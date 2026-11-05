/**
 * @file RunSave.js
 * @description Saves an Endless run in progress so the player can continue it later.
 *
 * The snapshot is taken at the START of a wave (a clean moment: no ghosts, no projectiles), so there
 * is nothing fragile to serialize: just the wave number, hearts, score, upgrades and session metrics.
 * Resuming puts the player back at the start of that wave.
 *
 * Only plain Endless runs are saved. Daily challenges are one-shot attempts, and Story already has
 * its own level select.
 */

import { STORAGE_KEYS } from './Constants.js';
import { UPGRADES } from './Upgrades.js';
import { DIFFICULTIES } from './ProgressStore.js';

const VERSION = 1;
/** Don't bother saving the first wave: nothing worth continuing yet */
export const MIN_SAVE_WAVE = 2;
/** A save older than this is dropped on load (the game has probably been updated since) */
const MAX_AGE_MS = 30 * 24 * 3600 * 1000;

function nonNegativeInt(n, fallback = 0) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

/**
 * Build a snapshot from the live game.
 * @param {Object} game
 * @returns {Object}
 */
export function buildEndlessSnapshot(game) {
  const m = game.metrics || {};
  return {
    v: VERSION,
    mode: 'ENDLESS',
    savedAt: Date.now(),
    difficulty: game.difficulty || 'NORMAL',
    // A run that used assists stays unranked after being resumed
    assisted: !!game.runAssisted,
    wave: game.waveSystem.currentWave,
    score: Math.round(game.score || 0),
    hp: game.player.hp,
    maxHp: game.player.maxHp,
    upgrades: { ...game.upgrades.stacks },
    metrics: {
      spellsCast: m.spellsCast || 0,
      spellsHit: m.spellsHit || 0,
      damageTaken: m.damageTaken || 0,
      enemiesDefeated: m.enemiesDefeated || 0,
      maxCombo: m.maxCombo || 0,
      // Time already played, so the resumed run doesn't count the time spent away
      elapsedMs: m.startTime ? Math.max(0, Date.now() - m.startTime) : 0
    }
  };
}

/**
 * Validate untrusted JSON into a snapshot, or null if it can't be trusted.
 * @param {*} raw
 * @returns {Object|null}
 */
export function sanitizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object' || raw.v !== VERSION || raw.mode !== 'ENDLESS') return null;
  const wave = nonNegativeInt(raw.wave);
  if (wave < MIN_SAVE_WAVE || wave > 9999) return null;
  const savedAt = nonNegativeInt(raw.savedAt);
  if (!savedAt || Date.now() - savedAt > MAX_AGE_MS) return null;

  const maxHp = Math.min(6, Math.max(1, nonNegativeInt(raw.maxHp, 5)));
  const hp = Math.min(maxHp, Math.max(1, nonNegativeInt(raw.hp, maxHp)));

  const upgrades = {};
  if (raw.upgrades && typeof raw.upgrades === 'object') {
    for (const [id, def] of Object.entries(UPGRADES)) {
      const n = Math.min(def.max, nonNegativeInt(raw.upgrades[id]));
      if (n > 0) upgrades[id] = n;
    }
  }

  const m = raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {};
  return {
    v: VERSION,
    mode: 'ENDLESS',
    savedAt,
    difficulty: DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : 'NORMAL',
    assisted: !!raw.assisted,
    wave,
    score: nonNegativeInt(raw.score),
    hp,
    maxHp,
    upgrades,
    metrics: {
      spellsCast: nonNegativeInt(m.spellsCast),
      spellsHit: nonNegativeInt(m.spellsHit),
      damageTaken: nonNegativeInt(m.damageTaken),
      enemiesDefeated: nonNegativeInt(m.enemiesDefeated),
      maxCombo: nonNegativeInt(m.maxCombo),
      elapsedMs: nonNegativeInt(m.elapsedMs)
    }
  };
}

export class RunSaveStore {
  /**
   * @param {Storage|null} [storage] defaults to window.localStorage when available
   */
  constructor(storage) {
    this._storage = storage !== undefined ? storage : RunSaveStore._defaultStorage();
  }

  static _defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* access can throw */ }
    return null;
  }

  /** @returns {Object|null} the saved snapshot, or null if there is none / it is invalid */
  load() {
    if (!this._storage) return null;
    try {
      const raw = this._storage.getItem(STORAGE_KEYS.ENDLESS_SAVE);
      if (!raw) return null;
      const snap = sanitizeSnapshot(JSON.parse(raw));
      if (!snap) this.clear();
      return snap;
    } catch (e) {
      return null;
    }
  }

  exists() {
    return this.load() !== null;
  }

  /** @returns {boolean} whether the snapshot was written */
  save(snapshot) {
    if (!this._storage || !snapshot) return false;
    try {
      this._storage.setItem(STORAGE_KEYS.ENDLESS_SAVE, JSON.stringify(snapshot));
      return true;
    } catch (e) {
      return false;
    }
  }

  clear() {
    if (!this._storage) return;
    try {
      this._storage.removeItem(STORAGE_KEYS.ENDLESS_SAVE);
    } catch (e) { /* ignore */ }
  }
}
