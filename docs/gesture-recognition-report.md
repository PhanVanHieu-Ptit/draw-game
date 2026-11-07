# Gesture recognition evaluation

Measured 2026-11-07 with Node v22.22.3 on the development machine. Results describe synthetic fixtures, not a human usability study or a mobile frame-rate guarantee.

## Baseline and decision

The baseline at `fec3cf1c5b08cf131d5c2d7d5580f0b5441a325b` already uses arc-length resampling, bounding-box normalization, directional template distance, and geometry gates. Retain that algorithm. Orientation remains significant: rotating a horizontal line must not turn it into a vertical spell. Templates permit reversed strokes; circles support both windings and several start positions.

Observed weaknesses:

- Geometry indexed point 31 even when pointCount changed; geometry distances assumed boxSize 100.
- Reversing an inward spiral does not produce the independently generated outward template. Three noisy reversed variants failed.
- Broad global acceptance admitted a half-circle as V and a square as circle. Candidate scores had no runner-up separation requirement.
- Practice scored the same stroke twice. Invalid coordinates and excessive input had no explicit rejection.
- Input could mix pointer IDs, omitted release coordinates, and recognized cancelled strokes. Low-sample strokes could be mistaken for taps regardless of distance.

Changes keep the baseline matcher, add reversed spiral templates, class-specific score floors, a configurable margin between distinct geometrically valid candidates, and canonical geometry units. Resampling remains independent of event timing. Mouse, touch, and pen use the same Pointer Events path with coalesced samples and pointer ownership. Recognition runs on release, never every frame. Samples retained by input are bounded to approximately 2,048; drawing already strides long trails. Practice analysis is reused.

## Accuracy

Fixtures contain 288 positive strokes: eight shapes × three scales (35%, 100%, 400%) × three sampling densities × both traversal directions × clean/noisy input. Deterministic noise is relative to shape size. Timestamps and event density vary to simulate drawing speed. Negative fixtures cover diagonal/incomplete angle, half-circle, retraced line, tap and square. Full existing tests additionally cover open circles, different circle start points, spiral winding and bolt variants.

| Metric | Baseline | Improved |
| --- | ---: | ---: |
| Correct classification including rejection | 289/294 (98.30%) | 294/294 (100%) |
| Positive recognition | 285/288 | 288/288 |
| False negatives / wrong positive labels | 3 | 0 |
| Negative false positives | 2/6 | 0/6 |

Seven classes scored 36/36 at baseline; spiral scored 33/36. All eight now score 36/36. Rejected baseline false positives had similarity 0.715 (half-circle → V) and 0.761 (square → circle); the new 0.78 floors reject these while preserving tested valid strokes. These floors are tuned on this fixture set: unseen human strokes may need different settings. A half-circle can legitimately be intended as a rounded V; the default favors distinct angular shapes.

Regression tests also cover nondefault pointCount/boxSize, immutability, invalid values, resource limits, ambiguous templates, configurable thresholds, a single Practice analysis, pointer isolation/cancellation, release coordinates and replay. Ambiguity rejection compares different spell classes, never variants of the same spell.

## Performance

After 500 warm-up calls, time 3,000 individual recognitions using `performance.now()`, with the same fixture schedule for both versions. Compilation is excluded and happens once at construction. Allocation/GC and host scheduling are included in call timings.

| Recognition latency (ms) | Baseline | Improved |
| --- | ---: | ---: |
| Median | 0.062 | 0.095 |
| p95 | 0.134 | 0.176 |
| p99 | 0.196 | 0.241 |
| Maximum | 0.382 | 0.431 |

Added comparisons cost about 0.033 ms at median on this machine. Measurements fit comfortably within a 16.7 ms frame budget here. Browser/device profiling with real stylus and touch input is still needed to establish mobile frame pacing. This benchmark does not time Canvas rendering or browser event dispatch.

## Configuration and API

```js
const engine = new GestureEngine({
  minScore: 0.65,
  thresholds: { caret: 0.78, v_shape: 0.78, circle: 0.78 },
  minMargin: 0.025,
  minPathLength: 15,
  pointCount: 32, // integer 8..256
  boxSize: 100,
  oneDThreshold: 0.25,
  maxInputPoints: 8192
});
```

The effective class threshold is `max(minScore, thresholds[class] ?? 0)`. `setSensitivity()` still updates the global floor; class floors stay in force and may be explicitly overridden. Length is in logical canvas units; InputHandler maps CSS/client coordinates to logical dimensions without using device pixel ratio. Shape matching removes translation and scale. Strokes shorter than the logical-unit minimum remain deliberate accidental-touch rejections.

`recognize()` preserves `gesture`, `score`, `candidate`, `reason`, and adds `confidence` (same normalized similarity as score) and `margin` (best minus runner-up score). Confidence is a similarity measure, not a calibrated probability. New rejection codes are `ambiguous`, `invalid_input`, and `too_complex`; existing geometry and low-score codes remain. Vietnamese feedback uses the existing miss-hint setting and guide overlay.

Practice includes an accessible replay button and R shortcut. Replay progressively traces the captured stroke; the existing template toggle and miss guides show the intended shape and drawing direction. `inputHandler.replayLastStroke()` is also available programmatically. Keyboard spell casting and on-screen rune buttons continue to call the existing assisted-casting path.

## Reproduction and validation

- `npm run test:gestures`: new fixtures/input regressions and existing 21 gesture tests pass.
- `npm run evaluate:gestures`: writes `tests/fixtures/gesture-evaluation.json`.
- `node scripts/evaluate-gestures.js --baseline`: loads the frozen Git revision and writes `tests/fixtures/gesture-baseline.json`; requires that revision in local history.
- `npm run build`: passes and refreshes the standalone exports.
- `npm test`: gesture tests and other suites run; the engagement suite reports one failure, “ghosts generated during a blood moon are faster,” in unchanged WaveSystem behavior. That suite reports the failure without a failing process exit code, so console output must be inspected.

The small rejection set cannot establish production false-positive rates. Gather anonymized, consented human stroke fixtures across devices before tightening additional geometry rules or changing recognizer families.
