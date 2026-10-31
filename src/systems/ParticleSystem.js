/**
 * @file ParticleSystem.js
 * @description High-performance visual effects: sparkles, impact bursts, death poofs, floating numbers, screen shake.
 */

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = {
      intensity: 0,
      duration: 0,
      timer: 0,
      x: 0,
      y: 0
    };
  }

  /**
   * Trigger screen shake
   * @param {number} intensity Max pixel displacement
   * @param {number} duration Duration in seconds
   */
  shake(intensity = 8, duration = 0.25) {
    this.screenShake.intensity = intensity;
    this.screenShake.duration = duration;
    this.screenShake.timer = duration;
  }

  /**
   * Spawn magic sparkles (e.g. while drawing trail or trailing missiles)
   */
  emitSparkle(x, y, color = '#c084fc', count = 1) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 40 + 10;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 1.5 + 1.2,
        size: Math.random() * 3 + 2,
        color,
        type: 'sparkle'
      });
    }
  }

  /**
   * Burst on projectile hitting enemy
   */
  emitHitBurst(x, y, color = '#38bdf8', count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 2.0 + 1.8,
        size: Math.random() * 4 + 3,
        color,
        type: 'spark'
      });
    }
  }

  /**
   * Enemy death poof (spirit particles + expanding ring)
   */
  emitDeathPoof(x, y, color = '#a78bfa', count = 24) {
    // Ring wave
    this.particles.push({
      x,
      y,
      radius: 5,
      maxRadius: 45,
      growth: 90,
      life: 1.0,
      decay: 2.2,
      color,
      type: 'ring'
    });

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 40;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30, // slight upward float
        life: 1.0,
        decay: Math.random() * 1.6 + 1.0,
        size: Math.random() * 4 + 2,
        color,
        type: 'smoke'
      });
    }
  }

  /**
   * Floating notification text (Score, Combo, Healing)
   */
  emitFloatingText(text, x, y, color = '#fef08a', fontSize = 18) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -55,
      life: 1.0,
      decay: 1.2,
      color,
      fontSize
    });
  }

  /**
   * Update particle positions, life, and screen shake
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    // Screen shake
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      const progress = this.screenShake.timer / this.screenShake.duration;
      const currentIntensity = this.screenShake.intensity * Math.max(0, progress);
      this.screenShake.x = (Math.random() - 0.5) * 2 * currentIntensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * currentIntensity;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'ring') {
        p.radius += p.growth * dt;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Dampen velocity slightly
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
    }

    // Floating texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life -= t.decay * dt;
      t.y += t.vy * dt;

      if (t.life <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  /**
   * Render all particles and texts
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));

      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5 * p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Floating text rendering
    ctx.shadowBlur = 6;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const t = this.floatingTexts[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.font = `bold ${t.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore();
  }

  clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake.timer = 0;
    this.screenShake.x = 0;
    this.screenShake.y = 0;
  }
}
