/**
 * @file ParticleSystem.js
 * @description High-performance visual effects: Magic Sparks, Monster Death Explosions, 
 * directional gravity sparks, floating runes, and procedural screen shake.
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
      y: 0,
      rotation: 0
    };

    // Color palettes by enemy archetype for death bursts
    this.ENEMY_PALETTES = {
      REGULAR: ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#c084fc', '#ffffff'],
      SPEEDSTER: ['#ffe4e6', '#fda4af', '#fb7185', '#f43f5e', '#f97316', '#fde047'],
      ARMORED: ['#f3e8ff', '#ddd6fe', '#c084fc', '#a855f7', '#7c3aed', '#fbbf24', '#f59e0b'],
      BOSS: ['#ffe4e6', '#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#881337', '#fbbf24', '#ffffff']
    };

    // Sparkle magic palette for player drawing trail
    this.MAGIC_TRAIL_PALETTE = ['#f472b6', '#e879f9', '#c084fc', '#38bdf8', '#fde047', '#a78bfa'];
  }

  /**
   * Trigger procedural screen shake with smooth exponential decay
   * @param {number} intensity Max pixel displacement
   * @param {number} duration Duration in seconds
   */
  triggerShake(intensity = 10, duration = 0.3) {
    // Retain maximum if a stronger shake occurs during an active one
    if (this.screenShake.timer > 0) {
      this.screenShake.intensity = Math.max(this.screenShake.intensity, intensity);
      this.screenShake.duration = Math.max(this.screenShake.duration, duration);
      this.screenShake.timer = Math.max(this.screenShake.timer, duration);
    } else {
      this.screenShake.intensity = intensity;
      this.screenShake.duration = duration;
      this.screenShake.timer = duration;
    }
  }

  /**
   * Backward-compatible alias for triggerShake
   */
  shake(intensity = 8, duration = 0.25) {
    this.triggerShake(intensity, duration);
  }

  /**
   * Magic Sparks along the player's drawing stroke trail.
   * Emits twinkling, rotating 4-point star particles that drift and fade.
   * @param {number} x 
   * @param {number} y 
   * @param {number} [count=2]
   * @param {string|null} [customColor=null]
   * @param {number} [vx=0]
   * @param {number} [vy=0]
   */
  emitMagicSparks(x, y, count = 2, customColor = null, vx = 0, vy = 0) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 55 + 15;
      const color = customColor || this.MAGIC_TRAIL_PALETTE[Math.floor(Math.random() * this.MAGIC_TRAIL_PALETTE.length)];

      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed + vx * 0.2,
        vy: Math.sin(angle) * speed + vy * 0.2 - 12, // light upward float
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 9,
        life: 1.0,
        decay: Math.random() * 1.8 + 1.4, // lasts 0.4s ~ 0.7s
        size: Math.random() * 3.5 + 2.5,
        color,
        type: 'magic_spark'
      });
    }
  }

  /**
   * Backward-compatible sparkle emitter
   */
  emitSparkle(x, y, color = '#c084fc', count = 1) {
    this.emitMagicSparks(x, y, count, color);
  }

  /**
   * 20 - 30 Particle Monster Death Explosion:
   * Burst particles colored to match monster type, affected by gravity, drag, and gradual fade.
   * Includes expanding shockwave ring and ascending spirit motes.
   * @param {number} x Monster origin X
   * @param {number} y Monster origin Y
   * @param {string} [enemyType='REGULAR'] Archetype ('REGULAR', 'SPEEDSTER', 'ARMORED', 'BOSS')
   * @param {number} [count=28] Number of explosion particles (20 - 30)
   */
  emitMonsterDeathExplosion(x, y, enemyType = 'REGULAR', count = 28) {
    const palette = this.ENEMY_PALETTES[enemyType] || this.ENEMY_PALETTES.REGULAR;
    const primaryColor = palette[3] || '#c084fc';
    const isBoss = enemyType === 'BOSS';
    const isArmored = enemyType === 'ARMORED';

    // 1. Expanding shockwave ring
    this.particles.push({
      x,
      y,
      radius: 8,
      maxRadius: isBoss ? 110 : (isArmored ? 70 : 52),
      growth: isBoss ? 280 : (isArmored ? 220 : 170),
      life: 1.0,
      decay: isBoss ? 2.2 : 3.2,
      color: primaryColor,
      type: 'ring'
    });

    // 2. 20 - 30 Gravity-bound explosion sparks
    const particleCount = Math.max(20, Math.min(30, count));
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = Math.random() * 240 + 90;
      const color = palette[Math.floor(Math.random() * palette.length)];

      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 110 - 40, // explosive initial upward pop
        gravity: 420, // gravity pulling downwards (px/s^2)
        drag: 0.965,
        life: 1.0,
        decay: Math.random() * 1.2 + 0.85, // 0.8s ~ 1.2s lifespan
        size: Math.random() * 4.2 + 2.8,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        color,
        type: 'gravity_spark'
      });
    }

    // 3. Ascending ethereal spirit embers (contrast against falling sparks)
    const spiritCount = 6;
    for (let i = 0; i < spiritCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * speed,
        vy: -Math.random() * 65 - 25, // floats upwards
        life: 1.0,
        decay: Math.random() * 1.3 + 0.9,
        size: Math.random() * 5 + 3,
        color: palette[1] || '#ffffff',
        type: 'smoke'
      });
    }
  }

  /**
   * Backward-compatible death poof (now redirects to high-end death explosion)
   */
  emitDeathPoof(x, y, color = '#a78bfa', count = 24) {
    let enemyType = 'REGULAR';
    if (color && (color.includes('#f4') || color.includes('#ec') || color.includes('#ef'))) {
      enemyType = 'SPEEDSTER';
    } else if (color && (color.includes('#7c') || color.includes('#a8') || color.includes('#4c'))) {
      enemyType = 'ARMORED';
    }
    this.emitMonsterDeathExplosion(x, y, enemyType, count);
  }

  /**
   * Burst on projectile hitting enemy
   */
  emitHitBurst(x, y, color = '#38bdf8', count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 190 + 70;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: Math.random() * 2.2 + 2.0,
        size: Math.random() * 3.8 + 2.2,
        color,
        type: 'spark'
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
   * Update particle positions, physics, life decay, and screen shake timer
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    // 1. Procedural Screen Shake calculation
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      const progress = Math.max(0, this.screenShake.timer / this.screenShake.duration);
      // Smooth non-linear exponential decay for cinematic punch
      const currentIntensity = this.screenShake.intensity * Math.pow(progress, 1.6);
      
      this.screenShake.x = (Math.random() - 0.5) * 2 * currentIntensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * currentIntensity;
      this.screenShake.rotation = (Math.random() - 0.5) * currentIntensity * 0.0012;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
      this.screenShake.rotation = 0;
    }

    // 2. Particles Physics Update
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      if (p.type === 'ring') {
        p.radius += p.growth * dt;
      } else if (p.type === 'gravity_spark') {
        // Gravity acceleration
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vRot) p.rotation += p.vRot * dt;
      } else if (p.type === 'magic_spark') {
        // Twinkling spark with slight deceleration
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vRot) p.rotation += p.vRot * dt;
      } else if (p.type === 'smoke') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += 3.5 * dt; // expands as it floats away
        p.vx *= 0.98;
      } else {
        // Standard spark
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.95;
        p.vy *= 0.95;
      }
    }

    // 3. Floating Texts Update
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
   * Render all particles and floating texts with additive blending layers
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    if (this.particles.length === 0 && this.floatingTexts.length === 0) return;

    ctx.save();

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const alpha = Math.max(0, Math.min(1, p.life));
      ctx.globalAlpha = alpha;

      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(1, 3.0 * p.life);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'magic_spark') {
        // Render 4-point star magic sparkle
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);

        const s = p.size * (0.3 + 0.7 * p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;

        // 4-pointed cross star
        ctx.beginPath();
        ctx.moveTo(0, -s * 1.8);
        ctx.quadraticCurveTo(0, 0, s * 1.8, 0);
        ctx.quadraticCurveTo(0, 0, 0, s * 1.8);
        ctx.quadraticCurveTo(0, 0, -s * 1.8, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s * 1.8);
        ctx.fill();

        // White core glint
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.8, s * 0.45), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (p.type === 'gravity_spark') {
        // High energy death burst particle
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 9;

        const currentSize = Math.max(0.6, p.size * p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();

        // White center for brightest sparks
        if (p.life > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'smoke') {
        // Soft ethereal spirit smoke
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Standard sparks
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * p.life), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Floating text rendering with neon glow backdrop
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const t = this.floatingTexts[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.font = `800 ${t.fontSize}px Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);

      // Inner crisp text overlay
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
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
    this.screenShake.rotation = 0;
  }
}
