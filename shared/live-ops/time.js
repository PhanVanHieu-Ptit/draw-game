/**
 * @file shared/live-ops/time.js
 * @description Timezone-safe time helpers for Live Operations. Pure and isomorphic (no DOM, no Node-only API): the
 * admin server, the admin app and the game all use the same code.
 *
 * Rules the rest of the system relies on:
 *  - An authoritative moment is a UTC instant written as `YYYY-MM-DDTHH:mm:ssZ` (whole seconds, always `Z`).
 *    Offsets such as `+07:00` are rejected, so one moment has exactly one spelling.
 *  - A wall-clock time (`YYYY-MM-DDTHH:mm`) only means something together with an IANA zone name. Converting it
 *    never guesses: a time that does not exist (spring-forward gap) or happens twice (fall-back overlap) is reported,
 *    not silently shifted.
 *  - Calendar days and ISO weeks are measured in the zone's own calendar, so a day in a DST zone can be 23 or 25
 *    hours long and a day in Asia/Kolkata starts at 18:30Z the evening before.
 */

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Event times outside this range are rejected: it keeps ISO strings in their plain 4-digit-year form. */
export const MIN_YEAR = 2024;
export const MAX_YEAR = 2100;
const MIN_MS = Date.UTC(MIN_YEAR, 0, 1);
const MAX_MS = Date.UTC(MAX_YEAR, 0, 1);

const pad = (n, width = 2) => String(n).padStart(width, '0');

// ---------------------------------------------------------------------------------------------------------------------
// UTC instants
// ---------------------------------------------------------------------------------------------------------------------

/**
 * @param {number} ms epoch milliseconds (rounded down to the second)
 * @returns {string} `YYYY-MM-DDTHH:mm:ssZ`
 */
export function formatInstant(ms) {
  if (!Number.isFinite(ms)) throw new RangeError('Invalid instant');
  const date = new Date(Math.floor(ms / SECOND) * SECOND);
  if (Number.isNaN(date.getTime())) throw new RangeError('Invalid instant');
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
    + `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
}

/**
 * @param {*} text
 * @returns {number} epoch milliseconds, or NaN when `text` is not a canonical in-range UTC instant
 */
export function parseInstant(text) {
  if (typeof text !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/.exec(text);
  if (!match) return NaN;
  const [y, mo, d, h, mi, s] = match.slice(1).map(Number);
  const ms = Date.UTC(y, mo - 1, d, h, mi, s);
  // Date.UTC rolls 2026-02-31 over to March; the round trip catches that (and 24:00:00, 60 seconds...)
  if (!(ms >= MIN_MS && ms < MAX_MS) || formatInstant(ms) !== text) return NaN;
  return ms;
}

export const isInstant = (text) => Number.isFinite(parseInstant(text));

// ---------------------------------------------------------------------------------------------------------------------
// Calendar dates and wall-clock strings
// ---------------------------------------------------------------------------------------------------------------------

/**
 * @param {*} text 'YYYY-MM-DD'
 * @returns {{y:number, m:number, d:number, ms:number}|null} null unless it is a real calendar date
 */
export function parseDateKey(text) {
  const match = typeof text === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null;
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const ms = Date.UTC(y, m - 1, d);
  const date = new Date(ms);
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { y, m, d, ms };
}

export const isDateKey = (text) => parseDateKey(text) !== null;

const keyFromMs = (ms) => {
  const date = new Date(ms);
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};

/** The calendar date `n` days after `dateKey` (negative = before). Pure calendar arithmetic, no time zone involved. */
export function addDays(dateKey, n) {
  const parsed = parseDateKey(dateKey);
  if (!parsed || !Number.isInteger(n)) throw new RangeError('Invalid date');
  return keyFromMs(parsed.ms + n * DAY);
}

/** ISO weekday of a calendar date: Monday = 1 ... Sunday = 7 */
export function isoWeekday(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new RangeError('Invalid date');
  return ((new Date(parsed.ms).getUTCDay() + 6) % 7) + 1;
}

/**
 * @param {*} text 'YYYY-MM-DDTHH:mm'
 * @returns {{date: string, hour: number, minute: number, wallMs: number}|null} wallMs = the wall clock read as if it
 *   were UTC (only useful to the zone arithmetic below)
 */
export function parseLocal(text) {
  const match = typeof text === 'string' ? /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(text) : null;
  if (!match) return null;
  const date = parseDateKey(match[1]);
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  if (!date || hour > 23 || minute > 59) return null;
  return { date: match[1], hour, minute, wallMs: date.ms + hour * HOUR + minute * MINUTE };
}

export const isLocalDateTime = (text) => parseLocal(text) !== null;

// ---------------------------------------------------------------------------------------------------------------------
// ISO weeks
// ---------------------------------------------------------------------------------------------------------------------

/** @returns {string} the ISO 8601 week of a calendar date, e.g. '2026-W46' */
export function isoWeekKey(dateKey) {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new RangeError('Invalid date');
  const thursday = new Date(parsed.ms + (3 - ((new Date(parsed.ms).getUTCDay() + 6) % 7)) * DAY);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.floor((thursday.getTime() - jan1) / DAY / 7) + 1;
  return `${pad(isoYear, 4)}-W${pad(week)}`;
}

/** @returns {string|null} the Monday (as 'YYYY-MM-DD') of an ISO week key, or null when the key is not a real week */
export function weekStartKey(weekKey) {
  const match = typeof weekKey === 'string' ? /^(\d{4})-W(\d{2})$/.exec(weekKey) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // Week 1 is the week containing 4 January
  const jan4 = parseDateKey(`${pad(year, 4)}-01-04`);
  if (!jan4) return null;
  const mondayOfWeek1 = jan4.ms - ((new Date(jan4.ms).getUTCDay() + 6) % 7) * DAY;
  const monday = keyFromMs(mondayOfWeek1 + (week - 1) * 7 * DAY);
  return isoWeekKey(monday) === weekKey ? monday : null; // rejects week 53 in a 52-week year
}

export const isWeekKey = (text) => weekStartKey(text) !== null;

// ---------------------------------------------------------------------------------------------------------------------
// Time zones
// ---------------------------------------------------------------------------------------------------------------------

const formatters = new Map();

function formatterFor(timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Whether `name` is an IANA zone this runtime knows. Only region names such as 'Asia/Ho_Chi_Minh' (and 'UTC') are
 * accepted: fixed-offset spellings like '+07:00' are not supported by every engine and carry no DST rules.
 */
export function isTimeZone(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 64) return false;
  if (name !== 'UTC' && !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){1,2}$/.test(name)) return false;
  try {
    formatterFor(name);
    return true;
  } catch (error) {
    return false;
  }
}

function wallParts(ms, timeZone) {
  const out = {};
  for (const part of formatterFor(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  if (out.hour === 24) out.hour = 0; // some engines print midnight as 24 even with hourCycle h23
  return out;
}

/**
 * How far the zone's wall clock is ahead of UTC at an instant, in milliseconds (+7 hours for Vietnam, +5:30 for
 * India, -4 hours for New York in summer).
 */
export function offsetAt(ms, timeZone) {
  const t = Math.floor(ms / SECOND) * SECOND;
  const p = wallParts(t, timeZone);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
}

/** @returns {string} the calendar date 'YYYY-MM-DD' in `timeZone` at an instant */
export function localDate(ms, timeZone) {
  const p = wallParts(ms, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}`;
}

/** @returns {string} the wall clock 'YYYY-MM-DDTHH:mm' in `timeZone` at an instant */
export function wallClock(ms, timeZone) {
  const p = wallParts(ms, timeZone);
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Convert a wall-clock time in a zone to an instant without guessing.
 * @param {string} local 'YYYY-MM-DDTHH:mm'
 * @param {string} timeZone
 * @returns {{status: 'ok', ms: number} | {status: 'ambiguous', candidates: number[]} | {status: 'gap'} | {status: 'invalid'}}
 *   'gap' = the clock skips this time (spring forward); 'ambiguous' = the clock shows it twice (fall back)
 */
export function resolveLocal(local, timeZone) {
  const parsed = parseLocal(local);
  if (!parsed || !isTimeZone(timeZone)) return { status: 'invalid' };
  const wall = parsed.wallMs;
  // A transition moves the offset by at most a few hours, so the offsets a day either side bracket the answer.
  const guesses = new Set([wall - offsetAt(wall - DAY, timeZone), wall - offsetAt(wall + DAY, timeZone)]);
  const matches = [...guesses].filter((ms) => wall - ms === offsetAt(ms, timeZone)).sort((a, b) => a - b);
  if (matches.length === 0) return { status: 'gap' };
  if (matches.length === 1) return { status: 'ok', ms: matches[0] };
  return { status: 'ambiguous', candidates: matches };
}

/**
 * The first instant of a calendar day in a zone (that day's local midnight, or the end of a midnight DST gap).
 * Found by bisection on "has the zone's calendar reached this date yet", so it is correct for every zone,
 * including half-hour DST (Australia/Lord_Howe) and zones that skip midnight.
 * @param {string} dateKey 'YYYY-MM-DD'
 * @param {string} timeZone
 * @returns {number} epoch milliseconds
 */
export function startOfLocalDay(dateKey, timeZone) {
  const parsed = parseDateKey(dateKey);
  if (!parsed || !isTimeZone(timeZone)) throw new RangeError('Invalid date or time zone');
  const approx = parsed.ms - offsetAt(parsed.ms, timeZone);
  let lo = approx - 30 * HOUR; // the zone's date is certainly earlier here ...
  let hi = approx + 30 * HOUR; // ... and certainly reached here
  while (hi - lo > SECOND) {
    const mid = Math.floor((lo + hi) / 2 / SECOND) * SECOND;
    if (localDate(mid, timeZone) >= dateKey) hi = mid;
    else lo = mid;
  }
  return hi;
}
