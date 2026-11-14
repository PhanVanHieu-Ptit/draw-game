import { endingAvailable } from '../../shared/story/runtime.js';
import { freezeConfig, defaults, SCHEMA_VERSION } from '../../shared/game-configuration.js';
/**
 * @file Game.js
 * @description Master Game Coordinator implementing Core Loop, Clean Architecture, 
 * Dynamic Lighting with Vignette, Screen Shake, and Particle integrations.
 * Upgraded with Object Pooling for Enemies, Projectiles, and Particles to guarantee stable 60+ FPS,
 * exact deltaTime scaling across high-refresh monitors (60Hz, 120Hz, 144Hz), and Retina DPR calibration.
 */

import { GAME_STATES, RUNES, COMBO_CONFIG, STORAGE_KEYS, PLAYER_CONFIG, ACADEMY_CHARACTERS } from './Constants.js';
import { CombatSystem, comboMultiplier, tickCombo } from '../combat/CombatSystem.js';
import { StateMachine } from './StateMachine.js';
import { SettingsStore, AUDIO_SCALE } from './Settings.js';
import { ProgressStore } from './ProgressStore.js';
import { evaluateAchievements, bestiaryId } from './Achievements.js';
import { UpgradeState, UPGRADES, rollUpgradeChoices, shouldOfferUpgrade } from './Upgrades.js';
import { getCompanion, isCompanionUnlocked, companionsUnlockedByLevel, DEFAULT_COMPANION } from './Companions.js';
import { buildDailyChallengeUrl } from './Challenge.js';
import { LiveOpsService } from './LiveOps.js';
import { LiveOpsEffects } from '../systems/LiveOpsEffects.js';
import { RunSaveStore, buildEndlessSnapshot, MIN_SAVE_WAVE } from './RunSave.js';
import { PhraseTracker, PHRASE_RUNES } from './Spells.js';
import { evaluateCosmetics, getCosmetic, getTrail, isCosmeticUnlocked, DEFAULT_TRAIL, DEFAULT_HAT } from './Cosmetics.js';
import { StoryDirector } from './StoryDirector.js';
import { buildScene, buildBark } from './StoryScenes.js';
import { shardForLevel, evaluatePledge, loreSummary } from './Lore.js';
import { ObjectPool } from './ObjectPool.js';
import { GestureEngine, getMissHint } from '../GestureEngine.js';
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
import { DangerIndicator } from '../systems/DangerIndicator.js';
import { PracticeSession } from '../systems/PracticeSession.js';
import { EventSystem } from '../systems/EventSystem.js';
import { HighlightRecorder } from '../systems/HighlightRecorder.js';
import { UIManager } from '../ui/UIManager.js';

/** 3-2-1 shown after resuming from pause: seconds per number, and how many numbers */
const COUNTDOWN_STEP = 0.8;
const COUNTDOWN_STEPS = 3;
/** Combo counts that trigger a short slow-motion "wow" moment */
const SLOWMO_COMBOS = [5, 10, 20, 35];

export class Game {
  constructor(canvas, combatOptions = {}) {
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

    // Ghost glows are cached sprites (not per-frame shadowBlur): size them for the starting tier now,
    // so the first squad that spawns does not have to build them mid-fight.
    Enemy.setGlowScale(this.quality.glowScale);
    Enemy.setPixelRatio(this.dpr);
    Enemy.prewarmGlow();

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

    // Surprises (golden ghost, meteor shower...), secret Spell Phrases, Boss Rush and the best-moment clip
    this.events = new EventSystem();
    // Live operations: the server-published schedule (daily / weekly challenges, seasonal and random events, flags).
    // Nothing is requested until main.js configures a URL; `liveRun` is what the current run was pinned to at its start.
    this.liveOps = new LiveOpsService();
    this.liveRun = null;
    this.liveEffects = new LiveOpsEffects();
    this.phrases = new PhraseTracker();
    this.bossRush = false;
    this.highlight = new HighlightRecorder(canvas, {
      // The clip carries the game's sound (music, effects, Momo); a fresh track per run
      getAudioTrack: () => (this.audioSystem && typeof this.audioSystem.getRecordingTrack === 'function'
        ? this.audioSystem.getRecordingTrack()
        : null)
    });
    this.clipResult = null;
    this._boostShown = 0;
    Enemy.onGoldenEscape = (e) => this._onGoldenEscaped(e);

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

    // Player preferences and long-term progress (records, stats, achievements, bestiary)
    this.settings = new SettingsStore();
    this.progress = new ProgressStore();
    // Best score from before records were split per mode/difficulty (shown in the records screen)
    this.legacyHighScore = this._loadHighScore();

    // Run-scoped upgrades picked between stages
    this.upgrades = new UpgradeState();
    this.upgradePending = false;
    this._levelStartDamage = 0;
    this._upgradeTimer = null;
    this._stagesClearedThisRun = 0;
    this._newCompanions = [];

    // In-run story: scenes between fights, companion reactions, and the per-level facts the pledges read
    this.storyDirector = new StoryDirector((line) => this._showStoryLine(line), () => { this.uiManager?._storyChoiceElement?.remove(); this._graphBattle = null; });
    this._pendingLore = null;
    this._resetStoryTracking();

    // Saved Endless run, the active Daily Challenge (null = ordinary run) and accessibility flags
    this.runSave = new RunSaveStore();
    this.challenge = null;
    this.runAssisted = false; // true once an assist was on / used during this run: the run is not ranked
    this.assistScale = 1;     // ghost speed multiplier from the slow-motion assist setting
    this._pendingRestore = null;

    // "Wow" moments and pressure cues
    this.slowMo = { timer: 0, total: 1, scale: 1 };
    this._slowMoCooldown = 0;
    this.resumeCountdown = 0;
    this.danger = new DangerIndicator();
    this._moodRate = 1;

    // Equip the saved companion's passive
    this._equipCompanion();

    // Scoring & Combo runtime state
    this.combat = new CombatSystem(combatOptions);
    this._localCombatRules = structuredClone(this.combat.rules);
    this.combat.onEvent(event => this._onCombatEvent(event));
    this.score = 0;
    this.displayedScore = 0;
    this.highScore = 0; // best score of the current mode + difficulty, see refreshHighScore()
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    // Session Metrics
    this.metrics = this._newMetrics();

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

    // The touch buzz on pen-down follows the haptics setting
    this.inputHandler.canVibrate = () => this.settings.get('haptics');

    // Equipped ink colour and hat
    this._applyCosmetics();

    // Push the initial quality tier into the subsystems
    this._applyQuality();

    // Apply saved preferences (volume, sensitivity, haptics, shake, graphics) and keep them live
    this._applyAllSettings();
    this.settings.onChange((key, value) => this._applySetting(key, value));
    this.refreshHighScore();

    // Practice Mode (drawing trainer)
    this.practice = new PracticeSession(this);

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

      // The level's opening scene, once the stage banner has cleared
      this._resetStoryTracking();
      this.storyDirector.cancel();
      this.storyDirector.schedule(2.2, this._scene(lvlNum, 'intro'));
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

      // The boss's battle cry (a scene already playing finishes first)
      this.storyDirector.schedule(0.6, this._scene(this.waveSystem.currentLevelIndex, 'bossSpawn'));
    };

    this.waveSystem.onLevelComplete = (lvlNum, lvlData) => {
      // The boss's memory shard (and a kept pledge) are earned the moment it falls
      this._pendingLore = this._awardLore(lvlNum);
      this.triggerShake(10, 0.45);
      // The boss falls: a beat of slow motion to savour it
      this.triggerSlowMo(1.3, 0.28, true);
      // The last Story level has no "next area": its banner announces the victory instead
      const isFinal = !!this.waveSystem.isFinalLevel;
      this.uiManager.showLevelComplete(lvlNum, lvlData, isFinal);
      this.particleSystem.emitFloatingText(
        isFinal ? '🏆 GIẢI CỨU HỌC VIỆN!' : `MÀN ${lvlNum} HOÀN THÀNH!`,
        this.width / 2,
        this.height * 0.35,
        '#34d399',
        30
      );

      // Momo cries in triumph upon clearing the stage
      if (this.audioSystem && typeof this.audioSystem.playCatMeow === 'function') {
        setTimeout(() => this.audioSystem.playCatMeow('triumphant'), 400);
      }

      // The purified boss's parting words (the memory itself is on the upgrade screen)
      const waitingBattle = this._graphBattle;
      const generation = this.storyDirector.generation;
      this.storyDirector.cancel();
      this.storyDirector.play(this._scene(lvlNum, 'bossDefeat'));
      if (waitingBattle && waitingBattle.generation === generation && waitingBattle.line.battleId === lvlData.id) {
        this.storyDirector.play(waitingBattle.line.resume());
      }
    };

    this.waveSystem.onGameVictory = () => {
      this.stateMachine.changeState(GAME_STATES.VICTORY);
    };

    this.waveSystem.onWaveStart = (waveNum) => {
      this.events.startWave(waveNum, { enabled: this._eventsAllowed() });
      this.uiManager.updateWave(waveNum);
      // A new level/wave: the flawless-clear baseline restarts and the combo shield recharges
      this._levelStartDamage = this.metrics ? this.metrics.damageTaken : 0;
      this._levelStartCasts = this.metrics ? this.metrics.spellsCast : 0;
      this._levelStartHits = this.metrics ? this.metrics.spellsHit : 0;
      this._levelMaxCombo = this.comboCount || 0;
      this._levelPhrases = 0;
      this.upgrades.refillShield();
      this.uiManager.meta.renderBuffs(this.upgrades);
      this._saveEndlessProgress(waveNum);
    };

    this.waveSystem.onWaveComplete = (waveNum) => {
      this.triggerShake(5, 0.3);
      this.audioSystem.playWaveComplete();
      if (this.runConfiguration?.id !== 'local' && this.runConfiguration?.values && this.waveSystem.gameMode === 'ENDLESS' && waveNum >= this.runConfiguration.values.global.maxWaves) {
        this.stateMachine.changeState(GAME_STATES.VICTORY);
        return;
      }
      this._onStageCleared(waveNum);
    };

    // Persist progress when the page is hidden/closed (kills and stats are only held in memory in between)
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.progress) this.progress.save();
      });
    }
    window.addEventListener('pagehide', () => {
      if (this.progress) this.progress.save();
    });
  }

  // =========================================================================
  // SETTINGS
  // =========================================================================

  /** Push every saved preference into the subsystems it controls */
  _applyAllSettings() {
    const all = this.settings.all();
    for (const key of Object.keys(all)) {
      this._applySetting(key, all[key]);
    }
  }

  /**
   * Apply one preference. Called once per key at start-up and again whenever the player changes it.
   * @param {string} key
   * @param {*} value
   */
  _applySetting(key, value) {
    switch (key) {
      case 'masterVolume':
        this.audioSystem.setVolume((value / 100) * AUDIO_SCALE.master);
        break;
      case 'musicVolume':
        this.audioSystem.setBGMVolume((value / 100) * AUDIO_SCALE.music);
        break;
      case 'sfxVolume':
        this.audioSystem.setSfxVolume((value / 100) * AUDIO_SCALE.sfx);
        break;
      case 'catVolume':
        this.audioSystem.setCatVolume((value / 100) * AUDIO_SCALE.cat);
        break;
      case 'muted':
        this.audioSystem.setMute(value);
        break;
      case 'sensitivity':
        this.gestureEngine.setSensitivity(value);
        break;
      case 'haptics':
        this.hapticSystem.setEnabled(value);
        break;
      case 'screenShake':
        this.particleSystem.setShakeEnabled(value);
        break;
      case 'quality':
        this.quality.setPreference(value);
        break;
      case 'colorBlind':
        Enemy.colorBlind = !!value;
        break;
      case 'storyLines':
        if (this.storyDirector) this.storyDirector.setEnabled(!!value);
        break;
      case 'assist':
        // Applies to ghosts that spawn from now on. Turning it on mid-run makes the run unranked for good.
        this.assistScale = 1 - value / 100;
        if (value > 0) this.runAssisted = true;
        break;
      default:
        break; // missHints and altInput are read on demand
    }
  }

  /** Reload the displayed "best score" for the current mode + difficulty */
  refreshHighScore() {
    const mode = this.waveSystem ? this.waveSystem.gameMode : 'STORY';
    this.highScore = this.progress.getRecord(mode, this.difficulty).score;
    return this.highScore;
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
      // Rotating the phone mid-fight: pause first, the player resumes with a 3-2-1
      this._pauseIfPlaying();
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

    if (Enemy.setGlowScale(q.glowScale)) Enemy.prewarmGlow();

    if (this.particleSystem) {
      this.particleSystem.setGlow(q.particleGlow);
      if (this.particleBudget) {
        this.particleSystem.setActiveLimit(this.particleBudget * q.particleFactor);
      }
    }
    if (this.inputHandler) {
      this.inputHandler.setGlow(q.glowScale > 0);
    }
    // Recording the arena costs CPU: stop if the device had to drop to the lowest tier
    if (this.highlight && this.highlight.running && !this._highlightAllowed()) {
      this.highlight.discard();
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

    // A portrait <-> landscape flip on a phone pauses the run (the layout under the player's hand just changed)
    const portrait = height > width;
    if (isMobile && this._wasPortrait !== undefined && portrait !== this._wasPortrait) {
      this._pauseIfPlaying();
    }
    this._wasPortrait = portrait;

    this.dpr = dpr;
    this.width = width;
    this.height = height;
    // Glow sprites are DPR-aware: rebuild them (once) if the canvas density changed
    if (Enemy.setPixelRatio(dpr)) Enemy.prewarmGlow();

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

  /**
   * Legacy single "best score" key, kept up to date so older builds / saved data stay consistent.
   * The per-mode records that the UI shows live in ProgressStore.
   * @param {number} score
   * @returns {boolean} true if it beat the all-time best
   */
  saveHighScore(score) {
    if (score > this.legacyHighScore) {
      this.legacyHighScore = score;
      try {
        localStorage.setItem(STORAGE_KEYS.HIGH_SCORE, score.toString());
      } catch (e) {}
      return true;
    }
    return false;
  }

  /**
   * Close out the current run: save records/stats, evaluate achievements, clear the Endless autosave.
   * Called by GameOverState / VictoryState.
   *
   * Three kinds of run are told apart:
   *  - ordinary: updates the (mode x difficulty) records;
   *  - Daily Challenge: has its own per-day board, regular records are untouched;
   *  - assisted (slow-motion assist / alternative input used): not ranked at all.
   *
   * @param {boolean} victory
   * @returns {Object} summary the end-of-run screen displays
   */
  finishRun(victory) {
    const mode = this.waveSystem.gameMode;
    const daily = this.challenge;
    const difficulty = daily ? daily.difficulty : (this.difficulty || 'NORMAL');
    const assisted = this.isAssisted();
    const m = this.metrics;
    const level = mode === 'STORY'
      ? (victory ? 5 : this.waveSystem.currentLevelIndex)
      : this.waveSystem.currentWave;
    const accuracy = m.spellsCast > 0 ? Math.round((m.spellsHit / m.spellsCast) * 100) : 100;
    const seconds = m.startTime ? Math.round((Date.now() - m.startTime) / 1000) : 0;
    const rush = !!this.bossRush && mode === 'STORY' && !daily;
    // A seasonal / random event that changed the fight or the score makes this run incomparable with the regular records
    const altered = !daily && this._liveRunAltersPlay();

    const result = this.progress.recordRun({
      mode, difficulty,
      score: this.score,
      level,
      combo: m.maxCombo || 0,
      accuracy,
      // A Boss Rush clear is not a Story clear (it would unlock "Giải Cứu Học Viện")
      victory: victory && !rush,
      spellsCast: m.spellsCast,
      spellsHit: m.spellsHit,
      seconds,
      ranked: !assisted && !daily && !rush && !altered,
      assisted
    });

    let dailyInfo = null;
    let highScore = result.record.score;
    let previousBest = result.previous.score;
    let isNewHighScore = result.isNewScore;
    if (daily) {
      const weekly = daily.kind === 'weekly';
      dailyInfo = {
        key: daily.key, name: daily.modifier.name, isNewBest: false, streak: 0,
        kind: daily.kind || 'daily', source: daily.source || 'builtin', boardId: daily.boardId || null
      };
      // Only the challenge of the moment is ranked: an older day from a friend's link is just for fun
      if (!assisted && this.liveOps.isCurrentChallenge(daily)) {
        const challengeRun = { score: this.score, wave: level, combo: m.maxCombo || 0 };
        if (!weekly) {
          const d = this.progress.recordDaily(daily.key, challengeRun);
          dailyInfo.isNewBest = d.isNewBest;
          dailyInfo.streak = d.streak;
          dailyInfo.record = d.record;
          highScore = d.record.score;
          previousBest = d.previous;
          isNewHighScore = d.isNewBest;
        }
        // Each (challenge, rules version, score version) is its own leaderboard: scores are never mixed across them
        const board = daily.boardId ? this.progress.recordBoard(daily.boardId, challengeRun) : null;
        if (board && board.record) {
          dailyInfo.board = { id: daily.boardId, isNewBest: board.isNewBest, previous: board.previous, record: board.record };
          if (weekly) {
            dailyInfo.isNewBest = board.isNewBest;
            dailyInfo.record = board.record;
            highScore = board.record.score;
            previousBest = board.previous;
            isNewHighScore = board.isNewBest;
          }
          this.progress.save();
        }
      } else {
        highScore = this.score;
      }
    }

    // Live operations: event progress and rewards. Settled before the cosmetics check so a granted cosmetic shows up
    // as newly unlocked. A fault here must never stop the run from being closed out.
    let liveSummary = null;
    try {
      liveSummary = this._settleLiveRun({ mode, difficulty, assisted, level, combo: m.maxCombo || 0 });
      if (liveSummary && altered) liveSummary.unranked = true;
    } catch (e) {
      liveSummary = null;
    }

    // Boss Rush keeps its own board: best score, fastest clear and furthest boss
    let rushInfo = null;
    if (rush) {
      rushInfo = { seconds, isNewScore: false, isNewTime: false, record: this.progress.getRush() };
      if (!assisted) {
        const r = this.progress.recordRush({ score: this.score, level, seconds, victory });
        rushInfo = { seconds, isNewScore: r.isNewScore, isNewTime: r.isNewTime, record: r.record, previous: r.previous };
        highScore = r.record.score;
        previousBest = r.previous.score;
        isNewHighScore = r.isNewScore;
      } else {
        highScore = this.score;
      }
    }

    if (!assisted && !daily && !rush && !altered) {
      this.saveHighScore(this.score);
      this.highScore = result.record.score;
    }
    if (mode === 'ENDLESS' && !daily) this.runSave.clear();

    // The end screen lists new achievements itself: play the fanfare but skip the toasts on top of it
    const achievements = evaluateAchievements(this.progress);
    const cosmetics = this._checkCosmetics(false);
    this._announceAchievements(achievements, false);
    this._collectHighlight();

    const summary = {
      mode, difficulty, level, accuracy, seconds, victory, assisted,
      daily: dailyInfo,
      liveOps: liveSummary,
      bossRush: rush,
      rush: rushInfo,
      cosmetics,
      score: this.score,
      maxCombo: m.maxCombo || 0,
      highScore,
      previousBest,
      scoreGap: (assisted || daily || rush || altered) ? 0 : result.scoreGap,
      isNewHighScore: !assisted && isNewHighScore,
      isNewLevel: !assisted && !daily && !rush && result.isNewLevel,
      isNewCombo: !assisted && !daily && !rush && result.isNewCombo,
      record: result.record,
      replay: this.getRunReplay(),
      unlockedCompanions: this._newCompanions.slice(),
      achievements
    };
    this._newCompanions = [];
    return summary;
  }

  /**
   * Hand the finished run to live operations (progress towards event rewards, rewards granted). Once per run.
   * @returns {{events: Array<Object>, granted: Array<Object>}|null} null when no event touched the run
   */
  _settleLiveRun({ mode, difficulty, assisted, level, combo }) {
    const pin = this.liveRun;
    if (!pin || pin.settled) return null;
    const ch = this.challenge;
    const settled = this.liveOps.settleRun({
      pin,
      progress: this.progress,
      run: {
        mode: ch ? (ch.kind === 'weekly' ? 'WEEKLY' : 'DAILY') : mode,
        difficulty: ch ? ch.difficulty : difficulty,
        assisted,
        score: this.score,
        wave: level,
        combo,
        storyLevelsCleared: this._storyLevelsCleared()
      }
    });
    if (settled.events.some((e) => e.counted)) this.progress.save();
    return settled.events.length ? settled : null;
  }

  /**
   * Facts for the end-of-run recap: favourite rune, sharpest stroke, rune that needs practice.
   * @returns {{topRune: string|null, topRuneCount: number, bestAccuracy: number, bestAccuracyRune: string|null, avgAccuracy: number, weakestRune: string|null, weakestMissRate: number}}
   */
  getRunReplay() {
    const m = this.metrics || {};
    const use = m.runeUse || {};
    const miss = m.runeMiss || {};

    let topRune = null;
    let topRuneCount = 0;
    for (const [rune, n] of Object.entries(use)) {
      if (n > topRuneCount) { topRune = rune; topRuneCount = n; }
    }

    let weakestRune = null;
    let weakestRate = 0;
    for (const rune of Object.keys(RUNES)) {
      const total = (use[rune] || 0) + (miss[rune] || 0);
      if (total < 4) continue;
      const rate = (miss[rune] || 0) / total;
      if (rate >= 0.25 && rate > weakestRate) { weakestRune = rune; weakestRate = rate; }
    }

    return {
      topRune,
      topRuneCount,
      bestAccuracy: Math.round((m.accBest || 0) * 100),
      bestAccuracyRune: m.accBestRune || null,
      avgAccuracy: m.accCount ? Math.round((m.accSum / m.accCount) * 100) : 0,
      weakestRune,
      weakestMissRate: Math.round(weakestRate * 100)
    };
  }

  /** @returns {boolean} whether this run used an assist and is therefore left out of the records */
  isAssisted() {
    return !!this.runAssisted || (this.settings ? this.settings.get('assist') > 0 : false);
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
    this.refreshHighScore();
    if (this.uiManager && typeof this.uiManager.updateDifficultyUI === 'function') {
      this.uiManager.updateDifficultyUI(difficulty);
    }
  }

  /** Fresh per-run counters (runeUse / runeMiss / acc* feed the end-of-run recap) */
  _newMetrics() {
    return {
      spellsCast: 0,
      spellsHit: 0,
      damageTaken: 0,
      enemiesDefeated: 0,
      maxCombo: 0,
      startTime: Date.now(),
      runeUse: {},
      runeMiss: {},
      accBest: 0,
      accBestRune: null,
      accSum: 0,
      accCount: 0
    };
  }

  resetGameData() {
    this.runConfiguration = this._pendingRestore ? freezeConfig(structuredClone(this._pendingRestore.configuration || { id: 'local', schemaVersion: SCHEMA_VERSION, values: defaults })) : this.remoteConfiguration?.pin();
    if (this.waveSystem.gameMode === 'ENDLESS' && this.runConfiguration?.values.modes.endlessEnabled === false) {
      this.waveSystem.setMode('STORY');
    }
    this._configurationTime = 0;
    const remote = this.runConfiguration?.id !== 'local' && this.runConfiguration?.values;
    this._spellReadyAt = {};
    if (!remote && this._localCombatRules) {
      this.combat.rules = structuredClone(this._localCombatRules);
      this.gestureEngine.setSensitivity(this.settings.get('sensitivity'));
    }
    if (remote) {
      this.combat.rules.damage = { ...this.combat.rules.damage, runes: remote.combat.runeDamage, player: remote.combat.playerDamage };
      this.combat.rules.scoring.multiplier = remote.combo.scoreMultiplier;
      Object.assign(this.combat.rules.flags, remote.flags);
      this.gestureEngine.minScore = remote.gestures.minScore;
    }
    this.score = 0;
    this.displayedScore = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    this.comboTimer = 0;

    this.metrics = this._newMetrics();
    this.runAssisted = this.settings.get('assist') > 0;
    this._stagesClearedThisRun = 0;
    this._newCompanions = [];
    this.slowMo.timer = 0;
    this._slowMoCooldown = 0;
    this.resumeCountdown = 0;
    this._moodRate = 1;
    this.audioSystem.setBGMRate(1);
    this.danger.critical = false;
    this.freezeOverlayTimer = 0;
    this.lightningFlashTimer = 0;
    this.bossEntranceWarningActive = false;
    this.bossEntranceWarningTimer = 0;

    // Surprises, phrase chain and the clip recorder start fresh with every run
    this._combatFizzleDelay = 0;
    this._comboWarning = false;
    this.events.reset();
    this.phrases.reset();
    this.waveSystem.eventSpeedScale = 1;
    this.waveSystem.spawnQueue.length = 0;
    this.clipResult = null;
    this.uiManager.meta.renderPhraseChain([]);
    this.uiManager.meta.setClip(null);
    this._beginHighlight();

    // Upgrades only last for one run: undo their effects on the player before it is reset
    this.upgrades.reset();
    this.upgradePending = false;
    clearTimeout(this._upgradeTimer);
    this._levelStartDamage = 0;
    this.storyDirector.cancel();
    this._pendingLore = null;
    this._resetStoryTracking();
    // Live operations: fix which events this run is subject to, before hearts and wave rules are decided
    this.liveRun = this._pinLiveRun();
    this.liveEffects.set(this.liveRun ? this.liveRun.visual : this.liveOps.menuVisual());
    // Hearts: a daily twist or an event can lower them; the equipped companion may add invulnerability time
    const runModifier = this._runModifier();
    this.player.maxHp = (runModifier && runModifier.maxHp) || PLAYER_CONFIG.MAX_HP;
    this.player.invulnerableBonus = this.upgrades.invulnerableBonus;
    this.upgrades.refillShield();
    this.refreshHighScore();

    this.player.resize(this.width, this.height);
    this.player.reset();

    // Release all active entities back to object pools
    this.enemyPool.releaseAll(this.enemies);
    this.projectilePool.releaseAll(this.projectiles);

    this.particleSystem.clear();
    this.inputHandler.clear();
    // Seed / daily twist / difficulty must be in place BEFORE the first wave is generated
    this._applyRunConfig();
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
    this.uiManager.meta.hideUpgradePicker();
    this.uiManager.meta.renderBuffs(this.upgrades);
    this.uiManager.meta.setCountdown(0);
    this._announceLiveRun();

    // "Continue Endless": put back what the autosave kept
    if (this._pendingRestore) {
      const snap = this._pendingRestore;
      this._pendingRestore = null;
      this._restoreEndless(snap);
    }
  }

  /** Point WaveSystem at this run's rules: the daily seed + twist, or plain random at the chosen difficulty */
  _applyRunConfig() {
    const ws = this.waveSystem;
    const ch = this.challenge;
    if (ch) {
      ws.setSeed(ch.seed);
      ws.setModifier(ch.modifier);
      ws.setDifficulty(ch.difficulty); // fixed so scores are comparable; the saved difficulty is untouched
      this.events.setSeed(ch.seed);
    } else {
      ws.setSeed(null);
      // A seasonal / random event may twist an ordinary Endless run (null when none applies)
      ws.setModifier(this._runModifier());
      ws.setDifficulty(this.difficulty);
      this.events.setSeed(null);
    }
    this.events.setSurpriseScale(this.liveRun ? this.liveRun.surpriseMultiplier : 1);
    ws.setBossRush(this.bossRush);
  }

  /** The rule twist of this run: the challenge's own, or what the live events add to an ordinary run */
  _runModifier() {
    if (this.challenge) return this.challenge.modifier;
    return this.liveRun ? this.liveRun.modifier : null;
  }

  /** Did a live event change how this (ordinary) run plays or scores? Its score then stays out of the regular records. */
  _liveRunAltersPlay() {
    const pin = this.liveRun;
    return !!pin && (pin.modifier !== null || pin.scoreMultiplier !== 1 || pin.surpriseMultiplier !== 1);
  }

  /** Story levels cleared so far (an event can require some progress) */
  _storyLevelsCleared() {
    let n = 0;
    for (let level = 1; level <= 5; level++) if (this.progress.isLevelCleared(level)) n++;
    return n;
  }

  /**
   * Pin the run to the live events that apply to it. Live operations never stops a run from starting: any failure
   * means "no events". A run continued from the Endless autosave began under other rules, and Boss Rush has its own
   * board, so no event applies to either.
   * @returns {Object|null}
   */
  _pinLiveRun() {
    // Boss Rush is its own board, like the Story mystery it stays apart from: no event touches it
    if (!this.liveOps || this._pendingRestore || this.bossRush) return null;
    try {
      const ch = this.challenge;
      const pin = this.liveOps.pinRun({
        mode: ch ? (ch.kind === 'weekly' ? 'WEEKLY' : 'DAILY') : this.waveSystem.gameMode,
        difficulty: ch ? ch.difficulty : this.difficulty,
        assisted: this.isAssisted(),
        storyLevelsCleared: this._storyLevelsCleared(),
        challenge: ch
      });
      if (pin) pin.pendingAnnounce = true;
      return pin;
    } catch (e) {
      return null;
    }
  }

  /** Tell the player which event is bending this run (canvas text: safe for server-provided names) */
  _announceLiveRun() {
    const pin = this.liveRun;
    if (!pin || !pin.pendingAnnounce) return;
    pin.pendingAnnounce = false;
    if (this.particleSystem && pin.names.length) {
      this.particleSystem.emitFloatingText(`🎉 ${pin.names.join(' + ')}`, this.width / 2, this.height * 0.26, '#fde68a', 22);
    }
  }

  /** Menu / between runs: show the look of whatever event is live (or nothing) */
  refreshLiveEffects() {
    if (this.liveEffects && this.liveOps) this.liveEffects.set(this.liveOps.menuVisual());
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
    if (this.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING) this._configurationTime = (this._configurationTime || 0) + dt;
    if (this.backgroundRenderer) {
      this.backgroundRenderer.update(dt);
    }
    if (this.liveEffects && this.liveEffects.active) this.liveEffects.update(dt, this.width, this.height, this.quality ? this.quality.tier : 'high');
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
    // Event look (colour wash, snow, petals...): over the scenery, under ghosts and Momo
    if (this.liveEffects && this.liveEffects.active) this.liveEffects.render(this.ctx, this.width, this.height);

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
    // The golden ghost is a bonus: it never holds a wave (or a boss fight) open
    const livingEnemiesCount = this.enemies.filter(e => !e.isDead && !e.isGolden).length;
    const hostileEnemiesCount = this.enemies.filter(e => !e.isDead && !e.isHeartGhost && !e.isGolden).length;

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
          eliteModifier: enemyConfig.eliteModifier,
          x: spawnPos.x,
          y: spawnPos.y,
          canvasWidth: this.width,
          canvasHeight: this.height,
          isHeartGhost: isHeart,
          isFreezeGhost: isFreeze,
          isBlastGhost: isBlast,
          isGolden: Boolean(enemyConfig.isGolden),
          symbolQueue: enemyConfig.symbolQueue,
          bossPhases: enemyConfig.bossPhases,
          bossLives: enemyConfig.bossLives,
          speedMultiplier: enemyConfig.speedMultiplier !== undefined
            ? enemyConfig.speedMultiplier * (this.runConfiguration?.id !== "local" ? (this.runConfiguration?.values.difficulty[({ NORMAL: "normalSpeed", HARDCORE: "hardcoreSpeed", INFERNO: "infernoSpeed" })[this.difficulty]] || 1) : 1) * (isBoss ? 1 : this.upgrades.enemySpeedScale) * (this.assistScale || 1)
            : enemyConfig.speedMultiplier,
          targetPlayerPos: this.player,
          levelIndex: this.waveSystem ? this.waveSystem.currentLevelIndex : 1,
          levelId: (this.waveSystem && this.waveSystem.levelData) ? this.waveSystem.levelData.id : 'library'
        });
        this.enemies.push(newEnemy);
        if (this.combat.rules.flags.eliteModifiers && this.combat.rules.elite[newEnemy.eliteModifier]) {
          this.particleSystem.emitFloatingText(`ELITE: ${newEnemy.eliteModifier.toUpperCase()}`, newEnemy.x, newEnemy.y - 55, '#fbbf24', 18);
          this.audioSystem.playSpell('lightning');
        }
        if (this.progress.markSeen(bestiaryId(newEnemy))) {
          this.progress.save(); // first meeting with this kind of ghost: remember it (rare event)
        }

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
                const healed = this.combat.heal(this.player, 1);
                if (healed) {
                  this.particleSystem.emitFloatingText('+1 HP ❤️ (THU HOẠCH TIM)', this.player.x, this.player.y - 60, '#f43f5e', 24);
                  this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
                }
                this.particleSystem.emitMonsterDeathExplosion(minion.x, minion.y, 'HEART', 20);
              } else {
                this.particleSystem.emitMonsterDeathExplosion(minion.x, minion.y, minion.type, 24);
                const reward = this._addScore((minion.scoreValue || 100) * this.comboMultiplier);
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
      enemy.statusEffects?.tick(dt);
      const elite = this.combat.rules.flags.eliteModifiers && this.combat.rules.elite[enemy.eliteModifier];
      enemy.combatSpeedScale = (enemy.statusEffects?.speedMultiplier ?? 1) * (elite?.speedMultiplier ?? 1);
      enemy.update(dt, this.player);

      // Check collision with Player
      if (enemy.collidesWith(this.player)) {
        if (enemy.isHeartGhost) {
          // Touching Heart Ghost peacefully heals Momo!
          const healed = this.combat.heal(this.player, 1);
          if (healed) {
            this.progress.addStat('heals');
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

        const damageTaken = this.combat.damagePlayer(this.player);
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
          const hitResult = this.combat.hit(proj.cast, proj.targetEnemy, proj.targetGeneration);
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
                const phaseReward = this._addScore(500 * this.comboMultiplier);
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
                    const minionReward = this._addScore((minion.scoreValue || 100) * this.comboMultiplier);
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
                const healed = this.combat.heal(this.player, 1);
                if (healed) {
                  this.progress.addStat('heals');
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

              const reward = this._addScore(proj.targetEnemy.scoreValue * this.comboMultiplier);
              this._onEnemyDefeated(proj.targetEnemy, proj.gesture, isTargetBoss);
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
        if (proj.cast && --proj.cast.pending === 0) this.combat.emit('cast:completed', { cast: proj.cast });
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

    // Simulation time only: pause/countdown never enters updatePlaying.
    const combo = tickCombo(this.comboCount, this.comboTimer, dt);
    if (this.comboCount > 0 && combo.count === 0) this.combat.emit('combo:expired');
    this.comboCount = combo.count;
    this.comboTimer = combo.timer;
    this.comboMultiplier = comboMultiplier(combo.count, this.combat.rules.combo.tiers);
    this._tickCombatFeedback(dt);

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
    const decayPercent = this.comboCount > 0 ? (this.comboTimer / this.comboDecayTime) : 0;
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

    // 3. Floating announcements sit under the ghosts: a ghost must never be hidden by a message
    this.particleSystem.renderTexts(ctx);

    // 4. Render Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx);
    }

    // 5. Render Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].render(ctx);
    }

    // 6. Render Particles (hit bursts, sparks) over everything
    this.particleSystem.renderParticles(ctx);

    // 7. Render On-Canvas Interactive Tutorial Guide if active
    this._renderTutorialGuide(ctx);

    // 8. Render Dynamic Lighting (Darkness Vignette & Radial Light Cutouts)
    this._renderDynamicLighting(ctx);

    // 9. Render Neon Drawing Trail
    this.inputHandler.render(ctx);

    ctx.restore();

    // 10. Pressure cues in screen space (not shaken): edge arrows, last-heart glow, slow-motion tint
    if (this.danger) this.danger.render(ctx, this);

    // 11. Blood moon: the whole arena glows red while it lasts
    if (this.events && this.events.speedTimer > 0) {
      const pulse = 0.10 + 0.04 * Math.sin(performance.now() / 260);
      ctx.save();
      ctx.fillStyle = `rgba(190, 18, 60, ${pulse})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.restore();
    }
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
    const stateName = this.stateMachine.getCurrentStateName();
    if (stateName === GAME_STATES.PRACTICE) {
      this.practice.handleStroke(rawStroke);
      return;
    }
    if (stateName !== GAME_STATES.PLAYING) return;

    this.executeSpell(result, rawStroke);
  }

  /** Recognition adapter ends above; synthetic input uses the same execution path. */
  executeSpell(result, rawStroke = []) {
    if (this.stateMachine.getCurrentStateName() !== GAME_STATES.PLAYING) return;
    if (this.resumeCountdown > 0 || this.uiManager.meta.isUpgradeOpen()) return;
    this.metrics.spellsCast++;

    const gesture = result.gesture;
    if (!gesture || !RUNES[gesture]) {
      this._trackMiss(result);
      this.audioSystem.playFizzle();
      const hint = getMissHint(result.reason, result.candidate, result.score);
      this.uiManager.showGestureFeedback(null, 0, false, hint);
      this._showMissGuide(result, rawStroke);
      this._fizzleCombo();
      return;
    }

    const cooldown = this.runConfiguration?.values.spells.cooldownSeconds || 0;
    const castTime = this._configurationTime || 0;
    if ((this._spellReadyAt?.[gesture] || 0) > castTime) return;
    this._spellReadyAt ||= {};
    this._spellReadyAt[gesture] = castTime + cooldown;

    const duration = rawStroke.length > 1
      ? (rawStroke[rawStroke.length - 1].timestamp - rawStroke[0].timestamp) / 1000 : NaN;
    const cast = this.combat.beginCast(result, duration);
    if (!cast) {
      this.audioSystem.playFizzle();
      this.uiManager.showGestureFeedback(gesture, result.score, false, 'Phép chưa được trang bị');
      this._fizzleCombo();
      return;
    }
    this._trackCast(gesture, result);

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
        const healed = this.combat.heal(this.player, 1);
        if (healed) {
          this.progress.addStat('heals');
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

      cast.pending = matchingEnemies.length;
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
          cast,
          particleSystem: this.particleSystem
        });
        this.projectiles.push(projectile);
      }

      // Combo Progression
      this.comboCount++;
      this.combat.emit('combo:advanced', { count: this.comboCount });
      this.metrics.maxCombo = Math.max(this.metrics.maxCombo || 0, this.comboCount);
      this.comboTimer = this.comboDecayTime;
      this.comboMultiplier = this._calculateComboMultiplier(this.comboCount);
      this.audioSystem.playCombo(this.comboCount);

      // Combo milestone: a beat of slow motion, and "combo 5 without being hit" is tracked for an achievement
      if (SLOWMO_COMBOS.includes(this.comboCount)) {
        this.triggerSlowMo(0.75, 0.4);
        this.particleSystem.emitFloatingText(`🔥 COMBO x${this.comboCount}!`, this.width / 2, this.height * 0.3, '#fbbf24', 30);
      }
      if (this.comboCount === 5 && this.metrics.damageTaken === this._levelStartDamage && !this.isAssisted()) {
        this.progress.addStat('cleanCombos');
      }
      if (this.highlight) this.highlight.noteHit(this.comboCount);
      this._trackPhrase(gesture);

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
      const points = this._addScore((runeData.baseScore || 100) * this.comboMultiplier * (cast.perfect ? this.combat.rules.perfect.scoreMultiplier : 1));

      this.particleSystem.emitFloatingText(
        `+${points}`,
        this.player.x + (Math.random() - 0.5) * 40,
        this.player.y - 70,
        runeData.color,
        20
      );

      if (cast.perfect) this.combat.emit('cast:perfect', { cast });
      this.uiManager.showGestureFeedback(gesture, result.score, true);
    } else {
      if (gesture === 'heart') {
        // In Google Doodle, drawing heart always restores HP even without enemies having heart
        const healed = this.combat.heal(this.player, 1);
        if (healed) {
          this.progress.addStat('heals');
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
        this._combatFizzleDelay = 0.14;
        this.particleSystem.emitFloatingText('Chưa có U Linh Băng Giá! ❄️', this.player.x, this.player.y - 60, '#38bdf8', 20);
      } else if (gesture === 'spiral') {
        this.audioSystem.playSpell(gesture);
        this._combatFizzleDelay = 0.14;
        this.particleSystem.emitFloatingText('Chưa có U Linh Cuồng Phong! 🌀', this.player.x, this.player.y - 60, '#34d399', 20);
      } else if (gesture === 'lightning') {
        this.audioSystem.soundLightning();
        this.lightningFlashTimer = 0.16;
        this.triggerShake(8, 0.3);
      } else {
        this.audioSystem.playSpell(gesture);
        this._combatFizzleDelay = 0.14;
      }
      this.uiManager.showGestureFeedback(gesture, result.score, false);
      this._fizzleCombo();
    }
    this.combat.emit('cast:launched', { cast, targets: matchingEnemies.length });
    if (!matchingEnemies.length) this.combat.emit('cast:completed', { cast });
  }

  /**
   * Freeze all active enemies on the battlefield for the given duration
   * @param {number} [duration=4.5] 
   */
  triggerFreezeAll(duration = 4.5) {
    duration += this.upgrades.freezeBonus;
    this.combat.emit('support:freeze', { duration });
    this.progress.addStat('freezes');
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
    this.particleSystem.emitFloatingText(`❄️ ĐÓNG BĂNG TOÀN DIỆN! (${duration.toFixed(1)}s)`, this.player.x, this.player.y - 75, '#38bdf8', 26);
    this.triggerShake(6, 0.3);
    if (this.hapticSystem) this.hapticSystem.pulse(20);
  }

  /**
   * Knockback and push all active enemies away from Momo
   * @param {number} [force=320] 
   */
  triggerPushbackAll(force = 320) {
    force *= this.upgrades.galeMultiplier;
    this.progress.addStat('gales');
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
    if (this.hapticSystem) this.hapticSystem.pulse(20);
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
    this._breakPhraseChain();
    if (this.comboCount > 0) {
      if (this.upgrades.consumeShield()) {
        this.particleSystem.emitFloatingText('🛡️ LÁ CHẮN COMBO!', this.player.x, this.player.y - 50, '#38bdf8', 18);
        this.uiManager.meta.renderBuffs(this.upgrades);
        return;
      }
      this.comboCount = 0;
      this.comboMultiplier = 1;
      this.comboTimer = 0;
      this.particleSystem.emitFloatingText('COMBO VỠ!', this.player.x, this.player.y - 50, '#94a3b8', 18);
    }
  }

  /** Seconds a combo survives without a hit (base value + upgrades) */
  get comboDecayTime() {
    return (this.runConfiguration?.id !== "local" && this.runConfiguration?.values.combo.decaySeconds || COMBO_CONFIG.DECAY_TIME) + this.upgrades.comboTimeBonus;
  }

  /**
   * Add points to the score, applying the run's score upgrades.
   * @param {number} points base points (already multiplied by the combo)
   * @returns {number} the points actually awarded (use this for floating text)
   */
  _addScore(points) {
    // Surprise boosts and the live event's score rule (version 2 challenges / overlays) stack
    const eventMult = (this.events ? this.events.scoreMult : 1) * (this.liveRun ? this.liveRun.scoreMultiplier : 1);
    const awarded = this.combat.score(points, this.upgrades.scoreMultiplier, eventMult);
    this.combat.emit('score:awarded', { points: awarded });
    this.score += awarded;
    return awarded;
  }

  /**
   * After a missed stroke, show the shape the player was probably aiming for.
   * Skipped when the setting is off, the stroke was just a stray touch, or it resembled nothing.
   */
  _showMissGuide(result, rawStroke) {
    if (!this.settings.get('missHints')) return;
    if (!result.candidate || !RUNES[result.candidate]) return;
    if (result.reason === 'too_short' || result.reason === 'no_input') return;
    if (result.reason === 'low_score' && result.score < 0.35) return;
    this.inputHandler.showGuide(result.candidate, RUNES[result.candidate].color, rawStroke);
  }

  /**
   * Bookkeeping for a defeated enemy: kill stats, bestiary and achievements.
   * @param {Enemy} enemy
   * @param {string} gesture rune that landed the final blow
   * @param {boolean} isBoss
   */
  _onEnemyDefeated(enemy, gesture, isBoss) {
    if (enemy.isGolden) this._onGoldenCaught(enemy);
    this.progress.recordKill(bestiaryId(enemy), gesture);
    if (isBoss) {
      this.progress.addStat('bossesDefeated');
      this.progress.save();
    }
    if (!this.isAssisted()) this.progress.maxStat('bestCombo', this.comboCount);
    this._announceAchievements(evaluateAchievements(this.progress));
  }

  /**
   * A story level or endless wave was cleared: update stats and, when due, offer an upgrade.
   * Fired from WaveSystem.onWaveComplete (once per cleared level/wave).
   * @param {number} index level (1..5) in Story, wave number in Endless
   */
  _onStageCleared(index) {
    const mode = this.waveSystem.gameMode;
    this.progress.addStat('levelsCleared');
    this._stagesClearedThisRun++;
    const assisted = this.isAssisted();
    if (!assisted && this.metrics.damageTaken === this._levelStartDamage) {
      this.progress.addStat('flawlessLevels');
    }
    if (!assisted) this.progress.maxStat('bestCombo', this.metrics.maxCombo || 0);

    // Clearing a Story level unlocks the companion tied to it (assisted clears count too: it is progress, not rank)
    if (mode === 'STORY' && !this.bossRush && this.progress.markLevelCleared(index)) {
      for (const def of companionsUnlockedByLevel(index)) {
        const char = ACADEMY_CHARACTERS.find(c => c.id === def.id);
        const name = char ? char.name : def.id;
        this._newCompanions.push(name);
        this.uiManager.meta.showToast(
          `<span class="toast-icon">🐾</span><span class="toast-body"><b>Mở khóa đồng hành!</b><br>${name} — ${def.passive}</span>`,
          'unlock'
        );
      }
    }

    // Oliver's cookie soup: heal one heart every N cleared stages
    const healEvery = this.upgrades.healEvery;
    if (healEvery > 0 && this._stagesClearedThisRun % healEvery === 0 && this.combat.heal(this.player, 1)) {
      this.progress.addStat('heals');
      this.particleSystem.emitFloatingText('🥣 SÚP BÁNH QUY +1 ❤️', this.player.x, this.player.y - 70, '#fb923c', 22);
      this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    }
    this.progress.save();
    this._announceAchievements(evaluateAchievements(this.progress));

    if (shouldOfferUpgrade(mode, index)) {
      this._offerUpgrade();
    }
  }

  /**
   * Hold the intermission and let the player choose 1 of 3 upgrades.
   * No-op when there is nothing useful left to offer.
   */
  _offerUpgrade() {
    const choices = rollUpgradeChoices(this.upgrades, { hp: this.player.hp, maxHp: this.player.maxHp }, 3);
    if (choices.length === 0) return;

    this.upgradePending = true;
    this.waveSystem.intermissionHold = true;

    // Give the "stage complete" banner a moment before covering the screen
    clearTimeout(this._upgradeTimer);
    this._upgradeTimer = setTimeout(() => {
      if (!this.upgradePending) return;
      this.uiManager.meta.showUpgradePicker(choices, (id) => this.pickUpgrade(id), this._pendingLore);
      this._pendingLore = null;
    }, 1500);
  }

  /**
   * Apply the chosen upgrade and let the game continue.
   * @param {string} id
   */
  pickUpgrade(id) {
    if (!this.upgradePending) return false;
    const def = UPGRADES[id];
    if (!def || !this.upgrades.add(id)) return false;

    if (def.apply) def.apply(this.player);
    this.player.invulnerableBonus = this.upgrades.invulnerableBonus;

    this.upgradePending = false;
    this.waveSystem.intermissionHold = false;
    // Short breather, then the next level/wave starts
    this.waveSystem.intermissionTimer = Math.min(this.waveSystem.intermissionTimer, 0.8);

    this.progress.addStat('upgradesTaken');
    this.progress.save();
    this._announceAchievements(evaluateAchievements(this.progress));

    this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    this.uiManager.meta.renderBuffs(this.upgrades);
    this.particleSystem.emitFloatingText(`${def.icon} ${def.name}`, this.width / 2, this.height * 0.4, '#fbbf24', 26);
    if (this.audioSystem) this.audioSystem.playSpell('heart');
    if (this.hapticSystem) this.hapticSystem.pulse(18);
    return true;
  }

  /**
   * Fanfare, plus a toast per newly earned achievement.
   * @param {Array} list
   * @param {boolean} [toasts=true] false when the screen already lists them (end of run)
   */
  _announceAchievements(list, toasts = true) {
    if (toasts) this._checkCosmetics(true);
    if (!list || list.length === 0) return;
    if (toasts) {
      for (const def of list) {
        if (this.uiManager && this.uiManager.meta) this.uiManager.meta.showAchievementToast(def);
      }
    }
    if (this.audioSystem && typeof this.audioSystem.playWaveComplete === 'function') {
      this.audioSystem.playWaveComplete();
    }
  }

  // =========================================================================
  // RUN STATISTICS (feed the end-of-run recap)
  // =========================================================================

  /** A recognised stroke: count it for the favourite-rune and accuracy facts */
  _trackCast(gesture, result) {
    const m = this.metrics;
    if (!m.runeUse) m.runeUse = {};
    m.runeUse[gesture] = (m.runeUse[gesture] || 0) + 1;
    // Strokes from the on-screen pad are not drawn, so their "accuracy" says nothing
    if (result.synthetic || !(result.score > 0)) return;
    m.accSum = (m.accSum || 0) + result.score;
    m.accCount = (m.accCount || 0) + 1;
    if (result.score > (m.accBest || 0)) {
      m.accBest = result.score;
      m.accBestRune = gesture;
    }
  }

  /** A stroke that matched nothing: remember which rune it was closest to */
  _trackMiss(result) {
    const m = this.metrics;
    if (!result || !result.candidate || !RUNES[result.candidate] || !(result.score >= 0.35)) return;
    if (!m.runeMiss) m.runeMiss = {};
    m.runeMiss[result.candidate] = (m.runeMiss[result.candidate] || 0) + 1;
  }

  // =========================================================================
  // WOW MOMENTS, PRESSURE CUES & SMART RESUME
  // =========================================================================

  /**
   * Brief slow motion for a big moment (boss down, combo milestone).
   * @param {number} [duration=0.9] real seconds
   * @param {number} [scale=0.3] game speed at the slowest point (1 = normal)
   * @param {boolean} [force=false] ignore the cooldown (used for bosses)
   */
  triggerSlowMo(duration = 0.9, scale = 0.3, force = false) {
    if (!this.slowMo) return;
    if (!force && this._slowMoCooldown > 0) return;
    this.slowMo.timer = duration;
    this.slowMo.total = duration;
    this.slowMo.scale = scale;
    // Rare moments only: never chain slow motion back to back
    this._slowMoCooldown = duration + 5;
  }

  /**
   * Per-frame work that is not simulation: advances the slow-motion clock, the danger cues and the music mood.
   * Returns the (possibly slowed) time step for the simulation.
   * @param {number} dt real seconds
   * @returns {number} game seconds
   */
  advanceEffects(dt) {
    let scaled = dt;
    const sm = this.slowMo;
    if (sm.timer > 0) {
      sm.timer = Math.max(0, sm.timer - dt);
      const progress = 1 - sm.timer / sm.total;
      // Hold the slow speed, then ease back to normal over the last 35%
      const ease = progress < 0.65 ? 0 : (progress - 0.65) / 0.35;
      scaled = dt * (sm.scale + (1 - sm.scale) * ease);
    }
    if (this._slowMoCooldown > 0) this._slowMoCooldown -= dt;

    this.danger.update(dt, this);
    this._updateAudioMood();

    // Surprises, boss tricks, phrase chain timeout and the clip recorder run on game time
    this._updateEvents(scaled);
    this._pollBossGimmicks();
    this._pollStory(dt);
    if (this.phrases.tick(scaled)) this.uiManager.meta.renderPhraseChain([]);
    if (this.highlight) this.highlight.tick(scaled);
    return scaled;
  }

  /** Music slows a little in slow motion and quickens while Momo is on her last heart */
  _updateAudioMood() {
    let target = 1;
    if (this.slowMo.timer > 0) target = 0.86;
    else if (this.danger.critical) target = 1.14;
    if (target !== this._moodRate) {
      this._moodRate = target;
      if (this.audioSystem.setBGMRate) this.audioSystem.setBGMRate(target);
    }
  }

  /** After unpausing: freeze the world for 3-2-1 so the player can get their hand back on the screen */
  beginResumeCountdown() {
    this.resumeCountdown = COUNTDOWN_STEP * COUNTDOWN_STEPS;
    this.inputHandler.setEnabled(false);
    this.uiManager.meta.setCountdown(COUNTDOWN_STEPS);
  }

  cancelResumeCountdown() {
    if (this.resumeCountdown > 0) this.resumeCountdown = 0;
    if (this.uiManager && this.uiManager.meta) this.uiManager.meta.setCountdown(0);
  }

  /**
   * @param {number} dt
   * @returns {boolean} true while the countdown is running (the simulation should be skipped)
   */
  tickResumeCountdown(dt) {
    if (this.resumeCountdown <= 0) return false;
    this.resumeCountdown -= dt;
    if (this.resumeCountdown <= 0) {
      this.resumeCountdown = 0;
      this.uiManager.meta.setCountdown(0);
      this.inputHandler.setEnabled(true);
      if (this.audioSystem && typeof this.audioSystem.resumeBGM === 'function') this.audioSystem.resumeBGM();
      if (this.highlight) this.highlight.resume();
      return false;
    }
    this.uiManager.meta.setCountdown(Math.ceil(this.resumeCountdown / COUNTDOWN_STEP));
    return true;
  }

  // =========================================================================
  // ENDLESS AUTOSAVE, DAILY CHALLENGE, PRACTICE & COMPANIONS
  // =========================================================================

  /** Snapshot an Endless run at the start of each wave so it can be continued later */
  _saveEndlessProgress(wave) {
    if (this.waveSystem.gameMode !== 'ENDLESS' || this.challenge || wave < MIN_SAVE_WAVE) return;
    this.runSave.save(buildEndlessSnapshot(this));
  }

  /** Continue the saved Endless run from the start of the wave it was saved at */
  resumeEndless() {
    const snap = this.runSave.load();
    if (!snap) return false;
    this.challenge = null;
    this.bossRush = false;
    this._pendingRestore = snap;
    this.waveSystem.setMode('ENDLESS');
    this.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
    return true;
  }

  /** Called at the end of resetGameData when a saved run is being continued */
  _restoreEndless(snap) {
    if (snap.difficulty !== this.difficulty) this.setDifficulty(snap.difficulty);
    this.score = snap.score;
    this.displayedScore = snap.score;
    this.runAssisted = this.runAssisted || snap.assisted;

    this.upgrades.stacks = { ...snap.upgrades };
    this.upgrades.refillShield();
    this.player.maxHp = snap.maxHp;
    this.player.hp = snap.hp;
    this.player.invulnerableBonus = this.upgrades.invulnerableBonus;

    const m = this.metrics;
    m.spellsCast = snap.metrics.spellsCast;
    m.spellsHit = snap.metrics.spellsHit;
    m.damageTaken = snap.metrics.damageTaken;
    m.enemiesDefeated = snap.metrics.enemiesDefeated;
    m.maxCombo = snap.metrics.maxCombo;
    m.startTime = Date.now() - snap.metrics.elapsedMs;

    this.waveSystem.initLevel(snap.wave);
    this.uiManager.updateScore(this.score);
    this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    this.uiManager.meta.renderBuffs(this.upgrades);
    this.uiManager.meta.applyAssistBadge();
    this.particleSystem.emitFloatingText(`▶ TIẾP TỤC ĐỢT ${snap.wave}`, this.width / 2, this.height * 0.3, '#fbbf24', 28);
  }

  /**
   * Start the Daily Challenge of the moment (or an older date from a friend's link). The live schedule decides what
   * that is; with none (offline, nothing scheduled) it is the built-in rotation for today's UTC date.
   * @param {string} [key] 'YYYY-MM-DD' of a specific day
   */
  startDaily(key) {
    this.bossRush = false;
    // The live schedule decides (its own seed, rules and board); offline, or with nothing scheduled, it is the
    // built-in rotation for the date, which is exactly what this method always played
    this.challenge = this.liveOps.dailyChallenge(key || null);
    this.waveSystem.setMode('ENDLESS');
    this.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  }

  /**
   * Start the weekly challenge, if the server has one running.
   * @returns {boolean} false when there is none (the menu should not have offered it)
   */
  startWeekly() {
    const challenge = this.liveOps.weeklyChallenge();
    if (!challenge) return false;
    this.bossRush = false;
    this.challenge = challenge;
    this.waveSystem.setMode('ENDLESS');
    this.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
    return true;
  }

  /** Link that challenges a friend to beat today's best score */
  getDailyShareUrl() {
    const today = this.liveOps.dailyChallenge();
    const key = today.key;
    const best = this.progress.getDaily(key);
    let base = 'https://arcane-paws.game/';
    try {
      if (typeof window !== 'undefined' && window.location && window.location.href) base = window.location.href;
    } catch (e) { /* keep the default */ }
    return buildDailyChallengeUrl(base, key, best ? best.score : 0, 'Momo', today.boardId);
  }

  /** Practice Mode: draw freely with accuracy feedback and no enemies */
  startPractice() {
    if (this.remoteConfiguration?.pin().values.modes.practiceEnabled === false) return;
    this.stateMachine.changeState(GAME_STATES.PRACTICE);
  }

  /** Clear the arena and park Momo low on the screen so the template has room above her */
  preparePracticeScene() {
    this.enemyPool.releaseAll(this.enemies);
    this.projectilePool.releaseAll(this.projectiles);
    this.particleSystem.clear();
    this.inputHandler.clear();
    this.audioSystem.stopBGM();
    this.player.reset();
    // Held sideways the info panel covers the bottom, so Momo steps to the left instead
    const compact = this.height < 520 && this.width > this.height;
    this.player.x = compact ? this.width * 0.1 : this.width / 2;
    this.player.y = compact ? this.height * 0.62 : this.height * 0.76;
  }

  /** Leave a run or Practice Mode for the main menu */
  quitToMenu() {
    this.storyDirector.cancel();
    if (this.highlight) this.highlight.discard();
    if (this.audioSystem && typeof this.audioSystem.stopBGM === 'function') this.audioSystem.stopBGM();
    this.stateMachine.changeState(GAME_STATES.MENU);
  }

  /** Make the saved companion's passive active */
  _equipCompanion() {
    let id = this.progress.getCompanion();
    if (!isCompanionUnlocked(id, this.progress)) id = DEFAULT_COMPANION;
    this.upgrades.setCompanionEffects(getCompanion(id).effects);
    if (this.player) this.player.invulnerableBonus = this.upgrades.invulnerableBonus;
  }

  /**
   * Choose the companion for upcoming runs.
   * @param {string} id
   * @returns {boolean} false if it is locked
   */
  setCompanion(id) {
    if (!isCompanionUnlocked(id, this.progress)) return false;
    this.progress.setCompanion(id);
    this.progress.save();
    this._equipCompanion();
    this.uiManager.meta.renderBuffs(this.upgrades);
    return true;
  }

  /**
   * Alternative input: cast a rune without drawing it (on-screen pad or keys 1-8).
   * Such a run is not ranked.
   * @param {string} gesture rune id
   * @returns {boolean} whether the cast was accepted
   */
  castRune(gesture) {
    if (!RUNES[gesture]) return false;
    if (this.stateMachine.getCurrentStateName() !== GAME_STATES.PLAYING) return false;
    if (this.resumeCountdown > 0 || this.uiManager.meta.isUpgradeOpen()) return false;
    this.runAssisted = true;
    this.uiManager.meta.applyAssistBadge();
    this.onGestureRecognized({ gesture, score: 1, candidate: gesture, reason: null, synthetic: true }, []);
    return true;
  }

  // =========================================================================
  // SURPRISES: GOLDEN GHOST, METEOR SHOWER, BLOOD MOON, BOSS TRICKS
  // =========================================================================

  /** Whether the current wave may hold surprises (not the tutorial level, not a boss-only level, not Boss Rush) */
  _eventsAllowed() {
    const ws = this.waveSystem;
    if (this.bossRush || this.isTutorialActive) return false;
    if (ws.gameMode === 'STORY') {
      return ws.currentLevelIndex >= 2 && ws.currentLevelIndex < 5 && !!ws.levelData && ws.totalEnemiesInWave > 0;
    }
    return ws.currentWave >= 2;
  }

  /** Runes the ghosts of the current level (or daily twist) can carry */
  _runePool() {
    const ws = this.waveSystem;
    if (ws.modifier && ws.modifier.runes) return ws.modifier.runes;
    if (ws.levelData && ws.levelData.allowedRunes) return ws.levelData.allowedRunes;
    return ws.currentWave >= 2
      ? ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning']
      : ['horizontal', 'vertical', 'caret', 'v_shape'];
  }

  _updateEvents(dt) {
    const ws = this.waveSystem;
    const mod = ws.modifier;
    const active = !ws.isIntermission && !ws.isBossSpawned && ws.enemiesSpawnedInWave < ws.totalEnemiesInWave;
    const fired = this.events.update(dt, {
      active,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      pool: this._runePool(),
      noHearts: !!(mod && (mod.noHearts || mod.runes))
    });
    for (const ev of fired) this._announceEvent(ev);
    ws.eventSpeedScale = this.events.speedScale;

    // HUD pill for a running score boost: touch the DOM only when the shown second changes
    const left = this.events.scoreTimer > 0 ? Math.ceil(this.events.scoreTimer) : 0;
    if (left !== this._boostShown) {
      this._boostShown = left;
      this.uiManager.meta.setBoost(this.events.scoreMult, left);
    }
  }

  _announceEvent(ev) {
    const color = ev.kind === 'GOLDEN' ? '#fde047' : (ev.kind === 'HEART_FEST' ? '#f472b6' : '#fb923c');
    this.particleSystem.emitFloatingText(ev.text, this.width / 2, this.height * 0.2, color, 24);
    this.triggerShake(ev.kind === 'BLOOD_MOON' ? 9 : 5, 0.35);
    if (this.audioSystem) {
      if (ev.kind === 'GOLDEN' || ev.kind === 'HEART_FEST') this.audioSystem.playSpell('heart');
      else if (typeof this.audioSystem.soundBlast === 'function') this.audioSystem.soundBlast();
    }
    if (this.hapticSystem) this.hapticSystem.pulse(16);
    for (const spawn of ev.spawns) this.waveSystem.queueSpawn(spawn);
  }

  /** Boss tricks are raised by the Enemy; the game turns them into banners, sounds and spawns */
  _pollBossGimmicks() {
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isBoss && e.gimmickEvent) {
        const kind = e.gimmickEvent;
        e.gimmickEvent = null;
        this._onBossGimmick(e, kind);
      }
    }
  }

  _onBossGimmick(boss, kind) {
    const ps = this.particleSystem;
    const x = this.width / 2;
    const y = this.height * 0.2;
    if (kind === 'HIDE') {
      ps.emitFloatingText('📚 SÁCH CHE MẤT ẤN KÝ! Hãy nhớ lấy!', x, y, '#7dd3fc', 22);
    } else if (kind === 'SWIRL') {
      ps.emitFloatingText('🍲 SÚP XOÁY! Thứ tự ấn ký bị đảo ngược!', x, y, '#fb923c', 22);
      if (this.audioSystem && typeof this.audioSystem.soundBlast === 'function') this.audioSystem.soundBlast();
    } else if (kind === 'METEORS') {
      ps.emitFloatingText('🔭 THIÊN THẠCH RƠI! Hạ chúng thật nhanh!', x, y, '#c084fc', 22);
      this.waveSystem.queueSpawn(this.events.makeMeteorSquad(this._runePool(), 3));
    } else if (kind === 'SPRINT') {
      ps.emitFloatingText('🏀 CHẠY NƯỚC RÚT! Vẽ nhanh lên!', x, y, '#34d399', 22);
      this.triggerShake(8, 0.3);
    } else if (kind === 'FLICKER') {
      ps.emitFloatingText('👑 BÓNG TỐI CHẬP CHỜN — ấn ký lúc hiện lúc ẩn!', x, y, '#f43f5e', 22);
      this.triggerShake(10, 0.5);
    }
    if (this.hapticSystem) this.hapticSystem.pulse(22);
  }

  // =========================================================================
  // IN-RUN STORY (scenes, companion reactions, memory shards, pledges)
  // =========================================================================

  /** Forget what the current level has shown and counted so far */
  _resetStoryTracking() {
    this._midFired = false;
    this._barkedCombo = false;
    this._storyBoss = null;
    this._storyBossLives = 0;
    this._prevHp = this.player ? this.player.hp : 5;
    this._levelStartCasts = 0;
    this._levelStartHits = 0;
    this._levelMaxCombo = 0;
    this._levelPhrases = 0;
  }

  /** The lines of one beat of the current Story level (empty outside Story mode) */
  _scene(level, beat) {
    const ws = this.waveSystem;
    if (ws.gameMode !== 'STORY' || !ws.levelData) return [];
    // Boss Rush is five bosses back to back: only the battle cry and the parting words
    if (this.bossRush) {
      return beat === 'bossSpawn' || beat === 'bossDefeat' ? buildScene(level, beat, { replay: true }) : [];
    }
    // A level whose memory is already in the journal skips the extra lines
    return buildScene(level, beat, { replay: this.progress.hasShard(level), interactive: true, state: this._storyGraphState(), onState: state => { this.progress.data.storyState = state; this.progress.save(); } });
  }

  _storyGraphState() {
    const state = this._graphStoryState ||= structuredClone(this.progress.data.storyState || {flags:{},promises:[],memories:[],rewards:[]});
    for (let level=1;level<=5;level++) {
      if (this.progress.hasShard(level) && !state.memories.includes(String(level))) state.memories.push(String(level));
      if (this.progress.hasPledge(level) && !state.promises.includes(String(level))) state.promises.push(String(level));
    }
    return state;
  }

  _showStoryLine(line) {
    if (!this.uiManager) return;
    if (line.choices) {
      const generation = this.storyDirector.generation;
      this.uiManager.showStoryChoices(line, index => {
        if (generation !== this.storyDirector.generation) return;
        this.storyDirector.resumeGraph(line.choices[index].resume());
      });
      return;
    }
    if (line.battleId) {
      if (this.waveSystem.isIntermission && this.waveSystem.levelData?.id === line.battleId) {
        this.storyDirector.resumeGraph(line.resume());
        return;
      }
      this._graphBattle = {line,generation:this.storyDirector.generation};
      return;
    }
    this.uiManager.showDialogue({
      name: line.name,
      role: line.role,
      avatar: line.avatar,
      characterId: line.characterId,
      color: line.color,
      text: line.text,
      expression: line.expression,
      duration: line.ms
    });
  }

  /** The companion Momo brought (Momo herself when none is unlocked/equipped) */
  _activeCompanionId() {
    const id = this.progress.getCompanion();
    return isCompanionUnlocked(id, this.progress) ? id : DEFAULT_COMPANION;
  }

  /** Per-frame story logic: dialogue clock, mid-level beat, boss beats, companion reactions, pledge counters */
  _pollStory(dt) {
    const d = this.storyDirector;
    d.update(dt);
    if (this.comboCount > this._levelMaxCombo) this._levelMaxCombo = this.comboCount;

    const ws = this.waveSystem;
    const inStory = ws.gameMode === 'STORY' && !!ws.levelData && !this.bossRush;

    // Half of the ordinary ghosts have appeared
    if (inStory && !this._midFired && !ws.isBossSpawned && !ws.isIntermission &&
        ws.totalEnemiesInWave > 0 && ws.enemiesSpawnedInWave >= Math.ceil(ws.totalEnemiesInWave / 2)) {
      this._midFired = true;
      d.play(this._scene(ws.currentLevelIndex, 'mid'));
    }

    // The boss loses a life
    let boss = null;
    for (let i = 0; i < this.enemies.length; i++) {
      if (this.enemies[i].isBoss) { boss = this.enemies[i]; break; }
    }
    if (!boss) {
      this._storyBoss = null;
    } else if (this._storyBoss !== boss) {
      this._storyBoss = boss;
      this._storyBossLives = boss.bossLives;
    } else if (boss.bossLives < this._storyBossLives) {
      this._storyBossLives = boss.bossLives;
      if (inStory) {
        const max = boss.maxBossLives || 0;
        if (boss.bossLives === max - 1) d.play(this._scene(ws.currentLevelIndex, 'bossHurtFirst'));
        else if (boss.bossLives === 1 && max > 2) d.play(this._scene(ws.currentLevelIndex, 'bossHurtLast'));
      }
    }

    // Reactions of whoever Momo brought along
    if (!this.bossRush) {
      if (!this._barkedCombo && this.comboCount >= 10) {
        this._barkedCombo = true;
        d.bark('combo', (n) => buildBark(this._activeCompanionId(), 'combo', n));
      }
      const hp = this.player.hp;
      if (hp === 1 && this._prevHp > 1) {
        d.bark('lowHp', (n) => buildBark(this._activeCompanionId(), 'lowHp', n));
      }
      this._prevHp = hp;
    }
  }

  /** What this Story level counted for the pledges */
  _levelFacts() {
    const m = this.metrics;
    return {
      damage: m.damageTaken - this._levelStartDamage,
      maxCombo: this._levelMaxCombo,
      phrases: this._levelPhrases,
      casts: m.spellsCast - this._levelStartCasts,
      hits: m.spellsHit - this._levelStartHits,
      hearts: this.player.hp
    };
  }

  /**
   * A Story boss fell: hand out its memory shard and, if the level was played the right way, its pledge.
   * Boss Rush, Endless and Daily runs do not touch the mystery. Assisted runs earn the shard (the story is
   * for everyone) but not the pledge (it is a challenge).
   * @param {number} level
   * @returns {{def: Object, newShard: boolean, newPledge: boolean}|null} what the upgrade screen should show
   */
  _awardLore(level) {
    if (this.waveSystem.gameMode !== 'STORY' || this.bossRush || this.challenge) return null;
    const def = shardForLevel(level);
    if (!def) return null;
    const p = this.progress;

    const newShard = p.unlockShard(level);
    let newPledge = false;
    if (!this.isAssisted() && !p.hasPledge(level) && evaluatePledge(level, this._levelFacts())) {
      newPledge = p.keepPledge(level);
    }
    if (newShard || newPledge) p.save();

    if (newShard) {
      this.uiManager.meta.showShardToast(def);
      this.uiManager.meta.markLoreNew();
    }
    if (newPledge) {
      this.particleSystem.emitFloatingText(`✨ LỜI HỨA TRỌN VẸN: CHỮ "${def.letter}" SÁNG LÊN!`, this.width / 2, this.height * 0.28, '#fde047', 26);
      if (this.audioSystem) this.audioSystem.playSpell('heart');
      if (this.hapticSystem) this.hapticSystem.pulse(24);
      this.uiManager.meta.markLoreNew();
    }
    if (newShard || newPledge) this._announceAchievements(evaluateAchievements(p));
    return { def, newShard, newPledge };
  }

  /**
   * Endings to play after a Story victory, in order: the ordinary one the first time, the true one the first
   * time every pledge is kept. Boss Rush and Daily victories are not the story's ending.
   * @returns {Array<'normal'|'true'>}
   */
  pickEndings() {
    if (this.waveSystem.gameMode !== 'STORY' || this.bossRush || this.challenge) return [];
    const queue = [];
    if (!this.progress.isEndingSeen('normal')) queue.push('normal');
    if (endingAvailable('true', {storyVictory:true,pledges:this.progress.pledgeCount()}) && !this.progress.isEndingSeen('true')) queue.push('true');
    return queue;
  }

  /** An ending starts playing: remember it (and reward the true one) so a skip does not force a replay */
  markEndingSeen(kind) {
    if (!this.progress.markEndingSeen(kind)) return;
    this.progress.save();
    this._announceAchievements(evaluateAchievements(this.progress));
  }

  /** The golden ghost was purified: a big bonus and a short double-score window */
  _onGoldenCaught(enemy) {
    this.progress.addStat('goldenCaught');
    this.events.boostScore(2, 10);
    this.particleSystem.emitFloatingText('🌟 U LINH VÀNG! ĐIỂM x2 TRONG 10 GIÂY!', this.width / 2, this.height * 0.26, '#fde047', 26);
    this.particleSystem.emitHitBurst(enemy.x, enemy.y, '#fde047', 36);
    this.comboTimer = this.comboDecayTime;
    if (this.combat.heal(this.player, 1)) {
      this.progress.addStat('heals');
      this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 22);
      this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
    }
    if (this.audioSystem) this.audioSystem.playWaveComplete();
    if (this.hapticSystem) this.hapticSystem.pulse(24);
  }

  /** The golden ghost slipped away (called by the Enemy) */
  _onGoldenEscaped(enemy) {
    if (this.particleSystem) {
      this.particleSystem.emitFloatingText('💨 U Linh Vàng đã trốn mất…', this.width / 2, this.height * 0.26, '#94a3b8', 20);
    }
  }

  // =========================================================================
  // SPELL PHRASES
  // =========================================================================

  /** A stroke landed on a ghost: extend the chain, and cast the phrase if it just completed */
  _trackPhrase(gesture) {
    if (!this.phrases) return;
    const phrase = this.phrases.push(gesture);
    this.uiManager.meta.renderPhraseChain(this.phrases.chain, phrase);
    if (phrase) this._castPhrase(phrase);
  }

  _breakPhraseChain() {
    if (this.phrases && this.phrases.breakChain()) this.uiManager.meta.renderPhraseChain([]);
  }

  _castPhrase(phrase) {
    this._levelPhrases = (this._levelPhrases || 0) + 1;
    const rec = this.progress.recordPhrase(phrase.id);
    this.particleSystem.emitFloatingText(`${phrase.icon} ${phrase.name.toUpperCase()}!`, this.width / 2, this.height * 0.32, '#fde047', 30);
    this.particleSystem.emitHitBurst(this.player.x, this.player.y, '#fde047', 30);
    if (this.audioSystem) this.audioSystem.playSpell('heart');
    if (this.hapticSystem) this.hapticSystem.pulse(24);

    switch (phrase.effect) {
      case 'dispel':
        this._dispelAll();
        break;
      case 'freeze':
        this.triggerFreezeAll(3.5);
        break;
      case 'heal':
        if (this.combat.heal(this.player, 1)) {
          this.progress.addStat('heals');
          this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
        } else {
          const pts = this._addScore(400);
          this.particleSystem.emitFloatingText(`+${pts}`, this.player.x, this.player.y - 60, '#fde047', 22);
        }
        break;
      case 'aegis':
        this.combat.grantInvulnerability(this.player, 3.5);
        this.particleSystem.emitFloatingText('🛡️ BẤT TỬ 3,5 GIÂY', this.player.x, this.player.y - 60, '#38bdf8', 22);
        break;
      case 'gale':
        this.triggerPushbackAll(280);
        break;
      case 'golden':
        this.events.boostScore(2, 10);
        this.particleSystem.emitFloatingText('🌅 ĐIỂM x2 TRONG 10 GIÂY', this.player.x, this.player.y - 60, '#fde047', 22);
        break;
      default:
        break;
    }

    if (rec.isNew) {
      this.uiManager.meta.showToast(
        `<span class="toast-icon">📖</span><span class="toast-body"><b>Công thức mới trong Sổ Phép!</b><br>${phrase.icon} ${phrase.name} — ${phrase.desc}</span>`,
        'unlock'
      );
    }
    this.progress.save();
    this._announceAchievements(evaluateAchievements(this.progress));
  }

  /** Blade Storm: strip the front rune off every ghost that no stroke is already about to hit */
  _dispelAll() {
    const targeted = new Set();
    for (let i = 0; i < this.projectiles.length; i++) {
      if (this.projectiles[i].targetEnemy) targeted.add(this.projectiles[i].targetEnemy);
    }
    const cast = this.combat.beginCast({ gesture: 'horizontal', synthetic: true }, NaN, true);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isDead || e.isBoss || e.isHeartGhost || e.isFreezeGhost || e.isBlastGhost || targeted.has(e)) continue;
      const rune = e.symbolQueue[0];
      if (!PHRASE_RUNES.includes(rune)) continue;
      cast.gesture = rune;
      const res = this.combat.hit(cast, e);
      if (!res.matched) continue;
      this.particleSystem.emitHitBurst(e.x, e.y, RUNES[rune].color, 14);
      if (res.destroyed) this._phraseKill(e, rune);
    }
    this.combat.emit('cast:completed', { cast });
    this.lightningFlashTimer = 0.18;
    this.triggerShake(10, 0.35);
  }

  _phraseKill(enemy, rune) {
    this.metrics.enemiesDefeated++;
    this.audioSystem.playEnemyDeath();
    this.particleSystem.emitMonsterDeathExplosion(enemy.x, enemy.y, enemy.type, 24);
    const reward = this._addScore(enemy.scoreValue * this.comboMultiplier);
    this.particleSystem.emitFloatingText(`+${reward}`, enemy.x, enemy.y - 20, '#fde047', 20);
    this._onEnemyDefeated(enemy, rune, false);
  }

  // =========================================================================
  // BOSS RUSH, COSMETICS & BEST-MOMENT CLIP
  // =========================================================================

  /** Boss Rush: the five bosses back to back (no minion phase), with an upgrade between bosses */
  startBossRush() {
    this.challenge = null;
    this.bossRush = true;
    this.waveSystem.setMode('STORY');
    this.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  }

  /** Put the equipped ink colour and hat into effect (falls back to the defaults if they are not unlocked) */
  _applyCosmetics() {
    const p = this.progress;
    if (!p) return;
    const trailDef = getCosmetic('trail', p.getEquipped('trail'));
    const hatDef = getCosmetic('hat', p.getEquipped('hat'));
    const trail = trailDef && isCosmeticUnlocked(trailDef, p) ? trailDef : getTrail(DEFAULT_TRAIL);
    const hat = hatDef && isCosmeticUnlocked(hatDef, p) ? hatDef.id : DEFAULT_HAT;
    if (this.inputHandler) this.inputHandler.setTrailStyle(trail);
    if (this.player) this.player.hat = hat;
  }

  /**
   * Equip a cosmetic.
   * @param {'trail'|'hat'} kind
   * @param {string} id
   * @returns {boolean} false if it does not exist or is still locked
   */
  setCosmetic(kind, id) {
    const def = getCosmetic(kind, id);
    if (!def || !isCosmeticUnlocked(def, this.progress)) return false;
    this.progress.equipCosmetic(kind, id);
    this.progress.save();
    this._applyCosmetics();
    return true;
  }

  /**
   * Tell the player about cosmetics that just became available.
   * @param {boolean} toast false at the end of a run (the summary lists them instead)
   * @returns {Array} the newly unlocked cosmetics
   */
  _checkCosmetics(toast = true) {
    if (!this.progress) return [];
    const fresh = evaluateCosmetics(this.progress);
    if (fresh.length > 0 && this.uiManager && this.uiManager.meta) this.uiManager.meta.markWardrobeNew();
    if (toast && fresh.length > 0 && this.uiManager && this.uiManager.meta) {
      for (const c of fresh) {
        this.uiManager.meta.showToast(
          `<span class="toast-icon">${c.icon}</span><span class="toast-body"><b>Phần thưởng mới!</b><br>${c.kind === 'hat' ? 'Mũ' : 'Vệt mực'}: ${c.name}</span>`,
          'unlock'
        );
      }
    }
    return fresh;
  }

  /** Recording the arena costs CPU: only when switched on, and not on weak devices */
  _highlightAllowed() {
    if (!this.settings.get('highlight') || !this.quality) return false;
    const tier = this.quality.tier;
    if (tier === 'low') return false;
    return !this.isMobile || tier === 'high';
  }

  _beginHighlight() {
    if (!this.highlight) return;
    this.highlight.discard();
    if (this._highlightAllowed()) this.highlight.begin();
  }

  /** End of a run: finish recording and hand the best moment to the end screen */
  _collectHighlight() {
    if (!this.highlight || !this.highlight.supported) return;
    this.highlight.end().then((clip) => {
      this.clipResult = clip;
      if (this.uiManager && this.uiManager.meta) this.uiManager.meta.setClip(clip);
    }).catch(() => { /* no clip is fine */ });
  }

  _calculateComboMultiplier(count) {
    return comboMultiplier(count, this.combat?.rules.combo.tiers);
  }

  _tickCombatFeedback(dt) {
    if (this._combatFizzleDelay > 0) {
      this._combatFizzleDelay -= dt;
      if (this._combatFizzleDelay <= 0) this.audioSystem.playFizzle();
    }
    const urgent = this.comboCount > 0 && this.comboTimer / this.comboDecayTime <= this.combat.rules.combo.warningFraction;
    if (urgent && !this._comboWarning) {
      this.particleSystem.emitFloatingText('COMBO SẮP HẾT!', this.player.x, this.player.y - 95, '#fbbf24', 18);
      this.audioSystem.playCombo(this.comboCount);
    }
    this._comboWarning = urgent;
  }

  _onCombatEvent(event) {
    const labels = { 'cast:perfect': '✨ PERFECT!', 'hit:blocked': '🛡️ GIÁP!', 'element:reaction': '⚡ PHẢN ỨNG!', 'chain:reaction': '⚡ CHAIN!' };
    if (event.type === 'chain:reaction') this._addScore(event.bonus);
    if (labels[event.type]) {
      const target = event.enemy || this.player;
      this.particleSystem.emitFloatingText(labels[event.type], target.x, target.y - 70, '#fde047', 22);
      this.audioSystem.playHit(event.cast.gesture);
    }
  }

  /**
   * Handle single tap / click on canvas (interacting with Momo the cat)
   * @param {{x: number, y: number}} pt
   * @returns {boolean} True if tap was consumed
   */
  onCanvasTap(pt) {
    if (!this.player) return false;
    if (this.stateMachine && this.stateMachine.getCurrentStateName() === GAME_STATES.PRACTICE) return false;

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
