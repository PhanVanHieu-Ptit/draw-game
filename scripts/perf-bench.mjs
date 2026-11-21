#!/usr/bin/env node
/**
 * @file perf-bench.mjs
 * @description Zero-dependency browser benchmark for Arcane Paws.
 *
 * Drives a real headless Chrome through the DevTools protocol (Node's built-in WebSocket, no npm packages) and
 * measures the *real game* running in a page: frame-interval distribution, long tasks, main-thread / process CPU,
 * JS heap, input -> stroke latency, gesture-recognition time, load timing and transfer size.
 *
 *   node scripts/perf-bench.mjs --root <dir with a built index.html> --label before --out before.json
 *   node scripts/perf-bench.mjs --compare before.json after.json
 *
 * What this is NOT: a physical-device test. Phones are approximated with viewport + DPR + touch emulation and a CPU
 * throttle on the renderer main thread (--cpu). The GPU / raster side is whatever this machine has, so absolute
 * numbers do not transfer to a phone; the before/after DELTAS under identical conditions are what is meaningful.
 *
 * Measuring rules learned the hard way (see project notes): measure requestAnimationFrame INTERVALS, not JS time
 * (rasterisation is the cost and it never shows up in JS), and never call getImageData to "flush" the canvas.
 *
 * Options
 *   --root <dir>        folder served over http (a vite build output). Required unless --file is used.
 *   --file <html>       also/instead load this file over file:// (the standalone build)
 *   --label <name>      label stored in the result
 *   --out <json>        write results here (default: stdout summary only)
 *   --matrix quick|full which configurations to run (default quick)
 *   --seconds <n>       seconds sampled per frame scenario (default 6)
 *   --only <a,b>        run only these scenario groups: load,frames,recognize,audio,soak
 *   --scenarios <list>  frame scenarios to run (default depends on matrix)
 *   --soak <seconds>    soak duration (default 90)
 *   --gzip <0|1>        serve text assets gzip-compressed, like a production host (default 1)
 *   --font-delay <ms>   simulated latency of the Google Fonts stylesheet (default 300)
 *   --chrome <path>     Chrome binary (default: macOS Google Chrome, or $CHROME)
 */

import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// ----------------------------------------------------------------------------------------------- small utilities

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { o._.push(a); continue; }
    const eq = a.indexOf('=');
    if (eq > 0) { o[a.slice(2, eq)] = a.slice(eq + 1); continue; }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) { o[a.slice(2)] = next; i++; } else o[a.slice(2)] = true;
  }
  return o;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function dist(values) {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return { n: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 };
  const sum = v.reduce((a, b) => a + b, 0);
  return { n: v.length, mean: sum / v.length, p50: percentile(v, 50), p95: percentile(v, 95), p99: percentile(v, 99), max: v[v.length - 1] };
}

const round = (x, d = 2) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

function median(values) {
  const v = values.slice().sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : 0;
}

// ----------------------------------------------------------------------------------------------- static server

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webp': 'image/webp'
};
const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg']);

/**
 * @param {string} dir
 * @param {{gzip?: boolean, hideAudio?: boolean}} [opts] hideAudio: answer 404 for mp3 (simulates a host without the audio files)
 */
function serve(dir, opts = {}) {
  const cache = new Map();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(dir, p));
    if (!file.startsWith(path.normalize(dir))) { res.writeHead(403); res.end(); return; }
    const ext = path.extname(file).toLowerCase();
    if (opts.hideAudio && ext === '.mp3') { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }
      const headers = { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
      const wantsGzip = opts.gzip !== false && COMPRESSIBLE.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      if (wantsGzip) {
        let z = cache.get(file);
        if (!z) { z = zlib.gzipSync(buf, { level: 9 }); cache.set(file, z); }
        headers['content-encoding'] = 'gzip';
        headers['content-length'] = z.length;
        res.writeHead(200, headers); res.end(z);
      } else {
        headers['content-length'] = buf.length;
        res.writeHead(200, headers); res.end(buf);
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

// ----------------------------------------------------------------------------------------------- DevTools protocol

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.handlers = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id !== undefined) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`)); else p.resolve(m.result);
      } else if (m.method) {
        const hs = this.handlers.get(m.method);
        if (hs) for (const h of hs) h(m.params, m.sessionId);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.seq;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    this.ws.send(JSON.stringify(msg));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }
  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
    return () => { const a = this.handlers.get(method); a.splice(a.indexOf(fn), 1); };
  }
}

class Page {
  constructor(cdp, sessionId, targetId) {
    this.cdp = cdp; this.sessionId = sessionId; this.targetId = targetId; this.offs = [];
  }
  send(method, params) { return this.cdp.send(method, params, this.sessionId); }
  on(method, fn) { this.offs.push(this.cdp.on(method, (params, sid) => { if (sid === this.sessionId) fn(params); })); }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error(`page eval failed: ${(d.exception && (d.exception.description || d.exception.value)) || d.text}\n--- in: ${expression.slice(0, 160)}`);
    }
    return r.result.value;
  }
  async close() {
    for (const off of this.offs) off();
    try { await this.cdp.send('Target.closeTarget', { targetId: this.targetId }); } catch (e) { /* already gone */ }
  }
}

async function launchChrome(chromePath, port, userDataDir) {
  const args = [
    `--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--headless=new',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
    '--enable-precise-memory-info', '--hide-scrollbars', '--disable-features=Translate,MediaRouter',
    '--window-size=1600,1000', 'about:blank'
  ];
  const proc = spawn(chromePath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr += d; });
  for (let i = 0; i < 100; i++) {
    await sleep(100);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) {
        const info = await r.json();
        return { proc, info };
      }
    } catch (e) { /* not up yet */ }
    if (proc.exitCode !== null) throw new Error(`Chrome exited early (${proc.exitCode}): ${stderr.slice(-400)}`);
  }
  proc.kill();
  throw new Error('Chrome did not open its debugging port');
}

// ----------------------------------------------------------------------------------------------- device profiles

const PROFILES = {
  // MacBook-class laptop on a Retina panel
  desktop: { width: 1440, height: 900, dpr: 2, mobile: false, touch: false, label: 'desktop 1440x900 @2x' },
  // budget laptop / external monitor at 1x
  laptop: { width: 1366, height: 768, dpr: 1, mobile: false, touch: false, label: 'laptop 1366x768 @1x' },
  // large displays: the canvas backing store is what grows (5K iMac-class @2x, 4K monitor at 100% scaling)
  desktop5k: { width: 2560, height: 1440, dpr: 2, mobile: false, touch: false, label: 'desktop 2560x1440 @2x (5K)' },
  desktop4k: { width: 3840, height: 2160, dpr: 1, mobile: false, touch: false, label: 'desktop 3840x2160 @1x (4K)' },
  // iPad-class tablet, portrait
  tablet: { width: 820, height: 1180, dpr: 2, mobile: true, touch: true, label: 'tablet 820x1180 @2x touch' },
  // modern phone, portrait
  mobile: { width: 390, height: 844, dpr: 3, mobile: true, touch: true, label: 'phone 390x844 @3x touch' },
  'mobile-small': { width: 320, height: 568, dpr: 2, mobile: true, touch: true, label: 'small phone 320x568 @2x touch' },
  // phone rotated
  'mobile-landscape': { width: 844, height: 390, dpr: 3, mobile: true, touch: true, label: 'phone 844x390 @3x touch' }
};

// ----------------------------------------------------------------------------------------------- page-side code

/** Installed on every new document, before any game code runs. */
const PROBE_SRC = `(() => {
  try { localStorage.setItem('arcane_paws_tutorial_completed_v1', 'true'); } catch (e) {}
  const P = window.__perf = { longtasks: [], loaf: [], events: [], shifts: [], paints: {}, lcp: 0, net: [], pend: [], in2js: [], gameReadyAt: 0, firstFrameAt: 0, errors: [] };
  const obs = (type, fn, extra) => { try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); }).observe(Object.assign({ type, buffered: true }, extra || {})); } catch (e) {} };
  obs('longtask', (e) => P.longtasks.push({ s: e.startTime, d: e.duration }));
  obs('long-animation-frame', (e) => P.loaf.push({ s: e.startTime, d: e.duration, b: e.blockingDuration || 0 }));
  obs('event', (e) => P.events.push({ n: e.name, s: e.startTime, d: e.duration, ip: e.processingStart }), { durationThreshold: 16 });
  obs('layout-shift', (e) => P.shifts.push({ v: e.value, s: e.startTime, input: e.hadRecentInput }));
  obs('paint', (e) => { P.paints[e.name] = e.startTime; });
  obs('largest-contentful-paint', (e) => { P.lcp = e.startTime; });
  window.addEventListener('error', (e) => P.errors.push(String(e.message || e)));
  // fetch accounting (how many requests does the game make, and how many fail?)
  const realFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = String((input && input.url) || input);
    const rec = { url, ok: null, t: performance.now() };
    if (P.net.length < 2000) P.net.push(rec);
    let p;
    try { p = realFetch.call(this, input, init); } catch (e) { rec.ok = false; throw e; }
    p.then((r) => { rec.ok = r.ok; rec.status = r.status; }, () => { rec.ok = false; });
    return p;
  };
  // input latency: remember the OS timestamp of every pointermove; the render hook turns them into "event -> stroke issued"
  window.addEventListener('pointermove', (e) => { P.pend.push(e.timeStamp); }, { capture: true, passive: true });
  // record the moment the game object appears and the first frame after it
  let game;
  Object.defineProperty(window, '__ARCANE_GAME__', {
    configurable: true, enumerable: true,
    get() { return game; },
    set(v) { game = v; P.gameReadyAt = performance.now(); requestAnimationFrame((t) => { P.firstFrameAt = t; }); }
  });
})();`;

/** Evaluated once the game exists: wraps update/render for timing and exposes scenario helpers. */
const BENCH_SRC = `(() => {
  if (window.__bench) return true;
  const g = window.__ARCANE_GAME__;
  const P = window.__perf;
  let on = false, last = 0, frames = [], ltMark = 0, loafMark = 0, evMark = 0, rafId = 0;
  const upd = [], rnd = [];
  const origUpdate = g.update.bind(g), origRender = g.render.bind(g);
  g.update = function (dt) { const t = performance.now(); origUpdate(dt); if (on) upd.push(performance.now() - t); };
  g.render = function () {
    const t = performance.now(); origRender(); const d = performance.now();
    if (on) rnd.push(d - t);
    if (P.pend.length) { if (on) for (let i = 0; i < P.pend.length; i++) P.in2js.push(d - P.pend[i]); P.pend.length = 0; }
  };
  // recognition timing + results
  const rec = { ms: [], results: [] };
  const recognizer = g.inputHandler.recognition || g.gestureEngine;
  const origRecognize = recognizer.recognize.bind(recognizer);
  recognizer.recognize = function (pts) {
    const t = performance.now();
    const record = r => { if (r) { rec.ms.push(performance.now() - t); rec.results.push({ gesture: r.gesture, score: r.score, reason: r.reason, n: pts.length }); } return r; };
    const result = origRecognize(pts);
    return result?.then ? result.then(record) : record(result);
  };
  const GHOST_TYPES = ['REGULAR', 'SPEEDSTER', 'ARMORED', 'REGULAR', 'REGULAR'];
  const QUEUES = [['horizontal'], ['vertical'], ['caret'], ['v_shape'], ['lightning']];
  let keepTimer = 0, partTimer = 0, castTimer = 0;
  const bench = {
    ready: () => !!(g && g.isRunning),
    setTier(t) { g.quality.setPreference(t); return g.quality.tier; },
    state() { return g.stateMachine.getCurrentStateName(); },
    play() {
      if (g.storyDirector && g.storyDirector.setEnabled) g.storyDirector.setEnabled(false);
      g.stateMachine.changeState('PLAYING');
      g.waveSystem.update = () => null;          // no scripted spawns: the scenario decides how many ghosts exist
      g.combat.damagePlayer = () => false;       // nothing may end the run mid-measurement
      return g.stateMachine.getCurrentStateName();
    },
    park(n) {
      const cx = g.player.x, cy = g.player.y, R = Math.min(g.width, g.height) * 0.34;
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.3, ring = 0.85 + 0.3 * ((i % 3) / 2);
        const e = g.enemyPool.acquire();
        e.init({ type: GHOST_TYPES[i % GHOST_TYPES.length], x: cx + Math.cos(a) * R * ring, y: cy + Math.sin(a) * R * ring,
          canvasWidth: g.width, canvasHeight: g.height, symbolQueue: QUEUES[i % QUEUES.length].slice(),
          targetPlayerPos: g.player, levelIndex: 1, levelId: 'library' });
        e.speed = 0;                               // parked (init treats speedMultiplier 0 as 1)
        g.enemies.push(e);
      }
      return g.enemies.length;
    },
    keepFilled(n) {
      clearInterval(keepTimer);
      keepTimer = setInterval(() => { const alive = g.enemies.filter((e) => !e.isDead).length; if (alive < n) bench.park(n - alive); }, 150);
    },
    particles(perSecond, count) {
      clearInterval(partTimer);
      partTimer = setInterval(() => {
        for (let i = 0; i < perSecond / 10; i++) g.particleSystem.emitMonsterDeathExplosion(60 + Math.random() * (g.width - 120), 80 + Math.random() * (g.height - 160), 'REGULAR', count || 28);
      }, 100);
    },
    autoCast(perSecond) {
      clearInterval(castTimer);
      const ids = ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning', 'heart', 'circle', 'spiral']; let k = 0;
      castTimer = setInterval(() => { g.castRune(ids[k++ % ids.length]); }, 1000 / perSecond);
    },
    stopTimers() { clearInterval(keepTimer); clearInterval(partTimer); clearInterval(castTimer); },
    pause() { g.stateMachine.changeState('PAUSE'); return g.stateMachine.getCurrentStateName(); },
    story() { g.stateMachine.changeState('STORY'); return g.stateMachine.getCurrentStateName(); },
    begin() {
      upd.length = 0; rnd.length = 0; frames = []; last = 0; P.in2js.length = 0; P.pend.length = 0;
      ltMark = P.longtasks.length; loafMark = P.loaf.length; evMark = P.events.length; rec.ms.length = 0; rec.results.length = 0;
      on = true;
      const tick = (t) => { if (!on) return; if (last) frames.push(t - last); last = t; rafId = requestAnimationFrame(tick); };
      rafId = requestAnimationFrame(tick);
    },
    end() {
      on = false; cancelAnimationFrame(rafId);
      return {
        frames, upd: upd.slice(), rnd: rnd.slice(), in2js: P.in2js.slice(), long: P.longtasks.slice(ltMark), loaf: P.loaf.slice(loafMark),
        events: P.events.slice(evMark), rec: { ms: rec.ms.slice(), results: rec.results.slice() },
        tier: g.quality.tier, particles: g.particleSystem.activeParticleCount, enemies: g.enemies.length, projectiles: g.projectiles.length,
        dpr: g.dpr, canvasW: g.canvas.width, canvasH: g.canvas.height, w: g.width, h: g.height, isMobile: g.isMobile,
        state: g.stateMachine.getCurrentStateName()
      };
    },
    heap() { return performance.memory ? performance.memory.usedJSHeapSize : 0; },
    audioInfo() {
      const a = g.audioSystem; const bufs = (a && a._audioBuffers) || {}; const out = { buffers: {}, decodedBytes: 0, ctxState: a && a.ctx ? a.ctx.state : 'none', sampleRate: a && a.ctx ? a.ctx.sampleRate : 0 };
      for (const k of Object.keys(bufs)) { const b = bufs[k]; if (!b) continue; const bytes = b.length * b.numberOfChannels * 4; out.buffers[k] = { seconds: +b.duration.toFixed(1), channels: b.numberOfChannels, bytes }; out.decodedBytes += bytes; }
      return out;
    }
  };
  window.__bench = bench;
  return true;
})()`;

// ----------------------------------------------------------------------------------------------- gestures

let strokeSource = null;
async function gestureTemplates() {
  if (strokeSource) return strokeSource;
  const { getGuideStroke } = await import(pathToFileURL(path.join(REPO, 'src/GestureEngine.js')).href);
  strokeSource = {};
  for (const g of ['horizontal', 'vertical', 'v_shape', 'caret', 'lightning', 'heart', 'circle', 'spiral']) strokeSource[g] = getGuideStroke(g);
  return strokeSource;
}

/** A hand-like polyline for a gesture: template densified to ~stepPx spacing with deterministic jitter */
function buildStroke(template, cx, cy, size, stepPx, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
  const pts = template.map((p) => ({ x: cx + ((p.x - 50) / 100) * size, y: cy + ((p.y - 50) / 100) * size }));
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.round(len / stepPx));
    for (let k = i === 1 ? 0 : 1; k <= n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t + rnd() * 2.2, y: a.y + (b.y - a.y) * t + rnd() * 2.2 });
    }
  }
  return out;
}

async function drawStroke(page, points, { touch, intervalMs, pointerType = 'mouse' }) {
  const first = points[0];
  if (touch) {
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: first.x, y: first.y, id: 1 }] });
  } else {
    await page.send('Input.dispatchMouseEvent', { pointerType, type: 'mouseMoved', x: first.x, y: first.y });
    await page.send('Input.dispatchMouseEvent', { pointerType, type: 'mousePressed', x: first.x, y: first.y, button: 'left', buttons: 1, clickCount: 1 });
  }
  let next = performance.now();
  for (let i = 1; i < points.length; i++) {
    next += intervalMs;
    const wait = next - performance.now();
    if (wait > 1) await sleep(wait);
    const p = points[i];
    if (touch) await page.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
    else await page.send('Input.dispatchMouseEvent', { pointerType, type: 'mouseMoved', x: p.x, y: p.y, button: 'left', buttons: 1 });
  }
  const last = points[points.length - 1];
  if (touch) await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  else await page.send('Input.dispatchMouseEvent', { pointerType, type: 'mouseReleased', x: last.x, y: last.y, button: 'left', buttons: 0, clickCount: 1 });
}

// ----------------------------------------------------------------------------------------------- runner

class Bench {
  constructor(opts) {
    this.opts = opts;
    this.cdp = null;
    this.chrome = null;
    this.servers = [];
    this.meta = {};
  }

  async start() {
    const chromePath = this.opts.chrome || process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    if (!fs.existsSync(chromePath)) throw new Error(`Chrome not found at ${chromePath} (use --chrome or $CHROME)`);
    this.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arcane-bench-'));
    const port = 9300 + Math.floor(Math.random() * 400);
    this.chrome = await launchChrome(chromePath, port, this.userDataDir);
    const ws = new WebSocket(this.chrome.info.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener('open', res); ws.addEventListener('error', rej); });
    this.cdp = new CDP(ws);
    let gpu = {};
    try {
      const info = await this.cdp.send('SystemInfo.getInfo');
      gpu = { devices: (info.gpu.devices || []).map((d) => `${d.vendorString || ''} ${d.deviceString || ''}`.trim()), featureStatus: info.gpu.featureStatus || {} };
    } catch (e) { /* not available */ }
    this.meta = {
      date: new Date().toISOString(), chrome: this.chrome.info.Browser, userAgent: this.chrome.info['User-Agent'],
      node: process.version, os: `${os.type()} ${os.release()} ${os.arch()}`, cpu: os.cpus()[0].model, cores: os.cpus().length,
      memGB: Math.round(os.totalmem() / 2 ** 30), gpu, headless: true
    };
  }

  async stop() {
    try { this.cdp.ws.close(); } catch (e) { /* ignore */ }
    if (this.chrome) {
      this.chrome.proc.kill('SIGKILL');
      // Chrome helpers can inherit the stderr pipe after their parent exits.
      this.chrome.proc.stderr?.destroy();
      this.chrome.proc.unref();
    }
    for (const s of this.servers) { s.close(); s.closeAllConnections?.(); }
    try { fs.rmSync(this.userDataDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  async serveRoot(dir, opts = {}) {
    const { server, port } = await serve(dir, { gzip: this.opts.gzip !== '0' && this.opts.gzip !== 0, ...opts });
    this.servers.push(server);
    return `http://127.0.0.1:${port}/`;
  }

  /** Open a fresh tab with the given emulation. Does not navigate. */
  async newPage(profileName, { cpu = 1, network = null, fontDelay = 0 } = {}) {
    const prof = PROFILES[profileName];
    const { targetId } = await this.cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new Page(this.cdp, sessionId, targetId);
    await Promise.all([page.send('Page.enable'), page.send('Runtime.enable'), page.send('Network.enable'), page.send('Performance.enable')]);
    await page.send('Emulation.setDeviceMetricsOverride', { width: prof.width, height: prof.height, deviceScaleFactor: prof.dpr, mobile: prof.mobile });
    if (prof.touch) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    if (prof.mobile) {
      await page.send('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' });
    }
    await page.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (network) await page.send('Network.emulateNetworkConditions', { offline: false, ...network });
    await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE_SRC });

    // Google Fonts: answer with an (empty) stylesheet after `fontDelay` ms, so the cost of a render-blocking
    // third-party stylesheet is measured deterministically instead of depending on this machine's internet
    await page.send('Fetch.enable', { patterns: [{ urlPattern: '*fonts.googleapis.com*' }, { urlPattern: '*fonts.gstatic.com*' }] });
    page.on('Fetch.requestPaused', async (ev) => {
      try {
        if (fontDelay) await sleep(fontDelay);
        if (/fonts\.googleapis\.com/.test(ev.request.url)) {
          await page.send('Fetch.fulfillRequest', { requestId: ev.requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: 'text/css' }], body: Buffer.from('/* font stub */').toString('base64') });
        } else {
          await page.send('Fetch.failRequest', { requestId: ev.requestId, errorReason: 'Failed' });
        }
      } catch (e) { /* page closed */ }
    });
    page.profile = prof; page.profileName = profileName;
    return page;
  }

  async waitGame(page, timeoutMs = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeoutMs) {
      try { if (await page.eval('!!(window.__ARCANE_GAME__ && window.__ARCANE_GAME__.isRunning)')) return true; } catch (e) { /* navigating */ }
      await sleep(60);
    }
    throw new Error('game did not start');
  }

  async load(page, url) {
    const loaded = new Promise((res) => { const off = this.cdp.on('Page.loadEventFired', (_, sid) => { if (sid === page.sessionId) { off(); res(); } }); });
    await page.send('Page.navigate', { url });
    await loaded;
    await this.waitGame(page);
    await page.eval(BENCH_SRC);
  }

  async perfMetrics(page) {
    const { metrics } = await page.send('Performance.getMetrics');
    const m = {};
    for (const x of metrics) m[x.name] = x.value;
    return m;
  }

  async cpuTimes() {
    try {
      const { processInfo } = await this.cdp.send('SystemInfo.getProcessInfo');
      const out = {};
      for (const p of processInfo) out[p.type] = (out[p.type] || 0) + p.cpuTime;
      return out;
    } catch (e) { return {}; }
  }

  /** Warm up, then sample `seconds` of frames while a scenario-specific `during()` driver (optional) runs */
  async sample(page, seconds, { warmup = 3, during = null } = {}) {
    await sleep(warmup * 1000);
    const m0 = await this.perfMetrics(page);
    const c0 = await this.cpuTimes();
    const w0 = performance.now();
    await page.eval('__bench.begin()');
    if (during) await during(); else await sleep(seconds * 1000);
    const raw = await page.eval('__bench.end()');
    const wall = (performance.now() - w0) / 1000;
    const m1 = await this.perfMetrics(page);
    const c1 = await this.cpuTimes();
    return summarize(raw, m0, m1, c0, c1, wall);
  }
}

function summarize(raw, m0, m1, c0, c1, wall) {
  const f = dist(raw.frames);
  const over = (ms) => (raw.frames.length ? (raw.frames.filter((x) => x > ms).length / raw.frames.length) * 100 : 0);
  const d = (k) => ((m1[k] || 0) - (m0[k] || 0));
  const cpu = (k) => (c1[k] !== undefined && c0[k] !== undefined ? ((c1[k] - c0[k]) / wall) * 100 : null);
  const long = raw.long.filter((t) => t.d >= 50);
  const loaf = raw.loaf.filter((t) => t.d >= 50);
  return {
    seconds: round(wall, 1),
    frames: raw.frames.length,
    fps: round(raw.frames.length / wall, 1),
    frameMs: { mean: round(f.mean), p50: round(f.p50), p95: round(f.p95), p99: round(f.p99), max: round(f.max) },
    pctOver20ms: round(over(20), 1), pctOver33ms: round(over(33.4), 1), pctOver50ms: round(over(50), 1),
    renderFps: round(raw.rnd.length / wall, 1),
    jsUpdateMs: round(dist(raw.upd).mean, 3), jsRenderMs: round(dist(raw.rnd).mean, 3), jsRenderP95: round(dist(raw.rnd).p95, 3),
    mainThreadBusyPct: round((d('TaskDuration') / wall) * 100, 1),
    scriptPct: round((d('ScriptDuration') / wall) * 100, 1),
    layoutPct: round((d('LayoutDuration') / wall) * 100, 2),
    stylePct: round((d('RecalcStyleDuration') / wall) * 100, 2),
    styleRecalcs: d('RecalcStyleCount'), layouts: d('LayoutCount'),
    rendererCpuPct: round(cpu('renderer'), 1), gpuCpuPct: round(cpu('GPU'), 1), browserCpuPct: round(cpu('browser'), 1),
    longTasks: { count: long.length, totalMs: round(long.reduce((a, b) => a + b.d, 0), 0), maxMs: round(long.reduce((a, b) => Math.max(a, b.d), 0), 0) },
    loafCount: loaf.length,
    slowEvents: raw.events.filter((e) => e.d >= 16).length,
    heapMB: round((m1.JSHeapUsedSize || 0) / 2 ** 20, 1),
    nodes: m1.Nodes, listeners: m1.JSEventListeners,
    tierAfter: raw.tier, particlesAfter: raw.particles, enemiesAfter: raw.enemies, canvas: `${raw.canvasW}x${raw.canvasH}`, dpr: raw.dpr,
    in2js: raw.in2js.length ? { n: raw.in2js.length, p50: round(dist(raw.in2js).p50, 1), p95: round(dist(raw.in2js).p95, 1), max: round(dist(raw.in2js).max, 1) } : null,
    recognizeMs: raw.rec.ms.length ? { n: raw.rec.ms.length, p50: round(dist(raw.rec.ms).p50, 3), max: round(dist(raw.rec.ms).max, 3) } : null,
    recognized: raw.rec.results
  };
}

// ----------------------------------------------------------------------------------------------- scenarios

const FRAME_SCENARIOS = {
  menu: async (b, page, s) => b.sample(page, s),
  play10: async (b, page, s) => { await page.eval('__bench.play(); __bench.park(10); __bench.keepFilled(10)'); return b.sample(page, s); },
  play30: async (b, page, s) => { await page.eval('__bench.play(); __bench.park(30); __bench.keepFilled(30)'); return b.sample(page, s); },
  particles: async (b, page, s) => { await page.eval('__bench.play(); __bench.park(10); __bench.keepFilled(10); __bench.particles(14, 28)'); return b.sample(page, s); },
  // same as play10 with the best-moment clip recorder (captureStream + MediaRecorder) switched off in Settings
  play10norec: async (b, page, s) => { await page.eval("__ARCANE_GAME__.settings.set('highlight', false); __bench.play(); __bench.park(10); __bench.keepFilled(10)"); return b.sample(page, s); },
  pause: async (b, page, s) => { await page.eval('__bench.play(); __bench.park(10)'); await sleep(1500); await page.eval('__bench.stopTimers(); __bench.pause()'); return b.sample(page, s, { warmup: 2 }); },
  story: async (b, page, s) => { await page.eval('__bench.story()'); return b.sample(page, s, { warmup: 2 }); },
  draw: async (b, page, s) => {
    await page.eval('__bench.play(); __bench.park(10); __bench.keepFilled(10)');
    const templates = await gestureTemplates();
    const touch = page.profile.touch;
    const size = Math.min(page.profile.width, page.profile.height) * (touch ? 0.5 : 0.3);
    const cx = page.profile.width / 2, cy = page.profile.height * 0.62;
    const order = ['horizontal', 'vertical', 'v_shape', 'caret', 'lightning', 'heart', 'circle', 'spiral'];
    return b.sample(page, s, {
      warmup: 3,
      during: async () => {
        const t0 = performance.now();
        let k = 0;
        // draw until the sampling window has elapsed; every stroke is a real pointer stream through the game's InputHandler
        while ((performance.now() - t0) / 1000 < s) {
          const gesture = order[k % order.length];
          const stroke = buildStroke(templates[gesture], cx, cy, size, touch ? 9 : 7, 1000 + k);
          await drawStroke(page, stroke, { touch, intervalMs: touch ? 16 : 8 });
          await sleep(220);
          k++;
        }
      }
    });
  }
};

const DEFAULT_SCENARIOS = {
  quick: ['menu', 'play10', 'play30', 'particles', 'draw', 'pause', 'story'],
  full: ['menu', 'play10', 'play30', 'particles', 'draw', 'pause', 'story']
};

/** Configurations (profile x cpu throttle x tier) per matrix size */
function configs(matrix) {
  const c = [
    { profile: 'desktop', cpu: 1, tier: 'auto' },
    { profile: 'desktop', cpu: 4, tier: 'auto' },
    { profile: 'tablet', cpu: 4, tier: 'auto' },
    { profile: 'mobile', cpu: 4, tier: 'auto' }
  ];
  if (matrix === 'full') {
    c.push({ profile: 'laptop', cpu: 4, tier: 'auto' }, { profile: 'mobile', cpu: 6, tier: 'auto' },
      { profile: 'desktop', cpu: 4, tier: 'medium', only: ['play30', 'particles'] },
      { profile: 'desktop', cpu: 4, tier: 'low', only: ['play30', 'particles'] },
      { profile: 'mobile-landscape', cpu: 4, tier: 'auto', only: ['play10', 'draw'] },
      { profile: 'desktop5k', cpu: 1, tier: 'auto', only: ['menu', 'play10', 'particles'] },
      { profile: 'desktop4k', cpu: 1, tier: 'auto', only: ['menu', 'play10', 'particles'] });
  }
  return c;
}

async function runFrames(b, base, results) {
  const seconds = Number(b.opts.seconds || 6);
  const matrix = b.opts.matrix || 'quick';
  const wanted = b.opts.scenarios ? String(b.opts.scenarios).split(',') : DEFAULT_SCENARIOS[matrix];
  const only = b.opts.profiles ? String(b.opts.profiles).split(',') : null;
  results.frames = [];
  for (const cfg of configs(matrix)) {
    if (only && !only.includes(cfg.profile)) continue;
    const list = (cfg.only || wanted).filter((s) => wanted.includes(s));
    for (const name of list) {
      const page = await b.newPage(cfg.profile, { cpu: cfg.cpu });
      try {
        await b.load(page, base);
        if (cfg.tier !== 'auto') await page.eval(`__bench.setTier(${JSON.stringify(cfg.tier)})`);
        const r = await FRAME_SCENARIOS[name](b, page, seconds);
        const row = { scenario: name, profile: cfg.profile, cpu: cfg.cpu, tierSetting: cfg.tier, ...r };
        results.frames.push(row);
        console.log(`  ${cfg.profile.padEnd(9)} cpu${cfg.cpu} ${String(cfg.tier).padEnd(6)} ${name.padEnd(9)} ${String(row.fps).padStart(5)} fps  p95 ${String(row.frameMs.p95).padStart(6)} ms  >33ms ${String(row.pctOver33ms).padStart(5)}%  main ${String(row.mainThreadBusyPct).padStart(5)}%  rend ${String(row.rendererCpuPct).padStart(6)}%  gpu ${String(row.gpuCpuPct).padStart(6)}%  tier->${row.tierAfter}`);
      } catch (e) {
        console.log(`  ${cfg.profile} cpu${cfg.cpu} ${name}: FAILED ${e.message.split('\n')[0]}`);
        results.frames.push({ scenario: name, profile: cfg.profile, cpu: cfg.cpu, tierSetting: cfg.tier, error: e.message.split('\n')[0] });
      } finally { await page.close(); }
    }
  }
}

async function runLoad(b, base, fileUrl, results) {
  results.load = [];
  const runs = Number(b.opts.loadRuns || 3);
  const fontDelay = Number(b.opts.fontDelay ?? 300);
  const cases = [
    { name: 'desktop, no throttle', profile: 'desktop', cpu: 1, network: null },
    { name: 'phone, 4x CPU + slow-4G (emulated)', profile: 'mobile', cpu: 4, network: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 } }
  ];
  const targets = [];
  if (base) targets.push({ kind: 'http', url: base });
  if (fileUrl) targets.push({ kind: 'file', url: fileUrl });
  for (const t of targets) {
    for (const c of cases) {
      const rows = [];
      let reqs = [];
      for (let i = 0; i < runs; i++) {
        const page = await b.newPage(c.profile, { cpu: c.cpu, network: c.network, fontDelay });
        const requests = new Map();
        page.on('Network.requestWillBeSent', (e) => requests.set(e.requestId, { url: e.request.url, type: e.type }));
        page.on('Network.responseReceived', (e) => { const r = requests.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.fromCache = e.response.fromDiskCache; } });
        page.on('Network.loadingFinished', (e) => { const r = requests.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
        page.on('Network.loadingFailed', (e) => { const r = requests.get(e.requestId); if (r) { r.failed = e.errorText; } });
        try {
          const t0 = performance.now();
          await b.load(page, t.url);
          const wall = performance.now() - t0;
          // Paint observers run asynchronously after gameReady. Collect after settling;
          // reading immediately reported a misleading zero FCP in file:// mode.
          await sleep(1200);
          const probe = await page.eval(`(() => { const P = window.__perf; const nav = performance.getEntriesByType('navigation')[0] || {};
            const long = P.longtasks.filter((l) => l.s < P.gameReadyAt);
            return { fcp: P.paints['first-contentful-paint'] || 0, lcp: P.lcp, gameReady: P.gameReadyAt, firstFrame: P.firstFrameAt, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd,
              tbt: long.reduce((a, l) => a + Math.max(0, l.d - 50), 0), longTasks: long.length, cls: P.shifts.filter((s) => !s.input).reduce((a, s) => a + s.v, 0) }; })()`);
          const m = await b.perfMetrics(page);
          rows.push({ ...probe, wall, scriptMs: m.ScriptDuration * 1000, taskMs: m.TaskDuration * 1000, layoutMs: m.LayoutDuration * 1000, styleMs: m.RecalcStyleDuration * 1000, nodes: m.Nodes, heapMB: m.JSHeapUsedSize / 2 ** 20 });
          reqs = [...requests.values()];
        } catch (e) { rows.push({ error: e.message.split('\n')[0] }); } finally { await page.close(); }
      }
      const ok = rows.filter((r) => !r.error);
      const med = (k) => round(median(ok.map((r) => r[k])), 1);
      const byType = {};
      let total = 0;
      for (const r of reqs) { if (r.failed || !r.bytes) continue; total += r.bytes; byType[r.mime || r.type] = (byType[r.mime || r.type] || 0) + r.bytes; }
      const failed = reqs.filter((r) => r.failed || (r.status && r.status >= 400)).map((r) => `${r.status || r.failed} ${r.url.replace(/^https?:\/\/127\.0\.0\.1:\d+/, '')}`);
      const row = { target: t.kind, case: c.name, runs: ok.length, fcp: med('fcp'), lcp: med('lcp'), dcl: med('dcl'), load: med('load'), gameReadyMs: med('gameReady'), firstFrameMs: med('firstFrame'), tbtMs: med('tbt'), longTasks: med('longTasks'), cls: round(median(ok.map((r) => r.cls)), 4), scriptMs: med('scriptMs'), taskMs: med('taskMs'), nodes: med('nodes'), heapMB: med('heapMB'), requests: reqs.length, transferKB: round(total / 1024, 0), byTypeKB: Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, round(v / 1024, 0)])), failedRequests: failed };
      results.load.push(row);
      console.log(`  load ${t.kind.padEnd(4)} ${c.name.padEnd(36)} FCP ${row.fcp} ms | game ready ${row.gameReadyMs} ms | TBT ${row.tbtMs} ms | ${row.requests} req, ${row.transferKB} KB | failed ${failed.length}`);
    }
  }
}

async function runRecognize(b, base, results) {
  results.recognize = [];
  for (const cpu of [1, 4]) {
    const page = await b.newPage('desktop', { cpu });
    try {
      await b.load(page, base);
      const res = await page.eval(`(() => {
        const g = window.__ARCANE_GAME__, engine = g.gestureEngine, out = {};
        const mk = (n, kind) => { const pts = []; for (let i = 0; i < n; i++) { const t = i / (n - 1), a = t * Math.PI * 2;
          pts.push(kind === 'circle' ? { x: 300 + 120 * Math.cos(a), y: 300 + 120 * Math.sin(a) } : kind === 'zig' ? { x: 200 + 200 * t, y: 200 + 80 * Math.sin(t * 14) } : { x: 100 + 300 * t, y: 300 + (i % 2 ? 1.5 : -1.5) }); } return pts; };
        for (const kind of ['line', 'circle', 'zig']) for (const n of [30, 120, 400, 1500]) {
          const pts = mk(n, kind); for (let i = 0; i < 20; i++) engine.recognize(pts);        // warm the JIT
          const times = []; for (let i = 0; i < 200; i++) { const t = performance.now(); engine.recognize(pts); times.push(performance.now() - t); }
          times.sort((a, b) => a - b); out[kind + '@' + n] = { p50: times[100], p95: times[190], max: times[199] };
        }
        return out;
      })()`);
      results.recognize.push({ cpu, ...Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { p50: round(v.p50, 3), p95: round(v.p95, 3), max: round(v.max, 3) }])) });
      const worst = Math.max(...Object.values(res).map((v) => v.p95));
      console.log(`  recognize cpu${cpu}: worst p95 ${round(worst, 3)} ms over ${Object.keys(res).length} stroke shapes/sizes`);
    } finally { await page.close(); }
  }
}

async function runAudio(b, base, fileUrl, results) {
  results.audio = [];
  const slow4g = { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 };
  const cases = [{ name: 'http, audio files present', url: base, serveOpts: null }];
  if (base) cases.push({ name: 'http, slow-4G emulated (time until fight music ready)', url: base, network: slow4g });
  if (base) cases.push({ name: 'http, audio files MISSING (host without mp3)', url: base, hideAudio: true });
  if (fileUrl) cases.push({ name: 'file:// standalone', url: fileUrl });
  for (const c of cases) {
    let url = c.url;
    if (c.hideAudio) url = await b.serveRoot(b.opts.root, { hideAudio: true });
    const page = await b.newPage('desktop', { cpu: 1, network: c.network || null });
    const requests = new Map();
    page.on('Network.requestWillBeSent', (e) => requests.set(e.requestId, { url: e.request.url, type: e.type }));
    page.on('Network.responseReceived', (e) => { const r = requests.get(e.requestId); if (r) r.status = e.response.status; });
    page.on('Network.loadingFinished', (e) => { const r = requests.get(e.requestId); if (r) r.bytes = e.encodedDataLength; });
    page.on('Network.loadingFailed', (e) => { const r = requests.get(e.requestId); if (r) r.failed = e.errorText; });
    try {
      await b.load(page, url);
      const heap0 = await page.eval('(() => { try { return performance.memory.usedJSHeapSize; } catch (e) { return 0; } })()');
      // the first user gesture unlocks audio and starts the preload; then play for a while with casts that trigger sounds
      const tGesture = performance.now();
      await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 400, y: 300, button: 'left', buttons: 1, clickCount: 1 });
      await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 400, y: 300, button: 'left', buttons: 0, clickCount: 1 });
      // how long until the fight music (main) is decoded and until all four tracks are
      let mainReadyMs = null, allReadyMs = null;
      const waitLimit = c.network ? 40000 : 8000;
      while (performance.now() - tGesture < waitLimit) {
        const have = await page.eval("Object.keys((__ARCANE_GAME__.audioSystem._audioBuffers) || {}).filter((k) => __ARCANE_GAME__.audioSystem._audioBuffers[k])");
        if (mainReadyMs === null && have.includes('main')) mainReadyMs = performance.now() - tGesture;
        if (have.length >= 4) { allReadyMs = performance.now() - tGesture; break; }
        await sleep(100);
      }
      await sleep(c.network ? 500 : 1500);
      await page.eval('__bench.play(); __bench.park(8); __bench.keepFilled(8); __bench.autoCast(3)');
      const secs = 15;
      await sleep(secs * 1000);
      await page.eval('__bench.stopTimers()');
      const info = await page.eval('__bench.audioInfo()');
      const net = await page.eval('window.__perf.net.map((n) => ({ url: n.url, ok: n.ok, status: n.status }))');
      const audioFetches = net.filter((n) => /\.mp3/.test(n.url));
      const failedFetches = audioFetches.filter((n) => n.ok === false);
      const reqs = [...requests.values()];
      const audioReqs = reqs.filter((r) => /\.mp3/.test(r.url));
      const row = {
        case: c.name, ctxState: info.ctxState, decodedBuffers: info.buffers, decodedMB: round(info.decodedBytes / 2 ** 20, 1),
        mainReadyMs: mainReadyMs === null ? null : round(mainReadyMs, 0), allReadyMs: allReadyMs === null ? null : round(allReadyMs, 0),
        mp3FetchCalls: audioFetches.length, mp3FetchFailures: failedFetches.length, mp3NetworkRequests: audioReqs.length,
        mp3Failed: audioReqs.filter((r) => r.failed || (r.status && r.status >= 400)).length, mp3KB: round(audioReqs.reduce((a, r) => a + (r.bytes || 0), 0) / 1024, 0),
        seconds: secs, failuresPerMinute: round((failedFetches.length / secs) * 60, 0), heapDeltaMB: round(((await page.eval('(() => { try { return performance.memory.usedJSHeapSize; } catch (e) { return 0; } })()')) - heap0) / 2 ** 20, 1)
      };
      results.audio.push(row);
      console.log(`  audio ${c.name.padEnd(44)} music ready ${row.mainReadyMs} ms / all ${row.allReadyMs} ms | decoded ${row.decodedMB} MB | mp3 fetch() calls ${row.mp3FetchCalls} (${row.mp3FetchFailures} failed, ~${row.failuresPerMinute}/min) | net requests ${row.mp3NetworkRequests} (${row.mp3Failed} failed)`);
    } catch (e) {
      console.log(`  audio ${c.name}: FAILED ${e.message.split('\n')[0]}`);
      results.audio.push({ case: c.name, error: e.message.split('\n')[0] });
    } finally { await page.close(); }
  }
}

async function runSoak(b, base, results) {
  const seconds = Number(b.opts.soak || 90);
  const page = await b.newPage('desktop', { cpu: 1 });
  try {
    await b.load(page, base);
    await page.eval('__bench.play(); __bench.park(12); __bench.keepFilled(12); __bench.autoCast(4); __bench.particles(6, 24)');
    const samples = [];
    const t0 = Date.now();
    await sleep(6000); // let JIT and one-time caches settle before the baseline sample
    while ((Date.now() - t0) / 1000 < seconds) {
      await page.send('HeapProfiler.collectGarbage');
      const m = await b.perfMetrics(page);
      samples.push({ t: round((Date.now() - t0) / 1000, 0), heapMB: round(m.JSHeapUsedSize / 2 ** 20, 2), nodes: m.Nodes, listeners: m.JSEventListeners });
      await sleep(5000);
    }
    // least-squares slope of heap over time
    const n = samples.length, xs = samples.map((s) => s.t / 60), ys = samples.map((s) => s.heapMB);
    const mx = xs.reduce((a, c) => a + c, 0) / n, my = ys.reduce((a, c) => a + c, 0) / n;
    const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
    const info = await page.eval('(() => { const g = __ARCANE_GAME__; return { score: g.score, kills: g.metrics.enemiesDefeated, casts: g.metrics.spellsCast, enemyPool: g.enemyPool.pool ? g.enemyPool.pool.length : null, particles: g.particleSystem.activeParticleCount }; })()');
    results.soak = { seconds, samples, heapSlopeMBPerMin: round(slope, 3), firstHeapMB: ys[0], lastHeapMB: ys[ys.length - 1], nodesFirst: samples[0].nodes, nodesLast: samples[samples.length - 1].nodes, listenersFirst: samples[0].listeners, listenersLast: samples[samples.length - 1].listeners, activity: info };
    console.log(`  soak ${seconds}s: heap ${ys[0]} -> ${ys[ys.length - 1]} MB (slope ${round(slope, 3)} MB/min), nodes ${samples[0].nodes} -> ${samples[n - 1].nodes}, listeners ${samples[0].listeners} -> ${samples[n - 1].listeners}; kills ${info.kills}, casts ${info.casts}`);
  } finally { await page.close(); }
}

// ----------------------------------------------------------------------------------------------- compare

function compare(aPath, bPath, loadBaselinePath) {
  const A = JSON.parse(fs.readFileSync(aPath, 'utf8'));
  const B = JSON.parse(fs.readFileSync(bPath, 'utf8'));
  if (loadBaselinePath) A.load = JSON.parse(fs.readFileSync(loadBaselinePath, 'utf8')).load;
  const key = (r) => `${r.profile}|cpu${r.cpu}|${r.tierSetting}|${r.scenario}`;
  const rows = [];
  const bmap = new Map((B.frames || []).map((r) => [key(r), r]));
  const pct = (a, b) => (a ? `${(((b - a) / a) * 100).toFixed(0)}%` : '-');
  console.log(`\nFrames: ${A.label} -> ${B.label}`);
  console.log('config                                   fps            p95 ms          >33ms %        main-thread %   renderer CPU %  tier');
  console.log('(fps = display frames per second; "game fps" = frames the game actually rendered, shown after the tier)');
  for (const a of A.frames || []) {
    const b = bmap.get(key(a));
    if (!b || a.error || b.error) continue;
    rows.push([key(a).replace(/\|/g, ' ').padEnd(38), `${a.fps}->${b.fps}`.padEnd(14), `${a.frameMs.p95}->${b.frameMs.p95}`.padEnd(15), `${a.pctOver33ms}->${b.pctOver33ms}`.padEnd(14), `${a.mainThreadBusyPct}->${b.mainThreadBusyPct}`.padEnd(15), `${a.rendererCpuPct}->${b.rendererCpuPct}`.padEnd(15), `${a.tierAfter}->${b.tierAfter}`.padEnd(12), `game fps ${a.renderFps}->${b.renderFps}`].join(' '));
  }
  console.log(rows.join('\n'));
  if (A.load && B.load) {
    console.log('\nLoad (median):');
    for (const a of A.load) {
      const b = B.load.find((x) => x.target === a.target && x.case === a.case);
      if (!b) continue;
      console.log(`  ${a.target} ${a.case}: FCP ${a.fcp}->${b.fcp} ms, gameReady ${a.gameReadyMs}->${b.gameReadyMs} ms, TBT ${a.tbtMs}->${b.tbtMs} ms, requests ${a.requests}->${b.requests}, transfer ${a.transferKB}->${b.transferKB} KB, failed ${a.failedRequests.length}->${b.failedRequests.length}`);
    }
  }
  if (A.audio && B.audio) {
    console.log('\nAudio:');
    for (const a of A.audio) {
      const b = B.audio.find((x) => x.case === a.case);
      if (!b || a.error || b.error) continue;
      console.log(`  ${a.case}: music ready ${a.mainReadyMs}->${b.mainReadyMs} ms, all ${a.allReadyMs}->${b.allReadyMs} ms, mp3 fetch() calls ${a.mp3FetchCalls}->${b.mp3FetchCalls} (failed ${a.mp3FetchFailures}->${b.mp3FetchFailures}), decoded ${a.decodedMB}->${b.decodedMB} MB`);
    }
  }
  if (A.recognize && B.recognize) {
    console.log('\nRecognition worst p95 (ms):', A.recognize.map((r, i) => `cpu${r.cpu}: ${Math.max(...Object.entries(r).filter(([k]) => k !== 'cpu').map(([, v]) => v.p95))}->${Math.max(...Object.entries(B.recognize[i]).filter(([k]) => k !== 'cpu').map(([, v]) => v.p95))}`).join(' | '));
  }
  if (A.soak && B.soak) console.log(`\nSoak: heap slope ${A.soak.heapSlopeMBPerMin}->${B.soak.heapSlopeMBPerMin} MB/min, nodes ${A.soak.nodesFirst}->${A.soak.nodesLast} vs ${B.soak.nodesFirst}->${B.soak.nodesLast}`);
}

// ----------------------------------------------------------------------------------------------- main

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.compare) {
    const files = opts.compare === true ? opts._ : [opts.compare, ...opts._];
    if (files.length !== 2) throw new Error('usage: perf-bench.mjs --compare before.json after.json');
    compare(files[0], files[1], opts['baseline-load']);
    return;
  }
  if (!opts.root && !opts.file) { console.error('usage: perf-bench.mjs --root <build dir> [--file <standalone.html>] --label <name> --out <json>'); process.exit(2); }
  if (opts.root) opts.root = path.resolve(opts.root);

  const only = opts.only ? String(opts.only).split(',') : ['load', 'frames', 'recognize', 'audio', 'soak'];
  const b = new Bench(opts);
  const results = { label: opts.label || 'run', args: { matrix: opts.matrix || 'quick', seconds: Number(opts.seconds || 6) } };
  try {
    await b.start();
    results.meta = b.meta;
    console.log(`Chrome ${b.meta.chrome} on ${b.meta.cpu} (${b.meta.cores} cores, ${b.meta.memGB} GB), headless`);
    const base = opts.root ? await b.serveRoot(opts.root) : null;
    const fileUrl = opts.file ? pathToFileURL(path.resolve(opts.file)).href : null;
    if (only.includes('load')) { console.log('\n[load]'); await runLoad(b, base, fileUrl, results); }
    if (only.includes('recognize') && base) { console.log('\n[recognize]'); await runRecognize(b, base, results); }
    if (only.includes('frames') && base) { console.log('\n[frames]'); await runFrames(b, base, results); }
    if (only.includes('audio')) { console.log('\n[audio]'); await runAudio(b, base, fileUrl, results); }
    if (only.includes('soak') && base) { console.log('\n[soak]'); await runSoak(b, base, results); }
  } finally {
    await b.stop();
  }
  if (opts.out) { fs.writeFileSync(opts.out, JSON.stringify(results, null, 2)); console.log(`\nwrote ${opts.out}`); }
}

export { Bench, gestureTemplates, buildStroke, drawStroke };
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
