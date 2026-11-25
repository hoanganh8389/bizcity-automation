# Nghiệm thu tính năng

<!-- [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 — khung từ bizcity-platform templates/delivery (chuẩn bizcity_delivery@1, khuôn open-ketoan docs/nghiem-thu). -->

Mỗi tính năng có **một phiếu nghiệm thu** trong thư mục này. Phiếu là **thước đo duy nhất** để nói một tính năng "xong": có tình huống bằng số liệu thật, kết quả mong đợi, kết quả phần mềm chạy ra, và biên bản của bộ phận sử dụng. Chuẩn: [`bizcity_delivery@1`](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-DELIVERY-v1.md).

Chưa có phiếu **Đã chốt** thì chưa code tính năng (sửa lỗi nhỏ, đổi giao diện không cần phiếu).

## Cấu trúc

```
<thư mục này>/
  README.md                      tệp này (danh sách phiếu ở cuối do công cụ sinh)
  _MAU.md                        mẫu phiếu — chép ra để viết phiếu mới
  <phân hệ>/NT-<MÃ>-<số>-<tên-ngắn>.md
```

- **Mã:** `NT-<MÃ PHÂN HỆ>-<3 chữ số>`, tăng dần trong phân hệ, không dùng lại số đã bỏ. Tên ngắn không dấu, nối bằng gạch ngang.
- **Không ghi tên người** trong phiếu; ghi **bộ phận** (Kho, Bán hàng, Chăm sóc khách hàng…).

## Trạng thái phiếu (từ khoá cố định)

Ô *Trạng thái* bắt đầu bằng **đúng một** từ khoá; ngày và ghi chú để sau dấu `—` (ví dụ `Chờ nghiệm thu — 25/11/2026`).

| Từ khoá | Nghĩa | Ai chuyển |
|---|---|---|
| `Nháp` | đang viết tình huống | người nhận yêu cầu |
| `Đã chốt` | bộ phận sử dụng đồng ý tình huống và kết quả mong đợi — được code | bộ phận sử dụng |
| `Đang làm` | đã giao việc | người làm |
| `Chờ nghiệm thu` | test tự động khoá đúng kết quả, đã ghi §7 | người làm |
| `Đạt` / `Chưa đạt` | bộ phận sử dụng chạy lại trên phần mềm thật, ghi §8 biên bản | bộ phận sử dụng |
| `Huỷ` | không làm nữa, ghi lý do ở §9 | chủ dự án |

## Quy trình

1. **Viết phiếu** từ `_MAU.md` → **chốt** với bộ phận sử dụng.
2. **Giao việc** kèm đường dẫn phiếu; làm theo nếp PR của repo.
3. **Test tự động** khoá đúng kết quả của phiếu; tên test (`describe`) mở đầu bằng mã phiếu.
4. **Ghi §7 Kết quả chạy**: commit, tệp test, bảng so mong đợi ↔ phần mềm → `Chờ nghiệm thu`.
5. **Nghiệm thu** với bộ phận sử dụng trên phần mềm thật → §8 biên bản → `Đạt` / `Chưa đạt`.

Xem trạng thái: `node ../bizcity-platform/tools/delivery-check.mjs --repo . --report`

## Danh sách phiếu

<!-- nghiem-thu:danh-sach:bat-dau — phần dưới do `delivery-check.mjs --repo . --write-index` sinh, không sửa tay -->
Chưa có phiếu.
<!-- nghiem-thu:danh-sach:ket-thuc -->
