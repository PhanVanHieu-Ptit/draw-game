import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminServer } from "../server/app.mjs";
import * as L from "../../shared/live-ops/index.js";
import { LiveOpsService, MIN_REFRESH_MS } from "../../src/core/LiveOps.js";
import { ProgressStore } from "../../src/core/ProgressStore.js";

// The whole chain with nothing mocked in between: the real admin server on a real loopback port, driven as an admin over
// HTTP, and the real game-side LiveOpsService reading what the server publishes through the same endpoint a deployed game
// uses. The only injected thing is time (one clock for the server, the same clock plus a deliberate skew for the "device").

const credentials = { email: "liveops@example.com", password: "liveops-password-long-enough" };
const T0 = Date.parse("2026-11-13T07:00:00Z");
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DEVICE_SKEW = -90 * MIN; // the player's device clock is 90 minutes behind the server

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

async function boot(t) {
  const clock = { ms: T0 };
  const dir = await mkdtemp(join(tmpdir(), "arcane-liveops-e2e-"));
  const server = createAdminServer({ ...credentials, dataDir: dir, now: () => clock.ms, sessionTTL: 3650 * 24 * HOUR, liveOpsTickMs: 0 });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "x-admin-request": "1" }, body: JSON.stringify(credentials) });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const admin = async (path, body) => {
    const res = await fetch(`${base}/api/liveops/environments/production${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "x-admin-request": "1", cookie },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  };
  const revision = async () => (await admin("")).json.revision;
  const create = async (content) => admin("/events", { revision: await revision(), content });
  const act = async (id, action, extra = {}) => admin(`/events/${id}/${action}`, { revision: await revision(), ...extra });
  const save = async (content) => admin(`/events/${content.id}/save`, { revision: await revision(), content });
  const flags = async (patch) => {
    const current = (await admin("")).json.flags;
    for (const [key, value] of Object.entries(patch)) current[key] = { ...current[key], ...value };
    return admin("/flags", { revision: await revision(), flags: current });
  };
  /** A game on the "device clock", pointed at the real public endpoint */
  const game = (storage = new MemoryStorage()) => {
    const service = new LiveOpsService({ storage, now: () => clock.ms + DEVICE_SKEW });
    return { service, storage, load: () => service.load(`${base}/api/game-liveops/production`, "production"), refresh: () => service.refresh({ force: true }) };
  };
  return { clock, admin, create, act, save, flags, game, base };
}

const dailyContent = (key, o = {}) =>
  L.createEventContent("daily", {
    id: `daily-${key}`, name: `Daily ${key}`, timeZone: "UTC",
    schedule: { startLocal: `${key}T00:00`, endLocal: `${L.addDays(key, 1)}T00:00` },
    rules: { scoreVersion: 2, seedSalt: "e2e", score: { multiplier: 1.5 } },
    rewards: [{ id: "five-k", type: "badge", ref: "🏅", label: "Five K", condition: { metric: "bestScore", threshold: 5000 } }],
    ...o,
  });
const seasonalContent = (o = {}) =>
  L.createEventContent("seasonal", {
    id: "frost-season", name: "Frost Season", timeZone: "Asia/Ho_Chi_Minh",
    schedule: { startLocal: "2026-11-10T00:00", endLocal: "2026-12-10T00:00" },
    eligibility: { modes: ["ENDLESS", "STORY"] },
    announcement: { enabled: true, title: "Frost is here", body: "Snow falls.", leadHours: 24, tone: "event" },
    rules: { enemy: { speedMultiplier: 0.9 }, visual: { theme: "frost", ambient: "snow" } },
    ...o,
  });
const run = (over = {}) => ({ mode: "DAILY", difficulty: "NORMAL", assisted: false, score: 6000, wave: 5, combo: 9, storyLevelsCleared: 0, ...over });
const pinDaily = (service) => service.pinRun({ mode: "DAILY", difficulty: "NORMAL", assisted: false, storyLevelsCleared: 0, challenge: service.dailyChallenge() });

test("what an admin schedules is exactly what the game plays: challenge, seed, board, overlay and announcement", async (t) => {
  const { create, act, game } = await boot(t);
  assert.equal((await create(dailyContent("2026-11-13"))).status, 201);
  assert.equal((await create(seasonalContent())).status, 201);
  assert.equal((await act("daily-2026-11-13", "schedule")).status, 200);

  // A draft never reaches a player
  const g = game();
  assert.equal((await g.load()).ok, true, "the real payload passes the game's strict validation");
  assert.equal(g.service.dailyChallenge().eventId, "daily-2026-11-13");
  assert.deepEqual(g.service.overlaysFor({ mode: "ENDLESS", difficulty: "NORMAL", assisted: false, storyLevelsCleared: 0 }), [], "the seasonal event is still a draft");

  assert.equal((await act("frost-season", "schedule")).status, 200);
  await g.refresh();
  const ch = g.service.dailyChallenge();
  assert.equal(ch.source, "liveops");
  assert.equal(ch.seed, L.deriveSeed({ kind: "daily", key: "2026-11-13", salt: "e2e" }), "the seed the server's rules imply, on every client");
  assert.equal(ch.boardId, "daily:2026-11-13:r1:s2");
  assert.equal(ch.scoreMultiplier, 1.5);
  assert.equal(g.service.now(), T0, "synced to the server despite a device clock that is 90 minutes off");
  assert.equal(g.service.status().clockTrusted, true);
  const pin = g.service.pinRun({ mode: "ENDLESS", difficulty: "NORMAL", assisted: false, storyLevelsCleared: 0, challenge: null });
  assert.equal(pin.modifier.speed, 0.9);
  assert.deepEqual(pin.visual, { theme: "frost", ambient: "snow" });
  assert.equal(g.service.announcements()[0].title, "Frost is here");
});

test("two games, one schedule: both derive the same challenge and board; an offline one falls back to the cache and earns nothing", async (t) => {
  const { create, act, game } = await boot(t);
  await create(dailyContent("2026-11-13"));
  await act("daily-2026-11-13", "schedule");
  const a = game();
  const b = game();
  await Promise.all([a.load(), b.load()]);
  assert.equal(a.service.dailyChallenge().seed, b.service.dailyChallenge().seed);
  assert.equal(a.service.dailyChallenge().boardId, b.service.dailyChallenge().boardId);
  assert.equal(L.isBoardCompatible(a.service.dailyChallenge().boardId, b.service.dailyChallenge().boardId), true);

  // The server goes away: a new session of game A restores the cache and still plays the scheduled challenge, without rewards
  const offline = new LiveOpsService({ storage: a.storage, now: () => T0 + DEVICE_SKEW + 5 * MIN, fetcher: async () => { throw new Error("server down"); } });
  assert.equal(offline.configure(`${a.service.url}`, "production"), true);
  assert.equal(offline.dailyChallenge().eventId, "daily-2026-11-13");
  const progress = new ProgressStore(new MemoryStorage());
  const settled = offline.settleRun({ pin: pinDaily(offline), run: run(), progress });
  assert.ok(settled.events[0].reasons.includes("untrusted-clock"));
  assert.equal(progress.eventRewards().length, 0);
});

test("time moves events on the server and the game follows after its next refresh, without anyone touching the admin", async (t) => {
  const { clock, create, act, game } = await boot(t);
  await create(dailyContent("2026-11-14"));
  await act("daily-2026-11-14", "schedule");
  const g = game();
  await g.load();
  assert.equal(g.service.dailyChallenge().source, "builtin", "tomorrow's daily is not live yet: today is the built-in rotation");
  assert.equal(g.service.schedule().upcoming[0].event.id, "daily-2026-11-14");

  clock.ms = Date.parse("2026-11-14T00:30:00Z");
  await g.refresh();
  assert.equal(g.service.dailyChallenge().eventId, "daily-2026-11-14");
  assert.equal(g.service.schedule().live[0].event.status, "active", "the server reports the event as it is now, not as it was stored");

  clock.ms = Date.parse("2026-11-15T00:30:00Z");
  await g.refresh();
  assert.equal(g.service.dailyChallenge().source, "builtin");
  assert.equal(g.service.schedule().past[0].event.id, "daily-2026-11-14");
});

test("rewards: earned once on a trusted clock; a claim for a run that was under way when the admin cancelled the event is refused", async (t) => {
  const { create, act, save, game, clock } = await boot(t);
  await create(dailyContent("2026-11-13"));
  await act("daily-2026-11-13", "schedule");
  const g = game();
  await g.load();
  const progress = new ProgressStore(new MemoryStorage());

  const first = g.service.settleRun({ pin: pinDaily(g.service), run: run(), progress });
  assert.deepEqual(first.granted.map((r) => r.rewardId), ["five-k"]);
  assert.equal(g.service.settleRun({ pin: pinDaily(g.service), run: run({ score: 9000 }), progress }).granted.length, 0, "granted once");

  // A run starts, then the admin cancels the event before it ends: the claim is refused after the next refresh
  const doomed = pinDaily(g.service);
  assert.equal((await act("daily-2026-11-13", "cancel", { reason: "wrong rules" })).status, 200);
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  const refused = g.service.settleRun({ pin: doomed, run: run(), progress: new ProgressStore(new MemoryStorage()) });
  assert.ok(refused.events[0].reasons.includes("cancelled"), refused.events[0].reasons.join());
  assert.equal(g.service.dailyChallenge().source, "builtin", "and the cancelled challenge is no longer offered");
  assert.equal(g.service.schedule().past.find((i) => i.event.id === "daily-2026-11-13").cancelled, true, "the history says why it vanished");

});

test("versioned rules: a running event cannot be edited under a player; a draft cycle on an upcoming one bumps the version and the board", async (t) => {
  const { create, act, save, game, clock } = await boot(t);
  const g = game();

  // Live since the 10th: its rules are frozen. The only ways to change a running event are cancelling it or waiting.
  await create(seasonalContent());
  await act("frost-season", "schedule");
  await g.load();
  assert.equal(g.service.findEvent("frost-season").version, 1);
  assert.equal((await act("frost-season", "unschedule")).status, 409);
  assert.equal((await save(seasonalContent({ name: "Sneaky edit" }))).status, 409);
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  assert.equal(g.service.findEvent("frost-season").name, "Frost Season", "nothing changed under the running event");

  // Tomorrow's daily is still upcoming: unschedule, edit, schedule again = version 2, and a different leaderboard
  await create(dailyContent("2026-11-14"));
  await act("daily-2026-11-14", "schedule");
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  const v1 = g.service.findEvent("daily-2026-11-14");
  assert.equal(v1.version, 1);
  assert.equal(L.eventChallenge(v1).boardId, "daily:2026-11-14:r1:s2");

  assert.equal((await act("daily-2026-11-14", "unschedule")).status, 200);
  const edited = dailyContent("2026-11-14", { description: "Tuned after feedback.", rules: { scoreVersion: 2, seedSalt: "e2e", score: { multiplier: 2 } } });
  const saved = await save(edited);
  assert.equal(saved.status, 200, JSON.stringify(saved.json).slice(0, 300));
  assert.equal((await act("daily-2026-11-14", "schedule")).status, 200);
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  const v2 = g.service.findEvent("daily-2026-11-14");
  assert.equal(v2.version, 2);
  assert.equal(v2.description, "Tuned after feedback.");
  const board = L.eventChallenge(v2).boardId;
  assert.equal(board, "daily:2026-11-14:r2:s2");
  assert.equal(L.isBoardCompatible(L.eventChallenge(v1).boardId, board), false, "scores under the old rules are not comparable with the new ones");
  assert.equal(L.eventChallenge(v2).seed, L.eventChallenge(v1).seed, "the sequence of ghosts does not depend on the rules version");
});

test("feature flags published by the admin switch the game's behaviour, per kind, after the next refresh", async (t) => {
  const { create, act, flags, game, clock } = await boot(t);
  await create(seasonalContent());
  await act("frost-season", "schedule");
  const ctx = { mode: "ENDLESS", difficulty: "NORMAL", assisted: false, storyLevelsCleared: 0 };
  const g = game();
  await g.load();
  assert.equal(g.service.overlaysFor(ctx).length, 1);
  assert.equal(g.service.announcements().length, 1);

  assert.equal((await flags({ "liveops.seasonal": { enabled: false } })).status, 200);
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  assert.equal(g.service.overlaysFor(ctx).length, 0, "the kind's flag is off");
  assert.equal(g.service.announcements().length, 1, "announcements are a separate flag");
  assert.equal(g.service.dailyChallenge().source, "builtin");

  assert.equal((await flags({ "liveops.seasonal": { enabled: true }, "liveops.enabled": { enabled: false } })).status, 200);
  clock.ms += MIN_REFRESH_MS;
  await g.refresh();
  assert.equal(g.service.enabled, false, "the master switch");
  assert.deepEqual(g.service.announcements(), []);
  assert.deepEqual(g.service.schedule(), { live: [], upcoming: [], past: [] });
});

test("the game rejects a tampered answer from the real endpoint as a whole and keeps playing on what it had", async (t) => {
  const { create, act, base, clock } = await boot(t);
  await create(dailyContent("2026-11-13"));
  await act("daily-2026-11-13", "schedule");
  let tamper = false;
  const fetcher = async (url, init) => {
    const res = await fetch(url, init);
    const body = await res.json();
    if (tamper) body.events[0].rules.score.multiplier = 99; // out of the contract's range
    return { ok: res.ok, status: res.status, json: async () => body };
  };
  const service = new LiveOpsService({ storage: new MemoryStorage(), now: () => clock.ms, fetcher });
  assert.equal((await service.load(`${base}/api/game-liveops/production`, "production")).ok, true);
  tamper = true;
  const bad = await service.refresh({ force: true });
  assert.deepEqual([bad.ok, bad.reason], [false, "invalid"]);
  assert.equal(service.dailyChallenge().eventId, "daily-2026-11-13", "the previous, valid schedule stays in force");
});
