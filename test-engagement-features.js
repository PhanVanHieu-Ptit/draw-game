/**
 * @file test-engagement-features.js
 * @description Covers the engagement features:
 *  1. Spell Phrases (PhraseTracker) and the Spellbook data
 *  2. Mid-wave surprises (EventSystem) and the WaveSystem hooks they use
 *  3. Golden ghost and boss signature tricks (Enemy)
 *  4. Cosmetics (unlock rules, persistence, hats, ink trails)
 *  5. Best-moment clip recorder (HighlightRecorder, with a fake MediaRecorder)
 *  6. Game integration: surprises, phrases, Boss Rush, cosmetics, achievements
 */

import { PhraseTracker, SPELL_PHRASES, PHRASE_WINDOW, PHRASE_COOLDOWN, PHRASE_RUNES, getPhrase } from './src/core/Spells.js';
import { EventSystem, EVENT_DEFS } from './src/systems/EventSystem.js';
import { WaveSystem } from './src/systems/WaveSystem.js';
import { Enemy, BOSS_GIMMICKS } from './src/entities/Enemy.js';
import { ProgressStore } from './src/core/ProgressStore.js';
import { SettingsStore, DEFAULT_SETTINGS } from './src/core/Settings.js';
import { ACHIEVEMENTS, evaluateAchievements } from './src/core/Achievements.js';
import {
  TRAILS, HATS, STREAK_MILESTONES, isCosmeticUnlocked, evaluateCosmetics, getCosmetic, getTrail, trailColors
} from './src/core/Cosmetics.js';
import { drawHat } from './src/entities/Hats.js';
import { HighlightRecorder } from './src/systems/HighlightRecorder.js';
import { GAME_STATES, RUNES } from './src/core/Constants.js';

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log(`  ✅ PASS: ${msg}`); passed++; }
  else { console.error(`  ❌ FAIL: ${msg}`); failed++; }
}

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

/** A canvas context that accepts every call (hats, trails and ghosts use many different ones) */
const anyCtx = () => new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {}, width: 10 })),
  set: (t, k, v) => { t[k] = v; return true; }
});

// ---------------------------------------------------------------------------------------------
// Minimal DOM so Game (and its UI) can be constructed under Node
// ---------------------------------------------------------------------------------------------
const noopCtx = {
  save() {}, restore() {}, clearRect() {}, fillRect() {}, scale() {}, translate() {}, rotate() {},
  beginPath() {}, arc() {}, fill() {}, stroke() {}, drawImage() {}, moveTo() {}, lineTo() {}, rect() {},
  closePath() {}, fillText() {}, setLineDash() {}, clip() {}, roundRect() {},
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
  measureText: () => ({ width: 10 })
};
const fakeEl = () => ({
  addEventListener() {}, classList: { add() {}, remove() {}, contains: () => false },
  style: { setProperty() {} }, textContent: '', innerHTML: '', innerText: '', appendChild() {},
  querySelectorAll: () => [], querySelector: () => null, setAttribute() {}
});
global.window = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {},
  location: { href: 'https://example.test/play/', search: '' }
};
global.document = {
  addEventListener() {}, hidden: false,
  createElement: () => ({ getContext: () => noopCtx, classList: { add() {}, remove() {}, contains: () => false }, appendChild() {}, width: 100, height: 100 }),
  getElementById: () => fakeEl(), querySelectorAll: () => [], querySelector: () => null
};
const mockCanvas = {
  getContext: () => noopCtx, parentElement: { clientWidth: 1280, clientHeight: 720 },
  width: 1280, height: 720, style: {}, addEventListener() {}
};

console.log('🧪 Engagement features verification\n');

// ===== 1. Spell phrases ========================================================================
console.log('--- 1. Spell Phrases ---');
{
  assert(SPELL_PHRASES.length >= 5, `there are ${SPELL_PHRASES.length} secret phrases to discover`);
  assert(new Set(SPELL_PHRASES.map(p => p.id)).size === SPELL_PHRASES.length, 'every phrase has a unique id');
  assert(new Set(SPELL_PHRASES.map(p => p.runes.join())).size === SPELL_PHRASES.length, 'no two phrases share a recipe');
  assert(SPELL_PHRASES.every(p => p.runes.length === 3 && p.runes.every(r => PHRASE_RUNES.includes(r) && RUNES[r])), 'every recipe is three basic runes');
  assert(SPELL_PHRASES.every(p => p.runes[0] !== p.runes[1] || p.runes[1] !== p.runes[2]), 'no recipe is the same stroke three times (it would fire by accident)');
  assert(SPELL_PHRASES.every(p => p.hint && p.desc && p.name && p.icon), 'every phrase has a name, an icon, a description and a riddle hint');

  const blade = getPhrase('blade_storm');
  const t = new PhraseTracker();
  assert(t.push(blade.runes[0]) === null && t.push(blade.runes[1]) === null, 'the first two strokes complete nothing');
  assert(t.chain.join() === blade.runes.slice(0, 2).join(), 'the chain shows the strokes so far');
  const cast = t.push(blade.runes[2]);
  assert(cast && cast.id === 'blade_storm', 'the third stroke in order casts the phrase');
  assert(t.chain.length === 0, 'the chain is cleared after a cast');

  // Cooldown: the same recipe straight away does not fire again
  t.push(blade.runes[0]); t.push(blade.runes[1]);
  assert(t.push(blade.runes[2]) === null, 'a phrase still recharging does not fire a second time');
  t.tick(PHRASE_COOLDOWN + 0.1);
  t.push(blade.runes[0]); t.push(blade.runes[1]);
  assert(t.push(blade.runes[2]) !== null, `after ${PHRASE_COOLDOWN}s the phrase can be cast again`);

  // Window and breaking
  const w = new PhraseTracker();
  w.push('horizontal');
  assert(w.tick(PHRASE_WINDOW - 0.1) === false && w.chain.length === 1, 'the chain survives inside the time window');
  assert(w.tick(0.3) === true && w.chain.length === 0, 'the chain expires once the window passes (tick reports it)');
  w.push('caret'); w.push('v_shape');
  assert(w.breakChain() === true && w.chain.length === 0 && w.breakChain() === false, 'a missed stroke breaks the chain');
  w.push('horizontal'); w.push('heart'); w.push('circle');
  assert(w.chain.join() === 'horizontal', 'heart / circle / spiral strokes neither join nor break a chain');
  const wrong = new PhraseTracker();
  wrong.push('horizontal'); wrong.push('vertical');
  assert(wrong.push('caret') === null, 'the wrong third stroke casts nothing');
  // Sliding window: a stray first stroke does not stop the real recipe from firing
  const slide = new PhraseTracker();
  slide.push('caret');
  slide.push(blade.runes[0]); slide.push(blade.runes[1]);
  assert(slide.push(blade.runes[2]) && slide.chain.length === 0, 'extra strokes before the recipe do not prevent it');
}

// ===== 2. Surprises (EventSystem) and WaveSystem hooks =========================================
console.log('\n--- 2. Surprises and WaveSystem hooks ---');
{
  const planFor = (seed, wave) => {
    const e = new EventSystem();
    e.setSeed(seed);
    e.startWave(wave, { enabled: true });
    return JSON.stringify(e.plan);
  };
  assert(planFor(1234, 3) === planFor(1234, 3), 'with a seed (Daily Challenge) the same wave always holds the same surprises');
  let differs = false;
  for (let w = 2; w < 14; w++) if (planFor(1234, w) !== planFor(99, w)) differs = true;
  assert(differs, 'different seeds give different schedules');

  const off = new EventSystem();
  off.startWave(3, { enabled: false });
  assert(off.plan.length === 0, 'a wave that is not eligible (tutorial, boss rush...) holds no surprises');

  // Over many unseeded waves both kinds show up, never more than two per wave
  const kinds = new Set();
  let maxPerWave = 0;
  for (let i = 0; i < 400; i++) {
    const e = new EventSystem();
    e.startWave(5, { enabled: true });
    maxPerWave = Math.max(maxPerWave, e.plan.length);
    e.plan.forEach(p => kinds.add(p.kind));
  }
  assert(kinds.has('GOLDEN') && kinds.has('METEOR') && kinds.has('BLOOD_MOON') && kinds.has('HEART_FEST'), 'all four surprise kinds can appear');
  assert(maxPerWave <= 2, 'a wave holds at most two surprises');
  assert(Object.keys(EVENT_DEFS).every(k => EVENT_DEFS[k].text && EVENT_DEFS[k].name), 'every surprise has an announcement');

  // Firing
  const ev = new EventSystem();
  ev.plan = [{ kind: 'GOLDEN', at: 1 }];
  const state = { active: true, hp: 5, maxHp: 5, pool: ['horizontal', 'vertical'] };
  assert(ev.update(0.5, state).length === 0, 'nothing fires before its time');
  const idle = new EventSystem();
  idle.plan = [{ kind: 'GOLDEN', at: 0.1 }];
  assert(idle.update(5, { ...state, active: false }).length === 0 && idle.plan.length === 1, 'nothing fires while ghosts are not being spawned (boss fight, intermission)');
  const fired = ev.update(0.6, state);
  assert(fired.length === 1 && fired[0].kind === 'GOLDEN', 'it fires when its time comes');
  const golden = fired[0].spawns[0];
  assert(golden.isGolden && golden.symbolQueue.length === 2 && golden.symbolQueue.every(r => ['horizontal', 'vertical'].includes(r)), 'the golden ghost carries two runes from the allowed pool');

  const meteor = new EventSystem();
  meteor.plan = [{ kind: 'METEOR', at: 0 }];
  const mf = meteor.update(0.1, state)[0];
  assert(Array.isArray(mf.spawns[0]) && mf.spawns[0].length === 5 && mf.spawns[0].every(g => g.archetype === 'SPEEDSTER' && g.symbolQueue.length === 1), 'a meteor shower is a squad of five fast single-rune ghosts');
  assert(meteor.scoreMult === 2, 'a meteor shower doubles the score');
  meteor.update(12.5, { ...state, active: false });
  assert(meteor.scoreMult === 1, 'the score boost ends by itself');

  const fest = new EventSystem();
  fest.plan = [{ kind: 'HEART_FEST', at: 0 }];
  assert(fest.update(0.1, state)[0].kind === 'METEOR', 'a healing festival is swapped for a meteor shower when Momo is at full health');
  fest.plan = [{ kind: 'HEART_FEST', at: 0 }];
  const hf = fest.update(0.1, { ...state, hp: 2 })[0];
  assert(hf.kind === 'HEART_FEST' && hf.spawns.length === 2 && hf.spawns.every(g => g.isHeartGhost), 'a wounded Momo gets two healing ghosts');
  fest.plan = [{ kind: 'HEART_FEST', at: 0 }];
  assert(fest.update(0.1, { ...state, hp: 2, noHearts: true })[0].kind === 'METEOR', 'no healing ghosts when a daily twist forbids them');

  const moon = new EventSystem();
  moon.plan = [{ kind: 'BLOOD_MOON', at: 0 }];
  moon.update(0.1, state);
  assert(moon.speedScale === 1.25 && moon.scoreMult === 2, 'a blood moon speeds ghosts up and doubles the score');
  moon.update(15, { ...state, active: false });
  assert(moon.speedScale === 1 && moon.scoreMult === 1, 'the blood moon fades');
  moon.boostScore(2, 5); moon.boostScore(1.5, 3);
  assert(moon.scoreMult === 2, 'a weaker boost never lowers a stronger one');

  // WaveSystem: the queue goes first, and Boss Rush skips the minion phase
  const ws = new WaveSystem();
  ws.setMode('ENDLESS');
  ws.queueSpawn({ archetype: 'REGULAR', symbolQueue: ['horizontal'], isGolden: true });
  const first = ws.update(0.016, 5, 0, 0);
  assert(first && first.isGolden, 'queued ghosts come out of update() before the normal wave');
  assert(ws.spawnQueue.length === 0, 'the queue is drained');
  ws.queueSpawn([{ archetype: 'SPEEDSTER', symbolQueue: ['vertical'] }]);
  ws.initLevel(2);
  assert(ws.spawnQueue.length === 0, 'a new wave drops stale queued ghosts');

  ws.eventSpeedScale = 1;
  ws.setMode('ENDLESS'); ws.initLevel(3);
  let base = null;
  for (let i = 0; i < 400 && !base; i++) { const r = ws.update(0.1, 5, 0, 0); if (r) base = Array.isArray(r) ? r[0] : r; }
  ws.eventSpeedScale = 1.25;
  ws.initLevel(3);
  let fast = null;
  for (let i = 0; i < 400 && !fast; i++) { const r = ws.update(0.1, 5, 0, 0); if (r) fast = Array.isArray(r) ? r[0] : r; }
  assert(base && fast && fast.speedMultiplier > base.speedMultiplier * 1.2, 'ghosts generated during a blood moon are faster');

  const rush = new WaveSystem();
  rush.setMode('STORY');
  rush.setBossRush(true);
  rush.initLevel(1);
  assert(rush.bossRush && rush.totalEnemiesInWave === 0, 'Boss Rush levels have no minion phase');
  const bossCfg = rush.update(0.1, 5, 0, 0);
  assert(bossCfg && bossCfg.isBoss && bossCfg.archetype === 'BOSS_LIBRARIAN', 'the level boss appears straight away in Boss Rush');
  rush.setBossRush(false);
  assert(rush.totalEnemiesInWave === 12, 'switching Boss Rush off restores the normal minion count');
}

// ===== 3. Golden ghost & boss tricks ===========================================================
console.log('\n--- 3. Golden ghost and boss tricks ---');
{
  const player = { x: 400, y: 300, radius: 30 };
  const g = new Enemy();
  g.init({ type: 'REGULAR', x: 40, y: 120, canvasWidth: 800, canvasHeight: 600, isGolden: true, symbolQueue: ['horizontal', 'vertical'], speedMultiplier: 1.5, targetPlayerPos: player });
  assert(g.isGolden && g.scoreValue === 1200 && g.baseColor === '#fde68a', 'the golden ghost is golden and worth a lot');
  assert(g.collidesWith({ x: g.x, y: g.y, radius: 30 }) === false, 'the golden ghost never hurts Momo');
  let escapedAt = -1;
  let hooked = 0;
  Enemy.onGoldenEscape = () => { hooked++; };
  for (let t = 0; t < 40 && !g.isDead; t += 0.05) { g.update(0.05, player); escapedAt = t; }
  assert(g.isDead && g.escaped && escapedAt > 3 && escapedAt < 25, `it escapes if nobody catches it (after ${escapedAt.toFixed(1)}s)`);
  assert(hooked === 1, 'the game is told when it escapes');
  Enemy.onGoldenEscape = null;

  const caught = new Enemy();
  caught.init({ type: 'REGULAR', x: 300, y: 100, canvasWidth: 800, canvasHeight: 600, isGolden: true, symbolQueue: ['horizontal', 'vertical'], speedMultiplier: 1.5 });
  caught.takeHit('horizontal');
  const kill = caught.takeHit('vertical');
  assert(kill.destroyed && caught.isDead && !caught.escaped, 'two correct strokes purify it');
  caught.reset();
  assert(!caught.isGolden && !caught.escaped, 'a pooled ghost forgets it was golden');
  assert(!!anyCtxRender(g), 'the golden aura renders without errors');

  function anyCtxRender(e) {
    const probe = new Enemy();
    probe.init({ type: 'REGULAR', x: 100, y: 100, canvasWidth: 800, canvasHeight: 600, isGolden: true, symbolQueue: ['caret', 'v_shape'], speedMultiplier: 1.5 });
    probe.render(anyCtx());
    return true;
  }

  // --- boss tricks
  const boss = (type, queue = ['horizontal', 'vertical', 'caret']) => {
    const b = new Enemy();
    b.init({ type, x: 400, y: -75, canvasWidth: 800, canvasHeight: 600, symbolQueue: queue, bossPhases: [queue], bossLives: 3, speedMultiplier: 0.9, targetPlayerPos: player });
    return b;
  };
  const run = (b, seconds, dt = 0.05) => {
    const events = [];
    for (let t = 0; t < seconds; t += dt) {
      b.update(dt, player);
      if (b.gimmickEvent) { events.push(b.gimmickEvent); b.gimmickEvent = null; }
    }
    return events;
  };

  assert(Object.keys(BOSS_GIMMICKS).length === 5, 'every one of the five bosses has a signature trick');

  const lib = boss('BOSS_LIBRARIAN');
  assert(lib.gimmick && lib.gimmick.kind === 'hide' && !lib.symbolsHidden, 'the Librarian starts with her runes visible');
  let sawHidden = false;
  let hideEvent = false;
  for (let t = 0; t < 12; t += 0.05) {
    lib.update(0.05, player);
    if (lib.gimmickEvent === 'HIDE') { hideEvent = true; lib.gimmickEvent = null; }
    if (lib.symbolsHidden) sawHidden = true;
  }
  assert(sawHidden && hideEvent, 'the Librarian hides her runes behind "?" and announces it');
  run(lib, 3.5);
  assert(lib.matchesActiveSymbol('horizontal'), 'hidden runes still work: matching is unchanged');
  lib.render(anyCtx());
  lib.symbolsHidden = true;
  lib.render(anyCtx());
  assert(true, 'a boss with hidden runes renders without errors');

  const chef = boss('BOSS_CHEF');
  const chefEvents = run(chef, 8);
  assert(chefEvents.includes('SWIRL') && chef.symbolQueue[0] === 'caret' && chef.symbolQueue[2] === 'horizontal', 'the Chef reverses the order of the runes');

  const stella = boss('BOSS_PLANETARIUM');
  assert(run(stella, 9).includes('METEORS'), 'Professor Stella calls down meteors');

  const coach = boss('BOSS_COACH');
  const calm = boss('BOSS_COACH');
  calm.gimmickTimer = 999;
  coach.gimmickTimer = 0.01;
  coach.update(0.05, player); // sprint begins
  assert(coach.sprintTimer > 0 && coach.gimmickEvent === 'SPRINT', 'the Coach announces his sprint');
  coach.gimmickEvent = null;
  const y0 = coach.y, y1 = calm.y;
  for (let i = 0; i < 10; i++) { coach.update(0.05, player); calm.update(0.05, player); }
  assert((coach.y - y0) > (calm.y - y1) * 1.6, 'a sprinting Coach covers much more ground');

  const master = boss('BOSS_MASTER');
  const early = run(master, 6);
  assert(!early.includes('FLICKER') && !master.symbolsHidden, "Lord Umbra's runes are steady until his last life");
  master.bossLives = 1;
  let flickered = false;
  let sawEvent = false;
  for (let t = 0; t < 8; t += 0.05) {
    master.update(0.05, player);
    if (master.gimmickEvent === 'FLICKER') sawEvent = true;
    if (master.symbolsHidden) flickered = true;
  }
  assert(sawEvent && flickered, "on his last life Lord Umbra's runes flicker in and out");

  const hit = boss('BOSS_LIBRARIAN', ['horizontal']);
  hit.symbolsHidden = true;
  hit.takeHit('horizontal');
  hit.startBossRetreat(true);
  assert(hit.symbolsHidden === false, 'a retreating boss shows its runes again');

  // Pool safety: a recycled enemy has no leftover tricks
  const recycled = boss('BOSS_COACH');
  recycled.sprintTimer = 2;
  recycled.reset();
  assert(recycled.gimmick === null && recycled.sprintTimer === 0 && !recycled.symbolsHidden, 'a recycled boss forgets its trick');
}

// ===== 4. Cosmetics ============================================================================
console.log('\n--- 4. Cosmetics ---');
{
  assert(TRAILS.length >= 6 && HATS.length >= 6, `there are ${TRAILS.length} ink trails and ${HATS.length} hats`);
  assert(TRAILS[0].unlock === null && HATS[0].unlock === null, 'the default trail and "no hat" are always owned');
  const ids = [...TRAILS, ...HATS].map(c => c.id);
  assert(new Set(ids).size === ids.length, 'cosmetic ids are unique');
  const achIds = new Set(ACHIEVEMENTS.map(a => a.id));
  const badRefs = [...TRAILS, ...HATS].filter(c => c.unlock && c.unlock.achievement && !achIds.has(c.unlock.achievement));
  assert(badRefs.length === 0, 'every cosmetic that needs an achievement points at a real one');
  const streaks = new Set([...TRAILS, ...HATS].filter(c => c.unlock && c.unlock.streak).map(c => c.unlock.streak));
  assert(STREAK_MILESTONES.every(m => streaks.has(m)), 'every daily-streak milestone has a reward');
  assert([...TRAILS, ...HATS].every(c => c.unlock === null || c.hint), 'every locked cosmetic tells the player how to get it');

  const p = new ProgressStore(new MemoryStorage());
  const party = getCosmetic('hat', 'party');
  assert(!isCosmeticUnlocked(party, p), 'a hat is locked until its achievement is earned');
  p.unlock('daily_first');
  assert(isCosmeticUnlocked(party, p), 'earning the achievement unlocks the hat');
  const fresh = evaluateCosmetics(p);
  assert(fresh.some(c => c.id === 'party' && c.kind === 'hat'), 'a newly available cosmetic is reported once');
  assert(evaluateCosmetics(p).length === 0, 'and not reported again');

  p.data.stats.bestDailyStreak = 7;
  const ids2 = evaluateCosmetics(p).map(c => c.id).sort();
  assert(ids2.includes('aurora') && ids2.includes('halo') && ids2.includes('bow') && !ids2.includes('rainbow'), 'a 7-day daily streak unlocks the 3- and 7-day rewards, not the 14-day one');
  p.data.stats.bestDailyStreak = 14;
  assert(evaluateCosmetics(p).some(c => c.id === 'rainbow'), 'a 14-day streak unlocks the rainbow trail');

  assert(p.getEquipped('trail') === 'arcane' && p.getEquipped('hat') === 'none', 'defaults are equipped at first');
  assert(p.equipCosmetic('hat', 'party') && p.getEquipped('hat') === 'party', 'a hat can be equipped');
  assert(p.equipCosmetic('hat', 'wizard-hat-9000') === false && p.getEquipped('hat') === 'party', 'an unknown cosmetic is rejected');

  // Persistence & sanitising
  const storage = new MemoryStorage();
  const a = new ProgressStore(storage);
  a.unlock('daily_first');
  a.equipCosmetic('hat', 'party');
  a.equipCosmetic('trail', 'rainbow');
  a.markCosmeticSeen('party');
  a.recordPhrase('aegis'); a.recordPhrase('aegis'); a.recordPhrase('golden_hour');
  a.recordRush({ score: 4000, level: 5, seconds: 300, victory: true });
  a.save();
  const b = new ProgressStore(storage);
  assert(b.getEquipped('hat') === 'party' && b.getEquipped('trail') === 'rainbow' && b.isCosmeticSeen('party'), 'equipped cosmetics survive a reload');
  assert(b.getPhraseCount('aegis') === 2 && b.discoveredPhraseCount() === 2 && b.isPhraseDiscovered('golden_hour'), 'discovered phrases survive a reload');
  assert(b.getRush().seconds === 300 && b.getRush().clears === 1 && b.getRush().level === 5, 'the Boss Rush record survives a reload');
  const bad = new MemoryStorage();
  bad.setItem('arcane_paws_progress_v1', JSON.stringify({ cosmetics: { trail: 'nope', hat: 42, seen: { x: true } }, phrases: { aegis: -3, fake: 9 }, rush: { score: 'abc', seconds: -4 } }));
  const c = new ProgressStore(bad);
  assert(c.getEquipped('trail') === 'arcane' && c.getEquipped('hat') === 'none', 'corrupt cosmetics fall back to the defaults');
  assert(c.discoveredPhraseCount() === 0 && c.getRush().score === 0 && c.getRush().seconds === 0, 'corrupt phrases / rush data are discarded');
  assert(c.recordPhrase('fake').isNew === false, 'an unknown phrase id is ignored');

  // Boss Rush records
  const r = new ProgressStore(new MemoryStorage());
  const r1 = r.recordRush({ score: 1000, level: 3, seconds: 200, victory: false });
  assert(r1.isNewScore && !r1.isNewTime && r.getRush().seconds === 0, 'a failed rush sets a score but no clear time');
  const r2 = r.recordRush({ score: 5000, level: 5, seconds: 400, victory: true });
  const r3 = r.recordRush({ score: 4000, level: 5, seconds: 350, victory: true });
  const r4 = r.recordRush({ score: 4500, level: 5, seconds: 500, victory: true });
  assert(r2.isNewTime && r3.isNewTime && !r4.isNewTime && r.getRush().seconds === 350, 'the fastest clear time is kept');
  assert(r.getRush().score === 5000 && r.getRush().clears === 3 && r.getRush().plays === 4, 'best score and counters accumulate');

  // Achievements fed by the new stats
  const s = new ProgressStore(new MemoryStorage());
  s.recordPhrase('aegis');
  s.data.stats.goldenCaught = 10;
  s.recordRush({ score: 100, level: 5, seconds: 300, victory: true });
  const earned = evaluateAchievements(s).map(x => x.id);
  assert(['phrase_first', 'golden_1', 'golden_10', 'rush_clear', 'rush_fast'].every(id => earned.includes(id)), 'phrases, golden ghosts and Boss Rush earn their achievements');
  assert(!earned.includes('story_clear') && !earned.includes('spellbook_all'), 'but not the unrelated ones');
  SPELL_PHRASES.forEach(ph => s.recordPhrase(ph.id));
  assert(evaluateAchievements(s).some(x => x.id === 'spellbook_all'), 'discovering every phrase completes the Spellbook');

  // Colours and drawing
  assert(getTrail('nope').id === 'arcane', 'an unknown trail falls back to the default');
  const rb1 = trailColors(getTrail('rainbow'), 0);
  const rb2 = trailColors(getTrail('rainbow'), 1);
  assert(rb1.active !== rb2.active, 'the rainbow trail changes colour over time');
  assert(trailColors(getTrail('gold'), 5).active === '#fbbf24', 'a fixed trail keeps its colours');
  let drew = true;
  try { HATS.forEach(h => drawHat(anyCtx(), h.id, { x: 0, y: -40, w: 54 }, 1.3)); drawHat(anyCtx(), 'nope', { x: 0, y: 0, w: 40 }, 0); drawHat(anyCtx(), 'crown', null, 0); } catch (e) { drew = false; console.error(e); }
  assert(drew, 'every hat (and a bogus id) draws without errors');
  assert(DEFAULT_SETTINGS.highlight === true, 'recording the best moment is on by default');
  const st = new SettingsStore(new MemoryStorage());
  assert(st.set('highlight', false) && st.get('highlight') === false, 'the recording setting can be switched off');
}

// ===== 5. Highlight recorder ===================================================================
console.log('\n--- 5. Best-moment clip ---');
{
  assert(HighlightRecorder.isSupported(mockCanvas) === false, 'without MediaRecorder the recorder is inert');
  const inert = new HighlightRecorder(mockCanvas);
  assert(inert.begin() === false && (await inert.end()) === null, 'an inert recorder starts nothing and yields no clip');
  inert.noteHit(5); inert.tick(10); inert.pause(); inert.resume(); inert.discard();
  assert(true, 'every method is safe to call on an inert recorder');

  class FakeRecorder {
    static isTypeSupported(t) { return t === 'video/webm'; }
    constructor(stream, opts) { this.state = 'inactive'; this.stream = stream; this.opts = opts; FakeRecorder.made++; FakeRecorder.lastOpts = opts; }
    start() { this.state = 'recording'; }
    pause() { this.state = 'paused'; }
    resume() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: new Blob(['x'.repeat(2000)]) });
      setTimeout(() => this.onstop && this.onstop(), 0);
    }
  }
  FakeRecorder.made = 0;
  global.MediaRecorder = FakeRecorder;
  let stopped = 0;
  const canvas = { captureStream: () => ({ getTracks: () => [{ stop() { stopped++; } }] }) };

  assert(HighlightRecorder.isSupported(canvas), 'a canvas with captureStream is supported once MediaRecorder exists');
  const rec = new HighlightRecorder(canvas, { segmentSeconds: 6 });
  assert(rec.mimeType === 'video/webm', 'it picks a supported format');
  assert(rec.begin() === true && rec.running, 'recording starts');

  for (let c = 1; c <= 5; c++) rec.noteHit(c);   // segment 1: peak 5
  rec.tick(6.1);                                  // rotate
  for (let c = 1; c <= 9; c++) rec.noteHit(c);   // segment 2: peak 9
  rec.pause();
  rec.tick(100);                                  // paused: time does not count
  rec.resume();
  rec.tick(6.1);                                  // rotate
  rec.noteHit(1); rec.noteHit(2);                 // segment 3: peak 2 (not a "moment")
  rec.tick(3);
  const clip = await rec.end();
  assert(FakeRecorder.made === 3, `a new recorder is started per segment (${FakeRecorder.made})`);
  assert(clip && clip.peak === 9 && clip.ext === 'webm' && clip.blob.size > 0, 'the most exciting segment (combo 9) is the one kept');
  assert(stopped >= 1 && !rec.running, 'the capture stream is released when the run ends');

  const dull = new HighlightRecorder(canvas, { segmentSeconds: 6 });
  dull.begin(); dull.noteHit(1); dull.noteHit(2); dull.tick(3);
  assert((await dull.end()) === null, 'a run without a real combo produces no clip');

  const again = new HighlightRecorder(canvas, { segmentSeconds: 6 });
  again.begin(); again.noteHit(7); again.tick(3);
  again.discard();
  assert(again.best === null && !again.running, 'discard() throws the clip away');

  // --- 10 second segments and the game's sound
  const tenSec = new HighlightRecorder(canvas);
  assert(tenSec.segmentSeconds === 10, 'a segment is 10 seconds by default');
  tenSec.begin(); tenSec.noteHit(4);
  const madeAtStart = FakeRecorder.made;
  tenSec.tick(9.5);
  assert(FakeRecorder.made === madeAtStart && tenSec.running, 'the segment is still being recorded at 9.5s');
  tenSec.tick(0.6);
  const madeAfterRotate = FakeRecorder.made;
  const tenClip = await tenSec.end();
  assert(madeAfterRotate === madeAtStart + 1 && tenClip && tenClip.peak === 4, 'it rotates to a new segment only after 10s');

  const audioTracks = [];
  const avStream = { tracks: [{ stop() { stopped++; } }], getTracks() { return this.tracks; }, addTrack(t) { audioTracks.push(t); this.tracks.push(t); } };
  const avCanvas = { captureStream: () => avStream };
  let audioStops = 0;
  const withAudio = new HighlightRecorder(avCanvas, { getAudioTrack: () => ({ stop() { audioStops++; } }) });
  withAudio.begin(); withAudio.noteHit(5); withAudio.tick(3);
  assert(audioTracks.length === 1 && withAudio.hasAudio, 'the game\'s audio track is added to the capture stream');
  assert(FakeRecorder.lastOpts.audioBitsPerSecond === 128000, 'the recorder is given an audio bitrate when sound is present');
  const avClip = await withAudio.end();
  assert(avClip && avClip.peak === 5 && audioStops === 1, 'a clip with sound is produced and the audio track is released afterwards');

  const noTrack = new HighlightRecorder(avCanvas, { getAudioTrack: () => null });
  noTrack.begin();
  assert(noTrack.running && !noTrack.hasAudio && FakeRecorder.lastOpts.audioBitsPerSecond === undefined, 'no audio track: it records video only');
  noTrack.discard();

  const brokenAudio = new HighlightRecorder(avCanvas, { getAudioTrack: () => { throw new Error('no audio'); } });
  assert(brokenAudio.begin() === true && brokenAudio.running && !brokenAudio.hasAudio, 'an audio failure never stops the video clip');
  brokenAudio.discard();

  FakeRecorder.isTypeSupported = (t) => t === 'video/webm;codecs=vp8,opus' || t === 'video/webm';
  assert(HighlightRecorder.pickMimeType() === 'video/webm;codecs=vp8,opus', 'it prefers a format that includes the opus audio codec');
  FakeRecorder.isTypeSupported = (t) => t === 'video/webm';
  delete global.MediaRecorder;
}

// ===== 6. Game integration =====================================================================
console.log('\n--- 6. Game integration ---');
{
  const { Game } = await import('./src/core/Game.js');
  const game = new Game(mockCanvas);
  game.progress = new ProgressStore(new MemoryStorage());
  game.settings = new SettingsStore(new MemoryStorage());
  game.settings.onChange((k, v) => game._applySetting(k, v));
  const toasts = [];
  game.uiManager.meta.showToast = (html) => toasts.push(html);

  // --- Endless run: surprises
  game.waveSystem.setMode('ENDLESS');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(game.events.plan.length === 0, 'wave 1 of Endless holds no surprises (a gentle start)');
  assert(game.stateMachine.getCurrentStateName() === GAME_STATES.PLAYING && !game.bossRush, 'a normal run is not Boss Rush');

  game.events.plan = [{ kind: 'GOLDEN', at: 0 }];
  game._updateEvents(0.1);
  assert(game.waveSystem.spawnQueue.length === 1, 'a fired surprise queues its ghost');
  game.waveSystem.spawnTimer = 99; // keep the ordinary spawner quiet
  game.updatePlaying(0.016);
  const goldenEnemy = game.enemies.find(e => e.isGolden);
  assert(!!goldenEnemy && goldenEnemy.symbolQueue.length === 2, 'the golden ghost appears in the arena through the normal spawn path');
  assert(game.enemies.filter(e => !e.isDead && !e.isHeartGhost && !e.isGolden).length === 0, 'the golden ghost does not count as a hostile ghost (it cannot hold a wave open)');
  assert(game.player.hp === game.player.maxHp, 'it does not hurt Momo');

  const before = game.progress.data.stats.goldenCaught;
  game.player.hp = 3;
  game._onEnemyDefeated(goldenEnemy, 'horizontal', false);
  assert(game.progress.data.stats.goldenCaught === before + 1, 'catching it is counted');
  assert(game.events.scoreMult === 2 && game.player.hp === 4, 'it doubles the score for a while and heals one heart');
  assert(game._addScore(100) === 200, 'points are doubled while the boost lasts');
  game.events.update(11, { active: false });
  assert(game._addScore(100) === 100, 'and back to normal afterwards');

  game.events.plan = [{ kind: 'BLOOD_MOON', at: 0 }];
  game._updateEvents(0.1);
  assert(game.waveSystem.eventSpeedScale === 1.25, 'a blood moon reaches the wave generator');
  game.events.update(20, { active: false });
  game._updateEvents(0.1);
  assert(game.waveSystem.eventSpeedScale === 1, 'and leaves it again');

  game.events.plan = [{ kind: 'METEOR', at: 0 }];
  game._updateEvents(0.1);
  game.waveSystem.spawnTimer = 99;
  const nBefore = game.enemies.length;
  game.updatePlaying(0.016);
  assert(game.enemies.length - nBefore === 5, 'a meteor shower puts five ghosts on the screen at once');

  // --- boss trick -> spawn
  const bossEnemy = new Enemy();
  bossEnemy.init({ type: 'BOSS_PLANETARIUM', x: 600, y: 100, canvasWidth: 1280, canvasHeight: 720, symbolQueue: ['horizontal'], bossLives: 3, targetPlayerPos: game.player });
  bossEnemy.gimmickEvent = 'METEORS';
  game.enemies.push(bossEnemy);
  game._pollBossGimmicks();
  assert(bossEnemy.gimmickEvent === null && game.waveSystem.spawnQueue.length === 1, "the boss's meteor volley is queued as a squad");
  game.waveSystem.spawnQueue.length = 0;

  // --- phrases through real strokes
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  game.enemies.length = 0;
  game.projectiles.length = 0;
  const mk = (queue, x, y) => {
    const e = game.enemyPool.acquire();
    e.init({ type: 'REGULAR', x, y, canvasWidth: 1280, canvasHeight: 720, symbolQueue: queue, speedMultiplier: 0, targetPlayerPos: game.player });
    game.enemies.push(e);
    return e;
  };
  mk(['horizontal', 'caret', 'caret'], 100, 100);
  mk(['vertical', 'caret', 'caret'], 200, 100);
  mk(['lightning', 'caret', 'caret'], 300, 100);
  const idle = mk(['caret', 'vertical'], 400, 100);
  const stroke = (rune) => game.onGestureRecognized({ gesture: rune, score: 0.9, candidate: rune, reason: null }, []);
  stroke('horizontal'); stroke('vertical');
  assert(game.phrases.chain.length === 2 && game.progress.discoveredPhraseCount() === 0, 'two strokes build a chain but cast nothing');
  stroke('lightning');
  assert(game.progress.getPhraseCount('blade_storm') === 1, 'three strokes in the secret order cast Bão Kiếm');
  assert(idle.symbolQueue.length === 1 && idle.symbolQueue[0] === 'vertical', 'Bão Kiếm strips the front rune off ghosts that no stroke is already about to hit');
  assert(game.progress.data.stats.phrasesCast === 1 && game.progress.isUnlocked('phrase_first'), 'the first cast is recorded and earns its achievement');
  assert(toasts.some(t => t.includes('Công thức mới')), 'discovering a phrase for the first time is announced');
  assert(game.phrases.chain.length === 0, 'the chain starts over');

  // a miss breaks the chain
  stroke('caret');
  game.onGestureRecognized({ gesture: null, score: 0.1, candidate: null, reason: 'low_score' }, []);
  assert(game.phrases.chain.length === 0, 'a fizzled stroke breaks the chain');

  // other effects
  game.player.hp = game.player.maxHp - 1;
  game._castPhrase(getPhrase('moon_blessing'));
  assert(game.player.hp === game.player.maxHp, 'Phước Lành Trăng Khuyết heals a heart');
  const sc = game.score;
  game._castPhrase(getPhrase('moon_blessing'));
  assert(game.score === sc + 400, 'at full health it gives bonus points instead');
  game._castPhrase(getPhrase('aegis'));
  assert(game.player.isInvulnerable && game.player.invulnerableTimer >= 3.5, 'Khiên Hộ Mệnh makes Momo invulnerable');
  game._castPhrase(getPhrase('golden_hour'));
  assert(game.events.scoreMult === 2, 'Giờ Vàng doubles the score');
  game.enemies.length = 0;
  mk(['horizontal'], 500, 300);
  game._castPhrase(getPhrase('frost_echo'));
  assert(game.enemies.every(e => e.isFrozen), 'Dư Âm Băng Giá freezes every ghost');
  mk(['vertical'], 900, 300);
  const startX = game.enemies[1].x;
  game._castPhrase(getPhrase('gale_hymn'));
  assert(game.enemies[1].knockbackTimer > 0 || game.enemies[1].x !== startX, 'Khúc Hát Cuồng Phong pushes ghosts away');

  // --- cosmetics
  game.progress.unlock('daily_first');
  game._checkCosmetics(true);
  assert(toasts.some(t => t.includes('Phần thưởng mới')), 'a new cosmetic is announced');
  assert(game.setCosmetic('hat', 'party') && game.player.hat === 'party', 'equipping a hat puts it on Momo');
  assert(game.setCosmetic('hat', 'crown') === false && game.player.hat === 'party', 'a locked hat cannot be equipped');
  game.progress.data.stats.bestDailyStreak = 14;
  assert(game.setCosmetic('trail', 'rainbow') && game.inputHandler.trailStyle.id === 'rainbow', 'equipping a trail changes the ink');
  let rendered = true;
  try {
    game.player.render(anyCtx());
    game.inputHandler.currentPoints = [{ x: 0, y: 0 }, { x: 40, y: 10 }, { x: 90, y: 40 }];
    game.inputHandler.render(anyCtx());
    game.inputHandler.glow = false;
    game.inputHandler.render(anyCtx());
  } catch (e) { rendered = false; console.error(e); }
  assert(rendered, 'Momo with a hat and a rainbow trail render without errors');
  game.progress.data.cosmetics.hat = 'crown'; // saved game says "crown" but it was never earned
  game._applyCosmetics();
  assert(game.player.hat === 'none', 'an equipped but locked hat is ignored when the game starts');

  // --- Boss Rush
  game.progress = new ProgressStore(new MemoryStorage());
  game.startBossRush();
  assert(game.bossRush && game.waveSystem.gameMode === 'STORY' && game.waveSystem.bossRush, 'Boss Rush starts a Story run in rush mode');
  assert(game.waveSystem.totalEnemiesInWave === 0, 'with no minion phase');
  assert(game.events.plan.length === 0, 'and no surprises');
  let sawBoss = false;
  for (let i = 0; i < 160 && !sawBoss; i++) {
    game.stateMachine.update(0.05);
    sawBoss = game.enemies.some(e => e.isBoss);
  }
  assert(sawBoss, 'the first boss arrives after a short warning');

  game.score = 8000;
  game.metrics.maxCombo = 12;
  game.metrics.startTime = Date.now() - 200 * 1000;
  game.waveSystem.currentLevelIndex = 5;
  const summary = game.finishRun(true);
  assert(summary.bossRush === true && summary.rush && summary.rush.seconds >= 199, 'the recap knows it was a Boss Rush and how long it took');
  assert(game.progress.getRush().clears === 1 && game.progress.getRush().score === 8000, 'the clear is saved to the Boss Rush board');
  assert(summary.rush.isNewTime && summary.isNewHighScore, 'a first clear is a new record');
  assert(game.progress.getRecord('STORY', 'NORMAL').plays === 0, 'regular Story records are untouched');
  assert(!game.progress.isUnlocked('story_clear') && game.progress.isUnlocked('rush_clear') && game.progress.isUnlocked('rush_fast'), 'a Boss Rush clear is not a Story clear, but earns its own achievements');
  assert(!game.progress.isLevelCleared(1), 'rush does not unlock companions');
  game._onStageCleared(1);
  assert(!game.progress.isLevelCleared(1), '...even when a level is cleared during a rush');
  assert(Array.isArray(summary.cosmetics) && summary.cosmetics.some(c => c.id === 'horns'), 'the Boss Rush reward (devil horns) is listed in the recap');

  // The recap renders for a rush
  const html = [];
  game.uiManager.meta._html = (id, h) => html.push(h);
  game.uiManager.meta.renderRunSummary('go-summary', summary);
  assert(html.length === 1 && html[0].includes('Boss Rush') && html[0].includes('Phần thưởng mới'), 'the end-of-run recap mentions Boss Rush and the new reward');

  // leaving the run resets the flag; Daily / Endless are never a rush
  game.stateMachine.changeState(GAME_STATES.MENU);
  assert(game.bossRush === false, 'returning to the menu leaves Boss Rush');
  game.startBossRush();
  game.startDaily('2026-11-05');
  assert(game.bossRush === false && game.challenge, 'starting a Daily Challenge cancels Boss Rush');
  assert(game.events.seed !== null && game.waveSystem.seed === game.events.seed, 'Daily Challenge surprises use the daily seed');
  game.stateMachine.changeState(GAME_STATES.MENU);
  game.waveSystem.setMode('STORY');
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true });
  assert(game.waveSystem.bossRush === false && game.waveSystem.totalEnemiesInWave === 12, 'a normal Story run keeps its minion phase');

  // --- clip plumbing without MediaRecorder
  assert(game.highlight.supported === false, 'under Node there is no MediaRecorder, so no clip is attempted');
  game._collectHighlight();
  game.uiManager.meta.setClip(null);
  assert(true, 'finishing a run without a recorder is harmless');
  game.settings.set('highlight', false);
  assert(game._highlightAllowed() === false, 'the setting switches recording off');
}

console.log(`\n========================================`);
console.log(`Engagement Features Tests: ${passed} Passed, ${failed} Failed`);
console.log(`========================================`);
if (failed > 0) process.exit(1);
