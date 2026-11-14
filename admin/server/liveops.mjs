import { randomUUID } from "node:crypto";
import { ENVIRONMENTS } from "../../shared/game-configuration.js";
import * as L from "../../shared/live-ops/index.js";

// Live Operations: server-authoritative event schedules.
//
//   GET  /api/game-liveops/:environment                         public  the schedule the game downloads (published events only)
//   GET  /api/liveops/environments/:environment                 read    workspace: events, flags, conflicts, recent history
//   GET  /api/liveops/environments/:environment/history         read    paged history (?eventId=&before=&limit=)
//   POST /api/liveops/environments/:environment/preview         write   validate unsaved content, resolve its window, find conflicts
//   POST /api/liveops/environments/:environment/events          write   create a draft
//   POST /api/liveops/environments/:environment/events/:id/save write   edit a draft (a new version)
//   POST /api/liveops/environments/:environment/events/:id/delete write delete a draft
//   POST /api/liveops/environments/:environment/events/:id/{schedule,unschedule,activate,complete,cancel,archive}   publish
//   POST /api/liveops/environments/:environment/flags           publish feature flags
//   POST /api/liveops/environments/:environment/generate        write   create daily / random drafts from a deterministic generator
//
// Every mutation needs the session, the X-Admin-Request header, the same origin and the caller's permission (all checked
// by app.mjs and here) plus the workspace `revision` (409 when stale). A lifecycle action whose result already holds
// ("activate" on an active event) is an idempotent no-op: it answers 200 with `changed: false`, never an error and never a
// duplicate history entry. Time moves events on by itself (see applyDue); history ids for those transitions are
// deterministic, so running the same transition twice records it once.

const HISTORY_LIMIT = 2000;
const VERSIONS_LIMIT = 30;
const WORKSPACE_HISTORY = 100;
const MAX_REASON = 200;
const NAME_ID = /^[a-z0-9][a-z0-9-]{1,47}$/;

const fail = (status, message, details) => {
  throw Object.assign(new Error(message), { status, ...(details ? { details } : {}) });
};

export const emptyWorkspace = () => ({
  revision: 0,
  events: {},
  flags: L.defaultFlags(),
  history: [],
  seq: 0,
});

const iso = (ms) => L.formatInstant(ms);
const recordsOf = (ws) => Object.values(ws.events);

/** Put what time has already done into the stored state. Idempotent: the second call finds nothing due. */
export function applyDue(ws, nowMs) {
  let applied = 0;
  for (const t of L.dueTransitions(recordsOf(ws), nowMs)) {
    const record = ws.events[t.id];
    if (t.to === "active") {
      record.status = "active";
      record.activatedAt = record.activatedAt || t.at;
    } else {
      record.status = "completed";
      record.completedAt = t.at;
    }
    const type = t.to === "active" ? "activated" : "completed";
    const added = addHistory(ws, {
      id: `${t.id}#${t.version}#${type}`,
      at: t.at,
      recordedAt: iso(nowMs),
      type,
      eventId: t.id,
      version: t.version,
      actor: "system",
      from: t.from,
      to: t.to,
      note: "time-driven",
    });
    if (added) applied++;
  }
  return applied;
}

function addHistory(ws, entry) {
  // An entry with an id is recorded once, however many times the same transition is applied
  if (entry.id && ws.history.some((h) => h.id === entry.id)) return false;
  ws.seq = (ws.seq || 0) + 1;
  ws.history.push({ seq: ws.seq, id: entry.id || randomUUID(), ...entry });
  if (ws.history.length > HISTORY_LIMIT) ws.history.splice(0, ws.history.length - HISTORY_LIMIT);
  return true;
}

/** Persist whatever time has made due, in every environment. The server calls this on a timer and before serving admin requests. */
export async function reconcileAll({ store, mutate, now }) {
  const nowMs = now();
  const pending = Object.entries(store().liveOps || {}).filter(
    ([, ws]) => L.dueTransitions(recordsOf(ws), nowMs).length > 0,
  );
  if (!pending.length) return 0;
  let applied = 0;
  await mutate((s) => {
    for (const [environment] of pending) applied += applyDue(s.liveOps[environment], nowMs);
  });
  return applied;
}

/** Events that are scheduled or running right now, across environments (the dashboard's "scheduled events") */
export function countLiveEvents(store, nowMs) {
  let count = 0;
  for (const ws of Object.values(store.liveOps || {})) {
    for (const record of recordsOf(ws)) {
      if (L.LIVE_STATUSES.includes(L.effectiveStatus(record, nowMs))) count++;
    }
  }
  return count;
}

function view(environment, ws, nowMs, extra = {}) {
  const events = recordsOf(ws)
    .filter((e) => e.status !== "archived")
    .map((e) => ({ ...e, versions: e.versions.slice(-10), effectiveStatus: L.effectiveStatus(e, nowMs) }))
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : a.id < b.id ? -1 : 1));
  return {
    environment,
    revision: ws.revision,
    serverTime: iso(nowMs),
    events,
    archivedCount: recordsOf(ws).length - events.length,
    flags: L.normalizeFlags(ws.flags),
    conflicts: L.findConflicts(recordsOf(ws), nowMs),
    history: ws.history.slice(-WORKSPACE_HISTORY).reverse(),
    limits: L.LIMITS,
    ...extra,
  };
}

function checkContent(content) {
  const errors = L.validateEventContent(content);
  if (errors.length) fail(400, errors.slice(0, 8).join("; "), { errors });
  const window = L.resolveEventWindow(content);
  if (!window.ok) fail(400, window.errors.join("; "), { errors: window.errors });
  return window;
}

/** The candidate event as the schedule would hold it, for conflict checks */
function candidateRecord(content, window, status = "scheduled") {
  return {
    id: content.id,
    kind: content.kind,
    status,
    version: 0,
    content,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    challengeKey: window.challengeKey,
  };
}

function conflictsFor(ws, candidate, nowMs) {
  const others = recordsOf(ws).filter((r) => r.id !== candidate.id);
  return L.findConflicts([...others, candidate], nowMs).filter((c) => c.eventIds.includes(candidate.id));
}

function requireConflictFree(ws, candidate, nowMs) {
  const conflicts = conflictsFor(ws, candidate, nowMs);
  if (conflicts.length) fail(409, `Schedule conflict: ${conflicts[0].message}`, { conflicts });
}

function ensureRevision(ws, input) {
  if (!Number.isInteger(input.revision) || input.revision !== ws.revision) {
    fail(409, "Live operations changed. Reload and compare before retrying.");
  }
}

function newRecord(content, window, actor, nowMs, note) {
  return {
    id: content.id,
    kind: content.kind,
    status: "draft",
    version: 1,
    content: structuredClone(content),
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    challengeKey: window.challengeKey,
    createdAt: iso(nowMs),
    createdBy: actor,
    updatedAt: iso(nowMs),
    updatedBy: actor,
    versions: [{ version: 1, savedAt: iso(nowMs), author: actor, changed: ["all"] }],
    ...(note ? { origin: note } : {}),
  };
}

function reasonOf(input) {
  if (input.reason === undefined) return "";
  if (typeof input.reason !== "string" || input.reason.length > MAX_REASON || /[\u0000-\u001f]/.test(input.reason)) {
    fail(400, `reason: expected up to ${MAX_REASON} characters`);
  }
  return input.reason.trim();
}

const PAST = {
  schedule: "scheduled",
  unschedule: "unscheduled",
  activate: "activated",
  complete: "completed",
  cancel: "cancelled",
  archive: "archived",
};
const DETERMINISTIC = new Set(["activate", "complete", "cancel", "archive"]);

/**
 * @returns {{changed: boolean, record: Object}}
 */
function lifecycle(ws, action, id, input, current, nowMs) {
  if (!Object.hasOwn(ws.events, id)) fail(404, "Event not found.");
  const record = ws.events[id];
  const actor = current.email;
  const target = L.ACTION_RESULT[action];
  // Already there: nothing to do and nothing to complain about (activation by the clock and by a person can race)
  if (record.status === target) return { changed: false, record };
  if (!L.canApply(record.status, action)) {
    fail(409, `Cannot ${action} an event that is ${record.status}.`);
  }
  ensureRevision(ws, input);
  const reason = action === "cancel" ? reasonOf(input) : "";
  const from = record.status;

  if (action === "schedule") {
    const window = checkContent(record.content);
    if (window.endMs <= nowMs) fail(409, "The event has already ended; move its schedule to the future first.");
    requireConflictFree(ws, candidateRecord(record.content, window), nowMs);
    Object.assign(record, { startsAt: window.startsAt, endsAt: window.endsAt, challengeKey: window.challengeKey });
    record.status = "scheduled";
    record.scheduledAt = iso(nowMs);
    record.scheduledBy = actor;
  } else if (action === "unschedule") {
    record.status = "draft";
    delete record.scheduledAt;
    delete record.scheduledBy;
  } else if (action === "activate") {
    if (L.KIND_INFO[record.kind].calendar) {
      fail(409, `A ${record.kind} challenge covers a fixed ${record.kind === "daily" ? "day" : "week"}; it starts at its scheduled time.`);
    }
    if (nowMs >= Date.parse(record.endsAt)) fail(409, "The event has already ended.");
    const moved = { ...record, startsAt: iso(nowMs), status: "active" };
    requireConflictFree(ws, moved, nowMs);
    record.startsAt = iso(nowMs);
    record.content.schedule.startLocal = L.wallClock(nowMs, record.content.timeZone);
    record.status = "active";
    record.activatedAt = iso(nowMs);
  } else if (action === "complete") {
    record.endsAt = iso(nowMs);
    record.content.schedule.endLocal = L.wallClock(nowMs, record.content.timeZone);
    record.status = "completed";
    record.completedAt = iso(nowMs);
  } else if (action === "cancel") {
    record.status = "cancelled";
    record.cancelledAt = iso(nowMs);
    record.cancelledBy = actor;
    if (reason) record.cancelReason = reason;
  } else if (action === "archive") {
    record.status = "archived";
    record.archivedAt = iso(nowMs);
  }
  record.updatedAt = iso(nowMs);
  record.updatedBy = actor;

  addHistory(ws, {
    ...(DETERMINISTIC.has(action) ? { id: `${id}#${record.version}#${PAST[action]}` } : {}),
    at: iso(nowMs),
    recordedAt: iso(nowMs),
    type: PAST[action],
    eventId: id,
    version: record.version,
    actor,
    from,
    to: record.status,
    ...(reason ? { note: reason } : {}),
  });
  // Scheduled for a window that has already begun: it is live straight away
  applyDue(ws, nowMs);
  return { changed: true, record };
}

export async function liveOpsRoute({
  req,
  path,
  method,
  body,
  send,
  store,
  mutate,
  current,
  permits,
  now,
}) {
  // ── Public: the authoritative schedule ─────────────────────────────────────────────────────────────────────────────
  const publicMatch = path.match(/^\/api\/game-liveops\/([^/]+)$/);
  if (publicMatch) {
    if (method !== "GET") fail(404, "Unknown operation.");
    const environment = publicMatch[1];
    if (!ENVIRONMENTS.includes(environment)) fail(400, "Unknown environment.");
    const ws = store().liveOps?.[environment] || emptyWorkspace();
    // Computed on the server clock without writing anything: a public read never changes the store
    send(200, L.buildPublicPayload({ environment, revision: ws.revision, flags: ws.flags, events: recordsOf(ws) }, now()));
    return true;
  }

  if (path === "/api/liveops" && method === "GET") {
    if (!current) fail(401, "Authentication required.");
    if (!permits(current, "liveops:read")) fail(403, "Permission denied.");
    send(200, { source: "api", integration: "connected", environments: ENVIRONMENTS, items: [] });
    return true;
  }
  const match = path.match(/^\/api\/liveops\/environments\/([^/]+)(?:\/(.+))?$/);
  if (!match) return false;
  const [, environment, rest = ""] = match;
  if (!current) fail(401, "Authentication required.");
  if (!ENVIRONMENTS.includes(environment)) fail(400, "Unknown environment.");
  const need = (permission) => {
    if (!permits(current, `liveops:${permission}`)) fail(403, "Permission denied.");
  };
  const segments = rest ? rest.split("/") : [];
  // Nothing below may write, not even the clock catch-up, for a caller who is not allowed to read this module
  need("read");

  // The stored state first catches up with the clock, so every answer reflects what is really running
  await reconcileAll({ store, mutate, now });
  const readWorkspace = () => store().liveOps?.[environment] || emptyWorkspace();

  // ── Reads ──────────────────────────────────────────────────────────────────────────────────────────────────────────
  if (method === "GET" && segments.length === 0) {
    need("read");
    send(200, view(environment, readWorkspace(), now()));
    return true;
  }
  if (method === "GET" && segments.length === 1 && segments[0] === "history") {
    need("read");
    const query = new URL(req.url, "http://localhost").searchParams;
    const limit = Math.min(200, Math.max(1, Number(query.get("limit")) || 50));
    const before = Number(query.get("before")) || Infinity;
    const eventId = query.get("eventId");
    const entries = readWorkspace()
      .history.filter((h) => h.seq < before && (!eventId || h.eventId === eventId))
      .reverse();
    send(200, { entries: entries.slice(0, limit), next: entries.length > limit ? entries[limit - 1].seq : null });
    return true;
  }
  if (method !== "POST") fail(404, "Unknown operation.");
  const input = await body();
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(400, "Expected a JSON object.");

  // ── Dry run: validate and find conflicts without saving ────────────────────────────────────────────────────────────
  if (segments.length === 1 && segments[0] === "preview") {
    need("write");
    const errors = L.validateEventContent(input.content);
    let window = null;
    let conflicts = [];
    if (!errors.length) {
      const resolved = L.resolveEventWindow(input.content);
      if (resolved.ok) {
        window = { startsAt: resolved.startsAt, endsAt: resolved.endsAt, challengeKey: resolved.challengeKey };
        conflicts = conflictsFor(readWorkspace(), candidateRecord(input.content, resolved), now());
      } else errors.push(...resolved.errors);
    }
    send(200, { ok: errors.length === 0, errors, window, conflicts, serverTime: iso(now()) });
    return true;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let result;
  const commit = async (action, permission, apply) => {
    need(permission);
    await mutate((s) => {
      s.liveOps ||= {};
      const ws = (s.liveOps[environment] ||= emptyWorkspace());
      const nowMs = now();
      applyDue(ws, nowMs);
      const outcome = apply(ws, nowMs) || {};
      if (outcome.changed !== false) {
        ws.revision++;
        s.audit.push({
          id: randomUUID(),
          action: `liveops.${action}`,
          actor: current.email,
          target: outcome.eventId ? `${environment}/${outcome.eventId}` : environment,
          revision: ws.revision,
          createdAt: iso(nowMs),
        });
      }
      result = { ...outcome, view: view(environment, ws, nowMs) };
    });
  };
  const respond = (status = 200) => {
    const { view: workspace, record, ...rest } = result;
    send(status, { ...workspace, changed: rest.changed !== false, ...(record ? { event: { ...record, effectiveStatus: L.effectiveStatus(record, now()) } } : {}), ...(rest.extra || {}) });
    return true;
  };

  if (segments.length === 1 && segments[0] === "events") {
    await commit("create", "write", (ws, nowMs) => {
      ensureRevision(ws, input);
      const window = checkContent(input.content);
      const id = input.content.id;
      if (Object.hasOwn(ws.events, id)) fail(409, `An event with the id “${id}” already exists.`);
      if (recordsOf(ws).filter((e) => e.status !== "archived").length >= L.LIMITS.eventsPerEnvironment) {
        fail(409, `This environment already holds ${L.LIMITS.eventsPerEnvironment} events; archive finished ones first.`);
      }
      const record = newRecord(input.content, window, current.email, nowMs);
      ws.events[id] = record;
      addHistory(ws, { at: iso(nowMs), recordedAt: iso(nowMs), type: "created", eventId: id, version: 1, actor: current.email, to: "draft" });
      return { record, eventId: id };
    });
    return respond(201);
  }

  if (segments.length === 3 && segments[0] === "events") {
    const [, id, action] = segments;
    if (!NAME_ID.test(id)) fail(404, "Event not found.");

    if (action === "save") {
      await commit("save", "write", (ws, nowMs) => {
        if (!Object.hasOwn(ws.events, id)) fail(404, "Event not found.");
        const record = ws.events[id];
        if (record.status !== "draft") fail(409, `A ${record.status} event cannot be edited. Unschedule it to change it.`);
        ensureRevision(ws, input);
        if (input.content?.id !== id) fail(400, "event.id: cannot be changed; create a new event instead.");
        const window = checkContent(input.content);
        const changed = L.changedSections(record.content, input.content);
        if (!changed.length) return { changed: false, record, eventId: id };
        record.version++;
        record.kind = input.content.kind;
        record.content = structuredClone(input.content);
        Object.assign(record, { startsAt: window.startsAt, endsAt: window.endsAt, challengeKey: window.challengeKey, updatedAt: iso(nowMs), updatedBy: current.email });
        record.versions.push({ version: record.version, savedAt: iso(nowMs), author: current.email, changed });
        if (record.versions.length > VERSIONS_LIMIT) record.versions.splice(0, record.versions.length - VERSIONS_LIMIT);
        addHistory(ws, { at: iso(nowMs), recordedAt: iso(nowMs), type: "saved", eventId: id, version: record.version, actor: current.email, note: `changed: ${changed.join(", ")}` });
        return { record, eventId: id };
      });
      return respond();
    }

    if (action === "delete") {
      await commit("delete", "write", (ws, nowMs) => {
        if (!Object.hasOwn(ws.events, id)) fail(404, "Event not found.");
        const record = ws.events[id];
        if (record.status !== "draft") fail(409, `Only a draft can be deleted; a ${record.status} event stays in the history (cancel or archive it).`);
        ensureRevision(ws, input);
        delete ws.events[id];
        addHistory(ws, { at: iso(nowMs), recordedAt: iso(nowMs), type: "deleted", eventId: id, version: record.version, actor: current.email, from: "draft" });
        return { eventId: id };
      });
      return respond();
    }

    if (L.ACTIONS.includes(action)) {
      await commit(action, "publish", (ws, nowMs) => {
        const outcome = lifecycle(ws, action, id, input, current, nowMs);
        return { ...outcome, eventId: id };
      });
      return respond();
    }
    fail(404, "Unknown operation.");
  }

  if (segments.length === 1 && segments[0] === "flags") {
    await commit("flags", "publish", (ws, nowMs) => {
      ensureRevision(ws, input);
      const errors = L.validateFlags(input.flags);
      if (errors.length) fail(400, errors.slice(0, 8).join("; "), { errors });
      const before = L.normalizeFlags(ws.flags);
      const changed = L.FLAG_KEYS.filter((key) => JSON.stringify(before[key]) !== JSON.stringify(input.flags[key]));
      if (!changed.length) return { changed: false };
      ws.flags = Object.fromEntries(L.FLAG_KEYS.map((key) => [key, { enabled: input.flags[key].enabled, rolloutPercent: input.flags[key].rolloutPercent }]));
      addHistory(ws, {
        at: iso(nowMs), recordedAt: iso(nowMs), type: "flags", eventId: null, version: null, actor: current.email,
        note: changed.map((key) => `${key}: ${input.flags[key].enabled ? `on ${input.flags[key].rolloutPercent}%` : "off"}`).join(", "),
      });
      return {};
    });
    return respond();
  }

  if (segments.length === 1 && segments[0] === "generate") {
    await commit("generate", "write", (ws, nowMs) => {
      ensureRevision(ws, input);
      const params = input.params && typeof input.params === "object" && !Array.isArray(input.params) ? input.params : {};
      const events = recordsOf(ws);
      const taken = events.filter((e) => e.status !== "cancelled" && e.status !== "archived");
      let generated;
      if (input.kind === "daily") {
        generated = L.generateDailyContents({
          ...params,
          existingKeys: taken.filter((e) => e.kind === "daily").map((e) => e.challengeKey),
        });
      } else if (input.kind === "random") {
        generated = L.generateRandomContents({
          ...params,
          occupied: taken.filter((e) => e.kind === "random").map((e) => ({ startsAt: e.startsAt, endsAt: e.endsAt })),
          takenIds: events.map((e) => e.id),
        });
      } else fail(400, "kind: expected daily or random");
      if (generated.errors.length) fail(400, generated.errors.join("; "), { errors: generated.errors });
      if (events.filter((e) => e.status !== "archived").length + generated.contents.length > L.LIMITS.eventsPerEnvironment) {
        fail(409, `This environment would exceed ${L.LIMITS.eventsPerEnvironment} events; archive finished ones first.`);
      }
      const created = [];
      for (const content of generated.contents) {
        if (Object.hasOwn(ws.events, content.id)) continue;
        const window = checkContent(content);
        ws.events[content.id] = newRecord(content, window, current.email, nowMs, `generated ${input.kind}`);
        addHistory(ws, { at: iso(nowMs), recordedAt: iso(nowMs), type: "created", eventId: content.id, version: 1, actor: current.email, to: "draft", note: `generated ${input.kind}` });
        created.push(content.id);
      }
      return {
        ...(created.length ? {} : { changed: false }),
        extra: { created, skipped: generated.skipped || [], shortfall: generated.shortfall || 0 },
      };
    });
    return respond();
  }

  fail(404, "Unknown operation.");
}
