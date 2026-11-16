# Arcane Paws performance and accessibility audit

Audit date: 2026-11-15. Implementation plan: [PLAN.md](PLAN.md).

## Scope and baseline

The baseline is a fresh build of the working tree present at the start of this task, **including its existing uncommitted changes**. Those already added audio request deduplication/backoff, sequential audio loading, nonblocking fonts, duplicate-asset removal, canvas labels, some modal focus handling, and reduced-motion shake defaults. They were preserved and are not counted as new before/after improvements. The old tracked distribution was stale; it was not used as the baseline. No admin source was changed.

The game uses ES modules, Canvas 2D, procedural geometry, image sprites, and DOM overlays. React is confined to the separate admin application. No framework migration or new runtime/testing dependency was introduced.

## Implementation audit

| Area | Observed implementation and disposition |
| --- | --- |
| Scheduling | One bound `requestAnimationFrame` loop, delta capped at 50 ms, plus separate story/victory illustration loops. Previously an active pause still painted the arena ~60 times/second. It now retains its frozen arena pixels and invalidates them on state, size, quality, or settings changes. Hidden-page frame requests are cancelled; visibility/pageshow restart one chain. Start is idempotent. |
| Rendering | Existing adaptive high/medium/low tiers cap DPR and lightmap resolution, cache backgrounds at lower tiers, and cache enemy glows. Full-scene Canvas raster and recording work matter more than JavaScript time in the burst scenario. Existing effects and tier controls remain available. |
| Particles | Fixed pools: 800 desktop / 380 mobile, with lower-tier budgets. Common glowing particles previously blurred each fill every frame. Their shapes, colours and bright cores now share DPR-aware raster sprites, with quarter-pixel size bins and at most 256 retained entries. Expanding rings and unsupported contexts keep the vector path. Counts, lifetimes and simulation are unchanged. |
| Gesture pipeline | Pointer capture, primary-pointer filtering, coalesced samples, cached coordinate mapping, bounded raw stroke storage, 32-point resampling, and template/geometric recognition. The recognizer, templates, thresholds and all eight gestures are unchanged. The three visual glow layers reuse one traced path. A density-only resize preserves the active stroke; logical-size changes cancel and release it safely. |
| Audio | Web Audio unlocks on interaction, uses four local audio sprites plus procedural fallbacks and an embedded cat voice. Existing in-flight deduplication, retry backoff and sequential loading remain. File mode now skips doomed local-track requests entirely. Hidden suspension and resume behavior remain covered by tests. |
| Loading | HTTP sprites use own-origin assets; optional web fonts were already nonblocking. The hosted build retains these. Standalone copies omit font links and immediately use the existing procedural character/soundtrack instead of trying local sprite/audio paths. No media was deleted by this optimization. |
| Persistence | Guarded localStorage stores settings, records, achievements, progression and saved Endless runs. Progress is mostly held in memory and saved at meaningful boundaries; there is no new per-frame storage write. Modes, difficulty, progression and ranking rules were preserved. |
| Responsive UI | Existing safe-area padding, dynamic viewport units, short-landscape rules and scrollable cards remain. Arena-only touch suppression allows document zoom; modal touch policy explicitly allows vertical panning/pinch. Settings range controls now have a 44 px hit area while retaining their thin visible tracks. DPR policy updates with viewport changes. |
| Navigation/accessibility | Existing dialog semantics and opener restoration are retained. A real Tab/Shift-Tab boundary guard supplements `inert`. Rune buttons now accept keyboard/assistive clicks while pointer presses still cast immediately once. Global shortcuts ignore held repeats, composition and Ctrl/Alt/Meta combinations, and respect focused controls. Returning to gameplay focuses the arena. |

## Prioritized issues

| Priority | Evidence | Action / status |
| --- | --- | --- |
| P1 | Desktop particle stress: 18.8 FPS, 100 ms frame p95; 5K backing-store case: 10.3 FPS. Low JS time alongside missed frames points to raster/encoding pressure, not recognition. | Bounded particle sprite cache implemented; high-quality effects retained. |
| P1 | Paused desktop still rendered ~60 Hz and used 12.3% main-thread busy time. | Retain frozen arena frame; suppress hidden scheduling; preserve explicit resume and countdown. |
| P1 | Native browser checks reproduce missing keyboard rune activations and Tab escaping dialogs. Repeated P also toggled pause. | Native button activation, focus containment, shortcut guards and arena focus implemented. |
| P1 | Zoom disabled by viewport metadata and ancestor touch policy. | Remove zoom restriction; keep canvas drawing gesture suppression local. |
| P2 | File-mode load attempted 12 sprite URLs; fonts and later audio added further external attempts. | Standalone now starts and plays with only its HTML request. |
| P2 | Density changes during an adaptive downgrade must not interrupt a drawn spell. | Separate logical resize cancellation from DPR-only changes; regression test added. |
| P2, remaining | High-resolution recording and full-scene raster still consume substantial CPU. Fixed pools also shift entries when exhausted. | Existing highlight switch and quality tiers remain available; no unverified pooling/recording rewrite. |

**Refined finding:** source inspection initially suggested the global touch policy blocked card scrolling. Real Chrome touch swipes showed that existing scrollable cards already worked. Both builds scroll in that browser; restoring zoom and scoping Safari gesture cancellation are the supported changes. Safari behavior was not tested.

## Measurement method

Real local headless Chrome on Apple M4, 10 cores, 32 GB RAM. Exact browser/OS/GPU metadata is in the JSON evidence. A real browser drives the actual production game through DevTools, using Node's built-in WebSocket. This is **viewport/touch/CPU emulation, not physical-device testing**.

The 54 frame scenarios span desktop 1440×900 @2, laptop 1366×768 @1, tablet 820×1180 @2, phone 390×844 @3, phone landscape 844×390 @3, desktop 2560×1440 @2 and 3840×2160 @1; selected CPU rates are native, 4× and 6×, with adaptive and fixed lower tiers. Backing-store DPR still follows the game's caps. Each frame sample uses 2–3 seconds of warmup and approximately 5 seconds of sampling. Enemy positions/counts and event rate are controlled; particle randomness is not seeded. Main-thread busy percentage comes from Chrome task duration; renderer CPU includes workers/encoding and may exceed 100% of one core.

FPS is measured from animation-frame intervals, **not** update/render JS execution time. Input latency is pointer timestamp to completion of the next game render's drawing commands, **not** hardware-to-photon latency. Long tasks, long animation frames, event timing, JS heap, DOM/listener counts, style/layout cost, and CPU counters are retained in the raw results. A 45-second post-GC soak is a short diagnostic, not proof of a leak-free long session.

Load results are medians of three fresh pages with HTTP text gzip, disabled browser cache, and optional fonts intercepted with a deterministic empty CSS response (300 ms delay). The phone network profile uses 150 ms latency and 1.6 Mbps down, plus 4× CPU throttling. Actual web-font transfer/appearance, WAN variability and physical phones are not measured. The load harness was corrected to collect buffered paint results after settling; use `before-load.json` instead of the early paint fields in `before.json`.

## Results

All 54 frame scenarios completed in each build. These are observed samples, not FPS guarantees or statistical confidence intervals.

| Metric / scenario | Before | After |
| --- | ---: | ---: |
| Desktop particle stress, FPS | 18.8 | 59.8 |
| Desktop particle stress, frame p95 | 100 ms | 16.7 ms |
| Desktop particle stress, ending adaptive tier | low | high |
| Desktop 4× CPU particle stress, FPS | 39.1 | 59.7 |
| 5K backing-store particle stress, FPS | 10.3 | 59.8 |
| 5K backing-store particle stress, frame p95 | 116.7 ms | 16.8 ms |
| 4K particle stress, FPS | 39.0 | 59.8 |
| Desktop drawing, FPS | 46.7 | 59.7 |
| Desktop event-to-stroke-command latency, p95 | 41.3 ms | 17.8 ms |
| Phone 4× CPU drawing, FPS | 59.8 | 59.9 |
| Phone 4× CPU event-to-stroke-command latency, p95 | 53.5 ms | 53.0 ms |
| Desktop paused main-thread busy | 12.3% | 3.5% |
| Desktop paused game render rate | 60.1/s | 0.0/s |
| Worst recognition p95, native / 4× CPU | 0.2 / 1.1 ms | 0.2 / 0.9 ms |
| HTTP desktop FCP, median | 116 ms | 120 ms |
| HTTP phone slow-4G + 4× CPU FCP, median | 1316 ms | 1328 ms |
| Standalone phone FCP, median | 356 ms | 340 ms |
| Standalone load requests / failed requests | 14 / 12 | 1 / 0 |
| HTTP initial transfer, rounded KiB | 823 | 824 |
| Hosted HTML raw bytes | 725,874 | 729,573 |
| Hosted HTML gzip-9 bytes | 193,239 | 194,445 |
| Standalone HTML raw bytes | 725,874 | 729,049 |

Rendering improves most in the targeted desktop effects cases. Phone/tablet rendering was already near 60 FPS, and touch latency is essentially unchanged. Ordinary HTTP first paint is comparable; this work adds about 1.2 KB gzip to the hosted HTML. No broad load-time or phone-latency improvement is claimed. The desktop burst samples report zero main-thread long tasks in both builds despite their different frame pacing, supporting the raster/encoding diagnosis.

Higher FPS with the high tier retained can increase total CPU: desktop native particle renderer CPU rose from 100.5% to 171.6%, and 5K from 328.8% to 531.2%. Those counters include recording/raster workers. This is a throughput/quality improvement, not a measured battery saving. Pausing does reduce arena work and main-thread busy time; CSS and the benchmark's own frame observer still run.

The 45-second soak's post-GC JS heap moved 3.26→3.62 MB before and 3.34→3.69 MB after; fitted growth was 0.546→0.530 MB/min. DOM nodes moved 2289→2270 versus 2290→2296; listeners 157→163 versus 159→169. These short traces do not establish a memory improvement or rule out a leak. The new cache's retained entry bound is tested separately; GPU/audio/native memory was not measured.

Full raw evidence:

- [Original baseline, frames/recognition/soak](before.json)
- [Corrected baseline load measurements](before-load.json)
- [Optimized frames/recognition/soak and load](after.json)
- [Complete comparison, using corrected baseline load data](comparison.txt)
- [Build sizes and SHA-256 fingerprints](build-sizes.json)
- [Baseline interaction checks](before-interactions.json)
- [Optimized eight-gesture browser interactions](after-interactions.json)
- [Final responsive/control checks](after-ui-final.json)
- [Automated suite report](test-results.json)
- [Gesture evaluation](gesture-evaluation.json)

## Validation and limits

At baseline, all 32 active game suites passed. After implementation, all 34 active suites pass, including the added runtime lifecycle and particle-cache suites. The three existing quarantines remain unrun: `center-cat-boss-tutorial`, `boss-minions-and-scary-face`, and `monster-sounds`. Gesture evaluation passes **294/294** positive and rejection fixtures. Existing mode, boss, combat, progression, audio, responsive and rendering suites remain active.

Real Chrome interaction checks pass across desktop, laptop, tablet, portrait phone and landscape phone: dialog entry/exit/focus containment, keyboard and pointer rune activation, all eight gestures through real pointer streams, unchanged health during pause, no redundant paused arena paints, held-key protection, countdown/focus on resume, and no runtime errors. Native touch swipes moved Settings by 238, 229 and 231 CSS px on tablet, phone and landscape phone respectively. The disconnected `file://` run enters PLAYING, recognizes a cast, runs an audio context, and makes only its HTML request. Audible output was not listened to.

An additional 320×568 phone viewport is included in the final control/layout checks. Screenshots were visually inspected: [portrait menu](screenshots/mobile-menu.png), [320 px Settings](screenshots/mobile-small-settings.png), [landscape Settings](screenshots/mobile-landscape-settings.png), [high-tier particles](screenshots/desktop-particles.png), [offline standalone](screenshots/standalone-offline.png).

Remaining limits: no Safari/Firefox or physical-device, thermal, battery, screen-reader, switch-control or full WCAG conformance testing; no GPU/audio-buffer memory accounting or long-duration leak proof. Real-time enemy positions/rune queues are still primarily visual, so a canvas label and alternative buttons do not make the entire game nonvisually playable. Legacy tutorial/share-card/ending overlay focus paths warrant a separate accessibility pass. The existing frame loop can still stop after an uncaught update/render exception. Config/story URLs, when opted in at build time, are awaited before startup with individual timeouts; this measurement used the local-content default. HTTP deployment still needs a network/cached response for a cold reload; standalone is the tested offline distribution. No service worker or asset-content policy change was introduced.

## Reproduction

Run `npm run build` to refresh the tracked distributions, then `npm test`, `npm run test:browser` and `npm run perf:browser -- --matrix full --seconds 5 --only load,frames,recognize,soak --soak 45 --out after.json`. The full default benchmark also has optional audio loading scenarios; audio readiness/decoded-buffer timing was not measured in this comparison.

Compare the saved evidence with:

```sh
node scripts/perf-bench.mjs --compare docs/performance/before.json docs/performance/after.json --baseline-load docs/performance/before-load.json
```

Vite build and standalone export pass. Vite retains its existing warning about the ignored `inlineDynamicImports` option. Tracked distribution files were refreshed; removal of duplicate root assets in the distribution reflects the asset removals already present in the initial working tree.
