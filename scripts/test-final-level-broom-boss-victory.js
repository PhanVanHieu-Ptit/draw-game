/**
 * @file test-final-level-broom-boss-victory.js
 * @description Comprehensive test suite validating:
 * 1. Momo riding Magic Flying Broomstick (chổi thần bay giữa không trung)
 * 2. Colossal Demon Master Boss taking up 1/4 of the screen (to bằng 1/4 màn hình)
 * 3. Immediate Boss presence and continuous minion spawning in Level 5 (luôn xuất hiện & quỷ nhỏ ra liên tục)
 * 4. Stolen Ancient Spellbook dropping on Boss defeat & Momo recovering it
 * 5. Animated Victory Scene: Castle landing & Friends tossing Momo up in celebration (đáp xuống thành, bạn bè tung hô)
 */

import { Player } from '../src/entities/Player.js';
import { Enemy } from '../src/entities/Enemy.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';
import { StoryCanvasRenderer } from '../src/ui/StoryCanvasRenderer.js';
import { LEVEL_CONFIGS, ENEMY_TYPES } from '../src/core/Constants.js';

function createMockCanvas(width = 800, height = 600) {
  const noop = () => {};
  return {
    width,
    height,
    getContext: () => ({
      save: noop,
      restore: noop,
      translate: noop,
      rotate: noop,
      scale: noop,
      beginPath: noop,
      closePath: noop,
      moveTo: noop,
      lineTo: noop,
      bezierCurveTo: noop,
      quadraticCurveTo: noop,
      arc: noop,
      ellipse: noop,
      fill: noop,
      stroke: noop,
      fillRect: noop,
      strokeRect: noop,
      clearRect: noop,
      rect: noop,
      fillText: noop,
      strokeText: noop,
      setLineDash: noop,
      drawImage: noop,
      createLinearGradient: () => ({ addColorStop: noop }),
      createRadialGradient: () => ({ addColorStop: noop })
    })
  };
}

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

console.log('🧪 Starting Final Level Broom, Colossal Boss & Victory Celebration Tests...\n');

// =========================================================================
// 1. MOMO ON MAGIC FLYING BROOMSTICK
// =========================================================================
console.log('--- 1. Testing Momo on Magic Flying Broomstick ---');
const player = new Player(800, 600);
assert(player.isRidingBroom === false, 'Player starts with broom unequipped in normal levels');

player.setRidingBroom(true);
assert(player.isRidingBroom === true, 'player.setRidingBroom(true) equips the magic broomstick');

player.update(0.016, []);
assert(player.isRidingBroom === true, 'Broom status remains active after update');

const mockCanvas = createMockCanvas(800, 600);
const mockCtx = mockCanvas.getContext('2d');
try {
  player.render(mockCtx);
  assert(true, 'Rendered Momo flying on magic broomstick without errors');
} catch (err) {
  assert(false, `Failed rendering Momo with broom: ${err.message}`);
}

player.reset();
assert(player.isRidingBroom === false, 'player.reset() resets broom state back to false');

// =========================================================================
// 2. COLOSSAL DEMON BOSS MASTER (1/4 OF THE SCREEN)
// =========================================================================
console.log('\n--- 2. Testing Colossal Demon Boss Master (1/4 of Screen) ---');
const masterBoss = new Enemy({
  type: 'BOSS_MASTER',
  canvasWidth: 1000,
  canvasHeight: 700,
  symbolQueue: ['lightning', 'horizontal', 'vertical', 'caret', 'v_shape'],
  targetPlayerPos: { x: 500, y: 350 }
});

assert(masterBoss.isBoss === true, 'Boss Master is recognized as Boss entity');
assert(masterBoss.radius >= 130, `Boss Master has colossal radius (${masterBoss.radius}px >= 130px) occupying ~1/4 of screen`);

// Verify hover kinematics in upper sky
const initialY = 180;
masterBoss.x = 500;
masterBoss.y = initialY;
masterBoss.update(0.05, { x: 500, y: 350 });

assert(masterBoss.y <= 350 * 0.7, `Boss Master stays hovering in upper sky (y=${Math.round(masterBoss.y)}px above player at y=350px)`);

try {
  masterBoss.render(mockCtx);
  assert(true, 'Rendered Colossal Boss Master with demon wings, horns, and ancient spellbook without errors');
} catch (err) {
  assert(false, `Failed rendering Colossal Boss Master: ${err.message}`);
}

// =========================================================================
// 3. LEVEL 5 IMMEDIATE BOSS PRESENCE & CONTINUOUS MINION SWARM
// =========================================================================
console.log('\n--- 3. Testing Level 5 Immediate Boss & Continuous Minions ---');
const waveSys = new WaveSystem();
let bossSpawnedEvent = false;
let spawnedBossName = '';
waveSys.onBossSpawn = (type, name) => {
  bossSpawnedEvent = true;
  spawnedBossName = name;
};

waveSys.initLevel(5);
assert(waveSys.currentLevelIndex === 5, 'Level 5 active');
assert(waveSys.isBossSpawned === false, 'Boss initially preparing for immediate spawn');

// Advance time slightly (spawnTimer is 0.4s for immediate level 5 appearance)
let spawnedEntity = null;
for (let t = 0; t < 10; t++) {
  const result = waveSys.update(0.1, 5, 0);
  if (result) {
    spawnedEntity = result;
    break;
  }
}

assert(waveSys.isBossSpawned === true, 'Giant Demon Boss spawned immediately on Level 5 start ("luôn xuất hiện ở đó")');
assert(spawnedEntity !== null && spawnedEntity.isBoss === true, 'Spawned entity is Level 5 Boss');
assert(spawnedEntity.archetype === 'BOSS_MASTER', 'Spawned entity archetype is BOSS_MASTER');
assert(bossSpawnedEvent === true, 'onBossSpawn hook triggered on immediate Level 5 Boss entrance');

// While Boss is alive, small minions continue spawning continuously ("các con nhỏ cứ xuất hiện liên tục")
let minionCount = 0;
for (let step = 0; step < 30; step++) {
  // livingEnemiesCount = 1 (just the Boss alive, no minions currently on screen)
  const minionConfig = waveSys.update(0.2, 5, 1);
  if (minionConfig && !minionConfig.isBoss) {
    minionCount++;
  }
}

assert(minionCount >= 2, `Minions spawn continuously while Boss is alive (spawned ${minionCount} minions)`);

// =========================================================================
// 4. BOSS DEFEAT & INTERMISSION TIMING FOR RECOVERING SPELLBOOK
// =========================================================================
console.log('\n--- 4. Testing Boss Defeat & Intermission Timing ---');
let victoryTriggered = false;
waveSys.onGameVictory = () => {
  victoryTriggered = true;
};

waveSys.notifyBossDefeated();
assert(waveSys.isBossDefeated === true, 'Boss defeated flag is true');
assert(waveSys.intermissionTimer >= 4.0, `Intermission timer allows 4.2s for spellbook falling & landing (timer=${waveSys.intermissionTimer}s)`);

// Fast forward 4.5s
waveSys.update(4.5, 5, 0);
assert(victoryTriggered === true, 'onGameVictory triggered after spellbook recovery & descent');

// =========================================================================
// 5. ANIMATED VICTORY CUTSCENE (CASTLE LANDING & FRIENDS TOSSING MOMO UP)
// =========================================================================
console.log('\n--- 5. Testing Victory Canvas Scene (Landing & Cheering Celebration) ---');
const victoryCanvas = createMockCanvas(560, 260);

for (const t of [0.5, 1.5, 3.0, 5.2]) {
  try {
    StoryCanvasRenderer.renderVictory(victoryCanvas, t);
    assert(true, `Rendered Victory Scene at t=${t}s (Castle, Friends & Momo tossing) without errors`);
  } catch (err) {
    assert(false, `Failed rendering Victory Scene at t=${t}s: ${err.message}`);
  }
}

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
}
