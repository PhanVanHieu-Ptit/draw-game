import { sanitizeStoryState } from '../../shared/story/engine.js';
/**
 * @file ProgressStore.js
 * @description Long-term player progress persisted in localStorage:
 *  - records per (mode x difficulty): best score, furthest level/wave, best combo, best accuracy
 *  - lifetime stats (kills, spells, play time, ...) that drive achievements
 *  - unlocked achievements, the bestiary (enemies met / defeated) and Practice Mode mastery
 *  - Story levels cleared (they unlock companions), the equipped companion and daily-challenge scores
 *  - the story mystery: memory shards, kept pledges (the letters of the forgotten name) and endings seen
 *
 * Everything is kept in memory and written with save(). Callers save at meaningful moments (end of a
 * run, achievement unlocked, page hidden) rather than on every kill, so combat never waits on storage.
 * localStorage may be unavailable or throw; the store then simply works in memory for the session.
 */

import { STORAGE_KEYS, RUNES } from './Constants.js';
import { DEFAULT_COMPANION, COMPANIONS } from './Companions.js';
import { shiftDateKey, isValidDateKey } from './Challenge.js';
import { SPELL_PHRASES } from './Spells.js';
import { getCosmetic, DEFAULT_TRAIL, DEFAULT_HAT, TRAILS, HATS } from './Cosmetics.js';
import { RUN_CAPS, REWARD_TYPES, LIMITS as LIVEOPS_LIMITS, emptyProgress as emptyEventProgress, applyRun as applyEventRun, grantableCosmetics, parseBoardId } from '../../shared/live-ops/contract.js';

export const MODES = ['STORY', 'ENDLESS'];
export const DIFFICULTIES = ['NORMAL', 'HARDCORE', 'INFERNO'];

const SCHEMA_VERSION = 1;

/**
 * Practice: an attempt must reach this accuracy (and be recognised) to count towards mastery.
 * Straight lines are easy to draw cleanly, so they demand more; the curvy runes (measured with
 * simulated hand-drawn strokes) are given a little more room.
 */
export const MASTERY_ACCURACY = 0.85;
export const MASTERY_THRESHOLDS = {
  horizontal: 0.9,
  vertical: 0.9,
  caret: 0.85,
  v_shape: 0.85,
  circle: 0.82,
  lightning: 0.8,
  heart: 0.8,
  spiral: 0.8
};
export const MASTERY_PASSES = 3;

/** @returns {number} accuracy (0..1) a stroke needs to count towards mastering `rune` */
export function masteryThreshold(rune) {
  return MASTERY_THRESHOLDS[rune] || MASTERY_ACCURACY;
}
/** Daily results older than this many days are dropped to keep the save small */
const DAILY_KEEP_DAYS = 90;
/** Live-operations bookkeeping is capped so a long-lived save stays small (oldest entries go first) */
const LIVEOPS_KEEP = { events: 60, boards: 120, granted: 300 };
const EVENT_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;
const REWARD_ID = /^[a-z0-9][a-z0-9-]{1,31}$/;
const NO_CONTROL = /^[^\u0000-\u001f\u007f]*$/;

function emptyLiveOps() {
  // events: eventId -> {version, runs, bestScore, bestWave, bestCombo, at}; granted: 'eventId:rewardId' -> reward;
  // boards: boardId ('daily:2026-11-14:r3:s1') -> best result on that exact leaderboard
  return { events: {}, granted: {}, boards: {} };
}

/** Keep the newest `keep` entries of an object map ordered by their numeric `at` */
function pruneByAt(map, keep) {
  const keys = Object.keys(map);
  if (keys.length <= keep) return;
  keys.sort((a, b) => (map[b].at || 0) - (map[a].at || 0));
  for (const k of keys.slice(keep)) delete map[k];
}

function emptyRecord() {
  return { score: 0, level: 0, combo: 0, accuracy: 0, plays: 0, wins: 0, lastPlayed: 0 };
}

function emptyStats() {
  return {
    runs: 0,
    wins: 0,
    kills: 0,
    spells: 0,
    hits: 0,
    playSeconds: 0,
    bestCombo: 0,
    bestScore: 0,
    bestEndlessWave: 0,
    bestAccuracy: 0,
    bossesDefeated: 0,
    levelsCleared: 0,
    flawlessLevels: 0,
    heals: 0,
    freezes: 0,
    gales: 0,
    upgradesTaken: 0,
    practicePasses: 0,
    dailyPlays: 0,
    bestDailyStreak: 0,
    cleanCombos: 0,
    goldenCaught: 0,
    phrasesCast: 0,
    rushClears: 0,
    trueEndings: 0,
    killsByRune: {}
  };
}

function emptyRush() {
  // seconds = fastest clear (0 = never cleared), level = furthest boss reached
  return { score: 0, seconds: 0, level: 0, plays: 0, clears: 0 };
}

function emptyLore() {
  // shards / pledges: story level (1..5) -> true; endings: 'normal' | 'true' -> true once shown
  return { shards: {}, pledges: {}, endings: {} };
}

export const ENDING_KINDS = ['normal', 'true'];

function freshData() {
  return {
    v: SCHEMA_VERSION,
    records: {},
    stats: emptyStats(),
    achievements: {},
    seen: {},
    kills: {},
    practice: {},
    cleared: {},
    companion: DEFAULT_COMPANION,
    daily: {},
    phrases: {},
    cosmetics: { trail: DEFAULT_TRAIL, hat: DEFAULT_HAT, seen: {} },
    rush: emptyRush(),
    storyState: sanitizeStoryState(),
    lore: emptyLore(),
    liveops: emptyLiveOps()
  };
}

function nonNegative(n, fallback = 0) {
  const v = Number(n);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

export function recordKey(mode, difficulty) {
  return `${mode}:${difficulty}`;
}

export class ProgressStore {
  /**
   * @param {Storage|null} [storage] defaults to window.localStorage when available
   */
  constructor(storage) {
    this._storage = storage !== undefined ? storage : ProgressStore._defaultStorage();
    this.data = freshData();
    this._load();
  }

  static _defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* access can throw */ }
    return null;
  }

  // ------------------------------------------------------------------ persistence

  _load() {
    if (!this._storage) return;
    try {
      const raw = this._storage.getItem(STORAGE_KEYS.PROGRESS);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      this._merge(parsed);
    } catch (e) { /* corrupt data: start fresh rather than crash the game */ }
  }

  /** Copy only well-formed values from untrusted parsed JSON into this.data */
  _merge(parsed) {
    const d = this.data;

    if (parsed.records && typeof parsed.records === 'object') {
      for (const mode of MODES) {
        for (const diff of DIFFICULTIES) {
          const src = parsed.records[recordKey(mode, diff)];
          if (!src || typeof src !== 'object') continue;
          const rec = emptyRecord();
          for (const k of Object.keys(rec)) rec[k] = nonNegative(src[k]);
          d.records[recordKey(mode, diff)] = rec;
        }
      }
    }

    if (parsed.stats && typeof parsed.stats === 'object') {
      const base = emptyStats();
      for (const k of Object.keys(base)) {
        if (k === 'killsByRune') continue;
        d.stats[k] = nonNegative(parsed.stats[k]);
      }
      if (parsed.stats.killsByRune && typeof parsed.stats.killsByRune === 'object') {
        for (const rune of Object.keys(RUNES)) {
          const n = nonNegative(parsed.stats.killsByRune[rune]);
          if (n > 0) d.stats.killsByRune[rune] = n;
        }
      }
    }

    if (parsed.achievements && typeof parsed.achievements === 'object') {
      for (const [id, ts] of Object.entries(parsed.achievements)) {
        const t = nonNegative(ts);
        if (t > 0) d.achievements[id] = t;
      }
    }

    for (const field of ['seen', 'kills']) {
      if (parsed[field] && typeof parsed[field] === 'object') {
        for (const [id, val] of Object.entries(parsed[field])) {
          if (field === 'seen') {
            if (val) d.seen[id] = true;
          } else {
            const n = nonNegative(val);
            if (n > 0) d.kills[id] = n;
          }
        }
      }
    }

    if (parsed.practice && typeof parsed.practice === 'object') {
      for (const rune of Object.keys(RUNES)) {
        const src = parsed.practice[rune];
        if (!src || typeof src !== 'object') continue;
        d.practice[rune] = {
          attempts: nonNegative(src.attempts),
          passes: nonNegative(src.passes),
          good: nonNegative(src.good),
          best: Math.min(1, nonNegative(src.best))
        };
      }
    }

    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (let lvl = 1; lvl <= 5; lvl++) {
        if (parsed.cleared[lvl]) d.cleared[lvl] = true;
      }
    }

    if (typeof parsed.companion === 'string' && COMPANIONS[parsed.companion]) {
      d.companion = parsed.companion;
    }

    if (parsed.phrases && typeof parsed.phrases === 'object') {
      for (const phrase of SPELL_PHRASES) {
        const n = Math.round(nonNegative(parsed.phrases[phrase.id]));
        if (n > 0) d.phrases[phrase.id] = n;
      }
    }

    if (parsed.cosmetics && typeof parsed.cosmetics === 'object') {
      const c = parsed.cosmetics;
      if (getCosmetic('trail', c.trail)) d.cosmetics.trail = c.trail;
      if (getCosmetic('hat', c.hat)) d.cosmetics.hat = c.hat;
      if (c.seen && typeof c.seen === 'object') {
        for (const def of [...TRAILS, ...HATS]) {
          if (c.seen[def.id]) d.cosmetics.seen[def.id] = true;
        }
      }
    }

    if (parsed.rush && typeof parsed.rush === 'object') {
      const r = emptyRush();
      for (const k of Object.keys(r)) r[k] = Math.round(nonNegative(parsed.rush[k]));
      d.rush = r;
    }

    d.storyState = sanitizeStoryState(parsed.storyState || {});

    if (parsed.lore && typeof parsed.lore === 'object') {
      for (const field of ['shards', 'pledges']) {
        const src = parsed.lore[field];
        if (!src || typeof src !== 'object') continue;
        for (let lvl = 1; lvl <= 5; lvl++) {
          if (src[lvl]) d.lore[field][lvl] = true;
        }
      }
      if (parsed.lore.endings && typeof parsed.lore.endings === 'object') {
        for (const kind of ENDING_KINDS) {
          if (parsed.lore.endings[kind]) d.lore.endings[kind] = true;
        }
      }
    }

    if (parsed.liveops && typeof parsed.liveops === 'object') this._mergeLiveOps(parsed.liveops);

    if (parsed.daily && typeof parsed.daily === 'object') {
      for (const [key, src] of Object.entries(parsed.daily)) {
        if (!isValidDateKey(key) || !src || typeof src !== 'object') continue;
        d.daily[key] = {
          score: Math.round(nonNegative(src.score)),
          wave: Math.round(nonNegative(src.wave)),
          combo: Math.round(nonNegative(src.combo)),
          plays: Math.max(1, Math.round(nonNegative(src.plays, 1)))
        };
      }
    }
  }

  /**
   * Live-operations state from untrusted JSON (localStorage is editable). Anything malformed is dropped; a granted
   * cosmetic must still be a real, grantable wardrobe item, so a hand-edited save cannot invent one.
   */
  _mergeLiveOps(src) {
    const out = this.data.liveops;
    const int = (n, cap) => Math.min(cap, Math.round(nonNegative(n)));
    const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (isObj(src.events)) {
      for (const [id, e] of Object.entries(src.events)) {
        if (!EVENT_ID.test(id) || !isObj(e)) continue;
        out.events[id] = {
          version: Math.max(1, int(e.version, 1000000)),
          runs: int(e.runs, 1000000),
          bestScore: int(e.bestScore, RUN_CAPS.score),
          bestWave: int(e.bestWave, RUN_CAPS.wave),
          bestCombo: int(e.bestCombo, RUN_CAPS.combo),
          at: int(e.at, 8.64e15)
        };
      }
    }
    if (isObj(src.granted)) {
      const cosmetics = new Set(grantableCosmetics());
      for (const [key, g] of Object.entries(src.granted)) {
        if (!isObj(g) || typeof g.eventId !== 'string' || typeof g.rewardId !== 'string') continue;
        if (!EVENT_ID.test(g.eventId) || !REWARD_ID.test(g.rewardId) || key !== `${g.eventId}:${g.rewardId}`) continue;
        if (!REWARD_TYPES.includes(g.type) || typeof g.ref !== 'string') continue;
        if (g.type === 'cosmetic' && !cosmetics.has(g.ref)) continue;
        if (g.type === 'badge' && (g.ref.length < 1 || g.ref.length > 8 || !NO_CONTROL.test(g.ref))) continue;
        const label = typeof g.label === 'string' && g.label.length <= LIVEOPS_LIMITS.badgeLabel && NO_CONTROL.test(g.label) ? g.label : '';
        if (g.type === 'badge' && !label.trim()) continue;
        out.granted[key] = {
          eventId: g.eventId, rewardId: g.rewardId, type: g.type, ref: g.ref, label,
          eventName: typeof g.eventName === 'string' && g.eventName.length <= LIVEOPS_LIMITS.name && NO_CONTROL.test(g.eventName) ? g.eventName : '',
          at: int(g.at, 8.64e15)
        };
      }
    }
    if (isObj(src.boards)) {
      for (const [id, b] of Object.entries(src.boards)) {
        if (!parseBoardId(id) || !isObj(b)) continue;
        out.boards[id] = {
          score: int(b.score, RUN_CAPS.score), wave: int(b.wave, RUN_CAPS.wave), combo: int(b.combo, RUN_CAPS.combo),
          plays: Math.max(1, int(b.plays, 1000000)), at: int(b.at, 8.64e15)
        };
      }
    }
    pruneByAt(out.events, LIVEOPS_KEEP.events);
    pruneByAt(out.granted, LIVEOPS_KEEP.granted);
    pruneByAt(out.boards, LIVEOPS_KEEP.boards);
  }

  save() {
    if (!this._storage) return false;
    try {
      this._storage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(this.data));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------ records

  /** @returns {{score:number, level:number, combo:number, accuracy:number, plays:number, wins:number, lastPlayed:number}} */
  getRecord(mode, difficulty) {
    return { ...emptyRecord(), ...(this.data.records[recordKey(mode, difficulty)] || {}) };
  }

  /**
   * Fold a finished run into the records and lifetime stats.
   *
   * @param {Object} run
   * @param {'STORY'|'ENDLESS'} run.mode
   * @param {'NORMAL'|'HARDCORE'|'INFERNO'} run.difficulty
   * @param {number} run.score
   * @param {number} run.level Story: furthest level reached (1..5); Endless: wave reached
   * @param {number} run.combo Best combo this run
   * @param {number} run.accuracy 0..100
   * @param {boolean} [run.victory]
   * @param {number} [run.spellsCast]
   * @param {number} [run.spellsHit]
   * @param {number} [run.seconds]
   * @param {boolean} [run.ranked=true] false: leave the (mode x difficulty) records alone (daily / assisted runs)
   * @param {boolean} [run.assisted=false] true: don't let this run raise "best ever" stats that drive achievements
   * @returns {{previous: Object, record: Object, isNewScore: boolean, isNewLevel: boolean, isNewCombo: boolean, scoreGap: number}}
   */
  recordRun(run) {
    const mode = MODES.includes(run.mode) ? run.mode : 'STORY';
    const difficulty = DIFFICULTIES.includes(run.difficulty) ? run.difficulty : 'NORMAL';
    const score = Math.max(0, Math.round(nonNegative(run.score)));
    const level = Math.max(0, Math.round(nonNegative(run.level)));
    const combo = Math.max(0, Math.round(nonNegative(run.combo)));
    const accuracy = Math.min(100, nonNegative(run.accuracy));

    const ranked = run.ranked !== false;
    const key = recordKey(mode, difficulty);
    const previous = this.getRecord(mode, difficulty);
    let record = { ...previous };

    const isNewScore = ranked && score > previous.score;
    const isNewLevel = ranked && level > previous.level;
    const isNewCombo = ranked && combo > previous.combo;

    if (ranked) {
      record.score = Math.max(previous.score, score);
      record.level = Math.max(previous.level, level);
      record.combo = Math.max(previous.combo, combo);
      record.accuracy = Math.max(previous.accuracy, Math.round(accuracy));
      record.plays = previous.plays + 1;
      record.wins = previous.wins + (run.victory ? 1 : 0);
      record.lastPlayed = Date.now();
      this.data.records[key] = record;
    }

    const s = this.data.stats;
    s.runs += 1;
    if (run.victory && !run.assisted) s.wins += 1;
    s.spells += Math.max(0, Math.round(nonNegative(run.spellsCast)));
    s.hits += Math.max(0, Math.round(nonNegative(run.spellsHit)));
    s.playSeconds += Math.max(0, Math.round(nonNegative(run.seconds)));
    if (!run.assisted) {
      s.bestCombo = Math.max(s.bestCombo, combo);
      s.bestScore = Math.max(s.bestScore, score);
      if (mode === 'ENDLESS') s.bestEndlessWave = Math.max(s.bestEndlessWave, level);
      // Accuracy only means something over a decent number of casts
      if (nonNegative(run.spellsCast) >= 30) s.bestAccuracy = Math.max(s.bestAccuracy, Math.round(accuracy));
    }

    this.save();

    return {
      previous,
      record,
      isNewScore: isNewScore && score > 0,
      isNewLevel: isNewLevel && level > 0,
      isNewCombo: isNewCombo && combo > 0,
      scoreGap: Math.max(0, previous.score - score)
    };
  }

  // ------------------------------------------------------------------ stats & collection

  /** In-run counters (kept in memory; persisted by the next save()) */
  addStat(name, amount = 1) {
    if (typeof this.data.stats[name] !== 'number') return;
    this.data.stats[name] += amount;
  }

  maxStat(name, value) {
    if (typeof this.data.stats[name] !== 'number') return;
    if (value > this.data.stats[name]) this.data.stats[name] = value;
  }

  /**
   * Count a defeated enemy.
   * @param {string} enemyId bestiary id ('REGULAR', 'HEART', 'BOSS_CHEF', ...)
   * @param {string|null} rune gesture that landed the final blow
   */
  recordKill(enemyId, rune = null) {
    this.data.stats.kills += 1;
    this.data.kills[enemyId] = (this.data.kills[enemyId] || 0) + 1;
    this.data.seen[enemyId] = true;
    if (rune && RUNES[rune]) {
      this.data.stats.killsByRune[rune] = (this.data.stats.killsByRune[rune] || 0) + 1;
    }
  }

  /** @returns {boolean} true the first time this enemy type is met (the caller may save) */
  markSeen(enemyId) {
    if (this.data.seen[enemyId]) return false;
    this.data.seen[enemyId] = true;
    return true;
  }

  isSeen(enemyId) {
    return !!this.data.seen[enemyId];
  }

  getKills(enemyId) {
    return this.data.kills[enemyId] || 0;
  }

  // ------------------------------------------------------------------ achievements

  isUnlocked(id) {
    return !!this.data.achievements[id];
  }

  /** @returns {boolean} true if newly unlocked */
  unlock(id) {
    if (this.data.achievements[id]) return false;
    this.data.achievements[id] = Date.now();
    return true;
  }

  unlockedCount() {
    return Object.keys(this.data.achievements).length;
  }

  // ------------------------------------------------------------------ practice

  getPractice(rune) {
    return { attempts: 0, passes: 0, good: 0, best: 0, ...(this.data.practice[rune] || {}) };
  }

  /**
   * @param {string} rune
   * @param {number} accuracy 0..1 similarity to the rune template
   * @param {boolean} passed whether the stroke was recognised as this rune
   * @returns {{mastered: boolean, becameMastered: boolean, good: boolean}} `good` = counted towards mastery
   */
  recordPractice(rune, accuracy, passed) {
    if (!RUNES[rune]) return { mastered: false, becameMastered: false, good: false };
    const before = this.isMastered(rune);
    const p = this.getPractice(rune);
    const acc = Math.min(1, nonNegative(accuracy));
    let good = false;
    p.attempts += 1;
    if (passed) {
      p.passes += 1;
      p.best = Math.max(p.best, acc);
      this.data.stats.practicePasses += 1;
      good = acc >= masteryThreshold(rune);
      if (good) p.good += 1;
    }
    this.data.practice[rune] = p;
    const mastered = this.isMastered(rune);
    return { mastered, becameMastered: mastered && !before, good };
  }

  /** A rune is mastered after MASTERY_PASSES recognised strokes at or above its masteryThreshold */
  isMastered(rune) {
    const p = this.data.practice[rune];
    return !!p && p.good >= MASTERY_PASSES;
  }

  masteredCount() {
    return Object.keys(RUNES).filter(r => this.isMastered(r)).length;
  }

  // ------------------------------------------------------------------ story progress & companions

  /** @param {number} level Story level 1..5 that was just cleared */
  markLevelCleared(level) {
    const n = Math.round(Number(level));
    if (!(n >= 1 && n <= 5) || this.data.cleared[n]) return false;
    this.data.cleared[n] = true;
    return true;
  }

  isLevelCleared(level) {
    return !!this.data.cleared[level];
  }

  getCompanion() {
    return this.data.companion;
  }

  /** @returns {boolean} true if the id is a real companion (the caller checks it is unlocked) */
  setCompanion(id) {
    if (!COMPANIONS[id]) return false;
    this.data.companion = id;
    return true;
  }

  // ------------------------------------------------------------------ story mystery (see core/Lore.js)

  /** @param {number} level Story level 1..5 whose boss was just purified @returns {boolean} true the first time */
  unlockShard(level) {
    const n = Math.round(Number(level));
    if (!(n >= 1 && n <= 5) || this.data.lore.shards[n]) return false;
    this.data.lore.shards[n] = true;
    return true;
  }

  hasShard(level) {
    return !!this.data.lore.shards[level];
  }

  shardCount() {
    return Object.keys(this.data.lore.shards).length;
  }

  /** @param {number} level Story level 1..5 whose pledge was kept @returns {boolean} true the first time */
  keepPledge(level) {
    const n = Math.round(Number(level));
    if (!(n >= 1 && n <= 5) || this.data.lore.pledges[n]) return false;
    this.data.lore.pledges[n] = true;
    return true;
  }

  hasPledge(level) {
    return !!this.data.lore.pledges[level];
  }

  pledgeCount() {
    return Object.keys(this.data.lore.pledges).length;
  }

  /** @param {'normal'|'true'} kind */
  isEndingSeen(kind) {
    return !!this.data.lore.endings[kind];
  }

  /** @returns {boolean} true the first time this ending is marked */
  markEndingSeen(kind) {
    if (!ENDING_KINDS.includes(kind) || this.data.lore.endings[kind]) return false;
    this.data.lore.endings[kind] = true;
    if (kind === 'true') this.data.stats.trueEndings += 1;
    return true;
  }

  // ------------------------------------------------------------------ daily challenge

  /** @returns {{score:number, wave:number, combo:number, plays:number}|null} */
  getDaily(key) {
    const d = this.data.daily[key];
    return d ? { ...d } : null;
  }

  /**
   * Fold a finished daily run in. Only the best score of the day is kept.
   * @param {string} key 'YYYY-MM-DD'
   * @param {{score:number, wave:number, combo:number}} run
   * @returns {{isNewBest: boolean, previous: number, record: Object, streak: number}}
   */
  recordDaily(key, run) {
    if (!isValidDateKey(key)) return { isNewBest: false, previous: 0, record: null, streak: 0 };
    const score = Math.max(0, Math.round(nonNegative(run.score)));
    const prev = this.data.daily[key];
    const previous = prev ? prev.score : 0;
    const isNewBest = score > previous;
    this.data.daily[key] = {
      score: Math.max(previous, score),
      wave: Math.max(prev ? prev.wave : 0, Math.round(nonNegative(run.wave))),
      combo: Math.max(prev ? prev.combo : 0, Math.round(nonNegative(run.combo))),
      plays: (prev ? prev.plays : 0) + 1
    };
    this.data.stats.dailyPlays += 1;

    // Forget very old days
    const oldest = shiftDateKey(key, -DAILY_KEEP_DAYS);
    for (const k of Object.keys(this.data.daily)) {
      if (k < oldest) delete this.data.daily[k];
    }

    const streak = this.dailyStreak(key);
    this.data.stats.bestDailyStreak = Math.max(this.data.stats.bestDailyStreak, streak);
    this.save();
    return { isNewBest, previous, record: { ...this.data.daily[key] }, streak };
  }

  /**
   * Consecutive days with a daily run, counting back from `key`. A streak is still alive if the player
   * has not played today yet but did yesterday.
   * @param {string} key today's date key
   */
  dailyStreak(key) {
    let cursor = this.data.daily[key] ? key : shiftDateKey(key, -1);
    let streak = 0;
    while (this.data.daily[cursor]) {
      streak++;
      cursor = shiftDateKey(cursor, -1);
    }
    return streak;
  }

  // ------------------------------------------------------------------ live operations

  /**
   * Progress towards an event's rewards. Progress belongs to one version of the event's rules, so when `version` is given
   * and differs from the stored one the answer is "nothing yet".
   * @returns {{runs:number, bestScore:number, bestWave:number, bestCombo:number}}
   */
  getEventProgress(eventId, version) {
    const e = this.data.liveops.events[eventId];
    return e && (version === undefined || e.version === version) ? { runs: e.runs, bestScore: e.bestScore, bestWave: e.bestWave, bestCombo: e.bestCombo } : emptyEventProgress();
  }

  /**
   * Fold a run that took part in an event into that event's progress. Progress belongs to one version of the event's
   * rules: when the rules change, the count starts again (rewards already granted stay granted).
   * @returns {{runs:number, bestScore:number, bestWave:number, bestCombo:number}} the new progress
   */
  applyEventRun(eventId, version, run, nowMs = Date.now()) {
    if (!EVENT_ID.test(eventId)) return emptyEventProgress();
    const prev = this.data.liveops.events[eventId];
    const base = prev && prev.version === version ? prev : emptyEventProgress();
    const next = applyEventRun(base, run);
    this.data.liveops.events[eventId] = { version, ...next, at: Math.round(nowMs) };
    pruneByAt(this.data.liveops.events, LIVEOPS_KEEP.events);
    return { ...next };
  }

  /** @returns {Record<string, true>} reward key ('eventId:rewardId') -> true, for evaluateRewards */
  grantedRewardKeys(eventId) {
    const out = {};
    for (const g of Object.values(this.data.liveops.granted)) if (g.eventId === eventId) out[g.rewardId] = true;
    return out;
  }

  /**
   * Record a reward the player has earned. Idempotent: a reward is granted once, ever.
   * @param {{eventId:string, rewardId:string, type:'cosmetic'|'badge', ref:string, label:string, eventName?:string}} reward
   * @returns {boolean} true when it was newly granted
   */
  grantEventReward(reward, nowMs = Date.now()) {
    const key = `${reward.eventId}:${reward.rewardId}`;
    if (!EVENT_ID.test(reward.eventId) || !REWARD_ID.test(reward.rewardId) || !REWARD_TYPES.includes(reward.type)) return false;
    if (this.data.liveops.granted[key]) return false;
    if (reward.type === 'cosmetic' && !grantableCosmetics().includes(reward.ref)) return false;
    this.data.liveops.granted[key] = {
      eventId: reward.eventId, rewardId: reward.rewardId, type: reward.type, ref: String(reward.ref),
      label: String(reward.label || ''), eventName: String(reward.eventName || '').slice(0, LIVEOPS_LIMITS.name), at: Math.round(nowMs)
    };
    pruneByAt(this.data.liveops.granted, LIVEOPS_KEEP.granted);
    return true;
  }

  /** @param {string} ref 'trail:frost' or 'hat:crown': is it owned through an event reward? */
  hasEventCosmetic(ref) {
    return Object.values(this.data.liveops.granted).some((g) => g.type === 'cosmetic' && g.ref === ref);
  }

  /** @returns {Array<Object>} granted rewards, newest first */
  eventRewards() {
    return Object.values(this.data.liveops.granted).sort((a, b) => b.at - a.at).map((g) => ({ ...g }));
  }

  /** @returns {{score:number, wave:number, combo:number, plays:number, at:number}|null} best on one exact leaderboard */
  getBoard(boardId) {
    const b = this.data.liveops.boards[boardId];
    return b ? { ...b } : null;
  }

  /**
   * Keep the best result per leaderboard. A board id carries the rules and score versions, so a changed challenge
   * starts a fresh board instead of mixing incomparable scores.
   * @returns {{isNewBest: boolean, previous: number, record: Object|null}}
   */
  recordBoard(boardId, run, nowMs = Date.now()) {
    if (!parseBoardId(boardId)) return { isNewBest: false, previous: 0, record: null };
    const prev = this.data.liveops.boards[boardId];
    const score = Math.min(RUN_CAPS.score, Math.max(0, Math.round(nonNegative(run.score))));
    const previous = prev ? prev.score : 0;
    this.data.liveops.boards[boardId] = {
      score: Math.max(previous, score),
      wave: Math.max(prev ? prev.wave : 0, Math.min(RUN_CAPS.wave, Math.round(nonNegative(run.wave)))),
      combo: Math.max(prev ? prev.combo : 0, Math.min(RUN_CAPS.combo, Math.round(nonNegative(run.combo)))),
      plays: (prev ? prev.plays : 0) + 1,
      at: Math.round(nowMs)
    };
    pruneByAt(this.data.liveops.boards, LIVEOPS_KEEP.boards);
    return { isNewBest: score > previous, previous, record: { ...this.data.liveops.boards[boardId] } };
  }

  /** @returns {Array<{boardId:string, score:number, wave:number, combo:number, plays:number, at:number}>} newest first */
  boardHistory(limit = 20) {
    return Object.entries(this.data.liveops.boards)
      .map(([boardId, b]) => ({ boardId, ...b }))
      .sort((a, b) => b.at - a.at)
      .slice(0, limit);
  }

  // ------------------------------------------------------------------ spell phrases

  /**
   * Count a cast Spell Phrase.
   * @param {string} id
   * @returns {{isNew: boolean, count: number}} isNew: the first time this phrase has ever been cast
   */
  recordPhrase(id) {
    if (!SPELL_PHRASES.some(p => p.id === id)) return { isNew: false, count: 0 };
    const before = this.data.phrases[id] || 0;
    this.data.phrases[id] = before + 1;
    this.data.stats.phrasesCast += 1;
    return { isNew: before === 0, count: before + 1 };
  }

  isPhraseDiscovered(id) {
    return (this.data.phrases[id] || 0) > 0;
  }

  getPhraseCount(id) {
    return this.data.phrases[id] || 0;
  }

  discoveredPhraseCount() {
    return SPELL_PHRASES.filter(p => this.isPhraseDiscovered(p.id)).length;
  }

  // ------------------------------------------------------------------ cosmetics

  /** @param {'trail'|'hat'} kind */
  getEquipped(kind) {
    return kind === 'hat' ? this.data.cosmetics.hat : this.data.cosmetics.trail;
  }

  /**
   * @param {'trail'|'hat'} kind
   * @param {string} id (the caller checks it is unlocked)
   * @returns {boolean} false if there is no such cosmetic
   */
  equipCosmetic(kind, id) {
    if (!getCosmetic(kind, id)) return false;
    if (kind === 'hat') this.data.cosmetics.hat = id;
    else this.data.cosmetics.trail = id;
    return true;
  }

  isCosmeticSeen(id) {
    return !!this.data.cosmetics.seen[id];
  }

  markCosmeticSeen(id) {
    this.data.cosmetics.seen[id] = true;
  }

  // ------------------------------------------------------------------ boss rush

  /** @returns {{score:number, seconds:number, level:number, plays:number, clears:number}} */
  getRush() {
    return { ...this.data.rush };
  }

  /**
   * Fold a finished Boss Rush run in.
   * @param {{score:number, level:number, seconds:number, victory:boolean}} run level = bosses reached (1..5)
   * @returns {{isNewScore: boolean, isNewTime: boolean, record: Object, previous: Object}}
   */
  recordRush(run) {
    const prev = this.getRush();
    const r = this.data.rush;
    const score = Math.max(0, Math.round(nonNegative(run.score)));
    const seconds = Math.max(1, Math.round(nonNegative(run.seconds, 1)));
    const level = Math.min(5, Math.max(0, Math.round(nonNegative(run.level))));

    const isNewScore = score > prev.score;
    const isNewTime = !!run.victory && (prev.seconds === 0 || seconds < prev.seconds);

    r.plays += 1;
    r.score = Math.max(r.score, score);
    r.level = Math.max(r.level, level);
    if (run.victory) {
      r.clears += 1;
      this.data.stats.rushClears += 1;
      if (isNewTime) r.seconds = seconds;
    }
    this.save();
    return { isNewScore: isNewScore && score > 0, isNewTime, record: this.getRush(), previous: prev };
  }

  // ------------------------------------------------------------------ misc

  /** Wipe everything (used by tests and a possible "reset progress" action) */
  clear() {
    this.data = freshData();
    this.save();
  }
}
