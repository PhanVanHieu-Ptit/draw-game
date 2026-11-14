/**
 * @file EventSystem.js
 * @description Surprises that break the rhythm of a wave: a golden ghost that must be caught before it escapes,
 * a meteor shower, a blood moon and a festival of healing ghosts.
 *
 * Each wave gets a small schedule (decided when the wave starts, from a seeded generator in Daily Challenges so
 * everybody meets the same surprises). The schedule only advances while ghosts are actually being spawned, so
 * nothing fires during a boss fight or an intermission. When an entry comes due, update() returns a description
 * of what happened: Game announces it and hands the `spawns` to WaveSystem.queueSpawn().
 *
 * The system also owns the two timed effects the events (and the "Golden Hour" spell phrase) use:
 * a score multiplier and a ghost speed scale.
 *
 * Pure logic: no DOM, no canvas, no Game.
 */

import { waveRng } from '../core/Challenge.js';

export const EVENT_DEFS = {
  GOLDEN: { icon: '🌟', name: 'U Linh Vàng', text: '🌟 U LINH VÀNG XUẤT HIỆN — bắt nó trước khi nó trốn!' },
  METEOR: { icon: '🌠', name: 'Mưa Sao Băng', text: '🌠 MƯA SAO BĂNG! Hạ thật nhanh — điểm x2!' },
  BLOOD_MOON: { icon: '🌕', name: 'Trăng Máu', text: '🌕 TRĂNG MÁU! U linh nhanh hơn, điểm x2!' },
  HEART_FEST: { icon: '💖', name: 'Lễ Hội U Linh Tim', text: '💖 LỄ HỘI U LINH TIM — hãy chạm vào chúng!' }
};

/** Relative weights of the ordinary (non-golden) events */
const EVENT_WEIGHTS = [
  ['METEOR', 40],
  ['BLOOD_MOON', 35],
  ['HEART_FEST', 25]
];

const GOLDEN_CHANCE = 0.45;
const EVENT_CHANCE = 0.55;
const DEFAULT_POOL = ['horizontal', 'vertical', 'caret', 'v_shape'];

export class EventSystem {
  constructor() {
    this.seed = null;
    this.rng = Math.random;
    this.reset();
  }

  /** Forget everything (a new run starts) */
  reset() {
    this.plan = [];
    this.clock = 0;
    this.wave = 0;
    this.scoreMult = 1;
    this.scoreTimer = 0;
    this.speedScale = 1;
    this.speedTimer = 0;
    this.surpriseScale = 1;
  }

  /**
   * Live operations: how often surprises happen relative to the normal rate (0 = never, 2 = twice as likely, capped at
   * the certainty of 1). At scale 1 nothing changes, so every existing seeded Daily Challenge plays exactly as before;
   * at another scale the schedule is still a pure function of (seed, wave, scale), so everyone on the same challenge
   * rules meets the same surprises.
   * @param {number} scale 0..3
   */
  setSurpriseScale(scale) {
    const n = Number(scale);
    this.surpriseScale = Number.isFinite(n) ? Math.min(3, Math.max(0, n)) : 1;
  }

  /** @param {number|null} seed Daily Challenge seed, or null for ordinary randomness */
  setSeed(seed) {
    this.seed = seed === null || seed === undefined ? null : seed >>> 0;
  }

  /**
   * Decide which surprises this wave holds.
   * @param {number} wave wave / level number (also keys the seeded generator)
   * @param {{enabled?: boolean}} [opts] enabled=false for the tutorial level, boss levels, Boss Rush...
   */
  startWave(wave, opts = {}) {
    this.wave = wave;
    this.clock = 0;
    this.plan = [];
    this.rng = this.seed === null ? Math.random : waveRng((this.seed ^ 0x5bd1e995) >>> 0, wave);
    if (!opts.enabled) return;

    const r = this.rng;
    const kinds = [];
    if (r() < GOLDEN_CHANCE * this.surpriseScale) kinds.push('GOLDEN');
    if (r() < EVENT_CHANCE * this.surpriseScale) kinds.push(this._pickWeighted());
    if (kinds.length === 2 && r() < 0.5) kinds.reverse();

    let at = 7 + r() * 6;
    for (const kind of kinds) {
      this.plan.push({ kind, at });
      at += 9 + r() * 5;
    }
  }

  _pickWeighted() {
    const total = EVENT_WEIGHTS.reduce((n, [, w]) => n + w, 0);
    let roll = this.rng() * total;
    for (const [kind, w] of EVENT_WEIGHTS) {
      roll -= w;
      if (roll < 0) return kind;
    }
    return EVENT_WEIGHTS[0][0];
  }

  /** Raise (never lower) the score multiplier for `seconds` */
  boostScore(mult, seconds) {
    this.scoreMult = Math.max(this.scoreMult, mult);
    this.scoreTimer = Math.max(this.scoreTimer, seconds);
  }

  /** Make freshly generated ghosts faster for `seconds` */
  boostSpeed(scale, seconds) {
    this.speedScale = Math.max(this.speedScale, scale);
    this.speedTimer = Math.max(this.speedTimer, seconds);
  }

  _tickEffects(dt) {
    if (this.scoreTimer > 0) {
      this.scoreTimer -= dt;
      if (this.scoreTimer <= 0) {
        this.scoreTimer = 0;
        this.scoreMult = 1;
      }
    }
    if (this.speedTimer > 0) {
      this.speedTimer -= dt;
      if (this.speedTimer <= 0) {
        this.speedTimer = 0;
        this.speedScale = 1;
      }
    }
  }

  /**
   * @param {number} dt seconds of game time
   * @param {Object} state
   * @param {boolean} state.active true while ghosts are being spawned normally (no boss, no intermission)
   * @param {number} state.hp
   * @param {number} state.maxHp
   * @param {string[]} [state.pool] runes the current level / daily twist allows
   * @param {boolean} [state.noHearts] healing ghosts are forbidden (daily twist)
   * @returns {Array<{kind: string, icon: string, name: string, text: string, spawns: Array}>} events that just fired
   */
  update(dt, state) {
    this._tickEffects(dt);
    const fired = [];
    if (!state || !state.active || this.plan.length === 0) return fired;

    this.clock += dt;
    while (this.plan.length > 0 && this.plan[0].at <= this.clock) {
      const entry = this.plan.shift();
      const ev = this._fire(entry.kind, state);
      if (ev) fired.push(ev);
    }
    return fired;
  }

  _runePool(state) {
    return state.pool && state.pool.length > 0 ? state.pool : DEFAULT_POOL;
  }

  _randomRune(pool) {
    return pool[Math.floor(this.rng() * pool.length)];
  }

  _fire(kind, state) {
    const pool = this._runePool(state);

    // A healing festival means nothing to a healthy Momo (or when healing is banned): make it a meteor shower
    if (kind === 'HEART_FEST' && (state.hp >= state.maxHp || state.noHearts)) kind = 'METEOR';

    const def = EVENT_DEFS[kind];
    const ev = { kind, icon: def.icon, name: def.name, text: def.text, spawns: [] };

    if (kind === 'GOLDEN') {
      const count = this.wave >= 8 ? 3 : 2;
      const symbolQueue = [];
      for (let i = 0; i < count; i++) symbolQueue.push(this._randomRune(pool));
      ev.spawns.push({ archetype: 'REGULAR', symbolQueue, isGolden: true, isHeartGhost: false, speedMultiplier: 1.5 });
    } else if (kind === 'METEOR') {
      const squad = [];
      for (let i = 0; i < 5; i++) {
        squad.push({
          archetype: 'SPEEDSTER',
          symbolQueue: [this._randomRune(pool)],
          isHeartGhost: false,
          speedMultiplier: 0.95
        });
      }
      ev.spawns.push(squad);
      this.boostScore(2, 12);
    } else if (kind === 'BLOOD_MOON') {
      this.boostSpeed(1.25, 14);
      this.boostScore(2, 14);
    } else if (kind === 'HEART_FEST') {
      const count = state.maxHp - state.hp >= 2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        ev.spawns.push({ archetype: 'REGULAR', symbolQueue: ['heart'], isHeartGhost: true, speedMultiplier: 0 });
      }
    }
    return ev;
  }

  /**
   * Meteor volley called down by a boss: `count` fast single-rune ghosts as one squad.
   * @param {string[]} pool runes to draw from
   * @param {number} [count=3]
   * @returns {Array<Object>} a squad (array of ghost configs)
   */
  makeMeteorSquad(pool, count = 3) {
    const runes = pool && pool.length > 0 ? pool : DEFAULT_POOL;
    const squad = [];
    for (let i = 0; i < count; i++) {
      squad.push({
        archetype: 'SPEEDSTER',
        symbolQueue: [runes[Math.floor(this.rng() * runes.length)]],
        isHeartGhost: false,
        speedMultiplier: 0.95
      });
    }
    return squad;
  }
}
