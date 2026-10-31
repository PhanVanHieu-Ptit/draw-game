/**
 * @file Enemy.js
 * @description Enemy entity - Spawns from edges and moves towards Player, displaying symbol queue.
 * Features multi-harmonic sine wave floating animations and player-tracking blinking eyes.
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
    this.phase = Math.random() * Math.PI * 2; // unique harmonic phase
    this.hitTimer = 0;
    this.isDead = false;

    // Player position tracking for eyes gaze
    this.targetPlayerPos = { x: 0, y: 0 };

    // Eye blinking dynamics
    this.blinkTimer = Math.random() * 2.5 + 2.0;
    this.blinkDuration = 0.16;
    this.isBlinking = false;

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

    const enemy = new Enemy({
      type: enemyType,
      x,
      y,
      symbolQueue,
      speedMultiplier
    });

    if (playerPos) {
      enemy.targetPlayerPos = { x: playerPos.x, y: playerPos.y };
    }

    return enemy;
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
      this.hitTimer = 0.22; // Hit flash duration
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
   * Update enemy movement and animation timers towards player
   * @param {number} dt 
   * @param {{x: number, y: number}} playerPos 
   */
  update(dt, playerPos) {
    this.time += dt;

    if (playerPos) {
      this.targetPlayerPos.x = playerPos.x;
      this.targetPlayerPos.y = playerPos.y;
    }

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
    }

    // Eye blinking timer state machine
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.blinkTimer = this.blinkDuration;
      } else {
        this.isBlinking = false;
        // Schedule next blink in 2.5s ~ 5.5s
        this.blinkTimer = Math.random() * 3.0 + 2.5;
      }
    }

    // Calculate heading vector to player
    const dx = this.targetPlayerPos.x - this.x;
    const dy = this.targetPlayerPos.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Normal perpendicular vector for wavy oscillation
      const px = -ny;
      const py = nx;
      const wave = Math.sin(this.time * this.oscillationFrequency + this.phase) * (this.speed * this.oscillationAmplitude);

      this.x += (nx * this.speed + px * wave) * dt;
      this.y += (ny * this.speed + py * wave) * dt;
    }
  }

  /**
   * Render enemy body with sine-wave hovering and player-tracking eyes
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();

    const isHit = this.hitTimer > 0;
    const now = Date.now();

    // 1. Procedural sine-wave floating dynamics
    // Vertical bobbing oscillation
    const bob = Math.sin(now * 0.0035 + this.phase) * (this.type === 'SPEEDSTER' ? 5 : 8);
    // Sway tilt angle (rolling left and right gently)
    const sway = Math.cos(now * 0.0022 + this.phase) * 0.08;
    // Breathing squash & stretch
    const breath = Math.sin(now * 0.004 + this.phase) * 0.045;
    const scaleX = 1 - breath;
    const scaleY = 1 + breath;

    // Apply translation to enemy position + bobbing
    ctx.translate(this.x, this.y + bob);

    // 2. Ghost Body
    ctx.save();
    ctx.rotate(sway);
    ctx.scale(scaleX, scaleY);

    if (isHit) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
    } else {
      ctx.fillStyle = this.baseColor;
      ctx.shadowColor = this.glowColor;
      ctx.shadowBlur = 16;
    }

    // Ghost body shape with multi-harmonic flowing wavy bottom
    const r = this.radius;
    ctx.beginPath();
    // Head dome
    ctx.arc(0, -r * 0.2, r, Math.PI, 0, false);
    // Right side down to skirt
    ctx.lineTo(r, r * 0.8);

    // Wavy ghost skirt driven by Date.now() harmonics
    const wave1 = Math.sin(now * 0.007 + this.phase) * 3.5;
    const wave2 = Math.cos(now * 0.005 + this.phase) * 3.5;
    const wave3 = Math.sin(now * 0.009 + this.phase + 1) * 3.0;

    ctx.quadraticCurveTo(r * 0.55, r * 0.65 + wave1, r * 0.15, r * 0.88 + wave2);
    ctx.quadraticCurveTo(-r * 0.2, r * 0.88 + wave3, -r * 0.55, r * 0.65 - wave1);
    ctx.lineTo(-r, r * 0.8);

    ctx.closePath();
    ctx.fill();

    // 3. Armored details if Armored archetype
    if (this.type === 'ARMORED') {
      ctx.strokeStyle = '#4c1d95';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r + 4, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();

      // Spectral horns / spikes
      ctx.fillStyle = '#6d28d9';
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.4);
      ctx.lineTo(-r * 1.35, -r * 1.15);
      ctx.lineTo(-r * 0.35, -r * 0.7);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(r * 0.8, -r * 0.4);
      ctx.lineTo(r * 1.35, -r * 1.15);
      ctx.lineTo(r * 0.35, -r * 0.7);
      ctx.closePath();
      ctx.fill();
    }

    // 4. Ghost Eyes (Gazing at Player + Blinking)
    this._renderEyes(ctx, r, isHit);

    ctx.restore(); // restore body rotate/scale

    // 5. Floating Symbol Queue Header (stable, doesn't tilt with sway)
    this._renderSymbols(ctx);

    ctx.restore();
  }

  /**
   * Render dynamic eyes with gaze vector towards player & blink animation
   */
  _renderEyes(ctx, r, isHit) {
    ctx.save();

    // Calculate angle towards player
    const dx = this.targetPlayerPos.x - this.x;
    const dy = this.targetPlayerPos.y - this.y;
    const angleToPlayer = Math.atan2(dy, dx);

    // Eye blinking scale calculation
    let eyeScaleY = 1.0;
    if (this.isBlinking) {
      const progress = Math.max(0, Math.min(1, this.blinkTimer / this.blinkDuration));
      eyeScaleY = Math.max(0.08, Math.sin(progress * Math.PI));
    }
    if (isHit) {
      eyeScaleY = 0.12; // closed in pain
    }

    const eyeOffsetX = r * 0.35;
    const eyeOffsetY = -r * 0.2;
    const eyeRadiusX = r * 0.20;
    const eyeRadiusY = Math.max(1, (r * 0.24) * eyeScaleY);

    // Eyeball background (sclera)
    ctx.shadowBlur = 0;
    ctx.fillStyle = this.type === 'SPEEDSTER' ? '#ffe4e6' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils tracking the player
    if (eyeScaleY > 0.25) {
      const maxPupilShift = r * 0.08;
      const pupilX = Math.cos(angleToPlayer) * maxPupilShift;
      const pupilY = Math.sin(angleToPlayer) * maxPupilShift * eyeScaleY;

      const pupilColor = this.type === 'SPEEDSTER' 
        ? '#dc2626' 
        : (this.type === 'ARMORED' ? '#581c87' : '#1e1b4b');

      ctx.fillStyle = pupilColor;
      if (this.type === 'SPEEDSTER') {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 8;
      }

      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX + pupilX, eyeOffsetY + pupilY, eyeRadiusX * 0.65, eyeRadiusY * 0.65, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX + pupilX, eyeOffsetY + pupilY, eyeRadiusX * 0.65, eyeRadiusY * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();

      // Catchlight sparkle (glint)
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + pupilX - 1, eyeOffsetY + pupilY - 1, eyeRadiusX * 0.24, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + pupilX - 1, eyeOffsetY + pupilY - 1, eyeRadiusX * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Render hovering symbol queue pills above enemy
   */
  _renderSymbols(ctx) {
    if (this.symbolQueue.length === 0) return;

    ctx.save();
    const badgeHeight = 24;
    const badgeWidth = 24;
    const spacing = 6;
    const totalWidth = this.symbolQueue.length * badgeWidth + (this.symbolQueue.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const badgeY = -this.radius - 32;

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
