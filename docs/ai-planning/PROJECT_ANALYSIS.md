# PROJECT ANALYSIS

Phân tích trạng thái repository `draw-game` tại nhánh `content-management`, commit `d101898`, ngày **2026-11-10**. Working tree sạch khi bắt đầu; giai đoạn phân tích **không sửa business code** (chỉ thêm `docs/ai-planning/`). Mọi con số bên dưới lấy từ lệnh đã chạy thật (mục 9) hoặc đọc trực tiếp từ source — chỗ nào chưa xác minh được thì ghi rõ.

Tài liệu liên quan: [REQUIREMENTS](./REQUIREMENTS.md) · [GAP_ANALYSIS](./GAP_ANALYSIS.md) · [ARCHITECTURE](./ARCHITECTURE.md) · [RISKS](./RISKS.md) · [ROADMAP](./ROADMAP.md) · [SPRINT_PLAN](./SPRINT_PLAN.md).

## 1. Tóm tắt điều hành

**Sản phẩm.** *Arcane Paws* (tên hiển thị trong UI: "Magic Cat Academy: Arcane Paws") là game phòng thủ theo wave chạy trên trình duyệt: người chơi dùng chuột/cảm ứng vẽ ký hiệu (rune) để diệt u linh. Repo gồm ba phần: (1) **game** (JavaScript thuần + Canvas 2D + Web Audio, build ra một file HTML), (2) **Admin Control Center** (React + Ant Design + API Node), (3) **`shared/`** (hợp đồng dữ liệu dùng chung giữa game, API và SPA).

**Tình trạng.** Phần lõi game đã trưởng thành và được test dày (≈ 1.065 assertion, 22 script + 3 suite chạy riêng xanh). Admin đã có xác thực/RBAC, vòng đời cấu hình, Story CMS và Gameplay Studio, với 19 test backend + 10 test UI xanh và typecheck sạch. Build tất định và game khởi động đúng trong Chrome thật. Khoảng trống chính nằm ở **tích hợp, độ tin cậy của cổng chất lượng, bảo mật nội dung và tuân thủ IP**, không phải ở tính năng lõi.

**Mười vấn đề quan trọng nhất** (chi tiết và bằng chứng: [GAP_ANALYSIS](./GAP_ANALYSIS.md)):

| # | Vấn đề | Mức | GAP |
|---|---|---|---|
| 1 | Gameplay Content do Admin xuất bản **không có consumer nào ở game** (grep 0 kết quả) — tính năng lớn nhất còn thiếu | Cao | GAP-101 |
| 2 | `npm test` **đỏ ~1/3 số lần** (36/105 lần đo gộp) do test flaky; 1 test "xanh giả"; 6 file test nằm ngoài cổng (3 hỏng); **không có CI** | Cao | GAP-307/308/309/201 |
| 3 | Ba lỗi Admin **tái hiện được bằng server thật**: 413 với tài liệu > 16 KiB, hỏng UTF-8 khi body chia chunk, Analyst nhận 403 | Cao | GAP-301/302/303 |
| 4 | Sink **XSS**: văn bản từ Story CMS vào `innerHTML` (`UIManager.js:843`) | Cao | GAP-304 |
| 5 | **Rủi ro IP**: asset audio/sprite ghi chú "trích từ Google Doodle", URL dự phòng tải trực tiếp từ google.com, tên "Magic Cat Academy" | Cao | GAP-310/401 |
| 6 | Vệ sinh repo: **`node_modules/` (327 file, 31 MB) bị track**, không có `.gitignore` gốc, 3 bản bundle trùng được commit | Trung bình | GAP-306/311 |
| 7 | GDD v1.0.0 **lệch code** (8 rune thay vì 6, công thức/số liệu, DDA, độ khó) | Trung bình | GAP-102 |
| 8 | Admin chưa sẵn sàng production (JSON store, session in-memory, 1 tài khoản, không artifact triển khai) | Trung bình | GAP-110/114 |
| 9 | Lõi game khó bảo trì: `Game.js` 3.322 dòng, `updatePlaying` ~517 dòng, test dùng fake-context | Trung bình | GAP-113 |
| 10 | **Vòng lặp game không chịu lỗi**: một ngoại lệ ở `update()`/`render()` dừng game vĩnh viễn (đã tái hiện tất định); không có handler lỗi toàn cục; Admin SPA không có ErrorBoundary | Trung bình | GAP-312/204 |

**Kế hoạch.** 65 task / 12 epic / 8 sprint (168 SP đã xếp + 21 SP parking lot; kế hoạch v1.2.0) và 10 quyết định cần chủ dự án — xem [ROADMAP](./ROADMAP.md) và [SPRINT_PLAN](./SPRINT_PLAN.md). Sprint nên làm đầu tiên: **Sprint 0** (không chờ quyết định nào).

## 2. Phạm vi, phương pháp và giới hạn

**Đã làm:** đọc cấu trúc, cấu hình và tài liệu; đọc source các module quyết định (Game, WaveSystem, CombatSystem, Constants, RemoteConfiguration, toàn bộ `shared/` và `admin/server/`, các trang admin); chạy test/build/typecheck; smoke test trong Chrome thật; viết script tái hiện lỗi (lưu tại [`evidence/repro-admin-bugs.mjs`](./evidence/repro-admin-bugs.mjs)).

**Cố ý KHÔNG làm** (và lý do):

- **Không đọc `admin/.env`** — quy tắc `.agent/rules/terminal-safety.md` ("Do not read .env files or private keys"). Hệ quả: không biết cấu hình credential thực tế; không ảnh hưởng kết luận.
- **Không chạy `npm run build` / `npm run evaluate:gestures`** — chúng ghi vào file đang được track. Thay bằng build ra thư mục tạm (`vite build --outDir <tmp>`).
- **Không chạy `vite` dev** — theo ghi chú của dự án, nó ghi đè `node_modules/.vite/deps/_metadata.json` (file đang bị track).
- **Không audit phụ thuộc** (cần mạng) → ghi `UNKNOWN` (GAP-405).
- **Không thử trên thiết bị thật, không nghe âm thanh, không mở Admin SPA trong trình duyệt** → các mục tương ứng là `UNKNOWN` (GAP-402/403/404).
- Script thử nghiệm tạm nằm **ngoài repo** (scratchpad); chỉ script tái hiện lỗi được đưa vào `evidence/`.

**Cách đọc mức tin cậy:** "đã chạy" = có lệnh và kết quả ở mục 9; "đọc source" = xác nhận bằng đọc code nhưng chưa thực thi; "UNKNOWN" = chưa đủ dữ liệu.

## 3. Công nghệ

| Thành phần | Công nghệ | Ghi chú |
|---|---|---|
| Game | JavaScript ES modules thuần, Canvas 2D, Web Audio API | Không framework; `index.html` 939 dòng + `styles/main.css` 4.364 dòng |
| Build game | Vite 8.3.5 + `vite-plugin-singlefile` 2.3.4; pnpm 10.33.0 | Ra một file HTML ~667 kB (gzip 175,8 kB) |
| Admin SPA | React 19.1, Ant Design 5.27, react-router-dom 7.9, TypeScript 5.9 (strict), Vite 7.1 | Một chunk JS 1.382 kB (gzip 434,7 kB) |
| Admin API | Node `http` thuần + `node:crypto` (scrypt), lưu `admin/.data/store.json` | Không framework; loopback; một tiến trình |
| Test game | Script Node tự viết (`assert` thủ công hoặc `node:assert`), mock DOM tối giản | Không có test framework; không có coverage |
| Test admin | `node --test` (backend), Vitest 5.1 + Testing Library + jsdom (UI) | |
| Môi trường | Node v22.22.3, npm 10.9.8, pnpm 10.33.0 | Không có `engines`/`.nvmrc` (GAP-115) |
| Lịch sử | 27 commit (không merge) + 26 PR gộp, 2026-10-31 → 2026-11-10 | ≈ 2,5 commit/ngày; mỗi nhánh tính năng ≈ 1 PR |

## 4. Cấu trúc repo và quy mô

| Đường dẫn | Vai trò | Quy mô (dòng) |
|---|---|---|
| `src/core/` (17 file) | Game, Constants, StateMachine, ProgressStore, Settings, RunSave, Challenge, Lore, StoryScenes/Director, Spells, Upgrades, Companions, Cosmetics, Achievements, RemoteConfiguration | `Game.js` 3.322; `Constants.js` 822; `ProgressStore.js` 696 |
| `src/systems/` (13) | WaveSystem, InputHandler, SoundSystem, AudioSystem, ParticleSystem, BackgroundRenderer, QualityManager, HighlightRecorder, EventSystem, DangerIndicator, PracticeSession, HapticSystem | `SoundSystem.js` 2.457; `BackgroundRenderer.js` 1.380 |
| `src/entities/` (7) | Enemy, Player, Projectile, Entity, RunePatterns, Hats, momoSprites | `Enemy.js` 2.991; `momoSprites.js` 1.051 |
| `src/ui/` (5) | UIManager, MetaUI, StoryCanvasRenderer, WizardCardRenderer, CharacterPortraits | `UIManager.js` 1.701; `StoryCanvasRenderer.js` 1.564; `MetaUI.js` 1.357 |
| `src/combat/` (2) | CombatSystem, StatusEffects | 112 + 26 |
| `src/GestureEngine.js` | Nhận diện cử chỉ | 778 |
| **Tổng `src/`** | 45 file | **27.088** |
| `shared/` | `game-configuration.js` (86), `gameplay-content.js` (213), `gameplay-content.types.ts` (56), `story/engine.js` (366), `story/runtime.js` (126), `story/seed.json` (1.918 dòng, 71 KB) | 2.765 |
| `admin/server/` | `app.mjs` 236, `configuration.mjs` 145, `story.mjs` 96, `policy.mjs` 35, `index.mjs` 12 | 524 |
| `admin/src/` | `StoryPage.tsx` 872, `GameplayPage.tsx` 602, `pages.tsx` 353, `ConfigurationPage.tsx` 351, `main.tsx` 237, `Auth.tsx` 167, … | 3.043 (gồm 4 file test) |
| `admin/tests/` | server, configuration, gameplay, story | 743 |
| Test gốc | 28 file: 17 `test-*.js` ở gốc + 2 trong `tests/` + 9 `scripts/test-*.js` | 7.303 |
| `docs/` | GDD (584), combat, configuration-management, story-cms, gameplay-content-editors, gesture-recognition-report | ~850 |
| Asset | `assets/`, `public/` (mp3, png) — nhiều bản trùng | ~2,7 MB audio + ~0,65 MB sprite |
| Artifact được track | `arcane-paws-standalone.html` + `dist/` (15 file) | 3 bản HTML trùng 667.200 B |

`git ls-files`: **496 file**, trong đó **327 thuộc `node_modules/`** (31 MB), 15 thuộc `dist/`, còn lại ~154 file nguồn/tài liệu. `.git` nặng 25 MB.

## 5. Kiến trúc tóm tắt

Xem [ARCHITECTURE.md](./ARCHITECTURE.md). Ba điểm cần nhớ:

1. **Game là mô phỏng một vòng lặp** quanh `Game` (lớp "god", ~100 phương thức) với `StateMachine` (MENU, STORY, PLAYING, PAUSE, GAMEOVER, VICTORY, PRACTICE). Spawn do `WaveSystem` điều khiển; chiến đấu do `CombatSystem` (sự kiện đồng bộ có thứ tự); cử chỉ do `GestureEngine` + `InputHandler` (Pointer Events).
2. **Admin → game chỉ qua hai kênh công khai, có fallback:** cấu hình (`/api/game-config/:env`, được ghim bất biến theo ván) và story (`/api/story-content/published`). Kênh thứ ba — nội dung gameplay (`/api/game-content/:env`) — **tồn tại ở API nhưng game không gọi**.
3. **`shared/` là ranh giới hợp đồng** (schema, validate, engine story) được game, server và SPA cùng import; nhưng `shared/gameplay-content.js` lại import `src/core/Constants.js` của game, và `GameplayPage.tsx` import cả `src/entities/Enemy.js` (GAP-112).

## 6. Kiểm kê tính năng (đã đối chiếu code + test)

| Khu vực | Trạng thái | Bằng chứng chính |
|---|---|---|
| Nhận diện cử chỉ, input (8 rune) | Đầy đủ | 294/294 fixture theo tài liệu; test xanh (GAP-001) |
| Chiến đấu, trạng thái, cờ tính năng | Đầy đủ (2 cờ chưa có producer/UI) | `tests/combat.test.js`; GAP-002/103 |
| Story 5 màn + boss, Endless, điểm/combo, 3 độ khó | Đầy đủ | GAP-003 |
| Lớp meta (cài đặt, kỷ lục, luyện tập, thử thách ngày, đồng hành, tủ đồ, 37 thành tựu) | Đầy đủ | `test-meta-features.js` 160 (GAP-004) |
| Lớp gắn kết (bất ngờ, câu thần chú, Boss Rush, clip) | Đầy đủ | `test-engagement-features.js` 170 (GAP-005) |
| Story/lore + Story CMS | Đầy đủ chức năng, 2 lỗi | GAP-006; GAP-302/304 |
| Cấu hình game từ Admin | Đầy đủ | GAP-007 |
| Gameplay Studio (editor + vòng đời) | Editor xong; **runtime chưa nối**; 2 lỗi | GAP-101/301/303 |
| LiveOps / Players / Analytics | Chỉ là khung `not_connected` | GAP-104 |
| i18n | Chỉ story (vi/en); UI cứng tiếng Việt | GAP-105 |
| Accessibility | Tuỳ chọn tốt; thiếu ngữ nghĩa hộp thoại/zoom | GAP-107 |
| Chịu lỗi runtime (vòng lặp game, ErrorBoundary Admin) | Thiếu | GAP-312/204 |
| CI, README, LICENSE, favicon, PWA | Thiếu | GAP-201/109/202/203 |

Tổng hợp: **48 mục GAP** (11 COMPLETED, 16 PARTIAL, 4 MISSING, 12 BUG, 5 UNKNOWN) và **30 yêu cầu** (xem REQUIREMENTS/GAP_ANALYSIS).

## 7. Chất lượng

### 7.1 Test game — kết quả từng suite (chạy riêng từng file, 2026-11-10)

Tổng thời gian toàn bộ 25 suite ≈ 12 giây. Trong `npm test` (22 script) có 17 suite in bộ đếm: **1.064 pass / 1 fail** ở lần chạy đầu (engagement đỏ do flaky; lần chạy riêng sau đó 170/170).

| Suite | Pass | Ghi chú |
|---|---:|---|
| `tests/combat.test.js` | — (thoát 0) | node:assert |
| `tests/gesture-recognition.test.js` | — (thoát 0) | node:assert |
| `test-gesture-enhancements.js` | 21 | |
| `test-performance-system.js` | 30 | **soft-assert, không bao giờ thoát ≠ 0** (GAP-308) |
| `test-visual-effects.js` | 45 | |
| `test-sound-system.js` | 51 | |
| `scripts/test-new-features.js` | 29 | |
| `test-doodle-levels-story.js` | 60 | |
| `test-story-character-expansion.js` | 69 | |
| `test-character-visuals.js` | 138 | |
| `test-difficulty-scaling.js` | 45 | |
| `scripts/test-boss-retreat-all-minions.js` | 28 | |
| `scripts/test-boss-spawn-deadlock-prevention.js` | — (thoát 0) | gọi `updatePlaying.call(fake)` |
| `test-share-card-haptic-catsfx.js` | 41 | |
| `scripts/test-boss-gradual-arrival.js` | — (thoát 0) | gọi `updatePlaying.call(fake)` |
| `scripts/test-final-boss-half-screen-right.js` | 40 | |
| `test-tactical-rune-requirement.js` | 17 | |
| `test-mobile-optimization.js` | 75 | |
| `test-endless-mode.js` | — (thoát 0) | |
| `test-meta-features.js` | 160 | |
| `test-enemy-render-performance.js` | 46 | guard `shadowBlur` |
| `test-engagement-features.js` | 169–170 | **flaky**: đỏ ≈ 1/3 số lần (36/105 lần đo gộp; GAP-307) |
| *Ngoài `npm test`:* `test-story-lore.js` | 168 | chỉ trong `npm run test:story` |
| *Ngoài `npm test`:* `test-powerups-freeze-blast.js` | 34 | mồ côi |
| *Ngoài `npm test`:* `scripts/test-gesture-momo-sound.js` | 72 | mồ côi |
| *Ngoài `npm test`, HỎNG:* `scripts/test-center-cat-boss-tutorial.js` | 1 đỏ + TypeError | sửa lần cuối 01/11 (GAP-309) |
| *Ngoài `npm test`, HỎNG:* `scripts/test-boss-minions-and-scary-face.js` | 53 / 2 đỏ (+1 chập chờn) | thêm `Spawned minion has valid combat speed` đỏ 1/12 lần (§9b V6) |
| *Ngoài `npm test`, HỎNG:* `scripts/test-monster-sounds.js` | 35 / 5 đỏ | |

### 7.2 Test và typecheck Admin

`npm --prefix admin test` → **19/19** (server, configuration, gameplay, story). `npx vitest run` → **10/10** (4 file). `npx tsc --noEmit` → sạch. Khoảng trống: `gameplay.test.mjs` gọi thẳng `configurationRoute` với `permits: () => true` nên không chạm đường HTTP thật (đã che giấu GAP-301/303); UI Gameplay chỉ có 1 test (thêm enemy/undo/redo/lưu).

### 7.3 Build và artifact

Game: `vite build` ra thư mục tạm → 53 module, **667.200 B** (gzip 175,80 kB), md5 **trùng khớp** cả 3 bản đã commit (build tất định). Admin: build OK, 1 chunk 1.382,42 kB (gzip 434,74 kB) với cảnh báo > 500 kB. `scripts/export-bundle.js` in "100% self-contained" nhưng audio/sprite **không** được nhúng (GAP-106).

### 7.4 Smoke test trình duyệt (Chrome headless, 1280×800)

Menu hiển thị đầy đủ (chọn 5 màn, 3 độ khó, 8 rune, nút chơi, Nhật Ký, lưới tính năng); **0 dòng CONSOLE**; request: `index.html`, sprite (sau 2×2 lần 404 ở `/assets/level1-*.png`), `favicon.ico` 404. Âm thanh và gameplay chưa được thực thi trong trình duyệt.

### 7.5 Lỗi đã tái hiện bằng thực nghiệm

`node docs/ai-planning/evidence/repro-admin-bugs.mjs` → **3 FAIL, exit 1** trên code hiện tại:

| Kiểm tra | Kết quả trên code hiện tại |
|---|---|
| EXP1 (GAP-301) | 15.278 B → 200; 16.808 B → **413**; 110.433 B → **413** (cả ba qua `validateContent`) |
| EXP2 (GAP-303) | Analyst: policy `gameplay:read` = true nhưng `GET /api/gameplay/environments/development` → **403** |
| EXP3 (GAP-302) | body 204 KB cắt giữa ký tự đa byte → **3 ký tự U+FFFD** trong dữ liệu lưu |

## 8. Nợ kỹ thuật và vấn đề (xếp hạng)

| Hạng | Vấn đề | Task |
|---:|---|---|
| 1 | Cổng test không tin cậy (flaky, xanh giả, mồ côi, không CI) | TST-01..03, FND-05 |
| 2 | Lỗi Admin xác nhận (413, UTF-8, Analyst) | ADM-01..03 |
| 3 | Sink XSS từ CMS | SEC-01, SEC-02 |
| 4 | IP/asset/hotlink | IPA-01..07 |
| 5 | Content runtime chưa nối | RUN-01..09 |
| 6 | Repo vệ sinh (node_modules tracked, artifact trùng, asset trùng) | FND-01, FND-04, IPA-03 |
| 7 | GDD lệch code | BAL-01..03 |
| 8 | Production readiness của Admin | OPS-01..05, ADM-04/05 |
| 9 | Khả năng bảo trì lõi game | ARC-01, ARC-02 |
| 10 | i18n/a11y/boot | UXL-01..05 |
| 11 | Chịu lỗi runtime (vòng lặp game, ErrorBoundary Admin) | ARC-06, ADM-07 |

Các điểm tích cực cần giữ: không có `TODO/FIXME`, không có `console.log` thừa trong `src/`; persistence an toàn trước dữ liệu hỏng; guard hiệu năng bằng test (`shadowBlur`); fallback an toàn khi nạp từ xa lỗi; build tất định.

## 9. Nhật ký xác minh

| # | Kiểm tra | Lệnh | Kết quả |
|---:|---|---|---|
| 1 | Trạng thái git | `git status`, `git log` | sạch; 27 commit + 26 merge |
| 2 | Test gốc | `npm test` | 22 script; 21 xanh, engagement 1 assertion đỏ → exit 1; 1.064 pass/1 fail trên 17 suite có bộ đếm |
| 3 | Độ flaky | `node test-engagement-features.js` × 12 | 8 lần exit 1, 4 lần exit 0 (mẫu nhỏ, ngoại lai — đo lại ở §9b V5: ≈ 31%) |
| 4 | Từng suite | vòng lặp 25 file | tất cả exit 0 khi chạy riêng; ≈ 12 s |
| 5 | Orphan hỏng | 3 file `scripts/test-*.js` | 3 file exit 1 (1+TypeError, 2, 5 assertion đỏ) |
| 6 | Admin backend | `npm --prefix admin test` | 19/19 pass |
| 7 | Admin UI | `npx vitest run` (trong `admin/`) | 4 file, 10 test pass |
| 8 | Typecheck | `npx tsc --noEmit` (trong `admin/`) | sạch |
| 9 | Build game | `npx vite build --outDir <tmp>` | 53 module; 667.200 B; md5 = 3 bản đã commit |
| 10 | Build admin | `npx vite build --outDir <tmp>` (trong `admin/`) | OK; 1.382,42 kB |
| 11 | Smoke trình duyệt | Chrome headless + static server cục bộ | menu OK; 0 console; 404: 2 sprite + favicon |
| 12 | Tái hiện lỗi Admin | `node docs/ai-planning/evidence/repro-admin-bugs.mjs` | EXP1/2/3 FAIL, exit 1 |
| 13 | Content không được dùng | `grep -rnE "game-content\|gameplay-content\|contentEnvironments\|contentTimeline\|validateContent" src main.js index.html scripts` | không có kết quả (exit 1) |
| 14 | Hotlink | `grep -rn "google.com/logos" src` | `SoundSystem.js:1817`, `Player.js:97` |
| 15 | Seed story | node `locales` | 243 chuỗi, 0 chuỗi chứa `<`/`>`, dài nhất 302 ký tự |
| 16 | Tracked | `git ls-files node_modules \| wc -l` | 327 |
| 17 | Sau phân tích | `git status --short` | chỉ `docs/ai-planning/` (mới, chưa commit) |

## 9b. Kiểm chứng lần 2 (độc lập, 2026-11-10, cùng commit `d101898`)

Bộ kế hoạch v1.0.0 đã tồn tại (chưa commit) khi lượt kiểm chứng này bắt đầu. Thay vì tin vào văn bản, các kết luận quan trọng nhất được chạy lại bằng lệnh thật; **không có file nguồn nào đổi** giữa hai lượt (`git status` chỉ có `docs/ai-planning/`). Kết quả: phần lớn **khớp**; **2 số liệu sai đã sửa**; **2 lỗ hổng chưa được nêu đã bổ sung**; **2 chỗ sai của công cụ/tài liệu kế hoạch đã sửa** (kiểm tra mốc không chạy; đường găng ROADMAP §3 sai) ⇒ kế hoạch **v1.1.0**.

| # | Kiểm tra | Cách làm | Kết quả |
|---:|---|---|---|
| V1 | Tính nhất quán v1.0.0 | `plan.mjs validate` | 0 lỗi, 0 cảnh báo (nhưng xem V15: một kiểm tra không hề chạy) |
| V2 | 3 lỗi Admin | `node docs/ai-planning/evidence/repro-admin-bugs.mjs` | **khớp** y hệt: 15.278 B → 200; 16.808 B → 413; 110.433 B → 413; Analyst → 403; U+FFFD = 3; exit 1; repo không đổi |
| V3 | Chuỗi XSS | đọc `runtime.js` → `installStory` → `storyContent.slides` → `UIManager.js:824,843` | **khớp**: `validateStory` chỉ kiểm `typeof === "string"`; CHƯA chạy khai thác |
| V4 | Baseline test | chạy riêng từng file trong 28 file | **khớp**: 22 suite của `npm test` đều exit 0 ở lần chạy này; 3 suite mồ côi hỏng đúng như nêu; số assertion khớp (168, 34, 72, 45, 60, 160, 75, 46, …) |
| V5 | Độ flaky blood-moon | `test-engagement-features.js` × 24, rồi × 60 | **SAI SỐ → đã sửa**: 7/24 và 19/60 (≈ 31%); v1.0.0 ghi ~67% (8/12) là mẫu ngoại lai. Gộp 36/105 ≈ 34% khớp nguyên nhân gốc ~32% |
| V6 | `scripts/test-boss-minions-and-scary-face.js` | × 12 | **bổ sung**: 2 assertion đỏ cố định (12/12) + `Spawned minion has valid combat speed` đỏ 1/12 ⇒ TST-05 mở rộng |
| V7 | Test "xanh giả" | đọc phần cuối `test-performance-system.js` | **khớp**: không có `process.exit`/`exitCode`/`throw` |
| V8 | Build tất định | `vite build --outDir <tmp>` | **khớp**: 667.200 B; md5 trùng 3 bản đã commit; repo không đổi |
| V9 | Test Admin | `npm --prefix admin test`; `npx vitest run` (trong `admin/`) | **khớp**: 19/19; 4 file / 10 test |
| V10 | Repo và asset | `git ls-files`, md5, grep | **khớp**: 327/496 file được track là `node_modules`; asset trùng 2–5 bản; standalone có 0 `data:audio`, 0 `data:image/png`, 2 tham chiếu Google Fonts, 1 URL google.com |
| V11 | Quy mô và hằng số | `wc -l`, grep | **khớp**: `Game.js` 3.322; `Enemy.js` 2.991; `SoundSystem.js` 2.457; `updatePlaying` 1185–1702; công thức Endless khớp `WaveSystem.js:142–144`; hằng số lệch GDD khớp `Constants.js:787,788,803` |
| V12 | **Phát hiện mới**: vòng lặp game | [`evidence/repro-game-loop.mjs`](./evidence/repro-game-loop.mjs) | `update()`/`render()` ném lỗi ⇒ rAF không được đặt lại (đứng hình vĩnh viễn); exit 1; thoát 0 khi vòng lặp được vá trong bộ nhớ ⇒ GAP-312, ARC-06 |
| V13 | **Phát hiện mới**: Admin SPA | grep `ErrorBoundary`/`componentDidCatch` trong `admin/src` | rỗng ⇒ GAP-204, ADM-07 |
| V14 | Lệnh verification trong backlog | script quét mọi lệnh của mọi task | không có tham chiếu file/script treo (157 lệnh / 63 task ở v1.0.0) |
| V15 | **Lỗi công cụ** | đọc và chạy thử `tools/plan.mjs` | kiểm tra bảng mốc ROADMAP **chưa từng chạy** (regex `/^M\d$/` không khớp ô `M0 · …` ⇒ đọc được 0 hàng); đã sửa thành `/^M\d\b/` và báo lỗi nếu không đọc được hàng nào; đã thử đột biến (gán sai sprint → bị bắt) |
| V16 | **Lỗi tài liệu**: đường găng ROADMAP §3 | script đối chiếu từng mũi tên với `dependencies` trong `tasks.json` | có mũi tên không phải phụ thuộc trực tiếp (ví dụ `IPA-02 → IPA-01`, `IPA-07 → REL-04`, `OPS-03 → ADM-05`, `RUN-04 → RUN-05`) và chuỗi "dài nhất" bỏ sót đoạn `TST-03 → UXL-05` đứng trước `RUN-02` ⇒ viết lại §3 (mỗi dòng một chuỗi) và `validate` nay kiểm từng mũi tên (đã thử đột biến) |

Chưa làm lại (vẫn `UNKNOWN`, xem §11): audit phụ thuộc (cần mạng), thiết bị thật, âm thanh trong trình duyệt, Admin SPA trong trình duyệt, đo thời gian boot thực tế.

## 10. Quy ước và gotcha của dự án

Danh sách đầy đủ, có hướng dẫn áp dụng, nằm trong [EXECUTION_RULES.md](./EXECUTION_RULES.md) §6. Những điều dễ sai nhất: logic theo khung không thuộc mô phỏng lõi phải để ở `PlayingState.update`/`Game.advanceEffects` (không phải `updatePlaying`); test Node mock DOM tối giản nên code UI phải guard truy cập DOM; văn bản story bị test khoá; không thêm `shadowBlur` vào đường vẽ minion; `package.json` có thể bị phiên khác sửa — đọc lại trước khi ghi.

## 11. Chưa xác minh / giới hạn

Hiệu năng và độ chính xác cảm ứng trên thiết bị thật (GAP-402); âm thanh trong trình duyệt (GAP-403); Admin SPA và preview enemy trong trình duyệt (GAP-404); lỗ hổng phụ thuộc (GAP-405); tình trạng giấy phép asset (GAP-401 — không phải kết luận pháp lý); tăng trưởng thực tế của `store.json` (GAP-114); hành vi throttle đăng nhập sau proxy thật (GAP-305); khả năng khai thác thực tế của sink XSS (GAP-304); thời gian chờ boot thực tế khi máy chủ chậm (GAP-111).
