# Live Operations

Live Operations lets an admin run the game's calendar without shipping a build: daily and weekly challenges, seasonal and random events, event rewards, announcements and feature flags. The **server owns the schedule**; the game downloads what the server published, checks it strictly, and plays with the built-in daily rotation whenever it cannot.

```
 Admin app (Live Operations)            Admin API (one process)                     Game (browser)
 ───────────────────────────            ───────────────────────                     ──────────────
 editor, schedule, flags      ──HTTP──▶  admin/server/liveops.mjs                    src/core/LiveOps.js
 history, generators                      lifecycle · conflicts · clock               download · validate · cache
                                          store.json (revision, events, history)      clock sync · flags · pin · rewards
                                                   │                                         ▲
                                                   └── GET /api/game-liveops/:env ──────────┘   (public, read-only)

 shared/live-ops/  time.js · contract.js · schedule.js   ← one implementation used by all three
```

`shared/live-ops/` is pure and isomorphic. The server validates with it, the admin app edits against it, and the game uses the same functions to decide what is live and whether a reward may be granted. The schema is strict (every field required, unknown fields rejected). Changing a field is a breaking change: bump `LIVEOPS_SCHEMA_VERSION` and release the game with it.

## Events

| Kind | Meaning | Window | Run types | Seeded |
| --- | --- | --- | --- | --- |
| `daily` | The daily challenge | one whole calendar day of the event's time zone (23–25 h on a DST day) | Daily | yes |
| `weekly` | The weekly challenge | Monday 00:00 to the next Monday 00:00 in its zone (167–169 h) | Weekly | yes |
| `seasonal` | A long overlay on ordinary runs | free window, 1 to 120 days | Endless and/or Story | no |
| `random` | A short surprise overlay | free window, 5 minutes to 72 hours | Endless and/or Story | no |

An admin configures, per event: name and description (plain text), time zone and start/end, an announcement (title, body, lead time, tone), eligibility, rules, and up to 8 rewards.

**Eligibility.** Run types, optional difficulties (empty = all), minimum Story levels cleared (0–5), and whether assisted runs may take part. Challenges are always their own run type and have one fixed difficulty, so scores stay comparable. An event never overrides the difficulty the player chose.

**Rules** (all optional; the neutral value changes nothing):

| Rule | Range | Effect |
| --- | --- | --- |
| `enemy.speedMultiplier` | 0.5–2 | ghost speed |
| `enemy.runes` | the five combat runes, repeats weight the pool | restrict which gestures ghosts carry (also removes heart, freeze and blast ghosts) |
| `enemy.noHearts` | bool | no healing ghosts |
| `spawn.intervalMultiplier` | 0.5–2 | time between spawns (smaller = denser) |
| `spawn.surpriseMultiplier` | 0–3 | how often golden ghosts, meteor showers, blood moons and heart festivals occur |
| `player.maxHp` | 0 (unchanged) or 1–5 | starting and maximum hearts |
| `score.multiplier` | 1–3 | points multiplier, needs score version 2 |
| `visual.theme`, `visual.ambient` | see below | colour wash and ambient particles |
| `scoreVersion` | 1 or 2 | 1 = classic score; 2 also applies `score.multiplier` |
| `seedSalt` | up to 32 chars | challenges only: re-rolls the ghost sequence |

Themes: `none frost ember twilight gold verdant blossom`. Ambient: `none snow embers stars petals sparkles`. Visual effects are decoration only; they are skipped on the low graphics tier (particles) and by `prefers-reduced-motion`.

**Story runs.** Story levels are authored, so a seasonal or random event never changes a Story fight: it contributes its look and its rewards only. A Story-only event is therefore restricted to visuals and rewards (the contract rejects anything else).

## Lifecycle

```
draft ──schedule──▶ scheduled ──(start time | activate)──▶ active ──(end time | complete)──▶ completed ──archive──▶ archived
  │ ▲                   │                                     │
  │ └───unschedule──────┘                                     │
  └─────cancel──▶ cancelled ◀──────────cancel────────────────┴── (also from scheduled)      cancelled ──archive──▶ archived
```

- Only a **draft** can be edited or deleted. Every save of a draft is a new **version**; unscheduling a scheduled event returns it to draft. A running event cannot be unscheduled or edited: cancel it and create another.
- **Time-driven transitions.** The server moves `scheduled → active → completed` by its own clock, on a 30-second timer and before every admin request, and records them in the history at the moment they were due (so a server that was down still writes the true history). The public schedule is computed on the server clock without writing anything, so it is correct even between ticks.
- **Idempotent activation.** An action whose result already holds (`activate` on an active event, a second `cancel`, the clock and an admin racing to activate) answers `200 {changed: false}`: no error, no duplicate history entry, no revision bump. Time-driven history entries have deterministic ids, so replaying a transition records it once.
- Daily and weekly challenges cannot be activated by hand: they start at their scheduled time.

## Scheduling and conflicts

- **Server-authoritative.** Times are authored as wall-clock values in an IANA zone and converted to UTC instants by the server. Published times are always `YYYY-MM-DDTHH:mm:ssZ`; offsets such as `+07:00` are rejected so a moment has one spelling.
- **Timezone-safe.** A wall-clock time that does not exist (spring-forward gap) or happens twice (fall-back overlap) is refused rather than guessed. Calendar days and ISO weeks are measured in the event's zone, so a day in `America/New_York` is 23 or 25 hours on a change, and a day in `Asia/Kolkata` starts at 18:30Z the evening before.
- **Conflict validation.** Checked when an event is scheduled and when it is activated, and again as one serialized write (two racing requests cannot both win):
  - *overlap*: one daily per day, one weekly per week, one seasonal and one random at a time;
  - *rules*: a seasonal and a random event that overlap and target the same run type are merged (multipliers multiply, `noHearts` is an OR, hearts take the smaller value, rune restrictions intersect). The pair is refused if no gesture is left, ghost speed leaves 0.4–3, the spawn interval leaves 0.3–3, or the score multiplier exceeds 5.

  Daily and weekly challenges are never modified by an overlay, so they cannot conflict with one. A scheduled event must end in the future.
- **Generators.** *Generate daily drafts* uses the built-in rotation as the starting point (the same twist a player gets offline) and skips dates that already have an event. *Generate random events* scatters short windows with a seeded generator (same seed, same schedule), keeps minimum gaps, stays inside allowed start hours, avoids DST gaps and never overlaps existing events. Both create **drafts**, which an admin reviews and schedules.

## Daily challenge: determinism and leaderboards

- **Seed.** `deriveSeed({kind, key, salt})`. With no salt a daily challenge gets exactly the seed the built-in rotation has always used for that date (`arcane-paws:YYYY-MM-DD`), so a friend playing offline and a player on the live schedule meet the same ghosts; a salt re-rolls the sequence. Weekly seeds are independent (`arcane-paws:weekly:YYYY-Www`). The rules version is deliberately not part of the seed.
- **Date and time zone.** The challenge key is the calendar date (or ISO week) in the event's zone. Without a live event the game falls back to the **UTC date**, as before.
- **Board id.** `daily:2026-11-14:r3:s2` = the daily of that date, rules version 3, score version 2. Two scores are comparable only when their board ids are equal. The built-in rotation is rules version 0 (`daily:2026-11-14:r0:s1`). The game keeps the best result per board id (`ProgressStore.recordBoard`) so a changed challenge starts a fresh board, and shared challenge links carry `board=` so a friend on other rules is told their scores are not directly comparable. There is no global leaderboard service yet; board ids are what any future one must key on.
- **Ranking.** Only the challenge of the moment is ranked and counts towards streaks and rewards. An older day opened from a friend's link is playable but unranked. Assisted runs are never ranked.
- **History.** The Events screen lists past events (completed and cancelled, kept in the payload for 14 and 7 days) and the player's own best score per board.

## Rewards

Two reward types, each with a condition `metric >= threshold` over the player's progress in that event (`runs`, `bestScore`, `bestWave`, `bestCombo`):

- **cosmetic**: a real, non-default trail or hat from the wardrobe (`trail:frost`, `hat:crown`); at most 4 per event. The item's name comes from the game, never from the server.
- **badge**: an icon of 1–8 characters and a name (up to 40 characters), shown in the Events screen.

**Claim validation** (`validateClaim`, run by the game before anything is granted) refuses a claim when: rewards are switched off, the clock was not confirmed by the server **in this session**, the event is unknown or **cancelled**, the version differs from the one the run was pinned to, the run started outside the event window, the claim arrives more than 10 minutes after the end, the numbers are not plausible (negative or above the caps), or the run was not eligible (mode, difficulty, story progress, **assisted**). A refused run does not count towards progress at all. Granting is idempotent: a reward is recorded once, ever (`eventId:rewardId`), however often the same run is settled. A run is settled once per pin.

A run is **pinned** when it starts: the event ids and versions it is subject to, plus the trusted-clock flag. A schedule update that arrives mid-run changes nothing about that run, and a claim for another version is refused.

> **What this does and does not protect.** The server is authoritative for *what is live*; it is not an anti-cheat service. Rewards are granted by the game from a locally saved result, so a player who edits their own save or code can grant themselves anything, exactly like configuration management (see [configuration-management.md](configuration-management.md)). The checks above stop honest edge cases (stale clocks, cancelled or re-versioned events, offline play, assisted runs) and a tampered payload. The save is also distrusted on load: granted rewards must still be real wardrobe items or well-formed badges, ids must be slugs, numbers are clamped. Server-side claims would need player accounts, which do not exist.

## Feature flags

Published per environment with a rollout percentage of installs (a stable per-install bucket, so raising the percentage never switches an install off). The game knows exactly these flags; an unknown one is refused.

| Flag | When off |
| --- | --- |
| `liveops.enabled` | master switch: the game ignores everything below and plays with the built-in daily rotation |
| `liveops.daily` | the daily challenge follows the built-in rotation |
| `liveops.weekly` | no weekly challenge is offered |
| `liveops.seasonal`, `liveops.random` | that kind does not apply to runs (and is hidden from the Events screen) |
| `liveops.announcements` | no event announcements |
| `liveops.rewards` | no reward is granted, and progress is not counted either |
| `liveops.effects` | events keep their rules but draw no special visual effects |

## Offline fallback

| Situation | Game behaviour |
| --- | --- |
| `VITE_LIVEOPS_URL` unset | nothing is ever requested; built-in daily, no weekly, no events |
| Server unreachable, 5xx, timeout (2.5 s) or invalid payload | keeps whatever schedule it already holds; otherwise the built-in rotation |
| Last good payload cached, still fresh | the cached schedule keeps working on the **clock offset measured at the last sync**; the clock is *not trusted*, so **no rewards** are granted |
| Cache older than `staleAfterSeconds` (default 24 h), saved "in the future", tampered with, or for another URL/environment | ignored: built-in rotation |
| Session left open past the freshness window | falls back to the built-in rotation until the next successful refresh |
| A response older than the held one (a CDN serving a stale copy) | rejected |

The cached schedule is applied synchronously at start-up and the network refresh is **not awaited**, so a slow server never delays the menu. It is refreshed when the tab becomes visible, every 5 minutes, and when the Events screen opens (never more often than once a minute). A payload is accepted **whole or not at all**: one invalid event, flag or field rejects everything.

The game's clock is the device clock corrected by the `serverTime` in the payload, so a wrong device clock does not shift the schedule.

## Admin UI

*Live Operations* in the admin app (Super Admin publishes; Content Editor prepares drafts; other roles have no access):

- **Schedule**: every non-archived event with its status (a stored status the clock has already moved on is marked), filters by kind and status, a timezone display toggle (event zone, UTC, browser), conflicts listed with the events involved, and per-event actions (edit, schedule, unschedule, activate, complete, cancel with a reason, archive, delete a draft) behind confirmations.
- **Event editor**: kind, id, presets, name/description, time zone and window (a day or week picker for challenges), announcement, eligibility, rules (including the gesture pool and the visual theme), rewards. A *preview* checks the content, resolves the UTC window and lists conflicts without saving. The server re-validates everything.
- **Daily & weekly**: coverage of the next 14 days. A day without an event shows the built-in rotation and its board (`r0·s1`); *Create draft* opens the editor prefilled with that day's built-in twist, and *New weekly challenge* starts a weekly.
- **Feature flags**: toggles and rollout percentages, with unsaved-change protection.
- **History**: every creation, save, transition (by an admin or by time), flag change and cancellation, newest first and paged (the API can also filter by event).

Every mutation needs the session, the `X-Admin-Request` header, a same-origin request, the caller's permission and the workspace `revision` (a stale one is a `409`: reload, compare, retry).

## API

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/game-liveops/:environment` | public | the schedule the game downloads: published events only (`scheduled`, `active`, `completed` within 14 days, `cancelled` within 7 days; at most 200), the flags, `serverTime`, `staleAfterSeconds`. No drafts, archive, authors or notes. `Cache-Control: no-store`. |
| `GET /api/liveops/environments/:env` | `liveops:read` | the workspace: events with versions, flags, conflicts, recent history |
| `GET …/history?eventId=&before=&limit=` | `liveops:read` | paged history |
| `POST …/preview` | `liveops:write` | validate unsaved content, resolve its window, find conflicts |
| `POST …/events`, `…/events/:id/save`, `…/events/:id/delete` | `liveops:write` | create a draft, save a new version, delete a draft |
| `POST …/events/:id/{schedule,unschedule,activate,complete,cancel,archive}` | `liveops:publish` | lifecycle |
| `POST …/flags` | `liveops:publish` | publish a full flag set |
| `POST …/generate` | `liveops:write` | create daily or random drafts from the deterministic generators |

Environments are an explicit allowlist (`development`, `staging`, `production`) and are isolated from each other. Request bodies are capped at 64 KiB. No CORS policy is added: serve the game and the admin API from one origin or behind a proxy, like the other public endpoints.

## Game integration

Build the game with:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_LIVEOPS_URL` | unset (feature off) | public endpoint, e.g. `/api/game-liveops/production` |
| `VITE_LIVEOPS_ENV` | `VITE_GAME_CONFIG_ENV` | environment name the payload must carry |

Where things live:

- `src/core/LiveOps.js` — `LiveOpsService`: download, validation, cache, clock, flags, challenge and overlay resolution, `pinRun`, `settleRun`, announcements.
- `src/core/Game.js` — `startDaily()` / `startWeekly()`, `_pinLiveRun()`, `_applyRunConfig()` (event rules reach `WaveSystem` as a modifier), `_addScore()` (event score rule), `finishRun()` (boards, streaks, settlement).
- `src/systems/EventSystem.js` — `setSurpriseScale()`; `src/systems/LiveOpsEffects.js` — the colour wash and ambient particles.
- `src/core/ProgressStore.js` — event progress, granted rewards and per-board bests, with strict loading; `src/core/Cosmetics.js` — an event reward unlocks its wardrobe item.
- `src/ui/MetaUI.js` — announcement banner, Events screen, daily screen additions, end-of-run reward lines. **Everything the server supplies (names, descriptions, announcements, reward labels) is set through `textContent` or escaped; it never reaches `innerHTML` unescaped.**

A run that is **continued from the Endless autosave** is not part of any event (it began under other rules), and neither is a **Boss Rush** run (it has its own board). An assisted run takes no overlay rules and earns nothing. A failure anywhere in live operations never stops a run from starting or finishing.

**Regular records stay comparable.** An ordinary Endless run under a seasonal or random event that changes the fight or the score (speed, spawn rate, surprise rate, hearts, gestures, no healing, score multiplier) does **not** update the Endless record, exactly like a daily run does not; the end screen says so. It still counts towards the event's own progress and rewards. A look-only event, and any Story run, leave the run fully ranked.

## Tests

```
npm test                        # game: tests/live-ops-contract.test.js (shared contract), tests/live-ops-client.test.js (client, UI, rewards, offline)
npm run test:admin              # admin: admin/tests/liveops.test.mjs (server), admin/tests/liveops-client.test.mjs (real server + real game client),
                                #        admin/src/LiveOpsPage.test.tsx (UI)
```

## Not in scope (yet)

A global leaderboard or any server-side score or claim endpoint; weekly challenge share links (a link carries a date, not a week); player segmentation beyond the rollout percentage; scheduling in the player's own time zone (events use absolute instants and are displayed in the player's zone).
