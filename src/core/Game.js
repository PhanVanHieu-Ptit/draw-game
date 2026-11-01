/**
 * @file Game.js
 * @description Master Game Coordinator implementing Core Loop, Clean Architecture, 
 * Dynamic Lighting with Vignette, Screen Shake, and Particle integrations.
 * Upgraded with Object Pooling for Enemies, Projectiles, and Particles to guarantee stable 60+ FPS,
 * exact deltaTime scaling across high-refresh monitors (60Hz, 120Hz, 144Hz), and Retina DPR calibration.
 */

import { GAME_STATES, RUNES, COMBO_CONFIG, STORAGE_KEYS } from './Constants.js';
import { StateMachine } from './StateMachine.js';
import { ObjectPool } from './ObjectPool.js';
import { GestureEngine } from '../GestureEngine.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { InputHandler } from '../systems/InputHandler.js';
import { BackgroundRenderer } from '../systems/BackgroundRenderer.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Cap DPR at 2.0 to balance Retina clarity with mobile GPU fillrate efficiency
    const rawDpr = window.devicePixelRatio || 1;
    this.dpr = Math.min(rawDpr, 2.0);

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Offscreen Lightmap Canvas for Dynamic Lighting & Vignette Masking
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    // Subsystems
    this.gestureEngine = new GestureEngine({
      minScore: 0.68,
      minPathLength: 15,
      pointCount: 32,
      boxSize: 100
    });
    this.audioSystem = new AudioSystem();
    this.particleSystem = new ParticleSystem(800, 50); // Pooled particle system
    this.waveSystem = new WaveSystem();
    this.backgroundRenderer = new BackgroundRenderer();

    // Object Pools for Projectile and Enemy entities
    this.projectilePool = new ObjectPool(
      () => new Projectile(),
      (proj) => proj.reset(),
      50,
      250
    );

    this.enemyPool = new ObjectPool(
      () => new Enemy(),
      (enemy) => enemy.reset(),
      40,
      150
    );

    // Active Entity Collections
    this.player = new Player(this.width, this.height);
    this.enemies = [];
    this.projectiles = [];

    // Scoring & Combo runtime state
    this.score = 0;
    this.displayedScore = 0;
    this.highScore = this._loadHighScore();
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    // Session Metrics
    this.metrics = {
      spellsCast: 0,
      spellsHit: 0,
      damageTaken: 0,
      enemiesDefeated: 0
    };

    // Lightning screen flash timer
    this.lightningFlashTimer = 0;

    // Input Handler with exact logical dimension callback
    this.inputHandler = new InputHandler(
      this.canvas,
      this.gestureEngine,
      this.particleSystem,
      (result, stroke) => this.onGestureRecognized(result, stroke),
      this.audioSystem,
      () => ({ width: this.width, height: this.height })
    );

    // UI Manager
    this.uiManager = new UIManager(this);

    // Finite State Machine
    this.stateMachine = new StateMachine(this);

    // Loop Timing
    this.lastTime = 0;
    this.isRunning = false;

    // Background stars / ambient dust
    this.stars = this._createAmbientStars(65);

    // Setup events
    this._bindResize();
    this.resize();

    // Hook Wave & Level System events with Screen Shake & Visual Announcements
    this.waveSystem.onLevelStart = (lvlNum, lvlData) => {
      this.uiManager.updateLevel(lvlNum, lvlData);
      this.triggerShake(8, 0.45);
      this.uiManager.showLevelTransition(lvlNum, lvlData);
      this.particleSystem.emitFloatingText(
        `CẤP ĐỘ ${lvlNum}: ${lvlData ? lvlData.name.toUpperCase() : ''}`,
        this.width / 2,
        this.height * 0.35,
        '#c084fc',
        30
      );
    };

    this.waveSystem.onBossSpawn = (bossType, bossName) => {
      this.triggerShake(22, 0.85);
      if (this.audioSystem && typeof this.audioSystem.soundBossCast === 'function') {
        this.audioSystem.soundBossCast();
      }
      this.particleSystem.emitFloatingText(
        `⚡ TRÙM XUẤT HIỆN: ${bossName ? bossName.toUpperCase() : 'CHÚA TỂ BÓNG MA'} ⚡`,
        this.width / 2,
        this.height * 0.22,
        '#f43f5e',
        26
      );
    };

    this.waveSystem.onLevelComplete = (lvlNum, lvlData) => {
      this.triggerShake(6, 0.35);
      this.particleSystem.emitFloatingText(
        `MÀN ${lvlNum} HOÀN THÀNH!`,
        this.width / 2,
        this.height * 0.35,
        '#34d399',
        30
      );
    };

    this.waveSystem.onGameVictory = () => {
      this.stateMachine.changeState(GAME_STATES.VICTORY);
    };

    this.waveSystem.onWaveStart = (waveNum) => {
      this.uiManager.updateWave(waveNum);
    };

    this.waveSystem.onWaveComplete = (waveNum) => {
      this.triggerShake(5, 0.3);
    };
  }

  /**
   * Trigger screen shake directly on the game canvas
   * @param {number} intensity Max displacement amplitude
   * @param {number} duration Duration in seconds
   */
  triggerShake(intensity = 10, duration = 0.3) {
    if (this.particleSystem) {
      this.particleSystem.triggerShake(intensity, duration);
    }
  }

  _bindResize() {
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.resize(), 100);
    });
  }

  /**
   * Responsive canvas resolution scaling calibrated to window.devicePixelRatio
   * Guarantees crystal-clear Retina graphics while locking logical coordinates
   */
  resize() {
    const rawDpr = window.devicePixelRatio || 1;
    this.dpr = Math.min(rawDpr, 2.0);

    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;

    // Internal pixel buffer scaled by DPR
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    // Explicit CSS display size matching viewport
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Resize lightmap canvas at logical size for maximum GPU fillrate performance
    this.lightCanvas.width = Math.round(this.width);
    this.lightCanvas.height = Math.round(this.height);

    this.player.resize(this.width, this.height);
  }

  _createAmbientStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        radius: Math.random() * 1.5 + 0.5,
        alpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: Math.random() * 2 + 1
      });
    }
    return stars;
  }

  _loadHighScore() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HIGH_SCORE);
      return saved ? parseInt(saved, 10) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  saveHighScore(score) {
    if (score > this.highScore) {
      this.highScore = score;
      try {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
      } catch (e) {}
      return true;
    }
    return false;
  }

  resetGameData() {
    this.score = 0;
    this.displayedScore = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    this.metrics = {
      spellsCast: 0,
      spellsHit: 0,
      damageTaken: 0,
      enemiesDefeated: 0
    };

    this.player.reset();

    // Release all active entities back to object pools
    this.enemyPool.releaseAll(this.enemies);
    this.projectilePool.releaseAll(this.projectiles);

    this.particleSystem.clear();
    this.inputHandler.clear();
    this.waveSystem.reset();

    this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    this.uiManager.updateScore(0);
    this.uiManager.updateCombo(0, 1, 0);
    this.uiManager.updateWave(1);
  }

  start() {
    this.stateMachine.changeState(GAME_STATES.MENU);
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * Main Game Loop with accurate deltaTime calculation
   * Ensures identical physics across 60Hz, 120Hz, 144Hz, and 240Hz monitors
   * @param {DOMHighResTimeStamp} timestamp 
   */
  loop(timestamp) {
    if (!this.isRunning) return;

    if (!this.lastTime) {
      this.lastTime = timestamp;
    }

    // Normalized delta time clamped to [0.001, 0.05] (20 FPS floor)
    // Prevents spiraling tunneling or jump lag when tab is backgrounded
    const rawDt = (timestamp - this.lastTime) / 1000;
    const dt = Math.min(0.05, Math.max(0.001, rawDt));
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    if (this.backgroundRenderer) {
      this.backgroundRenderer.update(dt);
    }
    this.stateMachine.update(dt);
  }

  render() {
    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    // Clear background
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Render animated Level Environment (Google Doodle 2016)
    const curLevel = this.waveSystem.currentLevelIndex || 1;
    this.backgroundRenderer.render(this.ctx, this.width, this.height, curLevel, this.lastTime / 1000);

    // Render active state
    this.stateMachine.render(this.ctx);

    this.ctx.restore();
  }

  _renderBackground(ctx) {
    const time = performance.now() / 1000;
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const a = (Math.sin(time * s.twinkleSpeed + i) * 0.35 + 0.65) * s.alpha;
      ctx.fillStyle = `rgba(224, 231, 255, ${a * 0.4})`;
      ctx.beginPath();
      ctx.arc(s.x % this.width, s.y % this.height, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Main Playing State Physics & Logic Update with Object Pooling
   * @param {number} dt 
   */
  updatePlaying(dt) {
    // 1. Update Player with dynamic drawing stroke coordinates
    this.player.setDrawing(this.inputHandler.isDrawing, this.inputHandler.lastPoint);
    this.player.update(dt, this.enemies);

    // Countdown lightning electric screen flash
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer -= dt;
    }

    // 2. Wave System Spawner with Pooled Enemy
    const enemyConfig = this.waveSystem.update(dt, this.player.hp, this.enemies.length);
    if (enemyConfig) {
      const isHeart = enemyConfig.isHeartGhost || (enemyConfig.symbolQueue && enemyConfig.symbolQueue.includes('heart'));
      const isBoss = enemyConfig.isBoss || enemyConfig.archetype === 'BOSS' || (typeof enemyConfig.archetype === 'string' && enemyConfig.archetype.startsWith('BOSS_'));
      let spawnPos;
      if (isHeart) {
        // Stationary Heart Ghost spawns in upper-middle viewable screen
        spawnPos = {
          x: Math.random() * (this.width * 0.6) + this.width * 0.2,
          y: Math.random() * (this.height * 0.28) + this.height * 0.16
        };
      } else if (isBoss) {
        // Boss descends grandly from upper center
        spawnPos = {
          x: this.width / 2,
          y: -75
        };
      } else {
        spawnPos = Enemy.getRandomEdgePosition(this.width, this.height);
      }

      const newEnemy = this.enemyPool.acquire();
      newEnemy.init({
        type: enemyConfig.archetype,
        x: spawnPos.x,
        y: spawnPos.y,
        isHeartGhost: isHeart,
        symbolQueue: enemyConfig.symbolQueue,
        speedMultiplier: enemyConfig.speedMultiplier,
        targetPlayerPos: this.player
      });
      this.enemies.push(newEnemy);

      // Boss / Armored entrance screen shake
      if (isBoss) {
        this.triggerShake(20, 0.75);
        if (this.audioSystem && typeof this.audioSystem.soundBossCast === 'function') {
          this.audioSystem.soundBossCast();
        }
      } else if (enemyConfig.archetype === 'ARMORED') {
        this.triggerShake(11, 0.55);
        this.particleSystem.emitFloatingText(
          '⚠️ HẮC GIÁP TƯỚNG QUÂN! ⚠️',
          this.width / 2,
          this.height * 0.22,
          '#a855f7',
          22
        );
      }
    }

    // 3. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player);

      // Check collision with Player
      if (enemy.collidesWith(this.player)) {
        const damageTaken = this.player.takeDamage(1);
        if (damageTaken) {
          this.metrics.damageTaken++;
          this.audioSystem.playHurt();
          
          this.triggerShake(18, 0.45);
          this.particleSystem.emitMonsterDeathExplosion(enemy.x, enemy.y, enemy.type, 26);
          this.particleSystem.emitFloatingText('-1 HP', this.player.x, this.player.y - 40, '#ef4444', 24);

          // Break combo
          this.comboCount = 0;
          this.comboMultiplier = 1;
          this.comboTimer = 0;

          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);

          if (this.player.hp <= 0) {
            this.stateMachine.changeState(GAME_STATES.GAMEOVER);
            return;
          }
        }

        // Return crashed enemy to pool with O(1) swap-and-pop removal
        this.enemyPool.release(enemy);
        this.enemies[i] = this.enemies[this.enemies.length - 1];
        this.enemies.pop();
        continue;
      }
    }

    // 4. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      const hasImpacted = proj.update(dt);

      if (hasImpacted) {
        if (proj.targetEnemy && !proj.targetEnemy.isDead) {
          const hitResult = proj.targetEnemy.takeHit(proj.gesture);
          if (hitResult.matched) {
            const rune = RUNES[proj.gesture] || { color: '#38bdf8' };
            this.particleSystem.emitHitBurst(proj.x, proj.y, rune.color, 16);
            this.audioSystem.playHit();

            if (hitResult.destroyed) {
              this.metrics.enemiesDefeated++;
              this.audioSystem.playEnemyDeath();
              
              const isTargetBoss = proj.targetEnemy.isBoss || proj.targetEnemy.type === 'BOSS' || (typeof proj.targetEnemy.type === 'string' && proj.targetEnemy.type.startsWith('BOSS_'));
              if (isTargetBoss) {
                this.triggerShake(22, 0.75);
              }
              this.particleSystem.emitMonsterDeathExplosion(
                proj.targetEnemy.x,
                proj.targetEnemy.y,
                isTargetBoss ? 'BOSS' : proj.targetEnemy.type,
                isTargetBoss ? 35 : 28
              );

              const reward = proj.targetEnemy.scoreValue * this.comboMultiplier;
              this.score += reward;
              this.particleSystem.emitFloatingText(
                `+${reward}`,
                proj.targetEnemy.x,
                proj.targetEnemy.y - 20,
                '#fde047',
                22
              );
            }
          }
        }

        // Return impacted projectile to pool with O(1) swap-and-pop removal
        this.projectilePool.release(proj);
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
      }
    }

    // Remove dead enemies using pool release and O(1) swap-and-pop
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].isDead) {
        this.enemyPool.release(this.enemies[i]);
        this.enemies[i] = this.enemies[this.enemies.length - 1];
        this.enemies.pop();
      }
    }

    // 5. Update Combo Decay
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
        this.comboTimer = 0;
      }
    }

    // 6. Smooth Lerp Score Display (frame-rate independent)
    if (this.displayedScore < this.score) {
      this.displayedScore += (this.score - this.displayedScore) * Math.min(1, dt * 10);
      if (Math.abs(this.score - this.displayedScore) < 1) {
        this.displayedScore = this.score;
      }
      this.uiManager.updateScore(this.displayedScore);
    }

    // 7. Update Systems
    this.particleSystem.update(dt);
    this.inputHandler.update(dt);

    // 8. Update Combo UI
    const decayPercent = this.comboCount > 0 ? (this.comboTimer / COMBO_CONFIG.DECAY_TIME) : 0;
    this.uiManager.updateCombo(this.comboCount, this.comboMultiplier, decayPercent);
  }

  /**
   * Render Playing Scene with Screen Shake & Dynamic Lighting
   * @param {CanvasRenderingContext2D} ctx 
   */
  renderPlaying(ctx) {
    ctx.save();

    // 1. Screen Shake with translational displacement and subtle camera roll
    const shake = this.particleSystem.screenShake;
    if (shake.timer > 0) {
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(shake.rotation);
      ctx.translate(-this.width / 2 + shake.x, -this.height / 2 + shake.y);
    }

    // 2. Render Player Momo
    this.player.render(ctx);

    // 3. Render Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx);
    }

    // 4. Render Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].render(ctx);
    }

    // 5. Render Particles & Floating texts
    this.particleSystem.render(ctx);

    // 6. Render Dynamic Lighting (Darkness Vignette & Radial Light Cutouts)
    this._renderDynamicLighting(ctx);

    // 7. Render Neon Drawing Trail
    this.inputHandler.render(ctx);

    ctx.restore();
  }

  /**
   * Dynamic Lighting & Atmospheric Fog Vignette
   * Uses an offscreen lightmap canvas with destination-out blending to punch luminous holes
   * @param {CanvasRenderingContext2D} ctx 
   */
  _renderDynamicLighting(ctx) {
    const lCanvas = this.lightCanvas;
    const lCtx = this.lightCtx;
    const w = this.width;
    const h = this.height;

    if (!lCanvas || w <= 0 || h <= 0) return;

    lCtx.save();
    lCtx.clearRect(0, 0, w, h);

    // Step A: Base Ambient Darkness
    lCtx.fillStyle = 'rgba(6, 4, 16, 0.78)';
    lCtx.fillRect(0, 0, w, h);

    // Step B: Heavy Vignette Gradient towards canvas borders
    const maxDim = Math.max(w, h);
    const vignette = lCtx.createRadialGradient(
      w / 2, h / 2, maxDim * 0.22,
      w / 2, h / 2, maxDim * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.6, 'rgba(3, 2, 8, 0.55)');
    vignette.addColorStop(1, 'rgba(2, 1, 5, 0.95)');
    lCtx.fillStyle = vignette;
    lCtx.fillRect(0, 0, w, h);

    // Step C: Carve out light sources using destination-out
    lCtx.globalCompositeOperation = 'destination-out';

    // 1. Local Light around Player Momo
    const isCasting = this.player.castTimer > 0;
    const isHurt = this.player.hurtTimer > 0;
    const breatheLight = Math.sin(this.lastTime * 0.003) * 14;
    const playerLightRadius = isCasting ? 270 : (isHurt ? 165 : 215 + breatheLight);

    const playerGlow = lCtx.createRadialGradient(
      this.player.x, this.player.y, 8,
      this.player.x, this.player.y, playerLightRadius
    );
    playerGlow.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
    playerGlow.addColorStop(0.4, 'rgba(0, 0, 0, 0.88)');
    playerGlow.addColorStop(0.75, 'rgba(0, 0, 0, 0.45)');
    playerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');

    lCtx.fillStyle = playerGlow;
    lCtx.beginPath();
    lCtx.arc(this.player.x, this.player.y, playerLightRadius, 0, Math.PI * 2);
    lCtx.fill();

    // Wand tip extra flare when casting
    if (isCasting) {
      const tip = this.player.getWandTip();
      const tipGlow = lCtx.createRadialGradient(tip.x, tip.y, 2, tip.x, tip.y, 140);
      tipGlow.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      tipGlow.addColorStop(0.6, 'rgba(0, 0, 0, 0.75)');
      tipGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      lCtx.fillStyle = tipGlow;
      lCtx.beginPath();
      lCtx.arc(tip.x, tip.y, 140, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 2. Local Light around Spell Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      const projRadius = 125;
      const projLight = lCtx.createRadialGradient(
        proj.x, proj.y, 6,
        proj.x, proj.y, projRadius
      );
      projLight.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      projLight.addColorStop(0.45, 'rgba(0, 0, 0, 0.82)');
      projLight.addColorStop(0.8, 'rgba(0, 0, 0, 0.35)');
      projLight.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = projLight;
      lCtx.beginPath();
      lCtx.arc(proj.x, proj.y, projRadius, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 3. Eerie Phosphor Glow around Monsters
    for (let i = 0; i < this.enemies.length; i++) {
      const enemy = this.enemies[i];
      const eRadius = enemy.radius * 2.5;
      const enemyLight = lCtx.createRadialGradient(
        enemy.x, enemy.y, 4,
        enemy.x, enemy.y, eRadius
      );
      enemyLight.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      enemyLight.addColorStop(0.6, 'rgba(0, 0, 0, 0.3)');
      enemyLight.addColorStop(1, 'rgba(0, 0, 0, 0)');

      lCtx.fillStyle = enemyLight;
      lCtx.beginPath();
      lCtx.arc(enemy.x, enemy.y, eRadius, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 4. Subtle Trail Glow along Player's current active drawing path
    if (this.inputHandler.isDrawing && this.inputHandler.currentPoints.length > 0) {
      const pts = this.inputHandler.currentPoints;
      const step = Math.max(1, Math.floor(pts.length / 10));
      for (let i = 0; i < pts.length; i += step) {
        const pt = pts[i];
        const strokeLight = lCtx.createRadialGradient(pt.x, pt.y, 2, pt.x, pt.y, 50);
        strokeLight.addColorStop(0, 'rgba(0, 0, 0, 0.6)');
        strokeLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
        lCtx.fillStyle = strokeLight;
        lCtx.beginPath();
        lCtx.arc(pt.x, pt.y, 50, 0, Math.PI * 2);
        lCtx.fill();
      }
    }

    lCtx.restore();

    // Step D: Composite the darkness lightmap over the main canvas
    ctx.drawImage(lCanvas, 0, 0);

    // Step E: Additive Glow Halos (Atmospheric Bloom)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Player warmth halo
    const haloColor = isHurt 
      ? 'rgba(239, 68, 68, 0.32)' 
      : (isCasting ? 'rgba(236, 72, 153, 0.28)' : 'rgba(192, 132, 252, 0.18)');
    const playerHalo = ctx.createRadialGradient(
      this.player.x, this.player.y, 5,
      this.player.x, this.player.y, 160
    );
    playerHalo.addColorStop(0, haloColor);
    playerHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = playerHalo;
    ctx.beginPath();
    ctx.arc(this.player.x, this.player.y, 160, 0, Math.PI * 2);
    ctx.fill();

    // Spell projectile color bloom
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      const halo = ctx.createRadialGradient(proj.x, proj.y, 4, proj.x, proj.y, 70);
      halo.addColorStop(0, `${proj.color}50`);
      halo.addColorStop(1, 'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, 70, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 6. Lightning Electric Sky Flash Overlay
    if (this.lightningFlashTimer > 0) {
      ctx.save();
      const flashAlpha = Math.min(0.65, this.lightningFlashTimer * 3.2);
      ctx.fillStyle = `rgba(224, 242, 254, ${flashAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
  }

  /**
   * Process Gesture Recognition Event from InputHandler
   * @param {{ gesture: string | null, score: number }} result 
   * @param {Array<{x: number, y: number}>} rawStroke 
   */
  onGestureRecognized(result, rawStroke) {
    if (this.stateMachine.getCurrentStateName() !== GAME_STATES.PLAYING) return;

    this.metrics.spellsCast++;

    const gesture = result.gesture;
    if (!gesture || !RUNES[gesture]) {
      this.audioSystem.playFizzle();
      this.uiManager.showGestureFeedback(null, 0, false);
      this._fizzleCombo();
      return;
    }

    // Find all enemies whose active (0th) symbol matches the recognized gesture
    const matchingEnemies = this.enemies.filter(e => e.matchesActiveSymbol(gesture));

    if (matchingEnemies.length > 0) {
      this.metrics.spellsHit++;
      this.player.castSpell(matchingEnemies[0]);
      this.audioSystem.playSpell(gesture);

      this.triggerShake(3.5, 0.15);

      if (gesture === 'lightning') {
        this.audioSystem.soundLightning();
        this.lightningFlashTimer = 0.22;
        if (this.backgroundRenderer) {
          this.backgroundRenderer.triggerLightning(0.25);
        }
        this.triggerShake(14, 0.45);
      }

      if (gesture === 'heart') {
        const healed = this.player.heal(1);
        if (healed) {
          this.audioSystem.playSpell('heart');
          this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
        }
      }

      // Fire pooled projectile to each matching enemy
      const wandTip = this.player.getWandTip();
      for (let i = 0; i < matchingEnemies.length; i++) {
        const enemy = matchingEnemies[i];
        const projectile = this.projectilePool.acquire();
        projectile.init({
          startX: wandTip.x,
          startY: wandTip.y,
          targetEnemy: enemy,
          gesture: gesture,
          particleSystem: this.particleSystem
        });
        this.projectiles.push(projectile);
      }

      // Combo Progression
      this.comboCount++;
      this.comboTimer = COMBO_CONFIG.DECAY_TIME;
      this.comboMultiplier = this._calculateComboMultiplier(this.comboCount);
      this.audioSystem.playCombo(this.comboCount);

      const runeData = RUNES[gesture];
      const points = (runeData.baseScore || 100) * this.comboMultiplier;
      this.score += points;

      this.particleSystem.emitFloatingText(
        `+${points}`,
        this.player.x + (Math.random() - 0.5) * 40,
        this.player.y - 70,
        runeData.color,
        20
      );

      this.uiManager.showGestureFeedback(gesture, result.score, true);
    } else {
      if (gesture === 'lightning') {
        this.audioSystem.soundLightning();
        this.lightningFlashTimer = 0.16;
        this.triggerShake(8, 0.3);
      } else {
        this.audioSystem.playFizzle();
      }
      this.uiManager.showGestureFeedback(gesture, result.score, false);
      this._fizzleCombo();
    }
  }

  _fizzleCombo() {
    if (this.comboCount > 0) {
      this.comboCount = 0;
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this.particleSystem.emitFloatingText('COMBO VỠ!', this.player.x, this.player.y - 50, '#94a3b8', 18);
    }
  }

  _calculateComboMultiplier(count) {
    for (const tier of COMBO_CONFIG.TIERS) {
      if (count >= tier.min && count <= tier.max) {
        return tier.mult;
      }
    }
    return 1;
  }
}
