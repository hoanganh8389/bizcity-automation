# PHASE-3-HIL-STEP-TRACE — HIL Step-by-Step Trace trong Chạy thử (V3)

> Status: IN PROGRESS · MVP code landed, runtime/canary evidence pending
> Date: 2026-08-16
> Owner: Twin AI Core (Johnny Chu)
> Scope: core/automation Builder "Chạy thử" (RunTimeline) + read-only consumption của
> TwinBrain HIL runtime đã ship (`core/twinbrain/includes/class-twinbrain-hil-*.php`)
> Canonical master: [core/twinbrain/docs/TWINBRAIN-MPR-V5-GOAL-LOOP-INTENT-NOTICE-HIL-ROADMAP.md](../../twinbrain/docs/TWINBRAIN-MPR-V5-GOAL-LOOP-INTENT-NOTICE-HIL-ROADMAP.md)
> §9.4, §10.4, §11, §15, §16, §21 (checklist HIL)
> Related: [PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md](PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md),
> R-EVT, R-CH-IDMEM, R-MSDB, R-CACHE, R-ERROR-UX

---

## 0. Vì sao cần tài liệu này (V3)

PHASE-2 đã cho phép author cấu hình HIL (`hil_prompt` → compile → `hil_spec`) và
runtime đã chặn side-effect khi chưa `_hil_ready` (`class-automation-runner.php`
+ `class-automation-trigger-matcher.php::prepare_hil_payload()`). Trước PHASE-3,
panel `RunTimeline` có 5 tab (`log / inbox / mpr / trace / fire`) và **không tab
nào cho biết**:

- HIL đang ở turn thứ mấy, hỏi slot nào.
- Slot nào đã điền, slot nào còn thiếu, slot nào bị redact.
- Vì sao runner reject `hil_not_ready` (không thấy state HIL tại thời điểm đó).

Đây là GAP giữa "runtime đã chạy đúng" và "admin nhìn thấy runtime chạy đúng ra
sao" — đúng tinh thần canon TwinBrain V5 §22: *"V5 chỉ được gọi
`RUNTIME_EVIDENCE_PASS` khi user... nhìn thấy đúng tiến trình, Goal/HIL state
có thể replay"*. Tài liệu này đặc tả cơ chế **footnote trace** cho từng bước HIL
để hiển thị trong Builder.

---

## 1. Đối tượng dữ liệu đã có sẵn (không tạo state machine mới)

Toàn bộ state đã tồn tại qua các class đã ship — tài liệu này **chỉ đọc**,
không thêm event type mới (tuân R-EVT-2/R-EVT-4a, không phá canon):

| Class đã ship | Vai trò | Field trace cần đọc |
|---|---|---|
| `BizCity_TwinBrain_HIL_State::normalize()` | Chuẩn hoá 1 snapshot | `hil_id, spec_id, trigger_id, status, pending_slot_id, slot_values, turn_count, confirmed, closure_reason, expires_at` |
| `BizCity_TwinBrain_HIL_Runtime::step()` | 1 turn coordinator, trả `{action, question, slot_id, hil_ready}` | `action` ∈ `open\|ask\|reask\|confirm\|reask_confirm\|ready\|paused\|failed\|expired\|cancelled\|noop` |
| `BizCity_TwinBrain_HIL_Repository::latest()/progress()/close()/open()` | Event-sourced persistence qua `bizcity_twin_event_stream` (taxonomy v11, không bảng mới) | mỗi lời gọi = 1 event row có thể query lại theo `hil_id` |
| `BizCity_Automation_Trigger_Matcher::prepare_hil_payload()` | Nơi step được gọi mỗi inbound, gửi câu hỏi qua `BizCity_Gateway_Sender` | input `payload`, output `_hil_ready/_hil_id/_hil_state/_hil_spec` hoặc `WP_Error` |
| `BizCity_TwinBrain_Progress_Notice_Projector::on_hil_milestone()` | Map `status` → message gửi ra channel thật | đã có mapping `status → message` có thể tái dùng cho label hiển thị FE |

**Không tạo `event_type` mới, không tạo bảng mới, không tạo SSE channel mới.**
Trace UI này là 1 lớp đọc (projection) trên dữ liệu event-sourced sẵn có, đúng
R-EVT-3 (logger/adapter chỉ là thin facade).

---

## 2. Đánh giá tiến độ và GAP còn lại

Đã giải quyết trong MVP code:

- [x] `Repository::history()` đọc bounded window mới nhất và trả ASC, không đổi schema.
- [x] REST `/hil-trace` đọc theo `run_id` hoặc Pending State `chat_id`.
- [x] `_hil_id`, `_hil_identity_uuid`, `_hil_session_id` được forward trong
  `trigger_payload_json` khi HIL ready; lúc collecting dùng Pending State.
- [x] Tab HIL trong RunTimeline có polling, checklist, footnote, redaction,
  Copy/Tải JSON và Copy HIL ID khi paused.
- [x] Cache trace dimension theo physical database khi router cung cấp
  `$wpdb->dbname`; history TTL 5 giây và flush sau snapshot mới.
- [x] Order HIL product step co catalog suggestions + exact/SKU/number match;
  reply mo ho moi dung `gpt-4o-mini` candidate matcher va confidence gate.

GAP còn lại, chưa được đánh dấu PASS:

- [ ] Live WordPress canary: inbound thật → hỏi slot → confirming → ready →
  runner side-effect → trace REST end-to-end.
- [ ] HIL slot-progress notice chi tiết (`slot_filled`, `slot_invalid`,
  `waiting_user`) theo canonical master; hiện projector mới có milestone tổng.
- [ ] Correlation `run_id` xuyên suốt HIL Instance/Goal Loop; trace collecting
  hiện dùng `chat_id` + Pending State vì chưa có automation run trước khi HIL ready.
- [ ] Live canary xac nhan danh sach Woo that, model response that va
  `trigger.hil_slots` duoc action order consume dung.
- [ ] Footnote runtime expose `product_match_mode`, `candidate_index` va
  `confidence` theo schema §3; code matcher da co gate nhung trace metadata
  chi tiet nay chua duoc persist/project ra UI.

---

## 3. Footnote trace schema (1 dòng = 1 bước HIL)

Mỗi lần `HIL_Runtime::step()` chạy (tương ứng 1 lượt inbound khi HIL đang mở)
tạo ra đúng **1 footnote entry**. FE hiển thị danh sách footnote theo thứ tự
thời gian, giống cách Matcher Trace đã hiển thị nhưng scope hẹp theo 1
`hil_id`.

```jsonc
{
  "ts": "2026-08-16T09:03:11+00:00",     // updated_at của snapshot tại turn này
  "hil_id": "hil_ab12cd34ef56",
  "spec_id": "commerce.order_execute",
  "trigger_id": "trigger.zalo_inbound",
  "turn_index": 2,                       // = state.turn_count tại thời điểm ghi
  "action": "ask",                       // open | ask | reask | confirm | reask_confirm | ready | paused | failed | expired | cancelled | noop
  "status": "collecting",                // status sau khi step() xử lý xong
  "slot_id": "receiver_phone",           // slot đang hỏi (rỗng nếu completed/ready)
  "slot_label": "Số điện thoại người nhận",
  "question_asked": "Bạn cho mình số điện thoại người nhận.",
  "answer_redacted": true,               // true nếu slot.redact_in_trace=true
  "answer_preview": "•••• (đã lưu, ẩn do redact_in_trace)",
  "slots_progress": { "filled": 2, "required": 5 },
  "slots_status": [
    { "id": "product_name",     "label": "Tên sản phẩm",        "required": true, "filled": true,  "redacted": false },
    { "id": "price",            "label": "Giá / thanh toán",     "required": true, "filled": true,  "redacted": false },
    { "id": "receiver_phone",   "label": "SĐT người nhận",       "required": true, "filled": false, "redacted": true },
    { "id": "receiver_address", "label": "Địa chỉ giao hàng",     "required": true, "filled": false, "redacted": true },
    { "id": "payment_method",   "label": "Phương thức thanh toán","required": true, "filled": false, "redacted": false }
  ],
  "closure_reason": null                 // chỉ set khi action ∈ ready|failed|expired|paused
}
```

Voi slot `product_name` cua order workflow, footnote nen them cac field quan
sat khong nhay cam sau khi match:

```jsonc
{
  "product_candidates_count": 8,
  "product_match_mode": "number|exact_name|exact_sku|llm_small|unmatched",
  "product_match_confidence": 0.91,
  "product_candidate_index": 2,
  "product_match_model": "gpt-4o-mini"
}
```

Chi ghi `candidate_index`, mode, confidence va model; khong ghi raw catalog
payload, prompt day du hay PII cua slot vao footnote.

### 3.1 Quy tắc điền field bắt buộc

- `question_asked` chỉ hiển thị khi `action ∈ {ask, reask, confirm, reask_confirm}`.
  Với `action=confirm`, REST projection hiển thị một summary an toàn của các
  slot đã nhận; không hứa giữ nguyên câu runtime do
  `HIL_Runtime::confirmation_question()` sinh vì câu đó không được persist
  cùng snapshot và slot values không được trả ra FE.
- `answer_redacted=true` khi slot tương ứng có `redact_in_trace=true` trong
  compiled `hil_spec` (xem PHASE-2 §3.1). FE **không bao giờ** nhận giá trị
  thật của slot bị redact — BE chỉ trả `answer_preview` dạng che, không trả
  `slot_values` gốc cho các slot đó (đồng bộ nguyên tắc mã hoá đã ghi ở
  canonical master §14/§23.1 mục 10/29 — repository đã mã hoá `slot_values`
  trước khi persist, và trace layer phải giữ nguyên nguyên tắc không lộ giá
  trị nhạy cảm ra FE dù chỉ để debug).
- `slots_status[]` luôn liệt kê **toàn bộ slot khai báo trong spec** theo đúng
  thứ tự `spec.slots[]`, không chỉ slot đã đụng tới — để FE vẽ được checklist
  đầy đủ ngay từ bước đầu tiên (slot chưa tới lượt hỏi vẫn hiện `filled:false`).
- `closure_reason` dùng đúng hằng số đã có trong
  `BizCity_TwinBrain_HIL_State` (`CLOSURE_READY`, `CLOSURE_TIMEOUT`,
  `CLOSURE_FAILED`, `CLOSURE_CANCELLED`) — không tạo enum trace riêng.

### 3.2 Trạng thái tổng quan (header của tab, không phải từng dòng)

```jsonc
{
  "hil_id": "hil_ab12cd34ef56",
  "status": "collecting",
  "turn_count": 2,
  "max_turns": 8,
  "slots_filled": 2,
  "slots_required": 5,
  "ready": false,
  "expires_at": "2026-08-16T10:03:11+00:00"
}
```

Dùng để vẽ progress bar `2/5 slot` + badge trạng thái (`Đang thu thập`,
`Đang chờ xác nhận`, `Sẵn sàng`, `Tạm dừng`, `Hết hạn`, `Lỗi`, `Đã huỷ`).

---

## 4. Nguồn dựng footnote (không thêm ghi mới, chỉ đọc lại)

```text
BizCity_TwinBrain_HIL_Repository (đọc nhiều snapshot theo hil_id, ASC theo thời gian)
  → mỗi snapshot đã có sẵn: status, pending_slot_id, slot_values, turn_count, closure_reason
  → diff(snapshot[i-1], snapshot[i]) → suy ra action + slot vừa hỏi/vừa điền
  → merge với compiled hil_spec (đọc từ trigger_config.hil_spec của workflow) để lấy label/ask/redact_in_trace
  → build 1 footnote entry / snapshot
```

Vì mỗi lần `progress()/close()` gọi là 1 event row mới trong
`bizcity_twin_event_stream`, lịch sử đã tồn tại sẵn — **không cần ghi thêm bất
kỳ dữ liệu nào mới**, chỉ cần 1 method đọc nhiều row (`history()`) thay vì chỉ
`latest()`.

---

## 5. Contract đã implement trong MVP

### 5.1 `BizCity_TwinBrain_HIL_Repository::history()`

```php
/**
 * @return array<int,array<string,mixed>> normalized snapshots, ASC theo thời gian.
 */
public static function history( int $blog_id, string $identity_uuid, string $session_id, string $hil_id, int $limit = 50 ): array;
```

Read-only, tái dùng đúng pattern query `LIKE '%"hil_id":"..."%'` +
`BizCity_Twin_Event_Stream_Schema::table()` đã có trong `latest()`. Lấy cửa sổ
snapshot mới nhất theo `limit`, sau đó trả ASC. Không đổi schema, không đổi
taxonomy.

### 5.2 REST route mới (nội bộ plugin, không gọi HTTP ra ngoài)

```
GET /wp-json/bizcity-automation/v1/hil-trace
  ?hil_id=hil_xxx                (ưu tiên nếu có)
  hoặc
  ?run_id=run_xxx                (tra run.trigger_payload._hil_id trước)
  hoặc
  ?chat_id=zalobot_xxx           (fallback dev/test — đọc Pending_State.hil_id)
```

Response:

```jsonc
{
  "ok": true,
  "header": { /* §3.2 */ },
  "footnotes": [ /* §3.1, ASC theo turn_index */ ]
}
```

Permission: `workflow_read_allowed` và kiểm tra owner/visible workflow trong
`class-automation-rest.php`. Route này **chỉ đọc**,
không side-effect — an toàn để mở cho staff xem trace của workflow mình sở
hữu (không riêng admin), theo đúng tinh thần `workflow_read_allowed()` hiện
có cho `/runs/:id`.

### 5.3 Forward `hil_id` vào run context

Khi `prepare_hil_payload()` trả `_hil_ready=true` kèm `_hil_id`,
`_hil_identity_uuid`, `_hil_session_id`, các giá trị này đi cùng
`$trigger_payload` vào `enqueue_and_optionally_run()` và được lưu trong
`trigger_payload_json`. **Không tạo cột DB mới** và không tạo `input_json` mới.

---

## 6. UI Builder — tab "HIL" đã implement trong RunTimeline

Tab thứ 6 đã được thêm vào `RunTimeline.jsx` bên cạnh
`log / inbox / mpr / trace / fire`, ví dụ id `hil`:

```
┌───────────────────────────────────────────────────────────┐
│ [Log] [Inbox] [MPR] [Matcher Trace] [Fire] [HIL]           │
├───────────────────────────────────────────────────────────┤
│ Trạng thái: 🟡 Đang thu thập · turn 2/8 · slot 2/5 đã điền │
│                                                             │
│ ☑ Tên sản phẩm          ☑ Giá/thanh toán                   │
│ ☐ SĐT người nhận (••••) ☐ Địa chỉ giao hàng (••••)         │
│ ☐ Phương thức thanh toán                                   │
│                                                             │
│ Footnote (mới nhất trên cùng):                             │
│ #3  ask       hỏi "receiver_phone"  → "Bạn cho mình SĐT…"  │
│ #2  ask       hỏi "payment_method"  → điền price OK         │
│ #1  ask       hỏi "product_name"    → mở HIL Instance       │
│                                                             │
│ [Copy JSON]  [Tải JSON]                                     │
└───────────────────────────────────────────────────────────┘
```

Yêu cầu UI:

- Slot checklist luôn hiện đủ **toàn bộ slot khai báo** (kể cả slot chưa tới
  lượt) — không chỉ hiện slot đã hỏi.
- Slot có `redact_in_trace=true` hiển thị `••••` thay vì giá trị, kể cả khi đã
  điền — chỉ hiện icon ✓ đã điền, không hiện nội dung.
- Copy/Tải JSON dùng cùng style export trace của `RunTimeline.jsx`; payload
  trace bao gồm header + footnotes, không gồm slot values gốc.
- Khi HIL `status=paused` (`on_timeout=pause`), hiển thị banner cảnh báo +
  nút "Copy hil_id" để admin tra cứu thủ công qua Diagnostics nếu cần.
- Khi chưa có `hil_id` cho run hiện tại (workflow không dùng HIL), tab hiện
  placeholder: *"Workflow này chưa cấu hình HIL — bấm Cấu hình HIL trong
  Inspector để thêm."* kèm link nhảy tới Inspector trigger node.

---

## 7. R-EVT / R-CH-IDMEM / R-CACHE / R-MSDB compliance

- **R-EVT-3**: `history()` là read projection thuần trên Event Stream đã có,
  không tạo bảng/log song song.
- **R-CH-IDMEM**: trace luôn scope theo `(blog_id, identity_uuid, session_id,
  hil_id)` đã resolve qua `BizCity_TwinBrain_Brain_Session_Resolver` — không
  tự chế tuple identity riêng cho mục đích hiển thị (đúng canon §11.2, đã sửa
  ở GAP #7 của canonical master).
- **R-MSDB**: mọi query theo `blog_id` hiện tại, không fallback Global DB.
- **R-CACHE**: nếu cache trace cho polling nhanh trong lúc "Chạy thử" đang mở,
  PHẢI dùng `BizCity_Cache` + đăng ký qua `BizCity_Cache_Registry` với TTL
  ngắn (≤ 5s) và flush khi có `progress()/close()` mới — không tự chế mảng
  `static $cache = []`.
- **R-ERROR-UX**: route `/hil-trace` khi không tìm thấy instance phải trả
  `code=not_found, message, hint, help_code` theo `BizCity_Error_Payload`,
  không trả `404` trơn.
- **Redaction (OWASP A02)**: không bao giờ trả `slot_values` gốc cho slot có
  `redact_in_trace=true` qua REST — kể cả cho admin. Chỉ trả
  `filled:boolean` + `answer_preview` dạng che.
- **Product match safety**: trace phai phan biet `unmatched`/confidence thap
  voi match thanh cong; khong coi `product_name` raw la product catalog id.

---

## 8. Acceptance checklist V3 (PASS gate)

- [x] `BizCity_TwinBrain_HIL_Repository::history()` thêm mới, read-only, lấy
  bounded window mới nhất rồi trả ASC; probe đã kiểm tra contract disk/loader.
- [x] REST `GET /bizcity-automation/v1/hil-trace` trả đúng header + footnotes
      theo schema §3, permission `workflow_read_allowed`.
- [x] Matcher forward `_hil_id` + identity/session hints vào trigger payload khi có.
- [x] Tab "HIL" mới trong `RunTimeline.jsx` hiển thị checklist slot + footnote
      + Copy/Tải JSON, redact đúng theo `redact_in_trace`.
- [x] Không lộ slot value bị redact ra FE dưới bất kỳ hình thức nào (projection
  chỉ trả `filled`/`redacted`, không trả `slot_values`).
- [x] Diagnostics: mở rộng probe `twinbrain.hil` để kiểm tra history method,
  REST route và scoped matcher hints; live event-order fixture vẫn thuộc
  canary WordPress.
- [x] Cache history được invalidate sau open/progress/close.
- [x] Order product matcher contract co catalog provider + small-model gate;
  live catalog/LLM canary va match metadata trong footnote vẫn pending.
- [ ] Runtime canary trên WordPress thật xác nhận route, event history và
  redaction response end-to-end.
- [ ] Không có thay đổi schema/DDL — nếu phát sinh cần cột mới, dừng lại và đi
      qua R-DCL + R-CR + Site Provisioner + DDV trước khi code.

---

## 9. Rollout wave

1. [x] `history()` read method + bounded-window cache.
2. [x] REST `/hil-trace` projection, permission và redaction.
3. [x] Forward `_hil_id` + identity/session hints vào `trigger_payload_json`/
  Pending State.
4. [x] FE tab "HIL" trong `RunTimeline.jsx` với polling và export trace.
5. [x] Probe contract + cập nhật checklist canonical master.
6. [ ] Chạy live WordPress canary và bổ sung slot-progress notice chi tiết.

Mỗi wave độc lập, có thể dừng ở bất kỳ bước nào mà không phá quyết định runtime
HIL hiện tại; `prepare_hil_payload()` chỉ được bổ sung trace hints, không đổi
slot ordering, confirmation hay side-effect gate.

---

## 10. Cập nhật liên quan tới canonical master

Tài liệu này bổ sung — không thay thế — checklist "HIL" trong
[TWINBRAIN-MPR-V5-GOAL-LOOP-INTENT-NOTICE-HIL-ROADMAP.md](../../twinbrain/docs/TWINBRAIN-MPR-V5-GOAL-LOOP-INTENT-NOTICE-HIL-ROADMAP.md)
§21. Cụ thể, mục checklist hiện có:

```
- [ ] Nút `{}` hiển thị JSON/slots/validation/test.
```

được mở rộng nghiệp vụ (không sửa dòng gốc) bởi 1 mục mới tương ứng ở đây:
theo dõi **runtime instance đang chạy step-by-step** (khác với `{}` console
vốn là xem **compiled spec tĩnh** trước khi save). Hai console phục vụ 2 mục
đích khác nhau — không gộp làm một:

| Console | Xem gì | Khi nào dùng |
|---|---|---|
| `{}` HIL Spec Compiler (đã có, PHASE-2) | Compiled `hil_spec` tĩnh — slots/validation/JSON | Lúc cấu hình trigger, trước khi save |
| Tab "HIL" trong RunTimeline (tài liệu này, PHASE-3) | HIL Instance runtime — từng turn, slot đã điền, câu hỏi đã hỏi | Lúc "Chạy thử"/debug 1 lần chạy thật |

---

## 11. Notes

- Các slice `history()`, REST route, scoped payload hints và tab FE đã landed;
  runtime canary và slot-progress notice chi tiết vẫn pending. Mọi thay đổi PHP tiếp theo phải có R-STAMP
  (Phase-ID `PHASE-3-HIL-TRACE`).
- Không đổi quyết định slot/side-effect của `HIL_Runtime::step()`/
  `prepare_hil_payload()`; payload hints chỉ phục vụ lớp quan sát (observability).
