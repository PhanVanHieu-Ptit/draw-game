import { randomUUID } from "node:crypto";
import {
  validateConfig,
  SCHEMA_VERSION,
  ENVIRONMENTS,
} from "../../shared/game-configuration.js";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function environmentState(store, environment) {
  return (
    store.environments?.[environment] || {
      revision: 0,
      published: null,
      draft: null,
      versions: [],
    }
  );
}
export async function configurationRoute({
  req,
  path,
  method,
  body,
  send,
  store,
  mutate,
  current,
  now,
  permits,
}) {
  const match = path.match(
    /^\/api\/(configuration\/environments|game-config)\/([^/]+)(?:\/(save|validate|review|publish|rollback))?$/,
  );
  if (!match) return false;
  const [, scope, environment, action] = match;
  if (!ENVIRONMENTS.includes(environment)) fail(400, "Unknown environment.");
  if (scope === "game-config") {
    if (method !== "GET" || action) fail(404, "Unknown operation.");
    const state = environmentState(store(), environment);
    if (!state.published) fail(404, "No published configuration.");
    send(200, state.published);
    return true;
  }
  if (!current) fail(401, "Authentication required.");
  if (!permits(current, `configuration:${method === "GET" ? "read" : "write"}`))
    fail(403, "Permission denied.");
  if (method === "GET" && !action) {
    send(200, environmentState(store(), environment));
    return true;
  }
  if (method !== "POST" || !action) fail(404, "Unknown operation.");
  if (
    ["publish", "rollback", "review"].includes(action) &&
    !permits(
      current,
      `configuration:${action === "rollback" ? "publish" : action}`,
    )
  )
    fail(403, "Permission denied.");
  const input = await body();
  let result;
  await mutate((s) => {
    s.environments ||= {};
    const state = (s.environments[environment] ||= structuredClone(
      environmentState(s, environment),
    ));
    if (!Number.isInteger(input.revision) || input.revision !== state.revision)
      fail(409, "Configuration changed. Reload and compare before retrying.");
    const timestamp = new Date(now()).toISOString();
    if (action === "save") {
      const errors = validateConfig(input.values);
      if (errors.length) fail(400, errors.join("; "));
      state.draft = {
        values: input.values,
        status: "draft",
        author: current.email,
      };
    } else if (action === "rollback") {
      const target = state.versions.find((v) => v.id === input.versionId);
      if (!target)
        fail(400, "Published version not found in this environment.");
      state.published = {
        ...structuredClone(target),
        id: randomUUID(),
        createdAt: timestamp,
        rollbackOf: target.id,
      };
      state.versions.push(state.published);
      state.draft = null;
    } else {
      if (!state.draft) fail(400, "Save a draft first.");
      const errors = validateConfig(state.draft.values);
      if (errors.length) fail(400, errors.join("; "));
      const expected = {
        validate: "draft",
        review: "validated",
        publish: "reviewed",
      }[action];
      if (state.draft.status !== expected)
        fail(409, `Expected ${expected} draft.`);
      if (action === "publish") {
        state.published = {
          id: randomUUID(),
          schemaVersion: SCHEMA_VERSION,
          environment,
          createdAt: timestamp,
          values: structuredClone(state.draft.values),
        };
        state.versions.push(state.published);
        state.draft = null;
      } else
        state.draft.status = action === "validate" ? "validated" : "reviewed";
    }
    state.revision++;
    s.audit.push({
      id: randomUUID(),
      action: `configuration.${action}`,
      actor: current.email,
      target: environment,
      revision: state.revision,
      ...(action === "save"
        ? { values: structuredClone(state.draft.values) }
        : {}),
      versionId: state.published?.id,
      createdAt: timestamp,
    });
    result = structuredClone(state);
  });
  send(200, result);
  return true;
}
