/**
 * @file test-difficulty-scaling.js
 * @description Comprehensive automated verification for Enhanced Game Difficulty,
 * Simultaneous Ghost Squad Spawning, Danger Surge, and 5-Level Escalation.
 */

import { DIFFICULTY_LEVELS, LEVEL_CONFIGS, ENEMY_TYPES } from './src/core/Constants.js';
import { WaveSystem } from './src/systems/WaveSystem.js';
import { Enemy } from './src/entities/Enemy.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('🧪 Starting Enhanced Game Difficulty & Squad Swarm Verification Tests...\n');

// -------------------------------------------------------------------------
// 1. DIFFICULTY MODES CONFIGURATION
// -------------------------------------------------------------------------
console.log('--- 1. Testing Difficulty Modes (NORMAL, HARDCORE, INFERNO) ---');
assert(DIFFICULTY_LEVELS.NORMAL !== undefined, 'NORMAL difficulty mode exists');
assert(DIFFICULTY_LEVELS.HARDCORE !== undefined, 'HARDCORE difficulty mode exists');
assert(DIFFICULTY_LEVELS.INFERNO !== undefined, 'INFERNO difficulty mode exists');

assert(DIFFICULTY_LEVELS.NORMAL.speedMult >= 1.0, 'Normal speed multiplier is active (>= 1.0)');
assert(DIFFICULTY_LEVELS.HARDCORE.speedMult > DIFFICULTY_LEVELS.NORMAL.speedMult, 'Hardcore is faster than Normal');
assert(DIFFICULTY_LEVELS.INFERNO.speedMult > DIFFICULTY_LEVELS.HARDCORE.speedMult, 'Inferno is faster than Hardcore');

assert(DIFFICULTY_LEVELS.NORMAL.spawnIntervalMult <= 1.0, 'Normal spawn interval is brisk');
assert(DIFFICULTY_LEVELS.HARDCORE.spawnIntervalMult < DIFFICULTY_LEVELS.NORMAL.spawnIntervalMult, 'Hardcore spawns faster than Normal');
assert(DIFFICULTY_LEVELS.INFERNO.spawnIntervalMult < DIFFICULTY_LEVELS.HARDCORE.spawnIntervalMult, 'Inferno spawns fastest');

assert(DIFFICULTY_LEVELS.INFERNO.squadBonus === 2, 'Inferno grants +2 squad member bonus');
assert(DIFFICULTY_LEVELS.HARDCORE.squadBonus === 1, 'Hardcore grants +1 squad member bonus');

// -------------------------------------------------------------------------
// 2. ESCALATING LEVEL CONFIGURATIONS (LEVELS 1 TO 5)
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Difficulty Escalation Across Stages 1 to 5 ---');
assert(LEVEL_CONFIGS[0].speedMultiplier < LEVEL_CONFIGS[1].speedMultiplier, 'Level 2 speed is higher than Level 1');
assert(LEVEL_CONFIGS[1].speedMultiplier < LEVEL_CONFIGS[2].speedMultiplier, 'Level 3 speed is higher than Level 2');
assert(LEVEL_CONFIGS[2].speedMultiplier < LEVEL_CONFIGS[3].speedMultiplier, 'Level 4 speed is higher than Level 3');
assert(LEVEL_CONFIGS[3].speedMultiplier < LEVEL_CONFIGS[4].speedMultiplier, 'Level 5 (Lord Umbra) has highest speed multiplier');

assert(LEVEL_CONFIGS[0].baseSpawnInterval > LEVEL_CONFIGS[1].baseSpawnInterval, 'Level 2 spawns faster than Level 1');
assert(LEVEL_CONFIGS[1].baseSpawnInterval > LEVEL_CONFIGS[2].baseSpawnInterval, 'Level 3 spawns faster than Level 2');
assert(LEVEL_CONFIGS[2].baseSpawnInterval > LEVEL_CONFIGS[3].baseSpawnInterval, 'Level 4 spawns faster than Level 3');
assert(LEVEL_CONFIGS[4].baseSpawnInterval <= 0.65, 'Level 5 has rapid 0.65s spawn cadence');

// -------------------------------------------------------------------------
// 3. SIMULTANEOUS SQUAD SPAWNING PER LEVEL
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing Simultaneous Ghost Squad Spawning ---');
const waveSys = new WaveSystem();

// Level 2: Expect squads of 2 or 3 ghosts appearing together
waveSys.initLevel(2);
let level2SquadsDetected = 0;
for (let i = 0; i < 15; i++) {
  waveSys.spawnTimer = 0;
  const res = waveSys.update(0.1, 5, 0);
  if (Array.isArray(res) && res.length >= 2) {
    level2SquadsDetected++;
  }
}
assert(level2SquadsDetected > 0, `Level 2 spawns simultaneous ghost squads (detected ${level2SquadsDetected} squads)`);

// Level 3: Expect squads of 2 to 4 ghosts
waveSys.initLevel(3);
let level3SquadsDetected = 0;
let maxLevel3Squad = 0;
for (let i = 0; i < 20; i++) {
  waveSys.spawnTimer = 0;
  const res = waveSys.update(0.1, 5, 0);
  if (Array.isArray(res)) {
    level3SquadsDetected++;
    maxLevel3Squad = Math.max(maxLevel3Squad, res.length);
  }
}
assert(level3SquadsDetected > 0, `Level 3 spawns squads (detected ${level3SquadsDetected} squads)`);
assert(maxLevel3Squad >= 3, `Level 3 squads reach sizes of ${maxLevel3Squad} simultaneous ghosts`);

// Level 4: Expect large ambushes of 3 to 5 ghosts
waveSys.initLevel(4);
let maxLevel4Squad = 0;
for (let i = 0; i < 25; i++) {
  waveSys.spawnTimer = 0;
  const res = waveSys.update(0.1, 5, 0);
  if (Array.isArray(res)) {
    maxLevel4Squad = Math.max(maxLevel4Squad, res.length);
  }
}
assert(maxLevel4Squad >= 4, `Level 4 ambushes reach sizes of ${maxLevel4Squad} simultaneous ghosts`);

// Level 5: Boss Minion swarms
waveSys.initLevel(5);
// First update returns Boss
const bossSpawn = waveSys.update(0.1, 5, 0);
assert(bossSpawn && bossSpawn.isBoss === true, 'Level 5 immediately deploys Boss Lord Umbra');

// Subsequent updates while Boss lives spawn squads of minions
waveSys.bossMinionSpawnTimer = 0;
let bossSquadCount = 0;
for (let i = 0; i < 10; i++) {
  waveSys.bossMinionSpawnTimer = 0;
  const minionSpawn = waveSys.update(0.1, 5, 1);
  if (Array.isArray(minionSpawn) && minionSpawn.length >= 2) {
    bossSquadCount++;
  }
}
assert(bossSquadCount > 0, `Lord Umbra battle spawns squads of minions simultaneously (${bossSquadCount} squads)`);

// -------------------------------------------------------------------------
// 4. MULTI-EDGE SQUAD EDGE POSITIONING
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing Multi-Edge Squad Positioning (Encircling Momo) ---');
for (const squadSize of [2, 3, 4, 5]) {
  const positions = Enemy.getSquadEdgePositions(squadSize, 1280, 720);
  assert(positions.length === squadSize, `Generated ${squadSize} positions for squad of ${squadSize}`);
  for (const pos of positions) {
    const isAtEdge = pos.x < 0 || pos.x > 1280 || pos.y < 0 || pos.y > 720;
    assert(isAtEdge, `Position (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}) is outside screen border`);
  }
}

// -------------------------------------------------------------------------
// 5. DANGER SURGE / ENRAGE RUSH MECHANIC
// -------------------------------------------------------------------------
console.log('\n--- 5. Testing Danger Surge Acceleration Close to Momo ---');
const ghostFar = new Enemy({
  type: 'REGULAR',
  x: 500,
  y: 500
});
ghostFar.update(0.1, { x: 500, y: 1000 }); // 500px away
assert(ghostFar.isCloseDanger === false, 'Ghost at 500px distance is not in danger surge');

const ghostNear = new Enemy({
  type: 'REGULAR',
  x: 500,
  y: 900
});
ghostNear.update(0.1, { x: 500, y: 1000 }); // 100px away (<175px)
assert(ghostNear.isCloseDanger === true, 'Ghost at 100px distance enters danger surge rush');

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Difficulty Tests: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
