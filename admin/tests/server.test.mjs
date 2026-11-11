import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createAdminServer } from "../server/app.mjs";
import { permits, roles, modules } from "../server/policy.mjs";
const credentials = {
  email: "test@example.com",
  password: "test-password-long-enough",
};
async function fixture(t, options = {}) {
  const dataDir = await mkdtemp(join(tmpdir(), "arcane-admin-"));
  const server = createAdminServer({ ...credentials, dataDir, ...options });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(dataDir, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (path, options = {}) => fetch(base + path, options);
  const login = () =>
    call("/api/auth/login", {
      method: "POST",
      headers: { "x-admin-request": "1" },
      body: JSON.stringify(credentials),
    });
  return { call, login, server, dataDir };
}
test("all roles enforce least privilege and unknown roles deny", () => {
  for (const role of Object.keys(roles))
    for (const module of modules)
      for (const action of ["read", "write"])
        assert.equal(
          permits({ role }, `${module}:${action}`),
          roles[role].includes(`${module}:${action}`),
        );
  assert.equal(permits({ role: "Analyst" }, "configuration:write"), false);
  assert.equal(permits({ role: "Support" }, "system:write"), false);
  assert.equal(permits({ role: "unknown" }, "dashboard:read"), false);
  assert.equal(permits(null, "dashboard:read"), false);
});
test("session protection, drafts, audit, unknown metrics, logout", async (t) => {
  const { call, login, dataDir } = await fixture(t);
  assert.equal((await call("/api/configuration")).status, 401);
  assert.equal(
    (await call("/api/configuration", { method: "POST" })).status,
    403,
  );
  assert.equal(
    (
      await call("/api/auth/login", {
        method: "POST",
        headers: { "x-admin-request": "1", origin: "https://evil.example" },
        body: JSON.stringify(credentials),
      })
    ).status,
    403,
  );
  const response = await login();
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  const headers = { cookie: cookie.split(";")[0], "x-admin-request": "1" };
  assert.equal((await call("/api/auth/me", { headers })).status, 200);
  assert.equal(
    (
      await call("/api/configuration", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "bad", maxWaves: 0 }),
      })
    ).status,
    400,
  );
  const created = await call("/api/configuration", {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "First draft",
      maxWaves: 20,
      status: "published",
    }),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).item.status, "draft");
  const dashboard = await (await call("/api/dashboard", { headers })).json();
  assert.equal(dashboard.metrics.activePlayers, null);
  assert.equal(dashboard.metrics.publishedConfiguration, 0);
  assert.equal(
    (await (await call("/api/system", { headers })).json()).items.length,
    1,
  );
  const { readFile } = await import("node:fs/promises");
  const stored = JSON.parse(
    await readFile(join(dataDir, "store.json"), "utf8"),
  );
  assert.equal(stored.configuration.length, 1);
  assert.equal(
    (await call("/api/players", { method: "DELETE", headers })).status,
    404,
  );
  assert.equal(
    (await call("/api/auth/logout", { method: "POST", headers })).status,
    200,
  );
  assert.equal((await call("/api/dashboard", { headers })).status, 401);
});
test("sessions expire and login attempts are throttled", async (t) => {
  let time = 1000;
  const { call, login } = await fixture(t, {
    sessionTTL: 100,
    now: () => time,
  });
  const response = await login();
  const headers = { cookie: response.headers.get("set-cookie").split(";")[0] };
  time += 101;
  assert.equal((await call("/api/auth/me", { headers })).status, 401);
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call("/api/auth/login", {
          method: "POST",
          headers: { "x-admin-request": "1" },
          body: JSON.stringify({ ...credentials, password: "incorrect" }),
        })
      ).status,
      401,
    );
  assert.equal((await login()).status, 429);
  time += 900001;
  assert.equal((await login()).status, 200);
});
test("server refuses missing or weak bootstrap secrets", () => {
  assert.throws(() => createAdminServer({}), /ADMIN_EMAIL/);
  assert.throws(
    () => createAdminServer({ email: "x", password: "short" }),
    /16 characters/,
  );
});
test("server denies privileged direct API requests for Analyst", async (t) => {
  const { call, login } = await fixture(t, { role: "Analyst" });
  const response = await login();
  const headers = {
    cookie: response.headers.get("set-cookie").split(";")[0],
    "x-admin-request": "1",
  };
  assert.equal((await call("/api/dashboard", { headers })).status, 200);
  assert.equal((await call("/api/configuration", { headers })).status, 403);
  assert.equal(
    (
      await call("/api/configuration", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "Forbidden", maxWaves: 10 }),
      })
    ).status,
    403,
  );
  assert.equal((await call("/api/system", { headers })).status, 403);
});
// POST `body` to the server over a raw socket, written in two pieces `pauseMs` apart, so the server receives
// the two halves as separate chunks. Returns the response status.
function postInTwoChunks(server, cookie, path, body, splitAt, pauseMs = 30) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: server.address().port,
        path,
        method: "POST",
        headers: {
          cookie,
          "x-admin-request": "1",
          "content-type": "application/json",
          "content-length": body.length,
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.write(body.subarray(0, splitAt));
    setTimeout(() => req.end(body.subarray(splitAt)), pauseMs);
  });
}
test("request bodies split inside a multi-byte character keep every character (>= 1 MB)", async (t) => {
  const { call, login, server } = await fixture(t);
  const cookie = (await login()).headers.get("set-cookie").split(";")[0];
  const headers = { cookie, "x-admin-request": "1" };
  const current = await (await call("/api/content/story", { headers })).json();
  const story = structuredClone(current.draft);
  const sample = "Ngước nhìn sao trời, ế ề ể ễ ệ ạ ả ấ ầ ẩ ẫ ậ ";
  const text = sample.repeat(Math.ceil(1_100_000 / Buffer.byteLength(sample)));
  assert.ok(Buffer.byteLength(text) >= 1_000_000);
  story.locales.vi["test.multibyte"] = text;
  const body = Buffer.from(
    JSON.stringify({ revision: current.revision, story }),
    "utf8",
  );
  // Cut in the middle of a character: step forward to a UTF-8 continuation byte (10xxxxxx) near the middle.
  let splitAt = Math.floor(body.length / 2);
  while ((body[splitAt] & 0xc0) !== 0x80) splitAt++;
  assert.equal(
    await postInTwoChunks(server, cookie, "/api/content/story/draft", body, splitAt),
    200,
  );
  const stored = (await (await call("/api/content/story", { headers })).json())
    .draft.locales.vi["test.multibyte"];
  assert.equal((stored.match(/�/g) || []).length, 0);
  assert.equal(stored.length, text.length);
  assert.equal(stored, text);
});
test("request body limits are measured in bytes, and invalid JSON is still a 400", async (t) => {
  const { call, login } = await fixture(t);
  const cookie = (await login()).headers.get("set-cookie").split(";")[0];
  const post = (path, payload) =>
    call(path, {
      method: "POST",
      headers: { cookie, "x-admin-request": "1" },
      body: payload,
    });
  // 9000 two-byte characters = 18000 bytes: under 16384 characters but over the 16 KiB byte limit.
  const big = JSON.stringify({ name: "ế".repeat(9000), maxWaves: 10 });
  assert.ok(big.length < 16384 && Buffer.byteLength(big) > 16384);
  assert.equal((await post("/api/configuration", big)).status, 413);
  assert.equal((await post("/api/configuration", "{not json")).status, 400);
});
