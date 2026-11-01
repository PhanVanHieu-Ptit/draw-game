/**
 * @file test-doodle-levels-story.js
 * @description Comprehensive automated verification for Google Doodle 2016 5-Level & Story System.
 */

import { LEVEL_CONFIGS, STORY_SLIDES, ENEMY_TYPES } from './src/core/Constants.js';
import { WaveSystem } from './src/systems/WaveSystem.js';
import { BackgroundRenderer } from './src/systems/BackgroundRenderer.js';
import { StoryCanvasRenderer } from './src/ui/StoryCanvasRenderer.js';
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

console.log('🧪 Starting Google Doodle 2016 5-Level & Story Verification Tests...\n');

// Mock Canvas 2D Context for Node.js
function createMockCanvas(width = 800, height = 600) {
  const gradientMock = { addColorStop: () => {} };
  const ctx = {
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    rect: () => {},
    fillRect: () => {},
    strokeRect: () => {},
    stroke: () => {},
    fill: () => {},
    clearRect: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    setLineDash: () => {},
    fillText: () => {},
    measureText: () => ({ width: 50 }),
    createLinearGradient: () => gradientMock,
    createRadialGradient: () => gradientMock,
    fillStyle: '#000000',
    strokeStyle: '#000000',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    lineCap: 'butt',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'left',
    textBaseline: 'top'
  };

  return {
    width,
    height,
    getContext: () => ctx
  };
}

// -------------------------------------------------------------------------
// 1. LEVEL CONFIGURATIONS & STORY SLIDES
// -------------------------------------------------------------------------
console.log('--- 1. Testing Google Doodle 2016 Level Configurations ---');
assert(Array.isArray(LEVEL_CONFIGS) && LEVEL_CONFIGS.length === 5, 'Exactly 5 levels defined matching Google Doodle 2016');
assert(LEVEL_CONFIGS[0].id === 'library', 'Level 1 is The Library (Thư viện cổ kính)');
assert(LEVEL_CONFIGS[1].id === 'cafeteria', 'Level 2 is The Cafeteria (Phòng ăn & Nhà bếp)');
assert(LEVEL_CONFIGS[2].id === 'classroom', 'Level 3 is The Classroom (Lớp học thiên văn)');
assert(LEVEL_CONFIGS[3].id === 'gymnasium', 'Level 4 is The Gymnasium (Nhà thể thao)');
assert(LEVEL_CONFIGS[4].id === 'rooftop', 'Level 5 is The Rooftop (Sân thượng lâu đài)');

assert(LEVEL_CONFIGS[0].bossType === 'BOSS_LIBRARIAN', 'Level 1 Boss is Librarian Ghost');
assert(LEVEL_CONFIGS[1].bossType === 'BOSS_CHEF', 'Level 2 Boss is Chef Ghost');
assert(LEVEL_CONFIGS[2].bossType === 'BOSS_PLANETARIUM', 'Level 3 Boss is Astronomy/Planetarium Ghost');
assert(LEVEL_CONFIGS[3].bossType === 'BOSS_COACH', 'Level 4 Boss is Coach Ghost');
assert(LEVEL_CONFIGS[4].bossType === 'BOSS_MASTER', 'Level 5 Boss is Master Ghost (Final Boss)');

assert(Array.isArray(STORY_SLIDES.INTRO) && STORY_SLIDES.INTRO.length === 3, 'Intro story has 3 sequential cinematic slides');
assert(Array.isArray(STORY_SLIDES.VICTORY) && STORY_SLIDES.VICTORY.length === 3, 'Victory story has 3 resolution slides');

// -------------------------------------------------------------------------
// 2. BOSS ARCHETYPES & VISUAL ENTITY CONFIG
// -------------------------------------------------------------------------
console.log('\n--- 2. Testing Boss Archetypes & Entity Properties ---');
const bossTypes = ['BOSS_LIBRARIAN', 'BOSS_CHEF', 'BOSS_PLANETARIUM', 'BOSS_COACH', 'BOSS_MASTER'];

for (const bType of bossTypes) {
  const enemy = new Enemy({ type: bType, symbolQueue: ['horizontal', 'vertical', 'lightning'] });
  assert(enemy.isBoss === true, `${bType} has isBoss flag set to true`);
  assert(enemy.radius >= 50, `${bType} has appropriately large boss radius (${enemy.radius}px)`);
  assert(enemy.oscillationFrequency === 1.8, `${bType} uses heavy boss oscillation frequency`);
}

// -------------------------------------------------------------------------
// 3. PROGRESSIVE 5-LEVEL WAVE SYSTEM FLOW & BOSS SPAWNING
// -------------------------------------------------------------------------
console.log('\n--- 3. Testing 5-Level Progression & Boss Battle Flow ---');
const waveSys = new WaveSystem();
assert(waveSys.currentLevelIndex === 1, 'WaveSystem starts at Level 1');
assert(waveSys.levelData.id === 'library', 'Level 1 data loaded correctly');
assert(waveSys.isBossSpawned === false, 'Boss initially not spawned');

// Fast-forward spawning all minions in Level 1
let spawnedMinions = 0;
while (spawnedMinions < waveSys.totalEnemiesInWave) {
  const config = waveSys.update(0.01, 5, 1);
  if (config) spawnedMinions++;
}
assert(spawnedMinions === waveSys.totalEnemiesInWave, `Spawned all ${waveSys.totalEnemiesInWave} minions in Level 1`);

// When all minions are destroyed (livingEnemiesCount === 0), Boss must spawn!
let bossSpawnEventFired = false;
waveSys.onBossSpawn = (type, name) => {
  bossSpawnEventFired = true;
};

const bossConfig = waveSys.update(0.01, 5, 0);
assert(bossConfig !== null, 'Spawned Level 1 Boss after minion wave cleared');
assert(bossConfig.isBoss === true, 'Spawned entity has isBoss: true');
assert(bossConfig.archetype === 'BOSS_LIBRARIAN', 'Level 1 Boss is BOSS_LIBRARIAN');
assert(bossSpawnEventFired === true, 'onBossSpawn event triggered with Boss details');
assert(waveSys.isBossSpawned === true, 'isBossSpawned flag set to true');

// When Boss is eliminated
let levelCompleteFired = false;
waveSys.onLevelComplete = (lvlNum, lvlData) => {
  levelCompleteFired = true;
};

waveSys.update(0.01, 5, 0); // living count is 0 with boss defeated
assert(waveSys.isIntermission === true, 'Level entered intermission after Boss defeated');
assert(levelCompleteFired === true, 'onLevelComplete hook triggered');

// Fast forward intermission to advance to Level 2
waveSys.update(3.0, 5, 0);
assert(waveSys.currentLevelIndex === 2, 'Advanced to Level 2 (The Cafeteria)');
assert(waveSys.levelData.id === 'cafeteria', 'Level 2 cafeteria data active');

// Advance straight to Level 5 (The Rooftop)
waveSys.initLevel(5);
assert(waveSys.currentLevelIndex === 5, 'Jumped to Level 5');
assert(waveSys.levelData.id === 'rooftop', 'Level 5 Rooftop active');
assert(waveSys.levelData.bossType === 'BOSS_MASTER', 'Level 5 boss is Master Ghost');

// -------------------------------------------------------------------------
// 4. BACKGROUND RENDERER ENVIRONMENTS (5 STAGES)
// -------------------------------------------------------------------------
console.log('\n--- 4. Testing 5-Stage Background Renderer ---');
const bgRenderer = new BackgroundRenderer();
const mockCanvas = createMockCanvas(1280, 720);
const mockCtx = mockCanvas.getContext('2d');

for (let lvl = 1; lvl <= 5; lvl++) {
  try {
    bgRenderer.render(mockCtx, 1280, 720, lvl, 1.5);
    assert(true, `Rendered Level ${lvl} (${LEVEL_CONFIGS[lvl - 1].enName}) without errors`);
  } catch (err) {
    assert(false, `Failed rendering Level ${lvl}: ${err.message}`);
  }
}

// -------------------------------------------------------------------------
// 5. STORY CANVAS COMIC ILLUSTRATION RENDERER
// -------------------------------------------------------------------------
console.log('\n--- 5. Testing Story Canvas Cutscene Renderer ---');
const storyCanvas = createMockCanvas(480, 240);

for (let slide = 0; slide < 3; slide++) {
  try {
    StoryCanvasRenderer.renderSlide(storyCanvas, slide, 1.0);
    assert(true, `Rendered Story Slide ${slide + 1}/3 without errors`);
  } catch (err) {
    assert(false, `Failed rendering Story Slide ${slide}: ${err.message}`);
  }
}

try {
  StoryCanvasRenderer.renderVictory(storyCanvas, 2.0);
  assert(true, 'Rendered Victory scene without errors');
} catch (err) {
  assert(false, `Failed rendering Victory scene: ${err.message}`);
}

// -------------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------------
console.log('\n========================================');
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
