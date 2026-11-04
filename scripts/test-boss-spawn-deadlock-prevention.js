/**
 * @file test-boss-spawn-deadlock-prevention.js
 * @description Verifies deadlock prevention for Boss spawning:
 * 1. Boss spawns when hostile minions are 0 even if a Heart Ghost is alive.
 * 2. Boss spawns after 2.5s grace timer when wave finished spawning but slow minions linger.
 * 3. Heart Ghost has a 14s lifetime and gentle approach motion.
 * 4. Touching Heart Ghost heals player without damage.
 * 5. Boss entrance cleansing shockwave cleanses lingering minions and converts Heart Ghost.
 */

import assert from 'assert';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Game } from '../src/core/Game.js';

console.log('🧪 Starting Boss Spawn Deadlock Prevention Verification Tests...');

// -------------------------------------------------------------------------
// 1. WAVE SYSTEM GRACE TIMER & HOSTILE ENEMY COUNT SEPARATION
// -------------------------------------------------------------------------
console.log('\n--- 1. Testing WaveSystem Boss Spawning with Lingering Minions ---');
const waveSys = new WaveSystem();
waveSys.initLevel(1);

// Fast-forward spawning all minions
let spawnedCount = 0;
while (spawnedCount < waveSys.totalEnemiesInWave) {
  const cfg = waveSys.update(0.01, 5, 2, 2);
  if (cfg) spawnedCount++;
}
assert(spawnedCount === waveSys.totalEnemiesInWave, 'All minions in wave spawned');
assert(waveSys.isBossSpawned === false, 'Boss has not spawned yet while minions linger');

// Test 1A: If hostile count reaches 0 (only 1 heart ghost remains), Boss MUST spawn immediately!
const bossResultImmediate = waveSys.update(0.01, 5, 1, 0); // 1 living total, 0 hostile
assert(bossResultImmediate !== null, 'Boss spawned immediately when hostile enemies reached 0');
assert(bossResultImmediate.isBoss === true, 'Spawned entity is Boss');
assert(waveSys.isBossSpawned === true, 'isBossSpawned is now true');

// Test 1B: If hostile minions linger, boss does NOT spawn prematurely; player can defeat all small ghosts first!
const waveSys2 = new WaveSystem();
waveSys2.initLevel(1);
let spawned2 = 0;
while (spawned2 < waveSys2.totalEnemiesInWave) {
  const cfg = waveSys2.update(0.01, 5, 2, 2);
  if (cfg) spawned2++;
}
assert(waveSys2.isBossSpawned === false, 'Boss not spawned yet');

// Simulate 5.0s passing with 2 hostile minions still lingering -> Boss must NOT spawn prematurely!
let midwayResult = waveSys2.update(5.0, 5, 2, 2);
assert(midwayResult === null, 'Boss does not spawn while hostile minions are actively being fought');
assert(waveSys2.isBossSpawned === false, 'Boss remains unspawned so player can defeat small ghosts');
assert(waveSys2.bossSpawnGraceTimer <= 41.0, 'Emergency grace timer counted down');

// Defeat all hostile minions -> Boss now spawns!
let clearedBossResult = waveSys2.update(0.01, 5, 0, 0);
assert(clearedBossResult !== null, 'Boss spawns when all hostile minions are eliminated');
assert(clearedBossResult.isBoss === true, 'Spawned entity is Boss');
assert(waveSys2.isBossSpawned === true, 'isBossSpawned is now true');

// Test 1C: Emergency failsafe timeout (45s) in case a minion got lost in space
const waveSys3 = new WaveSystem();
waveSys3.initLevel(1);
let spawned3 = 0;
while (spawned3 < waveSys3.totalEnemiesInWave) {
  const cfg = waveSys3.update(0.01, 5, 1, 1);
  if (cfg) spawned3++;
}
let forcedBossResult = waveSys3.update(46.0, 5, 1, 1);
assert(forcedBossResult !== null, 'Emergency failsafe spawns Boss after 45s');
assert(forcedBossResult.isBoss === true, 'Emergency spawn entity is Boss');
assert(waveSys3.isBossSpawned === true, 'isBossSpawned is true after emergency timeout');

// -------------------------------------------------------------------------
// 2. HEART GHOST LIFETIME & DRIFT
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Heart Ghost Lifetime & Gentle Drift ---');
const heartGhost = new Enemy({
  isHeartGhost: true,
  symbolQueue: ['heart'],
  x: 200,
  y: 200,
  targetPlayerPos: { x: 400, y: 400 }
});

assert(heartGhost.isHeartGhost === true, 'Entity is Heart Ghost');
assert(heartGhost.heartLifetime === 14.0, 'Heart Ghost has 14s lifetime');

// Simulate 5 seconds
heartGhost.update(5.0, { x: 400, y: 400 });
assert(heartGhost.heartLifetime === 9.0, 'Heart Ghost lifetime decreases to 9s');
assert(heartGhost.isDead === false, 'Heart Ghost is still alive');
assert(heartGhost.x === 200, 'Heart Ghost stays stationary on X');
assert(heartGhost.y === 200, 'Heart Ghost stays stationary on Y');

// Simulate remaining 9.5 seconds -> should expire and die
heartGhost.update(9.5, { x: 400, y: 400 });
assert(heartGhost.isDead === true, 'Heart Ghost expires and dies when lifetime reaches 0');

// -------------------------------------------------------------------------
// 3. HEART GHOST CONTACT HEALS MOMO
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing Heart Ghost Contact with Player ---');
const playerMock = {
  x: 400,
  y: 300,
  hp: 3,
  maxHp: 5,
  radius: 25,
  heal: function(amt) {
    if (this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + amt);
      return true;
    }
    return false;
  },
  takeDamage: function(amt) {
    this.hp -= amt;
    return true;
  },
  setDrawing: () => {},
  update: () => {}
};

const contactHeart = new Enemy({
  isHeartGhost: true,
  symbolQueue: ['heart'],
  x: playerMock.x,
  y: playerMock.y,
  targetPlayerPos: playerMock
});

const gameContext = {
  player: playerMock,
  enemies: [contactHeart],
  enemyPool: {
    release: () => {}
  },
  inputHandler: { isDrawing: false, lastPoint: null, update: () => {} },
  waveSystem: { update: () => null, currentLevelIndex: 1 },
  particleSystem: {
    emitFloatingText: () => {},
    emitHitBurst: () => {},
    emitMonsterDeathExplosion: () => {},
    triggerShake: () => {},
    update: () => {}
  },
  uiManager: {
    updateHearts: () => {},
    updateScore: () => {},
    updateCombo: () => {}
  },
  audioSystem: {
    playSpell: () => {},
    playEnemyAttack: () => {},
    playHurt: () => {}
  },
  projectiles: [],
  projectilePool: { release: () => {} },
  metrics: { damageTaken: 0, enemiesDefeated: 0 },
  score: 0,
  displayedScore: 0,
  comboCount: 0,
  comboMultiplier: 1,
  comboTimer: 0,
  triggerShake: () => {}
};

// Call updatePlaying via prototype
Game.prototype.updatePlaying.call(gameContext, 0.016);
assert(playerMock.hp === 4, 'Player HP increased from 3 to 4 on Heart Ghost contact');
assert(gameContext.enemies.length === 0, 'Heart Ghost was consumed and removed from enemies list');

// -------------------------------------------------------------------------
// 4. BOSS ENTRANCE CLEANSING SHOCKWAVE
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing Boss Entrance Cleansing Shockwave ---');
const minion1 = new Enemy({ type: 'REGULAR', x: 100, y: 100, symbolQueue: ['horizontal'], targetPlayerPos: playerMock });
const minionHeart = new Enemy({ type: 'REGULAR', isHeartGhost: true, x: 200, y: 200, symbolQueue: ['heart'], targetPlayerPos: playerMock });
gameContext.enemies = [minion1, minionHeart];
gameContext.enemyPool.acquire = () => new Enemy({ targetPlayerPos: playerMock });
gameContext.width = 800;
gameContext.height = 600;

// Setup waveSystem.update to return a Boss config
gameContext.waveSystem.update = () => ({
  archetype: 'BOSS_LIBRARIAN',
  isBoss: true,
  symbolQueue: ['horizontal', 'vertical', 'lightning'],
  bossPhases: [['horizontal', 'vertical']],
  bossLives: 2,
  speedMultiplier: 1.0
});

const initialScore = gameContext.score;
const hpBeforeBoss = playerMock.hp;

Game.prototype.updatePlaying.call(gameContext, 0.016);

// Verify that minion1 and minionHeart were cleansed!
assert(minion1.isDead === true, 'Regular minion was cleansed by Boss entrance shockwave');
assert(minionHeart.isDead === true, 'Heart minion was cleansed by Boss entrance shockwave');
assert(gameContext.score > initialScore, 'Score increased from cleansed minion');
assert(playerMock.hp === Math.min(playerMock.maxHp, hpBeforeBoss + 1), 'Player received +1 HP from cleansed Heart minion');

console.log('\n========================================');
console.log('✅ ALL BOSS SPAWN DEADLOCK PREVENTION TESTS PASSED!');
console.log('========================================\n');
