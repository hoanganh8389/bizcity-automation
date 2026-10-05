# BizCity Automation — Hướng dẫn sử dụng

> **Đối tượng:** admin / staff vận hành site WordPress đã cài plugin
> `bizcity-twin-ai`. Không cần biết PHP. Phần "Nâng cao" có ví dụ cho dev.
>
> **Mục tiêu:** xây flow tự động hoá (Zalo trả lời, FB comment scan,
> lịch nhắc, webhook nhận data ngoài…) bằng giao diện kéo-thả, rồi
> cho chạy đúng giờ / đúng sự kiện mà không cần code.
>
> **Trang chính:** `wp-admin/admin.php?page=bizcity-automation`.

---

## 1. Khái niệm 30 giây

| Thuật ngữ      | Ý nghĩa                                                                           |
| -------------- | --------------------------------------------------------------------------------- |
| **Workflow**   | Một sơ đồ kéo-thả gồm nhiều **block** nối với nhau bằng **edge** (mũi tên).       |
| **Trigger**    | Block "khởi đầu" — quyết định *khi nào* workflow chạy (manual / Zalo / FB / cron / webhook / scheduler). |
| **Action**     | Block "làm việc" — gọi LLM, gửi tin nhắn, ghi DB, gửi HTTP…                       |
| **Logic**      | Block "rẽ nhánh" — `condition` cho phép nhảy nhánh true/false.                     |
| **Run**        | Một lần workflow chạy. Có `run_id` duy nhất (`run_xxxxxxxxxxxx`).                  |
| **CRM event**  | Mỗi run kết thúc tự sinh 1 dòng `event_type='automation_run'` trong Scheduler.    |

---

## 2. Tạo workflow đầu tiên (5 phút)

### Bước 1 — Mở Builder
1. Vào `wp-admin` → menu **BizCity Automation** (hoặc URL `?page=bizcity-automation`).
2. Bấm **+ New workflow**.
3. Đặt `name` (vd: *Reply Zalo greetings*) và `slug` (vd: `wf_zalo_greet_v1`).

### Bước 2 — Thả block
Kéo block từ palette bên trái thả vào canvas:

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ trigger.zalo     │ ─→  │ llm.compose_reply│ ─→  │ action.reply_zalo│
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

- **trigger.zalo_inbound** — khởi động khi có tin nhắn Zalo Bot (`platform=ZALO_BOT`, `code=zalo_bot`, không phải Zalo OA/Personal; thiếu discriminator sẽ bị bỏ qua).
- **llm.compose_reply** — soạn câu trả lời bằng LLM (dùng `{{trigger.text}}` trong prompt).
- **action.reply_zalo** — gửi câu trả lời ra Zalo Bot.

### Bước 3 — Cấu hình block
Click vào từng block → panel bên phải:

- `llm.compose_reply`:
  - `prompt`: `Khách hỏi: {{trigger.text}}. Hãy trả lời thân thiện, dưới 200 ký tự.`
  - `system_prompt` (optional)
- `action.reply_zalo`:
  - `text`: `{{llm.compose_reply.text}}` *(token reference output từ block LLM)*
  - `chat_id`: `{{trigger.chat_id}}` *(lấy từ payload trigger)*

### Bước 4 — Lưu + chạy thử
1. Bấm **Save** (Ctrl+S). Workflow lưu vào DB (`bizcity_automation_workflows`).
2. Bấm **Run manually** ở góc trên → mở dialog Run Timeline.
3. Quan sát SSE stream realtime: từng block emit `running / ok / fail` + output JSON.

---

## 3. Trigger reference

### 3.1 `trigger.manual`
Chỉ chạy khi bấm nút **Run manually** hoặc gọi REST `POST /workflows/:id/run`.
Dùng cho: workflow test, workflow do user gọi qua admin action.

### 3.2 `trigger.zalo_inbound`
Tự động chạy khi có tin nhắn Zalo Bot vào (qua Channel Gateway).
Cấu hình `trigger_config`:
```json
{ "filter": "giá", "page_id": "" }
```
- `filter` (optional): chỉ chạy khi text tin nhắn **chứa substring này** (case-insensitive).
- Bỏ trống `filter` → match mọi tin nhắn.
- Bot echo của assistant tự bị bỏ qua (chống loop).

Payload truyền vào `ctx.trigger`:
```json
{
  "channel": "ZALO_BOT",
  "text": "Cho mình hỏi giá khoá học?",
  "user_id": "ext_zalo_user_id",
  "wp_user_id": 12,
  "chat_id": "zalobot_999_user",
  "_trigger": "zalo_inbound"
}
```

### 3.3 `trigger.fb_comment`
Tương tự Zalo nhưng cho Facebook. Hỗ trợ thêm:
```json
{ "filter": "giá", "page_id": "1234567890" }
```
- `page_id`: chỉ match comment của Page cụ thể (bỏ trống = mọi page).

### 3.4 `trigger.cron`
Chạy theo lịch định kỳ. Cấu hình `trigger_config`:
```json
{ "schedule": "every:5:minutes" }
```

Các format hỗ trợ:

| Expression          | Ngữ nghĩa                          |
| ------------------- | ---------------------------------- |
| `every:5:minutes`   | Mỗi 5 phút                         |
| `every:30:minutes`  | Mỗi 30 phút                        |
| `*/15 * * * *`      | Mỗi 15 phút (cron-syntax)          |
| `0 9 * * *`         | 9h sáng mỗi ngày (theo site TZ)    |
| `0 22 * * *`        | 22h mỗi ngày                       |
| (anything else)     | Fallback: 1 lần / 24h              |

Bookkeeping `last_fired_at` lưu trong WP option, không cần bảng riêng.

### 3.5 `trigger.webhook`
Cho phép hệ thống bên ngoài gọi vào để kích hoạt workflow.

Cấu hình `trigger_config`:
```json
{ "slug": "lead-from-zapier", "secret": "biz-wh-xxxxxx" }
```
- `slug` (BẮT BUỘC): định danh trong URL, regex `[a-zA-Z0-9_-]{2,64}`.
- `secret` (**BẮT BUỘC, nếu để trống endpoint sẽ trả 503**).

URL:
```
POST https://YOUR-SITE/wp-json/bizcity-automation/v1/webhook/lead-from-zapier
Header: X-Bizcity-Webhook-Token: biz-wh-xxxxxx
Body  : { "email": "a@b.com", "phone": "...", "anything": "..." }
```
Hoặc dùng query: `?token=biz-wh-xxxxxx`.

Response:
- **202 Accepted** + `{ "ok": true, "run_id": "run_xxx", "mode": "deferred" }` — run đã enqueue, runner cron pick lên tick kế tiếp (≤60s).
- **401** `webhook_token_invalid` — sai token.
- **404** `webhook_not_found` — slug chưa được workflow nào claim.
- **429** `rate_limited` — quá 30 req/phút/slug.
- **503** `webhook_secret_missing` — workflow chưa cấu hình secret (open endpoint bị chặn vì lý do an toàn).

Payload truyền vào `ctx.trigger`:
```json
{
  "email": "a@b.com",
  "_trigger": "webhook",
  "_slug": "lead-from-zapier"
}
```

#### Ví dụ: kịch bản tuỳ biến cho "Nhắc việc mới" của CRM (PHASE-0.50 C-05 N-06)

CRM (Path A / Zone 2, [R-LEADER-MEMBER R-LM-8](../../../docs/rules/PHASE-0-RULE-LEADER-MEMBER-WORKSPACE.md)) gọi
`dispatch_webhook()` mỗi khi leader giao việc và tick "Nhắn Zalo Bot nội bộ", **nếu** trưởng nhóm đã cấu hình một
workflow webhook ở **BizCity CRM → Settings**. Không cấu hình thì CRM tự gửi một mẫu tin cố định — mục này chỉ
dành cho ai muốn tự soạn lời nhắn khác.

1. Tạo workflow mới: block **Trigger → Webhook**, đặt `slug` + `secret`, dán đúng hai giá trị đó vào ô "Kịch bản
   tuỳ biến" ở CRM Settings.
2. Nối sang block **Action → Trả lời Zalo**. **Để trống** cả hai field `Zalo Bot` và `Gửi đến người dùng` —
   `chat_id` đã có sẵn trong `ctx.trigger.chat_id` do CRM resolve theo đúng `user_id` của người nhận việc (R-LM-8),
   khối này tự đọc trước khi cần tới field `override_chat_id`.
3. Soạn `text` bằng template token đọc từ payload CRM gửi — **không có** tên/SĐT/ID khách, chỉ:

   | Token | Ý nghĩa |
   |---|---|
   | `{{trigger.count}}` | số việc trong lần giao này |
   | `{{trigger.leader_name}}` | tên người giao |
   | `{{trigger.due_date}}` | hạn (`YYYY-MM-DD`, rỗng nếu không đặt hạn) |
   | `{{trigger.link}}` | đường dẫn `/gpt/crm/` |
   | `{{trigger.recipient_user_id}}` | `user_id` người nhận (không phải PII khách) |

   Ví dụ `text`: `Bạn có {{trigger.count}} việc mới từ {{trigger.leader_name}}. Xem: {{trigger.link}}`
4. Bật `enabled=1` cho workflow, lưu lại ô Settings ở CRM. Lần giao việc kế tiếp (có tick "Nhắn Zalo Bot nội bộ")
   sẽ chạy qua workflow này thay vì mẫu mặc định.

### 3.6 `trigger.crm_event`
Chạy khi một event CRM được tạo với `event_type` khớp cấu hình.
Dùng cho: welcome contact mới, SLA breach, CSAT sau resolve, loyalty, invoice quá hạn.

Cấu hình `trigger_config`:
```json
{ "event_type": "contact_created" }
```

Payload truyền vào `ctx.trigger`:
```json
{
  "event_type": "contact_created",
  "contact_id": 123,
  "contact_name": "Nguyễn Văn A",
  "contact_email": "a@b.com",
  "_trigger": "crm_event"
}
```

> **Zone note:** trigger này dùng được cả Path A (admin) lẫn Path B (CRM-care recipe). Khi dùng trong recipe `zone=crm` thì `run.source='crm_care'`.

---

### 3.7 Trigger từ trang **Scheduler** (event_type=`automation_workflow`)

**Cách user lên lịch chạy workflow một lần (one-shot)** mà không cần dùng cron expression:

1. Mở `wp-admin/admin.php?page=bizcity-scheduler`.
2. Bấm **+ Tạo sự kiện mới**.
3. Điền form:
   - **Tiêu đề:** ví dụ `Chạy workflow Daily Report 9:00 sáng`.
   - **Bắt đầu lúc:** thời điểm muốn workflow kích hoạt.
   - **Nhắc trước:** 0 phút (nếu muốn chạy đúng giờ bắt đầu).
   - **Trạng thái:** `active`.
   - **Loại sự kiện** (`event_type`): `automation_workflow`.
     > *Tab Advanced trong UI scheduler hoặc gọi REST `POST bizcity-scheduler/v1/events` để set field này.*
   - **Metadata (JSON):**
     ```json
     {
       "workflow_id": 42,
       "payload": {
         "from": "scheduler",
         "any_field": "merged into ctx.trigger"
       }
     }
     ```
4. Save.

Khi tới giờ, scheduler-cron tự bắn `do_action('bizcity_scheduler_reminder_fire', $event)`. Trigger Matcher (priority 45) đọc `metadata.workflow_id`, enqueue + chạy sync workflow đó.

**Use cases:**
- Chạy báo cáo hằng tuần đúng thứ Hai 9h sáng.
- Gửi nhắc nhở 1-lần cho khách hàng cụ thể (workflow gửi email + ghi CRM).
- Schedule một workflow sau N giờ kể từ sự kiện X (vd: workflow follow-up sau khi user mua hàng 24h — dùng từ code: `wp_insert_event_with_metadata()`).

---

## 4. Block reference (22 trigger + action built-in)

### Triggers (9)
| Block ID                    | Mô tả                                                 |
| --------------------------- | ----------------------------------------------------- |
| `trigger.manual`            | Chạy thủ công                                         |
| `trigger.zalo_inbound`      | Tin nhắn / file / voice / ảnh Zalo Bot                |
| `trigger.fb_comment`        | Comment Facebook Page                                 |
| `trigger.fb_message`        | DM Facebook Messenger (Zone 1 — CRM care)             |
| `trigger.telegram_inbound`  | Telegram bot DM                                       |
| `trigger.cron`              | Theo lịch cron (cron expression hoặc `every:N:unit`)  |
| `trigger.webhook`           | HTTP POST từ ngoài (token-protected)                  |
| `trigger.crm_event`         | CRM event theo `event_type` (contact/sla/loyalty/...) |
| `trigger.cf7_submit`        | Contact Form 7 submit (bất kỳ form hoặc form cụ thể) |

### Actions (11)
| Block ID                    | Mô tả                                                        | Data fields                                                    |
| --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------- |
| `action.search_kg`          | Tìm trong Knowledge Graph                                    | `query`, `top_k`                                               |
| `action.reply_zalo`         | Gửi tin nhắn Zalo Bot                                        | `text`, `conversation_chat_id`                                              |
| `action.send_email`         | Gửi email qua `wp_mail()` (hỗ trợ SMTP BizCity, rich body)  | `to`, `subject`, `body`, `attachment_url` *(opt)*             |
| `action.http_request`       | HTTP request ngoài (SSRF guarded, chỉ http(s), no priv IP)  | `method`, `url`, `headers`, `body`                             |
| `action.db_write`           | Insert row vào bảng whitelist                                | `table`, `data` (KV)                                           |
| `action.log`                | error_log() để debug                                         | `message` *(supports `{{*}}` = full ctx JSON)*                 |
| `action.create_crm_event`   | Tạo event trong CRM/Scheduler                                | `event_type`, `title`, `body`, `due_at`, …                     |
| `action.web_research`       | Tra cứu web theo chủ đề (TwinBrain Web engine)               | `query`, `vertical` *(auto/tax/law/gov/med/nutri/scholar/social)*, `mode` *(quick/deep)*, `max_results` |
| `action.generate_content`   | Tạo nội dung bằng AI (LLM + notebook skeleton)              | `content_type`, `notebook_id`, `prompt_template`, `tone`, `max_words` |
| `action.invoke_skill`       | Gọi một skill theo slug (cross-tier bridge)                  | `skill_slug`, `prompt_template`, `vars_json`                   |
| `action.run_astro`          | Tra cứu bản đồ sao + nhận định chiêm tinh (TwinBrain Astro)  | `chat_id`, `instance_id`, `query`, `compose` *(toggle LLM)*   |

### LLM (2)
| Block ID                  | Mô tả                                                          | Data fields                                |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `llm.compose_reply`       | Gọi LLM compose response (dùng `BizCity_LLM_Client`)          | `prompt`, `system_prompt`, `max_tokens`    |
| `llm.mpr_think`           | TwinBrain 9-layer MPR reasoning (full thinking trace)          | `prompt`, `guru_id`, `surface`             |

### Logic (1)
| Block ID            | Mô tả                          | Data fields              |
| ------------------- | ------------------------------ | ------------------------ |
| `logic.condition`   | Rẽ nhánh true/false            | `expression`             |

Expression syntax:
- Tokens: `node.path.to.field` (vd `kg.hits`, `trigger.text`).
- Operators: `== != > < >= <= contains`.
- Boolean: `&&` `||` (1 cấp, không precedence — group bằng cách viết lại).

Ví dụ:
```
trigger.text contains "giá" && kg.hits > 0
```

Output: `{ branch: 'true' | 'false', matched: bool }`.

Edge từ `logic.condition` phải set `sourceHandle = "true"` hoặc `"false"`. Runner sẽ skip cả nhánh bị loại.

---

## 5. Template substitution `{{...}}`

Mọi data field kiểu string đều resolve `{{a.b.c}}` từ `ctx`:

```
ctx = {
  trigger: { text: "...", chat_id: "..." },
  n_search_1: { hits: 3, results: [...] },         // output theo node id
  search_kg:  { hits: 3, results: [...] },         // alias theo kind (last output)
  _run_id: "run_xxx",
  _workflow_id: 42,
  _meta: { workflow_slug: "...", workflow_name: "..." }
}
```

Đặc biệt: `{{*}}` (chỉ trong `action.log.message`) = dump full ctx JSON.

---

## 6. Chạy + theo dõi

### 6.1 Manual run
- Builder UI: nút **Run** ở góc trên → mở Run Timeline (SSE realtime).
- REST: `POST /wp-json/bizcity-automation/v1/workflows/42/run` (`?defer=1` để enqueue cho cron thay vì sync).

### 6.2 Run history
- Builder UI: tab **Runs** → list paginated.
- REST: `GET /wp-json/bizcity-automation/v1/runs?workflow_id=42&limit=50`.

### 6.3 Cancel run
- UI: button **Cancel** (chỉ khả dụng khi run đang `queued`).
- REST: `POST /wp-json/bizcity-automation/v1/runs/run_xxx/cancel`.

### 6.4 SSE event stream
```
GET /wp-json/bizcity-automation/v1/runs/run_xxx/events
Content-Type: text/event-stream
```
Mỗi log row mới được emit:
```
id: 12345
event: log
data: {"node_id":"n_compose","block_id":"llm.compose_reply","status":1,"output":{...}}

event: end
data: {"status":2}
```

### 6.5 Tìm run từ trang Scheduler
Mỗi run xong tự ghi 1 row `event_type='automation_run'` trong `bizcity_crm_events`:
- Title: `[<workflow name>] OK` hoặc `FAIL`.
- Body: JSON tóm tắt.
- Field `related_id` = `run_id`.

Mở **Scheduler page** → filter `event_type=automation_run` để xem lịch sử.

---

## 7. Bảo mật & giới hạn

| Mối lo                  | Cách bảo vệ                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| Webhook spam            | Rate-limit 30 req/min/slug + secret bắt buộc.                      |
| SSRF qua `http_request` | Chặn `file://`, IP private, chỉ cho `http/https`, method whitelist. |
| DB tampering            | `db_write` chỉ ghi vào bảng whitelist (default: `automation_logs`, `crm_events`). Mở rộng qua filter `bizcity_automation_db_write_whitelist`. |
| LLM cost spike          | `max_tokens` trong block + entitlement check trong `BizCity_LLM_Client`. |
| Permission              | Mọi REST admin route yêu cầu `manage_options`. Webhook public nhưng có token. |

Recommend:
- Đặt **secret webhook** ≥ 24 ký tự random.
- KHÔNG bật `action.db_write` ghi vào table `wp_users` / `wp_options` (không có trong whitelist mặc định, đừng override).
- KHÔNG log dữ liệu nhạy cảm qua `action.log` ở production (kiểm tra `WP_DEBUG=false`).

---

## 8. Troubleshooting

### "Workflow không chạy khi có tin nhắn Zalo / FB"
1. Mở `wp-admin/tools.php?page=bizcity-diagnostics` → run probe **Core · Automation**.
2. Verify `Runtime · matcher hook bizcity_channel_message_received` PASS.
3. Verify `trigger_type` của workflow là `zalo_inbound` / `fb_comment`.
4. Verify `enabled=1`.
5. Test `filter` substring — bỏ trống thử lại.

### "Webhook trả 503"
→ Workflow chưa set `trigger_config.secret`. Mở workflow → tab Trigger → đặt secret.

### "Run mãi `queued` không lên `running`"
1. WordPress cron đang chạy? Test `wp cron event list | grep bizcity_automation_cron_dispatch`.
2. Probe **Core · Automation** → step `Runtime · runner execute` phải PASS.
3. Nếu site dùng external cron, đảm bảo gọi `wp-cron.php` mỗi phút.

### "Run FAIL với reason `block_error`"
- Mở Run Timeline → click step `fail` → xem `error` field.
- Hoặc REST: `GET /runs/run_xxx` → field `result.error`.

### "Scheduler event không trigger workflow"
1. Verify `event_type` đúng = `automation_workflow` (không phải `automation_run`).
2. Verify `metadata.workflow_id` là số nguyên dương + workflow tồn tại + `enabled=1`.
3. Verify event `status='active'` (không phải `draft`).
4. Check cron `bizcity_cron_runs.meta` cho hook `bizcity_scheduler_cron` — có note_event `automation_scheduler_invalid_metadata` không?

---

## 9. REST API cheat-sheet

NS: `bizcity-automation/v1`.

Quyền workflow:
- Customer đã đăng nhập (`read`) được tạo workflow mới, mở canvas, lưu/bật/tắt/xóa workflow do chính họ tạo, và duplicate workflow admin publish dạng must-use thành bản riêng.
- Admin (`manage_options`) có thêm quyền dùng Template Gallery / Hub / Community import, Save as template, và publish/unpublish workflow thành must-use cho mọi user trong blog client.
- Customer không được sửa trực tiếp workflow must-use/global của admin; REST enforce ownership bằng `created_by`.

```
GET    /workflows                    # list
POST   /workflows                    # create
GET    /workflows/{id}               # load
PUT    /workflows/{id}               # update
DELETE /workflows/{id}               # soft delete
POST   /workflows/{id}/duplicate     # clone
POST   /workflows/{id}/run           # run (?defer=1 = cron mode)

GET    /runs?workflow_id=&limit=     # history
GET    /runs/{run_id}                # detail
POST   /runs/{run_id}/cancel         # cancel
GET    /runs/{run_id}/events         # SSE stream

GET    /blocks                       # block catalog

POST   /webhook/{slug}               # PUBLIC (token-protected)
```

---

## 10. Mở rộng cho developer

### 10.1 Đăng ký block tự định nghĩa
```php
add_filter( 'bizcity_automation_register_blocks', function( $registry ) {
    require_once __DIR__ . '/class-my-block.php';
    $registry->register( new My_Block() );
    return $registry;
} );
```
`My_Block` implement `BizCity_Automation_Block` (interface 4 method: `id()`, `kind()`, `meta()`, `execute($ctx, $data)`). Khuyến nghị extend `BizCity_Automation_Block_Base` để có helper `resolve()` template + `debug()`.

### 10.2 Lập lịch workflow từ code
```php
$mgr = BizCity_Scheduler_Manager::instance();
$mgr->create_event( array(
    'user_id'    => get_current_user_id(),
    'title'      => 'Run workflow nightly report',
    'start_at'   => gmdate( 'Y-m-d H:i:s', strtotime( 'tomorrow 09:00' ) ),
    'event_type' => 'automation_workflow',
    'metadata'   => array(
        'workflow_id' => 42,
        'payload'     => array( 'report_date' => gmdate( 'Y-m-d' ) ),
    ),
    'status'     => 'active',
) );
```

### 10.3 Enqueue run từ code
```php
$run_id = BizCity_Automation_Repo_Runs::enqueue( 42, array(
    'from'    => 'my_plugin',
    'payload' => array( 'foo' => 'bar' ),
) );
// Chạy ngay sync:
BizCity_Automation_Runner::instance()->execute( $run_id );
// Hoặc để cron pick up.
```

### 10.4 Lắng nghe event run
```php
add_action( 'bizcity_automation_run_enqueued', function( $run_id, $wf_id, $payload ) {
    // do something
}, 10, 3 );

add_action( 'bizcity_automation_log_appended', function( $run_id, $log_row ) {
    // do something per node
}, 10, 2 );
```

### 10.5 Map platform → trigger_type tự định nghĩa
```php
add_filter( 'bizcity_automation_map_trigger_type', function( $trigger, $platform, $payload ) {
    if ( $platform === 'TELEGRAM' ) { return 'telegram_inbound'; }
    return $trigger;
}, 10, 3 );
```

---

## 11. Roadmap kế tiếp (sau BE-5)

- **AI authoring** — chat với LLM để sinh workflow JSON (Pillar 2).
- **Versioning UI** — diff giữa version cũ/mới của graph.
- **Marketplace template** — chia sẻ workflow giữa site.
- **Parallel branch** — tận dụng Action Scheduler chạy song song nhiều nhánh.
- **Sub-workflow call** — workflow A invoke workflow B.

---

## 11b. BE-6 mới ship (Instance picker · Test Listener · Cron Health · Messenger split · MPR Thinking)

### Instance picker — chọn OA/Page/Bot cụ thể
Trigger Zalo/FB/Telegram nay có dropdown **OA/Page/Bot**. Bỏ trống = nhận từ
mọi instance. Chọn `oa_abc` = chỉ workflow này fire khi tin về OA `oa_abc`.
Phù hợp khi site có 5 OA Zalo + 3 fanpage, mỗi vertical 1 workflow riêng.

> Backend: matcher check `trigger_config.instance_id` vs `payload.instance_id`
> trước substring filter. Registry mirror: `GET /wp-json/bizcity-automation/v1/channel-registry?platform=ZALO_BOT`.

### Chạy thử (Test Listener) — capture tin thật
Builder canvas → click trigger node → bấm **Chạy thử**. FE gọi:
```
POST /wp-json/bizcity-automation/v1/test/listen
{ "trigger_code":"zalo_inbound", "node_id":"t_1", "ttl_seconds":300 }
→ { listener_id, expires_at }
```
Trong 5 phút, gửi 1 tin thật từ Zalo/FB. FE polling
`GET /test/poll?listener_id=...` → khi `status=captured` thì có
`captured_payload` → user bấm "Chạy lại với payload này" để debug downstream.

Capture hook chạy priority 1 trước matcher chính → workflow vẫn enqueue
như bình thường, listener KHÔNG block.

### Cron health
- Settings → Tools → "Automation Cron" hoặc `GET /cron-health`.
- Status: `healthy` (<5 phút) · `degraded` (<30 phút) · `dead` (>30 phút).
- Nếu `dead` → admin banner đỏ cảnh báo. Check `DISABLE_WP_CRON`, system cron.
- Option lưu: `bizcity_automation_cron_last_tick` (autoload=no).

### Messenger trigger tách 2 loại
| Trigger | platform + event_subtype | Use case |
|---|---|---|
| `trigger.fb_message` | FACEBOOK + messaging | DM Messenger (inbox riêng) |
| `trigger.fb_comment` | FACEBOOK + feed | Comment trên Page post |
| `trigger.telegram_inbound` | TELEGRAM | Telegram bot DM |

Matcher tự derive `event_subtype` từ `payload.raw.entry[0]`.
Channel Gateway adapter Facebook hiện tại chỉ parse `entry[].messaging` —
adapter nâng cấp parse `entry[].changes` (feed) là việc của Channel Gateway
(không thuộc Automation).

### MPR Thinking action (`llm.mpr_think`)
Block LLM gọi `BizCity_TwinBrain_Runtime` (9-layer reasoning: pre_rules →
guru_lookup → tool_intent → tool_dispatch → perspective → synthesizer →
final_done). Mỗi layer được ghi 1 row vào `automation_logs` với
`block_id='llm.mpr_think.event'` → FE Run Timeline hiện step-by-step.

Output dòng JSON:
```json
{
  "answer_md": "...",
  "thinking_md": "1. **pre_rules_done** — {...}\n2. ...",
  "citations": [...],
  "events": [{event_key, summary}, ...],
  "layers_count": 9,
  "trace_id": "tb_xxxx"
}
```

Pattern: TwinBrain chat → user "tạo bảng tính" → TwinBrain fire
`do_action('bizcity_twinbrain_intent', 'create_spreadsheet', $payload)` →
trigger `twinbrain_intent` (cfg.intent_id='create_spreadsheet') match →
workflow chạy `llm.mpr_think` (research) → `action.http_request`
(Google Sheets API) → `action.reply_zalo` (báo link).

---

## 13. Template Gallery — Thư viện 57 công thức

> Truy cập: **Automation → nút "Thư viện"** (hoặc nút "+ New" → chọn "Từ template").
> Admin có thể **Re-seed** (nút góc phải) để cập nhật built-in templates mới nhất.

### 13.1 Cách dùng
1. Mở gallery → filter theo **nhóm** (dropdown) hoặc **tìm kiếm** tên/slug.
2. Click card → **Xem trước** (JSON graph readonly).
3. Bấm **Cài đặt / Sử dụng** → hệ thống clone thành workflow `enabled=0`.
4. Mở workflow mới trong builder → điền các tham số cần thiết (`instance_id`, `page_id`, `secret`…).
5. Bấm **Publish** để bật.

### 13.2 Danh mục 57 template (SEED_VERSION 1.20.0)

| # | Slug | Tên | Nhóm | Trigger |
|---|---|---|---|---|
| 1 | `tpl_zalo_cskh_v1` | Zalo CSKH — Hỏi & đáp tự động | cskh | zalo_inbound |
| 2 | `tpl_fb_lead_capture_v1` | Facebook Lead — Capture & notify | lead | fb_comment |
| 3 | `tpl_mpr_auto_reply_v1` | MPR Auto-reply (TwinBrain) | mpr | zalo_inbound |
| 4 | `tpl_cron_daily_report_v1` | Cron · Báo cáo hàng ngày | report | cron |
| 5 | `tpl_webhook_to_crm_v1` | Webhook → CRM event | webhook | webhook |
| 6 | `tpl_tb_web_search_alert_v1` | TwinBrain Web Search Alert | mpr | zalo_inbound |
| 7 | `tpl_zalo_pilot_keyword_v1` | Pilot · Keyword chain (no AI) | general | zalo_inbound |
| 8 | `tpl_zalo_pilot_fallback_v1` | Pilot · Fallback → TwinBrain | general | zalo_inbound |
| 9 | `tpl_image_capture_v1` | Pilot · Nhận ảnh (turn 1) | general | zalo_inbound |
| 10 | `tpl_post_web_with_image_v1` | Pilot · Đăng web kèm ảnh | general | zalo_inbound |
| 11 | `tpl_post_web_image_first_v1` | Logic 1: ảnh trước → keyword sau | general | zalo_inbound |
| 12 | `tpl_post_fb_image_first_v1` | Logic 2: ảnh trước → đăng FB | general | zalo_inbound |
| 13 | `tpl_reminder_calendar_v1` | Logic 3: nhắc lịch → CRM event | general | zalo_inbound |
| 14 | `tpl_post_fb_with_image_v1` | Pilot · Đăng FB Page kèm ảnh | general | zalo_inbound |
| 15 | `tpl_schedule_event_v1` | Lên lịch generic (CRM event) | general | zalo_inbound |
| 16 | `tpl_test_smoke_manual_v1` | Smoke test đơn giản nhất | test | manual |
| 17 | `tpl_test_smoke_branch_v1` | Smoke test có condition branch | test | manual |
| 18 | `tpl_knowledge_router_v1` | @hỏi → TwinBrain MPR thinking | mpr | zalo_inbound |
| 19 | `tpl_remember_this_v1` | @nhớ → CRM event (memory note) | general | zalo_inbound |
| 20 | `tpl_slash_kg_query_v1` | /kg slash → KG search → LLM | general | zalo_inbound |
| 21 | `tpl_skill_intent_invoke_v1` | skill_intent → invoke → log | general | zalo_inbound |
| 22 | `tpl_zalo_oa_auto_reply_v1` | **[Care] Zalo OA CSKH tự động** | **cskh** | zalo_inbound |
| 23 | `tpl_zalo_classify_route_v1` | **[Care] Phân loại → route phòng ban** | **cskh** | zalo_inbound |
| 24 | `tpl_zalo_tag_assign_v1` | **[Care] Tag + assign NV chăm sóc** | **cskh** | zalo_inbound |
| 25 | `tpl_fb_messenger_auto_reply_v1` | **[Care] FB Messenger CSKH** | **cskh** | fb_message |
| 26 | `tpl_deplao_keyword_chain_v1` | [Deplao] Trả lời theo từ khoá (no AI) | general | zalo_inbound |
| 27 | `tpl_deplao_lead_collect_v1` | [Deplao] Thu thập lead / tư vấn | lead | zalo_inbound |
| 28 | `tpl_deplao_fb_comment_lead_v1` | [Deplao] FB comment → CRM lead | lead | fb_comment |
| 29 | `tpl_deplao_out_of_hours_v1` | [Deplao] Ngoài giờ → Tự trả lời | cskh | zalo_inbound |
| 30 | `tpl_deplao_order_confirm_v1` | [Deplao] Webhook thanh toán → CRM | webhook | webhook |
| 31 | `tpl_woo_order_created_v1` | [Woo] Đơn mới → CRM + Zalo | general | webhook |
| 32 | `tpl_woo_order_shipped_v1` | [Woo] Shipped → Zalo khách | general | webhook |
| 33 | `tpl_woo_abandoned_cart_v1` | [Woo] Giỏ bỏ dở → Nhắc Zalo | lead | webhook |
| 34 | `tpl_woo_refund_notify_v1` | [Woo] Hoàn tiền → Log + Zalo | general | webhook |
| 35 | `tpl_woo_low_stock_v1` | [Woo] Sắp hết hàng → Email | general | webhook |
| 36 | `tpl_crm_new_contact_welcome_v1` | [CRM] Liên hệ mới → Welcome Zalo | lead | crm_event |
| 37 | `tpl_crm_label_notify_v1` | [CRM] Label gán → Thông báo NV | cskh | crm_event |
| 38 | `tpl_crm_sla_escalate_v1` | [CRM] SLA quá hạn → Escalate | cskh | crm_event |
| 39 | `tpl_crm_csat_v1` | [CRM] Đóng hội thoại → CSAT | cskh | crm_event |
| 40 | `tpl_crm_stale_lead_v1` | [CRM] Lead nguội → Nhắc NV hàng ngày | lead | cron |
| 41 | `tpl_internal_standup_v1` | [Nội bộ] Standup sáng T2-T6 | report | cron |
| 42 | `tpl_internal_weekly_v1` | [Nội bộ] Báo cáo tuần Thứ 2 | report | cron |
| 43 | `tpl_internal_task_overdue_v1` | [Nội bộ] Task quá hạn → Nhắc | general | cron |
| 44 | `tpl_zalo_image_classify_v1` | [Zalo] Ảnh → Phân loại + CRM | cskh | zalo_inbound |
| 45 | `tpl_zalo_pdf_extract_v1` | [Zalo] File/PDF → Lưu Knowledge Base | general | zalo_inbound |
| 46 | `tpl_zalo_voice_v1` | [Zalo] Voice → Transcribe + CRM | cskh | zalo_inbound |
| 47 | `tpl_loyalty_earned_v1` | [Loyalty] Tích điểm → Zalo | cskh | crm_event |
| 48 | `tpl_loyalty_tier_up_v1` | [Loyalty] Lên hạng → Zalo chúc mừng | cskh | crm_event |
| 49 | `tpl_campaign_started_v1` | [Campaign] Bắt đầu → Zalo team | general | crm_event |
| 50 | `tpl_appointment_reminder_v1` | [CRM] Nhắc lịch hẹn → Zalo khách | cskh | crm_event |
| 51 | `tpl_invoice_overdue_v1` | [Finance] Hóa đơn quá hạn → Email | general | crm_event |
| 52 | `tpl_ai_summarise_thread_v1` | [AI] Tóm tắt hội thoại → Zalo | cskh | zalo_inbound |
| 53 | `tpl_http_form_to_crm_v1` | [HTTP] Form đăng ký → CRM + Zalo | lead | webhook |
| 54 | `tpl_zalo_menu_bot_v1` | [Zalo] Menu bot 1-2-3 (tĩnh, no AI) | cskh | zalo_inbound |
| 55 | `tpl_broadcast_segment_v1` | [Broadcast] Cron → Draft VIP campaign | lead | cron |
| 56 | `tpl_zalobot_web_research_steps_v1` | **[AI] Zalo Bot · Nghiên cứu web 3 bước** | ai | zalo_inbound |
| 57 | `tpl_zalobot_astro_steps_v1` | **[AI] Zalo Bot · Chiêm tinh 3 bước** *(pro)* | ai | zalo_inbound |
| — | `tpl_cf7_ebook_autoresponder_v1` | [CF7] Ebook autoresponder · SMTP + CRM | lead | cf7_submit |

> Template #56–57 dùng `action.web_research` + `action.run_astro` — xem chi tiết tại §15.
> Template CF7 (#—) = không đánh số vì `trigger.cf7_submit` yêu cầu plugin Contact Form 7.

**Template in đậm** (#22–25) = `zone=crm` — phơi trong tab "Tự động hoá CSKH" của CRM SPA (Path B).
Các template khác = `zone=admin` — chỉ thấy trong Automation Builder (Path A, `manage_options`).

### 13.3 Re-seed & cập nhật

```
Admin UI: Thư viện → nút "Re-seed"
REST:     POST /wp-json/bizcity-automation/v1/templates/reseed   (manage_options)
WP-CLI:   wp eval "BizCity_Automation_Templates_Seeder::force_reseed();"
```

Re-seed là **idempotent** — slug unique, chỉ cập nhật version (không xoá workflow đã instantiate).

---

## 14. Tab "Tự động hoá CSKH" — Path B (CRM SPA)

> Cho nhân viên CSKH / team chăm sóc — **KHÔNG** cần vào Automation Builder.
> Rule: [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md) §2 R-ZONE-5.

### 14.1 Truy cập

`wp-admin/admin.php?page=bizcity-twin-crm#tab=crm-care`

Menu: **CRM** → left rail → **CSKH tự động** (icon HeartHandshake, hotkey `z`)

Cần quyền `bizcity_crm_manage` hoặc `manage_options`.

### 14.2 Luồng sử dụng

```
1. Bộ công thức có sẵn  →  click "Kích hoạt"  →  recipe được clone (enabled=0)
2. Mục "Công thức của tôi" →  bật toggle (enabled=1)  →  recipe bắt đầu theo dõi kênh
3. Nút "Kênh" →  chọn Inbox Zone-1 (Zalo OA / Zalo Personal / FB / WebChat)
4. Nút "Lịch sử" →  drawer read-only xem runs
```

### 14.3 Giới hạn của Path B

| Được phép | Không được phép |
|---|---|
| Bật/tắt recipe | Mở ReactFlow canvas sửa node/edge |
| Gắn kênh Zone-1 | Tạo workflow trống từ đầu |
| Xem lịch sử chạy (read-only) | Sửa `graph_json` thủ công |
| Đổi tên recipe | Thêm action HTTP/db_write tuỳ ý |

### 14.4 API surface Path B

```
GET  /bizcity-automation/v1/workflows?zone=crm&is_template=1    # recipe gallery
GET  /bizcity-automation/v1/workflows?zone=crm&is_template=0    # my recipes
POST /bizcity-automation/v1/templates/{id}/crm-instantiate      # kích hoạt
POST /bizcity-automation/v1/workflows/{id}/bind                 # gắn kênh
PUT  /bizcity-automation/v1/workflows/{id}                      # enabled toggle / rename
GET  /bizcity-automation/v1/runs?zone=crm&workflow_id={id}      # run history
```

### 14.5 Mở rộng recipe mới (cho admin)

1. Viết blueprint trong `class-automation-templates-seeder.php` với `zone=crm`, `is_template=1`, `category='cskh'|'care'`.
2. Bump `SEED_VERSION` (vd `1.13.0`).
3. Chạy Re-seed — recipe mới xuất hiện trong gallery Path B ngay.

---

---

## 15. Kịch bản nâng cao: Nghiên cứu web & Chiêm tinh qua Zalo Bot

> **PHASE-ZALOBOT** — ship 2026-06-18.
> Hai kịch bản dưới đây là ví dụ tiêu biểu về luồng **3-bước** (ack → xử lý → trả kết quả)
> thay vì 1-bước đơn, giúp user biết AI đang làm gì và tránh timeout cảm giác.

---

### 15.1 Nghiên cứu web (`action.web_research`)

#### Mô tả
Admin nhắn qua Zalo Bot: **"nghiên cứu thuế TNCN"** → bot trả lời 3 tin:
1. **Ack:** _"🔍 Đang nghiên cứu..."_ (ngay lập tức)
2. **Nguồn:** danh sách 7 nguồn tham khảo dạng text thuần (Zalo-friendly)
3. **Tổng hợp:** nhận định tổng hợp từ AI

#### Block `action.web_research`

| Field | Type | Mô tả |
|---|---|---|
| `query` | text/template | Câu truy vấn, vd `{{trigger.text}}` |
| `vertical` | select | `auto` = tổng hợp; `tax` = thuế; `law` = pháp lý; `gov` = chính phủ; `med` = y tế; `nutri` = dinh dưỡng; `scholar` = học thuật; `social` = mạng xã hội |
| `mode` | select | `quick` (≤4s) hoặc `deep` (ReAct ≤60s). **Chỉ có tác dụng khi `vertical=auto`** |
| `max_results` | number | Số nguồn tối đa (1–15, mặc định 7) |

**Outputs quan trọng:**

| Output | Mô tả | Dùng khi |
|---|---|---|
| `{{n_X.ok}}` | `true`/`false` | Kiểm tra trong `logic.condition` |
| `{{n_X.answer_md}}` | Tổng hợp dạng Markdown | Gửi lên TwinChat hoặc WhatsApp (hỗ trợ markdown) |
| `{{n_X.sources_text}}` | Danh sách nguồn dạng plain text | **Gửi qua Zalo** (Zalo không render markdown) |
| `{{n_X.citation_count}}` | Số nguồn tìm được | Hiển thị trong ack step 2 |

**Vertical routing — khi nào dùng?**

| Vertical | Phù hợp với |
|---|---|
| `auto` | Hỏi tổng hợp, tin tức, kiến thức chung |
| `tax` | Thuế TNCN, thuế GTGT, luật thuế |
| `law` | Luật dân sự, hình sự, lao động, hợp đồng |
| `gov` | Thủ tục hành chính, giấy tờ nhà nước |
| `med` | Bệnh lý, thuốc, hướng dẫn y tế |
| `nutri` | Dinh dưỡng, thực phẩm, chế độ ăn |
| `scholar` | Nghiên cứu khoa học, học thuật |
| `social` | Mạng xã hội, tâm lý, community |

#### Luồng template `tpl_zalobot_web_research_steps_v1`

```
[trigger.zalo_inbound]
    filter: "nghiên cứu"
         │
         ▼
[action.reply_zalo]  ← Ack: "🔍 Đang nghiên cứu {{trigger.text}}..."
         │
         ▼
[action.web_research]
    query: {{trigger.text}}
    vertical: auto   (đổi sang tax/law/gov/... tùy ngữ cảnh site)
    mode: quick
    max_results: 7
         │
         ▼
[logic.condition]
    expression: research.ok == 1
         │
    ┌────┴────┐
    │ true   │ false
    ▼         ▼
[reply: nguồn]  [reply: không tìm được]
    │
    ▼
[reply: tổng hợp]
```

**Cấu hình sau khi cài template:**
1. Mở workflow → node `trigger` → đặt `instance_id` đúng Zalo Bot instance của bạn.
2. (Tuỳ chọn) Đổi `filter` từ `nghiên cứu` sang từ khoá phù hợp site (vd: `hỏi thuế`, `tra cứu luật`).
3. (Tuỳ chọn) Đổi `vertical` từ `auto` sang lĩnh vực cụ thể nếu site chuyên về 1 ngành.
4. Bật `enabled=1` → Publish.

---

### 15.2 Chiêm tinh (`action.run_astro`)

#### Mô tả
Admin nhắn qua Zalo Bot: **"chiêm tinh hôm nay"** → bot trả lời 3 tin:
1. **Ack:** _"🔭 Đang tra cứu bản đồ sao..."_
2. **Chart links:** link bản đồ sao natal + transit (nếu đã có bản đồ sao trong hệ thống)
3. **Nhận định AI:** đoạn luận giải ngắn (≤250 từ) do LLM soạn từ data chiêm tinh

**Fallback khi chưa có bản đồ sao:**  
Bot gửi link **Tạo bản đồ sao mới** (có nhúng `chat_id` + `return=zalo_bot`) → user tạo xong → nhắn lại → bot luận giải.

#### Block `action.run_astro`

| Field | Type | Mô tả |
|---|---|---|
| `chat_id` | text | Chat ID Zalo, mặc định `{{trigger.chat_id}}` |
| `instance_id` | text | Bot instance, mặc định `{{trigger.instance_id}}` |
| `query` | textarea | Câu hỏi chiêm tinh, mặc định `{{trigger.text}}` |
| `compose` | toggle | Bật = LLM soạn nhận định (18s); Tắt = chỉ lấy links |

**Outputs:**

| Output | Mô tả |
|---|---|
| `{{n_X.ok}}` | Thành công? |
| `{{n_X.has_chart}}` | `1` = đã có bản đồ sao; `0` = chưa có |
| `{{n_X.passages_count}}` | Số data passages nạp được (dùng trong `logic.condition`) |
| `{{n_X.coachee_name}}` | Tên coachee (từ bizcoach-pro) |
| `{{n_X.period_label}}` | Kỳ tiếng Việt: "ngày hôm nay", "tuần này", "tháng này"... |
| `{{n_X.natal_url}}` | URL xem bản đồ sao natal (có `?chat_id=...`) |
| `{{n_X.transit_url}}` | URL xem transit kỳ hiện tại |
| `{{n_X.create_chart_url}}` | URL tạo bản đồ sao mới (fallback) |
| `{{n_X.analysis}}` | Nhận định LLM (nếu `compose=true` và `has_chart=true`) |

#### Luồng template `tpl_zalobot_astro_steps_v1`

```
[trigger.zalo_inbound]
    filter: "chiêm tinh"
         │
         ▼
[action.reply_zalo]  ← Ack: "🔭 Đang tra cứu bản đồ sao..."
         │
         ▼
[action.run_astro]
    chat_id: {{trigger.chat_id}}
    compose: true
         │
         ▼
[logic.condition]
    expression: astro.passages_count > 0
         │
    ┌────┴────┐
    │ true   │ false
    ▼         ▼
[reply: links chart]   [reply: fallback → link tạo chart]
"✨ Bản đồ sao của     "🌟 Bạn chưa có bản đồ sao...
 {{astro.coachee_name}} \n  👉 {{astro.create_chart_url}}"
 📊 Natal: {{natal_url}}
 🌀 Transit: {{transit_url}}"
    │
    ▼
[reply: nhận định]
"🔮 {{astro.period_label}}:\n{{astro.analysis}}"
```

**Yêu cầu:**
- Plugin **bizcoach-pro** đã cài và kích hoạt.
- Ít nhất 1 coachee đã có bản đồ sao được liên kết với `chat_id` của user qua Zalo Bot.
- `action.run_astro` tự resolve `user_id` từ `chat_id` qua filter `bizcity_automation_astro_user_id_from_chat_id`.

**Cấu hình sau khi cài template:**
1. Đặt `instance_id` đúng Zalo Bot của bạn.
2. Đổi `filter` nếu muốn dùng từ khoá khác (vd: `tử vi`, `lá số tử vi`, `bói`).
3. Kiểm tra plan: template này `plan=pro`.
4. Bật `enabled=1`.

#### Luồng end-to-end với nút "Luận giải" trên trang bản đồ sao *(sắp ra)*

```
[User nhắn "chiêm tinh"]
         ↓
[Bot gửi link tạo chart]
  ?zalo_chat_id=XXX&return=zalo_bot
         ↓
[User mở link → tạo coachee mới → nhấn "Luận giải qua Zalo"]
         ↓
[bizcoach-pro REST]
         ↓
[Bot gửi nhận định ngay qua Zalo]
```

> Nút "Luận giải qua Zalo" trên trang bản đồ sao đang được implement trong sprint kế tiếp (`bizcoach-pro` plugin).

---

### 15.3 Tips kết hợp

**Luồng "hỏi thuế + báo người dùng":**
```
trigger.zalo_inbound (filter: "hỏi thuế")
  → ack reply
  → action.web_research (vertical: tax, mode: quick)
  → condition ok
    true  → reply sources_text → reply answer_md
    false → reply "Không tìm thấy"
```

**Luồng "chiêm tinh hàng ngày" (cron 7h sáng):**
```
trigger.cron (0 7 * * *)
  → action.run_astro (query: "vận mệnh hôm nay", compose: true)
  → condition passages_count > 0
    true  → action.send_email (to: admin, body: {{astro.analysis}})
```

---

## 16. Tham khảo

- Source: `core/automation/`.
- Schema R-DCL: `core/diagnostics/changelog/core.automation.json`.
- Probe R-DDV: `core/diagnostics/includes/probes/class-probe-automation.php`.
- Roadmap BE: [AUTOMATION-1-BE-ROADMAP.md](AUTOMATION-1-BE-ROADMAP.md).
- Scheduler event_type contract: `core/diagnostics/changelog/core.scheduler.json` v3.4.0+.

_Last updated: 2026-06-19 — PHASE-ZALOBOT (57 templates, `action.web_research` vertical modes + `sources_text`, `action.run_astro` chiêm tinh 3-bước, `trigger.cf7_submit`, §15 kịch bản nghiên cứu & chiêm tinh qua Zalo Bot)._
