/**
 * @file QualityManager.js
 * @description Adaptive render-quality controller.
 *
 * Canvas `shadowBlur` is by far the most expensive thing this game draws: every call that
 * has a non-zero blur forces the browser to rasterise the shape to a temporary layer and blur it.
 * On phones that is the difference between 60 FPS and a slideshow.
 *
 * Tiers (best -> cheapest):
 *   high   - desktop default. Full glow everywhere.
 *   medium - phones. Entities keep a softer glow, per-particle glow is off.
 *   low    - weak / throttled devices. No shadow blur at all, 1x DPR, cheaper lightmap.
 *
 * The manager starts at a tier picked from the device, then watches the real frame time and
 * steps DOWN one tier when the device clearly cannot keep up. It never steps back up on its own,
 * so quality cannot oscillate (which would itself cause visible hitches).
 */

export const QUALITY_TIERS = {
  high: {
    name: 'high',
    glowScale: 1,        // multiplier applied to every ctx.shadowBlur assignment
    particleGlow: true,  // per-particle shadow glow
    dprCapMobile: 1.5,
    dprCapDesktop: 2.0,
    lightScale: 0.5,     // lightmap resolution relative to the screen
    particleFactor: 1,   // multiplier on the particle budget
    bgIntervalMs: 0,     // 0 = repaint the animated background every frame
    dynamicLighting: true,
    shadowEffects: true,
    glowEffects: true,
    backgroundAnimations: true,
    screenShake: true,
    resolutionScale: 1.0
  },
  medium: {
    name: 'medium',
    glowScale: 0.6,
    particleGlow: false,
    dprCapMobile: 1.5,
    dprCapDesktop: 1.5,
    lightScale: 0.4,
    particleFactor: 1,
    bgIntervalMs: 33,    // background repainted at ~30 FPS into a cached layer
    dynamicLighting: true,
    shadowEffects: true,
    glowEffects: true,
    backgroundAnimations: true,
    screenShake: true,
    resolutionScale: 1.0
  },
  low: {
    name: 'low',
    glowScale: 0,
    particleGlow: false,
    dprCapMobile: 1,
    dprCapDesktop: 1,
    lightScale: 0.3,
    particleFactor: 0.55,
    bgIntervalMs: 50,    // ~20 FPS
    dynamicLighting: false,
    shadowEffects: false,
    glowEffects: false,
    backgroundAnimations: false,
    screenShake: false,
    resolutionScale: 0.85
  }
};

const ORDER = ['high', 'medium', 'low'];

// Frame-time sampling. 1000/45 ~ 22 ms: below ~45 FPS we consider the device to be struggling.
const SAMPLE_FRAMES = 60;
const SLOW_FRAME_MS = 22;
// A device this slow (<25 FPS) will not recover by shedding one tier: skip straight past the next one.
const VERY_SLOW_FRAME_MS = 40;
// Ignore the first moments of a session / state change, they are dominated by JIT warm-up.
const WARMUP_MS = 3000;

export class QualityManager {
  /**
   * @param {{ isMobile?: boolean, lowEndDevice?: boolean, initialTier?: 'high'|'medium'|'low', allowStepUp?: boolean }} [opts]
   */
  constructor(opts = {}) {
    const isMobile = !!opts.isMobile;
    const lowEnd = opts.lowEndDevice !== undefined ? !!opts.lowEndDevice : QualityManager.detectLowEnd();

    let tier = opts.initialTier;
    if (!tier) {
      if (lowEnd) tier = 'low';
      else tier = isMobile ? 'medium' : 'high';
    }

    this.isMobile = isMobile;
    this.tier = QUALITY_TIERS[tier] ? tier : 'high';
    this.settings = QUALITY_TIERS[this.tier];
    this.listeners = [];

    // When the player picks a fixed graphics tier, the adaptive step-down must leave it alone
    this.locked = false;

    // Optional bidirectional adaptation (default: false to preserve strict step-down stability)
    this.allowStepUp = !!opts.allowStepUp;

    // Fine-grained option overrides
    this._customOverrides = {};

    this._frameCount = 0;
    this._accumMs = 0;
    this._warmupLeft = WARMUP_MS;
    this._cooldownLeft = 0;
    this._fastFrames = 0;
  }

  /** Heuristic for weak phones: few cores or little RAM, or the user asked the OS to save data. */
  static detectLowEnd() {
    if (typeof navigator === 'undefined') return false;
    const cores = navigator.hardwareConcurrency || 8;
    const mem = navigator.deviceMemory || 4; // Chromium only; undefined elsewhere -> assume OK
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    return cores <= 3 || mem <= 2 || saveData;
  }

  get glowScale() {
    if (this._customOverrides.glowEffects === false || this._customOverrides.shadowEffects === false) return 0;
    return this.settings.glowScale;
  }
  get particleGlow() {
    if (this._customOverrides.glowEffects === false) return false;
    return this.settings.particleGlow;
  }
  get lightScale() { return this.settings.lightScale; }
  get particleFactor() {
    if (this._customOverrides.particleDensity !== undefined) return this._customOverrides.particleDensity;
    return this.settings.particleFactor;
  }
  get bgIntervalMs() {
    if (this._customOverrides.backgroundAnimations === false) return 999999999;
    return this.settings.bgIntervalMs;
  }

  // --- Configurable individual graphics options ---
  get particleDensity() {
    return this._customOverrides.particleDensity !== undefined ? this._customOverrides.particleDensity : this.settings.particleFactor;
  }
  get glowEffects() {
    return this._customOverrides.glowEffects !== undefined ? this._customOverrides.glowEffects : (this.settings.glowEffects !== false && this.settings.glowScale > 0);
  }
  get shadowEffects() {
    return this._customOverrides.shadowEffects !== undefined ? this._customOverrides.shadowEffects : (this.settings.shadowEffects !== false && this.settings.glowScale > 0);
  }
  get backgroundAnimations() {
    return this._customOverrides.backgroundAnimations !== undefined ? this._customOverrides.backgroundAnimations : (this.settings.backgroundAnimations !== false);
  }
  get screenShake() {
    return this._customOverrides.screenShake !== undefined ? this._customOverrides.screenShake : (this.settings.screenShake !== false);
  }
  get dynamicLighting() {
    return this._customOverrides.dynamicLighting !== undefined ? this._customOverrides.dynamicLighting : (this.settings.dynamicLighting !== false);
  }
  get resolutionScale() {
    return this._customOverrides.resolutionScale !== undefined ? this._customOverrides.resolutionScale : (this.settings.resolutionScale || 1.0);
  }

  /**
   * Set an individual graphics option override
   * @param {'particleDensity'|'glowEffects'|'shadowEffects'|'backgroundAnimations'|'screenShake'|'dynamicLighting'|'resolutionScale'} option
   * @param {*} value
   */
  setOption(option, value) {
    if (option === 'particleDensity' || option === 'resolutionScale') {
      const num = Number(value);
      if (!Number.isFinite(num)) return;
      this._customOverrides[option] = Math.max(0.2, Math.min(2.0, num));
    } else {
      this._customOverrides[option] = !!value;
    }
    this._notifyChange(this.settings, this.settings);
  }

  /** Reset all individual option overrides to match active tier */
  resetOptions() {
    this._customOverrides = {};
    this._notifyChange(this.settings, this.settings);
  }

  /** Device-pixel-ratio cap for the main canvas at the current tier. */
  getDprCap() {
    return this.isMobile ? this.settings.dprCapMobile : this.settings.dprCapDesktop;
  }

  /** Subscribe to tier changes. Callback receives (settings, previousSettings). */
  onChange(fn) {
    this.listeners.push(fn);
  }

  _notifyChange(current, prev) {
    for (const fn of this.listeners) {
      try { fn(current, prev); } catch (e) { /* a bad listener must not break the loop */ }
    }
  }

  setTier(name) {
    if (!QUALITY_TIERS[name] || name === this.tier) return false;
    const prev = this.settings;
    this.tier = name;
    this.settings = QUALITY_TIERS[name];
    this._notifyChange(this.settings, prev);
    return true;
  }

  forceTier(name) {
    if (QUALITY_TIERS[name]) {
      const prev = this.settings;
      this.tier = name;
      this.settings = QUALITY_TIERS[name];
      this._notifyChange(this.settings, prev);
    }
  }

  recordFrame(frameMs) {
    this.sampleFrame(frameMs);
  }

  get mode() {
    return this.locked ? this.tier : 'auto';
  }

  setMode(mode) {
    this.setPreference(mode);
  }

  /**
   * Player preference: 'auto' (adapt to the device, the default) or a fixed tier name.
   * A fixed tier is applied immediately and is never lowered automatically.
   * @param {'auto'|'high'|'medium'|'low'} pref
   */
  setPreference(pref) {
    if (pref === 'auto') {
      this.locked = false;
      this.resetSampling(1500);
      return;
    }
    if (!QUALITY_TIERS[pref]) return;
    this.locked = true;
    this.setTier(pref);
  }

  /** Drop one tier. Returns false if already at the lowest. */
  stepDown() {
    const idx = ORDER.indexOf(this.tier);
    if (idx < 0 || idx >= ORDER.length - 1) return false;
    this._fastFrames = 0;
    this._cooldownLeft = 5000;
    return this.setTier(ORDER[idx + 1]);
  }

  /** Step up one tier. Returns false if already at the highest. */
  stepUp() {
    const idx = ORDER.indexOf(this.tier);
    if (idx <= 0) return false;
    this._fastFrames = 0;
    this._cooldownLeft = 6000;
    return this.setTier(ORDER[idx - 1]);
  }

  /**
   * Feed one frame's duration (ms). Call once per rendered frame while the game is actually running.
   * Large gaps (tab was hidden, state change) are ignored so they cannot trigger a downgrade.
   */
  sampleFrame(frameMs) {
    if (this.locked) return;
    if (!(frameMs > 0) || frameMs > 250) return;

    if (this._cooldownLeft > 0) {
      this._cooldownLeft -= frameMs;
    }

    if (this._warmupLeft > 0) {
      this._warmupLeft -= frameMs;
      return;
    }

    this._accumMs += frameMs;
    this._frameCount++;

    // Track fast frame performance for step-up when allowed
    if (this.allowStepUp && frameMs < 14.0) {
      this._fastFrames++;
    } else if (frameMs > 20.0) {
      this._fastFrames = Math.max(0, this._fastFrames - 10);
    }

    if (this._frameCount >= SAMPLE_FRAMES) {
      const avg = this._accumMs / this._frameCount;
      this._frameCount = 0;
      this._accumMs = 0;

      if (avg > SLOW_FRAME_MS && this._cooldownLeft <= 0) {
        // After a downgrade give the new tier a moment to settle before judging it.
        let changed = this.stepDown();
        if (changed && avg > VERY_SLOW_FRAME_MS) this.stepDown();
        if (changed) this._warmupLeft = 1500;
      } else if (this.allowStepUp && this._fastFrames >= 180 && this._cooldownLeft <= 0 && this.tier !== 'high') {
        // Consistently capable device with solid 60+ FPS headroom over extended duration
        this.stepUp();
        this._warmupLeft = 1500;
      }
    }
  }

  /** Restart the warm-up window, e.g. after returning from a hidden tab. */
  resetSampling(extraWarmupMs = 1000) {
    this._frameCount = 0;
    this._accumMs = 0;
    this._fastFrames = 0;
    this._warmupLeft = Math.max(this._warmupLeft, extraWarmupMs);
  }
}

/**
 * Route every `ctx.shadowBlur = x` through the quality tier without touching the ~90 call sites.
 * The accessor is installed on the context *instance*, so it survives canvas resizes
 * (which reset context state but not own properties).
 *
 * `getBlur` is called on every assignment so tier changes take effect immediately.
 * Reading `ctx.shadowBlur` returns the value the game code last wrote, not the scaled one.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {() => number} getBlur returns the current glow multiplier
 * @returns {boolean} true if the hook was installed
 */
export function installShadowBlurScaler(ctx, getBlur) {
  try {
    if (!ctx || ctx.__shadowScalerInstalled) return false;
    const proto = Object.getPrototypeOf(ctx);
    const desc = proto && Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    if (!desc || typeof desc.set !== 'function' || typeof desc.get !== 'function') return false;

    let raw = 0;
    Object.defineProperty(ctx, 'shadowBlur', {
      configurable: true,
      enumerable: true,
      get() { return raw; },
      set(v) {
        raw = v;
        desc.set.call(this, v * getBlur());
      }
    });
    Object.defineProperty(ctx, '__shadowScalerInstalled', { value: true });
    return true;
  } catch (e) {
    return false;
  }
}
