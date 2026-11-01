/**
 * @file WaveSystem.js
 * @description Manages 5 progressive story levels matching Google Doodle Halloween 2016,
 * culminating in unique Boss Battles (Librarian, Chef, Planetarium, Coach, Master Boss),
 * with fallback to Endless Mode defense after victory.
 */

import { RUNES, LEVEL_CONFIGS, ENEMY_TYPES } from '../core/Constants.js';

export class WaveSystem {
  constructor() {
    this.gameMode = 'STORY'; // 'STORY' | 'ENDLESS'
    this.currentLevelIndex = 1;
    this.currentWave = 1; // Alias for backward compatibility
    this.levelData = LEVEL_CONFIGS[0];

    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.speedMultiplier = 1.0;
    this.intermissionTimer = 0;
    this.isIntermission = false;

    // Boss state tracking
    this.isBossSpawned = false;
    this.isBossDefeated = false;
    this.bossMinionSpawnTimer = 0;

    // Event hooks
    this.onWaveStart = null;
    this.onWaveComplete = null;
    this.onLevelStart = null;
    this.onLevelComplete = null;
    this.onBossSpawn = null;
    this.onGameVictory = null;

    this.initLevel(1);
  }

  reset() {
    this.gameMode = 'STORY';
    this.currentLevelIndex = 1;
    this.currentWave = 1;
    this.initLevel(1);
  }

  setMode(mode = 'STORY') {
    this.gameMode = mode;
    this.reset();
  }

  /**
   * Initialize a level (1..5) or endless wave
   * @param {number} levelNum 
   */
  initLevel(levelNum) {
    this.currentLevelIndex = levelNum;
    this.currentWave = levelNum; // Keep in sync for compatibility
    this.enemiesSpawnedInWave = 0;
    this.isBossSpawned = false;
    this.isBossDefeated = false;
    this.bossMinionSpawnTimer = 0;
    this.isIntermission = false;
    this.intermissionTimer = 0;

    if (levelNum <= 5 && this.gameMode === 'STORY') {
      // 5-Level Story Campaign
      this.levelData = LEVEL_CONFIGS[levelNum - 1];
      this.totalEnemiesInWave = this.levelData.totalMinions;
      this.spawnInterval = this.levelData.baseSpawnInterval;
      this.speedMultiplier = this.levelData.speedMultiplier;
    } else {
      // Endless Mode: GDD Formula Scaling
      this.levelData = null;
      this.totalEnemiesInWave = Math.floor(8 + 4 * Math.pow(levelNum, 1.18));
      this.spawnInterval = Math.max(0.65, 2.6 * Math.exp(-0.09 * (levelNum - 1)));
      this.speedMultiplier = Math.min(1.75, 1.0 + 0.05 * (levelNum - 1));
    }

    // In Level 5, spawn the giant boss immediately with brief 0.2s dramatic breathing time
    this.spawnTimer = (levelNum === 5 && this.gameMode === 'STORY') ? 0.2 : 1.2;

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
   * Notify that the Level Boss was eliminated
   */
  notifyBossDefeated() {
    if (this.isBossDefeated) return;
    this.isBossDefeated = true;
    this.isIntermission = true;
    // For final level, allow 4.2s for spellbook drop, Momo catching it, and landing cutscene
    this.intermissionTimer = (this.currentLevelIndex === 5 && this.gameMode === 'STORY') ? 4.2 : 2.6;
    if (this.onLevelComplete) {
      this.onLevelComplete(this.currentLevelIndex, this.levelData);
    }
    if (this.onWaveComplete) {
      this.onWaveComplete(this.currentWave);
    }
  }

  /**
   * Update level & wave progression loop
   * @param {number} dt 
   * @param {number} playerHp 
   * @param {number} livingEnemiesCount 
   * @returns {{ archetype: string, symbolQueue: string[], speedMultiplier: number, isBoss?: boolean, isHeartGhost?: boolean } | null}
   */
  update(dt, playerHp, livingEnemiesCount) {
    // 1. Intermission between stages or victory transition
    if (this.isIntermission) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        if (this.gameMode === 'STORY' && this.currentLevelIndex >= 5) {
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

    // 2. Special Level 5 Final Boss Showdown:
    // The Colossal Demon Master Boss is ALWAYS present from the very start, and minions spawn continuously!
    if (this.gameMode === 'STORY' && this.currentLevelIndex === 5 && this.levelData) {
      // Immediate Boss Spawn on level start
      if (!this.isBossSpawned) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.isBossSpawned = true;
          this.isBossDefeated = false;
          this.bossMinionSpawnTimer = 1.2;
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
            speedMultiplier: 0.80
          };
        }
        return null;
      }

      // If Boss was defeated or all enemies cleared
      if (this.isBossSpawned && (this.isBossDefeated || livingEnemiesCount === 0)) {
        this.notifyBossDefeated();
        return null;
      }

      // Continuous swarm of minions while Boss is alive ("các con nhỏ cứ xuất hiện liên tục")
      if (this.isBossSpawned && !this.isBossDefeated) {
        this.bossMinionSpawnTimer -= dt;
        if (this.bossMinionSpawnTimer <= 0) {
          const livingMinions = Math.max(0, livingEnemiesCount - 1);
          const maxMinions = 3;
          if (livingMinions < maxMinions) {
            const interval = Math.max(1.6, 2.2 * (playerHp <= 2 ? 1.2 : 1.0));
            this.bossMinionSpawnTimer = interval;
            return this._generateBossMinionConfig(playerHp);
          } else {
            this.bossMinionSpawnTimer = 0.6;
          }
        }
      }
      return null;
    }

    // 3. Story Mode (Levels 1-4): Minions wave cleared -> Level Boss Battle
    if (this.gameMode === 'STORY' && this.levelData) {
      // If all minions have spawned and died, spawn the Level Boss!
      if (this.enemiesSpawnedInWave >= this.totalEnemiesInWave) {
        if (!this.isBossSpawned && livingEnemiesCount === 0) {
          this.isBossSpawned = true;
          this.isBossDefeated = false;
          this.bossMinionSpawnTimer = 2.2; // Breathing window before first boss minion appears
          if (this.onBossSpawn) {
            this.onBossSpawn(this.levelData.bossType, this.levelData.bossName);
          }
          return {
            archetype: this.levelData.bossType,
            symbolQueue: (this.levelData.bossPhases && this.levelData.bossPhases.length > 0)
              ? [...this.levelData.bossPhases[0]]
              : [...this.levelData.bossSymbols],
            bossPhases: this.levelData.bossPhases ? this.levelData.bossPhases.map(p => [...p]) : null,
            bossLives: this.levelData.bossLives || 3,
            isBoss: true,
            isHeartGhost: false,
            speedMultiplier: 0.85
          };
        }

        // If boss was defeated or living count dropped to 0 after boss was spawned
        if (this.isBossSpawned && (this.isBossDefeated || livingEnemiesCount === 0)) {
          this.notifyBossDefeated();
          return null;
        }

        // WHILE BOSS IS ALIVE: Continue spawning small ghosts ("các con ma nhỏ")!
        if (this.isBossSpawned && !this.isBossDefeated) {
          this.bossMinionSpawnTimer -= dt;
          if (this.bossMinionSpawnTimer <= 0) {
            // livingEnemiesCount includes Boss + minions
            const livingMinions = Math.max(0, livingEnemiesCount - 1);
            const maxMinions = this.currentLevelIndex <= 2 ? 2 : 3;
            if (livingMinions < maxMinions) {
              const baseInterval = this.levelData.baseSpawnInterval || 2.4;
              const interval = Math.max(2.0, baseInterval * 1.35) * (playerHp <= 2 ? 1.2 : 1.0);
              this.bossMinionSpawnTimer = interval;
              return this._generateBossMinionConfig(playerHp);
            } else {
              this.bossMinionSpawnTimer = 0.8; // retry soon once a minion is cleared
            }
          }
        }
      }
    } else {
      // Endless mode completion check
      if (this.enemiesSpawnedInWave >= this.totalEnemiesInWave && livingEnemiesCount === 0) {
        this.isIntermission = true;
        this.intermissionTimer = 2.5;
        if (this.onWaveComplete) {
          this.onWaveComplete(this.currentWave);
        }
        return null;
      }
    }

    // 3. Spawning Minions
    if (this.enemiesSpawnedInWave < this.totalEnemiesInWave) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        let interval = this.spawnInterval;
        if (playerHp <= 2) {
          interval *= 1.15; // slightly slower when critical
        }
        this.spawnTimer = interval;
        this.enemiesSpawnedInWave++;

        return this._generateEnemyConfig(playerHp);
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
    const rand = Math.random();
    let archetype = 'REGULAR';

    if (lvl) {
      // Guided Story Level archetype distribution
      if (lvl.hasSpeedster && rand < 0.28) {
        archetype = 'SPEEDSTER';
      } else if (lvl.hasArmored && rand > 0.72) {
        archetype = 'ARMORED';
      } else {
        archetype = 'REGULAR';
      }
    } else {
      // Endless Mode scaling
      if (W === 1) {
        archetype = 'REGULAR';
      } else if (W === 2) {
        archetype = rand < 0.2 ? 'SPEEDSTER' : 'REGULAR';
      } else if (W <= 4) {
        if (rand < 0.25) archetype = 'SPEEDSTER';
        else if (rand < 0.38) archetype = 'ARMORED';
        else archetype = 'REGULAR';
      } else {
        if (rand < 0.35) archetype = 'SPEEDSTER';
        else if (rand < 0.60) archetype = 'ARMORED';
        else archetype = 'REGULAR';
      }
    }

    // Available rune pool
    const pool = (lvl && lvl.allowedRunes) ? lvl.allowedRunes : ['horizontal', 'vertical', 'caret', 'v_shape'];
    if (!lvl && W >= 2) pool.push('lightning');

    // Guided Level 1 Tutorial: Ghost 1 is Horizontal [ — ], Ghost 2 is Vertical [ | ]
    if (this.currentLevelIndex === 1 && this.gameMode === 'STORY') {
      if (this.enemiesSpawnedInWave === 1) {
        return {
          archetype: 'REGULAR',
          symbolQueue: ['horizontal'],
          isHeartGhost: false,
          speedMultiplier: 0.65
        };
      } else if (this.enemiesSpawnedInWave === 2) {
        return {
          archetype: 'REGULAR',
          symbolQueue: ['vertical'],
          isHeartGhost: false,
          speedMultiplier: 0.70
        };
      }
    }

    const symbolQueue = [];
    let count = 1;

    if (archetype === 'REGULAR') {
      count = (this.currentLevelIndex >= 3 && Math.random() < 0.45) ? 2 : 1;
    } else if (archetype === 'SPEEDSTER') {
      count = 1;
    } else if (archetype === 'ARMORED') {
      count = Math.min(4, Math.floor(Math.random() * 2) + 3); // 3 or 4
    }

    for (let i = 0; i < count; i++) {
      const rune = pool[Math.floor(Math.random() * pool.length)];
      symbolQueue.push(rune);
    }

    // Chance to spawn special Heart Ghost (❤️)
    const heartChance = playerHp < 5 ? (playerHp <= 2 ? 0.28 : 0.16) : 0.08;
    const isHeartGhost = Math.random() < heartChance;
    if (isHeartGhost) {
      symbolQueue.length = 0;
      symbolQueue.push('heart');
    }

    return {
      archetype: isHeartGhost ? 'REGULAR' : archetype,
      symbolQueue,
      isHeartGhost,
      speedMultiplier: isHeartGhost ? 0 : this.speedMultiplier
    };
  }

  /**
   * Generate small minion ghost config while Boss is active on battlefield
   * @param {number} playerHp 
   */
  _generateBossMinionConfig(playerHp) {
    const lvl = this.levelData;
    const pool = (lvl && lvl.allowedRunes) ? lvl.allowedRunes : ['horizontal', 'vertical', 'caret', 'v_shape'];
    const rand = Math.random();

    let archetype = 'REGULAR';
    if (lvl) {
      if (lvl.hasSpeedster && rand < 0.22) {
        archetype = 'SPEEDSTER';
      } else if (lvl.hasArmored && rand > 0.80) {
        archetype = 'ARMORED';
      }
    }

    // Minions during boss fight have 1 symbol (or occasionally 2 in later levels)
    // so player can defeat them fluidly while coordinating against the Boss
    const symbolQueue = [];
    const count = (this.currentLevelIndex >= 4 && Math.random() < 0.35 && archetype !== 'SPEEDSTER') ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const rune = pool[Math.floor(Math.random() * pool.length)];
      symbolQueue.push(rune);
    }

    // Small chance to spawn emergency healing Heart Ghost if player is hurting
    const heartChance = playerHp <= 2 ? 0.28 : (playerHp < 5 ? 0.12 : 0.04);
    const isHeartGhost = Math.random() < heartChance;
    if (isHeartGhost) {
      symbolQueue.length = 0;
      symbolQueue.push('heart');
    }

    return {
      archetype: isHeartGhost ? 'REGULAR' : archetype,
      symbolQueue,
      isHeartGhost,
      isBoss: false,
      speedMultiplier: isHeartGhost ? 0 : this.speedMultiplier * 0.92
    };
  }
}

