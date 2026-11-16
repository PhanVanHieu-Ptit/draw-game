# Responsive layout implementation

The purple glass panels, antique gold trim, rune colors, typography and character artwork remain in place. The game now has a bounded arena with separate HUD and feedback docks. The arena uses logical CSS pixels; devicePixelRatio changes its rendering density. Its maximum desktop width is 1600px, including the surrounding docks.

## Layout changes

- Health, score, elapsed playing time, combo and controls share a grid. Narrow screens use two rows; short landscape screens use one row. Pause, help, mute, practice controls and alternative rune buttons have targets of at least 44px.
- The companion and upgrade status occupy their own row. Safe-area padding protects the arena and its controls. Canvas touch gestures stay blocked while menus retain native scrolling and browser zoom.
- Main-menu modes appear near the title. Container queries create a two-column menu on wider screens. Chapters, difficulty choices, companion cards, achievements, settings and other dialogs scroll within the available height without clipping their buttons.
- Practice has a four-by-two rune picker on narrow screens, an eight-rune row on wider screens, and an accuracy panel outside the drawing surface.
- ResizeObserver follows the actual arena. Resize cancels an interrupted stroke, relocates enemies and projectiles, preserves sprite proportions, and recomputes pointer mapping. Density changes preserve a stroke. Final-boss sizing is limited uniformly by short arenas.
- The admin shell, editors, tables, map viewport, navigation drawer and touch controls adapt to smaller containers. Oversized tables and the story map scroll within their panels. Form text uses 16px on touch screens. Viewport metadata supports keyboard-driven viewport resizing.

## Validation

Run after building both applications:

```sh
npm run build
npm --prefix admin run build
npm test
npm --prefix admin run test:ui
npm run test:responsive
node scripts/validate-browser.mjs --root dist --file arcane-paws-standalone.html --profiles desktop,laptop,tablet,mobile-small,mobile,mobile-landscape --out docs/responsive/interactions.json --assert 1
```

[results.json](results.json) records the game and admin matrix. [interactions.json](interactions.json) records keyboard navigation, native touch scrolling, all eight gesture shapes, pause/resume, focus containment and offline standalone play.

| Width checkpoint | Primary viewport | Rotated viewport |
| --- | --- | --- |
| 320 | 320 × 568 | 568 × 320 |
| 360 | 360 × 640 | 640 × 360 |
| 375 | 375 × 667 | 667 × 375 |
| 390 | 390 × 844 | 844 × 390 |
| 430 | 430 × 932 | 932 × 430 |
| 768 | 768 × 1024 | 1024 × 768 |
| 1024 | 1024 × 768 | 768 × 1024 |
| 1280 | 1280 × 800 | 800 × 1280 |
| 1440 | 1440 × 900 | 900 × 1440 |
| 1920 | 1920 × 1080 | 1080 × 1920 |

The duplicate tablet pair is run once: 18 distinct sizes for the game and 18 for the admin dashboard. Configuration, gameplay and story editors also run at 320, 768 and 1440px. Additional checks cover safe-area offsets, an interrupted stroke during resize, coordinate accuracy after resize and DPR changes, long score and combo content, six hearts, menu-button reachability, and all eight alternative rune targets. A reduced-height admin viewport simulates keyboard space and checks that a focused field remains reachable.

The 34 active game suites pass; three existing quarantined suites remain excluded. The admin UI suite passes all 28 tests. Both production builds pass.

`npm run test:admin` cannot complete its backend stage: the committed `admin/server/app.mjs` contains merge-conflict markers starting at line 7, and refers to a missing `throttle.mjs`. These are present in HEAD and were not modified by this layout change. Browser admin checks use read-only local fixtures and do not access an account or database.

These are headless Chrome checks with viewport and touch emulation, plus visual inspection of representative screenshots. They do not establish physical-device, Safari, system-edge-gesture or actual OS-keyboard behavior. Safe-area offsets and keyboard height are simulated; browser zoom remains available outside the canvas.

## Modified files

| Files | Purpose |
| --- | --- |
| `index.html`, `styles/responsive.css` (new) | Arena, HUD structure, responsive menus and dialogs, practice layout, safe areas and touch targets |
| `src/core/Game.js` | Arena observation, DPR changes, resize handling, entity relocation, practice placement and playing-time counter |
| `src/entities/Enemy.js` | Uniform final-boss fit for short arenas |
| `src/systems/PracticeSession.js` | Guide positioning within the reserved drawing surface |
| `src/ui/UIManager.js` | Timer rendering, health accessibility label and transition-banner cleanup |
| `admin/index.html`, `admin/src/main.tsx`, `admin/src/styles.css` | Keyboard viewport metadata, bounded drawer, responsive shell and editors |
| `tests/runtime-lifecycle.test.js` | Pointer offset/scaling, resized entities, dock changes and short-arena regression coverage |
| `scripts/validate-responsive.mjs` (new), `package.json` | Repeatable viewport matrix and npm command |
| `scripts/validate-browser.mjs`, `scripts/perf-bench.mjs` | Arena-based gesture checks, resize settling and browser-process cleanup |
| `arcane-paws-standalone.html`, `dist/index.html`, `dist/arcane-paws-standalone.html` | Refreshed tracked production artifacts |
| `docs/responsive/README.md`, `results.json`, `interactions.json`, `screenshots/*.png` (new) | Validation notes, machine-readable evidence and screenshots |

Representative screenshots: [desktop menu](screenshots/1440x900-menu.png), [small-screen gameplay](screenshots/320x568-playing.png), [landscape gameplay](screenshots/844x390-playing.png), [practice](screenshots/320x568-practice.png), [admin configuration](screenshots/admin-configuration-320.png).
