# Spell drawing and touch input verification

Verified on 20 November 2026. The recognizer's normal thresholds and template matching algorithm are preserved. The current default fixture result is **294/294**, including all 288 positive variants and six rejection fixtures.

## Behavior

- Pointer Events share one input path for mouse, touch and pen. The first primary contact owns a stroke; secondary contacts are ignored until they lift and begin a fresh primary contact. Pen side buttons, erasers and secondary mouse buttons do not draw.
- Coalesced samples are collected in chronological order. Duplicate aggregate samples are removed, the release endpoint is retained, and geometry is never interpolated or decimated for recognition. Input retains 8,192 samples plus one overflow sentinel; an excessively long stroke is rejected rather than silently changing its shape.
- Coordinates map from the canvas client rectangle into logical arena dimensions. Backing-store DPR never enters that mapping. Camera shake is restored before rendering ink, so the trail remains under the pointer.
- Ink appears on contact and ends at the current pointer. Independent visual samples use gentle quadratic smoothing, preserve sharp turns and apply 0.75-logical-pixel RDP simplification on long paths. Full, simple and minimal ink effects are available in Settings.
- Recognition and Practice scoring run in an inline worker, including the single-file export. Work is queued in order. Unsupported/blocked/failed workers use bounded recognition after yielding the event handler. A watchdog retries unresponsive work once through that fallback. Cancellation, reset and destruction invalidate queued cast callbacks.
- Pointer cancellation, capture loss, page blur/hide, viewport scrolling, resizing and rotation discard the interrupted stroke without casting. Capture failure has a window-level move/release fallback. All installed listeners and worker jobs are cleaned up on destruction.
- Modern Pointer Events browsers use `touch-action: none` without redundant scroll-blocking Touch Event handlers. The arena owns touch scrolling/zoom gestures; menus retain native touch scrolling and browser zoom. Rotation keeps the existing gameplay pause/resume countdown, then enables drawing with a fresh coordinate mapping.
- Feedback remains in the existing HUD: a name/symbol and labeled match percentage for recognition, `?` plus text for ambiguity, and `×` plus text for rejection. Match percentage is template similarity, not a calibrated probability. Existing optional mistake hints and guides remain available.
- Keyboard shortcuts 1–8 and the on-screen rune pad retain the existing alternative-input setting and single-activation path. Easy/strict recognition now shifts class-specific floors as well as the global floor. Normal defaults are unchanged. The OS reduced-motion preference defaults to reduced drawing effects and disabled screen shake; players can override it.

## Automated coverage

`npm test`: **36/36 active suites pass**; the repository's three pre-existing quarantined suites remain excluded.

`npm run test:gestures` includes:

- 360 complete pointer strokes: all eight gestures × mouse/touch/pen × five viewport/backing-density combinations × three speed/sample schedules. Every stroke maps to its logical points within floating-point tolerance and produces exactly one callback, including duplicate/bubbled releases.
- All 294 existing fixtures executed by the actual worker module in a Node worker, with bit-for-bit parity against synchronous recognition. Practice scores, sensitivity changes, custom templates, concurrent requests, worker failure, fallback and shutdown are also covered.
- Coalescing/deduplication, isolated pointer ownership, release endpoints, all interruption paths, post-interruption recovery, stale callback rejection, visual endpoints/corners, reduced-effects settings, listener cleanup and input outside a canvas without capture.
- Practice target changes invalidate pending results; combat camera transforms do not affect ink.

`node scripts/validate-browser.mjs --root dist --file arcane-paws-standalone.html --assert 1`: all five profiles pass the existing interaction checks, including all eight gestures, keyboard/button activation, native menu scrolling, focus, pause/resume and no runtime errors. The offline export casts successfully with networking disconnected and requests only the HTML and its embedded worker blob. Raw evidence: [browser interactions](performance/input-interactions.json).

`npm run test:input:browser`: the expanded real-Chrome matrix checks mouse, touch and emulated pen; portrait and landscape; fast and slow sampling; exact cast counts; logical alignment; no arena/page scrolling; native touch cancellation; multi-touch ownership; drawing after rotation/resume; Practice scoring; and an active worker. Raw evidence and timing distributions: [pointer input](performance/pointer-input.json).

## Browser measurements

The isolated final run completed **104/104 gesture matrix cases**, plus single-cast multi-touch and Practice worker-scoring checks. No duplicated or lost recognition callbacks or logical alignment errors were observed. The [final smoke test](performance/input-final-smoke.json) additionally confirms keys 1–8, touch scrolling prevention, and an active worker casting offline in the rebuilt export.

| Profile | Gesture cases | Max alignment error (logical px) | Event → ink p50 / p95 (ms) | Worker round trip p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| desktop | 24 | 0.00 | 16.2 / 17.8 | 17.4 |
| laptop | 8 | 0.00 | 16.6 / 17.9 | 19.6 |
| tablet | 32 | 0.00 | 16.7 / 67.3 | 18.2 |
| mobile | 24 | 0.00 | 66.3 / 67.5 | 17.5 |
| mobile-landscape | 16 | 0.00 | 48.6 / 50.4 | 17.3 |

All five profiles used an active worker. Tablet/phone profiles also passed cancellation recovery; phone portrait passed multi-touch and rotation/resume recovery. CPU/GPU details and complete timing distributions are preserved in the JSON report. No physical-device latency improvement is inferred from these emulation measurements.

## Measurement limits

The browser harness measures pointer-event timestamp to canvas draw submission, including event delivery, frame scheduling and scene rendering. Worker round-trip timings include messaging and scheduling, not just template matching. Neither measurement includes display scanout or physical sensor latency. Profiles emulate viewport size, DPR and touch/pen event delivery on desktop Chrome; they are not physical phones or styluses. Reserved OS edge-navigation gestures and Safari/iPadOS stylus behavior still need physical-device checks. No production false-positive rate is inferred from this small deterministic fixture set.

Rebuild with `npm run build` to refresh all three tracked single-file distributions. Screenshots from validation are available under `docs/performance/screenshots/` and `test-results/`.
