#!/usr/bin/env node
// Real Chrome input/worker checks. CDP device emulation is not physical hardware testing.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { Bench, drawStroke } from './perf-bench.mjs';
import { shapes, interpolate } from '../tests/fixtures/gestures.js';

const b = new Bench({});
const report = { date: '2026-11-20', environment: 'Headless Chrome, CDP emulated input; timings end at canvas draw submission, not physical display', profiles: [] };
const out = 'docs/performance/pointer-input.json';
const screenshotDir = 'test-results/pointer-input';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function distribution(samples) {
  const values = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const at = p => values[Math.min(values.length - 1, Math.floor(values.length * p))] || 0;
  return { samples: values.length, p50: at(.5), p95: at(.95), max: at(1) };
}
async function settle(page, count) {
  await page.eval(`new Promise((resolve, reject) => { const end = performance.now() + 4000; function check() { if (__inputResults.length >= ${count}) resolve(); else if (performance.now() > end) reject(new Error('recognition timeout')); else setTimeout(check, 5); } check(); })`);
}
async function runShapes(page, pointerType, intervalMs, row) {
  const box = await page.eval(`(() => { const r = __ARCANE_GAME__.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()`);
  for (const [gesture, shape] of Object.entries(shapes)) {
    const size = Math.min(box.width, box.height) * .45;
    const points = interpolate(shape, 2).map(p => ({ x: box.x + box.width * .25 + p.x * size / 100, y: box.y + box.height * .25 + p.y * size / 100 }));
    const before = await page.eval('__inputResults.length');
    await drawStroke(page, points, { touch: pointerType === 'touch', pointerType, intervalMs });
    await settle(page, before + 1);
    const result = await page.eval('__inputResults.at(-1)');
    assert.equal(result.gesture, gesture, `${row.profile}/${pointerType}/${intervalMs}/${gesture}`);
    assert.equal(await page.eval('__inputResults.length'), before + 1, 'exactly one recognition per completed contact');
    row.strokes.push({ pointerType, intervalMs, expected: gesture, ...result });
  }
}
try {
  await b.start(); report.chrome = b.meta;
  const url = await b.serveRoot('dist');
  for (const profile of ['desktop', 'laptop', 'tablet', 'mobile', 'mobile-landscape']) {
    const page = await b.newPage(profile);
    const row = { profile, strokes: [] }; report.profiles.push(row);
    try {
      await b.load(page, url);
      await page.eval(`(async () => {
        const g = __ARCANE_GAME__;
        g.settings.set('highlight', false); __bench.play();
        await g.inputHandler.recognition.ready;
        window.__inputResults = []; window.__maxAlignmentError = 0;
        const original = g.onGestureRecognized.bind(g);
        g.onGestureRecognized = (r, points) => { __inputResults.push({gesture:r.gesture,score:r.score,reason:r.reason,samples:points.length}); original(r,points); };
        g.canvas.addEventListener('pointermove', e => {
          if (!g.inputHandler.isDrawing) return;
          const r=g.canvas.getBoundingClientRect(), p=g.inputHandler.lastPoint;
          if(p) __maxAlignmentError=Math.max(__maxAlignmentError,Math.hypot(p.x-(e.clientX-r.left)*g.width/r.width,p.y-(e.clientY-r.top)*g.height/r.height));
        });
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        __bench.begin();
      })()`);
      assert.equal(await page.eval('!!__ARCANE_GAME__.inputHandler.recognition.worker'), true, 'real inline worker is active');
      const scrollBefore = await page.eval('[scrollX,scrollY,document.getElementById("game-wrapper").scrollTop]');
      const type = page.profile.touch ? 'touch' : 'mouse';
      await runShapes(page, type, 8, row);
      // All eight pen gestures at fast and slow speeds, on both desktop and tablet.
      if (['desktop', 'tablet'].includes(profile)) for (const speed of [1, 20]) await runShapes(page, 'pen', speed, row);
      assert.deepEqual(await page.eval('[scrollX,scrollY,document.getElementById("game-wrapper").scrollTop]'), scrollBefore, 'drawing does not scroll arena/page');
      row.alignmentErrorLogicalPixels = await page.eval('__maxAlignmentError'); assert.ok(row.alignmentErrorLogicalPixels < .01);
      row.workerActive = await page.eval('!!__ARCANE_GAME__.inputHandler.recognition.worker');
      const metrics = await page.eval('__bench.end()');
      row.eventToInkMs = distribution(metrics.in2js); row.recognitionRoundTripMs = distribution(metrics.rec.ms);
      row.runtimeErrors = await page.eval('__perf.errors'); assert.equal(row.runtimeErrors.length, 0);
      // Cancel a real touch stream, then verify the next complete stream still casts.
      if (page.profile.touch) {
        const point = await page.eval('(() => {const r=__ARCANE_GAME__.canvas.getBoundingClientRect();return {x:r.x+r.width*.4,y:r.y+r.height*.5};})()');
        const before = await page.eval('__inputResults.length');
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
        await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + 60, y: point.y, id: 1 }] });
        await page.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        await sleep(30);
        assert.equal(await page.eval('__inputResults.length'), before);
        assert.equal(await page.eval('__ARCANE_GAME__.inputHandler.isDrawing'), false);
        row.cancelResets = true;
        if (profile === 'mobile') {
          const first = { x: point.x - 40, y: point.y, id: 1 };
          const second = { x: point.x + 50, y: point.y + 40, id: 2 };
          await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] });
          await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first, second] });
          await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{...first,x:first.x+100}, second] });
          await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await settle(page, before + 1);
          assert.equal(await page.eval('__inputResults.length'), before + 1);
          assert.equal(await page.eval('__inputResults.at(-1).gesture'), 'horizontal');
          row.multiTouchSingleCast = true;
        }
        await runShapes(page, 'touch', 1, row);
      }
      // Rotate an active mobile touch and verify all eight gestures in the newly sized arena.
      if (profile === 'mobile') {
        const p = await page.eval('(() => {const r=__ARCANE_GAME__.canvas.getBoundingClientRect();return {x:r.x+80,y:r.y+80};})()');
        const before = await page.eval('__inputResults.length');
        await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] });
        await page.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 3, mobile: true });
        await sleep(250);
        await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(await page.eval('__ARCANE_GAME__.inputHandler.isDrawing'), false);
        assert.equal(await page.eval('__inputResults.length'), before);
        await page.eval('__bench.play()');
        await page.eval(`new Promise((resolve, reject) => { const end = performance.now() + 5000; const check = () => { if (__ARCANE_GAME__.inputHandler.isEnabled) resolve(); else if (performance.now() > end) reject(new Error('resume input timeout')); else setTimeout(check, 20); }; check(); })`);
        await runShapes(page, 'touch', 8, row); row.orientationRecovery = true;
      }
      if (profile === 'desktop') {
        await page.eval(`__ARCANE_GAME__.startPractice()`);
        await page.eval(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
        const box = await page.eval(`(() => {const r=__ARCANE_GAME__.canvas.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()`);
        await drawStroke(page, [{x:box.x+box.width*.25,y:box.y+box.height*.45},{x:box.x+box.width*.65,y:box.y+box.height*.45}], {touch:false,intervalMs:8});
        await page.eval(`new Promise((resolve, reject) => { const end=performance.now()+3000; const check=()=>{if(__ARCANE_GAME__.practice.history.length)resolve();else if(performance.now()>end)reject(new Error('practice timeout'));else setTimeout(check,10);};check(); })`);
        row.practiceWorkerScoring = await page.eval('__ARCANE_GAME__.practice.lastResult.passed');
        assert.equal(row.practiceWorkerScoring, true);
      }
      fs.mkdirSync(screenshotDir, { recursive: true });
      const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(`${screenshotDir}/${profile}.png`, Buffer.from(data, 'base64'));
      console.log(profile, { strokes: row.strokes.length, worker: row.workerActive, alignment: row.alignmentErrorLogicalPixels, inkP95: row.eventToInkMs.p95, recognitionP95: row.recognitionRoundTripMs.p95 });
    } catch (error) { row.error = error.stack; row.inputState = await page.eval(`({state:__bench.state(),enabled:__ARCANE_GAME__.inputHandler.isEnabled,drawing:__ARCANE_GAME__.inputHandler.isDrawing,countdown:__ARCANE_GAME__.resumeCountdown})`); console.error(profile, error.message); }
    finally { await page.close(); }
  }
} finally {
  await b.stop();
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
}
if (report.profiles.some(row => row.error)) process.exitCode = 1;
