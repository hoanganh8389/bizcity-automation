# Rà soát

<!-- [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 — khung từ bizcity-platform templates/delivery (chuẩn bizcity_delivery@1 §4; khuôn open-ketoan docs/reviews, RULE-REVIEW). -->

Nơi ghi các lần rà soát định kỳ của repo: sau mỗi vài phase, sau mỗi đợt đóng góp lớn, trước khi phát hành. Mỗi lần một tệp `REVIEW-<YYYY-MM-DD>-<phạm-vi>.md`. Chuẩn: [`bizcity_delivery@1` §4](https://github.com/hoanganh8389/bizcity-platform/blob/main/docs/standard/BIZCITY-DELIVERY-v1.md).

## Mỗi PR (không ghi ở đây, ghi trong PR)

- Việc gì, phiếu nghiệm thu / mã việc nào.
- **Khối Bằng chứng chạy máy:** lệnh đã chạy + kết quả (bộ kiểm, test, typecheck); chỗ đỏ có sẵn trên `main` ghi rõ là có sẵn.
- Người duyệt khác người làm.

## Một lần rà định kỳ

```markdown
# Rà soát <YYYY-MM-DD> — <phạm vi: phase / người đóng góp / cả repo>

**Kết luận:** ĐẠT · ĐẠT có điều kiện · KHÔNG ĐẠT
**Đã chạy:** <lệnh + kết quả: standard-check, users-check, delivery-check --report, test của repo>

| # | Phát hiện | Luật | Ở đâu (tệp:dòng) | Mức (chặn / cảnh báo / gợi ý) | Giao cho | Trạng thái |
|---|---|---|---|---|---|---|

**So với lần rà trước:** <tốt lên / xấu đi ở đâu>
```

- Mỗi phát hiện dẫn **mã luật** và **tệp:dòng**; không dẫn được luật nào thì chỉ là gợi ý.
- Không sửa âm thầm việc của người khác — giao việc, ghi người nhận.
- Lỗi lặp lại ⇒ đề xuất thêm phép kiểm tự động.

## Danh sách lần rà

| Ngày | Phạm vi | Kết luận |
|---|---|---|
