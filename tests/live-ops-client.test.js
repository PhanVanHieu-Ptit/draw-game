/**
 * @file tests/live-ops-client.test.js
 * @description The game's side of Live Operations: LiveOpsService (download, strict validation, cache and offline
 * fallback, server-synchronised clock, flags, challenge and overlay resolution, run pinning, reward settlement),
 * the progress it persists (and how it distrusts a hand-edited save), the in-run hooks (surprise rate, effects), and
 * Game / MetaUI end to end on a fake DOM, including server-supplied text that must never become markup.
 */
import assert from 'node:assert/strict';
import { getDailyChallenge, dateKey, buildDailyChallengeUrl, parseDailyChallengeParams } from '../src/core/Challenge.js';
import { STORAGE_KEYS, GAME_STATES, RUNES } from '../src/core/Constants.js';
import { isCosmeticUnlocked, getCosmetic } from '../src/core/Cosmetics.js';
import { ProgressStore } from '../src/core/ProgressStore.js';
import {
  LiveOpsService, LIVEOPS_STORAGE, MIN_REFRESH_MS, mergedToModifier, formatRemaining, summarizeRules
} from '../src/core/LiveOps.js';
import { EventSystem } from '../src/systems/EventSystem.js';
import { LiveOpsEffects, MAX_PARTICLES } from '../src/systems/LiveOpsEffects.js';
import * as L from '../shared/live-ops/index.js';

let passed = 0;
const failures = [];
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  ❌ FAIL: ${name}\n     ${String(error && error.stack ? error.stack : error).split('\n').slice(0, 5).join('\n     ')}`);
  }
}
const section = (title) => console.log(`\n--- ${title} ---`);

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------------------

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
class BrokenStorage {
  getItem() { throw new Error('blocked'); }
  setItem() { throw new Error('blocked'); }
  removeItem() { throw new Error('blocked'); }
}

const URL_ = '/api/game-liveops/production';
const ENV = 'production';
const NOW = Date.parse('2026-11-14T08:00:00Z'); // a Saturday, ISO week 2026-W46
const MIN = 60 * 1000;
const HOUR = 3600 * 1000;
const SKEW = 20 * MIN; // the server's clock is ahead of the device's

const reward = (over) => ({ id: 'score-5k', type: 'badge', ref: '🏅', label: 'Five Thousand', condition: { metric: 'bestScore', threshold: 5000 }, ...over });
const dailyEvent = (key, over = {}) => L.createEventContent('daily', {
  id: `daily-${key}`, name: `Daily ${key}`, timeZone: 'UTC',
  schedule: { startLocal: `${key}T00:00`, endLocal: `${L.addDays(key, 1)}T00:00` }, ...over
});
const LIVE_DAILY = () => dailyEvent('2026-11-14', {
  description: 'Hearts are precious today.',
  rules: { scoreVersion: 2, seedSalt: 'nov', score: { multiplier: 1.5 }, player: { maxHp: 3 } },
  rewards: [
    reward(),
    reward({ id: 'frost-trail', type: 'cosmetic', ref: 'trail:frost', label: '', condition: { metric: 'runs', threshold: 1 } })
  ]
});
const WEEKLY = () => L.createEventContent('weekly', {
  id: 'weekly-2026-w46', name: 'Week 46', timeZone: 'UTC', schedule: { startLocal: '2026-11-09T00:00', endLocal: '2026-11-16T00:00' }
});
const SEASONAL = (over = {}) => L.createEventContent('seasonal', {
  id: 'frost-season', name: 'Frost Season', timeZone: 'Asia/Ho_Chi_Minh', schedule: { startLocal: '2026-11-10T00:00', endLocal: '2026-12-10T00:00' },
  eligibility: { modes: ['ENDLESS', 'STORY'] },
  announcement: { enabled: true, title: 'Frost is here', body: 'Snow falls on the academy.', leadHours: 24, tone: 'event' },
  rules: { scoreVersion: 2, enemy: { speedMultiplier: 0.9 }, score: { multiplier: 1.25 }, visual: { theme: 'frost', ambient: 'snow' } },
  rewards: [reward({ id: 'wave-5', ref: '❄️', label: 'Snow Walker', condition: { metric: 'bestWave', threshold: 5 } })],
  ...over
});
const RANDOM = (over = {}) => L.createEventContent('random', {
  id: 'blood-moon', name: 'Blood Moon', timeZone: 'UTC', schedule: { startLocal: '2026-11-14T07:00', endLocal: '2026-11-14T09:00' },
  eligibility: { modes: ['ENDLESS'] },
  announcement: { enabled: true, title: 'Blood Moon!', body: 'Ghosts are faster.', leadHours: 0, tone: 'urgent' },
  rules: { enemy: { noHearts: true }, spawn: { surpriseMultiplier: 2 }, visual: { theme: 'ember', ambient: 'embers' } },
  ...over
});
const UPCOMING = () => L.createEventContent('random', {
  id: 'meteor-night', name: 'Meteor Night', timeZone: 'UTC', schedule: { startLocal: '2026-11-16T19:00', endLocal: '2026-11-16T21:00' },
  announcement: { enabled: true, title: 'Meteors', body: 'Look up.', leadHours: 24, tone: 'info' }
});

function record(content, { status = 'scheduled', version = 1, scheduled = true } = {}) {
  const window = L.resolveEventWindow(content);
  assert.ok(window.ok, window.errors.join('; '));
  return {
    id: content.id, kind: content.kind, status, version, content,
    startsAt: window.startsAt, endsAt: window.endsAt, challengeKey: window.challengeKey,
    ...(scheduled ? { scheduledAt: '2026-11-01T00:00:00Z' } : {}),
    ...(status === 'cancelled' ? { cancelledAt: '2026-11-13T00:00:00Z' } : {})
  };
}
const baseRecords = () => [
  record(dailyEvent('2026-11-13')), record(LIVE_DAILY()), record(dailyEvent('2026-11-15')),
  record(WEEKLY()), record(SEASONAL()), record(RANDOM()), record(UPCOMING())
];
const workspace = (events = baseRecords(), flags = L.defaultFlags(), revision = 7) => ({ environment: ENV, revision, flags, events });

/** A device clock and a server whose clock runs SKEW ahead of it */
function rig({ events, flags, storage = new MemoryStorage(), skew = SKEW, deviceMs = NOW } = {}) {
  const device = { ms: deviceMs };
  const state = { ws: workspace(events, flags), mode: 'ok', calls: 0, revision: 7 };
  const payload = () => L.buildPublicPayload({ ...state.ws, revision: state.revision }, device.ms + skew);
  const fetcher = async () => {
    state.calls++;
    if (state.mode === 'down') throw new Error('offline');
    if (state.mode === '500') return { ok: false, status: 500, json: async () => ({}) };
    if (state.mode === 'badjson') return { ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } };
    const body = typeof state.mode === 'function' ? state.mode(payload()) : payload();
    return { ok: true, status: 200, json: async () => structuredClone(body) };
  };
  const make = (extra = {}) => new LiveOpsService({ storage, now: () => device.ms, fetcher, ...extra });
  return { device, state, storage, fetcher, make, service: make() };
}
async function online(options) {
  const r = rig(options);
  const result = await r.service.load(URL_, ENV);
  assert.equal(result.ok, true, JSON.stringify(result));
  return r;
}

const ENDLESS = { mode: 'ENDLESS', difficulty: 'NORMAL', assisted: false, storyLevelsCleared: 0 };
const dailyRun = (over = {}) => ({ mode: 'DAILY', difficulty: 'NORMAL', assisted: false, score: 6000, wave: 5, combo: 9, storyLevelsCleared: 0, ...over });

// ---------------------------------------------------------------------------------------------------------------------
section('Not configured: the game plays exactly as before');
// ---------------------------------------------------------------------------------------------------------------------

await test('without a URL nothing is requested and every answer is the built-in one', async () => {
  const r = rig();
  assert.equal(r.service.configure(undefined, ENV), false);
  assert.deepEqual(await r.service.refresh(), { ok: false, source: 'none', reason: 'not-configured' });
  assert.equal(r.service.configure(URL_, 'moon'), false, 'an unknown environment is not a deployment either');
  assert.equal(r.state.calls, 0);
  const daily = r.service.dailyChallenge();
  assert.deepEqual(daily, L.builtinChallenge(dateKey(new Date(NOW))));
  assert.equal(daily.source, 'builtin');
  assert.equal(r.service.weeklyChallenge(), null);
  assert.deepEqual(r.service.overlaysFor(ENDLESS), []);
  assert.deepEqual(r.service.announcements(), []);
  assert.deepEqual(r.service.schedule(), { live: [], upcoming: [], past: [] });
  assert.deepEqual(r.service.menuVisual(), { theme: 'none', ambient: 'none' });
  assert.equal(r.service.pinRun({ ...ENDLESS, challenge: null }), null);
  assert.deepEqual(r.service.settleRun({ pin: null, run: dailyRun(), progress: new ProgressStore(new MemoryStorage()) }), { events: [], granted: [] });
  assert.equal(r.service.status().configured, false);
  assert.equal(r.service.now(), NOW, 'with no schedule the clock is the device clock');
});

// ---------------------------------------------------------------------------------------------------------------------
section('Loading: strict, server-synchronised, never fatal');
// ---------------------------------------------------------------------------------------------------------------------

await test('a good payload is applied, the clock follows the server, and the schedule is cached', async () => {
  const { service, storage, device } = await online();
  assert.equal(service.source, 'network');
  assert.equal(service.clockTrusted, true);
  assert.equal(service.now(), NOW + SKEW, 'the schedule runs on server time, not the raw device clock');
  device.ms += 5 * MIN;
  assert.equal(service.now(), NOW + SKEW + 5 * MIN, 'and keeps ticking from there');
  const cached = JSON.parse(storage.getItem(LIVEOPS_STORAGE.CACHE));
  assert.equal(cached.v, 1);
  assert.equal(cached.environment, ENV);
  assert.equal(cached.offsetMs, SKEW);
  assert.equal(cached.payload.revision, 7);
  const status = service.status();
  assert.equal(status.enabled, true);
  assert.equal(status.source, 'network');
  assert.equal(status.clockTrusted, true);
});

await test('a device clock that is days wrong does not matter once synced', async () => {
  const { service } = await online({ deviceMs: NOW - 2 * 24 * HOUR, skew: 2 * 24 * HOUR + SKEW });
  assert.equal(service.now(), NOW + SKEW);
  assert.equal(service.dailyChallenge().eventId, 'daily-2026-11-14');
});

await test('every kind of bad answer is survived and leaves the built-in rotation in place', async () => {
  for (const mode of ['down', '500', 'badjson']) {
    const r = rig();
    r.state.mode = mode;
    const result = await r.service.load(URL_, ENV);
    assert.equal(result.ok, false, mode);
    assert.equal(r.service.source, 'none');
    assert.equal(r.service.dailyChallenge().source, 'builtin');
  }
});

await test('a payload that fails the contract is refused as a whole, whatever is wrong with it', async () => {
  const tamper = {
    'an extra top-level field': (p) => ({ ...p, admin: true }),
    'another environment': (p) => ({ ...p, environment: 'staging' }),
    'an unknown schema version': (p) => ({ ...p, schemaVersion: 99 }),
    'an unknown flag': (p) => ({ ...p, flags: { ...p.flags, 'liveops.backdoor': { enabled: true, rolloutPercent: 100 } } }),
    'an event with an unknown field': (p) => ({ ...p, events: p.events.map((e, i) => (i === 0 ? { ...e, secret: 1 } : e)) }),
    'a duplicate event id': (p) => ({ ...p, events: [...p.events, p.events[0]] }),
    'a reward for a cosmetic that is not in the wardrobe': (p) => ({
      ...p, events: p.events.map((e) => (e.id === 'daily-2026-11-14' ? { ...e, rewards: [{ ...e.rewards[1], ref: 'trail:nonexistent' }] } : e))
    }),
    'an offset in a timestamp': (p) => ({ ...p, serverTime: '2026-11-14T08:20:00+07:00' }),
    'an array instead of an object': () => []
  };
  for (const [what, fn] of Object.entries(tamper)) {
    const r = rig();
    r.state.mode = fn;
    const result = await r.service.load(URL_, ENV);
    assert.equal(result.ok, false, what);
    assert.equal(result.reason, 'invalid', what);
    assert.equal(r.service.payload, null, `${what}: nothing of it may be applied`);
    assert.equal(r.service.dailyChallenge().source, 'builtin', what);
  }
});

await test('a failed refresh keeps the schedule already held; a stale answer from a CDN is not accepted', async () => {
  const r = await online();
  r.device.ms += 2 * MIN;
  r.state.mode = '500';
  assert.equal((await r.service.refresh({ force: true })).ok, false);
  assert.equal(r.service.dailyChallenge().eventId, 'daily-2026-11-14', 'the schedule survives a failed refresh');
  assert.equal(r.service.lastError, 'network');
  // An answer built an hour in the past (a cache between the game and the server)
  const old = L.buildPublicPayload(workspace(), NOW - HOUR);
  r.state.mode = () => old;
  const stale = await r.service.refresh({ force: true });
  assert.deepEqual([stale.ok, stale.reason], [false, 'stale-response']);
  assert.equal(r.service.now(), NOW + SKEW + 2 * MIN, 'and its serverTime did not move the clock');
});

await test('refreshes are deduplicated while one is under way and throttled afterwards', async () => {
  const r = rig();
  r.service.configure(URL_, ENV);
  const [a, b] = await Promise.all([r.service.refresh(), r.service.refresh()]);
  assert.equal(r.state.calls, 1, 'two concurrent refreshes share one request');
  assert.deepEqual([a.ok, b.ok], [true, true]);
  const throttled = await r.service.refresh();
  assert.equal(throttled.reason, 'throttled');
  assert.equal(r.state.calls, 1);
  r.device.ms += MIN_REFRESH_MS;
  await r.service.refresh();
  assert.equal(r.state.calls, 2);
  await r.service.refresh({ force: true });
  assert.equal(r.state.calls, 3, 'force bypasses the throttle');
});

await test('listeners hear about a new schedule; a listener that throws cannot break the others', async () => {
  const r = rig();
  const heard = [];
  r.service.onChange(() => { throw new Error('bad listener'); });
  const off = r.service.onChange(() => heard.push(r.service.source));
  await r.service.load(URL_, ENV);
  assert.deepEqual(heard, ['network']);
  off();
  await r.service.refresh({ force: true });
  assert.deepEqual(heard, ['network'], 'unsubscribed');
});

// ---------------------------------------------------------------------------------------------------------------------
section('Offline fallback');
// ---------------------------------------------------------------------------------------------------------------------

await test('offline, the last schedule keeps working on the saved clock offset, but the clock is not trusted', async () => {
  const first = await online();
  const second = first.make();
  first.state.mode = 'down';
  first.device.ms += 10 * MIN; // later session, same device clock
  assert.equal(second.configure(URL_, ENV), true, 'the cache is restored synchronously, before any network answer');
  assert.equal(second.source, 'cache');
  assert.equal(second.clockTrusted, false);
  assert.equal(second.now(), NOW + SKEW + 10 * MIN);
  assert.equal(second.dailyChallenge().source, 'liveops', 'a scheduled challenge still plays offline');
  assert.equal(second.status().clockTrusted, false);
  assert.equal((await second.refresh()).ok, false);
  assert.equal(second.source, 'cache', 'a failed refresh keeps the cache');
});

await test('a cache older than the server allows, saved in the future, tampered with, or for another deployment is ignored', async () => {
  const first = await online();
  const raw = first.storage.getItem(LIVEOPS_STORAGE.CACHE);
  const fresh = () => {
    const service = first.make();
    return service;
  };
  const reload = (text) => { first.storage.setItem(LIVEOPS_STORAGE.CACHE, text); return fresh(); };

  first.device.ms = NOW + 25 * HOUR; // staleAfterSeconds is 24h
  assert.equal(fresh().configure(URL_, ENV), false, 'too old to act on');
  assert.equal(fresh().dailyChallenge().source, 'builtin');

  first.device.ms = NOW - 30 * MIN; // the device clock was moved back since
  assert.equal(fresh().configure(URL_, ENV), false, 'saved in the future');
  first.device.ms = NOW + MIN;

  const cached = JSON.parse(raw);
  const bad = structuredClone(cached);
  bad.payload.events[0].extra = true;
  assert.equal(reload(JSON.stringify(bad)).configure(URL_, ENV), false, 'a tampered cache is as untrusted as the network');
  assert.equal(reload(JSON.stringify({ ...cached, environment: 'staging' })).configure(URL_, ENV), false);
  assert.equal(reload(JSON.stringify({ ...cached, url: '/somewhere/else' })).configure(URL_, ENV), false);
  assert.equal(reload(JSON.stringify({ ...cached, offsetMs: 1e15 })).configure(URL_, ENV), false);
  assert.equal(reload('{not json').configure(URL_, ENV), false);
  assert.equal(reload(JSON.stringify({ v: 2 })).configure(URL_, ENV), false);
  assert.equal(reload(raw).configure(URL_, ENV), true, 'and the untouched original is fine');
});

await test('a session left open past the freshness window falls back to the built-in rotation', async () => {
  const r = await online();
  assert.equal(r.service.enabled, true);
  r.state.mode = 'down';
  r.device.ms += 25 * HOUR;
  assert.equal(r.service.enabled, false);
  assert.equal(r.service.status().stale, true);
  assert.equal(r.service.dailyChallenge().source, 'builtin');
  assert.equal(r.service.weeklyChallenge(), null);
  assert.deepEqual(r.service.overlaysFor(ENDLESS), []);
});

await test('blocked storage (private mode) never breaks anything', async () => {
  const r = rig({ storage: new BrokenStorage() });
  assert.equal(r.service.configure(URL_, ENV), false);
  assert.equal((await r.service.refresh({ force: true })).ok, true);
  assert.equal(r.service.dailyChallenge().source, 'liveops');
  assert.equal(r.service.flag('liveops.daily'), true, 'the install id falls back to memory');
  r.service.dismissAnnouncement('frost-season@1');
  assert.equal(r.service.announcements().some((a) => a.eventId === 'frost-season'), false, 'a dismissal still holds for the session');
});

// ---------------------------------------------------------------------------------------------------------------------
section('Daily and weekly challenges');
// ---------------------------------------------------------------------------------------------------------------------

await test('a live daily is the challenge: its own seed, rules, score version and leaderboard', async () => {
  const { service } = await online();
  const ch = service.dailyChallenge();
  assert.equal(ch.source, 'liveops');
  assert.equal(ch.eventId, 'daily-2026-11-14');
  assert.equal(ch.key, '2026-11-14');
  assert.equal(ch.seed, L.deriveSeed({ kind: 'daily', key: '2026-11-14', salt: 'nov' }));
  assert.notEqual(ch.seed, getDailyChallenge('2026-11-14').seed, 'a salt re-rolls the sequence');
  assert.equal(ch.difficulty, 'NORMAL');
  assert.equal(ch.modifier.maxHp, 3);
  assert.equal(ch.scoreMultiplier, 1.5);
  assert.equal(ch.boardId, 'daily:2026-11-14:r1:s2');
  assert.equal(service.isCurrentChallenge(ch), true);
});

await test('with nothing live, a cancelled event, or the flag off, the daily is the built-in one', async () => {
  const noToday = baseRecords().filter((r) => r.id !== 'daily-2026-11-14');
  const a = await online({ events: noToday });
  assert.equal(a.service.dailyChallenge().source, 'builtin');
  assert.equal(a.service.dailyChallenge().seed, getDailyChallenge('2026-11-14').seed, 'the same ghosts the built-in rotation always dealt');

  const cancelled = baseRecords().map((r) => (r.id === 'daily-2026-11-14' ? { ...r, status: 'cancelled' } : r));
  assert.equal((await online({ events: cancelled })).service.dailyChallenge().source, 'builtin');

  const flags = L.defaultFlags();
  flags['liveops.daily'] = { enabled: false, rolloutPercent: 100 };
  const off = await online({ flags });
  assert.equal(off.service.dailyChallenge().source, 'builtin');
  assert.equal(off.service.weeklyChallenge().kind, 'weekly', 'other kinds are unaffected');
});

await test("a friend's link for another day: a published event of that day, otherwise the built-in challenge of the date", async () => {
  const { service } = await online();
  const yesterday = service.dailyChallenge('2026-11-13');
  assert.equal(yesterday.source, 'liveops', 'yesterday is published as completed');
  assert.equal(yesterday.key, '2026-11-13');
  assert.equal(service.isCurrentChallenge(yesterday), false, 'an old day is playable but not ranked');
  assert.equal(service.dailyChallenge('2026-11-15').source, 'builtin', 'tomorrow is not live yet');
  const old = service.dailyChallenge('2026-10-01');
  assert.equal(old.source, 'builtin');
  assert.equal(old.key, '2026-10-01');
  assert.equal(service.isCurrentChallenge(old), false);
});

await test('the built-in daily is current only for the UTC date of the schedule clock', async () => {
  const noToday = baseRecords().filter((r) => r.id !== 'daily-2026-11-14');
  const { service, device } = await online({ events: noToday });
  const today = service.dailyChallenge();
  assert.equal(service.isCurrentChallenge(today), true);
  device.ms += 20 * HOUR; // past midnight UTC on the server clock
  assert.equal(service.isCurrentChallenge(today), false);
  assert.equal(service.dailyChallenge().key, '2026-11-15');
});

await test('the weekly challenge is the live weekly event (there is no built-in one)', async () => {
  const { service } = await online();
  const weekly = service.weeklyChallenge();
  assert.equal(weekly.kind, 'weekly');
  assert.equal(weekly.key, '2026-W46');
  assert.equal(weekly.seed, L.deriveSeed({ kind: 'weekly', key: '2026-W46' }));
  assert.equal(weekly.boardId, 'weekly:2026-W46:r1:s1');
  assert.equal(service.isCurrentChallenge(weekly), true);
  const none = await online({ events: baseRecords().filter((r) => r.kind !== 'weekly') });
  assert.equal(none.service.weeklyChallenge(), null);
  const flags = L.defaultFlags();
  flags['liveops.weekly'] = { enabled: false, rolloutPercent: 100 };
  assert.equal((await online({ flags })).service.weeklyChallenge(), null);
});

// ---------------------------------------------------------------------------------------------------------------------
section('Seasonal and random events: overlays and the pinned run');
// ---------------------------------------------------------------------------------------------------------------------

await test('an ordinary Endless run takes the seasonal event first, then the random one, and merges their rules', async () => {
  const { service } = await online();
  assert.deepEqual(service.overlaysFor(ENDLESS).map((e) => e.id), ['frost-season', 'blood-moon']);
  const pin = service.pinRun({ ...ENDLESS, challenge: null });
  assert.deepEqual(pin.entries.map((e) => e.eventId), ['frost-season', 'blood-moon']);
  assert.equal(pin.modifier.speed, 0.9);
  assert.equal(pin.modifier.noHearts, true);
  assert.equal('runes' in pin.modifier, false, 'no rune restriction means no key (an empty list would mean "nothing")');
  assert.equal(pin.surpriseMultiplier, 2);
  assert.equal(pin.scoreMultiplier, 1.25);
  assert.deepEqual(pin.visual, { theme: 'frost', ambient: 'snow' }, 'the higher-priority event sets the look');
  assert.equal(pin.startedMs, NOW + SKEW);
  assert.equal(pin.trusted, true);
  assert.equal(pin.entries[0].version, 1);
});

await test('a Story run takes only looks and rewards: story fights are authored', async () => {
  const { service } = await online();
  assert.deepEqual(service.overlaysFor({ ...ENDLESS, mode: 'STORY' }).map((e) => e.id), ['frost-season'], 'the random event is Endless-only');
  const pin = service.pinRun({ ...ENDLESS, mode: 'STORY', challenge: null });
  assert.equal(pin.modifier, null);
  assert.equal(pin.surpriseMultiplier, 1);
  assert.equal(pin.scoreMultiplier, 1);
  assert.equal(pin.visual.theme, 'frost');
  assert.equal(pin.entries.length, 1, 'rewards still count');
});

await test('a challenge run is governed by its own event only; the built-in challenge is not pinned at all', async () => {
  const { service } = await online();
  const pin = service.pinRun({ mode: 'DAILY', difficulty: 'NORMAL', assisted: false, storyLevelsCleared: 0, challenge: service.dailyChallenge() });
  assert.deepEqual(pin.entries.map((e) => e.eventId), ['daily-2026-11-14'], 'overlays never touch a challenge');
  assert.equal(pin.modifier, null, 'its rules reach WaveSystem through challenge.modifier');
  assert.equal(pin.scoreMultiplier, 1.5);
  assert.equal(service.pinRun({ mode: 'DAILY', difficulty: 'NORMAL', assisted: false, storyLevelsCleared: 0, challenge: L.builtinChallenge('2026-11-14') }), null);
});

await test('eligibility decides: an assisted run, a locked-out difficulty or missing story progress gets no overlay', async () => {
  const gated = SEASONAL({ eligibility: { modes: ['ENDLESS'], difficulties: ['HARDCORE'], minStoryLevelsCleared: 2, allowAssisted: false } });
  const { service } = await online({ events: [record(gated)] });
  assert.deepEqual(service.overlaysFor({ ...ENDLESS, difficulty: 'HARDCORE', storyLevelsCleared: 2 }).map((e) => e.id), ['frost-season']);
  assert.deepEqual(service.overlaysFor({ ...ENDLESS, difficulty: 'NORMAL', storyLevelsCleared: 2 }), []);
  assert.deepEqual(service.overlaysFor({ ...ENDLESS, difficulty: 'HARDCORE', storyLevelsCleared: 1 }), []);
  assert.deepEqual(service.overlaysFor({ ...ENDLESS, difficulty: 'HARDCORE', storyLevelsCleared: 2, assisted: true }), []);
  assert.equal(service.pinRun({ ...ENDLESS, assisted: true, challenge: null }), null);
});

await test('mergedToModifier: only what changes the run appears, restrictions intersect, extremes are clamped', () => {
  const rules = (over = {}) => L.createEventContent('seasonal', { rules: over }).rules;
  const names = [{ name: 'A' }, { name: 'B' }];
  const merged = L.mergeRules([rules({ enemy: { runes: ['horizontal', 'vertical'] } }), rules({ enemy: { runes: ['horizontal'] } })]);
  assert.deepEqual(mergedToModifier(merged, names).runes, ['horizontal']);
  assert.equal(mergedToModifier(merged, names).name, 'A + B');
  const none = L.mergeRules([rules({ enemy: { runes: ['horizontal'] } }), rules({ enemy: { runes: ['vertical'] } })]);
  assert.equal(none.conflict, true);
  assert.equal(mergedToModifier(none, names), null, 'a restriction with no gesture left is dropped, never applied');
  const fast = L.mergeRules([rules({ enemy: { speedMultiplier: 2 } }), rules({ enemy: { speedMultiplier: 2 } }), rules({ enemy: { speedMultiplier: 2 } })]);
  assert.equal(mergedToModifier(fast, names).speed, L.SAFE_LIMITS.speed[1]);
  assert.equal(mergedToModifier(L.mergeRules([rules({ visual: { theme: 'gold' } })]), names), null, 'a visual-only event changes nothing about the fight');
  assert.equal(mergedToModifier(L.mergeRules([rules({ player: { maxHp: 4 } }), rules({ player: { maxHp: 3 } })]), names).maxHp, 3);
});

// ---------------------------------------------------------------------------------------------------------------------
section('Feature flags');
// ---------------------------------------------------------------------------------------------------------------------

const flagsWith = (patch) => {
  const flags = L.defaultFlags();
  for (const [key, value] of Object.entries(patch)) flags[key] = { ...flags[key], ...value };
  return flags;
};

await test('the master switch turns every live-ops answer into the built-in one', async () => {
  const { service } = await online({ flags: flagsWith({ 'liveops.enabled': { enabled: false } }) });
  assert.equal(service.enabled, false);
  assert.equal(service.dailyChallenge().source, 'builtin');
  assert.equal(service.weeklyChallenge(), null);
  assert.deepEqual(service.overlaysFor(ENDLESS), []);
  assert.deepEqual(service.announcements(), []);
  assert.deepEqual(service.schedule(), { live: [], upcoming: [], past: [] });
  assert.equal(service.flag('liveops.daily'), false);
  assert.equal(service.pinRun({ ...ENDLESS, challenge: null }), null);
});

await test('per-kind, announcement and effects flags each switch off only their own part', async () => {
  const noRandom = (await online({ flags: flagsWith({ 'liveops.random': { enabled: false } }) })).service;
  assert.deepEqual(noRandom.overlaysFor(ENDLESS).map((e) => e.id), ['frost-season']);
  assert.equal(noRandom.schedule().live.some((i) => i.event.id === 'blood-moon'), false);

  const noSeasonal = (await online({ flags: flagsWith({ 'liveops.seasonal': { enabled: false } }) })).service;
  assert.deepEqual(noSeasonal.overlaysFor(ENDLESS).map((e) => e.id), ['blood-moon']);

  const noAnnounce = (await online({ flags: flagsWith({ 'liveops.announcements': { enabled: false } }) })).service;
  assert.deepEqual(noAnnounce.announcements(), []);
  assert.equal(noAnnounce.overlaysFor(ENDLESS).length, 2);

  const noEffects = (await online({ flags: flagsWith({ 'liveops.effects': { enabled: false } }) })).service;
  assert.deepEqual(noEffects.menuVisual(), { theme: 'none', ambient: 'none' });
  const pin = noEffects.pinRun({ ...ENDLESS, challenge: null });
  assert.deepEqual(pin.visual, { theme: 'none', ambient: 'none' });
  assert.equal(pin.modifier.speed, 0.9, 'the rules stay: only the look is off');
});

await test('rollout is per install and stable: the same install always lands on the same side', async () => {
  const flags = flagsWith({ 'liveops.seasonal': { enabled: true, rolloutPercent: 50 } });
  const ids = Array.from({ length: 40 }, (_, i) => `install-${String(i).padStart(4, '0')}`);
  const inside = ids.find((id) => L.rolloutBucket(id, 'liveops.seasonal') < 50);
  const outside = ids.find((id) => L.rolloutBucket(id, 'liveops.seasonal') >= 50);
  assert.ok(inside && outside);
  for (const [id, expected] of [[inside, true], [outside, false]]) {
    const storage = new MemoryStorage();
    storage.setItem(LIVEOPS_STORAGE.INSTALL, id);
    const { service } = await online({ flags, storage });
    assert.equal(service.flag('liveops.seasonal'), expected, id);
    assert.equal(service.flag('liveops.seasonal'), expected, 'and again');
    assert.equal(service.overlaysFor(ENDLESS).some((e) => e.id === 'frost-season'), expected);
  }
  const fresh = new MemoryStorage();
  const { service } = await online({ storage: fresh });
  service.flag('liveops.daily');
  assert.match(fresh.getItem(LIVEOPS_STORAGE.INSTALL), /^[A-Za-z0-9-]{8,64}$/, 'an install id is created once and kept');
});

// ---------------------------------------------------------------------------------------------------------------------
section('Announcements, schedule and history');
// ---------------------------------------------------------------------------------------------------------------------

await test('announcements run from the lead time until the event ends: urgent first, running before upcoming', async () => {
  const { service, device } = await online();
  assert.deepEqual(service.announcements().map((a) => [a.eventId, a.phase, a.tone]), [['blood-moon', 'live', 'urgent'], ['frost-season', 'live', 'event']]);
  assert.equal(service.announcements().some((a) => a.eventId === 'meteor-night'), false, 'its lead time (24h) has not started');
  device.ms = Date.parse('2026-11-15T20:00:00Z') - SKEW; // a day and a half later: the game has asked the server again
  await service.refresh({ force: true });
  const tomorrow = service.announcements();
  assert.deepEqual(tomorrow.map((a) => [a.eventId, a.phase]), [['frost-season', 'live'], ['meteor-night', 'upcoming']], 'blood-moon is over; meteor-night is within 24h');
});

await test('a dismissed announcement stays dismissed across sessions, and returns when the event changes version', async () => {
  const first = await online();
  const key = first.service.announcements()[0].key;
  first.service.dismissAnnouncement(key);
  assert.equal(first.service.announcements().some((a) => a.key === key), false);
  assert.equal(first.service.announcements({ includeDismissed: true }).some((a) => a.key === key), true);
  const second = first.make();
  second.configure(URL_, ENV);
  assert.equal(second.announcements().some((a) => a.key === key), false, 'remembered in storage');
  // The admin edits the event: version 2 is news again
  const bumped = baseRecords().map((r) => (r.id === 'blood-moon' ? { ...r, version: 2 } : r));
  first.state.ws = workspace(bumped);
  first.device.ms += MIN_REFRESH_MS;
  await first.service.refresh();
  assert.equal(first.service.announcements().some((a) => a.key === 'blood-moon@2'), true);
  first.service.dismissAnnouncement({}); // junk is ignored
});

await test('a cancelled event is announced no more and is listed in the history, marked as cancelled', async () => {
  const records = baseRecords().map((r) => (r.id === 'blood-moon' ? { ...r, status: 'cancelled' } : r));
  const { service } = await online({ events: records });
  assert.equal(service.announcements().some((a) => a.eventId === 'blood-moon'), false);
  assert.deepEqual(service.overlaysFor(ENDLESS).map((e) => e.id), ['frost-season'], 'and it no longer changes runs');
  const past = service.schedule().past.find((i) => i.event.id === 'blood-moon');
  assert.equal(past.cancelled, true);
});

await test('the schedule groups events by where they are on the schedule clock', async () => {
  const { service } = await online();
  const s = service.schedule();
  const ids = (list) => list.map((i) => i.event.id);
  assert.deepEqual(ids(s.live), ['blood-moon', 'daily-2026-11-14', 'weekly-2026-w46', 'frost-season'], 'soonest ending first');
  assert.deepEqual(ids(s.upcoming), ['daily-2026-11-15', 'meteor-night'], 'soonest starting first');
  assert.deepEqual(ids(s.past), ['daily-2026-11-13']);
});

// ---------------------------------------------------------------------------------------------------------------------
section('Rewards: progress, claims, idempotency');
// ---------------------------------------------------------------------------------------------------------------------

const progressStore = () => new ProgressStore(new MemoryStorage());
const pinDaily = (service) => service.pinRun({ mode: 'DAILY', difficulty: 'NORMAL', assisted: false, storyLevelsCleared: 0, challenge: service.dailyChallenge() });

await test('a run that meets the conditions earns the rewards once; a cosmetic reward unlocks its wardrobe item', async () => {
  const { service } = await online();
  const progress = progressStore();
  const frost = getCosmetic('trail', 'frost');
  assert.equal(isCosmeticUnlocked(frost, progress), false);
  const pin = pinDaily(service);
  const settled = service.settleRun({ pin, run: dailyRun(), progress });
  assert.equal(settled.events[0].counted, true);
  assert.deepEqual(settled.granted.map((g) => g.rewardId).sort(), ['frost-trail', 'score-5k']);
  assert.equal(settled.granted.find((g) => g.rewardId === 'score-5k').label, 'Five Thousand');
  assert.equal(progress.hasEventCosmetic('trail:frost'), true);
  assert.equal(isCosmeticUnlocked(frost, progress), true, 'owned through the event, though its own achievement is not earned');
  assert.equal(progress.eventRewards().length, 2);
  assert.deepEqual(progress.getEventProgress('daily-2026-11-14', 1), { runs: 1, bestScore: 6000, bestWave: 5, bestCombo: 9 });
  assert.equal(progress.getEventProgress('daily-2026-11-14', 2).runs, 0, 'progress belongs to one version of the rules');

  // The same pin, settled again, counts nothing; and a second run earns nothing new
  assert.deepEqual(service.settleRun({ pin, run: dailyRun(), progress }), { events: [], granted: [] });
  const again = service.settleRun({ pin: pinDaily(service), run: dailyRun({ score: 9000 }), progress });
  assert.deepEqual(again.granted, []);
  assert.equal(progress.getEventProgress('daily-2026-11-14', 1).runs, 2);
  assert.equal(progress.getEventProgress('daily-2026-11-14', 1).bestScore, 9000);
});

await test('rewards come when the threshold is reached, not before, and progress accumulates', async () => {
  const { service } = await online();
  const progress = progressStore();
  const first = service.settleRun({ pin: pinDaily(service), run: dailyRun({ score: 4000 }), progress });
  assert.deepEqual(first.granted.map((g) => g.rewardId), ['frost-trail'], 'the 5000-point badge is not earned at 4000');
  const second = service.settleRun({ pin: pinDaily(service), run: dailyRun({ score: 5000 }), progress });
  assert.deepEqual(second.granted.map((g) => g.rewardId), ['score-5k']);
  assert.deepEqual(progress.grantedRewardKeys('daily-2026-11-14'), { 'frost-trail': true, 'score-5k': true });
});

await test('a seasonal reward is earned on a Story run too (bestWave counts the story level)', async () => {
  const { service } = await online();
  const progress = progressStore();
  const pin = service.pinRun({ ...ENDLESS, mode: 'STORY', challenge: null });
  const settled = service.settleRun({ pin, run: { ...ENDLESS, mode: 'STORY', score: 300, wave: 5, combo: 3 }, progress });
  assert.deepEqual(settled.granted.map((g) => g.rewardId), ['wave-5']);
  assert.equal(progress.eventRewards()[0].eventName, 'Frost Season');
});

await test('an assisted run, a changed version, a late claim, a disabled rewards flag and impossible numbers are refused, and a refused run does not count', async () => {
  const progress = progressStore();
  const refused = async (setup, expected, runOver = {}) => {
    const r = await online();
    const pin = pinDaily(r.service);
    await setup(r);
    const settled = r.service.settleRun({ pin, run: dailyRun(runOver), progress });
    assert.equal(settled.events[0].counted, false, expected);
    assert.ok(settled.events[0].reasons.includes(expected), `${expected} in ${settled.events[0].reasons}`);
    assert.deepEqual(settled.granted, []);
    return r;
  };
  await refused(() => {}, 'not-eligible:assisted', { assisted: true });
  await refused((r) => { r.service.payload.events = r.service.payload.events.map((e) => (e.id === 'daily-2026-11-14' ? { ...e, version: 2 } : e)); }, 'version-mismatch');
  await refused((r) => { r.device.ms = Date.parse('2026-11-15T00:11:00Z') - SKEW; }, 'outside-window'); // 11 minutes after the end (grace is 10)
  await refused((r) => { r.service.payload.flags['liveops.rewards'] = { enabled: false, rolloutPercent: 100 }; }, 'rewards-disabled');
  await refused(() => {}, 'out-of-range', { score: -5 });
  await refused(() => {}, 'out-of-range', { wave: 1e9 });
  assert.deepEqual(progress.getEventProgress('daily-2026-11-14'), { runs: 0, bestScore: 0, bestWave: 0, bestCombo: 0 });
  assert.equal(progress.eventRewards().length, 0);
});

await test('a claim made after cancellation is refused (the server said so)', async () => {
  const r = await online();
  const pin = pinDaily(r.service);
  r.state.ws = workspace(baseRecords().map((e) => (e.id === 'daily-2026-11-14' ? { ...e, status: 'cancelled' } : e)));
  r.device.ms += MIN_REFRESH_MS;
  await r.service.refresh({ force: true });
  const settled = r.service.settleRun({ pin, run: dailyRun(), progress: progressStore() });
  assert.ok(settled.events[0].reasons.includes('cancelled') || settled.events[0].reasons.includes('unknown-event'), settled.events[0].reasons.join());
  assert.equal(settled.granted.length, 0);
});

await test('a claim within the grace period after the end is honoured, a later one is not', async () => {
  const r = await online();
  const pin = pinDaily(r.service);
  const progress = progressStore();
  r.device.ms = Date.parse('2026-11-15T00:09:00Z') - SKEW;
  assert.equal(r.service.settleRun({ pin, run: dailyRun(), progress }).events[0].counted, true, '9 minutes after the end (grace is 10)');
  const late = { ...pin, settled: false }; // the same run, claimed again too late
  r.device.ms = Date.parse('2026-11-15T00:11:00Z') - SKEW;
  const refused = r.service.settleRun({ pin: late, run: dailyRun(), progress });
  assert.ok(refused.events[0].reasons.includes('outside-window'));
});

await test('offline there is no reward: the clock was not confirmed by the server in this session', async () => {
  const first = await online();
  const offline = first.make();
  first.state.mode = 'down';
  offline.configure(URL_, ENV);
  const pin = pinDaily(offline);
  assert.equal(pin.trusted, false);
  const progress = progressStore();
  const settled = offline.settleRun({ pin, run: dailyRun(), progress });
  assert.ok(settled.events[0].reasons.includes('untrusted-clock'));
  assert.equal(progress.eventRewards().length, 0);
  assert.equal(progress.getEventProgress('daily-2026-11-14').runs, 0);
  // Back online in the same session, the next run counts
  first.state.mode = 'ok';
  first.device.ms += MIN_REFRESH_MS;
  await offline.refresh({ force: true });
  assert.equal(offline.settleRun({ pin: pinDaily(offline), run: dailyRun(), progress }).events[0].counted, true);
});

await test('a run pinned while the clock was untrusted stays untrusted even if the server answers before it ends', async () => {
  const first = await online();
  const offline = first.make();
  first.state.mode = 'down';
  offline.configure(URL_, ENV);
  const pin = pinDaily(offline);
  first.state.mode = 'ok';
  first.device.ms += MIN_REFRESH_MS;
  await offline.refresh({ force: true });
  const settled = offline.settleRun({ pin, run: dailyRun(), progress: progressStore() });
  assert.ok(settled.events[0].reasons.includes('untrusted-clock'));
});

// ---------------------------------------------------------------------------------------------------------------------
section('ProgressStore: live-ops state survives, and distrusts an edited save');
// ---------------------------------------------------------------------------------------------------------------------

await test('event progress, rewards and boards are saved and read back', () => {
  const storage = new MemoryStorage();
  const a = new ProgressStore(storage);
  a.applyEventRun('frost-season', 3, { score: 1200, wave: 6, combo: 7, assisted: false }, 1000);
  a.grantEventReward({ eventId: 'frost-season', rewardId: 'wave-5', type: 'badge', ref: '❄️', label: 'Snow Walker', eventName: 'Frost Season' }, 2000);
  a.grantEventReward({ eventId: 'frost-season', rewardId: 'hat', type: 'cosmetic', ref: 'hat:crown', label: '' }, 3000);
  a.recordBoard('daily:2026-11-14:r1:s2', { score: 800, wave: 4, combo: 6 }, 4000);
  assert.equal(a.save(), true);
  const b = new ProgressStore(storage);
  assert.deepEqual(b.getEventProgress('frost-season', 3), { runs: 1, bestScore: 1200, bestWave: 6, bestCombo: 7 });
  assert.equal(b.eventRewards().length, 2);
  assert.equal(b.hasEventCosmetic('hat:crown'), true);
  assert.equal(b.getBoard('daily:2026-11-14:r1:s2').score, 800);
});

await test('a rewards grant is idempotent, and only real wardrobe cosmetics can be granted', () => {
  const p = progressStore();
  const g = { eventId: 'frost-season', rewardId: 'trail', type: 'cosmetic', ref: 'trail:frost', label: '' };
  assert.equal(p.grantEventReward(g), true);
  assert.equal(p.grantEventReward(g), false);
  assert.equal(p.grantEventReward({ ...g, rewardId: 'other', ref: 'trail:arcane' }), false, 'a default cosmetic is not a reward');
  assert.equal(p.grantEventReward({ ...g, rewardId: 'made-up', ref: 'hat:godmode' }), false);
  assert.equal(p.grantEventReward({ ...g, eventId: '../x', rewardId: 'x1' }), false);
  assert.equal(p.grantEventReward({ ...g, rewardId: 'weird', type: 'cash' }), false);
  assert.equal(p.eventRewards().length, 1);
});

await test('a hand-edited save cannot invent rewards, ids, boards or absurd numbers', () => {
  const storage = new MemoryStorage();
  const original = new ProgressStore(storage);
  original.save();
  const edited = JSON.parse(storage.getItem(STORAGE_KEYS.PROGRESS));
  edited.liveops = {
    events: {
      'ok-event': { version: 2, runs: 3, bestScore: 1e15, bestWave: -4, bestCombo: 'many', at: 5 },
      '../escape': { version: 1, runs: 1 },
      'x': { version: 1 }
    },
    granted: {
      'e-one:badge-one': { eventId: 'e-one', rewardId: 'badge-one', type: 'badge', ref: '⭐', label: 'Star', at: 1 },
      'e-one:default-trail': { eventId: 'e-one', rewardId: 'default-trail', type: 'cosmetic', ref: 'trail:arcane', label: '', at: 1 },
      'e-one:fake-hat': { eventId: 'e-one', rewardId: 'fake-hat', type: 'cosmetic', ref: 'hat:godmode', label: '', at: 1 },
      'e-one:nameless': { eventId: 'e-one', rewardId: 'nameless', type: 'badge', ref: '⭐', label: '   ', at: 1 },
      'mismatch': { eventId: 'e-one', rewardId: 'other-id', type: 'badge', ref: '⭐', label: 'Star', at: 1 },
      'e-one:long-icon': { eventId: 'e-one', rewardId: 'long-icon', type: 'badge', ref: '123456789', label: 'Star', at: 1 },
      'e-one:good-hat': { eventId: 'e-one', rewardId: 'good-hat', type: 'cosmetic', ref: 'hat:crown', label: '', at: 2 }
    },
    boards: {
      'daily:2026-11-14:r1:s2': { score: 5, wave: 1, combo: 1, plays: 0, at: 1 },
      'daily:not-a-board': { score: 5 },
      'weekly:2026-W46:r2:s1': { score: 1e15, wave: 3, combo: 2, plays: 1, at: 1 }
    }
  };
  storage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(edited));
  const p = new ProgressStore(storage);
  assert.deepEqual(Object.keys(p.data.liveops.events), ['ok-event']);
  assert.equal(p.data.liveops.events['ok-event'].bestScore, L.RUN_CAPS.score, 'absurd scores are clamped');
  assert.equal(p.data.liveops.events['ok-event'].bestWave, 0);
  assert.equal(p.data.liveops.events['ok-event'].bestCombo, 0);
  assert.deepEqual(p.eventRewards().map((g) => g.rewardId).sort(), ['badge-one', 'good-hat']);
  assert.deepEqual(Object.keys(p.data.liveops.boards).sort(), ['daily:2026-11-14:r1:s2', 'weekly:2026-W46:r2:s1']);
  assert.equal(p.getBoard('weekly:2026-W46:r2:s1').score, L.RUN_CAPS.score);
  assert.equal(p.data.liveops.boards['daily:2026-11-14:r1:s2'].plays, 1);
  // Garbage of the wrong shape altogether
  for (const junk of [null, 5, 'x', [], { events: 5, granted: [], boards: 'x' }]) {
    edited.liveops = junk;
    storage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(edited));
    assert.doesNotThrow(() => new ProgressStore(storage));
  }
});

await test('leaderboards are per (challenge, rules version, score version); the best score of each is kept', () => {
  const p = progressStore();
  const v1 = 'daily:2026-11-14:r1:s2';
  const v2 = 'daily:2026-11-14:r2:s2';
  assert.equal(p.recordBoard(v1, { score: 500, wave: 3, combo: 4 }, 1).isNewBest, true);
  const worse = p.recordBoard(v1, { score: 300, wave: 9, combo: 2 }, 2);
  assert.deepEqual([worse.isNewBest, worse.previous, worse.record.score, worse.record.wave, worse.record.plays], [false, 500, 500, 9, 2]);
  assert.equal(p.recordBoard(v2, { score: 100, wave: 1, combo: 1 }, 3).previous, 0, 'new rules, a fresh board: scores are never mixed');
  assert.equal(p.recordBoard('daily:2026-11-14', { score: 1 }).record, null);
  assert.deepEqual(p.boardHistory(5).map((b) => b.boardId), [v2, v1], 'newest first');
  assert.equal(L.isBoardCompatible(v1, v2), false);
});

await test('the save stays bounded: the oldest event entries, rewards and boards are dropped first', () => {
  const p = progressStore();
  for (let i = 0; i < 320; i++) p.grantEventReward({ eventId: `evt-${i}`, rewardId: 'r-one', type: 'badge', ref: '⭐', label: 'Star' }, i + 1);
  assert.equal(p.eventRewards().length, 300);
  assert.equal(p.eventRewards()[0].eventId, 'evt-319');
  assert.equal(p.data.liveops.granted['evt-0:r-one'], undefined);
  for (let i = 0; i < 70; i++) p.applyEventRun(`evt-${i}`, 1, { score: 1, wave: 1, combo: 1 }, i + 1);
  assert.equal(Object.keys(p.data.liveops.events).length, 60);
  for (let i = 1; i <= 130; i++) p.recordBoard(`daily:2026-11-${String((i % 28) + 1).padStart(2, '0')}:r${i}:s1`, { score: 1, wave: 1, combo: 1 }, i);
  assert.equal(Object.keys(p.data.liveops.boards).length, 120);
});

// ---------------------------------------------------------------------------------------------------------------------
section('Share links carry the leaderboard');
// ---------------------------------------------------------------------------------------------------------------------

await test('a challenge link names its board; a malformed board is dropped; old links still read', () => {
  const board = 'daily:2026-11-14:r3:s2';
  const url = buildDailyChallengeUrl('https://example.test/play/', '2026-11-14', 1234, 'Momo', board);
  assert.equal(new URL(url).searchParams.get('board'), board);
  const parsed = parseDailyChallengeParams(new URL(url).search);
  assert.deepEqual(parsed, { key: '2026-11-14', score: 1234, from: 'Momo', board });
  assert.equal(parseDailyChallengeParams('?daily=2026-11-14&score=5&board=<script>').board, '', 'markup is not a board id');
  assert.equal(parseDailyChallengeParams('?daily=2026-11-14&score=5&board=weekly:2026-W46:r1:s1').board, 'weekly:2026-W46:r1:s1');
  assert.equal(parseDailyChallengeParams('?daily=2026-11-14&score=5').board, '', 'a link with no board is a link from the built-in rotation');
  assert.equal(buildDailyChallengeUrl('https://example.test/', '2026-11-14', 5, 'Momo'), 'https://example.test/?daily=2026-11-14&score=5&from=Momo', 'no board, no change to the old format');
  assert.equal(buildDailyChallengeUrl('https://example.test/', '2026-11-14', 5, 'Momo', 'junk').includes('board'), false);
});

// ---------------------------------------------------------------------------------------------------------------------
section('In-run hooks: surprise rate and visual effects');
// ---------------------------------------------------------------------------------------------------------------------

await test('the surprise rate scales how often surprises are scheduled and stays deterministic per (seed, scale)', () => {
  const plans = (scale, seed = 1234) => {
    const events = new EventSystem();
    events.setSeed(seed);
    events.setSurpriseScale(scale);
    const out = [];
    for (let wave = 2; wave < 202; wave++) {
      events.startWave(wave, { enabled: true });
      out.push(events.plan.map((p) => p.kind));
    }
    return out;
  };
  assert.equal(new EventSystem().surpriseScale, 1);
  const total = (list) => list.reduce((n, p) => n + p.length, 0);
  assert.equal(total(plans(0)), 0, 'scale 0 means no surprises at all');
  assert.ok(plans(3).every((p) => p.length === 2), 'a scale that pushes both chances to certainty always schedules two');
  assert.ok(total(plans(2)) > total(plans(1)) && total(plans(1)) > total(plans(0.5)));
  assert.deepEqual(plans(2), plans(2), 'same seed, same scale: same surprises for everyone');
  assert.notDeepEqual(plans(2), plans(2, 99));
  const events = new EventSystem();
  events.setSurpriseScale(NaN);
  assert.equal(events.surpriseScale, 1);
  events.setSurpriseScale(99);
  assert.equal(events.surpriseScale, 3);
  events.setSurpriseScale(2);
  events.reset();
  assert.equal(events.surpriseScale, 1, 'a new run starts at the normal rate');
});

await test('effects: unknown looks are "none"; the low tier and reduced motion keep the wash and drop the particles', () => {
  const fx = new LiveOpsEffects();
  fx.reducedMotion = false;
  assert.equal(fx.active, false);
  fx.set({ theme: 'nonsense', ambient: 'lava' });
  assert.deepEqual([fx.theme, fx.ambient, fx.active], ['none', 'none', false]);
  fx.set(null);
  assert.equal(fx.active, false);
  fx.set({ theme: 'frost', ambient: 'snow' });
  assert.equal(fx.active, true);
  assert.deepEqual([fx.particleCount('high'), fx.particleCount('medium'), fx.particleCount('low')], [MAX_PARTICLES, MAX_PARTICLES / 2, 0]);
  fx.reducedMotion = true;
  assert.equal(fx.particleCount('high'), 0);
  fx.reducedMotion = false;
  fx.set({ theme: 'gold', ambient: 'none' });
  assert.equal(fx.active, true, 'a wash alone is a look');
  assert.equal(fx.particleCount('high'), 0);
});

await test('effects cost: one wash plus at most MAX_PARTICLES small shapes, recycled in place', () => {
  const counts = { fillRect: 0, arc: 0, ellipse: 0, fill: 0, save: 0, restore: 0, beginPath: 0 };
  const ctx = new Proxy({}, { get: (_, key) => (key in counts ? () => { counts[key]++; } : () => {}), set: () => true });
  for (const ambient of ['snow', 'embers', 'stars', 'petals', 'sparkles']) {
    for (const key of Object.keys(counts)) counts[key] = 0;
    const fx = new LiveOpsEffects();
    fx.reducedMotion = false;
    fx.set({ theme: 'frost', ambient });
    for (let i = 0; i < 400; i++) fx.update(1 / 60, 800, 600, 'high');
    fx.render(ctx, 800, 600);
    assert.ok(fx._particles.length <= MAX_PARTICLES, ambient);
    assert.ok(counts.fillRect + counts.arc + counts.ellipse <= 1 + MAX_PARTICLES * 2, `${ambient}: ${JSON.stringify(counts)}`);
    for (const p of fx._particles) assert.ok(p.y > -40 && p.y < 640, `${ambient}: a particle left the arena for good (${p.y})`);
  }
  for (const key of Object.keys(counts)) counts[key] = 0;
  const idle = new LiveOpsEffects();
  idle.render(ctx, 800, 600);
  idle.update(1, 800, 600);
  assert.deepEqual(Object.values(counts).reduce((a, b) => a + b, 0), 0, 'no look, no drawing');
  const shrink = new LiveOpsEffects();
  shrink.reducedMotion = false;
  shrink.set({ theme: 'none', ambient: 'snow' });
  shrink.update(1 / 60, 800, 600, 'high');
  assert.equal(shrink._particles.length, MAX_PARTICLES);
  shrink.update(1 / 60, 800, 600, 'low');
  assert.equal(shrink._particles.length, 0, 'a drop to the low tier sheds the particles at once');
});

await test('player-facing helpers: remaining time and the rules summary', () => {
  assert.equal(formatRemaining(90 * MIN), '1 giờ 30 phút');
  assert.equal(formatRemaining(26 * HOUR), '1 ngày 2 giờ');
  assert.equal(formatRemaining(10 * 1000), '1 phút');
  assert.equal(formatRemaining(-5), '1 phút');
  const rules = L.createEventContent('seasonal').rules;
  assert.deepEqual(summarizeRules(rules), []);
  assert.deepEqual(summarizeRules({ ...rules, visual: { theme: 'frost', ambient: 'none' } }), ['🎨 Chỉ đổi hiệu ứng hình ảnh']);
  const lines = summarizeRules({
    ...rules, enemy: { speedMultiplier: 1.25, runes: ['horizontal', 'horizontal', 'vertical'], noHearts: true },
    spawn: { intervalMultiplier: 0.7, surpriseMultiplier: 2 }, player: { maxHp: 3 }, score: { multiplier: 1.5 }
  });
  assert.equal(lines.length, 7);
  assert.ok(lines.includes('👻 Tốc độ u linh ×1,25') && lines.includes('✨ Điểm ×1,5') && lines.includes('❤️ Tối đa 3 tim'));
  assert.ok(lines.includes(`✍️ Chỉ ấn ký ${RUNES.horizontal.symbol} ${RUNES.vertical.symbol}`), 'a repeated rune is listed once');
});

// ---------------------------------------------------------------------------------------------------------------------
section('Game and UI on a fake DOM');
// ---------------------------------------------------------------------------------------------------------------------

// An inspectable DOM: elements are cached per id, classList is real, createElement builds a small tree
const makeEl = (id = '') => {
  const el = {
    id, children: [], attrs: {}, className: '', _text: '', _html: '', innerText: '', style: { setProperty() {} },
    classes: new Set(),
    addEventListener() {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    appendChild(child) { this.children.push(child); return child; }, querySelectorAll: () => [], querySelector: () => null, remove() {},
    get parentElement() { return null; }
  };
  Object.defineProperty(el, 'textContent', {
    get() { return this._text; },
    set(v) { this._text = String(v); this.children = []; }
  });
  Object.defineProperty(el, 'innerHTML', {
    get() { return this._html; },
    set(v) { this._html = String(v); this.children = []; }
  });
  el.classList = {
    add: (...c) => c.forEach((x) => el.classes.add(x)), remove: (...c) => c.forEach((x) => el.classes.delete(x)),
    contains: (c) => el.classes.has(c), toggle: (c, force) => (force === undefined ? (el.classes.has(c) ? el.classes.delete(c) : el.classes.add(c)) : (force ? el.classes.add(c) : el.classes.delete(c)))
  };
  return el;
};
const textOf = (el) => `${el.textContent} ${el.children.map(textOf).join(' ')}`;
const elements = new Map();
const noopCtx = {
  save() {}, restore() {}, clearRect() {}, fillRect() {}, scale() {}, translate() {}, rotate() {}, beginPath() {}, arc() {}, ellipse() {},
  fill() {}, stroke() {}, drawImage() {}, moveTo() {}, lineTo() {}, rect() {}, closePath() {}, fillText() {}, setLineDash() {}, clip() {},
  roundRect() {}, setTransform() {}, createRadialGradient: () => ({ addColorStop() {} }), createLinearGradient: () => ({ addColorStop() {} }),
  measureText: () => ({ width: 10 })
};
global.window = { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, addEventListener() {}, location: { href: 'https://example.test/play/', search: '' } };
global.document = {
  addEventListener() {}, hidden: false,
  createElement: (tag) => { const el = makeEl(); el.tag = tag; el.getContext = () => noopCtx; el.width = 100; el.height = 100; return el; },
  getElementById: (id) => { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); },
  querySelectorAll: () => [], querySelector: () => null
};
const mockCanvas = { getContext: () => noopCtx, parentElement: { clientWidth: 1280, clientHeight: 720 }, width: 1280, height: 720, style: {}, addEventListener() {} };

const { Game } = await import('../src/core/Game.js');
const { SettingsStore } = await import('../src/core/Settings.js');
const { RunSaveStore } = await import('../src/core/RunSave.js');

async function newGame(options = {}) {
  const game = new Game(mockCanvas);
  game.progress = new ProgressStore(new MemoryStorage());
  game.runSave = new RunSaveStore(new MemoryStorage());
  game.settings = new SettingsStore(new MemoryStorage());
  game.settings.onChange((k, v) => game._applySetting(k, v));
  game.uiManager.meta.showToast = () => {};
  if (options.events !== false) {
    const r = rig(options);
    game.liveOps = r.service;
    r.service.onChange(() => game.uiManager.meta.refreshLiveOps()); // what main.js / MetaUI wire up in the real game
    await r.service.load(URL_, ENV);
    game.rig = r;
  } else {
    game.liveOps = new LiveOpsService({ storage: new MemoryStorage(), now: () => NOW });
  }
  return game;
}
const play = (game, mode, extra = {}) => {
  game.waveSystem.setMode(mode);
  game.stateMachine.changeState(GAME_STATES.PLAYING, { resetData: true, ...extra });
};

await test('the daily challenge run uses the live event: seed, rules, hearts, score rule and pinned run', async () => {
  const game = await newGame();
  game.startDaily();
  const ch = game.challenge;
  assert.equal(ch.source, 'liveops');
  assert.equal(game.waveSystem.seed, L.deriveSeed({ kind: 'daily', key: '2026-11-14', salt: 'nov' }));
  assert.equal(game.waveSystem.modifier.id, 'daily-2026-11-14');
  assert.equal(game.player.maxHp, 3, "the event's heart rule applies");
  assert.deepEqual(game.liveRun.entries.map((e) => e.eventId), ['daily-2026-11-14']);
  const expected = Math.round(100 * game.combat.rules.scoring.multiplier * game.upgrades.scoreMultiplier * game.events.scoreMult * 1.5);
  assert.equal(game._addScore(100), expected, 'score version 2 multiplies points');
  assert.equal(game.getDailyShareUrl().includes(encodeURIComponent('daily:2026-11-14:r1:s2')), true, 'the share link names the board');
});

await test('finishing a live daily: board, streak record, rewards, new cosmetic announced, settled once', async () => {
  const game = await newGame();
  game.startDaily();
  game.score = 6000; game.metrics.maxCombo = 9; game.waveSystem.currentWave = 5;
  const summary = game.finishRun(false);
  assert.equal(summary.daily.kind, 'daily');
  assert.equal(summary.daily.source, 'liveops');
  assert.equal(summary.daily.boardId, 'daily:2026-11-14:r1:s2');
  assert.equal(summary.daily.board.record.score, 6000);
  assert.equal(game.progress.getDaily('2026-11-14').score, 6000, "the streak record is keyed by the challenge's own day");
  assert.equal(summary.liveOps.granted.length, 2);
  assert.ok(summary.cosmetics.some((c) => c.id === 'frost'), 'the granted trail shows up as a new wardrobe unlock');
  assert.equal(summary.isNewHighScore, true);
  const regular = JSON.stringify(game.progress.data.records);
  assert.equal(regular.includes('6000'), false, 'regular records are untouched');
  // finishing again counts nothing more
  const again = game.finishRun(false);
  assert.equal(again.liveOps, null);
  assert.equal(game.progress.eventRewards().length, 2);
  assert.equal(game.progress.getEventProgress('daily-2026-11-14', 1).runs, 1);
});

await test('an old day from a friend is playable and unranked: no board, no streak, no reward', async () => {
  const game = await newGame();
  game.startDaily('2026-11-13');
  assert.equal(game.challenge.key, '2026-11-13');
  game.score = 9000; game.waveSystem.currentWave = 4;
  const summary = game.finishRun(false);
  assert.equal(game.progress.getDaily('2026-11-13'), null);
  assert.equal(game.progress.getBoard(game.challenge.boardId), null);
  assert.equal(summary.daily.isNewBest, false);
  assert.equal(summary.highScore, 9000);
  assert.equal(game.progress.eventRewards().length, 0);
});

await test('the weekly challenge: its own board, no daily streak, refuses to start when there is none', async () => {
  const game = await newGame();
  assert.equal(game.startWeekly(), true);
  assert.equal(game.challenge.kind, 'weekly');
  assert.equal(game.waveSystem.gameMode, 'ENDLESS');
  assert.equal(game.waveSystem.seed, L.deriveSeed({ kind: 'weekly', key: '2026-W46' }));
  game.score = 2500; game.waveSystem.currentWave = 3;
  const summary = game.finishRun(false);
  assert.equal(summary.daily.kind, 'weekly');
  assert.equal(game.progress.getBoard('weekly:2026-W46:r1:s1').score, 2500);
  assert.deepEqual(Object.keys(game.progress.data.daily), [], 'a weekly run is not a daily streak day');
  assert.equal(summary.isNewHighScore, true);
  assert.equal(summary.highScore, 2500);

  const empty = await newGame({ events: baseRecords().filter((r) => r.kind !== 'weekly') });
  const before = empty.stateMachine.getCurrentStateName();
  assert.equal(empty.startWeekly(), false);
  assert.equal(empty.stateMachine.getCurrentStateName(), before);
});

await test('an ordinary Endless run takes the live overlays; a Story run only their look; the menu clears the pin', async () => {
  const game = await newGame();
  play(game, 'ENDLESS');
  assert.deepEqual(game.liveRun.entries.map((e) => e.eventId), ['frost-season', 'blood-moon']);
  assert.equal(game.waveSystem.modifier.speed, 0.9);
  assert.equal(game.waveSystem.modifier.noHearts, true);
  assert.equal(game.events.surpriseScale, 2);
  assert.equal(game.liveEffects.theme, 'frost');
  assert.equal(game.waveSystem.seed, null, 'an ordinary run is not seeded');
  const mult = game.combat.rules.scoring.multiplier * game.upgrades.scoreMultiplier;
  assert.equal(game._addScore(100), Math.round(100 * mult * 1.25));

  play(game, 'STORY', { startLevel: 1 });
  assert.equal(game.waveSystem.modifier, null, 'story fights are authored');
  assert.equal(game.events.surpriseScale, 1);
  assert.equal(game.liveEffects.theme, 'frost');
  assert.equal(game._addScore(100), Math.round(100 * mult));

  game.stateMachine.changeState(GAME_STATES.MENU);
  assert.equal(game.liveRun, null);
  assert.equal(game.liveEffects.theme, 'frost', 'on the menu the arena shows the look of what is live');
});

await test('an Endless run that is being continued, assist runs, and a broken live-ops layer never block or distort a run', async () => {
  const game = await newGame();
  game._pendingRestore = {};
  assert.equal(game._pinLiveRun(), null, 'a continued run began under other rules');
  game._pendingRestore = null;

  game.settings.set('assist', 20);
  play(game, 'ENDLESS');
  assert.equal(game.liveRun, null, 'assisted runs are not eligible, so no overlay rules apply either');
  game.settings.set('assist', 0);

  game.liveOps.pinRun = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => play(game, 'ENDLESS'));
  assert.equal(game.liveRun, null);
  assert.equal(game.waveSystem.modifier, null);
  game.score = 100;
  assert.doesNotThrow(() => game.finishRun(false));

  const real = await newGame();
  play(real, 'ENDLESS');
  real.liveOps.settleRun = () => { throw new Error('boom'); };
  real.score = 50;
  const summary = real.finishRun(false);
  assert.equal(summary.liveOps, null, 'a fault while settling only means no event line on the end screen');
  assert.equal(summary.score, 50);
});

await test('an event that changes the fight or the score keeps an ordinary run out of the regular records; a look-only event, a Story run and Boss Rush do not', async () => {
  const altering = await newGame(); // frost (speed, score x1.25) + blood moon (no hearts, surprises)
  play(altering, 'ENDLESS');
  altering.score = 4000; altering.waveSystem.currentWave = 4; altering.metrics.maxCombo = 6;
  const summary = altering.finishRun(false);
  assert.equal(altering.progress.getRecord('ENDLESS', 'NORMAL').score, 0, 'a boosted score never reaches the regular record');
  assert.equal(altering.progress.getRecord('ENDLESS', 'NORMAL').plays, 0);
  assert.equal(summary.isNewHighScore, false);
  assert.equal(summary.scoreGap, 0, 'and no "just short of the record" nudge');
  assert.equal(summary.liveOps.unranked, true, 'the end screen says why');
  assert.equal(altering.progress.getEventProgress('frost-season', 1).bestScore, 4000, 'but it still counts for the event');

  const lookOnly = await newGame({ events: [record(SEASONAL({ rules: { visual: { theme: 'blossom', ambient: 'petals' } }, rewards: [] }))] });
  play(lookOnly, 'ENDLESS');
  assert.equal(lookOnly.liveRun.modifier, null);
  assert.equal(lookOnly.liveRun.scoreMultiplier, 1);
  lookOnly.score = 4000; lookOnly.waveSystem.currentWave = 4;
  const plain = lookOnly.finishRun(false);
  assert.equal(lookOnly.progress.getRecord('ENDLESS', 'NORMAL').score, 4000, 'a look-only event leaves the run fully ranked');
  assert.equal(plain.isNewHighScore, true);
  assert.equal(plain.liveOps.unranked, undefined);

  const story = await newGame();
  play(story, 'STORY', { startLevel: 1 });
  story.score = 700;
  const storySummary = story.finishRun(false);
  assert.equal(story.progress.getRecord('STORY', 'NORMAL').score, 700, 'story fights are untouched, so the run stays ranked');
  assert.equal(storySummary.liveOps.unranked, undefined);

  const rush = await newGame();
  rush.bossRush = true;
  play(rush, 'STORY', { startLevel: 1 });
  assert.equal(rush.liveRun, null, 'Boss Rush has its own board: no event touches it');
});

await test('refresh never rejects, whatever goes wrong inside it', async () => {
  const r = rig();
  r.service.configure(URL_, ENV);
  r.service._fetch = async () => { throw new Error('boom'); };
  const result = await r.service.refresh({ force: true });
  assert.deepEqual([result.ok, result.reason], [false, 'error']);
  assert.equal(r.service.lastError, 'error');
  assert.equal(r.service.dailyChallenge().source, 'builtin');
});

await test('offline (nothing configured) the daily challenge is exactly the built-in one', async () => {
  const game = await newGame({ events: false });
  game.startDaily();
  const today = '2026-11-14'; // the schedule clock of the service (NOW)
  assert.equal(game.challenge.source, 'builtin');
  assert.equal(game.waveSystem.seed, getDailyChallenge(today).seed);
  assert.equal(game.liveRun, null);
  assert.equal(game.waveSystem.modifier.id, getDailyChallenge(today).modifier.id);
  game.score = 700; game.waveSystem.currentWave = 2;
  const summary = game.finishRun(false);
  assert.equal(game.progress.getDaily(today).score, 700);
  assert.equal(summary.liveOps, null);
  assert.equal(summary.daily.boardId, `daily:${today}:r0:s1`, 'the built-in rotation has its own board: rules version 0');
});

await test('server-supplied text never becomes markup: daily screen, banner and events screen', async () => {
  const evil = '<img src=x onerror=alert(1)>';
  const records = [
    record(dailyEvent('2026-11-14', { name: evil, description: `${evil} & "quotes"`, rewards: [reward({ label: evil })] })),
    record(SEASONAL({ name: evil, announcement: { enabled: true, title: evil, body: `${evil}`, leadHours: 0, tone: 'event' } })),
    record(WEEKLY())
  ];
  const game = await newGame({ events: records });
  const meta = game.uiManager.meta;
  const $ = (id) => document.getElementById(id);

  meta.renderDaily();
  const modifier = $('daily-modifier').innerHTML;
  assert.equal(modifier.includes('<img'), false, 'the challenge name and description are escaped');
  assert.ok(modifier.includes('&lt;img'));
  assert.ok($('daily-meta').innerHTML.length > 0);
  assert.equal($('btn-start-weekly').classes.has('hidden'), false, 'a live weekly is offered');

  meta.refreshLiveOps();
  assert.equal($('liveops-banner').classes.has('hidden'), false);
  assert.equal($('liveops-banner-title').textContent, evil, 'the banner is text, byte for byte');
  assert.equal($('liveops-banner').attrs['data-tone'], 'event');
  assert.equal($('events-menu-badge').classes.has('hidden'), false, 'something is live');

  meta.openEvents();
  assert.equal($('events-screen').classes.has('active'), true);
  const body = $('events-body');
  assert.ok(body.children.length >= 4, 'live, upcoming, rewards and history sections');
  const all = textOf(body);
  assert.ok(all.includes(evil), 'the name is shown as text');
  assert.equal(body.innerHTML.includes('<img'), false, 'and was never put through innerHTML');
  const cards = [];
  const walk = (el) => { if (/event-card/.test(el.className || '')) cards.push(el); (el.children || []).forEach(walk); };
  walk(body);
  assert.ok(cards.some((c) => /live/.test(c.className)), 'a live card');
  assert.ok(cards.some((c) => /Chơi thử thách ngày/.test(textOf(c))), 'the live daily can be started from here');

  // The end-of-run recap escapes event names and badge labels too
  game.startDaily();
  game.score = 6000; game.waveSystem.currentWave = 5;
  const summary = game.finishRun(false);
  meta.renderRunSummary('go-summary', summary);
  const recap = $('go-summary').innerHTML;
  assert.equal(recap.includes('<img'), false);
  assert.ok(recap.includes('run-liveops') && recap.includes('&lt;img'));

  // Dismissing the banner hides it
  meta._bannerKey = game.liveOps.announcements()[0].key;
  game.liveOps.dismissAnnouncement(meta._bannerKey);
  assert.equal($('liveops-banner').classes.has('hidden'), true, 'dismissal re-renders the banner through onChange');
});

await test('the UI explains where the schedule comes from and never throws when there is none', async () => {
  const game = await newGame({ events: false });
  const meta = game.uiManager.meta;
  assert.doesNotThrow(() => { meta.renderDaily(); meta.refreshLiveOps(); meta.openEvents(); meta.updateMenu(); });
  assert.match(document.getElementById('events-status').textContent, /Chưa cấu hình/);
  assert.equal(document.getElementById('btn-start-weekly').classes.has('hidden'), true);
  assert.equal(document.getElementById('liveops-banner').classes.has('hidden'), true);

  const configured = await newGame();
  configured.rig.state.mode = 'down';
  configured.rig.device.ms += 25 * HOUR; // freshness window over
  configured.uiManager.meta.renderEvents();
  assert.match(document.getElementById('events-status').textContent, /Không kết nối được máy chủ/);

  const cache = await newGame();
  const offline = cache.rig.make();
  cache.rig.state.mode = 'down';
  offline.configure(URL_, ENV);
  cache.liveOps = offline;
  cache.uiManager.meta.renderDaily();
  assert.match(document.getElementById('daily-meta').innerHTML, /Chưa xác nhận giờ với máy chủ/, 'an unconfirmed clock is said out loud');
  cache.uiManager.meta.renderEvents();
  assert.match(document.getElementById('events-status').textContent, /ngoại tuyến/);
});

console.log('\n========================================');
console.log(`Live Ops Client Tests: ${passed} Passed, ${failures.length} Failed`);
console.log('========================================\n');
if (failures.length) {
  console.error(`Failed: ${failures.join('; ')}`);
  process.exit(1);
}
process.exit(0);
