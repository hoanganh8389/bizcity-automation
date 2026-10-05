# GAP ANALYSIS — Content + Image Workflow Automation

> Phase-ID: `PHASE-IMG-TPL` · Date: 2026-07-05 · Author: Johnny Chu

---

## 1. Yêu cầu từ user

| # | Yêu cầu | Phân loại |
|---|---|---|
| 1a | Trending research + news: gửi link đọc thêm qua Zalo dưới dạng URL thuần (không href) | Missing output var |
| 1b | Web research: tương tự — expose URL đầu tiên trong citations | Missing output var |
| 2 | Block tạo ảnh bằng mô tả (generate image), chọn model: nano-banana, gpt-image-1, gpt-image-2, … | Missing block |
| 3.1 | Template đăng bài: nếu không có ảnh → tự gen ảnh + lấy link + đăng | Missing templates |
| 3.2 | 4 scenarios: đăng FB, đăng WP, lịch FB hàng ngày, lịch WP hàng ngày | Missing templates |

---

## 2. Phân tích blocks hiện có

### 2.1 `action.trending_research` — ĐỦ nếu thêm `top_url`

| Output hiện có | OK |
|---|---|
| `msg_1..4` – 4 phần Zalo | ✅ |
| `answer_md` | ✅ |
| `sources_text` | ✅ |
| `top_sources[]` | ✅ nhưng chứa object, không trực tiếp gửi Zalo |
| **`top_url`** — URL nguồn đầu tiên dạng plain text | ❌ THIẾU |

**Fix:** thêm `'top_url' => (string)($clusters[0]['url'] ?? '')` vào return.
Template cập nhật: `msg_2` kết thúc bằng `\n\n📖 Đọc thêm: {{tr.top_url}}`.

### 2.2 `action.web_research` — ĐỦ nếu thêm `top_url`

| Output hiện có | OK |
|---|---|
| `answer_md` | ✅ |
| `sources_text` | ✅ |
| `citations` – JSON array | ✅ nhưng JSON string, không trực tiếp send |
| **`top_url`** — URL citation[0] | ❌ THIẾU |

**Fix:** parse `citations_raw[0]['url']` và trả thêm `top_url`.

### 2.3 `action.generate_image` — HOÀN TOÀN THIẾU

**Block mới cần tạo.** Wraps `BizCity_LLM_Client::generate_image()`.

| Output | Kiểu |
|---|---|
| `ok` | bool |
| `image_url` | string – URL (permanent nếu sideload=true, tạm thời nếu không) |
| `model_used` | string |
| `width` | int |
| `height` | int |
| `ms` | int |

Fields:

| Field | Type | Mô tả |
|---|---|---|
| `prompt` | textarea | Mô tả ảnh cần tạo |
| `model` | select | gpt-image-1 / gpt-image-2 / dall-e-3 / flux-schnell / flux-1.1-pro / nano-banana |
| `size` | select | 1024×1024 / 1536×1024 / 1024×1536 / 512×512 |
| `sideload_to_wp` | toggle | Lưu ảnh vào WP Media Library → URL bền vững, dùng được cho FB |

**Lý do `sideload_to_wp` quan trọng:**
- `gpt-image-1` / `gpt-image-2` trả về URL tạm thời (hết hạn ~60 phút) hoặc `b64_json`.
- Facebook Graph API khi đăng ảnh cần URL **bền vững** (fetch từ URL vào lúc publish).
- Nếu `sideload_to_wp=true` → ảnh được lưu vào `wp-content/uploads/` → URL bền vững.
- `action.publish_wp_post` tự sideload khi nhận `image_url` → không cần sideload 2 lần cho WP.

### 2.4 `action.publish_fb_post` — ĐỦ

`image_url` field có sẵn, chấp nhận bất kỳ URL nào.
Chỉ cần đảm bảo URL bền vững → dùng `generate_image` với `sideload_to_wp=true`.

### 2.5 `action.publish_wp_post` — ĐỦ

`image_url` field → `media_sideload_image()` → set featured image. Đã có sẵn.

---

## 3. Class/function cần bổ sung

| Class/Function | File | Status |
|---|---|---|
| `BizCity_Automation_Action_Generate_Image` | `class-action-generate-image.php` | ❌ CẦN TẠO |
| `BizCity_LLM_Client::generate_image()` | `class-llm-client.php` | ✅ ĐÃ CÓ |
| `media_sideload_image()` | WordPress core | ✅ ĐÃ CÓ (cần require includes) |

---

## 4. Templates cần tạo (file: `content-with-image.json`)

| Slug | Trigger | Flow | Use case |
|---|---|---|---|
| `tpl_generate_image_v1` | `trigger.zalo_inbound` keyword `@tạo ảnh` | `trending_research` → `generate_image` → `reply_zalo` (URL) | Gen ảnh on-demand qua Zalo |
| `tpl_fb_post_with_auto_image_v1` | `trigger.zalo_inbound` | `generate_content(fb_post)` → `generate_image(sideload)` → `publish_fb_post` | Zalo lệnh → đăng FB có ảnh |
| `tpl_wp_post_with_auto_image_v1` | `trigger.zalo_inbound` | `web_research` → `generate_content(web_post)` → `generate_image(sideload)` → `publish_wp_post` | Zalo lệnh → đăng WP có ảnh |
| `tpl_daily_fb_content_image_v1` | `trigger.cron` 8h | `generate_content(fb_post)` → `generate_image(sideload)` → `publish_fb_post` | Lịch FB hàng ngày + ảnh auto |
| `tpl_daily_wp_content_image_v1` | `trigger.cron` 9h | `web_research` → `generate_content(web_post)` → `generate_image(sideload)` → `publish_wp_post(draft)` | Lịch WP hàng ngày + ảnh auto |

---

## 5. Template cần CẬP NHẬT

| File | Template slug | Thay đổi |
|---|---|---|
| `trending.json` | `tpl_daily_trending_digest_v1` | `msg_2` + `\n📖 {{tr.top_url}}` |
| `trending.json` | `tpl_ondemand_trending_zalo_v1` | reply text + `\n📖 {{tr.top_url}}` |

---

## 6. Zalo link format — Lý do không dùng href

Zalo gửi tin nhắn text thuần — **không hỗ trợ HTML/markdown** trong message body.  
Gửi `<a href="https://...">đọc thêm</a>` → hiển thị literal HTML, không thành link.  
Gửi `https://...` dạng plain text → Zalo tự động chuyển thành tap-to-open link.

Pattern đúng:
```
📖 Đọc thêm: https://example.com/article-slug
```
Không dùng:
```
❌ [Đọc thêm](https://example.com/article-slug)   ← markdown, không hoạt động
❌ <a href="...">Đọc thêm</a>                     ← HTML, không hoạt động
```

---

## 7. Workflow dispatch sau khi implement

1. `action.generate_image` cần require_once trong `bootstrap.php`
2. `class-block-registry.php::bootstrap()` cần `$this->register(new BizCity_Automation_Action_Generate_Image())`
3. Bump `SEED_VERSION = '1.36.0'` trong seeder
4. Templates tự được nạp qua `load_json_blueprints()` khi file `content-with-image.json` tồn tại
