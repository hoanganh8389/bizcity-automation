# GAP ANALYSIS — Logic Branch Edge trong Core Automation

Ngày: 2026-07-03  
Phạm vi: UI Builder, schema graph, runtime runner, template/docs contract

## 1) Bối cảnh vấn đề

Case thực tế đang gặp: node điều kiện "Có bản đồ sao?" không thể hiện đúng nhánh if/else trong UI; điểm out không bám rõ sang nhánh LLM (true) và nhánh reply lỗi (false). Người dùng khó biết chọn true/false ở đâu, và flow chạy sai kỳ vọng.

## 2) Contract đúng (đang được runner dùng)

Để if/else chạy đúng trong core automation, contract hiện hành cần:

- Node điều kiện phải có:
  - `type = "condition"`
  - `data.blockId = "logic.condition"`
  - `data.expression` có biểu thức
- Edge rẽ nhánh từ node condition phải có `sourceHandle`:
  - `"true"` đi nhánh thành công (tiếp tục xử lý)
  - `"false"` đi nhánh fallback (ví dụ reply "chưa có bản đồ sao")
- Runner đọc `out.branch` từ block `logic.condition` và chỉ giữ nhánh có handle khớp.

## 3) Điểm gãy đã xác định

### P0-1 — Sai node type trong template thật (logic vs condition)

Trong template astro đang dùng, node `chk` khai báo:

- `"type": "logic"`

Trong khi frontend chỉ đăng ký renderer cho `condition`, không có `logic`.

Hệ quả:

- React Flow fallback sang default node (không có 2 handle true/false chuẩn).
- UI biểu diễn rẽ nhánh bị "lệch", người dùng không thấy branch UX đúng.

### P0-2 — Sai field cấu hình điều kiện (condition vs expression)

Template astro đang lưu:

- `data.condition = "{{n1.has_chart}} == 1"`

Trong khi block `logic.condition` chỉ đọc:

- `data.expression`

Hệ quả:

- Inspector mở ra thấy ô "Biểu thức" trống.
- Runtime coi expression rỗng và mặc định trả branch `true`.
- Nhánh false không bao giờ chạy, nên fallback reply "chưa có bản đồ sao" không kích hoạt.

### P0-3 — Duplicate edge trên condition làm vỡ semantics if/else

Trong kịch bản đính kèm (workflow id 35) đang đồng thời tồn tại 2 cặp edge từ `chk`:

- Cặp đúng theo branch:
   - `e_chk_err` với `sourceHandle = "false"`
   - `e_chk_n3` với `sourceHandle = "true"`
- Cặp duplicate phát sinh từ canvas:
   - `xy-edge__chk-errin` (không có `sourceHandle`)
   - `xy-edge__chk-n3in` (không có `sourceHandle`)

Hệ quả ở runtime:

- Runner map edge thiếu handle thành `out`.
- Với node condition, logic hiện tại giữ cả edge có handle khớp branch và edge `out`.
- Vì vậy, dù branch là `true` hay `false`, 2 edge `out` vẫn được giữ => cả nhánh LLM (`n3`) và nhánh fallback (`err`) có thể cùng chạy.

Đây là điểm gãy mức P0 vì làm sai hành vi nghiệp vụ (if/else không còn độc quyền nhánh).

### P1-1 — Contract handle bị drift giữa nhiều nguồn tài liệu/code cũ

Hiện đang tồn tại đồng thời các kiểu handle cũ:

- `yes/no`
- `output-right/output-left`
- `out`

Nhưng UI condition hiện tại và runtime branch mới đang định hướng `true/false`.

Hệ quả:

- Cùng là "if/else" nhưng mỗi nguồn dùng 1 naming khác nhau.
- Người cấu hình không biết chọn gì là đúng trong node/edge.
- Dễ tạo edge "có nối" nhưng branch semantics sai.

### P1-2 — Runner có đoạn fallback comment không khớp hành vi

Trong runner có comment "No handle matched -> keep all", nhưng code thực tế vẫn mark nhánh discarded.

Hệ quả:

- Nếu gặp workflow cũ dùng handle lạ (vd `default`), có thể skip sai toàn bộ downstream.

### P1-3 — AI Builder normalize handle về `default`

Ở endpoint AI build workflow, edge sanitize default:

- `sourceHandle = "default"`
- `targetHandle = "default"`

Hệ quả:

- Graph AI sinh ra có condition edge không theo contract true/false.
- Chạy runtime branch không ổn định (phụ thuộc fallback path).

### P2-1 — UX thiếu control edge-level cho branch

Inspector hiện chỉ cấu hình node data; chưa có UI rõ ràng để:

- Chọn edge này thuộc nhánh true hay false
- Hiển thị badge/label ngay trên edge để phân biệt nhanh

Hệ quả:

- Người dùng phải "đoán" qua vị trí dây nối.
- Khi graph dày, rất dễ nối nhầm.

## 4) Repro ngắn cho case "Có bản đồ sao?"

1. Import/open workflow từ `templates/astro-zalobot.json`.
2. Chọn node `chk` (Có bản đồ sao?).
3. Quan sát Inspector:
   - ô `Biểu thức` trống (vì data dùng key `condition`)
4. Run thử với user chưa có chart:
   - vẫn đi nhánh true (vì expression rỗng => branch true mặc định)
   - nhánh false reply không chạy.

## 4.1) Repro chính xác theo kịch bản đính kèm (id 35)

Kịch bản này xác nhận cùng lúc 3 lỗi P0:

1. Node `chk` có `type = "logic"` (không phải `condition`) nên UI render sai node condition.
2. `chk.data` dùng `condition` thay vì `expression` nên evaluate bị rỗng.
3. Có duplicate edge từ `chk` đến cả `err` và `n3` với id dạng `xy-edge__*` không có `sourceHandle`.

Mô phỏng runner khi branch=`true`:

- Giữ edge `sourceHandle=true` (đúng)
- Đồng thời giữ toàn bộ edge `out` (do thiếu handle)
- Kết quả: `n3` chạy, và `err` cũng có thể bị chạy theo edge `out`

Mô phỏng runner khi branch=`false`:

- Giữ edge `sourceHandle=false` (đúng)
- Đồng thời giữ toàn bộ edge `out`
- Kết quả: `err` chạy, và `n3` cũng có thể bị chạy theo edge `out`

=> Semantics if/else bị phá vỡ hoàn toàn.

## 5) Đề xuất chuẩn hóa contract (để chốt 1 chuẩn duy nhất)

### Chuẩn schema

- Condition node:
  - `type = "condition"`
  - `blockId = "logic.condition"`
  - `data.expression` bắt buộc
- Branch edge:
  - `sourceHandle` chỉ nhận `"true"`, `"false"`, hoặc `"out"` (legacy linear)

### Chuẩn UI

- Node condition luôn render 2 output handles rõ nhãn `true`/`false`.
- Khi tạo edge từ condition:
  - auto gán label edge theo `sourceHandle`
  - inspector edge cho phép đổi true <-> false
- Nếu gặp node type `logic` khi load:
  - tự migrate sang `condition` trong FE hydration
  - hiển thị warning migration 1 lần.

### Chuẩn runtime

- Nếu condition có edge handle không thuộc set hợp lệ:
  - log warning `invalid_condition_handle`
  - fallback an toàn rõ ràng (không skip toàn bộ ngầm).

## 6) Danh sách điểm cần sửa (đề xuất implementation)

1. Data migration template astro
   - `type: logic -> condition`
   - `data.condition -> data.expression`
   - loại toàn bộ duplicate edge condition không có `sourceHandle`
2. FE graph hydration
   - map `node.type === "logic"` thành `"condition"`
   - nếu gặp edge từ condition thiếu `sourceHandle`, tự chuẩn hoá hoặc chặn save
3. FE edge UX
   - hiển thị label true/false trên edge condition
   - thêm chỉnh `sourceHandle` ở inspector khi chọn edge
4. Runner hardening
   - xử lý explicit khi không có kept branch
   - với node condition: không tự giữ `out` khi đã tồn tại edge branch true/false
   - log warning khi phát hiện duplicate edge condition cùng source-target khác handle
5. AI Builder sanitize
   - không default `sourceHandle=default` cho condition branch
6. Docs/test alignment
   - bỏ `yes/no`, `output-right/output-left` khỏi tài liệu active
   - cập nhật test branch theo `true/false`

## 7) Acceptance criteria

- [ ] Node condition luôn hiển thị đúng renderer, không fallback default box.
- [ ] Ô `Biểu thức` luôn có giá trị đúng khi mở workflow có condition.
- [ ] Case chưa có chart đi đúng nhánh false và gửi reply fallback.
- [ ] Case có chart đi nhánh true và nối sang node LLM tổng quan.
- [ ] Một lần chạy chỉ đi đúng một nhánh sau condition; không còn hiện tượng chạy đồng thời `err` + `n3`.
- [ ] Không còn edge condition thiếu `sourceHandle` trong graph đã lưu.
- [ ] Không còn template/docs active dùng `type=logic` hoặc `data.condition`.
- [ ] Log runtime có cảnh báo rõ ràng nếu gặp handle branch không hợp lệ.

## 8) Kết luận

Đây không phải lỗi đơn lẻ của canvas, mà là lỗi "đứt contract" giữa 4 lớp: template data -> FE renderer -> UX cấu hình edge -> runtime branch matcher.  
Case "Có bản đồ sao?" trong kịch bản đính kèm đang chạm đồng thời 3 điểm gãy P0 (`type` sai + `expression` sai + duplicate edge thiếu handle), nên biểu hiện vừa sai UI vừa sai luồng chạy.
