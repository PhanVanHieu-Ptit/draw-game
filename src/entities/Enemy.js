/**
 * @file Enemy.js
 * @description Enemy entity - Spawns from edges and moves towards Player, displaying symbol queue.
 */

import { Entity } from './Entity.js';
import { RUNES, ENEMY_TYPES } from '../core/Constants.js';

export class Enemy extends Entity {
  /**
   * @param {Object} config
   * @param {string} config.type 'REGULAR' | 'SPEEDSTER' | 'ARMORED'
   * @param {number} config.x Spawn X
   * @param {number} config.y Spawn Y
   * @param {Array<string>} config.symbolQueue Array of rune IDs (e.g. ['horizontal', 'caret'])
   * @param {number} [config.speedMultiplier=1.0]
   */
  constructor(config) {
    super(config.x, config.y);

    const archetype = ENEMY_TYPES[config.type] || ENEMY_TYPES.REGULAR;
    this.type = archetype.type;
    this.name = archetype.name;
    this.baseSpeed = archetype.baseSpeed;
    this.speed = archetype.baseSpeed * (config.speedMultiplier || 1.0);
    this.radius = archetype.radius;
    this.baseColor = archetype.color;
    this.glowColor = archetype.glowColor;
    this.scoreValue = archetype.score;

    this.symbolQueue = [...config.symbolQueue];
    this.time = Math.random() * 10;
    this.hitTimer = 0;
    this.isDead = false;

    // Movement angle & sine oscillation offset
    this.oscillationFrequency = this.type === 'SPEEDSTER' ? 5 : 2.5;
    this.oscillationAmplitude = this.type === 'ARMORED' ? 0.3 : 0.8;
  }

  /**
   * Static factory to create an enemy spawning from random edges directed towards player
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   * @param {{x: number, y: number}} playerPos 
   * @param {string} enemyType 'REGULAR' | 'SPEEDSTER' | 'ARMORED'
   * @param {Array<string>} symbolQueue 
   * @param {number} speedMultiplier 
   * @returns {Enemy}
   */
  static spawnFromRandomEdge(canvasWidth, canvasHeight, playerPos, enemyType, symbolQueue, speedMultiplier = 1.0) {
    const margin = 50;
    const edge = Math.floor(Math.random() * 3); // 0: Top, 1: Left, 2: Right
    let x, y;

    switch (edge) {
      case 0: // Top edge
        x = Math.random() * (canvasWidth - 100) + 50;
        y = -margin;
        break;
      case 1: // Left edge
        x = -margin;
        y = Math.random() * (canvasHeight * 0.65) + 30;
        break;
      case 2: // Right edge
      default:
        x = canvasWidth + margin;
        y = Math.random() * (canvasHeight * 0.65) + 30;
        break;
    }

    return new Enemy({
      type: enemyType,
      x,
      y,
      symbolQueue,
      speedMultiplier
    });
  }

  /**
   * Check if the enemy's front symbol matches the gesture
   * @param {string} gesture 
   * @returns {boolean}
   */
  matchesActiveSymbol(gesture) {
    if (this.symbolQueue.length === 0) return false;
    return this.symbolQueue[0] === gesture;
  }

  /**
   * Apply hit from a spell matching front symbol
   * @param {string} gesture 
   * @returns {{ matched: boolean, destroyed: boolean, remaining: number, runeId: string }}
   */
  takeHit(gesture) {
    if (this.symbolQueue.length === 0) {
      return { matched: false, destroyed: true, remaining: 0, runeId: null };
    }

    if (this.symbolQueue[0] === gesture) {
      const removedRune = this.symbolQueue.shift();
      this.hitTimer = 0.2; // Hit flash
      const destroyed = this.symbolQueue.length === 0;
      if (destroyed) {
        this.isDead = true;
      }
      return {
        matched: true,
        destroyed,
        remaining: this.symbolQueue.length,
        runeId: removedRune
      };
    }

    return { matched: false, destroyed: false, remaining: this.symbolQueue.length, runeId: null };
  }

  /**
   * Update enemy movement towards player
   * @param {number} dt 
   * @param {{x: number, y: number}} playerPos 
   */
  update(dt, playerPos) {
    this.time += dt;

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
    }

    // Calculate heading vector to player
    const dx = playerPos.x - this.x;
    const dy = playerPos.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Normal perpendicular vector for wavy oscillation
      const px = -ny;
      const py = nx;
      const wave = Math.sin(this.time * this.oscillationFrequency) * (this.speed * this.oscillationAmplitude);

      this.x += (nx * this.speed + px * wave) * dt;
      this.y += (ny * this.speed + py * wave) * dt;
    }
  }

  /**
   * Render enemy body and floating symbols above head
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    const isHit = this.hitTimer > 0;
    const bob = Math.sin(this.time * 4) * 4;

    // 1. Ghost Body
    ctx.save();
    ctx.translate(0, bob);

    if (isHit) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
    } else {
      ctx.fillStyle = this.baseColor;
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 14;
    }

    // Ghost body shape with flowing wavy bottom
    const r = this.radius;
    ctx.beginPath();
    // Head dome
    ctx.arc(0, -r * 0.2, r, Math.PI, 0, false);
    // Right side down to skirt
    ctx.lineTo(r, r * 0.8);

    // Wavy ghost skirt
    const wave1 = Math.sin(this.time * 6) * 3;
    const wave2 = Math.cos(this.time * 6) * 3;
    ctx.quadraticCurveTo(r * 0.5, r * 0.6 + wave1, 0, r * 0.85 + wave2);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.6 - wave1, -r, r * 0.8);

    ctx.closePath();
    ctx.fill();

    // 2. Armored details if Armored archetype
    if (this.type === 'ARMORED') {
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r + 4, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();

      // Spectral horns / spikes
      ctx.fillStyle = '#6d28d9';
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.4);
      ctx.lineTo(-r * 1.3, -r * 1.1);
      ctx.lineTo(-r * 0.4, -r * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(r * 0.8, -r * 0.4);
      ctx.lineTo(r * 1.3, -r * 1.1);
      ctx.lineTo(r * 0.4, -r * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Ghost Eyes
    ctx.fillStyle = this.type === 'SPEEDSTER' ? '#dc2626' : '#1e1b4b';
    ctx.shadowBlur = 0;
    const eyeOffsetX = r * 0.35;
    const eyeOffsetY = -r * 0.2;
    const eyeSize = r * 0.18;

    ctx.beginPath();
    ctx.arc(-eyeOffsetX, eyeOffsetY, eyeSize, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX, eyeOffsetY, eyeSize, 0, Math.PI * 2);
    ctx.fill();

    // Eye glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-eyeOffsetX + 1, eyeOffsetY - 1, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.arc(eyeOffsetX + 1, eyeOffsetY - 1, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // restore bob

    // 4. Floating Symbol Queue Header
    this._renderSymbols(ctx, bob);

    ctx.restore();
  }

  /**
   * Render hovering symbol queue pills above enemy
   */
  _renderSymbols(ctx, bob) {
    if (this.symbolQueue.length === 0) return;

    ctx.save();
    const badgeHeight = 24;
    const badgeWidth = 24;
    const spacing = 6;
    const totalWidth = this.symbolQueue.length * badgeWidth + (this.symbolQueue.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const badgeY = -this.radius - 32 + bob;

    for (let i = 0; i < this.symbolQueue.length; i++) {
      const runeId = this.symbolQueue[i];
      const rune = RUNES[runeId] || { symbol: '?', color: '#ffffff', glow: '#ffffff' };
      const isActive = i === 0; // The active symbol to be drawn first
      const x = startX + i * (badgeWidth + spacing);

      // Badge pill background
      ctx.save();
      const scale = isActive ? 1.15 : 0.95;
      const bx = x + badgeWidth / 2;
      const by = badgeY + badgeHeight / 2;

      ctx.translate(bx, by);
      ctx.scale(scale, scale);

      // Active pulsing shadow
      if (isActive) {
        const pulse = (Math.sin(this.time * 8) + 1) * 0.5;
        ctx.shadowColor = rune.glow;
        ctx.shadowBlur = 10 + pulse * 6;
        ctx.fillStyle = 'rgba(15, 12, 34, 0.92)';
        ctx.strokeStyle = rune.color;
        ctx.lineWidth = 2;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15, 12, 34, 0.75)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
      }

      ctx.beginPath();
      ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Symbol Icon
      ctx.fillStyle = rune.color;
      ctx.font = `bold ${isActive ? 15 : 13}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rune.symbol, 0, 1);

      ctx.restore();
    }

    ctx.restore();
  }
}
