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
