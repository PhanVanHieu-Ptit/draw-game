import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminServer } from "../server/app.mjs";
import { defaults, validateConfig } from "../../shared/game-configuration.js";
import { RemoteConfiguration } from "../../src/core/RemoteConfiguration.js";
async function fixture(t, role = "Super Admin") {
  const dataDir = await mkdtemp(join(tmpdir(), "configuration-"));
  const credentials = {
    email: "admin@test.test",
    password: "long-test-password-only",
  };
  const server = createAdminServer({ ...credentials, dataDir, role });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "x-admin-request": "1" },
    body: JSON.stringify(credentials),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const call = (path, input) =>
    fetch(base + path, {
      method: input ? "POST" : "GET",
      headers: { cookie, "x-admin-request": "1" },
      body: input ? JSON.stringify(input) : undefined,
    });
  return { call, base, dataDir };
}
test("strict shared schema rejects missing, unknown, non-finite and out of range fields", () => {
  assert.deepEqual(validateConfig(defaults), []);
  for (const value of [
    {},
    { ...defaults, extra: {} },
    { ...defaults, combat: { runeDamage: Infinity, playerDamage: 0 } },
  ])
    assert.ok(validateConfig(value).length);
});
test("atomic version lifecycle, stale writes, rollback and environment isolation", async (t) => {
  const { call, base, dataDir } = await fixture(t);
  const path = "/api/configuration/environments/staging";
  assert.equal((await fetch(base + path)).status, 401);
  assert.equal((await fetch(base + "/api/game-config/staging")).status, 404);
  assert.equal(
    (await call(path + "/save", { revision: 0, values: {} })).status,
    400,
  );
  const saves = await Promise.all(
    [1, 2].map(() => call(path + "/save", { revision: 0, values: defaults })),
  );
  assert.deepEqual(saves.map((r) => r.status).sort(), [200, 409]);
  assert.equal((await call(path + "/publish", { revision: 1 })).status, 409);
  for (const [index, action] of ["validate", "review", "publish"].entries())
    assert.equal(
      (await call(path + "/" + action, { revision: index + 1 })).status,
      200,
    );
  const first = await (await fetch(base + "/api/game-config/staging")).json();
  assert.equal(first.schemaVersion, 1);
  assert.equal((await fetch(base + "/api/game-config/production")).status, 404);
  let revision = 4;
  for (const action of ["save", "validate", "review", "publish"]) {
    assert.equal(
      (
        await call(path + "/" + action, {
          revision: revision++,
          values: { ...defaults, combat: { runeDamage: 2, playerDamage: 2 } },
        })
      ).status,
      200,
    );
  }
  assert.equal(
    (await call(path + "/rollback", { revision, versionId: first.id })).status,
    200,
  );
  const state = await (await call(path)).json();
  assert.equal(state.versions.length, 3);
  assert.notEqual(state.published.id, first.id);
  assert.deepEqual(state.published.values, defaults);
  const persisted = JSON.parse(
    await readFile(join(dataDir, "store.json"), "utf8"),
  );
  assert.equal(persisted.environments.staging.revision, 9);
  assert.equal(persisted.audit.length, 9);
});
test("designer can edit and validate but cannot review, publish or rollback", async (t) => {
  const { call } = await fixture(t, "Game Designer");
  const path = "/api/configuration/environments/development";
  assert.equal(
    (await call(path + "/save", { revision: 0, values: defaults })).status,
    200,
  );
  assert.equal((await call(path + "/validate", { revision: 1 })).status, 200);
  for (const action of ["review", "publish", "rollback"])
    assert.equal(
      (await call(path + "/" + action, { revision: 2 })).status,
      403,
    );
});
test("runtime fallback, compatibility rejection and immutable run pin", async () => {
  const remote = new RemoteConfiguration();
  const original = remote.pin();
  assert.equal(original.id, "local");
  assert.equal(
    await remote.load("/config", "staging", async () => {
      throw Error("offline");
    }),
    false,
  );
  const envelope = {
    id: "version-1",
    schemaVersion: 1,
    environment: "staging",
    values: structuredClone(defaults),
  };
  const fetcher = (value) => async () => ({
    ok: true,
    json: async () => value,
  });
  assert.equal(
    await remote.load(
      "/config",
      "staging",
      fetcher({ ...envelope, schemaVersion: 2 }),
    ),
    false,
  );
  assert.equal(
    await remote.load("/config", "production", fetcher(envelope)),
    false,
  );
  assert.equal(
    await remote.load("/config", "staging", fetcher(envelope)),
    true,
  );
  const pinned = remote.pin();
  await remote.load(
    "/config",
    "staging",
    fetcher({ ...envelope, id: "version-2" }),
  );
  assert.equal(pinned.id, "version-1");
  assert.throws(() => {
    pinned.values.combat.playerDamage = 5;
  });
});
