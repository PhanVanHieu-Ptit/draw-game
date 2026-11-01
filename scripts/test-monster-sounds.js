/**
 * @file test-monster-sounds.js
 * @description In-depth verification test for authentic Google Doodle Halloween 2016 monster sounds:
 * 1. Sprite definitions & timings (ghost vanish wc, ghost attack Tb, boss roar Pb, boss defeats kc/lc/mc/nc/uc).
 * 2. SoundSystem monster audio methods & procedural fallbacks.
 * 3. AudioSystem facade integration.
 * 4. Game combat loop event triggers (ghost collision attack, rune partial hit, enemy elimination, boss battle).
 */

import { AUDIO_SPRITES, SoundSystem } from '../src/systems/SoundSystem.js';
import { AudioSystem } from '../src/systems/AudioSystem.js';
import { Game } from '../src/core/Game.js';
import { Enemy } from '../src/entities/Enemy.js';

console.log('🧪 Starting Authentic Google Doodle Monster Sound Verification Tests...\n');

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

// =========================================================================
// 1. Verify Authentic Google Doodle Halloween 2016 Audio Sprites
// =========================================================================
console.log('--- 1. Testing Monster Audio Sprites Timings (Google Doodle 2016) ---');

assert(AUDIO_SPRITES.ghost_vanish !== undefined, 'AUDIO_SPRITES contains ghost_vanish');
assert(AUDIO_SPRITES.ghost_vanish.file === 'main', 'ghost_vanish uses main.mp3');
assert(AUDIO_SPRITES.ghost_vanish.start === 60.31322, 'ghost_vanish starts at 60.31322s (wc: ghost dissolves)');
assert(AUDIO_SPRITES.ghost_vanish.duration === 1.335147, 'ghost_vanish duration is 1.335147s');

assert(AUDIO_SPRITES.ghost_attack !== undefined, 'AUDIO_SPRITES contains ghost_attack');
assert(AUDIO_SPRITES.ghost_attack.file === 'main', 'ghost_attack uses main.mp3');
assert(AUDIO_SPRITES.ghost_attack.start === 57.571723, 'ghost_attack starts at 57.571723s (Tb: ghost lunge attack)');
assert(AUDIO_SPRITES.ghost_attack.duration === 1.741497, 'ghost_attack duration is 1.741497s');

assert(AUDIO_SPRITES.boss_roar !== undefined, 'AUDIO_SPRITES contains boss_roar');
assert(AUDIO_SPRITES.boss_roar.file === 'end', 'boss_roar uses end.mp3');
assert(AUDIO_SPRITES.boss_roar.start === 8.400, 'boss_roar starts at 8.400s (Pb: boss apparition roar)');
assert(AUDIO_SPRITES.boss_roar.duration === 5.233333, 'boss_roar duration is 5.233333s');

// Boss 1..5 Defeat Sprites
assert(AUDIO_SPRITES.boss_defeat_1.start === 0.000, 'boss_defeat_1 starts at 0.000s in main.mp3 (kc: Level 1 Librarian Boss roar)');
assert(AUDIO_SPRITES.boss_defeat_2.start === 4.160816, 'boss_defeat_2 starts at 4.160816s in main.mp3 (lc: Level 2 Chef Boss scream)');
assert(AUDIO_SPRITES.boss_defeat_3.start === 8.39415, 'boss_defeat_3 starts at 8.39415s in main.mp3 (mc: Level 3 Planetarium Boss roar)');
assert(AUDIO_SPRITES.boss_defeat_4.start === 12.927483, 'boss_defeat_4 starts at 12.927483s in main.mp3 (nc: Level 4 Coach Boss roar)');
assert(AUDIO_SPRITES.boss_defeat_5.start === 21.878163, 'boss_defeat_5 starts at 21.878163s in main.mp3 (uc: Level 5 Master Boss roar)');

assert(AUDIO_SPRITES.bgm_boss_5.file === 'end', 'bgm_boss_5 uses end.mp3');
assert(AUDIO_SPRITES.bgm_boss_5.start === 21.909342, 'bgm_boss_5 starts at 21.909342s (vc: Final Boss battle theme)');
assert(AUDIO_SPRITES.bgm_boss_5.duration === 30.000, 'bgm_boss_5 has 30.0s loop duration');

// =========================================================================
// 2. Testing SoundSystem Monster Audio Synthesizers & Fallbacks
// =========================================================================
console.log('\n--- 2. Testing SoundSystem Monster Audio Methods ---');

const soundSys = new SoundSystem({ autoUnlock: false });
assert(typeof soundSys.soundGhostAttack === 'function', 'SoundSystem has soundGhostAttack()');
assert(typeof soundSys.soundBossRoar === 'function', 'SoundSystem has soundBossRoar()');
assert(typeof soundSys.soundBossDefeat === 'function', 'SoundSystem has soundBossDefeat()');
assert(typeof soundSys.soundEnemyHit === 'function', 'SoundSystem has soundEnemyHit()');
assert(typeof soundSys.soundGhostSpawn === 'function', 'SoundSystem has soundGhostSpawn()');

// =========================================================================
// 3. Testing AudioSystem Facade Methods
// =========================================================================
console.log('\n--- 3. Testing AudioSystem Facade Integration ---');

const audioSys = new AudioSystem({ autoUnlock: false });
assert(typeof audioSys.playEnemyAttack === 'function', 'AudioSystem has playEnemyAttack()');
assert(typeof audioSys.playBossRoar === 'function', 'AudioSystem has playBossRoar()');
assert(typeof audioSys.playBossDeath === 'function', 'AudioSystem has playBossDeath()');
assert(typeof audioSys.playHit === 'function', 'AudioSystem has playHit()');
assert(typeof audioSys.playEnemyDeath === 'function', 'AudioSystem has playEnemyDeath()');
assert(typeof audioSys.playGhostSpawn === 'function', 'AudioSystem has playGhostSpawn()');

// Track calls on audioSys
let lastAudioCall = null;
const audioCalls = [];
['playEnemyAttack', 'playBossRoar', 'playBossDeath', 'playHit', 'playEnemyDeath', 'playHurt'].forEach(m => {
  audioSys[m] = function(...args) {
    lastAudioCall = m;
    audioCalls.push({ method: m, args });
  };
});

// =========================================================================
// 4. Testing In-Game Monster Combat Audio Triggers
// =========================================================================
console.log('\n--- 4. Testing Combat Game Loop Monster Audio Triggers ---');

const mockCtx = {
  save: () => {},
  restore: () => {},
  clearRect: () => {},
  fillRect: () => {},
  beginPath: () => {},
  arc: () => {},
  fill: () => {},
  stroke: () => {},
  drawImage: () => {},
  measureText: () => ({ width: 50 }),
  fillText: () => {},
  createRadialGradient: () => ({ addColorStop: () => {} }),
  createLinearGradient: () => ({ addColorStop: () => {} })
};

const mockElement = {
  getContext: () => mockCtx,
  width: 800,
  height: 600,
  style: {},
  addEventListener: () => {},
  removeEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  classList: { add: () => {}, remove: () => {}, contains: () => false },
  textContent: '',
  innerHTML: '',
  querySelectorAll: () => [],
  querySelector: () => mockElement,
  appendChild: () => {},
  children: []
};

globalThis.window = {
  innerWidth: 800,
  innerHeight: 600,
  devicePixelRatio: 1,
  addEventListener: () => {},
  removeEventListener: () => {}
};

globalThis.document = {
  getElementById: () => mockElement,
  createElement: () => mockElement,
  querySelector: () => mockElement,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {}
};

const game = new Game(mockElement);
game.audioSystem = audioSys;

// Test A: Ghost strikes player -> Triggers playEnemyAttack() AND playHurt()
audioCalls.length = 0;
const attackingEnemy = new Enemy({
  type: 'REGULAR',
  x: game.player.x,
  y: game.player.y,
  symbolQueue: ['horizontal']
});
game.enemies.push(attackingEnemy);
game.updatePlaying(0.016);

const hasEnemyAttackCall = audioCalls.some(c => c.method === 'playEnemyAttack');
const hasHurtCall = audioCalls.some(c => c.method === 'playHurt');
assert(hasEnemyAttackCall, 'Ghost attack collision triggers playEnemyAttack() (Google Doodle Tb)');
assert(hasHurtCall, 'Ghost attack collision triggers playHurt() (Google Doodle tc)');

// Test B: Partial hit on enemy (enemy has 2 symbols, hit 1st symbol)
audioCalls.length = 0;
const multiRuneEnemy = new Enemy({
  type: 'ARMORED',
  x: 200,
  y: 200,
  symbolQueue: ['horizontal', 'vertical']
});
game.enemies.push(multiRuneEnemy);

// Simulate projectile hitting enemy
const fakeProj = {
  targetEnemy: multiRuneEnemy,
  gesture: 'horizontal',
  update: () => true,
  reset: () => {}
};
game.projectiles.push(fakeProj);
game.updatePlaying(0.016);

const hasHitCall = audioCalls.some(c => c.method === 'playHit');
const hasDeathOnPartialHit = audioCalls.some(c => c.method === 'playEnemyDeath' || c.method === 'playBossDeath');
assert(hasHitCall, 'Partial rune hit triggers playHit()');
assert(!hasDeathOnPartialHit, 'Partial rune hit does NOT prematurely trigger enemy death audio');
assert(multiRuneEnemy.symbolQueue.length === 1, 'Enemy still alive with 1 symbol remaining');

// Test C: Final hit eliminating regular enemy -> Triggers playEnemyDeath() (wc)
audioCalls.length = 0;
const finalProj = {
  targetEnemy: multiRuneEnemy,
  gesture: 'vertical',
  update: () => true,
  reset: () => {}
};
game.projectiles.push(finalProj);
game.updatePlaying(0.016);

const hasEnemyDeathCall = audioCalls.some(c => c.method === 'playEnemyDeath');
assert(hasEnemyDeathCall, 'Final hit on regular enemy triggers playEnemyDeath() (Google Doodle wc)');

// Test D: Boss Spawning -> Triggers playBossRoar() (Pb)
audioCalls.length = 0;
if (game.waveSystem.onBossSpawn) {
  game.waveSystem.onBossSpawn('BOSS_LIBRARIAN', 'Bóng Ma Thủ Thư');
}
const hasBossRoarOnSpawn = audioCalls.some(c => c.method === 'playBossRoar');
assert(hasBossRoarOnSpawn, 'Boss apparition triggers playBossRoar() (Google Doodle Pb)');

// Test E: Boss Defeat -> Triggers playBossDeath(level)
audioCalls.length = 0;
const bossEnemy = new Enemy({
  type: 'BOSS_LIBRARIAN',
  x: 300,
  y: 300,
  symbolQueue: ['horizontal']
});
game.enemies.push(bossEnemy);

const bossProj = {
  targetEnemy: bossEnemy,
  gesture: 'horizontal',
  update: () => true,
  reset: () => {}
};
game.projectiles.push(bossProj);
game.waveSystem.currentLevelIndex = 1;
game.updatePlaying(0.016);

const hasBossDeathCall = audioCalls.some(c => c.method === 'playBossDeath');
const bossDeathCall = audioCalls.find(c => c.method === 'playBossDeath');
assert(hasBossDeathCall, 'Eliminating boss triggers playBossDeath()');
assert(bossDeathCall && bossDeathCall.args[0] === 1, 'playBossDeath passed correct level index 1');

console.log(`\n========================================`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
