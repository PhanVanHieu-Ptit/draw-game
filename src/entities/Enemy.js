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

    if (config.type || config.isHeartGhost || config.symbolQueue) {
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
    this.isFinalBoss = Boolean(archetype.isFinalBoss || this.type === 'BOSS_MASTER');

    // Canvas dimensions & positioning on right side for Final Boss
    this.canvasWidth = config.canvasWidth || 800;
    this.canvasHeight = config.canvasHeight || 600;
    this.baseAnchorX = this.canvasWidth * 0.76;
    this.baseAnchorY = this.canvasHeight * 0.46;

    if (this.isFinalBoss) {
      this.updateCanvasDimensions(this.canvasWidth, this.canvasHeight);
      this.x = config.x !== undefined ? config.x : this.baseAnchorX;
      this.y = config.y !== undefined ? config.y : this.baseAnchorY;
    }

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

    // Multi-phase Boss tracking
    this.bossPhases = [];
    if (this.isBoss) {
      if (config.bossPhases && Array.isArray(config.bossPhases) && config.bossPhases.length > 0) {
        this.bossPhases = config.bossPhases.map(p => [...p]);
      } else if (this.symbolQueue.length > 0) {
        this.bossPhases = [[...this.symbolQueue]];
      }
      this.maxBossLives = config.bossLives || (this.bossPhases.length > 0 ? this.bossPhases.length : 3);
      this.bossLives = this.maxBossLives;
      this.currentPhaseIndex = 0;
      if (this.symbolQueue.length === 0 && this.bossPhases.length > 0) {
        for (let i = 0; i < this.bossPhases[0].length; i++) {
          this.symbolQueue.push(this.bossPhases[0][i]);
        }
      }
      this.isRetreating = false;
      this.isReEntering = false;
      this.retreatTimer = 0;
      this.reEnterTimer = 0;
      this.phaseClearedOnRetreat = false;
    } else {
      this.bossLives = 1;
      this.maxBossLives = 1;
      this.currentPhaseIndex = 0;
      this.isRetreating = false;
      this.isReEntering = false;
      this.retreatTimer = 0;
      this.reEnterTimer = 0;
      this.phaseClearedOnRetreat = false;
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
   * Dynamically scale Final Boss dimensions to occupy ~45%-50% screen width and anchor on the right side
   * @param {number} width 
   * @param {number} height 
   */
  updateCanvasDimensions(width, height) {
    this.canvasWidth = width || 800;
    this.canvasHeight = height || 600;
    if (this.isFinalBoss) {
      const isMobile = this.canvasWidth < 600;
      this.baseAnchorX = this.canvasWidth * 0.76;
      this.baseAnchorY = this.canvasHeight * (isMobile ? 0.44 : 0.46);
      // Colossal half-screen scaling: boss width takes up ~46% of screen width (proportionally scaled on mobile)
      this.bossWidth = isMobile ? Math.max(160, this.canvasWidth * 0.44) : Math.max(300, this.canvasWidth * 0.46);
      this.radius = Math.max(isMobile ? 65 : 120, this.bossWidth / 2.8);
      this.bossHeight = this.radius * 3.1;
    }
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
    this.isRetreating = false;
    this.isReEntering = false;
    this.retreatTimer = 0;
    this.reEnterTimer = 0;
    this.isBoss = false;
    this.isFinalBoss = false;
    this.baseAnchorX = 0;
    this.baseAnchorY = 0;
    this.bossPhases = [];
    this.bossLives = 1;
    this.maxBossLives = 1;
    this.currentPhaseIndex = 0;
    this.phaseClearedOnRetreat = false;
  }

  /**
   * Check collision with player or other entities
   * @param {Entity} other 
   * @returns {boolean}
   */
  collidesWith(other) {
    if (this.isFinalBoss) {
      // The colossal Boss occupies ~46% screen width with huge shadow wings
      // Its front left wing/body strikes Momo when within effective attack range
      const effectiveRadius = this.radius * 1.15;
      return this.distanceTo(other) < (effectiveRadius + (other.radius || 25));
    }
    return super.collidesWith(other);
  }

  /**
   * Calculate random edge spawn position from any of the 4 borders (Top, Bottom, Left, Right)
   * Ghosts can emerge from all 360-degree directions toward Momo in the center.
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   * @returns {{x: number, y: number}}
   */
  static getRandomEdgePosition(canvasWidth, canvasHeight) {
    const margin = 60;
    const edge = Math.floor(Math.random() * 4); // 0: Top, 1: Bottom, 2: Left, 3: Right
    let x, y;

    switch (edge) {
      case 0: // Top edge
        x = Math.random() * (canvasWidth - 80) + 40;
        y = -margin;
        break;
      case 1: // Bottom edge
        x = Math.random() * (canvasWidth - 80) + 40;
        y = canvasHeight + margin;
        break;
      case 2: // Left edge
        x = -margin;
        y = Math.random() * (canvasHeight - 80) + 40;
        break;
      case 3: // Right edge
      default:
        x = canvasWidth + margin;
        y = Math.random() * (canvasHeight - 80) + 40;
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
  /**
   * Check if the enemy's front symbol matches the gesture
   * @param {string} gesture 
   * @returns {boolean}
   */
  matchesActiveSymbol(gesture) {
    if (this.isDead || this.symbolQueue.length === 0) return false;
    if (this.isRetreating || this.isReEntering) return false;
    return this.symbolQueue[0] === gesture;
  }

  /**
   * Apply hit from a spell matching front symbol
   * @param {string} gesture 
   * @returns {{ matched: boolean, destroyed: boolean, isPhaseComplete?: boolean, bossLivesRemaining?: number, remaining: number, runeId: string }}
   */
  takeHit(gesture) {
    if (this.symbolQueue.length === 0) {
      return { matched: false, destroyed: true, remaining: 0, runeId: null };
    }

    if (this.isRetreating || this.isReEntering) {
      return { matched: false, destroyed: false, remaining: this.symbolQueue.length, runeId: null };
    }

    if (this.symbolQueue[0] === gesture) {
      const removedRune = this.symbolQueue.shift();
      this.hitTimer = 0.22; // Hit flash duration
      const isQueueEmpty = this.symbolQueue.length === 0;

      if (isQueueEmpty) {
        if (this.isBoss && this.bossLives > 1) {
          this.bossLives--;
          this.startBossRetreat(true);
          return {
            matched: true,
            destroyed: false,
            isPhaseComplete: true,
            bossLivesRemaining: this.bossLives,
            remaining: 0,
            runeId: removedRune
          };
        } else {
          if (this.isBoss) this.bossLives = 0;
          this.isDead = true;
          return {
            matched: true,
            destroyed: true,
            remaining: 0,
            runeId: removedRune
          };
        }
      } else {
        // Ghost was hit and survived: SLOW DOWN significantly and CHANGE FACIAL EXPRESSION!
        this.slowTimer = 2.4;
        this.slowFactor = 0.35;
        this.expressionTimer = 2.4;
        this.shiverTimer = 0.45;
        return {
          matched: true,
          destroyed: false,
          remaining: this.symbolQueue.length,
          runeId: removedRune
        };
      }
    }

    return { matched: false, destroyed: false, remaining: this.symbolQueue.length, runeId: null };
  }

  /**
   * Trigger multi-phase Boss retreat recoil animation when 1 life is depleted or after striking Momo.
   * In Google Doodle 2016, each time a boss phase is beaten, boss recoils backward,
   * then re-emerges with fresh runes!
   * @param {boolean} isPhaseCleared 
   */
  startBossRetreat(isPhaseCleared = false) {
    this.isRetreating = true;
    this.phaseClearedOnRetreat = Boolean(isPhaseCleared);
    this.retreatTimer = 1.35;
    this.expressionTimer = 1.6;
    this.shiverTimer = 0.9;
    this.hitTimer = 0.4;

    if (this.isFinalBoss) {
      // Final Boss recoils backward toward the right screen edge and slightly up
      this.vx = 260;
      this.vy = -60;
      return;
    }

    // Recoil away from Momo for other bosses
    const dx = this.x - this.targetPlayerPos.x;
    const dy = this.y - this.targetPlayerPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    let dirX = dx / dist;
    let dirY = dy / dist;

    // Favor retreating backwards up or out towards edge
    if (Math.abs(dirY) < 0.3) {
      dirY = -0.7;
    }

    this.vx = dirX * 220;
    this.vy = dirY * 220;
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

    // Boss multi-phase retreat and re-entry state machine
    if (this.isBoss) {
      if (this.isRetreating) {
        this.retreatTimer -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.retreatTimer <= 0) {
          this.isRetreating = false;
          this.isReEntering = true;
          this.reEnterTimer = 1.2;
          if (this.phaseClearedOnRetreat) {
            this.currentPhaseIndex++;
            if (this.bossPhases && this.currentPhaseIndex < this.bossPhases.length) {
              this.symbolQueue = [...this.bossPhases[this.currentPhaseIndex]];
            } else {
              this.symbolQueue = ['horizontal', 'vertical', 'lightning'];
            }
          }
          // Move smoothly back towards right-side staging range
          if (this.isFinalBoss) {
            const rdx = this.baseAnchorX - this.x;
            const rdy = this.baseAnchorY - this.y;
            const rdist = Math.hypot(rdx, rdy) || 1;
            this.vx = (rdx / rdist) * 160;
            this.vy = (rdy / rdist) * 160;
          } else {
            const rdx = this.targetPlayerPos.x - this.x;
            const rdy = (this.targetPlayerPos.y - 120) - this.y;
            const rdist = Math.hypot(rdx, rdy) || 1;
            this.vx = (rdx / rdist) * 180;
            this.vy = (rdy / rdist) * 180;
          }
        }
        return;
      } else if (this.isReEntering) {
        this.reEnterTimer -= dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (this.isFinalBoss) {
          const curDist = Math.hypot(this.baseAnchorX - this.x, this.baseAnchorY - this.y);
          if (this.reEnterTimer <= 0 || curDist < 25) {
            this.isReEntering = false;
            this.x = this.baseAnchorX;
            this.y = this.baseAnchorY;
            this.vx = 0;
            this.vy = 0;
          }
        } else {
          const curDist = Math.hypot(this.targetPlayerPos.x - this.x, this.targetPlayerPos.y - this.y);
          if (this.reEnterTimer <= 0 || curDist < 200) {
            this.isReEntering = false;
            this.vx = 0;
            this.vy = 0;
          }
        }
        return;
      }
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

    // Heart ghost stays stationary in one place!
    if (this.isHeartGhost || this.symbolQueue.includes('heart')) {
      return;
    }

    // Final Boss advances menacingly towards Momo on the left to take Momo's life!
    if (this.isFinalBoss) {
      const dx = this.targetPlayerPos.x - this.x;
      const dy = this.targetPlayerPos.y - this.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        const nx = dx / dist;
        const ny = dy / dist;

        // Normal perpendicular vector for menacing undulating flight motion
        const px = -ny;
        const py = nx;
        const currentSpeed = this.speed * (this.slowTimer > 0 ? this.slowFactor : 1.0);
        const wave = Math.sin(this.time * 2.0 + this.phase) * (currentSpeed * 0.35);

        this.x += (nx * currentSpeed + px * wave) * dt;
        this.y += (ny * currentSpeed + py * wave) * dt;
      }
      return;
    }

    // Heading vector to player (for normal minions and other bosses)
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

    const r = this.radius;

    if (this.isFinalBoss) {
      this._renderFinalBossBody(ctx, r, animTime, isHit, isScared);
    } else {
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
      } else if (this.type === 'BOSS') {
        // Generic fallback boss
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r + 6, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.stroke();
      }
    }

    // 4. Ghost Face & Expressions (Normal eyes/mouth vs Hit scared scream & sweat drop)
    this._renderFace(ctx, r, isHit, isScared);

    ctx.restore();

    // 5. Floating Symbol Queue Header
    this._renderSymbols(ctx);

    ctx.restore();
  }

  /**
   * Render dynamic facial expressions: menacing spooky gaze with sharp fangs vs hit shocked screaming face
   */
  _renderFace(ctx, r, isHit, isScared) {
    ctx.save();

    const isHeart = this.isHeartGhost || (this.symbolQueue && this.symbolQueue.includes('heart'));
    const isAnyBoss = Boolean(this.isBoss || this.type === 'BOSS' || (typeof this.type === 'string' && this.type.startsWith('BOSS_')));

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
    const eyeOffsetY = -r * 0.22;
    const eyeRadiusX = isScared ? r * 0.25 : (isAnyBoss ? r * 0.24 : r * 0.20);
    const eyeRadiusY = isScared ? r * 0.28 : Math.max(2, (r * 0.22) * eyeScaleY);

    if (isHeart) {
      // Gentle, friendly healing spirit face
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Soft happy pupil
      const pupilShift = r * 0.05;
      const px = Math.cos(angleToPlayer) * pupilShift;
      const py = Math.sin(angleToPlayer) * pupilShift * eyeScaleY;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + px, eyeOffsetY + py, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + px, eyeOffsetY + py, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Cute smile
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, r * 0.18, 5, 0.2, Math.PI - 0.2);
      ctx.stroke();

      ctx.restore();
      return;
    }

    // =========================================================================
    // SCARY / SPOOKY GHOST COMBAT FACE (Regular, Speedster, Armored, and Bosses)
    // =========================================================================

    // 1. Spooky Eye Sockets & Glowing Demonic Eyes
    const eyeSlant = isScared ? 0.10 : 0.24; // Slanted down towards center (\   /)

    // Determine archetype spectral eye glow colors
    let scleraColor = '#f0fdf4';
    let glowColor = '#22d3ee';
    let pupilColor = '#090d16';
    let browColor = '#0f172a';
    let glowBlur = 8;

    if (isAnyBoss) {
      scleraColor = '#fef08a';
      glowColor = (this.type === 'BOSS_MASTER' || this.type === 'BOSS') ? '#f43f5e' : '#f59e0b';
      pupilColor = '#450a0a';
      browColor = '#450a0a';
      glowBlur = 14;
    } else if (this.type === 'SPEEDSTER') {
      scleraColor = '#fee2e2';
      glowColor = '#ef4444';
      pupilColor = '#7f1d1d';
      browColor = '#7f1d1d';
      glowBlur = 10;
    } else if (this.type === 'ARMORED') {
      scleraColor = '#f3e8ff';
      glowColor = '#a855f7';
      pupilColor = '#3b0764';
      browColor = '#3b0764';
      glowBlur = 9;
    }

    // --- Left Eye ---
    ctx.save();
    ctx.translate(-eyeOffsetX, eyeOffsetY);
    ctx.rotate(isScared ? -eyeSlant : eyeSlant);

    // Dark shadowy eye socket backing
    ctx.fillStyle = '#05020a';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeRadiusX + 2, eyeRadiusY + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing spectral sclera
    ctx.fillStyle = scleraColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pupil
    if (isScared) {
      const tremX = Math.sin(this.time * 26) * 1.5;
      const tremY = Math.cos(this.time * 22) * 1.5;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(tremX, tremY, Math.max(1.5, r * 0.07), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pShiftX = Math.cos(angleToPlayer) * (eyeRadiusX * 0.32);
      const pShiftY = Math.sin(angleToPlayer) * (eyeRadiusY * 0.28);
      // Predatory vertical slit pupil
      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.ellipse(pShiftX, pShiftY, eyeRadiusX * 0.32, eyeRadiusY * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      // Demonic glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pShiftX - 1, pShiftY - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- Right Eye ---
    ctx.save();
    ctx.translate(eyeOffsetX, eyeOffsetY);
    ctx.rotate(isScared ? eyeSlant : -eyeSlant);

    // Dark shadowy eye socket backing
    ctx.fillStyle = '#05020a';
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeRadiusX + 2, eyeRadiusY + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing spectral sclera
    ctx.fillStyle = scleraColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowBlur;
    ctx.beginPath();
    ctx.ellipse(0, 0, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Pupil
    if (isScared) {
      const tremX = Math.sin(this.time * 26 + 1) * 1.5;
      const tremY = Math.cos(this.time * 22 + 1) * 1.5;
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(tremX, tremY, Math.max(1.5, r * 0.07), 0, Math.PI * 2);
      ctx.fill();
    } else {
      const pShiftX = Math.cos(angleToPlayer) * (eyeRadiusX * 0.32);
      const pShiftY = Math.sin(angleToPlayer) * (eyeRadiusY * 0.28);
      // Predatory vertical slit pupil
      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.ellipse(pShiftX, pShiftY, eyeRadiusX * 0.32, eyeRadiusY * 0.82, 0, 0, Math.PI * 2);
      ctx.fill();
      // Demonic glint
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pShiftX - 1, pShiftY - 1.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Angry / Sinister Furrowed Eyebrows
    ctx.strokeStyle = browColor;
    ctx.lineWidth = isAnyBoss ? 3.6 : (this.type === 'ARMORED' ? 3.0 : 2.4);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (!isScared) {
      // Menacing angry brow line slanting fiercely inward (\  /)
      ctx.moveTo(-eyeOffsetX - eyeRadiusX * 0.95, eyeOffsetY - eyeRadiusY * 1.05);
      ctx.lineTo(-eyeOffsetX + eyeRadiusX * 0.75, eyeOffsetY - eyeRadiusY * 0.35);

      ctx.moveTo(eyeOffsetX + eyeRadiusX * 0.95, eyeOffsetY - eyeRadiusY * 1.05);
      ctx.lineTo(eyeOffsetX - eyeRadiusX * 0.75, eyeOffsetY - eyeRadiusY * 0.35);

      // Boss demonic center furrow crease
      if (isAnyBoss) {
        ctx.moveTo(0, eyeOffsetY - eyeRadiusY * 0.65);
        ctx.lineTo(0, eyeOffsetY - eyeRadiusY * 0.2);
      }
    } else {
      // Scared distressed eyebrows (/  \)
      ctx.moveTo(-eyeOffsetX - eyeRadiusX * 0.85, eyeOffsetY - eyeRadiusY * 0.35);
      ctx.lineTo(-eyeOffsetX + eyeRadiusX * 0.70, eyeOffsetY - eyeRadiusY * 1.10);

      ctx.moveTo(eyeOffsetX + eyeRadiusX * 0.85, eyeOffsetY - eyeRadiusY * 0.35);
      ctx.lineTo(eyeOffsetX - eyeRadiusX * 0.70, eyeOffsetY - eyeRadiusY * 1.10);
    }
    ctx.stroke();

    // 3. Menacing Jagged Grinning Mouth with Sharp Pointy Fangs
    const mw = isAnyBoss ? r * 0.58 : (this.type === 'SPEEDSTER' ? r * 0.50 : (this.type === 'ARMORED' ? r * 0.46 : r * 0.42));
    const mh = isAnyBoss ? r * 0.30 : (this.type === 'SPEEDSTER' ? r * 0.24 : r * 0.20);
    const my = r * 0.22;

    if (!isScared) {
      // Wicked sinister evil grin curving up sharply into cheeks
      ctx.fillStyle = this.type === 'SPEEDSTER' ? '#200306' : (this.type === 'ARMORED' ? '#180324' : (isAnyBoss ? '#1a0307' : '#070913'));
      ctx.beginPath();
      ctx.moveTo(-mw, my - mh * 0.2);
      ctx.quadraticCurveTo(0, my + mh * 0.1, mw, my - mh * 0.2);
      ctx.quadraticCurveTo(mw * 0.55, my + mh, 0, my + mh);
      ctx.quadraticCurveTo(-mw * 0.55, my + mh, -mw, my - mh * 0.2);
      ctx.closePath();
      ctx.fill();

      // Mouth outline
      ctx.strokeStyle = browColor;
      ctx.lineWidth = isAnyBoss ? 2.6 : 1.8;
      ctx.stroke();

      // Sharp white fangs
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      // Upper Left Fang
      ctx.moveTo(-mw * 0.55, my - mh * 0.05);
      ctx.lineTo(-mw * 0.22, my - mh * 0.05);
      ctx.lineTo(-mw * 0.38, my + mh * 0.78);
      ctx.closePath();

      // Upper Right Fang
      ctx.moveTo(mw * 0.22, my - mh * 0.05);
      ctx.lineTo(mw * 0.55, my - mh * 0.05);
      ctx.lineTo(mw * 0.38, my + mh * 0.78);
      ctx.closePath();

      // Center Lower Sharp Fang
      ctx.moveTo(-mw * 0.14, my + mh * 0.95);
      ctx.lineTo(mw * 0.14, my + mh * 0.95);
      ctx.lineTo(0, my + mh * 0.22);
      ctx.closePath();

      // Extra ferocious teeth for Bosses & Speedsters
      if (isAnyBoss || this.type === 'SPEEDSTER') {
        // Extra left tooth
        ctx.moveTo(-mw * 0.80, my - mh * 0.15);
        ctx.lineTo(-mw * 0.55, my - mh * 0.05);
        ctx.lineTo(-mw * 0.68, my + mh * 0.50);
        ctx.closePath();

        // Extra right tooth
        ctx.moveTo(mw * 0.55, my - mh * 0.05);
        ctx.lineTo(mw * 0.80, my - mh * 0.15);
        ctx.lineTo(mw * 0.68, my + mh * 0.50);
        ctx.closePath();
      }
      ctx.fill();
    } else {
      // Horrified screaming gaping mouth cavity
      const screamWobble = Math.sin(this.time * 20) * 1.5;
      ctx.fillStyle = '#05020a';
      ctx.beginPath();
      ctx.ellipse(0, my + 4, mw * 0.65 + screamWobble, mh * 1.35 - screamWobble, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.0;
      ctx.stroke();

      // Terrified shivering fangs along rim
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-mw * 0.35, my - mh * 0.6);
      ctx.lineTo(-mw * 0.15, my - mh * 0.6);
      ctx.lineTo(-mw * 0.25, my + mh * 0.05);
      ctx.closePath();

      ctx.moveTo(mw * 0.15, my - mh * 0.6);
      ctx.lineTo(mw * 0.35, my - mh * 0.6);
      ctx.lineTo(mw * 0.25, my + mh * 0.05);
      ctx.closePath();

      ctx.moveTo(-mw * 0.12, my + mh * 1.25);
      ctx.lineTo(mw * 0.12, my + mh * 1.25);
      ctx.lineTo(0, my + mh * 0.55);
      ctx.closePath();
      ctx.fill();

      // Agonized pink tongue / inner throat
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(0, my + mh * 0.75, mw * 0.25, 0, Math.PI);
      ctx.fill();

      // Distress cartoon ectoplasm/sweat drop beside temple
      const dropY = -r * 0.38 + Math.sin(this.time * 12) * 2.5;
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(r * 0.72, dropY - 5);
      ctx.quadraticCurveTo(r * 0.82, dropY, r * 0.72, dropY + 4);
      ctx.quadraticCurveTo(r * 0.62, dropY, r * 0.72, dropY - 5);
      ctx.fill();
      ctx.shadowBlur = 0;
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
   * Render colossal Final Master Boss Body taking up half the screen on the right side.
   * Features:
   * - Giant cosmic radial dark aura & pulsing spectral fog
   * - Massive billowing phantom cloak and shadow wings spanning ~45%-50% of screen width
   * - 5 undulating multi-harmonic living spectral tails with fluid sinusoidal motion
   * - Grand sweeping gothic demon horns and 3-spired dark crown with embedded blood ruby
   * - The Stolen Master Spellbook clutched in clawed phantom hands with animated All-Seeing Eye
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} r Core body radius
   * @param {number} animTime Milliseconds timestamp
   * @param {boolean} isHit Hit flash state
   * @param {boolean} isScared Hit scream state
   */
  _renderFinalBossBody(ctx, r, animTime, isHit, isScared) {
    ctx.save();

    // 1. Colossal Cosmic Radial Dark Aura (500-600px diameter)
    const auraPulse = Math.sin(animTime * 0.003) * 0.08;
    const auraR = r * (1.9 + auraPulse);
    const auraGrad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, auraR);
    if (isHit) {
      auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      auraGrad.addColorStop(0.35, 'rgba(244, 63, 94, 0.4)');
      auraGrad.addColorStop(1, 'transparent');
    } else {
      auraGrad.addColorStop(0, 'rgba(244, 63, 94, 0.38)');
      auraGrad.addColorStop(0.45, 'rgba(190, 18, 60, 0.20)');
      auraGrad.addColorStop(0.75, 'rgba(76, 5, 25, 0.10)');
      auraGrad.addColorStop(1, 'transparent');
    }
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR, 0, Math.PI * 2);
    ctx.fill();

    // 2. Colossal Billowing Phantom Cloak & Shadow Wings (Spanning ~45-50% screen width)
    const wingWaveL = Math.sin(animTime * 0.004) * 14;
    const wingWaveR = Math.sin(animTime * 0.004 + 1.2) * 14;

    ctx.save();
    if (isHit) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 32;
    } else {
      ctx.fillStyle = '#18040b';
      ctx.shadowColor = '#e11d48';
      ctx.shadowBlur = 24;
    }

    // Outer Shadow Mantle / Wings
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.4);
    // Left Wing (sweeping out toward center)
    ctx.bezierCurveTo(-r * 0.6, -r * 0.45, -r * 1.2, -r * 0.2, -r * 1.6, r * 0.05 + wingWaveL);
    ctx.bezierCurveTo(-r * 1.65, r * 0.45, -r * 1.35, r * 0.85, -r * 1.1, r * 1.15 + wingWaveL * 0.6);
    ctx.bezierCurveTo(-r * 0.75, r * 0.95, -r * 0.45, r * 0.85, 0, r * 0.95);
    // Right Wing (sweeping out toward right border)
    ctx.bezierCurveTo(r * 0.45, r * 0.85, r * 0.75, r * 0.95, r * 1.1, r * 1.15 + wingWaveR * 0.6);
    ctx.bezierCurveTo(r * 1.35, r * 0.85, r * 1.65, r * 0.45, r * 1.6, r * 0.05 + wingWaveR);
    ctx.bezierCurveTo(r * 1.2, -r * 0.2, r * 0.6, -r * 0.45, 0, -r * 0.4);
    ctx.closePath();
    ctx.fill();

    // Wing edge trim highlight
    ctx.strokeStyle = isHit ? '#ffffff' : '#f43f5e';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();

    // 3. Main Spectral Body & 5 Living Multi-Harmonic Undulating Ghost Robes / Tails
    ctx.save();
    const bodyGrad = ctx.createLinearGradient(0, -r * 1.0, 0, r * 1.5);
    if (isHit) {
      bodyGrad.addColorStop(0, '#ffffff');
      bodyGrad.addColorStop(0.5, '#fda4af');
      bodyGrad.addColorStop(1, '#ffffff');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 28;
    } else {
      bodyGrad.addColorStop(0, '#be123c');
      bodyGrad.addColorStop(0.35, '#881337');
      bodyGrad.addColorStop(0.7, '#4c0519');
      bodyGrad.addColorStop(1, '#18040b');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = '#f43f5e';
      ctx.shadowBlur = 20;
    }

    // 5 Living Harmonic Wave Tails
    const tWave1 = Math.sin(animTime * 0.005) * 12;
    const tWave2 = Math.sin(animTime * 0.006 + 1.3) * 14;
    const tWave3 = Math.sin(animTime * 0.007 + 2.5) * 16;
    const tWave4 = Math.sin(animTime * 0.006 + 3.8) * 14;
    const tWave5 = Math.sin(animTime * 0.005 + 5.0) * 12;

    ctx.beginPath();
    // Massive Head Dome
    ctx.arc(0, -r * 0.15, r, Math.PI, 0, false);
    // Right side of body down to outer right tail
    ctx.lineTo(r, r * 0.4);
    ctx.quadraticCurveTo(r * 0.95, r * 0.85, r * 0.85, r * 1.35 + tWave5);
    // Tail 5 -> 4
    ctx.quadraticCurveTo(r * 0.65, r * 0.95, r * 0.50, r * 1.45 + tWave4);
    // Tail 4 -> 3 (Center)
    ctx.quadraticCurveTo(r * 0.25, r * 0.95, 0, r * 1.55 + tWave3);
    // Tail 3 -> 2
    ctx.quadraticCurveTo(-r * 0.25, r * 0.95, -r * 0.50, r * 1.45 + tWave2);
    // Tail 2 -> 1
    ctx.quadraticCurveTo(-r * 0.65, r * 0.95, -r * 0.85, r * 1.35 + tWave1);
    // Left side back up to head
    ctx.quadraticCurveTo(-r * 0.95, r * 0.85, -r, r * 0.4);
    ctx.closePath();
    ctx.fill();

    // Body spectral glow rim
    ctx.strokeStyle = isHit ? '#ffffff' : '#fb7185';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 4. Grand Sweeping Gothic Demon Horns & Spired Dark Crown
    ctx.save();
    ctx.fillStyle = isHit ? '#ffffff' : '#be123c';
    ctx.strokeStyle = isHit ? '#ffffff' : '#f43f5e';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;

    // Crown arch over forehead
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r + 6, Math.PI * 0.85, Math.PI * 0.15, true);
    ctx.stroke();

    // Left Demon Horn: Sweeping grand curves outward and upward
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, -r * 0.35);
    ctx.quadraticCurveTo(-r * 1.55, -r * 0.95, -r * 1.5, -r * 1.65);
    ctx.quadraticCurveTo(-r * 1.0, -r * 1.25, -r * 0.35, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Demon Horn
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -r * 0.35);
    ctx.quadraticCurveTo(r * 1.55, -r * 0.95, r * 1.5, -r * 1.65);
    ctx.quadraticCurveTo(r * 1.0, -r * 1.25, r * 0.35, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3 Spired Dark Gothic Crown
    ctx.beginPath();
    // Left Spire
    ctx.moveTo(-r * 0.45, -r * 0.85);
    ctx.lineTo(-r * 0.32, -r * 1.4);
    ctx.lineTo(-r * 0.18, -r * 0.95);
    // Center Spire (Tallest with Blood Gem)
    ctx.lineTo(0, -r * 1.65);
    // Right Spire
    ctx.lineTo(r * 0.18, -r * 0.95);
    ctx.lineTo(r * 0.32, -r * 1.4);
    ctx.lineTo(r * 0.45, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Blood Ruby Gem on center crown spire
    const gemY = -r * 1.35;
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(0, gemY, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.ellipse(0, gemY, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. The Stolen Master Spellbook Clutched in Clawed Hands
    const bookW = r * 0.90;
    const bookH = r * 0.65;
    const bookX = -bookW / 2;
    const bookY = r * 0.42;

    ctx.save();
    // Book Shadow and Body
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#e11d48';
    ctx.shadowBlur = 16;
    ctx.fillRect(bookX, bookY, bookW, bookH);
    ctx.strokeRect(bookX, bookY, bookW, bookH);

    // Gold filigree corner brackets on spellbook
    ctx.fillStyle = '#f59e0b';
    const cSize = 14;
    // Top-Left
    ctx.fillRect(bookX, bookY, cSize, 3.5);
    ctx.fillRect(bookX, bookY, 3.5, cSize);
    // Top-Right
    ctx.fillRect(bookX + bookW - cSize, bookY, cSize, 3.5);
    ctx.fillRect(bookX + bookW - 3.5, bookY, 3.5, cSize);
    // Bottom-Left
    ctx.fillRect(bookX, bookY + bookH - 3.5, cSize, 3.5);
    ctx.fillRect(bookX, bookY + bookH - cSize, 3.5, cSize);
    // Bottom-Right
    ctx.fillRect(bookX + bookW - cSize, bookY + bookH - 3.5, cSize, 3.5);
    ctx.fillRect(bookX + bookW - 3.5, bookY + bookH - cSize, 3.5, cSize);

    // Book center arcane rune ring
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, bookY + bookH / 2, 16, 0, Math.PI * 2);
    ctx.stroke();

    // The All-Seeing Eye of Dark Magic on the book
    const eyeCenterY = bookY + bookH / 2;
    // Eye sclera
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, eyeCenterY, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil shifts left toward Momo on the left side
    const eyeLookX = -4 + Math.sin(animTime * 0.002) * 2;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(eyeLookX, eyeCenterY, 4, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Demonic glint
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eyeLookX - 1.5, eyeCenterY - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Shadowy clawed hands clutching the book
    ctx.fillStyle = '#18040b';
    ctx.strokeStyle = '#be123c';
    ctx.lineWidth = 2.5;
    // Left hand claws
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.ellipse(bookX + 6, bookY + 14 + c * 14, 8, 4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    // Right hand claws
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      ctx.ellipse(bookX + bookW - 6, bookY + 14 + c * 14, 8, 4, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Render hovering symbol queue pills and Boss Phase hearts above enemy
   */
  _renderSymbols(ctx) {
    ctx.save();

    // 1. Boss Lives Hearts display
    if (this.isBoss && this.maxBossLives > 1) {
      const heartSize = this.isFinalBoss ? 24 : 16;
      const hSpacing = this.isFinalBoss ? 6 : 3;
      const totalHWidth = this.maxBossLives * heartSize + (this.maxBossLives - 1) * hSpacing;
      const startHX = -totalHWidth / 2;
      const bossHpY = this.isFinalBoss ? (-this.radius * 1.08) : (-this.radius - 52);

      ctx.save();
      for (let h = 0; h < this.maxBossLives; h++) {
        const isFilled = h < this.bossLives;
        const hx = startHX + h * (heartSize + hSpacing) + heartSize / 2;
        ctx.font = `${this.isFinalBoss ? 22 : 13}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (isFilled) {
          ctx.shadowColor = '#f43f5e';
          ctx.shadowBlur = this.isFinalBoss ? 16 : 8;
          ctx.fillText('❤️', hx, bossHpY);
        } else {
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.35;
          ctx.fillText('🖤', hx, bossHpY);
          ctx.globalAlpha = 1.0;
        }
      }
      ctx.restore();
    }

    // 2. Boss Retreat & Re-entry banners
    if (this.isRetreating) {
      ctx.fillStyle = '#fde047';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.font = `bold ${this.isFinalBoss ? 16 : 12}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const retreatMsg = this.phaseClearedOnRetreat ? '⚡ LÙI LẠI... (-1 MẠNG)' : '⚡ ĐÒN ĐÁNH CỦA TRÙM! LÙI LẠI...';
      ctx.fillText(retreatMsg, 0, this.isFinalBoss ? (-this.radius * 0.80) : (-this.radius - 28));
      ctx.restore();
      return;
    }

    if (this.isReEntering) {
      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 12;
      ctx.font = `bold ${this.isFinalBoss ? 16 : 12}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const reEnterMsg = this.phaseClearedOnRetreat ? '🔥 KÝ TỰ MỚI! 🔥' : '⚠️ TRÙM TIẾP TỤC TẤN CÔNG! ⚠️';
      ctx.fillText(reEnterMsg, 0, this.isFinalBoss ? (-this.radius * 0.80) : (-this.radius - 28));
    }

    if (this.symbolQueue.length === 0) {
      ctx.restore();
      return;
    }

    const badgeHeight = this.isFinalBoss ? 36 : 24;
    const badgeWidth = this.isFinalBoss ? 36 : 24;
    const spacing = this.isFinalBoss ? 8 : 6;
    const totalWidth = this.symbolQueue.length * badgeWidth + (this.symbolQueue.length - 1) * spacing;
    const startX = -totalWidth / 2;
    const badgeY = this.isFinalBoss ? (-this.radius * 0.80) : (-this.radius - 32);

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
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6);
      } else {
        ctx.rect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = rune.color;
      ctx.font = `bold ${isActive ? (this.isFinalBoss ? 22 : 15) : (this.isFinalBoss ? 18 : 13)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rune.symbol, 0, 1);

      ctx.restore();
    }

    ctx.restore();
  }
}
