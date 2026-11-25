# Canon chung và xương sống xuyên app — áp cho bizcity-automation (Open Automation)

<!-- [2026-11-24 06:40 PM Johnny Chu - Chu Hoàng Anh] SPINE-3 — gieo canon theo Q-SPINE-4 (chủ duyệt 2026-11-24). Tài liệu thuần, không đổi mã. -->

| Tài liệu | Ở đâu |
|---|---|
| **BIZCITY OPEN CANON** | [open-hub/docs/canon](https://github.com/hoanganh8389/open-hub/blob/main/docs/canon/README.md) |
| **`bizcity_spine@1`** — xương sống xuyên app | [bizcity-platform/docs/standard/BIZCITY-SPINE-v1.md](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-SPINE-v1.md) |
| Canon riêng của repo | [AUTOMATION-0-CANON.md](../AUTOMATION-0-CANON.md) |

## Open Automation trong xương sống (`bizcity.app.json`)

| | |
|---|---|
| Làm chủ | `automation_run` — lượt chạy kịch bản (R-CANON-1: "Automation: lượt chạy") |
| Dùng | `tenant`, `user` (`sub = wp:<id>`), `document` (sự kiện mang `doc_ref` của app phát; hành động trả về `doc_ref` mới nếu có) |
| Vào / ra | **vào:** sự kiện `bizcity_event@1` (outbox / webhook HMAC, idempotent theo `event_id`); **ra:** MCP của app chủ, ghi = nháp / chờ duyệt với `confirm_token` |

## Ba điều không làm

- Không ghi thẳng bảng của app khác; không gọi route ghi nội bộ của app khác.
- Không giữ bản sao danh mục như nguồn sự thật; cần dữ liệu thì đọc qua MCP tại thời điểm chạy.
- Không thêm trục mới ở repo này.

## Giấy phép

Mọi ứng dụng Bizcity Open **0đ** (chủ chốt 2026-11-24). Dòng "bán riêng theo gói" trong mô tả plugin không còn đúng và sẽ bị `spine-check` nhắc.

## Kiểm

```bash
node ../bizcity-platform/tools/spine-check.mjs --manifest bizcity.app.json   # SC-SPINE-1, phải ĐẠT
```

## Chuẩn nền của hệ (bizcity-platform)

<!-- [2026-11-25 10:04 AM Johnny Chu - Chu Hoàng Anh] STD-2 — trỏ về bản đồ chuẩn nền bizcity_standard_map@1 (bản nháp chờ duyệt) để repo này đi cùng hướng với cả hệ. Không đổi mã. -->

Repo này theo **[bản đồ chuẩn nền `bizcity_standard_map@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/README.md)**: bốn trục dữ liệu (master data, chứng từ, khách 360, người dùng) và mười hai trụ cột kỹ thuật. Bức tranh toàn hệ: [ARCHITECTURE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/ARCHITECTURE.md). Thứ tự luật: canon chung (open-hub) → chuẩn nền (bizcity-platform) → luật của repo này; luật của repo **không được nới** hai tầng trên.

| Việc ở repo này | Chuẩn |
|---|---|
| Khuôn repo, manifest, nếp làm việc | [APP-SKELETON](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-APP-SKELETON-v1.md) |
| API, kiểm đầu vào / đầu ra | [API-PROFILE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-API-PROFILE-v1.md) |
| Người dùng, vai, quyền, đăng nhập một lần | [USERS-ROLES](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-USERS-ROLES-v1.md) · [IDENTITY](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-IDENTITY-v1.md) |
| Bảo mật · quan sát và truy lỗi · đệm | [SECURITY](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-SECURITY-v1.md) · [OBSERVABILITY](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-OBSERVABILITY-v1.md) · [CACHE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-CACHE-v1.md) |
| Kiểm thử · phiên bản, migration, sao lưu, nâng cấp | [TESTING](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-TESTING-v1.md) · [RELEASE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-RELEASE-v1.md) |
| Giao diện React (model · view · controller), mockup | [WEB](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-WEB-v1.md) |
| Nhiều site / nhiều CSDL · Hub, khoá, 1API | [MULTISITE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-MULTISITE-v1.md) · [HUB](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-HUB-v1.md) |

Kiểm khuôn repo (mức S0–S3):

```bash
node ../bizcity-platform/tools/standard-check.mjs --repo .
```

Lần kiểm 2026-11-25 còn:

- SC-STD-2 (cảnh báo): `README.md` — thiếu
- SC-STD-2 (cảnh báo): `AGENTS.md` — thiếu hướng dẫn cho người và agent (AGENTS.md hoặc CLAUDE.md)
- SC-STD-2 (cảnh báo): `CHANGELOG.md` — thiếu
- SC-STD-2 (cảnh báo): `LICENSE` — thiếu
