/**
 * @file LiveOps.js
 * @description The game's side of Live Operations (see docs/live-operations.md): downloads the schedule the admin
 * server publishes, keeps it honest, and answers the questions the game asks: which daily / weekly challenge is on,
 * which seasonal / random events change this run, what to announce, and which rewards a finished run has earned.
 *
 * Design rules (they are what the tests lock):
 *  - The server decides what is live. The game only evaluates a schedule the server published, against a clock it
 *    synchronised with the server (`serverTime` in the payload), never against the raw device clock alone.
 *  - Nothing here may break the game. No URL configured, a timeout, a 500, malformed JSON, a payload that fails the
 *    strict contract: every path ends in "play with what we have", ultimately the built-in daily rotation.
 *  - A payload is accepted whole or not at all (shared/live-ops/schedule.js validatePublicPayload).
 *  - Offline fallback: the last good payload is cached. While it is fresh enough (the server says how long:
 *    `staleAfterSeconds`) the schedule keeps working on the clock offset measured at the last sync. Rewards are the
 *    exception: they need a clock confirmed by the server in THIS session, so offline play never grants any.
 *  - A run is pinned to the event versions that were live when it started. A schedule update that arrives mid-run
 *    changes nothing about that run; a reward claim for a different version is refused.
 *
 * Pure logic plus fetch / localStorage, both injected and guarded: no DOM, no canvas, no Game.
 */

import * as L from '../../shared/live-ops/index.js';
import { ENVIRONMENTS } from '../../shared/game-configuration.js';
import { dateKey } from './Challenge.js';
import { RUNES } from './Constants.js';

export const LIVEOPS_STORAGE = {
  CACHE: 'arcane_paws_liveops_v1',
  INSTALL: 'arcane_paws_install_v1',
  DISMISSED: 'arcane_paws_liveops_dismissed_v1'
};

export const FETCH_TIMEOUT_MS = 2500;
/** Refreshes closer together than this are skipped (the menu asks on every visit) */
export const MIN_REFRESH_MS = 60 * 1000;
/** How far a device clock may disagree with its own saved timestamps before the cache is not trusted */
export const CLOCK_SKEW_MS = 5 * L.MINUTE;
const MAX_DISMISSED = 60;

const defaultStorage = () => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { /* access can throw */ }
  return null;
};

const randomId = () => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (e) { /* fall through */ }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
};

const clamp = (n, [lo, hi]) => Math.min(hi, Math.max(lo, n));

/**
 * The WaveSystem modifier for the combined rules of the overlay events that are live (same shape as a built-in daily
 * twist). A key is present only when it changes the run; `null` when nothing does (a visual-only event).
 * @param {ReturnType<typeof L.mergeRules>} merged
 * @param {Array<{name: string}>} events
 */
export function mergedToModifier(merged, events) {
  const mod = {};
  // `conflict` means the restrictions left no gesture at all: the server refuses to schedule that, and a client that
  // is handed it anyway keeps every gesture rather than spawning ghosts nobody can draw
  if (!merged.conflict && merged.runes.length) mod.runes = [...merged.runes];
  if (merged.noHearts) mod.noHearts = true;
  const speed = clamp(merged.speedMultiplier, L.SAFE_LIMITS.speed);
  if (speed !== 1) mod.speed = speed;
  const spawn = clamp(merged.intervalMultiplier, L.SAFE_LIMITS.interval);
  if (spawn !== 1) mod.spawn = spawn;
  if (merged.maxHp > 0) mod.maxHp = merged.maxHp;
  if (Object.keys(mod).length === 0) return null;
  return { id: 'liveops', icon: '🎉', name: events.map((e) => e.name).join(' + '), desc: '', ...mod };
}

const num = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

/**
 * What an event's rules do, one short Vietnamese phrase each (the Events screen lists them). Visual-only events say so.
 * @param {Object} rules a published event's `rules`
 * @returns {string[]}
 */
export function summarizeRules(rules) {
  const out = [];
  if (rules.enemy.speedMultiplier !== 1) out.push(`👻 Tốc độ u linh ×${num(rules.enemy.speedMultiplier)}`);
  if (rules.enemy.runes.length) out.push(`✍️ Chỉ ấn ký ${[...new Set(rules.enemy.runes)].map((r) => (RUNES[r] ? RUNES[r].symbol : r)).join(' ')}`);
  if (rules.enemy.noHearts) out.push('💔 Không có u linh tim');
  if (rules.spawn.intervalMultiplier !== 1) out.push(`⏱️ Nhịp xuất hiện ×${num(rules.spawn.intervalMultiplier)}`);
  if (rules.spawn.surpriseMultiplier !== 1) out.push(`🌟 Bất ngờ ×${num(rules.spawn.surpriseMultiplier)}`);
  if (rules.player.maxHp > 0) out.push(`❤️ Tối đa ${rules.player.maxHp} tim`);
  if (rules.score.multiplier !== 1) out.push(`✨ Điểm ×${num(rules.score.multiplier)}`);
  if (out.length === 0 && (rules.visual.theme !== 'none' || rules.visual.ambient !== 'none')) out.push('🎨 Chỉ đổi hiệu ứng hình ảnh');
  return out;
}

/** 5400000 -> "1 giờ 30 phút" (player-facing, Vietnamese like the rest of the game) */
export function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / L.MINUTE));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const minutes = total % 60;
  if (days > 0) return `${days} ngày ${hours} giờ`;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  return `${Math.max(1, minutes)} phút`;
}

/** An instant as the player's own wall clock reads it ("14/11/2026, 19:30"); the schedule itself is in UTC */
export function formatLocalTime(instant) {
  const ms = L.parseInstant(instant);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ms));
  } catch (e) {
    return instant;
  }
}

export class LiveOpsService {
  /**
   * @param {Object} [options]
   * @param {Storage|null} [options.storage] defaults to localStorage when available
   * @param {() => number} [options.now] device clock in ms (injected by tests)
   * @param {typeof fetch} [options.fetcher]
   */
  constructor({ storage, now = Date.now, fetcher } = {}) {
    this._storage = storage !== undefined ? storage : defaultStorage();
    this._now = now;
    this._fetcher = fetcher;
    this._listeners = new Set();
    this._install = null;
    this._dismissed = null;
    this._refreshing = null;

    this.url = null;
    this.environment = null;
    this.configured = false;
    this.payload = null;
    this.source = 'none'; // 'none' | 'network' | 'cache'
    this.clockOffsetMs = 0;
    this.clockTrusted = false;
    this.receivedAt = 0;
    this.serverTimeMs = 0;
    this.lastAttemptAt = 0;
    this.lastError = null;
  }

  // ------------------------------------------------------------------ loading

  /**
   * Point the service at a deployment and pick up the cached schedule straight away (synchronous, so the menu can use it
   * before the network answers). Without a URL nothing is ever requested and the built-in rotation is used.
   * @returns {boolean} whether a usable cached schedule was restored
   */
  configure(url, environment) {
    this.configured = Boolean(url) && ENVIRONMENTS.includes(environment);
    this.url = this.configured ? url : null;
    this.environment = this.configured ? environment : null;
    this.payload = null;
    this.source = 'none';
    this.clockTrusted = false;
    if (!this.configured) return false;
    const restored = this._restoreCache();
    if (restored) this._emit();
    return restored;
  }

  /** configure() then one refresh; resolves when the network answered or gave up. Never rejects. */
  async load(url, environment) {
    this.configure(url, environment);
    return this.refresh({ force: true });
  }

  /**
   * Ask the server for the schedule. Skipped when one is already under way or one finished less than MIN_REFRESH_MS ago.
   * @returns {Promise<{ok: boolean, source: string, reason?: string}>}
   */
  refresh({ force = false } = {}) {
    if (!this.configured) return Promise.resolve({ ok: false, source: this.source, reason: 'not-configured' });
    if (this._refreshing) return this._refreshing;
    if (!force && this.lastAttemptAt && this._now() - this.lastAttemptAt < MIN_REFRESH_MS) {
      return Promise.resolve({ ok: this.source === 'network', source: this.source, reason: 'throttled' });
    }
    // Never rejects: whatever goes wrong inside a refresh is just "the refresh failed"
    this._refreshing = this._fetch().catch(() => this._fail('error')).finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  async _fetch() {
    this.lastAttemptAt = this._now();
    let payload;
    try {
      const fetcher = this._fetcher || globalThis.fetch;
      const response = await fetcher(this.url, {
        signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined,
        credentials: 'omit',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      payload = await response.json();
    } catch (error) {
      return this._fail('network');
    }
    const problems = L.validatePublicPayload(payload, this.environment);
    if (problems.length) return this._fail('invalid', problems);

    const receivedAt = this._now();
    const serverMs = L.parseInstant(payload.serverTime);
    // An answer older than what we already hold came through a stale cache between us and the server: keep what we have
    if (this.payload && serverMs + CLOCK_SKEW_MS < this.serverTimeMs) return this._fail('stale-response');

    this.payload = payload;
    this.source = 'network';
    this.clockOffsetMs = serverMs - receivedAt;
    this.clockTrusted = true;
    this.receivedAt = receivedAt;
    this.serverTimeMs = serverMs;
    this.lastError = null;
    this._saveCache();
    this._emit();
    return { ok: true, source: 'network' };
  }

  _fail(reason, details) {
    this.lastError = reason;
    // A failed refresh never throws away a schedule we already hold; it is judged by its age (see _usable)
    this._emit();
    return { ok: false, source: this.source, reason, ...(details ? { details } : {}) };
  }

  _saveCache() {
    if (!this._storage || !this.payload) return;
    try {
      this._storage.setItem(LIVEOPS_STORAGE.CACHE, JSON.stringify({
        v: 1, url: this.url, environment: this.environment, savedAt: this.receivedAt, offsetMs: this.clockOffsetMs, payload: this.payload
      }));
    } catch (e) { /* storage full or blocked: the schedule simply is not cached */ }
  }

  _restoreCache() {
    if (!this._storage) return false;
    try {
      const raw = this._storage.getItem(LIVEOPS_STORAGE.CACHE);
      if (!raw) return false;
      const cached = JSON.parse(raw);
      if (!cached || cached.v !== 1 || cached.environment !== this.environment || cached.url !== this.url) return false;
      if (!Number.isFinite(cached.savedAt) || !Number.isFinite(cached.offsetMs) || Math.abs(cached.offsetMs) > 400 * L.DAY) return false;
      if (L.validatePublicPayload(cached.payload, this.environment).length) return false; // the cache is as untrusted as the network
      const age = this._now() - cached.savedAt;
      // Saved "in the future" = the device clock was moved back since; older than the server allows = too old to act on
      if (age < -CLOCK_SKEW_MS || age > cached.payload.staleAfterSeconds * 1000) return false;
      this.payload = cached.payload;
      this.source = 'cache';
      this.clockOffsetMs = cached.offsetMs;
      this.clockTrusted = false;
      this.receivedAt = cached.savedAt;
      this.serverTimeMs = L.parseInstant(cached.payload.serverTime);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------------ clock and state

  /** The schedule's clock: the device clock corrected by what the server said at the last sync (epoch ms) */
  now() {
    return this._now() + (this.payload ? this.clockOffsetMs : 0);
  }

  /** Is the held schedule still within the server's freshness window? */
  _usable() {
    if (!this.payload) return false;
    const age = this._now() - this.receivedAt;
    return age >= -CLOCK_SKEW_MS && age <= this.payload.staleAfterSeconds * 1000;
  }

  /** Live operations is on: a usable schedule and the master flag */
  get enabled() {
    return this._usable() && L.evaluateFlag(this.payload.flags, 'liveops.enabled', this._installId());
  }

  /** @param {string} key one of L.FLAG_KEYS */
  flag(key) {
    if (!this.enabled) return false;
    return L.evaluateFlag(this.payload.flags, key, this._installId());
  }

  status() {
    const usable = this._usable();
    return {
      configured: this.configured,
      enabled: this.enabled,
      source: usable ? this.source : 'none',
      clockTrusted: usable && this.clockTrusted,
      stale: Boolean(this.payload) && !usable,
      environment: this.environment,
      revision: this.payload ? this.payload.revision : null,
      serverTime: this.payload ? this.payload.serverTime : null,
      lastError: this.lastError
    };
  }

  onChange(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _emit() {
    for (const listener of this._listeners) {
      try { listener(this); } catch (e) { /* a broken listener must not stop the schedule */ }
    }
  }

  _installId() {
    if (this._install) return this._install;
    let id = null;
    try {
      id = this._storage ? this._storage.getItem(LIVEOPS_STORAGE.INSTALL) : null;
      if (typeof id !== 'string' || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
        id = randomId();
        if (this._storage) this._storage.setItem(LIVEOPS_STORAGE.INSTALL, id);
      }
    } catch (e) {
      id = id && /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : randomId();
    }
    this._install = id;
    return id;
  }

  // ------------------------------------------------------------------ the schedule

  _events(kind) {
    if (!this._usable()) return [];
    return kind ? this.payload.events.filter((e) => e.kind === kind) : this.payload.events;
  }

  findEvent(id) {
    return this._events().find((e) => e.id === id) || null;
  }

  /** Published events of a kind that are running now (empty when the kind's flag is off) */
  live(kind) {
    if (!this.flag(`liveops.${kind}`)) return [];
    return L.liveEvents(this._events(kind), this.now(), kind);
  }

  /**
   * The daily challenge to play. With a live event scheduled it is the event's challenge (its own seed, rules, score
   * version and board); otherwise, and always when offline, it is the built-in rotation for the UTC date, which is the
   * very challenge the game has always offered. `key` asks for a specific day (a friend's link): a published event of
   * that day wins, otherwise the built-in challenge of that date.
   * @param {string|null} [key] 'YYYY-MM-DD'
   */
  dailyChallenge(key = null) {
    const nowMs = this.now();
    if (this.flag('liveops.daily')) {
      const event = key
        ? this._events('daily').find((e) => e.challengeKey === key && ['live', 'ended'].includes(L.eventPhase(e, nowMs)))
        : L.liveEvents(this._events('daily'), nowMs, 'daily')[0];
      if (event) return L.eventChallenge(event);
    }
    return L.builtinChallenge(key || dateKey(new Date(nowMs)));
  }

  /** The weekly challenge that is on, or null (there is no built-in weekly) */
  weeklyChallenge() {
    const event = this.live('weekly')[0];
    return event ? L.eventChallenge(event) : null;
  }

  /**
   * Is this the challenge of the moment? Only the current one is ranked and counts towards streaks and rewards; an
   * older day from a friend's link is playable for fun.
   */
  isCurrentChallenge(challenge) {
    if (!challenge) return false;
    const nowMs = this.now();
    if (challenge.source === 'liveops') {
      const event = this.findEvent(challenge.eventId);
      return Boolean(event) && L.eventPhase(event, nowMs) === 'live' && event.version === challenge.rulesVersion;
    }
    return challenge.kind === 'daily' && challenge.key === dateKey(new Date(nowMs));
  }

  /**
   * Seasonal then random events that apply to a run (live, flag on, the run is eligible), highest priority first.
   * @param {{mode: string, difficulty: string, assisted: boolean, storyLevelsCleared: number}} ctx
   */
  overlaysFor(ctx) {
    const out = [];
    for (const kind of ['seasonal', 'random']) {
      for (const event of this.live(kind)) if (L.checkEligibility(event, ctx).ok) out.push(event);
    }
    return out;
  }

  /** Look of the menu: the visual of the first live overlay that has one */
  menuVisual() {
    if (!this.flag('liveops.effects')) return { theme: 'none', ambient: 'none' };
    const events = [...this.live('seasonal'), ...this.live('random')];
    const merged = L.mergeRules(events.map((e) => e.rules));
    return { theme: merged.theme, ambient: merged.ambient };
  }

  // ------------------------------------------------------------------ announcements

  _dismissedSet() {
    if (this._dismissed) return this._dismissed;
    let list = [];
    try {
      const raw = this._storage ? this._storage.getItem(LIVEOPS_STORAGE.DISMISSED) : null;
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) list = parsed.filter((k) => typeof k === 'string' && k.length <= 64).slice(-MAX_DISMISSED);
    } catch (e) { /* ignore */ }
    this._dismissed = new Set(list);
    return this._dismissed;
  }

  /**
   * Announcements to show now: from `leadHours` before an event starts until it ends, urgent first, running events
   * before upcoming ones. The text is the server's: show it as text, never as HTML.
   * @returns {Array<{key: string, eventId: string, version: number, title: string, body: string, tone: string, phase: 'upcoming'|'live', startsAt: string, endsAt: string}>}
   */
  announcements({ includeDismissed = false } = {}) {
    if (!this.flag('liveops.announcements')) return [];
    const nowMs = this.now();
    const dismissed = this._dismissedSet();
    const tones = { urgent: 0, event: 1, info: 2 };
    return this._events()
      .filter((e) => e.announcement.enabled && e.status !== 'cancelled')
      .map((e) => ({ e, phase: L.eventPhase(e, nowMs) }))
      .filter(({ e, phase }) => (phase === 'live' || (phase === 'upcoming' && nowMs >= Date.parse(e.startsAt) - e.announcement.leadHours * L.HOUR)))
      .map(({ e, phase }) => ({
        key: `${e.id}@${e.version}`, eventId: e.id, version: e.version, title: e.announcement.title, body: e.announcement.body,
        tone: e.announcement.tone, phase, startsAt: e.startsAt, endsAt: e.endsAt
      }))
      .filter((a) => includeDismissed || !dismissed.has(a.key))
      .sort((a, b) => tones[a.tone] - tones[b.tone] || (a.phase === b.phase ? 0 : a.phase === 'live' ? -1 : 1) || (a.startsAt < b.startsAt ? -1 : 1));
  }

  dismissAnnouncement(key) {
    if (typeof key !== 'string' || key.length > 64) return;
    const set = this._dismissedSet();
    set.add(key);
    while (set.size > MAX_DISMISSED) set.delete(set.values().next().value);
    try {
      if (this._storage) this._storage.setItem(LIVEOPS_STORAGE.DISMISSED, JSON.stringify([...set]));
    } catch (e) { /* not persisted: it comes back next session */ }
    this._emit();
  }

  /**
   * Everything the Events screen lists, split by where it is relative to the schedule's clock. Kinds whose flag is off
   * are left out. `past` includes cancelled events (marked) so the player is told why something vanished.
   */
  schedule() {
    const out = { live: [], upcoming: [], past: [] };
    if (!this.enabled) return out;
    const nowMs = this.now();
    for (const event of this._events()) {
      if (!this.flag(`liveops.${event.kind}`)) continue;
      const phase = L.eventPhase(event, nowMs);
      const item = { event, phase, cancelled: event.status === 'cancelled' };
      if (phase === 'live') out.live.push(item);
      else if (phase === 'upcoming') out.upcoming.push(item);
      else out.past.push(item);
    }
    const byEnd = (a, b) => Date.parse(a.event.endsAt) - Date.parse(b.event.endsAt);
    out.live.sort(byEnd);
    out.upcoming.sort((a, b) => Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt));
    out.past.sort((a, b) => byEnd(b, a));
    return out;
  }

  // ------------------------------------------------------------------ runs: pin and settle

  /**
   * Fix what a run is subject to at the moment it starts. Returns null when no event touches the run (the common
   * case offline, or when nothing is live).
   *
   * Rules of the road: a challenge run (daily / weekly) is governed by its own event, whose rules Game applies through
   * `challenge.modifier`; an ordinary Endless run takes the seasonal / random overlays it is eligible for; a Story run
   * takes only looks and rewards, because story fights are authored.
   *
   * @param {{mode: string, difficulty: string, assisted: boolean, storyLevelsCleared: number, challenge?: Object|null}} run
   */
  pinRun({ mode, difficulty, assisted, storyLevelsCleared, challenge = null }) {
    const nowMs = this.now();
    let events = [];
    if (challenge) {
      const event = challenge.source === 'liveops' ? this.findEvent(challenge.eventId) : null;
      if (event) events = [event];
    } else {
      events = this.overlaysFor({ mode, difficulty, assisted, storyLevelsCleared });
    }
    if (events.length === 0) return null;

    const gameplay = Boolean(challenge) || mode === 'ENDLESS';
    const merged = L.mergeRules(events.map((e) => e.rules));
    const effects = this.flag('liveops.effects');
    const snapshot = {};
    for (const e of events) snapshot[e.id] = { id: e.id, kind: e.kind, name: e.name, version: e.version };
    return {
      startedMs: nowMs,
      trusted: this.clockTrusted,
      entries: events.map((e) => ({ eventId: e.id, version: e.version, startedMs: nowMs, kind: e.kind })),
      events: snapshot,
      names: events.map((e) => e.name),
      modifier: challenge || !gameplay ? null : mergedToModifier(merged, events),
      surpriseMultiplier: gameplay ? clamp(merged.surpriseMultiplier, [0, 3]) : 1,
      scoreMultiplier: gameplay ? clamp(merged.scoreMultiplier, [1, L.SAFE_LIMITS.score[1]]) : 1,
      visual: effects ? { theme: merged.theme, ambient: merged.ambient } : { theme: 'none', ambient: 'none' }
    };
  }

  /**
   * Turn a finished run into event progress and rewards. Every reward passes L.validateClaim first (window, version,
   * cancellation, eligibility, plausibility, trusted clock, the rewards flag); a refused run does not count at all.
   * Settling is once per pin, and granting is idempotent on its own: the store records a reward once, ever.
   *
   * @param {Object} input
   * @param {Object|null} input.pin what pinRun returned for this run
   * @param {{mode: string, difficulty: string, assisted: boolean, score: number, wave: number, combo: number, storyLevelsCleared: number}} input.run
   * @param {import('./ProgressStore.js').ProgressStore} input.progress
   * @returns {{events: Array<Object>, granted: Array<Object>}}
   */
  settleRun({ pin, run, progress }) {
    const out = { events: [], granted: [] };
    // A run is settled once: settling the same pin again counts nothing (rewards are idempotent on their own as well)
    if (!pin || pin.settled) return out;
    pin.settled = true;
    const nowMs = this.now();
    for (const entry of pin.entries) {
      const event = this.findEvent(entry.eventId);
      const name = (event && event.name) || (pin.events[entry.eventId] && pin.events[entry.eventId].name) || entry.eventId;
      const claim = L.validateClaim({
        event, run, pinned: entry, nowMs,
        clockTrusted: this.clockTrusted && pin.trusted,
        rewardsEnabled: this.flag('liveops.rewards')
      });
      if (!claim.ok) {
        out.events.push({ eventId: entry.eventId, name, kind: entry.kind, counted: false, hasRewards: Boolean(event && event.rewards.length), reasons: claim.reasons, granted: [] });
        continue;
      }
      const next = progress.applyEventRun(entry.eventId, event.version, run, nowMs);
      const already = progress.grantedRewardKeys(entry.eventId);
      const granted = [];
      for (const rewardId of L.evaluateRewards(event, next, already)) {
        const reward = event.rewards.find((r) => r.id === rewardId);
        const fresh = progress.grantEventReward({
          eventId: event.id, rewardId, type: reward.type, ref: reward.ref, label: reward.label, eventName: event.name
        }, nowMs);
        if (fresh) granted.push({ eventId: event.id, eventName: event.name, rewardId, type: reward.type, ref: reward.ref, label: reward.label });
      }
      out.events.push({ eventId: entry.eventId, name, kind: entry.kind, counted: true, hasRewards: event.rewards.length > 0, reasons: [], progress: next, granted });
      out.granted.push(...granted);
    }
    return out;
  }
}
