/**
 * @file Challenge.js
 * @description Daily Challenge: a date-seeded Endless run with one twist ("modifier") that is the same
 * for every player on the same day, so scores are comparable and can be shared.
 *
 * Everything here is pure (no DOM, no Game): the date key, the seeded random generator, the modifier
 * table and the share-link helpers. Game applies the result to WaveSystem / Player.
 *
 * "Today" is the UTC date, so players in different time zones get the same challenge at the same moment.
 */

/** Fixed difficulty for every daily run, so scores are comparable between players */
export const DAILY_DIFFICULTY = 'NORMAL';

/**
 * @typedef {Object} DailyModifier
 * @property {string} id
 * @property {string} icon
 * @property {string} name
 * @property {string} desc
 * @property {string[]} [runes] Restrict ghosts to these gestures (also removes heart/freeze/blast ghosts)
 * @property {boolean} [noHearts] No healing ghosts
 * @property {number} [speed] Multiplier on ghost speed
 * @property {number} [maxHp] Starting (and maximum) hearts for the run
 * @property {number} [spawn] Multiplier on the spawn interval (smaller = more ghosts at once)
 */

/** @type {DailyModifier[]} */
export const DAILY_MODIFIERS = [
  {
    id: 'flat_lines', icon: '↔️', name: 'Chỉ Ngang & Dọc',
    desc: 'U linh chỉ mang ấn ký — và |. Không có ghost tim, băng, gió.',
    runes: ['horizontal', 'vertical']
  },
  {
    id: 'sharp_angles', icon: '📐', name: 'Góc Nhọn',
    desc: 'U linh chỉ mang ấn ký ∧ và ∨. Không có ghost tim, băng, gió.',
    runes: ['caret', 'v_shape']
  },
  {
    id: 'storm', icon: '🌩️', name: 'Bão Sét',
    desc: 'Mọi ấn ký đều xen lẫn tia sét ⚡. Hãy luyện nét zích-zắc!',
    runes: ['lightning', 'horizontal', 'vertical', 'lightning']
  },
  {
    id: 'no_hearts', icon: '💔', name: 'Không Còn Trái Tim',
    desc: 'Không có u linh tim hồi máu. Mỗi giọt máu đều quý giá.',
    noHearts: true
  },
  {
    id: 'whirlwind', icon: '🌪️', name: 'Gió Lốc',
    desc: 'U linh di chuyển nhanh hơn 25%.',
    speed: 1.25
  },
  {
    id: 'glass_cat', icon: '🔮', name: 'Mèo Thủy Tinh',
    desc: 'Momo chỉ có 3 tim trong suốt cuộc chơi.',
    maxHp: 3
  },
  {
    id: 'swarm', icon: '🐝', name: 'Bầy Đàn',
    desc: 'U linh xuất hiện dày đặc hơn 30%.',
    spawn: 0.7
  }
];

// -------------------------------------------------------------------------
// Date key & seeded random
// -------------------------------------------------------------------------

/**
 * @param {Date} [date]
 * @returns {string} 'YYYY-MM-DD' in UTC
 */
export function dateKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** @returns {boolean} whether `key` looks like a valid 'YYYY-MM-DD' date */
export function isValidDateKey(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dateKey(d) === key;
}

/**
 * The date key `offset` days away from `key` (negative = earlier).
 * @param {string} key
 * @param {number} offset
 * @returns {string}
 */
export function shiftDateKey(key, offset) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return dateKey(d);
}

/**
 * FNV-1a hash of a string into an unsigned 32-bit integer.
 * @param {string} str
 * @returns {number}
 */
export function hashSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32: small, fast, well-distributed seeded PRNG.
 * @param {number} seed 32-bit integer
 * @returns {() => number} generator of floats in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Independent generator for one wave of a seeded run. Seeding per wave (instead of one stream for the
 * whole run) keeps wave N identical for everyone even if earlier waves consumed a different number of
 * random values (for example because one player was healed and another was not).
 * @param {number} seed run seed
 * @param {number} wave wave number (1-based)
 * @returns {() => number}
 */
export function waveRng(seed, wave) {
  return mulberry32((seed ^ Math.imul(wave + 1, 0x9E3779B1)) >>> 0);
}

// -------------------------------------------------------------------------
// The daily challenge
// -------------------------------------------------------------------------

/**
 * @typedef {Object} DailyChallenge
 * @property {string} key 'YYYY-MM-DD'
 * @property {number} seed
 * @property {DailyModifier} modifier
 * @property {string} difficulty
 */

/**
 * Deterministic challenge for a date: the same key always yields the same seed and modifier.
 * @param {string} [key] defaults to today (UTC)
 * @returns {DailyChallenge}
 */
export function getDailyChallenge(key = dateKey()) {
  const seed = hashSeed(`arcane-paws:${key}`);
  const modifier = DAILY_MODIFIERS[hashSeed(`modifier:${key}`) % DAILY_MODIFIERS.length];
  return { key, seed, modifier, difficulty: DAILY_DIFFICULTY };
}

// -------------------------------------------------------------------------
// Share links
// -------------------------------------------------------------------------

/**
 * Link that challenges a friend to beat `score` on a given day's daily challenge.
 * @param {string} baseUrl page URL (query/hash are replaced)
 * @param {string} key date key of the challenge
 * @param {number} score score to beat
 * @param {string} [from] sender name
 * @param {string} [board] leaderboard id of the challenge the score was set on (live operations: scores are only
 *   comparable on the same rules and score version, see shared/live-ops boardId). Omitted for the built-in rotation.
 * @returns {string}
 */
export function buildDailyChallengeUrl(baseUrl, key, score = 0, from = 'Momo', board = '') {
  const url = new URL(baseUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set('daily', key);
  url.searchParams.set('score', String(Math.max(0, Math.round(score))));
  url.searchParams.set('from', String(from).slice(0, 24));
  if (isBoardParam(board)) url.searchParams.set('board', board);
  return url.toString();
}

const BOARD_PARAM = /^(daily|weekly):(\d{4}-\d{2}-\d{2}|\d{4}-W\d{2}):r\d{1,6}:s\d{1,3}$/;
/** Shape check only; shared/live-ops parseBoardId is the full parser (this file cannot import it: it imports us) */
function isBoardParam(value) {
  return typeof value === 'string' && value.length <= 48 && BOARD_PARAM.test(value);
}

/**
 * Read a daily-challenge link. Everything is validated because the URL is controlled by whoever sent it.
 * @param {string} search e.g. window.location.search
 * @returns {{key: string, score: number, from: string, board: string}|null} `board` is '' when the link names none
 */
export function parseDailyChallengeParams(search) {
  try {
    const params = new URLSearchParams(search || '');
    const key = params.get('daily');
    if (!key || !isValidDateKey(key)) return null;
    const score = Number(params.get('score'));
    const from = (params.get('from') || 'Một người bạn').replace(/[\u0000-\u001f<>]/g, '').slice(0, 24);
    return {
      key,
      score: Number.isFinite(score) && score > 0 ? Math.min(Math.round(score), 99999999) : 0,
      from: from || 'Một người bạn',
      board: isBoardParam(params.get('board')) ? params.get('board') : ''
    };
  } catch (e) {
    return null;
  }
}
