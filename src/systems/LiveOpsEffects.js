/**
 * @file LiveOpsEffects.js
 * @description The "special visual effects" of a live event: a colour wash over the arena and a light layer of ambient
 * particles (snow, embers, stars, petals, sparkles). Purely decorative: it never touches gameplay state and is skipped
 * entirely when the `liveops.effects` flag is off (LiveOpsService hands over `none`).
 *
 * Cost is bounded on purpose: one translucent fill plus at most MAX_PARTICLES small shapes, one fillStyle for the whole
 * layer. The low quality tier and a "reduce motion" preference keep the wash and drop the particles. No shadowBlur,
 * and particles are recycled in place.
 */

import { VISUAL_THEMES, AMBIENT_EFFECTS } from '../../shared/live-ops/contract.js';

export const MAX_PARTICLES = 48;

/** Colour wash per theme: [css colour, alpha] (drawn over the level background, under ghosts and Momo) */
export const THEME_WASH = {
  none: null,
  frost: ['#7dd3fc', 0.10],
  ember: ['#fb923c', 0.10],
  twilight: ['#6366f1', 0.14],
  gold: ['#facc15', 0.09],
  verdant: ['#4ade80', 0.09],
  blossom: ['#f9a8d4', 0.10]
};

/** Particle look per ambient effect: colour, size range, fall speed (px/s, negative = rises), sway, shape */
const AMBIENT = {
  snow: { color: '#f8fafc', size: [1.5, 3.5], speed: [28, 60], sway: 18, shape: 'dot' },
  embers: { color: '#fdba74', size: [1.2, 2.8], speed: [-70, -30], sway: 22, shape: 'dot' },
  stars: { color: '#fef9c3', size: [1.5, 3.2], speed: [0, 0], sway: 0, shape: 'star' },
  petals: { color: '#fbcfe8', size: [3, 5.5], speed: [26, 48], sway: 34, shape: 'petal' },
  sparkles: { color: '#fde68a', size: [1.5, 3.4], speed: [0, 0], sway: 0, shape: 'star' }
};

export class LiveOpsEffects {
  constructor() {
    this.theme = 'none';
    this.ambient = 'none';
    this.time = 0;
    this._particles = [];
    this._width = 0;
    this._height = 0;
    this.reducedMotion = false;
    try {
      this.reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        && Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { /* no matchMedia: motion stays on */ }
  }

  /** @returns {boolean} whether anything is drawn at all */
  get active() {
    return THEME_WASH[this.theme] !== null || this.ambient !== 'none';
  }

  /**
   * @param {{theme: string, ambient: string}} visual an unknown value is treated as "none"
   */
  set(visual) {
    const theme = visual && VISUAL_THEMES.includes(visual.theme) ? visual.theme : 'none';
    const ambient = visual && AMBIENT_EFFECTS.includes(visual.ambient) ? visual.ambient : 'none';
    if (theme === this.theme && ambient === this.ambient) return;
    this.theme = theme;
    this.ambient = ambient;
    this._particles.length = 0; // re-seeded on the next update, for the new look
  }

  /** The number of particles for a quality tier ('low' keeps none) */
  particleCount(tier) {
    if (this.ambient === 'none' || this.reducedMotion || tier === 'low') return 0;
    return tier === 'medium' ? Math.round(MAX_PARTICLES * 0.5) : MAX_PARTICLES;
  }

  /** Fill `p` (a new object, or a particle that left the screen) with a fresh position and look */
  _spawn(spec, width, height, anywhere, p = {}) {
    const rand = (a, b) => a + Math.random() * (b - a);
    p.x = rand(0, width);
    p.y = anywhere ? rand(0, height) : (spec.speed[0] < 0 ? height + 8 : -8);
    p.size = rand(spec.size[0], spec.size[1]);
    p.vy = rand(spec.speed[0], spec.speed[1]);
    p.phase = rand(0, Math.PI * 2);
    p.twinkle = rand(0.8, 2.2);
    return p;
  }

  update(dt, width, height, tier = 'high') {
    if (!this.active) return;
    this.time += dt;
    const spec = AMBIENT[this.ambient];
    const want = spec ? this.particleCount(tier) : 0;
    const list = this._particles;
    if (width !== this._width || height !== this._height) {
      this._width = width;
      this._height = height;
      list.length = 0;
    }
    while (list.length < want) list.push(this._spawn(spec, width, height, true));
    if (list.length > want) list.length = want;
    if (!spec) return;
    for (const p of list) {
      p.y += p.vy * dt;
      if (p.vy > 0 ? p.y > height + 10 : p.vy < 0 && p.y < -10) this._spawn(spec, width, height, false, p);
    }
  }

  render(ctx, width, height) {
    if (!this.active) return;
    const wash = THEME_WASH[this.theme];
    if (wash) {
      ctx.save();
      ctx.globalAlpha = wash[1];
      ctx.fillStyle = wash[0];
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    const spec = AMBIENT[this.ambient];
    const list = this._particles;
    if (!spec || list.length === 0) return;
    ctx.save();
    ctx.fillStyle = spec.color;
    for (const p of list) {
      const x = p.x + Math.sin(this.time * 0.9 + p.phase) * spec.sway;
      if (spec.shape === 'star') {
        // Twinkle in place: size breathes, drawn as a plus so it needs no path
        const s = p.size * (0.55 + 0.45 * Math.sin(this.time * p.twinkle + p.phase));
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x - s, p.y - s * 0.28, s * 2, s * 0.56);
        ctx.fillRect(x - s * 0.28, p.y - s, s * 0.56, s * 2);
      } else if (spec.shape === 'petal' && typeof ctx.ellipse === 'function') {
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.ellipse(x, p.y, p.size, p.size * 0.55, p.phase + this.time * 0.7, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        ctx.arc(x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}
