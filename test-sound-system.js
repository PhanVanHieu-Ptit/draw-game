/**
 * @file test-sound-system.js
 * @description Unit tests for SoundSystem Web Audio API synthesizer.
 */

// Mock Web Audio API for Node.js test environment
class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.calls = [];
  }
  setValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'setValueAtTime', val, time });
  }
  linearRampToValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'linearRampToValueAtTime', val, time });
  }
  exponentialRampToValueAtTime(val, time) {
    this.value = val;
    this.calls.push({ method: 'exponentialRampToValueAtTime', val, time });
  }
  cancelScheduledValues(time) {
    this.calls.push({ method: 'cancelScheduledValues', time });
  }
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
    this.detune = new MockAudioParam(0);
    this.started = false;
    this.stopped = false;
  }
  start(time = 0) {
    this.started = true;
    this.startTime = time;
  }
  stop(time = 0) {
    this.stopped = true;
    this.stopTime = time;
  }
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
    this.state = 'suspended';
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

// Attach mocks to global
globalThis.AudioContext = MockAudioContext;
globalThis.window = {
  AudioContext: MockAudioContext,
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function runTests() {
  const { SoundSystem } = await import('./src/systems/SoundSystem.js');
  console.log('🧪 Starting SoundSystem tests...\n');

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

  // Test 1: Instantiation & Auto-unlock setup
  const soundSys = new SoundSystem({ masterVolume: 0.75 });
  assert(soundSys.volume === 0.75, 'Initial master volume set correctly');
  assert(soundSys.isMuted === false, 'Initial mute state is false');

  // Test 2: Resume & Init AudioContext
  await soundSys.resume();
  assert(soundSys.ctx !== null, 'AudioContext created upon resume');
  assert(soundSys.ctx.state === 'running', 'AudioContext is resumed to running state');
  assert(soundSys.masterGain !== null, 'Master GainNode connected');
  assert(soundSys.compressor !== null, 'Master DynamicsCompressorNode connected');

  // Test 3: soundDraw(speed)
  soundSys.soundDraw(200);
  assert(soundSys._drawVoice !== null, 'soundDraw(200) creates active draw voice');
  const osc1Freq = soundSys._drawVoice.osc1.frequency.value;
  assert(osc1Freq >= 220 && osc1Freq <= 960, `soundDraw(200) sets appropriate frequency: ${osc1Freq}Hz`);
  assert(soundSys._drawVoice.filter.type === 'bandpass', 'soundDraw uses bandpass resonant filter');

  // Fast speed test
  soundSys.soundDraw(1500);
  const fastFreq = soundSys._drawVoice.osc1.frequency.value;
  assert(fastFreq > osc1Freq, `Frequency increases with speed: ${fastFreq}Hz > ${osc1Freq}Hz`);

  // stopDraw()
  soundSys.stopDraw();
  assert(soundSys._drawVoice === null, 'stopDraw clears active draw voice');

  // Test 4: soundSpellSuccess()
  const nodesBeforeSpell = soundSys.ctx.createdNodes.length;
  soundSys.soundSpellSuccess('horizontal');
  const nodesAfterSpell = soundSys.ctx.createdNodes.length;
  const spellNodes = soundSys.ctx.createdNodes.slice(nodesBeforeSpell);
  assert(nodesAfterSpell > nodesBeforeSpell, 'soundSpellSuccess creates oscillator and filter nodes');

  // Check for chime frequencies in 800Hz - 1600Hz
  const chimeOscs = spellNodes.filter(n => n.name === 'OscillatorNode' && n.frequency.value >= 800 && n.frequency.value <= 1700);
  assert(chimeOscs.length >= 3, `Found ${chimeOscs.length} crystal chime oscillators in 800Hz - 1600Hz range`);

  // Test 5: soundGhostVanish()
  const nodesBeforeGhost = soundSys.ctx.createdNodes.length;
  soundSys.soundGhostVanish();
  const ghostNodes = soundSys.ctx.createdNodes.slice(nodesBeforeGhost);
  const ghostFilter = ghostNodes.find(n => n.name === 'BiquadFilterNode' && n.type === 'lowpass');
  assert(ghostFilter !== undefined, 'soundGhostVanish uses Low-pass filter');
  assert(ghostFilter.Q.value >= 4, `Low-pass filter has resonant Q: ${ghostFilter.Q.value}`);

  // Check downward frequency sweep
  const ghostOsc = ghostNodes.find(n => n.name === 'OscillatorNode');
  const hasExpRampDown = ghostOsc.frequency.calls.some(c => c.method === 'exponentialRampToValueAtTime' && c.val <= 60);
  assert(hasExpRampDown, 'soundGhostVanish sweeps oscillator down to sub-bass (<=60Hz)');

  // Test 6: soundDamage()
  const nodesBeforeDamage = soundSys.ctx.createdNodes.length;
  soundSys.soundDamage();
  const damageNodes = soundSys.ctx.createdNodes.slice(nodesBeforeDamage);
  const subPunchOsc = damageNodes.find(n => n.name === 'OscillatorNode' && n.frequency.value <= 200);
  assert(subPunchOsc !== undefined, 'soundDamage creates heavy low-frequency punch');
  const subRamp = subPunchOsc.frequency.calls.some(c => c.val <= 50);
  assert(subRamp, 'soundDamage sweeps down to sub-bass impact tone');

  // Test 7: soundBossCast()
  const nodesBeforeBoss = soundSys.ctx.createdNodes.length;
  soundSys.soundBossCast();
  const bossNodes = soundSys.ctx.createdNodes.slice(nodesBeforeBoss);
  const droneOsc = bossNodes.find(n => n.name === 'OscillatorNode' && n.frequency.calls.some(c => c.val === 55));
  assert(droneOsc !== undefined, 'soundBossCast creates low 55Hz dread sub-bass drone');
  const alarmFilters = bossNodes.filter(n => n.name === 'BiquadFilterNode' && n.type === 'bandpass');
  assert(alarmFilters.length >= 3, `soundBossCast triggers 3 escalating warning siren pulses (found ${alarmFilters.length})`);

  // Test 8: Volume & Mute Controls
  soundSys.toggleMute();
  assert(soundSys.isMuted === true, 'toggleMute() mutes audio');
  soundSys.toggleMute();
  assert(soundSys.isMuted === false, 'toggleMute() unmutes audio');

  // Test 9: Lightning Strike SFX (soundLightning)
  const preLightningNodesCount = soundSys.ctx.createdNodes.length;
  soundSys.soundLightning();
  const lightningNodes = soundSys.ctx.createdNodes.slice(preLightningNodesCount);
  const lightningOscs = lightningNodes.filter(n => n.name === 'OscillatorNode');
  assert(lightningOscs.length >= 3, `soundLightning creates multiple oscillator layers (found ${lightningOscs.length})`);
  const subBassBoom = lightningOscs.find(o => o.type === 'sine' && o.frequency.value <= 180);
  assert(subBassBoom !== undefined, 'soundLightning includes low-frequency sub-bass shockwave');

  // Test 10: Background Music (BGM) Controls
  assert(typeof soundSys.startBGM === 'function', 'startBGM method exists');
  soundSys.startBGM();
  assert(soundSys.isBGMPlaying === true, 'startBGM sets isBGMPlaying to true');
  soundSys.pauseBGM();
  assert(soundSys.isBGMPaused === true, 'pauseBGM sets isBGMPaused to true');
  soundSys.resumeBGM();
  assert(soundSys.isBGMPaused === false, 'resumeBGM clears isBGMPaused');
  soundSys.stopBGM();
  assert(soundSys.isBGMPlaying === false, 'stopBGM sets isBGMPlaying to false');

  // Test 11: Monster Audio Synthesizer Fallbacks
  const preGhostAtkCount = soundSys.ctx.createdNodes.length;
  soundSys.soundGhostAttack();
  const ghostAtkNodes = soundSys.ctx.createdNodes.slice(preGhostAtkCount);
  assert(ghostAtkNodes.length >= 2, 'soundGhostAttack creates synthesizer nodes');

  const preBossRoarCount = soundSys.ctx.createdNodes.length;
  soundSys.soundBossRoar();
  const bossRoarNodes = soundSys.ctx.createdNodes.slice(preBossRoarCount);
  assert(bossRoarNodes.length >= 2, 'soundBossRoar creates synthesizer nodes');

  const preBossDefeatCount = soundSys.ctx.createdNodes.length;
  soundSys.soundBossDefeat(1);
  const bossDefeatNodes = soundSys.ctx.createdNodes.slice(preBossDefeatCount);
  assert(bossDefeatNodes.length >= 2, 'soundBossDefeat creates synthesizer nodes');

  const preHitCount = soundSys.ctx.createdNodes.length;
  soundSys.soundEnemyHit('horizontal');
  const hitNodes = soundSys.ctx.createdNodes.slice(preHitCount);
  assert(hitNodes.length >= 2, 'soundEnemyHit creates quick impact transient');

  const preSpawnCount = soundSys.ctx.createdNodes.length;
  soundSys.soundGhostSpawn();
  const spawnNodes = soundSys.ctx.createdNodes.slice(preSpawnCount);
  assert(spawnNodes.length >= 2, 'soundGhostSpawn creates ethereal formant');

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
