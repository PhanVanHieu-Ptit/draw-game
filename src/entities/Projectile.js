/**
 * @file Projectile.js
 * @description Pooled Magic projectile fired from Player's wand towards targeted enemy.
 * Uses pre-allocated history trail points to eliminate per-frame heap allocations.
 */

import { Entity } from './Entity.js';
import { RUNES } from '../core/Constants.js';

export class Projectile extends Entity {
  /**
   * @param {Object} [config]
   * @param {number} [config.startX=0]
   * @param {number} [config.startY=0]
   * @param {import('./Enemy.js').Enemy} [config.targetEnemy=null]
   * @param {string} [config.gesture=''] Rune ID
   * @param {import('../systems/ParticleSystem.js').ParticleSystem} [config.particleSystem=null]
   */
  constructor(config = {}) {
    super(config.startX || 0, config.startY || 0);

    this.speed = 880; // pixels per second
    this.radius = 8;
    this.historyCapacity = 6;
    
    // Pre-allocated trail points buffer (zero allocations per frame)
    this.history = Array.from({ length: this.historyCapacity }, () => ({ x: 0, y: 0 }));
    this.historyCount = 0;

    if (config.startX !== undefined) {
      this.init(config);
    } else {
      this.targetEnemy = null;
      this.gesture = '';
      this.particleSystem = null;
      this.color = '#c084fc';
      this.glowColor = '#a855f7';
      this.time = 0;
    }
  }

  /**
   * Initialize or re-activate projectile from object pool
   * @param {Object} config 
   */
  init(config) {
    this.x = config.startX;
    this.y = config.startY;
    this.vx = 0;
    this.vy = 0;
    this.targetEnemy = config.targetEnemy;
    this.gesture = config.gesture;
    this.particleSystem = config.particleSystem;

    const rune = RUNES[this.gesture] || { color: '#c084fc', glow: '#a855f7' };
    this.color = rune.color;
    this.glowColor = rune.glow;

    this.time = 0;
    this.isDead = false;

    // Reset pre-allocated history buffer
    for (let i = 0; i < this.historyCapacity; i++) {
      this.history[i].x = this.x;
      this.history[i].y = this.y;
    }
    this.historyCount = 1;
  }

  /**
   * Reset projectile state for object pool release
   */
  reset() {
    this.targetEnemy = null;
    this.particleSystem = null;
    this.isDead = true;
    this.historyCount = 0;
    this.time = 0;
  }

  /**
   * Update homing trajectory towards target with deltaTime
   * @param {number} dt 
   * @returns {boolean} Whether projectile impacted or finished
   */
  update(dt) {
    this.time += dt;

    // Shift pre-allocated trail points in-place (ZERO heap allocation)
    for (let i = this.historyCapacity - 1; i > 0; i--) {
      this.history[i].x = this.history[i - 1].x;
      this.history[i].y = this.history[i - 1].y;
    }
    this.history[0].x = this.x;
    this.history[0].y = this.y;
    if (this.historyCount < this.historyCapacity) {
      this.historyCount++;
    }

    // Emit trailing sparkles
    if (this.particleSystem && Math.random() < 0.6) {
      this.particleSystem.emitSparkle(this.x, this.y, this.color, 1);
    }

    // Target location
    const targetX = this.targetEnemy ? this.targetEnemy.x : this.x + this.vx * dt;
    const targetY = this.targetEnemy ? this.targetEnemy.y : this.y + this.vy * dt;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    // Hit impact condition
    const hitDistance = this.radius + (this.targetEnemy ? this.targetEnemy.radius : 15);
    if (dist <= hitDistance || dist < this.speed * dt) {
      this.x = targetX;
      this.y = targetY;
      this.isDead = true;
      return true; // Impacted!
    }

    // Velocity heading
    const nx = dx / dist;
    const ny = dy / dist;
    this.vx = nx * this.speed;
    this.vy = ny * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    return false;
  }

  /**
   * Render projectile with radiant glow and pre-allocated missile tail
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();

    // 1. Render historical missile trail
    if (this.historyCount > 1) {
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.historyCount; i++) {
        ctx.lineTo(this.history[i].x, this.history[i].y);
      }
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.45;
      ctx.stroke();
    }

    // 2. Projectile Head Orb with Glow
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer corona ring
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}
