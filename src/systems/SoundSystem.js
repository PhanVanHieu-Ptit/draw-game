/**
 * @file SoundSystem.js
 * @description Pure Web Audio API Sound Synthesizer module for Arcane Paws: Spellscribe.
 * Generates all audio procedurally using OscillatorNodes, BiquadFilterNodes, and GainNodes.
 * Zero external audio files required. Completely standalone with automatic AudioContext
 * unlocking on first user interaction in compliance with modern browser autoplay policies.
 * 
 * Audio Programmer Specification:
 * 1. soundDraw(speed): Gentle rushing wind whoosh, frequency dynamically tracking mouse speed.
 * 2. soundSpellSuccess(gesture): Crisp magical explosion transient with shimmering high crystal chime (800Hz - 1600Hz).
 * 3. soundGhostVanish(): Ghost dissipating into void (downward frequency sweep + low-pass filter cutoff sweep).
 * 4. soundDamage(): Heavy concussive sub-bass impact alerting player damage.
 * 5. soundBossCast(): Urgent, ominous siren alarm warning of incoming Boss AoE devastation.
 * 6. Automatic AudioContext resume on first user interaction.
 */

/**
 * Authentic Google Doodle Halloween 2016 (Magic Cat Academy) Audio Sprite Map.
 * Extracted directly from official Google Doodle audio sheets (main.mp3, victory.mp3, initial.mp3, end.mp3).
 */
export const AUDIO_SPRITES = {
  // main.mp3 sprites
  bgm: { file: 'main', start: 31.308549, duration: 25.263175, loop: true },
  spell_slash: { file: 'main', start: 70.241565, duration: 0.98356 },     // Kb: basic spell slash
  combo_1: { file: 'main', start: 72.225125, duration: 1.160 },           // Wb: combo level 1
  combo_2: { file: 'main', start: 74.385125, duration: 1.248 },           // Dc: combo level 2
  combo_3: { file: 'main', start: 76.633129, duration: 1.387 },           // Ec: combo level 3
  combo_4: { file: 'main', start: 79.019796, duration: 1.483 },           // Fc: combo level 4
  spell_heart: { file: 'main', start: 86.341088, duration: 1.625397 },   // Ic: heart heal spell
  spell_lightning: { file: 'main', start: 88.966485, duration: 2.066576 }, // Jc: lightning storm spell
  cat_hurt: { file: 'main', start: 18.89415, duration: 1.984014 },        // tc: cat hurt meow
  ghost_vanish: { file: 'main', start: 60.31322, duration: 1.335147 },   // wc: ghost defeated/dissolves
  combo_fizzle: { file: 'main', start: 57.571723, duration: 1.741497 },   // Tb: combo lost/fizzle
  level_start: { file: 'main', start: 68.073311, duration: 1.168254 },   // Bc: level start ready
  level_clear: { file: 'main', start: 65.500159, duration: 1.573152 },   // Vb: wave/stage clear
  boss_intro: { file: 'main', start: 0, duration: 3.160816 },             // kc: boss apparition
  // victory.mp3
  victory: { file: 'victory', start: 0, duration: 18.413424 },            // Ib: grand victory fanfare
  // initial.mp3
  intro: { file: 'initial', start: 0, duration: 16.921542 },              // vb: spooky intro cutscene
  // end.mp3
  game_over: { file: 'end', start: 0, duration: 1.933333 }                // Ob: game over chime
};

export class SoundSystem {
  /**
   * @param {Object} [options={}]
   * @param {number} [options.masterVolume=0.8] Master volume (0.0 to 1.0)
   * @param {boolean} [options.autoUnlock=true] Whether to listen for window user gestures to resume AudioContext
   */
  constructor(options = {}) {
    this.volume = options.masterVolume !== undefined ? Math.max(0, Math.min(1, options.masterVolume)) : 0.8;
    this.isMuted = false;

    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;
    /** @type {DynamicsCompressorNode|null} */
    this.compressor = null;

    // Active continuous draw voice state
    this._drawVoice = null;
    this._drawFadeTimeout = null;
    this._lastDrawX = null;
    this._lastDrawY = null;
    this._lastDrawTime = null;

    // Background Music (BGM) Procedural Synthesizer & Authentic Audio state
    this.bgmGain = null;
    this.bgmVolume = options.bgmVolume !== undefined ? Math.max(0, Math.min(1, options.bgmVolume)) : 0.35;
    this.isBGMPlaying = false;
    this.isBGMPaused = false;
    this._bgmInterval = null;
    this._bgmNextNoteTime = 0;
    this._bgmStep = 0;

    // Authentic Google Doodle Halloween 2016 Audio Tracks (Buffer & Source tracking)
    this._audioBuffers = {};
    this._currentBGMSource = null;
    this._loadingTracks = {};
    this._currentOneShots = [];

    // Browser policy unlock state
    this._unlocked = false;
    this._unlockHandler = null;

    if (options.autoUnlock !== false) {
      this._setupAutoUnlock();
    }
  }

  /* -------------------------------------------------------------------------
   * AudioContext Lifecycle & Browser Autoplay Compliance
   * ------------------------------------------------------------------------- */

  /**
   * Lazily initialize AudioContext and master signal chain
   * @returns {AudioContext|null}
   */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('[SoundSystem] Web Audio API is not supported in this browser environment.');
      return null;
    }

    try {
      this.ctx = new AudioContextClass();

      // Master Dynamics Compressor: prevents digital clipping/distortion when multiple SFX overlap
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      // Master Gain Node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0.0001 : this.volume, this.ctx.currentTime);

      // Connect: Master Gain -> Compressor -> Destination
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);

      // BGM Gain Node connected to masterGain
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.isMuted ? 0.0001 : this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._unlocked = true;
          this.preloadAudio();
          if (this.isBGMPlaying && !this.isBGMPaused) {
            this.resumeBGM();
          }
        }).catch(() => {});
      } else {
        this._unlocked = true;
        this.preloadAudio();
      }
    } catch (err) {
      console.warn('[SoundSystem] Failed to initialize AudioContext:', err);
    }

    return this.ctx;
  }

  /**
   * Ensure AudioContext is instantiated and running before generating audio
   * @private
   * @returns {boolean} True if ready to play audio
   */
  _ensureReady() {
    if (this.isMuted) return false;

    if (!this.ctx) {
      this.init();
    }

    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this._unlocked = true;
      }).catch(() => {});
      return false; // Still suspended until user gesture event loop settles
    }

    return true;
  }

  /**
   * Setup global user-gesture listeners to automatically resume AudioContext
   * @private
   */
  _setupAutoUnlock() {
    if (typeof window === 'undefined') return;

    const unlockEvents = ['pointerdown', 'mousedown', 'touchstart', 'keydown'];

    this._unlockHandler = () => {
      if (!this.ctx) {
        this.init();
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume().then(() => {
          this._unlocked = true;
          if (this.isBGMPlaying && !this.isBGMPaused) {
            this.resumeBGM();
          }
        }).catch(() => {});
      } else {
        this._unlocked = true;
      }

      if (this._unlocked && this.ctx && this.ctx.state === 'running') {
        // Clean up listeners once unlocked
        unlockEvents.forEach(evt => {
          window.removeEventListener(evt, this._unlockHandler, { capture: true });
        });
      }
    };

    unlockEvents.forEach(evt => {
      window.addEventListener(evt, this._unlockHandler, { capture: true, passive: true });
    });
  }

  /**
   * Explicitly resume AudioContext (returns Promise)
   * @returns {Promise<string>}
   */
  async resume() {
    const ctx = this.init();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
      this._unlocked = true;
    }
    return ctx ? ctx.state : 'unsupported';
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   * @param {number} val 
   */
  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0.0001 : this.volume,
        now + 0.05
      );
    }
  }

  /**
   * Toggle mute state
   * @returns {boolean} New isMuted state
   */
  toggleMute() {
    return this.setMute(!this.isMuted);
  }

  /**
   * Set mute state explicitly
   * @param {boolean} muted 
   * @returns {boolean}
   */
  setMute(muted) {
    this.isMuted = !!muted;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0.0001 : this.volume,
        now + 0.05
      );
    }
    if (this.bgmGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0.0001 : this.bgmVolume,
        now + 0.05
      );
    }
    if (this.isMuted) {
      this.stopDraw();
    }
    return this.isMuted;
  }

  /* -------------------------------------------------------------------------
   * 1. soundDraw(speed): Âm gió rít nhẹ, tần số thay đổi theo tốc độ chuột
   * ------------------------------------------------------------------------- */

  /**
   * Plays/modulates continuous rushing wind whoosh tracking gesture drawing speed.
   * Uses dual detuned oscillators (Sine + Triangle) routed through a resonant
   * bandpass filter. Pitch and filter resonance scale dynamically with velocity.
   * 
   * @param {number} [speed=0] Speed in pixels per second or normalized velocity (0 - 2000+)
   */
  soundDraw(speed = 0) {
    if (!this._ensureReady()) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Normalize velocity factor between 0.0 and 1.0 (saturates around 1800 px/s)
    const normSpeed = Math.min(1.0, Math.max(0.0, speed / 1800));

    // Dynamic acoustic properties
    // Base frequency: 220Hz (gentle breeze) up to 960Hz (rushing gale whistle)
    const targetFreq = 220 + normSpeed * 740;
    // Resonant bandpass filter center: 380Hz up to 2100Hz
    const targetFilterCutoff = 380 + normSpeed * 1720;
    // Target gain: whisper quiet at standstill up to 0.18 when dashing
    const targetGain = normSpeed > 0.03 ? (0.02 + normSpeed * 0.16) : 0.0001;

    // Lazily create continuous voice if not existing or stopped
    if (!this._drawVoice) {
      try {
        const osc1 = ctx.createOscillator(); // Fundamental whistling wave
        const osc2 = ctx.createOscillator(); // Detuned air turbulence wave
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(targetFreq, now);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(targetFreq * 1.015, now); // +25 cents detune for breathy shimmer

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(targetFilterCutoff, now);
        filter.Q.setValueAtTime(3.2, now); // Resonant airy whistle

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 0.04);

        // Routing: [osc1, osc2] -> filter -> gain -> masterGain
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc1.start(now);
        osc2.start(now);

        this._drawVoice = { osc1, osc2, filter, gain };
      } catch (e) {
        return;
      }
    } else {
      // Modulate running voice with micro-ramps (40ms) to ensure smooth glide without clicks
      const { osc1, osc2, filter, gain } = this._drawVoice;

      osc1.frequency.cancelScheduledValues(now);
      osc1.frequency.linearRampToValueAtTime(targetFreq, now + 0.04);

      osc2.frequency.cancelScheduledValues(now);
      osc2.frequency.linearRampToValueAtTime(targetFreq * 1.015, now + 0.04);

      filter.frequency.cancelScheduledValues(now);
      filter.frequency.linearRampToValueAtTime(targetFilterCutoff, now + 0.04);

      gain.gain.cancelScheduledValues(now);
      gain.gain.linearRampToValueAtTime(targetGain, now + 0.04);
    }

    // Auto-silence voice if no subsequent motion received within 120ms
    if (this._drawFadeTimeout) {
      clearTimeout(this._drawFadeTimeout);
    }
    this._drawFadeTimeout = setTimeout(() => {
      this.stopDraw();
    }, 120);
  }

  /**
   * Helper to feed raw coordinate updates into soundDraw, computing speed automatically
   * @param {number} x Current X
   * @param {number} y Current Y
   */
  feedDrawCoord(x, y) {
    const nowTime = performance.now();
    if (this._lastDrawX !== null && this._lastDrawY !== null && this._lastDrawTime !== null) {
      const dt = Math.max(0.001, (nowTime - this._lastDrawTime) / 1000);
      const dx = x - this._lastDrawX;
      const dy = y - this._lastDrawY;
      const dist = Math.hypot(dx, dy);
      const speed = dist / dt; // pixels per second
      this.soundDraw(speed);
    } else {
      this.soundDraw(100);
    }
    this._lastDrawX = x;
    this._lastDrawY = y;
    this._lastDrawTime = nowTime;
  }

  /**
   * Smoothly fades out and closes active drawing wind voice
   */
  stopDraw() {
    this._lastDrawX = null;
    this._lastDrawY = null;
    this._lastDrawTime = null;

    if (this._drawFadeTimeout) {
      clearTimeout(this._drawFadeTimeout);
      this._drawFadeTimeout = null;
    }

    if (!this._drawVoice || !this.ctx) return;

    const { osc1, osc2, gain } = this._drawVoice;
    const now = this.ctx.currentTime;

    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(0.0001, now + 0.08);

    setTimeout(() => {
      try {
        osc1.stop();
        osc2.stop();
        osc1.disconnect();
        osc2.disconnect();
      } catch (e) {}
    }, 90);

    this._drawVoice = null;
  }

  /* -------------------------------------------------------------------------
   * 2. soundSpellSuccess(): Tiếng nổ phép giòn, âm sắc crystal/chime (800Hz - 1600Hz)
   * ------------------------------------------------------------------------- */

  /**
   * Plays a crisp magical burst accompanied by high-register crystalline chiming harmonics.
   * Architecture:
   * Layer A: Crisp snap/percussive click (2400Hz -> 600Hz in 25ms).
   * Layer B: Crystalline chime triad in 800Hz - 1600Hz range with bell-like exponential decay.
   * Layer C: Shimmering highpass sparkle overtone.
   * 
   * @param {string} [gesture='default'] Optional rune ID for subtle melodic variations
   */
  soundSpellSuccess(gesture = 'default') {
    if (!this._ensureReady()) return;

    if (gesture === 'lightning') {
      this.soundLightning();
    }

    // Authentic Google Doodle SFX Sprite
    let spriteKey = 'spell_slash';
    if (gesture === 'heart') spriteKey = 'spell_heart';
    else if (gesture === 'lightning') spriteKey = 'spell_lightning';

    if (this.playAudioSprite(spriteKey, 0.95)) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // --- Layer A: Crisp Arcane Snap Transient ("Tiếng nổ phép thuật giòn") ---
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    const snapFilter = ctx.createBiquadFilter();

    snapOsc.type = 'triangle';
    // Rapid downward sweep for snappy percussive bite
    snapOsc.frequency.setValueAtTime(2600, now);
    snapOsc.frequency.exponentialRampToValueAtTime(450, now + 0.035);

    snapFilter.type = 'highpass';
    snapFilter.frequency.setValueAtTime(600, now);

    snapGain.gain.setValueAtTime(0.32, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    snapOsc.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.masterGain);

    snapOsc.start(now);
    snapOsc.stop(now + 0.05);

    // --- Layer B: High Crystal Chimes (800Hz - 1600Hz) ---
    // Frequency chords tuned to pure crystalline Pythagorean & Just intonations
    let chimePitches = [880, 1108.73, 1318.51, 1567.98]; // A5, C#6, E6, G6 (Crystal Major 7th)

    if (gesture === 'caret') {
      chimePitches = [987.77, 1244.51, 1479.98, 1661.22]; // High Apex Chime
    } else if (gesture === 'v_shape') {
      chimePitches = [830.61, 1046.50, 1244.51, 1479.98]; // Deep Resonant Chime
    } else if (gesture === 'lightning') {
      chimePitches = [1046.50, 1318.51, 1567.98, 1760.00]; // Electric Brilliant Chime
    } else if (gesture === 'heart') {
      chimePitches = [880, 1174.66, 1396.91, 1567.98]; // Fairy Blessing Chime
    }

    chimePitches.forEach((freq, idx) => {
      const chimeOsc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      const chimeFilter = ctx.createBiquadFilter();

      // Sine wave with slight triangle overtone for metallic crystal shimmer
      chimeOsc.type = idx % 2 === 0 ? 'sine' : 'triangle';

      // Micro-slide upward at attack (giving glass tension release sensation)
      chimeOsc.frequency.setValueAtTime(freq * 0.98, now + idx * 0.015);
      chimeOsc.frequency.exponentialRampToValueAtTime(freq, now + idx * 0.015 + 0.04);

      // Peaking filter to enhance crystal brilliance around 1400Hz
      chimeFilter.type = 'peaking';
      chimeFilter.frequency.setValueAtTime(1400, now);
      chimeFilter.Q.setValueAtTime(4.5, now);
      chimeFilter.gain.setValueAtTime(6, now);

      const startTime = now + idx * 0.018; // Staggered arpeggiated strike
      const duration = 0.42 + idx * 0.08;

      chimeGain.gain.setValueAtTime(0.0001, startTime);
      chimeGain.gain.linearRampToValueAtTime(0.18 / (1 + idx * 0.25), startTime + 0.012);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      chimeOsc.connect(chimeFilter);
      chimeFilter.connect(chimeGain);
      chimeGain.connect(this.masterGain);

      chimeOsc.start(startTime);
      chimeOsc.stop(startTime + duration);
    });
  }

  /* -------------------------------------------------------------------------
   * 3. soundGhostVanish(): Tiếng quái tan biến (hạ tần số sweep down + Low-pass filter)
   * ------------------------------------------------------------------------- */

  /**
   * Plays the spectral dissolution sound of an enemy spirit vanishing into the nether.
   * Features a dual-oscillator pitch sweep downward coupled with a resonant Low-Pass filter
   * closing down dramatically (2200Hz down to 80Hz) to produce an eerie hollow "whooomph" suction.
   */
  soundGhostVanish() {
    if (!this._ensureReady()) return;

    if (this.playAudioSprite('ghost_vanish', 0.9)) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.45;

    // Rich harmonic oscillator (Sawtooth + Triangle) to provide rich material for Low-Pass filter
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    // Pitch sweep down: 560Hz down to sub-bass 55Hz
    osc1.frequency.setValueAtTime(560, now);
    osc1.frequency.exponentialRampToValueAtTime(55, now + duration);

    // Detuned second oscillator (-14 cents) for eerie ethereal beating
    osc2.frequency.setValueAtTime(550, now);
    osc2.frequency.exponentialRampToValueAtTime(50, now + duration);

    // Resonant Low-Pass Filter sweeping down from 2400Hz to 80Hz
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(4.8, now); // Accentuated resonance gives the ghost "whoosh" vocal formant
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + duration);

    // Amplitude envelope: instant swell then smooth dissolution
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Routing
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  /* -------------------------------------------------------------------------
   * 4. soundDamage(): Âm trầm giáng mạnh báo hiệu người chơi bị đánh trúng
   * ------------------------------------------------------------------------- */

  /**
   * Plays a heavy, visceral sub-bass impact alerting that the player has taken damage.
   * Architecture:
   * Layer A: Heavy Sub-bass punch (190Hz dropping to 36Hz in 60ms).
   * Layer B: Saturated crunch body (distorted low saw 85Hz -> 28Hz).
   * Layer C: Snappy slap transient (280Hz -> 60Hz in 25ms).
   */
  soundDamage() {
    if (!this._ensureReady()) return;

    this.playAudioSprite('cat_hurt', 1.0);

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const duration = 0.42;

    // --- Layer A: Sub-bass Punch (Body Impact) ---
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(190, now);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 0.07);
    subOsc.frequency.linearRampToValueAtTime(28, now + duration);

    subGain.gain.setValueAtTime(0.48, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);

    subOsc.start(now);
    subOsc.stop(now + duration);

    // --- Layer B: Saturated Low Sawtooth (Visceral Crunch) ---
    const sawOsc = ctx.createOscillator();
    const sawFilter = ctx.createBiquadFilter();
    const sawGain = ctx.createGain();

    sawOsc.type = 'sawtooth';
    sawOsc.frequency.setValueAtTime(95, now);
    sawOsc.frequency.exponentialRampToValueAtTime(32, now + 0.28);

    sawFilter.type = 'lowpass';
    sawFilter.frequency.setValueAtTime(260, now);
    sawFilter.Q.setValueAtTime(2.5, now);

    sawGain.gain.setValueAtTime(0.35, now);
    sawGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    sawOsc.connect(sawFilter);
    sawFilter.connect(sawGain);
    sawGain.connect(this.masterGain);

    sawOsc.start(now);
    sawOsc.stop(now + 0.3);

    // --- Layer C: Sharp Slap Transient ---
    const slapOsc = ctx.createOscillator();
    const slapGain = ctx.createGain();

    slapOsc.type = 'square';
    slapOsc.frequency.setValueAtTime(320, now);
    slapOsc.frequency.exponentialRampToValueAtTime(70, now + 0.028);

    slapGain.gain.setValueAtTime(0.22, now);
    slapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    slapOsc.connect(slapGain);
    slapGain.connect(this.masterGain);

    slapOsc.start(now);
    slapOsc.stop(now + 0.035);
  }

  /* -------------------------------------------------------------------------
   * 5. soundBossCast(): Âm báo động cảnh báo đòn đánh diện rộng của Boss
   * ------------------------------------------------------------------------- */

  /**
   * Plays an urgent, ominous klaxon alarm warning of an incoming Boss Area-of-Effect (AoE) attack.
   * Architecture:
   * 1. Three rapid piercing alert chirps (370Hz -> 520Hz, 440Hz -> 660Hz, 550Hz -> 880Hz).
   * 2. Menacing low sub-bass drone (55Hz) swelling underneath to build apocalyptic tension.
   */
  soundBossCast() {
    if (!this._ensureReady()) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // --- 1. Apocalyptic Sub-bass Drone Swell (55Hz / A1) ---
    const droneOsc = ctx.createOscillator();
    const droneFilter = ctx.createBiquadFilter();
    const droneGain = ctx.createGain();

    droneOsc.type = 'sawtooth';
    droneOsc.frequency.setValueAtTime(55, now);
    droneOsc.frequency.linearRampToValueAtTime(45, now + 0.9);

    droneFilter.type = 'lowpass';
    droneFilter.frequency.setValueAtTime(120, now);
    droneFilter.frequency.linearRampToValueAtTime(220, now + 0.6);
    droneFilter.frequency.linearRampToValueAtTime(60, now + 0.95);

    droneGain.gain.setValueAtTime(0.001, now);
    droneGain.gain.linearRampToValueAtTime(0.38, now + 0.55);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

    droneOsc.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.masterGain);

    droneOsc.start(now);
    droneOsc.stop(now + 0.95);

    // --- 2. Three Escalating Alarm Pulses (Urgent Siren) ---
    const pulses = [
      { start: 0.00, f1: 370, f2: 540, dur: 0.16 },
      { start: 0.18, f1: 440, f2: 660, dur: 0.16 },
      { start: 0.36, f1: 550, f2: 880, dur: 0.28 }
    ];

    pulses.forEach((p) => {
      const pOsc = ctx.createOscillator();
      const pSub = ctx.createOscillator(); // Triton dissonant interval
      const pFilter = ctx.createBiquadFilter();
      const pGain = ctx.createGain();

      const pTime = now + p.start;

      pOsc.type = 'sawtooth';
      pOsc.frequency.setValueAtTime(p.f1, pTime);
      pOsc.frequency.exponentialRampToValueAtTime(p.f2, pTime + p.dur);

      // Minor second / tritone dissonance for alarm tension
      pSub.type = 'square';
      pSub.frequency.setValueAtTime(p.f1 * 1.414, pTime); // sqrt(2) = Tritone
      pSub.frequency.exponentialRampToValueAtTime(p.f2 * 1.414, pTime + p.dur);

      pFilter.type = 'bandpass';
      pFilter.frequency.setValueAtTime(900, pTime);
      pFilter.Q.setValueAtTime(4.0, pTime);

      pGain.gain.setValueAtTime(0.001, pTime);
      pGain.gain.linearRampToValueAtTime(0.24, pTime + 0.02);
      pGain.gain.exponentialRampToValueAtTime(0.001, pTime + p.dur);

      pOsc.connect(pFilter);
      pSub.connect(pFilter);
      filterConnect: pFilter.connect(pGain);
      pGain.connect(this.masterGain);

      pOsc.start(pTime);
      pSub.start(pTime);
      pOsc.stop(pTime + p.dur);
      pSub.stop(pTime + p.dur);
    });
  }

  /* -------------------------------------------------------------------------
   * Additional Arcade Gameplay SFX & Compatibility Bridge
   * ------------------------------------------------------------------------- */

  /**
   * Dynamic ascending combo chime (Google Doodle authentic combo sound sprites: Wb, Dc, Ec, Fc)
   * @param {number} comboCount 
   */
  soundCombo(comboCount) {
    if (!this._ensureReady()) return;
    const comboTier = ((Math.max(1, comboCount) - 1) % 4) + 1;
    if (this.playAudioSprite(`combo_${comboTier}`, 0.95)) {
      return;
    }

    const baseFreq = 440;
    const semitones = Math.min(22, comboCount);
    const freq = baseFreq * Math.pow(2, semitones / 12);
    this._playTone(freq, 0.2, 'sine', 0.2);
  }

  /**
   * Spell fizzle / gesture mismatch sound (Google Doodle authentic combo lost sound sprite Tb)
   */
  soundFizzle() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('combo_fizzle', 0.85)) {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.16);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  /**
   * Health restore fanfare
   */
  soundHeal() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('spell_heart', 0.95)) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.32, 'sine', 0.18);
      }, idx * 60);
    });
  }

  /**
   * Game Over descending motif (plays authentic end.mp3 sprite if available)
   */
  soundGameOver() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('game_over', 0.95)) return;
    if (this._playOneShotBuffer('end')) return;

    // Procedural melancholic descending motif fallback
    const sequence = [440, 392, 349.23, 293.66, 220];
    sequence.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.45, 'sine', 0.24);
      }, idx * 180);
    });
  }

  /**
   * Game start / story intro fanfare (plays authentic level_start / initial.mp3 if available)
   */
  soundStart() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('level_start', 0.95)) return;
    if (this._playOneShotBuffer('initial')) return;

    // Procedural start fanfare fallback
    const sequence = [392, 523.25, 659.25, 783.99];
    sequence.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.25, 'triangle', 0.22);
      }, idx * 90);
    });
  }

  /**
   * Stage Victory fanfare (plays authentic victory.mp3 if available)
   */
  soundVictory() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('victory', 1.0)) return;
    if (this._playOneShotBuffer('victory')) return;

    // Procedural victory chime fallback
    const sequence = [293.66, 369.99, 440.00, 587.33, 739.99, 880.00];
    sequence.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.35, 'triangle', 0.22);
      }, idx * 100);
    });
  }

  /**
   * Stage / Wave Cleared Fanfare (Google Doodle authentic level clear sprite Vb)
   */
  soundWaveComplete() {
    if (!this._ensureReady()) return;
    if (this.playAudioSprite('level_clear', 0.95)) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this._playTone(freq, 0.3, 'triangle', 0.2);
      }, idx * 70);
    });
  }

  /**
   * Private helper to generate a pure tone with exponential envelope
   * @private
   */
  _playTone(freq, duration, type = 'sine', volume = 0.2) {
    if (!this._ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Powerful Thunderous Lightning Strike Sound Effect
   * Synthesizes electric arc zap, massive explosive thunderclap, sub-bass boom, and rolling thunder tail.
   */
  soundLightning() {
    if (!this._ensureReady()) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // 1. High-frequency electric zap / static crackle
    const zapOsc = ctx.createOscillator();
    const zapGain = ctx.createGain();
    const zapFilter = ctx.createBiquadFilter();

    zapOsc.type = 'sawtooth';
    zapOsc.frequency.setValueAtTime(3200, now);
    zapOsc.frequency.exponentialRampToValueAtTime(220, now + 0.07);

    zapFilter.type = 'bandpass';
    zapFilter.frequency.setValueAtTime(2400, now);
    zapFilter.Q.setValueAtTime(3.5, now);

    zapGain.gain.setValueAtTime(0.35, now);
    zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    zapOsc.connect(zapFilter);
    zapFilter.connect(zapGain);
    zapGain.connect(this.masterGain);

    zapOsc.start(now);
    zapOsc.stop(now + 0.08);

    // 2. Heavy Thunderclap Pop & Transient
    const clapOsc = ctx.createOscillator();
    const clapGain = ctx.createGain();
    const clapFilter = ctx.createBiquadFilter();

    clapOsc.type = 'square';
    clapOsc.frequency.setValueAtTime(1100, now + 0.01);
    clapOsc.frequency.exponentialRampToValueAtTime(90, now + 0.14);

    clapFilter.type = 'lowpass';
    clapFilter.frequency.setValueAtTime(1400, now + 0.01);
    clapFilter.frequency.exponentialRampToValueAtTime(240, now + 0.18);
    clapFilter.Q.setValueAtTime(4.2, now + 0.01);

    clapGain.gain.setValueAtTime(0.001, now);
    clapGain.gain.setValueAtTime(0.48, now + 0.015);
    clapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    clapOsc.connect(clapFilter);
    clapFilter.connect(clapGain);
    clapGain.connect(this.masterGain);

    clapOsc.start(now + 0.01);
    clapOsc.stop(now + 0.2);

    // 3. Sub-Bass Concussive Shockwave (Heavy chest thump)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now + 0.015);
    subOsc.frequency.exponentialRampToValueAtTime(36, now + 0.55);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.setValueAtTime(0.68, now + 0.025);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start(now + 0.015);
    subOsc.stop(now + 0.6);

    // 4. Low Rumbling Rolling Thunder Tail (Echoes across the night sky)
    const rumbleOsc = ctx.createOscillator();
    const rumbleFilter = ctx.createBiquadFilter();
    const rumbleGain = ctx.createGain();

    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(95, now + 0.06);
    rumbleOsc.frequency.linearRampToValueAtTime(48, now + 0.85);

    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(320, now + 0.06);
    rumbleFilter.frequency.exponentialRampToValueAtTime(80, now + 0.85);
    rumbleFilter.Q.setValueAtTime(3.8, now + 0.06);

    rumbleGain.gain.setValueAtTime(0.001, now + 0.06);
    rumbleGain.gain.linearRampToValueAtTime(0.38, now + 0.16);
    rumbleGain.gain.setValueAtTime(0.34, now + 0.35);
    rumbleGain.gain.linearRampToValueAtTime(0.22, now + 0.55);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    rumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);

    rumbleOsc.start(now + 0.06);
    rumbleOsc.stop(now + 0.9);

    // If web audio buffer is available in browser, mix in realistic white-noise thunderclap texture
    if (typeof ctx.createBuffer === 'function' && typeof ctx.createBufferSource === 'function') {
      try {
        const sampleRate = ctx.sampleRate || 44100;
        const bufLen = Math.floor(sampleRate * 0.4);
        const buffer = ctx.createBuffer(1, bufLen, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleRate * 0.12));
        }
        const noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = buffer;

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(800, now + 0.01);
        noiseFilter.Q.setValueAtTime(1.8, now + 0.01);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.45, now + 0.01);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

        noiseSrc.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGain);

        noiseSrc.start(now + 0.01);
        noiseSrc.stop(now + 0.38);
      } catch (err) {}
    }
  }

  /* -------------------------------------------------------------------------
   * Procedural Background Music (BGM) Sequencer
   * ------------------------------------------------------------------------- */

  /* -------------------------------------------------------------------------
   * Authentic Google Doodle Halloween 2016 Audio & Procedural BGM Sequencer
   * ------------------------------------------------------------------------- */

  /**
   * Preload audio tracks for authentic Google Doodle Halloween 2016 audio
   */
  preloadAudio() {
    if (typeof window === 'undefined') return;
    ['main', 'initial', 'victory', 'end'].forEach(name => {
      this._loadAudioTrack(name).catch(() => {});
    });
  }

  /**
   * Load and decode an audio track into an AudioBuffer with robust fallbacks
   * @param {string} name 'main' | 'initial' | 'victory' | 'end'
   * @returns {Promise<AudioBuffer|null>}
   */
  async _loadAudioTrack(name) {
    if (this._audioBuffers[name]) return this._audioBuffers[name];
    if (this._loadingTracks[name]) return this._loadingTracks[name];
    if (!this.ctx) return null;

    const promise = (async () => {
      const candidates = [
        `./assets/audio/${name}.mp3`,
        `assets/audio/${name}.mp3`,
        `/audio/${name}.mp3`,
        `audio/${name}.mp3`,
        `/${name}.mp3`,
        `https://www.google.com/logos/2016/halloween16/r4/${name}.mp3`
      ];

      for (const url of candidates) {
        try {
          const resp = await fetch(url);
          if (resp && resp.ok) {
            const arrayBuf = await resp.arrayBuffer();
            if (this.ctx) {
              const audioBuf = await this.ctx.decodeAudioData(arrayBuf);
              this._audioBuffers[name] = audioBuf;
              delete this._loadingTracks[name];

              // If BGM is playing and we just loaded 'main', switch to buffer
              if (name === 'main' && this.isBGMPlaying && !this.isBGMPaused && !this._currentBGMSource) {
                this._startBufferBGM();
              }
              return audioBuf;
            }
          }
        } catch (e) {
          // Continue to next candidate URL
        }
      }
      delete this._loadingTracks[name];
      return null;
    })();

    this._loadingTracks[name] = promise;
    return promise;
  }

  /**
   * Play an authentic Google Doodle audio sprite from decoded AudioBuffers
   * @param {string} spriteName Key in AUDIO_SPRITES
   * @param {number} [customVolume=1.0] Relative volume scale
   * @returns {boolean} True if played via authentic buffer sprite
   */
  playAudioSprite(spriteName, customVolume = 1.0) {
    if (!this._ensureReady()) return false;
    const sprite = AUDIO_SPRITES[spriteName];
    if (!sprite || !this.ctx || this.isMuted) return false;

    const buf = this._audioBuffers[sprite.file];
    if (!buf) {
      this._loadAudioTrack(sprite.file).catch(() => {});
      return false;
    }

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.isMuted ? 0.0001 : customVolume, this.ctx.currentTime);

      src.connect(gain);
      gain.connect(this.masterGain);

      src.start(0, sprite.start, sprite.duration);
      this._currentOneShots.push(src);

      src.onended = () => {
        const idx = this._currentOneShots.indexOf(src);
        if (idx !== -1) this._currentOneShots.splice(idx, 1);
      };
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Play a one-shot buffer (e.g., initial, victory, end)
   * @private
   * @param {string} name
   * @returns {boolean} True if played via buffer
   */
  _playOneShotBuffer(name) {
    if (!this.ctx || this.isMuted) return false;
    const buf = this._audioBuffers[name];
    if (!buf) {
      // Trigger preload for future calls
      this._loadAudioTrack(name).catch(() => {});
      return false;
    }

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.masterGain);
      src.start(0);
      this._currentOneShots.push(src);
      src.onended = () => {
        const idx = this._currentOneShots.indexOf(src);
        if (idx !== -1) this._currentOneShots.splice(idx, 1);
      };
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Start looping background music (Google Doodle OST with eerie procedural fallback)
   */
  startBGM() {
    this.isBGMPlaying = true;
    this.isBGMPaused = false;

    if (!this.ctx) {
      this.init();
    }
    if (!this.ctx) return;

    if (!this.bgmGain) {
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.isMuted ? 0.0001 : this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);
    }

    // If authentic Google Halloween main.mp3 buffer is ready, play it!
    if (this._audioBuffers['main']) {
      this._startBufferBGM();
      return;
    }

    // Try loading main.mp3 asynchronously
    this._loadAudioTrack('main').then(buf => {
      if (buf && this.isBGMPlaying && !this.isBGMPaused && !this._currentBGMSource) {
        this._startBufferBGM();
      }
    }).catch(() => {});

    // Meanwhile, run eerie procedural Halloween synth loop as instant fallback
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
    }

    this._bgmStep = 0;
    this._bgmNextNoteTime = this.ctx.currentTime + 0.05;

    this._bgmInterval = setInterval(() => {
      this._scheduleBGM();
    }, 60);
  }

  /**
   * Play the authentic Google Doodle main.mp3 buffer on seamless loop
   * Google Doodle Halloween 2016 BGM theme is slice Sb (31.308549s - 56.571724s)
   * @private
   */
  _startBufferBGM() {
    if (!this._audioBuffers['main'] || !this.ctx || this.isMuted || !this.isBGMPlaying || this.isBGMPaused) return;

    if (this._currentBGMSource) {
      try { this._currentBGMSource.stop(0); } catch (e) {}
      this._currentBGMSource = null;
    }

    // Stop procedural interval since authentic music is active
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }

    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this._audioBuffers['main'];
      src.loop = true;
      src.loopStart = 31.308549;
      src.loopEnd = 31.308549 + 25.263175;
      src.connect(this.bgmGain);
      src.start(0, 31.308549);
      this._currentBGMSource = src;
    } catch (err) {
      console.warn('[SoundSystem] Failed to start buffer BGM:', err);
    }
  }

  /**
   * Pause background music
   */
  pauseBGM() {
    this.isBGMPaused = true;
    if (this._currentBGMSource) {
      try { this._currentBGMSource.stop(0); } catch (e) {}
      this._currentBGMSource = null;
    }
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
  }

  /**
   * Resume background music
   */
  resumeBGM() {
    if (this.isBGMPlaying && this.isBGMPaused) {
      this.isBGMPaused = false;
      if (this._audioBuffers['main']) {
        this._startBufferBGM();
      } else {
        if (this.ctx) {
          this._bgmNextNoteTime = this.ctx.currentTime + 0.05;
          this._bgmInterval = setInterval(() => {
            this._scheduleBGM();
          }, 60);
        }
        this._loadAudioTrack('main').catch(() => {});
      }
    } else if (!this.isBGMPlaying) {
      this.startBGM();
    }
  }

  /**
   * Stop background music
   */
  stopBGM() {
    this.isBGMPlaying = false;
    this.isBGMPaused = false;
    if (this._currentBGMSource) {
      try { this._currentBGMSource.stop(0); } catch (e) {}
      this._currentBGMSource = null;
    }
    if (this._bgmInterval) {
      clearInterval(this._bgmInterval);
      this._bgmInterval = null;
    }
  }

  /**
   * Set BGM volume
   * @param {number} volume (0.0 to 1.0)
   */
  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgmGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.bgmGain.gain.cancelScheduledValues(now);
      this.bgmGain.gain.linearRampToValueAtTime(
        this.isMuted ? 0.0001 : this.bgmVolume,
        now + 0.05
      );
    }
  }

  /**
   * Eerie & Haunting ("Ma Mị") procedural Halloween BGM synthesizer
   * D Harmonic Minor progression with gothic music-box celesta, hollow cello bass, and ghostly theremin glides
   * @private
   */
  _scheduleBGM() {
    if (!this.ctx || this.isMuted || !this.isBGMPlaying || this.isBGMPaused) return;
    if (this._currentBGMSource) return; // Buffer is playing authentic music

    const stepDuration = 0.2586; // 116 BPM, 8th note duration
    const lookAhead = 0.25;

    // Spooky gothic bass: D minor -> Bb maj -> Gm -> A7(b9)
    const bassNotes = [
      73.42, 0, 73.42, 0, 87.31, 0, 55.00, 0,       // Dm (D2, D2, F2, A1)
      58.27, 0, 58.27, 0, 73.42, 0, 87.31, 0,       // Bb (Bb1, Bb1, D2, F2)
      49.00, 0, 49.00, 0, 58.27, 0, 73.42, 0,       // Gm (G1, G1, Bb1, D2)
      55.00, 0, 69.30, 0, 82.41, 0, 58.27, 0        // A7(b9) (A1, C#2, E2, Bb1)
    ];

    // Eerie music-box arpeggios with mystical chromatic tensions
    const arpeggios = [
      293.66, 349.23, 440.00, 587.33, 440.00, 349.23, 440.00, 554.37, // Dm (D4-F4-A4-D5 with C#5 ghost)
      293.66, 349.23, 466.16, 587.33, 466.16, 349.23, 466.16, 622.25, // Bb (Bb4 with Eb5 passing)
      293.66, 392.00, 466.16, 587.33, 466.16, 392.00, 466.16, 587.33, // Gm
      277.18, 329.63, 440.00, 554.37, 466.16, 349.23, 440.00, 554.37  // A7(b9) haunted finish
    ];

    // Haunting Halloween Lead Melody (Celesta & Ghostly Theremin Chime)
    const melodyNotes = {
      0: 587.33,   // D5
      2: 440.00,   // A4
      4: 698.46,   // F5
      6: 659.25,   // E5
      8: 587.33,   // D5
      10: 466.16,  // Bb4
      12: 587.33,  // D5
      14: 523.25,  // C5
      16: 466.16,  // Bb4
      18: 392.00,  // G4
      20: 466.16,  // Bb4
      22: 587.33,  // D5
      24: 554.37,  // C#5 (Haunting harmonic minor leading tone)
      26: 659.25,  // E5
      28: 440.00,  // A4
      30: 554.37   // C#5
    };

    while (this._bgmNextNoteTime < this.ctx.currentTime + lookAhead) {
      const step = this._bgmStep;
      const t = this._bgmNextNoteTime;

      // 1. Plucked Cello / Organ Bass Note
      const bassFreq = bassNotes[step];
      if (bassFreq > 0) {
        this._playBGMBass(bassFreq, t, stepDuration * 0.85);
      }

      // 2. Haunted Music-Box Arpeggio Tone
      const arpFreq = arpeggios[step];
      if (arpFreq > 0) {
        this._playBGMArp(arpFreq, t, 0.18);
      }

      // 3. Eerie Celesta & Ghostly Theremin Lead Melody
      if (melodyNotes[step] !== undefined) {
        this._playBGMMelody(melodyNotes[step], t, stepDuration * 0.95);
      }

      // 4. Subtle percussive tick on off-beats
      if (step % 2 === 1) {
        this._playBGMTick(t);
      }

      this._bgmNextNoteTime += stepDuration;
      this._bgmStep = (this._bgmStep + 1) % 32;
    }
  }

  /**
   * Warm hollow plucked bass voice for BGM
   * @private
   */
  _playBGMBass(freq, time, duration) {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, time);
      filter.frequency.exponentialRampToValueAtTime(65, time + duration);

      gain.gain.setValueAtTime(0.26, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  /**
   * Spooky music-box chime with delicate vibrato for BGM
   * @private
   */
  _playBGMArp(freq, time, duration) {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sine';
      // Subtle eerie vibrato
      osc.frequency.setValueAtTime(freq, time);
      osc.frequency.linearRampToValueAtTime(freq * 1.006, time + duration * 0.5);
      osc.frequency.linearRampToValueAtTime(freq * 0.995, time + duration);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.2, time);
      filter.Q.setValueAtTime(3.5, time);

      gain.gain.setValueAtTime(0.09, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  /**
   * Haunting celesta / ghostly theremin lead melody for BGM
   * @private
   */
  _playBGMMelody(freq, time, duration) {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);
      // Eerie slight portamento/glide
      osc.frequency.exponentialRampToValueAtTime(freq * 1.008, time + duration * 0.6);
      osc.frequency.exponentialRampToValueAtTime(freq, time + duration);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, time);
      filter.frequency.exponentialRampToValueAtTime(600, time + duration);

      gain.gain.setValueAtTime(0.20, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + duration);
    } catch (e) {}
  }

  /**
   * Delicate wood click / shaker for BGM rhythm
   * @private
   */
  _playBGMTick(time) {
    if (!this.ctx || !this.bgmGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(800, time);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, time);
      filter.Q.setValueAtTime(4, time);

      gain.gain.setValueAtTime(0.035, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(time);
      osc.stop(time + 0.025);
    } catch (e) {}
  }

  /* -------------------------------------------------------------------------
   * Aliases for seamless drop-in compatibility with legacy AudioSystem calls
   * ------------------------------------------------------------------------- */

  playSpell(gesture) {
    this.soundSpellSuccess(gesture);
  }

  playLightning() {
    this.soundLightning();
  }

  playEnemyDeath() {
    this.soundGhostVanish();
  }

  playHit() {
    this.soundGhostVanish();
  }

  playHurt() {
    this.soundDamage();
  }

  playCombo(count) {
    this.soundCombo(count);
  }

  playFizzle() {
    this.soundFizzle();
  }

  playStart() {
    this.soundStart();
  }

  playGameOver() {
    this.soundGameOver();
  }
}

