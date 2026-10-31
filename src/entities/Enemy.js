/**
 * @file Enemy.js
 * @description Pooled Enemy entity - Spawns from edges and moves towards Player, displaying symbol queue.
 * Optimized with Object Pooling and frame-rate independent multi-harmonic sine wave animations.
 */

import { Entity } from './Entity.js';
import { RUNES, ENEMY_TYPES } from '../core/Constants.js';

export class Enemy extends Entity {
  /**
   * @param {Object} [config]
   */
  constructor(config = {}) {
    super(config.x || 0, config.y || 0);

    this.symbolQueue = [];
    this.targetPlayerPos = { x: 0, y: 0 };
    this.time = Math.random() * 10;
    this.phase = Math.random() * Math.PI * 2;
    this.hitTimer = 0;
    this.isDead = false;

    this.blinkTimer = Math.random() * 2.5 + 2.0;
    this.blinkDuration = 0.16;
    this.isBlinking = false;

    if (config.type) {
      this.init(config);
    }
  }

  /**
   * Initialize or reuse enemy instance from object pool
   * @param {Object} config 
   */
  init(config) {
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.vx = 0;
    this.vy = 0;

    const archetype = ENEMY_TYPES[config.type] || ENEMY_TYPES.REGULAR;
    this.type = archetype.type;
    this.name = archetype.name;
    this.baseSpeed = archetype.baseSpeed;
    this.speed = archetype.baseSpeed * (config.speedMultiplier || 1.0);
    this.radius = archetype.radius;
    this.baseColor = archetype.color;
    this.glowColor = archetype.glowColor;
    this.scoreValue = archetype.score;

    // Fast copy symbol queue without re-allocating array reference
    this.symbolQueue.length = 0;
    if (config.symbolQueue) {
      for (let i = 0; i < config.symbolQueue.length; i++) {
        this.symbolQueue.push(config.symbolQueue[i]);
      }
    }

    this.time = Math.random() * 10;
    this.phase = Math.random() * Math.PI * 2;
    this.hitTimer = 0;
    this.isDead = false;

    if (config.targetPlayerPos) {
      this.targetPlayerPos.x = config.targetPlayerPos.x;
      this.targetPlayerPos.y = config.targetPlayerPos.y;
    } else {
      this.targetPlayerPos.x = 0;
      this.targetPlayerPos.y = 0;
    }

    this.blinkTimer = Math.random() * 2.5 + 2.0;
    this.blinkDuration = 0.16;
    this.isBlinking = false;

<<<<<<< Updated upstream
    // Movement angle & sine oscillation offset
    this.oscillationFrequency = this.type === 'SPEEDSTER' ? 5 : 2.5;
    this.oscillationAmplitude = this.type === 'ARMORED' ? 0.3 : 0.8;
=======
    this.oscillationFrequency = this.type === 'SPEEDSTER' ? 5 : (this.type === 'BOSS' ? 1.8 : 2.5);
    this.oscillationAmplitude = (this.type === 'ARMORED' || this.type === 'BOSS') ? 0.25 : 0.8;
>>>>>>> Stashed changes
  }

  /**
   * Reset enemy state for object pool release
   */
  reset() {
    this.isDead = true;
    this.symbolQueue.length = 0;
    this.hitTimer = 0;
    this.targetPlayerPos.x = 0;
    this.targetPlayerPos.y = 0;
  }

  /**
   * Calculate random edge spawn position
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   * @returns {{x: number, y: number}}
   */
  static getRandomEdgePosition(canvasWidth, canvasHeight) {
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

    return { x, y };
  }

  /**
   * Legacy factory for backward compatibility
   */
  static spawnFromRandomEdge(canvasWidth, canvasHeight, playerPos, enemyType, symbolQueue, speedMultiplier = 1.0) {
    const pos = Enemy.getRandomEdgePosition(canvasWidth, canvasHeight);
    const enemy = new Enemy({
      type: enemyType,
      x: pos.x,
      y: pos.y,
      symbolQueue,
      speedMultiplier,
      targetPlayerPos: playerPos ? { x: playerPos.x, y: playerPos.y } : null
    });
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
   * Update enemy movement and animation timers with delta-time
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
        this.blinkTimer = Math.random() * 3.0 + 2.5;
      }
    }

    // Heading vector to player
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
   * Synchronized to entity's delta-time driven clock for jitter-free 60Hz/120Hz/144Hz displays
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.save();

    const isHit = this.hitTimer > 0;
    const animTime = this.time * 1000;

    // 1. Procedural sine-wave floating dynamics
    const bob = Math.sin(animTime * 0.0035 + this.phase) * (this.type === 'SPEEDSTER' ? 5 : 8);
    const sway = Math.cos(animTime * 0.0022 + this.phase) * 0.08;
    const breath = Math.sin(animTime * 0.004 + this.phase) * 0.045;
    const scaleX = 1 - breath;
    const scaleY = 1 + breath;

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
    ctx.arc(0, -r * 0.2, r, Math.PI, 0, false);
    ctx.lineTo(r, r * 0.8);

    const wave1 = Math.sin(animTime * 0.007 + this.phase) * 3.5;
    const wave2 = Math.cos(animTime * 0.005 + this.phase) * 3.5;
    const wave3 = Math.sin(animTime * 0.009 + this.phase + 1) * 3.0;

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
<<<<<<< Updated upstream
=======
    } else if (this.type === 'BOSS') {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r + 6, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();

      ctx.fillStyle = '#be123c';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.moveTo(-r * 0.85, -r * 0.3);
      ctx.quadraticCurveTo(-r * 1.5, -r * 0.9, -r * 1.45, -r * 1.45);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.05, -r * 0.35, -r * 0.75);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.9);
      ctx.lineTo(0, -r * 1.6);
      ctx.lineTo(r * 0.25, -r * 0.9);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(r * 0.85, -r * 0.3);
      ctx.quadraticCurveTo(r * 1.5, -r * 0.9, r * 1.45, -r * 1.45);
      ctx.quadraticCurveTo(r * 0.9, -r * 1.05, r * 0.35, -r * 0.75);
      ctx.closePath();
      ctx.fill();
>>>>>>> Stashed changes
    }

    // 4. Ghost Eyes (Gazing at Player + Blinking)
    this._renderEyes(ctx, r, isHit);

    ctx.restore();

    // 5. Floating Symbol Queue Header
    this._renderSymbols(ctx);

    ctx.restore();
  }

  /**
   * Render dynamic eyes with gaze vector towards player & blink animation
   */
  _renderEyes(ctx, r, isHit) {
    ctx.save();

    const dx = this.targetPlayerPos.x - this.x;
    const dy = this.targetPlayerPos.y - this.y;
    const angleToPlayer = Math.atan2(dy, dx);

    let eyeScaleY = 1.0;
    if (this.isBlinking) {
      const progress = Math.max(0, Math.min(1, this.blinkTimer / this.blinkDuration));
      eyeScaleY = Math.max(0.08, Math.sin(progress * Math.PI));
    }
    if (isHit) {
      eyeScaleY = 0.12;
    }

    const eyeOffsetX = r * 0.35;
    const eyeOffsetY = -r * 0.2;
    const eyeRadiusX = r * 0.20;
    const eyeRadiusY = Math.max(1, (r * 0.24) * eyeScaleY);

    ctx.shadowBlur = 0;
    ctx.fillStyle = this.type === 'SPEEDSTER' ? '#ffe4e6' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

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
      const isActive = i === 0;
      const x = startX + i * (badgeWidth + spacing);

      ctx.save();
      const scale = isActive ? 1.15 : 0.95;
      const bx = x + badgeWidth / 2;
      const by = badgeY + badgeHeight / 2;

      ctx.translate(bx, by);
      ctx.scale(scale, scale);

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
