/**
 * @file Settings.js
 * @description Persistent player preferences (volume, gesture sensitivity, haptics, shake, hints, graphics,
 * accessibility: colour-blind markers, slow-motion assist, alternative input).
 *
 * The store only holds and validates values and notifies listeners; Game applies them to the
 * subsystems (see Game._applySetting). localStorage may be missing or throw (private mode, sandboxed
 * iframes), so every access is guarded and the game keeps working with in-memory values.
 */

import { STORAGE_KEYS } from './Constants.js';

export const SENSITIVITY_OPTIONS = ['easy', 'normal', 'strict'];
export const QUALITY_OPTIONS = ['auto', 'high', 'medium', 'low'];
/** Slow-motion assist: percentage by which ghosts are slowed. Runs with assist on are not ranked. */
export const ASSIST_OPTIONS = [0, 20, 30];

/**
 * Slider values are 0..100 in the UI. These factors convert them to the internal gain values so that
 * the defaults reproduce the loudness the game shipped with (master 0.4, music 0.35, SFX 1.0).
 */
export const AUDIO_SCALE = {
  master: 0.8,
  music: 0.5,
  sfx: 1.0,
  cat: 1.0
};

export const DEFAULT_SETTINGS = Object.freeze({
  masterVolume: 50,
  musicVolume: 70,
  sfxVolume: 100,
  catVolume: 100,
  muted: false,
  sensitivity: 'normal',
  haptics: true,
  screenShake: true,
  missHints: true,
  quality: 'auto',
  colorBlind: false,
  assist: 0,
  altInput: false
});

const NUMBER_KEYS = ['masterVolume', 'musicVolume', 'sfxVolume', 'catVolume'];
const BOOLEAN_KEYS = ['muted', 'haptics', 'screenShake', 'missHints', 'colorBlind', 'altInput'];

/**
 * Coerce a value for `key` into something valid, or return undefined if it is not salvageable.
 * @param {string} key
 * @param {*} value
 * @returns {*}
 */
export function sanitizeSetting(key, value) {
  if (NUMBER_KEYS.includes(key)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(100, Math.round(n)));
  }
  if (BOOLEAN_KEYS.includes(key)) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
  }
  if (key === 'sensitivity') return SENSITIVITY_OPTIONS.includes(value) ? value : undefined;
  if (key === 'quality') return QUALITY_OPTIONS.includes(value) ? value : undefined;
  if (key === 'assist') {
    const n = Number(value);
    return ASSIST_OPTIONS.includes(n) ? n : undefined;
  }
  return undefined;
}

export class SettingsStore {
  /**
   * @param {Storage|null} [storage] defaults to window.localStorage when available
   */
  constructor(storage) {
    this._storage = storage !== undefined ? storage : SettingsStore._defaultStorage();
    this._listeners = [];
    this._values = { ...DEFAULT_SETTINGS };
    this._load();
  }

  static _defaultStorage() {
    try {
      if (typeof localStorage !== 'undefined') return localStorage;
    } catch (e) { /* access can throw */ }
    return null;
  }

  _load() {
    if (!this._storage) return;
    try {
      const raw = this._storage.getItem(STORAGE_KEYS.SETTINGS);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        const clean = sanitizeSetting(key, parsed[key]);
        if (clean !== undefined) this._values[key] = clean;
      }
    } catch (e) { /* corrupt JSON: fall back to defaults */ }
  }

  _save() {
    if (!this._storage) return;
    try {
      this._storage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this._values));
    } catch (e) { /* quota / private mode */ }
  }

  get(key) {
    return this._values[key];
  }

  all() {
    return { ...this._values };
  }

  /**
   * @param {string} key
   * @param {*} value
   * @returns {boolean} true if the stored value changed
   */
  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return false;
    const clean = sanitizeSetting(key, value);
    if (clean === undefined || clean === this._values[key]) return false;
    this._values[key] = clean;
    this._save();
    this._emit(key, clean);
    return true;
  }

  /** Restore every setting to its default and notify listeners of each change. */
  reset() {
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      this.set(key, DEFAULT_SETTINGS[key]);
    }
  }

  /**
   * Subscribe to changes. The callback receives (key, value).
   * @param {(key: string, value: *) => void} fn
   * @returns {() => void} unsubscribe
   */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter(l => l !== fn);
    };
  }

  _emit(key, value) {
    for (const fn of this._listeners) {
      try { fn(key, value); } catch (e) { /* a bad listener must not break the others */ }
    }
  }
}
