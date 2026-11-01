/**
 * @file Player.js
 * @description Player entity - Arcane Wizard Cat positioned fixed at bottom-center of the screen.
 */

import { Entity } from './Entity.js';
import { PLAYER_CONFIG } from '../core/Constants.js';

export class Player extends Entity {
  constructor(canvasWidth, canvasHeight) {
    super(canvasWidth / 2, canvasHeight - 90);
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    this.maxHp = PLAYER_CONFIG.MAX_HP;
    this.hp = this.maxHp;
    this.radius = PLAYER_CONFIG.HITBOX_RADIUS;
    this.dangerRadius = PLAYER_CONFIG.DANGER_RADIUS;

    this.invulnerableTimer = 0;
    this.isInvulnerable = false;

    // Animation states
    this.time = 0;
    this.castTimer = 0;
    this.castTargetAngle = -Math.PI / 2; // Default facing up
    this.hurtTimer = 0;
    this.dangerPulse = 0;

    // Drawing gesture tracking states
    this.isDrawing = false;
    this.drawPoint = null;
    this.currentWandAngle = -Math.PI / 2 - 0.2;
    this.targetWandAngle = -Math.PI / 2 - 0.2;
    this.wandArmX = 14;
    this.wandArmY = 2;
    this.targetArmX = 14;
    this.targetArmY = 2;
  }

  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.x = width / 2;
    this.y = height - 90;
  }

  reset() {
    this.hp = this.maxHp;
    this.invulnerableTimer = 0;
    this.isInvulnerable = false;
    this.castTimer = 0;
    this.hurtTimer = 0;
    this.isDrawing = false;
    this.drawPoint = null;
    this.currentWandAngle = -Math.PI / 2 - 0.2;
    this.targetWandAngle = -Math.PI / 2 - 0.2;
    this.wandArmX = 14;
    this.wandArmY = 2;
  }

  /**
   * Update active gesture drawing state from InputHandler
   * @param {boolean} isDrawing 
   * @param {{x: number, y: number}|null} drawPoint 
   */
  setDrawing(isDrawing, drawPoint = null) {
    this.isDrawing = isDrawing;
    this.drawPoint = drawPoint;
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
      return true;
    }
    return false;
  }

  /**
   * Trigger wand casting animation towards a target point
   * @param {{x: number, y: number}} target 
   */
  castSpell(target) {
    this.castTimer = 0.28;
    if (target) {
      this.castTargetAngle = Math.atan2(target.y - this.y, target.x - this.x);
    } else {
      this.castTargetAngle = -Math.PI / 2;
    }
  }

  /**
   * Get world coordinates of wand tip to spawn projectiles
   * @returns {{x: number, y: number}}
   */
  getWandTip() {
    const wandLength = 36;
    const angle = this.currentWandAngle;
    return {
      x: this.x + this.wandArmX + Math.cos(angle) * wandLength,
      y: this.y + this.wandArmY - 15 + Math.sin(angle) * wandLength
    };
  }

  update(dt, enemies = []) {
    this.time += dt;

    // Update wand angle and arm positioning:
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
      this.targetWandAngle = this.castTargetAngle;
      this.targetArmX = 14 + Math.cos(this.castTargetAngle) * 10;
      this.targetArmY = 2 + Math.sin(this.castTargetAngle) * 8;
    } else {
      // Idle breathing sway
      this.targetWandAngle = -Math.PI / 2 - 0.2 + Math.sin(this.time * 2.5) * 0.08;
      this.targetArmX = 14;
      this.targetArmY = 2;
    }

    // Delta-time smooth interpolation (snappy tracking when drawing)
    const lerpRate = this.isDrawing ? 28 : (this.castTimer > 0 ? 32 : 12);
    const alpha = Math.min(1, dt * lerpRate);

    // Angle interpolation handling wrap-around
    let angleDiff = this.targetWandAngle - this.currentWandAngle;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    this.currentWandAngle += angleDiff * alpha;

    this.wandArmX += (this.targetArmX - this.wandArmX) * alpha;
    this.wandArmY += (this.targetArmY - this.wandArmY) * alpha;

    // Check danger zone
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

    // Cast timer countdown
    if (this.castTimer > 0) {
      this.castTimer -= dt;
    }

    // Hurt recoil timer
    if (this.hurtTimer > 0) {
      this.hurtTimer -= dt;
    }

    // Invulnerability timer
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.isInvulnerable = false;
      }
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
    ctx.strokeStyle = isDanger ? `rgba(239, 68, 68, ${0.4 * pulseFactor})` : 'rgba(168, 85, 247, 0.12)';
    ctx.lineWidth = isDanger ? 2.5 : 1.5;
    ctx.setLineDash([8, 8]);
    ctx.stroke();

    // Subtle inner glowing ring on floor
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 60);
    grad.addColorStop(0, 'rgba(167, 139, 250, 0.25)');
    grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Invulnerability Flashing
    if (this.isInvulnerable && Math.floor(this.time * 20) % 2 === 0) {
      ctx.globalAlpha = 0.35;
    }

    // Idle floating bob
    const bob = Math.sin(this.time * 3) * 3;
    ctx.translate(0, bob);

    // Hurt recoil tint
    if (this.hurtTimer > 0) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 18;
    }

    // 3. Tail wag
    const tailAngle = Math.sin(this.time * 4) * 0.35;
    ctx.save();
    ctx.translate(-16, 12);
    ctx.rotate(tailAngle);
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, 8, -20, -10);
    ctx.stroke();
    // Tail tip white
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 4. Cat Body (Robe & Fur)
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(0, 10, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // Robe collar / magical amulet
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(0, 18);
    ctx.lineTo(12, 4);
    ctx.closePath();
    ctx.fill();

    // Glowing Amulet Gem
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 5. Cat Head
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.arc(0, -12, 18, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    ctx.fillStyle = '#18181b';
    // Left ear
    ctx.beginPath();
    ctx.moveTo(-16, -18);
    ctx.lineTo(-24, -36);
    ctx.lineTo(-8, -26);
    ctx.closePath();
    ctx.fill();
    // Inner left ear (pink)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(-20, -32);
    ctx.lineTo(-10, -25);
    ctx.closePath();
    ctx.fill();

    // Right ear
    ctx.fillStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(16, -18);
    ctx.lineTo(24, -36);
    ctx.lineTo(8, -26);
    ctx.closePath();
    ctx.fill();
    // Inner right ear (pink)
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(15, -20);
    ctx.lineTo(20, -32);
    ctx.lineTo(10, -25);
    ctx.closePath();
    ctx.fill();

    // 6. Eyes (Big luminous magical eyes tracking wand/stroke)
    let pupilShiftX = 0;
    let pupilShiftY = 0;
    if (this.isDrawing && this.drawPoint) {
      const pdx = this.drawPoint.x - this.x;
      const pdy = this.drawPoint.y - (this.y - 12);
      const pdist = Math.hypot(pdx, pdy) || 1;
      pupilShiftX = (pdx / pdist) * 2.4;
      pupilShiftY = (pdy / pdist) * 2.2;
    } else if (this.castTimer > 0) {
      pupilShiftX = Math.cos(this.castTargetAngle) * 2.5;
      pupilShiftY = Math.sin(this.castTargetAngle) * 2.2;
    }

    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(-7, -12, 4, 6, 0, 0, Math.PI * 2);
    ctx.ellipse(7, -12, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights with dynamic gaze shift
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-8 + pupilShiftX * 0.4, -14 + pupilShiftY * 0.4, 1.5, 0, Math.PI * 2);
    ctx.arc(6 + pupilShiftX * 0.4, -14 + pupilShiftY * 0.4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Dark pupils looking dynamically
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(-7 + pupilShiftX, -12 + pupilShiftY, 2.2, 0, Math.PI * 2);
    ctx.arc(7 + pupilShiftX, -12 + pupilShiftY, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Tiny pink nose
    ctx.fillStyle = '#f472b6';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-2, -8);
    ctx.lineTo(2, -8);
    ctx.closePath();
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    // Left
    ctx.beginPath();
    ctx.moveTo(-12, -7); ctx.lineTo(-22, -9);
    ctx.moveTo(-12, -5); ctx.lineTo(-22, -4);
    // Right
    ctx.moveTo(12, -7); ctx.lineTo(22, -9);
    ctx.moveTo(12, -5); ctx.lineTo(22, -4);
    ctx.stroke();

    // 7. Witch Hat
    ctx.fillStyle = '#312e81';
    // Brim
    ctx.beginPath();
    ctx.ellipse(0, -24, 25, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hat Cone
    ctx.beginPath();
    ctx.moveTo(-16, -24);
    ctx.quadraticCurveTo(-6, -45, 8, -55);
    ctx.quadraticCurveTo(10, -40, 16, -24);
    ctx.closePath();
    ctx.fill();

    // Hat Band with Golden Buckle
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.rect(-6, -30, 12, 5);
    ctx.fill();

    // 8. Wizard Wand & Casting Paw (Follows drawing stroke dynamically)
    ctx.save();
    ctx.translate(this.wandArmX, this.wandArmY);

    // Cute Furry Cat Paw holding wand
    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Paw claws/pads
    ctx.fillStyle = '#312e81';
    ctx.beginPath();
    ctx.arc(2, 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Rotate wand according to current dynamic wand angle
    ctx.rotate(this.currentWandAngle + Math.PI / 2);

    // Wand stick
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -28);
    ctx.stroke();

    // Wand gold ring collar
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.rect(-2.5, -27, 5, 2.5);
    ctx.fill();

    // Wand tip crystal
    const isCasting = this.castTimer > 0;
    const isDrawing = this.isDrawing;
    const isEmpowered = isCasting || isDrawing;

    ctx.fillStyle = isEmpowered ? '#ffffff' : '#ec4899';
    ctx.shadowColor = isDrawing ? '#38bdf8' : '#ec4899';
    ctx.shadowBlur = isEmpowered ? 24 : 8;
    ctx.beginPath();
    ctx.arc(0, -30, isEmpowered ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();

    if (isEmpowered) {
      // Magic flare rays dancing at the tip
      const rayColor = isDrawing ? '#67e8f9' : '#f43f5e';
      ctx.strokeStyle = rayColor;
      ctx.lineWidth = 2;
      const rayLen = isDrawing ? 11 : 14;
      const rayPhase = this.time * 9;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
        const curA = a + rayPhase;
        ctx.beginPath();
        ctx.moveTo(Math.cos(curA) * 5, -30 + Math.sin(curA) * 5);
        ctx.lineTo(Math.cos(curA) * rayLen, -30 + Math.sin(curA) * rayLen);
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.restore();
  }
}
