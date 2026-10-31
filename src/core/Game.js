/**
 * @file Game.js
 * @description Master Game Coordinator implementing Core Loop, Clean Architecture, and State Machine integration.
 */

import { GAME_STATES, RUNES, COMBO_CONFIG, STORAGE_KEYS } from './Constants.js';
import { StateMachine } from './StateMachine.js';
import { GestureEngine } from '../GestureEngine.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { WaveSystem } from '../systems/WaveSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { InputHandler } from '../systems/InputHandler.js';
import { UIManager } from '../ui/UIManager.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = window.devicePixelRatio || 1;

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Subsystems
    this.gestureEngine = new GestureEngine({
      minScore: 0.68,
      minPathLength: 15,
      pointCount: 32,
      boxSize: 100
    });
    this.audioSystem = new AudioSystem();
    this.particleSystem = new ParticleSystem();
    this.waveSystem = new WaveSystem();

    // Player and Entity collections
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

    // Input Handler
    this.inputHandler = new InputHandler(
      this.canvas,
      this.gestureEngine,
      this.particleSystem,
      (result, stroke) => this.onGestureRecognized(result, stroke)
    );

    // UI Manager
    this.uiManager = new UIManager(this);

    // Finite State Machine
    this.stateMachine = new StateMachine(this);

    // Loop Timing
    this.lastTime = 0;
    this.isRunning = false;

    // Background stars / ambient dust
    this.stars = this._createAmbientStars(60);

    // Setup events
    this._bindResize();
    this.resize();

    // Hook Wave System events
    this.waveSystem.onWaveStart = (waveNum) => {
      this.uiManager.updateWave(waveNum);
      this.particleSystem.emitFloatingText(
        `WAVE ${waveNum}`,
        this.width / 2,
        this.height * 0.35,
        '#c084fc',
        34
      );
    };

    this.waveSystem.onWaveComplete = (waveNum) => {
      this.particleSystem.emitFloatingText(
        `WAVE ${waveNum} HOÀN THÀNH!`,
        this.width / 2,
        this.height * 0.35,
        '#34d399',
        30
      );
    };
  }

  _bindResize() {
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width || window.innerWidth;
    this.height = rect.height || window.innerHeight;

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

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
    this.enemies = [];
    this.projectiles = [];
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

  loop(timestamp) {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;

    this.update(dt);
    this.render();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  update(dt) {
    this.stateMachine.update(dt);
  }

  render() {
    this.ctx.save();
    this.ctx.scale(this.dpr, this.dpr);

    // Clear background
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Draw ambient starfield
    this._renderBackground(this.ctx);

    // Render active state
    this.stateMachine.render(this.ctx);

    this.ctx.restore();
  }

  _renderBackground(ctx) {
    // Subtle twinkling stars
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
   * Main Playing State Physics & Logic Update
   * @param {number} dt 
   */
  updatePlaying(dt) {
    // 1. Update Player
    this.player.update(dt, this.enemies);

    // 2. Wave System Spawner
    const enemyConfig = this.waveSystem.update(dt, this.player.hp, this.enemies.length);
    if (enemyConfig) {
      const newEnemy = Enemy.spawnFromRandomEdge(
        this.width,
        this.height,
        this.player,
        enemyConfig.archetype,
        enemyConfig.symbolQueue,
        enemyConfig.speedMultiplier
      );
      this.enemies.push(newEnemy);
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
          this.particleSystem.shake(12, 0.35);
          this.particleSystem.emitDeathPoof(enemy.x, enemy.y, '#ef4444', 20);
          this.particleSystem.emitFloatingText('-1 HP', this.player.x, this.player.y - 40, '#ef4444', 24);

          // Break combo
          this.comboCount = 0;
          this.comboMultiplier = 1;
          this.comboTimer = 0;

          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);

          // Check GameOver
          if (this.player.hp <= 0) {
            this.stateMachine.changeState(GAME_STATES.GAMEOVER);
            return;
          }
        }
        // Enemy dissipates on crashing into player
        this.enemies.splice(i, 1);
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

            // Check if enemy is completely destroyed
            if (hitResult.destroyed) {
              this.metrics.enemiesDefeated++;
              this.audioSystem.playEnemyDeath();
              this.particleSystem.emitDeathPoof(proj.targetEnemy.x, proj.targetEnemy.y, proj.targetEnemy.glowColor, 24);

              // Add defeat score
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
        this.projectiles.splice(i, 1);
      }
    }

    // Remove dead enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].isDead) {
        this.enemies.splice(i, 1);
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

    // 6. Smooth Lerp Score Display
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
   * Render Playing Scene
   * @param {CanvasRenderingContext2D} ctx 
   */
  renderPlaying(ctx) {
    ctx.save();

    // Screen Shake offset
    ctx.translate(this.particleSystem.screenShake.x, this.particleSystem.screenShake.y);

    // 1. Render Player
    this.player.render(ctx);

    // 2. Render Enemies
    for (let i = 0; i < this.enemies.length; i++) {
      this.enemies[i].render(ctx);
    }

    // 3. Render Projectiles
    for (let i = 0; i < this.projectiles.length; i++) {
      this.projectiles[i].render(ctx);
    }

    // 4. Render Particles & Floating texts
    this.particleSystem.render(ctx);

    // 5. Render Neon Drawing Trail
    this.inputHandler.render(ctx);

    ctx.restore();
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
      // Unrecognized stroke
      this.audioSystem.playFizzle();
      this.uiManager.showGestureFeedback(null, 0, false);
      this._fizzleCombo();
      return;
    }

    // Find all enemies whose active (0th) symbol matches the recognized gesture
    const matchingEnemies = this.enemies.filter(e => e.matchesActiveSymbol(gesture));

    if (matchingEnemies.length > 0) {
      // Success! Player casts wand towards the nearest target
      this.metrics.spellsHit++;
      this.player.castSpell(matchingEnemies[0]);
      this.audioSystem.playSpell(gesture);

      // Handle Heart Gesture Healing
      if (gesture === 'heart') {
        const healed = this.player.heal(1);
        if (healed) {
          this.audioSystem.playSpell('heart');
          this.particleSystem.emitFloatingText('+1 HP ❤️', this.player.x, this.player.y - 60, '#f43f5e', 24);
          this.uiManager.updateHearts(this.player.hp, this.player.maxHp);
        }
      }

      // Fire projectile to each matching enemy
      const wandTip = this.player.getWandTip();
      for (const enemy of matchingEnemies) {
        const projectile = new Projectile({
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

      // Add rune base points
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
      // Valid gesture drawn, but no current enemy needs it
      this.audioSystem.playFizzle();
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
