# Game configuration management

Open Game Configuration in Admin. Choose development, staging or production. The ten tabs expose typed fields with current published and saved draft values. Comparison shows the current working values against the publication; Reset to published only changes the working form. Save persists a draft. Field errors block saving, and invalid requests are independently rejected by the server. Navigation and page-close warnings protect unsaved work. Conflicts preserve working values: compare them, then reload before resubmitting.

## Lifecycle and permissions

Save draft → Validate → Mark reviewed → Publish. Each save invalidates previous validation/review. Game Designer can save and validate; Super Admin can also review, publish and rollback. The initial single-account architecture permits the same operator to review and publish; it does not enforce two-person approval. Publish and rollback require confirmation. Rollback selects a previous publication in the same environment, creates a new immutable publication, and clears the draft.

The rules preview computes a sample score and player damage using the shared contract. It is a deterministic calculator, not an interactive gameplay simulation.

## Contract and storage

`shared/game-configuration.js` defines schema version 1, required fields, types, ranges, defaults and preview calculations. Unknown fields, omitted values, nonfinite numbers and invalid types fail validation. Breaking changes require a schema bump and coordinated game deployment. Schema version differs from publication ID and workspace revision.

The existing authenticated Node API stores environment workspaces in `admin/.data/store.json`. Each workspace contains an integer revision, mutable draft, publication pointer and immutable publication history. Legacy name/maxWaves drafts remain isolated and cannot be published through the new lifecycle.

All mutations are serialized in a single process. Inside that serialization boundary, the API checks the caller's expected revision, validates the transition and commits the new state and audit record through one atomic file rename. A stale or missing revision returns 409. Publication IDs use random UUIDs. Audit events contain actor, environment, revision, time, publication reference, and saved values for draft edits. The System Administration page exposes the latest 100 audit records; the persisted history is retained.

This storage architecture supports **one server process on a local filesystem**. It is not a distributed database or tamper-proof audit sink. For multiple instances, replace the repository with database transactions, conditional revision updates and durable audit storage; also replace in-memory sessions/rate limits. Back up the data directory. Atomic rename prevents partial publication visibility but does not promise durability through power loss.

## API

- `GET /api/configuration/environments/:environment`: authenticated workspace/history.
- `POST /api/configuration/environments/:environment/save`: `{revision, values}`.
- `POST /api/configuration/environments/:environment/{validate,review,publish}`: `{revision}`.
- `POST /api/configuration/environments/:environment/rollback`: `{revision, versionId}`.
- `GET /api/game-config/:environment`: public published envelope only; returns 404 before first publication. Never exposes drafts, actors or audit history.

Authenticated mutations retain the existing session, origin and X-Admin-Request protections. No cross-origin CORS policy is added. Error responses use `{message}`; schema failures return 400, permission failures 403, revision/transition conflicts 409. Environments are an explicit allowlist, never a filesystem path.

## Game deployment

Remote configuration is opt-in at Vite build time:

```sh
VITE_GAME_CONFIG_URL=/api/game-config/production VITE_GAME_CONFIG_ENV=production npm run build
```

Route that public endpoint through the game's same-origin reverse proxy to the admin API. Keep authenticated admin routes protected by the existing session and authorization checks. For cross-origin delivery, configure an explicit read-only public delivery proxy; the server deliberately does not enable CORS for the admin API. These build variables contain no secrets.

At boot the game fetches once with a 2.5 second timeout and no credentials. Network errors, missing publications, unknown environments, schema mismatch or malformed values leave local behavior intact. There is no mandatory backend dependency. Omit the variables for a fully offline standalone export.

A run pins a deeply frozen configuration snapshot. Combat damage, scoring, combo decay, gesture minimum score, per-rune cooldowns and feature flags apply at run start. Difficulty speed values multiply the existing NORMAL/HARDCORE/INFERNO profiles. maxWaves caps Endless; Story keeps its authored five levels. Disabling Endless routes new runs to Story; disabling Practice prevents entry. Visual and accessibility values initialize player preferences only when no saved preference overrides them. Saved Endless runs include the pinned snapshot; incompatible snapshots are rejected, and older saves without configuration resume using local rules.

New publications affect future game loads and runs, never an active run. Refreshing publication delivery during a session is not currently polled. Existing local records remain local; remote configuration is not an anti-cheat system or an authoritative leaderboard.

## Verification

```sh
npm --prefix admin test
npm --prefix admin run test:ui
npm --prefix admin run build
npm test
npm run build
```

Integration tests cover strict schema validation, serialized conflicting writes, ordered transitions, role enforcement, environment isolation, version history, rollback, audit persistence, compatibility rejection, immutable snapshots and offline fallback. UI tests cover editing/reset/save revisions, unsaved notices, errors and hidden unauthorized publishing controls.
