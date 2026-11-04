/**
 * @file test-share-card-haptic-catsfx.js
 * @description Comprehensive unit tests for:
 * 1. Wizard Cat License / Share Card (Canvas Card & Ranks)
 * 2. Mobile Haptic Vibration System (navigator.vibrate)
 * 3. Feline Sound Effects (Meow, Purr, Hiss)
 */

import { HapticSystem } from './src/systems/HapticSystem.js';
import { calculateWizardRank, renderWizardCard, getChallengeUrl } from './src/ui/WizardCardRenderer.js';
import { AudioSystem } from './src/systems/AudioSystem.js';

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

// ============================================================================
// 1. MOCK ENVIRONMENT SETUP
// ============================================================================

// Mock Web Vibration API
const mockVibrations = [];
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'vibrate', {
    value: (pattern) => {
      mockVibrations.push(pattern);
      return true;
    },
    configurable: true,
    writable: true
  });
} else {
  globalThis.navigator = {
    vibrate: (pattern) => {
      mockVibrations.push(pattern);
      return true;
    }
  };
}

// Mock Canvas 2D Context for Node.js
class MockCanvasContext {
  constructor() {
    this.calls = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'left';
    this.textBaseline = 'top';
    this.shadowBlur = 0;
    this.shadowColor = '';
  }
  save() { this.calls.push({ method: 'save' }); }
  restore() { this.calls.push({ method: 'restore' }); }
  beginPath() { this.calls.push({ method: 'beginPath' }); }
  closePath() { this.calls.push({ method: 'closePath' }); }
  moveTo(x, y) { this.calls.push({ method: 'moveTo', x, y }); }
  lineTo(x, y) { this.calls.push({ method: 'lineTo', x, y }); }
  arc(x, y, r, sa, ea) { this.calls.push({ method: 'arc', x, y, r }); }
  ellipse(x, y, rx, ry, rot, sa, ea) { this.calls.push({ method: 'ellipse', x, y, rx, ry }); }
  rect(x, y, w, h) { this.calls.push({ method: 'rect', x, y, w, h }); }
  roundRect(x, y, w, h, r) { this.calls.push({ method: 'roundRect', x, y, w, h, r }); }
  fill() { this.calls.push({ method: 'fill' }); }
  stroke() { this.calls.push({ method: 'stroke' }); }
  fillRect(x, y, w, h) { this.calls.push({ method: 'fillRect', x, y, w, h }); }
  strokeRect(x, y, w, h) { this.calls.push({ method: 'strokeRect', x, y, w, h }); }
  fillText(text, x, y) { this.calls.push({ method: 'fillText', text, x, y }); }
  clip() { this.calls.push({ method: 'clip' }); }
  quadraticCurveTo(cpx, cpy, x, y) { this.calls.push({ method: 'quadraticCurveTo', cpx, cpy, x, y }); }
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
  createRadialGradient() {
    return { addColorStop: () => {} };
  }
}

class MockCanvas {
  constructor(width = 840, height = 520) {
    this.width = width;
    this.height = height;
    this.ctx = new MockCanvasContext();
  }
  getContext(type) {
    return type === '2d' ? this.ctx : null;
  }
  toDataURL() {
    return 'data:image/png;base64,mockpngdata';
  }
}

// Mock Web Audio API for AudioSystem test
class MockAudioParam {
  constructor(val = 0) { this.value = val; this.calls = []; }
  setValueAtTime(val, t) { this.calls.push({ val, t }); }
  linearRampToValueAtTime(val, t) { this.calls.push({ val, t }); }
  exponentialRampToValueAtTime(val, t) { this.calls.push({ val, t }); }
}
class MockNode {
  constructor(name) { this.name = name; }
  connect() {}
  disconnect() {}
}
class MockOsc extends MockNode {
  constructor() {
    super('Oscillator');
    this.frequency = new MockAudioParam(440);
  }
  start() {}
  stop() {}
}
class MockGain extends MockNode {
  constructor() {
    super('Gain');
    this.gain = new MockAudioParam(1);
  }
}
class MockFilter extends MockNode {
  constructor() {
    super('Filter');
    this.frequency = new MockAudioParam(1000);
    this.Q = new MockAudioParam(1);
  }
}
class MockCtx {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.createdNodes = [];
  }
  createOscillator() { const o = new MockOsc(); this.createdNodes.push(o); return o; }
  createGain() { const g = new MockGain(); this.createdNodes.push(g); return g; }
  createBiquadFilter() { const f = new MockFilter(); this.createdNodes.push(f); return f; }
  createDynamicsCompressor() { const c = new MockNode('Compressor'); return c; }
  resume() { return Promise.resolve(); }
}

async function runTests() {
  console.log('🧪 Starting Share Card, Haptic Mobile, and Cat SFX Tests...\n');

  // =========================================================================
  // SECTION 1: HAPTIC SYSTEM VERIFICATION
  // =========================================================================
  console.log('--- 1. Testing HapticSystem Web Vibration API Integration ---');
  mockVibrations.length = 0;
  const haptic = new HapticSystem();

  assert(haptic.isSupported() === true, 'HapticSystem detects Web Vibration API support');
  assert(haptic.enabled === true, 'HapticSystem enabled by default');

  haptic.cast();
  assert(mockVibrations.length === 1 && mockVibrations[0] === 14, 'haptic.cast() fires 14ms crisp tactile tick');

  haptic.heal();
  assert(mockVibrations.length === 2 && Array.isArray(mockVibrations[1]) && mockVibrations[1][0] === 35, 'haptic.heal() fires double-heartbeat pattern');

  haptic.freeze();
  assert(mockVibrations.length === 3 && Array.isArray(mockVibrations[2]), 'haptic.freeze() fires crystalline stutter pattern');

  haptic.blast();
  assert(mockVibrations.length === 4 && Array.isArray(mockVibrations[3]), 'haptic.blast() fires wind shockwave pattern');

  haptic.damage();
  assert(mockVibrations.length === 5 && mockVibrations[4][0] === 65, 'haptic.damage() fires concussive alert buzz');

  haptic.bossHit();
  assert(mockVibrations.length === 6 && mockVibrations[5][0] === 45, 'haptic.bossHit() fires recoil shudder');

  haptic.bossDefeat();
  assert(mockVibrations.length === 7 && mockVibrations[6].length >= 5, 'haptic.bossDefeat() fires massive triumphant shudder');

  haptic.gameover();
  assert(mockVibrations.length === 8 && mockVibrations[7][0] === 80, 'haptic.gameover() fires descending sad pulses');

  haptic.victory();
  assert(mockVibrations.length === 9 && mockVibrations[8].length >= 7, 'haptic.victory() fires grand fanfare rhythm');

  haptic.combo(15);
  assert(mockVibrations.length === 10 && mockVibrations[9].length >= 5, 'haptic.combo(15) fires high momentum burst');

  // Test disable/enable toggle
  haptic.toggle();
  assert(haptic.enabled === false, 'haptic.toggle() disables vibration');
  const vibratedWhenOff = haptic.cast();
  assert(vibratedWhenOff === false, 'haptic.cast() is blocked when disabled');
  haptic.toggle();
  assert(haptic.enabled === true, 'haptic.toggle() re-enables vibration');

  // =========================================================================
  // SECTION 2: WIZARD CAT CARD RANK & CANVAS RENDERER
  // =========================================================================
  console.log('\n--- 2. Testing Wizard Card Ranks & Canvas Rendering ---');

  // Rank calculations
  const rankSSS = calculateWizardRank({ score: 15400, isVictory: true, accuracy: 96 });
  assert(rankSSS.grade === 'SSS', 'Score 15400 + Victory + 96% Acc awards SSS rank');
  assert(rankSSS.title === 'ĐẠI PHÁP SƯ TỐI CAO', 'Grade SSS title is ĐẠI PHÁP SƯ TỐI CAO');

  const rankSS = calculateWizardRank({ score: 9200, isVictory: false, accuracy: 85 });
  assert(rankSS.grade === 'SS', 'Score 9200 awards SS rank');
  assert(rankSS.title === 'PHÁP SƯ THƯỢNG ĐẲNG', 'Grade SS title is PHÁP SƯ THƯỢNG ĐẲNG');

  const rankS = calculateWizardRank({ score: 5500, isVictory: false, accuracy: 80 });
  assert(rankS.grade === 'S', 'Score 5500 awards S rank (PHÁP SƯ TINH ANH)');

  const rankA = calculateWizardRank({ score: 2800, isVictory: false, accuracy: 75 });
  assert(rankA.grade === 'A', 'Score 2800 awards A rank (PHÁP SƯ CHÍNH THỨC)');

  const rankB = calculateWizardRank({ score: 1400, isVictory: false, accuracy: 70 });
  assert(rankB.grade === 'B', 'Score 1400 awards B rank (HỌC VIÊN XUẤT SẮC)');

  const rankC = calculateWizardRank({ score: 450, isVictory: false, accuracy: 60 });
  assert(rankC.grade === 'C', 'Score 450 awards C rank (PHÙ THỦY TẬP SỰ)');

  // Challenge URL Generator
  const challengeUrl = getChallengeUrl(18500, 'Momo');
  assert(challengeUrl.includes('challenge=true'), 'getChallengeUrl contains challenge parameter');
  assert(challengeUrl.includes('score=18500'), 'getChallengeUrl encodes score parameter');
  assert(challengeUrl.includes('from=Momo'), 'getChallengeUrl encodes hero parameter');

  // Canvas Render Execution
  const mockCanvas = new MockCanvas(840, 520);
  renderWizardCard(mockCanvas, {
    score: 16800,
    highScore: 18000,
    accuracy: 97,
    spellsCast: 84,
    spellsHit: 82,
    enemiesDefeated: 74,
    maxCombo: 16,
    elapsedSeconds: 215,
    levelReached: 5,
    isVictory: true,
    difficulty: 'HARDCORE'
  });

  const filledTexts = mockCanvas.ctx.calls.filter(c => c.method === 'fillText').map(c => c.text);
  assert(filledTexts.some(t => t.includes('CHỨNG NHẬN PHÁP SƯ MÈO')), 'Card renders main certificate title');
  assert(filledTexts.some(t => t.includes('PHÁP SƯ MOMO')), 'Card renders Momo hero tag');
  assert(filledTexts.some(t => t.includes('16,800')), 'Card renders formatted final score');
  assert(filledTexts.some(t => t.includes('97%')), 'Card renders accuracy percentage');
  assert(filledTexts.some(t => t.includes('x16')), 'Card renders max combo counter');
  assert(filledTexts.some(t => t.includes('74')), 'Card renders enemies banished counter');
  assert(filledTexts.some(t => t.includes('SSS')), 'Card renders SSS rank crest');
  assert(filledTexts.some(t => t.includes('ĐẠI PHÁP SƯ TỐI CAO')), 'Card renders Grand Archmage title');
  assert(filledTexts.some(t => t.includes('ĐỘ KHÓ: ÁC MỘNG')), 'Card renders selected difficulty badge');

  // =========================================================================
  // SECTION 3: AUDIO SYSTEM CAT SFX METHODS
  // =========================================================================
  console.log('\n--- 3. Testing AudioSystem Feline Vocalizations ---');

  const audioSys = new AudioSystem();
  audioSys.ctx = new MockCtx();
  audioSys.masterGain = audioSys.ctx.createGain();

  assert(typeof audioSys.playCatMeow === 'function', 'audioSys.playCatMeow method exists');
  assert(typeof audioSys.playCatPurr === 'function', 'audioSys.playCatPurr method exists');
  assert(typeof audioSys.playCatHiss === 'function', 'audioSys.playCatHiss method exists');

  const nodesBefore = audioSys.ctx.createdNodes.length;
  audioSys.playCatMeow('cheerful');
  const meowCount = audioSys.ctx.createdNodes.length - nodesBefore;
  assert(meowCount >= 3, `playCatMeow('cheerful') generates synthesized feline audio nodes (found ${meowCount})`);

  const nodesBeforePurr = audioSys.ctx.createdNodes.length;
  audioSys.playCatPurr(0.6);
  const purrCount = audioSys.ctx.createdNodes.length - nodesBeforePurr;
  assert(purrCount >= 3, `playCatPurr() generates amplitude-modulated purr rumble (found ${purrCount})`);

  const nodesBeforeHiss = audioSys.ctx.createdNodes.length;
  audioSys.playCatHiss();
  const hissCount = audioSys.ctx.createdNodes.length - nodesBeforeHiss;
  assert(hissCount >= 2, `playCatHiss() generates defensive cat hiss audio (found ${hissCount})`);

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
