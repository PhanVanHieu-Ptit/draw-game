# REQUIREMENTS

Repo **không có PRD riêng**. Yêu cầu dưới đây được tổng hợp từ các nguồn thật: [`docs/GDD.md`](../GDD.md), [`docs/combat.md`](../combat.md), [`docs/configuration-management.md`](../configuration-management.md), [`docs/gameplay-content-editors.md`](../gameplay-content-editors.md), [`docs/story-cms.md`](../story-cms.md), [`docs/gesture-recognition-report.md`](../gesture-recognition-report.md), [`admin/README.md`](../../admin/README.md) và hành vi của code. Cột **Type**: `Explicit` = được viết trong tài liệu; `Derived` = suy ra từ thực hành chuẩn hoặc từ code — **cần chủ dự án xác nhận** (xem câu hỏi ở cuối).

> Bảng được `plan.mjs validate` kiểm tra: yêu cầu không COMPLETED phải trỏ tới ≥ 1 GAP (truy vết yêu cầu → GAP → task).

## Bảng yêu cầu

| ID | Source | Statement | Type | Status | Gaps |
|---|---|---|---|---|---|
| REQ-G01 | GDD §1 | Vòng lặp lõi: quái xuất hiện từ rìa → người chơi vẽ ký hiệu → nhận diện → thanh tẩy/điểm; quái chạm → mất 1 HP + i-frame; HP = 0 → game over. | Explicit | COMPLETED | GAP-003 |
| REQ-G02 | GDD §2 | Danh mục 6 ký hiệu và cơ chế phép thuật (AoE ngang, xuyên dọc, combo ∧∨, sét dây chuyền, hồi tim). | Explicit | PARTIAL | GAP-001, GAP-102 |
| REQ-G03 | GDD §3.1 | Ba loại quái (Thường / Tốc Độ / Bọc Thép) với số ký hiệu và tốc độ xác định. | Explicit | PARTIAL | GAP-102 |
| REQ-G04 | GDD §3.2 A–D | Công thức số quái, khoảng spawn, hệ số tốc độ và ma trận phân bổ theo wave. | Explicit | PARTIAL | GAP-102 |
| REQ-G05 | GDD §3.2 E | Cân bằng độ khó động (DDA): nới khi HP ≤ 2; tăng tốc khi combo ≥ 15. | Explicit | PARTIAL | GAP-102 |
| REQ-G06 | GDD §4 | Điểm = cơ bản × bội số combo (×1…×5); combo decay; thưởng bọc thép/sét/tim. | Explicit | PARTIAL | GAP-003, GAP-102 |
| REQ-G07 | GDD §5 | Thiết kế hướng dữ liệu: WaveConfig, EnemyTemplate, PlayerState dạng JSON schema. | Explicit | PARTIAL | GAP-101, GAP-102 |
| REQ-G08 | GDD §6 | Nhận diện cử chỉ độ trễ thấp (Dollar + heuristic) giữ 60 FPS trên mobile và desktop. | Explicit | COMPLETED | GAP-001 |
| REQ-G09 | GDD §7 | HUD (HP, điểm, wave, combo), vòng nguy hiểm, slow-motion "Hero Save". | Explicit | PARTIAL | GAP-102 |
| REQ-G10 | GDD §8 | Lớp gắn kết: bất ngờ giữa wave, câu thần chú, Boss Rush, Tủ Đồ, clip khoảnh khắc. | Explicit | COMPLETED | GAP-005 |
| REQ-G11 | GDD §9 | Cốt truyện & bí ẩn "Cái Tên Bị Lãng Quên": mảnh ký ức, lời hứa, hai cái kết, Nhật Ký. | Explicit | COMPLETED | GAP-006 |
| REQ-G12 | docs/combat.md | Tùy chọn chiến đấu độc lập: Perfect Cast, Chain Reaction, tương tác nguyên tố, loadout, elite. | Explicit | PARTIAL | GAP-002, GAP-103 |
| REQ-A01 | admin/README.md | Xác thực phía server, RBAC 5 vai trò, phiên HttpOnly/SameSite, throttle, không có quyền chỉ ở frontend. | Explicit | PARTIAL | GAP-008, GAP-303, GAP-305 |
| REQ-A02 | docs/configuration-management.md | Vòng đời cấu hình (draft → validate → review → publish → rollback), endpoint công khai chỉ trả bản publish, game ghim snapshot theo ván. | Explicit | COMPLETED | GAP-007 |
| REQ-A03 | docs/gameplay-content-editors.md | Gameplay Studio: editor enemy/boss/wave theo schema, undo/redo, import/export, vòng đời + audit, ngân sách 10.000 spawn. | Explicit | PARTIAL | GAP-301, GAP-303, GAP-404 |
| REQ-A04 | docs/gameplay-content-editors.md (Runtime integration boundary) | Game tiêu thụ content đã publish qua adapter ánh xạ vào hệ thống chiến đấu/wave hiện có. | Explicit | MISSING | GAP-101 |
| REQ-A05 | docs/story-cms.md | Story CMS: editor đồ thị, preview, publish bất biến, game nạp nội dung đã publish và fallback. | Explicit | PARTIAL | GAP-006, GAP-302, GAP-304 |
| REQ-A06 | admin/src/pages.tsx (mô tả module) | Live Operations, Players, Analytics hoạt động với dữ liệu thật. | Derived | PARTIAL | GAP-104 |
| REQ-A07 | admin/README.md (Deployment boundary) | Vận hành production an toàn khi mở rộng: DB giao dịch, session dùng chung, IdP/đa tài khoản. | Explicit | PARTIAL | GAP-110, GAP-114 |
| REQ-N01 | GDD §6–§7; docs/gesture-recognition-report.md | Hiệu năng: nhận diện < 16 ms và giữ 60 FPS. | Explicit | UNKNOWN | GAP-402 |
| REQ-N02 | GDD (Nền tảng: Web, Mouse & Touch) | Chạy tốt trên mobile với cảm ứng. | Explicit | PARTIAL | GAP-107, GAP-108, GAP-402 |
| REQ-N03 | scripts/export-bundle.js | Bản standalone một file chạy offline ("100% self-contained"). | Explicit | PARTIAL | GAP-106 |
| REQ-N04 | Suy ra từ Settings (colorBlind, altInput, assist) | Accessibility cho người chơi. | Derived | PARTIAL | GAP-107 |
| REQ-N05 | shared/story + main.js | Bản địa hóa tiếng Việt/Anh. | Derived | PARTIAL | GAP-105 |
| REQ-N06 | admin/README.md + thực hành chuẩn | Bảo mật: chống XSS, CSRF, brute-force, RBAC, không rò bí mật, tài nguyên từ nguồn tin cậy. | Derived | PARTIAL | GAP-304, GAP-305, GAP-310, GAP-405 |
| REQ-N07 | Thực hành chuẩn | Kiểm thử đáng tin cậy và CI tự động cho mọi thay đổi. | Derived | PARTIAL | GAP-108, GAP-201, GAP-307, GAP-308, GAP-309 |
| REQ-N08 | Thực hành chuẩn | Build và phát hành tái lập, repo sạch. | Derived | PARTIAL | GAP-009, GAP-115, GAP-306, GAP-311 |
| REQ-N09 | Thực hành chuẩn | Tuân thủ giấy phép/IP của asset, tên và phụ thuộc. | Derived | UNKNOWN | GAP-202, GAP-310, GAP-401 |
| REQ-N10 | Thực hành chuẩn | Tài liệu đủ để người mới vận hành và đóng góp. | Derived | PARTIAL | GAP-109 |
| REQ-N11 | Thực hành chuẩn | Độ bền runtime: một lỗi bất ngờ ở một khung hình (game) hoặc một trang (Admin) không được làm game đứng hình vĩnh viễn hay Admin trắng trang; người dùng được thông báo, giữ được tiến độ và có đường quay lại. | Derived | PARTIAL | GAP-312, GAP-204 |

**Tổng hợp:** 30 yêu cầu — COMPLETED 5 · PARTIAL 22 · MISSING 1 · BUG 0 · UNKNOWN 2.

## Ghi chú diễn giải

- **REQ-G02…G07, G09 (PARTIAL):** hành vi cốt lõi có và có test, nhưng GDD v1.0.0 lệch code (8 rune, số liệu, độ khó). Đây là lệch TÀI LIỆU, không phải lỗi chức năng — cần DEC-01 để chốt nguồn sự thật (GAP-102).
- **REQ-A04 (MISSING):** yêu cầu duy nhất hoàn toàn chưa có ở runtime; chính docs đã nêu "cần adapter phía game". Chiếm 30 SP trong kế hoạch (nhóm RUN).
- **REQ-N01 (UNKNOWN):** độ trễ nhận diện đã được tài liệu hóa (p95 0,176 ms) nhưng FPS trên thiết bị thật chưa từng được đo tự động.
- **REQ-N09 (UNKNOWN):** không phải kết luận pháp lý — là rủi ro phát hiện trong source (GAP-401).

## Câu hỏi cần chủ dự án xác nhận

Danh sách đầy đủ, có phương án và khuyến nghị, nằm ở mục "Danh sách quyết định" của [SPRINT_PLAN.md](./SPRINT_PLAN.md) và trạng thái ở [PROGRESS.md](./PROGRESS.md). Các câu hỏi liên quan trực tiếp tới yêu cầu:

1. Số liệu cân bằng nào là chuẩn — GDD hay code? (DEC-01 → REQ-G02…G06)
2. Gameplay content phải điều khiển game theo mô hình nào? (DEC-02 → REQ-A04)
3. Có kế hoạch cho LiveOps/Players/Analytics không? Đây mới là yêu cầu SUY RA (DEC-06 → REQ-A06).
4. Phạm vi vận hành của Admin — công cụ nội bộ hay public? (DEC-05 → REQ-A07)
5. Có cần giao diện đa ngôn ngữ? (DEC-07 → REQ-N05)
6. Tình trạng giấy phép của audio/sprite và tên thương hiệu (DEC-03, DEC-04 → REQ-N09)
