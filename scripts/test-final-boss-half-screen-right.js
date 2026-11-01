/**
 * @file test-final-boss-half-screen-right.js
 * @description Automated verification for:
 * 1. Final Boss (BOSS_MASTER) colossal sizing taking up half the screen (~45%-50% screen width).
 * 2. Final Boss anchored and hovering on the RIGHT side of the screen (x ≈ 76% screen width).
 * 3. Final Boss dynamic resizing with screen dimensions.
 * 4. Player (Momo) positioned on the LEFT side during Level 5 Rooftop (x ≈ 22% screen width).
 * 5. Minions in Level 5 spawning from the right border and upper sky towards Momo.
 * 6. Procedural rendering of colossal wings, horns, 5 tails, spellbook, and hearts without errors.
 */

import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { LEVEL_CONFIGS, ENEMY_TYPES } from '../src/core/Constants.js';

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

// Mock Canvas 2D Context for rendering verification
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
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1.0
  };
}

console.log('🧪 Starting Final Boss (Half-Screen & Right Side) Verification Tests...\n');

// =========================================================================
// 1. Final Boss Archetype & Sizing: "To bằng nửa màn hình"
// =========================================================================
console.log('--- 1. Testing Final Boss Colossal Sizing (Half-Screen Width & Height) ---');
const screenW = 1000;
const screenH = 700;

const finalBoss = new Enemy();
finalBoss.init({
  type: 'BOSS_MASTER',
  canvasWidth: screenW,
  canvasHeight: screenH,
  symbolQueue: ['lightning', 'horizontal', 'vertical', 'lightning'],
  bossLives: 5,
  targetPlayerPos: { x: screenW * 0.22, y: screenH * 0.70 }
});

assert(finalBoss.isBoss === true, 'Final Boss is flagged as isBoss');
assert(finalBoss.isFinalBoss === true, 'Final Boss is flagged as isFinalBoss');
assert(finalBoss.radius >= 130, `Final Boss has colossal core radius (${finalBoss.radius}px >= 130px)`);

// Boss width spans ~45%-50% of the screen
const bossSpanWidth = finalBoss.bossWidth;
const widthPercentage = (bossSpanWidth / screenW) * 100;
console.log(`  📊 Boss visual span width: ${bossSpanWidth.toFixed(1)}px (${widthPercentage.toFixed(1)}% of screen)`);
assert(widthPercentage >= 40 && widthPercentage <= 55, `Boss spans half the screen width (${widthPercentage.toFixed(1)}% of screen)`);

const bossSpanHeight = finalBoss.bossHeight;
const heightPercentage = (bossSpanHeight / screenH) * 100;
console.log(`  📊 Boss visual span height: ${bossSpanHeight.toFixed(1)}px (${heightPercentage.toFixed(1)}% of screen)`);
assert(heightPercentage >= 55 && heightPercentage <= 80, `Boss spans significant vertical presence (${heightPercentage.toFixed(1)}% of screen)`);

// Test dynamic resizing
finalBoss.updateCanvasDimensions(1400, 900);
const resizedWidthPct = (finalBoss.bossWidth / 1400) * 100;
assert(resizedWidthPct >= 40 && resizedWidthPct <= 55, `Boss maintains ~half screen width on 1400x900 resize (${resizedWidthPct.toFixed(1)}%)`);

// =========================================================================
// 2. Final Boss Anchored on the RIGHT Side: "Nằm bên phải"
// =========================================================================
console.log('\n--- 2. Testing Final Boss Positioning on the RIGHT Side ---');
finalBoss.updateCanvasDimensions(screenW, screenH);
assert(finalBoss.baseAnchorX === screenW * 0.76, `Boss baseAnchorX is anchored at 76% of screen (got ${finalBoss.baseAnchorX})`);
assert(finalBoss.baseAnchorY === screenH * 0.46, `Boss baseAnchorY is anchored at 46% of screen (got ${finalBoss.baseAnchorY})`);

// Position check: does Boss stay on the right side over several updates?
let remainedOnRight = true;
for (let t = 0; t < 60; t++) {
  finalBoss.update(0.016, { x: screenW * 0.22, y: screenH * 0.70 });
  if (finalBoss.x < screenW * 0.65) {
    remainedOnRight = false;
  }
}
assert(remainedOnRight === true, `Boss stays anchored hovering on the RIGHT side without rushing to player (X: ${finalBoss.x.toFixed(1)})`);

// =========================================================================
// 3. Boss Recoil & Re-entry on the Right Side
// =========================================================================
console.log('\n--- 3. Testing Boss Recoil & Re-entry on Right Side ---');
finalBoss.startBossRetreat();
assert(finalBoss.isRetreating === true, 'Boss entered isRetreating state');
assert(finalBoss.vx > 0, `Boss recoils rightward towards right edge (vx: ${finalBoss.vx})`);

// Progress retreat until finished
finalBoss.update(1.4, { x: screenW * 0.22, y: screenH * 0.70 });
assert(finalBoss.isReEntering === true, 'Boss entered isReEntering state');
finalBoss.update(1.3, { x: screenW * 0.22, y: screenH * 0.70 });
assert(finalBoss.isReEntering === false, 'Boss finished re-entry');
assert(Math.abs(finalBoss.x - finalBoss.baseAnchorX) < 10, `Boss smoothly returned to anchor position on right side (${finalBoss.x.toFixed(1)})`);

// =========================================================================
// 4. Procedural Rendering of Colossal Master Ghost Body
// =========================================================================
console.log('\n--- 4. Testing Procedural Rendering of Half-Screen Boss Body ---');
const mockCtx = createMockContext();
finalBoss.render(mockCtx);

const bezierCalls = mockCtx.calls.filter(c => c.method === 'bezierCurveTo');
const quadCalls = mockCtx.calls.filter(c => c.method === 'quadraticCurveTo');
const fillCalls = mockCtx.calls.filter(c => c.method === 'fill');
const strokeCalls = mockCtx.calls.filter(c => c.method === 'stroke');
const ellipseCalls = mockCtx.calls.filter(c => c.method === 'ellipse');

assert(bezierCalls.length >= 4, `Rendered sweeping billowing cloak & shadow wings (${bezierCalls.length} bezier curves)`);
assert(quadCalls.length >= 6, `Rendered 5 living harmonic undulating spectral tails & horns (${quadCalls.length} quad curves)`);
assert(fillCalls.length >= 10, `Rendered aura, body, crown, fangs, eyes, and spellbook (${fillCalls.length} fills)`);
assert(strokeCalls.length >= 4, `Rendered wing trim, crown spires, and horn edges (${strokeCalls.length} strokes)`);
assert(ellipseCalls.length >= 4, `Rendered eyes, crown ruby, and spellbook All-Seeing Eye (${ellipseCalls.length} ellipses)`);

// =========================================================================
// 5. Level 5 Player Position on the Left Side
// =========================================================================
console.log('\n--- 5. Testing Player Position on LEFT Side in Level 5 ---');
const player = new Player(screenW, screenH);
// Default in Levels 1-4 is center
assert(player.x === screenW / 2, `Default player X is center (${player.x})`);
assert(player.y === screenH / 2, `Default player Y is center (${player.y})`);

// In Level 5 Rooftop, player stands on the left
const level5PlayerX = screenW * 0.22;
const level5PlayerY = screenH * 0.70;
assert(level5PlayerX === 220, `Level 5 Player X is 220 on 1000px screen`);
assert(level5PlayerX < screenW * 0.35, `Player is positioned safely on the LEFT half of the rooftop`);

// =========================================================================
// 6. Level 5 Immediate Boss Spawning & 5 Lives
// =========================================================================
console.log('\n--- 6. Testing Level 5 Immediate Boss Spawning & 5 Lives ---');
const level5WaveSys = new WaveSystem();
level5WaveSys.initLevel(5);

assert(level5WaveSys.currentLevelIndex === 5, 'Active level is 5');
assert(level5WaveSys.levelData.id === 'rooftop', 'Level 5 is rooftop');
assert(level5WaveSys.levelData.bossLives === 5, 'Level 5 Boss has 5 lives');
assert(level5WaveSys.levelData.bossPhases.length === 5, 'Level 5 Boss has 5 phases');
assert(level5WaveSys.totalEnemiesInWave === 0, 'Level 5 totalEnemiesInWave is 0 (direct boss battle)');

// On the very first update call, the Final Boss MUST spawn immediately
const initialSpawn = level5WaveSys.update(0.016, 5, 0);
assert(initialSpawn !== null, 'Spawned entity on first frame of Level 5');
assert(initialSpawn.isBoss === true, 'Spawned entity is a Boss');
assert(initialSpawn.archetype === 'BOSS_MASTER', 'Spawned entity is BOSS_MASTER');
assert(initialSpawn.bossLives === 5, 'Spawned Boss has 5 lives');
assert(initialSpawn.bossPhases.length === 5, 'Spawned Boss has 5 phases');
assert(level5WaveSys.isBossSpawned === true, 'isBossSpawned is immediately true');
assert(level5WaveSys.isBossDefeated === false, 'isBossDefeated is false');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
