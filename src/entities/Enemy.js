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

    // Hit response: slowdown, scared facial expression, and shudder
    this.slowTimer = 0;
    this.slowFactor = 0.35;
    this.expressionTimer = 0;
    this.shiverTimer = 0;
    this.isHeartGhost = false;

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
    this.isBoss = Boolean(archetype.isBoss || this.type === 'BOSS' || (typeof this.type === 'string' && this.type.startsWith('BOSS_')));

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

    // Hit reaction and slowdown states
    this.slowTimer = 0;
    this.slowFactor = 0.35;
    this.expressionTimer = 0;
    this.shiverTimer = 0;

    // Heart ghost special stationary behavior
    this.isHeartGhost = config.isHeartGhost || this.symbolQueue.includes('heart');
    if (this.isHeartGhost) {
      this.speed = 0;
      this.baseSpeed = 0;
      this.baseColor = '#fbcfe8';
      this.glowColor = '#f43f5e';
    }

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

    const isAnyBoss = this.isBoss || this.type === 'BOSS';
    this.oscillationFrequency = this.type === 'SPEEDSTER' ? 5 : (isAnyBoss ? 1.8 : 2.5);
    this.oscillationAmplitude = (this.type === 'ARMORED' || isAnyBoss) ? 0.25 : 0.8;
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
      } else {
        // Ghost was hit and survived: SLOW DOWN significantly and CHANGE FACIAL EXPRESSION!
        this.slowTimer = 2.4;
        this.slowFactor = 0.35;
        this.expressionTimer = 2.4;
        this.shiverTimer = 0.45;
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

    if (this.hitTimer > 0) this.hitTimer -= dt;
    if (this.slowTimer > 0) this.slowTimer -= dt;
    if (this.expressionTimer > 0) this.expressionTimer -= dt;
    if (this.shiverTimer > 0) this.shiverTimer -= dt;

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

    // Heart ghost stays stationary in one place!
    if (this.isHeartGhost || this.symbolQueue.includes('heart')) {
      return;
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
      const currentSpeed = this.speed * (this.slowTimer > 0 ? this.slowFactor : 1.0);
      const wave = Math.sin(this.time * this.oscillationFrequency + this.phase) * (currentSpeed * this.oscillationAmplitude);

      this.x += (nx * currentSpeed + px * wave) * dt;
      this.y += (ny * currentSpeed + py * wave) * dt;
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
    const isScared = isHit || this.expressionTimer > 0;
    const isHeart = this.isHeartGhost || this.symbolQueue.includes('heart');
    const animTime = this.time * 1000;

    // 1. Procedural sine-wave floating dynamics with hit shudder
    const bob = Math.sin(animTime * 0.0035 + this.phase) * (this.type === 'SPEEDSTER' ? 5 : 8);
    const sway = Math.cos(animTime * 0.0022 + this.phase) * 0.08;
    const breath = Math.sin(animTime * 0.004 + this.phase) * 0.045;
    const scaleX = 1 - breath;
    const scaleY = 1 + breath;
    const shiverX = this.shiverTimer > 0 ? (Math.random() - 0.5) * 4 : 0;
    const shiverY = this.shiverTimer > 0 ? (Math.random() - 0.5) * 3 : 0;

    ctx.translate(this.x + shiverX, this.y + bob + shiverY);

    // 2. Ghost Body
    ctx.save();
    ctx.rotate(sway);
    ctx.scale(scaleX, scaleY);

    if (isHit) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
    } else if (isHeart) {
      ctx.fillStyle = '#fce7f3';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 20;
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

    // Heart ghost cute chest heart & rosy cheeks
    if (isHeart) {
      // Rosy cheeks
      ctx.fillStyle = 'rgba(244, 63, 94, 0.45)';
      ctx.beginPath();
      ctx.arc(-r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
      ctx.arc(r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
      ctx.fill();

      // Soft heart on chest
      ctx.fillStyle = '#f43f5e';
      ctx.shadowColor = '#fda4af';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      const hx = 0;
      const hy = r * 0.42;
      const hs = 3.5;
      ctx.moveTo(hx, hy);
      ctx.bezierCurveTo(hx - hs * 2, hy - hs * 2, hx - hs * 3, hy + hs, hx, hy + hs * 2.5);
      ctx.bezierCurveTo(hx + hs * 3, hy + hs, hx + hs * 2, hy - hs * 2, hx, hy);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

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
    } else if (this.type === 'BOSS_LIBRARIAN') {
      // 1. Librarian Ghost: Golden spectacles & Mortarboard scholar cap
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.85);
      ctx.lineTo(r * 0.9, -r * 0.85);
      ctx.lineTo(0, -r * 1.4);
      ctx.closePath();
      ctx.fill();
      // Cap tassel
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.4);
      ctx.lineTo(r * 0.85, -r * 1.05);
      ctx.lineTo(r * 0.85, -r * 0.75);
      ctx.stroke();

      // Golden reading spectacles
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-r * 0.35, -r * 0.2, r * 0.24, 0, Math.PI * 2);
      ctx.arc(r * 0.35, -r * 0.2, r * 0.24, 0, Math.PI * 2);
      ctx.moveTo(-r * 0.12, -r * 0.2);
      ctx.lineTo(r * 0.12, -r * 0.2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else if (this.type === 'BOSS_CHEF') {
      // 2. Chef Ghost: Big puffy white toque hat & giant spoon
      ctx.fillStyle = '#f8fafc';
      ctx.shadowColor = '#fdba74';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.15, r * 0.65, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r * 0.45, -r * 0.95, r * 0.9, r * 0.35);
      // Hat band
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-r * 0.45, -r * 0.72, r * 0.9, 5);

      // Wooden cooking ladle held on side
      ctx.strokeStyle = '#9a3412';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(r * 0.85, -r * 0.2);
      ctx.lineTo(r * 1.25, r * 0.6);
      ctx.stroke();
      ctx.fillStyle = '#c2410c';
      ctx.beginPath();
      ctx.ellipse(r * 0.82, -r * 0.25, 7, 10, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.type === 'BOSS_PLANETARIUM') {
      // 3. Planetarium Ghost: Orbiting celestial rings and third-eye star
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.45, r * 0.5, 0.25, 0, Math.PI * 2);
      ctx.stroke();

      // Mini planets on orbit
      const pAngle = this.time * 2.5;
      const px = Math.cos(pAngle) * (r * 1.45);
      const py = Math.sin(pAngle) * (r * 0.5);
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      // Third-eye star on forehead
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#eab308';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, -r * 0.6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (this.type === 'BOSS_COACH') {
      // 4. Coach Ghost: Sports whistle & emerald sweatband
      // Sweatband
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-r * 0.75, -r * 0.62, r * 1.5, 9);
      // Lightning bolt on headband
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('⚡', -3, -r * 0.62 + 7);

      // Whistle hanging on red lanyard
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.2, r * 0.1);
      ctx.lineTo(0, r * 0.45);
      ctx.lineTo(r * 0.2, r * 0.1);
      ctx.stroke();

      // Whistle body
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, r * 0.52, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(0, r * 0.48, 8, 4);
      ctx.shadowBlur = 0;
    } else if (this.type === 'BOSS_MASTER' || this.type === 'BOSS') {
      // 5. Final Master Boss Ghost: Demon horns, dark crown & clutching the STOLEN MASTER SPELLBOOK!
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -r * 0.2, r + 6, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.stroke();

      ctx.fillStyle = '#be123c';
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 18;

      // Crown horns
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

      // The Stolen Master Spellbook in its shadowy grasp!
      const bookW = r * 0.85;
      const bookH = r * 0.65;
      const bookX = -bookW / 2;
      const bookY = r * 0.32;

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#e11d48';
      ctx.shadowBlur = 12;
      ctx.fillRect(bookX, bookY, bookW, bookH);
      ctx.strokeRect(bookX, bookY, bookW, bookH);

      // Book eye of dark magic
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, bookY + bookH / 2, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.arc(0, bookY + bookH / 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 4. Ghost Face & Expressions (Normal eyes/mouth vs Hit scared scream & sweat drop)
    this._renderFace(ctx, r, isHit, isScared);

    ctx.restore();

    // 5. Floating Symbol Queue Header
    this._renderSymbols(ctx);

    ctx.restore();
  }

  /**
   * Render dynamic facial expressions: normal curious gaze vs hit shocked/scared face
   */
  _renderFace(ctx, r, isHit, isScared) {
    ctx.save();

    const dx = this.targetPlayerPos.x - this.x;
    const dy = this.targetPlayerPos.y - this.y;
    const angleToPlayer = Math.atan2(dy, dx);

    let eyeScaleY = 1.0;
    if (this.isBlinking && !isScared) {
      const progress = Math.max(0, Math.min(1, this.blinkTimer / this.blinkDuration));
      eyeScaleY = Math.max(0.08, Math.sin(progress * Math.PI));
    }
    if (isHit) {
      eyeScaleY = 0.2;
    }

    const eyeOffsetX = r * 0.35;
    const eyeOffsetY = -r * 0.2;
    const eyeRadiusX = isScared ? r * 0.25 : r * 0.20;
    const eyeRadiusY = isScared ? r * 0.28 : Math.max(1, (r * 0.24) * eyeScaleY);

    ctx.shadowBlur = 0;
    ctx.fillStyle = this.type === 'SPEEDSTER' ? '#ffe4e6' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isScared) {
      // 1. Scared / Shocked Face: Tiny trembling pupils
      const tremX = Math.sin(this.time * 24) * 1.2;
      const tremY = Math.cos(this.time * 20) * 1.2;
      const pupilR = Math.max(1.5, r * 0.08);

      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + tremX, eyeOffsetY + tremY, pupilR, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + tremX, eyeOffsetY + tremY, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Scared angled eyebrows \ /
      ctx.strokeStyle = '#1e1b4b';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-eyeOffsetX - eyeRadiusX * 0.8, eyeOffsetY - eyeRadiusY - 2);
      ctx.lineTo(-eyeOffsetX + eyeRadiusX * 0.6, eyeOffsetY - eyeRadiusY + 3);
      ctx.moveTo(eyeOffsetX + eyeRadiusX * 0.8, eyeOffsetY - eyeRadiusY - 2);
      ctx.lineTo(eyeOffsetX - eyeRadiusX * 0.6, eyeOffsetY - eyeRadiusY + 3);
      ctx.stroke();

      // 2. Shocked screaming trembling mouth
      const mouthWobble = Math.sin(this.time * 18) * 1.5;
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.15 + mouthWobble, r * 0.22 - mouthWobble, 0, 0, Math.PI * 2);
      ctx.fill();

      // Scared pink tongue inside open mouth
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(0, r * 0.28, r * 0.08, 0, Math.PI);
      ctx.fill();

      // 3. Nervous cartoon sweat drop floating beside forehead
      const sweatDropY = -r * 0.35 + Math.sin(this.time * 10) * 2;
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(r * 0.68, sweatDropY - 5);
      ctx.quadraticCurveTo(r * 0.76, sweatDropY, r * 0.68, sweatDropY + 4);
      ctx.quadraticCurveTo(r * 0.60, sweatDropY, r * 0.68, sweatDropY - 5);
      ctx.fill();
    } else {
      // Normal state: gaze tracking player
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

      // Normal cute playful ghost smile
      ctx.strokeStyle = this.type === 'SPEEDSTER' 
        ? '#dc2626' 
        : (this.type === 'ARMORED' ? '#581c87' : '#1e1b4b');
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-3, r * 0.16, 3.5, 0.2, Math.PI - 0.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(3, r * 0.16, 3.5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Backward compatibility alias for _renderEyes
   */
  _renderEyes(ctx, r, isHit) {
    this._renderFace(ctx, r, isHit, isHit || this.expressionTimer > 0);
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
