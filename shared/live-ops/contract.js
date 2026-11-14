/**
 * @file shared/live-ops/contract.js
 * @description The wire contract for Live Operations: what an event is, what a rule may do, how rewards are
 * earned and checked, how challenge seeds and leaderboard boards are derived, and how feature flags roll out.
 *
 * Pure and isomorphic: the admin server validates with it, the admin app edits against it, and the game uses the very
 * same functions to decide what is live and whether a reward may be granted. Like `game-configuration.js` the schema
 * is STRICT: every field is required and unknown fields are rejected. Changing a field is a breaking change and needs a
 * LIVEOPS_SCHEMA_VERSION bump plus a coordinated game release.
 */

import { RUNES, DIFFICULTY_LEVELS } from '../../src/core/Constants.js';
import { TRAILS, HATS, DEFAULT_TRAIL, DEFAULT_HAT } from '../../src/core/Cosmetics.js';
import { hashSeed, getDailyChallenge } from '../../src/core/Challenge.js';
import {
  DAY, HOUR, MINUTE, MIN_YEAR, MAX_YEAR,
  addDays, formatInstant, isTimeZone, isoWeekday, isoWeekKey, parseInstant, parseLocal, resolveLocal, startOfLocalDay
} from './time.js';

export const LIVEOPS_SCHEMA_VERSION = 1;

export const EVENT_KINDS = ['daily', 'weekly', 'seasonal', 'random'];
export const EVENT_STATUSES = ['draft', 'scheduled', 'active', 'completed', 'archived', 'cancelled'];
/** Statuses in which an event takes part in the live schedule (and can therefore conflict with another one) */
export const LIVE_STATUSES = ['scheduled', 'active'];

/** Run types an event can be bound to. DAILY / WEEKLY are the challenge runs themselves. */
export const ALL_MODES = ['DAILY', 'WEEKLY', 'ENDLESS', 'STORY'];
/** Run types a seasonal / random overlay may target */
export const OVERLAY_MODES = ['ENDLESS', 'STORY'];
export const DIFFICULTY_IDS = Object.keys(DIFFICULTY_LEVELS);
/** Score formulas this build understands (see docs/live-operations.md "Score versions") */
export const SCORE_VERSIONS = [1, 2];
/** Gestures a rule may restrict ghosts to: the five combat runes (heart / circle / spiral belong to tactical ghosts) */
export const COMBAT_RUNES = ['horizontal', 'vertical', 'caret', 'v_shape', 'lightning'];
export const VISUAL_THEMES = ['none', 'frost', 'ember', 'twilight', 'gold', 'verdant', 'blossom'];
export const AMBIENT_EFFECTS = ['none', 'snow', 'embers', 'stars', 'petals', 'sparkles'];
export const ANNOUNCEMENT_TONES = ['info', 'event', 'urgent'];
export const REWARD_TYPES = ['cosmetic', 'badge'];
export const REWARD_METRICS = ['runs', 'bestScore', 'bestWave', 'bestCombo'];

export const LIMITS = {
  name: 80,
  description: 400,
  announcementTitle: 60,
  announcementBody: 240,
  badgeLabel: 40,
  seedSalt: 32,
  eventId: 48,
  rewardId: 32,
  rewards: 8,
  cosmeticRewards: 4,
  leadHours: 14 * 24,
  /** Per environment: events that are not archived */
  eventsPerEnvironment: 1000
};

/** A combination of overlapping events must stay inside these bounds (see schedule.js findConflicts) */
export const SAFE_LIMITS = {
  speed: [0.4, 3],
  interval: [0.3, 3],
  score: [1, 5]
};

/** Reward thresholds: the ceiling per metric (what the game can actually reach) */
export const METRIC_CEILING = { runs: 1000, bestScore: 1000000, bestWave: 999, bestCombo: 999 };

/**
 * What each kind of event means. `calendar` kinds are aligned to a day / ISO week in the event's time zone, so their
 * real length varies with DST by up to an hour: 23–25 hours for a day, 167–169 for a week.
 */
export const KIND_INFO = {
  daily: {
    label: 'Daily challenge', calendar: 'day', channel: 'daily', modes: ['DAILY'], seeded: true, fixedDifficulty: true,
    minDuration: 23 * HOUR, maxDuration: 25 * HOUR
  },
  weekly: {
    label: 'Weekly challenge', calendar: 'week', channel: 'weekly', modes: ['WEEKLY'], seeded: true, fixedDifficulty: true,
    minDuration: 7 * DAY - HOUR, maxDuration: 7 * DAY + HOUR
  },
  seasonal: {
    label: 'Seasonal event', calendar: null, channel: 'seasonal', modes: null, seeded: false, fixedDifficulty: false,
    minDuration: DAY, maxDuration: 120 * DAY
  },
  random: {
    label: 'Random event', calendar: null, channel: 'random', modes: null, seeded: false, fixedDifficulty: false,
    minDuration: 5 * MINUTE, maxDuration: 72 * HOUR
  }
};

export const isChallengeKind = (kind) => Boolean(KIND_INFO[kind]?.calendar);

// ---------------------------------------------------------------------------------------------------------------------
// Strict schema interpreter (same spirit as shared/gameplay-content.js)
// ---------------------------------------------------------------------------------------------------------------------

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const object = (fields) => ({ t: 'object', fields });
const text = (max, options = {}) => ({ t: 'text', max, min: 0, multiline: false, ...options });
const int = (min, max) => ({ t: 'int', min, max });
const num = (min, max) => ({ t: 'num', min, max });
const bool = () => ({ t: 'bool' });
const oneOf = (options) => ({ t: 'enum', options });
const list = (item, options = {}) => ({ t: 'list', item, max: 500, unique: false, ...options });
const custom = (fn) => ({ t: 'custom', fn });

// Control characters (and, in single-line fields, newlines) never belong in event text
const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0009\u000b-\u001f\u007f]/;

function check(spec, value, path, errors) {
  switch (spec.t) {
    case 'object': {
      if (!isObject(value)) {
        errors.push(`${path}: required object`);
        return;
      }
      for (const key of Object.keys(value)) if (!Object.hasOwn(spec.fields, key)) errors.push(`${path}.${key}: unknown field`);
      for (const [key, child] of Object.entries(spec.fields)) check(child, value[key], `${path}.${key}`, errors);
      return;
    }
    case 'text': {
      if (typeof value !== 'string') errors.push(`${path}: expected text`);
      else if (value.length > spec.max || value.length < spec.min) errors.push(`${path}: expected ${spec.min > 0 ? `${spec.min}–` : 'up to '}${spec.max} characters`);
      else if ((spec.multiline ? CONTROL_EXCEPT_NEWLINE : CONTROL).test(value)) errors.push(`${path}: control characters are not allowed`);
      else if (spec.min > 0 && !value.trim()) errors.push(`${path}: cannot be blank`);
      return;
    }
    case 'int':
    case 'num': {
      const ok = typeof value === 'number' && Number.isFinite(value) && value >= spec.min && value <= spec.max && (spec.t === 'num' || Number.isInteger(value));
      if (!ok) errors.push(`${path}: expected ${spec.t === 'int' ? 'integer' : 'number'} in ${spec.min}–${spec.max}`);
      return;
    }
    case 'bool':
      if (typeof value !== 'boolean') errors.push(`${path}: expected true or false`);
      return;
    case 'enum':
      if (!spec.options.includes(value)) errors.push(`${path}: expected one of ${spec.options.join(', ')}`);
      return;
    case 'list': {
      if (!Array.isArray(value) || value.length > spec.max) {
        errors.push(`${path}: expected a list with at most ${spec.max} entries`);
        return;
      }
      value.forEach((item, index) => check(spec.item, item, `${path}[${index}]`, errors));
      if (spec.unique && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(`${path}: entries must be unique`);
      return;
    }
    case 'custom':
      spec.fn(value, path, errors);
      return;
    default:
      errors.push(`${path}: unsupported schema`);
  }
}

const slug = (max) => custom((value, path, errors) => {
  if (typeof value !== 'string' || !new RegExp(`^[a-z0-9][a-z0-9-]{1,${max - 1}}$`).test(value)) {
    errors.push(`${path}: expected 2–${max} lowercase letters, digits or hyphens, starting with a letter or digit`);
  }
});

const timeZoneField = custom((value, path, errors) => {
  if (!isTimeZone(value)) errors.push(`${path}: unknown time zone (use an IANA name such as Asia/Ho_Chi_Minh or UTC)`);
});

const localField = custom((value, path, errors) => {
  if (parseLocal(value) === null) errors.push(`${path}: expected a wall-clock time like 2026-12-01T19:30`);
});

const seedSaltField = custom((value, path, errors) => {
  if (typeof value !== 'string' || value.length > LIMITS.seedSalt || !/^[A-Za-z0-9_-]*$/.test(value)) {
    errors.push(`${path}: expected up to ${LIMITS.seedSalt} letters, digits, hyphens or underscores`);
  }
});

const CONTENT_SPEC = object({
  id: slug(LIMITS.eventId),
  kind: oneOf(EVENT_KINDS),
  name: text(LIMITS.name, { min: 1 }),
  description: text(LIMITS.description, { multiline: true }),
  timeZone: timeZoneField,
  schedule: object({ startLocal: localField, endLocal: localField }),
  announcement: object({
    enabled: bool(),
    title: text(LIMITS.announcementTitle),
    body: text(LIMITS.announcementBody, { multiline: true }),
    leadHours: int(0, LIMITS.leadHours),
    tone: oneOf(ANNOUNCEMENT_TONES)
  }),
  eligibility: object({
    modes: list(oneOf(ALL_MODES), { max: 4, unique: true }),
    difficulties: list(oneOf(DIFFICULTY_IDS), { max: 3, unique: true }),
    minStoryLevelsCleared: int(0, 5),
    allowAssisted: bool()
  }),
  rules: object({
    difficulty: oneOf(['PLAYER', ...DIFFICULTY_IDS]),
    scoreVersion: oneOf(SCORE_VERSIONS),
    seedSalt: seedSaltField,
    enemy: object({
      speedMultiplier: num(0.5, 2),
      // The pool ghosts draw from. A gesture listed twice is drawn twice as often (the built-in "Bão Sét" twist does exactly that).
      runes: list(oneOf(COMBAT_RUNES), { max: 12 }),
      noHearts: bool()
    }),
    spawn: object({ intervalMultiplier: num(0.5, 2), surpriseMultiplier: num(0, 3) }),
    player: object({ maxHp: int(0, 5) }),
    score: object({ multiplier: num(1, 3) }),
    visual: object({ theme: oneOf(VISUAL_THEMES), ambient: oneOf(AMBIENT_EFFECTS) })
  }),
  rewards: list(
    object({
      id: slug(LIMITS.rewardId),
      type: oneOf(REWARD_TYPES),
      ref: text(32),
      label: text(LIMITS.badgeLabel),
      condition: object({ metric: oneOf(REWARD_METRICS), threshold: int(1, 1000000) })
    }),
    { max: LIMITS.rewards }
  )
});

// ---------------------------------------------------------------------------------------------------------------------
// Event content: defaults, validation, canonical form
// ---------------------------------------------------------------------------------------------------------------------

function merge(base, extra) {
  if (!isObject(extra)) return base;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) out[key] = isObject(value) && isObject(base[key]) ? merge(base[key], value) : structuredClone(value);
  return out;
}

/**
 * A complete, schema-shaped event with neutral rules.
 * @param {'daily'|'weekly'|'seasonal'|'random'} [kind]
 * @param {Object} [overrides] deep-merged over the defaults (arrays are replaced, not merged)
 */
export function createEventContent(kind = 'seasonal', overrides = {}) {
  const info = KIND_INFO[kind] || KIND_INFO.seasonal;
  return merge({
    id: '',
    kind,
    name: '',
    description: '',
    timeZone: 'UTC',
    schedule: { startLocal: '', endLocal: '' },
    announcement: { enabled: false, title: '', body: '', leadHours: 24, tone: 'event' },
    eligibility: { modes: info.modes ? [...info.modes] : ['ENDLESS'], difficulties: [], minStoryLevelsCleared: 0, allowAssisted: false },
    rules: {
      difficulty: info.fixedDifficulty ? 'NORMAL' : 'PLAYER',
      scoreVersion: 1,
      seedSalt: '',
      enemy: { speedMultiplier: 1, runes: [], noHearts: false },
      spawn: { intervalMultiplier: 1, surpriseMultiplier: 1 },
      player: { maxHp: 0 },
      score: { multiplier: 1 },
      visual: { theme: 'none', ambient: 'none' }
    },
    rewards: []
  }, overrides);
}

/** Do the rules change how a run plays or scores? (visual effects and rewards do not) */
export function altersGameplay(rules) {
  return rules.enemy.speedMultiplier !== 1 || rules.enemy.runes.length > 0 || rules.enemy.noHearts
    || rules.spawn.intervalMultiplier !== 1 || rules.spawn.surpriseMultiplier !== 1
    || rules.player.maxHp !== 0 || rules.score.multiplier !== 1;
}

/** Cosmetics an event may hand out: everything except what every player owns from the start */
export function grantableCosmetics() {
  return [
    ...TRAILS.filter((t) => t.id !== DEFAULT_TRAIL).map((t) => `trail:${t.id}`),
    ...HATS.filter((h) => h.id !== DEFAULT_HAT).map((h) => `hat:${h.id}`)
  ];
}

function checkRewards(content, errors) {
  const seenIds = new Set();
  const seenRefs = new Set();
  let cosmetics = 0;
  const grantable = new Set(grantableCosmetics());
  content.rewards.forEach((reward, index) => {
    const path = `rewards[${index}]`;
    if (seenIds.has(reward.id)) errors.push(`${path}.id: duplicate reward id ${reward.id}`);
    seenIds.add(reward.id);
    if (reward.type === 'cosmetic') {
      cosmetics++;
      if (!grantable.has(reward.ref)) errors.push(`${path}.ref: unknown cosmetic (expected trail:<id> or hat:<id> from the game's wardrobe, not a default one)`);
      if (reward.label !== '') errors.push(`${path}.label: must be empty for a cosmetic (its name comes from the game)`);
    } else if (reward.type === 'badge') {
      if (reward.ref.length < 1 || reward.ref.length > 8 || !reward.ref.trim() || CONTROL.test(reward.ref)) errors.push(`${path}.ref: expected an icon of 1–8 characters`);
      if (!reward.label.trim()) errors.push(`${path}.label: a badge needs a name`);
    }
    const key = `${reward.type}:${reward.ref}`;
    if (seenRefs.has(key)) errors.push(`${path}.ref: the same reward is already offered by this event`);
    seenRefs.add(key);
    const ceiling = METRIC_CEILING[reward.condition.metric];
    if (reward.condition.threshold > ceiling) errors.push(`${path}.condition.threshold: at most ${ceiling} for ${reward.condition.metric}`);
  });
  if (cosmetics > LIMITS.cosmeticRewards) errors.push(`rewards: at most ${LIMITS.cosmeticRewards} cosmetics per event`);
}

/** Rules that depend on the kind of event but not on its schedule (so published events, which carry no wall-clock times, use them too) */
function checkRules(content, errors) {
  const info = KIND_INFO[content.kind];
  const { eligibility, rules } = content;

  if (eligibility.modes.length === 0) errors.push('eligibility.modes: choose at least one mode');
  else if (info.modes) {
    if (eligibility.modes.length !== info.modes.length || !info.modes.every((m) => eligibility.modes.includes(m))) {
      errors.push(`eligibility.modes: a ${content.kind} challenge is always ${info.modes.join(', ')}`);
    }
  } else if (!eligibility.modes.every((m) => OVERLAY_MODES.includes(m))) {
    errors.push(`eligibility.modes: a ${content.kind} event can target ${OVERLAY_MODES.join(' and ')} runs only`);
  }

  if (info.fixedDifficulty) {
    if (rules.difficulty === 'PLAYER') errors.push('rules.difficulty: a challenge needs one fixed difficulty so scores are comparable');
    if (eligibility.difficulties.length) errors.push('eligibility.difficulties: not used by a challenge (its difficulty is fixed)');
  } else if (rules.difficulty !== 'PLAYER') {
    errors.push('rules.difficulty: an event never overrides the difficulty the player chose');
  }
  if (!info.seeded && rules.seedSalt) errors.push('rules.seedSalt: only daily and weekly challenges are seeded');
  if (rules.score.multiplier !== 1 && rules.scoreVersion < 2) errors.push('rules.score.multiplier: needs score version 2 (version 1 keeps the classic score)');

  // Story levels are authored: a Story-only event can change the look and the rewards, not the fight
  if (!info.modes && eligibility.modes.length > 0 && eligibility.modes.every((m) => m === 'STORY') && altersGameplay(rules)) {
    errors.push('rules: a Story-only event may only change visual effects and rewards');
  }

  if (content.announcement.enabled && (!content.announcement.title.trim() || !content.announcement.body.trim())) {
    errors.push('announcement: an enabled announcement needs a title and a body');
  }
}

/** The shape of the authored schedule for the event's kind (calendar-aligned kinds are fixed to whole days / weeks) */
function checkSchedule(content, errors) {
  const info = KIND_INFO[content.kind];
  const start = parseLocal(content.schedule.startLocal);
  const end = parseLocal(content.schedule.endLocal);
  if (info.calendar === 'day') {
    if (start.hour !== 0 || start.minute !== 0) errors.push('schedule.startLocal: a daily challenge starts at 00:00');
    else if (content.schedule.endLocal !== `${addDays(start.date, 1)}T00:00`) errors.push('schedule.endLocal: a daily challenge ends at 00:00 the next day');
  } else if (info.calendar === 'week') {
    if (isoWeekday(start.date) !== 1 || start.hour !== 0 || start.minute !== 0) errors.push('schedule.startLocal: a weekly challenge starts on a Monday at 00:00');
    else if (content.schedule.endLocal !== `${addDays(start.date, 7)}T00:00`) errors.push('schedule.endLocal: a weekly challenge ends the next Monday at 00:00');
  } else if (end.wallMs <= start.wallMs) {
    errors.push('schedule.endLocal: must be after the start');
  }
}

/**
 * Validate an event's content (what an editor sends). Time-zone resolution of the window is separate: see
 * resolveEventWindow. Returns an empty array when the content is sound.
 * @param {*} content
 * @returns {string[]}
 */
export function validateEventContent(content) {
  const errors = [];
  check(CONTENT_SPEC, content, 'event', errors);
  if (errors.length) return errors;
  checkRules(content, errors);
  checkSchedule(content, errors);
  checkRewards(content, errors);
  return errors;
}

const PUBLIC_STATUSES = ['scheduled', 'active', 'completed', 'cancelled'];
const instantField = custom((value, path, errors) => {
  if (!Number.isFinite(parseInstant(value))) errors.push(`${path}: expected a UTC instant like 2026-12-01T12:30:00Z`);
});
const CHALLENGE_KEY = { daily: /^\d{4}-\d{2}-\d{2}$/, weekly: /^\d{4}-W\d{2}$/ };

const PUBLIC_EVENT_SPEC = object({
  id: CONTENT_SPEC.fields.id,
  kind: CONTENT_SPEC.fields.kind,
  status: oneOf(PUBLIC_STATUSES),
  version: int(1, 1000000),
  challengeKey: text(LIMITS.eventId, { min: 1 }),
  name: CONTENT_SPEC.fields.name,
  description: CONTENT_SPEC.fields.description,
  timeZone: CONTENT_SPEC.fields.timeZone,
  startsAt: instantField,
  endsAt: instantField,
  announcement: CONTENT_SPEC.fields.announcement,
  eligibility: CONTENT_SPEC.fields.eligibility,
  rules: CONTENT_SPEC.fields.rules,
  rewards: CONTENT_SPEC.fields.rewards
});

/**
 * Validate an event as the public endpoint serves it (see schedule.js toPublicEvent). The game runs this on every event
 * it downloads; one bad event rejects the whole payload, so a half-tampered schedule is never applied.
 * @param {*} event
 * @returns {string[]}
 */
export function validatePublicEvent(event) {
  const errors = [];
  check(PUBLIC_EVENT_SPEC, event, 'event', errors);
  if (errors.length) return errors;
  checkRules(event, errors);
  checkRewards(event, errors);
  if (!(parseInstant(event.endsAt) > parseInstant(event.startsAt))) errors.push('event.endsAt: must be after startsAt');
  const pattern = CHALLENGE_KEY[event.kind];
  if (pattern ? !pattern.test(event.challengeKey) : event.challengeKey !== event.id) errors.push('event.challengeKey: does not match the kind of event');
  return errors;
}

/**
 * Turn an event's authored schedule into authoritative UTC instants.
 * Daily and weekly challenges cover whole calendar days / ISO weeks of the event's zone (so 23 or 25 hours on a DST
 * day). Seasonal and random events are free wall-clock windows; a time that does not exist or happens twice in the
 * zone is refused rather than guessed.
 * @param {Object} content a content object that already passed validateEventContent
 * @returns {{ok: boolean, errors: string[], startMs?: number, endMs?: number, startsAt?: string, endsAt?: string, challengeKey?: string}}
 */
export function resolveEventWindow(content) {
  const errors = [];
  const info = KIND_INFO[content?.kind];
  const start = parseLocal(content?.schedule?.startLocal);
  const end = parseLocal(content?.schedule?.endLocal);
  if (!info || !start || !end || !isTimeZone(content.timeZone)) return { ok: false, errors: ['schedule: invalid time, kind or time zone'] };
  const zone = content.timeZone;
  let startMs;
  let endMs;
  let challengeKey = content.id;

  if (info.calendar) {
    startMs = startOfLocalDay(start.date, zone);
    endMs = startOfLocalDay(addDays(start.date, info.calendar === 'day' ? 1 : 7), zone);
    challengeKey = info.calendar === 'day' ? start.date : isoWeekKey(start.date);
  } else {
    const explain = (field, resolved, local) => {
      if (resolved.status === 'gap') errors.push(`schedule.${field}: ${local} does not exist in ${zone} (the clock skips it); choose another time`);
      else if (resolved.status === 'ambiguous') errors.push(`schedule.${field}: ${local} happens twice in ${zone} (the clock repeats it); choose another time`);
      else if (resolved.status !== 'ok') errors.push(`schedule.${field}: invalid time`);
    };
    const a = resolveLocal(content.schedule.startLocal, zone);
    const b = resolveLocal(content.schedule.endLocal, zone);
    explain('startLocal', a, content.schedule.startLocal);
    explain('endLocal', b, content.schedule.endLocal);
    if (errors.length) return { ok: false, errors };
    startMs = a.ms;
    endMs = b.ms;
  }

  if (!(endMs > startMs)) errors.push('schedule: the event must end after it starts');
  else if (endMs - startMs < info.minDuration || endMs - startMs > info.maxDuration) {
    const show = (ms) => (ms >= DAY ? `${Math.round(ms / DAY)} day(s)` : ms >= HOUR ? `${Math.round(ms / HOUR)} hour(s)` : `${Math.round(ms / MINUTE)} minute(s)`);
    errors.push(`schedule: a ${content.kind} event lasts between ${show(info.minDuration)} and ${show(info.maxDuration)}`);
  }
  if (Date.UTC(MIN_YEAR, 0, 1) > startMs || endMs >= Date.UTC(MAX_YEAR, 0, 1)) errors.push(`schedule: times must fall between ${MIN_YEAR} and ${MAX_YEAR}`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors, startMs, endMs, startsAt: formatInstant(startMs), endsAt: formatInstant(endMs), challengeKey };
}

/** Keys sorted, so two equal contents always serialise identically (used to detect changes between versions) */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** Top-level sections of an event that differ between two contents */
export function changedSections(before, after) {
  if (!before) return Object.keys(after);
  return Object.keys(after).filter((key) => canonicalJson(before[key]) !== canonicalJson(after[key]));
}

// ---------------------------------------------------------------------------------------------------------------------
// Rules -> what the game applies
// ---------------------------------------------------------------------------------------------------------------------

const THEME_ICON = { none: '📅', frost: '❄️', ember: '🔥', twilight: '🌙', gold: '🌟', verdant: '🌿', blossom: '🌸' };

/**
 * The modifier object WaveSystem understands (same shape as Challenge.js DAILY_MODIFIERS), with a key present ONLY when
 * the rule changes something: WaveSystem treats `runes: []` as "restrict to nothing", so an empty list must be absent.
 * @param {{id: string, name: string, description: string, rules: Object}} event
 */
export function rulesToModifier(event) {
  const { rules } = event;
  const modifier = {
    id: event.id,
    icon: THEME_ICON[rules.visual.theme] || THEME_ICON.none,
    name: event.name,
    desc: event.description
  };
  if (rules.enemy.runes.length) modifier.runes = [...rules.enemy.runes];
  if (rules.enemy.noHearts) modifier.noHearts = true;
  if (rules.enemy.speedMultiplier !== 1) modifier.speed = rules.enemy.speedMultiplier;
  if (rules.spawn.intervalMultiplier !== 1) modifier.spawn = rules.spawn.intervalMultiplier;
  if (rules.player.maxHp > 0) modifier.maxHp = rules.player.maxHp;
  return modifier;
}

/** The inverse for the built-in rotation: a Challenge.js DAILY_MODIFIERS entry expressed as schema rules */
export function modifierToRules(modifier) {
  return {
    ...createEventContent('daily').rules,
    enemy: {
      speedMultiplier: modifier.speed || 1,
      runes: modifier.runes ? [...modifier.runes] : [],
      noHearts: Boolean(modifier.noHearts)
    },
    spawn: { intervalMultiplier: modifier.spawn || 1, surpriseMultiplier: 1 },
    player: { maxHp: modifier.maxHp || 0 }
  };
}

/**
 * Combine the rules of events that are live at the same time (a seasonal event and a random one): multipliers
 * multiply, "no hearts" is an OR, hearts take the smaller value, rune restrictions intersect.
 * `conflict` is set when the restrictions leave no gesture at all.
 * @param {Array<Object>} ruleSets `rules` objects, highest priority first (visuals come from the first one that sets one)
 */
export function mergeRules(ruleSets) {
  const merged = {
    speedMultiplier: 1, intervalMultiplier: 1, surpriseMultiplier: 1, scoreMultiplier: 1,
    noHearts: false, maxHp: 0, runes: [], conflict: false,
    theme: 'none', ambient: 'none'
  };
  let restricted = null;
  for (const rules of ruleSets) {
    merged.speedMultiplier *= rules.enemy.speedMultiplier;
    merged.intervalMultiplier *= rules.spawn.intervalMultiplier;
    merged.surpriseMultiplier *= rules.spawn.surpriseMultiplier;
    merged.scoreMultiplier *= rules.score.multiplier;
    merged.noHearts = merged.noHearts || rules.enemy.noHearts;
    if (rules.player.maxHp > 0) merged.maxHp = merged.maxHp ? Math.min(merged.maxHp, rules.player.maxHp) : rules.player.maxHp;
    if (rules.enemy.runes.length) restricted = restricted ? restricted.filter((r) => rules.enemy.runes.includes(r)) : [...rules.enemy.runes];
    if (merged.theme === 'none') merged.theme = rules.visual.theme;
    if (merged.ambient === 'none') merged.ambient = rules.visual.ambient;
  }
  if (restricted) {
    merged.runes = restricted;
    merged.conflict = restricted.length === 0;
  }
  return merged;
}

/**
 * May this run take part in the event?
 * @param {Object} event
 * @param {{mode: string, difficulty: string, assisted: boolean, storyLevelsCleared: number}} ctx
 * @returns {{ok: boolean, reason: string|null}}
 */
export function checkEligibility(event, ctx) {
  const e = event.eligibility;
  if (!e.modes.includes(ctx.mode)) return { ok: false, reason: 'mode' };
  if (e.difficulties.length && !e.difficulties.includes(ctx.difficulty)) return { ok: false, reason: 'difficulty' };
  if ((ctx.storyLevelsCleared || 0) < e.minStoryLevelsCleared) return { ok: false, reason: 'progress' };
  if (ctx.assisted && !e.allowAssisted) return { ok: false, reason: 'assisted' };
  return { ok: true, reason: null };
}

// ---------------------------------------------------------------------------------------------------------------------
// Challenge identity: seed, board, built-in fallback
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Deterministic seed of a daily / weekly challenge. With no salt a daily challenge gets EXACTLY the seed the built-in
 * rotation has always used for that date, so a friend playing offline and a player on the live schedule meet the same
 * ghosts; a salt re-rolls the sequence. The rules version is deliberately not part of the seed.
 * @param {{kind: 'daily'|'weekly', key: string, salt?: string}} challenge key: 'YYYY-MM-DD' (daily) or 'YYYY-Www'
 * @returns {number} unsigned 32-bit
 */
export function deriveSeed({ kind, key, salt = '' }) {
  const base = kind === 'weekly' ? `arcane-paws:weekly:${key}` : `arcane-paws:${key}`;
  return hashSeed(salt ? `${base}:${salt}` : base);
}

/**
 * The identity of a leaderboard: two scores are comparable only when their board ids are equal.
 * 'daily:2026-11-14:r3:s1' = the daily of that date, rules version 3, score version 1. The built-in rotation is
 * rules version 0.
 */
export function boardId({ kind, key, version, scoreVersion }) {
  return `${kind}:${key}:r${version}:s${scoreVersion}`;
}

const BOARD_PATTERN = /^(daily|weekly):(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}):r(\d{1,6}):s(\d{1,3})$/;

/** @returns {{kind: string, key: string, version: number, scoreVersion: number}|null} */
export function parseBoardId(id) {
  const match = typeof id === 'string' && id.length <= 48 ? BOARD_PATTERN.exec(id) : null;
  if (!match) return null;
  return { kind: match[1], key: match[2], version: Number(match[3]), scoreVersion: Number(match[4]) };
}

export function isBoardCompatible(a, b) {
  return parseBoardId(a) !== null && a === b;
}

/** What a day's challenge is when nothing is scheduled (and always when the game is offline): the original rotation. */
export function builtinChallenge(key) {
  const legacy = getDailyChallenge(key);
  return {
    key: legacy.key,
    seed: legacy.seed,
    modifier: legacy.modifier,
    difficulty: legacy.difficulty,
    kind: 'daily',
    source: 'builtin',
    eventId: null,
    rulesVersion: 0,
    scoreVersion: 1,
    scoreMultiplier: 1,
    boardId: boardId({ kind: 'daily', key: legacy.key, version: 0, scoreVersion: 1 }),
    startsAt: null,
    endsAt: null,
    name: legacy.modifier.name,
    description: legacy.modifier.desc,
    rewards: []
  };
}

/** A daily / weekly challenge resolved from a (published) live event */
export function eventChallenge(event) {
  const { rules } = event;
  return {
    key: event.challengeKey,
    seed: deriveSeed({ kind: event.kind, key: event.challengeKey, salt: rules.seedSalt }),
    modifier: rulesToModifier(event),
    difficulty: rules.difficulty,
    kind: event.kind,
    source: 'liveops',
    eventId: event.id,
    rulesVersion: event.version,
    scoreVersion: rules.scoreVersion,
    scoreMultiplier: rules.score.multiplier,
    boardId: boardId({ kind: event.kind, key: event.challengeKey, version: event.version, scoreVersion: rules.scoreVersion }),
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    name: event.name,
    description: event.description,
    rewards: event.rewards
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Rewards: progress, evaluation and claim validation
// ---------------------------------------------------------------------------------------------------------------------

/** A claim may arrive this long after the event ended (the run was already under way when it did) */
export const CLAIM_GRACE_MS = 10 * MINUTE;
/** Anything above these is not a plausible run result and is refused outright */
export const RUN_CAPS = { score: 100000000, wave: 9999, combo: 9999 };

export const emptyProgress = () => ({ runs: 0, bestScore: 0, bestWave: 0, bestCombo: 0 });

/**
 * Fold a finished run into a player's progress for one event. An assisted run (slow-motion assist, alternative input)
 * only counts as a played run: it never raises a best score, wave or combo.
 * @returns {{runs: number, bestScore: number, bestWave: number, bestCombo: number}} a new object
 */
export function applyRun(progress, run) {
  const next = { ...emptyProgress(), ...progress };
  next.runs += 1;
  if (!run.assisted) {
    next.bestScore = Math.max(next.bestScore, Math.round(run.score));
    next.bestWave = Math.max(next.bestWave, Math.round(run.wave));
    next.bestCombo = Math.max(next.bestCombo, Math.round(run.combo));
  }
  return next;
}

/**
 * Rewards the progress has earned and the player does not hold yet.
 * @param {{rewards: Array}} event
 * @param {Object} progress
 * @param {Record<string, *>} [granted] reward id -> anything truthy for rewards already granted
 * @returns {string[]} reward ids
 */
export function evaluateRewards(event, progress, granted = {}) {
  return event.rewards
    .filter((reward) => !granted[reward.id] && (progress[reward.condition.metric] || 0) >= reward.condition.threshold)
    .map((reward) => reward.id);
}

/**
 * The gate every reward passes before it is granted. Pure, so the game and any server-side check run the same rules.
 *
 * It protects against: a claim for an event that was not running (time is the server-synchronised clock, never the raw
 * device clock), a claim after a cancellation, a run that was started under other rules than the published ones, an
 * ineligible run, impossible numbers, and a game that could not confirm the time with the server this session.
 * It cannot stop a player who edits their own save: configuration is not anti-cheat (docs/live-operations.md).
 *
 * @param {Object} input
 * @param {Object|null} input.event the event as the game currently knows it (published form, with status/startsAt/endsAt/version)
 * @param {{mode: string, difficulty: string, assisted: boolean, score: number, wave: number, combo: number, storyLevelsCleared: number}} input.run
 * @param {{eventId: string, version: number, startedMs: number}} input.pinned what the run was pinned to when it started
 * @param {number} input.nowMs authoritative time of the claim
 * @param {boolean} input.clockTrusted the time was confirmed by the server in this session
 * @param {boolean} [input.rewardsEnabled] feature flag `liveops.rewards`
 * @returns {{ok: boolean, reasons: string[]}}
 */
export function validateClaim({ event, run, pinned, nowMs, clockTrusted, rewardsEnabled = true }) {
  const reasons = [];
  if (!rewardsEnabled) reasons.push('rewards-disabled');
  if (!clockTrusted) reasons.push('untrusted-clock');
  if (!event || !pinned || pinned.eventId !== event.id) {
    reasons.push('unknown-event');
    return { ok: false, reasons };
  }
  if (event.status === 'cancelled') reasons.push('cancelled');
  if (pinned.version !== event.version) reasons.push('version-mismatch');
  const start = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (!(Number.isFinite(pinned.startedMs) && pinned.startedMs >= start && pinned.startedMs < end)) reasons.push('started-outside-window');
  if (!(Number.isFinite(nowMs) && nowMs >= start && nowMs < end + CLAIM_GRACE_MS)) reasons.push('outside-window');
  const numbers = [['score', run.score, RUN_CAPS.score], ['wave', run.wave, RUN_CAPS.wave], ['combo', run.combo, RUN_CAPS.combo]];
  if (numbers.some(([, value, cap]) => !(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= cap))) reasons.push('out-of-range');
  const eligible = checkEligibility(event, run);
  if (!eligible.ok) reasons.push(`not-eligible:${eligible.reason}`);
  return { ok: reasons.length === 0, reasons };
}

/** Short text for a reward, for the admin and for logs ("cosmetic trail:frost when bestScore >= 5000") */
export function describeReward(reward) {
  const { metric, threshold } = reward.condition;
  return `${reward.type} ${reward.type === 'badge' ? reward.label : reward.ref} when ${metric} >= ${threshold}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------------------------------------------------

/** The flags the game knows how to honour. An unknown key is refused (the game could not act on it). */
export const FLAG_DEFS = {
  'liveops.enabled': { label: 'Live operations (master switch)', description: 'Off: the game ignores everything live-ops and plays with its built-in daily rotation.', default: true },
  'liveops.daily': { label: 'Managed daily challenge', description: 'Off: the daily challenge follows the built-in rotation.', default: true },
  'liveops.weekly': { label: 'Weekly challenge', description: 'Off: no weekly challenge is offered.', default: true },
  'liveops.seasonal': { label: 'Seasonal events', description: 'Off: seasonal events do not apply to runs.', default: true },
  'liveops.random': { label: 'Random events', description: 'Off: random events do not apply to runs.', default: true },
  'liveops.announcements': { label: 'Announcements', description: 'Off: the game shows no event announcements.', default: true },
  'liveops.rewards': { label: 'Event rewards', description: 'Off: no event reward is granted (progress is not counted either).', default: true },
  'liveops.effects': { label: 'Visual effects', description: 'Off: events keep their rules but draw no special visual effects.', default: true }
};
export const FLAG_KEYS = Object.keys(FLAG_DEFS);

export const defaultFlags = () => Object.fromEntries(FLAG_KEYS.map((key) => [key, { enabled: FLAG_DEFS[key].default, rolloutPercent: 100 }]));

/** Fill in flags a stored workspace predates, so a newly added flag never reads as "missing" */
export function normalizeFlags(stored) {
  const flags = defaultFlags();
  if (isObject(stored)) {
    for (const key of FLAG_KEYS) {
      const f = stored[key];
      if (isObject(f) && typeof f.enabled === 'boolean' && Number.isInteger(f.rolloutPercent) && f.rolloutPercent >= 0 && f.rolloutPercent <= 100) {
        flags[key] = { enabled: f.enabled, rolloutPercent: f.rolloutPercent };
      }
    }
  }
  return flags;
}

/** Strict validation of a full flag set (what an admin saves and what the public payload carries) */
export function validateFlags(flags) {
  const errors = [];
  if (!isObject(flags)) return ['flags: required object'];
  for (const key of Object.keys(flags)) if (!Object.hasOwn(FLAG_DEFS, key)) errors.push(`flags.${key}: unknown flag`);
  for (const key of FLAG_KEYS) {
    const flag = flags[key];
    if (!isObject(flag)) {
      errors.push(`flags.${key}: required object`);
      continue;
    }
    for (const field of Object.keys(flag)) if (field !== 'enabled' && field !== 'rolloutPercent') errors.push(`flags.${key}.${field}: unknown field`);
    if (typeof flag.enabled !== 'boolean') errors.push(`flags.${key}.enabled: expected true or false`);
    if (!Number.isInteger(flag.rolloutPercent) || flag.rolloutPercent < 0 || flag.rolloutPercent > 100) errors.push(`flags.${key}.rolloutPercent: expected integer in 0–100`);
  }
  return errors;
}

/** A stable 0–99 bucket for an install and a flag: the same install always lands in the same place */
export function rolloutBucket(bucketId, key) {
  return hashSeed(`${bucketId}:${key}`) % 100;
}

/**
 * Is the flag on for this install? An unknown flag is off. `rolloutPercent` is the share of installs that get an
 * enabled flag; 100 = everyone, 0 = nobody.
 */
export function evaluateFlag(flags, key, bucketId = '') {
  if (!Object.hasOwn(FLAG_DEFS, key)) return false;
  const flag = flags && flags[key] ? flags[key] : { enabled: FLAG_DEFS[key].default, rolloutPercent: 100 };
  if (!flag.enabled || flag.rolloutPercent <= 0) return false;
  return flag.rolloutPercent >= 100 || rolloutBucket(bucketId, key) < flag.rolloutPercent;
}

// ---------------------------------------------------------------------------------------------------------------------
// Presets: ready-made rules for the admin editor and the random-event generator
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Starting points for seasonal and random events. Names are player-facing (the game is Vietnamese-first) and every
 * preset passes validateEventContent once an id and a schedule are filled in (tests/live-ops-contract.test.js).
 */
export const EVENT_PRESETS = [
  {
    id: 'frost-season', kind: 'seasonal', name: 'Mùa Băng Giá', description: 'Tuyết rơi trên học viện: u linh chậm hơn một chút, điểm cao hơn.',
    rules: { enemy: { speedMultiplier: 0.9 }, score: { multiplier: 1.25 }, scoreVersion: 2, visual: { theme: 'frost', ambient: 'snow' } }
  },
  {
    id: 'ember-festival', kind: 'seasonal', name: 'Lễ Hội Lửa Than', description: 'Đêm hội rực lửa: u linh đông hơn và nhiều bất ngờ hơn.',
    rules: { spawn: { intervalMultiplier: 0.9, surpriseMultiplier: 1.5 }, visual: { theme: 'ember', ambient: 'embers' } }
  },
  {
    id: 'blossom-week', kind: 'seasonal', name: 'Tuần Lễ Hoa Anh Đào', description: 'Một tuần thanh bình: chỉ có hiệu ứng, không đổi luật chơi.',
    rules: { visual: { theme: 'blossom', ambient: 'petals' } }
  },
  {
    id: 'blood-moon-rush', kind: 'random', name: 'Trăng Máu Bất Chợt', description: 'U linh nhanh hơn trong một thời gian ngắn!',
    rules: { enemy: { speedMultiplier: 1.2 }, spawn: { surpriseMultiplier: 2 }, visual: { theme: 'ember', ambient: 'embers' } }
  },
  {
    id: 'meteor-night', kind: 'random', name: 'Đêm Sao Băng', description: 'Sao băng xuất hiện liên tục, điểm nhân 1,5.',
    rules: { spawn: { surpriseMultiplier: 2.5 }, score: { multiplier: 1.5 }, scoreVersion: 2, visual: { theme: 'twilight', ambient: 'stars' } }
  },
  {
    id: 'golden-hour', kind: 'random', name: 'Giờ Vàng', description: 'Ít u linh hơn nhưng điểm quý hơn.',
    rules: { spawn: { intervalMultiplier: 1.2 }, score: { multiplier: 1.5 }, scoreVersion: 2, visual: { theme: 'gold', ambient: 'sparkles' } }
  }
];

/** @returns {Object} complete event content for a preset id (id / schedule left for the caller to fill in) */
export function presetContent(presetId, overrides = {}) {
  const preset = EVENT_PRESETS.find((p) => p.id === presetId);
  if (!preset) throw new RangeError(`Unknown preset ${presetId}`);
  return createEventContent(preset.kind, merge({ name: preset.name, description: preset.description, rules: preset.rules }, overrides));
}
