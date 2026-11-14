/**
 * @file tests/live-ops-contract.test.js
 * @description The shared Live Operations contract (shared/live-ops/): timezone-safe time, the strict event schema,
 * the lifecycle, conflict validation, deterministic seeds and boards, reward validation, feature flags, the public
 * payload and the schedule generators. Admin server and game both rely on exactly these functions.
 */
import assert from 'node:assert/strict';
import { DAILY_MODIFIERS, getDailyChallenge } from '../src/core/Challenge.js';
import { RUNES } from '../src/core/Constants.js';
import { TRAILS, HATS } from '../src/core/Cosmetics.js';
import * as L from '../shared/live-ops/index.js';

let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  ❌ FAIL: ${name}\n     ${String(error && error.stack ? error.stack : error).split('\n').slice(0, 4).join('\n     ')}`);
  }
}
const section = (title) => console.log(`\n--- ${title} ---`);

const NOW = Date.parse('2026-11-13T07:00:00Z');
const ms = (instant) => Date.parse(instant);
const lengthHours = (key, zone) => (L.startOfLocalDay(L.addDays(key, 1), zone) - L.startOfLocalDay(key, zone)) / L.HOUR;

const seasonal = (overrides = {}) => L.createEventContent('seasonal', {
  id: 'frost-season', name: 'Frost Season', timeZone: 'Asia/Ho_Chi_Minh',
  schedule: { startLocal: '2026-12-01T00:00', endLocal: '2026-12-15T00:00' }, ...overrides
});
const random = (overrides = {}) => L.createEventContent('random', {
  id: 'blood-moon', name: 'Blood Moon', timeZone: 'UTC',
  schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-20T20:00' }, ...overrides
});
const daily = (key = '2026-11-14', overrides = {}) => L.createEventContent('daily', {
  id: `daily-${key}`, name: 'Daily', timeZone: 'UTC',
  schedule: { startLocal: `${key}T00:00`, endLocal: `${L.addDays(key, 1)}T00:00` }, ...overrides
});
const weekly = (overrides = {}) => L.createEventContent('weekly', {
  id: 'weekly-46', name: 'Weekly', timeZone: 'UTC',
  schedule: { startLocal: '2026-11-09T00:00', endLocal: '2026-11-16T00:00' }, ...overrides
});

/** A stored record as the admin server keeps it: content plus the resolved window and a status */
function record(content, status = 'scheduled', version = 1) {
  const window = L.resolveEventWindow(content);
  assert.equal(window.ok, true, `fixture window: ${window.errors.join('; ')}`);
  return {
    id: content.id, kind: content.kind, status, version, content,
    startsAt: window.startsAt, endsAt: window.endsAt, challengeKey: window.challengeKey,
    scheduledAt: '2026-11-10T00:00:00Z'
  };
}
const messages = (errors) => errors.join(' | ');

console.log('🧪 Live Operations contract\n');

// =====================================================================================================================
section('1. UTC instants and calendar dates');
test('an instant has exactly one spelling: UTC, whole seconds, in range', () => {
  assert.equal(L.formatInstant(Date.UTC(2026, 10, 13, 7, 0, 0, 999)), '2026-11-13T07:00:00Z');
  assert.equal(L.parseInstant('2026-11-13T07:00:00Z'), Date.UTC(2026, 10, 13, 7));
  for (const bad of ['2026-11-13T07:00:00+07:00', '2026-11-13T07:00:00.000Z', '2026-11-13 07:00:00Z', '2026-02-31T00:00:00Z',
    '2026-11-13T24:00:00Z', '2026-11-13T07:60:00Z', '2023-12-31T23:59:59Z', '2100-01-01T00:00:00Z', 5, null, undefined]) {
    assert.ok(Number.isNaN(L.parseInstant(bad)), `${bad} must be rejected`);
  }
  assert.throws(() => L.formatInstant(NaN), RangeError);
});
test('calendar dates reject rollovers and do plain calendar arithmetic across months, years and leap days', () => {
  assert.equal(L.isDateKey('2026-02-29'), false);
  assert.equal(L.isDateKey('2028-02-29'), true);
  assert.equal(L.isDateKey('2026-13-01'), false);
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(L.isoWeekday('2026-11-09'), 1);
  assert.equal(L.isoWeekday('2026-11-15'), 7);
});
test('ISO weeks: year boundaries and 53-week years', () => {
  assert.equal(L.isoWeekKey('2026-11-13'), '2026-W46');
  assert.equal(L.isoWeekKey('2024-12-30'), '2025-W01'); // belongs to next year's week 1
  assert.equal(L.isoWeekKey('2027-01-01'), '2026-W53'); // belongs to last year's week 53
  assert.equal(L.weekStartKey('2026-W46'), '2026-11-09');
  assert.equal(L.weekStartKey('2026-W53'), '2026-12-28');
  assert.equal(L.weekStartKey('2027-W53'), null, '2027 has only 52 weeks');
  assert.equal(L.weekStartKey('2026-W00'), null);
  assert.equal(L.weekStartKey('2026-46'), null);
});

// =====================================================================================================================
section('2. Time zones, DST and wall-clock resolution');
test('only IANA region names are zones (no fixed offsets, no junk)', () => {
  for (const ok of ['UTC', 'Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/London', 'Australia/Lord_Howe', 'America/Argentina/Buenos_Aires']) assert.equal(L.isTimeZone(ok), true, ok);
  for (const bad of ['+07:00', 'GMT+7', 'Mars/Base', '', 'x'.repeat(80), 'Asia/', 7, null]) assert.equal(L.isTimeZone(bad), false, String(bad));
});
test('a calendar day is 23 or 25 hours on a DST change and 24 otherwise', () => {
  assert.equal(lengthHours('2026-03-08', 'America/New_York'), 23);
  assert.equal(lengthHours('2026-11-01', 'America/New_York'), 25);
  assert.equal(lengthHours('2026-03-29', 'Europe/London'), 23);
  assert.equal(lengthHours('2026-10-25', 'Europe/London'), 25);
  assert.equal(lengthHours('2026-03-07', 'America/New_York'), 24);
  assert.equal(lengthHours('2026-11-14', 'Asia/Ho_Chi_Minh'), 24);
  assert.equal(lengthHours('2026-10-04', 'Australia/Lord_Howe'), 23.5, 'Lord Howe shifts by 30 minutes');
  assert.equal(lengthHours('2026-04-05', 'Australia/Lord_Howe'), 24.5);
});
test('a day starts when the zone says so: half-hour offsets and +14 included', () => {
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-11-14', 'UTC')), '2026-11-14T00:00:00Z');
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-11-14', 'Asia/Ho_Chi_Minh')), '2026-11-13T17:00:00Z');
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-11-14', 'Asia/Kolkata')), '2026-11-13T18:30:00Z');
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-11-14', 'Pacific/Kiritimati')), '2026-11-13T10:00:00Z');
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-03-08', 'America/New_York')), '2026-03-08T05:00:00Z');
  assert.equal(L.formatInstant(L.startOfLocalDay('2026-03-09', 'America/New_York')), '2026-03-09T04:00:00Z');
});
test('a wall-clock time that does not exist or happens twice is reported, never guessed', () => {
  assert.deepEqual(L.resolveLocal('2026-03-08T02:30', 'America/New_York'), { status: 'gap' });
  const twice = L.resolveLocal('2026-11-01T01:30', 'America/New_York');
  assert.equal(twice.status, 'ambiguous');
  assert.deepEqual(twice.candidates.map(L.formatInstant), ['2026-11-01T05:30:00Z', '2026-11-01T06:30:00Z']);
  assert.equal(L.resolveLocal('2026-10-04T02:15', 'Australia/Lord_Howe').status, 'gap');
  assert.equal(L.resolveLocal('2026-04-05T01:45', 'Australia/Lord_Howe').status, 'ambiguous');
  const fine = L.resolveLocal('2026-03-08T12:00', 'America/New_York');
  assert.equal(fine.status, 'ok');
  assert.equal(L.formatInstant(fine.ms), '2026-03-08T16:00:00Z');
  assert.equal(L.formatInstant(L.resolveLocal('2026-12-01T19:30', 'Asia/Ho_Chi_Minh').ms), '2026-12-01T12:30:00Z');
  assert.equal(L.resolveLocal('2026-02-31T10:00', 'UTC').status, 'invalid');
  assert.equal(L.resolveLocal('2026-02-10T24:00', 'UTC').status, 'invalid');
  assert.equal(L.resolveLocal('2026-02-10T10:00', 'Mars/Base').status, 'invalid');
});
test('wall clock and local date read back what resolveLocal was given', () => {
  for (const zone of ['Asia/Ho_Chi_Minh', 'America/New_York', 'Europe/London', 'Asia/Kolkata']) {
    const resolved = L.resolveLocal('2026-06-15T18:45', zone);
    assert.equal(resolved.status, 'ok', zone);
    assert.equal(L.wallClock(resolved.ms, zone), '2026-06-15T18:45', zone);
    assert.equal(L.localDate(resolved.ms, zone), '2026-06-15', zone);
  }
});

// =====================================================================================================================
section('3. Event content: strict schema');
test('a minimal valid event of every kind passes', () => {
  assert.deepEqual(L.validateEventContent(seasonal()), []);
  assert.deepEqual(L.validateEventContent(random()), []);
  assert.deepEqual(L.validateEventContent(daily()), []);
  assert.deepEqual(L.validateEventContent(weekly()), []);
});
test('every field is required and unknown fields are rejected, at every level', () => {
  const e = seasonal();
  delete e.rules.spawn;
  assert.match(messages(L.validateEventContent(e)), /rules\.spawn: required object/);
  const extra = seasonal();
  extra.surprise = true;
  extra.rules.enemy.hack = 1;
  const out = messages(L.validateEventContent(extra));
  assert.match(out, /event\.surprise: unknown field/);
  assert.match(out, /rules\.enemy\.hack: unknown field/);
  assert.match(messages(L.validateEventContent(null)), /required object/);
  assert.match(messages(L.validateEventContent([])), /required object/);
});
test('numbers must be finite and in range; integers must be integers', () => {
  for (const [path, bad] of [['rules.enemy.speedMultiplier', NaN], ['rules.enemy.speedMultiplier', Infinity], ['rules.enemy.speedMultiplier', 2.01],
    ['rules.enemy.speedMultiplier', '1'], ['rules.spawn.intervalMultiplier', 0.49], ['rules.spawn.surpriseMultiplier', -1], ['rules.player.maxHp', 2.5],
    ['rules.player.maxHp', 6], ['rules.score.multiplier', 0.9], ['announcement.leadHours', 337], ['eligibility.minStoryLevelsCleared', 6]]) {
    const e = seasonal();
    const keys = path.split('.');
    const parent = keys.slice(0, -1).reduce((o, k) => o[k], e);
    parent[keys.at(-1)] = bad;
    assert.notDeepEqual(L.validateEventContent(e), [], `${path} = ${bad} must be rejected`);
  }
});
test('text: length caps, control characters, blank names; markup is stored as text, not rejected', () => {
  assert.match(messages(L.validateEventContent(seasonal({ name: '' }))), /name: expected 1–80/);
  assert.match(messages(L.validateEventContent(seasonal({ name: '   ' }))), /name: cannot be blank/);
  assert.match(messages(L.validateEventContent(seasonal({ name: 'x'.repeat(81) }))), /name/);
  assert.match(messages(L.validateEventContent(seasonal({ name: 'bad\nname' }))), /control characters/);
  assert.match(messages(L.validateEventContent(seasonal({ name: 'nul\u0000' }))), /control characters/);
  assert.equal(L.validateEventContent(seasonal({ description: 'line one\nline two' })).length, 0, 'a description may use line breaks');
  assert.match(messages(L.validateEventContent(seasonal({ description: 'a\u0007b' }))), /control characters/);
  assert.deepEqual(L.validateEventContent(seasonal({ name: '<img src=x onerror=alert(1)> & co' })), [], 'rendering escapes it; the contract does not rewrite text');
});
test('ids are slugs; time zone and wall-clock fields are checked', () => {
  for (const bad of ['', 'A-b', 'a', 'has space', '-lead', 'x'.repeat(49), 'dot.dot']) assert.notDeepEqual(L.validateEventContent(seasonal({ id: bad })), [], bad);
  assert.match(messages(L.validateEventContent(seasonal({ timeZone: '+07:00' }))), /unknown time zone/);
  assert.match(messages(L.validateEventContent(seasonal({ schedule: { startLocal: '2026-12-01 00:00', endLocal: '2026-12-15T00:00' } }))), /wall-clock/);
  assert.match(messages(L.validateEventContent(seasonal({ schedule: { startLocal: '2026-12-15T00:00', endLocal: '2026-12-01T00:00' } }))), /must be after the start/);
});
test('rune restrictions are a weighted pool of the five combat runes', () => {
  assert.ok(L.COMBAT_RUNES.every((r) => Object.hasOwn(RUNES, r)), 'every combat rune exists in the game');
  assert.deepEqual(L.validateEventContent(seasonal({ rules: { enemy: { runes: ['horizontal', 'lightning'] } } })), []);
  assert.notDeepEqual(L.validateEventContent(seasonal({ rules: { enemy: { runes: ['heart'] } } })), []);
  assert.notDeepEqual(L.validateEventContent(seasonal({ rules: { enemy: { runes: ['spiral'] } } })), [], 'tactical gestures belong to tactical ghosts');
  assert.deepEqual(L.validateEventContent(seasonal({ rules: { enemy: { runes: ['lightning', 'horizontal', 'vertical', 'lightning'] } } })), [], 'listing a rune twice makes it twice as likely');
  assert.match(messages(L.validateEventContent(seasonal({ rules: { enemy: { runes: Array(13).fill('caret') } } }))), /at most 12/);
});

// =====================================================================================================================
section('4. Event content: rules that depend on the kind');
test('daily challenges are one fixed-difficulty seeded calendar day; weekly ones a Monday-to-Monday week', () => {
  assert.match(messages(L.validateEventContent(daily('2026-11-14', { schedule: { startLocal: '2026-11-14T06:00', endLocal: '2026-11-15T00:00' } }))), /starts at 00:00/);
  assert.match(messages(L.validateEventContent(daily('2026-11-14', { schedule: { startLocal: '2026-11-14T00:00', endLocal: '2026-11-16T00:00' } }))), /ends at 00:00 the next day/);
  assert.match(messages(L.validateEventContent(daily('2026-11-14', { rules: { difficulty: 'PLAYER' } }))), /fixed difficulty/);
  assert.match(messages(L.validateEventContent(daily('2026-11-14', { eligibility: { difficulties: ['NORMAL'] } }))), /difficulty is fixed/);
  assert.match(messages(L.validateEventContent(daily('2026-11-14', { eligibility: { modes: ['ENDLESS'] } }))), /always DAILY/);
  assert.match(messages(L.validateEventContent(weekly({ schedule: { startLocal: '2026-11-10T00:00', endLocal: '2026-11-17T00:00' } }))), /Monday/);
  assert.match(messages(L.validateEventContent(weekly({ schedule: { startLocal: '2026-11-09T00:00', endLocal: '2026-11-15T00:00' } }))), /next Monday/);
  assert.deepEqual(L.validateEventContent(daily('2026-11-14', { rules: { seedSalt: 'rerolled-1', difficulty: 'HARDCORE' } })), []);
});
test('seasonal and random events overlay Endless / Story runs, never pick the difficulty and are not seeded', () => {
  assert.match(messages(L.validateEventContent(seasonal({ eligibility: { modes: ['DAILY'] } }))), /ENDLESS and STORY runs only/);
  assert.match(messages(L.validateEventContent(seasonal({ eligibility: { modes: [] } }))), /choose at least one mode/);
  assert.match(messages(L.validateEventContent(seasonal({ rules: { difficulty: 'HARDCORE' } }))), /never overrides the difficulty/);
  assert.match(messages(L.validateEventContent(seasonal({ rules: { seedSalt: 'x' } }))), /only daily and weekly challenges are seeded/);
  assert.deepEqual(L.validateEventContent(seasonal({ eligibility: { modes: ['ENDLESS', 'STORY'], difficulties: ['HARDCORE', 'INFERNO'] } })), []);
});
test('a score multiplier needs score version 2; a Story-only event may only change looks and rewards', () => {
  assert.match(messages(L.validateEventContent(seasonal({ rules: { score: { multiplier: 1.5 } } }))), /score version 2/);
  assert.deepEqual(L.validateEventContent(seasonal({ rules: { scoreVersion: 2, score: { multiplier: 1.5 } } })), []);
  assert.match(messages(L.validateEventContent(seasonal({ eligibility: { modes: ['STORY'] }, rules: { enemy: { speedMultiplier: 1.2 } } }))), /Story-only event may only change visual/);
  assert.deepEqual(L.validateEventContent(seasonal({ eligibility: { modes: ['STORY'] }, rules: { visual: { theme: 'frost', ambient: 'snow' } } })), []);
});
test('an enabled announcement needs a title and a body', () => {
  assert.match(messages(L.validateEventContent(seasonal({ announcement: { enabled: true } }))), /needs a title and a body/);
  assert.deepEqual(L.validateEventContent(seasonal({ announcement: { enabled: true, title: 'Hello', body: 'World', leadHours: 48, tone: 'urgent' } })), []);
});
test('altersGameplay: visuals and rewards are free, everything else changes the run', () => {
  assert.equal(L.altersGameplay(seasonal().rules), false);
  assert.equal(L.altersGameplay(seasonal({ rules: { visual: { theme: 'frost', ambient: 'snow' } } }).rules), false);
  for (const rules of [{ enemy: { speedMultiplier: 1.1 } }, { enemy: { noHearts: true } }, { enemy: { runes: ['caret'] } }, { spawn: { intervalMultiplier: 0.9 } },
    { spawn: { surpriseMultiplier: 2 } }, { player: { maxHp: 3 } }, { scoreVersion: 2, score: { multiplier: 1.5 } }]) {
    assert.equal(L.altersGameplay(seasonal({ rules }).rules), true, JSON.stringify(rules));
  }
});
test('every preset is a valid event once it has an id and a schedule', () => {
  for (const preset of L.EVENT_PRESETS) {
    const content = L.presetContent(preset.id, preset.kind === 'seasonal'
      ? { id: preset.id, schedule: { startLocal: '2026-12-01T00:00', endLocal: '2026-12-08T00:00' } }
      : { id: preset.id, schedule: { startLocal: '2026-12-01T19:00', endLocal: '2026-12-01T20:00' } });
    assert.deepEqual(L.validateEventContent(content), [], preset.id);
    assert.equal(L.resolveEventWindow(content).ok, true, preset.id);
  }
  assert.throws(() => L.presetContent('nope'), RangeError);
});

// =====================================================================================================================
section('5. Rewards: secure validation of the rules themselves');
const withReward = (reward) => seasonal({ rewards: [{ id: 'r1', type: 'cosmetic', ref: 'trail:frost', label: '', condition: { metric: 'bestScore', threshold: 5000 }, ...reward }] });
test('a reward may grant only a real, non-default cosmetic from the wardrobe, or a named badge', () => {
  assert.deepEqual(L.validateEventContent(withReward({})), []);
  assert.deepEqual(L.validateEventContent(withReward({ ref: 'hat:crown' })), []);
  assert.match(messages(L.validateEventContent(withReward({ ref: 'trail:laser-eyes' }))), /unknown cosmetic/);
  assert.match(messages(L.validateEventContent(withReward({ ref: 'trail:arcane' }))), /unknown cosmetic/, 'the default trail is owned by everyone');
  assert.match(messages(L.validateEventContent(withReward({ ref: 'hat:none' }))), /unknown cosmetic/);
  assert.match(messages(L.validateEventContent(withReward({ ref: 'frost' }))), /unknown cosmetic/);
  assert.match(messages(L.validateEventContent(withReward({ label: 'Free stuff' }))), /must be empty for a cosmetic/);
  assert.deepEqual(L.validateEventContent(withReward({ type: 'badge', ref: '🎃', label: 'Pumpkin Hunter' })), []);
  assert.match(messages(L.validateEventContent(withReward({ type: 'badge', ref: '🎃', label: '' }))), /needs a name/);
  assert.match(messages(L.validateEventContent(withReward({ type: 'badge', ref: '', label: 'x' }))), /icon of 1–8/);
  assert.match(messages(L.validateEventContent(withReward({ type: 'badge', ref: 'x'.repeat(9), label: 'x' }))), /icon of 1–8/);
  assert.match(messages(L.validateEventContent(withReward({ type: 'gold', ref: 'x' }))), /expected one of cosmetic, badge/);
});
test('thresholds are positive integers under a ceiling per metric; ids and rewards cannot repeat', () => {
  assert.match(messages(L.validateEventContent(withReward({ condition: { metric: 'bestScore', threshold: 0 } }))), /threshold/);
  assert.match(messages(L.validateEventContent(withReward({ condition: { metric: 'bestScore', threshold: 1.5 } }))), /threshold/);
  assert.match(messages(L.validateEventContent(withReward({ condition: { metric: 'runs', threshold: 1001 } }))), /at most 1000 for runs/);
  assert.match(messages(L.validateEventContent(withReward({ condition: { metric: 'bestWave', threshold: 1000 } }))), /at most 999/);
  assert.match(messages(L.validateEventContent(withReward({ condition: { metric: 'speed', threshold: 1 } }))), /expected one of runs, bestScore/);
  const dup = withReward({});
  dup.rewards.push({ ...dup.rewards[0], condition: { metric: 'runs', threshold: 1 } });
  assert.match(messages(L.validateEventContent(dup)), /duplicate reward id|already offered/);
  const sameRef = withReward({});
  sameRef.rewards.push({ ...sameRef.rewards[0], id: 'r2' });
  assert.match(messages(L.validateEventContent(sameRef)), /already offered by this event/);
});
test('at most 8 rewards and 4 cosmetics per event; every grantable cosmetic exists in the game catalog', () => {
  const many = seasonal({ rewards: Array.from({ length: 9 }, (_, i) => ({ id: `b${i}`, type: 'badge', ref: '⭐', label: `Badge ${i}`, condition: { metric: 'runs', threshold: i + 1 } })) });
  assert.match(messages(L.validateEventContent(many)), /at most 8/);
  const cosmetics = L.grantableCosmetics().slice(0, 5).map((ref, i) => ({ id: `c${i}`, type: 'cosmetic', ref, label: '', condition: { metric: 'runs', threshold: i + 1 } }));
  assert.match(messages(L.validateEventContent(seasonal({ rewards: cosmetics }))), /at most 4 cosmetics/);
  const catalog = new Set([...TRAILS.map((t) => `trail:${t.id}`), ...HATS.map((h) => `hat:${h.id}`)]);
  assert.ok(L.grantableCosmetics().every((ref) => catalog.has(ref)));
  assert.ok(!L.grantableCosmetics().includes('trail:arcane') && !L.grantableCosmetics().includes('hat:none'));
});

// =====================================================================================================================
section('6. Resolving the schedule to UTC');
test('a daily challenge is a whole calendar day of its zone (23 hours on a spring-forward day)', () => {
  const utc = L.resolveEventWindow(daily('2026-11-14'));
  assert.equal(utc.ok, true);
  assert.equal(utc.startsAt, '2026-11-14T00:00:00Z');
  assert.equal(utc.endsAt, '2026-11-15T00:00:00Z');
  assert.equal(utc.challengeKey, '2026-11-14');
  const hcm = L.resolveEventWindow(daily('2026-11-14', { timeZone: 'Asia/Ho_Chi_Minh' }));
  assert.equal(hcm.startsAt, '2026-11-13T17:00:00Z');
  assert.equal(hcm.endsAt, '2026-11-14T17:00:00Z');
  const dst = L.resolveEventWindow(daily('2026-03-08', { timeZone: 'America/New_York' }));
  assert.equal((dst.endMs - dst.startMs) / L.HOUR, 23);
  assert.equal(dst.challengeKey, '2026-03-08');
});
test('a weekly challenge is Monday to Monday in its zone and is keyed by ISO week', () => {
  // The week of 26 October contains the 1 November fall-back change in New York: it is 169 hours long
  const w = L.resolveEventWindow(weekly({ timeZone: 'America/New_York', schedule: { startLocal: '2026-10-26T00:00', endLocal: '2026-11-02T00:00' } }));
  assert.equal(w.ok, true, messages(w.errors));
  assert.equal(w.challengeKey, '2026-W44');
  assert.equal(w.startsAt, '2026-10-26T04:00:00Z', 'EDT on 26 October');
  assert.equal(w.endsAt, '2026-11-02T05:00:00Z', 'EST on 2 November');
  assert.equal((w.endMs - w.startMs) / L.HOUR, 169);
  const plain = L.resolveEventWindow(weekly());
  assert.equal(plain.challengeKey, '2026-W46');
  assert.equal((plain.endMs - plain.startMs) / L.HOUR, 168);
});
test('seasonal and random windows use exact wall-clock times and refuse DST gaps and overlaps', () => {
  const ok = L.resolveEventWindow(seasonal());
  assert.equal(ok.startsAt, '2026-11-30T17:00:00Z');
  assert.equal(ok.endsAt, '2026-12-14T17:00:00Z');
  assert.equal(ok.challengeKey, 'frost-season');
  const gap = L.resolveEventWindow(random({ timeZone: 'America/New_York', schedule: { startLocal: '2026-03-08T02:30', endLocal: '2026-03-08T04:00' } }));
  assert.equal(gap.ok, false);
  assert.match(messages(gap.errors), /does not exist in America\/New_York/);
  const twice = L.resolveEventWindow(random({ timeZone: 'America/New_York', schedule: { startLocal: '2026-11-01T00:30', endLocal: '2026-11-01T01:30' } }));
  assert.equal(twice.ok, false);
  assert.match(messages(twice.errors), /happens twice/);
  const across = L.resolveEventWindow(random({ timeZone: 'America/New_York', schedule: { startLocal: '2026-03-08T01:00', endLocal: '2026-03-08T03:30' } }));
  assert.equal(across.ok, true);
  assert.equal((across.endMs - across.startMs) / L.MINUTE, 90, '01:00 to 03:30 on a spring-forward night is 90 real minutes, not 150');
});
test('duration limits per kind and the 2024–2100 range', () => {
  assert.match(messages(L.resolveEventWindow(random({ schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-20T19:04' } })).errors), /between 5 minute/);
  assert.equal(L.resolveEventWindow(random({ schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-20T19:05' } })).ok, true);
  assert.equal(L.resolveEventWindow(random({ schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-23T19:00' } })).ok, true, '72 hours is the longest');
  assert.equal(L.resolveEventWindow(random({ schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-23T19:01' } })).ok, false);
  assert.match(messages(L.resolveEventWindow(seasonal({ schedule: { startLocal: '2026-12-01T00:00', endLocal: '2026-12-01T12:00' } })).errors), /between 1 day/);
  assert.equal(L.resolveEventWindow(seasonal({ schedule: { startLocal: '2026-12-01T00:00', endLocal: '2027-03-31T00:00' } })).ok, true, '120 days is the longest');
  assert.equal(L.resolveEventWindow(seasonal({ schedule: { startLocal: '2026-12-01T00:00', endLocal: '2027-04-01T00:00' } })).ok, false);
  assert.match(messages(L.resolveEventWindow(seasonal({ schedule: { startLocal: '2020-01-01T00:00', endLocal: '2020-02-01T00:00' } })).errors), /between 2024 and 2100/);
});
test('canonicalJson ignores key order; changedSections names what changed', () => {
  assert.equal(L.canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }), L.canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }));
  const a = seasonal();
  const b = seasonal({ name: 'Other', rules: { enemy: { speedMultiplier: 1.1 } } });
  assert.deepEqual(L.changedSections(a, b), ['name', 'rules']);
  assert.deepEqual(L.changedSections(a, a), []);
  assert.deepEqual(L.changedSections(null, a).includes('rewards'), true);
});

// =====================================================================================================================
section('7. Lifecycle and time-driven activation');
test('the six statuses and the transitions between them', () => {
  assert.deepEqual(L.EVENT_STATUSES, ['draft', 'scheduled', 'active', 'completed', 'archived', 'cancelled']);
  assert.ok(L.canApply('draft', 'schedule') && L.canApply('scheduled', 'unschedule') && L.canApply('scheduled', 'activate'));
  assert.ok(L.canApply('active', 'complete') && L.canApply('active', 'cancel') && L.canApply('completed', 'archive') && L.canApply('cancelled', 'archive'));
  for (const [status, action] of [['draft', 'activate'], ['draft', 'archive'], ['active', 'unschedule'], ['active', 'schedule'], ['completed', 'cancel'],
    ['archived', 'schedule'], ['cancelled', 'schedule'], ['completed', 'activate']]) assert.equal(L.canApply(status, action), false, `${status} -> ${action}`);
  assert.equal(L.ACTION_RESULT.unschedule, 'draft');
});
test('time moves a scheduled event to active and an active one to completed, whatever was persisted', () => {
  const r = record(random());
  const start = ms(r.startsAt);
  const end = ms(r.endsAt);
  assert.equal(L.effectiveStatus(r, start - 1), 'scheduled');
  assert.equal(L.effectiveStatus(r, start), 'active');
  assert.equal(L.effectiveStatus(r, end - 1), 'active');
  assert.equal(L.effectiveStatus(r, end), 'completed');
  assert.equal(L.effectiveStatus({ ...r, status: 'active' }, end), 'completed');
  for (const status of ['draft', 'completed', 'archived', 'cancelled']) assert.equal(L.effectiveStatus({ ...r, status }, start + 1), status, `${status} never changes by itself`);
});
test('due transitions are reported once, oldest first, with the moment they were due', () => {
  const r = record(random());
  const start = ms(r.startsAt);
  const end = ms(r.endsAt);
  assert.deepEqual(L.dueTransitions([r], start - 1), []);
  assert.deepEqual(L.dueTransitions([r], start + 5), [{ id: r.id, from: 'scheduled', to: 'active', at: r.startsAt, version: 1 }]);
  // the server was down for the whole window: both transitions come out, in order, stamped with their true times
  assert.deepEqual(L.dueTransitions([r], end + 5).map((t) => [t.to, t.at]), [['active', r.startsAt], ['completed', r.endsAt]]);
  // once persisted, nothing is due again: activation is idempotent
  assert.deepEqual(L.dueTransitions([{ ...r, status: 'active' }], start + 5), []);
  assert.deepEqual(L.dueTransitions([{ ...r, status: 'completed' }], end + 5), []);
  assert.deepEqual(L.dueTransitions([{ ...r, status: 'draft' }, { ...r, status: 'cancelled' }], end + 5), []);
});
test('eventPhase reads published events on any clock; a cancelled event is never live', () => {
  const e = { status: 'active', startsAt: '2026-11-20T19:00:00Z', endsAt: '2026-11-20T20:00:00Z' };
  assert.equal(L.eventPhase(e, ms(e.startsAt) - 1), 'upcoming');
  assert.equal(L.eventPhase(e, ms(e.startsAt)), 'live');
  assert.equal(L.eventPhase(e, ms(e.endsAt)), 'ended');
  assert.equal(L.eventPhase({ ...e, status: 'cancelled' }, ms(e.startsAt) + 1), 'cancelled');
});

// =====================================================================================================================
section('8. Conflict validation');
test('two events of the same kind cannot overlap; touching windows are fine', () => {
  const a = record(random({ id: 'a', schedule: { startLocal: '2026-11-20T19:00', endLocal: '2026-11-20T20:00' } }));
  const b = record(random({ id: 'b', schedule: { startLocal: '2026-11-20T19:30', endLocal: '2026-11-20T20:30' } }));
  const c = record(random({ id: 'c', schedule: { startLocal: '2026-11-20T20:30', endLocal: '2026-11-20T21:30' } }));
  const d = record(random({ id: 'd', schedule: { startLocal: '2026-11-20T20:00', endLocal: '2026-11-20T20:20' } }));
  const found = L.findConflicts([a, b, c], NOW);
  assert.equal(found.length, 1, 'c starts exactly when b ends, so only a and b clash');
  assert.equal(found[0].type, 'overlap');
  assert.deepEqual(found[0].eventIds, ['a', 'b']);
  assert.match(found[0].message, /both random events at the same time/);
  assert.deepEqual(L.findConflicts([a, d], NOW), [], 'd starts exactly when a ends');
  assert.deepEqual(L.findConflicts([b, c], NOW), []);
});
test('one daily per day and one weekly per week; a daily and a weekly can run together', () => {
  assert.equal(L.findConflicts([record(daily('2026-11-14')), record(daily('2026-11-14', { id: 'daily-dup' }))], NOW)[0].type, 'overlap');
  assert.deepEqual(L.findConflicts([record(daily('2026-11-14')), record(daily('2026-11-15'))], NOW), []);
  assert.deepEqual(L.findConflicts([record(daily('2026-11-14')), record(weekly())], NOW), []);
  // a Ho Chi Minh daily and a UTC daily for the "same date" are different windows that overlap for 7 hours
  const hcm = record(daily('2026-11-14', { id: 'daily-hcm', timeZone: 'Asia/Ho_Chi_Minh' }));
  assert.equal(L.findConflicts([record(daily('2026-11-14')), hcm], NOW).length, 1);
});
test('only live events conflict: drafts, completed, cancelled and archived ones are out of the way', () => {
  const a = record(random({ id: 'a' }));
  for (const status of ['draft', 'completed', 'cancelled', 'archived']) assert.deepEqual(L.findConflicts([a, { ...record(random({ id: 'b' })), status }], NOW), [], status);
  const past = record(random({ id: 'past', schedule: { startLocal: '2026-11-01T19:00', endLocal: '2026-11-01T20:00' } }));
  assert.deepEqual(L.findConflicts([past, record(random({ id: 'also-past', schedule: { startLocal: '2026-11-01T19:30', endLocal: '2026-11-01T20:30' } }))], NOW), [], 'windows that ended are not conflicts any more');
});
test('a seasonal and a random event that overlap are checked together: no gesture, too fast, too dense, too rich', () => {
  const base = record(seasonal({ id: 'season', timeZone: 'UTC', schedule: { startLocal: '2026-11-20T00:00', endLocal: '2026-11-25T00:00' } }));
  const overlay = (rules, extra = {}) => record(random({ id: 'surprise', rules, ...extra }));
  const noRune = L.findConflicts([record(seasonal({ id: 'season', timeZone: 'UTC', schedule: { startLocal: '2026-11-20T00:00', endLocal: '2026-11-25T00:00' }, rules: { enemy: { runes: ['horizontal'] } } })), overlay({ enemy: { runes: ['caret'] } })], NOW);
  assert.equal(noRune.length, 1);
  assert.equal(noRune[0].type, 'rules');
  assert.match(noRune[0].message, /no gesture that can appear/);
  const fast = L.findConflicts([record(seasonal({ id: 'season', timeZone: 'UTC', schedule: base.content.schedule, rules: { enemy: { speedMultiplier: 1.8 } } })), overlay({ enemy: { speedMultiplier: 1.8 } })], NOW);
  assert.match(fast[0].message, /ghost speed would be x3\.24/);
  const dense = L.findConflicts([record(seasonal({ id: 'season', timeZone: 'UTC', schedule: base.content.schedule, rules: { spawn: { intervalMultiplier: 0.5 } } })), overlay({ spawn: { intervalMultiplier: 0.5 } })], NOW);
  assert.match(dense[0].message, /spawn interval would be x0\.25/);
  const rich = L.findConflicts([record(seasonal({ id: 'season', timeZone: 'UTC', schedule: base.content.schedule, rules: { scoreVersion: 2, score: { multiplier: 3 } } })), overlay({ scoreVersion: 2, score: { multiplier: 2 } })], NOW);
  assert.match(rich[0].message, /score multiplier would be x6/);
  // compatible rules overlap happily; so do overlays aimed at different run types
  assert.deepEqual(L.findConflicts([base, overlay({ enemy: { speedMultiplier: 1.2 } })], NOW), []);
  const storyOnly = record(seasonal({ id: 'story-season', timeZone: 'UTC', schedule: base.content.schedule, eligibility: { modes: ['STORY'] }, rules: { visual: { theme: 'frost', ambient: 'snow' } } }));
  assert.deepEqual(L.findConflicts([storyOnly, overlay({ enemy: { runes: ['caret'] } })], NOW), []);
});
test('an overlay never conflicts with a challenge: challenge rules are fixed so scores stay comparable', () => {
  const day = record(daily('2026-11-20'));
  const overlay = record(random({ rules: { enemy: { speedMultiplier: 2 } } }));
  assert.deepEqual(L.findConflicts([day, overlay], NOW), []);
});

// =====================================================================================================================
section('9. Seeds, boards and the built-in fallback');
test('a daily challenge without a salt has EXACTLY the seed the built-in rotation always used', () => {
  for (const key of ['2026-11-13', '2026-01-01', '2027-02-28', '2025-12-31']) {
    assert.equal(L.deriveSeed({ kind: 'daily', key }), getDailyChallenge(key).seed, key);
  }
});
test('seeds are deterministic, salt re-rolls the sequence, weekly seeds are independent, rules version is not an input', () => {
  const a = L.deriveSeed({ kind: 'daily', key: '2026-11-14', salt: 'x1' });
  assert.equal(a, L.deriveSeed({ kind: 'daily', key: '2026-11-14', salt: 'x1' }));
  assert.notEqual(a, L.deriveSeed({ kind: 'daily', key: '2026-11-14' }));
  assert.notEqual(a, L.deriveSeed({ kind: 'daily', key: '2026-11-14', salt: 'x2' }));
  assert.notEqual(L.deriveSeed({ kind: 'weekly', key: '2026-W46' }), L.deriveSeed({ kind: 'daily', key: '2026-W46' }));
  assert.ok(Number.isInteger(a) && a >= 0 && a <= 0xffffffff);
  const v1 = L.eventChallenge({ ...L.toPublicEvent(record(daily('2026-11-14'), 'active', 1), NOW) });
  const v9 = L.eventChallenge({ ...L.toPublicEvent(record(daily('2026-11-14'), 'active', 9), NOW) });
  assert.equal(v1.seed, v9.seed, 'editing the rules must not change the ghost sequence');
  assert.notEqual(v1.boardId, v9.boardId, 'but it must start a new board');
});
test('board ids identify comparable scores: kind, key, rules version and score version', () => {
  const id = L.boardId({ kind: 'daily', key: '2026-11-14', version: 3, scoreVersion: 2 });
  assert.equal(id, 'daily:2026-11-14:r3:s2');
  assert.deepEqual(L.parseBoardId(id), { kind: 'daily', key: '2026-11-14', version: 3, scoreVersion: 2 });
  assert.deepEqual(L.parseBoardId('weekly:2026-W46:r1:s1'), { kind: 'weekly', key: '2026-W46', version: 1, scoreVersion: 1 });
  for (const bad of ['', 'daily:2026-11-14', 'monthly:2026-11:r1:s1', 'daily:2026-11-14:r1:s1;drop', `daily:2026-11-14:r${'9'.repeat(40)}:s1`, null, 7]) assert.equal(L.parseBoardId(bad), null, String(bad));
  assert.equal(L.isBoardCompatible(id, 'daily:2026-11-14:r3:s2'), true);
  assert.equal(L.isBoardCompatible(id, 'daily:2026-11-14:r4:s2'), false);
  assert.equal(L.isBoardCompatible(id, 'daily:2026-11-14:r3:s1'), false);
  assert.equal(L.isBoardCompatible('junk', 'junk'), false);
});
test('the built-in daily is the legacy challenge plus identity: rules version 0, score version 1, same modifier object', () => {
  const key = '2026-11-13';
  const legacy = getDailyChallenge(key);
  const builtin = L.builtinChallenge(key);
  assert.equal(builtin.seed, legacy.seed);
  assert.equal(builtin.modifier, legacy.modifier);
  assert.equal(builtin.difficulty, legacy.difficulty);
  assert.equal(builtin.key, key);
  assert.equal(builtin.source, 'builtin');
  assert.equal(builtin.boardId, `daily:${key}:r0:s1`);
  assert.equal(builtin.eventId, null);
  assert.equal(builtin.scoreMultiplier, 1);
});
test('built-in modifiers survive the round trip through rules: nothing gained, nothing lost, empty rules stay absent', () => {
  for (const modifier of DAILY_MODIFIERS) {
    const rules = L.modifierToRules(modifier);
    const content = L.createEventContent('daily', {
      id: 'daily-fixture', name: modifier.name, description: modifier.desc, rules, schedule: { startLocal: '2026-11-14T00:00', endLocal: '2026-11-15T00:00' }
    });
    const back = L.rulesToModifier({ id: 'daily-fixture', name: modifier.name, description: modifier.desc, rules: content.rules });
    assert.deepEqual(L.validateEventContent(content), [], `${modifier.id} must be a valid event, or the generator breaks on the days it is drawn`);
    for (const key of ['runes', 'noHearts', 'speed', 'spawn', 'maxHp']) assert.deepEqual(back[key], modifier[key], `${modifier.id}.${key}`);
    assert.equal(Object.hasOwn(back, 'runes') && back.runes.length === 0, false, 'runes: [] would restrict ghosts to nothing');
  }
  const plain = L.rulesToModifier({ id: 'p', name: 'Plain', description: '', rules: daily().rules });
  assert.deepEqual(Object.keys(plain).sort(), ['desc', 'icon', 'id', 'name']);
});
test('a live daily becomes a challenge with its own seed, modifier, difficulty and board', () => {
  const content = daily('2026-11-14', {
    name: 'Storm', description: 'Lightning only', rules: { difficulty: 'HARDCORE', scoreVersion: 2, score: { multiplier: 2 }, enemy: { runes: ['lightning'], speedMultiplier: 1.25 }, visual: { theme: 'twilight', ambient: 'stars' } }
  });
  const challenge = L.eventChallenge(L.toPublicEvent(record(content, 'active', 4), NOW));
  assert.equal(challenge.key, '2026-11-14');
  assert.equal(challenge.source, 'liveops');
  assert.equal(challenge.difficulty, 'HARDCORE');
  assert.equal(challenge.boardId, 'daily:2026-11-14:r4:s2');
  assert.equal(challenge.scoreMultiplier, 2);
  assert.equal(challenge.seed, getDailyChallenge('2026-11-14').seed);
  assert.deepEqual(challenge.modifier.runes, ['lightning']);
  assert.equal(challenge.modifier.speed, 1.25);
  assert.equal(challenge.modifier.icon, '🌙');
});

// =====================================================================================================================
section('10. Merging rules, eligibility and rewards');
test('overlapping events merge: multipliers multiply, hearts take the smaller value, runes intersect, first visual wins', () => {
  const a = seasonal({ rules: { enemy: { speedMultiplier: 1.2, runes: ['horizontal', 'vertical', 'caret'], noHearts: false }, spawn: { intervalMultiplier: 0.8 }, player: { maxHp: 4 }, visual: { theme: 'frost', ambient: 'snow' } } }).rules;
  const b = random({ rules: { enemy: { speedMultiplier: 1.5, runes: ['vertical', 'caret', 'lightning'], noHearts: true }, spawn: { intervalMultiplier: 0.5, surpriseMultiplier: 2 }, player: { maxHp: 3 }, visual: { theme: 'ember', ambient: 'embers' } } }).rules;
  const merged = L.mergeRules([a, b]);
  assert.equal(Math.round(merged.speedMultiplier * 100) / 100, 1.8);
  assert.equal(Math.round(merged.intervalMultiplier * 100) / 100, 0.4);
  assert.equal(merged.surpriseMultiplier, 2);
  assert.equal(merged.maxHp, 3);
  assert.equal(merged.noHearts, true);
  assert.deepEqual(merged.runes, ['vertical', 'caret']);
  assert.equal(merged.conflict, false);
  assert.equal(merged.theme, 'frost');
  assert.deepEqual(L.mergeRules([]).runes, []);
  assert.equal(L.mergeRules([seasonal({ rules: { enemy: { runes: ['horizontal'] } } }).rules, random({ rules: { enemy: { runes: ['caret'] } } }).rules]).conflict, true);
});
test('eligibility: mode, difficulty, story progress and assisted runs', () => {
  const e = { eligibility: { modes: ['ENDLESS'], difficulties: ['HARDCORE'], minStoryLevelsCleared: 2, allowAssisted: false } };
  const ctx = { mode: 'ENDLESS', difficulty: 'HARDCORE', assisted: false, storyLevelsCleared: 2 };
  assert.deepEqual(L.checkEligibility(e, ctx), { ok: true, reason: null });
  assert.equal(L.checkEligibility(e, { ...ctx, mode: 'STORY' }).reason, 'mode');
  assert.equal(L.checkEligibility(e, { ...ctx, difficulty: 'NORMAL' }).reason, 'difficulty');
  assert.equal(L.checkEligibility(e, { ...ctx, storyLevelsCleared: 1 }).reason, 'progress');
  assert.equal(L.checkEligibility(e, { ...ctx, assisted: true }).reason, 'assisted');
  assert.equal(L.checkEligibility({ eligibility: { ...e.eligibility, allowAssisted: true, difficulties: [] } }, { ...ctx, assisted: true, difficulty: 'INFERNO' }).ok, true);
});
test('progress folds runs in; an assisted run counts as played but never raises a best', () => {
  let p = L.emptyProgress();
  p = L.applyRun(p, { score: 1200, wave: 4, combo: 9, assisted: false });
  p = L.applyRun(p, { score: 800, wave: 6, combo: 3, assisted: false });
  assert.deepEqual(p, { runs: 2, bestScore: 1200, bestWave: 6, bestCombo: 9 });
  const q = L.applyRun(p, { score: 99999, wave: 99, combo: 99, assisted: true });
  assert.deepEqual(q, { runs: 3, bestScore: 1200, bestWave: 6, bestCombo: 9 });
  assert.deepEqual(p, { runs: 2, bestScore: 1200, bestWave: 6, bestCombo: 9 }, 'the input is not mutated');
});
test('rewards are earned when their metric reaches the threshold, and only once', () => {
  const event = L.toPublicEvent(record(seasonal({ rewards: [
    { id: 'play', type: 'badge', ref: '🎃', label: 'Played', condition: { metric: 'runs', threshold: 2 } },
    { id: 'wave', type: 'cosmetic', ref: 'trail:frost', label: '', condition: { metric: 'bestWave', threshold: 10 } }
  ] })), NOW);
  assert.deepEqual(L.evaluateRewards(event, { runs: 1, bestScore: 0, bestWave: 9, bestCombo: 0 }), []);
  assert.deepEqual(L.evaluateRewards(event, { runs: 2, bestScore: 0, bestWave: 10, bestCombo: 0 }), ['play', 'wave']);
  assert.deepEqual(L.evaluateRewards(event, { runs: 5, bestScore: 0, bestWave: 12, bestCombo: 0 }, { play: { at: 1 } }), ['wave'], 'already granted rewards are not offered again');
  assert.deepEqual(L.evaluateRewards(event, { runs: 5, bestScore: 0, bestWave: 12, bestCombo: 0 }, { play: true, wave: true }), []);
});
test('a claim is checked against the server schedule: window, version, cancellation, eligibility, plausibility and a trusted clock', () => {
  const event = L.toPublicEvent(record(seasonal({ timeZone: 'UTC', schedule: { startLocal: '2026-11-10T00:00', endLocal: '2026-11-20T00:00' } }), 'active', 3), NOW);
  const run = { mode: 'ENDLESS', difficulty: 'NORMAL', assisted: false, score: 4000, wave: 8, combo: 12, storyLevelsCleared: 0 };
  const pinned = { eventId: event.id, version: 3, startedMs: NOW - 5 * L.MINUTE };
  const claim = (overrides = {}) => L.validateClaim({ event, run, pinned, nowMs: NOW, clockTrusted: true, ...overrides });
  assert.deepEqual(claim(), { ok: true, reasons: [] });
  assert.deepEqual(claim({ clockTrusted: false }).reasons, ['untrusted-clock']);
  assert.deepEqual(claim({ rewardsEnabled: false }).reasons, ['rewards-disabled']);
  assert.deepEqual(claim({ event: { ...event, status: 'cancelled' } }).reasons, ['cancelled']);
  assert.deepEqual(claim({ pinned: { ...pinned, version: 2 } }).reasons, ['version-mismatch']);
  assert.deepEqual(claim({ pinned: { ...pinned, eventId: 'other' } }).reasons, ['unknown-event']);
  assert.deepEqual(claim({ event: null }).reasons, ['unknown-event']);
  assert.deepEqual(claim({ pinned: { ...pinned, startedMs: ms('2026-11-09T23:00:00Z') } }).reasons, ['started-outside-window']);
  assert.deepEqual(claim({ nowMs: ms('2026-11-09T12:00:00Z') }).reasons.includes('outside-window'), true, 'before the event began');
  assert.deepEqual(claim({ nowMs: ms('2026-11-20T00:09:59Z'), pinned: { ...pinned, startedMs: ms('2026-11-19T23:50:00Z') } }), { ok: true, reasons: [] }, 'inside the 10 minute grace after the end');
  assert.deepEqual(claim({ nowMs: ms('2026-11-20T00:10:00Z'), pinned: { ...pinned, startedMs: ms('2026-11-19T23:50:00Z') } }).reasons, ['outside-window'], 'grace over');
  for (const bad of [{ score: -1 }, { score: NaN }, { score: Infinity }, { wave: 10000 }, { combo: '9' }, { score: 100000001 }]) {
    assert.deepEqual(claim({ run: { ...run, ...bad } }).reasons, ['out-of-range'], JSON.stringify(bad));
  }
  assert.deepEqual(claim({ run: { ...run, mode: 'STORY' } }).reasons, ['not-eligible:mode']);
  assert.deepEqual(claim({ run: { ...run, assisted: true } }).reasons, ['not-eligible:assisted']);
  const several = claim({ clockTrusted: false, event: { ...event, status: 'cancelled' } });
  assert.deepEqual(several.reasons, ['untrusted-clock', 'cancelled'], 'every reason is reported, not only the first');
});

// =====================================================================================================================
section('11. Feature flags');
test('every flag has a default and the full set validates strictly', () => {
  const flags = L.defaultFlags();
  assert.deepEqual(Object.keys(flags), L.FLAG_KEYS);
  assert.deepEqual(L.validateFlags(flags), []);
  assert.ok(L.FLAG_KEYS.every((k) => L.FLAG_DEFS[k].label && L.FLAG_DEFS[k].description));
  const bad = structuredClone(flags);
  bad['liveops.unknown'] = { enabled: true, rolloutPercent: 100 };
  bad['liveops.daily'].rolloutPercent = 101;
  bad['liveops.weekly'].enabled = 'yes';
  bad['liveops.random'].extra = 1;
  delete bad['liveops.rewards'];
  const out = messages(L.validateFlags(bad));
  for (const part of ['unknown flag', 'rolloutPercent: expected integer in 0–100', 'enabled: expected true or false', 'unknown field', 'liveops.rewards: required object']) assert.match(out, new RegExp(part));
  assert.deepEqual(L.validateFlags(null), ['flags: required object']);
});
test('normalizeFlags fills what a stored workspace predates and ignores junk', () => {
  const normalized = L.normalizeFlags({ 'liveops.daily': { enabled: false, rolloutPercent: 40 }, 'liveops.weekly': { enabled: 'x', rolloutPercent: 5 }, nonsense: 1 });
  assert.deepEqual(normalized['liveops.daily'], { enabled: false, rolloutPercent: 40 });
  assert.deepEqual(normalized['liveops.weekly'], { enabled: true, rolloutPercent: 100 });
  assert.deepEqual(L.validateFlags(normalized), []);
  assert.deepEqual(L.normalizeFlags(null), L.defaultFlags());
});
test('rollout is stable per install and roughly proportional; 0 is off, 100 is on, unknown flags are off', () => {
  const flags = L.defaultFlags();
  flags['liveops.effects'] = { enabled: true, rolloutPercent: 30 };
  const install = 'install-abc-123';
  assert.equal(L.evaluateFlag(flags, 'liveops.effects', install), L.evaluateFlag(flags, 'liveops.effects', install));
  let on = 0;
  for (let i = 0; i < 4000; i++) if (L.evaluateFlag(flags, 'liveops.effects', `install-${i}`)) on++;
  assert.ok(on > 1000 && on < 1400, `${on}/4000 should be near 30%`);
  assert.equal(L.evaluateFlag({ ...flags, 'liveops.effects': { enabled: true, rolloutPercent: 0 } }, 'liveops.effects', install), false);
  assert.equal(L.evaluateFlag({ ...flags, 'liveops.effects': { enabled: false, rolloutPercent: 100 } }, 'liveops.effects', install), false);
  assert.equal(L.evaluateFlag(flags, 'liveops.daily', install), true);
  assert.equal(L.evaluateFlag(flags, 'liveops.does-not-exist', install), false);
  assert.equal(L.evaluateFlag(undefined, 'liveops.daily', install), true, 'no flags known: the default applies');
  const grown = L.evaluateFlag({ ...flags, 'liveops.effects': { enabled: true, rolloutPercent: 60 } }, 'liveops.effects', install);
  assert.ok(!L.evaluateFlag(flags, 'liveops.effects', install) || grown, 'raising a rollout never switches an install off');
});

// =====================================================================================================================
section('12. The public payload the game downloads');
const workspace = (events, extra = {}) => ({ environment: 'production', revision: 7, flags: L.defaultFlags(), events, ...extra });
test('only published events appear: no drafts, no archive; nothing editorial leaves the server', () => {
  const scheduled = record(random({ id: 'soon', schedule: { startLocal: '2026-11-14T19:00', endLocal: '2026-11-14T20:00' } }));
  const draft = { ...record(random({ id: 'secret', schedule: { startLocal: '2026-11-15T19:00', endLocal: '2026-11-15T20:00' } })), status: 'draft' };
  const archived = { ...record(random({ id: 'old', schedule: { startLocal: '2026-11-01T19:00', endLocal: '2026-11-01T20:00' } })), status: 'archived' };
  const payload = L.buildPublicPayload(workspace([scheduled, draft, archived]), NOW);
  assert.deepEqual(payload.events.map((e) => e.id), ['soon']);
  assert.equal(payload.serverTime, '2026-11-13T07:00:00Z');
  assert.equal(payload.environment, 'production');
  assert.equal(payload.revision, 7);
  assert.equal(JSON.stringify(payload).includes('secret'), false);
  const event = payload.events[0];
  assert.deepEqual(Object.keys(event).sort(), ['announcement', 'challengeKey', 'description', 'eligibility', 'endsAt', 'id', 'kind', 'name', 'rewards', 'rules', 'startsAt', 'status', 'timeZone', 'version']);
});
test('statuses are computed on the server clock, and the horizon keeps the payload small', () => {
  const live = record(random({ id: 'live', schedule: { startLocal: '2026-11-13T06:00', endLocal: '2026-11-13T08:00' } }));
  const far = record(seasonal({ id: 'far', timeZone: 'UTC', schedule: { startLocal: '2026-12-20T00:00', endLocal: '2026-12-30T00:00' } }));
  const recent = record(random({ id: 'recent', schedule: { startLocal: '2026-11-10T19:00', endLocal: '2026-11-10T20:00' } }));
  const ancient = record(random({ id: 'ancient', schedule: { startLocal: '2026-10-01T19:00', endLocal: '2026-10-01T20:00' } }));
  const payload = L.buildPublicPayload(workspace([far, ancient, recent, live]), NOW);
  assert.deepEqual(payload.events.map((e) => [e.id, e.status]), [['live', 'active'], ['recent', 'completed']], 'live first; the far-future and long-finished events are left out');
  const cancelled = { ...record(random({ id: 'cancelled-live', schedule: { startLocal: '2026-11-13T09:00', endLocal: '2026-11-13T10:00' } })), status: 'cancelled', cancelledAt: '2026-11-12T10:00:00Z' };
  const neverPublished = { ...record(random({ id: 'cancelled-draft', schedule: { startLocal: '2026-11-13T11:00', endLocal: '2026-11-13T12:00' } })), status: 'cancelled', scheduledAt: undefined, cancelledAt: '2026-11-12T10:00:00Z' };
  const longAgo = { ...record(random({ id: 'cancelled-old', schedule: { startLocal: '2026-11-13T13:00', endLocal: '2026-11-13T14:00' } })), status: 'cancelled', cancelledAt: '2026-10-01T10:00:00Z' };
  const withCancelled = L.buildPublicPayload(workspace([cancelled, neverPublished, longAgo]), NOW);
  assert.deepEqual(withCancelled.events.map((e) => [e.id, e.status]), [['cancelled-live', 'cancelled']], 'a recent cancellation of a published event is announced so caches drop it');
});
test('the payload is capped at 200 events', () => {
  const many = Array.from({ length: 260 }, (_, i) => record(random({ id: `ev-${i}`, schedule: { startLocal: `2026-11-14T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, endLocal: `2026-11-14T${String(Math.floor(i / 60) + 12).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}` } })));
  assert.equal(L.buildPublicPayload(workspace(many), NOW).events.length, 200);
});
test('the game accepts what the server builds and rejects any tampering, as a whole', () => {
  const payload = L.buildPublicPayload(workspace([
    record(seasonal({ schedule: { startLocal: '2026-11-20T00:00', endLocal: '2026-12-05T00:00' }, rewards: [{ id: 'r1', type: 'cosmetic', ref: 'trail:frost', label: '', condition: { metric: 'runs', threshold: 3 } }] }), 'scheduled', 2),
    record(daily('2026-11-14'), 'scheduled', 1),
    record(weekly(), 'active', 1)
  ]), NOW);
  assert.deepEqual(L.validatePublicPayload(payload, 'production'), []);
  const tamper = (mutate) => {
    const copy = structuredClone(payload);
    mutate(copy);
    return L.validatePublicPayload(copy, 'production');
  };
  const pick = (p, id) => p.events.find((e) => e.id === id);
  assert.match(messages(L.validatePublicPayload(payload, 'staging')), /environment/);
  assert.match(messages(tamper((p) => { p.schemaVersion = 2; })), /schemaVersion/);
  assert.match(messages(tamper((p) => { p.serverTime = '2026-11-13T07:00:00+07:00'; })), /serverTime/);
  assert.match(messages(tamper((p) => { p.extra = 1; })), /payload\.extra: unknown field/);
  assert.match(messages(tamper((p) => { p.staleAfterSeconds = 5; })), /staleAfterSeconds/);
  assert.match(messages(tamper((p) => { p.flags['liveops.hack'] = { enabled: true, rolloutPercent: 100 }; })), /unknown flag/);
  assert.match(messages(tamper((p) => { pick(p, 'frost-season').status = 'draft'; })), /status/);
  assert.match(messages(tamper((p) => { pick(p, 'frost-season').rules.enemy.speedMultiplier = 50; })), /speedMultiplier/);
  assert.match(messages(tamper((p) => { pick(p, 'frost-season').rewards[0].ref = 'trail:godmode'; })), /unknown cosmetic/);
  assert.match(messages(tamper((p) => { const e = pick(p, 'frost-season'); e.endsAt = e.startsAt; })), /after startsAt/);
  assert.match(messages(tamper((p) => { pick(p, 'daily-2026-11-14').challengeKey = 'whenever'; })), /challengeKey/);
  assert.match(messages(tamper((p) => { pick(p, 'frost-season').secretNote = 'x'; })), /unknown field/);
  assert.match(messages(tamper((p) => { p.events.push(structuredClone(p.events[0])); })), /duplicate/);
  assert.match(messages(tamper((p) => { p.events = 'nope'; })), /events/);
  assert.match(messages(L.validatePublicPayload(null, 'production')), /required object/);
  assert.ok(tamper((p) => { for (const e of p.events) { e.rules.enemy.speedMultiplier = 99; e.rules.spawn.surpriseMultiplier = 99; e.name = ''; } p.flags = {}; }).length <= 20, 'problem lists stay short');
});
test('liveEvents picks what is running on a given clock, soonest ending first', () => {
  const payload = L.buildPublicPayload(workspace([
    record(seasonal({ id: 'long', timeZone: 'UTC', schedule: { startLocal: '2026-11-10T00:00', endLocal: '2026-12-10T00:00' } }), 'active'),
    record(random({ id: 'short', schedule: { startLocal: '2026-11-13T06:00', endLocal: '2026-11-13T08:00' } }), 'active'),
    record(random({ id: 'later', schedule: { startLocal: '2026-11-13T20:00', endLocal: '2026-11-13T21:00' } }), 'scheduled')
  ]), NOW);
  assert.deepEqual(L.liveEvents(payload.events, NOW).map((e) => e.id), ['short', 'long']);
  assert.deepEqual(L.liveEvents(payload.events, NOW, 'seasonal').map((e) => e.id), ['long']);
  assert.deepEqual(L.liveEvents(payload.events, ms('2026-11-13T20:30:00Z')).map((e) => e.id), ['later', 'long'], 'the same payload on a later clock');
});

// =====================================================================================================================
section('13. Schedule generators');
test('daily drafts follow the built-in rotation, are valid, skip taken dates and are deterministic', () => {
  const out = L.generateDailyContents({ startDate: '2026-11-14', days: 5, existingKeys: ['2026-11-16'] });
  assert.deepEqual(out.errors, []);
  assert.deepEqual(out.skipped, ['2026-11-16']);
  assert.deepEqual(out.contents.map((c) => c.id), ['daily-2026-11-14', 'daily-2026-11-15', 'daily-2026-11-17', 'daily-2026-11-18']);
  for (const content of out.contents) {
    assert.deepEqual(L.validateEventContent(content), [], content.id);
    assert.equal(L.resolveEventWindow(content).ok, true, content.id);
    const key = content.id.slice(6);
    assert.equal(content.name, getDailyChallenge(key).modifier.name, 'the same twist a player would get offline');
    assert.equal(content.rules.difficulty, 'NORMAL');
    assert.equal(L.eventChallenge(L.toPublicEvent(record(content, 'active'), NOW)).seed, getDailyChallenge(key).seed);
  }
  assert.deepEqual(out, L.generateDailyContents({ startDate: '2026-11-14', days: 5, existingKeys: ['2026-11-16'] }));
  const seen = new Set();
  for (let start = '2026-01-01', i = 0; i < 24; i++, start = L.addDays(start, 31)) {
    const batch = L.generateDailyContents({ startDate: start, days: 31 });
    assert.deepEqual(batch.errors, []);
    for (const content of batch.contents) {
      assert.deepEqual(L.validateEventContent(content), [], `${content.id} (${content.name})`);
      seen.add(content.name);
    }
  }
  assert.equal(seen.size, DAILY_MODIFIERS.length, 'across 744 days every built-in twist was drawn and every one produced a valid event');
  assert.match(messages(L.generateDailyContents({ startDate: '2026-02-30', days: 5 }).errors), /startDate/);
  assert.match(messages(L.generateDailyContents({ startDate: '2026-11-14', days: 32 }).errors), /days/);
  assert.match(messages(L.generateDailyContents({ startDate: '2026-11-14', days: 3, timeZone: 'Mars/Base' }).errors), /timeZone/);
});
const randomParams = (overrides = {}) => ({
  seed: 'week-47', fromDate: '2026-11-16', days: 7, count: 4, durationMinutes: [30, 90], minGapMinutes: 120, hours: [18, 22], timeZone: 'Asia/Ho_Chi_Minh', ...overrides
});
test('random events are scattered deterministically: same seed, same schedule; another seed, another one', () => {
  const a = L.generateRandomContents(randomParams());
  assert.deepEqual(a.errors, []);
  assert.equal(a.contents.length, 4);
  assert.equal(a.shortfall, 0);
  assert.deepEqual(a, L.generateRandomContents(randomParams()));
  assert.notDeepEqual(a.contents.map((c) => c.schedule), L.generateRandomContents(randomParams({ seed: 'week-48' })).contents.map((c) => c.schedule));
});
test('generated random events are valid, inside the allowed hours and range, never overlap and keep their gap', () => {
  const { contents } = L.generateRandomContents(randomParams({ count: 8, days: 14 }));
  assert.equal(contents.length, 8);
  const windows = [];
  for (const c of contents) {
    assert.deepEqual(L.validateEventContent(c), [], c.id);
    const w = L.resolveEventWindow(c);
    assert.equal(w.ok, true, c.id);
    const startHour = Number(c.schedule.startLocal.slice(11, 13));
    assert.ok(startHour >= 18 && startHour < 22, `${c.id} starts at ${c.schedule.startLocal}`);
    const minutes = (w.endMs - w.startMs) / L.MINUTE;
    assert.ok(minutes >= 30 && minutes <= 90 && minutes % 5 === 0, `${c.id} lasts ${minutes} min`);
    assert.ok(c.schedule.startLocal >= '2026-11-16' && c.schedule.startLocal < '2026-11-30');
    assert.equal(c.announcement.enabled, true);
    windows.push(w);
  }
  windows.sort((a, b) => a.startMs - b.startMs);
  windows.forEach((w, i) => { if (i) assert.ok(w.startMs - windows[i - 1].endMs >= 120 * L.MINUTE, 'minimum gap'); });
  assert.deepEqual(L.findConflicts(contents.map((c) => record(c)), ms('2026-11-13T00:00:00Z')), [], 'the generated schedule passes conflict validation');
  assert.equal(new Set(contents.map((c) => c.id)).size, 8);
});
test('generation avoids what is already scheduled and reports a shortfall when there is no room', () => {
  const first = L.generateRandomContents(randomParams({ count: 3, days: 1, hours: [18, 22], durationMinutes: [60, 60], minGapMinutes: 0 }));
  const occupied = first.contents.map((c) => ({ startsAt: L.resolveEventWindow(c).startsAt, endsAt: L.resolveEventWindow(c).endsAt }));
  const second = L.generateRandomContents(randomParams({ count: 1, days: 1, hours: [18, 22], durationMinutes: [60, 60], minGapMinutes: 0, occupied, takenIds: first.contents.map((c) => c.id) }));
  assert.equal(second.contents.length + second.shortfall, 1);
  for (const c of second.contents) assert.ok(!occupied.some((o) => ms(L.resolveEventWindow(c).startsAt) < ms(o.endsAt) && ms(o.startsAt) < ms(L.resolveEventWindow(c).endsAt)));
  const impossible = L.generateRandomContents(randomParams({ count: 5, days: 1, hours: [18, 19], durationMinutes: [60, 90], minGapMinutes: 600 }));
  assert.ok(impossible.shortfall >= 4 && impossible.contents.length <= 1, `${impossible.contents.length} placed, shortfall ${impossible.shortfall}`);
});
test('generation is DST-safe: no event starts in a skipped hour or an ambiguous one', () => {
  const { contents } = L.generateRandomContents(randomParams({ seed: 'dst', fromDate: '2026-03-07', days: 3, count: 12, hours: [0, 6], timeZone: 'America/New_York', durationMinutes: [30, 120], minGapMinutes: 0 }));
  assert.ok(contents.length > 0);
  for (const c of contents) {
    assert.equal(L.resolveEventWindow(c).ok, true, `${c.id} ${c.schedule.startLocal}→${c.schedule.endLocal}`);
    assert.notEqual(c.schedule.startLocal.slice(0, 13), '2026-03-08T02', 'the 02:00 hour does not exist on 8 March');
  }
});
test('generator parameters are validated with clear messages', () => {
  for (const [override, pattern] of [[{ seed: '' }, /seed/], [{ fromDate: 'tomorrow' }, /fromDate/], [{ days: 0 }, /days/], [{ count: 21 }, /count/],
    [{ durationMinutes: [4, 30] }, /durationMinutes/], [{ durationMinutes: [90, 30] }, /durationMinutes/], [{ durationMinutes: [30, 5000] }, /durationMinutes/],
    [{ minGapMinutes: -1 }, /minGapMinutes/], [{ hours: [22, 18] }, /hours/], [{ hours: [0, 25] }, /hours/], [{ timeZone: 'Nope/Nope' }, /timeZone/], [{ presetIds: ['nothing'] }, /presetIds/]]) {
    const out = L.generateRandomContents(randomParams(override));
    assert.equal(out.contents.length, 0);
    assert.match(messages(out.errors), pattern, JSON.stringify(override));
  }
});

// =====================================================================================================================
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error(`\nFailed: ${failures.join(' | ')}`);
  process.exit(1);
}
