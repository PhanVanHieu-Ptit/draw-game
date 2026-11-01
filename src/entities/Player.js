/**
 * @file Player.js
 * @description Momo the Black Cat - Arcane Wizard Cat positioned fixed at bottom-center of the screen.
 * Faithful redesign modeled directly after Google Doodle Halloween 2016 (Magic Cat Academy).
 * Features authentic frame-by-frame sprite animation extracted from the official Google Doodle
 * assets, plus an authentic procedural vector fallback with radiant amber-yellow eyes and dynamic
 * gesture-tracking wand mechanics.
 */

import { Entity } from './Entity.js';
import { PLAYER_CONFIG } from '../core/Constants.js';
import { MOMO_SPRITES } from './momoSprites.js';

export class Player extends Entity {
  constructor(canvasWidth, canvasHeight) {
    super(canvasWidth / 2, canvasHeight / 2);
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.maxHp = PLAYER_CONFIG.MAX_HP;
    this.hp = this.maxHp;
    this.radius = PLAYER_CONFIG.HITBOX_RADIUS;
    this.dangerRadius = PLAYER_CONFIG.DANGER_RADIUS;

    this.invulnerableTimer = 0;
    this.isInvulnerable = false;

    // Animation & timing states
    this.time = 0;
    this.castTimer = 0;
    this.castTargetAngle = -Math.PI / 2; // Default facing up
    this.hurtTimer = 0;
    this.dangerPulse = 0;
    this.healPulseTimer = 0;

    // Drawing gesture tracking states
    this.isDrawing = false;
    this.drawPoint = null;
    this.currentWandAngle = -Math.PI / 2 - 0.2;
    this.targetWandAngle = -Math.PI / 2 - 0.2;
    this.wandArmX = 14;
    this.wandArmY = 2;
    this.targetArmX = 14;
    this.targetArmY = 2;

    // Google Doodle Halloween 2016 Authentic Sprite Animation System
    this.animState = 'idle'; // 'idle' | 'ready' | 'attack_vertical' | 'attack_up' | 'attack_horizontal' | 'attack_down' | 'attack_heart' | 'attack_lightning' | 'hurt' | 'victory' | 'down'
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.frameDuration = 0.083; // 83ms per frame (~12 fps) matching Google Doodle timing
    this.momoSprites = MOMO_SPRITES;
    this.castGesture = null;

    // Multi-sheet preloading (level1-png-sprite.png, level1-png1-sprite.png, main-png-sprite.png)
    this.spriteSheets = {};
    this.spritesLoaded = {};
    this.spriteLoaded = false;
    this._initSpriteSheets();
  }

  /**
   * Preload official Google Doodle sprite sheets
   * @private
   */
  _initSpriteSheets() {
    if (typeof Image === 'undefined') return;

    const sheetsToLoad = [
      'level1-png-sprite.png',
      'level1-png1-sprite.png',
      'main-png-sprite.png'
    ];

    sheetsToLoad.forEach(sheetName => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      this.spriteSheets[sheetName] = img;
      this.spritesLoaded[sheetName] = false;

      img.onload = () => {
        this.spritesLoaded[sheetName] = true;
        this.spriteLoaded = Object.values(this.spritesLoaded).some(v => v);
      };

      const candidateUrls = [
        `assets/${sheetName}`,
        `/assets/${sheetName}`,
        sheetName,
        `/${sheetName}`,
        `https://www.google.com/logos/2016/halloween16/r4/${sheetName}`
      ];

      let urlIdx = 0;
      const tryNextUrl = () => {
        if (urlIdx < candidateUrls.length) {
          img.src = candidateUrls[urlIdx++];
        }
      };

      img.onerror = () => tryNextUrl();
      tryNextUrl();
    });
  }

  resize(width, height) {
    this.canvasWidth = width || window.innerWidth;
    this.canvasHeight = height || window.innerHeight;
    this.x = this.canvasWidth / 2;
    this.y = this.canvasHeight / 2;
  }

  reset() {
    this.x = (this.canvasWidth || window.innerWidth) / 2;
    this.y = (this.canvasHeight || window.innerHeight) / 2;
    this.hp = this.maxHp;
    this.invulnerableTimer = 0;
    this.isInvulnerable = false;
    this.castTimer = 0;
    this.hurtTimer = 0;
    this.healPulseTimer = 0;
    this.isDrawing = false;
    this.drawPoint = null;
    this.currentWandAngle = -Math.PI / 2 - 0.2;
    this.targetWandAngle = -Math.PI / 2 - 0.2;
    this.wandArmX = 14;
    this.wandArmY = 2;
    this.castGesture = null;
    this.animState = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  /**
   * Update active gesture drawing state from InputHandler
   * In Google Doodle, when drawing begins, Momo raises wand in ready stance!
   * @param {boolean} isDrawing 
   * @param {{x: number, y: number}|null} drawPoint 
   */
  setDrawing(isDrawing, drawPoint = null) {
    this.isDrawing = isDrawing;
    this.drawPoint = drawPoint;

    if (isDrawing) {
      if (this.animState === 'idle') {
        this.animState = 'ready';
        this.frameIndex = 0;
        this.frameTimer = 0;
      }
    } else {
      if (this.animState === 'ready') {
        this.animState = 'idle';
        this.frameIndex = 0;
        this.frameTimer = 0;
      }
    }
  }

  /**
   * Take damage from an enemy collision
   * @param {number} amount 
   * @returns {boolean} Whether damage was taken
   */
  takeDamage(amount = 1) {
    if (this.isInvulnerable || this.hp <= 0) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnerableTimer = PLAYER_CONFIG.INVULNERABLE_DURATION;
    this.isInvulnerable = true;
    this.hurtTimer = 0.35;

    // Trigger authentic Momo hurt recoil animation
    this.animState = 'hurt';
    this.frameIndex = 0;
    this.frameTimer = 0;
    return true;
  }

  /**
   * Heal player
   * @param {number} amount 
   * @returns {boolean} Whether player was healed
   */
  heal(amount = 1) {
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + amount);
      this.healPulseTimer = 0.45;
      return true;
    }
    return false;
  }

  /**
   * Trigger wand casting animation matching the recognized gesture
   * @param {string|{x: number, y: number}} gestureOrTarget Rune ID or target object
   * @param {{x: number, y: number}|null} target Optional target point
   */
  castSpell(gestureOrTarget = 'horizontal', target = null) {
    let gesture = 'horizontal';
    let targetPoint = null;

    if (typeof gestureOrTarget === 'string') {
      gesture = gestureOrTarget;
      targetPoint = target;
    } else if (gestureOrTarget && typeof gestureOrTarget === 'object') {
      targetPoint = gestureOrTarget;
    }

    this.castTimer = 0.45;
    this.castGesture = gesture;

    if (targetPoint && typeof targetPoint.x === 'number') {
      this.castTargetAngle = Math.atan2(targetPoint.y - this.y, targetPoint.x - this.x);
    } else {
      this.castTargetAngle = -Math.PI / 2;
    }

    // Set authentic Google Doodle Momo attack animation state based on drawn gesture
    switch (gesture) {
      case 'vertical':
        this.animState = 'attack_vertical';
        break;
      case 'caret':
        this.animState = 'attack_up';
        break;
      case 'v_shape':
        this.animState = 'attack_down';
        break;
      case 'heart':
        this.animState = 'attack_heart';
        break;
      case 'lightning':
        this.animState = 'attack_lightning';
        break;
      case 'horizontal':
      default:
        this.animState = 'attack_horizontal';
        break;
    }

    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  /**
   * Set celebratory victory animation
   */
  celebrateVictory() {
    this.animState = 'victory';
    this.frameIndex = 0;
    this.frameTimer = 0;
  }

  /**
   * Get world coordinates of wand tip to spawn projectiles
   * @returns {{x: number, y: number}}
   */
  getWandTip() {
    const wandLength = 38;
    const angle = this.currentWandAngle;
    return {
      x: this.x + this.wandArmX + Math.cos(angle) * wandLength,
      y: this.y + this.wandArmY - 14 + Math.sin(angle) * wandLength
    };
  }

  update(dt, enemies = []) {
    this.time += dt;

    // 1. Update wand angle and arm positioning:
    if (this.isDrawing && this.drawPoint) {
      // Calculate angle and displacement from cat to drawing point
      const dx = this.drawPoint.x - (this.x + 14);
      const dy = this.drawPoint.y - (this.y - 12);
      this.targetWandAngle = Math.atan2(dy, dx);

      // Dynamically move cat's paw / arm in real-time matching stroke displacement
      const dist = Math.hypot(dx, dy);
      const nx = dx / Math.max(1, dist);
      const ny = dy / Math.max(1, dist);

      // Relative shift based on stroke offset from player
      const reachX = Math.max(-12, Math.min(20, (this.drawPoint.x - this.x) * 0.05));
      const reachY = Math.max(-15, Math.min(12, (this.drawPoint.y - (this.y - 50)) * 0.04));

      this.targetArmX = 14 + nx * 8 + reachX;
      this.targetArmY = 2 + ny * 7 + reachY;
    } else if (this.castTimer > 0) {
      // Dynamic physical wand trajectory enacting the drawn gesture shape
      const progress = 1 - Math.max(0, this.castTimer / 0.45); // 0.0 to 1.0

      if (this.animState === 'attack_horizontal') {
        // Horizontal wand slash sweeping across from left to right
        this.targetWandAngle = -Math.PI / 2 + (progress - 0.5) * 1.6;
        this.targetArmX = 14 + (progress - 0.5) * 18;
        this.targetArmY = 2;
      } else if (this.animState === 'attack_vertical') {
        // High vertical plunge downwards
        this.targetWandAngle = -Math.PI * 0.82 + progress * Math.PI * 0.64;
        this.targetArmX = 14;
        this.targetArmY = -2 + progress * 14;
      } else if (this.animState === 'attack_up') {
        // Upward apex slash thrusting to the sky
        this.targetWandAngle = -Math.PI * 0.25 - progress * Math.PI * 0.55;
        this.targetArmX = 14;
        this.targetArmY = 8 - progress * 14;
      } else if (this.animState === 'attack_down') {
        // Downward cut towards the floor
        this.targetWandAngle = -Math.PI * 0.72 + progress * Math.PI * 0.55;
        this.targetArmX = 14;
        this.targetArmY = -2 + progress * 12;
      } else if (this.animState === 'attack_heart') {
        // Circular wand twirl
        const circleA = progress * Math.PI * 2;
        this.targetWandAngle = -Math.PI / 2 + Math.sin(circleA) * 0.7;
        this.targetArmX = 14 + Math.cos(circleA) * 8;
        this.targetArmY = 2 + Math.sin(circleA) * 8;
      } else if (this.animState === 'attack_lightning') {
        // Sharp jagged electric thrust
        const zigzag = Math.sin(progress * 24) * 0.45;
        this.targetWandAngle = -Math.PI / 2 + zigzag;
        this.targetArmX = 14 + zigzag * 10;
        this.targetArmY = 2 - progress * 8;
      } else {
        this.targetWandAngle = this.castTargetAngle;
        this.targetArmX = 14 + Math.cos(this.castTargetAngle) * 10;
        this.targetArmY = 2 + Math.sin(this.castTargetAngle) * 8;
      }
    } else if (this.animState === 'ready') {
      // Ready stance: wand raised high in anticipation
      this.targetWandAngle = -Math.PI / 2 - 0.15;
      this.targetArmX = 14;
      this.targetArmY = -4;
    } else {
      // Idle breathing sway
      this.targetWandAngle = -Math.PI / 2 - 0.2 + Math.sin(this.time * 2.5) * 0.08;
      this.targetArmX = 14;
      this.targetArmY = 2;
    }

    // Delta-time smooth interpolation
    const lerpRate = this.isDrawing ? 28 : (this.castTimer > 0 ? 32 : 12);
    const alpha = Math.min(1, dt * lerpRate);

    // Angle interpolation handling wrap-around
    let angleDiff = this.targetWandAngle - this.currentWandAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.currentWandAngle += angleDiff * alpha;

    this.wandArmX += (this.targetArmX - this.wandArmX) * alpha;
    this.wandArmY += (this.targetArmY - this.wandArmY) * alpha;

    // 2. Timers countdown
    if (this.castTimer > 0) {
      this.castTimer -= dt;
      if (this.castTimer < 0) this.castTimer = 0;
    }
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
      if (this.hurtTimer < 0) this.hurtTimer = 0;
    }
    if (this.healPulseTimer > 0) {
      this.healPulseTimer -= dt;
      if (this.healPulseTimer < 0) this.healPulseTimer = 0;
    }

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
    }

    // 3. Sprite frame sequence advancement
    this.frameTimer += dt;
    while (this.frameTimer >= this.frameDuration) {
      this.frameTimer -= this.frameDuration;
      this.frameIndex++;
    }

    if (this.animState.startsWith('attack_') || this.animState === 'cast') {
      const frames = this.momoSprites[this.animState] || this.momoSprites.attack_horizontal;
      if (this.frameIndex >= frames.length || this.castTimer <= 0) {
        this.animState = this.isDrawing ? 'ready' : 'idle';
        this.frameIndex = 0;
      }
    } else if (this.animState === 'ready') {
      const frames = this.momoSprites.ready || [];
      if (frames.length > 0) {
        this.frameIndex = this.frameIndex % frames.length;
      }
      if (!this.isDrawing) {
        this.animState = 'idle';
        this.frameIndex = 0;
      }
    } else if (this.animState === 'hurt') {
      const frames = this.momoSprites.hurt || [];
      if (this.frameIndex >= frames.length || this.hurtTimer <= 0) {
        this.animState = this.isDrawing ? 'ready' : 'idle';
        this.frameIndex = 0;
      }
    } else if (this.animState === 'victory') {
      const frames = this.momoSprites.victory || [];
      if (this.frameIndex >= frames.length) {
        this.frameIndex = Math.max(0, frames.length - 1); // Hold triumph pose
      }
    } else if (this.animState === 'down') {
      const frames = this.momoSprites.down || [];
      if (this.frameIndex >= frames.length) {
        this.frameIndex = Math.max(0, frames.length - 1);
      }
    } else {
      // Idle loop
      const frames = this.momoSprites.idle || [];
      if (frames.length > 0) {
        this.frameIndex = this.frameIndex % frames.length;
      }
    }

    // 4. Danger zone check
    let hasEnemyInDanger = false;
    for (const enemy of enemies) {
      if (this.distanceTo(enemy) < this.dangerRadius) {
        hasEnemyInDanger = true;
        break;
      }
    }
    if (hasEnemyInDanger) {
      this.dangerPulse += dt * 8;
    } else {
      this.dangerPulse = 0;
    }
  }

  render(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);

    // 1. Arcane Ground Rune / Danger Circle
    const isDanger = this.dangerPulse > 0;
    const pulseFactor = isDanger ? (Math.sin(this.dangerPulse) * 0.25 + 0.75) : 0.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, this.dangerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = isDanger ? `rgba(239, 68, 68, ${0.4 * pulseFactor})` : 'rgba(251, 191, 36, 0.15)';
    ctx.lineWidth = isDanger ? 2.5 : 1.5;
    ctx.setLineDash([8, 8]);
    ctx.stroke();

    // Subtle inner golden/amber ambient halo on floor
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 60);
    grad.addColorStop(0, this.healPulseTimer > 0 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(251, 191, 36, 0.2)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Invulnerability Flashing
    if (this.isInvulnerable && Math.floor(this.time * 20) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Gentle idle breathing bob
    const bob = Math.sin(this.time * 3) * 2.5;
    ctx.translate(0, bob);

    // Hurt recoil glow
    if (this.hurtTimer > 0) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
    }

    // 3. Render Authentic Google Doodle Momo Sprite if loaded, otherwise Authentic Vector Fallback
    if (this.spriteLoaded) {
      this._renderSpriteMomo(ctx);
    } else {
      this._renderVectorMomo(ctx);
    }

    // 4. Interactive Magic Stardust & Wand Flare when drawing or casting
    this._renderMagicWandEffects(ctx);

    ctx.restore();
  }

  /**
   * Render Momo using authentic Google Doodle 2016 sprite animation frames
   * Supports multi-sheet loading (level1-png-sprite.png, level1-png1-sprite.png, main-png-sprite.png)
   * @private
   */
  _renderSpriteMomo(ctx) {
    const state = this.animState;
    const frames = this.momoSprites[state] || this.momoSprites.idle;
    if (!frames || frames.length === 0) {
      this._renderVectorMomo(ctx);
      return;
    }

    const frame = frames[this.frameIndex % frames.length];
    if (!frame) {
      this._renderVectorMomo(ctx);
      return;
    }

    const sheetName = frame.sheet || 'level1-png-sprite.png';
    const sheetImg = (this.spriteSheets && this.spriteSheets[sheetName]) ? this.spriteSheets[sheetName] : this.spriteSheet;

    if (!sheetImg || !this.spritesLoaded[sheetName]) {
      this._renderVectorMomo(ctx);
      return;
    }

    const offX = frames.offsetX !== undefined ? frames.offsetX : 0;
    const offY = frames.offsetY !== undefined ? frames.offsetY : 0;

    const scale = 0.95;
    const destW = frame.w * scale;
    const destH = frame.h * scale;

    ctx.save();
    // Authentic Google Doodle frame positioning with per-animation offsets
    ctx.drawImage(
      sheetImg,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      -destW / 2 + offX * scale,
      -destH / 2 - 14 + offY * scale,
      destW,
      destH
    );
    ctx.restore();
  }

  /**
   * Render 100% faithful authentic vector Momo
   * Pure black cat with iconic large luminous amber/yellow eyes, whiskers, and wand.
   * NO witch hat or blue wizard robe!
   * @private
   */
  _renderVectorMomo(ctx) {
    ctx.save();

    // 1. Long sleek black tail with graceful sinusoidal wag
    const tailAngle = Math.sin(this.time * 4.2) * 0.32;
    ctx.save();
    ctx.translate(-15, 14);
    ctx.rotate(tailAngle);
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 6.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-16, 6, -22, -12);
    ctx.stroke();
    ctx.restore();

    // 2. Momo's Sleek Black Cat Body
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, 10, 22, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle fur contour shading
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.ellipse(0, 14, 18, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, 12, 17, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // 3. Cute Black Cat Head
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, -14, 20, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute chubby cheeks
    ctx.beginPath();
    ctx.ellipse(-14, -10, 9, 8, -0.2, 0, Math.PI * 2);
    ctx.ellipse(14, -10, 9, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // 4. Pointed Cat Ears (NO witch hat! Pure black cat ears like Google Doodle)
    // Left ear
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(-16, -20);
    ctx.lineTo(-24, -38);
    ctx.lineTo(-6, -28);
    ctx.closePath();
    ctx.fill();

    // Inner left ear shading (dusky rose / warm dark tone)
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.moveTo(-15, -22);
    ctx.lineTo(-21, -34);
    ctx.lineTo(-9, -27);
    ctx.closePath();
    ctx.fill();

    // Right ear
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(16, -20);
    ctx.lineTo(24, -38);
    ctx.lineTo(6, -28);
    ctx.closePath();
    ctx.fill();

    // Inner right ear shading
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.moveTo(15, -22);
    ctx.lineTo(21, -34);
    ctx.lineTo(9, -27);
    ctx.closePath();
    ctx.fill();

    // 5. Large Luminous Amber/Golden Eyes (Iconic Google Doodle Halloween 2016 Momo)
    let pupilShiftX = 0;
    let pupilShiftY = 0;
    if (this.isDrawing && this.drawPoint) {
      const pdx = this.drawPoint.x - this.x;
      const pdy = this.drawPoint.y - (this.y - 14);
      const pdist = Math.hypot(pdx, pdy) || 1;
      pupilShiftX = (pdx / pdist) * 2.8;
      pupilShiftY = (pdy / pdist) * 2.4;
    } else if (this.castTimer > 0) {
      pupilShiftX = Math.cos(this.castTargetAngle) * 2.8;
      pupilShiftY = Math.sin(this.castTargetAngle) * 2.4;
    }

    // Glowing Golden Yellow Sclera / Irises
    ctx.save();
    ctx.fillStyle = '#facc15'; // Brilliant Golden Yellow
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    // Left eye
    ctx.beginPath();
    ctx.ellipse(-8, -14, 5.5, 7.5, -0.05, 0, Math.PI * 2);
    ctx.fill();
    // Right eye
    ctx.beginPath();
    ctx.ellipse(8, -14, 5.5, 7.5, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Inner eye amber ring
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(-8, -14, 4.5, 6.5, -0.05, 0, Math.PI * 2);
    ctx.ellipse(8, -14, 4.5, 6.5, 0.05, 0, Math.PI * 2);
    ctx.stroke();

    // Large Expressive Black Pupils looking dynamically towards drawing strokes
    ctx.fillStyle = '#09090b';
    ctx.beginPath();
    ctx.ellipse(-8 + pupilShiftX, -14 + pupilShiftY, 3.2, 4.8, 0, 0, Math.PI * 2);
    ctx.ellipse(8 + pupilShiftX, -14 + pupilShiftY, 3.2, 4.8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crisp Specular Highlights (White shine giving life & realism to Momo's gaze)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-9.5 + pupilShiftX * 0.3, -16 + pupilShiftY * 0.3, 1.8, 0, Math.PI * 2);
    ctx.arc(6.5 + pupilShiftX * 0.3, -16 + pupilShiftY * 0.3, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Secondary smaller highlight dot
    ctx.beginPath();
    ctx.arc(-7 + pupilShiftX * 0.2, -12 + pupilShiftY * 0.2, 0.9, 0, Math.PI * 2);
    ctx.arc(9 + pupilShiftX * 0.2, -12 + pupilShiftY * 0.2, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // 6. Tiny pink nose & sweet cat mouth
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-2, -8);
    ctx.lineTo(2, -8);
    ctx.closePath();
    ctx.fill();

    // Whisker pads & delicate whiskers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    // Left whiskers
    ctx.beginPath();
    ctx.moveTo(-11, -7); ctx.lineTo(-22, -10);
    ctx.moveTo(-11, -5); ctx.lineTo(-23, -4);
    ctx.moveTo(-11, -3); ctx.lineTo(-21, 2);
    // Right whiskers
    ctx.moveTo(11, -7); ctx.lineTo(22, -10);
    ctx.moveTo(11, -5); ctx.lineTo(23, -4);
    ctx.moveTo(11, -3); ctx.lineTo(21, 2);
    ctx.stroke();

    // 7. Paw Holding Wand
    ctx.save();
    ctx.translate(this.wandArmX, this.wandArmY);

    // Cute Furry Black Cat Paw
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rotate wand according to current dynamic wand angle
    ctx.rotate(this.currentWandAngle + Math.PI / 2);

    // Slender wooden wand stick
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.stroke();

    // Wand gold collar ring
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-2.5, -27, 5, 2.5);

    // Wand tip crystal
    const isCasting = this.castTimer > 0;
    const isDrawing = this.isDrawing;
    const isEmpowered = isCasting || isDrawing;

    ctx.fillStyle = isEmpowered ? '#ffffff' : '#ec4899';
    ctx.shadowColor = isDrawing ? '#38bdf8' : '#fbbf24';
    ctx.shadowBlur = isEmpowered ? 20 : 6;
    ctx.beginPath();
    ctx.arc(0, -30, isEmpowered ? 5.5 : 3.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Render dynamic magical wand flares & stardust when drawing gestures
   * @private
   */
  _renderMagicWandEffects(ctx) {
    if (!this.isDrawing && this.castTimer <= 0) return;

    ctx.save();
    const tip = this.getWandTip();
    const localX = tip.x - this.x;
    const localY = tip.y - this.y;

    const gestureColors = {
      horizontal: '#fbbf24',
      vertical: '#38bdf8',
      caret: '#f97316',
      v_shape: '#c084fc',
      heart: '#f43f5e',
      lightning: '#34d399'
    };
    const flareColor = this.isDrawing ? '#38bdf8' : (gestureColors[this.castGesture] || '#fbbf24');

    // Wand tip stardust flare
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = flareColor;
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(localX, localY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Slash blade trail when executing a gesture attack
    if (this.castTimer > 0) {
      const progress = 1 - Math.max(0, this.castTimer / 0.45);
      const slashAlpha = Math.sin(progress * Math.PI) * 0.75;
      ctx.save();
      ctx.strokeStyle = flareColor;
      ctx.lineWidth = 4 * slashAlpha;
      ctx.shadowColor = flareColor;
      ctx.shadowBlur = 16;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const slashR = 36;
      ctx.arc(this.wandArmX, this.wandArmY - 14, slashR, this.currentWandAngle - 0.4, this.currentWandAngle + 0.4);
      ctx.stroke();
      ctx.restore();
    }

    // Star ray flourishes
    ctx.strokeStyle = flareColor;
    ctx.lineWidth = 2;
    const rayLen = 14;
    const phase = this.time * 8;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
      const curA = a + phase;
      ctx.beginPath();
      ctx.moveTo(localX + Math.cos(curA) * 3, localY + Math.sin(curA) * 3);
      ctx.lineTo(localX + Math.cos(curA) * rayLen, localY + Math.sin(curA) * rayLen);
      ctx.stroke();
    }

    ctx.restore();
  }
}
