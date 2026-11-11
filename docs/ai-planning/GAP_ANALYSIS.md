# GAP ANALYSIS

Đối chiếu source code với yêu cầu sản phẩm ([REQUIREMENTS.md](./REQUIREMENTS.md)). Mọi kết luận "COMPLETED" đều có bằng chứng đã chạy ngày **2026-11-10** tại commit `d101898` (xem [PROJECT_ANALYSIS.md](./PROJECT_ANALYSIS.md) §Nhật ký xác minh). Không suy đoán: điều gì chưa xác minh được ghi `UNKNOWN`. Bản v1.1.0 đã được kiểm chứng lại độc lập cùng ngày bằng lệnh thật (xem [PROJECT_ANALYSIS](./PROJECT_ANALYSIS.md) §9b): hai số liệu được hiệu chỉnh (GAP-307, GAP-309) và thêm hai mục (GAP-204, GAP-312).

**Phân loại:** `COMPLETED` đã triển khai và có bằng chứng · `PARTIAL` triển khai chưa đầy đủ · `MISSING` chưa có · `BUG` lỗi đã xác nhận · `UNKNOWN` chưa đủ dữ liệu.

> Bảng chỉ mục dưới đây được `plan.mjs validate` kiểm tra: mỗi GAP không COMPLETED phải trỏ tới ≥ 1 task hoặc quyết định; cột Tasks phải khớp với `gapRefs` trong `tasks.json` (hai chiều).

| Trạng thái | Số mục |
|---|---:|
| COMPLETED | 11 |
| PARTIAL | 16 |
| MISSING | 4 |
| BUG | 12 |
| UNKNOWN | 5 |

## Chỉ mục

| ID | Status | Area | Title | Tasks | Decisions |
|---|---|---|---|---|---|
| GAP-001 | COMPLETED | Game | Nhận diện cử chỉ và xử lý input (8 rune) | — | — |
| GAP-002 | COMPLETED | Game | Hệ thống chiến đấu (CombatSystem, StatusEffects, cờ tính năng) | — | — |
| GAP-003 | COMPLETED | Game | Story 5 màn + boss, Endless, điểm/combo, độ khó | — | — |
| GAP-004 | COMPLETED | Game | Lớp meta: cài đặt, kỷ lục, luyện tập, thử thách ngày, đồng hành, tủ đồ, thành tựu | — | — |
| GAP-005 | COMPLETED | Game | Lớp gắn kết (§8): bất ngờ giữa wave, câu thần chú, Boss Rush, clip khoảnh khắc | — | — |
| GAP-006 | COMPLETED | Game+Admin | Hệ thống story/lore và pipeline Story CMS (chức năng) | — | — |
| GAP-007 | COMPLETED | Game+Admin | Pipeline cấu hình game: admin → API công khai → game ghim snapshot theo ván | — | — |
| GAP-008 | COMPLETED | Admin | Xác thực, RBAC và phiên (nền tảng) | — | — |
| GAP-009 | COMPLETED | Build | Build và xuất bản tái lập được | — | — |
| GAP-010 | COMPLETED | Game | Khởi động trên trình duyệt thật | — | — |
| GAP-011 | COMPLETED | Game | Bền vững dữ liệu cục bộ | — | — |
| GAP-101 | PARTIAL | Game+Admin | Gameplay Content Studio chưa có consumer ở runtime | RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07, RUN-08, RUN-09 | DEC-02 |
| GAP-102 | PARTIAL | Game/Docs | GDD v1.0.0 lệch code (số liệu, rune, độ khó, DDA) | BAL-01, BAL-02, BAL-03 | DEC-01 |
| GAP-103 | PARTIAL | Game | Cờ combat không có producer/UI (elite modifier, spell loadout) | RUN-06 | DEC-02 |
| GAP-104 | PARTIAL | Admin | Module Live Operations / Players / Analytics mới là khung; chưa có telemetry | MOD-01, MOD-02 | DEC-06 |
| GAP-105 | PARTIAL | Game | Bản địa hóa: story vi/en, UI cứng tiếng Việt | UXL-01, UXL-02 | DEC-07 |
| GAP-106 | PARTIAL | Game | Bản standalone không "tự đủ" như tài liệu tuyên bố | IPA-03, IPA-07 | DEC-09 |
| GAP-107 | PARTIAL | Game | Accessibility: thiếu ngữ nghĩa hộp thoại/focus, chặn zoom | UXL-03 | — |
| GAP-108 | PARTIAL | Test | Chiều sâu kiểm thử tự động còn hạn chế | TST-03, TST-07, REL-01, REL-02 | — |
| GAP-109 | PARTIAL | Docs | Tài liệu: README một dòng, GDD cũ, chưa có quy trình phát hành | FND-03, REL-04, REL-05 | — |
| GAP-110 | PARTIAL | Admin | Admin chưa sẵn sàng vận hành production | OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06 | DEC-05 |
| GAP-111 | PARTIAL | Game | Khởi động nạp cấu hình và story tuần tự (tối đa ~5 s) | UXL-05 | — |
| GAP-112 | PARTIAL | Build | Kích thước bundle admin và ghép nối shared↔game | ARC-04, REL-03 | — |
| GAP-113 | PARTIAL | Game | Khả năng bảo trì lõi game | ARC-01, ARC-02, ARC-03, ARC-05 | — |
| GAP-114 | PARTIAL | Admin | Kho dữ liệu JSON phình vô hạn | ADM-05 | DEC-05 |
| GAP-115 | PARTIAL | Repo | Toolchain không được ghim; hai package manager và hai major Vite | FND-02, FND-04 | DEC-08 |
| GAP-116 | PARTIAL | Admin | Mã chết và chữ lỗi thời trong Admin | ADM-06 | — |
| GAP-201 | MISSING | Repo | Không có CI/CD và cổng tự động | FND-05, SEC-03 | — |
| GAP-202 | MISSING | Repo | Thiếu LICENSE và THIRD_PARTY_NOTICES | IPA-06 | DEC-03 |
| GAP-203 | MISSING | Game | Thiếu favicon và web manifest | UXL-04 | — |
| GAP-204 | MISSING | Admin | Admin SPA không có ErrorBoundary: lỗi render làm trắng toàn trang | ADM-07 | — |
| GAP-301 | BUG | Admin | Lưu tài liệu Gameplay > 16 KiB bị từ chối 413 | ADM-02 | — |
| GAP-302 | BUG | Admin | Giải mã UTF-8 theo từng chunk làm hỏng tiếng Việt | ADM-01 | — |
| GAP-303 | BUG | Admin | Analyst nhận 403 trên endpoint Gameplay dù policy/README cho đọc | ADM-03 | DEC-10 |
| GAP-304 | BUG | Game+Admin | Sink XSS: văn bản từ Story CMS đi vào innerHTML | SEC-01, SEC-02 | — |
| GAP-305 | BUG | Admin | Throttle đăng nhập khoá theo địa chỉ socket (sai khi chạy sau proxy) | ADM-04 | — |
| GAP-306 | BUG | Repo | `node_modules/` bị track trong git; không có .gitignore gốc | FND-01 | — |
| GAP-307 | BUG | Test | Test "blood moon" flaky làm `npm test` đỏ ~1/3 số lần | TST-01 | — |
| GAP-308 | BUG | Test | `test-performance-system.js` không bao giờ trả exit code lỗi (xanh giả) | TST-02 | — |
| GAP-309 | BUG | Test | 6 suite mồ côi ngoài `npm test` (3 hỏng, 3 xanh) | TST-03, TST-04, TST-05, TST-06 | — |
| GAP-310 | BUG | Game | Runtime tải tài nguyên trực tiếp từ google.com | IPA-02 | — |
| GAP-311 | BUG | Repo | Asset trùng lặp, đường dẫn sai gây 404, ba bản bundle trùng được track | FND-04, IPA-03 | DEC-08 |
| GAP-312 | BUG | Game | Vòng lặp game dừng vĩnh viễn khi một khung ném ngoại lệ; không có handler lỗi toàn cục | ARC-06 | — |
| GAP-401 | UNKNOWN | IP | Tình trạng giấy phép của asset/thương hiệu có nguồn gốc Google Doodle | IPA-01, IPA-04, IPA-05, IPA-06 | DEC-03, DEC-04 |
| GAP-402 | UNKNOWN | Game | Hiệu năng/độ chính xác trên thiết bị thật chưa được xác minh | REL-02 | — |
| GAP-403 | UNKNOWN | Game | Audio chưa được thực thi trong trình duyệt thật | REL-01 | — |
| GAP-404 | UNKNOWN | Admin | Preview enemy của Gameplay Studio chưa chạy trong trình duyệt thật | REL-01 | — |
| GAP-405 | UNKNOWN | Repo | Lỗ hổng phụ thuộc chưa được rà soát | SEC-03 | — |

## Hạng mục COMPLETED (bằng chứng)

### GAP-001 — Nhận diện cử chỉ và xử lý input (8 rune)

- **File:** `src/GestureEngine.js`, `src/systems/InputHandler.js`, `tests/gesture-recognition.test.js`, `test-gesture-enhancements.js`, `docs/gesture-recognition-report.md`
- **Bằng chứng:** `npm test` (2026-11-10): `tests/gesture-recognition.test.js` và `test-gesture-enhancements.js` (21 assertion) xanh.
- **Bằng chứng:** docs/gesture-recognition-report.md: 294/294 fixture đúng (288 dương + 6 âm), độ trễ nhận diện p95 0,176 ms (số liệu tài liệu, chưa chạy lại bằng `npm run evaluate:gestures` vì lệnh ghi file fixture).

### GAP-002 — Hệ thống chiến đấu (CombatSystem, StatusEffects, cờ tính năng)

- **File:** `src/combat/CombatSystem.js`, `src/combat/StatusEffects.js`, `tests/combat.test.js`, `docs/combat.md`
- **Bằng chứng:** `tests/combat.test.js` thoát 0 trong `npm test`; `test-tactical-rune-requirement.js` 17 pass; `test-powerups-freeze-blast.js` 34 pass (suite mồ côi, chạy riêng).

### GAP-003 — Story 5 màn + boss, Endless, điểm/combo, độ khó

- **File:** `src/systems/WaveSystem.js`, `src/core/Constants.js`, `test-doodle-levels-story.js`, `test-difficulty-scaling.js`, `test-endless-mode.js`
- **Bằng chứng:** `test-difficulty-scaling.js` 45 pass; `test-doodle-levels-story.js` 60 pass; `test-endless-mode.js` thoát 0 (không in bộ đếm); các suite boss (`scripts/test-boss-*.js`, `test-final-boss-half-screen-right.js` 40 pass) xanh; bậc thang combo trong `COMBO_CONFIG.TIERS` khớp GDD §4. Số liệu cân bằng lệch GDD xem GAP-102.

### GAP-004 — Lớp meta: cài đặt, kỷ lục, luyện tập, thử thách ngày, đồng hành, tủ đồ, thành tựu

- **File:** `src/core/Settings.js`, `src/core/ProgressStore.js`, `src/core/Challenge.js`, `src/core/Companions.js`, `src/core/Cosmetics.js`, `src/core/Achievements.js`, `test-meta-features.js`
- **Bằng chứng:** `test-meta-features.js` 160 assertion xanh; 37 thành tựu, 11 mục Bestiary (đếm bằng `node -e` import Achievements.js).

### GAP-005 — Lớp gắn kết (§8): bất ngờ giữa wave, câu thần chú, Boss Rush, clip khoảnh khắc

- **File:** `src/systems/EventSystem.js`, `src/core/Spells.js`, `src/systems/HighlightRecorder.js`, `test-engagement-features.js`
- **Bằng chứng:** `test-engagement-features.js`: 169/170 assertion xanh; 1 assertion flaky do lỗi của test (GAP-307).

### GAP-006 — Hệ thống story/lore và pipeline Story CMS (chức năng)

- **File:** `src/core/Lore.js`, `src/core/StoryScenes.js`, `shared/story/engine.js`, `shared/story/runtime.js`, `admin/src/StoryPage.tsx`, `admin/server/story.mjs`
- **Bằng chứng:** `test-story-lore.js` 168 pass (chạy riêng — suite mồ côi); `admin/tests/story.test.mjs` 19 test pass (chạy trong `npm --prefix admin test`); vitest StoryPage 2 test. Lỗi liên quan: GAP-302 (UTF-8), GAP-304 (XSS).

### GAP-007 — Pipeline cấu hình game: admin → API công khai → game ghim snapshot theo ván

- **File:** `shared/game-configuration.js`, `admin/server/configuration.mjs`, `src/core/RemoteConfiguration.js`, `src/core/Game.js (dòng 932–1363, 2083, 2362, 2711)`
- **Bằng chứng:** `admin/tests/configuration.test.mjs` pass; game tiêu thụ cấu hình tại các dòng nêu trên (đọc source). Cấu hình chỉ được nạp lúc khởi động (không polling) — đúng như docs/configuration-management.md.

### GAP-008 — Xác thực, RBAC và phiên (nền tảng)

- **File:** `admin/server/app.mjs`, `admin/server/policy.mjs`, `admin/tests/server.test.mjs`, `admin/src/auth/Auth.tsx`
- **Bằng chứng:** `npm --prefix admin test`: 19/19 pass (gồm ma trận quyền, hết hạn phiên, throttle, từ chối secret yếu); vitest 10/10 pass. Lỗi liên quan: GAP-303, GAP-305.

### GAP-009 — Build và xuất bản tái lập được

- **File:** `vite.config.js`, `scripts/export-bundle.js`, `admin/vite.config.ts`
- **Bằng chứng:** Game: `vite build` ra thư mục tạm → 53 module, 667.200 B (gzip 175,80 kB); md5 trùng khớp cả 3 bản đã commit ⇒ build TẤT ĐỊNH. Admin: `tsc --noEmit` sạch; `vite build` ra thư mục tạm OK (1.382,42 kB, gzip 434,74 kB).

### GAP-010 — Khởi động trên trình duyệt thật

- **File:** `index.html`, `main.js`
- **Bằng chứng:** Chrome headless 1280×800 mở bản build qua HTTP cục bộ: menu hiển thị đầy đủ (chọn màn, độ khó, 8 rune, nút chơi, Nhật Ký, lưới tính năng); 0 dòng CONSOLE; request: index.html + sprite. Chưa kiểm thử audio và gameplay trong trình duyệt (GAP-403).

### GAP-011 — Bền vững dữ liệu cục bộ

- **File:** `src/core/ProgressStore.js`, `src/core/Settings.js`, `src/core/RunSave.js`
- **Bằng chứng:** Mọi truy cập `localStorage` (22 vị trí, 6 file) nằm trong `try/catch`; `ProgressStore` bỏ qua dữ liệu hỏng và bắt đầu mới ("corrupt data: start fresh").

## Hạng mục cần xử lý

### GAP-101 — Gameplay Content Studio chưa có consumer ở runtime

**Trạng thái:** `PARTIAL` · **Khu vực:** Game+Admin · **Chờ quyết định:** DEC-02

**File liên quan:** `admin/src/GameplayPage.tsx`, `shared/gameplay-content.js`, `docs/gameplay-content-editors.md`, `src/systems/WaveSystem.js`, `src/core/Game.js`

**Bằng chứng:**

- `grep -rnE "game-content|gameplay-content|contentEnvironments|contentTimeline|validateContent" src main.js index.html scripts` → KHÔNG có kết quả (exit 1). Chỉ `shared/story/*` và `shared/game-configuration.js` được game import.
- Endpoint công khai `GET /api/game-content/:env` có và được test (admin/tests/gameplay.test.mjs) nhưng không client nào gọi; docs/gameplay-content-editors.md thừa nhận "does not yet consume gameplay content releases".
- Lệch mô hình: content = lịch spawn theo thời gian tuyệt đối; WaveSystem = theo số lượng + điều kiện hết quái; boss gimmick cứng theo loại (`Enemy.js:21–26`); GDD §5 là schema thứ ba.

**Việc cần làm:** Chốt mô hình và ánh xạ (DEC-02, RUN-01); bộ nạp có fallback (RUN-02); adapter enemy/boss/trạng thái (RUN-03, RUN-05, RUN-06); nguồn wave theo kịch bản (RUN-04); chế độ chơi + pin snapshot (RUN-07); test tích hợp (RUN-08); chỉ báo "runtime hỗ trợ" (RUN-09).

**Task:** RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06, RUN-07, RUN-08, RUN-09

### GAP-102 — GDD v1.0.0 lệch code (số liệu, rune, độ khó, DDA)

**Trạng thái:** `PARTIAL` · **Khu vực:** Game/Docs · **Chờ quyết định:** DEC-01

**File liên quan:** `docs/GDD.md`, `src/core/Constants.js`, `src/systems/WaveSystem.js`

**Bằng chứng:**

- Đối chiếu trực tiếp source (xem bảng dưới). Các lệch này KHÔNG phải lỗi code; GDD là tài liệu v1.0.0 từ trước các vòng cân chỉnh (improve-algorithm, combat-refactor). Mục §8–§9 của GDD đã đồng bộ với code.

| Hạng mục | GDD | Code (nguồn) |
|---|---|---|
| Danh mục rune | 6 (— \| ∧ ∨ ⚡ ❤️) | 8: thêm `circle` ❄️ Frost Nova, `spiral` 🌀 Gale Shockwave (`Constants.js:17–98`) |
| Combo decay | 2,2 s | 2,4 s (`COMBO_CONFIG.DECAY_TIME`) |
| Bậc thang combo | 1–4 ×1 … 35+ ×5 | giống hệt ✓ |
| I-frame sau va chạm | 1,0 s | 1,2 s (`PLAYER_CONFIG.INVULNERABLE_DURATION`) |
| Vòng nguy hiểm | 120 px | 140 px (`PLAYER_CONFIG.DANGER_RADIUS`) |
| HP tối đa | 5 | 5 ✓ |
| Tốc độ quái thường | 90–120 px/s | `ENEMY_TYPES.REGULAR.baseSpeed` = 68 × hệ số |
| Số quái Endless N(W) | ⌊8 + 4·W^1,18⌋ | ⌊(10 + 5·W^1,22) × (HARDCORE 1,25)⌋ (`WaveSystem.js:142`) |
| Khoảng spawn | max(0,55; 2,6·e^(−0,09(W−1))) | max(0,45; 2,2·e^(−0,11(W−1)) × hệ số độ khó) (`:143`) |
| Hệ số tốc độ | min(1,75; 1 + 0,05(W−1)) | min(2,2; (1,1 + 0,08(W−1)) × hệ số độ khó) (`:144`) |
| Phân bổ archetype wave 2 | 85% thường / 15% nhanh | 70% / 30% (`:446`) |
| Xác suất ghost tim | 5–15% | 8% / 15% / 24% theo HP × hệ số độ khó (`:533`) |
| DDA HP ≤ 2 | giảm I_spawn 15% ("thưa hơn" — tự mâu thuẫn) | khoảng spawn ×1,10 (thưa hơn) và ghost tim 24% |
| DDA combo ≥ 15 | +10% tốc độ đợt sau | KHÔNG triển khai (grep `Game.js`/`WaveSystem.js` rỗng) |
| Độ khó | không có | NORMAL / HARDCORE / INFERNO (`DIFFICULTY_LEVELS`) |
| Schema §5 (WaveConfig/EnemyTemplate) | mô tả JSON schema | game không đọc schema này; admin có schema riêng khác tên trường (GAP-101) |

**Việc cần làm:** Quyết định nguồn sự thật (DEC-01) → BALANCE.md sinh từ code (BAL-01) → xử lý luật DDA (BAL-02) → harness mô phỏng để đo thay đổi sau này (BAL-03).

**Task:** BAL-01, BAL-02, BAL-03

### GAP-103 — Cờ combat không có producer/UI (elite modifier, spell loadout)

**Trạng thái:** `PARTIAL` · **Khu vực:** Game · **Chờ quyết định:** DEC-02

**File liên quan:** `src/combat/CombatSystem.js`, `src/core/Game.js (dòng 1351, 1371, 1451)`, `src/entities/Enemy.js`, `shared/game-configuration.js`, `docs/combat.md`

**Bằng chứng:**

- `eliteModifier` chỉ có consumer (`Game.js:1351,1371,1451`, `CombatSystem.js:82`, `Enemy.js:278`); `WaveSystem` không bao giờ phát nó (docs/combat.md: "does not randomly turn existing waves into elites").
- `spellLoadout`: chỉ `CombatSystem.js:51`, không có màn chọn (docs/combat.md: "There is no new loadout selection screen" — hoãn có chủ đích).
- `shared/game-configuration.js` chỉ lộ 3/5 cờ (`perfectCast`, `chainReaction`, `elementalInteraction`) trong khi `COMBAT_DEFAULTS.flags` có 5.

**Việc cần làm:** Elite producer qua content (RUN-06). UI chọn loadout: chưa có task — cần quyết định sản phẩm riêng (đang hoãn có chủ đích).

**Task:** RUN-06

### GAP-104 — Module Live Operations / Players / Analytics mới là khung; chưa có telemetry

**Trạng thái:** `PARTIAL` · **Khu vực:** Admin · **Chờ quyết định:** DEC-06

**File liên quan:** `admin/server/app.mjs`, `admin/src/pages.tsx`, `admin/server/policy.mjs`

**Bằng chứng:**

- `GET /api/{liveops,players,analytics}` trả `items: [], integration: "not_connected"` (`app.mjs`, đoạn cuối); Dashboard hiển thị `—` cho activePlayers/gameSessions/scheduledEvents (`pages.tsx`).
- Game không có lệnh gọi mạng nào ngoài việc nạp cấu hình/story (grep `fetch(` trong `src/` chỉ thấy nạp asset).
- Không có yêu cầu sản phẩm nào cho các module này trong repo (REQ-A06 là yêu cầu SUY RA).

**Việc cần làm:** Viết đặc tả có căn cứ (MOD-01) rồi mới quyết định xây dựng (MOD-02 ở parking lot).

**Task:** MOD-01, MOD-02

### GAP-105 — Bản địa hóa: story vi/en, UI cứng tiếng Việt

**Trạng thái:** `PARTIAL` · **Khu vực:** Game · **Chờ quyết định:** DEC-07

**File liên quan:** `main.js`, `shared/story/runtime.js`, `index.html`, `src/ui/UIManager.js`, `src/ui/MetaUI.js`

**Bằng chứng:**

- `main.js`: `setStoryLocale(import.meta.env.VITE_STORY_LOCALE || "vi")` — chọn lúc build, không có công tắc lúc chạy.
- Không có hàm i18n/bảng chuỗi (grep trong `src/` chỉ thấy `translate` của canvas/SVG); ảnh chụp menu toàn tiếng Việt; `<html lang="vi">`.

**Việc cần làm:** Hạ tầng i18n + công tắc (UXL-01), trích xuất ≥ 90% chuỗi (UXL-02) — chỉ khi DEC-07 = B.

**Task:** UXL-01, UXL-02

### GAP-106 — Bản standalone không "tự đủ" như tài liệu tuyên bố

**Trạng thái:** `PARTIAL` · **Khu vực:** Game · **Chờ quyết định:** DEC-09

**File liên quan:** `scripts/export-bundle.js`, `arcane-paws-standalone.html`, `src/systems/SoundSystem.js`, `src/entities/Player.js`, `index.html`

**Bằng chứng:**

- `grep -c "data:audio" arcane-paws-standalone.html` = 0 và `grep -c "data:image/png"` = 0; `export-bundle.js` in "100% self-contained" nhưng chỉ kiểm tra thẻ `<script src>`/`<link>`.
- `index.html` tải Google Fonts; `SoundSystem._loadAudioTrack` dùng `fetch` (không chạy trên `file://`); sprite chỉ nạp được nếu thư mục asset nằm cạnh file.

**Việc cần làm:** Dedupe và chuẩn hoá đường dẫn asset (IPA-03); hiện thực hợp đồng standalone theo DEC-09 (IPA-07).

**Task:** IPA-03, IPA-07

### GAP-107 — Accessibility: thiếu ngữ nghĩa hộp thoại/focus, chặn zoom

**Trạng thái:** `PARTIAL` · **Khu vực:** Game

**File liên quan:** `index.html`, `src/ui/MetaUI.js`, `styles/main.css`

**Bằng chứng:**

- `index.html`: 11 thuộc tính `aria-*`, 0 `role=`; viewport `maximum-scale=1.0, user-scalable=no`; `prefers-reduced-motion`: 2 tham chiếu trong CSS.
- Điểm cộng đã có: `colorBlind`, `altInput` (bàn phím), `assist`, `missHints` trong `Settings.js`.

**Việc cần làm:** UXL-03 (role/aria/focus trap/Esc, cho phép zoom, nhãn nút).

**Task:** UXL-03

### GAP-108 — Chiều sâu kiểm thử tự động còn hạn chế

**Trạng thái:** `PARTIAL` · **Khu vực:** Test

**File liên quan:** `package.json`, `test-*.js`, `tests/`, `scripts/test-*.js`

**Bằng chứng:**

- Toàn bộ test game chạy trong Node với DOM/canvas giả; chưa có e2e trình duyệt, chưa có coverage, chưa có tự động đo FPS.
- Test admin (29 test) nằm ngoài lệnh `npm test` gốc; 6 file test không nằm trong chuỗi `npm test` (GAP-309).

**Việc cần làm:** Runner thống nhất + orphan guard (TST-03); smoke trình duyệt (TST-07); e2e mở rộng (REL-01); harness hiệu năng (REL-02).

**Task:** TST-03, TST-07, REL-01, REL-02

### GAP-109 — Tài liệu: README một dòng, GDD cũ, chưa có quy trình phát hành

**Trạng thái:** `PARTIAL` · **Khu vực:** Docs

**File liên quan:** `README.md`, `docs/GDD.md`, `docs/`

**Bằng chứng:**

- `README.md` chỉ có đúng một dòng `# draw-game`; không có CHANGELOG/RELEASE; tài liệu rải ở `docs/` và `admin/README.md`.

**Việc cần làm:** README gốc (FND-03); checklist phát hành + CHANGELOG (REL-04); hợp nhất tài liệu và kiểm link (REL-05).

**Task:** FND-03, REL-04, REL-05

### GAP-110 — Admin chưa sẵn sàng vận hành production

**Trạng thái:** `PARTIAL` · **Khu vực:** Admin · **Chờ quyết định:** DEC-05

**File liên quan:** `admin/server/app.mjs`, `admin/server/index.mjs`, `admin/README.md`

**Bằng chứng:**

- admin/README.md ("Deployment boundary"): JSON store + session in-memory + một tài khoản bootstrap chỉ phù hợp một tiến trình; đa tài khoản/IdP/MFA là "extension points, not completed features".
- Không có Dockerfile/cấu hình proxy/`/api/health`/CSP; `send()` luôn đặt `Cache-Control: no-store` kể cả endpoint công khai cho game nên mọi lượt mở game chạm tiến trình admin.

**Việc cần làm:** Repository (OPS-01), SQLite + migrate (OPS-02), session bền vững (OPS-03), triển khai tham chiếu (OPS-04), xuất bản tĩnh (OPS-05); đa tài khoản nằm ở parking lot (OPS-06). Tất cả phụ thuộc DEC-05.

**Task:** OPS-01, OPS-02, OPS-03, OPS-04, OPS-05, OPS-06

### GAP-111 — Khởi động nạp cấu hình và story tuần tự (tối đa ~5 s)

**Trạng thái:** `PARTIAL` · **Khu vực:** Game

**File liên quan:** `main.js`

**Bằng chứng:**

- `main.js` dòng ~21 và ~26: `await remoteConfiguration.load(...)` rồi `await loadPublishedStory(...)`, mỗi cái timeout 2,5 s, đều trước `game.start()`. Xác nhận bằng đọc source; CHƯA đo thời gian thực tế.

**Việc cần làm:** UXL-05 (nạp song song + màn chờ).

**Task:** UXL-05

### GAP-112 — Kích thước bundle admin và ghép nối shared↔game

**Trạng thái:** `PARTIAL` · **Khu vực:** Build

**File liên quan:** `admin/src/GameplayPage.tsx`, `shared/gameplay-content.js`, `shared/gameplay-content.types.ts`, `admin/vite.config.ts`

**Bằng chứng:**

- Admin: một chunk JS 1.382,42 kB (gzip 434,74 kB), Vite cảnh báo > 500 kB; `GameplayPage.tsx` import `../../src/entities/Enemy.js` (2.991 dòng) để vẽ preview; `shared/gameplay-content.js` import `../src/core/Constants.js`; `gameplay-content.types.ts` viết tay song song với schema.

**Việc cần làm:** Types sinh từ schema + test chống lệch (ARC-04); code-splitting + ngân sách bundle (REL-03).

**Task:** ARC-04, REL-03

### GAP-113 — Khả năng bảo trì lõi game

**Trạng thái:** `PARTIAL` · **Khu vực:** Game

**File liên quan:** `src/core/Game.js`, `src/entities/Enemy.js`, `src/systems/SoundSystem.js`, `scripts/test-boss-gradual-arrival.js`, `scripts/test-boss-spawn-deadlock-prevention.js`

**Bằng chứng:**

- `Game.js` 3.322 dòng, ~100 phương thức; `updatePlaying` dòng 1185–1702 (~517 dòng). `Enemy.js` 2.991 dòng; `SoundSystem.js` 2.457 dòng.
- 2 suite gọi `Game.prototype.updatePlaying.call(fakeContext, dt)` trên đối tượng dựng tay (mọi `this.xxx` mới phải thêm vào fake context).

**Việc cần làm:** Harness `createTestGame()` + golden-master (ARC-01); tách `updatePlaying` (ARC-02); tách controller khỏi `Game.js` và baseline kiểm tra kiểu ở parking lot (ARC-03, ARC-05).

**Task:** ARC-01, ARC-02, ARC-03, ARC-05

### GAP-114 — Kho dữ liệu JSON phình vô hạn

**Trạng thái:** `PARTIAL` · **Khu vực:** Admin · **Chờ quyết định:** DEC-05

**File liên quan:** `admin/server/app.mjs`, `admin/server/configuration.mjs`, `admin/server/story.mjs`, `admin/src/StoryPage.tsx`

**Bằng chứng:**

- Đọc code: mỗi `mutate` clone và ghi lại toàn bộ `store.json`; audit `save` nhúng nguyên `values`; `versions` và `story.releases` (mỗi release là cả một story ~54 KB) không bao giờ bị cắt; `GET /api/content/story` trả mọi release. CHƯA đo tăng trưởng thực tế.

**Việc cần làm:** Retention/compaction và API danh sách tóm tắt (ADM-05); có thể được SQL thay thế một phần (OPS-02).

**Task:** ADM-05

### GAP-115 — Toolchain không được ghim; hai package manager và hai major Vite

**Trạng thái:** `PARTIAL` · **Khu vực:** Repo · **Chờ quyết định:** DEC-08

**File liên quan:** `package.json`, `admin/package.json`, `pnpm-lock.yaml`, `admin/package-lock.json`

**Bằng chứng:**

- Không có `engines`/`.nvmrc`; root dùng pnpm@10.33.0 (Vite 8.3.5), admin dùng npm (Vite 7.1); Node đang dùng v22.22.3; các gói rolldown khai báo `engines: ^20.19.0 || >=22.12.0`.

**Việc cần làm:** Ghim runtime (FND-02); chính sách artifact/package manager (FND-04).

**Task:** FND-02, FND-04

### GAP-116 — Mã chết và chữ lỗi thời trong Admin

**Trạng thái:** `PARTIAL` · **Khu vực:** Admin

**File liên quan:** `admin/src/pages.tsx`, `admin/src/services/api.ts`, `admin/server/app.mjs`

**Bằng chứng:**

- Nhánh `configuration` của `ModulePage` (modal "New configuration", `api.createConfig`) không bao giờ được render vì `main.tsx` định tuyến sang `ConfigurationPage`; endpoint legacy `POST /api/configuration` còn tồn tại; chữ trang System: "Audit history shows configuration creation actions" đã lỗi thời.

**Việc cần làm:** ADM-06.

**Task:** ADM-06

### GAP-201 — Không có CI/CD và cổng tự động

**Trạng thái:** `MISSING` · **Khu vực:** Repo

**File liên quan:** `.github/ (không tồn tại)`

**Bằng chứng:**

- Không có `.github/`; không có cấu hình ESLint/Prettier ở gốc (admin có script `format` nhưng không có file cấu hình prettier); 26 PR gộp không có kiểm tra tự động.

**Việc cần làm:** CI cho game + admin (FND-05); audit phụ thuộc + Dependabot (SEC-03).

**Task:** FND-05, SEC-03

### GAP-202 — Thiếu LICENSE và THIRD_PARTY_NOTICES

**Trạng thái:** `MISSING` · **Khu vực:** Repo · **Chờ quyết định:** DEC-03

**File liên quan:** `package.json`

**Bằng chứng:**

- `package.json` khai báo `"license": "ISC"` nhưng không có file LICENSE; không có thông báo cho thư viện/asset bên thứ ba.

**Việc cần làm:** IPA-06 (sau IPA-04).

**Task:** IPA-06

### GAP-203 — Thiếu favicon và web manifest

**Trạng thái:** `MISSING` · **Khu vực:** Game

**File liên quan:** `index.html`, `public/`

**Bằng chứng:**

- Smoke test: `GET /favicon.ico` → 404; không có `manifest`; không có service worker (PWA offline nằm ngoài phạm vi).

**Việc cần làm:** UXL-04.

**Task:** UXL-04

### GAP-204 — Admin SPA không có ErrorBoundary: lỗi render làm trắng toàn trang

**Trạng thái:** `MISSING` · **Khu vực:** Admin

**File liên quan:** `admin/src/main.tsx (Shell, dòng 140–142)`, `admin/src/components/shared.tsx`, `admin/src/GameplayPage.tsx (RuntimePreview, dòng 176–190)`

**Bằng chứng:**

- `grep -rn "ErrorBoundary\|componentDidCatch\|getDerivedStateFromError\|errorElement" admin/src` → KHÔNG có kết quả. Một ngoại lệ trong lúc render bất kỳ trang nào (ví dụ `RuntimePreview` của Gameplay Studio gọi `new Enemy(...)` rồi `render(ctx)` với dữ liệu bất thường, hoặc payload API ngoài dự kiến) làm React gỡ toàn bộ cây ⇒ trang trắng, mất cả menu điều hướng; chỉ còn cách tải lại.
- Điểm cộng đã có: phiên hết hạn (401) được xử lý (`api.ts:26` phát sự kiện `session-expired`, `Auth.tsx` đăng xuất); lỗi nạp dữ liệu có `ErrorState`/Retry (`shared.tsx:34`).
- Mức độ thấp: công cụ nội bộ, chưa có ca lỗi cụ thể nào được tái hiện. Xác nhận bằng grep + đọc source — CHƯA chạy.

**Việc cần làm:** ErrorBoundary quanh `<Outlet />`, tự đặt lại khi đổi route (ADM-07).

**Task:** ADM-07

### GAP-301 — Lưu tài liệu Gameplay > 16 KiB bị từ chối 413

**Trạng thái:** `BUG` · **Khu vực:** Admin

**File liên quan:** `admin/server/app.mjs (hàm body(), dòng ~75–89)`, `admin/tests/gameplay.test.mjs`

**Bằng chứng:**

- Tái hiện bằng server thật (`docs/ai-planning/evidence/repro-admin-bugs.mjs`, EXP1): 15.278 B → 200; 16.808 B → 413; 110.433 B → 413 — cả ba tài liệu đều qua `validateContent` (0 lỗi). Giới hạn 16.384 B áp cho mọi route trừ `/api/content/story*` (2 MiB) trong khi schema cho phép 500 phần tử/mảng và 10.000 spawn event.
- `admin/tests/gameplay.test.mjs` gọi trực tiếp `configurationRoute` với `permits: () => true` nên không phát hiện lỗi này.

**Việc cần làm:** Bảng giới hạn theo route + test HTTP vòng đời đầy đủ (ADM-02).

**Task:** ADM-02

### GAP-302 — Giải mã UTF-8 theo từng chunk làm hỏng tiếng Việt

**Trạng thái:** `BUG` · **Khu vực:** Admin

**File liên quan:** `admin/server/app.mjs (hàm body(): `raw += chunk`)`

**Bằng chứng:**

- Tái hiện tất định (EXP3): body 204 KB bị cắt giữa một ký tự đa byte → 3 ký tự U+FFFD trong dữ liệu lưu, round-trip khác. Tái hiện tự nhiên: body 1,25 MB → gửi 720.000 ký tự, lưu 720.015 ký tự (25 U+FFFD).
- Story seed mặc định (54 KB) round-trip sạch trên loopback (0/12) vì vừa một chunk; mức phơi nhiễm thực tế phụ thuộc kích thước story và cách mạng/proxy chia chunk.

**Việc cần làm:** Gom Buffer rồi decode một lần + test hồi quy tất định (ADM-01).

**Task:** ADM-01

### GAP-303 — Analyst nhận 403 trên endpoint Gameplay dù policy/README cho đọc

**Trạng thái:** `BUG` · **Khu vực:** Admin · **Chờ quyết định:** DEC-10

**File liên quan:** `admin/server/configuration.mjs (dòng 59–72)`, `admin/server/policy.mjs`, `admin/src/GameplayPage.tsx (dòng 407, 446, 536, 552, 560, 586)`, `admin/README.md`

**Bằng chứng:**

- EXP2: policy: Analyst `gameplay:read` = true, `configuration:read` = false; `GET /api/gameplay/environments/development` → 403. UI route guard dùng `gameplay:read` nên Analyst vào được trang rồi gặp lỗi; README ghi Analyst đọc được Gameplay.

**Việc cần làm:** Đồng bộ namespace quyền + test ma trận qua HTTP (ADM-03).

**Task:** ADM-03

### GAP-304 — Sink XSS: văn bản từ Story CMS đi vào innerHTML

**Trạng thái:** `BUG` · **Khu vực:** Game+Admin

**File liên quan:** `src/ui/UIManager.js (dòng 841, 843, 893, 922, 954)`, `shared/story/engine.js`, `src/ui/MetaUI.js`

**Bằng chứng:**

- `UIManager.js:843`: `btnStoryNext.innerHTML = <span>${slide.actionPrompt || ...}</span>`. `slide.actionPrompt` đến từ locale CMS (`slides.INTRO.N.actionPrompt`, trong seed.json); `validateStory` chỉ kiểm giá trị là string. Xác nhận bằng đọc source — CHƯA chạy khai thác.
- `MetaUI.js` đã có `escapeStoryText` cho nhật ký/mảnh ký ức; các `innerHTML` khác của `UIManager` (codex, hearts, avatar) dùng hằng số.
- Nếu game và admin chung origin (hướng dẫn triển khai), mã chèn có thể gọi `/api` với cookie phiên của quản trị viên đang chơi (cookie `Path=/api`, `HttpOnly`, `SameSite=Strict` không chặn được request cùng origin).

**Việc cần làm:** Vá sink + test hồi quy (SEC-01); phòng thủ lớp server/shared từ chối markup (SEC-02).

**Task:** SEC-01, SEC-02

### GAP-305 — Throttle đăng nhập khoá theo địa chỉ socket (sai khi chạy sau proxy)

**Trạng thái:** `BUG` · **Khu vực:** Admin

**File liên quan:** `admin/server/app.mjs (dòng 98–103)`

**Bằng chứng:**

- `attempts` khoá theo `req.socket.remoteAddress`; README yêu cầu chạy sau reverse proxy tin cậy ⇒ mọi người dùng chung một bucket (5 lần sai của bất kỳ ai khoá cả đội 15 phút); map không giới hạn kích thước. Xác nhận bằng đọc code; chưa chạy sau proxy thật.

**Việc cần làm:** `ADMIN_TRUST_PROXY`, throttle theo email, giới hạn bộ nhớ (ADM-04).

**Task:** ADM-04

### GAP-306 — `node_modules/` bị track trong git; không có .gitignore gốc

**Trạng thái:** `BUG` · **Khu vực:** Repo

**File liên quan:** `node_modules/ (327 file, 31 MB)`, `node_modules/.vite/deps/_metadata.json`

**Bằng chứng:**

- `git ls-files node_modules | wc -l` = 327 (tổng 496 file được track); gồm `rolldown-binding.darwin-arm64.node`; `ls -a` không thấy `.gitignore` gốc; `.git` 25 MB.
- Rủi ro phụ: một file `.env` đặt ở gốc không được ignore (chỉ `admin/.gitignore` ignore `.env`).

**Việc cần làm:** FND-01 (gỡ khỏi index, không viết lại lịch sử).

**Task:** FND-01

### GAP-307 — Test "blood moon" flaky làm `npm test` đỏ ~1/3 số lần

**Trạng thái:** `BUG` · **Khu vực:** Test

**File liên quan:** `test-engagement-features.js (dòng ~203–211)`, `src/systems/WaveSystem.js (dòng 561–568)`

**Bằng chứng:**

- Đo ba lần độc lập: lúc lập kế hoạch 8/12 lần thoát 1; kiểm chứng lần 2 (2026-11-10) 7/24 rồi 19/60 (≈ 31%); ghi chú cũ của dự án 2/9. Gộp **36/105 ≈ 34%** (khoảng tin cậy 95% ≈ 26–44%) — khớp với nguyên nhân gốc (~32%); con số "~67%" ở bản v1.0.0 là mẫu 12 lần ngoại lai và đã được hiệu chỉnh ở v1.1.0. Assertion đỏ luôn là `❌ FAIL: ghosts generated during a blood moon are faster`. Nguyên nhân: ghost tim/băng/xoáy trả `speedMultiplier` cố định 0/0,40/0,45 (bỏ qua `eventSpeedScale`), mẫu đầu ngẫu nhiên rơi vào nhóm này ~32%; RNG không gieo hạt.

**Việc cần làm:** TST-01 (sửa test; không sửa production).

**Task:** TST-01

### GAP-308 — `test-performance-system.js` không bao giờ trả exit code lỗi (xanh giả)

**Trạng thái:** `BUG` · **Khu vực:** Test

**File liên quan:** `test-performance-system.js`

**Bằng chứng:**

- File dùng soft-assert (tăng `failed`) và không có `process.exit`; đã quét 28 file test: đây là file duy nhất như vậy.

**Việc cần làm:** TST-02; runner TST-03 còn bắt thêm lỗi mềm bằng cách đọc bộ đếm "Failed".

**Task:** TST-02

### GAP-309 — 6 suite mồ côi ngoài `npm test` (3 hỏng, 3 xanh)

**Trạng thái:** `BUG` · **Khu vực:** Test

**File liên quan:** `package.json`, `scripts/test-center-cat-boss-tutorial.js`, `scripts/test-boss-minions-and-scary-face.js`, `scripts/test-monster-sounds.js`, `test-story-lore.js`, `test-powerups-freeze-blast.js`, `scripts/test-gesture-momo-sound.js`

**Bằng chứng:**

- Chạy riêng: `test-story-lore.js` 168 pass, `test-powerups-freeze-blast.js` 34 pass, `scripts/test-gesture-momo-sound.js` 72 pass.
- HỎNG: `scripts/test-center-cat-boss-tutorial.js` (1 assertion đỏ + `TypeError ... reading 'symbolQueue'`), `scripts/test-boss-minions-and-scary-face.js` (53 pass / 2 fail cố định; thêm 1 assertion chập chờn `Spawned minion has valid combat speed` đỏ 1/12 lần ở kiểm chứng lần 2 → 52 pass / 3 fail), `scripts/test-monster-sounds.js` (35 pass / 5 fail). Cả ba sửa lần cuối 2026-11-01 trong khi `WaveSystem`/`SoundSystem` đổi 04–06/11; hook âm thanh vẫn được gọi trong code thật (`Game.js:1535, 3286, 1592, 3174`) ⇒ nhiều khả năng test lỗi thời (cần triage để chắc, KHÔNG xoá assertion).

**Việc cần làm:** Runner + orphan guard + quarantine (TST-03); sửa từng suite (TST-04, TST-05, TST-06).

**Task:** TST-03, TST-04, TST-05, TST-06

### GAP-310 — Runtime tải tài nguyên trực tiếp từ google.com

**Trạng thái:** `BUG` · **Khu vực:** Game

**File liên quan:** `src/systems/SoundSystem.js (dòng 1817)`, `src/entities/Player.js (dòng 97)`

**Bằng chứng:**

- Cả hai file có URL dự phòng cuối cùng `https://www.google.com/logos/2016/halloween16/r4/...` (audio và sprite). Khi mọi bản sao cục bộ lỗi, game tải tài nguyên của bên thứ ba và để lộ IP người chơi. `index.html` còn tải Google Fonts (IPA-07/DEC-09).

**Việc cần làm:** Gỡ URL và thêm test chặn hotlink (IPA-02).

**Task:** IPA-02

### GAP-311 — Asset trùng lặp, đường dẫn sai gây 404, ba bản bundle trùng được track

**Trạng thái:** `BUG` · **Khu vực:** Repo · **Chờ quyết định:** DEC-08

**File liên quan:** `assets/`, `public/`, `dist/`, `arcane-paws-standalone.html`, `src/entities/Player.js`

**Bằng chứng:**

- md5: mỗi mp3/png lặp 3–5 lần (assets/, public/, public/audio/, public/assets/, dist/); `dist/index.html`, `dist/arcane-paws-standalone.html`, `arcane-paws-standalone.html` giống hệt nhau (667.200 B).
- Smoke test: loader sprite gọi `/assets/level1-png-sprite.png` và `/assets/level1-png1-sprite.png` → 404 rồi mới tìm thấy ở gốc; `public/audio/cat_meow.mp3` không được tham chiếu.

**Việc cần làm:** Dedupe + chuẩn hoá đường dẫn (IPA-03); chính sách artifact + script kiểm tra độ mới (FND-04).

**Task:** FND-04, IPA-03

### GAP-312 — Vòng lặp game dừng vĩnh viễn khi một khung ném ngoại lệ; không có handler lỗi toàn cục

**Trạng thái:** `BUG` · **Khu vực:** Game

**File liên quan:** `src/core/Game.js (loop: dòng 1062–1082; render: dòng 1092–1107)`, `main.js`, `index.html`, [`evidence/repro-game-loop.mjs`](./evidence/repro-game-loop.mjs)

**Bằng chứng:**

- `Game.loop()` gọi `this.update(dt)` rồi `this.render()` và chỉ đặt lại `requestAnimationFrame` ở dòng 1081, sau cả hai; không có `try/catch`/`finally`. Không nơi nào khác đặt lại vòng lặp (`_boundLoop` chỉ xuất hiện ở dòng 242, 1054, 1081; handler `visibilitychange` chỉ đặt lại `lastTime`).
- Tái hiện tất định bằng `node docs/ai-planning/evidence/repro-game-loop.mjs` (fake-context — kỹ thuật mà `scripts/test-boss-*.js` đã dùng): khung khỏe → rAF được đặt lại (PASS); `update()` ném lỗi → ngoại lệ thoát khỏi `loop`, rAF KHÔNG được đặt lại (FAIL); `render()` ném lỗi → tương tự (FAIL). Exit 1 trên code hiện tại; cùng script thoát 0 khi `loop` được vá bằng `try/catch` + đặt lại trong `finally` (đã kiểm chứng bằng vá trong bộ nhớ). Hệ quả: một ngoại lệ bất kỳ ⇒ canvas đứng hình vĩnh viễn, không thông báo, không đường quay lại ngoài tải lại trang.
- Không có handler lỗi toàn cục: `grep -rnE "onerror|unhandledrejection|addEventListener\('error'" src main.js index.html` chỉ thấy `onerror` của `<img>` (`Player.js:107`) và của MediaRecorder (`HighlightRecorder.js:183`). `main.js` khởi động trong một `DOMContentLoaded` async không có `try/catch` nên lỗi lúc dựng `Game` cũng không hiện gì.
- Chi tiết kỹ thuật (đọc source): `render()` gọi `ctx.save(); ctx.scale(dpr, dpr)` rồi `ctx.restore()` ở cuối mà không có `try/finally`. Nếu chỉ bọc vòng lặp bằng `try/catch`, các `save()` lồng bên trong (ví dụ `Enemy.render`) không được `restore()` và `restore()` ngoài cùng bị bỏ qua ⇒ ma trận biến đổi bị nhân `dpr` dồn qua các khung. Bản sửa phải khôi phục trạng thái canvas (`ctx.reset()`), không chỉ bắt lỗi.
- CHƯA tìm thấy đường dẫn cụ thể nào đang ném lỗi — đây là lỗ hổng chịu lỗi tiềm ẩn; mức phơi nhiễm tăng khi dữ liệu từ CMS chảy vào đường update/render (RUN-03..07). Đã kiểm cả 17 khối `catch {}` rỗng trong `src/`: đều là thao tác best-effort (dừng/nối nút âm thanh, `navigator.vibrate`, `releasePointerCapture`, `localStorage`) — không phải nguồn của lỗi này.

**Việc cần làm:** Bọc khung bằng `try/catch` + đặt lại rAF trong `finally`, khôi phục canvas, handler lỗi toàn cục chỉ ghi log, màn hình khôi phục sau ≥ 3 khung lỗi liên tiếp, bảo vệ khởi động trong `main.js`, test hồi quy (ARC-06).

**Task:** ARC-06

### GAP-401 — Tình trạng giấy phép của asset/thương hiệu có nguồn gốc Google Doodle

**Trạng thái:** `UNKNOWN` · **Khu vực:** IP · **Chờ quyết định:** DEC-03, DEC-04

**File liên quan:** `src/systems/SoundSystem.js (dòng 21)`, `src/entities/momoSprites.js (dòng 4)`, `src/entities/Player.js (dòng 60–77)`, `src/core/Constants.js (đầu file)`, `public/`, `assets/`

**Bằng chứng:**

- Chú thích trong code: âm thanh "Extracted directly from official Google Doodle audio sheets"; sprite "Extracted directly from Google Doodle level1-png-sprite.png, …"; đầu `Constants.js`: "based on Google Doodle Halloween 2016 (Magic Cat Academy)". Menu hiển thị "MAGIC CAT ACADEMY". Không có bằng chứng giấy phép trong repo.
- ĐÂY LÀ RỦI RO ĐƯỢC PHÁT HIỆN TRONG SOURCE, KHÔNG PHẢI KẾT LUẬN PHÁP LÝ — cần chủ dự án xác nhận nguồn gốc/giấy phép.

**Việc cần làm:** Kiểm kê (IPA-01), thay thế/gỡ theo DEC-03 (IPA-04), thống nhất tên (IPA-05), LICENSE/NOTICES (IPA-06).

**Task:** IPA-01, IPA-04, IPA-05, IPA-06

### GAP-402 — Hiệu năng/độ chính xác trên thiết bị thật chưa được xác minh

**Trạng thái:** `UNKNOWN` · **Khu vực:** Game

**File liên quan:** `src/systems/QualityManager.js`, `test-mobile-optimization.js`, `test-enemy-render-performance.js`

**Bằng chứng:**

- Test mobile (75 assertion) và render (46) chạy với mock; smoke test dùng Chrome headless trên máy phát triển. Chưa có đo FPS tự động hay thử trên điện thoại thật.

**Việc cần làm:** Harness rAF-interval + hướng dẫn đo trên thiết bị thật (REL-02).

**Task:** REL-02

### GAP-403 — Audio chưa được thực thi trong trình duyệt thật

**Trạng thái:** `UNKNOWN` · **Khu vực:** Game

**File liên quan:** `src/systems/SoundSystem.js`

**Bằng chứng:**

- Smoke test không kích hoạt âm thanh (autoplay chính sách trình duyệt); chưa biết các sheet mp3 giải mã được và nhánh tổng hợp phát được trong Chrome.

**Việc cần làm:** REL-01 (kiểm tra giải mã/phát trong trình duyệt).

**Task:** REL-01

### GAP-404 — Preview enemy của Gameplay Studio chưa chạy trong trình duyệt thật

**Trạng thái:** `UNKNOWN` · **Khu vực:** Admin

**File liên quan:** `admin/src/GameplayPage.tsx`, `admin/src/GameplayPage.test.tsx`

**Bằng chứng:**

- `RuntimePreview` gọi `new Enemy(...).render(ctx)`; UI test mock `HTMLCanvasElement.prototype.getContext` trả `null` nên đường vẽ chưa được thực thi.

**Việc cần làm:** REL-01.

**Task:** REL-01

### GAP-405 — Lỗ hổng phụ thuộc chưa được rà soát

**Trạng thái:** `UNKNOWN` · **Khu vực:** Repo

**File liên quan:** `pnpm-lock.yaml`, `admin/package-lock.json`

**Bằng chứng:**

- Không chạy `audit` trong giai đoạn phân tích vì cần truy cập mạng; chưa từng có audit nào.

**Việc cần làm:** SEC-03.

**Task:** SEC-03

