/**
 * @file test-mobile-optimization.js
 * @description Verifies the mobile performance work:
 *  - QualityManager tier selection + adaptive step-down from real frame times
 *  - ctx.shadowBlur scaling hook
 *  - Glow-free fallbacks in ParticleSystem and InputHandler (no shadow blur passes)
 *  - Per-stroke pointer mapping cache (no getBoundingClientRect on every pointermove)
 *  - Game: resize() skips needless canvas re-allocation, quality tiers reach every subsystem,
 *    background layer is repainted at a reduced rate, auto-pause when the page is hidden
 *  - HUD writes are skipped when nothing changed
 */

import { QualityManager, QUALITY_TIERS, installShadowBlurScaler } from './src/systems/QualityManager.js';
import { ParticleSystem } from './src/systems/ParticleSystem.js';
import { InputHandler } from './src/systems/InputHandler.js';
import { GAME_STATES } from './src/core/Constants.js';

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

// ---------------------------------------------------------------------------
// Shared mocks
// ---------------------------------------------------------------------------
global.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 2,
  addEventListener: () => {},
  localStorage: { getItem: () => null, setItem: () => {} }
};

/** A 2D-context-like object whose shadowBlur is an accessor on the *prototype*, like the real thing. */
class FakeCtx2D {
  constructor() {
    this._nativeBlur = 0;
    this.blurWrites = []; // every native value that reached the "browser"
    this.calls = [];
    this.moveTos = [];
    this.lineTos = [];
  }
  get shadowBlur() { return this._nativeBlur; }
  set shadowBlur(v) { this._nativeBlur = v; this.blurWrites.push(v); }
  save() {} restore() {} translate() {} rotate() {} scale() {} beginPath() {}
  arc() {} fill() {} stroke() {} fillText() {} strokeText() {} quadraticCurveTo() {} clearRect() {} fillRect() {}
  drawImage() { this.calls.push('drawImage'); }
  setTransform() {}
  moveTo(x, y) { this.moveTos.push([x, y]); }
  lineTo(x, y) { this.lineTos.push([x, y]); }
  createRadialGradient() { return { addColorStop() {} }; }
  measureText() { return { width: 10 }; }
}

function mockCtxFactory() {
  return new FakeCtx2D();
}

global.document = {
  hidden: false,
  addEventListener: () => {},
  createElement: () => ({
    getContext: () => mockCtxFactory(),
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    appendChild: () => {},
    width: 100,
    height: 100
  }),
  getElementById: () => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {} },
    innerText: '',
    textContent: '',
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  }),
  querySelectorAll: () => [],
  querySelector: () => null
};

console.log('🧪 Starting Mobile Optimization Verification Tests...\n');

// ---------------------------------------------------------------------------
// 1. QualityManager: tier selection
// ---------------------------------------------------------------------------
console.log('--- 1. QualityManager tier selection ---');
{
  const desktop = new QualityManager({ isMobile: false, lowEndDevice: false });
  const phone = new QualityManager({ isMobile: true, lowEndDevice: false });
  const weakPhone = new QualityManager({ isMobile: true, lowEndDevice: true });
  const forced = new QualityManager({ isMobile: false, lowEndDevice: false, initialTier: 'medium' });

  assert(desktop.tier === 'high', 'Desktop starts on the high tier');
  assert(phone.tier === 'medium', 'Phone starts on the medium tier');
  assert(weakPhone.tier === 'low', 'Low-end phone starts on the low tier');
  assert(forced.tier === 'medium', 'initialTier option is honoured');
  assert(new QualityManager({ initialTier: 'bogus', lowEndDevice: false }).tier === 'high', 'Unknown initialTier falls back to high');

  assert(desktop.glowScale === 1 && phone.glowScale < 1 && phone.glowScale > 0 && weakPhone.glowScale === 0,
    'Glow scale decreases high -> medium -> low and is exactly 0 on low');
  assert(phone.particleGlow === false && desktop.particleGlow === true, 'Per-particle glow is only enabled on the high tier');
  assert(weakPhone.getDprCap() === 1, 'Low tier caps DPR at 1 on phones');
  assert(phone.getDprCap() === 1.5 && desktop.getDprCap() === 2, 'DPR caps keep the original 1.5 (phone) / 2.0 (desktop) at their default tiers');
  assert(QUALITY_TIERS.low.lightScale < QUALITY_TIERS.high.lightScale, 'Lightmap resolution drops on weaker tiers');
  assert(desktop.bgIntervalMs === 0 && phone.bgIntervalMs > 0 && weakPhone.bgIntervalMs > phone.bgIntervalMs,
    'Background repaint interval: every frame on high, throttled on medium, more on low');
}

// ---------------------------------------------------------------------------
// 2. QualityManager: adaptive downgrade from frame times
// ---------------------------------------------------------------------------
console.log('\n--- 2. QualityManager adaptive step-down ---');
{
  const feed = (q, ms, count) => { for (let i = 0; i < count; i++) q.sampleFrame(ms); };

  // Healthy 60 FPS device never degrades
  const healthy = new QualityManager({ isMobile: true, lowEndDevice: false });
  feed(healthy, 16.7, 2000);
  assert(healthy.tier === 'medium', 'A steady 60 FPS device keeps its tier');

  // Warm-up frames are ignored, even when slow
  const warm = new QualityManager({ isMobile: true, lowEndDevice: false });
  feed(warm, 30, 90); // 2.7 s of slow frames (more than one 60-frame window) but still inside the 3 s warm-up
  assert(warm.tier === 'medium', 'Slow frames during warm-up do not trigger a downgrade');
  feed(warm, 30, 80); // warm-up now over: the very same slowness is judged
  assert(warm.tier === 'low', 'The same slowness after warm-up does trigger a downgrade');

  // Sustained slowness steps down exactly one tier
  const slow = new QualityManager({ isMobile: true, lowEndDevice: false });
  let changes = 0;
  slow.onChange(() => changes++);
  feed(slow, 30, 100 + 60); // clear warm-up (3000 ms) then one full sample window
  assert(slow.tier === 'low' && changes === 1, 'Sustained ~33 ms frames step medium -> low (one change event)');
  assert(slow.stepDown() === false, 'Cannot step below the lowest tier');

  // Very slow device skips a tier
  const awful = new QualityManager({ isMobile: false, lowEndDevice: false });
  feed(awful, 60, 60); // 3.6 s of 60 ms frames: past warm-up
  feed(awful, 60, 60);
  assert(awful.tier === 'low', 'A ~16 FPS device jumps high -> low instead of settling for medium');

  // Spikes (tab switch, GC pause) must not count
  const spiky = new QualityManager({ isMobile: true, lowEndDevice: false });
  feed(spiky, 16.7, 400);
  for (let i = 0; i < 200; i++) spiky.sampleFrame(i % 20 === 0 ? 900 : 16.7);
  assert(spiky.tier === 'medium', 'Frames longer than 250 ms (backgrounded tab / hitch) are ignored');

  // Never steps back up
  const recovered = new QualityManager({ isMobile: true, lowEndDevice: false });
  feed(recovered, 30, 160);
  const downTier = recovered.tier;
  feed(recovered, 8, 2000);
  assert(recovered.tier === downTier, 'Tier never climbs back automatically (no oscillation)');

  // resetSampling keeps a returning tab from being judged on its first frames
  const resumed = new QualityManager({ isMobile: true, lowEndDevice: false });
  feed(resumed, 16.7, 400);
  resumed.resetSampling(2000);
  feed(resumed, 40, 40); // 1.6 s of slow frames, inside the new warm-up
  assert(resumed.tier === 'medium', 'resetSampling() grants a fresh warm-up window');

  // Listener errors must not break the loop
  const bad = new QualityManager({ isMobile: false, lowEndDevice: false });
  bad.onChange(() => { throw new Error('boom'); });
  let threw = false;
  try { bad.setTier('low'); } catch (e) { threw = true; }
  assert(!threw && bad.tier === 'low', 'A throwing change-listener does not propagate');
}

// ---------------------------------------------------------------------------
// 3. shadowBlur scaling hook
// ---------------------------------------------------------------------------
console.log('\n--- 3. ctx.shadowBlur scaling hook ---');
{
  let scale = 1;
  const ctx = new FakeCtx2D();
  const installed = installShadowBlurScaler(ctx, () => scale);
  assert(installed === true, 'Hook installs on a context whose prototype exposes shadowBlur');
  assert(installShadowBlurScaler(ctx, () => scale) === false, 'Installing twice is a no-op');

  ctx.shadowBlur = 20;
  assert(ctx._nativeBlur === 20, 'High tier: blur reaches the browser unchanged');
  assert(ctx.shadowBlur === 20, 'Reading shadowBlur returns what game code wrote');

  scale = 0.5;
  ctx.shadowBlur = 20;
  assert(ctx._nativeBlur === 10, 'Medium-style scale halves the native blur');

  scale = 0;
  ctx.shadowBlur = 24;
  assert(ctx._nativeBlur === 0, 'Low tier: native blur is forced to 0 (no blur pass)');
  assert(ctx.shadowBlur === 24, 'Game-visible value is still the requested one');

  // Plain objects / mocks without the accessor must be left alone
  const plain = { save() {} };
  assert(installShadowBlurScaler(plain, () => 1) === false, 'Mocks without a shadowBlur accessor are skipped safely');
  assert(installShadowBlurScaler(null, () => 1) === false, 'null context is handled');
}

// ---------------------------------------------------------------------------
// 4. ParticleSystem: glow flag + soft cap
// ---------------------------------------------------------------------------
console.log('\n--- 4. ParticleSystem glow toggle & active limit ---');
{
  const make = (glow) => {
    const ps = new ParticleSystem(100, 10);
    ps.setGlow(glow);
    ps.emitMagicSparks(100, 100, 10, '#f472b6');
    ps.emitFloatingText && ps.emitFloatingText('+10', 50, 50, '#fbbf24', 20);
    return ps;
  };

  const glowCtx = new FakeCtx2D();
  const glowPs = make(true);
  glowPs.render(glowCtx);
  assert(glowCtx.blurWrites.some((v) => v > 0), 'Glow ON: particles request a shadow blur (original look)');

  const flatCtx = new FakeCtx2D();
  const flatPs = new ParticleSystem(100, 10);
  flatPs.setGlow(false);
  flatPs.emitMagicSparks(100, 100, 10, '#f472b6');
  flatPs.render(flatCtx);
  assert(flatCtx.blurWrites.every((v) => v === 0), 'Glow OFF: no particle ever requests a non-zero shadow blur');
  assert(flatPs.activeParticleCount > 0, 'Particles are still drawn without glow');

  const capped = new ParticleSystem(100, 10);
  capped.setActiveLimit(20);
  for (let i = 0; i < 80; i++) capped.emitMagicSparks(10, 10, 1, '#fff');
  assert(capped.activeParticleCount <= 20, `Soft cap holds the live particle count (<=20, got ${capped.activeParticleCount})`);
  capped.setActiveLimit(10000);
  assert(capped.activeLimit === 100, 'Active limit is clamped to the pre-allocated pool size');
  capped.setActiveLimit(-5);
  assert(capped.activeLimit >= 1, 'Active limit never drops below 1');
}

// ---------------------------------------------------------------------------
// 5. InputHandler: glow-free stroke, point striding, pointer mapping cache
// ---------------------------------------------------------------------------
console.log('\n--- 5. InputHandler stroke rendering & pointer mapping cache ---');
{
  let rectReads = 0;
  const handlers = {};
  const canvas = {
    getBoundingClientRect: () => { rectReads++; return { left: 10, top: 20, width: 400, height: 800 }; },
    addEventListener: (type, fn) => { handlers[type] = fn; },
    setPointerCapture: () => {},
    hasPointerCapture: () => false,
    releasePointerCapture: () => {}
  };
  const input = new InputHandler(canvas, null, null, null, null, () => ({ width: 800, height: 1600 }));
  input.setEnabled(true);

  // Mapping cache: 1 rect read per stroke, regardless of the number of pointermove events
  handlers.pointerdown({ pointerId: 1, clientX: 110, clientY: 120 });
  for (let i = 0; i < 60; i++) handlers.pointermove({ pointerId: 1, clientX: 110 + i, clientY: 120 + i });
  assert(rectReads === 1, `getBoundingClientRect called once per stroke (61 events -> ${rectReads} read)`);
  const p0 = input.currentPoints[0];
  const pLast = input.currentPoints[input.currentPoints.length - 1];
  assert(p0.x === 200 && p0.y === 200, 'Pointer mapping still scales client -> logical (2x): first point');
  assert(pLast.x === (110 + 59 - 10) * 2 && pLast.y === (120 + 59 - 20) * 2, 'Pointer mapping stays correct on later moves');
  handlers.pointerup({ pointerId: 1 });
  rectReads = 0;
  input._getCanvasPoint({ clientX: 10, clientY: 20 });
  input._getCanvasPoint({ clientX: 10, clientY: 20 });
  assert(rectReads === 2, 'Outside a stroke the mapping is NOT cached (always fresh)');

  // Stroke rendering without glow
  const pts = Array.from({ length: 300 }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 40 + 100 }));

  const flatCtx = new FakeCtx2D();
  input.setGlow(false);
  input._drawStrokeLine(flatCtx, pts, '#e879f9', 1);
  assert(flatCtx.blurWrites.every((v) => v === 0), 'Glow OFF: neon trail never sets a shadow blur');

  const glowCtx = new FakeCtx2D();
  input.setGlow(true);
  input._drawStrokeLine(glowCtx, pts, '#e879f9', 1);
  assert(glowCtx.blurWrites.some((v) => v > 0), 'Glow ON: neon trail keeps its shadowBlur layers');

  // Striding keeps the true endpoints and bounds the work
  const ctxA = new FakeCtx2D();
  input.setGlow(false);
  input._drawStrokeLine(ctxA, pts, '#e879f9', 1);
  assert(ctxA.moveTos.length === 1 && ctxA.moveTos[0][0] === 0, 'Long stroke starts at the first sample');
  const lastLine = ctxA.lineTos[ctxA.lineTos.length - 1];
  assert(lastLine[0] === 299, 'Long stroke ends exactly at the last sample');

  let quadCount = 0;
  const countingCtx = new FakeCtx2D();
  countingCtx.quadraticCurveTo = () => { quadCount++; };
  input._drawStrokeLine(countingCtx, pts, '#e879f9', 1);
  assert(quadCount <= 62, `300-point stroke is traced with <=62 curve segments (got ${quadCount})`);

  // Short strokes (2 points) still draw a straight line
  const shortCtx = new FakeCtx2D();
  input._drawStrokeLine(shortCtx, [{ x: 0, y: 0 }, { x: 5, y: 5 }], '#e879f9', 1);
  assert(shortCtx.lineTos.length === 1 && shortCtx.lineTos[0][0] === 5, 'Two-point stroke renders as a single line segment');
}

// ---------------------------------------------------------------------------
// 6. Game integration
// ---------------------------------------------------------------------------
console.log('\n--- 6. Game integration (resize, tiers, background layer, auto-pause) ---');
{
  let widthWrites = 0;
  const mainCtx = new FakeCtx2D();
  const parent = { clientWidth: 400, clientHeight: 800 };
  const mockCanvas = {
    getContext: () => mainCtx,
    parentElement: parent,
    _w: 0,
    get width() { return this._w; },
    set width(v) { widthWrites++; this._w = v; },
    height: 0,
    style: {},
    addEventListener: () => {}
  };

  const { Game } = await import('./src/core/Game.js');
  const game = new Game(mockCanvas);

  assert(game.quality instanceof QualityManager, 'Game owns a QualityManager');
  assert(mainCtx.__shadowScalerInstalled === true, 'Main context has the shadowBlur scaler installed');

  // --- resize early-out
  game.quality.setTier('high');
  widthWrites = 0;
  game.resize();
  game.resize();
  game.resize();
  assert(widthWrites === 0, 'resize() with unchanged size/DPR/tier does not re-allocate the canvas buffer');

  parent.clientWidth = 390;
  game.resize();
  assert(widthWrites === 1, 'resize() re-allocates once when the logical size changes');
  assert(game.width === 390 && game.height === 800, 'Logical size is updated');

  // --- tiers propagate
  game.quality.setTier('low');
  assert(game.particleSystem.glow === false, 'Low tier: particle glow disabled');
  assert(game.inputHandler.glow === false, 'Low tier: stroke glow disabled');
  assert(game.lightScale === QUALITY_TIERS.low.lightScale, 'Low tier: lightmap scale reduced');
  assert(game.dpr <= 1, `Low tier: DPR capped at 1 (got ${game.dpr})`);
  assert(game.particleSystem.activeLimit < game.particleBudget, 'Low tier: particle budget reduced');

  game.quality.setTier('high');
  assert(game.particleSystem.glow === true && game.inputHandler.glow === true, 'High tier restores glow');
  assert(game.particleSystem.activeLimit === game.particleBudget, 'High tier restores the full particle budget');
  assert(game.dpr === 2, `High tier on a 2x desktop uses DPR 2 (got ${game.dpr})`);

  // --- background layer: every frame on high, throttled on medium
  let bgRenders = 0;
  game.backgroundRenderer.render = () => { bgRenders++; };

  game.quality.setTier('high');
  for (let i = 0; i < 5; i++) { game.lastTime = 1000 + i * 16; game._renderLevelBackground(1); }
  assert(bgRenders === 5, 'High tier repaints the scene every frame');

  game.quality.setTier('medium'); // 33 ms interval
  bgRenders = 0;
  game._bgLastRender = -Infinity;
  const times = [5000, 5016, 5033, 5049, 5066, 5082, 5099];
  for (const t of times) { game.lastTime = t; game._renderLevelBackground(1); }
  assert(bgRenders > 0 && bgRenders < times.length, `Medium tier repaints the scene at a reduced rate (${bgRenders}/${times.length} frames)`);

  const before = bgRenders;
  game.lastTime = 5099 + 1;
  game._renderLevelBackground(1);
  assert(bgRenders === before, 'A frame inside the interval reuses the cached layer');
  game.lastTime = 5099 + 2;
  game._renderLevelBackground(2); // level change must force a repaint
  assert(bgRenders === before + 1, 'Switching level repaints immediately');

  // --- auto-pause when the page is hidden
  game.stateMachine.changeState(GAME_STATES.PLAYING);
  assert(game.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING, 'Precondition: game is PLAYING');
  global.document.hidden = true;
  game._onVisibilityChange();
  assert(game.stateMachine.getCurrentStateName() === GAME_STATES.PAUSE, 'Hiding the page pauses an active run');
  global.document.hidden = false;
  const tBefore = game.lastTime;
  game._onVisibilityChange();
  assert(game.stateMachine.getCurrentStateName() === GAME_STATES.PAUSE, 'Returning to the page does not auto-resume (player taps Continue)');
  assert(game.lastTime !== tBefore, 'Returning resets the frame clock (no huge delta-time on resume)');

  game.stateMachine.changeState(GAME_STATES.MENU);
  global.document.hidden = true;
  game._onVisibilityChange();
  assert(game.stateMachine.getCurrentStateName() === GAME_STATES.MENU, 'Hiding the page on the menu does not change state');
  global.document.hidden = false;

  // --- HUD: no redundant DOM writes
  const ui = game.uiManager;
  let scoreWrites = 0;
  const scoreEl = { set textContent(v) { scoreWrites++; this._t = v; }, get textContent() { return this._t; } };
  ui.scoreVal = scoreEl;
  ui.updateScore(100);
  ui.updateScore(100.2);
  ui.updateScore(99.8);
  assert(scoreWrites === 1, `updateScore skips the DOM when the rounded value is unchanged (${scoreWrites} write)`);
  ui.updateScore(101);
  assert(scoreWrites === 2, 'updateScore writes when the visible number changes');

  let barWrites = 0;
  const barStyle = { set width(v) { barWrites++; this._w = v; }, get width() { return this._w; } };
  let classOps = 0;
  ui.comboBadge = { classList: { add: () => { classOps++; }, remove: () => { classOps++; } } };
  ui.comboMult = { textContent: '' };
  ui.comboBar = { style: barStyle };
  ui._comboActive = false; ui._comboPct = undefined; ui._comboLabel = '';

  ui.updateCombo(0, 1, 0);
  const idleBarWrites = barWrites;
  for (let i = 0; i < 30; i++) ui.updateCombo(0, 1, 0);
  assert(barWrites === idleBarWrites && classOps <= 1, 'Idle combo meter causes no DOM writes frame after frame');

  barWrites = 0; classOps = 0;
  for (let i = 0; i < 30; i++) ui.updateCombo(3, 2, 0.5);
  assert(barWrites === 1 && classOps === 1, 'Active combo with identical state writes the DOM once, not every frame');
  assert(ui.comboMult.textContent === 'x2 (3 COMBO)', 'Combo label text is correct');
  ui.updateCombo(3, 2, 0.4);
  assert(barWrites === 2, 'Combo bar updates when the visible percentage changes');
  ui.updateCombo(0, 1, 0);
  assert(barStyle.width === '0%', 'Combo bar resets to 0% when the combo ends');
}

console.log('\n========================================');
console.log(`Mobile Optimization Tests: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) process.exit(1);
