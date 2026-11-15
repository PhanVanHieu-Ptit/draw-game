import { CombatSystem } from '../src/combat/CombatSystem.js';
/**
 * @file test-boss-gradual-arrival.js
 * @description Verifies gradual Boss arrival mechanics:
 * 1. Boss never spawns while small ghosts are still alive.
 * 2. Minions spawn at a relaxed, comfortable cadence (1.75s in Level 1).
 * 3. When all minions are defeated, Game shows an immediate warning and a short 1.2s transition.
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
console.log('\n--- 4. Testing Short Warning Buildup in Game Loop ---');
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
  combat: new CombatSystem(),
  _tickCombatFeedback: Game.prototype._tickCombatFeedback,
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
assert(gameContext.bossEntranceWarningTimer > 1.0 && gameContext.bossEntranceWarningTimer <= 1.2, 'Warning holds the boss for at most 1.2s');
assert(gameContext.enemies.length === 0, 'Boss does not drop immediately on frame 0');
assert(bannerShown === true, 'Banner celebrating clearing all minions was displayed');
assert(warningShown === true, 'Boss warning is shown immediately without a delayed callback');

// Keep a short readable warning before the entrance.
Game.prototype.updatePlaying.call(gameContext, 1.0);
assert(gameContext.enemies.length === 0, 'Boss is still held back during dramatic buildup (từ từ)');
assert(gameContext.bossEntranceWarningTimer <= 0.2, 'Timer counts down');

// Finish the 1.2s transition.
Game.prototype.updatePlaying.call(gameContext, 0.2);
assert(gameContext.enemies.length === 1, 'Boss arrives after dramatic buildup completes!');
assert(gameContext.enemies[0].isBoss === true, 'Entity on battlefield is Boss');
console.log('  ✅ PASS: 1.2s warning buildup verified');

// -------------------------------------------------------------------------
// 5. THE BOSS GLIDES INTO VIEW (it used to crawl ~3 s outside the screen after the warning)
// -------------------------------------------------------------------------
console.log('\n--- 5. Testing Level Boss Glides Into View Quickly ---');
{
  const target = { x: 400, y: 300 };
  // Fresh boss, as Game spawns it (the one above already moved during the last test step)
  const boss = new Enemy({ type: 'BOSS_LIBRARIAN', x: 400, y: -75, canvasWidth: 800, canvasHeight: 600, symbolQueue: ['horizontal'], bossLives: 3, speedMultiplier: 0.92, targetPlayerPos: target });
  assert(boss.isEntering === true, 'A level boss spawned above the screen starts its entrance glide');
  assert(boss.y < 0, 'Boss starts above the screen edge');

  let t = 0;
  let firstVisible = null;
  let fullyIn = null;
  while (t < 10 && (fullyIn === null)) {
    boss.update(1 / 60, target);
    t += 1 / 60;
    if (firstVisible === null && boss.y + boss.radius > 0) firstVisible = t;
    if (fullyIn === null && boss.y - boss.radius > 0) fullyIn = t;
  }
  assert(firstVisible !== null && firstVisible < 0.5, `Boss peeks into view within 0.5s (took ${firstVisible && firstVisible.toFixed(2)}s)`);
  assert(fullyIn !== null && fullyIn < 2.0, `Boss is fully on screen within 2s (took ${fullyIn && fullyIn.toFixed(2)}s)`);
  // The glide eases out and hands over to the normal advance shortly after (it must not hang on forever)
  while (t < 10 && boss.isEntering) { boss.update(1 / 60, target); t += 1 / 60; }
  assert(boss.isEntering === false && t < 3, `Glide hands over to the normal advance within 3s (took ${t.toFixed(2)}s)`);

  // After the hand-over it advances at its own (slow) speed, not at glide speed
  const yBefore = boss.y;
  for (let i = 0; i < 60; i++) boss.update(1 / 60, target);
  assert(boss.y - yBefore < boss.speed * 1.2, 'After the glide the boss advances at its normal speed');

  // A boss that recoils must not re-run the entrance
  boss.startBossRetreat(false);
  assert(boss.isEntering === false, 'Retreat cancels the entrance glide');

  // The final boss stands on screen from the start: no glide
  const finalBoss = new Enemy({ type: 'BOSS_MASTER', x: 600, y: 276, canvasWidth: 800, canvasHeight: 600, symbolQueue: ['horizontal'], bossLives: 3, targetPlayerPos: target });
  assert(finalBoss.isEntering === false, 'Final boss has no entrance glide');
  // A ghost that spawned on screen never glides
  const onScreen = new Enemy({ type: 'BOSS_CHEF', x: 400, y: 120, canvasWidth: 800, canvasHeight: 600, symbolQueue: ['horizontal'], bossLives: 3, targetPlayerPos: target });
  assert(onScreen.isEntering === false, 'A boss that starts on screen does not glide');
}
console.log('  ✅ PASS: level boss glides into view quickly');

// Exercise the actual WaveSystem through the game loop, including the final stage and Boss Rush.
console.log('\n--- 6. Testing Boss Timing Through the Game Loop ---');
function makeBossGame(level, rush = false) {
  const waveSystem = new WaveSystem();
  waveSystem.setBossRush(rush);
  waveSystem.initLevel(level);
  waveSystem.enemiesSpawnedInWave = waveSystem.totalEnemiesInWave;
  let warnings = 0;
  return {
    ...gameContext,
    combat: new CombatSystem(),
    waveSystem,
    enemies: [],
    projectiles: [],
    bossEntranceWarningActive: false,
    bossEntranceWarningTimer: 0,
    uiManager: { ...gameContext.uiManager, showBossWarning: () => { warnings++; } },
    get warningCount() { return warnings; }
  };
}

for (let level = 1; level <= 4; level++) {
  const game = makeBossGame(level);
  for (let frame = 0; frame < 71; frame++) {
    Game.prototype.updatePlaying.call(game, 1 / 60);
    assert(!game.enemies.some(e => e.isBoss), `Level ${level} keeps the warning readable`);
  }
  for (let frame = 0; frame < 2; frame++) Game.prototype.updatePlaying.call(game, 1 / 60);
  assert(game.enemies.filter(e => e.isBoss).length === 1, `Level ${level} boss arrives within 1.22s of clearing minions`);
  assert(game.warningCount === 1, `Level ${level} warns exactly once`);
}

const finalGame = makeBossGame(5);
Game.prototype.updatePlaying.call(finalGame, 1 / 60);
assert(finalGame.enemies.some(e => e.type === 'BOSS_MASTER'), 'Final boss appears on the first frame of level 5');
assert(finalGame.warningCount === 0, 'Final boss is not held by a pre-boss warning');

const rushGame = makeBossGame(1, true);
Game.prototype.updatePlaying.call(rushGame, 1 / 60);
assert(rushGame.enemies.some(e => e.isBoss), 'Boss Rush boss appears on the first frame');
assert(rushGame.warningCount === 0, 'Boss Rush has no minion-clear delay');

console.log('\n========================================');
console.log('✅ ALL BOSS GRADUAL ARRIVAL TESTS PASSED!');
console.log('========================================\n');
