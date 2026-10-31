/**
 * @file WaveSystem.js
 * @description Wave progression, enemy spawning interval, difficulty scaling, and archetype selection.
 */

import { RUNES } from '../core/Constants.js';

export class WaveSystem {
  constructor() {
    this.currentWave = 1;
    this.enemiesSpawnedInWave = 0;
    this.totalEnemiesInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 2.4;
    this.speedMultiplier = 1.0;
    this.intermissionTimer = 0;
    this.isIntermission = false;

    this.onWaveStart = null;
    this.onWaveComplete = null;

    this.initWave(1);
  }

  reset() {
    this.currentWave = 1;
    this.initWave(1);
  }

  /**
   * Initialize a new wave's parameters based on GDD formulas
   * @param {number} waveNum 
   */
  initWave(waveNum) {
    this.currentWave = waveNum;
    this.enemiesSpawnedInWave = 0;

    // Total enemies formula: floor(8 + 4 * W^1.18)
    this.totalEnemiesInWave = Math.floor(8 + 4 * Math.pow(waveNum, 1.18));

    // Spawn interval formula: max(0.65, 2.6 * exp(-0.09 * (W - 1)))
    this.spawnInterval = Math.max(0.65, 2.6 * Math.exp(-0.09 * (waveNum - 1)));

    // Speed multiplier: min(1.75, 1.0 + 0.05 * (W - 1))
    this.speedMultiplier = Math.min(1.75, 1.0 + 0.05 * (waveNum - 1));

    this.spawnTimer = 1.0; // small initial breath before first spawn
    this.isIntermission = false;
    this.intermissionTimer = 0;

    if (this.onWaveStart) {
      this.onWaveStart(this.currentWave, this.totalEnemiesInWave);
    }
  }

  /**
   * Check if an enemy is ready to be spawned
   * @param {number} dt 
   * @param {number} playerHp 
   * @param {number} livingEnemiesCount 
   * @returns {{ archetype: string, symbolQueue: string[], speedMultiplier: number } | null}
   */
  update(dt, playerHp, livingEnemiesCount) {
    // Intermission between waves
    if (this.isIntermission) {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.initWave(this.currentWave + 1);
      }
      return null;
    }

    // Check if wave finished
    if (this.enemiesSpawnedInWave >= this.totalEnemiesInWave && livingEnemiesCount === 0) {
      this.isIntermission = true;
      this.intermissionTimer = 2.5;
      if (this.onWaveComplete) {
        this.onWaveComplete(this.currentWave);
      }
      return null;
    }

    // Spawning timer
    if (this.enemiesSpawnedInWave < this.totalEnemiesInWave) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        // Dynamic interval reduction if player HP is low
        let interval = this.spawnInterval;
        if (playerHp <= 2) {
          interval *= 1.15; // slightly slower spawn when critical
        }
        this.spawnTimer = interval;
        this.enemiesSpawnedInWave++;

        return this._generateEnemyConfig(playerHp);
      }
    }

    return null;
  }

  /**
   * Generate archetype and random rune sequence for spawned enemy
   * @param {number} playerHp 
   * @returns {{ archetype: string, symbolQueue: string[], speedMultiplier: number }}
   */
  _generateEnemyConfig(playerHp) {
    const W = this.currentWave;
    const rand = Math.random();
    let archetype = 'REGULAR';

    if (W === 1) {
      archetype = 'REGULAR';
    } else if (W === 2) {
      archetype = rand < 0.2 ? 'SPEEDSTER' : 'REGULAR';
    } else if (W <= 4) {
      if (rand < 0.25) archetype = 'SPEEDSTER';
      else if (rand < 0.38) archetype = 'ARMORED';
      else archetype = 'REGULAR';
    } else {
      // Wave 5+ has Boss climaxes!
      if (this.enemiesSpawnedInWave === this.totalEnemiesInWave || (W % 5 === 0 && rand < 0.2)) {
        archetype = 'BOSS';
      } else if (rand < 0.30) {
        archetype = 'SPEEDSTER';
      } else if (rand < 0.55) {
        archetype = 'ARMORED';
      } else {
        archetype = 'REGULAR';
      }
    }

    // Available standard symbols
    const basicPool = ['horizontal', 'vertical', 'caret', 'v_shape'];
    if (W >= 2) basicPool.push('lightning');

    const symbolQueue = [];
    let count = 1;

    if (archetype === 'REGULAR') {
      count = (W >= 3 && Math.random() < 0.45) ? 2 : 1;
    } else if (archetype === 'SPEEDSTER') {
      count = 1;
    } else if (archetype === 'ARMORED') {
      count = Math.min(4, Math.floor(Math.random() * 2) + 3); // 3 or 4
    } else if (archetype === 'BOSS') {
      count = Math.min(6, Math.floor(Math.random() * 2) + 4); // 4 or 5
    }

    for (let i = 0; i < count; i++) {
      const rune = basicPool[Math.floor(Math.random() * basicPool.length)];
      symbolQueue.push(rune);
    }

    // Chance to inject Heart (❤️) if player is wounded
    const heartChance = playerHp < 5 ? (playerHp <= 2 ? 0.22 : 0.08) : 0;
    if (Math.random() < heartChance) {
      // Add or replace last symbol with heart
      symbolQueue[symbolQueue.length - 1] = 'heart';
    }

    return {
      archetype,
      symbolQueue,
      speedMultiplier: this.speedMultiplier
    };
  }
}
