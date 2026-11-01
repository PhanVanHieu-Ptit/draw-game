/**
 * @file test-new-features.js
 * @description Comprehensive verification test for the 5 newly implemented features:
 * 1. Stationary Heart Ghost
 * 2. Player Wand & Arm Stroke Following
 * 3. Procedural Background Music (BGM) Sequencer
 * 4. Enemy Hit Slowdown and Scared Facial Expression
 * 5. Thunderous Lightning Sound Effect & Sky Flash
 */

import { Enemy } from '../src/entities/Enemy.js';
import { Player } from '../src/entities/Player.js';
import { SoundSystem } from '../src/systems/SoundSystem.js';
import { WaveSystem } from '../src/systems/WaveSystem.js';

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

// Mock AudioContext for Node.js
class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
  }
  setValueAtTime(val) { this.value = val; }
  linearRampToValueAtTime(val) { this.value = val; }
  exponentialRampToValueAtTime(val) { this.value = val; }
  cancelScheduledValues() {}
}

class MockAudioNode {
  constructor(name) {
    this.name = name;
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
  disconnect() {
    this.connections = [];
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super('OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
  }
  start() {}
  stop() {}
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super('BiquadFilterNode');
    this.type = 'lowpass';
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.gain = new MockAudioParam(0);
  }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super('GainNode');
    this.gain = new MockAudioParam(1);
  }
}

class MockDynamicsCompressorNode extends MockAudioNode {
  constructor() {
    super('DynamicsCompressorNode');
    this.threshold = new MockAudioParam(-6);
    this.knee = new MockAudioParam(10);
    this.ratio = new MockAudioParam(4);
    this.attack = new MockAudioParam(0.003);
    this.release = new MockAudioParam(0.12);
  }
}

class MockAudioContext {
  constructor() {
    this.currentTime = 0.5;
    this.state = 'running';
    this.destination = new MockAudioNode('Destination');
    this.createdNodes = [];
  }
  createOscillator() {
    const node = new MockOscillatorNode();
    this.createdNodes.push(node);
    return node;
  }
  createGain() {
    const node = new MockGainNode();
    this.createdNodes.push(node);
    return node;
  }
  createBiquadFilter() {
    const node = new MockBiquadFilterNode();
    this.createdNodes.push(node);
    return node;
  }
  createDynamicsCompressor() {
    const node = new MockDynamicsCompressorNode();
    this.createdNodes.push(node);
    return node;
  }
  async resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

globalThis.AudioContext = MockAudioContext;
globalThis.window = {
  AudioContext: MockAudioContext,
  addEventListener: () => {},
  removeEventListener: () => {}
};

console.log('🧪 Running New Feature Verification Tests...\n');

// =========================================================================
// Feature 1: Con ma hình trái tim phải đứng yên 1 chỗ (Stationary Heart Ghost)
// =========================================================================
console.log('--- 1. Testing Stationary Heart Ghost ---');
const heartEnemy = new Enemy({
  type: 'REGULAR',
  x: 400,
  y: 200,
  isHeartGhost: true,
  symbolQueue: ['heart']
});

assert(heartEnemy.isHeartGhost === true, 'Heart enemy is identified as isHeartGhost');
assert(heartEnemy.speed === 0, 'Heart ghost speed is strictly 0');

const initialX = heartEnemy.x;
const initialY = heartEnemy.y;

// Simulate 3 seconds of updates towards player at (400, 700)
for (let i = 0; i < 30; i++) {
  heartEnemy.update(0.1, { x: 400, y: 700 });
}

assert(heartEnemy.x === initialX, `Heart ghost X stayed stationary at ${initialX}`);
assert(heartEnemy.y === initialY, `Heart ghost Y stayed stationary at ${initialY}`);

// =========================================================================
// Feature 2: Gậy của con mèo di chuyển qua lại, lên xuống giống nét vẽ
// =========================================================================
console.log('\n--- 2. Testing Player Wand & Arm Stroke Following ---');
const player = new Player(800, 600);
// Player is at (400, 510)
const initialWandAngle = player.currentWandAngle;
const initialArmX = player.wandArmX;
const initialArmY = player.wandArmY;

// Draw stroke to the upper-left (100, 150)
player.setDrawing(true, { x: 100, y: 150 });
player.update(0.15, []);

assert(player.isDrawing === true, 'Player tracks isDrawing state');
assert(player.currentWandAngle !== initialWandAngle, 'Wand angle tilts towards upper-left stroke');
assert(player.wandArmX < initialArmX, 'Wand arm shifts leftwards following stroke');
assert(player.wandArmY < initialArmY, 'Wand arm shifts upwards following stroke');

const leftArmX = player.wandArmX;

// Draw stroke to the upper-right (700, 200)
player.setDrawing(true, { x: 700, y: 200 });
player.update(0.15, []);

assert(player.wandArmX > leftArmX, 'Wand arm shifts rightwards following stroke');

// Stop drawing
player.setDrawing(false, null);
for (let i = 0; i < 20; i++) {
  player.update(0.1, []);
}
assert(Math.abs(player.wandArmX - 14) < 1, 'Wand arm returns to rest position after drawing finishes');

// =========================================================================
// Feature 3: Bổ sung nhạc nền (Background Music)
// =========================================================================
console.log('\n--- 3. Testing Procedural Background Music (BGM) ---');
const soundSys = new SoundSystem({ autoUnlock: false });
soundSys.init();

assert(typeof soundSys.startBGM === 'function', 'startBGM method exists');
assert(typeof soundSys.pauseBGM === 'function', 'pauseBGM method exists');
assert(typeof soundSys.resumeBGM === 'function', 'resumeBGM method exists');
assert(typeof soundSys.stopBGM === 'function', 'stopBGM method exists');

soundSys.startBGM();
assert(soundSys.isBGMPlaying === true, 'BGM is playing after startBGM()');
assert(soundSys.bgmGain !== null, 'BGM dedicated gain node created');

soundSys.pauseBGM();
assert(soundSys.isBGMPaused === true, 'BGM is paused after pauseBGM()');

soundSys.resumeBGM();
assert(soundSys.isBGMPaused === false, 'BGM is active after resumeBGM()');

soundSys.stopBGM();
assert(soundSys.isBGMPlaying === false, 'BGM stops after stopBGM()');

// =========================================================================
// Feature 4: Ma bị vẽ trúng đi chậm lại và đổi vẻ mặt (Slowdown & Scared Face)
// =========================================================================
console.log('\n--- 4. Testing Ghost Hit Slowdown & Scared Face ---');
const multiEnemy = new Enemy({
  type: 'ARMORED',
  x: 400,
  y: 100,
  symbolQueue: ['horizontal', 'vertical', 'caret']
});

const normalSpeed = multiEnemy.speed;

// Hit front symbol 'horizontal'
const hitRes = multiEnemy.takeHit('horizontal');
assert(hitRes.matched === true, 'Hit matched front symbol');
assert(hitRes.destroyed === false, 'Enemy survived with 2 runes remaining');
assert(multiEnemy.slowTimer > 0, 'Ghost entered slowTimer state');
assert(multiEnemy.expressionTimer > 0, 'Ghost entered scared expression state');
assert(multiEnemy.shiverTimer > 0, 'Ghost entered impact shiver state');

// Update and measure movement
const preUpdateY = multiEnemy.y;
multiEnemy.update(0.1, { x: 400, y: 700 });
const displacementSlowed = multiEnemy.y - preUpdateY;

// Calculate expected displacement without slow: normalSpeed * 0.1
const displacementNormal = normalSpeed * 0.1;
assert(displacementSlowed < displacementNormal * 0.5, `Enemy movement slowed down by >50% (Slowed: ${displacementSlowed.toFixed(2)}px vs Normal: ${displacementNormal.toFixed(2)}px)`);

// =========================================================================
// Feature 5: Bổ sung tiếng sét khi vẽ sét (Lightning Thunder SFX)
// =========================================================================
console.log('\n--- 5. Testing Lightning Thunder SFX ---');
const preLightningCount = soundSys.ctx.createdNodes.length;
soundSys.soundLightning();
const lightningNodes = soundSys.ctx.createdNodes.slice(preLightningCount);

const oscs = lightningNodes.filter(n => n.name === 'OscillatorNode');
const filters = lightningNodes.filter(n => n.name === 'BiquadFilterNode');
const gains = lightningNodes.filter(n => n.name === 'GainNode');

assert(oscs.length >= 3, `soundLightning creates multiple synthesizer oscillators (found ${oscs.length})`);
assert(filters.length >= 2, `soundLightning shapes audio with resonant filters (found ${filters.length})`);
assert(gains.length >= 3, `soundLightning applies dynamic gain envelopes (found ${gains.length})`);

// Check sub-bass shockwave
const subBass = oscs.find(o => o.type === 'sine' && o.frequency.value <= 180);
assert(subBass !== undefined, 'soundLightning contains sub-bass thunder boom');

console.log(`\n========================================`);
console.log(`Total Verification: ${passed} Passed, ${failed} Failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
