/** Timed effects use simulation seconds only. Refresh keeps the longest remaining duration. */
export class StatusEffects {
  constructor(definitions = {}) {
    this.definitions = { stun: { speedMultiplier: 0 }, slow: { speedMultiplier: 0.5 }, ...definitions };
    this.active = new Map();
  }
  apply(id, duration, strength = 1) {
    if (!this.definitions[id] || !Number.isFinite(duration) || duration <= 0) return false;
    const old = this.active.get(id);
    this.active.set(id, { remaining: Math.max(old?.remaining || 0, duration), strength });
    return true;
  }
  tick(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const [id, effect] of this.active) {
      effect.remaining -= dt;
      if (effect.remaining <= 0) this.active.delete(id);
    }
  }
  clear() { this.active.clear(); }
  get speedMultiplier() {
    let scale = 1;
    for (const [id] of this.active) scale *= this.definitions[id].speedMultiplier ?? 1;
    return scale;
  }
}
