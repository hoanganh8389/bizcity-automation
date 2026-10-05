# AUTOMATION — Backend Roadmap (BE-1 → BE-7)

> **Status:** BE-1 → BE-7 (incl. BE-7.E realtime runner) **shipped** 2026-05-29/30. Performance fixes + channel-gateway DB gate shipped 2026-05-30.
> **UI dual-path (Phase 0.41):** tách mặt tiền admin builder (Zone 2) ↔ CRM-care recipe (Zone 1) — xem §2.1 + [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md).
> **User guide:** [AUTOMATION-USER-GUIDE.md](AUTOMATION-USER-GUIDE.md).
> **Scope:** Phần backend của visual workflow builder ở `core/automation/`.
> FE đã hoàn thiện S1 (xyflow đầy đủ subflow / resizer / shortcuts / auto-layout / undo-redo).
> Tài liệu này chốt **lộ trình port BE** từ legacy `plugins/bizcity-automation`
> (Laravel-style WAIC framework — sẽ bị **DEPRECATE**) sang kiến trúc native
> WordPress + REST + cron + agent runner thống nhất với phần còn lại của
> `bizcity-twin-ai`.
>
> **Nguyên tắc tối thượng:**
> 1. **KHÔNG** load lại WAIC framework. Chỉ port "logic cần dùng" — không port wrapper.
> 2. **Tuân thủ R-DCL** (Diagnostics Changelog) — mọi schema mới phải có JSON.
> 3. **Tuân thủ R-CRON-META** — cron handler phải `note_event()` evidence.
> 4. **Tuân thủ R-DDV** — mọi REST/SQL/hook mới phải có probe diagnostic PASS.
> 5. **Tuân thủ R-GW-8 (client standalone)** — không phụ thuộc plugin server.
> 6. **CRM-first** — mọi workflow chạy xong phải emit `crm_events` (rule tối thượng).

---

## 1) Mục tiêu BE

Cho phép FE builder (đã xong S1):
- **Persist** workflow (nodes + edges + meta) vào DB qua REST `POST /workflows`.
- **List / load / version** workflow (`GET /workflows`, `GET /workflows/:id`).
- **Trigger** workflow từ Zalo Bot inbound message, FB comment, cron, webhook, manual.
- **Execute** workflow theo DAG: chạy từng block với tool registry hiện có
  (`search_kg`, `compose_reply`, `reply_zalo`, `send_email`, `create_crm_event`,
  `http_request`, `db_write`, `log`, `condition`).
- **Stream** trạng thái run (SSE) về FE để hiển thị trên `RunTimeline`.
- **Audit** mọi run vào `bizcity_automation_runs` + `bizcity_automation_logs`.
- **CRM bridge** — kết quả run luôn ghi vào `bizcity_crm_events` (Scheduler thấy được).

---

## 2) Lộ trình 5 sprint

| Sprint | Tên | Output | Phụ thuộc |
|---|---|---|---|
| BE-1 ✅ | Schema + REST CRUD | bảng `bizcity_automation_workflows` + `*_runs` + `*_logs`; REST `bizcity-automation/v1/workflows` | R-DCL JSON |
| BE-2 ✅ | Block registry (PHP) + Tool bridge | `class-block-registry.php` mirror FE registry; 14 block built-in; bridge sang `core/tools/` đã có; REST `GET /blocks` cho FE catalog sync | BE-1 |
| BE-3 ✅ | Runner + DAG executor + SSE | `class-automation-runner.php` (Kahn topo, branch skip, CRM bridge) + `POST /workflows/:id/run` (sync default, `?defer=1` cho cron) + SSE `GET /runs/:id/events` + cron hook `bizcity_automation_cron_dispatch` (R-CRON-META) | BE-2 |
| BE-4 | Triggers (Zalo, FB, Cron, Webhook) | hook `bizcity_channel_inbound` → match workflow → enqueue run | BE-3 + Channel Gateway |
| BE-5 | CRM bridge + Diagnostics + Probes | mọi run end → `crm_events`; probe `class-probe-automation.php` + Site Diagnostic | tất cả trên |

---

## 2.1) Nhánh CRM-care (UI dual-path) — Phase 0.41

> **Bối cảnh:** BE-1→BE-7 đã ship đủ runner/blocks/REST. Việc còn lại là **tách mặt tiền UI**
> thành 2 path trên cùng backend này: (A) nhánh ADMIN builder canvas (Zone 2, hiện hữu) và
> (B) nhánh **CRM-care** recipe (Zone 1, mới). Đặc tả đầy đủ + R-ZONE-5/6 + DDV:
> [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md).
>
> Sprint đặt tên `CRM-PATH-*` để KHÔNG gãy đánh số `BE-*`. Backend tái sử dụng 100%
> (`BizCity_Automation_Runner`, block registry, REST `bizcity-automation/v1`, bảng cũ).

| Sprint | Tên | Output | Phụ thuộc |
|---|---|---|---|
| CRM-PATH-1 | Zone flag + scoped REST | `trigger_config_json.zone` (`admin\|crm`); `GET /workflows?zone=crm` + cap `bizcity_crm_manage` | BE-1..BE-7 |
| CRM-PATH-2 | Care recipe seeder | bump `SEED_VERSION`; 3 template category `cskh/care`; `is_template=1` | CRM-PATH-1 |
| CRM-PATH-3 | CRM-care FE surface | tab "Tự động hoá CSKH" trong CRM SPA: recipe gallery + bind + toggle + run history (read-only, KHÔNG canvas) | CRM-PATH-2 |
| CRM-PATH-4 | Port kênh Zalo (Zone 1) | bind recipe `zalo_oa`/`zalo_personal` (R-ZONE-2 discriminator); `run.source='crm_care'` | CRM-PATH-3 + [0.39](../../channel-gateway/docs/PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md) |
| CRM-PATH-5 | Trigger Facebook Messenger | thêm `trigger.fb_messenger` (Zone 1) vào recipe — Zalo trước, FB sau | CRM-PATH-4 + FB adapter |



## 3) BE-1 — Schema + REST CRUD

### 3.1 Bảng mới

#### `bizcity_automation_workflows`
| Column | Type | Note |
|---|---|---|
| `id` | BIGINT PK | |
| `slug` | VARCHAR(64) UNIQUE | human id e.g. `wf_zalo_qa_v1` |
| `name` | VARCHAR(200) | |
| `desc` | TEXT NULL | |
| `enabled` | TINYINT(1) DEFAULT 1 | |
| `version` | INT DEFAULT 1 | bump on each save |
| `graph_json` | LONGTEXT | `{nodes, edges, meta}` (FE schema) |
| `trigger_type` | VARCHAR(32) | `zalo_inbound` / `fb_comment` / `cron` / `webhook` / `manual` |
| `trigger_config_json` | TEXT NULL | filter / page_id / cron expr |
| `tags` | VARCHAR(255) DEFAULT '' | comma-separated |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |
| `created_by` | BIGINT | wp user id |
| INDEX | `(enabled, trigger_type)` | |

#### `bizcity_automation_runs`
| Column | Type | Note |
|---|---|---|
| `id` | BIGINT PK | |
| `workflow_id` | BIGINT FK | |
| `run_id` | VARCHAR(32) | nanoid for FE matching |
| `status` | TINYINT | 0=queued · 1=running · 2=ok · 3=fail · 4=cancelled |
| `trigger_payload_json` | LONGTEXT NULL | inbound message payload |
| `result_json` | LONGTEXT NULL | final ctx |
| `error` | VARCHAR(500) DEFAULT '' | |
| `started_at` | DATETIME NULL | |
| `ended_at` | DATETIME NULL | |
| `tokens_used` | INT DEFAULT 0 | |
| `crm_event_id` | BIGINT DEFAULT 0 | back-link |
| INDEX | `(workflow_id, status)`, `(run_id)` | |

#### `bizcity_automation_logs`
| Column | Type | Note |
|---|---|---|
| `id` | BIGINT PK | |
| `run_id` | VARCHAR(32) INDEX | match `runs.run_id` |
| `node_id` | VARCHAR(64) | FE node id (`n_xxx`) |
| `block_id` | VARCHAR(64) | `action.search_kg` … |
| `step` | INT | DAG topo order |
| `status` | TINYINT | 0=running · 1=ok · 2=fail · 3=skip |
| `input_json` | LONGTEXT NULL | merged ctx for this step |
| `output_json` | LONGTEXT NULL | block result |
| `error` | VARCHAR(500) DEFAULT '' | |
| `started_at` | DATETIME | |
| `ended_at` | DATETIME NULL | |

### 3.2 Diagnostics Changelog (R-DCL)
Phải tạo `core/diagnostics/changelog/core.automation.json` v1.0.0 với:
- `current_version: "1.0.0"`
- `tables: [workflows, runs, logs]` đầy đủ column với `since: "1.0.0"`
- `history[]` row "Initial schema for native automation runner"
- Chạy `php core/diagnostics/validate-schema-changelog.php` phải exit 0.

### 3.3 REST routes (NS `bizcity-automation/v1`)
```
GET    /workflows                  → list (filter by enabled, trigger_type, tag)
POST   /workflows                  → create (validate graph_json)
GET    /workflows/:id              → load (graph_json + history meta)
PUT    /workflows/:id              → update (bump version)
DELETE /workflows/:id              → soft delete (enabled=0)
POST   /workflows/:id/duplicate    → clone
POST   /workflows/:id/run          → enqueue manual run → 202 { run_id }
GET    /runs/:run_id               → status + logs[]
GET    /runs/:run_id/events        → SSE stream (real-time logs)
GET    /runs?workflow_id=…&limit=… → history list
POST   /runs/:run_id/cancel        → set status=4, signal worker
```
Permission: `manage_options` (admin only).
Validation: `graph_json` phải có `nodes[]` + `edges[]`, mỗi edge `source/target`
phải tồn tại, có ≥ 1 trigger node.

---

## 4) BE-2 — Block registry (PHP) + Tool bridge

Mirror FE `blocks/registry.js` vào `core/automation/includes/blocks/`:
```
core/automation/includes/blocks/
  ├── class-block-registry.php       (singleton, register/resolve)
  ├── interface-block.php            ({id, kind, execute($ctx, $data): array})
  ├── triggers/
  │     ├── class-trigger-zalo.php
  │     ├── class-trigger-fb-comment.php
  │     ├── class-trigger-cron.php
  │     └── class-trigger-webhook.php
  ├── actions/
  │     ├── class-action-search-kg.php       → delegate core/knowledge
  │     ├── class-action-reply-zalo.php      → delegate Channel Gateway sender
  │     ├── class-action-send-email.php      → delegate core/smtp
  │     ├── class-action-http.php
  │     ├── class-action-db-write.php
  │     ├── class-action-log.php
  │     └── class-action-create-crm-event.php
  ├── llm/
  │     └── class-llm-compose.php            → delegate core/bizcity-llm/LLM_Client
  ├── logic/
  │     └── class-logic-condition.php
  └── filter hook: bizcity_automation_register_blocks
```

**Quy tắc:** mỗi block KHÔNG implement HTTP/LLM/DB trực tiếp. Phải `delegate`
sang module core đã có (`BizCity_LLM_Client`, `BizCity_Knowledge`,
`BizCity_Gateway_Sender`, …). Workflow runner chỉ làm "orchestration".

---

## 5) BE-3 — Runner + DAG executor + SSE

### 5.1 `class-workflow-runner.php`
```php
$runner = BizCity_Automation_Runner::instance();
$run_id = $runner->enqueue( $workflow_id, $trigger_payload );  // returns run_id
// chạy ngay (sync) hoặc cron-deferred:
$runner->execute( $run_id );
```

Algorithm:
1. Load workflow → topo-sort nodes theo edges (Kahn).
2. Khởi tạo `$ctx = [ 'trigger' => $payload, 'meta' => $wf->meta ]`.
3. Lặp từng node theo topo order:
   - Resolve block từ registry (`$block = $registry->get($blockId)`).
   - Merge inputs từ predecessors (`$ctx[$predNodeId] = $output`).
   - Resolve template: `{{trigger.text}}` / `{{kg.snippet}}` (đơn giản, regex).
   - `try { $output = $block->execute( $ctx, $data ); }` ghi log row.
   - Nếu là `condition` block → chọn branch và đánh dấu các node không reach là `skip`.
4. End run: ghi `runs.status = 2` (ok) / 3 (fail), `result_json`, emit `crm_events`.

### 5.2 SSE `/runs/:run_id/events`
- Long-running PHP request (header `Content-Type: text/event-stream`).
- Poll `automation_logs WHERE run_id = ? AND id > last_id` mỗi 500ms.
- Emit `data: {"node_id":"n_xxx","status":"ok","output":{…}}\n\n`.
- Đóng khi `runs.status >= 2`.
- FE: `EventSource` thay cho mock `runner.js` hiện tại.

### 5.3 Cron-deferred mode
Đăng ký qua `BizCity_Cron_Manager::register('bizcity_automation_dispatch')`,
chạy mỗi phút, pull `runs WHERE status=0` → execute. **R-CRON-META** bắt buộc:
- `note([ 'workflow_id' => $wid, 'counters' => [ 'runs_picked' => 1 ] ])`
- `note_event('automation_run_failed', [ 'workflow_id', 'run_id', 'reason' ])`
  với reason buckets: `block_timeout`, `block_http_error`, `template_invalid`,
  `validation_failed`, `*_error`.

---

## 6) BE-4 — Triggers (Scheduler · Zalo · FB · Cron · Webhook) ✅ SHIPPED 2026-05-29

> Trung tâm: `core/automation/includes/class-automation-trigger-matcher.php`
> (`BizCity_Automation_Trigger_Matcher::init()` đăng ký 3 hook + bootstrap thêm 1 REST route public).

### 6.0 Scheduler integration (TỐI THƯỢNG cho UI flow)

**Không tạo UI riêng cho việc lên lịch automation.** User dùng trang
Scheduler đã có sẵn (`wp-admin/admin.php?page=bizcity-scheduler`) để
tạo một event với `event_type='automation_workflow'`.

#### Recipe — lên lịch một workflow từ trang Scheduler

1. Mở `wp-admin/admin.php?page=bizcity-scheduler` → **New Event**.
2. Điền:
   - `title`: tự do, ví dụ `Run workflow Daily Reminder`.
   - `start_at`: thời điểm muốn workflow chạy.
   - `event_type`: `automation_workflow` *(field này hiện chưa có dropdown UI;
     trong M1 có thể nhập tay qua REST `POST bizcity-scheduler/v1/events`
     hoặc trường advanced; FE picker sẽ thêm trong slice tiếp theo)*.
   - `metadata` (JSON):
     ```json
     {
       "workflow_id": 42,
       "payload": { "anything": "free-form, merged into ctx.trigger" }
     }
     ```
   - `status`: `active`.
3. Cron scheduler tick (mỗi phút) → khi tới `start_at - reminder_min`,
   `do_action( 'bizcity_scheduler_reminder_fire', $event )`.
4. `BizCity_Automation_Trigger_Matcher::on_scheduler_fire()` (priority **45**,
   chạy sau fb_post@10 / web_post@25 / reminder_zalo@30 / woo_*@35-40 /
   lead_report@38) sẽ:
   - Guard `event_type === 'automation_workflow'` + `status === 'active'`.
   - Đọc `metadata.workflow_id` + `metadata.payload`.
   - `BizCity_Automation_Repo_Runs::enqueue()` → `BizCity_Automation_Runner::execute()`
     (sync vì đang trong cron context).
5. BE-3 CRM bridge tự emit row kết quả `event_type='automation_run'` vào
   `bizcity_crm_events` (status 1=OK / 3=FAIL).

#### R-CRON-META compliance
Matcher KHÔNG note counters (runner đã làm ở BE-3), chỉ note **failure events**
khi validation fail:
- `automation_scheduler_invalid_metadata` — `reason: invalid_metadata`.
- `automation_scheduler_workflow_missing` — `reason: workflow_missing`.
- `automation_enqueue_failed` — `reason: enqueue_failed`.

### 6.1 Channel inbound (Zalo + FB)
Hook canonical (chuẩn Channel Gateway):
```php
add_action( 'bizcity_channel_message_received',
    [ $matcher, 'on_channel_message' ], 30, 1 );
```
Mapping `payload.platform` → `trigger_type`:
- `ZALO_BOT*` → `zalo_inbound`.
- `FACEBOOK*` → `fb_comment`.
- khác → filter `bizcity_automation_map_trigger_type` (string, $platform, $payload).

Per-workflow filter trong `trigger_config_json`:
- `filter` (string) — substring match (case-insensitive) trên `payload.message`.
- `page_id` (FB only) — chỉ match khi `payload.raw.entry[0].id === page_id`.

Echo của assistant (`channel_role === 'ASSISTANT'`) bị bỏ qua để tránh loop.

### 6.2 Cron scan
Piggy-back lên runner cron tick (`BizCity_Automation_Runner::CRON_HOOK`
mỗi phút). Matcher `on_cron_scan()` lấy tất cả workflow `trigger_type='cron'`,
parse `trigger_config_json.schedule`:

| Expression                  | Ngữ nghĩa                          |
| --------------------------- | ---------------------------------- |
| `every:N:minutes`           | Mỗi N phút                         |
| `*/N * * * *`               | Mỗi N phút (cron-syntax shorthand) |
| `0 H * * *`                 | Hằng ngày tại giờ H (site TZ)      |
| (khác)                      | Fallback: mỗi 24h                  |

Bookkeeping `last_fired_at` qua option `bizcity_automation_cron_last_fired_<wf_id>`
(không cần thêm column).

### 6.3 Webhook (public)
REST route public, không cần `manage_options`:
```
POST /wp-json/bizcity-automation/v1/webhook/{slug}
Header: X-Bizcity-Webhook-Token: <secret>     (hoặc ?token=)
Body:   any JSON
```
Slug + secret cấu hình trong `trigger_config_json`:
```json
{ "slug": "lead-from-zapier", "secret": "biz-wh-xxxxxx" }
```
Validation:
- Regex slug `^[a-zA-Z0-9_-]{2,64}$`.
- Rate limit 30 req/min/slug qua transient.
- **Secret BẮT BUỘC** — workflow không cấu hình `secret` → matcher trả `503 webhook_secret_missing` (chặn open endpoint).
- `hash_equals()` so sánh secret (constant-time, tránh timing attack).
- Trả `202 Accepted` + `{ ok, run_id, mode:'deferred' }` — runner pick lên ở cron tick kế tiếp.

OWASP-friendly: secret bắt buộc, rate-limit, không log payload, không reflect
input qua error message.

---

## 7) BE-5 — CRM bridge + Diagnostics + Probes

### 7.1 CRM bridge (rule tối thượng)
Sau khi run kết thúc (ok hoặc fail), runner BẮT BUỘC emit 1 row vào
`bizcity_crm_events`:
```php
do_action( 'bizcity_crm_event_create', [
    'event_type'  => 'automation_run',
    'title'       => sprintf( '[%s] %s', $wf->name, $status ),
    'body'        => $summary,
    'related_id'  => $run_id,
    'workflow_id' => $wf->id,
    'status'      => $run->status,
    'due_at'      => null,
] );
```
Lưu `crm_event_id` ngược về `runs.crm_event_id`. Scheduler page sẽ list được
ngay không cần thay đổi UI.

### 7.2 Probes (R-DDV)
Tạo `core/diagnostics/includes/probes/class-probe-automation.php`:

| Step | Disk | Loader | Runtime |
|---|---|---|---|
| `schema_workflows_exists` | file `class-block-registry.php` | constant `BIZCITY_AUTOMATION_LOADED` | `WaicDb::exist('@__automation_workflows')` thay bằng `$wpdb->get_var(SHOW TABLES…)` |
| `rest_workflows_route` | route file | `rest_get_server()->get_routes()` chứa `/bizcity-automation/v1/workflows` | curl 401 không nonce, 200 có nonce |
| `runner_dispatch_cron` | bootstrap.php | `wp_get_schedules()['bizcity_automation_dispatch']` | `BizCity_Cron_Manager::has_runs_meta('bizcity_automation_dispatch')` |
| `crm_bridge_emit` | hook file | `has_action('bizcity_crm_event_create', …)` | dry-run runner → 1 row vào `crm_events` |
| `zalo_trigger_match` | matcher file | `has_action('bizcity_channel_inbound', BizCity_Automation_Trigger_Matcher::class)` | simulate inbound → row in `runs` queued |

Mỗi probe phải PASS trước khi sprint coi DONE.

### 7.3 Site Diagnostic page
Thêm 1 module card "Automation" vào trang Tools → BizCity Diagnostics
liệt kê 5 probes trên + button "Run all" + button "Repair tables"
(idempotent ADD-only như đang dùng).

---

## 8) Deprecation plan cho `plugins/bizcity-automation`

> Plugin cũ chạy WAIC framework (Laravel-style) gây fatal trên một số host
> (event `flowruns` viết bằng `WaicDb::exist('@__flowruns')` etc.). KHÔNG load.

| Bước | Hành động | Owner |
|---|---|---|
| 1 | Deactivate plugin trên server (admin → Plugins → Deactivate). | DevOps |
| 2 | Xoá `plugins/bizcity-automation/` khỏi git (folder đã gitignored). | Repo cleanup |
| 3 | Xoá file `bizcity-twin-ai/plugins/bizcity-automation` directory copy. | Repo cleanup |
| 4 | Sau BE-1 → BE-3 xong, viết **migration script** `bin/migrate-waic-workflows-to-native.php` đọc bảng `wp_bizcity_workflows` cũ → convert sang `bizcity_automation_workflows` mới (best-effort mapping). | BE-5 |
| 5 | Sau khi migrate xong, drop bảng cũ qua probe repair. | Diagnostics |
| 6 | Cập nhật `PHASE-0-CANON.md` ghi "WAIC framework deprecated 2026-05-29". | Docs |

---

## 9) Bundle / dependency policy

- **KHÔNG** thêm Composer dep mới (không Cron parser, không Laravel collection…).
- Cron expression: cài `dragonmantank/cron-expression` **chỉ khi** cần expr
  phức tạp. Sprint BE-4.3 đầu tiên dùng "every N minutes" fallback.
- DAG topo sort: viết tay (Kahn) ~30 lines, không cần lib.
- SSE: native PHP (`flush()` + `@ob_flush()`), không cần Ratchet.

---

## 10) Definition of Done (BE-1 → BE-5)

- [ ] R-DCL: `core.automation.json` v1.0.0, validator exit 0.
- [ ] R-DDV: 5 probes PASS trong Site Diagnostic.
- [ ] R-CRON-META: `cron_runs.meta` cho `bizcity_automation_dispatch` có
      `counters` + `*_failed` events bucketed.
- [ ] R-GW-8: REST routes dùng NS `bizcity-automation/v1`, không phụ thuộc
      `bizcity-llm-router`.
- [ ] R-NS: KHÔNG dùng `bizcity/v1` (xung đột LLM Router) và KHÔNG
      `bizcity-channel/v1` (xung đột Channel Gateway).
- [ ] CRM: mọi run emit 1 row vào `crm_events` thấy được trong Scheduler.
- [ ] FE `RunTimeline` switch từ mock runner sang `EventSource(/runs/:id/events)`.
- [ ] Zalo Bot inbound → workflow `wf_zalo_qa_v1` chạy end-to-end → `reply_zalo`
      action gửi tin nhắn ra ngoài qua Channel Gateway sender.

---

## 11) Out of scope (S3+)

- Workflow versioning UI (diff giữa version cũ/mới).
- Marketplace template share.
- AI chat → tạo workflow (Pillar 2 intent provider). _Sẽ thiết kế riêng ở
  `AUTOMATION-1-AI-AUTHORING.md`._
- Parallel branch execution (Action Scheduler integration).
- Sub-workflow call (workflow A invokes workflow B).
- Permission-per-workflow (chỉ user/role X được trigger).

---

## 12 · CHANGELOG

| Date       | Version | Author        | Change |
|------------|---------|---------------|--------|
| 2026-05-29 | v0.1    | Twin AI Core  | Initial draft (BE-1..BE-5 design). |
| 2026-05-29 | v0.2    | Twin AI Core  | **BE-1 shipped** — R-DCL `core.automation.json` v1.0.0 (3 tables) · `BizCity_Automation_{Installer, Repo_Workflows, Repo_Runs, REST}` · 10 routes under `bizcity-automation/v1` · R-DDV probe `core.automation` (disk+loader+runtime+round-trip). |
| 2026-05-29 | v0.3    | Twin AI Core  | **BE-2 shipped** — block registry PHP mirror FE: `interface-block.php` + `abstract-block.php` + `class-block-registry.php` + 14 built-in blocks (5 triggers / 7 actions / 1 LLM / 1 logic). Filter `bizcity_automation_register_blocks`. REST `GET /blocks` cho FE catalog sync. Probe mở rộng coverage: 9 disk files / 8 classes / 3 routes / 14 block IDs / `logic.condition` smoke. CANON v1.8 cập nhật cross-walk §4 + trigger map §5.1 (row "Automation block / workflow runner"). |
| 2026-05-29 | v0.4    | Twin AI Core  | **BE-3 shipped** — `BizCity_Automation_Runner` (Kahn topo + per-node executor + branch skip cho `logic.condition` + CRM bridge `bizcity_crm_event_create`). REST `POST /workflows/:id/run` sync mặc định (`?defer=1` cho cron mode). REST SSE `GET /runs/:id/events` tick 500ms / max 30s. Cron hook `bizcity_automation_cron_dispatch` đăng ký qua `BizCity_Cron_Manager` interval `bizcity_automation_minute` — R-CRON-META compliant (`counters` + `note_event('automation_run_failed', reason_bucket)`). `BizCity_Automation_Repo_Runs::append_log_update()` helper mới. Probe extend: +file runner, +class runner, +SSE route, +step "Runner execute". CANON v1.9. |
| 2026-05-29 | v0.5    | Twin AI Core  | **BE-4 shipped** — `BizCity_Automation_Trigger_Matcher` (3 hook: scheduler@45, channel inbound@30, cron-scan@5 piggy-back runner cron). **Scheduler integration**: register `event_type='automation_workflow'` (R-DCL core.scheduler v3.4.0) → metadata `{workflow_id, payload}` → matcher dispatch sync. Channel inbound: map `payload.platform` → `trigger_type` + filter substring + FB page_id guard, skip ASSISTANT echo. Cron scan: parse `every:N:minutes` / `*/N * * * *` / `0 H * * *` shorthand, last_fired bookkeeping qua option. Webhook public REST `POST /webhook/{slug}` — rate-limit 30/min/slug, `X-Bizcity-Webhook-Token` hash_equals, 202 deferred. R-DCL core.automation v1.0.1 contract docs (`trigger_config_json` keys schedule/filter/page_id/slug/secret). Probe extend: +disk matcher / +class matcher / +webhook route / +3 hook attached check / +scheduler bridge smoke (synth event dispatch → run row exists). |
| 2026-05-29 | v0.6    | Twin AI Core  | **BE-5 shipped** — (1) Runner CRM bridge bổ sung capture `crm_event_id` qua `apply_filters('bizcity_crm_event_create_filter')` rồi UPDATE ngược `runs.crm_event_id` để Scheduler page có thể pivot bidirectional. (2) Bootstrap thêm admin_notice cảnh báo khi legacy plugin `bizcity-automation/bizcity-automation.php` (WAIC framework) còn active đồng thời với native runtime — chống dual hook collision trên `bizcity_channel_message_received`. (3) **User guide `AUTOMATION-USER-GUIDE.md`** ship cho admin/staff: 12 chương (concept · 5-trigger reference · 14 block reference · template `{{}}` · run/monitor · security · troubleshooting · REST cheat-sheet · dev extension · roadmap). Probe `core.automation` không đổi (đã coverage BE-5 paths qua BE-3 round-trip + BE-4 scheduler bridge smoke). |

_End of roadmap v0.6 — bump version khi sprint complete._

| 2026-05-29 | v0.7    | Twin AI Core  | **BE-6 shipped** — 5-module sprint lấp khe giữa Channel Gateway + TwinBrain. (A) **Instance picker** matcher lọc theo `trigger_config.instance_id` (oa_id Zalo / page_id FB / bot Telegram); empty = match all. New REST `GET /channel-registry` proxy `BizCity_Integration_Registry::get_all()`. (B) **Test listener** port legacy `waic_workflow_listen_trigger` admin-ajax sang REST `POST /test/listen` + `GET /test/poll` + `POST /test/stop` (transient `bizcity_automation_listener_<lid>` TTL 30..900s, capture-first priority 1 trên `bizcity_channel_message_received`/`bizcity_automation_webhook_received`/`bizcity_twinbrain_intent`, hard cap 10 active listeners LRU evict). (C) **Cron health** option `bizcity_automation_cron_last_tick` stamp mỗi tick + REST `GET /cron-health` ({status: healthy<5′ / degraded<30′ / dead, last_tick, next_run, disable_wp_cron}) + admin_notice khi dead >30 phút. (D) **Messenger trigger split** matcher derive `event_subtype` từ `payload.raw.entry[0]` (messaging vs changes), route `FACEBOOK` về `trigger.fb_message` (DM) hoặc `trigger.fb_comment` (feed comment); mới thêm `trigger.telegram_inbound`. (E) **MPR Thinking action** `llm.mpr_think` gọi `BizCity_TwinBrain_Runtime::start_turn()` qua `BizCity_Automation_TwinBrain_Bridge::run_with_capture()` — subscribe `bizcity_twin_event` action priority 1, stream mỗi 9-layer event vào `bizcity_automation_logs` với `block_id='llm.mpr_think.event'` cho FE timeline; bridge cũng route `bizcity_twinbrain_intent` action sang `trigger.twinbrain_intent`. R-DCL `core.automation.json` bump 1.0.2 (contract docs only — no DDL). Probe extend: instance-filter smoke (wrong inst không enqueue) + listener round-trip (fire → poll captured) + cron scheduled → tổng 18 expected blocks, 10 expected routes, 6 expected classes mới. |
| 2026-05-29 | v0.8    | Twin AI Core  | **BE-7 shipped — Workflow Templates library.** New table `bizcity_automation_templates` (R-DCL `core.automation.json` v1.1.0 — schema cols: slug uniq / name / description / category {general,cskh,lead,report,webhook,mpr} / source {builtin,user,imported} / trigger_type / graph_json / trigger_config_json / tags / icon / version / is_active / use_count + audit). Installer bumped to 1.1.0 + new option `bizcity_automation_templates_seed_version`. New classes `BizCity_Automation_Repo_Templates` (query/upsert/instantiate/save_from_workflow/bump_use_count) + `BizCity_Automation_Templates_Seeder` (5 idempotent built-in blueprints: `tpl_zalo_cskh_v1`, `tpl_fb_lead_capture_v1`, `tpl_mpr_auto_reply_v1`, `tpl_cron_daily_report_v1`, `tpl_webhook_crm_v1`). New REST routes (admin-only): `GET /templates` (filter category/source/search/is_active + returns categories + sources enum) · `GET /templates/(?P<id>\d+)` · `POST /templates/(?P<id>\d+)/instantiate` (clones → workflows, bumps use_count, returns workflow row + `_template_id`/`_template_slug`) · `POST /workflows/(?P<id>\d+)/save-as-template` (user → templates, slug auto `usr_…`) · `POST /templates/reseed` (force re-seed builtins). Seeder mounted on `admin_init` priority 6 (post-installer). Probe extend: +2 disk files, +2 classes, +5 REST routes, +`bizcity_automation_templates` expected table, runtime smoke "builtin templates seeded (count ≥ blueprints)" + "instantiate first builtin → workflow row" (cleanup hard_delete). |

_End of roadmap v0.8._

| 2026-05-30 | v0.9    | Twin AI Core  | **BE-7.E shipped — Realtime "Chạy thử" runner + per-node badges.** (1) `core/automation/frontend/src/runtime/runner.js` rewritten: real REST `POST /workflows/:id/run?async=1` → `{run_id}` → `EventSource /runs/:id/events` SSE stream; fallback mock khi workflow `wf_new` hoặc REST fail. (2) `builderStore.js` mở rộng: `nodeStatus: {}`, `nodeOutputs: {}`, `runDbId`, `runMode`, `runStatus`, `runError`, `setNodeStatus(nodeId, status, output)` action; `startRun()` reset nodeStatus/nodeOutputs; `endRun({status, error})`. (3) `NodeShell.jsx`: badge 22px circle top-right — ⏳ amber (running=0) / ✓ green (ok=1) / ✗ red (fail=2) / ⊖ gray (skip=3); border/ring color theo status; tooltip output khi hover. (4) `bootstrap.php` add `add_action('bizcity_automation_run_async', ...)` async dispatcher. (5) REST `run_workflow()` thêm `?async=1` mode: `wp_schedule_single_event` + `spawn_cron` + return 202 immediately. (6) Seeder bump **1.5.0** — thêm 2 test template: `tpl_test_smoke_manual_v1` (trigger.manual → llm.compose_reply → action.create_crm_event, category='test') + `tpl_test_smoke_branch_v1` (trigger.manual → logic.condition → 2 branches skip-verify, category='test') → 14 blueprints total. R-DCL `core.automation.json` bump **1.5.0** (seeder version). Bundle build 449.65 kB, lint clean. |
| 2026-05-30 | v0.10   | Twin AI Core  | **Bug fixes + Performance + Channel Gateway DB gate.** (A) **Admin menu bug** (`bootstrap.php` line 77): `// BE-6.E` comment ăn mất `BizCity_Automation_Admin_SPA::instance();` trên cùng dòng → menu không hiện. Fixed: tách thành 2 dòng riêng. (B) **Installer version-check** (`class-automation-installer.php`): `ensure()` gọi `all_tables_present()` (SHOW TABLES) trên mỗi `admin_init` → thêm `static $installed = false` + `get_option(DB_VERSION_OPTION)` early-return; steady state 0 SHOW TABLES query. (C) **`bizcity_provisioner_log` cập nhật liên tục** (`class-site-provisioner.php`): `write_log()` gọi vô điều kiện dù 100% installer `skipped` → thêm guard: chỉ gọi khi có ít nhất 1 `action !== 'skipped'/'noop'` hoặc `$force = true`. (D) **`wp_global_inbox_admin` DDL lặp** (`class-blog-resolver.php`): `maybe_install_inbox()` không có version gate → `dbDelta()` mỗi 5 phút. Fixed: thêm `INBOX_DB_VERSION = '1.0.0'` + `INBOX_DB_VERSION_OPT = 'bizcity_blog_resolver_inbox_db_version'` + early-return khi option match + `update_option` sau `dbDelta`. Tạo `core/diagnostics/changelog/core.channel-gateway.json` v1.0.0 (R-DCL). Cập nhật `installer-registry.php` thêm `version_opt`/`expected_ver` cho entry `blog_resolver_inbox`. |

_End of roadmap v0.10._

| 2026-06-02 | v0.11   | Twin AI Core  | **Scheduler UI fix + R-FINAL-ACTION + SEED W1 + GURU W1.** (A) **Bug fix scheduler UI empty** — Runner inject `_owner_user_id` từ `workflow.created_by`; `action.publish_fb_post` pass `user_id` xuống CRM_Bridge → events ##72/73 hiện đúng calendar (root cause: cron context `get_current_user_id()=0`). (B) **R-FINAL-ACTION shipped** — `core/automation/docs/PHASE-R-FINAL-ACTION.md` (Tier tối thượng quad-commit: scheduler row + notify + edit link + ack callback). (C) **SEED W1 shipped** — `class-automation-templates-seeder.php` SEED_VERSION 1.7.0 + 2 new blueprints: `tpl_knowledge_router_v1` (@hỏi → mpr_think → reply_zalo + audit) và `tpl_remember_this_v1` (@nhớ → LLM extract → task event kind=memory_note). (D) **GURU W1 shipped** — `trigger.config.guru_id` cross-cut filter trong matcher (outer loop + `channel_filter_match()`) + 4 trigger blocks (zalo, fb_comment, fb_message, telegram) thêm field `guru_id`; FE registry mirror + rebuild bundle 583.59 kB. Docs: [PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md](PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md). |
| 2026-06-03 | v0.12   | Twin AI Core  | **DESIGN — PHASE-WORKFLOW-AS-SKILL + GURU W2 + GURU W3 + SKILL W1.** Tài liệu hóa bidirectional Skill MD ↔ Workflow JSON converter (lossless round-trip rule R-SK-1..R-SK-10), trigger type `guru_mention` (auto-detect `@<guru_slug>` + auto persona overlay) và `slash_command` (DCL table `bizcity_automation_slash_commands` v1.0.0 với `UNIQUE(command_slug, scope_guru_id)`). Action mới `action.persona_overlay` load `character.system_prompt` vào `ctx._persona`. Tuyên ngôn: **workflow = chain of skills · guru = persona context layer**. Roadmap §13 mới (GURU W2-W3 + SKILL W1-W7). Spec đầy đủ: [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md). Implementation gated on user approval. |

---

## 13 · BE-8+ — Guru Mention · Slash Command · Skill Template (DESIGN, v0.12)

> **⚠️ REVISION 2026-06-03 (v0.13)** — sau khi audit `core/skills/` (bảng `wp_bizcity_skills` v1.4.1 + parser + REST `bizcity/skill/v1` đã ship), bảng sprint dưới đây đã ĐƯỢC SUPERSEDE. Sprint plan thực thi xem **[PHASE-WORKFLOW-AS-SKILL.md §11](PHASE-WORKFLOW-AS-SKILL.md#11-sprint-plan-revised-v11--reuse-coreskills)**. Không tạo bảng `bizcity_automation_slash_commands`, không tạo `action.persona_overlay` block, không tạo `BizCity_Automation_Skill_Converter` riu0ea3i. Reuse `core/skills/` + extend 3 cột DB.

> **Tổng spec:** [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) — đọc trước khi code.

| Sprint | Item | File chính | Status |
|---|---|---|---|
| GURU W1 | `trigger_config.guru_id` cross-cut filter | `class-automation-trigger-matcher.php` + 4 trigger blocks | ✅ 2026-06-02 |
| GURU W2 | Trigger `guru_mention` + slug extractor + auto persona overlay | `class-trigger-guru-mention.php` · runner patch | ⬜ DESIGN |
| GURU W3.1 | DCL `bizcity_automation_slash_commands` v1.0.0 + registry class | DCL JSON · `class-automation-slash-registry.php` | ⬜ DESIGN |
| GURU W3.2 | Trigger `slash_command` + matcher early-route + `/help` REST | `class-trigger-slash-command.php` · REST CRUD | ⬜ DESIGN |
| SKILL W1 | Action `action.persona_overlay` (load `character.system_prompt` → `ctx._persona`) | `class-action-persona-overlay.php` | ⬜ DESIGN |
| SKILL W2 | Skill MD ↔ JSON converter PHP (`BizCity_Automation_Skill_Converter`) | `class-skill-converter.php` | ⬜ DESIGN |
| SKILL W3 | CLI `wp bizcity automation skill import/export <slug>` | `class-skill-cli.php` | ⬜ DESIGN |
| SKILL W4 | Round-trip test suite (md→json→md === md) + lint command | `tests/test-skill-converter.php` | ⬜ DESIGN |
| SKILL W5 | Migrate seed templates → `core/automation/skills/*.skill.md` (3 SEED W1 + 6 vertical) | `core/automation/skills/*` | ⬜ DESIGN |
| SKILL W6 | Builder UI: "Import / Export .skill.md" buttons | SPA workflow panel | ⬜ DESIGN |
| SKILL W7 | Community gallery — GitHub raw fetch (read-only PoC) | REST proxy → GitHub raw | ⬜ DESIGN |

**DoD chung cho mỗi sprint:**
1. Code stamp `[YYYY-MM-DD Johnny Chu] <Phase-ID>` ở mọi điểm thay đổi.
2. R-DCL JSON bumped + validator exit 0 (W3.1).
3. Probe `core.automation` extend coverage cho mỗi block/REST mới.
4. Round-trip test (W4) pass cho mọi seed.
5. CANON changelog row mới + cross-link.

