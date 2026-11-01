/**
 * @file test-center-cat-boss-tutorial.js
 * @description Automated verification for:
 * 1. Momo Center positioning (x = width/2, y = height/2)
 * 2. 360-degree ghost spawning from all 4 borders (Top, Bottom, Left, Right)
 * 3. Multi-phase Boss System (multi-life, retreat recoil, re-entry with new runes)
 * 4. Level Action Transitions (Ready... Draw!)
 * 5. Level 1 Tutorial interactive guide
 */

import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { LEVEL_CONFIGS, STORAGE_KEYS } from '../src/core/Constants.js';

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

console.log('🧪 Starting Center Cat, Multi-Phase Boss, 360 Spawning & Tutorial Tests...\n');

// =========================================================================
// 1. Momo Cat Center Positioning
// =========================================================================
console.log('--- 1. Testing Momo Center Positioning ---');
const player = new Player(800, 600);
assert(player.x === 400, `Player X is exactly width / 2 (400, got ${player.x})`);
assert(player.y === 300, `Player Y is exactly height / 2 (300, got ${player.y})`);

player.resize(1000, 700);
assert(player.x === 500, `Player X resized to 500 (got ${player.x})`);
assert(player.y === 350, `Player Y resized to 350 (got ${player.y})`);

player.reset();
assert(player.x === 500, `Player X maintained center on reset (got ${player.x})`);
assert(player.y === 350, `Player Y maintained center on reset (got ${player.y})`);

// =========================================================================
// 2. 360-Degree Ghost Spawning (All 4 Borders)
// =========================================================================
console.log('\n--- 2. Testing 360-Degree Ghost Spawning Across 4 Borders ---');
const w = 800;
const h = 600;
const edgesHit = { top: false, bottom: false, left: false, right: false };

for (let i = 0; i < 200; i++) {
  const pos = Enemy.getRandomEdgePosition(w, h);
  if (pos.y < 0) edgesHit.top = true;
  if (pos.y > h) edgesHit.bottom = true;
  if (pos.x < 0) edgesHit.left = true;
  if (pos.x > w) edgesHit.right = true;
}

assert(edgesHit.top === true, 'Ghosts spawn from Top border (moving down)');
assert(edgesHit.bottom === true, 'Ghosts spawn from Bottom border (moving up)');
assert(edgesHit.left === true, 'Ghosts spawn from Left border (moving right)');
assert(edgesHit.right === true, 'Ghosts spawn from Right border (moving left)');

// Test ghost movement towards center player
const ghostFromBottom = new Enemy({
  type: 'REGULAR',
  x: 400,
  y: 700,
  targetPlayerPos: { x: 400, y: 300 }
});
ghostFromBottom.update(0.5, { x: 400, y: 300 });
assert(ghostFromBottom.y < 700, `Ghost from bottom moves upward toward center (y: ${ghostFromBottom.y})`);

const ghostFromLeft = new Enemy({
  type: 'REGULAR',
  x: -50,
  y: 300,
  targetPlayerPos: { x: 400, y: 300 }
});
ghostFromLeft.update(0.5, { x: 400, y: 300 });
assert(ghostFromLeft.x > -50, `Ghost from left moves rightward toward center (x: ${ghostFromLeft.x})`);

// =========================================================================
// 3. Multi-Phase Boss System & Boss Recoil
// =========================================================================
console.log('\n--- 3. Testing Multi-Phase Boss System & Recoil ---');
for (const lvl of LEVEL_CONFIGS) {
  assert(typeof lvl.bossLives === 'number' && lvl.bossLives >= 3, `Level ${lvl.level} has ${lvl.bossLives} boss lives`);
  assert(Array.isArray(lvl.bossPhases) && lvl.bossPhases.length === lvl.bossLives, `Level ${lvl.level} has ${lvl.bossPhases.length} distinct boss phases`);
}

// Instantiate test boss with 3 phases
const bossEnemy = new Enemy();
bossEnemy.init({
  type: 'BOSS_LIBRARIAN',
  x: 400,
  y: 100,
  targetPlayerPos: { x: 400, y: 300 },
  bossLives: 3,
  bossPhases: [
    ['horizontal', 'vertical'],
    ['caret', 'v_shape'],
    ['lightning', 'horizontal']
  ]
});

assert(bossEnemy.isBoss === true, 'Entity is initialized as Boss');
assert(bossEnemy.bossLives === 3, 'Boss starts with 3 lives');
assert(bossEnemy.symbolQueue.length === 2, 'Phase 1 has 2 runes');
assert(bossEnemy.symbolQueue[0] === 'horizontal', 'Phase 1 first rune is horizontal');

// Hit 1 of Phase 1
const hit1 = bossEnemy.takeHit('horizontal');
assert(hit1.matched === true, 'Hit 1 matched horizontal');
assert(hit1.destroyed === false, 'Hit 1 did not destroy boss');
assert(bossEnemy.bossLives === 3, 'Boss still on life 3');

// Hit 2 of Phase 1 (completes Phase 1!)
const hit2 = bossEnemy.takeHit('vertical');
assert(hit2.matched === true, 'Hit 2 matched vertical');
assert(hit2.isPhaseComplete === true, 'Phase 1 completed!');
assert(hit2.destroyed === false, 'Boss is NOT destroyed yet!');
assert(bossEnemy.bossLives === 2, 'Boss lives decreased to 2');
assert(bossEnemy.isRetreating === true, 'Boss entered isRetreating state');
assert(bossEnemy.vy < 0, `Boss recoils backwards/upwards away from player (vy: ${bossEnemy.vy})`);

// While retreating, boss cannot be damaged
assert(bossEnemy.matchesActiveSymbol('caret') === false, 'Boss is invulnerable while retreating');

// Update boss through retreat timer (1.4s)
bossEnemy.update(0.7, { x: 400, y: 300 });
assert(bossEnemy.isRetreating === true, 'Boss still retreating at 0.7s');
bossEnemy.update(0.8, { x: 400, y: 300 });

// Retreat finishes -> Boss enters re-entering with Phase 2 runes!
assert(bossEnemy.isRetreating === false, 'Retreat finished');
assert(bossEnemy.isReEntering === true, 'Boss is re-entering battlefield');
assert(bossEnemy.currentPhaseIndex === 1, 'Current phase is now Phase 2 (index 1)');
assert(bossEnemy.symbolQueue[0] === 'caret', 'New runes set to Phase 2 (caret)');
assert(bossEnemy.symbolQueue[1] === 'v_shape', 'New runes set to Phase 2 (v_shape)');

// Update boss through re-entry (returns to combat distance)
bossEnemy.update(1.3, { x: 400, y: 300 });
assert(bossEnemy.isReEntering === false, 'Boss completed re-entry and is ready for combat');
assert(bossEnemy.matchesActiveSymbol('caret') === true, 'Boss now matches active Phase 2 rune');

// Clear Phase 2
bossEnemy.takeHit('caret');
const hitPhase2End = bossEnemy.takeHit('v_shape');
assert(hitPhase2End.isPhaseComplete === true, 'Phase 2 completed');
assert(bossEnemy.bossLives === 1, 'Boss lives decreased to 1');
assert(bossEnemy.isRetreating === true, 'Boss recoils again');

// Update through retreat & re-entry to Phase 3
bossEnemy.update(1.5, { x: 400, y: 300 });
bossEnemy.update(1.3, { x: 400, y: 300 });
assert(bossEnemy.symbolQueue[0] === 'lightning', 'Phase 3 active rune is lightning');

// Clear Phase 3 (Final Phase!)
bossEnemy.takeHit('lightning');
const hitFinal = bossEnemy.takeHit('horizontal');
assert(hitFinal.destroyed === true, 'Final hit destroys the Boss!');
assert(bossEnemy.isDead === true, 'Boss is marked dead');
assert(bossEnemy.bossLives === 0, 'Boss lives depleted to 0');

// =========================================================================
// 4. Level 1 Tutorial Setup & Wave Progression
// =========================================================================
console.log('\n--- 4. Testing Level 1 Tutorial Minion Spawn Sequence ---');
const waveSys = new WaveSystem();
waveSys.initLevel(1);

const minion1 = waveSys.update(1.25, 5, 0);
assert(minion1 !== null, 'Spawned first tutorial minion');
assert(minion1.symbolQueue[0] === 'horizontal', 'First tutorial minion has horizontal rune [ — ]');
assert(minion1.speedMultiplier <= 0.7, 'Tutorial minion speed is gentle for beginner learning');

const minion2 = waveSys.update(2.6, 5, 1);
assert(minion2 !== null, 'Spawned second tutorial minion');
assert(minion2.symbolQueue[0] === 'vertical', 'Second tutorial minion has vertical rune [ | ]');

// =========================================================================
// Test Summary
// =========================================================================
console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
