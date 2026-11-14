import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminServer } from "../server/app.mjs";
import { permits, roles } from "../server/policy.mjs";
import * as L from "../../shared/live-ops/index.js";

// Real HTTP against the real server on a random loopback port, with an injectable clock so "time passes" is exact.
const credentials = { email: "liveops@example.com", password: "liveops-password-long-enough" };
const T0 = Date.parse("2026-11-13T07:00:00Z");
const HOUR = 3600 * 1000;

async function boot(t, { role, dataDir, clock = { ms: T0 } } = {}) {
  const dir = dataDir || (await mkdtemp(join(tmpdir(), "arcane-liveops-")));
  const server = createAdminServer({
    ...credentials,
    dataDir: dir,
    role,
    now: () => clock.ms,
    // Sessions use the injected clock too: keep them alive when a test jumps weeks ahead
    sessionTTL: 3650 * 24 * HOUR,
    liveOpsTickMs: 0,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    if (!dataDir) await rm(dir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "x-admin-request": "1" },
    body: JSON.stringify(credentials),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, { method = "GET", body, auth = true, headers = {} } = {}) =>
    fetch(base + path, {
      method,
      headers: { "x-admin-request": "1", ...(auth ? { cookie } : {}), ...headers },
      body: body === undefined || typeof body === "string" ? body : JSON.stringify(body),
    });
  const root = (environment = "production") => `/api/liveops/environments/${environment}`;
  const get = async (suffix = "", environment) => {
    const res = await call(root(environment) + suffix);
    return { status: res.status, json: await res.json() };
  };
  const post = async (suffix, body, environment) => {
    const res = await call(root(environment) + suffix, { method: "POST", body });
    return { status: res.status, json: await res.json() };
  };
  const published = async (environment = "production") => {
    const res = await call(`/api/game-liveops/${environment}`, { auth: false });
    return { status: res.status, json: await res.json(), headers: res.headers };
  };
  /** Every mutation carries the current revision, like the editor does */
  const revision = async (environment) => (await get("", environment)).json.revision;
  const act = async (id, action, extra = {}, environment) =>
    post(`/events/${id}/${action}`, { revision: await revision(environment), ...extra }, environment);
  const create = async (content, environment) =>
    post("/events", { revision: await revision(environment), content }, environment);
  const save = async (content, environment) =>
    post(`/events/${content.id}/save`, { revision: await revision(environment), content }, environment);
  return { server, call, get, post, published, revision, act, create, save, clock, dir, base, cookie };
}

const seasonal = (o = {}) =>
  L.createEventContent("seasonal", {
    id: "frost-season",
    name: "Frost Season",
    timeZone: "Asia/Ho_Chi_Minh",
    schedule: { startLocal: "2026-11-20T00:00", endLocal: "2026-12-05T00:00" },
    ...o,
  });
const randomEvent = (o = {}) =>
  L.createEventContent("random", {
    id: "blood-moon",
    name: "Blood Moon",
    timeZone: "UTC",
    schedule: { startLocal: "2026-11-13T09:00", endLocal: "2026-11-13T10:00" },
    ...o,
  });
const daily = (key = "2026-11-14", o = {}) =>
  L.createEventContent("daily", {
    id: `daily-${key}`,
    name: "Storm",
    timeZone: "UTC",
    schedule: { startLocal: `${key}T00:00`, endLocal: `${L.addDays(key, 1)}T00:00` },
    ...o,
  });
const ids = (events) => events.map((e) => e.id);

test("roles: Super Admin publishes, Content Editor prepares drafts, everyone else is locked out of live operations", () => {
  assert.equal(permits({ role: "Super Admin" }, "liveops:publish"), true);
  for (const permission of ["liveops:read", "liveops:write"]) {
    assert.equal(permits({ role: "Content Editor" }, permission), true);
    assert.equal(permits({ role: "Super Admin" }, permission), true);
  }
  assert.equal(permits({ role: "Content Editor" }, "liveops:publish"), false);
  for (const role of ["Game Designer", "Analyst", "Support"]) {
    for (const permission of ["liveops:read", "liveops:write", "liveops:publish"]) {
      assert.equal(permits({ role }, permission), false, `${role} ${permission}`);
    }
  }
  assert.ok(roles["Super Admin"].includes("liveops:publish"));
});

test("every admin endpoint needs a session, the request header and permission; the schedule endpoint is public and read-only", async (t) => {
  const { call, published, base, cookie } = await boot(t);
  const env = "/api/liveops/environments/production";
  assert.equal((await call(env, { auth: false })).status, 401);
  for (const suffix of ["/preview", "/events", "/events/x1/save", "/events/x1/schedule", "/flags", "/generate"]) {
    assert.equal((await call(env + suffix, { method: "POST", body: {}, auth: false })).status, 401, suffix);
  }
  assert.equal((await call(env + "/history", { auth: false })).status, 401);
  // A valid session is not enough for a mutation without the CSRF header
  const noHeader = await fetch(`${base}${env}/events`, { method: "POST", headers: { cookie }, body: "{}" });
  assert.equal(noHeader.status, 403);
  const crossOrigin = await call(`${env}/events`, { method: "POST", body: {}, headers: { origin: "https://evil.example" } });
  assert.equal(crossOrigin.status, 403);
  // The public schedule needs nothing, shows an empty-but-valid payload before anything exists, and never accepts writes
  const open = await published();
  assert.equal(open.status, 200);
  assert.equal(open.json.serverTime, "2026-11-13T07:00:00Z");
  assert.deepEqual(open.json.events, []);
  assert.deepEqual(L.validatePublicPayload(open.json, "production"), []);
  assert.equal(open.headers.get("cache-control"), "no-store");
  assert.equal((await call("/api/game-liveops/production", { method: "POST", body: {}, auth: false })).status, 404);
  assert.equal((await call("/api/game-liveops/staging", { auth: false })).status, 200);
  assert.equal((await call("/api/game-liveops/mars", { auth: false })).status, 400);
  assert.equal((await call("/api/liveops/environments/mars", {})).status, 400);
  assert.equal((await call("/api/liveops/environments/production/nope", { method: "POST", body: {} })).status, 404);
});

test("an Analyst cannot read or touch live operations, and is refused before anything is written", async (t) => {
  const { get, post, dir } = await boot(t, { role: "Analyst" });
  assert.equal((await get()).status, 403);
  assert.equal((await post("/events", { revision: 0, content: seasonal() })).status, 403);
  assert.equal((await post("/flags", { revision: 0, flags: L.defaultFlags() })).status, 403);
  await assert.rejects(readFile(join(dir, "store.json")), "no refused request may write the store");
});

test("a Content Editor prepares drafts but cannot schedule, cancel or change flags", async (t) => {
  const { get, post, create, act, revision } = await boot(t, { role: "Content Editor" });
  const created = await create(seasonal());
  assert.equal(created.status, 201);
  assert.equal(created.json.event.status, "draft");
  assert.equal((await get()).status, 200);
  for (const action of ["schedule", "cancel", "archive", "activate"]) {
    assert.equal((await act("frost-season", action)).status, 403, action);
  }
  assert.equal((await post("/flags", { revision: await revision(), flags: L.defaultFlags() })).status, 403);
  assert.equal((await post("/events/frost-season/save", { revision: await revision(), content: seasonal({ name: "Frost 2" }) })).status, 200);
  assert.equal((await post("/events/frost-season/delete", { revision: await revision() })).status, 200);
});

test("a draft is created, edited into new versions, scheduled, published, and unscheduled again", async (t) => {
  const { get, create, save, act, published } = await boot(t);
  const created = await create(seasonal());
  assert.equal(created.status, 201);
  const draft = created.json.event;
  assert.equal(draft.version, 1);
  assert.equal(draft.status, "draft");
  assert.equal(draft.startsAt, "2026-11-19T17:00:00Z", "Ho Chi Minh midnight is 17:00 UTC the evening before");
  assert.equal(draft.endsAt, "2026-12-04T17:00:00Z");
  assert.equal(draft.createdBy, credentials.email);
  assert.deepEqual((await published()).json.events, [], "a draft is invisible to players");

  // Editing creates a new version; saving the same content again does not
  const edited = await save(seasonal({ name: "Frost Season II", rules: { enemy: { speedMultiplier: 0.9 } } }));
  assert.equal(edited.status, 200);
  assert.equal(edited.json.event.version, 2);
  assert.deepEqual(edited.json.event.versions.at(-1).changed, ["name", "rules"]);
  const same = await save(seasonal({ name: "Frost Season II", rules: { enemy: { speedMultiplier: 0.9 } } }));
  assert.equal(same.json.changed, false);
  assert.equal(same.json.event.version, 2, "an unchanged save is not a new version");

  const scheduled = await act("frost-season", "schedule");
  assert.equal(scheduled.status, 200);
  assert.equal(scheduled.json.event.status, "scheduled");
  assert.equal(scheduled.json.event.scheduledBy, credentials.email);
  const open = (await published()).json;
  assert.deepEqual(open.events.map((e) => [e.id, e.status, e.version]), [["frost-season", "scheduled", 2]]);
  assert.equal(open.events[0].name, "Frost Season II");
  assert.deepEqual(L.validatePublicPayload(open, "production"), []);

  // A scheduled event is frozen: changing it means unscheduling first, which needs the publish permission
  const blocked = await save(seasonal({ name: "Sneaky edit" }));
  assert.equal(blocked.status, 409);
  assert.match(blocked.json.message, /scheduled event cannot be edited/);

  assert.equal((await act("frost-season", "unschedule")).json.event.status, "draft");
  assert.deepEqual((await published()).json.events, []);
  const again = await save(seasonal({ name: "Frost Season III" }));
  assert.equal(again.json.event.version, 3);
  await act("frost-season", "schedule");
  assert.equal((await published()).json.events[0].version, 3, "players get the new rules version, never a silently edited old one");
  const { json } = await get();
  assert.deepEqual(json.history.map((h) => h.type).reverse(), ["created", "saved", "scheduled", "unscheduled", "saved", "scheduled"]);
});

test("time moves a scheduled event to active and then completed; the public schedule follows the clock without writing", async (t) => {
  const { server, get, create, act, published, clock, dir } = await boot(t);
  await create(randomEvent());
  await act("blood-moon", "schedule");
  assert.equal((await published()).json.events[0].status, "scheduled");

  const written = async () => readFile(join(dir, "store.json"), "utf8");
  const before = await written();
  clock.ms = Date.parse("2026-11-13T09:30:00Z");
  assert.equal((await published()).json.events[0].status, "active", "the public schedule is computed on the server clock");
  assert.equal(await written(), before, "a public read never writes the store");

  // The next admin request (or the timer) persists the transition, once
  assert.equal((await get()).json.events[0].status, "active");
  assert.match(await written(), /"status": "active"/);
  assert.equal(await server.reconcileLiveOps(), 0, "nothing left to do");
  const afterActivation = (await get()).json.history.filter((h) => h.type === "activated");
  assert.equal(afterActivation.length, 1);
  assert.deepEqual([afterActivation[0].actor, afterActivation[0].at, afterActivation[0].note], ["system", "2026-11-13T09:00:00Z", "time-driven"]);

  clock.ms = Date.parse("2026-11-13T10:00:00Z");
  assert.equal((await published()).json.events[0].status, "completed");
  assert.equal(await server.reconcileLiveOps(), 1, "the timer completes it");
  assert.equal(await server.reconcileLiveOps(), 0, "and the second run finds nothing");
  const ws = (await get()).json;
  assert.equal(ws.events[0].status, "completed");
  assert.deepEqual(ws.history.map((h) => h.type).reverse(), ["created", "scheduled", "activated", "completed"]);
  assert.equal((await act("blood-moon", "archive")).json.event.status, "archived");
  assert.equal((await get()).json.events.length, 0, "archived events leave the workspace list");
  assert.equal((await get()).json.archivedCount, 1);
  assert.deepEqual((await published()).json.events, [], "and the public schedule");
});

test("a server that was down for the whole window still records the true history, in order", async (t) => {
  const { server, get, create, act, clock } = await boot(t);
  await create(randomEvent());
  await act("blood-moon", "schedule");
  clock.ms = Date.parse("2026-11-20T00:00:00Z");
  assert.equal(await server.reconcileLiveOps(), 2);
  const history = (await get()).json.history.slice().reverse().filter((h) => h.actor === "system");
  assert.deepEqual(history.map((h) => [h.type, h.at]), [["activated", "2026-11-13T09:00:00Z"], ["completed", "2026-11-13T10:00:00Z"]]);
  assert.ok(history.every((h) => h.recordedAt === "2026-11-20T00:00:00Z"));
});

test("activation is idempotent: by hand, by the clock, twice, and after a lost response", async (t) => {
  const { get, create, act, post, clock, revision } = await boot(t);
  await create(seasonal({ schedule: { startLocal: "2026-11-14T00:00", endLocal: "2026-12-01T00:00" }, timeZone: "UTC" }));
  await act("frost-season", "schedule");

  const first = await act("frost-season", "activate");
  assert.equal(first.status, 200);
  assert.equal(first.json.changed, true);
  assert.equal(first.json.event.status, "active");
  assert.equal(first.json.event.startsAt, "2026-11-13T07:00:00Z", "it starts now");
  const after = (await get()).json;

  // The same request again (the first response was lost): success, nothing changes
  const second = await post("/events/frost-season/activate", { revision: 0 });
  assert.equal(second.status, 200, "even with a stale revision: it is a no-op, not a conflict");
  assert.equal(second.json.changed, false);
  const again = (await get()).json;
  assert.equal(again.revision, after.revision, "a no-op does not bump the revision");
  assert.equal(again.history.filter((h) => h.type === "activated").length, 1);
  assert.equal(again.history.length, after.history.length);

  // The clock then reaches the original start time: nothing is recorded twice
  clock.ms = Date.parse("2026-11-14T01:00:00Z");
  const later = (await get()).json;
  assert.equal(later.history.filter((h) => h.type === "activated").length, 1);
  assert.equal(later.events[0].status, "active");

  // The other lifecycle actions are idempotent the same way
  assert.equal((await act("frost-season", "cancel")).json.changed, true);
  const cancelledRevision = await revision();
  const cancelAgain = await post("/events/frost-season/cancel", { revision: 1 });
  assert.equal(cancelAgain.status, 200);
  assert.equal(cancelAgain.json.changed, false);
  assert.equal(await revision(), cancelledRevision);
});

test("an event cannot go through a transition it does not allow; a stale revision is a conflict", async (t) => {
  const { create, act, post, get } = await boot(t);
  await create(seasonal());
  for (const [action, pattern] of [["activate", /Cannot activate an event that is draft/], ["complete", /Cannot complete an event that is draft/], ["archive", /Cannot archive an event that is draft/]]) {
    const res = await act("frost-season", action);
    assert.equal(res.status, 409, action);
    assert.match(res.json.message, pattern);
  }
  const noop = await act("frost-season", "unschedule");
  assert.equal(noop.status, 200, "a draft is already unscheduled");
  assert.equal(noop.json.changed, false);
  const stale = await post("/events/frost-season/schedule", { revision: 99 });
  assert.equal(stale.status, 409);
  assert.match(stale.json.message, /Reload and compare/);
  assert.equal((await post("/events/frost-season/schedule", {})).status, 409, "a missing revision is stale too");
  assert.equal((await get()).json.events[0].status, "draft");
  assert.equal((await act("ghost-event", "schedule")).status, 404);
  assert.equal((await act("Bad_Id", "schedule")).status, 404);
  assert.equal((await act("frost-season", "launch")).status, 404);
  // Daily and weekly challenges keep to the calendar: no starting them early
  await create(daily("2026-11-20"));
  await act("daily-2026-11-20", "schedule");
  const early = await act("daily-2026-11-20", "activate");
  assert.equal(early.status, 409);
  assert.match(early.json.message, /fixed day/);
});

test("the schedule is validated as a whole: one daily per day, overlays that cannot coexist, and nothing in the past", async (t) => {
  const { create, act, get, clock } = await boot(t);
  await create(daily("2026-11-20"));
  await create(daily("2026-11-20", { id: "daily-twin" }));
  assert.equal((await act("daily-2026-11-20", "schedule")).status, 200);
  const clash = await act("daily-twin", "schedule");
  assert.equal(clash.status, 409);
  assert.match(clash.json.message, /Schedule conflict: .*both daily events at the same time/);
  assert.equal(clash.json.details.conflicts[0].type, "overlap");
  assert.deepEqual(clash.json.details.conflicts[0].eventIds, ["daily-2026-11-20", "daily-twin"]);
  assert.equal((await get()).json.events.find((e) => e.id === "daily-twin").status, "draft", "a refused schedule changes nothing");

  // Cancelling the first frees the day
  await act("daily-2026-11-20", "cancel", { reason: "wrong modifier" });
  assert.equal((await act("daily-twin", "schedule")).status, 200);
  const cancelled = (await get()).json.events.find((e) => e.id === "daily-2026-11-20");
  assert.equal(cancelled.cancelReason, "wrong modifier");

  // A seasonal event and a random one with incompatible rules cannot overlap
  await create(seasonal({ id: "slow-season", timeZone: "UTC", schedule: { startLocal: "2026-11-25T00:00", endLocal: "2026-12-05T00:00" }, rules: { enemy: { runes: ["horizontal"] } } }));
  await create(randomEvent({ id: "caret-hour", schedule: { startLocal: "2026-11-26T19:00", endLocal: "2026-11-26T20:00" }, rules: { enemy: { runes: ["caret"] } } }));
  await act("slow-season", "schedule");
  const rules = await act("caret-hour", "schedule");
  assert.equal(rules.status, 409);
  assert.match(rules.json.message, /no gesture that can appear/);
  assert.equal(rules.json.details.conflicts[0].type, "rules");

  // Drafts never conflict; the workspace reports the conflicts that exist among live events
  assert.deepEqual((await get()).json.conflicts, []);

  // Nothing can be scheduled for a time that has passed
  await create(randomEvent({ id: "too-late", schedule: { startLocal: "2026-11-12T09:00", endLocal: "2026-11-12T10:00" } }));
  const late = await act("too-late", "schedule");
  assert.equal(late.status, 409);
  assert.match(late.json.message, /already ended/);
  clock.ms += 0;
});

test("scheduling is timezone-safe: wall-clock times are resolved on the server and ambiguous or missing ones are refused", async (t) => {
  const { create, act, post } = await boot(t);
  const ny = (o) => randomEvent({ timeZone: "America/New_York", ...o });
  const gap = await create(ny({ id: "gap", schedule: { startLocal: "2027-03-14T02:30", endLocal: "2027-03-14T04:00" } }));
  assert.equal(gap.status, 400);
  assert.match(gap.json.message, /2027-03-14T02:30 does not exist in America\/New_York/);
  const twice = await create(ny({ id: "twice", schedule: { startLocal: "2026-11-01T00:30", endLocal: "2026-11-01T01:30" } }));
  assert.equal(twice.status, 400);
  assert.match(twice.json.message, /happens twice/);
  const fine = await create(ny({ id: "fine", schedule: { startLocal: "2027-03-14T01:00", endLocal: "2027-03-14T03:30" } }));
  assert.equal(fine.status, 201);
  assert.equal(fine.json.event.startsAt, "2027-03-14T06:00:00Z");
  assert.equal(fine.json.event.endsAt, "2027-03-14T07:30:00Z", "90 real minutes across the missing hour");

  const dst = await create(daily("2027-03-14", { id: "daily-dst", timeZone: "America/New_York" }));
  assert.equal(dst.status, 201);
  assert.equal(Date.parse(dst.json.event.endsAt) - Date.parse(dst.json.event.startsAt), 23 * HOUR);
  const misaligned = await create(daily("2027-03-14", { id: "daily-off", schedule: { startLocal: "2027-03-14T06:00", endLocal: "2027-03-15T06:00" } }));
  assert.equal(misaligned.status, 400);
  assert.match(misaligned.json.message, /starts at 00:00/);
  const offset = await post("/preview", { content: ny({ timeZone: "+07:00" }) });
  assert.equal(offset.json.ok, false);
  assert.match(offset.json.errors.join(), /unknown time zone/);
  await act("fine", "schedule");
});

test("event rules and rewards are validated strictly on the server, whatever the editor sent", async (t) => {
  const { create, save, post, revision } = await boot(t);
  const bad = async (override, pattern) => {
    const res = await create(seasonal({ id: `bad-${Math.random().toString(36).slice(2, 8)}`, ...override }));
    assert.equal(res.status, 400, JSON.stringify(override));
    assert.match(res.json.message, pattern);
    assert.ok(Array.isArray(res.json.details.errors) && res.json.details.errors.length > 0, "the response lists every field error");
  };
  await bad({ rewards: [{ id: "r1", type: "cosmetic", ref: "trail:laser", label: "", condition: { metric: "runs", threshold: 1 } }] }, /unknown cosmetic/);
  await bad({ rewards: [{ id: "r1", type: "cosmetic", ref: "trail:arcane", label: "", condition: { metric: "runs", threshold: 1 } }] }, /unknown cosmetic/);
  await bad({ rewards: [{ id: "r1", type: "badge", ref: "⭐", label: "x", condition: { metric: "bestScore", threshold: 2000000 } }] }, /threshold/);
  await bad({ rules: { enemy: { speedMultiplier: 9 } } }, /speedMultiplier/);
  await bad({ rules: { score: { multiplier: 2 } } }, /score version 2/);
  await bad({ eligibility: { modes: ["DAILY"] } }, /ENDLESS and STORY runs only/);
  await bad({ name: "a\u0000b" }, /control characters/);
  const extra = seasonal({ id: "extra-field" });
  extra.rules.cheats = true;
  assert.equal((await create(extra)).status, 400);
  assert.equal((await create(null)).status, 400);
  assert.equal((await post("/events", { revision: 0 })).status, 400);

  const ok = await create(seasonal({ rewards: [{ id: "frost-trail", type: "cosmetic", ref: "trail:frost", label: "", condition: { metric: "runs", threshold: 5 } }] }));
  assert.equal(ok.status, 201);
  const sneaky = await save(seasonal({ rewards: [{ id: "frost-trail", type: "cosmetic", ref: "hat:godmode", label: "", condition: { metric: "runs", threshold: 5 } }] }));
  assert.equal(sneaky.status, 400, "a save is validated as strictly as a create");
  const swapped = await save(seasonal({ id: "other-id" }));
  assert.equal(swapped.status, 404, "an event cannot be addressed by a different id");
  const renamed = await post("/events/frost-season/save", { revision: await revision(), content: seasonal({ id: "renamed" }) });
  assert.equal(renamed.status, 400, "the id in the body must match the event being saved");
  assert.match(renamed.json.message, /cannot be changed/);
});

test("an event id exists once per environment; environments are isolated", async (t) => {
  const { create, get, published, act } = await boot(t);
  assert.equal((await create(seasonal())).status, 201);
  const dup = await create(seasonal());
  assert.equal(dup.status, 409);
  assert.match(dup.json.message, /already exists/);
  assert.equal((await create(seasonal(), "staging")).status, 201, "the same id is fine in another environment");
  await act("frost-season", "schedule", {}, "staging");
  assert.deepEqual((await published("production")).json.events, []);
  assert.equal((await published("staging")).json.events.length, 1);
  assert.equal((await get("", "production")).json.events[0].status, "draft");
  assert.equal((await get("", "development")).json.events.length, 0);
});

test("feature flags: strict, publish-only, visible in the public schedule, no-ops are not recorded", async (t) => {
  const { post, get, published, revision } = await boot(t);
  const flags = L.defaultFlags();
  assert.deepEqual((await published()).json.flags, flags, "defaults until an admin decides otherwise");
  flags["liveops.seasonal"] = { enabled: false, rolloutPercent: 100 };
  flags["liveops.effects"] = { enabled: true, rolloutPercent: 25 };
  const saved = await post("/flags", { revision: await revision(), flags });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.changed, true);
  assert.deepEqual((await published()).json.flags, flags);
  assert.deepEqual(saved.json.flags, flags);
  const entry = (await get()).json.history[0];
  assert.deepEqual([entry.type, entry.actor], ["flags", credentials.email]);
  assert.match(entry.note, /liveops\.seasonal: off, liveops\.effects: on 25%/);

  const again = await post("/flags", { revision: await revision(), flags });
  assert.equal(again.json.changed, false);
  assert.equal(again.json.revision, saved.json.revision, "unchanged flags are not a new revision");

  const rev = await revision();
  for (const [mutate, pattern] of [
    [(f) => { f["liveops.nope"] = { enabled: true, rolloutPercent: 1 }; }, /unknown flag/],
    [(f) => { f["liveops.daily"].rolloutPercent = 101; }, /rolloutPercent/],
    [(f) => { f["liveops.daily"].rolloutPercent = 50.5; }, /rolloutPercent/],
    [(f) => { f["liveops.daily"].enabled = "no"; }, /enabled/],
    [(f) => { delete f["liveops.rewards"]; }, /required object/],
  ]) {
    const broken = structuredClone(flags);
    mutate(broken);
    const res = await post("/flags", { revision: rev, flags: broken });
    assert.equal(res.status, 400);
    assert.match(res.json.message, pattern);
  }
  assert.equal((await post("/flags", { revision: rev + 5, flags })).status, 409);
});

test("generators create valid drafts deterministically and report what they skipped", async (t) => {
  const { post, get, revision } = await boot(t);
  const generate = async (kind, params) => post("/generate", { revision: await revision(), kind, params });
  const days = await generate("daily", { startDate: "2026-11-14", days: 7 });
  assert.equal(days.status, 200);
  assert.equal(days.json.created.length, 7);
  assert.ok(days.json.events.every((e) => e.status === "draft" || e.kind !== "daily"));
  const first = days.json.events.find((e) => e.id === "daily-2026-11-14");
  assert.equal(first.content.rules.difficulty, "NORMAL");
  assert.deepEqual(L.validateEventContent(first.content), []);

  const overlap = await generate("daily", { startDate: "2026-11-18", days: 5 });
  assert.deepEqual(overlap.json.skipped, ["2026-11-18", "2026-11-19", "2026-11-20"]);
  assert.deepEqual(overlap.json.created, ["daily-2026-11-21", "daily-2026-11-22"]);
  const nothing = await generate("daily", { startDate: "2026-11-14", days: 3 });
  assert.equal(nothing.json.changed, false, "nothing new, nothing recorded");
  assert.deepEqual(nothing.json.created, []);

  const params = { seed: "week-47", fromDate: "2026-11-16", days: 7, count: 3, durationMinutes: [30, 60], minGapMinutes: 60, hours: [18, 22], timeZone: "Asia/Ho_Chi_Minh" };
  const random = await generate("random", params);
  assert.equal(random.status, 200);
  assert.equal(random.json.created.length, 3);
  assert.equal(random.json.shortfall, 0);
  const second = await generate("random", params);
  assert.equal(second.json.created.length, 3, "a second run with the same seed adds events at different free slots");
  const ws = (await get()).json;
  const windows = ws.events.filter((e) => e.kind === "random").map((e) => [Date.parse(e.startsAt), Date.parse(e.endsAt)]).sort((a, b) => a[0] - b[0]);
  windows.forEach((w, i) => { if (i) assert.ok(w[0] >= windows[i - 1][1] + 60 * 60 * 1000, "generated events keep their gap even across runs"); });
  assert.ok(ws.events.every((e) => e.status === "draft"), "generation never schedules anything");

  const rev = await revision();
  const post400 = async (body) => post("/generate", { revision: rev, ...body });
  assert.equal((await post400({ kind: "weekly", params: {} })).status, 400);
  assert.match((await post400({ kind: "daily", params: { startDate: "nope", days: 2 } })).json.message, /startDate/);
  assert.match((await post400({ kind: "random", params: { ...params, count: 99 } })).json.message, /count/);
  assert.equal((await post("/generate", { revision: 999, kind: "daily", params: { startDate: "2026-12-01", days: 1 } })).status, 409);
  const gens = (await get()).json.history.filter((h) => h.note === "generated daily").length;
  assert.equal(gens, 9);
});

test("preview validates and finds conflicts without saving anything", async (t) => {
  const { post, create, act, get } = await boot(t);
  await create(daily("2026-11-20"));
  await act("daily-2026-11-20", "schedule");
  const before = (await get()).json;
  const clash = await post("/preview", { content: daily("2026-11-20", { id: "daily-other" }) });
  assert.equal(clash.status, 200);
  assert.equal(clash.json.ok, true, "the content itself is valid");
  assert.equal(clash.json.conflicts.length, 1);
  assert.equal(clash.json.window.challengeKey, "2026-11-20");
  assert.equal(clash.json.window.startsAt, "2026-11-20T00:00:00Z");
  const invalid = await post("/preview", { content: seasonal({ name: "" }) });
  assert.equal(invalid.json.ok, false);
  assert.match(invalid.json.errors.join(), /name/);
  assert.equal(invalid.json.window, null);
  const gap = await post("/preview", { content: randomEvent({ timeZone: "America/New_York", schedule: { startLocal: "2027-03-14T02:30", endLocal: "2027-03-14T04:00" } }) });
  assert.match(gap.json.errors.join(), /does not exist/);
  const after = (await get()).json;
  assert.equal(after.revision, before.revision);
  assert.equal(after.events.length, before.events.length);
});

test("conflicts are decided inside the serialized write, so racing requests cannot both win", async (t) => {
  const { create, post, get, revision } = await boot(t);
  await create(daily("2026-11-20"));
  await create(daily("2026-11-20", { id: "daily-twin" }));
  const rev = await revision();
  const results = await Promise.all([
    post("/events/daily-2026-11-20/schedule", { revision: rev }),
    post("/events/daily-twin/schedule", { revision: rev }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], "one wins; the other is refused (stale revision or conflict)");
  const scheduled = (await get()).json.events.filter((e) => e.status === "scheduled");
  assert.equal(scheduled.length, 1);
});

test("history is persisted, filterable and pageable; audit records every administrative action", async (t) => {
  const { create, act, call, get } = await boot(t);
  await create(randomEvent());
  await create(seasonal());
  await act("blood-moon", "schedule");
  await act("blood-moon", "cancel", { reason: "oops" });
  const page = await (await call("/api/liveops/environments/production/history?limit=2")).json();
  assert.equal(page.entries.length, 2);
  assert.deepEqual(page.entries.map((e) => e.type), ["cancelled", "scheduled"]);
  assert.ok(page.next);
  const rest = await (await call(`/api/liveops/environments/production/history?before=${page.next}`)).json();
  assert.deepEqual(rest.entries.map((e) => e.type), ["created", "created"]);
  assert.equal(rest.next, null);
  const one = await (await call("/api/liveops/environments/production/history?eventId=frost-season")).json();
  assert.deepEqual(one.entries.map((e) => e.eventId), ["frost-season"]);
  assert.equal(page.entries[0].note, "oops");
  assert.deepEqual(page.entries.map((e) => e.seq), [4, 3]);

  const audit = await (await call("/api/system")).json();
  const liveops = audit.items.filter((a) => a.action.startsWith("liveops.")).map((a) => a.action).reverse();
  assert.deepEqual(liveops, ["liveops.create", "liveops.create", "liveops.schedule", "liveops.cancel"]);
  assert.equal(audit.items.find((a) => a.action === "liveops.schedule").target, "production/blood-moon");
  assert.ok((await get()).json.revision >= 4);
});

test("cancelling a published event keeps it in the public schedule as cancelled, so cached copies drop it", async (t) => {
  const { create, act, published } = await boot(t);
  await create(randomEvent());
  await act("blood-moon", "schedule");
  await act("blood-moon", "cancel");
  assert.deepEqual((await published()).json.events.map((e) => [e.id, e.status]), [["blood-moon", "cancelled"]]);
  await create(randomEvent({ id: "never-live", schedule: { startLocal: "2026-11-13T12:00", endLocal: "2026-11-13T13:00" } }));
  await act("never-live", "cancel");
  assert.deepEqual((await published()).json.events.map((e) => e.id), ["blood-moon"], "a draft that was cancelled was never published");
});

test("the public schedule exposes only player-facing fields", async (t) => {
  const { create, act, published } = await boot(t);
  await create(randomEvent());
  await act("blood-moon", "schedule");
  await act("blood-moon", "cancel", { reason: "internal-note" });
  const payload = (await published()).json;
  assert.equal(payload.events[0].status, "cancelled");
  const text = JSON.stringify(payload);
  for (const secret of [credentials.email, "internal-note", "createdBy", "scheduledBy", "versions", "history", "cancelReason", "updatedBy", "cancelledBy"]) {
    assert.equal(text.includes(secret), false, `${secret} must not leave the server`);
  }
});

test("state survives a restart: events, flags and history are read back from disk", async (t) => {
  const first = await boot(t);
  const dir = first.dir;
  await first.create(seasonal());
  await first.act("frost-season", "schedule");
  const flags = L.defaultFlags();
  flags["liveops.rewards"].enabled = false;
  await first.post("/flags", { revision: await first.revision(), flags });
  const before = (await first.get()).json;
  await new Promise((resolve) => first.server.close(resolve));

  const clock = { ms: T0 + HOUR };
  const second = await boot(t, { dataDir: dir, clock });
  const after = (await second.get()).json;
  assert.equal(after.revision, before.revision);
  assert.deepEqual(after.flags, flags);
  assert.deepEqual(after.history.map((h) => h.type), before.history.map((h) => h.type));
  assert.equal(after.events[0].status, "scheduled");
  assert.equal((await second.published()).json.events[0].id, "frost-season");
  await rm(dir, { recursive: true, force: true });
});

test("the dashboard counts scheduled and running events across environments", async (t) => {
  const { call, create, act, clock } = await boot(t);
  const metric = async () => (await (await call("/api/dashboard")).json()).metrics.scheduledEvents;
  assert.equal(await metric(), 0);
  await create(randomEvent());
  assert.equal(await metric(), 0, "a draft is not scheduled");
  await act("blood-moon", "schedule");
  await create(seasonal(), "staging");
  await act("frost-season", "schedule", {}, "staging");
  assert.equal(await metric(), 2);
  clock.ms = Date.parse("2026-11-13T09:30:00Z");
  assert.equal(await metric(), 2, "running events count too");
  clock.ms = Date.parse("2026-11-13T10:30:00Z");
  assert.equal(await metric(), 1, "a finished event does not, even before the timer has recorded it");
  assert.equal((await (await call("/api/liveops")).json()).integration, "connected");
});

test("live-ops request bodies are capped at 64 KiB, to the byte", async (t) => {
  const { call } = await boot(t);
  const bodyOfSize = (bytes) => JSON.stringify({ padding: "x".repeat(bytes - Buffer.byteLength(JSON.stringify({ padding: "" }))) });
  const post = (body) => call("/api/liveops/environments/production/preview", { method: "POST", body });
  assert.notEqual((await post(bodyOfSize(64 * 1024))).status, 413);
  assert.equal((await post(bodyOfSize(64 * 1024 + 1))).status, 413);
});

test("event text is stored exactly as written and served as data: no markup is rewritten or executed server-side", async (t) => {
  const { create, act, published } = await boot(t);
  const nasty = '<img src=x onerror="alert(1)"> & "quotes" </script>';
  assert.equal((await create(randomEvent({ name: nasty, description: `${nasty}\nsecond line`, announcement: { enabled: true, title: nasty, body: nasty, leadHours: 0, tone: "urgent" } }))).status, 201);
  await act("blood-moon", "schedule");
  const event = (await published()).json.events[0];
  assert.equal(event.name, nasty);
  assert.equal(event.description, `${nasty}\nsecond line`);
  assert.equal(event.announcement.title, nasty);
});
