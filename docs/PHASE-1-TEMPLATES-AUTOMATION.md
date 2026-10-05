# PHASE 1 — Templates Automation: Kế hoạch nội dung 30 ngày

> **Status:** SPEC · v0.4 · 2026-07-20  
> **Phase-ID:** `PHASE-1-TEMPLATES-AUTOMATION`  
> **Module:** `core/automation/`  
> **Owner:** Twin AI Core (Johnny Chu)  
> **Related:** [PHASE-AUTOMATION-CALENDAR.md](PHASE-AUTOMATION-CALENDAR.md) · [PHASE-AUTOMATION-HUB-TEMPLATES.md](PHASE-AUTOMATION-HUB-TEMPLATES.md) · [PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md](PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md)

---

## 0. Bối cảnh

User đưa mẫu Google Sheet kế hoạch content 30 ngày và yêu cầu dev bổ sung tình huống Automation:

1. Người dùng nhập thông tin sản phẩm/khách hàng/kênh/CTA để AI lập kế hoạch nội dung 30 ngày tới.
2. Mỗi nội dung có đủ `title`, `content`, `image_brief`, `hashtags` và lịch đăng.
3. Core Automation cần có block action để dựng được workflow kiểu này, không chỉ prompt thủ công.
4. Cần có kịch bản mẫu `.csv` để user tải file hoặc copy link, edit dễ trong Excel/Google Sheets, rồi import lại thành dữ liệu scheduler trực quan.

Link sheet tham chiếu:

```text
https://docs.google.com/spreadsheets/d/1YIg7sty7cI8sU1UVPq0ovq8q12s-ZY_V/edit?usp=sharing&ouid=109165215785731503002&rtpof=true&sd=true
```

Ghi chú: link Google Sheet có thể yêu cầu đăng nhập. Spec này chốt contract theo ảnh/mẫu hiện có: kịch bản content chia sẻ kiến thức với đầu vào, AI xử lý, đầu ra và KPI.

---

## 0.1 Phản biện thiết kế

Thiết kế v0.1 đúng hướng khi tách planner → scheduler → publisher, nhưng còn 3 điểm dễ gây vướng khi dev triển khai thật:

| Điểm yếu | Rủi ro | Điều chỉnh v0.2 |
|---|---|---|
| Sheet import bị để optional quá muộn | User thực tế đang làm kế hoạch trong Excel/Google Sheets; nếu chỉ có prompt AI thì khó duyệt hàng loạt. | CSV trở thành MVP bridge chính: export mẫu, user sửa, import/parse thành scheduler events. |
| Google Sheet private link bị xem như input trực tiếp | Link private cần OAuth/cookie, plugin client không được tự giữ credential Google. | Chỉ parse được CSV public/export URL hoặc file upload. Google OAuth Hub để Phase sau. |
| Plan AI 30 ngày có thể sinh nội dung lệch ý user | Nếu không có bảng trung gian, user phải sửa từng event trong UI. | Cho user chỉnh `.csv` trước khi commit vào `bizcity_crm_events`; UI preview diff trước khi import. |

Kết luận: **CSV-first** là phương án thực dụng nhất cho Phase 1. AI có thể tạo bản nháp, nhưng file CSV là contract dễ kiểm soát, dễ sửa và dễ biến thành lịch trực quan.

### 0.2 Phản biện bổ sung — DataTable trước, Automation sau

Yêu cầu mới: sau khi import CSV/Excel/Google Sheet, UI phải hiện thành bảng editable live để user sửa trực tiếp. Đây là hướng đúng, nhưng cần tách 2 wave:

| Wave | Mục tiêu | Lý do |
|---|---|---|
| **Wave 1 — Config DataTable Studio** | Import → preview → editable datatable → save dynamic JSON rows/search text. | User cần làm sạch dữ liệu, sửa cột linh hoạt, thêm cột mới trước khi chạy automation. |
| **Wave 2 — Automation Runtime Wiring** | Dùng config đã lưu để tạo/sync workflow chạy Zalo 7h, web daily, Facebook daily, auto-reply. | Khi data chưa sạch mà chạy publish/reply tự động sẽ rủi ro cao. |

Không nên ép mọi thứ về schema cứng ngay ở Wave 1. Nhưng cũng không nên lưu "JSON lỏng" hoàn toàn không kiểm soát. Phương án cân bằng:

```text
row_json        = dữ liệu linh hoạt cho LLM và UI
canonical_json  = projection field tối thiểu đã normalize để sort/filter/validate
search_text     = text phẳng để tìm kiếm LIKE / keyword nhanh
schema_key      = content_calendar | product_catalog | automation_scenarios
```

Như vậy UI vẫn linh hoạt như spreadsheet, còn runtime vẫn có đủ field tối thiểu để scheduler/publisher không chạy sai.

---

## 1. Mục tiêu Phase 1

Phase 1 biến Automation từ các template đăng lẻ hằng ngày thành **content calendar generator**:

```text
Input sản phẩm / khách hàng / vấn đề / kênh / CTA
  → AI lập 30 ý tưởng có lịch đăng
  → export/download CSV mẫu hoặc CSV plan đã sinh
  → user edit trong Excel/Google Sheets nếu cần
  → upload file hoặc paste/copy link CSV public
  → parser validate thành content_plan items
  → AI expand từng ngày thành title + content + image brief + hashtag
  → lưu thành calendar items trong bizcity_crm_events
  → user duyệt/sửa trong Automation Calendar
  → publish FB/WP/Zalo theo lịch bằng action hiện có
```

Không tạo runtime mới. Phase này reuse:

- JSON template loader trong `core/automation/templates/*.json`.
- `trigger.cron`, `action.generate_content`, `action.generate_image`, `action.publish_fb_post`, `action.publish_wp_post`, `action.reply_zalo`.
- Automation Calendar đang dùng `bizcity_crm_events` cho 30 ngày tới.
- `BizCity_LLM_Client` theo R-GW-8, không gọi thẳng `bizcity.vn` hoặc provider key.
- CSV mẫu: [content-calendar-30d-sample.csv](../templates/content-calendar-30d-sample.csv).
- CSV sản phẩm mẫu: [product-catalog-sample.csv](../templates/product-catalog-sample.csv).
- CSV cấu hình kịch bản mẫu: [automation-scenario-config-sample.csv](../templates/automation-scenario-config-sample.csv).

Wave split:

```text
Wave 1
  CSV/Excel/Google Sheet link/upload
    → parse schema/alias
    → DataTable editable live
    → save config pack rows as JSON + search_text

Wave 2
  Config pack đã duyệt
    → generate/sync workflow nodes
    → scheduler/publisher/reply chạy theo kịch bản
```

---

## 2. Use case canonical

### 2.1 Kịch bản 1 — Tạo content chia sẻ kiến thức

Mục tiêu: đăng đều nhưng không thành spam bán hàng.

| Layer | Nội dung |
|---|---|
| Đầu vào | Sản phẩm, khách mục tiêu, vấn đề thường gặp, kênh đăng, CTA. |
| AI xử lý | Viết 3 nhóm: kiến thức, review khách quan, bán hàng mềm. |
| Đầu ra | Caption, tiêu đề, brief ảnh, CTA, lịch đăng, checklist duyệt. |
| KPI | >=5 bài/tuần, mỗi bài có mục tiêu rõ: reach, inbox, lead hoặc khách mua lại. |

Prompt mẫu user:

```text
@BTnet, tạo 7 bài chia sẻ kiến thức khách quan cho tuần này về [sản phẩm].
Không viết quá bán hàng. Mỗi bài có: tiêu đề, nội dung 200 chữ, CTA mềm,
gợi ý hình, câu hỏi kéo tương tác. Dựa trên notebook sản phẩm và bảng giá hiện tại.
```

### 2.2 Mở rộng 30 ngày

Với kế hoạch 30 ngày, không nên sinh 30 bài dài trong một lần duy nhất. Flow chuẩn:

1. Sinh `calendar_plan` 30 dòng: ngày, chủ đề, góc nhìn, mục tiêu, kênh, CTA.
2. Expand từng dòng thành nội dung đầy đủ khi user duyệt hoặc trước lịch đăng.
3. Lưu mỗi dòng thành event để Calendar/CRM/Channel Gateway cùng nhìn thấy.

Lý do: giảm token, dễ duyệt, dễ retry từng bài, không mất toàn bộ plan khi một item lỗi.

### 2.3 Bốn kịch bản automation cần cấu hình bằng CSV/Sheet

Từ 2 nguồn CSV `content_calendar` + `product_catalog`, user cần cấu hình được 4 loại automation:

| Kịch bản | Trigger | Output | Ghi chú |
|---|---|---|---|
| Gửi kịch bản qua Zalo 7h sáng hằng ngày | `trigger.cron` `0 7 * * *` | `action.reply_zalo` gửi bài cần làm hôm nay | Dành cho admin/nhân viên duyệt trước khi đăng. |
| Tự động đăng bài lên web hằng ngày | `trigger.cron` | `action.publish_wp_post` | Default `draft`, chỉ auto-publish khi approved. |
| Tự động đăng Facebook hằng ngày | `trigger.cron` | `action.publish_fb_post` | Verify Page ownership trước publish. |
| Trả lời khách hàng tự động theo cài đặt | `trigger.zalo_inbound` / `trigger.fb_message` | `action.reply_zalo` / `action.reply_fb_message` | Dùng product catalog để trả lời giá, USP, so sánh, tồn kho nếu có. |

Các kịch bản này không nên hard-code trong React. Cần có một CSV/config layer user-editable để sinh workflow hoặc runtime config.

---

## 3. Content Plan Contract

### 3.0 CSV là contract user-editable

Phase 1 hỗ trợ 2 đường nhập dữ liệu đều parse về cùng `Plan item JSON`:

| Phương án | UX | Parser |
|---|---|---|
| Tải file | User tải `.csv` mẫu, sửa trong Excel/Google Sheets, upload lại. | `uploaded_csv` → parse local file. |
| Copy link | User copy link CSV public/export từ Google Sheets hoặc file tĩnh. | `csv_url` / `google_sheet_export` → `wp_remote_get()` có timeout, size limit, MIME/content check. |

Không parse link Google Sheet private dạng `/edit?...` nếu không public/export được. UI cần báo rõ: "Hãy Share public hoặc File → Download → CSV".

CSV sample đặt tại:

```text
core/automation/templates/content-calendar-30d-sample.csv
```

Product catalog sample đặt tại:

```text
core/automation/templates/product-catalog-sample.csv
```

Automation scenario config sample đặt tại:

```text
core/automation/templates/automation-scenario-config-sample.csv
```

CSV headers canonical:

```csv
day_index,date,time,channel,content_pillar,objective,audience,topic,angle,title,content,image_brief,hashtags,cta,approval_status,source_refs
```

Quy tắc parse:

- Header bắt buộc đúng tên, không phụ thuộc thứ tự.
- `hashtags` cho phép `#a #b #c` hoặc `#a,#b,#c`; parser normalize về array.
- `date` rỗng thì lấy `start_date + day_index - 1`; `time` rỗng thì dùng `default_time`.
- `approval_status` rỗng thì mặc định `draft`.
- Dòng thiếu `title` hoặc `content` vẫn được import dạng `draft_needs_expand` nếu có `topic`/`angle` để `action.expand_content_item` viết tiếp.
- Dòng thiếu cả `title`, `content`, `topic` thì reject với reason `invalid_param`.

### 3.0.1 Product catalog CSV

Đây là file đầu vào mô tả nhóm sản phẩm như bảng mẫu user đưa: nhóm hàng, đơn vị, tên sản phẩm, giá, kênh bán và điều kiện thanh toán. Phase 1 bổ sung thêm 2 cột quan trọng cho AI marketing:

1. `usp` — điểm bán hàng/khác biệt của từng sản phẩm.
2. `comparison_product` — sản phẩm đối chứng để AI viết bài so sánh khách quan.

CSV headers canonical:

```csv
category,vendor,product_name,price_vnd,usp,comparison_product,comparison_angle,sales_channel,payment_terms,content_notes
```

Ví dụ một dòng:

```csv
Do kho,Cty Mom Beauty,Banh hat hop 500g,140000,hop qua dinh duong tien loi vi ngot vua va nhieu hat,Banh quy cong nghiep 500g,doi chung ve qua tang an vat nhung it nguyen lieu hat,cua hang online,Cong no goi don,Noi ve hop qua lanh manh cho van phong va gia dinh
```

Quy tắc parse product catalog:

- `product_name`, `price_vnd`, `usp`, `comparison_product` là 4 trường bắt buộc cho kịch bản sản phẩm.
- `price_vnd` normalize về integer, bỏ dấu phẩy/chấm/ngăn cách nếu user paste từ Excel.
- `comparison_product` có thể là sản phẩm nội bộ khác hoặc nhóm hàng phổ thông ngoài thị trường.
- `comparison_angle` mô tả so sánh được phép; AI không được bịa claim vượt quá cột này.
- `content_notes` dùng để nhắc guard: tránh claim y tế, tránh công kích đối thủ, ưu tiên câu chuyện OCOP/nguồn gốc.
- Parser nên cho phép user upload nhiều nhóm hàng trong cùng file; planner chọn sản phẩm theo `category`, `vendor` hoặc keyword.

Normalized product item JSON:

```json
{
  "category": "Do kho",
  "vendor": "Cty Mom Beauty",
  "product_name": "Banh hat hop 500g",
  "price_vnd": 140000,
  "usp": "hop qua dinh duong tien loi vi ngot vua va nhieu hat",
  "comparison_product": "Banh quy cong nghiep 500g",
  "comparison_angle": "doi chung ve qua tang an vat nhung it nguyen lieu hat",
  "sales_channel": "cua hang online",
  "payment_terms": "Cong no goi don",
  "content_notes": "Noi ve hop qua lanh manh cho van phong va gia dinh"
}
```

Product catalog không tự tạo scheduler event. Nó là nguồn để `action.plan_content_calendar` sinh `topic`, `angle`, `title`, `content`, `image_brief`, `hashtags` cho content calendar.

### 3.0.2 Automation scenario config CSV

File này mô tả **kịch bản nào chạy, khi nào chạy, dùng Guru nào, đọc nguồn nào, xuất ra kênh nào**.

CSV headers canonical:

```csv
scenario_slug,enabled,guru_slug,scenario_type,trigger_type,schedule,channel,source_calendar,source_product_catalog,product_filter,approval_required,target_fb_page_id,target_wp_status,zalo_instance_id,reply_mode,action_chain,extra_json
```

Ví dụ:

```csv
send_script_zalo_7am,1,content_guru,send_daily_script,cron,0 7 * * *,zalo_bot,content-calendar-30d-sample.csv,product-catalog-sample.csv,category=Do kho,1,,draft,,daily_brief,load_guru_content_config|pick_today_content|reply_zalo,"{""timezone"":""Asia/Ho_Chi_Minh""}"
```

Supported `scenario_type`:

| scenario_type | Mục đích | Action chain chuẩn |
|---|---|---|
| `send_daily_script` | Gửi kịch bản hôm nay qua Zalo lúc 7h. | `load_guru_content_config → pick_today_content → reply_zalo` |
| `publish_web_post` | Đăng hoặc tạo draft web post hằng ngày. | `load_guru_content_config → pick_today_content → expand_content_item → publish_wp_post` |
| `publish_facebook` | Đăng Facebook hằng ngày. | `load_guru_content_config → pick_today_content → expand_content_item → publish_fb_post` |
| `customer_auto_reply` | Auto-reply khách theo cấu hình sản phẩm/Guru. | `load_guru_content_config → match_product_intent → logic.condition → reply_*` |

Quy tắc parse scenario config:

- `scenario_slug`, `enabled`, `guru_slug`, `scenario_type`, `trigger_type`, `channel`, `action_chain` là bắt buộc.
- `schedule` bắt buộc khi `trigger_type=cron`.
- `source_calendar` và `source_product_catalog` có thể là file upload, same-origin sample URL hoặc Google Sheet export CSV.
- `extra_json` là escape hatch cho cột phi cấu trúc nhưng phải là JSON object hợp lệ.
- Unknown columns từ Excel/Google Sheet không được bỏ mất; parser gom vào `custom_fields` nếu tên cột bắt đầu bằng `x_` hoặc không thuộc schema.
- Không tạo workflow ngay khi parse. UI phải preview và yêu cầu user bấm **Tạo/Cập nhật kịch bản automation**.

Normalized scenario JSON:

```json
{
  "scenario_slug": "publish_facebook_daily",
  "enabled": true,
  "guru_slug": "content_guru",
  "scenario_type": "publish_facebook",
  "trigger": { "type": "cron", "schedule": "0 9 * * *", "channel": "facebook" },
  "sources": {
    "calendar": "content-calendar-30d-sample.csv",
    "product_catalog": "product-catalog-sample.csv",
    "product_filter": "category=Do kho"
  },
  "targets": { "fb_page_id": "FB_PAGE_ID" },
  "approval_required": true,
  "action_chain": ["load_guru_content_config", "pick_today_content", "expand_content_item", "publish_fb_post"],
  "extra": { "include_hashtags": true, "generate_image": true },
  "custom_fields": {}
}
```

---

## 3.0.3 Excel / Google Sheet format mở rộng

Phase 1 không cần parser XLSX native ngay. Contract chuẩn vẫn là CSV, nhưng UI/REST phải hỗ trợ người dùng làm việc theo tư duy Excel/Google Sheet:

| Sheet/tab | CSV tương ứng | Vai trò |
|---|---|---|
| `content_calendar` | `content-calendar-30d-sample.csv` | Lịch nội dung theo ngày. |
| `product_catalog` | `product-catalog-sample.csv` | Bảng sản phẩm, giá, USP, đối chứng. |
| `automation_scenarios` | `automation-scenario-config-sample.csv` | Cấu hình kịch bản chạy tự động. |

Google Sheet public có thể có nhiều tab. Phase 1 parser nhận từng CSV export theo `gid`. UI nên cho phép user paste nhiều link hoặc chọn schema trước khi parse:

```text
Schema: [Content Calendar | Product Catalog | Automation Scenarios]
CSV/Google Sheet link: ______________________
```

Header alias để thân thiện Excel:

| Canonical | Alias chấp nhận |
|---|---|
| `product_name` | `ten_san_pham`, `tên sản phẩm`, `san_pham` |
| `price_vnd` | `gia_ban`, `giá bán`, `price` |
| `usp` | `diem_khac_biet`, `điểm khác biệt`, `loi_the` |
| `comparison_product` | `san_pham_doi_chung`, `sản phẩm đối chứng`, `doi_chung` |
| `schedule` | `lich_chay`, `lịch chạy`, `cron` |
| `channel` | `kenh`, `kênh`, `platform` |

Flexible columns:

- Cột canonical luôn được normalize về schema.
- Cột bắt đầu bằng `x_` được đưa vào `custom_fields`.
- Cột không nhận diện được nhưng có dữ liệu cũng đưa vào `custom_fields`, kèm warning preview.
- Cột chứa JSON phải có hậu tố `_json`, ví dụ `campaign_rules_json`, `reply_rules_json`.
- Không đưa `custom_fields` trực tiếp vào prompt nếu chưa sanitize và giới hạn độ dài.

Ví dụ cột phi cấu trúc hợp lệ:

```csv
x_mua_vu,x_ton_kho_note,reply_rules_json
tet_2026,uu_tien_set_qua,"{""max_reply_chars"":900,""handoff_when_unknown"":true}"
```

### 3.0.4 DataTable row model

Sau khi parse CSV/Excel/Google Sheet, UI không nên chỉ preview rồi import ngay. Wave 1 phải đưa dữ liệu vào một datatable editable live:

```json
{
  "pack_id": "gacp_20260720_abc123",
  "schema_key": "product_catalog",
  "row_key": "row_0001",
  "row_order": 1,
  "canonical_json": {
    "product_name": "Banh hat hop 500g",
    "price_vnd": 140000,
    "usp": "hop qua dinh duong tien loi vi ngot vua va nhieu hat",
    "comparison_product": "Banh quy cong nghiep 500g"
  },
  "row_json": {
    "category": "Do kho",
    "vendor": "Cty Mom Beauty",
    "product_name": "Banh hat hop 500g",
    "price_vnd": 140000,
    "usp": "hop qua dinh duong tien loi vi ngot vua va nhieu hat",
    "comparison_product": "Banh quy cong nghiep 500g",
    "x_mua_vu": "tet_2026"
  },
  "search_text": "do kho cty mom beauty banh hat hop 500g 140000 hop qua dinh duong",
  "validation": {
    "status": "valid",
    "warnings": []
  }
}
```

DataTable rules:

- Mỗi row có `row_json` là source of truth editable.
- `canonical_json` chỉ là projection của những field runtime cần biết.
- `search_text` build lại sau mỗi save row, dùng cho keyword search / `%LIKE%` / future fulltext.
- Cột lạ vẫn giữ trong `row_json`, không bị mất khi user save.
- User có thể thêm cột mới trong UI; hệ thống lưu vào `row_json` và đánh dấu là dynamic column.
- Runtime Wave 2 chỉ được dùng row có `validation.status=valid` hoặc `approved`.

Ghi chú về `%LIKE%`: dùng `%LIKE%` trên `search_text` tốt hơn quét raw JSON vì dễ normalize dấu, lowercase và tránh match nhầm ký tự JSON. Nếu dữ liệu lớn hơn 5.000 rows/pack, Phase sau nên thêm FULLTEXT/index riêng.

### 3.1 Plan item JSON

Mỗi dòng kế hoạch phải theo contract sau:

```json
{
  "day_index": 1,
  "date": "2026-07-21",
  "time": "08:00",
  "channel": "facebook",
  "content_pillar": "knowledge",
  "objective": "reach",
  "audience": "khách hàng đang tìm hiểu sản phẩm",
  "topic": "Một bữa cơm ngon có khó như bạn nghĩ?",
  "angle": "giải thích lợi ích thực tế, không bán hàng gắt",
  "title": "Một bữa cơm ngon bắt đầu từ điều rất nhỏ",
  "content": "...caption hoặc draft bài viết...",
  "image_brief": "Ảnh sản phẩm trên bàn ăn gia đình, nền sáng, có 3 bullet lợi ích, không quá nhiều chữ.",
  "hashtags": ["#gaoNgon", "#buaComGiaDinh", "#songKhoe"],
  "cta": "Bạn thường chọn gạo theo tiêu chí nào?",
  "approval_status": "draft",
  "source_refs": ["notebook:product", "price_sheet:current"]
}
```

### 3.2 Trường bắt buộc

| Field | Bắt buộc | Ghi chú |
|---|---:|---|
| `day_index` | yes | 1..30, dùng để sort và retry. |
| `date` | yes | `YYYY-MM-DD`, timezone theo WordPress site. |
| `time` | yes | `HH:MM`, default từ user hoặc 08:00. |
| `channel` | yes | `facebook`, `wp_post`, `zalo_bot`, `zalo_oa`, `telegram`. |
| `content_pillar` | yes | `knowledge`, `review`, `soft_sell`, `case_study`, `faq`, `behind_scene`. |
| `objective` | yes | `reach`, `inbox`, `lead`, `repeat_purchase`, `education`. |
| `title` | yes | Tiêu đề ngắn, dùng cho Calendar chip và WP title. |
| `content` | yes | Caption/post body. Có thể là draft ngắn ở step plan và full ở step expand. |
| `image_brief` | yes | Brief ảnh cho designer hoặc `action.generate_image`. |
| `hashtags` | yes | Array string, không phải text gộp. |
| `cta` | yes | CTA mềm hoặc hành động cụ thể. |

### 3.3 Metadata lưu vào `bizcity_crm_events`

Không tạo bảng mới ở Phase 1 nếu chưa cần cộng tác nhiều người. Dùng `bizcity_crm_events` làm source of truth lịch:

```json
{
  "automation_phase": "PHASE-1-TEMPLATES-AUTOMATION",
  "content_plan": {
    "plan_id": "cp_20260720_abc123",
    "day_index": 1,
    "channel": "facebook",
    "content_pillar": "knowledge",
    "objective": "reach",
    "title": "Một bữa cơm ngon bắt đầu từ điều rất nhỏ",
    "content": "...",
    "image_brief": "...",
    "hashtags": ["#gaoNgon", "#buaComGiaDinh"],
    "cta": "Bạn thường chọn gạo theo tiêu chí nào?",
    "approval_status": "draft",
    "source_refs": []
  },
  "workflow_id": 123,
  "run_id": 456,
  "publish": {
    "status": "pending",
    "target": "fb_page",
    "fb_page_id": ""
  }
}
```

Recommended event values:

| Column | Value |
|---|---|
| `event_type` | `automation_workflow` for workflow-triggered items; future `content_plan_item` only after R-DCL bump. |
| `source` | `workflow` or `content_plan`. If adding new enum/value, update changelog first. |
| `title` | `content_plan.title`. |
| `description` | Short preview of `content`. |
| `start_at` | `date time` from item. |
| `status` | `active` until published or skipped. |
| `user_id` | owner resolved from Automation context, never `get_current_user_id()` fallback in cron. |

---

## 4. Blocks cần bổ sung

Wave 1 ưu tiên block/parser/config storage và UI DataTable. Wave 2 mới ưu tiên các block chạy automation.

### 4.1 `action.plan_content_calendar`

Sinh kế hoạch 7/14/30 ngày dạng JSON có cấu trúc.

Inputs:

| Field | Type | Default | Ghi chú |
|---|---|---|---|
| `product_name` | text | `{{trigger.text}}` | Sản phẩm/dịch vụ chính. |
| `audience` | textarea | empty | Chân dung khách hàng. |
| `pain_points` | textarea | empty | Vấn đề thường gặp. |
| `channels` | text | `facebook` | CSV: facebook, wp_post, zalo_bot. |
| `start_date` | date | tomorrow | Ngày bắt đầu. |
| `days` | number | 30 | Clamp 1..60. |
| `posts_per_week` | number | 5 | Dùng để phân bổ ngày nghỉ. |
| `default_time` | text | `08:00` | Giờ đăng mặc định. |
| `content_mix` | text | `knowledge:50,review:25,soft_sell:25` | Tỉ lệ pillar. |
| `cta` | textarea | empty | CTA mong muốn. |
| `notebook_id` | notebook_picker | 0 | Inject product notebook nếu có. |
| `price_sheet_context` | textarea | empty | Bảng giá/input từ spreadsheet nếu đã import. |
| `product_catalog_json` | textarea | empty | JSON từ `product-catalog-sample.csv` hoặc file user upload. |
| `product_filter` | text | empty | Lọc theo category/vendor/keyword trước khi lập plan. |
| `comparison_mode` | select | `soft_compare` | `none`, `soft_compare`, `objective_review`. |
| `scenario_config_json` | textarea | empty | JSON từ `automation-scenario-config-sample.csv`. |
| `output_mode` | select | `plan_only` | `plan_only` hoặc `plan_with_drafts`. |

Outputs:

```php
array(
    'ok'             => true,
    'plan_id'        => 'cp_20260720_abc123',
    'items_count'    => 30,
    'calendar_json'  => '[...]',
    'calendar_md'    => '| Ngày | Tiêu đề | ... |',
    'first_title'    => '...',
    'first_content'  => '...',
    'degraded'       => '',
)
```

Implementation notes:

- Dùng `BizCity_LLM_Client::chat()` với `purpose=automation_content_plan`.
- Validate JSON bằng PHP array schema, không tin raw LLM output.
- Nếu LLM lỗi, trả `_degraded=true` và có fallback deterministic 7 ngày mẫu, không publish tự động.
- Ghi `note_event('content_plan_created', ...)` theo R-CRON-META.
- PHP 7.4 compatible, không dùng `str_contains`, union type, `match`, nullsafe.

### 4.2 `action.expand_content_item`

Nhận một item từ `calendar_json` và viết bản đầy đủ.

Inputs:

| Field | Type | Default |
|---|---|---|
| `calendar_json` | textarea | `{{plan.calendar_json}}` |
| `day_index` | number | 1 |
| `max_words` | number | 200 |
| `tone` | text | empty |
| `must_include` | textarea | empty |
| `must_avoid` | textarea | `Không viết quá bán hàng.` |
| `notebook_id` | notebook_picker | 0 |

Outputs:

```php
array(
    'ok'          => true,
    'day_index'   => 1,
    'date'        => '2026-07-21',
    'title'       => '...',
    'content'     => '...',
    'image_brief' => '...',
    'hashtags'    => '#a #b #c',
    'cta'         => '...',
)
```

Vai trò: tách plan và expand để user có thể duyệt từng bài, retry từng ngày, hoặc expand sát thời điểm đăng để thông tin còn mới.

### 4.3 `action.schedule_content_plan`

Tạo nhiều `bizcity_crm_events` từ `calendar_json`.

Inputs:

| Field | Type | Default |
|---|---|---|
| `calendar_json` | textarea | `{{plan.calendar_json}}` |
| `workflow_id` | number | `{{_workflow_id}}` |
| `approval_status` | select | `draft` |
| `publish_mode` | select | `approval_required` |
| `target_fb_page_id` | fb_page_picker | empty |
| `target_wp_status` | select | `draft` |

Outputs:

```php
array(
    'ok'            => true,
    'created_count' => 30,
    'plan_id'       => 'cp_20260720_abc123',
    'event_ids'     => '101,102,103',
)
```

Rules:

- Create rows with `status=active` but `metadata.content_plan.approval_status=draft`.
- Do not auto-publish unless `publish_mode=auto_publish` and target resource ownership is verified.
- Use `build_event_metadata()` so inbound/owner audit is preserved.
- Fail closed when owner user_id cannot be resolved.

### 4.4 `action.publish_content_item` (optional thin wrapper)

Phase 1 có thể chưa cần block này nếu workflow gọi thẳng `action.publish_fb_post` hoặc `action.publish_wp_post`.

Khi build, block này chỉ nên route theo `channel`:

| Channel | Delegate |
|---|---|
| `facebook` | `BizCity_Automation_Action_Publish_FB_Post` hoặc scheduler `fb_post` event. |
| `wp_post` | `BizCity_Automation_Action_Publish_WP_Post`. |
| `zalo_bot` | `BizCity_Automation_Action_Reply_Zalo`. |

Không copy logic publish riêng.

### 4.5 `action.import_content_plan_sheet`

Đổi từ optional sang **MVP bridge** cho Phase 1. Trong Wave 1, block/API này đọc CSV upload hoặc CSV public/export URL, normalize về datatable rows và config pack. Trong Wave 2, output mới được chuyển tiếp cho `action.schedule_content_plan` hoặc workflow generator.

Inputs:

| Field | Type | Ghi chú |
|---|---|---|
| `source_type` | select | `csv_url`, `uploaded_csv`, `google_sheet_export` |
| `source_url` | text | Chỉ dùng URL public/export được. Không dùng link private `/edit` nếu chưa đổi sang export CSV. |
| `uploaded_file_id` | media/file | File CSV user tải lên từ máy. |
| `column_map_json` | textarea | Map cột sheet sang contract. |
| `target_schema` | select | `content_calendar` hoặc `product_catalog`. |
| `fallback_prompt` | textarea | Nếu sheet không đọc được thì dùng prompt này để lập plan. |
| `default_time` | text | Giờ đăng mặc định khi CSV bỏ trống. |
| `target_timezone` | text | Default site timezone. |

Outputs:

Wave 2 / legacy scheduler output:

```php
array(
  'ok'               => true,
  'plan_id'          => 'cp_csv_20260720_abc123',
  'items_count'      => 30,
  'calendar_json'    => '[...]',
  'calendar_md'      => '| Ngày | Tiêu đề | ... |',
  'rejected_count'   => 0,
  'rejected_json'    => '[]',
  'source_type'      => 'uploaded_csv',
  'target_schema'    => 'content_calendar',
)
```

Wave 1 output ưu tiên:

```php
array(
  'ok'             => true,
  'pack_id'        => 'gacp_20260720_abc123',
  'schema_key'     => 'content_calendar',
  'rows_count'     => 30,
  'columns'        => array( 'day_index', 'date', 'time', 'title', 'content' ),
  'datatable_rows' => '[...]',
  'rejected_count' => 0,
)
```

Khi `target_schema=product_catalog`, output đổi ý nghĩa:

```php
array(
  'ok'                => true,
  'items_count'       => 30,
  'product_json'      => '[...]',
  'product_md'        => '| Sản phẩm | Giá | USP | Đối chứng |',
  'rejected_count'    => 0,
  'target_schema'     => 'product_catalog',
)
```

Khi `target_schema=automation_scenarios`, output:

```php
array(
  'ok'              => true,
  'items_count'     => 4,
  'scenario_json'   => '[...]',
  'scenario_md'     => '| Kịch bản | Trigger | Output |',
  'rejected_count'  => 0,
  'target_schema'   => 'automation_scenarios',
)
```

Copy-link support:

| Link user copy | Có parse trực tiếp? | Cách xử lý |
|---|---:|---|
| Public `.csv` URL | yes | Fetch, validate size/MIME, parse. |
| Google Sheets `/export?format=csv&gid=...` | yes | Fetch như CSV public. |
| Google Sheets `/edit?...` public | maybe | Convert sang export CSV nếu spreadsheet id/gid parse được. |
| Google Sheets private `/edit?...` | no | Trả Error UX yêu cầu share public hoặc upload CSV. |
| XLSX link | no in Phase 1 | Yêu cầu user download CSV; XLSX parser để Phase sau. |

Security:

- Không yêu cầu OAuth Google trong Automation block Phase 1. Nếu cần OAuth, đi qua 1-API Google OAuth Hub theo R-GW-API-CATALOG.
- Không fetch Google Sheet private bằng credential client site.
- CSV parser phải sanitize cell content, giới hạn số dòng/cột, không log PII.
- Limit đề xuất: tối đa 90 rows, 32 columns, 512 KB/file, timeout 8s.
- Chặn SSRF: chỉ cho `http/https`, reject localhost/private IP, không follow redirect quá 2 lần.

### 4.6 `action.load_guru_content_config` / Guru bridge node

Đây là node bridge đề xuất cho ý tưởng "Guru là cầu nối".

**Không biến Guru thành trigger primary.** Guru giữ vai trò persona/config/context bridge, còn trigger/action/logic vẫn thuộc Automation.

Inputs:

| Field | Type | Ghi chú |
|---|---|---|
| `guru_slug` | text/guru_picker | Guru chịu trách nhiệm kịch bản. |
| `content_calendar_json` | textarea | Lịch content đã parse. |
| `product_catalog_json` | textarea | Product catalog đã parse. |
| `scenario_config_json` | textarea | Scenario config đã parse. |
| `config_pack_id` | text | Pack đã lưu từ DataTable Studio. |
| `scope` | select | `content`, `product`, `reply`, `all`. |
| `strict_schema` | toggle | Nếu bật, reject unknown fields không nằm trong `custom_fields`. |

Outputs:

```php
array(
  'ok'                    => true,
  'guru_id'               => 12,
  'guru_slug'             => 'content_guru',
  'content_calendar_json' => '[...]',
  'product_catalog_json'  => '[...]',
  'scenario_config_json'  => '[...]',
  'config_hash'           => 'sha256:...',
)
```

Vai trò node:

```text
trigger.cron / trigger.zalo_inbound
  → action.load_guru_content_config
  → logic/action tiếp theo dùng {{cfg.product_catalog_json}}, {{cfg.content_calendar_json}}
```

Không nên ghi mọi thứ vào `character.system_prompt`. System prompt chỉ định giọng nói, nguyên tắc trả lời, vai trò Guru. CSV/JSON config là dữ liệu vận hành, phải version được, preview được, validate được.

---

## 4.7 Guru bridge architecture decision

### Phản biện hướng "đưa hết vào character guru"

| Hướng | Ưu điểm | Rủi ro |
|---|---|---|
| Nhét toàn bộ CSV/JSON vào `system_prompt` hoặc Quick Training | Nhanh, Guru trả lời theo dữ liệu mới. | Không có schema, khó diff, khó preview, dễ prompt quá dài, scheduler không query được, không biết row nào tạo event nào. |
| Guru làm trigger chính | UX nghe tự nhiên: `@guru` chạy mọi thứ. | Trộn persona với event; mất channel scope, quota, audit, ownership; đã bị phản biện trong seed/guru spec. |
| Guru làm bridge node/context provider | Giữ persona + config gần nhau, vẫn để Automation quyết định trigger/action/scheduler. | Cần thêm node loader và UI preview config. |

Quyết định: **Guru là bridge/context provider, không phải storage chính và không phải trigger chính.**

Guru có thể gắn:

- system prompt/tone/quick training cho phong cách trả lời;
- notebook/product knowledge;
- content automation config pack đã validate;
- allowlist skills/actions được phép gọi.

Automation graph vẫn là source of truth runtime:

```text
Channel/Cron Trigger
  → Guru Bridge Node (load persona + content/product/scenario config)
  → Logic/Action nodes
  → Scheduler/Publisher/Reply
```

### Cấu hình phi cấu trúc kiểu JSON trong Guru có hợp lý không?

Có, nhưng phải có ranh giới:

| Loại dữ liệu | Nơi lưu hợp lý | Lý do |
|---|---|---|
| Tone, vai trò, nguyên tắc trả lời | `character.system_prompt` / Quick Sheet | Đây là persona. |
| FAQ ngắn, guideline tư vấn | Quick Training / KG source | Đây là knowledge dễ truy hồi. |
| Product catalog, content calendar, scenario config | Config pack gắn Guru hoặc workflow metadata, không nhét prompt | Đây là dữ liệu vận hành cần parse/schedule. |
| Extra columns linh hoạt | `custom_fields` / `extra_json` sau validate | Cho phép phi cấu trúc nhưng không phá schema. |

Vì vậy nên phát triển **Guru Automation Config Pack**:

```json
{
  "pack_id": "gacp_20260720_abc123",
  "guru_slug": "content_guru",
  "version": "1.0.0",
  "content_calendar": [],
  "product_catalog": [],
  "automation_scenarios": [],
  "custom_fields": {},
  "hash": "sha256:..."
}
```

Phase 1 có thể lưu pack trong workflow/template metadata hoặc transient preview trước khi import. Phase 2 nếu cần quản lý nhiều pack theo Guru thì mới cân nhắc table riêng qua R-DCL/R-CR.

Với yêu cầu live editable datatable, khuyến nghị cập nhật quyết định này:

- Prototype rất nhỏ có thể lưu tạm trong workflow metadata.
- Wave 1 production nên có config table riêng để row-level edit/search không phải ghi đè một JSON blob lớn.
- Nếu thêm table, bắt buộc đi R-DCL + R-CR + Site Provisioner.

Schema đề xuất Wave 1:

```text
bizcity_automation_config_packs
  id, pack_key, name, schema_key, guru_id, owner_user_id, source_type,
  source_ref, version, status, created_at, updated_at

bizcity_automation_config_rows
  id, pack_id, row_key, row_order, row_json LONGTEXT,
  canonical_json LONGTEXT, search_text LONGTEXT,
  validation_status, validation_errors_json, updated_at
```

`row_json` giữ linh hoạt cho LLM; `search_text` phục vụ tìm keyword/`LIKE`; `canonical_json` giúp runtime đọc field cần thiết mà không phụ thuộc cột lỏng.

### 4.8 DataTable Studio APIs

Wave 1 REST đề xuất trong namespace `bizcity-automation/v1`:

| Method | Route | Purpose |
|---|---|---|
| POST | `/config-packs/parse` | Parse upload/link, trả columns + rows preview, chưa lưu. |
| POST | `/config-packs` | Tạo pack từ preview. |
| GET | `/config-packs` | List packs theo schema/guru/status. |
| GET | `/config-packs/{id}` | Lấy pack + rows paginated. |
| PATCH | `/config-packs/{id}/rows/{row}` | Save live edit một row. |
| POST | `/config-packs/{id}/rows/bulk` | Bulk add/delete/reorder/update. |
| POST | `/config-packs/{id}/validate` | Rebuild canonical/search_text + validate. |
| POST | `/config-packs/{id}/activate` | Wave 2: tạo/sync workflow từ scenario rows. |

Wave 1 không gọi `/activate` tự động.

---

## 5. Template JSON đề xuất

Tạo file mới:

```text
core/automation/templates/content-calendar-30d.json
```

Blueprint 1:

```json
[
  {
    "slug": "tpl_content_calendar_30d_fb_v1",
    "name": "Lập kế hoạch content Facebook 30 ngày",
    "description": "Nhập sản phẩm, khách hàng, vấn đề thường gặp và CTA → AI lập 30 ngày content gồm tiêu đề, nội dung, brief ảnh, hashtag → lưu vào Automation Calendar để duyệt/publish.",
    "category": "automation",
    "source": "builtin",
    "trigger_type": "manual",
    "icon": "CalendarDays",
    "tags": "content,calendar,30d,facebook,ai,approval",
    "trigger_config": { "mode": "manual" },
    "graph": {
      "meta": { "template": "tpl_content_calendar_30d_fb_v1" },
      "nodes": [
        { "id": "t1", "type": "trigger", "position": { "x": 0, "y": 80 }, "data": { "blockId": "trigger.manual", "label": "Manual · tạo kế hoạch 30 ngày" } },
        { "id": "plan", "type": "action", "position": { "x": 320, "y": 80 }, "data": { "blockId": "action.plan_content_calendar", "label": "Lập kế hoạch 30 ngày", "product_name": "{{trigger.text}}", "audience": "", "pain_points": "", "channels": "facebook", "days": 30, "posts_per_week": 5, "default_time": "08:00", "content_mix": "knowledge:50,review:25,soft_sell:25", "cta": "Inbox để được tư vấn", "notebook_id": 0, "output_mode": "plan_with_drafts" } },
        { "id": "schedule", "type": "action", "position": { "x": 640, "y": 80 }, "data": { "blockId": "action.schedule_content_plan", "label": "Lưu vào lịch duyệt", "calendar_json": "{{plan.calendar_json}}", "approval_status": "draft", "publish_mode": "approval_required", "target_fb_page_id": "" } },
        { "id": "log", "type": "action", "position": { "x": 960, "y": 80 }, "data": { "blockId": "action.log", "label": "Ghi audit", "message": "content_calendar_30d — plan_id={{plan.plan_id}} created={{schedule.created_count}}" } }
      ],
      "edges": [
        { "id": "e_t1_plan", "source": "t1", "target": "plan" },
        { "id": "e_plan_schedule", "source": "plan", "target": "schedule" },
        { "id": "e_schedule_log", "source": "schedule", "target": "log" }
      ]
    }
  }
]
```

Blueprint 2 sau khi block sheet có sẵn:

```text
tpl_content_calendar_from_sheet_v1
trigger.manual → action.import_content_plan_sheet → action.schedule_content_plan → action.log
```

Blueprint 3 để user tải mẫu:

```text
tpl_content_calendar_csv_template_v1
trigger.manual → action.reply_zalo/email/admin_notice chứa link download sample CSV
```

MVP UI có thể không cần blueprint 3 nếu Template Gallery có nút "Tải CSV mẫu" cố định.

Blueprint 4 — Zalo 7h hằng ngày:

```text
tpl_daily_zalo_script_from_guru_config_v1
trigger.cron(0 7 * * *) → action.load_guru_content_config → action.pick_today_content → action.reply_zalo → action.log
```

Blueprint 5 — Web daily post:

```text
tpl_daily_web_post_from_guru_config_v1
trigger.cron(0 8 * * *) → action.load_guru_content_config → action.pick_today_content → action.expand_content_item → action.publish_wp_post → action.log
```

Blueprint 6 — Facebook daily post:

```text
tpl_daily_fb_post_from_guru_config_v1
trigger.cron(0 9 * * *) → action.load_guru_content_config → action.pick_today_content → action.expand_content_item → action.publish_fb_post → action.log
```

Blueprint 7 — Customer auto-reply:

```text
tpl_customer_auto_reply_from_product_catalog_v1
trigger.zalo_inbound / trigger.fb_message → action.load_guru_content_config → action.match_product_intent → logic.condition → action.reply_zalo / action.reply_fb_message
```

---

## 5.1 CSV sample / download / copy link UX

### 5.1.1 Nút tải file / copy link mẫu

Trong Template Gallery hoặc Calendar import sheet:

```text
[Tải CSV mẫu 30 ngày]
[Copy link CSV mẫu]
[Tải CSV sản phẩm mẫu]
[Copy link CSV sản phẩm mẫu]
[Tải CSV cấu hình kịch bản mẫu]
[Copy link CSV cấu hình kịch bản mẫu]
```

File trả về:

```text
core/automation/templates/content-calendar-30d-sample.csv
core/automation/templates/product-catalog-sample.csv
core/automation/templates/automation-scenario-config-sample.csv
```

Hai thao tác đều phải dùng chung source CSV mẫu:

| Action | Output | Dùng để parse lại? |
|---|---|---:|
| Tải CSV mẫu | Browser download file `.csv` | yes, qua `uploaded_csv`. |
| Copy link CSV mẫu | Copy URL public same-origin tới sample CSV | yes, qua `csv_url`. |
| Tải CSV sản phẩm mẫu | Browser download product catalog `.csv` | yes, qua `uploaded_csv` với `target_schema=product_catalog`. |
| Copy link CSV sản phẩm mẫu | Copy URL public same-origin tới product sample CSV | yes, qua `csv_url` với `target_schema=product_catalog`. |
| Tải CSV cấu hình kịch bản mẫu | Browser download scenario config `.csv` | yes, qua `uploaded_csv` với `target_schema=automation_scenarios`. |
| Copy link CSV cấu hình kịch bản mẫu | Copy URL public same-origin tới scenario config CSV | yes, qua `csv_url` với `target_schema=automation_scenarios`. |

Sample CSV nên giữ header canonical và có 30 dòng. Nội dung mẫu có thể viết ASCII không dấu để Excel cũ mở không lỗi encoding; parser vẫn phải hỗ trợ UTF-8 tiếng Việt khi user edit lại.

REST đề xuất:

| Method | Route | Purpose |
|---|---|---|
| GET | `/content-plan/sample-csv` | Download hoặc trả URL CSV mẫu với header canonical và 30 dòng mẫu. |
| GET | `/content-plan/product-sample-csv` | Download hoặc trả URL CSV sản phẩm mẫu. |
| GET | `/content-plan/scenario-sample-csv` | Download hoặc trả URL CSV cấu hình kịch bản mẫu. |
| POST | `/content-plan/parse-csv` | Upload file hoặc URL, trả preview items + rejected rows. |
| POST | `/content-plan/import-events` | Commit preview thành `bizcity_crm_events`. |

Namespace giữ `bizcity-automation/v1`.

### 5.1.2 Copy link

UI field:

```text
Paste CSV/Google Sheet public link
[________________________________]
[Xem trước lịch]
```

Flow:

```text
User paste link
  → parse-csv endpoint fetch/convert nếu public
  → trả preview 30 dòng
  → user chỉnh mapping nếu header lạ
  → user bấm Import vào lịch
  → schedule_content_plan tạo event rows
  → Calendar hiển thị theo ngày/giờ/channel/status
```

Nếu link là Google Sheets `/edit`, parser thử convert:

```text
https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid|0}
```

Nếu Google trả HTML đăng nhập thay vì CSV, trả `content_plan_csv_private` với hint yêu cầu share public hoặc upload file CSV.

---

## 6. Runtime publish flow

Runtime publish flow thuộc **Wave 2**. Wave 1 chỉ dừng ở import → datatable → save config pack.

### 6.1 Approval required (default)

```text
Manual run tạo plan
  → schedule_content_plan tạo 30 calendar events draft
  → user mở Automation Calendar duyệt/sửa từng item
  → khi đến giờ, cron matcher chỉ publish item đã approval_status=approved
```

### 6.2 Auto publish

```text
Manual run tạo plan
  → schedule_content_plan tạo 30 events approved
  → cron matcher tới giờ
  → expand_content_item nếu content chưa full
  → publish_fb_post / publish_wp_post
  → update metadata.publish.status=done hoặc failed
```

Auto publish chỉ bật cho admin/owner có quyền và target resource đã verify ownership.

---

## 7. UI/UX yêu cầu

### 7.0 Wave 1 — Config DataTable Studio

UI nên là một route/surface riêng trong Automation, không nhét vào Builder canvas:

```text
Automation → Cấu hình dữ liệu
  Tabs: Content Calendar | Product Catalog | Automation Scenarios
```

Layout đề xuất:

```text
┌─────────────────────────────────────────────────────────────┐
│ Cấu hình dữ liệu automation                                  │
│ [Import CSV] [Paste Google Sheet link] [Tải mẫu] [Save]      │
├─────────────────────────────────────────────────────────────┤
│ Pack: Content tháng 8 · Guru: content_guru · Status: Draft   │
├─────────────────────────────────────────────────────────────┤
│ Filter/Search: [____________________]  Schema: [Product ▼]   │
├─────────────────────────────────────────────────────────────┤
│ Editable DataTable                                           │
│ row | product_name | price_vnd | usp | comparison_product... │
│  1  | ...          | ...       | ... | ...                   │
├─────────────────────────────────────────────────────────────┤
│ Row detail sheet: canonical fields · row_json · validation   │
└─────────────────────────────────────────────────────────────┘
```

DataTable requirements:

- Inline edit cell text/number/select.
- Add column, rename column, hide column.
- Add row, duplicate row, delete row, reorder row.
- Search over `search_text` and visible columns.
- Row detail sheet for long text / JSON fields.
- Dirty state per row; save row-level, not whole pack only.
- Validation badges: valid, warning, error, draft_needs_expand.
- "Build search text" happens on save/validate.
- Import preview and saved table use the same component.

Do not use raw `<textarea JSON>` as primary UI. JSON view is a debug/detail panel only.

### 7.1 Automation Builder

FE registry cần thêm block definitions cho:

- `action.plan_content_calendar`
- `action.expand_content_item`
- `action.schedule_content_plan`
- `action.import_content_plan_sheet`
- `action.load_guru_content_config`

Fields nên dùng control sẵn có:

- `notebook_picker` cho notebook sản phẩm.
- `fb_page_picker` hoặc field tương đương cho Page Facebook.
- `textarea` cho audience/pain_points/CTA.
- `select` cho channel/objective/content_pillar.
- `textarea` hoặc file/link picker cho `product_catalog_json` / product CSV URL.

### 7.2 Automation Calendar

Calendar chip nên hiển thị:

```text
08:00 · FB · Knowledge · Draft
Một bữa cơm ngon bắt đầu từ điều rất nhỏ
```

Sheet edit item cần có tabs/sections:

| Section | Fields |
|---|---|
| Nội dung | title, content, CTA, hashtags |
| Hình ảnh | image_brief, generated_image_url |
| Lịch | date, time, channel, target page/status |
| Duyệt | approval_status, reviewer_note |
| Evidence | source_refs, run_id, workflow_id |

Không render raw JSON làm UI chính, chỉ để debug.

### 7.3 Import preview

Trước khi ghi `bizcity_crm_events`, UI phải có preview:

| Column | Hiển thị |
|---|---|
| Ngày giờ | `date time` đã normalize theo timezone site. |
| Kênh | Facebook / WP / Zalo. |
| Trụ cột | Knowledge / Review / Soft sell. |
| Tiêu đề | `title`. |
| Trạng thái | `draft`, `draft_needs_expand`, `approved`. |
| Lỗi | reason nếu row bị reject. |

Chỉ khi user bấm **Import vào lịch** mới tạo event rows. Parser endpoint không được ghi DB.

Product catalog preview không tạo lịch. UI chỉ hiển thị bảng sản phẩm đã parse:

| Column | Hiển thị |
|---|---|
| Nhóm hàng | `category`. |
| Đơn vị | `vendor`. |
| Tên sản phẩm | `product_name`. |
| Giá bán | `price_vnd` format VND. |
| USP | `usp`. |
| Sản phẩm đối chứng | `comparison_product`. |
| Góc so sánh | `comparison_angle`. |

Sau preview, user có thể bấm **Dùng bảng này để lập kế hoạch 30 ngày**. Khi đó `product_json` được đưa vào `action.plan_content_calendar.product_catalog_json`.

Scenario config preview:

| Column | Hiển thị |
|---|---|
| Kịch bản | `scenario_slug`. |
| Guru | `guru_slug`, trạng thái resolve được hay không. |
| Trigger | `trigger_type` + `schedule` hoặc channel keyword. |
| Kênh | Zalo / Web / Facebook / CRM reply. |
| Nguồn | calendar CSV + product CSV. |
| Action chain | Danh sách node sẽ sinh hoặc sẽ chạy. |
| Lỗi | thiếu target page, thiếu Guru, cron sai, JSON extra lỗi. |

User bấm **Tạo/Cập nhật workflow từ config** thì hệ thống mới sinh workflow/template hoặc cập nhật workflow metadata. Không tạo ẩn ở bước preview.

Trong Wave 1, button chính sau preview là **Lưu thành bảng cấu hình**. Button **Tạo/Cập nhật workflow từ config** chỉ bật ở Wave 2.

---

## 8. R-DCL / R-CR / R-DDV

### 8.1 Storage decision cho Wave 1

Nhận định "không thêm bảng" chỉ đúng nếu Phase 1 dừng ở import one-shot. Với yêu cầu live editable datatable, cần tách:

| Scope | Storage |
|---|---|
| Wave 1 prototype | Có thể lưu pack JSON trong workflow metadata hoặc option tạm. |
| Wave 1 production | Nên thêm `bizcity_automation_config_packs` + `bizcity_automation_config_rows`. |
| Wave 2 runtime events | Reuse `bizcity_crm_events`. |

Nếu chỉ thêm metadata contract, update `core/diagnostics/changelog/core.automation.json` dạng contract-only:

- `metadata.content_plan.*`
- `source='content_plan'` nếu được dùng.
- New event type `content_plan_item` nếu quyết định thêm, nhưng phải bump changelog trước code.
- `config_pack_id`, `config_row_key` trong `metadata.content_plan` để trace event về datatable row.

### 8.2 Khi cần bảng riêng ở Phase 2

Chỉ tạo bảng riêng nếu cần collaboration/versioning nhiều người:

```text
bizcity_content_plans
bizcity_content_plan_items
```

Nếu tạo bảng:

1. Update changelog JSON trước.
2. Register `BizCity_Schema_Registry`.
3. Installer idempotent dùng `$wpdb->prefix`.
4. Provision qua site context đúng R-MSDB.
5. DDV Disk/Loader/Runtime PASS.

### 8.3 DDV probe mới

Probe đề xuất: `core.automation.content_calendar_30d`.

Rows:

| Row | Disk | Loader | Runtime |
|---|---|---|---|
| `blocks_registered` | action class files exist | registry has block ids | catalog export contains fields |
| `plan_contract` | validator helper exists | block loaded | synthetic input returns 30 valid items |
| `schedule_events` | scheduler bridge exists | CRM bridge loaded | synthetic plan creates event rows with metadata.content_plan |
| `approval_gate` | approval guard exists | cron matcher loaded | draft item does not publish |
| `template_seed` | JSON template exists | seeder loaded | template slug appears in query |
| `datatable_import` | config pack table/helper exists | REST loaded | CSV parse returns editable rows without creating workflow |
| `datatable_live_edit` | row patch endpoint exists | permissions attached | patch row rebuilds `search_text` and validation status |
| `wave2_activation_gate` | activate endpoint exists or skipped | route guard loaded | Wave 1 import does not activate workflow automatically |

---

## 9. Error UX

User-visible failures must return R-ERROR-UX payloads when exposed via REST/UI.

| Code | Message | Hint | Help code |
|---|---|---|---|
| `invalid_param` | Thiếu thông tin lập kế hoạch nội dung. | Nhập sản phẩm, khách hàng mục tiêu và kênh đăng. | `invalid_param_generic` |
| `llm_error` | AI chưa tạo được kế hoạch nội dung. | Thử giảm số ngày hoặc kiểm tra API Key BizCity. | `llm_error_generic` |
| `gateway_degraded` | Hub BizCity đang gián đoạn. | Kiểm tra API Key hoặc thử lại sau. | `gateway_degraded` |
| `content_plan_invalid` | Kế hoạch AI trả về chưa đúng định dạng. | Bấm tạo lại hoặc chuyển sang chế độ nháp 7 ngày. | `invalid_param_generic` |
| `content_plan_csv_private` | Link CSV/Google Sheet chưa truy cập công khai. | Chọn Share public, dùng link export CSV hoặc tải file CSV lên. | `invalid_param_generic` |
| `content_plan_csv_invalid` | File CSV chưa đúng mẫu kế hoạch nội dung. | Tải CSV mẫu rồi copy dữ liệu vào đúng cột. | `invalid_param_generic` |
| `content_plan_csv_too_large` | File CSV vượt giới hạn cho phép. | Giữ tối đa 90 dòng và tải lại file CSV. | `invalid_param_generic` |
| `product_catalog_invalid` | File sản phẩm thiếu tên, giá, USP hoặc sản phẩm đối chứng. | Tải CSV sản phẩm mẫu rồi điền đủ 4 cột bắt buộc. | `invalid_param_generic` |
| `scenario_config_invalid` | File cấu hình kịch bản thiếu trigger, Guru hoặc action chain. | Tải CSV cấu hình kịch bản mẫu rồi điền đủ cột bắt buộc. | `invalid_param_generic` |
| `guru_config_missing` | Guru chưa có cấu hình automation hợp lệ. | Import CSV cấu hình hoặc chọn Guru khác. | `invalid_param_generic` |
| `config_pack_invalid` | Bảng cấu hình còn dòng lỗi. | Sửa các dòng đỏ rồi bấm Validate lại. | `invalid_param_generic` |
| `config_row_invalid` | Dòng cấu hình chưa đủ dữ liệu bắt buộc. | Điền các ô bắt buộc hoặc xoá dòng này. | `invalid_param_generic` |
| `permission_denied` | Bạn không có quyền duyệt lịch đăng này. | Đăng nhập bằng tài khoản sở hữu kênh hoặc liên hệ quản trị. | `permission_denied` |

Không lộ prompt đầy đủ, API key, raw provider response, stack trace hoặc dữ liệu khách hàng trong message/context.

---

## 10. Implementation checklist

### BE blocks

- [ ] **Wave 1:** Add config pack parser/storage service for datatable rows.
- [ ] **Wave 1:** Add row-level REST endpoints for live edit and validation.
- [ ] Add `class-action-plan-content-calendar.php`.
- [ ] Add `class-action-expand-content-item.php`.
- [ ] Add `class-action-schedule-content-plan.php`.
- [ ] Add `class-action-import-content-plan-sheet.php`.
- [ ] Add CSV parser helper with header normalization, row validation and SSRF-safe URL fetch.
- [ ] Add product catalog parser mode: `target_schema=product_catalog`.
- [ ] Add scenario config parser mode: `target_schema=automation_scenarios`.
- [ ] Add `action.load_guru_content_config` bridge node.
- [ ] Add picker/action helper for `pick_today_content` and `match_product_intent` or implement them inside the bridge block as explicit methods.
- [ ] Require block files in `core/automation/bootstrap.php`.
- [ ] Register blocks in `BizCity_Automation_Block_Registry` with R-STAMP.
- [ ] Add cron/publish guard: draft content plan item must not auto-publish.

### FE builder

- [ ] **Wave 1:** Add `ConfigDataTableRoute.jsx` for import/edit/save packs.
- [ ] **Wave 1:** Add reusable editable datatable component with row detail sheet.
- [ ] Add block definitions in `frontend/src/blocks/registry.js`.
- [ ] Add output variables to block catalog so users can bind `{{plan.calendar_json}}`.
- [ ] Ensure text does not overflow inspector fields on mobile/desktop.

### Templates

- [ ] Add `core/automation/templates/content-calendar-30d.json`.
- [ ] Add `core/automation/templates/content-calendar-30d-sample.csv`.
- [ ] Add `core/automation/templates/product-catalog-sample.csv`.
- [ ] Add `core/automation/templates/automation-scenario-config-sample.csv`.
- [ ] Bump `BizCity_Automation_Templates_Seeder::SEED_VERSION` with `PHASE-1-TEMPLATES-AUTOMATION` stamp.
- [ ] Reseed and verify template appears in Template Gallery.
- [ ] Submit/sync to Hub after local PASS.

### Calendar / REST

- [ ] **Wave 1:** Add `/config-packs/*` REST endpoints.
- [ ] **Wave 1:** Keep import/save separate from workflow activation.
- [ ] Extend Calendar event sheet to edit `metadata.content_plan` fields.
- [ ] Add CSV preview/import REST endpoints or wire them through `action.import_content_plan_sheet`.
- [ ] Add approval status update endpoint if existing patch cannot update metadata safely.
- [ ] Add runtime guard for owner/resource verification before publish.

### Validation

- [ ] Update `core/diagnostics/changelog/core.automation.json` contract.
- [ ] Run `php core/diagnostics/validate-schema-changelog.php` when PHP CLI exists.
- [ ] Add DDV probe row PASS for content calendar.
- [ ] Test sample prompt: product + audience + pain points → 30 items.
- [ ] Test CSV download → edit → upload → preview → import 30 events.
- [ ] Test CSV import → editable datatable → row edit → save → search_text rebuild.
- [ ] Test unknown Excel columns persist in `row_json`.
- [ ] Test product catalog CSV download → edit → upload → preview → feed planner.
- [ ] Test scenario config CSV download → edit → upload → preview → create/update workflows.
- [ ] Test Guru bridge node loads config without putting raw CSV into `system_prompt`.
- [ ] Test copy public Google Sheet export link → preview → import 30 events.
- [ ] Test private Google Sheet link returns R-ERROR-UX, not fatal/HTML dump.
- [ ] Test schedule: 30 events appear in Automation Calendar.
- [ ] Test approval gate: draft item does not publish.
- [ ] Test publish: approved FB item delegates to existing publisher and records metadata.

---

## 11. Acceptance criteria

Phase 1 is DONE only when:

- Wave 1: user can import CSV/Google Sheet into editable datatable and save config pack without activating automation.
- Wave 1: user can edit cells/rows/columns live and search saved rows through normalized `search_text`.
- User can create a 30-day content plan from product/audience/channel/CTA input.
- User can download a CSV mẫu, edit it, upload it, preview it and import it into scheduler events.
- User can download product catalog CSV mẫu, edit product name/price/USP/comparison product, upload it and use it as source for content planning.
- User can download automation scenario config CSV mẫu and define Zalo 7h, web daily, Facebook daily and customer auto-reply scenarios.
- Guru can act as a bridge/context provider for config, but trigger/action/scheduler remain Automation-owned.
- User can paste a public CSV/Google Sheet export link and import the same scheduler data.
- Each item has title, content, image brief, hashtags, CTA, objective and scheduled time.
- Items are visible/editable in Automation Calendar before publishing.
- Draft items never publish automatically.
- Approved items publish through existing channel blocks, not duplicated publisher code.
- JSON template is loaded by seeder and visible in Template Gallery.
- DDV probe has Disk/Loader/Runtime PASS.
- PHP 7.4 compatibility grep is clean for touched PHP files.

---

## 12. Dev decision

Recommended build order:

### Wave 1 — Data config first

1. CSV samples + CSV parser/preview endpoint for content calendar, product catalog and automation scenarios.
2. Config pack storage (`row_json`, `canonical_json`, `search_text`) with R-DCL/R-CR if using tables.
3. `ConfigDataTableRoute.jsx` live editable UI.
4. Row-level save/validate/search.
5. Guru bridge config pack binding UI, but no activation yet.

### Wave 2 — Runtime automation

1. `action.plan_content_calendar` + validator helper.
2. `action.schedule_content_plan` storing events in `bizcity_crm_events` metadata.
3. `action.load_guru_content_config` as bridge node, with Guru resolving persona/config but not owning triggers.
4. Template `tpl_content_calendar_30d_fb_v1`, `tpl_content_calendar_from_sheet_v1` and the 4 scenario templates.
5. Calendar edit/approval UI.
6. `action.expand_content_item` for per-item retry/late expansion.
7. Google OAuth/XLSX import only after CSV upload/link works.

This keeps Phase 1 small enough to ship while still matching the spreadsheet-style workflow.