import { storyRoute } from './story.mjs';
import { configurationRoute } from "./configuration.mjs";
import { createServer } from "node:http";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { roles, permits, modules } from "./policy.mjs";
<<<<<<< Updated upstream
=======
import { createLoginThrottle, clientAddress } from "./throttle.mjs";
import { liveOpsRoute, countLiveEvents, reconcileAll } from "./liveops.mjs";

// Largest request body, in bytes, per route prefix (the first match wins). Content documents are big by nature:
// the story and gameplay editors save a whole document per request, and a gameplay document that stays inside the
// schema's own caps (500 entries per array, 10,000 spawn events, 512-character text) reaches about 1.9 MiB.
// Everything else (login, configuration) is tiny and keeps the default.
const MiB = 1024 * 1024;
const BODY_LIMITS = [
  ["/api/content/story", 2 * MiB],
  ["/api/gameplay/", 2 * MiB],
  // One event (or one flag set) per request: a few KiB. 64 KiB leaves room for 512-character texts and 8 rewards.
  ["/api/liveops/", 64 * 1024],
];
const DEFAULT_BODY_LIMIT = 16 * 1024;
const bodyLimit = (path) =>
  BODY_LIMITS.find(([prefix]) => path.startsWith(prefix))?.[1] ??
  DEFAULT_BODY_LIMIT;
// An upload over its limit is still read to the end (and thrown away, never buffered) up to this many bytes before
// the 413 is sent. Giving up the moment the limit is crossed left the connection open until Node's request timeout
// and often cost the client its 413 (it saw a reset connection instead). Past this size the connection is dropped.
const DRAIN_LIMIT = 8 * MiB;
>>>>>>> Stashed changes

export function createAdminServer({
  email,
  password,
  dataDir,
  secure = false,
  role = "Super Admin",
  sessionTTL = 8 * 60 * 60 * 1000,
  now = Date.now,
  // How often scheduled live-ops events are moved to active / completed and recorded, even when nobody is using the
  // admin. 0 turns the timer off (tests drive `server.reconcileLiveOps()` themselves).
  liveOpsTickMs = 30 * 1000,
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
  const server = createServer(async (req, res) => {
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
        const limit = path.startsWith('/api/content/story') ? 2097152 : 16384;
        // Collect the raw Buffers and decode once at the end: decoding each chunk on its own turns a multi-byte
        // character that straddles two chunks into U+FFFD.
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > limit)
            throw Object.assign(new Error("Request too large."), {
              status: 413,
            });
          chunks.push(chunk);
        }
        const raw = Buffer.concat(chunks).toString("utf8");
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
      if (await storyRoute({path,method,body,send,store:()=>store,mutate,current,permits,now})) return;
      if (await liveOpsRoute({ req, path, method, body, send, store: () => store, mutate, current, permits, now })) return;
      if (
        await configurationRoute({
          content: path.startsWith("/api/gameplay/environments/") || path.startsWith("/api/game-content/"),
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
            scheduledEvents: countLiveEvents(store, now()),
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
        // Structured problems (a list of field errors, the conflicting events) for the editors; never for a 500
        ...(error.status && error.details ? { details: error.details } : {}),
      });
    }
  });
  // Server-authoritative schedule: time moves events on whether or not anyone is looking. Every liveops request also
  // catches up first, so a missed tick never shows stale state.
  const reconcile = () => reconcileAll({ store: () => store, mutate, now });
  server.reconcileLiveOps = async () => {
    await ready;
    return reconcile();
  };
  if (liveOpsTickMs > 0) {
    const timer = setInterval(() => void server.reconcileLiveOps().catch(() => {}), liveOpsTickMs);
    timer.unref?.();
    server.on("close", () => clearInterval(timer));
  }
  return server;
}
