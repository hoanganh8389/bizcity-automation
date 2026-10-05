# RULE — Trigger Single-Claim (chống fan-out kịch bản trùng từ khóa)

> **Status:** ACTIVE · SHIPPED (core matcher + legacy @priority) · v1.3 · 2026-08-16
> **Owner:** Twin AI Core (BizCity Founder)
> **Tier:** 2 (module rule — enforced inside `core/automation`)
> **Related canon:** [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) §31 ·
> [RULE-INBOUND-DISPATCH-PRIORITY.md](RULE-INBOUND-DISPATCH-PRIORITY.md) (rule anh em —
> xử lý ranh giới automation-vs-generic-responder; rule này xử lý ranh giới
> workflow-vs-workflow CÙNG tier keyword-match)
> **Command grammar migration:**
> [TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md](../../../modules/twinchat/docs/TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md)
> chốt `#workflow_slug` là explicit workflow command mới. `@workflow` priority
> trong rule này chỉ giữ legacy compatibility; không dùng cho workflow/template mới.
> **Trigger for this doc:** user báo cáo nhắn `Ghi chú:` kèm nội dung chứa cả chữ
> "kịch bản" và "marketing" → hệ thống fan-out chạy CẢ 3 workflow (Ghi chú + Kịch
> bản + Marketing) thay vì chỉ chạy đúng 1 workflow "Ghi chú" mà user thật sự
> muốn.
> **Index:** [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md)

---

## 0. Tuyên ngôn (1 câu)

> **Một tin nhắn inbound chỉ có MỘT kịch bản (workflow) "thắng cuộc" ở pha
> keyword/filter-match. Fan-out nhiều workflow cùng lúc chỉ được phép khi từng
> workflow liên quan TỰ NGUYỆN khai báo `trigger_config.allow_costack=true` —
> không có "match trước là thắng" hay "match nhiều thì chạy hết" ngầm định.**

---

## 1. Root cause (đã trace trong code)

File: `core/automation/includes/class-automation-trigger-matcher.php`,
method `on_channel_message()` (nhánh BE-7.E "matched keyword"), có bản sao
logic tương tự (không có side-effect) trong `find_matching_workflows_for_payload()`
(PHASE-3-TWIN-GPT preview bridge).

### 1.1 Vì sao 1 tin nhắn match được nhiều workflow

`channel_filter_match()` mặc định `mode = 'keyword_contains'`
(`class-automation-trigger-matcher.php::channel_filter_match()`) — nghĩa là
**substring search bất kỳ vị trí nào trong toàn bộ text**, không phải "câu
lệnh ở đầu tin nhắn" hay "match trọn từ với ranh giới rõ ràng". Một tin nhắn
dài (ghi chú, checklist, mô tả công việc…) rất dễ chứa NHIỀU từ khóa của
NHIỀU workflow khác nhau cùng lúc.

### 1.2 Vì sao TẤT CẢ workflow match đều được chạy (không chỉ 1)

Sau khi build xong tập `$matched` (mọi workflow non-fallback pass filter),
code chỉ làm 2 việc trước khi enqueue:

1. **Lọc theo `exclusive`** — CHỈ áp dụng khi có workflow đặt
   `trigger_config.exclusive=true`, khi đó bộ lọc giữ lại **toàn bộ tập con
   exclusive=true** (không phải "1 workflow exclusive duy nhất thắng"). Nếu
   2+ workflow cùng đặt `exclusive=true` và cùng match → cả 2 vẫn fan-out với
   nhau.
2. **`usort()` theo `priority` desc rồi `version` desc** — đây CHỈ đổi **thứ
   tự chạy / thứ tự ACK**, KHÔNG cắt bớt danh sách.

Sau đó:

```php
foreach ( $matched as $idx => $row ) {
    $matched[ $idx ]['wf'] = $this->maybe_upgrade_legacy_astro_workflow( $row['wf'] );
    $this->enqueue_and_optionally_run( $matched[ $idx ]['wf'], $run_payload, false );
}
// ...
$this->send_match_ack( $run_payload, array_column( $matched, 'wf' ), 'keyword' );
```

→ **MỌI workflow trong `$matched` đều được enqueue + chạy + gửi ACK riêng.**
Đây là fan-out **theo thiết kế** (dùng cho các ca hợp lệ như "ACK + ghi log
song song"), nhưng trở thành bug khi các workflow không liên quan tới nhau
tình cờ share từ khóa.

---

## 2. Ca tái hiện cụ thể (từ báo cáo user, 2026-07-26)

Giả định 4 workflow template với `trigger_config.keywords`:

| Workflow | `keywords` | Mục đích |
|---|---|---|
| **Ghi chú** | `["ghi chú"]` | Lưu ghi chú nhanh vào bộ nhớ |
| **Thợ ảnh** | `["thợ ảnh", "sửa ảnh"]` | Sửa/chỉnh ảnh AI |
| **Kịch bản** | `["kịch bản"]` | Soạn kịch bản nội dung |
| **Marketing** | `["marketing"]` | Lập kế hoạch marketing |

Tin nhắn user gửi (ý định: chỉ muốn **ghi chú**):

```text
@ghichu CHECKLIST TRIỂN KHAI HÔM NAY & DANH SÁCH LINK NGUỒN
Checklist:
* [ ] Lên kế hoạch chi tiết cho nội dung review sản phẩm so sánh đối thủ...
* [ ] Chuẩn bị kịch bản và quay/dựng 2-3 video TikTok 30 giây theo mẫu.
* [ ] Lên lịch và chuẩn bị sản phẩm/đạo cụ cho 1 buổi livestream...
* [ ] Thiết kế banner/hình ảnh cho các chương trình khuyến mãi đã đề xuất.
```

Kết quả hiện tại:

```text
matched = [ Ghi chú (chứa "ghi chú" trong @ghichu-context),
            Kịch bản (chứa chữ "kịch bản" ở dòng 2),
            Marketing (không match "marketing" theo ví dụ trên nhưng CÙNG
                       cơ chế sẽ match ngay khi checklist có chữ "marketing") ]
exclusive_set = []  (không workflow nào đặt exclusive=true)
→ $matched giữ nguyên 3 phần tử
→ foreach: enqueue_and_optionally_run(Ghi chú), enqueue_and_optionally_run(Kịch bản), enqueue_and_optionally_run(Marketing)
→ 3 ACK "Đã nhận yêu cầu…" + 3 workflow run độc lập, có thể ra 3 câu trả lời
  hoặc 3 side-effect chồng chéo (lưu ghi chú + soạn kịch bản + lập kế hoạch
  marketing) mà user không hề yêu cầu 2 cái sau.
```

Đây chính xác là hiện tượng user mô tả: "vô tình kích hoạt chuỗi kịch bản
gồm Ghi chú, kịch bản và Marketing."

---

## 3. Vì sao cơ chế `exclusive` hiện có KHÔNG đủ

| Ca | `exclusive` hiện tại xử lý được? |
|---|---|
| 1 workflow đặc thù (vd `action.consume_attachment`) cần thắng mọi workflow tổng quát khác | ✅ Có (dùng cho PHASE-IMG-FIRST-FB-FIX, PHASE-ASTRO-WORKFLOW) |
| 2+ workflow "tổng quát" (Ghi chú / Kịch bản / Marketing) không workflow nào đặt `exclusive=true` | ❌ Không — cả 3 vẫn nằm trong `$matched`, đều được enqueue |
| 2+ workflow CÙNG đặt `exclusive=true` và cùng match 1 tin nhắn | ❌ Không — `exclusive_set` giữ cả 2, vẫn fan-out với nhau |
| Cần chọn ĐÚNG 1 workflow theo mức độ "cụ thể" của từ khóa match (vd match nguyên cụm ở đầu câu vs. match 1 từ lẻ ở giữa đoạn văn dài) | ❌ Không có khái niệm "specificity score" |

→ `exclusive` là cơ chế **loại trừ nhóm** (group override), không phải cơ chế
**chọn người thắng duy nhất** (single-claim resolution). Rule này định nghĩa
lớp thứ hai bổ sung, chạy SAU bước lọc `exclusive` hiện có.

---

## 4. Giải pháp canonical — Single-Claim Resolution

> **Trạng thái:** đặc tả kỹ thuật, CHƯA implement. Bất kỳ ai pick up task này
> phải đọc hết §5-§8 trước khi sửa code, và phải bump changelog theo §9.

### 4.1 Vị trí chèn logic

Chèn **ngay sau** bước lọc `exclusive_set` hiện có, **ngay trước** bước
`usort( $matched, ... )`, ở CẢ 2 call site:

1. `on_channel_message()` — dispatch thật (enqueue + ACK + run).
2. `find_matching_workflows_for_payload()` — preview matcher (Twin GPT prompt
   bridge, PHASE-3-TWIN-GPT), không enqueue nhưng phải trả về kết quả preview
   **nhất quán** với dispatch thật, nếu không sửa cả 2 nơi thì preview sẽ nói
   dối user về việc workflow nào thật sự chạy.

Khuyến nghị **extract 1 helper dùng chung** thay vì sửa trùng 2 lần (tránh
lệch pha như đã xảy ra với cặp `exclusive_set` hiện tại):

```php
/**
 * Reduce $matched xuống đúng 1 "single-claim winner" trừ khi từng workflow
 * tự khai báo allow_costack=true (competing set rỗng nếu tất cả đều opt-in).
 *
 * @param array $matched  [{wf, cfg}, ...] đã qua lọc exclusive_set.
 * @param string $text    haystack gốc (chưa normalize) — dùng để tính vị trí match.
 * @return array{ winners: array, suppressed: array<int,array{wf_id:int,reason:string}> }
 */
private function resolve_single_claim( array $matched, string $text ): array { /* … */ }
```

### 4.1.1 Logic #1 — `@` + keyword declared → ưu tiên kịch bản đó

Nếu message có `@...` và trong các workflow match có workflow khai báo keyword/filter
bắt đầu bằng `@` (vd `@ghichu`), matcher phải ưu tiên nhóm workflow này trước mọi
workflow keyword chung.

Contract runtime:

- `channel_filter_eval()` giữ metadata `is_at_command` + `message_has_at`.
- `resolve_single_claim()` tách nhóm `at_directed` (workflow có `is_at_command=true`
      và message có `@`) và suppress mọi workflow competing còn lại với reason
      `at_keyword_priority`.
- Sau đó mới chấm điểm winner trong tập `at_directed`.

Mục tiêu: biến `@ghichu` thành tín hiệu intent rõ ràng, không bị workflow keyword
chung (`marketing`, `kịch bản`, `chiến dịch`, ...) cướp quyền.

### 4.1.2 Logic #2 — case `@ghichu` ưu tiên ghi chú, không chạy marketing

Với message dạng:

```text
@ghichu ... nội dung dài có chứa từ "kịch bản"/"marketing" ...
```

Kỳ vọng bắt buộc:

- workflow ghi chú (`filter`/`keywords` chứa `@ghichu`) là winner;
- workflow marketing bị suppress với reason `at_keyword_priority`;
- trace phải có `matched_keyword_singleclaim_reduced` để debug.

### 4.2 Thuật toán chấm điểm (deterministic, không "may rủi")

```text
B0. Tách $matched thành 2 nhóm:
    - $costack   = cfg.allow_costack === true   (KHÔNG cạnh tranh, luôn được giữ)
    - $competing = còn lại

B1. Nếu count($competing) <= 1 → không cần reduce, trả $costack + $competing nguyên vẹn.

B2. Với mỗi row trong $competing, tính claim_score = (
        mode_strictness,     // keyword_exact=3 > keyword_start=2 > keyword_contains=1
        is_prefix_anchor,    // 1 nếu matched term nằm ở vị trí bắt đầu message
                             //   (sau khi strip mention/slash prefix) — nghĩa là
                             //   user gõ nó như MỘT LỆNH, không phải nhắc tới giữa câu
        matched_term_len,    // độ dài term khớp dài nhất trong keywords[] của workflow
        (int) cfg.priority,  // ưu tiên tường minh do người tạo workflow đặt
        -wf.id               // tie-break cuối: wf tạo trước (id nhỏ hơn) thắng
    )

B3. Sort $competing theo claim_score DESC (so sánh tuple, phần tử đầu ưu tiên nhất).

B4. winner = $competing[0]; suppressed = $competing[1..] (mỗi phần tử ghi reason,
    vd 'lower_priority', 'shorter_keyword_match', 'not_prefix_anchor', 'tie_break_newer_id').

B5. Trả về ( $costack ∪ [winner] ) làm $matched mới cho enqueue loop.
```

**Ghi chú B2 "is_prefix_anchor":** đa số case lỗi thực tế là do workflow
"tổng quát" (Kịch bản, Marketing) match trúng 1 từ NẰM GIỮA một đoạn văn dài
(ghi chú/checklist), trong khi workflow đúng ý định (Ghi chú) match trúng từ
khóa Ở ĐẦU tin nhắn — đây chính là tín hiệu mạnh nhất phân biệt "lệnh" và
"nhắc tới tình cờ". Cần `channel_filter_match()` / `match_terms_by_mode()`
trả thêm vị trí match (`mb_strpos` offset) thay vì chỉ trả `bool`, để B2 có
dữ liệu tính.

### 4.3 Vì sao KHÔNG chỉ dùng `priority` đơn thuần

Chỉ dựa `priority` bắt buộc admin phải đoán trước và gán số cho MỌI cặp
workflow có thể đụng từ khóa nhau — không scale khi thư viện template lớn
dần (30+ template hiện có). Thuật toán B2 dùng tín hiệu ngôn ngữ tự nhiên
(vị trí, độ dài match, độ chặt mode) làm lớp phòng vệ MẶC ĐỊNH, `priority`
chỉ là tie-break tường minh khi 2 workflow cùng "độ đặc thù ngôn ngữ".

### 4.4 Cờ đối lập — `allow_costack`

Field mới `trigger_config.allow_costack` (bool, default `false`, KHÔNG cần
DDL — field JSON trong `trigger_config_json` hiện có):

| Giá trị | Ý nghĩa |
|---|---|
| `false` (mặc định) | Workflow tham gia cạnh tranh single-claim bình thường — đúng ý user hiện tại (mỗi tin nhắn 1 kịch bản). |
| `true` | Workflow được khai báo RÕ RÀNG là "tiện ích nền" (utility) không cạnh tranh nội dung chính — ví dụ workflow chỉ `action.log`/ghi audit song song mọi tin nhắn, hoặc workflow gửi thông báo cho admin — LUÔN được giữ lại bất kể kết quả single-claim của các workflow khác. |

Migration: mọi workflow hiện có mặc định `allow_costack=false` (an toàn –
giữ đúng ý định "1 tin nhắn 1 kịch bản"). Site nào đang cố tình dựa vào
fan-out cũ (ví dụ 2 workflow luôn chạy cùng nhau theo thiết kế) PHẢI audit và
tự đặt `allow_costack=true` cho các workflow "phụ" trước khi bật rule này ở
site đó.

### 4.5 Rollout an toàn — filter bật/tắt

```php
// [ngày] [tác giả] RULE-TRIGGER-SINGLE-CLAIM — cho phép tắt tạm thời khi migrate.
if ( count( $competing ) > 1
    && apply_filters( 'bizcity_automation_single_claim_enabled', true, $run_payload ) ) {
    $reduced = $this->resolve_single_claim( $matched, $text );
    $matched = $reduced['winners'];
    // ghi trace + file logger cho $reduced['suppressed'] — xem §6.
}
```

Mặc định BẬT (`true`) vì đây là hành vi đúng theo kỳ vọng người dùng thông
thường ("gõ 1 lệnh → chạy 1 kịch bản"). Site cần fan-out thật sự phải dùng
`allow_costack=true` per-workflow (§4.4), không tắt filter toàn site trừ khi
đang debug.

---

## 5. Observability — trace event mới

Thêm 1 `BizCity_Automation_Matcher_Trace::note()` mới ngay trước bước enqueue
(song song với `matched_keyword` đã có):

```php
BizCity_Automation_Matcher_Trace::note( 'matched_keyword_singleclaim_reduced', array(
    'platform'     => $platform,
    'chat_id'      => $chat_id,
    'text'         => $text,
    'trigger_type' => $trigger_type,
    'detail'       => 'winner_wf_id=' . $winner_id
        . ' suppressed=' . implode( ',', array_map(
            static function ( $s ) { return $s['wf_id'] . ':' . $s['reason']; },
            $suppressed
          ) ),
) );
```

Và mirror per-workflow qua `BizCity_Automation_File_Logger::note_decision()`
cho từng `wf_id` bị suppress (giữ cùng pattern với `matched_keyword` hiện có ở
§27.2 canon) — để admin debug qua `wf-{id}.jsonl` biết ngay lý do workflow của
mình KHÔNG chạy dù text có chứa từ khóa.

---

## 6. Anti-patterns CẤM TUYỆT ĐỐI

- ❌ Coi fan-out nhiều workflow cùng lúc là hành vi mặc định hợp lệ — chỉ hợp
  lệ khi TỪNG workflow liên quan tự đặt `allow_costack=true` tường minh.
- ❌ Đặt `trigger_config.keywords` là 1 từ phổ biến/chung chung không có neo
  ngữ cảnh (`"kịch bản"`, `"marketing"`, `"thông tin"`, `"kế hoạch"`) mà không
  cân nhắc va chạm với workflow khác trong cùng thư viện template — trước khi
  publish, kiểm tra trace `matched_keyword` xem có fan-out ngoài ý muốn.
- ❌ Chỉ dựa `exclusive=true` để bảo vệ đúng 1 workflow khi có ≥2 workflow
  cùng đặt `exclusive=true` — đọc kỹ §3, `exclusive` là lọc nhóm không phải
  chọn người thắng duy nhất.
- ❌ Sửa logic single-claim ở MỘT trong 2 call site (`on_channel_message` /
  `find_matching_workflows_for_payload`) mà quên sửa nơi còn lại — bắt buộc
  extract helper dùng chung (§4.1).
- ❌ Tắt `bizcity_automation_single_claim_enabled` toàn site để "cho nhanh"
  thay vì audit + gắn `allow_costack=true` đúng cho từng workflow cần fan-out
  thật sự.
- ❌ Thêm workflow keyword mới mà không đặt `priority` tường minh khi biết
  trước nó sẽ cạnh tranh ngữ nghĩa với workflow tổng quát hơn đã có (vd
  workflow "Kịch bản Marketing Tết" cụ thể hơn workflow "Marketing" chung).

---

## 7. Tương thích ngược & migration checklist

- [ ] Audit toàn bộ `bizcity_automation_workflows.trigger_config_json` hiện
      có: liệt kê workflow nào đang PHỤ THUỘC vào việc chạy song song cùng
      workflow khác (nếu có) → gắn `allow_costack=true` TRƯỚC khi bật rule.
- [ ] Kiểm tra 2 template seed liên quan `is_fallback`/`exclusive` (Wave
      C/D/CRM-PATH) không bị ảnh hưởng ngoài ý muốn khi thêm bước reduce mới.
- [ ] `find_matching_workflows_for_payload()` (PHASE-3-TWIN-GPT preview) phải
      phản ánh ĐÚNG kết quả sau single-claim, không chỉ raw `$matched`.
- [ ] Test case tái hiện chính xác §2 (Ghi chú/Thợ ảnh/Kịch bản/Marketing) —
      chỉ đúng 1 workflow chạy, đúng workflow "Ghi chú".
- [ ] Test case 2 workflow cùng `exclusive=true` cùng match → vẫn phải reduce
      xuống 1 (không dừng ở bước lọc exclusive cũ).
- [ ] Test case workflow `allow_costack=true` (vd audit logger) LUÔN được giữ
      song song với winner, không bị suppress.

---

## 8. Implementation checklist (BE — khi pick up task)

- [ ] Thêm field `allow_costack` vào catalog field của Inspector (FE block
      config) cho mọi trigger block keyword-based, default `false`.
- [x] `channel_filter_match()` / `match_terms_by_mode()` trả thêm metadata
      (matched term, mode, offset vị trí) thay vì chỉ `bool` — cần thay đổi
      signature hoặc thêm overload; audit toàn bộ call site hiện có trước khi
      đổi (2 call site chính đã biết: `on_channel_message`,
      `find_matching_workflows_for_payload`).
- [x] Implement `resolve_single_claim()` helper dùng chung.
- [x] Wire vào 2 call site sau bước lọc `exclusive_set`, trước `usort`.
- [x] Thêm trace event `matched_keyword_singleclaim_reduced` (§5).
- [x] Filter `bizcity_automation_single_claim_enabled` (§4.5).
- [x] R-DCL: contract-only bump `core/diagnostics/changelog/core.automation.json`
      — field mới `trigger_config_json.allow_costack` (bool, default false),
      KHÔNG có DDL thay đổi.
- [ ] DDV probe mới hoặc extend probe hiện có: synthetic message chứa 3
      keyword workflow tổng quát → assert chỉ 1 workflow được enqueue.
- [ ] PHP 7.4 compatible — không dùng union return type/nullsafe/match cho
      code mới (xem `RULE PHP 7.4 Compatibility Floor` trong copilot
      instructions của repo).
- [x] R-STAMP mọi dòng sửa: `// [YYYY-MM-DD Johnny Chu] RULE-TRIGGER-SINGLE-CLAIM — ...`.

---

## 9. Governance — bump changelog khi implement

Khi task này chuyển từ SPEC → SHIPPED:

1. Đổi `Status:` đầu file này từ `SPEC · chưa triển khai code` →
   `ACTIVE · SHIPPED · <ngày>`.
2. Cập nhật dòng Status trong [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md)
   §3 (bảng chỉ mục) tương ứng.
3. Thêm 1 dòng changelog mới vào đầu **Changelog** của
   [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) mô tả ngắn gọn phần đã
   ship + link về rule này (xem cách các đợt Wave A-E / CRM-PATH đã làm).
4. KHÔNG sửa nội dung §1-§4 (root cause + spec) trong lần bump này — chỉ
   thêm 1 mục "## 10. Shipped implementation notes" phía dưới ghi lại file
   thật đã sửa, để giữ nguyên phần "vì sao" cho người đọc sau này.

---

## 10. Shipped implementation notes

Core single-claim logic đã được ship trong matcher (không còn fan-out mặc định
cho workflow cạnh tranh):

- `core/automation/includes/class-automation-trigger-matcher.php`
      - thêm `channel_filter_eval()` + metadata match (`matched_term`, `matched_pos`,
            `matched_term_len`, `is_prefix_anchor`)
      - thêm `resolve_single_claim()` và comparator/reason helpers
      - wire vào cả 2 call site:
            - `on_channel_message()` (dispatch thật)
            - `find_matching_workflows_for_payload()` (preview bridge)
      - thêm trace `matched_keyword_singleclaim_reduced`
      - thêm file-log decision `matcher.singleclaim_suppressed`
      - thêm rollout filter `bizcity_automation_single_claim_enabled`
      - thêm precedence lớp 1 cho `@`-directed workflow (`is_at_command` +
            `message_has_at`) để `@ghichu` thắng workflow keyword chung
      - fallback match `@term` bằng `raw_text` khi `message_text_clean` đã strip mention

Phạm vi chưa ship trong đợt này (follow-up):

- expose field `allow_costack` trong Inspector/FE config panel.
- DDV probe synthetic cho case 3 keyword cạnh tranh.

---

## Changelog

- v1.2 (2026-07-26): Added `@`-directed priority layer theo phản hồi thực tế:
      khi message có `@` + workflow khai báo keyword/filter `@...` thì ưu tiên
      nhóm workflow đó trước, suppress workflow keyword chung bằng reason
      `at_keyword_priority`. Bổ sung fallback match trên `raw_text` cho case
      mention bị strip trong `message_text_clean`.
- v1.1 (2026-07-26): Shipped core matcher implementation theo spec §4: thêm
      single-claim reduce cho competing workflows sau bước `exclusive_set`, giữ
      opt-in `allow_costack=true`, wire đồng bộ vào dispatch + preview call site,
      bổ sung trace/log suppressed workflow và rollout filter
      `bizcity_automation_single_claim_enabled`. Chưa ship Inspector field và DDV
      probe (để follow-up).
- v1.0 (2026-07-26): Initial SPEC. Trace root cause (fan-out `$matched` không
  bị giảm xuống 1 winner ở cả 2 call site), tái hiện ca cụ thể Ghi chú/Thợ
  ảnh/Kịch bản/Marketing từ báo cáo user, đặc tả thuật toán Single-Claim
  Resolution (mode strictness → prefix anchor → matched term length →
  priority → id tie-break), cờ đối lập `allow_costack`, rollout filter, và
  checklist migration/implementation đầy đủ. Chưa đổi code.
