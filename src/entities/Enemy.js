/**
 * @file Enemy.js
 * @description Pooled Enemy entity - Spawns from edges and moves towards Player, displaying symbol queue.
 * Optimized with Object Pooling and frame-rate independent multi-harmonic sine wave animations.
 */

import { Entity } from './Entity.js';
import { RUNES, ENEMY_TYPES } from '../core/Constants.js';
import { applyBorderPattern, resetBorderPattern, drawRunePattern } from './RunePatterns.js';

/**
 * Each boss has one signature trick that fires while it is advancing on Momo (never during a retreat):
 *  - hide:    the runes above its head turn into "?" for a moment, so the player must remember them
 *  - swirl:   the order of the remaining runes is reversed
 *  - meteors: it calls down a volley of fast single-rune ghosts (the game spawns them)
 *  - sprint:  a short burst of speed, announced as it starts
 *  - flicker: on its LAST life the runes are only readable for a short while in every cycle
 * The enemy only raises a `gimmickEvent`; Game turns it into banners, sounds and spawns.
 */
export const BOSS_GIMMICKS = {
  BOSS_LIBRARIAN: { kind: 'hide', firstDelay: 5.5, interval: 8, duration: 2.4, name: 'Sách Che Chữ' },
  BOSS_CHEF: { kind: 'swirl', firstDelay: 6, interval: 9, name: 'Súp Xoáy' },
  BOSS_PLANETARIUM: { kind: 'meteors', firstDelay: 7, interval: 12, name: 'Mưa Thiên Thạch' },
  BOSS_COACH: { kind: 'sprint', firstDelay: 6, interval: 9.5, duration: 2.2, speed: 2.1, name: 'Chạy Nước Rút' },
  BOSS_MASTER: { kind: 'flicker', visible: 1.5, hidden: 2.3, name: 'Bóng Tối Chập Chờn' }
};

const HIDDEN_RUNE = { symbol: '?', color: '#94a3b8', glow: '#64748b' };

// ---------------------------------------------------------------------------------------------
// Glow sprites
//
// ctx.shadowBlur is by far the costliest thing this file does: every blurred fill/stroke makes the
// browser rasterise the shape into a temporary layer and blur it. A ghost used to trigger ~15 of
// those per frame (its own glow, which then "leaked" into every later stroke: eyes, brows, mouth,
// fangs, accessories, rune badge...), so 20 ghosts on screen meant ~300 blur passes per frame.
//
// The glow of a given shape + colour never changes, so it is rendered once into a small offscreen
// sprite and blitted with drawImage (one textured quad). Bosses are few and keep the original look.
// If no offscreen canvas can be created (non-browser environments) the callers fall back to shadowBlur.
// ---------------------------------------------------------------------------------------------

/** key -> { canvas, ox, oy } sprite, or null when it could not be built (remembered: never retried) */
const glowSprites = new Map();
/** Mirrors the render-quality tier (QualityManager.glowScale): 0 = no glow at all */
let glowScale = 1;
/**
 * Canvas DPR. ctx.shadowBlur is measured in DEVICE pixels, so on a retina canvas the old glow was
 * blur/2 CSS pixels wide. Sprites are drawn in CSS pixels, so their blur is divided by the DPR to look the same.
 */
let pixelRatio = 1;

/** Effective sprite blur radius (CSS px) for a requested shadowBlur value */
function spriteBlur(blur) {
  return (blur * glowScale) / pixelRatio;
}

function makeSprite(w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  let canvas = null;
  if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
  } else if (typeof OffscreenCanvas === 'function') {
    canvas = new OffscreenCanvas(w, h);
  }
  const g = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
  return g ? { canvas, g } : null;
}

function cachedSprite(key, build) {
  let sprite = glowSprites.get(key);
  if (sprite === undefined) {
    try {
      sprite = build() || null;
    } catch (e) {
      sprite = null;
    }
    glowSprites.set(key, sprite);
  }
  return sprite;
}

/** '#rrggbb' -> 'rgba(r,g,b,a)'; null for anything else */
function hexToRgba(hex, a) {
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Glow of the ghost silhouette (body shape with a neutral skirt). Sprite origin = the ghost's origin. */
function buildBodyGlow(r, color, blur) {
  const pad = Math.ceil(blur * 1.3) + 2;
  const ox = r + pad;
  const oy = r * 1.2 + pad;
  const sp = makeSprite(ox * 2, oy + r * 0.88 + 4 + pad);
  if (!sp) return null;
  const g = sp.g;
  // Draw the shape far off-canvas and offset only its shadow back in: the sprite holds the halo, not the shape.
  const off = ox * 2 + blur * 3 + 50;
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.shadowOffsetX = off;
  g.fillStyle = '#000000';
  g.translate(ox - off, oy);
  g.beginPath();
  g.arc(0, -r * 0.2, r, Math.PI, 0, false);
  g.lineTo(r, r * 0.8);
  g.quadraticCurveTo(r * 0.55, r * 0.65, r * 0.15, r * 0.88);
  g.quadraticCurveTo(-r * 0.2, r * 0.88, -r * 0.55, r * 0.65);
  g.lineTo(-r, r * 0.8);
  g.closePath();
  g.fill();
  return { canvas: sp.canvas, ox, oy };
}

/**
 * Blit the cached halo behind a ghost body (in the ghost's local, already-transformed space).
 * @returns {boolean} true when the glow is handled (drawn, or switched off by the quality tier);
 *                    false when the caller must fall back to ctx.shadowBlur
 */
function drawBodyGlow(ctx, r, color, blur) {
  if (glowScale <= 0) return true;
  if (typeof ctx.drawImage !== 'function') return false;
  const sprite = cachedSprite(`body|${r}|${color}|${blur}`, () => buildBodyGlow(r, color, spriteBlur(blur)));
  if (!sprite) return false;
  ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
  return true;
}

/** Soft round halo of one colour, used for the small glowing eyes. */
function buildGlowDisc(color) {
  const size = 64;
  if (!hexToRgba(color, 1)) return null;
  const sp = makeSprite(size, size);
  if (!sp) return null;
  const grad = sp.g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Gaussian-like falloff, like a blurred shadow: bright core, fast fade, almost no tail
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    grad.addColorStop(t, hexToRgba(color, +Math.exp(-((t * 2.4) ** 2) / 2).toFixed(3)));
  }
  sp.g.fillStyle = grad;
  sp.g.fillRect(0, 0, size, size);
  return { canvas: sp.canvas, ox: size / 2, oy: size / 2 };
}

/**
 * Glow hugging a small eye of radii rx/ry. @returns {boolean} same contract as drawBodyGlow
 * (the eye is drawn right after, at the ctx origin).
 */
function drawEyeGlow(ctx, rx, ry, color, blur) {
  return drawGlowDisc(ctx, 0, 0, Math.max(rx, ry) + (blur * 0.9) / pixelRatio, color, 0.6);
}

/** @returns {boolean} same contract as drawBodyGlow */
function drawGlowDisc(ctx, x, y, radius, color, alpha) {
  if (glowScale <= 0) return true;
  if (typeof ctx.drawImage !== 'function') return false;
  const sprite = cachedSprite(`disc|${color}`, () => buildGlowDisc(color));
  if (!sprite) return false;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha * Math.min(1, glowScale);
  ctx.drawImage(sprite.canvas, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = prev;
  return true;
}

/** Glow of a rune badge (rounded rectangle). Sprite origin = the badge centre. */
function buildBadgeGlow(w, h, color, blur) {
  const pad = Math.ceil(blur * 1.3) + 2;
  const ox = w / 2 + pad;
  const oy = h / 2 + pad;
  const sp = makeSprite(ox * 2, oy * 2);
  if (!sp) return null;
  const g = sp.g;
  const off = ox * 2 + blur * 3 + 50;
  g.shadowColor = color;
  g.shadowBlur = blur;
  g.shadowOffsetX = off;
  g.fillStyle = '#000000';
  g.translate(ox - off, oy);
  g.beginPath();
  if (typeof g.roundRect === 'function') g.roundRect(-w / 2, -h / 2, w, h, 6);
  else g.rect(-w / 2, -h / 2, w, h);
  g.fill();
  return { canvas: sp.canvas, ox, oy };
}

/** @returns {boolean} same contract as drawBodyGlow */
function drawBadgeGlow(ctx, w, h, color, blur, alpha) {
  if (glowScale <= 0) return true;
  if (typeof ctx.drawImage !== 'function') return false;
  const sprite = cachedSprite(`badge|${w}|${h}|${color}|${blur}`, () => buildBadgeGlow(w, h, color, spriteBlur(blur)));
  if (!sprite) return false;
  const prev = ctx.globalAlpha;
  ctx.globalAlpha = prev * alpha;
  ctx.drawImage(sprite.canvas, -sprite.ox, -sprite.oy);
  ctx.globalAlpha = prev;
  return true;
}

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
    this.heartLifetime = 14.0;
    this.isFreezeGhost = false;
    this.isBlastGhost = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.thawTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.isMinionRetreating = false;
    this.minionRetreatTimer = 0;
    this.minionRetreatVx = 0;
    this.minionRetreatVy = 0;
    this.levelIndex = 1;
    this.levelId = 'library';

    // Golden ghost (rare visitor that drifts across the arena and escapes if not purified in time)
    this.isGolden = false;
    this.goldenLife = 0;
    this.goldenDirX = 0;
    this.goldenDirY = 0;
    this.escaped = false;
    this.escapeReported = false;

    // Boss signature trick state (see BOSS_GIMMICKS)
    this.gimmick = null;
    this.gimmickTimer = 0;
    this.gimmickEvent = null;
    this.symbolsHidden = false;
    this.hideTimer = 0;
    this.sprintTimer = 0;
    this._flickerStarted = false;

    if (config.type || config.isHeartGhost || config.isFreezeGhost || config.isBlastGhost || config.symbolQueue) {
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
    this.levelIndex = config.levelIndex || 1;
    this.levelId = config.levelId || 'library';

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

    // Special power-up ghosts: Heart (❤️), Freeze (❄️), Blast (🌀)
    this.isHeartGhost = Boolean(config.isHeartGhost || (this.symbolQueue && this.symbolQueue.includes('heart')));
    this.isFreezeGhost = Boolean(config.isFreezeGhost || (this.symbolQueue && this.symbolQueue.includes('circle')) || this.type === 'FREEZE');
    this.isBlastGhost = Boolean(config.isBlastGhost || (this.symbolQueue && this.symbolQueue.includes('spiral')) || this.type === 'BLAST');

    this.isFrozen = false;
    this.freezeTimer = 0;
    this.thawTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.isMinionRetreating = false;
    this.minionRetreatTimer = 0;
    this.minionRetreatVx = 0;
    this.minionRetreatVy = 0;

    if (this.isHeartGhost) {
      this.speed = 0;
      this.baseSpeed = 0;
      this.heartLifetime = 14.0;
      this.baseColor = '#fbcfe8';
      this.glowColor = '#f43f5e';
    } else if (this.isFreezeGhost) {
      this.speed = this.baseSpeed * (config.speedMultiplier !== undefined ? config.speedMultiplier : 0.40);
      this.baseColor = '#bae6fd';
      this.glowColor = '#38bdf8';
    } else if (this.isBlastGhost) {
      this.speed = this.baseSpeed * (config.speedMultiplier !== undefined ? config.speedMultiplier : 0.45);
      this.baseColor = '#a7f3d0';
      this.glowColor = '#10b981';
    }

    // Golden ghost: heads across the arena (not at Momo) and flees when its time is up
    this.isGolden = Boolean(config.isGolden);
    this.escaped = false;
    this.escapeReported = false;
    if (this.isGolden) {
      this.baseColor = '#fde68a';
      this.glowColor = '#f59e0b';
      this.scoreValue = 1200;
      this.goldenLife = 8.5;
      // Aim past the far side of the arena, bent sideways so the path does not run over Momo
      const cw = config.canvasWidth || 800;
      const ch = config.canvasHeight || 600;
      const side = Math.random() < 0.5 ? -1 : 1;
      const bend = Math.min(cw, ch) * 0.3 * side;
      let tx = cw - this.x;
      let ty = ch - this.y;
      let dx = tx - this.x;
      let dy = ty - this.y;
      const len = Math.hypot(dx, dy) || 1;
      tx += (-dy / len) * bend;
      ty += (dx / len) * bend;
      dx = tx - this.x;
      dy = ty - this.y;
      const d = Math.hypot(dx, dy) || 1;
      this.goldenDirX = dx / d;
      this.goldenDirY = dy / d;
    }

    // Boss signature trick
    this.gimmick = null;
    this.gimmickTimer = 0;
    this.gimmickEvent = null;
    this.symbolsHidden = false;
    this.hideTimer = 0;
    this.sprintTimer = 0;
    this._flickerStarted = false;

    // Multi-phase Boss tracking
    this.bossPhases = [];
    if (this.isBoss) {
      this.gimmick = BOSS_GIMMICKS[this.type] || null;
      this.gimmickTimer = this.gimmick && this.gimmick.firstDelay ? this.gimmick.firstDelay : 0;
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
    this.isHeartGhost = false;
    this.heartLifetime = 14.0;
    this.isFreezeGhost = false;
    this.isBlastGhost = false;
    this.isFrozen = false;
    this.freezeTimer = 0;
    this.thawTimer = 0;
    this.knockbackVx = 0;
    this.knockbackVy = 0;
    this.knockbackTimer = 0;
    this.isMinionRetreating = false;
    this.minionRetreatTimer = 0;
    this.minionRetreatVx = 0;
    this.minionRetreatVy = 0;
    this.levelIndex = 1;
    this.levelId = 'library';
    this.isGolden = false;
    this.goldenLife = 0;
    this.escaped = false;
    this.escapeReported = false;
    this.gimmick = null;
    this.gimmickTimer = 0;
    this.gimmickEvent = null;
    this.symbolsHidden = false;
    this.hideTimer = 0;
    this.sprintTimer = 0;
    this._flickerStarted = false;
  }

  /**
   * Freeze this enemy completely solid in place
   * @param {number} duration Freeze duration in seconds
   */
  freeze(duration = 4.5) {
    this.isFrozen = true;
    this.freezeTimer = duration;
    this.thawTimer = 0;
    this.slowTimer = 0;
    this.expressionTimer = duration + 0.8;
    this.shiverTimer = 0.5;
  }

  /**
   * Knockback this enemy violently away from Momo
   * @param {number} dirX Direction unit vector X away from player
   * @param {number} dirY Direction unit vector Y away from player
   * @param {number} [distance=300] Pushback distance in pixels
   * @param {number} [duration=0.42] Slide duration in seconds
   */
  knockback(dirX, dirY, distance = 300, duration = 0.42) {
    const dist = this.isBoss ? distance * 0.5 : distance;
    this.knockbackVx = (dirX * dist) / duration;
    this.knockbackVy = (dirY * dist) / duration;
    this.knockbackTimer = duration;
    this.shiverTimer = 0.6;
    this.expressionTimer = 0.8;
  }

  /**
   * Push/retreat minion backwards away from Momo when the Boss loses 1 life
   * @param {{x: number, y: number}} [playerPos] Player position
   * @param {number} [duration=1.35] Duration of retreat in seconds
   * @param {number} [speed=260] Initial retreat velocity in pixels/second
   */
  retreatWithBoss(playerPos, duration = 1.35, speed = 260) {
    if (this.isDead || this.isHeartGhost) return;

    const pPos = playerPos || this.targetPlayerPos;
    const dx = this.x - pPos.x;
    const dy = this.y - pPos.y;
    const dist = Math.hypot(dx, dy) || 1;
    let dirX = dx / dist;
    let dirY = dy / dist;

    // For Level 5 / Boss Master minions located in front of Momo (to the right), recoil towards the right
    if (this.levelIndex === 5 && dx >= 0 && dirX < 0.25) {
      dirX = 0.85;
      dirY = dirY * 0.5;
    }

    this.isMinionRetreating = true;
    this.minionRetreatTimer = duration;
    this.minionRetreatVx = dirX * speed;
    this.minionRetreatVy = dirY * speed;
    this.shiverTimer = Math.max(this.shiverTimer, duration);
    this.expressionTimer = Math.max(this.expressionTimer, duration + 0.3);
    this.hitTimer = 0.35;
  }

  /**
   * Check collision with player or other entities
   * @param {Entity} other 
   * @returns {boolean}
   */
  collidesWith(other) {
    if (this.isGolden) return false; // harmless: it only wants to get away
    if (this.isRetreating || this.isMinionRetreating) return false;
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
   * Calculate coordinated edge spawn positions for a squad of enemies appearing simultaneously,
   * dispersing them along different borders so they do not overlap and surround Momo dynamically.
   * @param {number} count 
   * @param {number} canvasWidth 
   * @param {number} canvasHeight 
   * @returns {Array<{x: number, y: number}>}
   */
  static getSquadEdgePositions(count, canvasWidth, canvasHeight) {
    if (count <= 1) {
      return [Enemy.getRandomEdgePosition(canvasWidth, canvasHeight)];
    }

    const margin = 60;
    const positions = [];
    // Edges: 0: Top, 1: Bottom, 2: Left, 3: Right
    let chosenEdges = [];

    if (count === 2) {
      // 2 ghosts: 50% opposite edges (Left & Right or Top & Bottom), 50% adjacent
      const roll = Math.random();
      if (roll < 0.5) {
        chosenEdges = Math.random() < 0.5 ? [2, 3] : [0, 1]; // Left & Right or Top & Bottom
      } else {
        const first = Math.floor(Math.random() * 4);
        const second = (first + 1 + Math.floor(Math.random() * 2)) % 4;
        chosenEdges = [first, second];
      }
    } else if (count === 3) {
      // 3 ghosts: pick 3 distinct edges out of 4
      const omit = Math.floor(Math.random() * 4);
      chosenEdges = [0, 1, 2, 3].filter(e => e !== omit);
    } else if (count === 4) {
      // 4 ghosts: all 4 borders (ambush from every side!)
      chosenEdges = [0, 1, 2, 3];
    } else {
      // 5+ ghosts: distribute across all 4 borders
      chosenEdges = [];
      for (let i = 0; i < count; i++) {
        chosenEdges.push(i % 4);
      }
    }

    // Shuffle edges so assignment isn't deterministic
    for (let i = chosenEdges.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chosenEdges[i], chosenEdges[j]] = [chosenEdges[j], chosenEdges[i]];
    }

    for (let i = 0; i < count; i++) {
      const edge = chosenEdges[i];
      let x, y;
      switch (edge) {
        case 0: // Top
          x = Math.random() * (canvasWidth - 100) + 50;
          y = -margin;
          break;
        case 1: // Bottom
          x = Math.random() * (canvasWidth - 100) + 50;
          y = canvasHeight + margin;
          break;
        case 2: // Left
          x = -margin;
          y = Math.random() * (canvasHeight - 100) + 50;
          break;
        case 3: // Right
        default:
          x = canvasWidth + margin;
          y = Math.random() * (canvasHeight - 100) + 50;
          break;
      }
      positions.push({ x, y });
    }

    return positions;
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
        // Ghost was hit and survived: briefly flinch and CHANGE FACIAL EXPRESSION without freezing
        this.slowTimer = 0.75;
        this.slowFactor = 0.35;
        this.expressionTimer = 1.2;
        this.shiverTimer = 0.35;
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
    this.symbolsHidden = false;
    this.hideTimer = 0;
    this.sprintTimer = 0;
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

    // Minion retreat recoil when Boss loses 1 life
    if (this.isMinionRetreating) {
      this.minionRetreatTimer -= dt;
      this.x += this.minionRetreatVx * dt;
      this.y += this.minionRetreatVy * dt;
      this.minionRetreatVx *= Math.pow(0.55, dt);
      this.minionRetreatVy *= Math.pow(0.55, dt);

      if (this.canvasWidth > 0 && this.canvasHeight > 0) {
        this.x = Math.max(-120, Math.min(this.canvasWidth + 120, this.x));
        this.y = Math.max(-120, Math.min(this.canvasHeight + 120, this.y));
      }

      if (this.minionRetreatTimer <= 0) {
        this.isMinionRetreating = false;
        this.minionRetreatVx = 0;
        this.minionRetreatVy = 0;
      }
      return;
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

    // Knockback physics impulse: slide backwards away from Momo
    if (this.knockbackTimer > 0) {
      this.knockbackTimer -= dt;
      this.x += this.knockbackVx * dt;
      this.y += this.knockbackVy * dt;
      this.knockbackVx *= Math.pow(0.12, dt);
      this.knockbackVy *= Math.pow(0.12, dt);
    }

    // Freeze state machine: when frozen solid, enemy cannot advance at all!
    if (this.freezeTimer > 0) {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.isFrozen = false;
        this.thawTimer = 1.5; // Thaw transition with 50% slow
      }
      return;
    }
    if (this.thawTimer > 0) {
      this.thawTimer -= dt;
    }

    if (this.isBoss) this._updateGimmick(dt);
    if (this.isGolden) {
      this._updateGolden(dt);
      return;
    }

    // Heart ghost stays stationary in one place with a 14s lifetime before expiring
    if (this.isHeartGhost || this.symbolQueue.includes('heart')) {
      if (this.heartLifetime > 0) {
        this.heartLifetime -= dt;
        if (this.heartLifetime <= 0) {
          this.isDead = true;
        }
      }
      return;
    }

    // Thaw multiplier reduces speed during gradual defrost
    const thawMult = this.thawTimer > 0 ? 0.50 : 1.0;

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
        const currentSpeed = this.speed * (this.slowTimer > 0 ? this.slowFactor : 1.0) * thawMult;
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

      // Close Danger warning: when within 175px of Momo, show warning visual without unfair speed spike
      const isCloseDanger = dist < 175 && !this.isBoss && !this.isHeartGhost;
      this.isCloseDanger = isCloseDanger;
      const surgeMult = 1.0;

      const sprintMult = this.sprintTimer > 0 && this.gimmick ? this.gimmick.speed : 1.0;
      const currentSpeed = this.speed * (this.slowTimer > 0 ? this.slowFactor : 1.0) * surgeMult * thawMult * sprintMult;
      const wave = Math.sin(this.time * this.oscillationFrequency + this.phase) * (currentSpeed * this.oscillationAmplitude);

      this.x += (nx * currentSpeed + px * wave) * dt;
      this.y += (ny * currentSpeed + py * wave) * dt;
    }
  }

  /**
   * Golden ghost: glide along its heading with a gentle weave; when its time runs out it bolts for the edge.
   * It never touches Momo (see collidesWith) and leaves without a trace if it gets away.
   * @param {number} dt
   */
  _updateGolden(dt) {
    const fleeing = this.goldenLife <= 0;
    if (!fleeing) this.goldenLife -= dt;
    const boost = fleeing ? 2.4 : 1.0;
    const weave = Math.sin(this.time * 3.2 + this.phase) * this.speed * 0.45;
    const px = -this.goldenDirY;
    const py = this.goldenDirX;
    const slow = this.slowTimer > 0 ? this.slowFactor : 1.0;
    this.x += (this.goldenDirX * this.speed * boost * slow + px * weave) * dt;
    this.y += (this.goldenDirY * this.speed * boost * slow + py * weave) * dt;

    const m = 140;
    if (this.x < -m || this.x > this.canvasWidth + m || this.y < -m || this.y > this.canvasHeight + m) {
      this.escaped = true;
      this.isDead = true;
      if (typeof Enemy.onGoldenEscape === 'function') Enemy.onGoldenEscape(this);
    }
  }

  /**
   * Advance a boss's signature trick (see BOSS_GIMMICKS). Only raises `gimmickEvent`; Game reacts to it.
   * @param {number} dt
   */
  _updateGimmick(dt) {
    const g = this.gimmick;
    if (!g) return;
    if (this.sprintTimer > 0) this.sprintTimer = Math.max(0, this.sprintTimer - dt);

    if (g.kind === 'flicker') {
      // Only on the last life: the runes are readable for `visible` seconds out of every cycle
      if (this.bossLives > 1) {
        this.symbolsHidden = false;
        return;
      }
      if (!this._flickerStarted) {
        this._flickerStarted = true;
        this.gimmickTimer = 0;
        this.gimmickEvent = 'FLICKER';
      }
      this.gimmickTimer += dt;
      this.symbolsHidden = (this.gimmickTimer % (g.visible + g.hidden)) > g.visible;
      return;
    }

    if (this.symbolsHidden) {
      this.hideTimer -= dt;
      if (this.hideTimer <= 0) this.symbolsHidden = false;
    }

    this.gimmickTimer -= dt;
    if (this.gimmickTimer > 0) return;
    this.gimmickTimer = g.interval;

    if (g.kind === 'hide') {
      this.symbolsHidden = true;
      this.hideTimer = g.duration;
      this.gimmickEvent = 'HIDE';
    } else if (g.kind === 'swirl') {
      if (this.symbolQueue.length > 1) {
        this.symbolQueue.reverse();
        this.hitTimer = 0.3;
        this.gimmickEvent = 'SWIRL';
      }
    } else if (g.kind === 'meteors') {
      this.gimmickEvent = 'METEORS';
    } else if (g.kind === 'sprint') {
      this.sprintTimer = g.duration;
      this.gimmickEvent = 'SPRINT';
    }
  }

  /** Shimmering halo and orbiting sparkles around the golden ghost */
  _renderGoldenAura(ctx) {
    const r = this.radius;
    const t = this.time;
    ctx.save();
    // Fade in and out while it is about to escape
    if (this.goldenLife < 2.5) {
      ctx.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(t * 10));
    }
    const pulse = 0.85 + 0.15 * Math.sin(t * 5);
    const grad = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.4 * pulse);
    grad.addColorStop(0, 'rgba(253, 224, 71, 0.55)');
    grad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r * 2.4 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const a = t * 2.2 + (i * Math.PI) / 2;
      ctx.fillText('✦', Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.4);
    }
    ctx.restore();
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

    // Heart ghost blinking fade when expiring
    if (isHeart && this.heartLifetime < 3.5) {
      const blink = Math.sin(this.time * 12) * 0.35 + 0.65;
      ctx.globalAlpha = Math.max(0.2, Math.min(1.0, blink * (this.heartLifetime / 3.5)));
    }

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

    // Minion recoil wind streaks when pushed back with Boss
    if (this.isMinionRetreating) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      const sDirX = this.minionRetreatVx ? -Math.sign(this.minionRetreatVx) : 1;
      ctx.moveTo(0, -this.radius * 0.35);
      ctx.lineTo(sDirX * 24, -this.radius * 0.35);
      ctx.moveTo(0, this.radius * 0.35);
      ctx.lineTo(sDirX * 30, this.radius * 0.35);
      ctx.stroke();
      ctx.restore();
    }

    if (this.isGolden) this._renderGoldenAura(ctx);

    // 2. Ghost Body
    ctx.save();
    ctx.rotate(sway);
    ctx.scale(scaleX, scaleY);

    const r = this.radius;

    if (this.isFinalBoss) {
      this._renderFinalBossBody(ctx, r, animTime, isHit, isScared);
    } else {
      const isAnyBoss = Boolean(this.isBoss || this.type === 'BOSS' || (typeof this.type === 'string' && this.type.startsWith('BOSS_')));
      // Minions are the ones that show up in numbers: their glow comes from a cached sprite and no
      // shadow stays active for the strokes that follow. Bosses are few and keep the original shadowBlur look.
      const lite = !isAnyBoss;

      let glowColor;
      let glowBlur;
      if (isHit) {
        ctx.fillStyle = '#ffffff';
        glowColor = '#ffffff';
        glowBlur = 24;
      } else if (isHeart) {
        ctx.fillStyle = '#fce7f3';
        glowColor = '#f43f5e';
        glowBlur = 20;
      } else if (this.type === 'BOSS_LIBRARIAN') {
        const bgGrad = ctx.createLinearGradient(0, -r, 0, r);
        bgGrad.addColorStop(0, '#7dd3fc');
        bgGrad.addColorStop(0.5, '#38bdf8');
        bgGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = bgGrad;
        glowColor = '#38bdf8';
        glowBlur = 22;
      } else if (this.type === 'BOSS_CHEF') {
        const bgGrad = ctx.createLinearGradient(0, -r, 0, r);
        bgGrad.addColorStop(0, '#fed7aa');
        bgGrad.addColorStop(0.45, '#fb923c');
        bgGrad.addColorStop(1, '#ea580c');
        ctx.fillStyle = bgGrad;
        glowColor = '#f97316';
        glowBlur = 22;
      } else if (this.type === 'BOSS_PLANETARIUM') {
        const bgGrad = ctx.createLinearGradient(0, -r, 0, r);
        bgGrad.addColorStop(0, '#e9d5ff');
        bgGrad.addColorStop(0.5, '#c084fc');
        bgGrad.addColorStop(1, '#7e22ce');
        ctx.fillStyle = bgGrad;
        glowColor = '#c084fc';
        glowBlur = 24;
      } else if (this.type === 'BOSS_COACH') {
        const bgGrad = ctx.createLinearGradient(0, -r, 0, r);
        bgGrad.addColorStop(0, '#a7f3d0');
        bgGrad.addColorStop(0.45, '#34d399');
        bgGrad.addColorStop(1, '#059669');
        ctx.fillStyle = bgGrad;
        glowColor = '#10b981';
        glowBlur = 22;
      } else {
        ctx.fillStyle = this.baseColor;
        glowColor = this.glowColor;
        glowBlur = 16;
      }

      if (!(lite && drawBodyGlow(ctx, r, glowColor, glowBlur))) {
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = glowBlur;
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
      // Only the body glows. Without this, the body's blur would also be applied to every stroke below.
      if (lite) ctx.shadowBlur = 0;

      // Danger surge aura when closing in fast to Momo
      if (this.isCloseDanger && !isHeart) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

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
      } else if (this.isFreezeGhost) {
        // Frosty cheeks & glowing snowflake chest crest
        ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
        ctx.beginPath();
        ctx.arc(-r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#0284c7';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('❄️', 0, r * 0.40);
        ctx.shadowBlur = 0;
      } else if (this.isBlastGhost) {
        // Tempest cheeks & swirling gale vortex chest crest
        ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
        ctx.beginPath();
        ctx.arc(-r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
        ctx.arc(r * 0.42, r * 0.04, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#059669';
        ctx.shadowColor = '#34d399';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🌀', 0, r * 0.40);
        ctx.shadowBlur = 0;
      }

      // FROZEN SOLID ICE BLOCK VISUAL CASING
      if (this.isFrozen || this.freezeTimer > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(186, 230, 253, 0.38)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
        // Freeze-all puts an ice block on EVERY ghost at once: no blur for minions
        if (!lite) {
          ctx.shadowColor = '#0284c7';
          ctx.shadowBlur = 12;
        }

        const ir = r * 1.35;
        ctx.beginPath();
        for (let a = 0; a < 6; a++) {
          const angle = (a / 6) * Math.PI * 2 + Math.PI / 6;
          const px = Math.cos(angle) * ir;
          const py = Math.sin(angle) * (ir * 1.08);
          if (a === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shimmering internal facet reflection lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-ir * 0.45, -ir * 0.7);
        ctx.lineTo(-ir * 0.15, -ir * 0.15);
        ctx.lineTo(ir * 0.5, -ir * 0.4);
        ctx.stroke();
        ctx.restore();
      }

      // 3. Archetype & Story Boss Accessories
      if (this.type === 'ARMORED') {
        // Hắc Giáp Tướng Quân: Heavy horned dark knight helm & spiked shoulder guards
        // (no extra shadowBlur: its body sprite already carries the purple glow)
        ctx.strokeStyle = '#4c1d95';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r + 4, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.stroke();

        ctx.fillStyle = '#6d28d9';

        // Left Spiked Pauldron
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.4);
        ctx.lineTo(-r * 1.40, -r * 1.15);
        ctx.lineTo(-r * 0.35, -r * 0.7);
        ctx.closePath();
        ctx.fill();

        // Right Spiked Pauldron
        ctx.beginPath();
        ctx.moveTo(r * 0.8, -r * 0.4);
        ctx.lineTo(r * 1.40, -r * 1.15);
        ctx.lineTo(r * 0.35, -r * 0.7);
        ctx.closePath();
        ctx.fill();

        // Knight Helm Visor Plate
        ctx.fillStyle = '#2e1065';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-r * 0.70, -r * 0.55, r * 1.4, 12, 3);
        ctx.fill();
        ctx.stroke();

        // Visor glowing eye slit
        ctx.fillStyle = '#a855f7';
        ctx.fillRect(-r * 0.55, -r * 0.50, r * 1.1, 3);
      } else if (this.type === 'BOSS_LIBRARIAN') {
        // =========================================================================
        // 1. MADAME LIBRARIA: BÓNG MA THỦ THƯ (THE KEEPER OF LOST PAGES)
        // Lore: 200yo spectral librarian, ethereal cyan ghost, scholar bun with golden
        // hairpin, reading spectacles with delicate chain, floating open ancient Grimoire
        // with glowing runes [—] and [|], and fluttering ancient book pages.
        // =========================================================================

        // Elegant Spectral Hair Bun with Golden Hairpin
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#bae6fd';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, -r * 1.12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Golden hairpin with amber tip
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, -r * 1.12);
        ctx.lineTo(16, -r * 1.12);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(16, -r * 1.12, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Mortarboard Scholar Cap with golden tassel
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.90, -r * 0.85);
        ctx.lineTo(r * 0.90, -r * 0.85);
        ctx.lineTo(0, -r * 1.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cap Gold Tassel
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.35);
        ctx.lineTo(r * 0.85, -r * 1.05);
        ctx.lineTo(r * 0.85, -r * 0.70);
        ctx.stroke();
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(r * 0.85, -r * 0.68, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Golden Reading Spectacles & Chain
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(-r * 0.35, -r * 0.20, r * 0.22, 0, Math.PI * 2);
        ctx.arc(r * 0.35, -r * 0.20, r * 0.22, 0, Math.PI * 2);
        ctx.moveTo(-r * 0.13, -r * 0.20);
        ctx.lineTo(r * 0.13, -r * 0.20);
        ctx.stroke();

        // Delicate silver spectacle chain looping to left shoulder
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(-r * 0.57, -r * 0.20);
        ctx.bezierCurveTo(-r * 0.85, 0, -r * 0.75, r * 0.40, -r * 0.45, r * 0.55);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        // Floating Antique Open Grimoire (Cổ Thư Khổng Lồ)
        const bookW = r * 1.25;
        const bookH = r * 0.52;
        const bookY = r * 0.42 + Math.sin(animTime * 0.005) * 4;

        ctx.save();
        ctx.translate(0, bookY);
        // Outer dark blue leather cover
        ctx.fillStyle = '#1e3a8a';
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#3b82f6';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        // Left page cover
        ctx.moveTo(-bookW * 0.52, -bookH * 0.45);
        ctx.quadraticCurveTo(-bookW * 0.25, -bookH * 0.55, 0, -bookH * 0.40);
        ctx.lineTo(0, bookH * 0.48);
        ctx.quadraticCurveTo(-bookW * 0.25, bookH * 0.38, -bookW * 0.52, bookH * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right page cover
        ctx.beginPath();
        ctx.moveTo(0, -bookH * 0.40);
        ctx.quadraticCurveTo(bookW * 0.25, -bookH * 0.55, bookW * 0.52, -bookH * 0.45);
        ctx.lineTo(bookW * 0.52, bookH * 0.48);
        ctx.quadraticCurveTo(bookW * 0.25, bookH * 0.38, 0, bookH * 0.48);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Parchment Pages inside
        ctx.fillStyle = '#e0f2fe';
        ctx.beginPath();
        ctx.moveTo(-bookW * 0.48, -bookH * 0.40);
        ctx.quadraticCurveTo(-bookW * 0.25, -bookH * 0.48, -2, -bookH * 0.36);
        ctx.lineTo(-2, bookH * 0.42);
        ctx.quadraticCurveTo(-bookW * 0.25, bookH * 0.32, -bookW * 0.48, bookH * 0.42);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(2, -bookH * 0.36);
        ctx.quadraticCurveTo(bookW * 0.25, -bookH * 0.48, bookW * 0.48, -bookH * 0.40);
        ctx.lineTo(bookW * 0.48, bookH * 0.42);
        ctx.quadraticCurveTo(bookW * 0.25, bookH * 0.32, 2, bookH * 0.42);
        ctx.closePath();
        ctx.fill();

        // Glowing Ancient Runes: [—] on left page and [|] on right page
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#60a5fa';
        ctx.shadowBlur = 6;
        // Left rune: Horizontal —
        ctx.beginPath();
        ctx.moveTo(-bookW * 0.34, 0);
        ctx.lineTo(-bookW * 0.14, 0);
        ctx.stroke();
        // Right rune: Vertical |
        ctx.beginPath();
        ctx.moveTo(bookW * 0.24, -bookH * 0.22);
        ctx.lineTo(bookW * 0.24, bookH * 0.22);
        ctx.stroke();

        ctx.restore();

        // 3 Fluttering Ancient Pages orbiting around Madame Libraria
        for (let p = 0; p < 3; p++) {
          const pageAngle = animTime * 0.003 + (p * Math.PI * 2) / 3;
          const px = Math.cos(pageAngle) * (r * 1.35);
          const py = Math.sin(pageAngle) * (r * 0.70);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(pageAngle + 0.4);
          ctx.fillStyle = '#f8fafc';
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 1.2;
          ctx.shadowColor = '#60a5fa';
          ctx.shadowBlur = 8;
          ctx.fillRect(-7, -10, 14, 20);
          ctx.strokeRect(-7, -10, 14, 20);
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          if (p % 2 === 0) {
            ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
          } else {
            ctx.moveTo(0, -5); ctx.lineTo(0, 5);
          }
          ctx.stroke();
          ctx.restore();
        }
      } else if (this.type === 'BOSS_CHEF') {
        // =========================================================================
        // 2. CHEF BOUILLON: BÓNG MA ĐẦU BẾP (THE PHANTOM GOURMAND)
        // Lore: Ghost chef of gigantic spectral kitchen, fiery flame ghost, tall pleated
        // chef toque with orange band, signature curling mustache, giant iron ladle
        // dripping orange broth, and steaming soup bubbles.
        // =========================================================================

        // Tall Pleated Chef Toque (Hat)
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#fdba74';
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.moveTo(-r * 0.48, -r * 0.85);
        ctx.bezierCurveTo(-r * 0.75, -r * 1.25, -r * 0.55, -r * 1.65, -r * 0.18, -r * 1.60);
        ctx.bezierCurveTo(0, -r * 1.75, r * 0.20, -r * 1.70, r * 0.35, -r * 1.55);
        ctx.bezierCurveTo(r * 0.75, -r * 1.45, r * 0.70, -r * 1.05, r * 0.48, -r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Hat Pleat Lines
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.18, -r * 1.55); ctx.lineTo(-r * 0.20, -r * 0.90);
        ctx.moveTo(0, -r * 1.65); ctx.lineTo(0, -r * 0.90);
        ctx.moveTo(r * 0.18, -r * 1.55); ctx.lineTo(r * 0.20, -r * 0.90);
        ctx.stroke();

        // Hat Band with gold button
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-r * 0.46, -r * 0.88, r * 0.92, 9);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -r * 0.88 + 4.5, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Giant Iron Cauldron Ladle with Dripping Broth
        ctx.save();
        ctx.translate(r * 0.85, r * 0.10);
        ctx.rotate(0.35 + Math.sin(animTime * 0.005) * 0.08);

        // Ladle handle
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 4.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.75);
        ctx.lineTo(0, r * 0.50);
        ctx.stroke();

        // Hook at top of handle
        ctx.beginPath();
        ctx.arc(-5, -r * 0.75, 5, 0, Math.PI);
        ctx.stroke();

        // Ladle bowl holding glowing broth
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.50, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing orange soup broth inside
        ctx.fillStyle = '#ea580c';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.50, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Golden herb / magic speckles in soup
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-4, r * 0.48, 1.8, 0, Math.PI * 2);
        ctx.arc(3, r * 0.52, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Dripping soup droplets falling from ladle
        const dripY = r * 0.50 + 10 + (animTime * 0.04 % 24);
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, dripY, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Steaming soup bubbles floating around Chef Bouillon
        for (let b = 0; b < 4; b++) {
          const bAngle = animTime * 0.004 + b * 1.6;
          const bx = Math.sin(bAngle) * (r * 0.95);
          const by = -r * 0.3 - ((animTime * 0.02 + b * 18) % (r * 1.2));
          ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
          ctx.shadowColor = '#fdba74';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (this.type === 'BOSS_PLANETARIUM') {
        // =========================================================================
        // 3. PROFESSOR STELLA: BÓNG MA THIÊN VĂN (THE ORBIT MASTER)
        // Lore: Astrology professor trapped in ancient celestial armillary spheres,
        // cosmic starry nebula body, tilted Saturn-like planetary orbit rings,
        // multiple orbiting planets (cyan, ruby, gold), star-shaped eyes,
        // and floating amethyst celestial orb with lightning rune ⚡.
        // =========================================================================

        // Tilted Saturn-like Planetary Orbit Rings (Behind & across body)
        ctx.save();
        ctx.rotate(-0.30); // ~ -17 degrees tilt

        // Outer starlight orbit ring
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
        ctx.lineWidth = 3.0;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.55, r * 0.52, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Inner cosmic dust ring with dash gaps
        ctx.strokeStyle = 'rgba(244, 114, 182, 0.65)';
        ctx.lineWidth = 2.0;
        ctx.setLineDash([8, 4]);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.38, r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Orbiting Planet 1: Starlight Cyan Planet with white atmosphere
        const a1 = animTime * 0.0022;
        const p1x = Math.cos(a1) * (r * 1.55);
        const p1y = Math.sin(a1) * (r * 0.52);
        ctx.fillStyle = '#38bdf8';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p1x, p1y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Orbiting Planet 2: Ruby Nebula Moon
        const a2 = a1 + (Math.PI * 2 / 3);
        const p2x = Math.cos(a2) * (r * 1.55);
        const p2y = Math.sin(a2) * (r * 0.52);
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p2x, p2y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Orbiting Planet 3: Golden Sun-Sphere
        const a3 = a1 + (Math.PI * 4 / 3);
        const p3x = Math.cos(a3) * (r * 1.38);
        const p3y = Math.sin(a3) * (r * 0.42);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p3x, p3y, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Third-Eye Star on forehead
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#eab308';
        ctx.shadowBlur = 14;
        const starY = -r * 0.65;
        ctx.beginPath();
        ctx.moveTo(0, starY - 7);
        ctx.lineTo(2, starY - 2);
        ctx.lineTo(7, starY);
        ctx.lineTo(2, starY + 2);
        ctx.lineTo(0, starY + 7);
        ctx.lineTo(-2, starY + 2);
        ctx.lineTo(-7, starY);
        ctx.lineTo(-2, starY - 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Floating Celestial Orb with Lightning Rune ⚡ (below body)
        const orbY = r * 0.68 + Math.sin(animTime * 0.005) * 4;
        ctx.save();
        ctx.fillStyle = '#7e22ce';
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, orbY, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Glowing Lightning Rune inside orb
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, orbY + 1);
        ctx.restore();
      } else if (this.type === 'BOSS_COACH') {
        // =========================================================================
        // 4. COACH STRIKER: BÓNG MA HUẤN LUYỆN VIÊN (THE SPECTRAL WHISTLE-MASTER)
        // Lore: Strictest gym coach, broad-shouldered athletic emerald specter,
        // white athletic sweatband with emerald lightning logo, black & white referee
        // striped collar, silver referee whistle on red lanyard with pulsing soundwaves.
        // =========================================================================

        // Broad Athletic Shoulders & Muscular Silhouette Wings
        ctx.save();
        ctx.fillStyle = '#059669';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 10;
        // Left Athletic Shoulder
        ctx.beginPath();
        ctx.ellipse(-r * 0.95, -r * 0.15, r * 0.40, r * 0.28, 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Right Athletic Shoulder
        ctx.beginPath();
        ctx.ellipse(r * 0.95, -r * 0.15, r * 0.40, r * 0.28, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // White Wrist Sweatbands
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(-r * 1.20, -r * 0.10, 8, 14);
        ctx.fillRect(r * 1.12, -r * 0.10, 8, 14);
        ctx.restore();

        // White Athletic Headband across forehead
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.roundRect(-r * 0.78, -r * 0.65, r * 1.56, 12, 4);
        ctx.fill();
        ctx.stroke();

        // Emerald Lightning Emblem on Headband
        ctx.fillStyle = '#059669';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', 0, -r * 0.65 + 6);

        // Referee Jersey Striped Collar on Chest
        const refY = r * 0.15;
        const refW = r * 0.85;
        const refH = r * 0.35;
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-refW / 2, refY, refW, refH);
        ctx.fillStyle = '#0f172a';
        // 3 Black vertical stripes
        const stripeW = refW / 6;
        ctx.fillRect(-refW / 2 + stripeW, refY, stripeW, refH);
        ctx.fillRect(-refW / 2 + stripeW * 3, refY, stripeW, refH);
        ctx.fillRect(-refW / 2 + stripeW * 5, refY, stripeW, refH);
        ctx.strokeStyle = '#047857';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-refW / 2, refY, refW, refH);
        ctx.restore();

        // Silver Referee Whistle on Red Lanyard
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.22, -r * 0.05);
        ctx.quadraticCurveTo(0, r * 0.38, 0, r * 0.48);
        ctx.quadraticCurveTo(0, r * 0.38, r * 0.22, -r * 0.05);
        ctx.stroke();

        // Polished silver whistle body
        const whistleY = r * 0.52;
        ctx.save();
        ctx.fillStyle = '#e2e8f0';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 8;

        // Whistle nozzle
        ctx.fillRect(0, whistleY - 4, 12, 8);
        ctx.strokeRect(0, whistleY - 4, 12, 8);
        // Whistle sound chamber cylinder
        ctx.beginPath();
        ctx.arc(0, whistleY, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Whistle hole
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(0, whistleY, 3, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Whistle Soundwaves
        const wavePulse = (animTime * 0.03) % 18;
        ctx.strokeStyle = 'rgba(52, 211, 153, ' + Math.max(0, 1 - wavePulse / 18) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(12, whistleY, 4 + wavePulse, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(12, whistleY, 9 + wavePulse, -0.6, 0.6);
        ctx.stroke();

        ctx.restore();
      } else if (this.type === 'BOSS') {
        // Generic fallback boss
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, -r * 0.2, r + 6, Math.PI * 0.85, Math.PI * 0.15, true);
        ctx.stroke();
      }

      // 4. Thematic Minion details matching the 5 Stages
      if (!isAnyBoss && !isHeart && !this.isFreezeGhost && !this.isBlastGhost) {
        if (this.type === 'SPEEDSTER') {
          // Speedster phantom dart: aerodynamic wind stream lines
          ctx.strokeStyle = '#f472b6';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(-r * 0.7, r * 0.5); ctx.lineTo(-r * 1.35, r * 0.85 + Math.sin(animTime * 0.01) * 4);
          ctx.moveTo(r * 0.7, r * 0.5); ctx.lineTo(r * 1.35, r * 0.85 + Math.cos(animTime * 0.01) * 4);
          ctx.stroke();
        }

        if (this.levelIndex === 1 || this.levelId === 'library') {
          // Level 1: Ancient Library Wisps - floating miniature parchment scroll / book page
          const pAngle = animTime * 0.003 + this.phase;
          const px = Math.cos(pAngle) * (r * 1.15);
          const py = Math.sin(pAngle) * (r * 0.55);
          ctx.fillStyle = '#fef08a';
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          ctx.fillRect(px - 4, py - 6, 8, 12);
          ctx.strokeRect(px - 4, py - 6, 8, 12);
        } else if (this.levelIndex === 2 || this.levelId === 'cafeteria') {
          // Level 2: Cafeteria & Kitchen Wisps - tiny apprentice toque or simmering soup ember
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#fdba74';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(0, -r * 0.95, 6, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          // Warm soup spark
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(r * 0.5, r * 0.2 + Math.sin(animTime * 0.008) * 3, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.levelIndex === 3 || this.levelId === 'classroom') {
          // Level 3: Astronomical Wisps - miniature celestial starlight orbit
          ctx.strokeStyle = 'rgba(192, 132, 252, 0.65)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 1.25, r * 0.35, 0.2, 0, Math.PI * 2);
          ctx.stroke();
          // Mini star spark on orbit
          const stAngle = animTime * 0.004 + this.phase;
          ctx.fillStyle = '#fde047';
          ctx.beginPath();
          ctx.arc(Math.cos(stAngle) * (r * 1.25), Math.sin(stAngle) * (r * 0.35), 2.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.levelIndex === 4 || this.levelId === 'gymnasium') {
          // Level 4: Gymnasium Wisps - tiny athlete sweatband & agility wind trails
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-r * 0.55, -r * 0.55, r * 1.1, 4);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-r * 1.1, 0); ctx.lineTo(-r * 0.6, -2);
          ctx.moveTo(-r * 1.2, r * 0.2); ctx.lineTo(-r * 0.7, r * 0.2);
          ctx.stroke();
        } else if (this.levelIndex === 5 || this.levelId === 'rooftop') {
          // Level 5: Corrupted Rooftop Wisps - dark crimson void aura edge
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.arc(0, -r * 0.2, r + 3, 0, Math.PI * 2);
          ctx.stroke();
        }
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
    // Minions: glow from cached sprites. Bosses (one at a time) keep real shadowBlur.
    const lite = !isAnyBoss;

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

    if (isHeart || this.isFreezeGhost || this.isBlastGhost) {
      // Gentle, friendly spirit face for special power-up companions
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.ellipse(eyeOffsetX, eyeOffsetY, eyeRadiusX, eyeRadiusY, 0, 0, Math.PI * 2);
      ctx.fill();

      // Soft pupil colored by power-up type
      const pupilShift = r * 0.05;
      const px = Math.cos(angleToPlayer) * pupilShift;
      const py = Math.sin(angleToPlayer) * pupilShift * eyeScaleY;
      const pupilColor = isHeart ? '#f43f5e' : (this.isFreezeGhost ? '#0284c7' : '#059669');
      ctx.fillStyle = pupilColor;
      ctx.beginPath();
      ctx.arc(-eyeOffsetX + px, eyeOffsetY + py, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.arc(eyeOffsetX + px, eyeOffsetY + py, eyeRadiusX * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // Cute smile
      ctx.strokeStyle = pupilColor;
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

    if (this.type === 'BOSS_MASTER') {
      scleraColor = '#ef4444';
      glowColor = '#f43f5e';
      pupilColor = '#18040b';
      browColor = '#4c0519';
      glowBlur = 18;
    } else if (this.type === 'BOSS_PLANETARIUM') {
      scleraColor = '#fdf4ff';
      glowColor = '#c084fc';
      pupilColor = '#581c87';
      browColor = '#3b0764';
      glowBlur = 14;
    } else if (this.type === 'BOSS_CHEF') {
      scleraColor = '#fff7ed';
      glowColor = '#f97316';
      pupilColor = '#431407';
      browColor = '#7c2d12';
      glowBlur = 12;
    } else if (this.type === 'BOSS_LIBRARIAN') {
      scleraColor = '#f0f9ff';
      glowColor = '#38bdf8';
      pupilColor = '#0c4a6e';
      browColor = '#1e3a8a';
      glowBlur = 12;
    } else if (this.type === 'BOSS_COACH') {
      scleraColor = '#ecfdf5';
      glowColor = '#10b981';
      pupilColor = '#064e3b';
      browColor = '#064e3b';
      glowBlur = 12;
    } else if (isAnyBoss) {
      scleraColor = '#fef08a';
      glowColor = '#f43f5e';
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
    this._beginEyeGlow(ctx, lite, glowColor, glowBlur, eyeRadiusX, eyeRadiusY);
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
    } else if (this.type === 'BOSS_PLANETARIUM') {
      // Professor Stella: Twinkling 4-pointed Star Pupil
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -eyeRadiusY * 0.7);
      ctx.lineTo(eyeRadiusX * 0.25, -eyeRadiusY * 0.25);
      ctx.lineTo(eyeRadiusX * 0.7, 0);
      ctx.lineTo(eyeRadiusX * 0.25, eyeRadiusY * 0.25);
      ctx.lineTo(0, eyeRadiusY * 0.7);
      ctx.lineTo(-eyeRadiusX * 0.25, eyeRadiusY * 0.25);
      ctx.lineTo(-eyeRadiusX * 0.7, 0);
      ctx.lineTo(-eyeRadiusX * 0.25, -eyeRadiusY * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
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

      // Lord Umbra: Crimson Eye Smoke Tendril (streaming backwards)
      if (this.type === 'BOSS_MASTER') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pShiftX - 2, pShiftY);
        ctx.bezierCurveTo(-eyeRadiusX * 1.5, -4, -eyeRadiusX * 2.2, -10 + Math.sin(this.time * 8) * 4, -eyeRadiusX * 3.2, -14);
        ctx.stroke();
      }
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
    this._beginEyeGlow(ctx, lite, glowColor, glowBlur, eyeRadiusX, eyeRadiusY);
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
    } else if (this.type === 'BOSS_PLANETARIUM') {
      // Professor Stella: Twinkling 4-pointed Star Pupil
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(0, -eyeRadiusY * 0.7);
      ctx.lineTo(eyeRadiusX * 0.25, -eyeRadiusY * 0.25);
      ctx.lineTo(eyeRadiusX * 0.7, 0);
      ctx.lineTo(eyeRadiusX * 0.25, eyeRadiusY * 0.25);
      ctx.lineTo(0, eyeRadiusY * 0.7);
      ctx.lineTo(-eyeRadiusX * 0.25, eyeRadiusY * 0.25);
      ctx.lineTo(-eyeRadiusX * 0.7, 0);
      ctx.lineTo(-eyeRadiusX * 0.25, -eyeRadiusY * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
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

      // Lord Umbra: Crimson Eye Smoke Tendril (streaming backwards)
      if (this.type === 'BOSS_MASTER') {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.75)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pShiftX + 2, pShiftY);
        ctx.bezierCurveTo(eyeRadiusX * 1.5, -4, eyeRadiusX * 2.2, -10 + Math.cos(this.time * 8) * 4, eyeRadiusX * 3.2, -14);
        ctx.stroke();
      }
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

      // Chef Bouillon Signature Curling Mustache
      if (this.type === 'BOSS_CHEF') {
        ctx.save();
        ctx.fillStyle = '#7c2d12';
        ctx.strokeStyle = '#431407';
        ctx.lineWidth = 1.6;
        ctx.shadowColor = '#431407';
        ctx.shadowBlur = 4;
        const mustY = my - mh * 0.22;
        ctx.beginPath();
        ctx.moveTo(0, mustY - 2);
        // Left wing swooping up into curled spiral tip
        ctx.bezierCurveTo(-mw * 0.40, mustY - 10, -mw * 0.85, mustY - 6, -mw * 1.08, mustY + 3);
        ctx.bezierCurveTo(-mw * 0.95, mustY + 9, -mw * 0.70, mustY + 4, -mw * 0.45, mustY + 2);
        ctx.quadraticCurveTo(-mw * 0.18, mustY + 3, 0, mustY + 1);
        // Right wing swooping up into curled spiral tip
        ctx.quadraticCurveTo(mw * 0.18, mustY + 3, mw * 0.45, mustY + 2);
        ctx.bezierCurveTo(mw * 0.70, mustY + 4, mw * 0.95, mustY + 9, mw * 1.08, mustY + 3);
        ctx.bezierCurveTo(mw * 0.85, mustY - 6, mw * 0.40, mustY - 10, 0, mustY - 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
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
      if (!lite) {
        ctx.shadowColor = '#0284c7';
        ctx.shadowBlur = 6;
      }
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
   * Glow behind a spectral eye: a cached halo sprite for minions, real shadowBlur for bosses
   * (or when no sprite can be built). Leaves the caller to fill the eye shape right after.
   */
  _beginEyeGlow(ctx, lite, color, blur, rx, ry) {
    if (lite && drawEyeGlow(ctx, rx, ry, color, blur)) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
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

    // 4. Ancient Knight Cat Ears, Feline Pauldrons, Spired Crystal Crown & Golden Guardian Crest
    ctx.save();

    // 4a. Ancient Knight Cat Ears (Đôi Tai Mèo Hiệp Sĩ Cổ Bọc Giáp)
    ctx.fillStyle = isHit ? '#ffffff' : '#09090b';
    ctx.strokeStyle = isHit ? '#ffffff' : '#7c3aed';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = '#9333ea';
    ctx.shadowBlur = 18;

    // Left Armored Knight Cat Ear
    ctx.beginPath();
    ctx.moveTo(-r * 0.65, -r * 0.35);
    ctx.lineTo(-r * 1.08, -r * 1.55);
    ctx.lineTo(-r * 0.22, -r * 0.80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Armored Knight Cat Ear
    ctx.beginPath();
    ctx.moveTo(r * 0.65, -r * 0.35);
    ctx.lineTo(r * 1.08, -r * 1.55);
    ctx.lineTo(r * 0.22, -r * 0.80);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner Cat Ear Ruby Armor Plates
    ctx.fillStyle = isHit ? '#fda4af' : '#4c0519';
    ctx.strokeStyle = isHit ? '#ffffff' : '#be123c';
    ctx.lineWidth = 1.8;
    // Inner left ear plate
    ctx.beginPath();
    ctx.moveTo(-r * 0.60, -r * 0.42);
    ctx.lineTo(-r * 0.96, -r * 1.40);
    ctx.lineTo(-r * 0.28, -r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner right ear plate
    ctx.beginPath();
    ctx.moveTo(r * 0.60, -r * 0.42);
    ctx.lineTo(r * 0.96, -r * 1.40);
    ctx.lineTo(r * 0.28, -r * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4b. Feline Knight Pauldrons (Giáp Vai Hiệp Sĩ Mèo)
    ctx.fillStyle = isHit ? '#ffffff' : '#2e1065';
    ctx.strokeStyle = isHit ? '#ffffff' : '#f43f5e';
    ctx.lineWidth = 2.5;
    // Left Pauldron
    ctx.beginPath();
    ctx.moveTo(-r * 0.90, -r * 0.05);
    ctx.quadraticCurveTo(-r * 1.45, -r * 0.15, -r * 1.55, r * 0.35);
    ctx.lineTo(-r * 1.05, r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Right Pauldron
    ctx.beginPath();
    ctx.moveTo(r * 0.90, -r * 0.05);
    ctx.quadraticCurveTo(r * 1.45, -r * 0.15, r * 1.55, r * 0.35);
    ctx.lineTo(r * 1.05, r * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 4c. 3-Spired Dark Violet Crystal Crown
    ctx.fillStyle = isHit ? '#ffffff' : '#9333ea';
    ctx.strokeStyle = isHit ? '#ffffff' : '#c084fc';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#c084fc';
    ctx.shadowBlur = 14;

    ctx.beginPath();
    // Left Spire
    ctx.moveTo(-r * 0.38, -r * 0.85);
    ctx.lineTo(-r * 0.26, -r * 1.35);
    ctx.lineTo(-r * 0.14, -r * 0.92);
    // Center Spire (Tallest Crystal with Blood Ruby)
    ctx.lineTo(0, -r * 1.62);
    // Right Spire
    ctx.lineTo(r * 0.14, -r * 0.92);
    ctx.lineTo(r * 0.26, -r * 1.35);
    ctx.lineTo(r * 0.38, -r * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Blood Ruby Gem on center crown spire
    const gemY = -r * 1.32;
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

    // 4d. Ancient Golden Guardian Cat Crest (Ấn Ký Hộ Vệ Hoàng Kim 300 Năm)
    // Placed proudly on chest above spellbook, symbolizing the forgotten guardian cat knight!
    const crestY = r * 0.16;
    ctx.save();
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, crestY - 14);
    ctx.lineTo(14, crestY);
    ctx.lineTo(0, crestY + 16);
    ctx.lineTo(-14, crestY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner Ruby Jewel
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, crestY, 5, 0, Math.PI * 2);
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
      const rune = this.symbolsHidden ? HIDDEN_RUNE : (RUNES[runeId] || { symbol: '?', color: '#ffffff', glow: '#ffffff' });
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
        // One blit of a cached halo (pulsing via alpha) instead of blurring the badge's fill, border AND glyph
        if (!drawBadgeGlow(ctx, badgeWidth, badgeHeight, rune.glow, 11, 0.85 + pulse * 0.15)) {
          ctx.shadowColor = rune.glow;
          ctx.shadowBlur = 10 + pulse * 6;
        }
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
      if (Enemy.colorBlind && !this.symbolsHidden) {
        // Colour-blind mode: tell runes apart by texture (border dash + hatch), not only by colour
        applyBorderPattern(ctx, runeId);
        ctx.lineWidth = Math.max(ctx.lineWidth, 2);
      }
      ctx.stroke();
      if (Enemy.colorBlind && !this.symbolsHidden) {
        resetBorderPattern(ctx);
        // Last: the hatch starts its own path, so it must not come between fill() and the border stroke()
        drawRunePattern(ctx, runeId, badgeWidth, badgeHeight, rune.color);
      }

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

/** Colour-blind rune textures on/off (set from Settings by Game) */
Enemy.colorBlind = false;

/** Called when a golden ghost gets away (set by Game, to announce it) */
Enemy.onGoldenEscape = null;

/**
 * Follow the render-quality tier: 1 = full glow, 0 = none. Cached glow sprites are rebuilt at the new strength.
 * @param {number} scale QualityManager.glowScale
 */
Enemy.setGlowScale = function setGlowScale(scale) {
  const next = Number.isFinite(scale) ? Math.max(0, scale) : 1;
  if (next === glowScale) return false;
  glowScale = next;
  glowSprites.clear();
  return true;
};

/**
 * Tell the glow sprites the canvas DPR (see `pixelRatio`). Rebuilds the cached sprites when it changes.
 * @param {number} dpr
 */
Enemy.setPixelRatio = function setPixelRatio(dpr) {
  const next = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  if (next === pixelRatio) return false;
  pixelRatio = next;
  glowSprites.clear();
  return true;
};

/**
 * Build every glow sprite up front so the first wave of ghosts does not pay for it mid-fight.
 * Safe to call anywhere: it quietly does nothing when no offscreen canvas exists.
 */
Enemy.prewarmGlow = function prewarmGlow() {
  try {
    if (glowScale <= 0) return;
    const probe = { drawImage() {}, globalAlpha: 1 };
    const radii = new Set();
    const colors = new Set(['#ffffff', '#f43f5e']);
    for (const t of Object.values(ENEMY_TYPES)) {
      if (t.isBoss || (typeof t.type === 'string' && t.type.startsWith('BOSS'))) continue;
      radii.add(t.radius);
      colors.add(t.glowColor);
      drawBodyGlow(probe, t.radius, t.glowColor, 16);
      drawGlowDisc(probe, 0, 0, 1, t.glowColor, 1);
    }
    for (const r of radii) {
      drawBodyGlow(probe, r, '#ffffff', 24);
      drawBodyGlow(probe, r, '#f43f5e', 20);
    }
    for (const rune of Object.values(RUNES)) {
      if (rune && rune.glow) drawBadgeGlow(probe, 24, 24, rune.glow, 11, 1);
    }
    for (const eyeGlow of ['#22d3ee', '#ef4444', '#a855f7']) drawGlowDisc(probe, 0, 0, 1, eyeGlow, 1);
  } catch (e) {
    /* purely an optimisation */
  }
};
