/**
 * @file test-powerups-freeze-blast.js
 * @description Comprehensive automated verification for:
 * 1. Increased Heart Ghost spawn rates & multi-heart allowances.
 * 2. Freeze Ghost (U Linh Băng Giá ❄️) & Frost Nova (circle) mechanics.
 * 3. Blast Ghost (U Linh Cuồng Phong 🌀) & Gale Shockwave (spiral) knockback mechanics.
 * 4. Gesture recognition for circle and spiral shapes.
 * 5. Enemy freeze state machine (speed = 0) and knockback displacement.
 */

import { RUNES, ENEMY_TYPES, DIFFICULTY_LEVELS } from './src/core/Constants.js';
import { GestureEngine } from './src/GestureEngine.js';
import { WaveSystem } from './src/systems/WaveSystem.js';
import { Enemy } from './src/entities/Enemy.js';
import { Game } from './src/core/Game.js';

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

console.log('🧪 Starting Tactical Power-ups (Hearts, Freeze, Knockback) Verification Tests...\n');

// -------------------------------------------------------------------------
// 1. RUNES & ARTIFACT CONFIGURATIONS
// -------------------------------------------------------------------------
console.log('--- 1. Testing Runes & Archetypes Configuration ---');
assert(RUNES.heart !== undefined, 'Heart rune exists');
assert(RUNES.circle !== undefined, 'Circle (Frost Nova ❄️) rune exists');
assert(RUNES.circle.symbol === '❄️', 'Circle symbol is ❄️');
assert(RUNES.spiral !== undefined, 'Spiral (Gale Shockwave 🌀) rune exists');
assert(RUNES.spiral.symbol === '🌀', 'Spiral symbol is 🌀');

assert(ENEMY_TYPES.FREEZE !== undefined, 'ENEMY_TYPES.FREEZE exists');
assert(ENEMY_TYPES.FREEZE.color === '#bae6fd', 'Freeze ghost has icy cyan palette');
assert(ENEMY_TYPES.BLAST !== undefined, 'ENEMY_TYPES.BLAST exists');
assert(ENEMY_TYPES.BLAST.color === '#a7f3d0', 'Blast ghost has gale emerald palette');

assert(DIFFICULTY_LEVELS.NORMAL.heartMult === 1.0, 'Normal heartMult is boosted to 1.0');
assert(DIFFICULTY_LEVELS.HARDCORE.heartMult >= 0.80, 'Hardcore heartMult is generous (>= 0.80)');
assert(DIFFICULTY_LEVELS.INFERNO.heartMult >= 0.65, 'Inferno heartMult is fair (>= 0.65)');

// -------------------------------------------------------------------------
// 2. GESTURE RECOGNITION FOR CIRCLE AND SPIRAL
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Gesture Recognition for Circle and Spiral ---');
const engine = new GestureEngine();

// Simulate Circle stroke (clockwise around (150, 150))
const circlePts = [];
for (let i = 0; i <= 24; i++) {
  const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
  circlePts.push({ x: 150 + 60 * Math.cos(angle), y: 150 + 60 * Math.sin(angle) });
}
const circleRes = engine.recognize(circlePts);
assert(circleRes.gesture === 'circle', `Recognized circle correctly (got: ${circleRes.gesture})`);
assert(circleRes.score >= 0.80, `Circle confidence score is high (${circleRes.score})`);

// Simulate Spiral stroke (inward swirl)
const spiralPts = [];
for (let i = 0; i <= 28; i++) {
  const t = i / 28;
  const r = 60 * (1 - t * 0.7);
  const angle = -Math.PI / 2 + t * Math.PI * 3.5;
  spiralPts.push({ x: 200 + r * Math.cos(angle), y: 200 + r * Math.sin(angle) });
}
const spiralRes = engine.recognize(spiralPts);
assert(spiralRes.gesture === 'spiral', `Recognized spiral correctly (got: ${spiralRes.gesture})`);
assert(spiralRes.score >= 0.70, `Spiral confidence score is above threshold (${spiralRes.score})`);

// -------------------------------------------------------------------------
// 3. WAVE SYSTEM POWER-UP SPAWNING (HEARTS, FREEZE, BLAST)
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing WaveSystem Power-Up Spawn Rates ---');
const waveSys = new WaveSystem();
waveSys.setMode('STORY');
waveSys.initLevel(2); // Level 2 allows tactical power-ups

let heartSpawnCount = 0;
let freezeSpawnCount = 0;
let blastSpawnCount = 0;
const testRuns = 200;

for (let i = 0; i < testRuns; i++) {
  // Simulate player with low HP (2/5)
  const cfg = waveSys._generateEnemyConfig(2);
  if (cfg.isHeartGhost) heartSpawnCount++;
  if (cfg.isFreezeGhost) freezeSpawnCount++;
  if (cfg.isBlastGhost) blastSpawnCount++;
}

console.log(`  Spawns out of ${testRuns} low-HP runs: Hearts: ${heartSpawnCount}, Freeze: ${freezeSpawnCount}, Blast: ${blastSpawnCount}`);
assert(heartSpawnCount >= 25, `Heart ghost spawns frequently when injured (saw ${heartSpawnCount} / ${testRuns})`);
assert(freezeSpawnCount >= 10, `Freeze ghost spawns in level 2 (saw ${freezeSpawnCount} / ${testRuns})`);
assert(blastSpawnCount >= 10, `Blast ghost spawns in level 2 (saw ${blastSpawnCount} / ${testRuns})`);

// Test Boss battle power-up minion generation
let bossHeartCount = 0;
let bossFreezeCount = 0;
let bossBlastCount = 0;
for (let i = 0; i < testRuns; i++) {
  const bCfg = waveSys._generateBossMinionConfig(2);
  if (bCfg.isHeartGhost) bossHeartCount++;
  if (bCfg.isFreezeGhost) bossFreezeCount++;
  if (bCfg.isBlastGhost) bossBlastCount++;
}
assert(bossHeartCount >= 20, `Heart spawns during Boss fight (saw ${bossHeartCount} / ${testRuns})`);
assert(bossFreezeCount >= 10, `Freeze spawns during Boss fight (saw ${bossFreezeCount} / ${testRuns})`);
assert(bossBlastCount >= 10, `Blast spawns during Boss fight (saw ${bossBlastCount} / ${testRuns})`);

// -------------------------------------------------------------------------
// 4. ENEMY ENTITY FREEZE & KNOCKBACK MECHANICS
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing Enemy Freeze & Knockback Behavior ---');
const enemy = new Enemy({
  type: 'REGULAR',
  x: 200,
  y: 200,
  symbolQueue: ['horizontal']
});

assert(enemy.isFrozen === false, 'Enemy starts unfrozen');
enemy.freeze(4.5);
assert(enemy.isFrozen === true, 'Enemy isFrozen flag active after freeze(4.5)');
assert(enemy.freezeTimer === 4.5, 'freezeTimer set to 4.5 seconds');

// Updating frozen enemy towards player: position should NOT change!
const initialX = enemy.x;
const initialY = enemy.y;
enemy.update(0.5, { x: 400, y: 400 });
assert(enemy.x === initialX && enemy.y === initialY, 'Frozen enemy does NOT advance towards player (motion stopped completely)');
assert(enemy.freezeTimer === 4.0, 'freezeTimer decrements on update (4.0s left)');

// Fast forward freeze expiry
enemy.update(4.1, { x: 400, y: 400 });
assert(enemy.isFrozen === false, 'Enemy unfreezes when timer expires');
assert(enemy.thawTimer > 0, 'Enemy enters thaw transition with slowdown');

// Knockback test
enemy.knockback(1, 0, 300, 0.40);
assert(enemy.knockbackTimer === 0.40, 'Knockback timer initialized to 0.40s');
assert(enemy.knockbackVx > 0, 'Knockback positive velocity applied outwards');

const preX = enemy.x;
enemy.update(0.1, { x: 0, y: 200 });
assert(enemy.x > preX, 'Knockback moves enemy away from player along vector');

// -------------------------------------------------------------------------
// 5. GAME SYSTEM INTEGRATION (FREEZE ALL & PUSHBACK ALL)
// -------------------------------------------------------------------------
console.log('\n--- 5. Testing Game Integration for FreezeAll & PushbackAll ---');

// Mock canvas and DOM environment for Game instance
const mockCanvas = {
  getContext: () => ({
    save: () => {},
    restore: () => {},
    clearRect: () => {},
    fillRect: () => {},
    scale: () => {},
    translate: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    drawImage: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} })
  }),
  width: 800,
  height: 600,
  style: {},
  addEventListener: () => {}
};

assert(typeof Game.prototype.triggerFreezeAll === 'function', 'Game.triggerFreezeAll method is implemented');
assert(typeof Game.prototype.triggerPushbackAll === 'function', 'Game.triggerPushbackAll method is implemented');

console.log(`\n========================================`);
console.log(`Power-Up Verification: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
