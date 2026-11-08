# Arcane Paws Admin Control Center

An isolated React + TypeScript + Vite + Ant Design application and Node HTTP API. Repository inspection found a vanilla JavaScript game, client-side local progress, and a Vite single-file export pipeline; no existing backend or admin app was available. Nothing in the game or its standalone builds is modified or imported by this application.

## Run locally

Requires Node 22.12+ and npm.

```sh
cd admin
npm ci
cp .env.example .env
# Edit .env: set ADMIN_EMAIL and a unique ADMIN_PASSWORD of 16+ characters.
npm run server
```

In another terminal, from `admin/`:

```sh
npm run dev
```

Open the Vite URL and sign in with the server-configured credentials. Vite proxies `/api` to loopback port 3001. If changing ADMIN_PORT, update the Vite proxy target too. No default credentials, mock login, bearer tokens in localStorage, or analytics fixtures are shipped. Theme preference alone is stored in localStorage.

```sh
npm test                 # HTTP integration and permission tests
npm run test:ui          # component, protected route, API error tests
npm run build           # strict TypeScript and production frontend build
npm run preview         # static preview only; /api requires a same-origin proxy
```

## Structure

```text
admin/
  src/
    auth/               Session restoration, login, permission route guards
    components/         Tables, filters, form modal, confirmations, notifications,
                        resource state hook, error/retry and page heading
    services/           Typed fetch client, DTOs and domain API methods
    pages.tsx           Dashboard and module foundations
    main.tsx            App providers, router, responsive shell and theme
    styles.css          Arcane palette and responsive layout
  server/
    app.mjs             HTTP endpoints, validation, session security, persistence
    policy.mjs          Authoritative server-side role/permission matrix
    index.mjs           Environment bootstrap, loopback listener
  tests/                Backend integration/security tests
```

## Authentication and authorization

The backend provisions one account from server environment variables. ADMIN_ROLE defaults to Super Admin and may be any supported role. This is an initial single-operator deployment; multi-account management, external identity provider integration, MFA, password recovery and role editing are extension points, not completed features. Never expose an endpoint that accepts a client-selected role. Add identities through a trusted identity adapter and resolve roles on the server.

| Role           | Read access                         | Write access             |
| -------------- | ----------------------------------- | ------------------------ |
| Super Admin    | All modules                         | All module policies      |
| Game Designer  | Dashboard, Configuration, Gameplay  | Configuration, Gameplay  |
| Content Editor | Dashboard, Content, Live Operations | Content, Live Operations |
| Analyst        | Dashboard, Analytics, Gameplay      | None                     |
| Support        | Dashboard, Players                  | Players                  |

Permissions follow `module:read` / `module:write`. Both backend handlers and frontend guards use server-issued permissions, with the backend independently checking each request against its own policy. Write permissions describe intended authority; only configuration draft creation is currently implemented. There is no frontend-only privileged action.

Login compares scrypt-derived password hashes, rotates sessions and uses a random opaque HttpOnly, SameSite=Strict cookie with an eight-hour expiry. Sessions remain in server memory and restart invalidates them. Invalid login attempts are throttled by socket address. Mutations require a custom header and same-origin browser requests; CORS is not enabled. Production adds Secure cookies. No credentials are logged or sent back in responses.

## API contract

All responses are JSON with no-store cache headers. Errors return `{message}` with 400/401/403/404/413/429/500. The client raises typed errors, reports notifications and invalidates expired sessions. UI supports initial loading, empty results, retryable errors and mutation success.

| Endpoint                                              | Purpose                                                         |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| POST /api/auth/login                                  | Server credential authentication                                |
| GET /api/auth/me                                      | Session user and permissions                                    |
| POST /api/auth/logout                                 | Invalidate session                                              |
| GET /api/dashboard                                    | Real admin-store count and API health; null unconnected metrics |
| GET /api/configuration                                | Persisted draft list                                            |
| POST /api/configuration                               | Validated draft creation with audit event                       |
| GET /api/system                                       | Last 100 configuration audit events                             |
| GET /api/{gameplay,content,liveops,players,analytics} | Explicit unconnected integration, empty items                   |

Configuration writes accept only name and integer maxWaves (1–1000); status is forced to draft regardless of client input. Data and audit events are persisted together using serialized atomic file replacement in `admin/.data/store.json`. No publish endpoint exists, so this store cannot change the game. Admin API operational status comes from the responding backend; it is not a claim about external game infrastructure. Dashboard telemetry uses null, displayed as an em dash, until connected. Published configuration count is scoped to the admin store.

## Deployment boundary

Serve `admin/dist` and `/api` under one HTTPS origin behind a trusted reverse proxy. Preserve the public Host and Origin headers for the origin check. Set NODE_ENV=production and inject credentials through your secret manager. Configure SPA fallback for frontend routes, never for `/api`. The server binds loopback and does not serve static files itself.

The local JSON store and in-memory sessions target a single process. Before multi-instance or public production operation, replace them with transactional database and shared session/rate-limit storage, add an identity provider, retention/backups and a centralized audit sink. Current audit history records draft creation only. Vite dev/preview servers are development tools. Integration modules need real domain repositories and backend permission checks before enabling their actions.

The root package, Vite configuration, `dist/`, game source and standalone HTML remain independent. Run root game tests using the existing root commands.
