#!/usr/bin/env node
// Local Chrome regression matrix. Run after building the game and admin applications.
// npm run test:responsive -- --out docs/responsive/results.json --screenshots docs/responsive/screenshots
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {
  Bench,
  drawStroke,
  buildStroke,
  gestureTemplates,
} from './perf-bench.mjs';
import { defaults } from '../shared/game-configuration.js';
import { contentDefaults } from '../shared/gameplay-content.js';

const args = process.argv.slice(2);
const option = (key, fallback) => {
  const i = args.indexOf(`--${key}`);
  return i < 0 ? fallback : args[i + 1];
};
const checkpoints = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
];
const sizes = [
  ...new Map(
    checkpoints
      .flatMap(([w, h]) => [
        [w, h],
        [h, w],
      ])
      .map((s) => [s.join('x'), s]),
  ).values(),
];
const out = option('out', 'docs/responsive/results.json');
const screenshots = option('screenshots', 'docs/responsive/screenshots');
const b = new Bench({});
const report = {
  game: [],
  admin: [],
  resize: {},
  notes: [
    'Chrome viewport/touch emulation; no physical-device or OS-keyboard testing. Admin data uses local fixtures.',
  ],
};
const settle = (page) =>
  page.eval(
    'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
  );
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const measure = `(() => {
  const visible = e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
  const bounds = e => { const r = e.getBoundingClientRect(); return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}; };
  const overflow = [...document.querySelectorAll('.ui-screen.active > .glass-card')].filter(visible)
    .filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className);
  return {width:innerWidth,height:innerHeight, scrollWidth:document.documentElement.scrollWidth,overflow,
    arena: bounds(document.getElementById('gameCanvas')),
    controls: [...document.querySelectorAll('#hud-playing .icon-btn')].map(e => ({id:e.id,...bounds(e)}))};
})()`;

async function viewport(page, width, height, dpr = 2) {
  await page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: false,
    screenOrientation: {
      type: height > width ? 'portraitPrimary' : 'landscapePrimary',
      angle: height > width ? 0 : 90,
    },
  });
  await settle(page);
}
async function capture(page, name) {
  fs.mkdirSync(screenshots, { recursive: true });
  // Capture the finished dialog, rather than a translucent frame of its entrance animation.
  await page.eval("Promise.all(document.getAnimations().filter(a => a.animationName === 'cardFadeIn').map(a => a.finished.catch(() => {})))");
  const clip = await page.eval(
    '({x:0,y:0,width:innerWidth,height:innerHeight,scale:1/devicePixelRatio})',
  );
  const { data } = await page.send('Page.captureScreenshot', {
    format: 'png',
    clip,
  });
  fs.writeFileSync(
    path.join(screenshots, `${name}.png`),
    Buffer.from(data, 'base64'),
  );
}
async function click(page, id) {
  await page.eval(`document.getElementById(${JSON.stringify(id)}).click()`);
  await settle(page);
}
async function dialog(page, opener, screen) {
  await click(page, opener);
  const result = await page.eval(`(() => {
    const overlay = document.getElementById(${JSON.stringify(screen)}), card = overlay.querySelector('.glass-card');
    const active = overlay.classList.contains('active');
    const buttons = [...card.querySelectorAll('button')].filter(e => !e.disabled && e.getClientRects().length);
    let reachable = true;
    for (const button of buttons) {
      button.scrollIntoView({block:'nearest'});
      const r = button.getBoundingClientRect(), c = card.getBoundingClientRect();
      reachable &&= r.left >= c.left - 1 && r.right <= c.right + 1 && r.top >= c.top - 1 && r.bottom <= c.bottom + 1;
    }
    card.scrollTop = 0;
    return { active, reachable, noOverflow:card.scrollWidth <= card.clientWidth + 1 };
  })()`);
  if (screen === 'settings-screen') {
    const size = await page.eval('({width:innerWidth,height:innerHeight})');
    if ([320, 844, 1440].includes(size.width)) await capture(page, `${size.width}x${size.height}-settings`);
  }
  // Real keyboard close also exercises focus restoration / the modal focus manager.
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await settle(page);
  return result;
}

async function stroke(page, templates, touch) {
  const arena =
    await page.eval(`(() => { const g=__ARCANE_GAME__, r=g.canvas.getBoundingClientRect();
    return {x:r.x,y:r.y,w:r.width,h:r.height,logicalW:g.width,logicalH:g.height}; })()`);
  const size = Math.min(arena.w, arena.h) * 0.45;
  const points = buildStroke(
    templates.horizontal,
    arena.x + arena.w / 2,
    arena.y + arena.h / 2,
    size,
    5,
    31,
  );
  await drawStroke(page, points, { touch, intervalMs: 2 });
  return page.eval(`(() => { const g=__ARCANE_GAME__, first=g.inputHandler.lastStroke?.[0];
    return !!first && Math.abs(first.x - ${JSON.stringify(((points[0].x - arena.x) * arena.logicalW) / arena.w)}) < 0.5
      && Math.abs(first.y - ${JSON.stringify(((points[0].y - arena.y) * arena.logicalH) / arena.h)}) < 0.5
      && g.gestureEngine.recognize(g.inputHandler.lastStroke).gesture === 'horizontal'; })()`);
}

// Static built admin + read-only API fixtures: never touches a real admin account or database.
function serveAdmin() {
  const seed = JSON.parse(fs.readFileSync('shared/story/seed.json', 'utf8'));
  const permissions = [
    'dashboard',
    'configuration',
    'gameplay',
    'content',
    'liveops',
    'players',
    'analytics',
    'system',
  ].flatMap((m) => [`${m}:read`, `${m}:write`, `${m}:publish`]);
  const server = http.createServer((req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    if (route.startsWith('/api/')) {
      let value = { items: [], source: 'fixture' };
      if (route === '/api/auth/me')
        value = {
          user: {
            id: 'responsive-fixture',
            name: 'Layout tester',
            email: 'layout@example.test',
            role: 'Super Admin',
            permissions,
          },
        };
      if (route === '/api/dashboard')
        value = {
          source: 'fixture',
          metrics: {
            activePlayers: null,
            gameSessions: null,
            publishedConfiguration: 0,
            scheduledEvents: 0,
            gameplayPerformance: null,
          },
          health: {
            adminApi: 'fixture',
            gameTelemetry: 'not connected',
            storage: 'fixture',
          },
          updatedAt: '2026-11-16T00:00:00Z',
        };
      if (route.startsWith('/api/configuration/environments/'))
        value = {
          revision: 0,
          published: { id: 'fixture', values: defaults },
          draft: null,
          versions: [],
        };
      if (route.startsWith('/api/gameplay/environments/'))
        value = {
          revision: 0,
          published: { id: 'fixture', values: contentDefaults },
          draft: null,
          versions: [],
        };
      if (route === '/api/content/story')
        value = { revision: 0, draft: seed, releases: [] };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(value));
      return;
    }
    const file = route.startsWith('/assets/')
      ? path.join(
          'admin/dist',
          path.basename(path.dirname(route)),
          path.basename(route),
        )
      : 'admin/dist/index.html';
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, {
      'content-type': file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : 'text/html',
    });
    res.end(fs.readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      b.servers.push(server);
      resolve(`http://127.0.0.1:${server.address().port}/`);
    }),
  );
}

try {
  await b.start();
  report.meta = b.meta;
  const url = await b.serveRoot(path.resolve('dist'));
  const templates = await gestureTemplates();
  const page = await b.newPage('desktop');
  await b.load(page, url);
  for (const [width, height] of sizes) {
    await page.eval('__ARCANE_GAME__.quitToMenu()');
    await viewport(page, width, height);
    const row = { width, height, checks: {}, dialogs: {} };
    report.game.push(row);
    row.layout = await page.eval(measure);
    row.checks.noHorizontalOverflow =
      row.layout.scrollWidth <= width && !row.layout.overflow.length;
    row.checks.menuButtonsReachable = await page.eval(`(() => {
      const card=document.querySelector('#menu-screen .glass-card');
      return [...card.querySelectorAll('button')].filter(e=>e.getClientRects().length).every(e=>{
        e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect(),c=card.getBoundingClientRect();
        return r.x>=c.x-1 && r.right<=c.right+1 && r.y>=c.y-1 && r.bottom<=c.bottom+1;
      });
    })()`);
    if (
      [320, 768, 1440, 1920].includes(width) &&
      (height > width || width >= 1440)
    ) {
      await page.eval(
        "document.querySelector('#menu-screen .glass-card').scrollTop=0",
      );
      await capture(page, `${width}x${height}-menu`);
    }
    for (const [opener, screen] of [
      ['btn-open-settings', 'settings-screen'],
      ['btn-open-companions', 'companion-screen'],
      ['btn-open-achievements', 'codex-screen'],
      ['btn-view-story', 'story-screen'],
    ]) {
      row.dialogs[screen] = await dialog(page, opener, screen);
    }
    row.checks.dialogControlsReachable = Object.values(row.dialogs).every(
      (d) => d.active && d.reachable && d.noOverflow,
    );
    await page.eval(
      "__ARCANE_GAME__.settings.set('highlight',false);__bench.play();__bench.park(5);__ARCANE_GAME__.uiManager.updateCombo(12,3,0.7);__ARCANE_GAME__.uiManager.updateScore(123456789);__ARCANE_GAME__.uiManager.updateHearts(6,6)",
    );
    await settle(page);
    row.checks.hudAndArenaDoNotOverlap = await page.eval(`(() => {
      const arena=document.getElementById('gameCanvas').getBoundingClientRect(), dock=document.querySelector('.hud-dock').getBoundingClientRect(),footer=document.querySelector('.hud-bottom-bar').getBoundingClientRect();
      return dock.bottom <= arena.top + 1 && footer.top >= arena.bottom - 1;
    })()`);
    const boxes = (await page.eval(measure)).controls;
    row.checks.controlsVisibleAnd44px = boxes.every(
      (r) =>
        r.x >= 0 &&
        r.right <= width &&
        r.y >= 0 &&
        r.bottom <= height &&
        r.width >= 44 &&
        r.height >= 44,
    );
    row.checks.essentialHudDoesNotOverlap = await page.eval(`(() => {
      const els=[...document.querySelectorAll('.hud-hearts-panel,.hud-center-panel,.hud-right-panel')];
      const boxes=els.map(e=>e.getBoundingClientRect());
      return boxes.every((a,i)=>boxes.every((z,j)=>i===j || a.right<=z.left+1 || z.right<=a.left+1 || a.bottom<=z.top+1 || z.bottom<=a.top+1));
    })()`);
    row.checks.canvasAndDprMatch = await page.eval(
      `(() => { const g=__ARCANE_GAME__,r=g.canvas.getBoundingClientRect();return Math.abs(g.width-r.width)<1 && Math.abs(g.height-r.height)<1 && g.canvas.width===Math.round(g.width*g.dpr) && g.canvas.height===Math.round(g.height*g.dpr);})()`,
    );
    await page.send('Emulation.setTouchEmulationEnabled', {
      enabled: width <= 1024,
      maxTouchPoints: 5,
    });
    row.checks.pointerCoordinatesAccurate = await stroke(
      page,
      templates,
      width <= 1024,
    );
    row.checks.noScrollWhileDrawing = await page.eval(
      'scrollX === 0 && scrollY === 0',
    );
    if (
      ([320, 390, 768, 1440, 1920].includes(width) &&
        (height > width || width >= 1440)) ||
      width === 844
    )
      await capture(page, `${width}x${height}-playing`);
    await page.eval("__ARCANE_GAME__.settings.set('altInput',true)");
    await settle(page);
    row.checks.alternativeRunesFit = await page.eval(`(() => {
      const buttons=[...document.querySelectorAll('#rune-pad button')];
      return __bench.state()==='PLAYING' && buttons.length===8 && buttons.every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.x>=0 && r.right<=innerWidth && r.y>=0 && r.bottom<=innerHeight;});
    })()`);
    await page.eval(
      "__ARCANE_GAME__.settings.set('altInput',false);__ARCANE_GAME__.startPractice()",
    );
    await settle(page);
    row.checks.practiceFits = await page.eval(
      `(() => {const g=__ARCANE_GAME__,p=g.practice.getLayout();return p.cy-p.size/2>=0 && p.cy+p.size/2<=g.height && [...document.querySelectorAll('.practice-rune')].every(e=>{const r=e.getBoundingClientRect();return r.width>=44 && r.height>=44 && r.x>=0 && r.right<=innerWidth;});})()`,
    );
    row.checks.practiceControlsClear = await page.eval(`(() => {
      const top=document.querySelector('.practice-top').getBoundingClientRect(), arena=__ARCANE_GAME__.canvas.getBoundingClientRect();
      return top.bottom<=arena.top && getComputedStyle(document.getElementById('level-transition-banner')).display==='none';
    })()`);
    if (
      ([320, 390, 768, 1440].includes(width) && height > width) ||
      width === 844
    )
      await capture(page, `${width}x${height}-practice`);
    row.checks.noRuntimeErrors = await page.eval('__perf.errors.length === 0');
    console.log(
      `game ${width}x${height}:`,
      Object.entries(row.checks)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(', ') || 'PASS',
    );
  }
  // Resize a captured stroke, then draw again across density and safe-area changes.
  await page.eval('__ARCANE_GAME__.quitToMenu();__bench.play()');
  await viewport(page, 390, 844, 3);
  const p = await page.eval(
    `(() => {const r=__ARCANE_GAME__.canvas.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...p,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await viewport(page, 768, 1024, 1);
  report.resize.interruptedStrokeCancelled = await page.eval(
    '!__ARCANE_GAME__.inputHandler.isDrawing && __ARCANE_GAME__.inputHandler.currentPoints.length === 0',
  );
  await page.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...p,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });
  await page.eval(
    "__ARCANE_GAME__.resumeCountdown=0;__bench.play();document.documentElement.style.setProperty('--sat','24px');document.documentElement.style.setProperty('--sab','34px');document.documentElement.style.setProperty('--sal','20px');document.documentElement.style.setProperty('--sar','20px')",
  );
  await settle(page);
  report.resize.safeInsets = await page.eval(
    `(() => {const r=document.querySelector('.hud-dock').getBoundingClientRect(),a=__ARCANE_GAME__.canvas.getBoundingClientRect();return r.top>=24 && r.left>=20 && a.bottom<=innerHeight-34;})()`,
  );
  report.resize.pointerAfterResizeAndInsets = await stroke(
    page,
    templates,
    false,
  );
  await page.close();

  const adminUrl = await serveAdmin(),
    admin = await b.newPage('desktop');
  await admin.send('Page.navigate', { url: adminUrl });
  for (let i = 0; i < 100; i++) {
    if (await admin.eval("!!document.querySelector('.content h1')")) break;
    await sleep(50);
  }
  for (const [width, height] of sizes) {
    await viewport(admin, width, height);
    const row = { width, height, checks: {} };
    report.admin.push(row);
    row.checks.dashboardFits = await admin.eval(
      'document.documentElement.scrollWidth <= innerWidth',
    );
    row.checks.navigationReachable = await admin.eval(
      `(() => {const selector=innerWidth<=1000?'.mobile-menu':'.desktop-sidebar',r=document.querySelector(selector).getBoundingClientRect();return r.width>0 && r.x>=0 && r.right<=innerWidth;})()`,
    );
    if (width === 320 || width === 768 || width === 1920)
      await capture(admin, `admin-${width}x${height}`);
    console.log(
      `admin ${width}x${height}:`,
      Object.entries(row.checks)
        .filter(([, v]) => !v)
        .map(([k]) => k)
        .join(', ') || 'PASS',
    );
  }
  report.adminEditors = [];
  for (const route of ['configuration', 'gameplay', 'content']) {
    await admin.send('Page.navigate', { url: adminUrl + route });
    for (let i = 0; i < 100; i++) {
      if (
        await admin.eval(
          "!!document.querySelector('.content h1') && !document.querySelector('.ant-spin-spinning')",
        )
      )
        break;
      await sleep(50);
    }
    for (const width of [320, 768, 1440]) {
      await viewport(admin, width, width === 320 ? 568 : 900);
      await sleep(100);
      report.adminEditors.push({
        route,
        width,
        fits: await admin.eval(
          'document.documentElement.scrollWidth <= innerWidth',
        ),
      });
      if (width === 320) await capture(admin, `admin-${route}-320`);
    }
  }
  await admin.send('Page.navigate', { url: adminUrl + 'configuration' });
  for (let i = 0; i < 100; i++) {
    if (
      await admin.eval("!!document.querySelector('input[aria-label=maxWaves]')")
    )
      break;
    await sleep(50);
  }
  await viewport(admin, 390, 360);
  report.keyboardViewport = await admin.eval(`(() => {
    const field=document.querySelector('input[aria-label=maxWaves]');field.focus();field.scrollIntoView({block:'center'});
    const r=field.getBoundingClientRect();return {simulated:true,focused:document.activeElement===field,fieldReachable:r.y>=0&&r.bottom<=innerHeight,noOverflow:document.documentElement.scrollWidth<=innerWidth};
  })()`);
  await admin.close();
} finally {
  await b.stop();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
}
const failed =
  [...report.game, ...report.admin].some((r) =>
    Object.values(r.checks).some((v) => !v),
  ) ||
  Object.values(report.resize).some((v) => !v) ||
  report.adminEditors?.some((r) => !r.fits) ||
  !report.keyboardViewport?.fieldReachable ||
  !report.keyboardViewport?.noOverflow;
console.log(`Report: ${out}`);
if (failed) process.exitCode = 1;
