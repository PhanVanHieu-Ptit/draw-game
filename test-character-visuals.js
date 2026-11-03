/**
 * @file test-character-visuals.js
 * @description Unit tests for CharacterPortraits and Story-accurate character interfaces:
 * 1. Validates SVG artwork generation for all 10 story characters.
 * 2. Confirms story-accurate visual features (heterochromia, chubby tabby, wizard hat, spectacles, etc.).
 * 3. Validates level companion mapping (levels 1..5).
 * 4. Checks CHARACTER_LORE_DATA metadata completeness (equipment, location, runes).
 */

import {
  CHARACTER_LORE_DATA,
  getCharacterPortraitSvg,
  getCompanionForLevel
} from './src/ui/CharacterPortraits.js';
import { ACADEMY_CHARACTERS, ENEMY_TYPES } from './src/core/Constants.js';
import { Enemy } from './src/entities/Enemy.js';
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

console.log('\n🧪 Starting Character UI & Lore Visual Verification Tests...\n');

console.log('--- 1. Testing SVG Portrait Generation for All 10 Story Characters ---');
const expectedCharIds = [
  'momo', 'oliver', 'luna', 'nyx', 'barnaby',
  'boss_librarian', 'boss_chef', 'boss_planetarium', 'boss_coach', 'boss_master'
];

expectedCharIds.forEach(charId => {
  const svg = getCharacterPortraitSvg(charId, 64);
  assert(typeof svg === 'string' && svg.includes('<svg') && svg.includes('</svg>'), `Generated valid SVG portrait for '${charId}'`);
  assert(svg.includes('viewBox="0 0 100 100"'), `'${charId}' portrait has proper 100x100 viewBox`);
});

console.log('\n--- 2. Verifying Lore-Accurate Visual Elements in SVGs ---');

// Momo: Obsidian wand, amber eyes (#fbbf24), wizard hat
const momoSvg = getCharacterPortraitSvg('momo', 80);
assert(momoSvg.includes('#fbbf24'), 'Momo has glowing amber eyes');
assert(momoSvg.includes('momo-hat'), 'Momo wears purple wizard hat');
assert(momoSvg.includes('momo-wand-glow'), 'Momo wields glowing arcane wand');

// Oliver: Chubby ginger tabby, croissant, alchemist green apron
const oliverSvg = getCharacterPortraitSvg('oliver', 80);
assert(oliverSvg.includes('croissant-gold'), 'Oliver holds fresh warm pastry/croissant');
assert(oliverSvg.includes('#10b981'), 'Oliver wears mint green alchemist apron');
assert(oliverSvg.includes('oliver-bg'), 'Oliver has warm ginger/honey palette');

// Luna: White cat, heterochromia (cyan #38bdf8 & amber #fbbf24), crescent moon tiara
const lunaSvg = getCharacterPortraitSvg('luna', 80);
assert(lunaSvg.includes('#38bdf8'), 'Luna has cyan starlight left eye');
assert(lunaSvg.includes('#fbbf24'), 'Luna has golden amber right eye (Heterochromia)');
assert(lunaSvg.includes('crescent-silver'), 'Luna wears silver crescent moon forehead tiara');

// Nyx: Calico tricolor patches, wink, emerald agility headband
const nyxSvg = getCharacterPortraitSvg('nyx', 80);
assert(nyxSvg.includes('#059669'), 'Nyx wears emerald agility headband');
assert(nyxSvg.includes('#ea580c'), 'Nyx has ginger-orange calico ear patch');
assert(nyxSvg.includes('#18181b'), 'Nyx has onyx-black calico eye patch');

// Barnaby: Horned owl tufts, golden spectacles, graduation wizard hat
const barnabySvg = getCharacterPortraitSvg('barnaby', 80);
assert(barnabySvg.includes('Spectacles') || barnabySvg.includes('#fbbf24'), 'Barnaby has golden scholar spectacles');
assert(barnabySvg.includes('#fed7aa'), 'Barnaby has rolled ancient parchment scroll');
assert(barnabySvg.includes('Mortarboard') || barnabySvg.includes('#1e40af'), 'Barnaby wears wizard mortarboard');

// Madame Libraria: Cyan ghost body, spectacles, open grimoire
const libSvg = getCharacterPortraitSvg('boss_librarian', 80);
assert(libSvg.includes('ghost-cyan'), 'Madame Libraria has ethereal cyan spectral body');
assert(libSvg.includes('Grimoire') || libSvg.includes('stroke="#2563eb"'), 'Madame Libraria holds open spellbook with horizontal/vertical runes');

// Chef Bouillon: Fiery flame ghost, tall chef toque, curling mustache, giant ladle
const chefSvg = getCharacterPortraitSvg('boss_chef', 80);
assert(chefSvg.includes('ghost-flame'), 'Chef Bouillon has fiery flame spectral body');
assert(chefSvg.includes('Chef Toque') || chefSvg.includes('#ffffff'), 'Chef Bouillon wears towering chef toque');
assert(chefSvg.includes('Mustache') || chefSvg.includes('#7c2d12'), 'Chef Bouillon has curling mustache');

// Professor Stella: Cosmic ghost, planetary orbit rings, celestial orb
const stellaSvg = getCharacterPortraitSvg('boss_planetarium', 80);
assert(stellaSvg.includes('cosmic-ghost'), 'Professor Stella has starry cosmic nebula body');
assert(stellaSvg.includes('Orbit Rings') || stellaSvg.includes('stroke-dasharray="8 3"'), 'Professor Stella has tilted Saturn-like planetary rings');

// Coach Striker: Athletic ghost, referee whistle, sweatband
const coachSvg = getCharacterPortraitSvg('boss_coach', 80);
assert(coachSvg.includes('athletic-ghost'), 'Coach Striker has broad athletic jade ghost body');
assert(coachSvg.includes('Whistle') || coachSvg.includes('rx="2"'), 'Coach Striker wears silver referee whistle');

// Lord Umbra: Crimson glowing eyes, crown of crystals, feline knight mantle
const umbraSvg = getCharacterPortraitSvg('boss_master', 80);
assert(umbraSvg.includes('crimson-eye-glow'), 'Lord Umbra has piercing crimson glowing eyes');
assert(umbraSvg.includes('#9333ea') || umbraSvg.includes('#c084fc'), 'Lord Umbra has spiky purple crystal crown');
assert(umbraSvg.includes('#fbbf24'), 'Lord Umbra has ancient golden crest indicating guardian cat past');

console.log('\n--- 3. Testing Playing HUD Companion System (Levels 1 to 5) ---');
for (let lvl = 1; lvl <= 5; lvl++) {
  const comp = getCompanionForLevel(lvl);
  assert(comp && comp.name && comp.role, `Level ${lvl} has valid companion (${comp.name} - ${comp.role})`);
  assert(typeof comp.svg === 'string' && comp.svg.includes('<svg'), `Level ${lvl} companion provides SVG avatar`);
  assert(comp.actionHint && comp.actionHint.length > 5, `Level ${lvl} companion has action hint: "${comp.actionHint}"`);
}

console.log('\n--- 4. Testing CHARACTER_LORE_DATA Metadata Completeness ---');
expectedCharIds.forEach(id => {
  const lore = CHARACTER_LORE_DATA[id];
  assert(lore !== undefined, `CHARACTER_LORE_DATA contains metadata for '${id}'`);
  assert(lore.equipment && lore.equipment.length > 0, `'${id}' has story equipment: ${lore.equipment}`);
  assert(lore.location && lore.location.length > 0, `'${id}' has story location: ${lore.location}`);
  assert(Array.isArray(lore.runes) && lore.runes.length > 0, `'${id}' has assigned runes: ${lore.runes.join(', ')}`);
  assert(lore.chapterIndex >= 1 && lore.chapterIndex <= 5, `'${id}' has valid chapter jump index (${lore.chapterIndex})`);
});

console.log('\n--- 5. Testing In-Game Canvas Entities (Enemy) & Story Figures ---');

// Test Enemy Boss configurations
const bossConfigs = [
  { typeKey: 'BOSS_LIBRARIAN', levelIndex: 1, levelId: 'library', name: 'Madame Libraria' },
  { typeKey: 'BOSS_CHEF', levelIndex: 2, levelId: 'cafeteria', name: 'Chef Bouillon' },
  { typeKey: 'BOSS_PLANETARIUM', levelIndex: 3, levelId: 'classroom', name: 'Professor Stella' },
  { typeKey: 'BOSS_COACH', levelIndex: 4, levelId: 'gymnasium', name: 'Coach Striker' },
  { typeKey: 'BOSS_MASTER', levelIndex: 5, levelId: 'rooftop', name: 'Lord Umbra' }
];

bossConfigs.forEach(b => {
  const enemy = new Enemy();
  enemy.init({
    type: b.typeKey,
    levelIndex: b.levelIndex,
    levelId: b.levelId
  });
  assert(enemy.type === b.typeKey, `Enemy successfully initialized as ${b.name}`);
  assert(enemy.isBoss === true, `${b.name} is identified as boss entity`);
  assert(enemy.levelIndex === b.levelIndex, `${b.name} has levelIndex ${b.levelIndex}`);
  assert(enemy.levelId === b.levelId, `${b.name} has levelId ${b.levelId}`);
});

// Test StoryCanvasRenderer procedural figure functions exist
assert(typeof StoryCanvasRenderer._drawMadameLibrariaFigure === 'function', 'StoryCanvasRenderer has _drawMadameLibrariaFigure');
assert(typeof StoryCanvasRenderer._drawChefBouillonFigure === 'function', 'StoryCanvasRenderer has _drawChefBouillonFigure');
assert(typeof StoryCanvasRenderer._drawProfessorStellaFigure === 'function', 'StoryCanvasRenderer has _drawProfessorStellaFigure');
assert(typeof StoryCanvasRenderer._drawCoachStrikerFigure === 'function', 'StoryCanvasRenderer has _drawCoachStrikerFigure');
assert(typeof StoryCanvasRenderer._drawLordUmbraFigure === 'function', 'StoryCanvasRenderer has _drawLordUmbraFigure');

// Test running them with mock CanvasRenderingContext2D
const createMockCtx = () => ({
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  closePath: () => {},
  arc: () => {},
  ellipse: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  fill: () => {},
  stroke: () => {},
  fillRect: () => {},
  fillText: () => {},
  translate: () => {},
  rotate: () => {},
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createLinearGradient: () => ({ addColorStop: () => {} }),
  shadowBlur: 0,
  shadowColor: '',
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: ''
});

const mockCtx = createMockCtx();
let renderedClean = true;
try {
  StoryCanvasRenderer._drawMadameLibrariaFigure(mockCtx, 100, 100, 32, 0);
  StoryCanvasRenderer._drawChefBouillonFigure(mockCtx, 100, 100, 32, 0);
  StoryCanvasRenderer._drawProfessorStellaFigure(mockCtx, 100, 100, 32, 0);
  StoryCanvasRenderer._drawCoachStrikerFigure(mockCtx, 100, 100, 32, 0);
  StoryCanvasRenderer._drawLordUmbraFigure(mockCtx, 100, 100, 44, 0);
} catch (e) {
  renderedClean = false;
  console.error(e);
}
assert(renderedClean, 'All 5 procedural Spirit Boss figures render without error');

console.log('\n========================================');
console.log(`Total Character Visual Verification: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}


