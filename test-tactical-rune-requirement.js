/**
 * @file test-tactical-rune-requirement.js
 * @description Verifies that drawing circle (freeze) and spiral (knockback) ONLY takes effect
 * when a Freeze Ghost or Blast Ghost is present on the battlefield.
 */

import { Game } from './src/core/Game.js';
import { Enemy } from './src/entities/Enemy.js';
import { GAME_STATES } from './src/core/Constants.js';

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

// Mock DOM elements and Canvas for Node test environment
global.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener: () => {},
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

global.document = {
  addEventListener: () => {},
  createElement: () => ({
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
      createRadialGradient: () => ({ addColorStop: () => {} }),
      measureText: () => ({ width: 10 })
    }),
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    appendChild: () => {},
    width: 100,
    height: 100
  }),
  getElementById: () => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {} },
    innerText: '',
    textContent: '',
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  }),
  querySelectorAll: () => [],
  querySelector: () => null
};

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
    createRadialGradient: () => ({ addColorStop: () => {} }),
    measureText: () => ({ width: 10 })
  }),
  parentElement: { clientWidth: 1280, clientHeight: 720 },
  width: 1280,
  height: 720,
  style: {},
  addEventListener: () => {}
};

console.log('🧪 Starting Tactical Rune Presence Requirement Verification Tests...\n');

const game = new Game(mockCanvas);
// Transition directly to PLAYING state
game.stateMachine.changeState(GAME_STATES.PLAYING);

// Test 1: Only normal enemies on battlefield (NO Freeze Ghost, NO Blast Ghost)
console.log('--- 1. Testing Circle / Spiral when NO Freeze/Blast Ghost is Present ---');

const normalEnemy = new Enemy({
  type: 'REGULAR',
  x: 400,
  y: 300,
  symbolQueue: ['horizontal', 'vertical']
});
game.enemies = [normalEnemy];

// Player draws circle (freeze)
assert(game.freezeOverlayTimer === 0, 'Initially freezeOverlayTimer is 0');
assert(normalEnemy.isFrozen === false, 'Normal enemy is initially unfrozen');

game.onGestureRecognized({ gesture: 'circle', score: 0.95 });

assert(game.freezeOverlayTimer === 0, 'Drawing circle with NO freeze ghost DOES NOT trigger freeze overlay');
assert(normalEnemy.isFrozen === false, 'Drawing circle with NO freeze ghost DOES NOT freeze enemies');
assert(game.comboCount === 0, 'Combo broken / fizzled on unmatched circle gesture');

// Player draws spiral (knockback)
const initialKnockbackTimer = normalEnemy.knockbackTimer;
assert(initialKnockbackTimer === 0, 'Normal enemy has knockbackTimer = 0');

game.onGestureRecognized({ gesture: 'spiral', score: 0.92 });

assert(normalEnemy.knockbackTimer === 0, 'Drawing spiral with NO blast ghost DOES NOT knockback enemies');
assert(game.comboCount === 0, 'Combo broken / fizzled on unmatched spiral gesture');

// Test 2: Freeze Ghost IS on battlefield
console.log('\n--- 2. Testing Circle when Freeze Ghost IS Present ---');

const freezeGhost = new Enemy({
  type: 'FREEZE',
  x: 500,
  y: 350,
  isFreezeGhost: true,
  symbolQueue: ['circle']
});
game.enemies.push(freezeGhost);

assert(freezeGhost.matchesActiveSymbol('circle') === true, 'Freeze ghost active symbol matches circle');

game.onGestureRecognized({ gesture: 'circle', score: 0.96 });

assert(game.freezeOverlayTimer > 0, 'Drawing circle with Freeze Ghost present ACTIVATES freeze overlay (4.5s)');
assert(normalEnemy.isFrozen === true, 'Enemies are frozen when Freeze Ghost is banished');
assert(game.comboCount === 1, 'Combo increases on matching circle gesture');
assert(game.projectiles.length > 0, 'Projectile fired towards Freeze Ghost');

// Test 3: Blast Ghost IS on battlefield
console.log('\n--- 3. Testing Spiral when Blast Ghost IS Present ---');

// Reset enemies
const normalEnemy2 = new Enemy({
  type: 'REGULAR',
  x: 350,
  y: 350,
  symbolQueue: ['vertical']
});
const blastGhost = new Enemy({
  type: 'BLAST',
  x: 600,
  y: 400,
  isBlastGhost: true,
  symbolQueue: ['spiral']
});
game.enemies = [normalEnemy2, blastGhost];
game.projectiles = [];
normalEnemy2.knockbackTimer = 0;

assert(blastGhost.matchesActiveSymbol('spiral') === true, 'Blast ghost active symbol matches spiral');

game.onGestureRecognized({ gesture: 'spiral', score: 0.94 });

assert(normalEnemy2.knockbackTimer > 0, 'Enemies are knocked back when Blast Ghost is triggered');
assert(game.comboCount === 2, 'Combo increases on matching spiral gesture');
assert(game.projectiles.length > 0, 'Projectile fired towards Blast Ghost');

console.log(`\n========================================`);
console.log(`Tactical Requirement Tests: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) process.exit(1);
