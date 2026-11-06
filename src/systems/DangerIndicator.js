/**
 * @file DangerIndicator.js
 * @description Pressure and awareness cues drawn over the playfield:
 *  - an arrow on the screen edge pointing at ghosts that are still outside the view (red and larger
 *    for fast ghosts and bosses, so the player knows where the next threat comes from);
 *  - a pulsing red edge glow and a heartbeat sound while Momo is on her last heart;
 *  - a cool blue edge tint during slow-motion "wow" moments.
 *
 * The glows are drawn from small cached canvases scaled up (smooth gradients are cheap to stretch and
 * expensive to rebuild), so a frame costs a couple of drawImage calls.
 */

const EDGE_INSET = 28;        // how far from the screen edge an arrow sits
const MAX_ARROWS = 10;
const BEAT_INTERVAL = 0.82;   // seconds between heartbeats on the last heart
const FAST_ETA = 2.2;         // a ghost that reaches Momo sooner than this is "fast"

export class DangerIndicator {
  constructor() {
    this.t = 0;
    this.critical = false;
    this._beatTimer = 0;
    this._beatAge = 10;      // seconds since the last beat
    this._vignettes = new Map();
    /** @type {Array<{x:number, y:number, angle:number, fast:boolean, size:number}>} reused every frame */
    this._arrows = [];
    // Pre-allocated arrow records, so collecting arrows never allocates during play
    this._pool = Array.from({ length: MAX_ARROWS }, () => ({ x: 0, y: 0, angle: 0, fast: false, size: 0 }));
  }

  /** @returns {boolean} whether the player is one hit from defeat */
  static isCritical(player) {
    return !!player && player.hp === 1 && player.maxHp > 1;
  }

  /**
   * @param {number} dt
   * @param {Object} game
   */
  update(dt, game) {
    this.t += dt;
    this._beatAge += dt;

    const critical = DangerIndicator.isCritical(game.player);
    if (critical !== this.critical) {
      this.critical = critical;
      this._beatTimer = 0; // first beat right away
    }

    if (this.critical) {
      this._beatTimer -= dt;
      if (this._beatTimer <= 0) {
        this._beatTimer = BEAT_INTERVAL;
        this._beatAge = 0;
        if (game.audioSystem && typeof game.audioSystem.soundHeartbeat === 'function') {
          game.audioSystem.soundHeartbeat(1);
        }
        if (game.hapticSystem) game.hapticSystem.pulse([22, 90, 16]);
      }
    }
  }

  /** 0..1 pulse that spikes with each heartbeat ("lub" then a smaller "dub") */
  get beat() {
    const a = this._beatAge;
    return Math.max(Math.exp(-a * 7), 0.7 * Math.exp(-Math.abs(a - 0.2) * 14));
  }

  /**
   * Find the ghosts outside the view and where their arrows go.
   * @param {Array<Object>} enemies
   * @param {{x:number, y:number}} player
   * @param {number} w
   * @param {number} h
   * @returns {Array<{x:number, y:number, angle:number, fast:boolean, size:number}>}
   */
  collectArrows(enemies, player, w, h) {
    const out = this._arrows;
    out.length = 0;

    for (let i = 0; i < enemies.length && out.length < MAX_ARROWS; i++) {
      const e = enemies[i];
      if (e.isDead || e.isHeartGhost || e.isGolden || e.isFrozen) continue;

      const r = (e.radius || 24) * 0.6;
      const outside = e.x < -r || e.x > w + r || e.y < -r || e.y > h + r;
      if (!outside) continue;

      const ax = Math.max(EDGE_INSET, Math.min(w - EDGE_INSET, e.x));
      const ay = Math.max(EDGE_INSET, Math.min(h - EDGE_INSET, e.y));
      const angle = Math.atan2(e.y - ay, e.x - ax);

      const dist = Math.hypot(e.x - player.x, e.y - player.y);
      const eta = (e.speed || 0) > 0 ? dist / e.speed : Infinity;
      const fast = !!e.isBoss || e.type === 'SPEEDSTER' || eta < FAST_ETA;

      // Don't bother with slow ghosts that are still far away
      if (!fast && eta > 5) continue;

      const slot = this._pool[out.length];
      slot.x = ax;
      slot.y = ay;
      slot.angle = angle;
      slot.fast = fast;
      slot.size = fast ? 15 : 10;
      out.push(slot);
    }
    return out;
  }

  /**
   * Draw the cues in screen space (call outside any screen-shake transform).
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} game
   */
  render(ctx, game) {
    const w = game.width;
    const h = game.height;
    if (!(w > 0 && h > 0)) return;

    // Slow-motion tint
    const sm = game.slowMo;
    if (sm && sm.timer > 0) {
      const k = Math.min(1, sm.timer / sm.total * 2.2);
      this._drawVignette(ctx, 'rgba(125, 211, 252, 0.75)', w, h, 0.55 * k);
    }

    // Last heart: pulsing red edges
    if (this.critical) {
      this._drawVignette(ctx, 'rgba(239, 68, 68, 0.9)', w, h, 0.22 + 0.5 * this.beat);
    }

    // Edge arrows
    if (game.enemies && game.player) {
      const arrows = this.collectArrows(game.enemies, game.player, w, h);
      for (let i = 0; i < arrows.length; i++) this._drawArrow(ctx, arrows[i]);
    }
  }

  _drawArrow(ctx, a) {
    const pulse = 0.65 + 0.35 * Math.sin(this.t * (a.fast ? 14 : 8));
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    ctx.globalAlpha = (a.fast ? 0.95 : 0.7) * pulse;
    ctx.fillStyle = a.fast ? '#ef4444' : '#fbbf24';
    ctx.strokeStyle = 'rgba(15, 8, 30, 0.85)';
    ctx.lineWidth = 2;
    if (a.fast) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
    }
    const s = a.size;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.7, -s * 0.8);
    ctx.lineTo(-s * 0.3, 0);
    ctx.lineTo(-s * 0.7, s * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Full-screen soft glow along the edges, stretched from a small cached canvas.
   */
  _drawVignette(ctx, color, w, h, alpha) {
    if (alpha <= 0.01) return;
    const sprite = this._getVignette(color);
    if (!sprite) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(sprite, 0, 0, w, h);
    ctx.restore();
  }

  _getVignette(color) {
    if (this._vignettes.has(color)) return this._vignettes.get(color);
    let sprite = null;
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const g = c.getContext('2d');
        if (g && typeof g.createRadialGradient === 'function') {
          const grad = g.createRadialGradient(32, 32, 14, 32, 32, 46);
          grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          grad.addColorStop(1, color);
          g.fillStyle = grad;
          g.fillRect(0, 0, 64, 64);
          sprite = c;
        }
      }
    } catch (e) {
      sprite = null;
    }
    this._vignettes.set(color, sprite);
    return sprite;
  }
}
