# PHASE-AUTOMATION-HUB-TEMPLATES — Thư viện Template Hub

> **Phase ID:** ATH (Automation Template Hub)  
> **Trạng thái:** IN PROGRESS — W1-W9 done; W10 seed done; submit Hub backend done (batch API ready)  
> **Author:** Johnny Chu  
> **Phụ thuộc:** Branch #12 QR Templates (pattern), Branch #11 Marketplace (monetize tương lai), R-SK (Skeleton-First Rule), TwinBrain Web Engine

---

## 1. Mục tiêu

Xây dựng thư viện template automation 3 tầng, cho phép:

1. **Browse** template từ Hub BizCity trực tiếp trong Automation SPA
2. **Import** template từ Hub về site khách → tạo workflow local
3. **Submit** (đăng) template local lên Hub để chia sẻ cộng đồng
4. **Mua bán** template premium qua Marketplace (Branch #11, Phase tương lai)

---

## 2. Kiến trúc tổng quan

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER A — Local (builtin + user-created)                                 │
│  bizcity_automation_templates (source: builtin | user | imported)        │
│  REST: bizcity-automation/v1/templates/* (đã có)                        │
└─────────────────────────────────────────────┬────────────────────────────┘
                                              │  POST /hub-templates/submit
                                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER B — Hub Library (bizcity.vn) [Branch #17 — CẦN BUILD]             │
│  bizcity/v1/automation-templates/*                                       │
│  ├ GET  /automation-templates          → browse (public, cached)         │
│  ├ GET  /automation-templates/{id}     → detail + graph_json             │
│  ├ GET  /automation-templates/categories → danh mục                     │
│  ├ POST /automation-templates          → submit (Bearer)                 │
│  └ POST /automation-templates/{id}/rate → đánh giá sao (Bearer)         │
└─────────────────────────────────────────────┬────────────────────────────┘
                                              │  future: Template Pack
                                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  TIER C — Marketplace Monetization (Branch #11)                          │
│  market/v1/catalog — "Template Pack" SKU (future)                       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Luồng hoạt động

### 3.1 Import từ Hub về local

```
User mở TemplateGallery → Tab "Hub BizCity"
    │
    ├─ GET /bizcity-automation/v1/hub-templates?category=zalo&plan=free
    │        PHP proxy: BizCity_Automation_Hub_Client::browse()
    │        → Bearer → bizcity.vn/wp-json/bizcity/v1/automation-templates
    │        Fail-OPEN: _degraded=true + empty rows khi hub offline
    │
    └─ User click [Import]
         POST /bizcity-automation/v1/hub-templates/{id}/import
              PHP: BizCity_Automation_Hub_Client::fetch_detail()
              → graph_json + trigger_config
              → BizCity_Automation_Repo_Workflows::create() enabled=0
              → return workflow row
         FE: navigate → /builder/{wf.id}
```

### 3.2 Submit template lên Hub

```
User mở workflow detail → click "Đăng lên Hub"
    │
    └─ POST /bizcity-automation/v1/hub-templates/submit
            body: { template_id: 123, description: "...", tags: "zalo,cskh" }
            PHP: BizCity_Automation_Repo_Templates::find(id)
            → pack: slug, name, description, graph_json, trigger_type, tags
            → BizCity_Automation_Hub_Client::submit()
            → Bearer → POST bizcity.vn/bizcity/v1/automation-templates
            → return { hub_id, status: "pending_review" }
```

### 3.3 Community GitHub (đã có, W0)

```
Tab "Cộng đồng" → input manifest_url (default GitHub bizcity/automation-workflows)
    → GET /bizcity-automation/v1/community/workflows
    → GET /bizcity-automation/v1/community/workflow?url=...
    → POST /bizcity-automation/v1/community/workflows/import
```

---

## 4. Thiết kế UI — TemplateGallery 3 tabs

```
┌─────────────────────────────────────────────────────────────────────┐
│  Thư viện template workflow                              [×]        │
├─────────────────────────────────────────────────────────────────────┤
│  [📋 Máy chủ]  [👥 Cộng đồng]  [🌐 Hub BizCity ⭐]                  │
├─────────────────────────────────────────────────────────────────────┤
│  Tab: Máy chủ (local)                                               │
│  ┌──search─┐  ┌─nguồn─┐  ┌─nhóm─┐  [↺] [re-seed]                   │
│  [Card grid — existing TemplateGallery behavior]                    │
├─────────────────────────────────────────────────────────────────────┤
│  Tab: Cộng đồng (GitHub)                                            │
│  ┌──manifest URL──────────────────────────────────┐ [Fetch]         │
│  [Card grid: name, description, author, tags, [Import]]             │
├─────────────────────────────────────────────────────────────────────┤
│  Tab: Hub BizCity                                                   │
│  ┌──search─┐  ┌─nhóm─┐  ┌─plan: free/paid─┐  [↺]                   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │
│  │ 🟢 Zalo  │  │ 📘 FB   │  │ 🟣 CSKH  │   ← cards                 │
│  │ Bot Reply│  │ Post Cron│  │ Lead Cap │                           │
│  │ ★4.8 (12)│  │ ★4.5 (8) │  │ ★4.9 (23)│                           │
│  │ 🆓 Free  │  │ 💎 Paid  │  │ 🆓 Free  │                           │
│  │ [Import] │  │ [Mua]   │  │ [Import] │                           │
│  └──────────┘  └──────────┘  └──────────┘                           │
│                                                                     │
│  [Khi hub offline] ⚠ Hub BizCity chưa kết nối.                     │
│   Kiểm tra API Key tại Cài đặt → BizCity.                          │
└─────────────────────────────────────────────────────────────────────┘
```

**Card Hub template:**
- Icon màu theo category
- Tên + slug (monospace nhỏ)
- Mô tả (2 dòng)
- Badge: category | trigger_type | plan (🆓 Free / 💎 Paid)
- ⭐ Rating (X.X) + downloads count
- Nút: `[Import]` (free) hoặc `[💎 Xem thêm]` (paid → link marketplace)

---

## 5. Thiết kế dữ liệu — Hub server schema (Branch #17)

```sql
-- Trên bizcity-llm-router (bizcity.vn)
CREATE TABLE bizcity_automation_hub_templates (
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_uuid  VARCHAR(64) DEFAULT NULL,
  template_version VARCHAR(20) DEFAULT '1.0.0',
  visibility     ENUM('global','private') DEFAULT 'private',
  slug           VARCHAR(128) NOT NULL UNIQUE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  category       VARCHAR(64) DEFAULT 'general',
  trigger_type   VARCHAR(32) DEFAULT 'manual',
  tags           VARCHAR(255) DEFAULT '',
  graph_json     LONGTEXT NOT NULL,
  thumbnail_url  VARCHAR(500) DEFAULT '',
  plan           ENUM('free','paid','enterprise') DEFAULT 'free',
  price_usd      DECIMAL(8,2) DEFAULT 0.00,
  author_api_key VARCHAR(64) DEFAULT '',   -- truncated biz-xxx
  author_display VARCHAR(128) DEFAULT '',
  downloads      INT UNSIGNED DEFAULT 0,
  rating         DECIMAL(3,1) DEFAULT 0.0,
  rating_count   INT UNSIGNED DEFAULT 0,
  source         ENUM('official','community') DEFAULT 'official',
  status         ENUM('active','pending_review','archived') DEFAULT 'active',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_template_uuid (template_uuid),
  KEY idx_visibility (visibility, status),
  KEY idx_category (category),
  KEY idx_plan_status (plan, status),
  FULLTEXT KEY ft_name_desc (name, description)
);
```

---

## 6. Thứ tự triển khai (Waves)

| Wave | Việc cần làm | File | Status |
|---|---|---|---|
| **W0** | Community GitHub tab (đã có endpoint, chưa có tab) | `TemplateGallery.jsx` | ✅ Done |
| **W1** | UI 3 tabs — Hub tab với stub/degraded state | `TemplateGallery.jsx`, `HubTemplateTab.jsx`, `CommunityTemplateTab.jsx` | ✅ Done 2026-06-16 |
| **W2** | PHP proxy routes + hub client stub | `class-automation-rest.php`, `class-automation-hub-client.php` | ✅ Done 2026-06-16 |
| **W3** | hubTemplatesApi + communityApi trong `api.js` | `api.js` | ✅ Done 2026-06-16 |
| **W4** | Hub server Branch #17 spec + schema + REST | `bizcity-llm-router/docs/api/17-automation-templates.md`, `class-router-automation-schema.php`, `class-router-automation-rest.php` | ✅ Done 2026-06-16 |
| **W5** | `is_hub_ready()` enable + DDV probe | `class-automation-hub-client.php`, `class-probe-hub-templates.php` | ✅ Done 2026-06-16 |
| **W6** | "🌐 Đăng lên Hub" button trong Toolbar.jsx | `Toolbar.jsx` | ✅ Done 2026-06-16 |
| **W7** | Monetize marker: Template Pack via Branch #11 | `HubTemplateTab.jsx` (comment marker) | ✅ Done 2026-06-16 (stub) |
| **W8** | `action.web_research` + `action.generate_content` PHP blocks | `class-action-web-research.php`, `class-action-generate-content.php`, `bootstrap.php` | ✅ Done 2026-06-16 |
| **W9** | `notebook_picker` field type renderer trong FE | `Inspector.jsx`, `NotebookPicker.jsx`, `api.js` | ✅ Done 2026-06-16 |
| **W10** | Seed 3 blueprints + submit lên Hub | `class-automation-templates-seeder.php`, `class-automation-rest.php` | ✅ Done 2026-06-24 |
| **W11** | Extract tất cả 59 builtin blueprint PHP → JSON files; `builtin_blueprints()` JSON-first | `core/automation/templates/builtin-*.json`, `class-automation-templates-seeder.php` | ✅ Done 2026-06-28 |

---

## 7. Quy tắc R-GW-8 compliance

- **FE KHÔNG bao giờ** fetch thẳng `bizcity.vn` — mọi hub call qua PHP proxy `bizcity-automation/v1/hub-templates/*`
- **PHP proxy** dùng `BizCity_Automation_Hub_Client` (extend pattern `BizCity_LLM_Client`)
- **Fail-OPEN**: khi hub offline → `200 + {_degraded: true, rows: []}` → FE hiện info banner
- **Auth**: Browse/GET → public (không cần Bearer). Submit → Bearer biz-xxx

---

## 8. DDV Evidence (R-DDV)

Khi W5 (full impl) hoàn thành, cần có probe:
- `core/diagnostics/includes/probes/class-probe-hub-templates.php`
- 3 layer evidence: Disk (client file exists) / Loader (class loaded) / Runtime (ping /categories)
- Register qua filter `bizcity_diagnostics_register_probes`

---

## 9. Error codes (R-ERROR-UX)

| Code | Message | Hint |
|---|---|---|
| `hub_offline` | Hub BizCity không phản hồi. | Kiểm tra API Key tại Cài đặt → BizCity. |
| `hub_auth_failed` | API Key không hợp lệ hoặc hết hạn. | Vào Cài đặt → BizCity → nhập lại API Key. |
| `template_not_found` | Template không tồn tại trên Hub. | Thử tải lại danh sách. |
| `plan_required` | Template yêu cầu gói Paid. | Nâng cấp tại bizcity.vn/marketplace. |
| `import_failed` | Import template thất bại. | Xem log PHP để biết chi tiết. |

---

## 10. Blocks mới cần thiết — Content Generation Flows

> **Ngày ghi nhận:** 2026-06-16  
> Hai flows dưới đây xác định **2 blocks chưa tồn tại** phải được build trước
> khi có thể seed các blueprint tương ứng lên Hub.

### 10.1 Flow 1 — Daily Web Research → Script → Zalo Bot

**Kịch bản:** Mỗi ngày 8h, hệ thống tự tìm kiếm thông tin hot/trend, tổng hợp thành kịch bản có dẫn chứng, gửi về Zalo Bot của user.

```
[trigger.cron: "0 8 * * *"]
  → [action.web_research]          ← BLOCK MỚI
       mode: quick | deep
       query: "xu hướng hot hôm nay {{trigger.date}}"
       output: answer_md, citations
  → [action.generate_content]      ← BLOCK MỚI
       content_type: script
       prompt_template: "Từ thông tin sau, viết kịch bản ngắn để đăng mạng xã hội:\n{{n_2.answer_md}}"
       notebook_id: 0  (không bind notebook — dùng web context)
       output: content
  → [action.reply_zalo]
       message: "{{n_3.content}}"
       chat_id: "{{trigger.chat_id}}"  (bind theo user Zalo Bot)
```

**Blueprints sẽ seed:**
- `tpl_daily_research_zalo_v1` — Cron 8h → web_research(quick) → generate_content(script) → reply_zalo

### 10.2 Flow 2 — Daily Notebook → Generate Content → Schedule FB Post

**Kịch bản:** Mỗi ngày 8h, tự viết bài dựa trên skeleton/KG của notebook đã chọn. 9h tự đăng bài lên Facebook Page.

```
[trigger.cron: "0 8 * * *"]
  → [action.generate_content]      ← BLOCK MỚI
       content_type: fb_post
       notebook_id: 42             ← PICKER BIND cứng trong template
       prompt_template: "Viết bài Facebook 4-6 dòng, hashtag, tone thương hiệu..."
       output: content, image_prompt
  → [action.publish_fb_post]       ← ĐÃ CÓ
       content: "{{n_2.content}}"
       fb_page_id: "{{settings.fb_page_id}}"
       mode: scheduled             ← đặt lịch 9h (delay_min = 60)
       delay_min: 60
```

**Blueprints sẽ seed:**
- `tpl_daily_notebook_fb_post_v1` — Cron 8h → generate_content(fb_post, notebook_bound) → publish_fb_post(scheduled 9h)
- `tpl_daily_notebook_wp_post_v1` — Cron 8h → generate_content(web_post, notebook_bound) → publish_wp_post

### 10.2.1 Flow 3 — Zalo Bot Photo Editor → Gemini 3 Pro → WP Media + Draft + Reply Link

**Kịch bản:** User gửi ảnh vào Zalo Bot, bot hỏi muốn sửa gì. User nhắn `@thợ ảnh ...` hoặc `sửa ảnh ...`. Workflow lấy ảnh đã gửi từ pending slot, lưu ảnh gốc vào WP Media, gọi Gemini 3 Pro để chỉnh ảnh theo prompt, lưu ảnh kết quả vào WP Media, tạo WP draft nếu resolve được owner, rồi gửi link ảnh đã sửa về Zalo.

```
Flow A — capture ảnh:
[trigger.zalo_inbound: "__attachment:image"]
  → [action.capture_attachment]
    url: "{{trigger.media_url}}"
    ttl_min: 60
  → [action.set_pending_intent]
    intent: "awaiting_seedream_photo_edit"
    workflow_slug: "tpl_zalobot_seedream_photo_edit_v1"
    ttl_min: 60
  → [action.reply_zalo]
    text: "Đã nhận ảnh. Sếp muốn thợ ảnh chỉnh gì?"

Flow B — sửa ảnh:
[trigger.zalo_inbound: "@thợ ảnh|sửa ảnh"]
  → [logic.condition]
    expression: "trigger._resume.attachment_url != ''"
  → true: [action.consume_attachment]
    sideload_to_wp: true
  → [action.edit_image]
    image_url: "{{consume.attachment_url}}"
    prompt: "{{trigger.text}}"
    model: "google/gemini-3-pro-image-preview"
    sideload_to_wp: true
  → [action.publish_wp_post]
    status: "draft"
    content: prompt + source image + edited image
    image_url: "{{edit.image_url}}"
  → [action.reply_zalo]
    text: "{{edit.image_url}} + {{track.edit_url}}"
```

**Blueprints sẽ seed:**
- `tpl_zalobot_seedream_photo_capture_v1` — `[global] Thợ ảnh · Gửi ảnh Zalo Bot → hỏi muốn sửa gì`
- `tpl_zalobot_seedream_photo_edit_v1` — `[global] Thợ ảnh · Sửa ảnh bằng Seedream 4.5 (@thợ ảnh / sửa ảnh)`

**Block mới:** `action.edit_image`.

| Field | Type | Mô tả |
|---|---|---|
| `image_url` | text | Ảnh nguồn, thường là `{{consume.attachment_url}}` hoặc `{{trigger._resume.attachment_url}}`. |
| `prompt` | textarea | Yêu cầu chỉnh sửa ảnh bằng ngôn ngữ tự nhiên. |
| `model` | select | Mặc định `google/gemini-3-pro-image-preview`; có thể chọn GPT Image 1 nếu hub hỗ trợ. |
| `size` | select | Kích thước/aspect output, ví dụ `1024x1024`, `1024x1536`, `1792x1024`. |
| `sideload_to_wp` | toggle | Bật để lưu ảnh đã chỉnh vào WP Media, tạo URL bền vững. |

**Runtime contract:** `action.edit_image` gọi `BizCity_LLM_Client::generate_image()` với `input_images[]` theo Branch #06 Image Generation, không gọi thẳng OpenRouter/bizcity.vn từ FE. Hub route qua `llm/router/v1/images/generations`; mặc định dùng `google/gemini-3-pro-image-preview`.

**Multi-attachment contract:** template có thể truyền nhiều ảnh bằng `image_urls: "{{consume.attachment_urls}}"`. Pending media phải dùng `BizCity_Automation_Pending_State::attachments[]`; `consume_attachment` sideload toàn bộ ảnh sang WP Media và trả `attachment_urls[]`/`attachment_ids[]`. Chi tiết rule: `core/automation/docs/RULE-AUTOMATION-MULTI-ATTACHMENT.md`.

**Output context vars:**
- `{{edit.ok}}` — true/false
- `{{edit.image_url}}` — URL ảnh đã chỉnh, ưu tiên WP Media nếu `sideload_to_wp=true`
- `{{edit.source_url}}` — URL ảnh gốc đã dùng
- `{{edit.source_urls}}` — mảng URL ảnh gốc khi user gửi nhiều ảnh
- `{{edit.attachment_id}}` — attachment ID nếu sideload tạo được
- `{{edit.model_used}}` — model thực tế hub trả về
- `{{edit.ms}}` — latency ms
- `{{edit.content_id}}` — My Content artifact / WP tracking ID nếu có

### 10.3 Mô tả block `action.web_research` (ĐÃ BUILD)

| Field | Type | Mô tả |
|---|---|---|
| `label` | text | Tên hiển thị |
| `query` | textarea | Query tìm kiếm, hỗ trợ `{{trigger.date}}`, `{{vars.topic}}` |
| `mode` | select | `quick` (≤4s, 1 search call) \| `deep` (ReAct max 5 iter, ≤60s) |
| `max_results` | number | Số kết quả tối đa (default 7, max 15) |

**Output context vars:**
- `{{n_X.answer_md}}` — tổng hợp markdown có citation
- `{{n_X.citations}}` — mảng `{web_url, web_title, web_host}`
- `{{n_X.citation_count}}` — số citation
- `{{n_X.mode}}` — `quick` hoặc `deep`

**Implementation:** Gọi `BizCity_TwinBrain_Web_Quick::instance()->run()` hoặc `BizCity_TwinBrain_Web_Deep::instance()->run()`. Cần guard `class_exists` + fail-OPEN (R-GW-8). Không emit SSE trong automation context — chỉ trả kết quả synchronous.

**File:** `core/automation/includes/blocks/actions/class-action-web-research.php`

### 10.4 Mô tả block `action.generate_content` (ĐÃ BUILD)

| Field | Type | Mô tả |
|---|---|---|
| `label` | text | Tên hiển thị |
| `content_type` | select | `fb_post` \| `web_post` \| `script` \| `summary` \| `email` |
| `notebook_id` | **notebook_picker** | ID notebook bind cứng — inject skeleton (R-SK RULE-5) |
| `prompt_template` | textarea | Prompt, hỗ trợ `{{n_X.*}}`, `{{trigger.*}}`, `{{vars.*}}` |
| `tone` | text | Giọng văn (optional, thêm vào system prompt) |
| `max_words` | number | Giới hạn từ (default 300) |

**Output context vars:**
- `{{n_X.content}}` — nội dung đã generate (plain text / markdown)
- `{{n_X.content_type}}` — loại nội dung đã chọn
- `{{n_X.notebook_id}}` — notebook đã dùng (0 nếu không bind)
- `{{n_X.skeleton_version}}` — phiên bản skeleton đã inject (để detect stale)

**Skeleton injection (R-SK RULE-5):**
```php
// Trong execute():
$notebook_id = (int) ( $data['notebook_id'] ?? 0 );
$skeleton_block = '';
if ( $notebook_id > 0 && class_exists( 'BizCity_KG_Skeleton_Adapter' )
     && BizCity_KG_Skeleton_Adapter::is_ready( $notebook_id ) ) {
    $skeleton_block = BizCity_KG_Skeleton_Adapter::get_prompt_block( $notebook_id, 'full' );
}
// messages: [system] → [system: skeleton_block] → [user: prompt]
```

**LLM call:** Qua `BizCity_LLM_Client::instance()->chat()` — không gọi endpoint thẳng.

**File:** `core/automation/includes/blocks/actions/class-action-generate-content.php`

### 10.5 Field type mới: `notebook_picker` (ĐÃ BUILD)

Cần thêm renderer trong Inspector UI (đã triển khai tại `Inspector.jsx` + `NotebookPicker.jsx`, tương tự `fb_page_picker` đã có):

```jsx
// Fetch danh sách notebook của user:
// GET /wp-json/bizcity/kg/v1/notebooks?user_id=current
// Response: [{ id, name, skeleton_status, skeleton_version, updated_at }]

// Render:
// [Select dropdown] Báo cáo EV Q1 2026 (📋 Ready · v3)
//                   Marketing Strategy 2026 (⏳ Building...)
//                   [Không bind notebook]
```

Status badge `skeleton_status` cần hiển thị cạnh tên notebook để user biết skeleton có sẵn chưa.

---

## 11. Waves bổ sung (W8–W10)

| Wave | Việc cần làm | File cần tạo/sửa | Status |
|---|---|---|---|
| **W8** | Build `action.web_research` PHP block | `class-action-web-research.php` | ✅ Done |
| **W8** | Build `action.generate_content` PHP block + skeleton injection | `class-action-generate-content.php` | ✅ Done |
| **W8** | Register 2 blocks mới trong `bootstrap.php` action loader | `bootstrap.php` | ✅ Done |
| **W9** | `notebook_picker` field type renderer trong FE | `Inspector.jsx`, `NotebookPicker.jsx` | ✅ Done |
| **W9** | API helper notebook list — fetch notebook list | `api.js` (`notebookApi.list`) | ✅ Done |
| **W10** | Seed blueprints: `bp_daily_research_zalo`, `bp_daily_notebook_fb_post`, `bp_daily_notebook_wp_post` | `class-automation-templates-seeder.php` | ✅ Done |
| **W10** | Submit 3 blueprints lên Hub (R-AUTO-TPL lifecycle) | Hub client + REST proxy | ⏳ In progress (batch endpoint ready; execute submit on test/prod key) |

### Thứ tự dependency

```
W8 (PHP blocks) → W9 (FE picker) → W10 (seed + submit)
                                  ↗
              W4-W6 (Hub server + client) đã done
```

**DoD W8:**
- `action.web_research` execute() gọi `BizCity_TwinBrain_Web_Quick` / `Web_Deep` thành công
- `action.generate_content` execute() inject skeleton khi `notebook_id > 0`
- Fail-OPEN: cả 2 block trả `_degraded=true` khi gateway/class missing, KHÔNG exception
- R-STAMP: mọi method có `// [YYYY-MM-DD Johnny Chu] PHASE-ATH W8 — ...`

**DoD W9:**
- `notebook_picker` hiển thị dropdown trong Builder với status badge
- Giá trị `notebook_id` lưu vào graph JSON khi save
- Import template từ Hub với `notebook_id` đã set → picker hiện đúng notebook (nếu tồn tại)

**DoD W10:**
- 3 blueprint seed thành công trên test site (status `builtin`, source `future_blueprints`)
- Template chạy đúng end-to-end (cron fire → research/generate → output visible)
- Submit lên Hub → status `pending_review`

### 11.1 W10 submit API (batch) — backend ready

`POST /wp-json/bizcity-automation/v1/hub-templates/submit`

Body mẫu để submit đúng 3 blueprint W10 theo slug:

```json
{
     "preset": "w10",
     "plan": "free",
     "author": "Johnny Chu"
}
```

Hoặc truyền slug explicit:

```json
{
     "template_slugs": [
          "tpl_daily_research_zalo_v1",
          "tpl_daily_notebook_fb_post_v1",
          "tpl_daily_notebook_wp_post_v1"
     ],
     "plan": "free",
     "author": "Johnny Chu"
}
```

Response shape:
- `mode=batch`
- `total`, `submitted`, `failed`
- `rows[]` mỗi slug có `ok`, `_degraded`, `hub_id`, `status`

---

## 12. JSON Template Files — Format Canonical & Sync Flow (2026-06-28)

> **Status:** ✅ Đã triển khai (W11). Mọi blueprint mới BẮT BUỘC là JSON file — KHÔNG viết thêm PHP `bp_*()` function.

### 12.1 Vị trí & danh sách file

Tất cả JSON template nằm trong: **`core/automation/templates/`**

| File | Nhóm | Templates | Ghi chú |
|---|---|---|---|
| `builtin-cskh-lead.json` | builtin | 6 | CSKH Zalo, FB lead, MPR, Cron report, Webhook, TB web search alert |
| `builtin-pilots.json` | builtin | 9 | Keyword pilot, fallback brain, image, post web/FB, calendar, lên lịch |
| `builtin-smoke-kg-care.json` | builtin | 10 | Smoke tests, KG router, remember, slash-KG, skill intent, Zalo OA, classify, tag, FB Messenger, care |
| `builtin-cf7-shop.json` | builtin | 6 | CF7 ebook, keyword chain, lead collect, FB comment, ngoài giờ, đặt hàng |
| `builtin-woo-crm-w1-w13.json` | builtin | 13 | W1–W13: WooCommerce orders, CRM welcome/label/SLA/CSAT/stale-lead, standup, weekly, task overdue |
| `builtin-woo-crm-w14-w25.json` | builtin | 12 | W14–W25: image classify, PDF, voice, loyalty, campaign, appointment, invoice, AI summarize, HTTP form, menu bot, broadcast |
| `builtin-video-zalobot.json` | builtin | 5 | Img capture, Kling video veo3, personal reminder, web research 3-step, astro 3-step |
| `daily-fb-post.json` | future | nhiều | Chuỗi đăng FB hàng ngày (8h/9h/10h…) |
| `daily-content.json` | future | nhiều | Tạo nội dung đa kênh |
| `personal-assistant.json` | future | nhiều | Personal assistant / productivity |
| `trending.json` | future | nhiều | Trending content automation |
| `web-skills/*.json` | future | 8 | Web research theo chuyên ngành (search, med, law, tax, gov, astro, nutri, scholar) |
| `builtin-catalog.json` | metadata | — | Metadata catalog (KHÔNG có graph, BỊ SKIP bởi loader) |

> **Loader rule**: `load_builtin_json_blueprints()` đọc `builtin-*.json`, bỏ qua `builtin-catalog.json`.
> `load_json_blueprints()` đọc tất cả `*.json` ngoại trừ `builtin-*.json` (tức là future + web-skills).

### 12.2 JSON Blueprint Format — Canonical Schema

Mỗi file là một **JSON array** của các blueprint object. Không dùng object-map vì array dễ merge và đọc.

```json
[
  {
    "template_uuid": "018fb5fd-8a22-7a10-9f79-4b6474dbb002",
    "template_version": "1.0.0",
    "visibility": "global",
    "slug":         "tpl_xxx_v1",
    "name":         "[global] Tên mô tả chức năng",
    "description":  "Mô tả đầy đủ kịch bản, điều kiện cần, kết quả đầu ra.",
    "category":     "automation",
    "source":       "builtin",
    "trigger_type": "cron",
    "icon":         "LucideIconName",
    "tags":         "tag1,tag2,tag3",
    "plan":         "free",
    "trigger_config": { "schedule": "0 8 * * *" },
    "graph": {
      "meta": {
        "template": "tpl_xxx_v1",
        "template_uuid": "018fb5fd-8a22-7a10-9f79-4b6474dbb002",
        "template_version": "1.0.0",
        "visibility": "global"
      },
      "nodes": [
        {
          "id": "t1",
          "type": "trigger",
          "position": { "x": 0, "y": 80 },
          "data": {
            "blockId": "trigger.cron",
            "label":   "Cron · 08:00 mỗi ngày",
            "schedule": "0 8 * * *"
          }
        },
        {
          "id": "n1",
          "type": "action",
          "position": { "x": 320, "y": 80 },
          "data": { "blockId": "action.reply_zalo", "label": "Trả lời Zalo", "text": "{{gen.output}}" }
        }
      ],
      "edges": [
        { "id": "e_t1_n1", "source": "t1", "target": "n1" },
        { "id": "e_g1_true", "source": "g1", "target": "nX", "sourceHandle": "true" }
      ]
    }
  }
]
```

**Field spec:**

| Field | Required | Mô tả |
|---|---|---|
| `template_uuid` | ✅ | Stable identity cho seed/Hub update. Không sinh runtime ngẫu nhiên; commit cố định trong JSON. |
| `template_version` | ✅ | Semver nội dung template (`1.0.0`, `1.1.0`). Khác DB row `version`. |
| `visibility` | ✅ | `global` hoặc `private`; quyết định selector, UI group và quyền runtime. |
| `slug` | ✅ | `tpl_<feature>_v<N>` — STABLE, không đổi sau khi seed lần đầu |
| `name` | ✅ | Tên generic, KHÔNG chứa tên khách hàng; `visibility=global` phải prefix `[global]` |
| `description` | ✅ | Mô tả rõ trigger → action → output |
| `category` | ✅ | `automation|cskh|lead|general|mpr|report|webhook|personal|care|ai|test` |
| `source` | ✅ | `builtin` (mặc định cho builtin-*.json) |
| `trigger_type` | ✅ | `cron|zalo_inbound|webhook|fb_comment|fb_message|crm_event|manual|slash_command|skill_intent|twinbrain_intent|twinbrain_tool_decided` |
| `icon` | — | Lucide icon name (CamelCase) |
| `tags` | ✅ | CSV string `"zalo,daily,cron"` — không có tên khách |
| `plan` | — | `free` (default) / `pro` / `enterprise` |
| `trigger_config` | — | Object config theo trigger type |
| `graph` | ✅ | ReactFlow graph **dạng object** — PHP loader tự `wp_json_encode()` khi upsert vào DB |

**Visibility rules:**

- `global`: template public-safe cho ZaloBot/global selector, ví dụ tra cứu, hỏi chiêm tinh, đọc báo, trend, sản phẩm, FAQ, daily digest. Không được đọc private memory/notebook/resource nếu chưa resolve linked `wp_user_id` và không có `owner_required=true`.
- `private`: template riêng tư cần linked identity, ví dụ nhắc việc cá nhân, tài chính cá nhân, nhật ký, note riêng, publish Facebook/Page thuộc user.
- Template Gallery phải cho filter/tab `Global` và `Riêng tư`; global template hiển thị prefix `[global]`.
- Không đổi `slug` để thêm `[global]`; đổi `name` và `visibility`, giữ `template_uuid`.

**Edge format:**
- Normal edge: `{"id":"e_src_tgt","source":"src","target":"tgt"}`
- Condition branch: thêm `"sourceHandle":"true"` hoặc `"sourceHandle":"false"`
- Không bao giờ để `id` trùng nhau trong cùng template

### 12.3 Luồng Sync JSON → Local DB → Hub

```
DEV tạo / sửa JSON file trong core/automation/templates/
          │
          ▼
[1] Reseed (nút UI hoặc WP-CLI)
    force_reseed() → seed_all() → blueprints()
      → builtin_blueprints() → load_builtin_json_blueprints()
      → future_blueprints()  → load_json_blueprints()
    → BizCity_Automation_Repo_Templates::upsert() cho từng blueprint
      • Lưu: template_uuid, template_version, visibility, slug, name, description,
              category, trigger_type, tags, plan, graph_json, source
      • trigger_type + tags ← đọc trực tiếp từ JSON fields
          │
          ▼
[2] Sync to Hub (auto: admin_init:99, main site only; hoặc WP-CLI)
    sync_to_hub() → đọc từ DB (source='builtin', limit=200)
    → Normalize sang Hub schema:
      • tags  ← rebuild từ category + trigger_type extracted từ graph nodes
                (KHÔNG dùng tags string từ JSON/DB — xem ghi chú §12.4)
      • graph_json ← đọc trực tiếp từ DB
    → BizCity_Automation_Hub_Client::sync_bulk()
    → Bearer → POST bizcity.vn/bizcity/v1/automation-templates/bulk
          │
          ▼
[3] Hub lưu vào bizcity_automation_hub_templates
    → Available cho mọi client site browse + import
```

### 12.4 Gap: Tags trong sync_to_hub() (Known, Low Priority)

`sync_to_hub()` hiện tại rebuild tags chỉ từ `category + trigger_type` (bỏ qua field `tags` CSV từ JSON).
Hệ quả: Hub template sẽ có ít tags hơn so với local (thiếu business tags như `daily`, `lead`, `9h`...).

**Chưa cần fix ngay** vì Hub browse dùng category + full-text search (không filter tags).
Nếu muốn tags đầy đủ lên Hub, fix `sync_to_hub()` để merge CSV tags từ `$tpl['tags']`:

```php
// Thay thế đoạn build $tags trong sync_to_hub():
$tags = array();
if ( ! empty( $tpl['category'] ) ) { $tags[] = (string) $tpl['category']; }
if ( $trigger_type ) { $tags[] = $trigger_type; }
// [2026-06-28 Johnny Chu] PHASE-ATH — merge tags CSV từ template field
if ( ! empty( $tpl['tags'] ) ) {
    $csv = array_map( 'trim', explode( ',', (string) $tpl['tags'] ) );
    $tags = array_unique( array_merge( $tags, $csv ) );
}
```

### 12.5 Format mapping: Client JSON ↔ Hub server

| Client JSON field | Hub DB column | Ghi chú |
|---|---|---|
| `template_uuid` | `template_uuid` | Canonical identity, upsert trước slug |
| `template_version` | `template_version` | Semver nội dung, dùng để update/review |
| `visibility` | `visibility` | `global` / `private`; Hub filter + client runtime policy |
| `slug` | `slug` | 1-1 |
| `name` | `name` | 1-1 |
| `description` | `description` | 1-1 |
| `category` | `category` | 1-1 |
| `tags` (CSV string) | `tags` (VARCHAR, JSON array) | Convert qua `array_unique` trong `sync_to_hub()` |
| `plan` | `plan` | 1-1, default `free` |
| `trigger_type` | `trigger_type` | Extracted từ graph nodes nếu không khai báo |
| `graph` (object) | `graph_json` (LONGTEXT string) | PHP `wp_json_encode($item['graph'])` khi upsert |
| `source` | `source` (enum `official|community`) | `builtin` → `official` |
| `icon` | ❌ không có | Client-only field, không sync lên Hub |
| `trigger_config` | ❌ không có | Client-only field — thông tin này nằm trong graph node |

### 12.6 Rule — R-ATH-JSON (Quy tắc tạo template mới)

> **TUYỆT ĐỐI** không thêm PHP `bp_*()` function mới vào seeder.
> Mọi template mới BẮT BUỘC là JSON file. PHP `bp_*()` functions là legacy fallback.

**Checklist khi thêm template mới:**

1. **Chọn file đúng** hoặc tạo file mới `core/automation/templates/<tên-nhóm>.json`
   - Builtin (ship cùng plugin): `builtin-<nhóm>.json`
   - Future / đang phát triển: `<tên-kịch-bản>.json`
2. **Viết JSON object** theo schema §12.2 — có `template_uuid`, `template_version`, `visibility`, slug format `tpl_<feature>_v<N>`
3. **Test local**: Reseed → Import từ Thư viện Templates → chạy thử trigger
4. **Nếu template là builtin**, thêm metadata row vào `builtin-catalog.json` (cho reference)
5. **Bump SEED_VERSION** trong `class-automation-templates-seeder.php` (minor bump)
6. **Sync lên Hub**: `sync_to_hub()` tự chạy sau reseed (main site) hoặc WP-CLI:
   ```bash
   wp eval 'BizCity_Automation_Templates_Seeder::sync_to_hub();'
   ```

**Anti-patterns CẤM:**
- ❌ Viết `private static function bp_xxx(): array { ... }` mới trong seeder
- ❌ Hard-code tên khách hàng trong `name`, `tags`, tên file
- ❌ Không bump `SEED_VERSION` → seeder không re-run → template không được tạo
- ❌ Thiếu `template_uuid` / `template_version` / `visibility` trong template JSON mới
- ❌ Coi DB row `version` là version nội dung template
- ❌ Đổi slug để thêm `[global]` thay vì giữ slug và sửa `name` + `visibility`
- ❌ `slug` chứa `_v0` hoặc slug không theo format `tpl_<feature>_v<N>`
- ❌ Để `"plan": "pro"` mà không có entitlement check trong import handler
- ❌ `graph_json` chứa hard-coded `page_id`, `user_id`, phone — phải dùng placeholder `{{FB_PAGE_ID}}`
