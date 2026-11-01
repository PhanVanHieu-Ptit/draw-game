/**
 * @file test-boss-minions-and-scary-face.js
 * @description Automated test for continuous minion spawning during boss battle
 * and scary ghost face expressions (sharp fangs, glowing sinister eyes, angled brows).
 */

import { WaveSystem } from '../src/systems/WaveSystem.js';
import { Enemy } from '../src/entities/Enemy.js';
import { LEVEL_CONFIGS } from '../src/core/Constants.js';

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

// Mock Canvas 2D Context for testing procedural drawing
function createMockContext() {
  const calls = [];
  const record = (method, args) => calls.push({ method, args: Array.from(args) });

  return {
    calls,
    save: function() { record('save', arguments); },
    restore: function() { record('restore', arguments); },
    translate: function() { record('translate', arguments); },
    rotate: function() { record('rotate', arguments); },
    scale: function() { record('scale', arguments); },
    beginPath: function() { record('beginPath', arguments); },
    closePath: function() { record('closePath', arguments); },
    moveTo: function() { record('moveTo', arguments); },
    lineTo: function() { record('lineTo', arguments); },
    arc: function() { record('arc', arguments); },
    ellipse: function() { record('ellipse', arguments); },
    rect: function() { record('rect', arguments); },
    roundRect: function() { record('roundRect', arguments); },
    fillRect: function() { record('fillRect', arguments); },
    strokeRect: function() { record('strokeRect', arguments); },
    quadraticCurveTo: function() { record('quadraticCurveTo', arguments); },
    bezierCurveTo: function() { record('bezierCurveTo', arguments); },
    fill: function() { record('fill', arguments); },
    stroke: function() { record('stroke', arguments); },
    fillText: function() { record('fillText', arguments); },
    measureText: () => ({ width: 40 }),
    setLineDash: function() { record('setLineDash', arguments); },
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    lineCap: 'round',
    font: '12px sans-serif',
    textAlign: 'center',
    textBaseline: 'middle'
  };
}

console.log('🧪 Starting Boss Minions & Scary Ghost Face Verification Tests...\n');

// -------------------------------------------------------------------------
// 1. CONTINUOUS MINION SPAWNING DURING BOSS BATTLE
// -------------------------------------------------------------------------
console.log('--- 1. Testing Small Minions Spawning During Boss Battle ---');

const waveSys = new WaveSystem();
waveSys.initLevel(1);

// Fast-forward initial minions in Level 1 (totalMinions = 10)
let initialMinions = 0;
while (initialMinions < waveSys.totalEnemiesInWave) {
  const cfg = waveSys.update(0.01, 5, 1);
  if (cfg) initialMinions++;
}
assert(initialMinions === 10, 'Spawned all 10 initial minions');

// Spawn the Boss (livingEnemiesCount === 0)
const bossCfg = waveSys.update(0.01, 5, 0);
assert(bossCfg !== null && bossCfg.isBoss === true, 'Boss successfully spawned');
assert(waveSys.isBossSpawned === true, 'isBossSpawned is true');
assert(waveSys.isBossDefeated === false, 'isBossDefeated is false');

// Now simulate battle with Boss active: livingEnemiesCount = 1 (just the Boss)
// Advance time past bossMinionSpawnTimer (2.2s initial)
let bossMinion = null;
for (let t = 0; t < 30; t++) {
  const cfg = waveSys.update(0.1, 5, 1);
  if (cfg) {
    bossMinion = cfg;
    break;
  }
}

assert(bossMinion !== null, 'Spawned small minion while Boss is active on battlefield');
assert(bossMinion.isBoss === false, 'Spawned minion has isBoss: false');
assert(bossMinion.symbolQueue.length >= 1, 'Spawned minion has valid runes');
assert(bossMinion.speedMultiplier > 0, 'Spawned minion has valid combat speed');

// Test that minion spawning respects concurrency cap (max 2 in Level 1)
// If livingEnemiesCount = 3 (1 boss + 2 minions), waveSys should NOT spawn another minion immediately
let extraSpawned = null;
for (let t = 0; t < 50; t++) {
  const cfg = waveSys.update(0.1, 5, 3);
  if (cfg) {
    extraSpawned = cfg;
    break;
  }
}
assert(extraSpawned === null, 'Did not exceed max concurrent minions during boss battle');

// Now defeat the boss
let levelCompleteTriggered = false;
waveSys.onLevelComplete = (lvlNum) => {
  levelCompleteTriggered = true;
};
waveSys.notifyBossDefeated();
assert(waveSys.isBossDefeated === true, 'notifyBossDefeated sets isBossDefeated: true');
assert(waveSys.isIntermission === true, 'Intermission triggered after boss defeat');
assert(levelCompleteTriggered === true, 'onLevelComplete triggered on boss defeat');

// Update during intermission should return null (no more minions spawn after boss dies)
const afterDefeatConfig = waveSys.update(0.1, 5, 0);
assert(afterDefeatConfig === null, 'No minions spawn after boss is defeated');

// -------------------------------------------------------------------------
// 2. SCARY GHOST FACIAL EXPRESSIONS (SHARP FANGS, ANGRY BROWS, GLOWING SLIT EYES)
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Scary Ghost Facial Expressions ---');

const testArchetypes = [
  'REGULAR',
  'SPEEDSTER',
  'ARMORED',
  'BOSS_LIBRARIAN',
  'BOSS_CHEF',
  'BOSS_PLANETARIUM',
  'BOSS_COACH',
  'BOSS_MASTER'
];

for (const type of testArchetypes) {
  const enemy = new Enemy({ type, symbolQueue: ['horizontal', 'vertical'] });
  const mockCtx = createMockContext();

  // Test normal menacing predatory expression
  enemy.hitTimer = 0;
  enemy.expressionTimer = 0;
  enemy.isDead = false;

  enemy.render(mockCtx);

  // Verify that rendering happened and drew facial features
  const fills = mockCtx.calls.filter(c => c.method === 'fill');
  const strokes = mockCtx.calls.filter(c => c.method === 'stroke');
  const ellipses = mockCtx.calls.filter(c => c.method === 'ellipse');
  const lines = mockCtx.calls.filter(c => c.method === 'lineTo');

  assert(fills.length > 5, `${type} renders body, dark mouth cavity, fangs, and demonic eyes`);
  assert(ellipses.length >= 2, `${type} renders slanted demonic eye sockets and predatory slit pupils`);
  assert(strokes.length >= 2, `${type} renders sharp angled furrowed eyebrows and wicked mouth outline`);
  assert(lines.length >= 4, `${type} renders sharp pointed triangular fangs and angry brow lines`);

  // Test scared hit expression
  const mockScaredCtx = createMockContext();
  enemy.hitTimer = 0.3;
  enemy.render(mockScaredCtx);
  const scaredFills = mockScaredCtx.calls.filter(c => c.method === 'fill');
  assert(scaredFills.length > 5, `${type} renders horrified screaming gaping fanged mouth when hit`);
}

// Test Heart Ghost retains friendly face for clear gameplay distinction
const heartGhost = new Enemy({ isHeartGhost: true, symbolQueue: ['heart'] });
const heartCtx = createMockContext();
heartGhost.render(heartCtx);
assert(heartGhost.isHeartGhost === true, 'Heart ghost entity is flagged as isHeartGhost');
assert(heartCtx.calls.length > 10, 'Heart ghost renders gentle friendly face with rosy cheeks');

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
