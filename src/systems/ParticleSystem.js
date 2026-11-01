/**
 * @file ParticleSystem.js
 * @description High-performance visual effects engine utilizing Object Pooling
 * to eliminate Garbage Collection pauses and achieve consistent 60+ FPS on all refresh rates (60Hz, 120Hz, 144Hz).
 * Features Magic Sparks, Monster Death Explosions, Ring Shockwaves, and Floating Texts.
 */

class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.gravity = 0;
    this.drag = 1.0;
    this.life = 0;
    this.decay = 1.0;
    this.size = 2;
    this.rotation = 0;
    this.vRot = 0;
    this.color = '#ffffff';
    this.type = 'spark'; // 'ring' | 'magic_spark' | 'gravity_spark' | 'smoke' | 'spark'
    this.radius = 0;
    this.maxRadius = 0;
    this.growth = 0;
  }

  reset() {
    this.active = false;
    this.gravity = 0;
    this.drag = 1.0;
    this.vRot = 0;
    this.rotation = 0;
    this.growth = 0;
    this.radius = 0;
  }
}

class FloatingText {
  constructor() {
    this.active = false;
    this.text = '';
    this.x = 0;
    this.y = 0;
    this.vy = -55;
    this.life = 0;
    this.decay = 1.2;
    this.color = '#fef08a';
    this.fontSize = 18;
  }

  reset() {
    this.active = false;
    this.text = '';
  }
}

export class ParticleSystem {
  constructor(maxParticles = 700, maxTexts = 50) {
    this.maxParticles = maxParticles;
    this.maxTexts = maxTexts;

    // Pre-allocated Particle Pool
    this.particlePool = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particlePool.push(new Particle());
    }
    this.activeParticleCount = 0;

    // Pre-allocated Floating Text Pool
    this.textPool = [];
    for (let i = 0; i < this.maxTexts; i++) {
      this.textPool.push(new FloatingText());
    }
    this.activeTextCount = 0;

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
      BOSS: ['#fecdd3', '#fda4af', '#f43f5e', '#e11d48', '#be123c', '#991b1b', '#fbbf24'],
      BOSS_MASTER: ['#ffffff', '#fde047', '#fbbf24', '#f43f5e', '#e11d48', '#be123c', '#881337', '#38bdf8']
    };

    // Sparkle magic palette for player drawing trail
    this.MAGIC_TRAIL_PALETTE = ['#f472b6', '#e879f9', '#c084fc', '#38bdf8', '#fde047', '#a78bfa'];
  }

  /**
   * Backward-compatible slice of currently active particles
   * @returns {Array<Particle>}
   */
  get particles() {
    return this.particlePool.slice(0, this.activeParticleCount);
  }

  /**
   * Backward-compatible slice of currently active floating texts
   * @returns {Array<FloatingText>}
   */
  get floatingTexts() {
    return this.textPool.slice(0, this.activeTextCount);
  }

  /**
   * Acquire a particle from pool with O(1) efficiency
   * @private
   * @returns {Particle|null}
   */
  _acquireParticle() {
    if (this.activeParticleCount < this.maxParticles) {
      const p = this.particlePool[this.activeParticleCount];
      this.activeParticleCount++;
      p.active = true;
      return p;
    }
    // Pool exhausted: recycle the oldest active particle (index 0)
    const p = this.particlePool[0];
    // Move it to the end of active pool
    this.particlePool.copyWithin(0, 1, this.activeParticleCount);
    this.particlePool[this.activeParticleCount - 1] = p;
    p.reset();
    p.active = true;
    return p;
  }

  /**
   * Acquire a text object from pool with O(1) efficiency
   * @private
   * @returns {FloatingText|null}
   */
  _acquireText() {
    if (this.activeTextCount < this.maxTexts) {
      const t = this.textPool[this.activeTextCount];
      this.activeTextCount++;
      t.active = true;
      return t;
    }
    const t = this.textPool[0];
    this.textPool.copyWithin(0, 1, this.activeTextCount);
    this.textPool[this.activeTextCount - 1] = t;
    t.reset();
    t.active = true;
    return t;
  }

  /**
   * Trigger procedural screen shake with smooth exponential decay
   * @param {number} intensity Max pixel displacement
   * @param {number} duration Duration in seconds
   */
  triggerShake(intensity = 10, duration = 0.3) {
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
      const p = this._acquireParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 55 + 15;
      const color = customColor || this.MAGIC_TRAIL_PALETTE[Math.floor(Math.random() * this.MAGIC_TRAIL_PALETTE.length)];

      p.reset();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 6;
      p.y = y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(angle) * speed + vx * 0.2;
      p.vy = Math.sin(angle) * speed + vy * 0.2 - 12; // upward float
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 9;
      p.life = 1.0;
      p.decay = Math.random() * 1.8 + 1.4;
      p.size = Math.random() * 3.5 + 2.5;
      p.color = color;
      p.type = 'magic_spark';
    }
  }

  emitSparkle(x, y, color = '#c084fc', count = 1) {
    this.emitMagicSparks(x, y, count, color);
  }

  /**
   * 20 - 30 Particle Monster Death Explosion:
   * Reused through object pooling to prevent memory churn on enemy elimination.
   * @param {number} x Monster origin X
   * @param {number} y Monster origin Y
   * @param {string} [enemyType='REGULAR'] Archetype ('REGULAR', 'SPEEDSTER', 'ARMORED', 'BOSS')
   * @param {number} [count=28] Number of explosion particles
   */
  emitMonsterDeathExplosion(x, y, enemyType = 'REGULAR', count = 28) {
    const palette = this.ENEMY_PALETTES[enemyType] || this.ENEMY_PALETTES.REGULAR;
    const primaryColor = palette[3] || '#c084fc';

    const isBoss = enemyType === 'BOSS' || (typeof enemyType === 'string' && enemyType.startsWith('BOSS_'));
    const isFinalBoss = enemyType === 'BOSS_MASTER';
    const isArmored = enemyType === 'ARMORED';

    // 1. Expanding shockwave ring
    const ring = this._acquireParticle();
    if (ring) {
      ring.reset();
      ring.active = true;
      ring.x = x;
      ring.y = y;
      ring.radius = 8;
      ring.maxRadius = isFinalBoss ? 260 : (isBoss ? 110 : (isArmored ? 70 : 52));
      ring.growth = isFinalBoss ? 550 : (isBoss ? 280 : (isArmored ? 220 : 170));
      ring.life = 1.0;
      ring.decay = isFinalBoss ? 1.4 : (isBoss ? 2.2 : 3.2);
      ring.color = primaryColor;
      ring.type = 'ring';
    }

    // Secondary golden ring for final boss
    if (isFinalBoss) {
      const ring2 = this._acquireParticle();
      if (ring2) {
        ring2.reset();
        ring2.active = true;
        ring2.x = x;
        ring2.y = y;
        ring2.radius = 16;
        ring2.maxRadius = 320;
        ring2.growth = 420;
        ring2.life = 1.0;
        ring2.decay = 1.1;
        ring2.color = '#fde047';
        ring2.type = 'ring';
      }
    }

    // 2. Gravity-bound explosion sparks
    const particleCount = isFinalBoss ? 55 : Math.max(20, Math.min(30, count));
    for (let i = 0; i < particleCount; i++) {
      const p = this._acquireParticle();
      if (!p) break;

      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = Math.random() * 240 + 90;
      const color = palette[Math.floor(Math.random() * palette.length)];

      p.reset();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 8;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - Math.random() * 110 - 40;
      p.gravity = 420;
      p.drag = 0.965;
      p.life = 1.0;
      p.decay = Math.random() * 1.2 + 0.85;
      p.size = Math.random() * 4.2 + 2.8;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 10;
      p.color = color;
      p.type = 'gravity_spark';
    }

    // 3. Ascending ethereal spirit embers
    for (let i = 0; i < 6; i++) {
      const p = this._acquireParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 60 + 20;

      p.reset();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 14;
      p.y = y + (Math.random() - 0.5) * 14;
      p.vx = Math.cos(angle) * speed;
      p.vy = -Math.random() * 65 - 25;
      p.life = 1.0;
      p.decay = Math.random() * 1.3 + 0.9;
      p.size = Math.random() * 5 + 3;
      p.color = palette[1] || '#ffffff';
      p.type = 'smoke';
    }
  }

  emitDeathPoof(x, y, color = '#a78bfa', count = 24) {
    let enemyType = 'REGULAR';
    if (color && (color.includes('#f4') || color.includes('#ec') || color.includes('#ef'))) {
      enemyType = 'SPEEDSTER';
    } else if (color && (color.includes('#7c') || color.includes('#a8') || color.includes('#4c'))) {
      enemyType = 'ARMORED';
    }
    this.emitMonsterDeathExplosion(x, y, enemyType, count);
  }

  emitHitBurst(x, y, color = '#38bdf8', count = 16) {
    for (let i = 0; i < count; i++) {
      const p = this._acquireParticle();
      if (!p) break;

      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 190 + 70;

      p.reset();
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.life = 1.0;
      p.decay = Math.random() * 2.2 + 2.0;
      p.size = Math.random() * 3.8 + 2.2;
      p.color = color;
      p.type = 'spark';
    }
  }

  emitFloatingText(text, x, y, color = '#fef08a', fontSize = 18) {
    const t = this._acquireText();
    if (!t) return;

    t.reset();
    t.active = true;
    t.text = text;
    t.x = x;
    t.y = y;
    t.vy = -55;
    t.life = 1.0;
    t.decay = 1.2;
    t.color = color;
    t.fontSize = fontSize;
  }

  /**
   * Update particle physics with accurate deltaTime scaling across 60Hz, 120Hz, 144Hz
   * Uses O(1) swap-and-pop removal to avoid array splicing!
   * @param {number} dt Delta time in seconds
   */
  update(dt) {
    // 1. Screen Shake decay
    if (this.screenShake.timer > 0) {
      this.screenShake.timer -= dt;
      const progress = Math.max(0, this.screenShake.timer / this.screenShake.duration);
      const currentIntensity = this.screenShake.intensity * Math.pow(progress, 1.6);
      
      this.screenShake.x = (Math.random() - 0.5) * 2 * currentIntensity;
      this.screenShake.y = (Math.random() - 0.5) * 2 * currentIntensity;
      this.screenShake.rotation = (Math.random() - 0.5) * currentIntensity * 0.0012;
    } else {
      this.screenShake.x = 0;
      this.screenShake.y = 0;
      this.screenShake.rotation = 0;
    }

    // Normalized frame rate factor for drag calculations (base 60 FPS)
    const rateFactor = dt * 60;

    // 2. Update Active Particles with O(1) in-place swap on death
    let i = 0;
    while (i < this.activeParticleCount) {
      const p = this.particlePool[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        // Deactivate & swap with the last active particle
        p.active = false;
        this.activeParticleCount--;
        if (i < this.activeParticleCount) {
          const last = this.particlePool[this.activeParticleCount];
          this.particlePool[i] = last;
          this.particlePool[this.activeParticleCount] = p;
          continue; // Check the particle just swapped into index i
        }
        break;
      }

      if (p.type === 'ring') {
        p.radius += p.growth * dt;
      } else if (p.type === 'gravity_spark') {
        p.vy += p.gravity * dt;
        const dragFactor = Math.pow(p.drag, rateFactor);
        p.vx *= dragFactor;
        p.vy *= dragFactor;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vRot) p.rotation += p.vRot * dt;
      } else if (p.type === 'magic_spark') {
        const decayFactor = Math.pow(0.94, rateFactor);
        p.vx *= decayFactor;
        p.vy *= decayFactor;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vRot) p.rotation += p.vRot * dt;
      } else if (p.type === 'smoke') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.size += 3.5 * dt;
        p.vx *= Math.pow(0.98, rateFactor);
      } else {
        // Standard spark
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const standardDecay = Math.pow(0.95, rateFactor);
        p.vx *= standardDecay;
        p.vy *= standardDecay;
      }

      i++;
    }

    // 3. Update Active Floating Texts with O(1) in-place swap on death
    let j = 0;
    while (j < this.activeTextCount) {
      const t = this.textPool[j];
      t.life -= t.decay * dt;
      t.y += t.vy * dt;

      if (t.life <= 0) {
        t.active = false;
        this.activeTextCount--;
        if (j < this.activeTextCount) {
          const lastText = this.textPool[this.activeTextCount];
          this.textPool[j] = lastText;
          this.textPool[this.activeTextCount] = t;
          continue;
        }
        break;
      }

      j++;
    }
  }

  /**
   * Render all pooled active particles and floating texts
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    if (this.activeParticleCount === 0 && this.activeTextCount === 0) return;

    ctx.save();

    for (let i = 0; i < this.activeParticleCount; i++) {
      const p = this.particlePool[i];
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
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation || 0);

        const s = p.size * (0.3 + 0.7 * p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;

        ctx.beginPath();
        ctx.moveTo(0, -s * 1.8);
        ctx.quadraticCurveTo(0, 0, s * 1.8, 0);
        ctx.quadraticCurveTo(0, 0, 0, s * 1.8);
        ctx.quadraticCurveTo(0, 0, -s * 1.8, 0);
        ctx.quadraticCurveTo(0, 0, 0, -s * 1.8);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(0.8, s * 0.45), 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      } else if (p.type === 'gravity_spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 9;

        const currentSize = Math.max(0.6, p.size * p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();

        if (p.life > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(p.x, p.y, currentSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.type === 'smoke') {
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

    // Render floating texts with fallback system fonts
    for (let i = 0; i < this.activeTextCount; i++) {
      const t = this.textPool[i];
      ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
      ctx.font = `800 ${t.fontSize}px Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(t.text, t.x, t.y);
    }

    ctx.restore();
  }

  clear() {
    for (let i = 0; i < this.activeParticleCount; i++) {
      this.particlePool[i].reset();
    }
    this.activeParticleCount = 0;

    for (let i = 0; i < this.activeTextCount; i++) {
      this.textPool[i].reset();
    }
    this.activeTextCount = 0;

    this.screenShake.timer = 0;
    this.screenShake.x = 0;
    this.screenShake.y = 0;
    this.screenShake.rotation = 0;
  }
}
