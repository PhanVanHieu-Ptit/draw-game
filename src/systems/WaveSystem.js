/**
 * @file WaveSystem.js
 * @description Manages 5 progressive story levels matching Google Doodle Halloween 2016,
 * culminating in unique Boss Battles (Librarian, Chef, Planetarium, Coach, Master Boss),
 * with fallback to Endless Mode defense after victory.
 */

import { RUNES, LEVEL_CONFIGS, ENEMY_TYPES, DIFFICULTY_LEVELS, INTRO_TIMING } from '../core/Constants.js';
import { waveRng } from '../core/Challenge.js';

export class WaveSystem {
  constructor() {
    this.gameMode = 'STORY'; // 'STORY' | 'ENDLESS'
    this.difficulty = 'NORMAL'; // 'NORMAL' | 'HARDCORE'
    this.currentLevelIndex = 1;
    this.currentWave = 1; // Alias for backward compatibility
    this.levelData = LEVEL_CONFIGS[0];

    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 1.85;
    this.speedMultiplier = 1.05;
    this.intermissionTimer = 0;
    this.isIntermission = false;
    // While true the intermission does not count down (the player is picking an upgrade)
    this.intermissionHold = false;

    // Randomness source. Math.random normally; a per-wave seeded generator for Daily Challenges, so
    // every player meets the same ghosts in the same wave (see setSeed()).
    this.rng = Math.random;
    this.seed = null;
    // Daily Challenge twist (see Challenge.js DAILY_MODIFIERS), or null
    this.modifier = null;

    // Boss Rush: Story levels without the minion phase, so each level is just its boss
    this.bossRush = false;

    // Extra ghosts injected by mid-wave events and boss gimmicks (see EventSystem). Each entry is a spawn
    // result (one config or a squad array) that update() hands to the game before anything else.
    this.spawnQueue = [];
    // Multiplier on the speed of ghosts generated while a "blood moon" style event is active
    this.eventSpeedScale = 1;

    // Boss state tracking
    this.isBossSpawned = false;
    this.isBossDefeated = false;
    this.bossMinionSpawnTimer = 0;
    this.bossSpawnGraceTimer = 45.0; // Emergency failsafe window (only if a minion is somehow lost for 45s)

    // Event hooks
    this.onWaveStart = null;
    this.onWaveComplete = null;
    this.onLevelStart = null;
    this.onLevelComplete = null;
    this.onBossSpawn = null;
    this.onGameVictory = null;

    this.initLevel(1);
  }

  /**
   * Restart progression from level / wave 1 in the CURRENT game mode.
   * The mode is chosen by setMode(); reset() must not overwrite it, otherwise Endless Mode
   * silently turns into Story Mode (finite 12-ghost level + boss) every time a run starts
   * (Game.resetGameData() calls reset()), and no new ghosts spawn once the quota is used up.
   */
  reset() {
    this.currentLevelIndex = 1;
    this.currentWave = 1;
    this.initLevel(1);
  }

  /**
   * Make the ghost sequence reproducible: wave N always draws from the same generator.
   * Pass null to go back to ordinary randomness.
   * @param {number|null} seed
   */
  setSeed(seed) {
    this.seed = seed === null || seed === undefined ? null : seed >>> 0;
    this._reseed(this.currentWave);
  }

  /**
   * Hand extra ghosts to the spawner. They come out of update() one entry per call, ahead of the normal
   * wave, so they go through exactly the same placement code as every other ghost.
   * @param {Object|Object[]} spawn a ghost config or a squad (array of configs)
   */
  queueSpawn(spawn) {
    if (!spawn) return;
    this.spawnQueue.push(spawn);
  }

  /** @param {boolean} on Boss Rush: every Story level starts straight at its boss */
  setBossRush(on) {
    this.bossRush = !!on;
    this._applyLevelScaling(this.currentLevelIndex);
  }

  /** @param {Object|null} modifier a DAILY_MODIFIERS entry, or null for a normal run */
  setModifier(modifier) {
    this.modifier = modifier || null;
    this._applyLevelScaling(this.currentLevelIndex);
  }

  _reseed(wave) {
    this.rng = this.seed === null ? Math.random : waveRng(this.seed, wave);
  }

  setMode(mode = 'STORY') {
    this.gameMode = mode;
    this.reset();
  }

  setDifficulty(difficulty = 'NORMAL') {
    this.difficulty = difficulty;
    // Only re-scale pacing for the current level. Do NOT call initLevel() here: it fires
    // onLevelStart/onWaveStart (level banner, tutorial popup, shake, meow) and resets level
    // progress, which must not happen just because the player picked a difficulty.
    if (this.currentLevelIndex) {
      this._applyLevelScaling(this.currentLevelIndex);
    }
  }

  /**
   * Recompute level data and difficulty-scaled pacing (spawn interval, speed, enemy count)
   * without touching progress state or firing any level/wave events.
   * @param {number} levelNum
   */
  _applyLevelScaling(levelNum) {
    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.NORMAL;

    if (levelNum <= 5 && this.gameMode === 'STORY') {
      // 5-Level Story Campaign
      this.levelData = LEVEL_CONFIGS[levelNum - 1];
      this.totalEnemiesInWave = this.bossRush ? 0 : this.levelData.totalMinions;
      this.spawnInterval = this.levelData.baseSpawnInterval * diffConfig.spawnIntervalMult;
      this.speedMultiplier = this.levelData.speedMultiplier * diffConfig.speedMult;
    } else {
      // Endless Mode: GDD Formula Scaling
      this.levelData = null;
      this.totalEnemiesInWave = Math.floor((10 + 5 * Math.pow(levelNum, 1.22)) * (this.difficulty === 'HARDCORE' ? 1.25 : 1.0));
      this.spawnInterval = Math.max(0.45, (2.2 * Math.exp(-0.11 * (levelNum - 1))) * diffConfig.spawnIntervalMult);
      this.speedMultiplier = Math.min(2.2, (1.1 + 0.08 * (levelNum - 1)) * diffConfig.speedMult);
    }

    const mod = this.modifier;
    if (mod) {
      if (mod.speed) this.speedMultiplier *= mod.speed;
      if (mod.spawn) this.spawnInterval = Math.max(0.35, this.spawnInterval * mod.spawn);
    }
  }

  /**
   * Initialize a level (1..5) or endless wave
   * @param {number} levelNum 
   */
  initLevel(levelNum) {
    this.currentLevelIndex = levelNum;
    this.currentWave = levelNum; // Keep in sync for compatibility
    this._reseed(levelNum);
    this.enemiesSpawnedInWave = 0;
    this.isBossSpawned = false;
    this.isBossDefeated = false;
    this.bossMinionSpawnTimer = 0;
    this.bossSpawnGraceTimer = 45.0;
    this.isIntermission = false;
    this.intermissionTimer = 0;
    this.intermissionHold = false;
    this.spawnQueue.length = 0;

    this._applyLevelScaling(levelNum);

    this.spawnTimer = INTRO_TIMING.FIRST_SPAWN_S; // Wait for the stage banner to clear before the first ghost

    if (this.onLevelStart && this.levelData) {
      this.onLevelStart(this.currentLevelIndex, this.levelData);
    }
    if (this.onWaveStart) {
      this.onWaveStart(this.currentWave, this.totalEnemiesInWave);
    }
  }

  /**
   * Alias for backward compatibility
   * @param {number} waveNum 
   */
  initWave(waveNum) {
    this.initLevel(waveNum);
  }

  /**
   * True while playing the level whose clearing ends the Story campaign (Level 5).
   * Clearing it goes to the Victory screen instead of another level.
   * @returns {boolean}
   */
  get isFinalLevel() {
    return this.gameMode === 'STORY' && this.currentLevelIndex >= 5;
  }

  /**
   * Notify that the Level Boss was eliminated
   */
  notifyBossDefeated() {
    if (this.isBossDefeated) return;
    this.isBossDefeated = true;
    this.isIntermission = true;
    this.intermissionTimer = 2.6;
    if (this.onLevelComplete) {
      this.onLevelComplete(this.currentLevelIndex, this.levelData);
    }
    if (this.onWaveComplete) {
      this.onWaveComplete(this.currentWave);
    }
  }

  /**
   * Pause minion spawning during boss phase transitions / retreat
   * @param {number} [duration=1.4]
   */
  pauseBossMinionSpawns(duration = 1.4) {
    this.bossMinionSpawnTimer = Math.max(this.bossMinionSpawnTimer, duration);
  }

  /**
   * Update level & wave progression loop
   * @param {number} dt 
   * @param {number} playerHp 
   * @param {number} livingEnemiesCount 
   * @param {number} [hostileEnemiesCount]
   * @returns {{ archetype: string, symbolQueue: string[], speedMultiplier: number, isBoss?: boolean, isHeartGhost?: boolean } | Array<object> | null}
   */
  update(dt, playerHp, livingEnemiesCount, hostileEnemiesCount = livingEnemiesCount) {
    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.NORMAL;

    // 1. Intermission between stages or victory transition
    if (this.isIntermission) {
      if (this.intermissionHold) return null;
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        if (this.isFinalLevel) {
          // Final 5th Level complete -> trigger Victory cutscene
          if (this.onGameVictory) {
            this.onGameVictory();
          }
        } else {
          this.initLevel(this.currentLevelIndex + 1);
        }
      }
      return null;
    }

    // 1b. Ghosts requested by an event or a boss gimmick come first
    if (this.spawnQueue.length > 0) {
      return this.spawnQueue.shift();
    }

    // 2. Story Mode: Minions cleared -> Boss Battle
    if (this.gameMode === 'STORY' && this.levelData) {
      // In Level 5 (The Rooftop), or when totalMinions is 0, the boss is present immediately from the start!
      const isImmediateBossLevel = this.currentLevelIndex === 5 || this.totalEnemiesInWave === 0 || this.levelData.bossType === 'BOSS_MASTER';

      if (isImmediateBossLevel || this.enemiesSpawnedInWave >= this.totalEnemiesInWave) {
        let shouldSpawnBoss = false;
        if (isImmediateBossLevel) {
          shouldSpawnBoss = true;
        } else if (hostileEnemiesCount === 0) {
          shouldSpawnBoss = true;
        } else {
          // As long as hostile minions linger, the player is actively fighting them.
          // The boss must NOT cut in early while there are still small ghosts to defeat!
          // Emergency failsafe only triggers if a stray minion somehow gets lost for >45s.
          this.bossSpawnGraceTimer -= dt;
          if (this.bossSpawnGraceTimer <= 0) {
            shouldSpawnBoss = true;
          }
        }

        if (!this.isBossSpawned && shouldSpawnBoss) {
          this.isBossSpawned = true;
          this.isBossDefeated = false;
          this.bossMinionSpawnTimer = 2.4; // Breathing window before first boss minion appears
          if (this.onBossSpawn) {
            this.onBossSpawn(this.levelData.bossType, this.levelData.bossName);
          }
          return {
            archetype: this.levelData.bossType,
            symbolQueue: (this.levelData.bossPhases && this.levelData.bossPhases.length > 0)
              ? [...this.levelData.bossPhases[0]]
              : [...this.levelData.bossSymbols],
            bossPhases: this.levelData.bossPhases ? this.levelData.bossPhases.map(p => [...p]) : null,
            bossLives: this.levelData.bossLives || 5,
            isBoss: true,
            isHeartGhost: false,
            speedMultiplier: 0.92 * diffConfig.speedMult
          };
        }

        // If boss was defeated or living count dropped to 0 after boss was spawned
        if (this.isBossSpawned && (this.isBossDefeated || livingEnemiesCount === 0)) {
          this.notifyBossDefeated();
          return null;
        }

        // WHILE BOSS IS ALIVE: Relentlessly spawn small ghosts ("các con ma nhỏ") in squads!
        if (this.isBossSpawned && !this.isBossDefeated) {
          this.bossMinionSpawnTimer -= dt;
          if (this.bossMinionSpawnTimer <= 0) {
            // livingEnemiesCount includes Boss + minions
            const livingMinions = Math.max(0, livingEnemiesCount - 1);
            let maxMinions = this.currentLevelIndex <= 2 ? 4 : (this.currentLevelIndex <= 4 ? 6 : 8);
            if (this.difficulty === 'HARDCORE') maxMinions += 2;
            if (this.difficulty === 'INFERNO') maxMinions += 4;

            if (livingMinions < maxMinions) {
              const baseInterval = this.levelData.baseSpawnInterval || 1.1;
              const interval = Math.max(0.60, baseInterval * 0.90) * (playerHp <= 2 ? 1.12 : 1.0) * diffConfig.spawnIntervalMult;
              this.bossMinionSpawnTimer = interval;

              const remainingSlots = maxMinions - livingMinions;
              let spawnCount = 1;

              if (this.currentLevelIndex >= 5 && remainingSlots >= 3 && this.rng() < 0.75) {
                spawnCount = Math.min(remainingSlots, 3 + diffConfig.squadBonus);
              } else if (this.currentLevelIndex >= 4 && remainingSlots >= 2 && this.rng() < 0.70) {
                spawnCount = Math.min(remainingSlots, 2 + diffConfig.squadBonus);
              } else if (this.currentLevelIndex >= 2 && remainingSlots >= 2 && this.rng() < 0.60) {
                spawnCount = Math.min(remainingSlots, 2);
              }

              if (spawnCount > 1) {
                const squad = [];
                for (let s = 0; s < spawnCount; s++) {
                  squad.push(this._generateBossMinionConfig(playerHp));
                }
                return squad;
              }
              return this._generateBossMinionConfig(playerHp);
            } else {
              this.bossMinionSpawnTimer = 0.5; // retry soon once a minion is cleared
            }
          }
        }
      }
    } else {
      // Endless mode completion check. Heart ghosts are stationary (speed 0) and only leave when
      // collected, so they must not hold the wave open or the next wave would never start.
      if (this.enemiesSpawnedInWave >= this.totalEnemiesInWave && hostileEnemiesCount === 0) {
        this.isIntermission = true;
        this.intermissionTimer = 2.5;
        if (this.onWaveComplete) {
          this.onWaveComplete(this.currentWave);
        }
        return null;
      }
    }

    // 3. Spawning Minions in Dynamic Squads
    if (this.enemiesSpawnedInWave < this.totalEnemiesInWave) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        let interval = this.spawnInterval;
        if (playerHp <= 2) {
          interval *= 1.10; // slightly slower when critical
        }
        this.spawnTimer = interval;

        const remaining = this.totalEnemiesInWave - this.enemiesSpawnedInWave;
        let squadSize = 1;

        if (this.currentLevelIndex === 1 && this.gameMode === 'STORY') {
          // Level 1: Clean single spawns for guided tutorial & test compliance
          squadSize = 1;
        } else if (this.currentLevelIndex === 2 && this.gameMode === 'STORY') {
          // Level 2: Frequently twins (2 ghosts) or trios (3 ghosts) appearing together
          const roll = this.rng();
          const wantTrio = roll < (this.difficulty === 'INFERNO' ? 0.45 : (this.difficulty === 'HARDCORE' ? 0.35 : 0.22));
          const wantPair = roll < (this.difficulty === 'INFERNO' ? 0.95 : (this.difficulty === 'HARDCORE' ? 0.90 : 0.82));
          let targetSize = wantTrio ? 3 : (wantPair ? 2 : 1);
          if (diffConfig.squadBonus) targetSize += diffConfig.squadBonus;
          squadSize = Math.min(remaining, targetSize);
        } else if (this.currentLevelIndex === 3 && this.gameMode === 'STORY') {
          // Level 3: Flanking squads of 2, 3, or 4 ghosts rushing together
          const roll = this.rng();
          const targetSize = roll < 0.40 ? 4 : (roll < 0.85 ? 3 : 2);
          squadSize = Math.min(remaining, targetSize + diffConfig.squadBonus);
        } else if (this.currentLevelIndex >= 4 && this.gameMode === 'STORY') {
          // Level 4: Full ambushes of 3, 4, or 5 ghosts simultaneously surrounding Momo
          const roll = this.rng();
          const targetSize = roll < 0.45 ? 5 : (roll < 0.85 ? 4 : 3);
          squadSize = Math.min(remaining, targetSize + diffConfig.squadBonus);
        } else {
          // Endless Mode: Squads scaling with wave index up to 6 ghosts simultaneously
          const maxSquad = Math.min(6, 2 + Math.floor(this.currentWave * 0.45));
          const targetSize = Math.floor(this.rng() * (maxSquad - 1)) + 2 + diffConfig.squadBonus;
          squadSize = Math.min(remaining, targetSize);
        }

        squadSize = Math.max(1, Math.min(remaining, squadSize));

        if (squadSize === 1) {
          this.enemiesSpawnedInWave++;
          return this._generateEnemyConfig(playerHp);
        } else {
          const squad = [];
          for (let s = 0; s < squadSize; s++) {
            this.enemiesSpawnedInWave++;
            squad.push(this._generateEnemyConfig(playerHp));
          }
          return squad;
        }
      }
    }

    return null;
  }

  /**
   * Generate minion enemy config matching active level pool
   * @param {number} playerHp 
   */
  _generateEnemyConfig(playerHp) {
    const W = this.currentWave;
    const lvl = this.levelData;
    const rand = this.rng();
    let archetype = 'REGULAR';

    if (lvl) {
      // Guided Story Level archetype distribution
      if (lvl.hasSpeedster && lvl.hasArmored) {
        if (rand < 0.38) archetype = 'SPEEDSTER';
        else if (rand < 0.72) archetype = 'ARMORED';
        else archetype = 'REGULAR';
      } else if (lvl.hasSpeedster) {
        archetype = rand < 0.40 ? 'SPEEDSTER' : 'REGULAR';
      } else if (lvl.hasArmored) {
        archetype = rand < 0.40 ? 'ARMORED' : 'REGULAR';
      } else {
        archetype = 'REGULAR';
      }
    } else {
      // Endless Mode scaling
      if (W === 1) {
        archetype = 'REGULAR';
      } else if (W === 2) {
        archetype = rand < 0.30 ? 'SPEEDSTER' : 'REGULAR';
      } else if (W <= 4) {
        if (rand < 0.35) archetype = 'SPEEDSTER';
        else if (rand < 0.60) archetype = 'ARMORED';
        else archetype = 'REGULAR';
      } else {
        if (rand < 0.40) archetype = 'SPEEDSTER';
        else if (rand < 0.75) archetype = 'ARMORED';
        else archetype = 'REGULAR';
      }
    }

    // Available rune pool
    const mod = this.modifier;
    const restricted = !!(mod && mod.runes);
    const pool = restricted
      ? [...mod.runes]
      : ((lvl && lvl.allowedRunes) ? lvl.allowedRunes : ['horizontal', 'vertical', 'caret', 'v_shape']);
    if (!restricted && !lvl && W >= 2) pool.push('lightning');

    // Guided Level 1 Tutorial: Ghost 1 is Horizontal [ — ], Ghost 2 is Vertical [ | ]
    if (this.currentLevelIndex === 1 && this.gameMode === 'STORY') {
      if (this.enemiesSpawnedInWave === 1) {
        return {
          archetype: 'REGULAR',
          symbolQueue: ['horizontal'],
          isHeartGhost: false,
          speedMultiplier: 0.75
        };
      } else if (this.enemiesSpawnedInWave === 2) {
        return {
          archetype: 'REGULAR',
          symbolQueue: ['vertical'],
          isHeartGhost: false,
          speedMultiplier: 0.80
        };
      }
    }

    const symbolQueue = [];
    let count = 1;

    if (archetype === 'REGULAR') {
      if (this.currentLevelIndex === 1) {
        count = (this.enemiesSpawnedInWave > 4 && this.rng() < 0.40) ? 2 : 1;
      } else if (this.currentLevelIndex === 2) {
        count = this.rng() < 0.65 ? 2 : 1;
      } else if (this.currentLevelIndex === 3) {
        count = this.rng() < 0.45 ? 3 : 2;
      } else if (this.currentLevelIndex >= 4) {
        count = this.rng() < 0.50 ? 4 : 3;
      } else {
        count = Math.min(4, Math.floor(this.rng() * 2) + Math.min(3, Math.floor(W * 0.3) + 1));
      }
    } else if (archetype === 'SPEEDSTER') {
      if (this.currentLevelIndex <= 2) {
        count = this.rng() < 0.30 ? 2 : 1;
      } else if (this.currentLevelIndex === 3) {
        count = this.rng() < 0.55 ? 2 : 1;
      } else {
        count = this.rng() < 0.40 ? 3 : 2;
      }
    } else if (archetype === 'ARMORED') {
      if (this.currentLevelIndex <= 3) {
        count = Math.floor(this.rng() * 2) + 4; // 4 or 5
      } else {
        count = Math.floor(this.rng() * 2) + 5; // 5 or 6
      }
    }

    for (let i = 0; i < count; i++) {
      const rune = pool[Math.floor(this.rng() * pool.length)];
      symbolQueue.push(rune);
    }

    // Tactical Power-Up Ghosts: Heart (❤️), Freeze (❄️), Blast/Pushback (🌀)
    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.NORMAL;
    const heartMult = diffConfig.heartMult ?? 1.0;
    const freezeMult = diffConfig.freezeMult ?? 1.0;
    const blastMult = diffConfig.blastMult ?? 1.0;

    // Much more generous heart spawn rate:
    // When critical (<=2 HP): ~24%
    // When wounded (<5 HP): ~15%
    // When full health (5 HP): ~8%
    // A daily twist can remove healing ghosts, or restrict the run to a few gestures (no tactical ghosts then,
    // since their hearts / circles / spirals would break the restriction)
    const heartChance = (mod && (mod.noHearts || restricted)) ? 0 : (playerHp <= 2 ? 0.24 : (playerHp < 5 ? 0.15 : 0.08)) * heartMult;

    // Freeze ghost: slows or completely freezes all ghosts on screen
    const canSpawnTactical = !restricted && (this.gameMode === 'ENDLESS' || this.currentLevelIndex >= 2 || this.enemiesSpawnedInWave >= 4);
    const freezeChance = canSpawnTactical ? 0.12 * freezeMult : 0;

    // Blast ghost: knocks back and pushes all ghosts far away from Momo
    const blastChance = canSpawnTactical ? 0.12 * blastMult : 0;

    const roll = this.rng();
    let isHeartGhost = false;
    let isFreezeGhost = false;
    let isBlastGhost = false;

    if (roll < heartChance) {
      isHeartGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('heart');
    } else if (roll < heartChance + freezeChance) {
      isFreezeGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('circle');
    } else if (roll < heartChance + freezeChance + blastChance) {
      isBlastGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('spiral');
    }

    return {
      archetype: isHeartGhost ? 'REGULAR' : (isFreezeGhost ? 'FREEZE' : (isBlastGhost ? 'BLAST' : archetype)),
      symbolQueue,
      isHeartGhost,
      isFreezeGhost,
      isBlastGhost,
      speedMultiplier: isHeartGhost ? 0 : (isFreezeGhost ? 0.40 : (isBlastGhost ? 0.45 : this.speedMultiplier * this.eventSpeedScale))
    };
  }

  /**
   * Generate small minion ghost config while Boss is active on battlefield
   * @param {number} playerHp 
   */
  _generateBossMinionConfig(playerHp) {
    const lvl = this.levelData;
    const pool = (lvl && lvl.allowedRunes) ? lvl.allowedRunes : ['horizontal', 'vertical', 'caret', 'v_shape'];
    const rand = this.rng();

    let archetype = 'REGULAR';
    if (lvl) {
      if (lvl.hasSpeedster && rand < 0.38) {
        archetype = 'SPEEDSTER';
      } else if (lvl.hasArmored && rand > 0.68) {
        archetype = 'ARMORED';
      }
    }

    const symbolQueue = [];
    let count = 1;
    if (archetype === 'ARMORED') {
      count = Math.floor(this.rng() * 2) + 4;
    } else if (this.currentLevelIndex >= 4) {
      count = this.rng() < 0.60 ? 3 : 2;
    } else if (this.currentLevelIndex >= 2) {
      count = this.rng() < 0.55 ? 2 : 1;
    } else {
      count = 1;
    }

    for (let i = 0; i < count; i++) {
      const rune = pool[Math.floor(this.rng() * pool.length)];
      symbolQueue.push(rune);
    }

    // Emergency healing Heart, Freeze, or Blast Ghost during Boss battles
    const diffConfig = DIFFICULTY_LEVELS[this.difficulty] || DIFFICULTY_LEVELS.NORMAL;
    const heartMult = diffConfig.heartMult ?? 1.0;
    const freezeMult = diffConfig.freezeMult ?? 1.0;
    const blastMult = diffConfig.blastMult ?? 1.0;

    const heartChance = (playerHp <= 2 ? 0.22 : (playerHp < 5 ? 0.14 : 0.08)) * heartMult;
    const freezeChance = 0.11 * freezeMult;
    const blastChance = 0.11 * blastMult;

    const roll = this.rng();
    let isHeartGhost = false;
    let isFreezeGhost = false;
    let isBlastGhost = false;

    if (roll < heartChance) {
      isHeartGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('heart');
    } else if (roll < heartChance + freezeChance) {
      isFreezeGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('circle');
    } else if (roll < heartChance + freezeChance + blastChance) {
      isBlastGhost = true;
      symbolQueue.length = 0;
      symbolQueue.push('spiral');
    }

    return {
      archetype: isHeartGhost ? 'REGULAR' : (isFreezeGhost ? 'FREEZE' : (isBlastGhost ? 'BLAST' : archetype)),
      symbolQueue,
      isHeartGhost,
      isFreezeGhost,
      isBlastGhost,
      isBoss: false,
      speedMultiplier: isHeartGhost ? 0 : (isFreezeGhost ? 0.40 : (isBlastGhost ? 0.45 : this.speedMultiplier * 0.98 * this.eventSpeedScale))
    };
  }
}
