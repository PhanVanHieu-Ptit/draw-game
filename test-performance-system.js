/**
 * @file test-performance-system.js
 * @description Production Performance & Web Performance Engineer Unit Test Suite.
 * Validates Object Pooling, Frame-rate / Refresh-rate DeltaTime invariance,
 * and Retina DPR input normalization.
 */

import { ObjectPool } from './src/core/ObjectPool.js';
import { Projectile } from './src/entities/Projectile.js';
import { Enemy } from './src/entities/Enemy.js';
import { ParticleSystem } from './src/systems/ParticleSystem.js';
import { InputHandler } from './src/systems/InputHandler.js';

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

console.log('🧪 Starting Web Performance Engineer Performance Verification Tests...\n');

// -------------------------------------------------------------
// 1. Test Generic ObjectPool
// -------------------------------------------------------------
console.log('--- 1. Testing Generic ObjectPool ---');
let createCount = 0;
const pool = new ObjectPool(
  () => { createCount++; return { id: createCount, value: 0 }; },
  (obj) => { obj.value = 0; },
  10,
  50
);

assert(pool.size === 10, 'Initial pool size pre-allocates 10 objects');
assert(createCount === 10, 'Factory called 10 times during pre-allocation');

const obj1 = pool.acquire();
assert(pool.size === 9, 'Acquiring an object decreases free pool size to 9');
obj1.value = 42;

pool.release(obj1);
assert(pool.size === 10, 'Releasing returns object to pool');
assert(obj1.value === 0, 'Reset hook called to clean instance state');

// -------------------------------------------------------------
// 2. Test Projectile Object Pooling & Zero Heap Allocations
// -------------------------------------------------------------
console.log('\n--- 2. Testing Projectile Object Pooling & Zero Heap Allocation ---');
const projPool = new ObjectPool(
  () => new Projectile(),
  (p) => p.reset(),
  20,
  100
);

assert(projPool.size === 20, 'Projectile pool pre-allocated with 20 instances');

const dummyEnemy = { x: 500, y: 500, radius: 25 };
const p1 = projPool.acquire();
p1.init({
  startX: 100,
  startY: 100,
  targetEnemy: dummyEnemy,
  gesture: 'horizontal',
  particleSystem: null
});

assert(p1.isDead === false, 'Acquired projectile is alive');
assert(p1.x === 100 && p1.y === 100, 'Projectile positioned at start coordinates');

// Simulate 30 frames of update: history buffer should update in-place without new allocations
const historyRef0 = p1.history[0];
const historyRef1 = p1.history[1];
for (let f = 0; f < 30; f++) {
  p1.update(0.016);
}
assert(p1.history[0] === historyRef0, 'History trail buffer reference 0 preserved (zero allocation)');
assert(p1.history[1] === historyRef1, 'History trail buffer reference 1 preserved (zero allocation)');
assert(p1.x > 100, 'Projectile traveled forward towards enemy target');

// Release to pool
projPool.release(p1);
assert(p1.isDead === true, 'Released projectile reset to dead state');
assert(projPool.size === 20, 'Projectile returned to pool');

// -------------------------------------------------------------
// 3. Test Enemy Object Pooling
// -------------------------------------------------------------
console.log('\n--- 3. Testing Enemy Object Pooling ---');
const enemyPool = new ObjectPool(
  () => new Enemy(),
  (e) => e.reset(),
  15,
  100
);

assert(enemyPool.size === 15, 'Enemy pool pre-allocated with 15 instances');
const e1 = enemyPool.acquire();
e1.init({
  type: 'SPEEDSTER',
  x: 200,
  y: 0,
  symbolQueue: ['caret', 'v_shape'],
  speedMultiplier: 1.0,
  targetPlayerPos: { x: 200, y: 600 }
});

assert(e1.type === 'SPEEDSTER', 'Enemy archetype correctly initialized');
assert(e1.matchesActiveSymbol('caret') === true, 'First active symbol matches');

// Hit symbol
const hit1 = e1.takeHit('caret');
assert(hit1.matched === true && hit1.destroyed === false, 'First symbol eliminated, enemy still alive');
assert(e1.matchesActiveSymbol('v_shape') === true, 'Second symbol becomes active');

const hit2 = e1.takeHit('v_shape');
assert(hit2.matched === true && hit2.destroyed === true, 'Final symbol eliminated, enemy destroyed');
assert(e1.isDead === true, 'Enemy marked as dead');

enemyPool.release(e1);
assert(enemyPool.size === 15, 'Enemy instance recycled back into enemy pool');

// -------------------------------------------------------------
// 4. Test Particle System Object Pooling & O(1) Swapping
// -------------------------------------------------------------
console.log('\n--- 4. Testing Particle Pooling & O(1) Zero-Splice Life Cycle ---');
const ps = new ParticleSystem(100, 20);
assert(ps.activeParticleCount === 0, 'Initially 0 active particles in pool');

ps.emitMagicSparks(150, 250, 10, '#f472b6');
assert(ps.activeParticleCount === 10, '10 particles activated from pool');

// Update to expire all particles
ps.update(3.0);
assert(ps.activeParticleCount === 0, 'Particles decayed and deactivated to 0 without array splicing');

// Emit monster death explosion (28 particles + 1 ring + 6 spirit smoke = 35 particles)
ps.emitMonsterDeathExplosion(300, 300, 'BOSS', 28);
assert(ps.activeParticleCount === 35, '35 pooled particles active after Boss death explosion');
assert(ps.particlePool.length === 100, 'Total pool capacity remains constant (no GC memory leak)');

// -------------------------------------------------------------
// 5. Test Refresh Rate Invariance (60Hz vs 120Hz vs 144Hz DeltaTime Math)
// -------------------------------------------------------------
console.log('\n--- 5. Testing 60Hz, 120Hz, 144Hz Refresh Rate Physics Invariance ---');
// Simulating 1 second of linear projectile flight
// Case A: 60 FPS (60 steps with dt = 1/60s)
let proj60 = new Projectile();
proj60.init({ startX: 0, startY: 0, targetEnemy: { x: 5000, y: 0, radius: 10 }, gesture: 'horizontal' });
for (let i = 0; i < 60; i++) {
  proj60.update(1 / 60);
}

// Case B: 120 FPS (120 steps with dt = 1/120s)
let proj120 = new Projectile();
proj120.init({ startX: 0, startY: 0, targetEnemy: { x: 5000, y: 0, radius: 10 }, gesture: 'horizontal' });
for (let i = 0; i < 120; i++) {
  proj120.update(1 / 120);
}

// Case C: 144 FPS (144 steps with dt = 1/144s)
let proj144 = new Projectile();
proj144.init({ startX: 0, startY: 0, targetEnemy: { x: 5000, y: 0, radius: 10 }, gesture: 'horizontal' });
for (let i = 0; i < 144; i++) {
  proj144.update(1 / 144);
}

const diff60_120 = Math.abs(proj60.x - proj120.x);
const diff60_144 = Math.abs(proj60.x - proj144.x);

assert(diff60_120 < 0.1, `Displacement difference between 60Hz and 120Hz is negligible (${diff60_120.toFixed(4)}px)`);
assert(diff60_144 < 0.1, `Displacement difference between 60Hz and 144Hz is negligible (${diff60_144.toFixed(4)}px)`);

// -------------------------------------------------------------
// 6. Test Retina DPR Scaling Coordinate Normalization
// -------------------------------------------------------------
console.log('\n--- 6. Testing Retina DPR Input Normalization ---');
// Mock Canvas & InputHandler
const mockCanvas = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({
    left: 20,
    top: 30,
    width: 800,
    height: 600
  })
};

const inputHandler = new InputHandler(
  mockCanvas,
  null,
  null,
  null,
  null,
  () => ({ width: 1600, height: 1200 }) // 2x Retina Logical resolution
);

const mockEvent = {
  clientX: 420, // 400px from left in CSS
  clientY: 330  // 300px from top in CSS
};

const pt = inputHandler._getCanvasPoint(mockEvent);
// Expected: (420 - 20) * (1600 / 800) = 400 * 2 = 800
// Expected: (330 - 30) * (1200 / 600) = 300 * 2 = 600
assert(pt.x === 800, `Retina X coordinate correctly normalized (expected 800, got ${pt.x})`);
assert(pt.y === 600, `Retina Y coordinate correctly normalized (expected 600, got ${pt.y})`);

console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');
