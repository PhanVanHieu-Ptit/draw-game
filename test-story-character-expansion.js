/**
 * @file test-story-character-expansion.js
 * @description Automated verification test suite for Expanded Story, Diverse Characters, In-Game Dialogue, and Codex.
 */

import { LEVEL_CONFIGS, STORY_SLIDES, STORY_CHAPTERS, ACADEMY_CHARACTERS } from './src/core/Constants.js';
import { StoryCanvasRenderer } from './src/ui/StoryCanvasRenderer.js';

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

console.log('🧪 Starting Story & Character Expansion Verification Tests...\n');

// 1. ACADEMY_CHARACTERS Cast Verification
console.log('--- 1. Testing Academy Character Roster & Diversity ---');
assert(Array.isArray(ACADEMY_CHARACTERS), 'ACADEMY_CHARACTERS is exported as an array');
assert(ACADEMY_CHARACTERS.length === 10, `ACADEMY_CHARACTERS contains 10 rich characters (found ${ACADEMY_CHARACTERS.length})`);

const allies = ACADEMY_CHARACTERS.filter(c => c.faction === 'ally');
const spirits = ACADEMY_CHARACTERS.filter(c => c.faction === 'spirit');
assert(allies.length === 5, 'Exactly 5 academy allies (Momo, Oliver, Luna, Nyx, Barnaby)');
assert(spirits.length === 5, 'Exactly 5 spirits/bosses (Madame Libraria, Chef Bouillon, Professor Stella, Coach Striker, Lord Umbra)');

const requiredKeys = ['id', 'name', 'title', 'faction', 'icon', 'themeColor', 'element', 'quote', 'bio'];
for (const char of ACADEMY_CHARACTERS) {
  const missingKeys = requiredKeys.filter(k => !char[k]);
  assert(missingKeys.length === 0, `Character ${char.name} has complete profile (missing: ${missingKeys.join(', ') || 'none'})`);
}

// 2. LEVEL_CONFIGS Lore & Dialogue Hooks
console.log('\n--- 2. Testing Level Narrative Dialogue Hooks ---');
assert(LEVEL_CONFIGS.length === 5, '5 level configurations active');

for (const lvl of LEVEL_CONFIGS) {
  assert(lvl.companion && typeof lvl.companion === 'object', `Level ${lvl.level} (${lvl.name}) has an assigned companion`);
  assert(typeof lvl.companion.name === 'string' && lvl.companion.name.length > 0, `Level ${lvl.level} companion has a name: ${lvl.companion.name}`);
  assert(typeof lvl.storyIntroQuote === 'string' && lvl.storyIntroQuote.length > 0, `Level ${lvl.level} has storyIntroQuote`);
  assert(typeof lvl.bossSpawnQuote === 'string' && lvl.bossSpawnQuote.length > 0, `Level ${lvl.level} has bossSpawnQuote`);
  assert(typeof lvl.bossDefeatQuote === 'string' && lvl.bossDefeatQuote.length > 0, `Level ${lvl.level} has bossDefeatQuote`);
}

// 3. STORY_SLIDES Lore Expansion
console.log('\n--- 3. Testing Story Slides Expanded Lore ---');
assert(STORY_SLIDES.INTRO.length === 3, 'Intro cutscene maintains 3 slides for pacing');
assert(STORY_SLIDES.VICTORY.length === 3, 'Victory cutscene maintains 3 slides for resolution');

assert(STORY_SLIDES.INTRO[0].text.includes('Oliver') && STORY_SLIDES.INTRO[0].text.includes('Nhật Thực'), 'Intro slide 1 introduces Oliver and Grimoire of Whispering Eclipse');
assert(STORY_SLIDES.INTRO[2].text.includes('Luna') && STORY_SLIDES.INTRO[2].text.includes('Nyx'), 'Intro slide 3 rallies all friends (Luna, Nyx, Barnaby)');
assert(STORY_SLIDES.VICTORY[0].text.includes('Umbra'), 'Victory slide 1 details the redemption of Lord Umbra');

// 4. Mock Canvas Rendering of Enhanced Slides
console.log('\n--- 4. Testing StoryCanvasRenderer with Companion Illustrations ---');
function createMockCanvas(width = 480, height = 240) {
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
  return { width, height, getContext: () => ctx };
}

const mockCanvas = createMockCanvas();
for (let i = 0; i < 3; i++) {
  try {
    StoryCanvasRenderer.renderSlide(mockCanvas, i, 1.25);
    assert(true, `Rendered Slide ${i + 1} with enhanced character visuals without errors`);
  } catch (err) {
    assert(false, `Failed rendering Slide ${i}: ${err.message}`);
  }
}

// 5. STORY_CHAPTERS 5 Acts Verification
console.log('\n--- 5. Testing 5 Story Chapters Replay & Scenes ---');
assert(Array.isArray(STORY_CHAPTERS) && STORY_CHAPTERS.length === 5, 'STORY_CHAPTERS defines all 5 replayable chapters');

for (let chap = 1; chap <= 5; chap++) {
  const c = STORY_CHAPTERS[chap - 1];
  assert(c.chapter === chap, `Chapter ${chap} defined correctly`);
  assert(typeof c.title === 'string' && c.title.length > 0, `Chapter ${chap} has title: ${c.title}`);
  assert(c.quotes && c.quotes.intro && c.quotes.boss, `Chapter ${chap} contains quotes for story callouts`);

  try {
    StoryCanvasRenderer.renderSlide(mockCanvas, c.slideIndex, 1.5);
    assert(true, `Rendered Chapter ${chap} scene (slide ${c.slideIndex}) without errors`);
  } catch (err) {
    assert(false, `Failed rendering Chapter ${chap} scene: ${err.message}`);
  }
}

console.log('\n========================================');
console.log(`Total Verification: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
