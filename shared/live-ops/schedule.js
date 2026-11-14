/**
 * @file shared/live-ops/schedule.js
 * @description The schedule side of Live Operations: the lifecycle state machine, time-driven activation, conflict
 * detection, deterministic schedule generators and the public payload the game downloads.
 *
 * "Server-authoritative" means the server decides what is live: it owns the clock, it applies the transitions below,
 * and the game only ever evaluates a schedule the server published (against a clock synchronised with the server).
 * Everything here is pure; the admin server wires it to storage in admin/server/liveops.mjs.
 */

import { getDailyChallenge, hashSeed, mulberry32 } from '../../src/core/Challenge.js';
import {
  EVENT_PRESETS, KIND_INFO, LIMITS, LIVE_STATUSES, LIVEOPS_SCHEMA_VERSION, SAFE_LIMITS,
  createEventContent, mergeRules, modifierToRules, normalizeFlags, validateFlags, validatePublicEvent
} from './contract.js';
import {
  DAY, MINUTE, addDays, formatInstant, isDateKey, isTimeZone, parseInstant, resolveLocal
} from './time.js';

// ---------------------------------------------------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------------------------------------------------
//
//   draft ──schedule──▶ scheduled ──(start time / activate)──▶ active ──(end time / complete)──▶ completed ──archive──▶ archived
//     │ ▲                   │                                      │
//     │ └────unschedule─────┘                                      │
//     └──────cancel────────▶ cancelled ◀─────────cancel───────────┴──(also from scheduled)           cancelled ──archive──▶ archived

export const ACTIONS = ['schedule', 'unschedule', 'activate', 'complete', 'cancel', 'archive'];
/** The status an action leads to (an action whose result already holds is an idempotent no-op) */
export const ACTION_RESULT = {
  schedule: 'scheduled', unschedule: 'draft', activate: 'active', complete: 'completed', cancel: 'cancelled', archive: 'archived'
};
/** Actions each stored status accepts */
export const TRANSITIONS = {
  draft: ['schedule', 'cancel'],
  scheduled: ['unschedule', 'activate', 'cancel'],
  active: ['complete', 'cancel'],
  completed: ['archive'],
  cancelled: ['archive'],
  archived: []
};

export const canApply = (status, action) => Boolean(TRANSITIONS[status]?.includes(action));

/** The status an event has at `nowMs`, whatever has or has not been persisted yet (time moves scheduled -> active -> completed) */
export function effectiveStatus(record, nowMs) {
  if (record.status !== 'scheduled' && record.status !== 'active') return record.status;
  const start = Date.parse(record.startsAt);
  const end = Date.parse(record.endsAt);
  if (nowMs >= end) return 'completed';
  if (record.status === 'scheduled' && nowMs >= start) return 'active';
  return record.status;
}

/**
 * Transitions that time alone has made due and that are not persisted yet, oldest first. Applying them is idempotent:
 * once an event's stored status has moved on, it no longer reports them. `at` is the moment the transition was due
 * (the start or end time), not "now", so a server that was down still records the true history.
 * @param {Array<{id: string, status: string, startsAt: string, endsAt: string, version: number}>} records
 * @param {number} nowMs
 * @returns {Array<{id: string, from: string, to: string, at: string, version: number}>}
 */
export function dueTransitions(records, nowMs) {
  const due = [];
  for (const record of records) {
    if (record.status === 'scheduled' && nowMs >= Date.parse(record.startsAt)) {
      due.push({ id: record.id, from: 'scheduled', to: 'active', at: record.startsAt, version: record.version });
    }
    if ((record.status === 'scheduled' || record.status === 'active') && nowMs >= Date.parse(record.endsAt)) {
      due.push({ id: record.id, from: 'active', to: 'completed', at: record.endsAt, version: record.version });
    }
  }
  return due.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Where is an event relative to a clock? 'cancelled' | 'upcoming' | 'live' | 'ended'. Works on records and on published events. */
export function eventPhase(event, nowMs) {
  if (event.status === 'cancelled') return 'cancelled';
  if (nowMs < Date.parse(event.startsAt)) return 'upcoming';
  return nowMs < Date.parse(event.endsAt) ? 'live' : 'ended';
}

// ---------------------------------------------------------------------------------------------------------------------
// Conflicts
// ---------------------------------------------------------------------------------------------------------------------

const overlaps = (a, b) => Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

const sharedMode = (a, b) => a.content.eligibility.modes.some((mode) => b.content.eligibility.modes.includes(mode));

/**
 * Problems between the events that are (or are about to be) live. Two kinds:
 *  - `overlap` (error): two events of the same kind overlap in time. There is one daily challenge per day, one weekly
 *    per week, one seasonal event and one random event at a time.
 *  - `rules` (error): a seasonal and a random event overlap and aim at the same run type, and their rules together are
 *    unplayable or unsafe (no gesture left, ghosts too fast, spawns too dense, score multiplier too high).
 * Daily and weekly challenges are never modified by an overlay (their rules are fixed so scores stay comparable), so
 * they cannot conflict with one.
 * @param {Array<Object>} records event records (stored status, `content`, `startsAt`, `endsAt`)
 * @param {number} nowMs only events still live at this time are considered
 * @returns {Array<{type: 'overlap'|'rules', severity: 'error', eventIds: string[], message: string}>}
 */
export function findConflicts(records, nowMs) {
  const live = records.filter((r) => LIVE_STATUSES.includes(effectiveStatus(r, nowMs)));
  const conflicts = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (!overlaps(a, b)) continue;
      const ids = [a.id, b.id].sort();
      if (a.kind === b.kind) {
        conflicts.push({
          type: 'overlap', severity: 'error', eventIds: ids,
          message: `“${a.content.name}” (${a.id}) and “${b.content.name}” (${b.id}) are both ${a.kind} events at the same time; only one ${KIND_INFO[a.kind].label.toLowerCase()} can run at once.`
        });
        continue;
      }
      if (KIND_INFO[a.kind].calendar || KIND_INFO[b.kind].calendar || !sharedMode(a, b)) continue;
      const merged = mergeRules([a.content.rules, b.content.rules]);
      const problems = [];
      if (merged.conflict) problems.push('their gesture restrictions leave no gesture that can appear');
      if (merged.speedMultiplier < SAFE_LIMITS.speed[0] || merged.speedMultiplier > SAFE_LIMITS.speed[1]) problems.push(`ghost speed would be x${round(merged.speedMultiplier)} (allowed ${SAFE_LIMITS.speed.join('–')})`);
      if (merged.intervalMultiplier < SAFE_LIMITS.interval[0] || merged.intervalMultiplier > SAFE_LIMITS.interval[1]) problems.push(`the spawn interval would be x${round(merged.intervalMultiplier)} (allowed ${SAFE_LIMITS.interval.join('–')})`);
      if (merged.scoreMultiplier > SAFE_LIMITS.score[1]) problems.push(`the score multiplier would be x${round(merged.scoreMultiplier)} (allowed up to ${SAFE_LIMITS.score[1]})`);
      if (problems.length) {
        conflicts.push({
          type: 'rules', severity: 'error', eventIds: ids,
          message: `“${a.content.name}” (${a.id}) and “${b.content.name}” (${b.id}) overlap and ${problems.join('; ')}.`
        });
      }
    }
  }
  return conflicts;
}

const round = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------------------------------------------------
// Public payload: what the game downloads
// ---------------------------------------------------------------------------------------------------------------------

/** What the public endpoint includes, and for how long, so the payload stays small however long the schedule grows */
export const PUBLIC_HORIZON = {
  /** scheduled events starting within this long are published (so teasers and tomorrow's daily are available) */
  aheadMs: 14 * DAY,
  /** completed events stay in the payload this long (the game shows them as history) */
  completedMs: 14 * DAY,
  /** cancelled events stay this long so a client that cached them learns about the cancellation */
  cancelledMs: 7 * DAY,
  maxEvents: 200
};
/** How long a game may keep using a downloaded payload without reaching the server (it is told in the payload) */
export const DEFAULT_STALE_AFTER_SECONDS = 24 * 60 * 60;

/** An event record as players see it. Nothing editorial (authors, notes, version trail) leaves the server. */
export function toPublicEvent(record, nowMs) {
  const c = record.content;
  return {
    id: record.id,
    kind: record.kind,
    status: effectiveStatus(record, nowMs),
    version: record.version,
    challengeKey: record.challengeKey,
    name: c.name,
    description: c.description,
    timeZone: c.timeZone,
    startsAt: record.startsAt,
    endsAt: record.endsAt,
    announcement: structuredClone(c.announcement),
    eligibility: structuredClone(c.eligibility),
    rules: structuredClone(c.rules),
    rewards: structuredClone(c.rewards)
  };
}

/**
 * The authoritative schedule for one environment. Drafts, archived events, authors and history never appear.
 * @param {{environment: string, revision: number, flags: Object, events: Array<Object>}} workspace
 * @param {number} nowMs the server's clock
 */
export function buildPublicPayload(workspace, nowMs) {
  const published = [];
  for (const record of workspace.events) {
    if (record.status === 'draft' || record.status === 'archived') continue;
    const status = effectiveStatus(record, nowMs);
    const start = Date.parse(record.startsAt);
    const end = Date.parse(record.endsAt);
    if (status === 'scheduled' && start - nowMs > PUBLIC_HORIZON.aheadMs) continue;
    if (status === 'completed' && nowMs - end > PUBLIC_HORIZON.completedMs) continue;
    if (status === 'cancelled' && (!record.scheduledAt || nowMs - Date.parse(record.cancelledAt || record.endsAt) > PUBLIC_HORIZON.cancelledMs)) continue;
    published.push({ record, status, start, end });
  }
  const order = { active: 0, scheduled: 1, completed: 2, cancelled: 3 };
  published.sort((a, b) => order[a.status] - order[b.status] || (a.status === 'completed' || a.status === 'cancelled' ? b.end - a.end : a.start - b.start) || (a.record.id < b.record.id ? -1 : 1));
  return {
    schemaVersion: LIVEOPS_SCHEMA_VERSION,
    environment: workspace.environment,
    revision: workspace.revision,
    serverTime: formatInstant(nowMs),
    staleAfterSeconds: DEFAULT_STALE_AFTER_SECONDS,
    flags: normalizeFlags(workspace.flags),
    events: published.slice(0, PUBLIC_HORIZON.maxEvents).map(({ record }) => toPublicEvent(record, nowMs))
  };
}

/**
 * Strictly validate a downloaded payload. One invalid event, flag or field rejects everything: a schedule that was
 * tampered with in transit is not applied half-way.
 * @param {*} payload
 * @param {string} environment the environment the game asked for
 * @returns {string[]} problems (empty = valid)
 */
export function validatePublicPayload(payload, environment) {
  const errors = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ['payload: required object'];
  const known = ['schemaVersion', 'environment', 'revision', 'serverTime', 'staleAfterSeconds', 'flags', 'events'];
  for (const key of Object.keys(payload)) if (!known.includes(key)) errors.push(`payload.${key}: unknown field`);
  if (payload.schemaVersion !== LIVEOPS_SCHEMA_VERSION) errors.push('payload.schemaVersion: unsupported');
  if (payload.environment !== environment) errors.push('payload.environment: does not match the requested environment');
  if (!Number.isInteger(payload.revision) || payload.revision < 0) errors.push('payload.revision: expected a non-negative integer');
  if (!Number.isFinite(parseInstant(payload.serverTime))) errors.push('payload.serverTime: expected a UTC instant');
  if (!Number.isInteger(payload.staleAfterSeconds) || payload.staleAfterSeconds < 60 || payload.staleAfterSeconds > 7 * 86400) errors.push('payload.staleAfterSeconds: expected an integer between 60 and 604800');
  errors.push(...validateFlags(payload.flags));
  if (!Array.isArray(payload.events) || payload.events.length > PUBLIC_HORIZON.maxEvents) errors.push(`payload.events: expected a list of at most ${PUBLIC_HORIZON.maxEvents} events`);
  else {
    const seen = new Set();
    payload.events.forEach((event, index) => {
      for (const problem of validatePublicEvent(event)) errors.push(`events[${index}]: ${problem}`);
      if (event && typeof event.id === 'string') {
        if (seen.has(event.id)) errors.push(`events[${index}].id: duplicate ${event.id}`);
        seen.add(event.id);
      }
    });
  }
  return errors.slice(0, 20);
}

/** Events of a kind that are live at `nowMs`, soonest-ending first. Works on published events. */
export function liveEvents(events, nowMs, kind) {
  return events
    .filter((event) => (!kind || event.kind === kind) && eventPhase(event, nowMs) === 'live')
    .sort((a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt) || (a.id < b.id ? -1 : 1));
}

// ---------------------------------------------------------------------------------------------------------------------
// Generators (deterministic: the same input always creates the same drafts)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Daily challenge drafts for consecutive dates, using the built-in rotation (the same modifier a player gets offline)
 * as the starting point. Dates that already have an event are skipped.
 * @param {{startDate: string, days: number, timeZone?: string, existingKeys?: string[]}} params
 * @returns {{contents: Object[], skipped: string[], errors: string[]}}
 */
export function generateDailyContents({ startDate, days, timeZone = 'UTC', existingKeys = [] }) {
  const errors = [];
  if (!isDateKey(startDate)) errors.push('startDate: expected a date like 2026-12-01');
  if (!Number.isInteger(days) || days < 1 || days > 31) errors.push('days: expected an integer between 1 and 31');
  if (!isTimeZone(timeZone)) errors.push('timeZone: unknown time zone');
  if (errors.length) return { contents: [], skipped: [], errors };
  const taken = new Set(existingKeys);
  const contents = [];
  const skipped = [];
  for (let i = 0; i < days; i++) {
    const key = addDays(startDate, i);
    if (taken.has(key)) {
      skipped.push(key);
      continue;
    }
    const legacy = getDailyChallenge(key);
    contents.push(createEventContent('daily', {
      id: `daily-${key}`,
      name: legacy.modifier.name,
      description: legacy.modifier.desc,
      timeZone,
      schedule: { startLocal: `${key}T00:00`, endLocal: `${addDays(key, 1)}T00:00` },
      rules: modifierToRules(legacy.modifier)
    }));
  }
  return { contents, skipped, errors };
}

/**
 * Random-event drafts: `count` short windows scattered over a date range, chosen by a seeded generator so the same
 * parameters always produce the same schedule (and a bad one can be regenerated with another seed). Windows never
 * overlap each other or `occupied`, keep `minGapMinutes` apart, start inside the allowed hours of the zone and are
 * checked against DST gaps and overlaps.
 * @param {Object} params
 * @param {string} params.seed any text
 * @param {string} params.fromDate first local date (inclusive)
 * @param {number} params.days length of the date range (1–31)
 * @param {number} params.count how many events (1–20)
 * @param {[number, number]} params.durationMinutes shortest and longest event, multiples of 5
 * @param {number} params.minGapMinutes
 * @param {[number, number]} params.hours local hours events may start in: [first, last+1), e.g. [18, 22]
 * @param {string} params.timeZone
 * @param {string[]} [params.presetIds] random presets to draw from (default: all)
 * @param {Array<{startsAt: string, endsAt: string}>} [params.occupied] windows of existing random events
 * @param {string[]} [params.takenIds] ids that already exist
 * @returns {{contents: Object[], shortfall: number, errors: string[]}}
 */
export function generateRandomContents(params) {
  const { seed, fromDate, days, count, durationMinutes, minGapMinutes = 0, hours, timeZone = 'UTC', presetIds = [], occupied = [], takenIds = [] } = params;
  const errors = [];
  if (typeof seed !== 'string' || !seed.trim() || seed.length > 64) errors.push('seed: expected 1–64 characters');
  if (!isDateKey(fromDate)) errors.push('fromDate: expected a date like 2026-12-01');
  if (!Number.isInteger(days) || days < 1 || days > 31) errors.push('days: expected an integer between 1 and 31');
  if (!Number.isInteger(count) || count < 1 || count > 20) errors.push('count: expected an integer between 1 and 20');
  if (!isTimeZone(timeZone)) errors.push('timeZone: unknown time zone');
  const [minLen, maxLen] = Array.isArray(durationMinutes) ? durationMinutes : [NaN, NaN];
  const info = KIND_INFO.random;
  if (![minLen, maxLen].every((n) => Number.isInteger(n) && n % 5 === 0) || minLen > maxLen || minLen * MINUTE < info.minDuration || maxLen * MINUTE > info.maxDuration) {
    errors.push(`durationMinutes: expected [shortest, longest] in multiples of 5 between ${info.minDuration / MINUTE} and ${info.maxDuration / MINUTE}`);
  }
  if (!Number.isInteger(minGapMinutes) || minGapMinutes < 0 || minGapMinutes > 7 * 24 * 60) errors.push('minGapMinutes: expected an integer between 0 and 10080');
  const [firstHour, endHour] = Array.isArray(hours) ? hours : [NaN, NaN];
  if (![firstHour, endHour].every(Number.isInteger) || firstHour < 0 || endHour > 24 || firstHour >= endHour) errors.push('hours: expected [first, last+1] with 0 <= first < last+1 <= 24');
  const pool = EVENT_PRESETS.filter((p) => p.kind === 'random' && (presetIds.length === 0 || presetIds.includes(p.id)));
  if (pool.length === 0) errors.push('presetIds: no matching random preset');
  if (errors.length) return { contents: [], shortfall: 0, errors };

  const rng = mulberry32(hashSeed(`liveops-random:${seed}`));
  const windows = occupied.map((w) => ({ start: Date.parse(w.startsAt), end: Date.parse(w.endsAt) })).filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end));
  const ids = new Set(takenIds);
  const gap = minGapMinutes * MINUTE;
  const contents = [];
  let shortfall = 0;

  for (let n = 0; n < count; n++) {
    let placed = false;
    for (let attempt = 0; attempt < 300 && !placed; attempt++) {
      const date = addDays(fromDate, Math.floor(rng() * days));
      const startMinute = firstHour * 60 + Math.floor(rng() * (((endHour - firstHour) * 60) / 5)) * 5;
      const length = minLen + Math.floor(rng() * ((maxLen - minLen) / 5 + 1)) * 5;
      const preset = pool[Math.floor(rng() * pool.length)];
      const startLocal = `${date}T${String(Math.floor(startMinute / 60)).padStart(2, '0')}:${String(startMinute % 60).padStart(2, '0')}`;
      // The end is the same wall clock plus the length, so a window that crosses midnight is still written as plain local times
      const endLocal = formatInstant(Date.parse(`${startLocal}:00Z`) + length * MINUTE).slice(0, 16);
      const a = resolveLocal(startLocal, timeZone);
      const b = resolveLocal(endLocal, timeZone);
      if (a.status !== 'ok' || b.status !== 'ok') continue; // a DST gap or overlap: try another slot
      if (b.ms - a.ms < info.minDuration || b.ms - a.ms > info.maxDuration) continue;
      if (windows.some((w) => a.ms < w.end + gap && w.start - gap < b.ms)) continue;
      const id = `random-${date.replaceAll('-', '')}-${startLocal.slice(11, 13)}${startLocal.slice(14, 16)}-${preset.id}`.slice(0, LIMITS.eventId);
      if (ids.has(id)) continue;
      ids.add(id);
      windows.push({ start: a.ms, end: b.ms });
      contents.push(createEventContent('random', {
        id,
        name: preset.name,
        description: preset.description,
        timeZone,
        schedule: { startLocal, endLocal },
        announcement: { enabled: true, title: preset.name, body: preset.description, leadHours: 0, tone: 'event' },
        rules: preset.rules
      }));
      placed = true;
    }
    if (!placed) shortfall++;
  }
  contents.sort((a, b) => (a.schedule.startLocal < b.schedule.startLocal ? -1 : 1));
  return { contents, shortfall, errors };
}

