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

    this.spawnTimer = 1.2; // brief breathing time before first ghost

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

    // 2. Story Mode: Minions cleared -> Boss Battle
    if (this.gameMode === 'STORY' && this.levelData) {
      // If all minions have spawned and died, spawn the Level Boss!
      if (this.enemiesSpawnedInWave >= this.totalEnemiesInWave) {
        if (!this.isBossSpawned && livingEnemiesCount === 0) {
          this.isBossSpawned = true;
          if (this.onBossSpawn) {
            this.onBossSpawn(this.levelData.bossType, this.levelData.bossName);
          }
          return {
            archetype: this.levelData.bossType,
            symbolQueue: [...this.levelData.bossSymbols],
            isBoss: true,
            isHeartGhost: false,
            speedMultiplier: 0.85
          };
        }

        // If boss was spawned and now defeated
        if (this.isBossSpawned && livingEnemiesCount === 0) {
          this.isIntermission = true;
          this.intermissionTimer = 2.6;
          if (this.onLevelComplete) {
            this.onLevelComplete(this.currentLevelIndex, this.levelData);
          }
          if (this.onWaveComplete) {
            this.onWaveComplete(this.currentWave);
          }
          return null;
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
}
