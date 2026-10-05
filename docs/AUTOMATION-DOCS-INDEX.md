# AUTOMATION DOCS INDEX — Bản đồ tài liệu `core/automation/docs/`

> **Status:** ACTIVE · v1.9 · 2026-08-16
> **Owner:** Twin AI Core (Johnny Chu)
> **Tier:** 1 (governance — mọi doc mới trong `core/automation/docs/` PHẢI đăng ký ở đây trong CÙNG PR)
> **Companion bắt buộc đọc cùng:** [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) — kiến trúc tổng +
> changelog chi tiết từng wave đã ship. File này KHÔNG lặp lại nội dung kỹ thuật của canon/rule/phase
> khác — nó chỉ là "sơ đồ trạm" + quy tắc đặt tên + quy tắc bump changelog.
> **Composer command companion (cross-module):**
> [TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md](../../../modules/twinchat/docs/TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md)
> — `@` Guru Workspace, `/` Vertical Plugin, `#` exact Automation Workflow;
> định nghĩa suggestion scopes, migration legacy và chat/channel timeline.

---

## 0. Tuyên ngôn (1 câu)

> **Không có tài liệu automation nào được coi là "tồn tại" nếu nó không có 1 dòng trong bảng §3 của
> file này — và không có thay đổi automation nào được coi là DONE nếu changelog của
> [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) không trỏ tới nó.**

---

## 1. Vấn đề hiện trạng (tại sao cần file này)

Trước ngày 2026-07-26, `core/automation/docs/` có 21 file với **4 quy ước đặt tên khác nhau
trộn lẫn, không có index tổng**:

| Hiện tượng lộn xộn | Ví dụ cụ thể |
|---|---|
| Số phase không liên tục / không rõ quy tắc | `PHASE-0.41-...` và `PHASE-1-...` tồn tại song song, không rõ `0.41` là con của phase nào |
| "PHASE-" dùng cho cả roadmap LẪN rule LẪN workflow cụ thể | `PHASE-R-FINAL-ACTION.md` nội dung thực chất là 1 RULE Tier tối thượng (không phải roadmap có ngày bắt đầu/kết thúc); `PHASE-AUTOMATION-CALENDAR.md`, `PHASE-AUTOMATION-HUB-TEMPLATES.md` không có số |
| Doc không theo prefix nào rõ ràng | `CONTENT-OPS-AUTOMATION-TRAINING.md`, `PROMPT-LIBRARY-TRENDING-RESEARCH.md` |
| Không có nơi tra cứu "doc nào đang ACTIVE / đã SHIPPED / còn SPEC" | Phải mở từng file đọc header mới biết |
| Không có rule bắt buộc bump changelog khi thêm doc mới | Nhiều doc (`WORKFLOW-*`, `GAP-ANALYSIS-*`) không được canon changelog nhắc tới |

Hệ quả: dev mới khó biết nên đặt tên file mới ra sao, dễ trùng nội dung, khó `grep` truy vết quyết
định kỹ thuật đã chốt ở đâu. File này giải quyết bằng 1 **quy tắc đặt tên chuẩn cho tương lai** (§2)
+ **1 bảng chỉ mục đầy đủ hiện trạng** (§3) + **1 rule bắt buộc bump changelog** (§4).

**Quyết định KHÔNG rename hàng loạt 21 file cũ** — rename phá cross-reference (canon đang link tới
từng file bằng tên hiện tại ở hàng chục vị trí, xem `AUTOMATION-0-CANON.md`). Quy tắc mới ở §2 chỉ
áp dụng cho file **MỚI** tạo từ nay; file cũ giữ nguyên tên, chỉ được gắn "Ghi chú" trong bảng §3 nếu
tên gây hiểu nhầm.

---

## 2. Naming convention chuẩn hoá (áp dụng cho MỌI file MỚI từ 2026-07-26)

| Prefix | Dùng khi nào | Quy tắc numbering | Ví dụ |
|---|---|---|---|
| `AUTOMATION-0-CANON.md` | Duy nhất — kiến trúc tổng toàn module. KHÔNG tạo file thứ 2 dùng số `0` | cố định, không đổi | (không tạo thêm) |
| `AUTOMATION-DOCS-INDEX.md` | Duy nhất — chính file này | cố định | (không tạo thêm) |
| `AUTOMATION-<KEBAB-SLUG>.md` | Tài liệu tham chiếu ngang, không gắn 1 phase có lifecycle SPEC→SHIPPED cụ thể (roadmap tổng lịch sử, user guide, error catalog) | không numbering | `AUTOMATION-USER-GUIDE.md` |
| `PHASE-<seq>[.<sub>]-<KEBAB-SLUG>.md` | Đặc tả 1 giai đoạn phát triển CÓ lifecycle rõ (SPEC → IN PROGRESS → SHIPPED), có ngày, có acceptance criteria | `<seq>` = số nguyên tăng dần theo **thứ tự được mở** (tra bảng §3 trước khi cấp số mới, không tái sử dụng số đã cấp dù phase đó bị huỷ); `<sub>` chỉ dùng khi phase con phụ thuộc chặt vào 1 phase cha đã có số (vd `0.41` là con của phase `0`) | `PHASE-2-CONTENT-CALENDAR-30D.md` |
| `RULE-<KEBAB-SLUG>.md` | Guardrail bắt buộc tuân thủ lâu dài, có Tier (0/1/2/3), KHÔNG có khái niệm "hoàn thành xong rồi archive" | không numbering | `RULE-TRIGGER-SINGLE-CLAIM.md` |
| `GAP-ANALYSIS-<KEBAB-SLUG>.md` | So sánh khả thi / feasibility study — KHÔNG normative, có thể được duyệt thành `PHASE-<seq>` sau | không numbering | `GAP-ANALYSIS-SCHEDULER-VS-CRON.md` |
| `WORKFLOW-<KEBAB-SLUG>.md` | Tài liệu 1 workflow template CỤ THỂ đã ship (slug, trigger, nodes) — không phải kiến trúc chung | không numbering | `WORKFLOW-ASTRO-TRANSIT-ZALO.md` |

### 2.1 Quy tắc cấp số `PHASE-<seq>`

1. Trước khi đặt tên, đọc bảng §3 cột **Alias/Phase-ID** để chắc chắn không trùng số.
2. Số chỉ tăng, không chèn giữa hai số đã cấp.
3. Phase con thật sự phụ thuộc 1 phase cha (không tồn tại độc lập) dùng `<cha>.<con>` — ví dụ
   `PHASE-0.41-...` là con của `PHASE 0` (canon). Không lạm dụng — nếu phase có thể đứng độc lập,
   cấp số nguyên mới thay vì gắn làm "con" của phase không liên quan.
4. Không đổi số đã cấp cho 1 phase sau khi đã publish/link ở nơi khác, kể cả khi phase đó bị huỷ —
   ghi `Status: DEPRECATED` trong file, không xoá số để tái sử dụng.

### 2.2 Legacy — KHÔNG rename, chỉ gắn "Ghi chú" trong bảng §3

Các file sau đây có tên KHÔNG khớp quy ước §2 nhưng **giữ nguyên** (đã có cross-reference nhiều nơi):

| File | Vấn đề tên gọi | Xử lý |
|---|---|---|
| `PHASE-R-FINAL-ACTION.md` | Nội dung là RULE Tier tối thượng, không phải phase có ngày kết thúc | Giữ tên; nếu tạo bản thay thế trong tương lai → dùng `RULE-FINAL-ACTION.md`, không rename file cũ |
| `PHASE-AUTOMATION-CALENDAR.md`, `PHASE-AUTOMATION-HUB-TEMPLATES.md` | Không có số `<seq>` | Giữ tên — coi là "phase lịch sử trước khi có rule §2" |
| `PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md`, `PHASE-WORKFLOW-AS-SKILL.md` | Không có số `<seq>` | Giữ tên — đã là landmark design-debate doc, đổi tên sẽ phá rất nhiều link nội bộ giữa 2 file này và canon |
| `CONTENT-OPS-AUTOMATION-TRAINING.md` | Không theo prefix nào ở §2 | Coi là biến thể của `AUTOMATION-<KEBAB>.md` (tài liệu đào tạo/tham chiếu ngang) |
| `PROMPT-LIBRARY-TRENDING-RESEARCH.md` | Không theo prefix nào ở §2; thực chất thuộc phạm vi `core/twinbrain/docs/PHASE-TRENDING-RESEARCH.md` được mirror sang automation | Coi là biến thể tham chiếu ngang; nếu tách hẳn khỏi twinbrain trong tương lai → cân nhắc đổi thành `AUTOMATION-TRENDING-RESEARCH-LIBRARY.md` (chưa làm ngay) |

---

## 3. Bảng chỉ mục đầy đủ (25 doc — 22 hiện có + 3 mới thêm 2026-07-26/2026-08-11 + 1 mới 2026-08-16)

### 3.1 Canon & Index (đọc trước tiên)

| File | Status | Tier | Mô tả 1 dòng |
|---|---|---|---|
| [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) | ACTIVE · v0.16 | — | Kiến trúc tổng module: dual-mode design/runtime, block taxonomy, DB schema, REST contract, toàn bộ Wave A-E + CRM-PATH-1..5 đã ship |
| **AUTOMATION-DOCS-INDEX.md** (file này) | ACTIVE · v1.0 | 1 | Bản đồ + quy ước đặt tên + rule bump changelog cho mọi doc automation |

### 3.2 Rule (guardrail bắt buộc, không có "xong rồi archive")

| File | Status | Tier | Mô tả 1 dòng |
|---|---|---|---|
| [PHASE-R-FINAL-ACTION.md](PHASE-R-FINAL-ACTION.md) *(⚠️ tên legacy, xem §2.2)* | RULE · v1.0 | Tối thượng (ngang R-AGENTIC/R-MPRT) | Mọi action cuối nhánh DAG phải quad-commit (scheduler row · notify · edit link · ack callback) |
| [RULE-AUTOMATION-MULTI-ATTACHMENT.md](RULE-AUTOMATION-MULTI-ATTACHMENT.md) | ACTIVE | Automation Canon | Contract `attachments[]` chung cho mọi flow nhận ảnh/file từ Zalo/FB/Telegram/WebChat/`/gpt/` |
| [RULE-INBOUND-DISPATCH-PRIORITY.md](RULE-INBOUND-DISPATCH-PRIORITY.md) | ACTIVE · v1.0 | 2 | Chống double-reply giữa automation matcher (workflow đã claim message) và generic responder (Command Router/Guru Bridge) qua claim-flag `$GLOBALS['bizcity_automation_matched_mids']` |
| **RULE-TRIGGER-SINGLE-CLAIM.md** *(MỚI 2026-07-26)* | **ACTIVE · SHIPPED (core matcher + legacy @priority)** · v1.3 | 2 | Chống fan-out NHIỀU workflow cùng lúc. `@`-directed priority đã ship nhưng chỉ giữ compatibility; grammar mới dùng exact `#workflow_slug` theo CCG companion. Còn follow-up Inspector field + DDV probe. |

### 3.3 Phase / Roadmap (có lifecycle SPEC → SHIPPED)

| File | Status | Alias/Phase-ID | Mô tả 1 dòng |
|---|---|---|---|
| [AUTOMATION-1-BE-ROADMAP.md](AUTOMATION-1-BE-ROADMAP.md) | SHIPPED (BE-1→BE-7) | `BE-1..BE-7` | Roadmap backend gốc: executor, listener, trigger matcher, scheduler bridge, TwinBrain bridge, realtime runner |
| [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md) | IN PROGRESS · v1.1 | `PHASE 0.41` (con của PHASE 0 canon) | UI dual-path: Admin builder canvas (Zone 2) ↔ CRM-care recipe gallery (Zone 1), CRM-PATH-1..5 |
| [PHASE-1-TEMPLATES-AUTOMATION.md](PHASE-1-TEMPLATES-AUTOMATION.md) | SPEC · v0.4 | `PHASE 1` | Content Calendar 30 ngày: CSV/Excel import, DataTable Studio, product catalog, scenario config, Guru bridge |
| [PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md](PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md) | IN PROGRESS · product matcher code landed, canary pending · v0.2 | `PHASE 2` | HIL template auto-upgrade + order product catalog suggestion + gpt-4o-mini candidate matching |
| [PHASE-3-HIL-STEP-TRACE.md](PHASE-3-HIL-STEP-TRACE.md) | IN PROGRESS · MVP code landed, canary pending · v0.2 | `PHASE 3` | Footnote trace step-by-step cho HIL Instance (slot hoi/da dien/con thieu) trong tab HIL cua RunTimeline "Chay thu" |
| [PHASE-AUTOMATION-CALENDAR.md](PHASE-AUTOMATION-CALENDAR.md) *(không số, xem §2.2)* | IMPLEMENTED (2026-06-16) | `PHASE-AUTOMATION-CALENDAR` | Lịch & kịch bản trong Automation dựa trên `bizcity_crm_events` |
| [PHASE-AUTOMATION-HUB-TEMPLATES.md](PHASE-AUTOMATION-HUB-TEMPLATES.md) *(không số, xem §2.2)* | IN PROGRESS (W1-W10 done) | `ATH` (Automation Template Hub) | Thư viện template 3 tầng: local seeder / Hub canonical / Marketplace |
| [PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md](PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md) *(không số, xem §2.2)* | IMPLEMENTED · v1.3 | `SEED W*` / `GURU W*` | Debate + kiến trúc Seed Templates & Guru-as-Trigger; nguồn gốc `trigger.guru_mention`, `trigger.slash_command` |
| [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) *(không số, xem §2.2)* | DESIGN · v1.4 (Wave 0 in-flight) | `WF-AUTO W*` / `BRIDGE W*` / `GURU W*` | Bidirectional Workflow-MD ↔ Skill format; nguồn gốc Wave A-E đã ship (xem canon §25-§29) |

### 3.4 Gap Analysis (feasibility study — KHÔNG normative)

| File | Ngày | Mô tả 1 dòng |
|---|---|---|
| [GAP-ANALYSIS-CONTENT-IMAGE.md](GAP-ANALYSIS-CONTENT-IMAGE.md) | 2026-07-05 | Rà soát workflow content + image (`PHASE-IMG-TPL`) |
| [GAP-ANALYSIS-LOGIC-BRANCH-EDGE.md](GAP-ANALYSIS-LOGIC-BRANCH-EDGE.md) | 2026-07-03 | Rà soát node logic if/else, sourceHandle, UI Builder branch rendering |
| [GAP-ANALYSIS-SCHEDULER-VS-CRON.md](GAP-ANALYSIS-SCHEDULER-VS-CRON.md) | 2026-06-14 | So sánh `core/scheduler` vs `core/cron` — observability & correctness |

### 3.5 Workflow templates cụ thể đã ship

| File | Phase-ID | Template slug | Mô tả 1 dòng |
|---|---|---|---|
| [WORKFLOW-ASTRO-RELATION-ZALOBOT.md](WORKFLOW-ASTRO-RELATION-ZALOBOT.md) | `PHASE-FAA2-TWINBRAIN REL-1` | `tpl_astro_relation_profile_zalo_v1` | Đánh giá độ hợp chiêm tinh hồ sơ mới qua Zalo Bot |
| [WORKFLOW-ASTRO-TRANSIT-ZALO.md](WORKFLOW-ASTRO-TRANSIT-ZALO.md) | `PHASE-ASTRO-WORKFLOW` | — | Xem vận hạn chiêm tinh qua Zalo Bot |
| [WORKFLOW-PRODUCTS-ZALOBOT.md](WORKFLOW-PRODUCTS-ZALOBOT.md) | `PHASE-TWB-PRODUCTS` | `tpl_products_lookup_zalo_v1` · `tpl_products_need_solution_zalo_v1` | Super-MRO — tra cứu/tư vấn sản phẩm qua Zalo Bot |
| [WORKFLOW-NOTE-THUKY-ZALOBOT.md](WORKFLOW-NOTE-THUKY-ZALOBOT.md) | **IN PROGRESS · `PHASE-TBR-NOTE-THUKY-ZALO`** | `tpl_zalo_note_notebook_v1` · `tpl_zalo_thuky_notebook_v1` | @note/@thuky → TwinBrain Goal Loop + Notebook/MPR → trả lời Zalo; N1/N2 foundation, chưa claim production |
| [WORKFLOW-WOO-BIZOPS-ZALOBOT.md](WORKFLOW-WOO-BIZOPS-ZALOBOT.md) | **ANALYSIS + ROADMAP SPEC · `PHASE-TWB-WOO-BIZOPS`** | `tpl_zalo_woo_bizops_query_v1` · `tpl_cron_woo_bizops_morning_digest_v1` *(chưa seed, chưa có action block)* | Đặc tả CEO/Admin hỏi doanh thu/đơn hàng/khách hàng/tồn kho WooCommerce qua Zalo Bot (Zone 2, admin-only); chỉ tài liệu, chưa code |

### 3.6 Tài liệu tham chiếu ngang (reference — không phase lifecycle)

| File | Cập nhật | Mô tả 1 dòng |
|---|---|---|
| [AUTOMATION-RUNTIME-ERRORS.md](AUTOMATION-RUNTIME-ERRORS.md) | v1.0 · 2026-06-08 | Nguồn dữ liệu DUY NHẤT cho mọi error code runtime automation (R-ERROR-UX) |
| [AUTOMATION-USER-GUIDE.md](AUTOMATION-USER-GUIDE.md) | — | Hướng dẫn sử dụng cho admin/staff không cần biết PHP |
| [CONTENT-OPS-AUTOMATION-TRAINING.md](CONTENT-OPS-AUTOMATION-TRAINING.md) *(xem §2.2)* | 2026-07-21 | Đào tạo kịch bản content/trending/marketing gắn prefix `[content ops]` trong Template Gallery |
| [PROMPT-LIBRARY-TRENDING-RESEARCH.md](PROMPT-LIBRARY-TRENDING-RESEARCH.md) *(xem §2.2)* | v1.0 · 2026-06-24 | Prompt & skill template library cho nghiên cứu xu hướng (mirror từ `core/twinbrain`) |

---

## 4. RULE — Governance bump changelog (bắt buộc từ nay)

> **Mọi PR thêm/sửa doc trong `core/automation/docs/` PHẢI cập nhật CẢ 2 nơi trong CÙNG PR:**

1. **Bảng §3 của file này** — thêm 1 dòng đúng category (hoặc cập nhật cột Status nếu doc đổi
   lifecycle SPEC → IN PROGRESS → SHIPPED).
2. **Changelog đầu [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md)** — thêm 1 dòng mới ở ĐẦU danh
   sách changelog (version tăng dần `v0.N`), mô tả ngắn gọn + link tới doc mới/thay đổi. Đây là
   pattern đã áp dụng nhất quán cho mọi Wave A-E và CRM-PATH-1..5 (xem các dòng `v0.6`…`v0.15` hiện
   có) — file này CHỈ chính thức hoá pattern đó thành rule bắt buộc, không phải phát minh mới.

Ngoài ra:

3. Nếu doc mới là **RULE** với Tier ≤ 2 → thêm vào bullet **"Related rules"** ở đầu
   `AUTOMATION-0-CANON.md` (dòng `> **Related rules:** ...`).
4. Nếu doc đổi trạng thái SPEC → SHIPPED → cập nhật CẢ cột Status ở bảng §3 CỦA CHÍNH FILE ĐÓ (header
   riêng của nó) LẪN bảng §3 ở file này — không để lệch pha giữa 2 nơi.
5. Nếu cần schema DB mới (bảng/cột) → vẫn phải đi qua R-DCL/R-CR/R-DDV theo copilot-instructions gốc
   của repo TRƯỚC khi cập nhật doc — rule này không thay thế R-DCL, chỉ bổ sung governance cho tầng
   tài liệu.

### Anti-patterns CẤM TUYỆT ĐỐI

- ❌ Tạo file `.md` mới trong `core/automation/docs/` mà không thêm dòng vào bảng §3 file này.
- ❌ Đặt tên `PHASE-<n>` trùng số đã cấp cho phase khác (kể cả phase đã bị huỷ) — tra §3 trước.
- ❌ Rename file cũ để "dọn dẹp" mà không `grep -rn "TÊN-FILE-CŨ.md"` toàn repo trước để audit hết
  cross-reference (canon, rule khác, code comment Phase-ID).
- ❌ Thêm/sửa doc roadmap hoặc rule automation nhưng KHÔNG bump changelog `AUTOMATION-0-CANON.md` —
  mất traceability, vi phạm đúng vấn đề mà file này được tạo ra để sửa.
- ❌ Để doc ở trạng thái SPEC quá lâu mà không có mục "Shipped implementation notes" khi code đã thật
  sự merge — gây hiểu nhầm giữa "đã có ý tưởng" và "đã chạy trên production".
- ❌ Viết nội dung kỹ thuật trùng lặp giữa file này và canon/rule khác — file này CHỈ index + quy ước,
  không phải nơi giải thích lại kiến trúc.

---

## 5. Cách dùng file này khi bắt đầu 1 task automation mới

```text
1. Đọc AUTOMATION-0-CANON.md §0-§1 (tuyên ngôn + kiến trúc dual-mode) nếu chưa quen module.
2. Mở bảng §3 file này → xác định task thuộc category nào (Rule / Phase / Gap-Analysis / Workflow).
3. Nếu là Phase mới → tra §2.1 để cấp số <seq> đúng, không trùng.
4. Nếu là Rule mới → dùng prefix RULE-<KEBAB>.md, xác định Tier, kiểm tra có đụng rule Tier thấp hơn
   đã có không (đọc hết bảng §3.2 trước khi viết rule mới tránh chồng chéo).
5. Viết xong → bump theo §4 (bảng §3 + canon changelog) trong CÙNG PR.
```

---

## Changelog

- v1.6 (2026-08-16): Dang ky phase moi
   [PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md](PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md)
   vao nhom Phase/Roadmap; chot scope rewrite FB/Web/Photo/Order + contract
   auto-check version, auto-bump va auto-upgrade cho MVP HIL.

- v1.5 (2026-08-16): Thêm cross-module Composer Command companion; đồng bộ
   Automation canon v0.19 + Single-Claim v1.3: `@` Guru, `/` Vertical Plugin,
   `#` exact Workflow; `@workflow`/`/workflow` chuyển thành legacy compatibility.
- v1.2 (2026-07-26): Đồng bộ index sau hotfix precedence `@` cho
   `RULE-TRIGGER-SINGLE-CLAIM.md` (v1.2) để case `@ghichu` không bị workflow
   keyword chung cướp quyền.
- v1.1 (2026-07-26): Đồng bộ status sau khi ship core code của `RULE-TRIGGER-SINGLE-CLAIM.md`.
   Cập nhật bảng §3.2 từ SPEC → ACTIVE/SHIPPED (core matcher) và giữ rõ 2
   hạng mục follow-up chưa ship (Inspector field `allow_costack`, DDV probe).
- v1.0 (2026-07-26): Initial index. Audit toàn bộ 21 doc hiện có trong `core/automation/docs/`,
  phân loại 6 nhóm (Canon/Index · Rule · Phase-Roadmap · Gap-Analysis · Workflow · Reference), chốt
  quy ước đặt tên chuẩn cho file mới (§2), ghi nhận 5 file legacy tên không khớp quy ước nhưng giữ
  nguyên không rename (§2.2), lập rule bắt buộc bump changelog canon khi thêm/sửa doc (§4). Đăng ký
  luôn 2 doc mới cùng đợt: chính file này + `RULE-TRIGGER-SINGLE-CLAIM.md`.
