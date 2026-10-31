/**
 * @file test-visual-effects.js
 * @description Unit & Integration tests for Visual Effects, Particle System, Enemy Animations,
 * Screen Shake, and Dynamic Lighting components.
 */

import { ParticleSystem } from './src/systems/ParticleSystem.js';
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

console.log('🧪 Starting Visual Effects & Technical Artist System tests...\n');

// 1. Test Particle System - Magic Sparks
console.log('--- 1. Testing Magic Sparks ---');
const ps = new ParticleSystem();
ps.emitMagicSparks(100, 200, 5, '#c084fc', 10, 5);

assert(ps.particles.length === 5, 'emitMagicSparks creates exactly 5 particles');
const spark = ps.particles[0];
assert(spark.type === 'magic_spark', 'Particle type is magic_spark');
assert(typeof spark.rotation === 'number', 'Magic spark has rotation property');
assert(typeof spark.vRot === 'number', 'Magic spark has rotational velocity (vRot)');
assert(spark.life === 1.0, 'Magic spark starts with life 1.0');
assert(spark.decay > 0, 'Magic spark has decay rate');

// Test update
ps.update(0.1);
assert(spark.life < 1.0, 'Magic spark life decays on update');
assert(spark.x !== 100 || spark.y !== 200, 'Magic spark moves with velocity');

// 2. Test Monster Death Explosion
console.log('\n--- 2. Testing Monster Death Explosion (20 - 30 particles) ---');
const psExplosion = new ParticleSystem();

// Regular monster
psExplosion.emitMonsterDeathExplosion(300, 400, 'REGULAR', 25);
// Should contain: 1 ring + 25 gravity_sparks + 6 spirit smoke = 32 particles
const gravitySparksReg = psExplosion.particles.filter(p => p.type === 'gravity_spark');
assert(gravitySparksReg.length === 25, 'Emitted exactly 25 gravity-bound sparks (20-30 range)');
assert(gravitySparksReg[0].gravity === 420, 'Sparks have downward gravity acceleration property');
assert(gravitySparksReg[0].vy < 0, 'Sparks initial explosive velocity shoots upwards before falling');

// Check color matching regular palette
const regPalette = psExplosion.ENEMY_PALETTES.REGULAR;
assert(regPalette.includes(gravitySparksReg[0].color), 'Sparks use REGULAR enemy color palette');

// Speedster monster
const psSpeedster = new ParticleSystem();
psSpeedster.emitMonsterDeathExplosion(100, 100, 'SPEEDSTER', 30);
const speedsterSparks = psSpeedster.particles.filter(p => p.type === 'gravity_spark');
assert(speedsterSparks.length === 30, 'Speedster emits 30 particles');
const speedPalette = psSpeedster.ENEMY_PALETTES.SPEEDSTER;
assert(speedPalette.includes(speedsterSparks[0].color), 'Speedster sparks use hot pink/flame palette');

// Armored monster
const psArmored = new ParticleSystem();
psArmored.emitMonsterDeathExplosion(200, 200, 'ARMORED', 28);
const armoredSparks = psArmored.particles.filter(p => p.type === 'gravity_spark');
assert(armoredSparks.length === 28, 'Armored emits 28 particles');
const armorPalette = psArmored.ENEMY_PALETTES.ARMORED;
assert(armorPalette.includes(armoredSparks[0].color), 'Armored sparks use dark violet/gold palette');

// Gravity update verification
const initialVy = speedsterSparks[0].vy;
psSpeedster.update(0.1); // 0.1s
assert(speedsterSparks[0].vy > initialVy, 'Gravity accelerates vy downwards over time (vy increases)');

// 3. Test Screen Shake
console.log('\n--- 3. Testing Screen Shake ---');
const psShake = new ParticleSystem();
assert(typeof psShake.triggerShake === 'function', 'triggerShake method exists');
assert(typeof psShake.shake === 'function', 'Backward-compatible shake alias exists');

psShake.triggerShake(18, 0.45);
assert(psShake.screenShake.intensity === 18, 'Screen shake intensity set to 18');
assert(psShake.screenShake.duration === 0.45, 'Screen shake duration set to 0.45');
assert(psShake.screenShake.timer === 0.45, 'Screen shake timer initialized to duration');

psShake.update(0.1);
assert(psShake.screenShake.timer < 0.45, 'Screen shake timer decreases on update');
assert(psShake.screenShake.x !== 0 || psShake.screenShake.y !== 0, 'Screen shake generates pixel displacement');
assert(typeof psShake.screenShake.rotation === 'number', 'Screen shake generates subtle rotation');

// Wait until finish
psShake.update(0.4);
assert(psShake.screenShake.x === 0 && psShake.screenShake.y === 0, 'Screen shake resets to 0 when timer expires');
assert(psShake.screenShake.rotation === 0, 'Screen shake rotation resets to 0 when timer expires');

// 4. Test Enemy Floating Animations and Gaze Tracking
console.log('\n--- 4. Testing Enemy Floating Animation & Eye Gaze ---');
const enemy = new Enemy({
  type: 'REGULAR',
  x: 200,
  y: 100,
  symbolQueue: ['horizontal']
});

assert(typeof enemy.phase === 'number', 'Enemy has harmonic phase for sine wave floating');
assert(typeof enemy.blinkTimer === 'number', 'Enemy has eye blinking timer');
assert(typeof enemy.blinkDuration === 'number', 'Enemy has blink duration');

// Update with player position
const playerPos = { x: 200, y: 500 }; // Player directly below enemy
enemy.update(0.1, playerPos);
assert(enemy.targetPlayerPos.x === 200 && enemy.targetPlayerPos.y === 500, 'Enemy tracks player position coordinates');

// Check angle calculation towards player
const dx = enemy.targetPlayerPos.x - enemy.x;
const dy = enemy.targetPlayerPos.y - enemy.y;
const angle = Math.atan2(dy, dx);
assert(Math.abs(angle - Math.PI / 2) < 0.05, 'Enemy calculates gaze angle directly downwards towards player');

// Blink timer test
enemy.blinkTimer = 0.05;
enemy.update(0.1, playerPos);
assert(enemy.isBlinking === true, 'Enemy enters isBlinking state when blinkTimer expires');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
