/**
 * @file Projectile.js
 * @description Magic projectile fired from Player's wand towards targeted enemy.
 */

import { Entity } from './Entity.js';
import { RUNES } from '../core/Constants.js';

export class Projectile extends Entity {
  /**
   * @param {Object} config
   * @param {number} config.startX
   * @param {number} config.startY
   * @param {import('./Enemy.js').Enemy} config.targetEnemy
   * @param {string} config.gesture Rune ID
   * @param {import('../systems/ParticleSystem.js').ParticleSystem} config.particleSystem
   */
  constructor(config) {
    super(config.startX, config.startY);
    this.targetEnemy = config.targetEnemy;
    this.gesture = config.gesture;
    this.particleSystem = config.particleSystem;

    const rune = RUNES[this.gesture] || { color: '#c084fc', glow: '#a855f7' };
    this.color = rune.color;
    this.glowColor = rune.glow;

    this.speed = 880; // pixels per second
    this.radius = 8;
    this.history = []; // trail history
    this.maxHistory = 6;
    this.time = 0;
  }

  /**
   * Update homing trajectory towards target
   * @param {number} dt 
   * @returns {boolean} Whether projectile impacted or finished
   */
  update(dt) {
    this.time += dt;

    // Record position for trail
    this.history.unshift({ x: this.x, y: this.y });
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    // Emit trailing sparkles
    if (this.particleSystem && Math.random() < 0.6) {
      this.particleSystem.emitSparkle(this.x, this.y, this.color, 1);
    }

    // Determine target location (even if enemy died mid-flight, fly to its last known position)
    const targetX = this.targetEnemy ? this.targetEnemy.x : this.x + this.vx * dt;
    const targetY = this.targetEnemy ? this.targetEnemy.y : this.y + this.vy * dt;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);

    // Check hit condition
    const hitDistance = this.radius + (this.targetEnemy ? this.targetEnemy.radius : 15);
    if (dist <= hitDistance || dist < this.speed * dt) {
      this.x = targetX;
      this.y = targetY;
      this.isDead = true;
      return true; // Impacted!
    }

    // Normal velocity vector towards target
    const nx = dx / dist;
    const ny = dy / dist;
    this.vx = nx * this.speed;
    this.vy = ny * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    return false;
  }

  /**
   * Render projectile with radiant glow and missile tail
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();

    // 1. Render historical missile trail
    if (this.history.length > 1) {
      ctx.beginPath();
      ctx.moveTo(this.history[0].x, this.history[0].y);
      for (let i = 1; i < this.history.length; i++) {
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
