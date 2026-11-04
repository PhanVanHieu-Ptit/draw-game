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
import { HapticSystem } from '../systems/HapticSystem.js';
import { InputHandler } from '../systems/InputHandler.js';
import { BackgroundRenderer } from '../systems/BackgroundRenderer.js';
import { QualityManager, installShadowBlurScaler } from '../systems/QualityManager.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Detect mobile device environment
    const isMobile = typeof window !== 'undefined' && (
      window.innerWidth <= 768 ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    );
    this.isMobile = isMobile;

    // Adaptive quality: picks a starting tier from the device, then steps down if frames run slow.
    this.quality = new QualityManager({ isMobile });
    this.quality.onChange(() => this._applyQuality());

    // Cap DPR (tier dependent) to avoid 3x retina fillrate throttling on phones
    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.dpr = Math.min(rawDpr, this.quality.getDprCap());

    // Route every ctx.shadowBlur assignment through the quality tier (no-op on mock contexts)
    installShadowBlurScaler(this.ctx, () => this.quality.glowScale);

    this.width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    this.height = typeof window !== 'undefined' ? window.innerHeight : 720;

    // Offscreen Lightmap Canvas for Dynamic Lighting & Vignette Masking (reduced resolution for fillrate performance)
    this.lightScale = this.quality.lightScale;
    this.lightCanvas = typeof document !== 'undefined' && document.createElement ? document.createElement('canvas') : null;
    this.lightCtx = this.lightCanvas ? this.lightCanvas.getContext('2d') : null;
    this._initLightSprites();

    // Subsystems
    this.gestureEngine = new GestureEngine({
      minScore: 0.65,
      minPathLength: 15,
      pointCount: 32,
      boxSize: 100
    });
    this.audioSystem = new AudioSystem();
    this.hapticSystem = new HapticSystem();
    const particleBudget = isMobile ? 380 : 800;
    this.particleBudget = particleBudget;
    this.particleSystem = new ParticleSystem(particleBudget, 50); // Pooled particle system
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

    // Difficulty state (NORMAL | HARDCORE)
    this.difficulty = this._loadDifficulty();
    this.waveSystem.setDifficulty(this.difficulty);

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
      enemiesDefeated: 0,
      maxCombo: 0,
      startTime: Date.now()
    };

    // Screen visual flash & freeze overlay timers
    this.lightningFlashTimer = 0;
    this.freezeOverlayTimer = 0;

    // Boss entrance dramatic warning & gradual transition
    this.bossEntranceWarningActive = false;
    this.bossEntranceWarningTimer = 0;

    // Level 1 Tutorial interactive tracking
    this.isTutorialActive = false;
    this.tutorialStep = 0;

    // Input Handler with exact logical dimension callback & interactive tap support
    this.inputHandler = new InputHandler(
      this.canvas,
      this.gestureEngine,
      this.particleSystem,
      (result, stroke) => this.onGestureRecognized(result, stroke),
      this.audioSystem,
      () => ({ width: this.width, height: this.height }),
      (tapPoint) => this.onCanvasTap(tapPoint)
    );

    // Push the initial quality tier into the subsystems
    this._applyQuality();

    // UI Manager
    this.uiManager = new UIManager(this);

    // Finite State Machine
    this.stateMachine = new StateMachine(this);

    // Loop Timing (bound once: avoids allocating a new closure every frame)
    this.lastTime = 0;
    this.isRunning = false;
    this._rafId = 0;
    this._boundLoop = (ts) => this.loop(ts);

    // Background stars / ambient dust
    this.stars = this._createAmbientStars(65);

    // Setup events
    this._bindResize();
    this.resize();

    // Hook Wave & Level System events with Screen Shake & Visual Announcements
    this.waveSystem.onLevelStart = (lvlNum, lvlData) => {
      this.bossEntranceWarningActive = false;
      this.bossEntranceWarningTimer = 0;
      this.uiManager.updateLevel(lvlNum, lvlData);
      this.triggerShake(8, 0.45);
      this.uiManager.showLevelTransition(lvlNum, lvlData);

      // In Level 5 (The Rooftop), Momo stands on the left side facing the giant boss on the right!
      if (lvlNum === 5) {
        const isMobile = this.width < 600;
        this.player.x = this.width * (isMobile ? 0.20 : 0.22);
        this.player.y = this.height * (isMobile ? 0.65 : 0.70);
        this.player.castTargetAngle = -0.15;
      } else {
        this.player.x = this.width / 2;
        this.player.y = this.height / 2;
        this.player.castTargetAngle = -Math.PI / 2;
      }

      this.particleSystem.emitFloatingText(
        `CẤP ĐỘ ${lvlNum}: ${lvlData ? lvlData.name.toUpperCase() : ''}`,
        this.width / 2,
        this.height * 0.35,
        '#c084fc',
        30
      );

      // Momo meows enthusiastically at the start of every level
      if (this.audioSystem && typeof this.audioSystem.playCatMeow === 'function') {
        setTimeout(() => this.audioSystem.playCatMeow('cheerful'), 350);
      }

      // Trigger companion story intro dialogue after transition
      if (lvlData && lvlData.companion && lvlData.storyIntroQuote) {
        setTimeout(() => {
          if (this.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) {
            this.uiManager.showDialogue({
              name: lvlData.companion.name,
              role: lvlData.companion.role,
              avatar: lvlData.companion.icon,
              color: lvlData.companion.color,
              text: lvlData.storyIntroQuote,
              duration: 4500
            });
          }
        }, 2200);
      }
    };

    this.waveSystem.onBossSpawn = (bossType, bossName) => {
      this.triggerShake(22, 0.85);
      if (this.audioSystem) {
        if (typeof this.audioSystem.playBossRoar === 'function') {
          this.audioSystem.playBossRoar();
        } else if (typeof this.audioSystem.soundBossCast === 'function') {
          this.audioSystem.soundBossCast();
        }
      }
      this.particleSystem.emitFloatingText(
        `⚡ TRÙM XUẤT HIỆN: ${bossName ? bossName.toUpperCase() : 'CHÚA TỂ BÓNG MA'} ⚡`,
        this.width / 2,
        this.height * 0.22,
        '#f43f5e',
        26
      );

      // Trigger boss battle cry dialogue
      const lvlData = this.waveSystem.levelData;
      if (lvlData && lvlData.bossSpawnQuote) {
        setTimeout(() => {
          if (this.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) {
            this.uiManager.showDialogue({
              name: lvlData.bossName || bossName,
              role: 'U Linh Thống Lĩnh',
              avatar: '👻⚡',
              color: '#f43f5e',
              text: lvlData.bossSpawnQuote,
              duration: 4500
            });
          }
        }, 600);
      }
    };

    this.waveSystem.onLevelComplete = (lvlNum, lvlData) => {
      this.triggerShake(10, 0.45);
      this.uiManager.showLevelComplete(lvlNum, lvlData);
      this.particleSystem.emitFloatingText(
        `MÀN ${lvlNum} HOÀN THÀNH!`,
        this.width / 2,
        this.height * 0.35,
        '#34d399',
        30
      );

      // Momo cries in triumph upon clearing the stage
      if (this.audioSystem && typeof this.audioSystem.playCatMeow === 'function') {
        setTimeout(() => this.audioSystem.playCatMeow('triumphant'), 400);
      }

      // Trigger boss purification dialogue
      if (lvlData && lvlData.bossDefeatQuote) {
        this.uiManager.showDialogue({
          name: lvlData.bossName,
          role: '✨ Đã Được Thanh Tẩy',
          avatar: '🌟',
          color: '#34d399',
          text: lvlData.bossDefeatQuote,
          duration: 4800
        });
      }
    };

    this.waveSystem.onGameVictory = () => {
      this.stateMachine.changeState(GAME_STATES.VICTORY);
    };

    this.waveSystem.onWaveStart = (waveNum) => {
      this.uiManager.updateWave(waveNum);
    };

    this.waveSystem.onWaveComplete = (waveNum) => {
      this.triggerShake(5, 0.3);
      this.audioSystem.playWaveComplete();
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

  _initLightSprites() {
    if (typeof document === 'undefined' || !document.createElement) return;

    const createStamp = (size, innerR, stops) => {
      try {
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        if (!ctx) return null;
        const half = size / 2;
        const grad = ctx.createRadialGradient(half, half, innerR, half, half, half);
        for (const [pos, col] of stops) {
          grad.addColorStop(pos, col);
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(half, half, half, 0, Math.PI * 2);
        ctx.fill();
        return c;
      } catch (e) {
        return null;
      }
    };

    // Cutout stamps for destination-out
    this.playerLightStamp = createStamp(128, 4, [
      [0, 'rgba(0, 0, 0, 1.0)'],
      [0.45, 'rgba(0, 0, 0, 0.88)'],
      [0.78, 'rgba(0, 0, 0, 0.42)'],
      [1.0, 'rgba(0, 0, 0, 0)']
    ]);

    this.projectileLightStamp = createStamp(64, 3, [
      [0, 'rgba(0, 0, 0, 1.0)'],
      [0.45, 'rgba(0, 0, 0, 0.82)'],
      [0.8, 'rgba(0, 0, 0, 0.35)'],
      [1.0, 'rgba(0, 0, 0, 0)']
    ]);

    this.enemyLightStamp = createStamp(64, 3, [
      [0, 'rgba(0, 0, 0, 0.68)'],
      [0.6, 'rgba(0, 0, 0, 0.3)'],
      [1.0, 'rgba(0, 0, 0, 0)']
    ]);

    this.strokeLightStamp = createStamp(32, 2, [
      [0, 'rgba(0, 0, 0, 0.6)'],
      [1.0, 'rgba(0, 0, 0, 0)']
    ]);

    this.playerHaloStamp = createStamp(128, 4, [
      [0, 'rgba(192, 132, 252, 0.22)'],
      [1.0, 'rgba(0, 0, 0, 0)']
    ]);
  }

  /**
   * Lazily build (and cache) a 130x130 radial bloom sprite for a projectile colour.
   * @param {string} color CSS hex colour like '#38bdf8'
   * @returns {HTMLCanvasElement|null}
   */
  _getProjectileHalo(color) {
    if (!this._haloCache) this._haloCache = new Map();
    let sprite = this._haloCache.get(color);
    if (sprite !== undefined) return sprite;

    sprite = null;
    try {
      if (typeof document !== 'undefined' && document.createElement) {
        const c = document.createElement('canvas');
        c.width = 130;
        c.height = 130;
        const hctx = c.getContext('2d');
        if (hctx) {
          const g = hctx.createRadialGradient(65, 65, 4, 65, 65, 65);
          g.addColorStop(0, `${color}50`);
          g.addColorStop(1, 'transparent');
          hctx.fillStyle = g;
          hctx.beginPath();
          hctx.arc(65, 65, 65, 0, Math.PI * 2);
          hctx.fill();
          sprite = c;
        }
      }
    } catch (e) {
      sprite = null;
    }
    this._haloCache.set(color, sprite);
    return sprite;
  }

  _bindResize() {
    // Resize events fire in bursts (orientation change, visualViewport, URL-bar collapse).
    // Coalesce them into at most one real resize per animation frame.
    const schedule = () => {
      if (this._resizeQueued) return;
      this._resizeQueued = true;
      requestAnimationFrame(() => {
        this._resizeQueued = false;
        this.resize();
      });
    };
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', () => {
      schedule();
      setTimeout(() => this.resize(), 150);
      setTimeout(() => this.resize(), 400);
    });
    if (typeof window !== 'undefined' && window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule);
    }

    // Stop burning battery (and playing audio) while the page is hidden or the app is backgrounded.
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => this._onVisibilityChange());
    }
    window.addEventListener('pagehide', () => this._pauseIfPlaying());
  }

  /**
   * Auto-pause an active run when the tab/app goes to the background, and avoid the huge
   * delta-time / quality-sampling spike when it comes back.
   */
  _onVisibilityChange() {
    if (typeof document !== 'undefined' && document.hidden) {
      this._pauseIfPlaying();
    } else {
      this.lastTime = performance.now();
      if (this.quality) this.quality.resetSampling(1500);
    }
  }

  _pauseIfPlaying() {
    if (!this.stateMachine || this.stateMachine.getCurrentStateName() !== GAME_STATES.PLAYING) return;
    this.stateMachine.changeState(GAME_STATES.PAUSE);
  }

  /**
   * Push the current quality tier into every subsystem that has a quality-dependent knob.
   */
  _applyQuality() {
    const q = this.quality;
    if (!q) return;

    this.lightScale = q.lightScale;

    if (this.particleSystem) {
      this.particleSystem.setGlow(q.particleGlow);
      if (this.particleBudget) {
        this.particleSystem.setActiveLimit(this.particleBudget * q.particleFactor);
      }
    }
    if (this.inputHandler) {
      this.inputHandler.setGlow(q.glowScale > 0);
    }

    // DPR / lightmap size changed: re-allocate buffers (no-op until the first resize ran)
    if (this._sizeKey) this.resize();
  }

  /**
   * Responsive canvas resolution scaling calibrated to window.devicePixelRatio
   * Guarantees crystal-clear Retina graphics while locking logical coordinates.
   * Re-allocating a canvas buffer is expensive (and clears it), so this bails out
   * early when neither the logical size, DPR nor lightmap scale changed.
   */
  resize() {
    const isMobile = typeof window !== 'undefined' && (
      window.innerWidth <= 768 ||
      ('ontouchstart' in window) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 0)
    );
    this.isMobile = isMobile;

    const rawDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const dpr = Math.min(rawDpr, this.quality ? this.quality.getDprCap() : (isMobile ? 1.5 : 2.0));

    const parent = this.canvas.parentElement;
    const width = parent && parent.clientWidth > 0 ? parent.clientWidth : window.innerWidth;
    const height = parent && parent.clientHeight > 0 ? parent.clientHeight : window.innerHeight;

    const sizeKey = `${width}x${height}@${dpr}/${this.lightScale}`;
    if (sizeKey === this._sizeKey) return;
    this._sizeKey = sizeKey;

    this.dpr = dpr;
    this.width = width;
    this.height = height;

    // Internal pixel buffer scaled by DPR
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    // Keep display size matching container via 100%
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';

    // Resize lightmap canvas at reduced resolution for GPU fillrate & less thermal throttling
    if (this.lightCanvas) {
      this.lightCanvas.width = Math.max(1, Math.round(this.width * this.lightScale));
      this.lightCanvas.height = Math.max(1, Math.round(this.height * this.lightScale));
    }

    if (this.waveSystem && this.waveSystem.currentLevelIndex === 5) {
      const isMobile = this.width < 600;
      this.player.x = this.width * (isMobile ? 0.20 : 0.22);
      this.player.y = this.height * (isMobile ? 0.65 : 0.70);
    } else {
      this.player.resize(this.width, this.height);
    }

    // Update dimensions on active enemies (e.g. final boss)
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (typeof e.updateCanvasDimensions === 'function') {
        e.updateCanvasDimensions(this.width, this.height);
      }
    }
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

  _loadDifficulty() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DIFFICULTY);
      if (saved === 'INFERNO' || saved === 'HARDCORE' || saved === 'NORMAL') {
        return saved;
      }
      return 'NORMAL';
    } catch (e) {
      return 'NORMAL';
    }
  }

  setDifficulty(difficulty = 'NORMAL') {
    this.difficulty = difficulty;
    try {
      localStorage.setItem(STORAGE_KEYS.DIFFICULTY, difficulty);
    } catch (e) {}
    this.waveSystem.setDifficulty(difficulty);
    if (this.uiManager && typeof this.uiManager.updateDifficultyUI === 'function') {
      this.uiManager.updateDifficultyUI(difficulty);
    }
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
      enemiesDefeated: 0,
      maxCombo: 0,
      startTime: Date.now()
    };
    this.freezeOverlayTimer = 0;
    this.lightningFlashTimer = 0;
    this.bossEntranceWarningActive = false;
    this.bossEntranceWarningTimer = 0;

    this.player.resize(this.width, this.height);
    this.player.reset();

    // Release all active entities back to object pools
    this.enemyPool.releaseAll(this.enemies);
    this.projectilePool.releaseAll(this.projectiles);

    this.particleSystem.clear();
    this.inputHandler.clear();
    this.waveSystem.reset();

    this.isTutorialActive = false;
    this.tutorialStep = 0;
    if (this.uiManager) {
      this.uiManager.hideTutorial();
    }

    this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    this.uiManager.updateScore(0);
    this.uiManager.updateCombo(0, 1, 0);
    this.uiManager.updateWave(1);
  }

  start() {
    this.stateMachine.changeState(GAME_STATES.MENU);
    this.isRunning = true;
    this.lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._boundLoop);
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

    // Feed the adaptive quality controller with the real (unclamped) frame time
    if (this.quality) this.quality.sampleFrame(rawDt * 1000);

    this.update(dt);
    this.render();

    this._rafId = requestAnimationFrame(this._boundLoop);
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
    this._renderLevelBackground(curLevel);

    // Render active state
    this.stateMachine.render(this.ctx);

    this.ctx.restore();
  }

  /**
   * Paint the animated level scene. On weaker tiers the scene is repainted into an offscreen layer at a
   * reduced rate (30/20 FPS) and simply blitted on the frames in between. The scenery is slow ambient
   * motion, so this is invisible to the player but removes most of the per-frame gradient/path work.
   * @param {number} level 1-based level index
   */
  _renderLevelBackground(level) {
    const interval = this.quality ? this.quality.bgIntervalMs : 0;
    const bg = interval > 0 ? this._ensureBackgroundLayer() : null;

    if (!bg) {
      this.backgroundRenderer.render(this.ctx, this.width, this.height, level, this.lastTime / 1000);
      return;
    }

    const now = this.lastTime;
    if (level !== this._bgLevel || now - this._bgLastRender >= interval) {
      const bctx = this._bgCtx;
      bctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      bctx.clearRect(0, 0, this.width, this.height);
      this.backgroundRenderer.render(bctx, this.width, this.height, level, now / 1000);
      this._bgLevel = level;
      this._bgLastRender = now;
    }
    this.ctx.drawImage(bg, 0, 0, this.width, this.height);
  }

  /**
   * Create / resize the offscreen background layer to match the main canvas buffer.
   * @returns {HTMLCanvasElement|null} null when offscreen canvases are unavailable
   */
  _ensureBackgroundLayer() {
    if (typeof document === 'undefined' || !document.createElement) return null;
    if (this._bgUnsupported) return null;

    const pw = this.canvas.width;
    const ph = this.canvas.height;
    if (!this._bgCanvas) {
      try {
        this._bgCanvas = document.createElement('canvas');
        this._bgCtx = this._bgCanvas.getContext('2d');
      } catch (e) {
        this._bgCtx = null;
      }
      if (!this._bgCtx) {
        this._bgUnsupported = true;
        this._bgCanvas = null;
        return null;
      }
      // Same quality-aware shadow handling as the main context
      installShadowBlurScaler(this._bgCtx, () => this.quality.glowScale);
    }
    if (this._bgCanvas.width !== pw || this._bgCanvas.height !== ph) {
      this._bgCanvas.width = pw;
      this._bgCanvas.height = ph;
      this._bgLastRender = -Infinity;
    }
    return this._bgCanvas;
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

    // Countdown lightning electric screen flash and frost freeze overlay
    if (this.lightningFlashTimer > 0) {
      this.lightningFlashTimer -= dt;
    }
    if (this.freezeOverlayTimer > 0) {
      this.freezeOverlayTimer -= dt;
    }

    // 2. Wave System Spawner with Pooled Enemy (supports simultaneous squad spawning)
    const livingEnemiesCount = this.enemies.filter(e => !e.isDead).length;
    const hostileEnemiesCount = this.enemies.filter(e => !e.isDead && !e.isHeartGhost).length;

    // Boss Entrance Build-up Delay: when all wave minions have been cleared in Story Mode,
    // pause briefly ("từ từ", ~2.2s) with warning banner and ominous ambience before Boss appears
    const isPreBossClear = Boolean(this.waveSystem
      && this.waveSystem.gameMode === 'STORY'
      && this.waveSystem.levelData
      && this.waveSystem.currentLevelIndex !== 5
      && !this.waveSystem.isBossSpawned
      && this.waveSystem.enemiesSpawnedInWave >= this.waveSystem.totalEnemiesInWave
      && hostileEnemiesCount === 0);

    let spawnResult = null;
    if (isPreBossClear) {
      if (!this.bossEntranceWarningActive) {
        this.bossEntranceWarningActive = true;
        this.bossEntranceWarningTimer = 2.2;

        // Visual & audio feedback: All minions defeated!
        if (this.particleSystem) {
          this.particleSystem.emitFloatingText('✨ ĐÃ QUÉT SẠCH QUÂN ĐOÀN U LINH! ✨', this.width / 2, this.height * 0.35, '#38bdf8', 26);
        }
        if (this.audioSystem && typeof this.audioSystem.playCatPurr === 'function') {
          this.audioSystem.playCatPurr();
        }

        // After 450ms, trigger Boss Warning Banner
        setTimeout(() => {
          if (this.stateMachine && this.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) {
            const bossName = this.waveSystem.levelData ? this.waveSystem.levelData.bossName : 'TRÙM ĐANG ĐẾN';
            const enName = this.waveSystem.levelData ? this.waveSystem.levelData.enName : 'BOSS APPROACHING';
            if (this.uiManager && typeof this.uiManager.showBossWarning === 'function') {
              this.uiManager.showBossWarning(bossName, enName);
            }
            this.triggerShake(12, 1.2);
            if (this.audioSystem && typeof this.audioSystem.soundBossCast === 'function') {
              this.audioSystem.soundBossCast();
            }
          }
        }, 450);
      }

      this.bossEntranceWarningTimer -= dt;
      if (this.bossEntranceWarningTimer <= 0) {
        spawnResult = this.waveSystem.update(dt, this.player.hp, livingEnemiesCount, hostileEnemiesCount);
      } else {
        spawnResult = null;
      }
    } else {
      spawnResult = this.waveSystem.update(dt, this.player.hp, livingEnemiesCount, hostileEnemiesCount);
    }
    if (spawnResult) {
      const configs = Array.isArray(spawnResult) ? spawnResult : [spawnResult];
      const isSquad = configs.length > 1;

      // Count living special tactical ghosts on screen
      let livingHeartCount = this.enemies.filter(e => e.isHeartGhost && !e.isDead).length;
      let livingFreezeCount = this.enemies.filter(e => e.isFreezeGhost && !e.isDead).length;
      let livingBlastCount = this.enemies.filter(e => e.isBlastGhost && !e.isDead).length;

      // Coordinated edge positions for simultaneous squad members (all 4 borders across all levels, including Level 5)
      let squadPositions = [];
      if (isSquad) {
        squadPositions = Enemy.getSquadEdgePositions(configs.length, this.width, this.height);
      }

      for (let k = 0; k < configs.length; k++) {
        const enemyConfig = configs[k];
        let isHeart = Boolean(enemyConfig.isHeartGhost || (enemyConfig.symbolQueue && enemyConfig.symbolQueue.includes('heart')));
        let isFreeze = Boolean(enemyConfig.isFreezeGhost || (enemyConfig.symbolQueue && enemyConfig.symbolQueue.includes('circle')));
        let isBlast = Boolean(enemyConfig.isBlastGhost || (enemyConfig.symbolQueue && enemyConfig.symbolQueue.includes('spiral')));

        // Rebalance heart limit: allow up to 2 hearts active simultaneously when wounded (<= 3 HP), or 1 when healthy
        const maxHeartsAllowed = this.player.hp <= 3 ? 2 : 1;
        if (isHeart && livingHeartCount >= maxHeartsAllowed) {
          isHeart = false;
          enemyConfig.isHeartGhost = false;
          enemyConfig.symbolQueue = ['horizontal', 'vertical'];
        }
        if (isHeart) livingHeartCount++;

        // Allow up to 1 active Freeze ghost at a time
        if (isFreeze && livingFreezeCount >= 1) {
          isFreeze = false;
          enemyConfig.isFreezeGhost = false;
          enemyConfig.symbolQueue = ['caret', 'v_shape'];
        }
        if (isFreeze) livingFreezeCount++;

        // Allow up to 1 active Blast ghost at a time
        if (isBlast && livingBlastCount >= 1) {
          isBlast = false;
          enemyConfig.isBlastGhost = false;
          enemyConfig.symbolQueue = ['horizontal', 'lightning'];
        }
        if (isBlast) livingBlastCount++;

        const isBoss = enemyConfig.isBoss || enemyConfig.archetype === 'BOSS' || (typeof enemyConfig.archetype === 'string' && enemyConfig.archetype.startsWith('BOSS_'));
        let spawnPos;

        if (isHeart || isFreeze || isBlast) {
          // Special tactical power-up ghosts spawn in arena around Momo so player can see them clearly
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.min(this.width, this.height) * (isHeart ? 0.28 : 0.36);
          spawnPos = {
            x: Math.max(70, Math.min(this.width - 70, this.width / 2 + Math.cos(angle) * dist)),
            y: Math.max(70, Math.min(this.height - 70, this.height / 2 + Math.sin(angle) * dist))
          };
        } else if (isBoss) {
          if (enemyConfig.archetype === 'BOSS_MASTER') {
            // Final Master Boss: Positioned majestically on the RIGHT side of the screen
            spawnPos = {
              x: this.width * 0.76,
              y: this.height * 0.46
            };
          } else {
            // Level 1-4 Bosses descend grandly from upper center
            spawnPos = {
              x: this.width / 2,
              y: -75
            };
          }
        } else {
          // Minions across all levels (including Level 5 final round) spawn from all four borders (Top, Bottom, Left, Right)
          if (isSquad && squadPositions[k]) {
            spawnPos = squadPositions[k];
          } else {
            spawnPos = Enemy.getRandomEdgePosition(this.width, this.height);
          }

          // Safety buffer: If player is near an edge (e.g. Momo on the left in Level 5),
          // ensure spawn position keeps a safe distance so the player has reaction time to draw
          if (this.player) {
            const distToPlayer = Math.hypot(spawnPos.x - this.player.x, spawnPos.y - this.player.y);
            const minSafeDist = Math.min(this.width, this.height) * 0.32;
            if (distToPlayer < minSafeDist) {
              const dx = spawnPos.x - this.player.x;
              const dy = spawnPos.y - this.player.y;
              const norm = Math.hypot(dx, dy) || 1;
              spawnPos = {
                x: this.player.x + (dx / norm) * minSafeDist,
                y: this.player.y + (dy / norm) * minSafeDist
              };
            }
          }
        }

        const newEnemy = this.enemyPool.acquire();
        newEnemy.init({
          type: enemyConfig.archetype,
          x: spawnPos.x,
          y: spawnPos.y,
          canvasWidth: this.width,
          canvasHeight: this.height,
          isHeartGhost: isHeart,
          isFreezeGhost: isFreeze,
          isBlastGhost: isBlast,
          symbolQueue: enemyConfig.symbolQueue,
          bossPhases: enemyConfig.bossPhases,
          bossLives: enemyConfig.bossLives,
          speedMultiplier: enemyConfig.speedMultiplier,
          targetPlayerPos: this.player,
          levelIndex: this.waveSystem ? this.waveSystem.currentLevelIndex : 1,
          levelId: (this.waveSystem && this.waveSystem.levelData) ? this.waveSystem.levelData.id : 'library'
        });
        this.enemies.push(newEnemy);

        // Boss / Armored entrance feedback
        if (isBoss) {
          // Boss Entrance Cleansing Shockwave: wipe lingering minion ghosts from pre-boss wave
          let cleansedCount = 0;
          for (let m = 0; m < this.enemies.length; m++) {
            const minion = this.enemies[m];
            if (minion !== newEnemy && !minion.isDead && !minion.isBoss) {
              minion.isDead = true;
              if (minion.isHeartGhost) {
                // Heart ghost automatically converts into +1 HP heal for Momo!
                const healed = this.player.heal(1);
                if (healed) {
                  this.particleSystem.emitFloatingText('+1 HP ❤️ (THU HOẠCH TIM)', this.player.x, this.player.y - 60, '#f43f5e', 24);
                  this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
                }
                this.particleSystem.emitMonsterDeathExplosion(minion.x, minion.y, 'HEART', 20);
              } else {
                this.particleSystem.emitMonsterDeathExplosion(minion.x, minion.y, minion.type, 24);
                const reward = (minion.scoreValue || 100) * this.comboMultiplier;
                this.score += reward;
                this.particleSystem.emitFloatingText(`+${reward}`, minion.x, minion.y - 18, '#fde047', 18);
              }
              cleansedCount++;
            }
          }

          if (cleansedCount > 0) {
            this.triggerShake(24, 0.85);
            this.particleSystem.emitFloatingText('⚡ UY LỰC TRÙM QUÉT SẠCH U LINH! ⚡', this.width / 2, this.height * 0.28, '#f43f5e', 24);
          } else {
            this.triggerShake(20, 0.75);
          }

          if (this.audioSystem) {
            if (typeof this.audioSystem.playBossRoar === 'function') {
              this.audioSystem.playBossRoar();
            } else if (typeof this.audioSystem.soundBossCast === 'function') {
              this.audioSystem.soundBossCast();
            }
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

      // If a squad of 2+ ghosts ambushes together, add an ambient dramatic chime or shake
      if (configs.length >= 2) {
        const shakePower = configs.length >= 4 ? 9 : (configs.length === 3 ? 7 : 4);
        this.triggerShake(shakePower, 0.28);
        const countText = configs.length >= 3 
          ? `⚔️ BẦY U LINH TẬP KÍCH! (x${configs.length}) ⚔️`
          : `⚡ TOÁN U LINH XUẤT HIỆN! (x2) ⚡`;
        this.particleSystem.emitFloatingText(
          countText,
          this.width / 2,
          this.height * 0.18,
          configs.length >= 4 ? '#f43f5e' : (configs.length === 3 ? '#fb923c' : '#38bdf8'),
          configs.length >= 3 ? 20 : 16
        );
      }
    }

    // 3. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(dt, this.player);

      // Check collision with Player
      if (enemy.collidesWith(this.player)) {
        if (enemy.isHeartGhost) {
          // Touching Heart Ghost peacefully heals Momo!
          const healed = this.player.heal(1);
          if (healed) {
            this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
            this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
          }
          if (this.audioSystem && typeof this.audioSystem.playSpell === 'function') {
            this.audioSystem.playSpell('heart');
          }
          this.particleSystem.emitHitBurst(enemy.x, enemy.y, '#f43f5e', 20);
          this.enemyPool.release(enemy);
          this.enemies[i] = this.enemies[this.enemies.length - 1];
          this.enemies.pop();
          continue;
        }

        const damageTaken = this.player.takeDamage(1);
        if (damageTaken) {
          this.metrics.damageTaken++;
          
          // Google Doodle authentic: Ghost screeching attack (Tb) + Momo hurt cry (tc)
          if (this.audioSystem && typeof this.audioSystem.playEnemyAttack === 'function') {
            this.audioSystem.playEnemyAttack();
          }
          this.audioSystem.playHurt();
          
          this.triggerShake(18, 0.45);
          this.particleSystem.emitMonsterDeathExplosion(enemy.x, enemy.y, enemy.type, 26);
          this.particleSystem.emitFloatingText('-1 HP', this.player.x, this.player.y - 40, '#ef4444', 24);

          // Mobile haptic pulse for damage taken & Cat Hiss SFX
          if (typeof this.audioSystem.playCatHiss === 'function') {
            this.audioSystem.playCatHiss();
          }
          if (this.hapticSystem) {
            this.hapticSystem.damage();
          }

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

        // Multi-phase Boss recoils and retreats when it hits player to attack again!
        if (enemy.isBoss) {
          enemy.startBossRetreat(false);
          continue;
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
            this.audioSystem.playHit(proj.gesture);

            // Tutorial progression
            if (this.isTutorialActive) {
              if (proj.gesture === 'horizontal' && this.tutorialStep === 1) {
                this.uiManager.advanceTutorial(2);
                this.particleSystem.emitFloatingText('XUẤT SẮC! TIẾP TỤC NÉT DỌC [ | ]', this.width / 2, this.height * 0.38, '#38bdf8', 22);
              } else if (proj.gesture === 'vertical' && this.tutorialStep === 2) {
                this.uiManager.advanceTutorial(3);
                this.particleSystem.emitFloatingText('HOÀN THÀNH HƯỚNG DẪN! HÃY CHIẾN ĐẤU! ⚡', this.width / 2, this.height * 0.38, '#34d399', 24);
              }
            }

            if (hitResult.isPhaseComplete) {
              // Multi-phase Boss lost 1 life and is retreating!
              const isTargetBoss = proj.targetEnemy.isBoss || proj.targetEnemy.type === 'BOSS' || (typeof proj.targetEnemy.type === 'string' && proj.targetEnemy.type.startsWith('BOSS_'));
              if (isTargetBoss) {
                if (this.hapticSystem) {
                  this.hapticSystem.bossHit();
                }
                if (typeof this.audioSystem.playBossRoar === 'function') {
                  this.audioSystem.playBossRoar();
                } else if (typeof this.audioSystem.playEnemyAttack === 'function') {
                  this.audioSystem.playEnemyAttack();
                }
                this.triggerShake(16, 0.5);
                this.particleSystem.emitHitBurst(proj.targetEnemy.x, proj.targetEnemy.y, '#f59e0b', 26);
                this.particleSystem.emitFloatingText(
                  `💥 TRÙM MẤT 1 MẠNG! (CÒN ${hitResult.bossLivesRemaining}) - LÙI LẠI!`,
                  proj.targetEnemy.x,
                  proj.targetEnemy.y - 45,
                  '#f43f5e',
                  24
                );
                const phaseReward = 500 * this.comboMultiplier;
                this.score += phaseReward;
                this.particleSystem.emitFloatingText(
                  `+${phaseReward}`,
                  proj.targetEnemy.x,
                  proj.targetEnemy.y - 18,
                  '#fde047',
                  22
                );

                // All other enemies must retreat backwards along with the Boss!
                this.retreatAllMinionsWithBoss(proj.targetEnemy);
              }
            } else if (hitResult.destroyed) {
              this.metrics.enemiesDefeated++;
              const isTargetBoss = proj.targetEnemy.isBoss || proj.targetEnemy.type === 'BOSS' || (typeof proj.targetEnemy.type === 'string' && proj.targetEnemy.type.startsWith('BOSS_'));
              if (isTargetBoss) {
                if (this.hapticSystem) {
                  this.hapticSystem.bossDefeat();
                }
                if (typeof this.audioSystem.playCatMeow === 'function') {
                  this.audioSystem.playCatMeow('cheerful');
                }
                if (typeof this.audioSystem.playBossDeath === 'function') {
                  this.audioSystem.playBossDeath(this.waveSystem.currentLevelIndex);
                } else {
                  this.audioSystem.playEnemyDeath();
                }
                this.triggerShake(22, 0.75);
                // Notify WaveSystem that the Boss has fallen
                if (typeof this.waveSystem.notifyBossDefeated === 'function') {
                  this.waveSystem.notifyBossDefeated();
                }

                // Cleanse all remaining minion ghosts in an epic celebratory magic shockwave!
                for (let j = 0; j < this.enemies.length; j++) {
                  const minion = this.enemies[j];
                  if (minion !== proj.targetEnemy && !minion.isDead) {
                    minion.isDead = true;
                    this.particleSystem.emitMonsterDeathExplosion(minion.x, minion.y, minion.type, 22);
                    const minionReward = (minion.scoreValue || 100) * this.comboMultiplier;
                    this.score += minionReward;
                    this.particleSystem.emitFloatingText(
                      `+${minionReward}`,
                      minion.x,
                      minion.y - 18,
                      '#fde047',
                      18
                    );
                  }
                }
              } else {
                this.audioSystem.playEnemyDeath();
              }
              // Special power-up effects on enemy defeat
              if (proj.targetEnemy.isFreezeGhost || proj.gesture === 'circle') {
                this.triggerFreezeAll(4.5);
              } else if (proj.targetEnemy.isBlastGhost || proj.gesture === 'spiral') {
                this.triggerPushbackAll(320);
              } else if (proj.targetEnemy.isHeartGhost || proj.gesture === 'heart') {
                const healed = this.player.heal(1);
                if (healed) {
                  this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
                  this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
                }
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

    // 6. Render On-Canvas Interactive Tutorial Guide if active
    this._renderTutorialGuide(ctx);

    // 7. Render Dynamic Lighting (Darkness Vignette & Radial Light Cutouts)
    this._renderDynamicLighting(ctx);

    // 8. Render Neon Drawing Trail
    this.inputHandler.render(ctx);

    ctx.restore();
  }

  /**
   * Render in-game animated drawing guide trajectory for Level 1 Tutorial
   * @param {CanvasRenderingContext2D} ctx 
   */
  _renderTutorialGuide(ctx) {
    if (!this.isTutorialActive || this.tutorialStep <= 0) return;

    ctx.save();
    const time = performance.now() / 1000;
    const progress = (time % 1.6) / 1.6;

    if (this.tutorialStep === 1) {
      // Step 1: Horizontal swipe [ — ]
      const cx = this.width / 2;
      const cy = this.height * 0.40;
      const len = 150;
      const startX = cx - len / 2;
      const endX = cx + len / 2;

      // Glow backdrop
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(startX, cy);
      ctx.lineTo(endX, cy);
      ctx.stroke();

      // Dashed guide line
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(startX, cy);
      ctx.lineTo(endX, cy);
      ctx.stroke();

      // Moving wand icon
      const curX = startX + progress * len;
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪄', curX, cy - 14);

      // Label text
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('VUỐT NGANG (—)', cx, cy + 22);
    } else if (this.tutorialStep === 2) {
      // Step 2: Vertical swipe [ | ]
      const cx = this.width / 2;
      const cy = this.height * 0.40;
      const len = 130;
      const startY = cy - len / 2;
      const endY = cy + len / 2;

      // Glow backdrop
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(cx, startY);
      ctx.lineTo(cx, endY);
      ctx.stroke();

      // Dashed guide line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(cx, startY);
      ctx.lineTo(cx, endY);
      ctx.stroke();

      // Moving wand icon
      const curY = startY + progress * len;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = 12;
      ctx.font = '26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🪄', cx + 16, curY);

      // Label text
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('VUỐT DỌC (|)', cx, endY + 20);
    }

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

    if (!lCanvas || !lCtx || w <= 0 || h <= 0) return;

    const s = this.lightScale || 0.5;
    const lw = lCanvas.width;
    const lh = lCanvas.height;

    lCtx.save();
    lCtx.clearRect(0, 0, lw, lh);

    // Step A: Base Ambient Darkness
    lCtx.fillStyle = 'rgba(6, 4, 16, 0.78)';
    lCtx.fillRect(0, 0, lw, lh);

    // Step B: Heavy Vignette Gradient towards canvas borders
    const maxDim = Math.max(lw, lh);
    const vignette = lCtx.createRadialGradient(
      lw / 2, lh / 2, maxDim * 0.22,
      lw / 2, lh / 2, maxDim * 0.75
    );
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(0.6, 'rgba(3, 2, 8, 0.55)');
    vignette.addColorStop(1, 'rgba(2, 1, 5, 0.95)');
    lCtx.fillStyle = vignette;
    lCtx.fillRect(0, 0, lw, lh);

    // Step C: Carve out light sources using destination-out
    lCtx.globalCompositeOperation = 'destination-out';

    // 1. Local Light around Player Momo
    const isCasting = this.player.castTimer > 0;
    const isHurt = this.player.hurtTimer > 0;
    const breatheLight = Math.sin(this.lastTime * 0.003) * 14;
    const playerLightRadius = isCasting ? 270 : (isHurt ? 165 : 215 + breatheLight);

    if (this.playerLightStamp) {
      lCtx.drawImage(
        this.playerLightStamp,
        (this.player.x - playerLightRadius) * s,
        (this.player.y - playerLightRadius) * s,
        playerLightRadius * 2 * s,
        playerLightRadius * 2 * s
      );
    }

    // Wand tip extra flare when casting
    if (isCasting && this.playerLightStamp) {
      const tip = this.player.getWandTip();
      const tipRadius = 140;
      lCtx.drawImage(
        this.playerLightStamp,
        (tip.x - tipRadius) * s,
        (tip.y - tipRadius) * s,
        tipRadius * 2 * s,
        tipRadius * 2 * s
      );
    }

    // 2. Local Light around Spell Projectiles (Zero GC Allocation)
    if (this.projectileLightStamp) {
      const projRadius = 125;
      for (let i = 0; i < this.projectiles.length; i++) {
        const proj = this.projectiles[i];
        lCtx.drawImage(
          this.projectileLightStamp,
          (proj.x - projRadius) * s,
          (proj.y - projRadius) * s,
          projRadius * 2 * s,
          projRadius * 2 * s
        );
      }
    }

    // 3. Eerie Phosphor Glow around Monsters (Zero GC Allocation)
    if (this.enemyLightStamp) {
      for (let i = 0; i < this.enemies.length; i++) {
        const enemy = this.enemies[i];
        const eRadius = enemy.radius * 2.5;
        lCtx.drawImage(
          this.enemyLightStamp,
          (enemy.x - eRadius) * s,
          (enemy.y - eRadius) * s,
          eRadius * 2 * s,
          eRadius * 2 * s
        );
      }
    }

    // 4. Subtle Trail Glow along Player's current active drawing path
    if (this.strokeLightStamp && this.inputHandler.isDrawing && this.inputHandler.currentPoints.length > 0) {
      const pts = this.inputHandler.currentPoints;
      const step = Math.max(1, Math.floor(pts.length / 10));
      for (let i = 0; i < pts.length; i += step) {
        const pt = pts[i];
        const rad = 45;
        lCtx.drawImage(
          this.strokeLightStamp,
          (pt.x - rad) * s,
          (pt.y - rad) * s,
          rad * 2 * s,
          rad * 2 * s
        );
      }
    }

    lCtx.restore();

    // Step D: Composite the darkness lightmap over the main canvas
    ctx.drawImage(lCanvas, 0, 0, this.width, this.height);

    // Step E: Additive Glow Halos (Atmospheric Bloom)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (this.playerHaloStamp) {
      const haloR = 160;
      ctx.drawImage(
        this.playerHaloStamp,
        this.player.x - haloR,
        this.player.y - haloR,
        haloR * 2,
        haloR * 2
      );
    }

    // Spell projectile color bloom (pre-rendered per colour: no gradient allocated per projectile per frame)
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      const halo = this._getProjectileHalo(proj.color);
      if (halo) {
        ctx.drawImage(halo, proj.x - 65, proj.y - 65);
      }
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

    // 7. Frost Nova Ice Vignette Overlay
    if (this.freezeOverlayTimer > 0) {
      ctx.save();
      const frostAlpha = Math.min(0.55, this.freezeOverlayTimer * 0.22 + 0.12);
      const frostGrad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, Math.min(this.width, this.height) * 0.22,
        this.width / 2, this.height / 2, Math.max(this.width, this.height) * 0.70
      );
      frostGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      frostGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.14)');
      frostGrad.addColorStop(1, `rgba(186, 230, 253, ${frostAlpha})`);
      ctx.fillStyle = frostGrad;
      ctx.fillRect(0, 0, this.width, this.height);

      // Frost decorative corner ice brackets
      ctx.strokeStyle = `rgba(224, 242, 254, ${Math.min(1.0, frostAlpha * 1.5)})`;
      ctx.lineWidth = 3;
      const cornerSize = 48;
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(10, cornerSize);
      ctx.lineTo(10, 10);
      ctx.lineTo(cornerSize, 10);
      ctx.stroke();
      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(this.width - 10, cornerSize);
      ctx.lineTo(this.width - 10, 10);
      ctx.lineTo(this.width - cornerSize, 10);
      ctx.stroke();
      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(10, this.height - cornerSize);
      ctx.lineTo(10, this.height - 10);
      ctx.lineTo(cornerSize, this.height - 10);
      ctx.stroke();
      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(this.width - 10, this.height - cornerSize);
      ctx.lineTo(this.width - 10, this.height - 10);
      ctx.lineTo(this.width - cornerSize, this.height - 10);
      ctx.stroke();

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

    // Momo immediately executes the gesture attack slash animation!
    this.player.castSpell(gesture, matchingEnemies[0] || null);

    if (matchingEnemies.length > 0) {
      this.metrics.spellsHit++;
      this.audioSystem.playSpell(gesture);

      this.triggerShake(3.5, 0.15);

      // Tactile mobile haptic feedback on successful spell strike
      if (this.hapticSystem) {
        this.hapticSystem.cast();
      }

      if (gesture === 'lightning') {
        this.audioSystem.soundLightning();
        if (this.hapticSystem) {
          this.hapticSystem.lightning();
        }
        this.lightningFlashTimer = 0.22;
        if (this.backgroundRenderer) {
          this.backgroundRenderer.triggerLightning(0.25);
        }
        this.triggerShake(14, 0.45);
      }

      if (gesture === 'heart') {
        const healed = this.player.heal(1);
        if (healed) {
          this.particleSystem.emitFloatingText('+1 HP ❤️ Purr~', this.player.x, this.player.y - 60, '#f43f5e', 24);
          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
          if (typeof this.audioSystem.playCatPurr === 'function') {
            this.audioSystem.playCatPurr();
          }
          if (this.hapticSystem) {
            this.hapticSystem.heal();
          }
        }
      }

      if (gesture === 'circle') {
        this.triggerFreezeAll(4.5);
        if (this.hapticSystem) {
          this.hapticSystem.freeze();
        }
      }

      if (gesture === 'spiral') {
        this.triggerPushbackAll(320);
        if (this.hapticSystem) {
          this.hapticSystem.blast();
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
      this.metrics.maxCombo = Math.max(this.metrics.maxCombo || 0, this.comboCount);
      this.comboTimer = COMBO_CONFIG.DECAY_TIME;
      this.comboMultiplier = this._calculateComboMultiplier(this.comboCount);
      this.audioSystem.playCombo(this.comboCount);

      // Play cheerful meow milestone at combo x3, x6, x9, x12...
      if (this.comboCount >= 3 && this.comboCount % 3 === 0) {
        if (typeof this.audioSystem.playCatMeow === 'function') {
          this.audioSystem.playCatMeow('cheerful');
        }
        if (this.hapticSystem) {
          this.hapticSystem.combo(this.comboCount);
        }
      }

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
      if (gesture === 'heart') {
        // In Google Doodle, drawing heart always restores HP even without enemies having heart
        const healed = this.player.heal(1);
        if (healed) {
          this.audioSystem.playSpell('heart');
          if (typeof this.audioSystem.playCatPurr === 'function') {
            this.audioSystem.playCatPurr(0.9);
          }
          this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
        } else {
          this.audioSystem.playSpell(gesture);
        }
      } else if (gesture === 'circle') {
        this.audioSystem.playSpell(gesture);
        setTimeout(() => this.audioSystem.playFizzle(), 140);
        this.particleSystem.emitFloatingText('Chưa có U Linh Băng Giá! ❄️', this.player.x, this.player.y - 60, '#38bdf8', 20);
      } else if (gesture === 'spiral') {
        this.audioSystem.playSpell(gesture);
        setTimeout(() => this.audioSystem.playFizzle(), 140);
        this.particleSystem.emitFloatingText('Chưa có U Linh Cuồng Phong! 🌀', this.player.x, this.player.y - 60, '#34d399', 20);
      } else if (gesture === 'lightning') {
        this.audioSystem.soundLightning();
        this.lightningFlashTimer = 0.16;
        this.triggerShake(8, 0.3);
      } else {
        this.audioSystem.playSpell(gesture);
        setTimeout(() => this.audioSystem.playFizzle(), 140);
      }
      this.uiManager.showGestureFeedback(gesture, result.score, false);
      this._fizzleCombo();
    }
  }

  /**
   * Freeze all active enemies on the battlefield for the given duration
   * @param {number} [duration=4.5] 
   */
  triggerFreezeAll(duration = 4.5) {
    this.freezeOverlayTimer = duration;
    let frozenCount = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.isDead) {
        e.freeze(e.isBoss ? Math.max(2.5, duration - 1.0) : duration);
        frozenCount++;
      }
    }
    this.audioSystem.soundFreeze();
    this.particleSystem.emitHitBurst(this.player.x, this.player.y, '#38bdf8', 32);
    this.particleSystem.emitFloatingText('❄️ ĐÓNG BĂNG TOÀN DIỆN! (4.5s)', this.player.x, this.player.y - 75, '#38bdf8', 26);
    this.triggerShake(6, 0.3);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch (e) {}
    }
  }

  /**
   * Knockback and push all active enemies away from Momo
   * @param {number} [force=320] 
   */
  triggerPushbackAll(force = 320) {
    let pushedCount = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.isDead && !e.isHeartGhost) {
        const dx = e.x - this.player.x;
        const dy = e.y - this.player.y;
        const dist = Math.hypot(dx, dy) || 1;
        const dirX = dx / dist;
        const dirY = dy / dist;
        e.knockback(dirX, dirY, e.isBoss ? force * 0.55 : force);
        pushedCount++;
      }
    }
    this.audioSystem.soundBlast();
    this.particleSystem.emitHitBurst(this.player.x, this.player.y, '#34d399', 38);
    this.particleSystem.emitFloatingText('💥 CUỒNG PHONG ĐẨY LÙI!', this.player.x, this.player.y - 75, '#34d399', 26);
    this.triggerShake(16, 0.45);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(20); } catch (e) {}
    }
  }

  /**
   * Push back and retreat all active minion enemies when the Boss loses 1 life
   * @param {Enemy} [bossEnemy]
   */
  retreatAllMinionsWithBoss(bossEnemy) {
    let retreatedCount = 0;
    for (let k = 0; k < this.enemies.length; k++) {
      const otherEnemy = this.enemies[k];
      if (otherEnemy !== bossEnemy && !otherEnemy.isDead && !otherEnemy.isHeartGhost) {
        if (typeof otherEnemy.retreatWithBoss === 'function') {
          otherEnemy.retreatWithBoss(this.player, 1.35, 260);
        } else if (typeof otherEnemy.knockback === 'function') {
          const dx = otherEnemy.x - this.player.x;
          const dy = otherEnemy.y - this.player.y;
          const dist = Math.hypot(dx, dy) || 1;
          otherEnemy.knockback(dx / dist, dy / dist, 320, 0.8);
        }
        if (this.particleSystem && typeof this.particleSystem.emitMagicSparks === 'function') {
          this.particleSystem.emitMagicSparks(otherEnemy.x, otherEnemy.y, 4, '#fbbf24');
        }
        retreatedCount++;
      }
    }

    // Pause new minion spawns for a breathing window during boss retreat
    if (this.waveSystem && typeof this.waveSystem.pauseBossMinionSpawns === 'function') {
      this.waveSystem.pauseBossMinionSpawns(1.4);
    }

    if (retreatedCount > 0) {
      if (this.audioSystem && typeof this.audioSystem.soundBlast === 'function') {
        this.audioSystem.soundBlast();
      }
      if (this.particleSystem && typeof this.particleSystem.emitFloatingText === 'function') {
        this.particleSystem.emitFloatingText('💨 BẦY QUÁI LÙI LẠI!', this.player.x, this.player.y - 75, '#fbbf24', 22);
      }
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

  /**
   * Handle single tap / click on canvas (interacting with Momo the cat)
   * @param {{x: number, y: number}} pt
   * @returns {boolean} True if tap was consumed
   */
  onCanvasTap(pt) {
    if (!this.player) return false;

    // Hit-test against Momo the cat (radius ~85px around player position)
    const distToMomo = Math.hypot(pt.x - this.player.x, pt.y - this.player.y);
    if (distToMomo <= 85) {
      if (this.audioSystem && typeof this.audioSystem.playCatMeow === 'function') {
        // Alternate between cute chirp ("Mew!") and cheerful meow ("Nyan~")
        const variant = Math.random() < 0.55 ? 'cute' : 'cheerful';
        this.audioSystem.playCatMeow(variant);
      }
      if (this.hapticSystem) {
        this.hapticSystem.pulse(18);
      }
      if (this.particleSystem) {
        // Emit cheerful hearts and paw sparkles around Momo
        this.particleSystem.emitMagicSparks(this.player.x, this.player.y - 25, 8, '#f472b6');
        this.particleSystem.emitFloatingText('Meow~ 🐾', this.player.x, this.player.y - 65, '#f472b6', 22);
      }
      // Playful cat casting / wiggle reaction
      this.player.castTimer = 0.35;
      return true;
    }

    return false;
  }
}
