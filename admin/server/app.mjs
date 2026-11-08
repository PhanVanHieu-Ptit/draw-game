import { configurationRoute } from "./configuration.mjs";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { roles, permits, modules } from "./policy.mjs";

export function createAdminServer({
  email,
  password,
  dataDir,
  secure = false,
  role = "Super Admin",
  sessionTTL = 8 * 60 * 60 * 1000,
  now = Date.now,
} = {}) {
  if (!email || !password || password.length < 16)
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters).",
    );
  if (!Object.hasOwn(roles, role)) throw new Error("Unknown bootstrap role.");
  const salt = randomBytes(32),
    hash = scryptSync(password, salt, 64);
  const sessions = new Map(),
    attempts = new Map();
  const user = { id: "bootstrap-admin", name: "Administrator", email, role };
  let store = { configuration: [], audit: [] };
  const ready = (async () => {
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    try {
      store = JSON.parse(await readFile(`${dataDir}/store.json`, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  })();
  // Serialize persistence and writes to avoid lost updates in concurrent requests.
  let writes = Promise.resolve();
  const mutate = (action) => {
    const operation = writes.then(async () => {
      const next = structuredClone(store);
      action(next);
      await writeFile(`${dataDir}/store.tmp`, JSON.stringify(next, null, 2), {
        mode: 0o600,
      });
      await rename(`${dataDir}/store.tmp`, `${dataDir}/store.json`);
      store = next;
    });
    writes = operation.catch(() => {});
    return operation;
  };
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(body));
    };
    try {
      await ready;
      const path = new URL(req.url, "http://localhost").pathname;
      const method = req.method;
      const mutating = !["GET", "HEAD"].includes(method);
      // Browsers cannot send this header cross-origin without a preflight; no CORS is enabled.
      if (mutating && req.headers["x-admin-request"] !== "1")
        return send(403, { message: "Missing request protection header." });
      if (
        mutating &&
        req.headers.origin &&
        req.headers.origin !==
          `${secure ? "https" : "http"}://${req.headers.host}`
      )
        return send(403, { message: "Cross-origin request rejected." });
      const body = async () => {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 16384)
            throw Object.assign(new Error("Request too large."), {
              status: 413,
            });
        }
        try {
          return JSON.parse(raw || "{}");
        } catch {
          throw Object.assign(new Error("Invalid JSON."), { status: 400 });
        }
      };
      const token = req.headers.cookie?.match(
        /(?:^|;\s*)ap_session=([a-f0-9]{64})(?:;|$)/,
      )?.[1];
      const session = sessions.get(token);
      if (session && session.expires <= now()) sessions.delete(token);
      const current = session && session.expires > now() ? session.user : null;
      const publicUser = (u) => ({ ...u, permissions: roles[u.role] });
      if (path === "/api/auth/login" && method === "POST") {
        const ip = req.socket.remoteAddress;
        const limit = attempts.get(ip);
        if (limit && limit.until > now() && limit.count >= 5)
          return send(429, {
            message: "Too many attempts. Try again in 15 minutes.",
          });
        const input = await body();
        const valid =
          typeof input.password === "string" &&
          input.password.length <= 1024 &&
          timingSafeEqual(hash, scryptSync(input.password, salt, 64));
        if (input.email !== email || !valid) {
          attempts.set(ip, {
            count: (limit?.until > now() ? limit.count : 0) + 1,
            until: now() + 900000,
          });
          return send(401, { message: "Invalid email or password." });
        }
        attempts.delete(ip);
        for (const [key, value] of sessions)
          if (value.expires <= now()) sessions.delete(key);
        if (token) sessions.delete(token);
        const id = randomBytes(32).toString("hex");
        sessions.set(id, { user, expires: now() + sessionTTL });
        res.setHeader(
          "Set-Cookie",
          `ap_session=${id}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${Math.floor(sessionTTL / 1000)}${secure ? "; Secure" : ""}`,
        );
        return send(200, { user: publicUser(user) });
      }
      if (
        await configurationRoute({
          req,
          path,
          method,
          body,
          send,
          store: () => store,
          mutate,
          current,
          now,
          permits,
        })
      )
        return;
      if (!current) return send(401, { message: "Authentication required." });
      if (path === "/api/auth/me" && method === "GET")
        return send(200, { user: publicUser(current) });
      if (path === "/api/auth/logout" && method === "POST") {
        sessions.delete(token);
        res.setHeader(
          "Set-Cookie",
          "ap_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0",
        );
        return send(200, { message: "Signed out." });
      }
      const module = path.split("/")[2];
      if (!modules.includes(module))
        return send(404, { message: "Endpoint not found." });
      if (!permits(current, `${module}:${mutating ? "write" : "read"}`))
        return send(403, { message: "Permission denied." });
      if (path === "/api/dashboard" && method === "GET")
        return send(200, {
          source: "api",
          metrics: {
            activePlayers: null,
            gameSessions: null,
            publishedConfiguration: Object.values(
              store.environments || {},
            ).filter((e) => e.published).length,
            scheduledEvents: null,
            gameplayPerformance: null,
          },
          health: {
            adminApi: "operational",
            gameTelemetry: "not connected",
            storage: "local JSON",
          },
          updatedAt: new Date(now()).toISOString(),
        });
      if (path === "/api/system" && method === "GET")
        return send(200, {
          source: "api",
          items: store.audit.slice(-100).reverse(),
        });
      if (path === "/api/configuration" && method === "GET")
        return send(200, { source: "api", items: store.configuration });
      if (path === "/api/configuration" && method === "POST") {
        const input = await body();
        if (
          typeof input.name !== "string" ||
          !input.name.trim() ||
          input.name.length > 80 ||
          !Number.isInteger(input.maxWaves) ||
          input.maxWaves < 1 ||
          input.maxWaves > 1000
        )
          return send(400, {
            message:
              "Name (1–80 characters) and maxWaves (1–1000) are required.",
          });
        const item = {
          id: randomBytes(12).toString("hex"),
          name: input.name.trim(),
          maxWaves: input.maxWaves,
          status: "draft",
          updatedAt: new Date(now()).toISOString(),
        };
        await mutate((s) => {
          s.configuration.push(item);
          s.audit.push({
            id: randomBytes(12).toString("hex"),
            action: "configuration.create",
            actor: current.email,
            target: item.id,
            createdAt: item.updatedAt,
          });
        });
        return send(201, { item });
      }
      // Unsupported modules do not pretend to expose game data or perform privileged operations.
      if (method === "GET" && path === `/api/${module}`)
        return send(200, {
          source: "api",
          items: [],
          integration: "not_connected",
        });
      return send(404, { message: "Endpoint not implemented." });
    } catch (error) {
      send(error.status || 500, {
        message: error.status
          ? error.message
          : "Server error. Check server storage and configuration.",
      });
    }
  });
}
