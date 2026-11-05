/**
 * @file test-boss-gradual-arrival.js
 * @description Verifies gradual Boss arrival mechanics:
 * 1. Boss never spawns while small ghosts are still alive.
 * 2. Minions spawn at a relaxed, comfortable cadence (1.75s in Level 1).
 * 3. When all minions are defeated, Game enters a dramatic 2.2s transition with warning banner.
 * 4. Boss spawns after the dramatic transition.
 * 5. Boss initial minion spawn timer is relaxed (2.4s) to allow 1v1 focus.
 */

import assert from 'assert';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { LEVEL_CONFIGS } from '../src/core/Constants.js';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';

console.log('🧪 Starting Boss Gradual Arrival & Minion Clear Verification Tests...\n');

// -------------------------------------------------------------------------
// 1. RELAXED SPAWN INTERVAL & CONFIGS
// -------------------------------------------------------------------------
console.log('--- 1. Testing Relaxed Spawn Intervals for Comfortable Pacing ---');
assert(LEVEL_CONFIGS[0].baseSpawnInterval >= 1.70, 'Level 1 has comfortable >= 1.70s spawn interval');
assert(LEVEL_CONFIGS[0].totalMinions === 12, 'Level 1 has 12 minions');
assert(LEVEL_CONFIGS[0].baseSpawnInterval > LEVEL_CONFIGS[1].baseSpawnInterval, 'Level 1 slower than Level 2');
assert(LEVEL_CONFIGS[1].baseSpawnInterval > LEVEL_CONFIGS[2].baseSpawnInterval, 'Level 2 slower than Level 3');
assert(LEVEL_CONFIGS[2].baseSpawnInterval > LEVEL_CONFIGS[3].baseSpawnInterval, 'Level 3 slower than Level 4');
assert(LEVEL_CONFIGS[3].baseSpawnInterval > LEVEL_CONFIGS[4].baseSpawnInterval, 'Level 4 slower than Level 5');
console.log('  ✅ PASS: Level spawn intervals relaxed for unhurried pacing');

// -------------------------------------------------------------------------
// 2. BOSS DOES NOT SPAWN WHILE SMALL GHOSTS LINGER
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Boss Does NOT Spawn While Small Ghosts Are Alive ---');
const waveSys = new WaveSystem();
waveSys.initLevel(1);

// Fast forward spawning all 12 minions
let spawned = 0;
while (spawned < waveSys.totalEnemiesInWave) {
  const cfg = waveSys.update(0.01, 5, 3, 3);
  if (cfg) spawned++;
}
assert(spawned === 12, 'All 12 minions spawned in wave');
assert(waveSys.isBossSpawned === false, 'Boss has NOT spawned yet');

// Simulate 10 seconds of fighting remaining minions (hostileEnemiesCount = 3)
for (let s = 0; s < 10; s++) {
  const cfg = waveSys.update(1.0, 5, 3, 3);
  assert(cfg === null, `Boss does not spawn prematurely at second ${s + 1}`);
  assert(waveSys.isBossSpawned === false, 'Boss remains unspawned while 3 small ghosts are alive');
}
console.log('  ✅ PASS: Boss stays away while small ghosts are still alive');

// -------------------------------------------------------------------------
// 3. BOSS SPAWNS ONLY AFTER ALL HOSTILE MINIONS ARE CLEARED
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing Boss Spawns Once Hostile Minions Reach 0 ---');
// Hostile minions reach 0
const bossCfg = waveSys.update(0.01, 5, 0, 0);
assert(bossCfg !== null, 'Boss config returned when all small ghosts are defeated');
assert(bossCfg.isBoss === true, 'Spawned entity is Boss');
assert(bossCfg.archetype === 'BOSS_LIBRARIAN', 'Level 1 boss is BOSS_LIBRARIAN');
assert(waveSys.isBossSpawned === true, 'isBossSpawned is true');
assert(waveSys.bossMinionSpawnTimer >= 2.2, 'Boss minion spawn timer relaxed to >= 2.2s for 1v1 breathing room');
console.log('  ✅ PASS: Boss spawns after all small ghosts are cleared');

// -------------------------------------------------------------------------
// 4. DRAMATIC TRANSITION BUILDUP IN GAME.JS
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing 2.2s Dramatic Warning Buildup in Game Loop ---');
const playerMock = {
  x: 400,
  y: 300,
  hp: 5,
  maxHp: 5,
  radius: 25,
  setDrawing: () => {},
  update: () => {}
};

let bannerShown = false;
let warningShown = false;

const gameContext = {
  player: playerMock,
  enemies: [],
  enemyPool: {
    acquire: () => new Enemy({ targetPlayerPos: playerMock }),
    release: () => {}
  },
  inputHandler: { isDrawing: false, lastPoint: null, update: () => {} },
  waveSystem: {
    gameMode: 'STORY',
    levelData: LEVEL_CONFIGS[0],
    currentLevelIndex: 1,
    enemiesSpawnedInWave: 12,
    totalEnemiesInWave: 12,
    isBossSpawned: false,
    update: function(dt, hp, living, hostile) {
      if (hostile === 0) {
        this.isBossSpawned = true;
        return {
          archetype: 'BOSS_LIBRARIAN',
          isBoss: true,
          symbolQueue: ['horizontal', 'vertical'],
          bossPhases: [['horizontal', 'vertical']],
          bossLives: 3,
          speedMultiplier: 0.92
        };
      }
      return null;
    }
  },
  particleSystem: {
    emitFloatingText: (txt) => {
      if (txt.includes('ĐÃ QUÉT SẠCH')) bannerShown = true;
    },
    emitHitBurst: () => {},
    emitMonsterDeathExplosion: () => {},
    triggerShake: () => {},
    update: () => {}
  },
  uiManager: {
    updateHearts: () => {},
    updateScore: () => {},
    updateCombo: () => {},
    showBossWarning: () => {
      warningShown = true;
    }
  },
  audioSystem: {
    playCatPurr: () => {},
    soundBossCast: () => {},
    playBossRoar: () => {}
  },
  projectiles: [],
  projectilePool: { release: () => {} },
  // Game.updatePlaying also depends on the run upgrades and long-term progress (added with the meta features)
  upgrades: { enemySpeedScale: 1, scoreMultiplier: 1 },
  progress: { addStat: () => {}, markSeen: () => false, save: () => {} },
  _addScore: Game.prototype._addScore,
  metrics: { damageTaken: 0, enemiesDefeated: 0 },
  score: 0,
  displayedScore: 0,
  comboCount: 0,
  comboMultiplier: 1,
  comboTimer: 0,
  triggerShake: () => {},
  bossEntranceWarningActive: false,
  bossEntranceWarningTimer: 0,
  width: 800,
  height: 600
};

// First frame of all minions cleared
Game.prototype.updatePlaying.call(gameContext, 0.016);
assert(gameContext.bossEntranceWarningActive === true, 'Boss entrance warning activated');
assert(gameContext.bossEntranceWarningTimer > 2.0, 'Dramatic delay timer initialized to ~2.2s');
assert(gameContext.enemies.length === 0, 'Boss does not drop immediately on frame 0');
assert(bannerShown === true, 'Banner celebrating clearing all minions was displayed');

// Advance 1.5 seconds into the 2.2s buildup
Game.prototype.updatePlaying.call(gameContext, 1.5);
assert(gameContext.enemies.length === 0, 'Boss is still held back during dramatic buildup (từ từ)');
assert(gameContext.bossEntranceWarningTimer <= 0.7, 'Timer counts down');

// Advance remaining 0.8 seconds (completing 2.2s buildup)
Game.prototype.updatePlaying.call(gameContext, 0.8);
assert(gameContext.enemies.length === 1, 'Boss arrives after dramatic buildup completes!');
assert(gameContext.enemies[0].isBoss === true, 'Entity on battlefield is Boss');
console.log('  ✅ PASS: 2.2s dramatic warning buildup verified');

console.log('\n========================================');
console.log('✅ ALL BOSS GRADUAL ARRIVAL TESTS PASSED!');
console.log('========================================\n');
