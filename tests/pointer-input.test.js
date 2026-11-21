import assert from 'node:assert/strict';
import { Worker as NodeWorker } from 'node:worker_threads';
import { PracticeSession } from '../src/systems/PracticeSession.js';
import { Game } from '../src/core/Game.js';
import { InputHandler } from '../src/systems/InputHandler.js';
import { GestureRecognition } from '../src/systems/GestureRecognition.js';
import { GestureEngine } from '../src/GestureEngine.js';
import { SettingsStore } from '../src/core/Settings.js';
import { UIManager } from '../src/ui/UIManager.js';
import { shapes, fixtures, negatives, interpolate } from './fixtures/gestures.js';

function target(extra = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, fn) { const set = listeners.get(type) || new Set(); set.add(fn); listeners.set(type, set); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    fire(type, e = {}) { for (const fn of listeners.get(type) || []) fn({ type, ...e }); },
    get listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); }
  }, extra);
}
globalThis.window = target({ innerWidth: 800, innerHeight: 600, visualViewport: target() });
globalThis.document = target({ hidden: false });
function setup(width = 800, height = 600, dpr = 2) {
  let capture = null;
  const calls = [], canvas = target({ style: {}, width: width * dpr, height: height * dpr,
    getBoundingClientRect: () => ({ left: 17, top: 83, width: width / 2, height: height / 2 }),
    setPointerCapture(id) { capture = id; }, hasPointerCapture: id => id === capture,
    releasePointerCapture() { capture = null; }
  });
  const input = new InputHandler(canvas, new GestureEngine(), null, (result, stroke) => calls.push({ result, stroke }), null, () => ({ width, height }));
  input.setEnabled(true);
  return { input, canvas, calls };
}
const event = (p, pointerType = 'touch', extra = {}) => ({ pointerId: 1, pointerType, isPrimary: true, button: 0,
  clientX: 17 + p.x / 2, clientY: 83 + p.y / 2, timeStamp: p.timestamp ?? 0,
  cancelable: true, preventDefault() { this.prevented = true; }, ...extra });
function draw(canvas, points, pointerType = 'touch') {
  canvas.fire('pointerdown', event(points[0], pointerType));
  for (const p of points.slice(1, -1)) canvas.fire('pointermove', event(p, pointerType));
  const end = event(points.at(-1), pointerType);
  canvas.fire('pointerup', end);
  canvas.fire('pointerup', end); // duplicate delivery / bubbling must never cast twice
  window.fire('pointerup', end);
}
let cases = 0;
for (const pointerType of ['mouse', 'touch', 'pen']) {
  for (const [width, height, dpr] of [[320, 568, 2], [844, 390, 3], [820, 1180, 2], [1440, 900, 1], [3840, 2160, 2]]) {
    const { input, canvas, calls } = setup(width, height, dpr);
    for (const interval of [1, 8, 40]) for (const [gesture, shape] of Object.entries(shapes)) {
      const size = Math.min(width, height) * 0.4;
      const points = interpolate(shape, interval === 1 ? 2 : 6).map((p, i) => ({
        x: width * 0.3 + p.x * size / 100, y: height * 0.3 + p.y * size / 100, timestamp: i * interval
      }));
      const before = calls.length;
      draw(canvas, points, pointerType);
      assert.equal(calls.length, before + 1, 'one cast per completed contact');
      assert.equal(calls.at(-1).result.gesture, gesture, `${pointerType}/${width}x${height}@${dpr}/${interval}/${gesture}`);
      assert.equal(calls.at(-1).stroke.length, points.length);
      calls.at(-1).stroke.forEach((p, i) => assert.ok(Math.hypot(p.x - points[i].x, p.y - points[i].y) < 1e-9, 'logical coordinate precision'));
      assert.equal(input.activePointerId, null);
      assert.equal(input.isDrawing, false);
      cases++;
    }
    assert.equal(canvas.style.touchAction, 'none');
    input.destroy(); assert.equal(canvas.listenerCount, 0);
  }
}
console.log(`Pointer matrix: ${cases} strokes correctly recognized once, with exact logical alignment.`);

// Coalesced samples remain chronological, deduplicated, un-smoothed, and retain the release endpoint.
{
  const { input, canvas, calls } = setup();
  canvas.fire('pointerdown', event({ x: 0, y: 40, timestamp: 0 }));
  const batch = [1, 2, 3].map(i => event({ x: i * 30, y: 40, timestamp: i }));
  canvas.fire('pointermove', { ...batch.at(-1), getCoalescedEvents: () => batch });
  assert.equal(input.currentPoints.length, 4);
  canvas.fire('pointermove', batch[0]); // stale raw/coalesced event
  assert.equal(input.currentPoints.length, 4);
  canvas.fire('pointerup', event({ x: 120, y: 40, timestamp: 4 }));
  assert.equal(calls[0].stroke.length, 5); assert.equal(calls[0].stroke.at(-1).x, 120);
  input.destroy();
}
// Secondary touch, pen palm, right click, unrelated up/cancel never take ownership or cast.
{
  const { input, canvas, calls } = setup();
  canvas.fire('pointerdown', event({ x: 1, y: 1 }, 'pen', { button: 2 }));
  assert.equal(input.isDrawing, false);
  canvas.fire('pointerdown', event({ x: 1, y: 1 }, 'pen'));
  canvas.fire('pointerdown', event({ x: 80, y: 90 }, 'touch', { pointerId: 2 }));
  for (const type of ['pointermove', 'pointerup', 'pointercancel']) canvas.fire(type, event({ x: 80, y: 90 }, 'touch', { pointerId: 2 }));
  assert.equal(input.currentPoints.length, 1); assert.equal(input.activePointerId, 1);
  canvas.fire('pointerup', event({ x: 150, y: 1 })); assert.equal(calls.length, 1);
  canvas.fire('pointerdown', event({ x: 1, y: 1 }, 'touch', { pointerId: 2, isPrimary: false }));
  assert.equal(input.isDrawing, false); input.destroy();
}
for (const [owner, type] of [[window, 'blur'], [window, 'pagehide'], [window, 'resize'], [window, 'orientationchange'],
  [window, 'scroll'], [window.visualViewport, 'resize'], [window.visualViewport, 'scroll'], [document, 'visibilitychange'],
  [null, 'pointercancel'], [null, 'lostpointercapture']]) {
  const { input, canvas, calls } = setup();
  canvas.fire('pointerdown', event({ x: 0, y: 0 })); canvas.fire('pointermove', event({ x: 100, y: 0, timestamp: 1 }));
  document.hidden = true; (owner || canvas).fire(type, { pointerId: 1 }); document.hidden = false;
  assert.equal(input.isDrawing, false, type); assert.equal(input.currentPoints.length, 0, type);
  canvas.fire('pointerup', event({ x: 150, y: 0, timestamp: 2 })); assert.equal(calls.length, 0, type);
  draw(canvas, [{ x: 0, y: 0 }, { x: 100, y: 0 }]); assert.equal(calls.length, 1, `recovery after ${type}`);
  input.destroy();
}
// Queued recognition must not escape a pause, resize, reset or destroyed input instance.
for (const interrupt of [input => input.setEnabled(false), input => input.clear(), input => input.cancelStroke(), input => input.destroy()]) {
  const { input, canvas, calls } = setup(); let finish;
  input.recognition = { recognize: () => new Promise(resolve => { finish = resolve; }), destroy() {} };
  draw(canvas, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
  interrupt(input); finish({ gesture: 'horizontal', score: 1 }); await Promise.resolve();
  assert.equal(calls.length, 0); input.destroy();
}
// Visible dot on down, exact endpoint, corner preservation, and reduced ink all leave raw input intact.
{
  const { input, canvas } = setup(); const commands = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => commands.push([key, ...args]), set: () => true });
  canvas.fire('pointerdown', event({ x: 10, y: 20 })); input.render(ctx);
  assert.ok(commands.some(([name]) => name === 'stroke'), 'contact draws before movement');
  input.setTrailOptions('minimal', true);
  canvas.fire('pointermove', event({ x: 50, y: 100, timestamp: 1 }));
  canvas.fire('pointermove', event({ x: 90, y: 20, timestamp: 2 }));
  const raw = JSON.stringify(input.currentPoints); commands.length = 0; input.render(ctx);
  assert.equal(JSON.stringify(input.currentPoints), raw);
  assert.ok(commands.some(([name, x, y]) => name === 'lineTo' && x === 50 && y === 100), 'V corner stays sharp');
  assert.ok(commands.some(([name, x, y]) => name === 'lineTo' && x === 90 && y === 20), 'ink ends at pointer');
  canvas.fire('pointerup', event({ x: 90, y: 20, timestamp: 2 })); assert.equal(input.fadingStrokes.length, 0);
  input.destroy();
}
// Execute the actual worker module in a real Node worker; fixture results must match bit for bit.
const workerURL = new URL('../src/workers/gesture.worker.js', import.meta.url).href;
const engine = new GestureEngine();
const service = new GestureRecognition(engine, () => {
  const source = `import {parentPort} from 'node:worker_threads'; globalThis.self={postMessage:m=>parentPort.postMessage(m)}; await import(${JSON.stringify(workerURL)}); parentPort.on('message',data=>self.onmessage({data}));`;
  const w = new NodeWorker(new URL(`data:text/javascript,${encodeURIComponent(source)}`));
  return { postMessage: data => w.postMessage(data), terminate: () => w.terminate(),
    set onmessage(fn) { w.on('message', data => fn({ data })); }, set onerror(fn) { w.on('error', fn); }, set onmessageerror(fn) { w.on('messageerror', fn); } };
});
for (const fixture of [...fixtures, ...negatives]) assert.deepEqual(await service.recognize(fixture.points), engine.recognize(fixture.points), fixture.id);
for (const sensitivity of ['easy', 'strict', 'normal']) {
  engine.setSensitivity(sensitivity);
  assert.deepEqual(await service.recognize(shapes.circle), engine.recognize(shapes.circle));
}
for (const [name, points] of Object.entries(shapes)) assert.deepEqual(await service.scoreFor(points, name), engine.scoreFor(points, name));
const parallel = await Promise.all(Object.values(shapes).map(points => service.recognize(points)));
assert.deepEqual(parallel.map(r => r.gesture), Object.keys(shapes));
engine.addTemplate('other-horizontal', shapes.horizontal);
assert.equal((await service.recognize(shapes.horizontal)).reason, 'ambiguous'); service.destroy();
assert.equal(await service.recognize(shapes.horizontal), null);
const failed = new GestureRecognition(new GestureEngine(), () => { throw new Error('worker blocked'); });
assert.equal((await failed.recognize(shapes.horizontal)).gesture, 'horizontal'); failed.destroy();
let brokenWorker;
const fallback = new GestureRecognition(new GestureEngine(), () => (brokenWorker = { postMessage() {}, terminate() {} }));
const job = fallback.recognize(shapes.vertical); await fallback.ready; await Promise.resolve();
brokenWorker.onerror({ preventDefault() {} });
assert.equal((await job).gesture, 'vertical'); fallback.destroy();
console.log('Real worker fixture parity, sensitivity sync, shutdown and error fallback passed.');

// Similarity is labeled as a match, with text/symbol distinctions independent of colour.
const feedback = Object.create(UIManager.prototype);
feedback.game = { settings: { get: () => true } };
feedback.gestureFeedback = { classList: { add() {}, remove() {} }, setAttribute(k, v) { this[k] = v; } };
for (const reason of ['ambiguous', 'low_score']) {
  feedback.showGestureFeedback(null, .8, false, null, { reason, candidate: 'circle' });
  assert.equal(feedback.gestureFeedback['data-verdict'], reason === 'ambiguous' ? 'ambiguous' : 'rejected');
  assert.match(feedback.gestureFeedback.textContent, /Khớp 80%/);
}
feedback.showGestureFeedback('horizontal', .9, true);
assert.equal(feedback.gestureFeedback['data-verdict'], 'valid'); assert.match(feedback.gestureFeedback.textContent, /✓/);
clearTimeout(feedback._feedbackTimeout);
const settings = new SettingsStore(null);
assert.equal(settings.set('trailEffect', 'minimal'), true); assert.equal(settings.set('trailEffect', 'invalid'), false);
assert.equal(settings.set('reducedEffects', true), true);
assert.equal(window.listenerCount, 0); assert.equal(document.listenerCount, 0); assert.equal(window.visualViewport.listenerCount, 0);
console.log('Pointer interruptions, coalescing, touch ownership, visual fidelity, feedback and cleanup passed.');

// Persisted ink preferences and OS reduced-motion default are independently adjustable.
window.matchMedia = () => ({ matches: true });
const reducedSettings = new SettingsStore(null);
assert.equal(reducedSettings.get('reducedEffects'), true);
assert.equal(reducedSettings.set('trailEffect', 'minimal'), true);
assert.equal(reducedSettings.set('trailEffect', 'invalid'), false);
assert.equal(reducedSettings.get('trailEffect'), 'minimal');
assert.equal(reducedSettings.set('reducedEffects', false), true);
assert.equal(reducedSettings.get('reducedEffects'), false);
reducedSettings.reset(); assert.equal(reducedSettings.get('reducedEffects'), true);

// Scroll blocking remains scoped to the arena; capture failure can finish outside it.
{
  const { input, canvas, calls } = setup(); let prevented = 0;
  for (const type of ['touchstart', 'touchmove', 'gesturestart']) canvas.fire(type, { cancelable: true, preventDefault() { prevented++; } });
  assert.equal(prevented, 3);
  canvas.setPointerCapture = () => { throw new Error('capture unavailable'); };
  canvas.fire('pointerdown', event({ x: 0, y: 0 }));
  window.fire('pointermove', event({ x: 70, y: 0, timestamp: 1 }, 'mouse', { target: {} }));
  window.fire('pointerup', event({ x: 140, y: 0, timestamp: 2 }));
  assert.equal(calls.length, 1); assert.equal(calls[0].stroke.at(-1).x, 140); input.destroy();
}
console.log('Reduced-effects preferences, arena scroll prevention and capture fallback passed.');

// Changing practice target invalidates queued scores before they can update mastery for another rune.
{
  let finish, cancellations = 0;
  const game = { inputHandler: { cancelStroke() { cancellations++; }, recognition: { scoreFor: () => new Promise(resolve => { finish = resolve; }) } } };
  const practice = new PracticeSession(game); practice.active = true;
  const pending = practice.handleStroke(shapes.horizontal);
  practice.selectRune('circle'); finish({ passed: true, accuracy: 1 });
  assert.equal(await pending, null); assert.equal(cancellations, 1); assert.equal(practice.history.length, 0);
}
// Combat camera shake must be restored before ink is rendered.
{
  const g = Object.create(Game.prototype), transforms = []; let transformCount = 0, rendered = false;
  const ctx = { save() { transforms.push(transformCount); }, restore() { transformCount = transforms.pop(); },
    translate() { transformCount++; }, rotate() { transformCount++; } };
  Object.assign(g, { width: 800, height: 600, enemies: [], projectiles: [], player: { render() {} },
    particleSystem: { screenShake: { timer: 1, x: 15, y: 9, rotation: .1 }, renderTexts() {}, renderParticles() {} },
    _renderTutorialGuide() {}, _renderDynamicLighting() {}, inputHandler: { render() { assert.equal(transformCount, 0); rendered = true; } } });
  g.renderPlaying(ctx); assert.equal(rendered, true);
}
console.log('Practice target invalidation and camera-independent ink rendering passed.');

// Pointer Events browsers rely on touch-action without redundant blocking Touch Events handlers.
{
  window.PointerEvent = class {};
  const { input, canvas } = setup(); let prevented = false;
  canvas.fire('touchmove', { cancelable: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, false); assert.equal(canvas.style.touchAction, 'none');
  input.destroy(); delete window.PointerEvent;
}
