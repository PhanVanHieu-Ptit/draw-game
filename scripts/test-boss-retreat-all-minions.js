/**
 * @file test-boss-retreat-all-minions.js
 * @description Automated verification test for the mechanic:
 * When Boss loses 1 life and recoils backwards, all other active monsters
 * on the battlefield must also retreat backwards away from Momo.
 */

import { Enemy } from '../src/entities/Enemy.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { Game } from '../src/core/Game.js';

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

console.log('🧪 Starting Boss Retreat & Minion Recoil Verification Tests...\n');

// -------------------------------------------------------------------------
// 1. MINION ENTITY RETREAT MECHANICS (retreatWithBoss)
// -------------------------------------------------------------------------
console.log('--- 1. Testing Enemy.retreatWithBoss() Physics & State Machine ---');

const playerPos = { x: 500, y: 500 };

// Create regular minion near Momo
const minion = new Enemy({
  type: 'REGULAR',
  x: 500,
  y: 350, // 150px directly North of Momo
  targetPlayerPos: playerPos,
  symbolQueue: ['horizontal', 'vertical']
});

assert(minion.isMinionRetreating === false, 'Minion initially not in retreat');
assert(minion.minionRetreatTimer === 0, 'minionRetreatTimer initially 0');

// Trigger retreat with Boss
minion.retreatWithBoss(playerPos, 1.35, 260);

assert(minion.isMinionRetreating === true, 'Minion enters isMinionRetreating state');
assert(minion.minionRetreatTimer === 1.35, 'minionRetreatTimer initialized to 1.35s');
assert(minion.minionRetreatVy < 0, `minionRetreatVy points away from player (North / upwards: ${minion.minionRetreatVy})`);
assert(minion.shiverTimer >= 1.35, 'Minion shiver timer active for fear/shock visual');
assert(minion.expressionTimer >= 1.35, 'Minion scared expression timer active');

// Updating minion during retreat: must move AWAY from Momo
const initialDist = Math.hypot(minion.x - playerPos.x, minion.y - playerPos.y);
minion.update(0.3, playerPos);
const afterStepDist = Math.hypot(minion.x - playerPos.x, minion.y - playerPos.y);

assert(afterStepDist > initialDist, `Minion recoiled further away from Momo (from ${initialDist.toFixed(1)}px to ${afterStepDist.toFixed(1)}px)`);
assert(minion.isMinionRetreating === true, 'Minion still in retreat state at 0.3s');

// Complete retreat duration
minion.update(1.2, playerPos);
assert(minion.isMinionRetreating === false, 'Minion retreat completed after timer expired');
assert(minion.minionRetreatVx === 0 && minion.minionRetreatVy === 0, 'Retreat velocity zeroed out');

// Now minion should resume moving TOWARDS Momo
const beforeResumeDist = Math.hypot(minion.x - playerPos.x, minion.y - playerPos.y);
minion.update(0.2, playerPos);
const afterResumeDist = Math.hypot(minion.x - playerPos.x, minion.y - playerPos.y);
assert(afterResumeDist < beforeResumeDist, 'Minion successfully resumed advancing towards Momo');

// -------------------------------------------------------------------------
// 2. RETREAT SAFETY & PLAYER INTERACTION (COLLISION & SPELL TARGETING)
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Collision Safety and Spell Match during Minion Retreat ---');

const minionNearMomo = new Enemy({
  type: 'SPEEDSTER',
  x: playerPos.x + 10,
  y: playerPos.y + 10,
  targetPlayerPos: playerPos,
  symbolQueue: ['lightning']
});

minionNearMomo.retreatWithBoss(playerPos, 1.35, 300);

// Collision check during retreat
assert(minionNearMomo.collidesWith(playerPos) === false, 'Retreating minion does NOT deal collision damage to player');

// Spell targeting during retreat: player CAN still hit and destroy retreating minions!
assert(minionNearMomo.matchesActiveSymbol('lightning') === true, 'Player can target and hit retreating minion');
const hitOutcome = minionNearMomo.takeHit('lightning');
assert(hitOutcome.matched === true && hitOutcome.destroyed === true, 'Spell destroys retreating minion');
assert(minionNearMomo.isDead === true, 'Minion marked as dead');

// Heart ghost immunity: Heart ghosts should NEVER be blasted away from player
const heartGhost = new Enemy({
  isHeartGhost: true,
  x: 450,
  y: 450,
  targetPlayerPos: playerPos,
  symbolQueue: ['heart']
});
heartGhost.retreatWithBoss(playerPos, 1.35, 260);
assert(heartGhost.isMinionRetreating === false, 'Heart ghost is preserved in place and not forced to retreat');

// -------------------------------------------------------------------------
// 3. LEVEL 5 ROOFTOP / LORD UMBRA RETREAT DIRECTION
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing Level 5 Lord Umbra Directional Retreat (Eastward) ---');

const rooftopMomo = { x: 200, y: 500 }; // Momo stationed on bottom-left
const rooftopMinion = new Enemy({
  type: 'ARMORED',
  levelIndex: 5,
  x: 350,
  y: 450,
  targetPlayerPos: rooftopMomo,
  symbolQueue: ['caret', 'v_shape']
});

rooftopMinion.retreatWithBoss(rooftopMomo, 1.35, 280);
assert(rooftopMinion.isMinionRetreating === true, 'Rooftop minion entered retreat');
assert(rooftopMinion.minionRetreatVx > 0, `Rooftop minion retreats Eastward towards right border (Vx: ${rooftopMinion.minionRetreatVx})`);

// -------------------------------------------------------------------------
// 4. GAME SYSTEM INTEGRATION: BOSS LOSING A LIFE RETREATS ALL MINIONS
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing Game System retreatAllMinionsWithBoss Integration ---');

assert(typeof Game.prototype.retreatAllMinionsWithBoss === 'function', 'Game.prototype.retreatAllMinionsWithBoss method is implemented');

const playerMock = { x: 500, y: 500 };

// Setup Boss and several Minions
const boss = new Enemy({
  type: 'BOSS_LIBRARIAN',
  x: 500,
  y: 200,
  bossLives: 3,
  bossPhases: [
    ['horizontal', 'vertical'],
    ['caret', 'v_shape'],
    ['lightning']
  ],
  targetPlayerPos: playerMock
});

const minion1 = new Enemy({
  type: 'REGULAR',
  x: 350,
  y: 400,
  targetPlayerPos: playerMock,
  symbolQueue: ['horizontal']
});

const minion2 = new Enemy({
  type: 'SPEEDSTER',
  x: 650,
  y: 400,
  targetPlayerPos: playerMock,
  symbolQueue: ['vertical']
});

const minion3 = new Enemy({
  type: 'ARMORED',
  x: 500,
  y: 600,
  targetPlayerPos: playerMock,
  symbolQueue: ['caret', 'v_shape']
});

const gameContext = {
  player: playerMock,
  enemies: [boss, minion1, minion2, minion3],
  particleSystem: {
    emitMagicSparks: () => {},
    emitFloatingText: () => {}
  },
  audioSystem: {
    soundBlast: () => {}
  },
  waveSystem: new WaveSystem()
};

// Simulate Boss phase complete (boss loses 1 life)
const hitResult = boss.takeHit('horizontal');
const hitPhaseEnd = boss.takeHit('vertical');

assert(hitPhaseEnd.isPhaseComplete === true, 'Boss completed Phase 1');
assert(boss.bossLives === 2, 'Boss lost 1 life (bossLives: 2)');
assert(boss.isRetreating === true, 'Boss entered retreat state');

// Trigger retreatAllMinionsWithBoss
Game.prototype.retreatAllMinionsWithBoss.call(gameContext, boss);

assert(minion1.isMinionRetreating === true, 'Minion 1 entered retreat state');
assert(minion2.isMinionRetreating === true, 'Minion 2 entered retreat state');
assert(minion3.isMinionRetreating === true, 'Minion 3 entered retreat state');
assert(boss.isMinionRetreating === false, 'Boss itself uses boss isRetreating state, not minion retreat');

// Minion spawn cooldown pause in WaveSystem
assert(gameContext.waveSystem.bossMinionSpawnTimer >= 1.4, 'WaveSystem paused minion spawns during boss retreat');

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
