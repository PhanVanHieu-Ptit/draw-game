/**
 * @file test-enemy-render-performance.js
 * @description Guards the "many ghosts on screen -> lag" fix in Enemy.render.
 *
 * ctx.shadowBlur is the most expensive thing the game draws. A ghost used to apply ~15 blur passes per
 * frame (its own glow, which then leaked into every later stroke), so a squad of 20 ghosts meant ~300 blur
 * passes per frame and a few FPS. Now a minion's glows are cached sprites (drawImage) and no shadow stays
 * active for later strokes. Verified here:
 *  - a minion render performs ZERO blurred draw operations and never writes a non-zero shadowBlur
 *  - the glow sprites are built once and reused (no per-frame canvas allocation), and prewarm covers them
 *  - without an offscreen canvas the glow falls back to shadowBlur (nothing is lost, nothing throws)
 *  - the quality tier (glow scale 0) switches the glow off, and DPR changes rebuild the sprites
 *  - bosses keep their original shadowBlur look
 *  - Game wires the quality tier and canvas DPR into the glow sprites
 */

import { Enemy } from './src/entities/Enemy.js';

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
// Recording canvas context. It tracks the shadow state across save()/restore() exactly like a real
// context, so a shadow that "leaks" into later draw calls is counted as blurred operations.
// ---------------------------------------------------------------------------
const DRAW_OPS = new Set(['fill', 'stroke', 'fillText', 'strokeText', 'fillRect', 'strokeRect']);

function makeRecordingCtx() {
  const state = { shadowBlur: 0, shadowColor: '', shadowOffsetX: 0, globalAlpha: 1 };
  const stack = [];
  const stats = { blurredOps: 0, drawImages: 0, shadowBlurWrites: [], ops: 0 };
  const methods = {
    save() { stack.push({ ...state }); },
    restore() { Object.assign(state, stack.pop()); },
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    drawImage() { stats.drawImages++; },
    measureText: () => ({ width: 10 })
  };
  return new Proxy({}, {
    get(_, key) {
      if (key === 'stats') return stats;
      if (key in state) return state[key];
      if (key in methods) return methods[key];
      if (DRAW_OPS.has(key)) {
        return () => {
          stats.ops++;
          const shadowed = state.shadowBlur > 0 || state.shadowOffsetX !== 0;
          if (shadowed && state.shadowColor) stats.blurredOps++;
        };
      }
      return () => {}; // every other drawing method is a no-op
    },
    set(_, key, value) {
      if (key === 'shadowBlur') stats.shadowBlurWrites.push(value);
      if (key in state) state[key] = value;
      return true;
    }
  });
}

// Fake DOM: only createElement('canvas') matters. Counts the sprites that get built.
let canvasesCreated = 0;
const spriteContexts = [];
function installFakeDom() {
  canvasesCreated = 0;
  spriteContexts.length = 0;
  global.document = {
    createElement: () => {
      canvasesCreated++;
      const ctx = makeRecordingCtx();
      spriteContexts.push(ctx);
      return { width: 0, height: 0, getContext: () => ctx };
    }
  };
}

function resetSpriteCache() {
  // Any change of DPR clears the cache; toggle so the cache is rebuilt from scratch
  Enemy.setPixelRatio(7);
  Enemy.setPixelRatio(1);
}

function makeEnemy(type, opts = {}) {
  const e = new Enemy();
  e.init({
    type,
    x: 300,
    y: 300,
    canvasWidth: 1280,
    canvasHeight: 720,
    symbolQueue: opts.queue || ['horizontal', 'vertical', 'lightning'],
    isHeartGhost: !!opts.heart,
    isFreezeGhost: !!opts.freeze,
    targetPlayerPos: { x: 640, y: 360 },
    levelIndex: opts.level || 1,
    levelId: ['library', 'cafeteria', 'classroom', 'gymnasium', 'rooftop'][(opts.level || 1) - 1],
    bossLives: 3
  });
  if (opts.hit) e.hitTimer = 0.3;
  if (opts.scared) e.expressionTimer = 1;
  if (opts.frozen) { e.isFrozen = true; e.freezeTimer = 3; }
  return e;
}

function render(enemy) {
  const ctx = makeRecordingCtx();
  enemy.render(ctx);
  return ctx.stats;
}

console.log('🧪 Starting Enemy Render Performance Tests...\n');

// ---------------------------------------------------------------------------
// 1. A minion render performs no blur passes
// ---------------------------------------------------------------------------
console.log('--- 1. Minions draw without per-frame shadow blur ---');
{
  installFakeDom();
  Enemy.setGlowScale(1);
  resetSpriteCache();

  const variants = [
    ['regular (level 1)', makeEnemy('REGULAR', { level: 1 })],
    ['regular (level 2)', makeEnemy('REGULAR', { level: 2 })],
    ['regular (level 3)', makeEnemy('REGULAR', { level: 3 })],
    ['regular (level 4)', makeEnemy('REGULAR', { level: 4 })],
    ['regular (level 5)', makeEnemy('REGULAR', { level: 5 })],
    ['speedster', makeEnemy('SPEEDSTER', { queue: ['vertical'] })],
    ['armored', makeEnemy('ARMORED', { level: 2, queue: ['horizontal', 'vertical', 'lightning', 'caret'] })],
    ['hit flash', makeEnemy('REGULAR', { hit: true })],
    ['scared face', makeEnemy('REGULAR', { scared: true })],
    ['frozen in ice', makeEnemy('REGULAR', { frozen: true })]
  ];
  for (const [name, enemy] of variants) {
    const s = render(enemy);
    assert(s.blurredOps === 0, `${name}: 0 blurred draw operations (got ${s.blurredOps})`);
    assert(s.shadowBlurWrites.every((v) => v === 0), `${name}: never sets a non-zero shadowBlur`);
  }

  const regular = render(variants[1][1]);
  assert(regular.drawImages >= 3, `The glow is blitted from sprites (body + eyes + active rune badge: ${regular.drawImages} drawImage calls)`);
}

// ---------------------------------------------------------------------------
// 2. Sprites are cached
// ---------------------------------------------------------------------------
console.log('\n--- 2. Glow sprites are built once and reused ---');
{
  installFakeDom();
  Enemy.setGlowScale(1);
  resetSpriteCache();

  const squad = [
    makeEnemy('REGULAR', { level: 1 }), makeEnemy('REGULAR', { level: 2 }), makeEnemy('SPEEDSTER'),
    makeEnemy('ARMORED', { level: 3 }), makeEnemy('REGULAR', { level: 4, hit: true })
  ];
  for (const e of squad) render(e); // first frame: sprites get built
  const builtAfterFirstFrame = canvasesCreated;
  assert(builtAfterFirstFrame > 0 && builtAfterFirstFrame < 30, `First frame builds a small set of sprites (${builtAfterFirstFrame})`);

  for (let frame = 0; frame < 120; frame++) for (const e of squad) { e.update(1 / 60, { x: 640, y: 360 }); render(e); }
  assert(canvasesCreated === builtAfterFirstFrame, `120 more frames x ${squad.length} ghosts allocate no new canvas (${canvasesCreated - builtAfterFirstFrame} new)`);

  // prewarm: a fresh cache, warmed up front, means a first-time squad allocates nothing mid-fight
  resetSpriteCache();
  installFakeDom();
  Enemy.prewarmGlow();
  const prewarmed = canvasesCreated;
  assert(prewarmed > 0, `prewarmGlow() builds the sprites up front (${prewarmed})`);
  for (const e of squad) render(e);
  const lateBuilt = canvasesCreated - prewarmed;
  assert(lateBuilt === 0, `After prewarm the first squad builds nothing mid-fight (${lateBuilt} late sprites)`);
}

// ---------------------------------------------------------------------------
// 3. Fallback: no offscreen canvas available
// ---------------------------------------------------------------------------
console.log('\n--- 3. Fallback without offscreen canvases ---');
{
  const savedDocument = global.document;
  delete global.document;
  Enemy.setGlowScale(1);
  resetSpriteCache();

  let threw = false;
  let stats = null;
  try {
    stats = render(makeEnemy('REGULAR', { level: 2 }));
  } catch (e) {
    threw = true;
    console.error(e);
  }
  assert(!threw, 'Rendering a ghost without document/OffscreenCanvas does not throw');
  assert(stats && stats.shadowBlurWrites.some((v) => v > 0), 'The glow falls back to shadowBlur (the look is kept)');
  assert(stats && stats.drawImages === 0, 'No sprite is blitted in the fallback');

  // a canvas whose 2D context is unusable (mocks, exhausted memory) must fall back the same way
  global.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  resetSpriteCache();
  threw = false;
  try {
    stats = render(makeEnemy('SPEEDSTER'));
  } catch (e) {
    threw = true;
  }
  assert(!threw && stats.shadowBlurWrites.some((v) => v > 0), 'A canvas without a 2D context also falls back to shadowBlur');

  global.document = savedDocument;
  resetSpriteCache();
}

// ---------------------------------------------------------------------------
// 4. Quality tier + DPR
// ---------------------------------------------------------------------------
console.log('\n--- 4. Quality tier and canvas DPR ---');
{
  installFakeDom();
  Enemy.setGlowScale(1);
  resetSpriteCache();

  Enemy.setGlowScale(0); // QualityManager "low" tier: no glow at all
  let s = render(makeEnemy('REGULAR', { level: 2 }));
  assert(s.drawImages === 0, 'Glow scale 0: no glow sprite is drawn');
  assert(s.blurredOps === 0 && s.shadowBlurWrites.every((v) => v === 0), 'Glow scale 0: no shadow blur either (the tier really is glow-free)');

  Enemy.setGlowScale(1);
  s = render(makeEnemy('REGULAR', { level: 2 }));
  assert(s.drawImages > 0, 'Back to full glow: sprites are drawn again');
  assert(Enemy.setGlowScale(1) === false && Enemy.setGlowScale(0.6) === true, 'setGlowScale reports whether anything changed');

  // The old glow was shadowBlur DEVICE pixels wide: on a 2x canvas the sprite blur must be halved to match
  const bodyBlurAt = (dpr) => {
    installFakeDom();
    Enemy.setGlowScale(1);
    Enemy.setPixelRatio(dpr === 1 ? 2 : 1); // force a rebuild
    Enemy.setPixelRatio(dpr);
    render(makeEnemy('REGULAR', { level: 2 })); // first sprite built is the body glow (16)
    const bodyCtx = spriteContexts[0];
    return Math.max(...bodyCtx.stats.shadowBlurWrites);
  };
  const blur1x = bodyBlurAt(1);
  const blur2x = bodyBlurAt(2);
  assert(blur1x === 16, `1x canvas: body glow sprite uses blur 16 (got ${blur1x})`);
  assert(blur2x === 8, `2x canvas: body glow sprite uses blur 8 so it looks identical (got ${blur2x})`);
  assert(Enemy.setPixelRatio(2) === false && Enemy.setPixelRatio(1) === true, 'setPixelRatio reports whether anything changed');
  Enemy.setPixelRatio(1);
  Enemy.setGlowScale(1);
}

// ---------------------------------------------------------------------------
// 5. Bosses keep their original look
// ---------------------------------------------------------------------------
console.log('\n--- 5. Bosses keep real shadowBlur ---');
{
  installFakeDom();
  Enemy.setGlowScale(1);
  resetSpriteCache();
  for (const type of ['BOSS_LIBRARIAN', 'BOSS_CHEF', 'BOSS_PLANETARIUM', 'BOSS_COACH']) {
    const s = render(makeEnemy(type, { queue: ['horizontal', 'vertical'] }));
    assert(s.shadowBlurWrites.some((v) => v >= 20), `${type}: body glow still uses its original shadowBlur`);
  }
}

// ---------------------------------------------------------------------------
// 6. Game wiring
// ---------------------------------------------------------------------------
console.log('\n--- 6. Game feeds quality tier and DPR into the glow sprites ---');
{
  class FakeCtx2D {
    constructor() { this._blur = 0; }
    get shadowBlur() { return this._blur; }
    set shadowBlur(v) { this._blur = v; }
    save() {} restore() {} translate() {} rotate() {} scale() {} beginPath() {} closePath() {}
    arc() {} ellipse() {} fill() {} stroke() {} fillText() {} quadraticCurveTo() {} lineTo() {} moveTo() {}
    clearRect() {} fillRect() {} drawImage() {} setTransform() {} rect() {} roundRect() {}
    createRadialGradient() { return { addColorStop() {} }; }
    createLinearGradient() { return { addColorStop() {} }; }
    measureText() { return { width: 10 }; }
  }
  global.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    addEventListener: () => {},
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  const stub = () => ({
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    style: { setProperty: () => {} },
    innerText: '',
    textContent: '',
    appendChild: () => {},
    querySelectorAll: () => [],
    querySelector: () => null
  });
  const gameCtxs = [];
  global.document = {
    hidden: false,
    addEventListener: () => {},
    createElement: () => {
      const ctx = new FakeCtx2D();
      gameCtxs.push(ctx);
      return { ...stub(), getContext: () => ctx, width: 100, height: 100 };
    },
    getElementById: () => stub(),
    querySelectorAll: () => [],
    querySelector: () => null
  };

  const mainCtx = new FakeCtx2D();
  const canvas = {
    getContext: () => mainCtx,
    parentElement: { clientWidth: 1280, clientHeight: 720 },
    width: 0,
    height: 0,
    style: {},
    addEventListener: () => {}
  };

  Enemy.setGlowScale(1);
  Enemy.setPixelRatio(1);
  const { Game } = await import('./src/core/Game.js');
  const game = new Game(canvas);

  game.quality.setTier('high');
  game.resize();
  let s = render(makeEnemy('REGULAR', { level: 2 }));
  assert(s.drawImages > 0, 'High tier: ghosts glow through sprites');
  assert(s.blurredOps === 0, 'High tier: still no blurred draw operations per ghost');

  game.quality.setTier('low');
  s = render(makeEnemy('REGULAR', { level: 2 }));
  assert(s.drawImages === 0 && s.blurredOps === 0, 'Low tier (glow scale 0): ghosts are drawn glow-free');

  game.quality.setTier('high');
  s = render(makeEnemy('REGULAR', { level: 2 }));
  assert(s.drawImages > 0, 'Back on the high tier the glow returns');
  assert(game.dpr === 2, `Game runs at DPR ${game.dpr} on a 2x desktop`);
  assert(Enemy.setPixelRatio(game.dpr) === false, 'Game already told the glow sprites about its DPR');
}

console.log('\n========================================');
console.log(`Enemy Render Performance Tests: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
}
