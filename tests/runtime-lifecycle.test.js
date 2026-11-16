import assert from 'node:assert/strict';
import { Game } from '../src/core/Game.js';
import { InputHandler } from '../src/systems/InputHandler.js';
import { GAME_STATES } from '../src/core/Constants.js';
import { StateMachine } from '../src/core/StateMachine.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`  ✅ PASS: ${name}`); }
const saved = Object.fromEntries(['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
let seq = 0;
const requests = new Map();
globalThis.requestAnimationFrame = fn => { requests.set(++seq, fn); return seq; };
globalThis.cancelAnimationFrame = id => requests.delete(id);
globalThis.document = { hidden: false };
globalThis.window = { innerWidth: 800, innerHeight: 600 };
function arena() {
  const g = Object.create(Game.prototype);
  Object.assign(g, { isRunning: false, _rafId: 0, lastTime: 0, updates: 0, renders: 0,
    update() { this.updates++; }, render() { this.renders++; },
    quality: { sampleFrame() {}, resetSampling() {} }
  });
  g.stateMachine = new StateMachine(g);
  for (const state of g.stateMachine.states.values()) { state.enter = () => {}; state.exit = () => {}; }
  g._boundLoop = t => g.loop(t);
  return g;
}
function frame(g, t) { const cb = requests.get(g._rafId); requests.delete(g._rafId); cb(t); }
try {
  check('starting twice creates one frame chain and preserves an active run', () => {
    requests.clear(); const g = arena(); g.start(); g.stateMachine.changeState(GAME_STATES.PLAYING); const id = g._rafId; g.start();
    assert.equal(g._rafId, id); assert.equal(requests.size, 1); assert.equal(g.stateMachine.getCurrentStateName(), GAME_STATES.PLAYING);
  });
  check('a paused arena is painted once and repaints after invalidation', () => {
    requests.clear(); const g = arena(); g.start(); g.stateMachine.changeState(GAME_STATES.PAUSE);
    frame(g, 100); frame(g, 116); frame(g, 132); assert.equal(g.renders, 1);
    g._pausedFrameDrawn = false; frame(g, 148); assert.equal(g.renders, 2);
    g.stateMachine.changeState(GAME_STATES.PLAYING); frame(g, 164); frame(g, 180); assert.equal(g.renders, 4);
  });
  check('hiding cancels work; repeated visible notifications resume one loop with manual pause intact', () => {
    requests.clear(); const g = arena(); g.start(); g.stateMachine.changeState(GAME_STATES.PLAYING);
    document.hidden = true; g._onVisibilityChange(); assert.equal(requests.size, 0); assert.equal(g._rafId, 0);
    assert.equal(g.stateMachine.getCurrentStateName(), GAME_STATES.PAUSE);
    document.hidden = false; g._onVisibilityChange(); g._onVisibilityChange(); assert.equal(requests.size, 1);
    frame(g, g.lastTime + 16); assert.equal(g.renders, 1); assert.equal(g.stateMachine.getCurrentStateName(), GAME_STATES.PAUSE);
  });
  check('a frame already queued at hide time does not update or schedule another', () => {
    requests.clear(); const g = arena(); g.start(); document.hidden = true; frame(g, 100);
    assert.equal(g.renders, 0); assert.equal(g.updates, 0); assert.equal(requests.size, 0); document.hidden = false;
  });
  check('changing render density preserves a stroke; changing logical arena size cancels it', () => {
    let cancelled = 0; let cap = 2;
    const g = Object.create(Game.prototype);
    const parent = { clientWidth: 800, clientHeight: 600 };
    Object.assign(g, { width: 800, height: 600, lightScale: 0.5, _sizeKey: '800x600@2/0.5',
      canvas: { parentElement: parent, style: {} }, player: { resize() {} }, enemies: [],
      quality: { getDprCap: () => cap }, inputHandler: { cancelStroke() { cancelled++; } }
    });
    window.devicePixelRatio = 2;
    cap = 1; g.resize(); assert.equal(cancelled, 0);
    parent.clientWidth = 600; g.resize(); assert.equal(cancelled, 1);
  });
  check('interrupting a captured stroke releases it without recognizing or leaking points into the next stroke', () => {
    const listeners = new Map(); let capture = null; let casts = 0; let stopped = 0;
    const canvas = {
      addEventListener: (name, fn) => listeners.set(name, fn),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
      setPointerCapture: id => { capture = id; }, hasPointerCapture: id => capture === id,
      releasePointerCapture: () => { capture = null; }
    };
    const input = new InputHandler(canvas, { recognize: () => { casts++; return {}; } }, null, null, { stopDraw: () => stopped++ });
    input.setEnabled(true);
    const ev = (type, x, id = 1) => ({ type, pointerId: id, button: 0, clientX: x, clientY: 100, timeStamp: x });
    listeners.get('pointerdown')(ev('pointerdown', 100)); listeners.get('pointermove')(ev('pointermove', 200));
    input.setEnabled(false);
    assert.equal(capture, null); assert.equal(input.activePointerId, null); assert.equal(input.currentPoints.length, 0); assert.equal(casts, 0); assert.equal(stopped, 1);
    input.setEnabled(true); listeners.get('pointerdown')(ev('pointerdown', 300, 2));
    listeners.get('lostpointercapture')(ev('lostpointercapture', 200, 1));
    assert.equal(input.isDrawing, true); assert.equal(input.currentPoints[0].x, 300);
    listeners.get('pointerup')(ev('pointerup', 400, 2)); assert.equal(casts, 1);
  });
} finally {
  for (const [key, desc] of Object.entries(saved)) { if (desc) Object.defineProperty(globalThis, key, desc); else delete globalThis[key]; }
}
console.log(`\nRuntime Lifecycle Tests: ${checks} Passed, 0 Failed`);
