# Nợ chuẩn nền — Open Automation

<!-- [2026-11-25 01:45 PM Johnny Chu - Chu Hoàng Anh] STD-5 — sinh bởi bizcity-platform tools/no-chuan.mjs (R-STD-9). Sửa nợ ở repo này; thêm / bớt mục "đã biết" thì sửa sổ docs/standard/no-chuan.json bên bizcity-platform rồi sinh lại. -->

> Ngày đo: 2026-11-25 · Repo: `bizcity-automation` · Chuẩn: [bản đồ chuẩn nền `bizcity_standard_map@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/README.md) · Kiến trúc: [ARCHITECTURE](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/ARCHITECTURE.md)

Tệp này liệt kê chỗ repo **chưa theo khuôn chung** của hệ. Dev của repo trả dần, mỗi lần một mục, theo nếp giữ chỗ / PR của repo. bizcity-platform giữ khuôn và bộ kiểm; **không ai sửa hộ** và **không nới chuẩn để trả nợ**.

## Định hướng phải giữ khi trả nợ

1. Mỗi app một sổ, một trục; tham chiếu app khác bằng ID của chủ (`item_id`, `doc_ref`, `contact_id`, `sub`), không bịa ID, không đọc CSDL chéo.
2. Người dùng · vai · quyền theo một khuôn ([USERS-ROLES](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-USERS-ROLES-v1.md)): bảng của gói nền, quyền `<module>:<chức-năng>-<động-từ>` tiếng Việt không dấu, từ chối luôn thắng, khoá API không mang quyền rủi ro cao. App tự đứng được không cần Hub; SSO nối sau.
3. Không ghi "xong" khi chưa có phép kiểm chạy được; nợ mới không vào baseline.
4. Đổi thứ dùng chung (hợp đồng, quyền, migration) có chữ chốt trước, có bằng chứng chạy máy trong PR.
5. Mọi ứng dụng 0 đồng; chỉ 1API của Zalo Hub và dịch vụ theo liên hệ tính phí.

## Nợ do bộ kiểm đo (7)

| Mã | Mức | Ở đâu | Việc |
|---|---|---|---|
| SC-STD-2 | cảnh báo | `README.md` | thiếu |
| SC-STD-2 | cảnh báo | `AGENTS.md` | thiếu hướng dẫn cho người và agent (AGENTS.md hoặc CLAUDE.md) |
| SC-STD-2 | cảnh báo | `CHANGELOG.md` | thiếu |
| SC-STD-2 | cảnh báo | `LICENSE` | thiếu |
| SC-USER-5 | cảnh báo | `bizcity.authz.json` | chưa có tệp khai báo quyền / vai (plugin WordPress: viết tay theo bizcity_authz_manifest@1) |
| SC-DLV-1 | cảnh báo | `docs/nghiem-thu/` | chưa có thư mục phiếu nghiệm thu (README.md + _MAU.md) — R-STD-DLV-1 |
| SC-DLV-6 | cảnh báo | `docs/reviews/` | chưa có nơi ghi rà soát định kỳ (R-STD-DLV-8) |

## Nợ đã biết từ rà soát (2)

| # | Luật | Việc | Lưu ý | Chuẩn |
|---|---|---|---|---|
| 1 | R-USER-13 | Viết tay `bizcity.authz.json` | — | [USERS-ROLES](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-USERS-ROLES-v1.md) |
| 2 | C-9-11 | Sửa câu "bán riêng theo gói": mọi ứng dụng 0 đồng | — | [HUB](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-HUB-v1.md) |

## Trả nợ thế nào

1. Chọn một mục; nhận việc theo nếp của repo (giữ chỗ nếu có `docs/phases/CLAIMS.md`).
2. Làm theo chuẩn được dẫn; có phép kiểm hoặc test chứng minh.
3. Chạy lại bộ kiểm (bizcity-platform cạnh repo này):

```bash
node ../bizcity-platform/tools/standard-check.mjs --repo .
node ../bizcity-platform/tools/users-check.mjs --repo .
node ../bizcity-platform/tools/no-chuan.mjs --repo . --write   # sinh lại tệp này
```

4. Mục "đã biết" trả xong: PR nhỏ vào bizcity-platform gỡ mục khỏi [sổ nợ chuẩn nền](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/no-chuan.json), rồi sinh lại tệp này.
