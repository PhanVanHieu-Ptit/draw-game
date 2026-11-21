#!/usr/bin/env node
// Real Chrome interaction validation; uses only the local benchmark's zero-dependency CDP driver.
// node scripts/validate-browser.mjs --root dist --file arcane-paws-standalone.html --out docs/performance/after-interactions.json --screenshots docs/performance/screenshots
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Bench, gestureTemplates, buildStroke, drawStroke } from './perf-bench.mjs';
const opts = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, xs) => { if (x.startsWith('--')) a.push([x.slice(2), xs[i + 1]]); return a; }, []));
opts.root = path.resolve(opts.root || 'dist');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const b = new Bench(opts);
const report = { profiles: [], standalone: null };
async function key(page, name, repeat = false) {
  const code = { Enter: 13, Escape: 27, Tab: 9, ' ': 32 }[name] || name.toUpperCase().charCodeAt(0);
  const text = name === 'Enter' ? '\r' : name === ' ' ? ' ' : undefined;
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name === ' ' ? 'Space' : name,
    text, unmodifiedText: text, windowsVirtualKeyCode: code, autoRepeat: repeat });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, windowsVirtualKeyCode: code });
}
async function screenshot(page, name) {
  if (!opts.screenshots) return;
  fs.mkdirSync(opts.screenshots, { recursive: true });
  const { data } = await page.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(opts.screenshots, `${name}.png`), Buffer.from(data, 'base64'));
}
try {
  await b.start(); report.meta = b.meta;
  const url = await b.serveRoot(opts.root);
  const templates = await gestureTemplates();
  for (const profile of (opts.profiles ? opts.profiles.split(',') : ['desktop', 'laptop', 'tablet', 'mobile', 'mobile-landscape'])) {
    const page = await b.newPage(profile);
    const row = { profile, checks: {} }; report.profiles.push(row);
    const check = (name, result) => { row.checks[name] = !!result; };
    try {
      await b.load(page, url); await sleep(350);
      await screenshot(page, `${profile}-menu`);
      row.layout = await page.eval(`(() => {
        const g = __ARCANE_GAME__, wrapper = document.getElementById('game-wrapper'), canvas = g.canvas;
        return { viewport: [innerWidth, innerHeight], canvas: [g.width, g.height], arena: [canvas.parentElement.clientWidth, canvas.parentElement.clientHeight], scrollWidth: document.documentElement.scrollWidth,
          wrapperTouch: getComputedStyle(wrapper).touchAction, canvasTouch: getComputedStyle(canvas).touchAction,
          viewportMeta: document.querySelector('meta[name=viewport]').content };
      })()`);
      check('noHorizontalOverflow', row.layout.scrollWidth <= row.layout.viewport[0]);
      check('canvasMatchesArena', row.layout.canvas.every((v, i) => v === row.layout.arena[i]));
      check('zoomAllowed', !/user-scalable=no|maximum-scale=1(?:\D|$)/.test(row.layout.viewportMeta) && row.layout.wrapperTouch !== 'none');
      await page.eval("document.getElementById('btn-open-settings').focus()");
      await key(page, 'Enter'); await sleep(450);
      check('keyboardOpensSettings', await page.eval("document.getElementById('settings-screen').classList.contains('active') && __bench.state() === 'MENU'"));
      check('settingsNoHorizontalOverflow', await page.eval("(() => { const e = document.querySelector('#settings-screen .glass-card'); return e.scrollWidth <= e.clientWidth + 1; })()"));
      row.sliderHeight = await page.eval("document.querySelector('#settings-screen input[type=range]').getBoundingClientRect().height");
      check('sliderHas44pxHitArea', Math.round(row.sliderHeight) >= 44);
      let focusInside = true;
      for (let i = 0; i < 30; i++) {
        await key(page, 'Tab');
        focusInside &&= await page.eval("document.getElementById('settings-screen').contains(document.activeElement)");
      }
      check('dialogTabContained', focusInside);
      if (page.profile.touch) {
        const box = await page.eval(`(() => { const e = document.querySelector('#settings-screen .glass-card'); e.scrollTop = 0; const r = e.getBoundingClientRect();
          return { x: r.x + 18, y: r.y + r.height * 0.8, distance: Math.min(180, r.height * 0.5), range: e.scrollHeight - e.clientHeight }; })()`);
        const pts = Array.from({ length: 12 }, (_, i) => ({ x: box.x, y: box.y - box.distance * i / 11 }));
        await drawStroke(page, pts, { touch: true, intervalMs: 16 }); await sleep(250);
        row.scrollTop = await page.eval("document.querySelector('#settings-screen .glass-card').scrollTop");
        row.scrollRange = box.range;
        check('nativeTouchScroll', row.checks.keyboardOpensSettings && (box.range === 0 || row.scrollTop > 0));
      }
      await screenshot(page, `${profile}-settings`);
      await key(page, 'Escape');
      check('dialogReturnsFocus', await page.eval("document.activeElement.id === 'btn-open-settings'"));
      await page.eval("__ARCANE_GAME__.settings.set('highlight', false); __bench.play(); __ARCANE_GAME__.settings.set('altInput', true)");
      await sleep(350);
      await page.eval(`(() => { const g = __ARCANE_GAME__, cast = g.castRune.bind(g); window.__castChecks = []; g.castRune = id => { __castChecks.push(id); return cast(id); }; document.querySelector('#rune-pad button').focus(); })()`);
      await key(page, 'Enter'); await key(page, ' ');
      check('runeKeyboardCastsOncePerActivation', await page.eval('__castChecks.length === 2'));
      const castsBeforePointer = await page.eval('__castChecks.length');
      const runeBox = await page.eval("(() => { const r = document.querySelector('#rune-pad button').getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()");
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...runeBox, button: 'left', buttons: 1, clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...runeBox, button: 'left', buttons: 0, clickCount: 1 });
      check('runePointerDoesNotDoubleCast', (await page.eval('__castChecks.length')) === castsBeforePointer + 1);
      const beforeKeys = await page.eval('__castChecks.length');
      await page.eval('__ARCANE_GAME__.canvas.focus()');
      for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8']) await key(page, digit);
      check('allEightKeyboardShortcuts', await page.eval(`JSON.stringify(__castChecks.slice(${beforeKeys})) === JSON.stringify(['horizontal','vertical','caret','v_shape','lightning','heart','circle','spiral'])`));
      await page.eval("__ARCANE_GAME__.settings.set('altInput', false)");
      // Let the CSS arena and its ResizeObserver agree before starting a captured stroke.
      await page.eval('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await page.eval('__bench.begin()');
      if (!opts['skip-draw']) {
        const expected = Object.keys(templates);
        for (const [index, gesture] of expected.entries()) {
          const arena = await page.eval("(() => { const r = __ARCANE_GAME__.canvas.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height}; })()");
          const size = Math.min(arena.width, arena.height) * 0.4;
          const points = buildStroke(templates[gesture], arena.x + arena.width / 2, arena.y + arena.height * 0.57, size, 6, 5000 + index);
          await drawStroke(page, points, { touch: page.profile.touch, intervalMs: page.profile.touch ? 8 : 4 });
          await sleep(70);
        }
        row.draw = await page.eval('__bench.end()');
        row.gestures = row.draw.rec.results.map(r => r.gesture);
        // Retain the actual recognition and event-to-render latency samples, not timing of CDP calls.
        row.inputToStrokeMs = row.draw.in2js;
        delete row.draw;
        check('allEightPointerGestures', expected.every((g, i) => row.gestures[i] === g) && row.gestures.length === 8);
      }
      await screenshot(page, `${profile}-playing`);
      if (profile === 'desktop') {
        await page.eval("__bench.setTier('high'); __bench.particles(14, 28)"); await sleep(800);
        await screenshot(page, 'desktop-particles'); await page.eval('__bench.stopTimers()');
        row.spriteCacheEntries = await page.eval('__ARCANE_GAME__.particleSystem._sprites?.size || 0');
        check('boundedParticleCacheUsed', row.spriteCacheEntries > 0 && row.spriteCacheEntries <= 256);
      }
      await page.eval("__bench.pause(); window.__pausedHP = __ARCANE_GAME__.player.hp; __bench.begin()");
      await sleep(350); const paused = await page.eval('__bench.end()');
      check('pauseFreezesHealth', await page.eval('__ARCANE_GAME__.player.hp === __pausedHP'));
      row.pauseRenderCount = paused.rnd.length;
      check('pauseReusesFrame', row.pauseRenderCount <= 1);
      await key(page, 'p', true);
      check('heldPauseDoesNotToggle', await page.eval("__bench.state() === 'PAUSE'"));
      await page.eval("document.getElementById('btn-resume').focus()"); await key(page, 'Enter');
      check('resumeHasCountdown', await page.eval("__bench.state() === 'PLAYING' && __ARCANE_GAME__.resumeCountdown > 0"));
      check('resumeFocusesArena', await page.eval("document.activeElement.id === 'gameCanvas'"));
      check('noRuntimeErrors', await page.eval('__perf.errors.length === 0'));
      console.log(profile, row.checks);
    } catch (error) { row.error = error.message; console.error(profile, error.message); }
    finally { await page.close(); }
  }
  if (opts.file) {
    const page = await b.newPage('mobile'); const requests = [];
    page.on('Network.requestWillBeSent', e => requests.push(e.request.url));
    try {
      // Actually disconnect the renderer, not just mock a failed fetch.
      await page.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
      await b.load(page, pathToFileURL(path.resolve(opts.file)).href); await sleep(400);
      await page.eval("__ARCANE_GAME__.settings.set('highlight', false); __bench.play()");
      const points = buildStroke(templates.horizontal, 195, 400, 150, 6, 9);
      await drawStroke(page, points, { touch: true, intervalMs: 8 });
      await page.eval(`new Promise(resolve => { const end = performance.now() + 3000; const check = () => { if (__ARCANE_GAME__.metrics.spellsCast > 0 || performance.now() > end) resolve(); else setTimeout(check, 10); }; check(); })`);
      report.standalone = await page.eval(`({ state: __bench.state(), running: __ARCANE_GAME__.isRunning, errors: __perf.errors,
        workerActive: !!__ARCANE_GAME__.inputHandler.recognition?.worker, spritesLoaded: __ARCANE_GAME__.player.spriteLoaded, casts: __ARCANE_GAME__.metrics.spellsCast, audioState: __ARCANE_GAME__.audioSystem.ctx?.state })`);
      report.standalone.requests = requests;
      report.standalone.noExternalRequests = requests.every(u => (u.startsWith('file:') && u.endsWith('.html')) || u.startsWith('blob:'));
      await screenshot(page, 'standalone-offline');
    } finally { await page.close(); }
  }
} finally { await b.stop(); if (opts.out) fs.writeFileSync(opts.out, JSON.stringify(report, null, 2) + '\n'); }
if (opts.assert && (report.profiles.some(r => r.error || Object.values(r.checks).some(x => !x)) || !report.standalone?.noExternalRequests || report.standalone.casts < 1 || !report.standalone.workerActive)) process.exitCode = 1;
