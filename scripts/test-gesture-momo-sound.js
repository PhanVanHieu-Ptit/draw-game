/**
 * @file test-gesture-momo-sound.js
 * @description Comprehensive unit verification test for Momo character gesture actions & synchronized audio system.
 */

import { MOMO_SPRITES } from '../src/entities/momoSprites.js';
import { Player } from '../src/entities/Player.js';
import { SoundSystem, AUDIO_SPRITES } from '../src/systems/SoundSystem.js';
import { AudioSystem } from '../src/systems/AudioSystem.js';

console.log('🧪 Starting Gesture-Momo-Sound Synchronization Tests...\n');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    console.log(`  ✅ PASS: ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

// --- 1. Testing MOMO_SPRITES data structure ---
console.log('--- 1. Testing Momo Gesture Sprite Definitions ---');
const requiredAnimations = [
  'idle',
  'ready',
  'attack_vertical',
  'attack_up',
  'attack_horizontal',
  'attack_down',
  'attack_heart',
  'attack_lightning',
  'hurt',
  'victory',
  'down'
];

requiredAnimations.forEach(animKey => {
  assert(Array.isArray(MOMO_SPRITES[animKey]), `MOMO_SPRITES contains ${animKey} frame array`);
  assert(MOMO_SPRITES[animKey].length > 0, `${animKey} contains active frames (${MOMO_SPRITES[animKey].length})`);
});

assert(MOMO_SPRITES.attack_vertical.offsetX === 12, 'attack_vertical has authentic doodle offsetX 12');
assert(MOMO_SPRITES.attack_vertical.offsetY === -21, 'attack_vertical has authentic doodle offsetY -21');
assert(MOMO_SPRITES.attack_horizontal.offsetX === 0, 'attack_horizontal has authentic doodle offsetX 0');
assert(MOMO_SPRITES.attack_horizontal.offsetY === -19, 'attack_horizontal has authentic doodle offsetY -19');
assert(MOMO_SPRITES.ready.offsetX === 10, 'ready stance has authentic doodle offsetX 10');

// --- 2. Testing Player Gesture Stances & Animation States ---
console.log('\n--- 2. Testing Player Gesture Animation Reactions ---');
const player = new Player(800, 600);
assert(player.animState === 'idle', 'Initial Momo state is idle');

// Drawing starts -> enters ready stance
player.setDrawing(true, { x: 400, y: 300 });
assert(player.animState === 'ready', 'Momo enters ready stance when drawing starts');

// Drawing stops without gesture -> returns to idle
player.setDrawing(false, null);
assert(player.animState === 'idle', 'Momo returns to idle when drawing stops without cast');

// Test gesture-specific cast reactions
player.castSpell('horizontal');
assert(player.animState === 'attack_horizontal', 'Momo executes horizontal slash on horizontal gesture');
assert(player.castTimer > 0, 'Cast timer activated for horizontal slash');

player.castSpell('vertical');
assert(player.animState === 'attack_vertical', 'Momo executes vertical slash on vertical gesture');

player.castSpell('caret');
assert(player.animState === 'attack_up', 'Momo executes upward apex slash on caret gesture');

player.castSpell('v_shape');
assert(player.animState === 'attack_down', 'Momo executes downward slash on v_shape gesture');

player.castSpell('heart');
assert(player.animState === 'attack_heart', 'Momo executes heart circular cast on heart gesture');

player.castSpell('lightning');
assert(player.animState === 'attack_lightning', 'Momo executes electric zigzag on lightning gesture');

// Test dynamic wand angles during gesture cast
player.castSpell('horizontal');
player.update(0.016, []);
assert(player.targetWandAngle !== undefined, 'Player calculates targetWandAngle for horizontal gesture');

// Test animation completion transitions
player.update(0.5, []);
assert(player.animState === 'idle', 'Momo transitions back to idle after attack animation finishes');

// --- 3. Testing AUDIO_SPRITES & Authentic Sound Synchronization ---
console.log('\n--- 3. Testing Audio Sprites & Audio-Action Synchronization ---');
assert(AUDIO_SPRITES.bgm !== undefined, 'AUDIO_SPRITES has bgm definition');
assert(AUDIO_SPRITES.bgm.start === 31.308549, 'BGM starts at exact doodle theme offset 31.308549s');
assert(AUDIO_SPRITES.bgm.duration === 25.263175, 'BGM loops exact doodle theme duration 25.263175s');
assert(AUDIO_SPRITES.bgm.loop === true, 'BGM is flagged as looping');

assert(AUDIO_SPRITES.spell_slash.start === 70.241565, 'Wand slash sprite Kb starts at 70.241565s');
assert(AUDIO_SPRITES.cat_hurt.start === 18.89415, 'Cat hurt sprite tc starts at 18.89415s');
assert(AUDIO_SPRITES.ghost_vanish.start === 60.31322, 'Ghost vanish sprite wc starts at 60.31322s');
assert(AUDIO_SPRITES.ghost_attack.start === 57.571723, 'Ghost attack sprite Tb starts at 57.571723s');
assert(AUDIO_SPRITES.boss_roar.start === 8.400, 'Boss roar sprite Pb starts at 8.400s in end.mp3');
assert(AUDIO_SPRITES.boss_defeat_1.start === 0.000, 'Boss 1 defeat sprite kc starts at 0.000s');
assert(AUDIO_SPRITES.boss_defeat_2.start === 4.160816, 'Boss 2 defeat sprite lc starts at 4.160816s');
assert(AUDIO_SPRITES.boss_defeat_3.start === 8.39415, 'Boss 3 defeat sprite mc starts at 8.39415s');
assert(AUDIO_SPRITES.boss_defeat_4.start === 12.927483, 'Boss 4 defeat sprite nc starts at 12.927483s');
assert(AUDIO_SPRITES.boss_defeat_5.start === 21.878163, 'Boss 5 defeat sprite uc starts at 21.878163s');
assert(AUDIO_SPRITES.bgm_boss_5.start === 21.909342, 'Boss 5 battle BGM sprite vc starts at 21.909342s in end.mp3');
assert(AUDIO_SPRITES.combo_1.start === 72.225125, 'Combo 1 sprite Wb starts at 72.225125s');
assert(AUDIO_SPRITES.combo_2.start === 74.385125, 'Combo 2 sprite Dc starts at 74.385125s');
assert(AUDIO_SPRITES.combo_3.start === 76.633129, 'Combo 3 sprite Ec starts at 76.633129s');
assert(AUDIO_SPRITES.combo_4.start === 79.019796, 'Combo 4 sprite Fc starts at 79.019796s');
assert(AUDIO_SPRITES.spell_heart.start === 86.341088, 'Heart spell sprite Ic starts at 86.341088s');
assert(AUDIO_SPRITES.spell_lightning.start === 88.966485, 'Lightning spell sprite Jc starts at 88.966485s');
assert(AUDIO_SPRITES.level_start.start === 68.073311, 'Level start sprite Bc starts at 68.073311s');
assert(AUDIO_SPRITES.level_clear.start === 65.500159, 'Level clear sprite Vb starts at 65.500159s');

// Test AudioSystem facade methods
const audioSys = new AudioSystem({ autoUnlock: false });
assert(typeof audioSys.playSpell === 'function', 'AudioSystem has playSpell method');
assert(typeof audioSys.playHit === 'function', 'AudioSystem has playHit method');
assert(typeof audioSys.playEnemyAttack === 'function', 'AudioSystem has playEnemyAttack method');
assert(typeof audioSys.playEnemyDeath === 'function', 'AudioSystem has playEnemyDeath method');
assert(typeof audioSys.playBossRoar === 'function', 'AudioSystem has playBossRoar method');
assert(typeof audioSys.playBossDeath === 'function', 'AudioSystem has playBossDeath method');
assert(typeof audioSys.playGhostSpawn === 'function', 'AudioSystem has playGhostSpawn method');
assert(typeof audioSys.playCombo === 'function', 'AudioSystem has playCombo method');
assert(typeof audioSys.playWaveComplete === 'function', 'AudioSystem has playWaveComplete method');
assert(typeof audioSys.playAudioSprite === 'function', 'AudioSystem has playAudioSprite method');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
