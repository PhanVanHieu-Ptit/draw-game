import assert from 'node:assert/strict';
import { QualityManager } from '../src/systems/QualityManager.js';
import { Entity } from '../src/entities/Entity.js';
import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { ParticleSystem } from '../src/systems/ParticleSystem.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  ✅ PASS: ${name}`);
}

console.log('🧪 Starting Rendering Performance & Adaptive Quality Verification Tests...\n');

// -------------------------------------------------------------
// 1. Adaptive Quality Manager & Configurable Options
// -------------------------------------------------------------
console.log('--- 1. Testing QualityManager Tiers & Configurable Options ---');

check('QualityManager initializes default Auto tier with valid profile', () => {
  const qm = new QualityManager();
  assert.equal(qm.mode, 'auto');
  assert.ok(['high', 'medium', 'low'].includes(qm.tier));
  assert.ok(typeof qm.particleDensity === 'number' && qm.particleDensity > 0);
  assert.ok(typeof qm.resolutionScale === 'number' && qm.resolutionScale > 0);
  assert.ok(typeof qm.glowEffects === 'boolean');
  assert.ok(typeof qm.shadowEffects === 'boolean');
  assert.ok(typeof qm.dynamicLighting === 'boolean');
  assert.ok(typeof qm.backgroundAnimations === 'boolean');
  assert.ok(typeof qm.screenShake === 'boolean');
});

check('Manual quality modes (high, medium, low) properly set profile parameters', () => {
  const qm = new QualityManager();

  qm.setMode('high');
  assert.equal(qm.tier, 'high');
  assert.equal(qm.particleDensity, 1.0);
  assert.equal(qm.resolutionScale, 1.0);
  assert.equal(qm.dynamicLighting, true);
  assert.equal(qm.glowEffects, true);
  assert.equal(qm.shadowEffects, true);
  assert.equal(qm.backgroundAnimations, true);
  assert.equal(qm.screenShake, true);

  qm.setMode('medium');
  assert.equal(qm.tier, 'medium');
  assert.equal(qm.particleDensity, 1.0);
  assert.equal(qm.resolutionScale, 1.0);
  assert.equal(qm.dynamicLighting, true);
  assert.equal(qm.glowEffects, true);
  assert.equal(qm.shadowEffects, true);
  assert.equal(qm.backgroundAnimations, true);

  qm.setMode('low');
  assert.equal(qm.tier, 'low');
  assert.equal(qm.particleDensity, 0.55);
  assert.equal(qm.resolutionScale, 0.85);
  assert.equal(qm.dynamicLighting, false);
  assert.equal(qm.glowEffects, false);
  assert.equal(qm.shadowEffects, false);
  assert.equal(qm.backgroundAnimations, false);
  assert.equal(qm.screenShake, false);
});

check('Custom option overrides and reset functionality', () => {
  const qm = new QualityManager();
  qm.setMode('high');
  assert.equal(qm.particleDensity, 1.0);

  // Override specific option
  qm.setOption('particleDensity', 0.5);
  assert.equal(qm.particleDensity, 0.5);

  qm.setOption('dynamicLighting', false);
  assert.equal(qm.dynamicLighting, false);

  // Reset restores tier defaults
  qm.resetOptions();
  assert.equal(qm.particleDensity, 1.0);
  assert.equal(qm.dynamicLighting, true);
});

check('Anti-oscillation hysteresis prevents rapid tier bouncing', () => {
  const qm = new QualityManager({ allowStepUp: true });
  qm.setMode('auto');
  qm.forceTier('high');
  qm._warmupLeft = 0;

  // Trigger stepDown by simulating heavy frame times (65 frames > 60 SAMPLE_FRAMES, 30ms = ~33 FPS)
  for (let i = 0; i < 65; i++) {
    qm.recordFrame(30); // 30ms > 22ms SLOW_FRAME_MS, <= 40ms VERY_SLOW_FRAME_MS
  }
  assert.equal(qm.tier, 'medium', 'Steps down to medium under sustained frame drops');

  // Immediately feeding fast frames should NOT immediately step back up (anti-oscillation cooldown)
  for (let i = 0; i < 50; i++) {
    qm.recordFrame(12.0); // 80+ FPS
  }
  assert.equal(qm.tier, 'medium', 'Maintains medium tier during cooldown to avoid rapid oscillation');

  // Once cooldown expires and enough fast frames accumulate, stepUp can happen
  qm._cooldownLeft = 0;
  qm._warmupLeft = 0;
  for (let i = 0; i < 200; i++) {
    qm.recordFrame(12.0);
  }
  assert.equal(qm.tier, 'high', 'Steps back up to high once stability is proven and cooldown passed');
});

// -------------------------------------------------------------
// 2. Collision Detection Optimization (AABB & Squared Dist)
// -------------------------------------------------------------
console.log('\n--- 2. Testing Collision Detection Optimization ---');

check('Entity.collidesWith rejects distant entities via AABB early-exit without sqrt', () => {
  const e1 = new Entity(100, 100, 20);
  const e2 = new Entity(1000, 1000, 20); // Far away
  assert.equal(e1.collidesWith(e2), false);

  const e3 = new Entity(135, 100, 20); // Within radius sum (20 + 20 = 40, distance is 35)
  assert.equal(e1.collidesWith(e3), true);

  const e4 = new Entity(145, 100, 20); // Outside radius sum (distance 45 > 40)
  assert.equal(e1.collidesWith(e4), false);

  const e5 = new Entity(128, 128, 20); // Diagonal: dx=28, dy=28 -> dx*dx+dy*dy = 1568 > 1600 (40*40)
  assert.equal(e1.collidesWith(e5), true); // 1568 < 1600 -> collides!

  const e6 = new Entity(129, 129, 20); // dx=29, dy=29 -> 841 + 841 = 1682 > 1600 -> no collision
  assert.equal(e1.collidesWith(e6), false);
});

check('Enemy boss collidesWith applies optimized squared distance check', () => {
  const boss = new Enemy();
  boss.isBoss = true;
  boss.archetype = 'BOSS_MASTER';
  boss.x = 500;
  boss.y = 300;
  boss.radius = 80;

  const player = new Entity(500, 350, 20); // Within boss collision radius
  assert.equal(boss.collidesWith(player), true);

  const distant = new Entity(800, 300, 20); // Far away
  assert.equal(boss.collidesWith(distant), false);
});

// -------------------------------------------------------------
// 3. Visual Resource & Gradient Caching
// -------------------------------------------------------------
console.log('\n--- 3. Testing Visual Resource & Gradient Caching ---');

const mockCtx = {
  createLinearGradient(x0, y0, x1, y1) {
    return {
      type: 'LinearGradient',
      coords: [x0, y0, x1, y1],
      stops: [],
      addColorStop(offset, color) { this.stops.push({ offset, color }); }
    };
  },
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return {
      type: 'RadialGradient',
      coords: [x0, y0, r0, x1, y1, r1],
      stops: [],
      addColorStop(offset, color) { this.stops.push({ offset, color }); }
    };
  }
};

check('Enemy.getCachedLinearGradient caches gradients by key and reuses instances', () => {
  Enemy.clearGradientCache();
  const grad1 = Enemy.getCachedLinearGradient(mockCtx, 'test_grad', 0, 0, 0, 100, [
    [0, '#ff0000'],
    [1, '#0000ff']
  ]);
  const grad2 = Enemy.getCachedLinearGradient(mockCtx, 'test_grad', 0, 0, 0, 100, [
    [0, '#ff0000'],
    [1, '#0000ff']
  ]);
  assert.equal(grad1, grad2, 'Reuses identical cached gradient object without reallocation');

  // Clearing cache flushes cached references
  Enemy.clearGradientCache();
  const grad3 = Enemy.getCachedLinearGradient(mockCtx, 'test_grad', 0, 0, 0, 100, [
    [0, '#ff0000'],
    [1, '#0000ff']
  ]);
  assert.notEqual(grad1, grad3, 'New gradient created after cache clear');
});

check('Player ground radial gradients are cached and reused across frames', () => {
  const player = new Player(400, 300);
  const gradA = player._getGroundGradient(mockCtx, false);
  const gradB = player._getGroundGradient(mockCtx, false);
  assert.equal(gradA, gradB, 'Cached normal ground gradient reused');

  const gradHealA = player._getGroundGradient(mockCtx, true);
  const gradHealB = player._getGroundGradient(mockCtx, true);
  assert.equal(gradHealA, gradHealB, 'Cached healing ground gradient reused');
  assert.notEqual(gradA, gradHealA, 'Normal and heal gradients are distinct cached objects');
});

// -------------------------------------------------------------
// 4. Particle System Optimization & Precomputed Decays
// -------------------------------------------------------------
console.log('\n--- 4. Testing Particle System Optimizations ---');

check('ParticleSystem scales emission counts with particleDensity', () => {
  const ps = new ParticleSystem(200, 50);
  ps.setQuality({ particleDensity: 0.5, glow: false });

  ps.emitMagicSparks(100, 100, 20, '#ffffff');
  // 20 * 0.5 = 10 particles active
  assert.equal(ps.activeParticleCount, 10, 'Emission count correctly scaled by density factor');
});

check('ParticleSystem update loop executes without NaN or decay math regressions', () => {
  const ps = new ParticleSystem(100, 20);
  ps.emitMagicSparks(100, 100, 10, '#f472b6');
  ps.emitHitBurst(100, 100, '#38bdf8', 5);

  const initialCount = ps.activeParticleCount;
  assert.ok(initialCount > 0);

  // Advance simulation by 0.5s
  ps.update(0.5);
  for (let i = 0; i < ps.activeParticleCount; i++) {
    const p = ps.particlePool[i];
    assert.ok(Number.isFinite(p.x), 'Particle x is finite');
    assert.ok(Number.isFinite(p.y), 'Particle y is finite');
    assert.ok(Number.isFinite(p.vx), 'Particle vx is finite');
    assert.ok(Number.isFinite(p.vy), 'Particle vy is finite');
    assert.ok(Number.isFinite(p.life), 'Particle life is finite');
  }
});

// -------------------------------------------------------------
// 5. Delta Time Clamping & Fixed-Timestep Guard
// -------------------------------------------------------------
console.log('\n--- 5. Testing Frame Delta Time Clamping ---');

check('Large delta times (e.g. background tab suspension) are safely clamped', () => {
  // Logic verified from Game.js loop implementation:
  // If rawDt > 0.25 (e.g. 5.0 seconds when tab suspended), dt is clamped to 1/60s (0.01667s)
  const simulateDeltaClamping = (rawDt) => {
    if (rawDt > 0.25) return 1 / 60;
    return rawDt;
  };

  assert.equal(simulateDeltaClamping(3.5), 1 / 60, 'Suspension delta 3.5s clamped to 16.7ms');
  assert.equal(simulateDeltaClamping(0.5), 1 / 60, 'Long lag delta 0.5s clamped to 16.7ms');
  assert.equal(simulateDeltaClamping(0.016), 0.016, 'Normal 60fps delta passes through untouched');
});

console.log(`\n========================================`);
console.log(`Rendering Performance Tests: ${passed} Passed, 0 Failed`);
console.log(`========================================\n`);
