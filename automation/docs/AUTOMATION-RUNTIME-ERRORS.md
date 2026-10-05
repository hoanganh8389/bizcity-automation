# AUTOMATION RUNTIME ERRORS — Catalog & Health Tracker Contract

> **Module:** `core/automation/`
> **Rule canonical:** [PHASE-0-RULE-ERROR-UX.md](../../../docs/rules/PHASE-0-RULE-ERROR-UX.md)
> **Error-UX Spec:** [core/helper/docs/ERROR-UX-SPEC.md](../../helper/docs/ERROR-UX-SPEC.md)
> **Health probe:** `core/diagnostics/includes/probes/class-probe-automation-runtime.php`
> **Phiên bản:** v1.0 · 2026-06-08 · **Owner:** Twin AI Core
>
> Tài liệu này là **nguồn dữ liệu duy nhất** cho mọi error code phát sinh
> khi automation workflow vận hành thực tế (runtime). Mọi code thêm mới
> PHẢI được cập nhật tại đây TRƯỚC khi commit code.

---

## 0 · Kiến trúc lỗi runtime

```
inbound trigger
    │
    ▼
BizCity_Automation_Trigger_Matcher ──── [SURFACE A] Matcher errors
    │  enqueue run
    ▼
bizcity_automation_runs (status=queued)
    │
    ├── inline execute (REST /run)
    │       │
    ▼       ▼
BizCity_Automation_Runner ──────────── [SURFACE B] Runner errors
    │  foreach block
    ▼
BizCity_Automation_Block (execute()) ── [SURFACE C] Block errors
    │
    ├── WP_Error → Runner.finish_failed()
    │               │
    │               ├── bizcity_automation_runs.status = FAIL
    │               ├── bizcity_automation_logs.status = FAIL
    │               └── BizCity_Cron_Manager.note_event('automation_run_failed')
    │
    └── cron pickup (bizcity_automation_cron_dispatch)
                │
                ▼
        BizCity_Automation_Runner.on_cron_dispatch() ─ [SURFACE D] Cron errors
                │
                └── CRM Bridge emit ─────────────────── [SURFACE E] Bridge errors
```

Các lỗi bị **capture** vào:
- `bizcity_automation_runs.error` (message cuối run)
- `bizcity_automation_runs.result_json` (reason bucket)
- `bizcity_automation_logs.error` (message per block step)
- `bizcity_cron_runs.meta → events[].name = automation_run_failed` (cron context)

**Health probe** `core.automation.runtime_errors` đọc bảng trên mỗi lần chạy
và surface lỗi có thể hành động được trong dashboard theo chuẩn ERROR-UX.

---

## 1 · Surface A — Trigger Matcher (`class-automation-trigger-matcher.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code | Source method |
|---|---|---|---|---|---|
| `enqueue_failed` | `enqueue_failed` | `$wpdb->insert` runs table thất bại | `automation_enqueue_failed` | `automation_run_failed` | `on_channel_message()` → `Repo_Runs::enqueue()` |
| `workflow_disabled` | `workflow_disabled` | Workflow tìm thấy nhưng `enabled=0` | `workflow_not_found` | `workflow_not_found` | `dispatch_to_workflow()` |
| `cron_parse_error` | `validation_failed` | Cron expression sai (vd `*/0 * * * *`) | `automation_graph_invalid` | `automation_graph_invalid` | `on_cron_scan()` |
| `webhook_token_invalid` | `invalid_param` | Webhook token header không khớp secret | `webhook_token_invalid` | `automation_webhook_setup` | REST `webhook_dispatch()` |
| `workflow_missing` | `workflow_missing` | Webhook slug không map được workflow | `workflow_not_found` | `workflow_not_found` | `dispatch_webhook()` |

### Hint chuẩn cho từng code
- **`automation_enqueue_failed`**: "Kiểm tra bảng `bizcity_automation_runs` tồn tại; xem PHP error log."
- **`workflow_not_found`**: "Kiểm tra workflow ID/slug còn tồn tại và đang ở trạng thái Enabled."
- **`automation_graph_invalid`**: "Mở editor workflow và sửa cron expression (vd: `*/5 * * * *`)."
- **`webhook_token_invalid`**: "Vào **Automation → Webhook** và cập nhật secret token khớp với caller."

---

## 2 · Surface B — Runner (`class-automation-runner.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code | Severity |
|---|---|---|---|---|---|
| `run_not_found` | `invalid_param` | run_id không tồn tại trong DB | `invalid_param` | `invalid_param_generic` | warn |
| `run_not_queued` | `invalid_param` | Run đã kết thúc / đang chạy, không thể khởi động lại | `automation_run_conflict` | `automation_run_failed` | info |
| `workflow_missing` | `workflow_missing` | Workflow bị xóa sau khi run được enqueue | `workflow_not_found` | `workflow_not_found` | warn |
| `graph_cycle` | `validation_failed` | Kahn topo sort thất bại — graph có cycle | `automation_graph_invalid` | `automation_graph_invalid` | warn |
| `unknown_block` | `validation_failed` | Block ID không có trong registry | `module_not_loaded` | `module_not_loaded` | fail |

### Hint chuẩn
- **`automation_run_conflict`**: "Xem **Automation → Lịch sử** để kiểm tra trạng thái run."
- **`automation_graph_invalid`**: "Mở editor workflow → xóa cạnh tạo vòng tròn → lưu lại."
- **`module_not_loaded`**: "Plugin chứa block chưa activate; kiểm tra block registry."

---

## 3 · Surface C — Action Blocks

### 3.1 `action.http_request` (`class-action-http.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `invalid_url` | `invalid_param` | URL rỗng hoặc không hợp lệ | `invalid_param` | `invalid_param_generic` |
| `invalid_method` | `invalid_param` | HTTP method không phải GET/POST/PUT/DELETE/PATCH | `invalid_param` | `invalid_param_generic` |
| `blocked_private_host` | `invalid_param` | URL trỏ IP nội bộ / localhost (SSRF guard) | `ssrf_blocked` | `automation_block_error` |
| `http_error` | `http_error` | Remote server trả 4xx / 5xx | `automation_http_error` | `automation_block_error` |

**Hint cho `ssrf_blocked`**: "URL hướng đến IP nội bộ không được phép. Dùng URL public có thể reach từ internet."

**Hint cho `automation_http_error`**: "Kiểm tra URL đích còn hoạt động; xem detail step trong Automation → Lịch sử."

### 3.2 `llm.compose_reply` / `llm.mpr_think` (`class-llm-*.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `llm_unavailable` | `provider_unavailable` | `BizCity_LLM_Client` không sẵn sàng | `llm_error` | `gateway_degraded` |
| `llm_call_failed` | `provider_unavailable` | Gateway trả lỗi (timeout, quota, provider) | `llm_error` | `gateway_degraded` |

### 3.3 `action.reply_zalo` (`class-action-reply-zalo.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `channel_not_configured` | `invalid_param` | Không tìm thấy account Zalo cho chat_id | `channel_not_configured` | `channel_setup` |
| `send_failed` | `http_error` | Gửi tin thất bại (API Zalo/OA/Personal) | `automation_http_error` | `automation_block_error` |

### 3.4 `action.publish_fb_post` (`class-action-publish-fb-post.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `token_invalid` | `http_error` | Page token hết hạn | `token_invalid` | `fb_token_expired` |
| `page_not_connected` | `invalid_param` | Page chưa kết nối hoặc không tìm thấy | `page_not_connected` | `fb_page_not_connected` |
| `graph_error` | `http_error` | Facebook Graph API trả lỗi | `automation_http_error` | `automation_block_error` |

### 3.5 `action.search_kg` (`class-action-search-kg.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `kg_empty` | `invalid_param` | Notebook không có dữ liệu index | `kg_empty` | `kg_add_source` |
| `retrieval_error` | `http_error` | Lỗi khi query vector store / DB | `retrieval_error` | `kg_retrieval_error` |

### 3.6 `action.send_email` (`class-action-send-email.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `email_send_failed` | `http_error` | `wp_mail()` trả false | `automation_email_failed` | `automation_block_error` |

### 3.7 `action.invoke_skill` (`class-action-invoke-skill.php`)

| WP_Error code / reason | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `skill_db_missing` | `invalid_param` | Skill slug không có trong `bizcity_skills` | `skill_db_missing` | `skill_not_found` |
| `runtime_error` | `block_error` | TwinBrain runtime gặp lỗi khi chạy skill | `twin_agent_exception` | `agent_exception` |

### 3.8 `action.capture_to_notebook` (`class-action-capture-to-notebook.php`)

| WP_Error code | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `notebook_bridge_unavailable` | `bridge_unavailable` | Module notebook bridge chưa load/sẵn sàng | `module_not_loaded` | `module_not_loaded` |
| `no_chat_id` | `chat_id_missing` | Trigger payload thiếu chat_id/conversation_chat_id | `invalid_param` | `invalid_param_generic` |
| `invalid_channel` | `channel_unresolved` | Không xác định được channel từ trigger hoặc override | `invalid_param` | `invalid_param_generic` |
| `notebook_bridge_invalid_identity` | `owner_user_missing` | Không resolve được owner user để ghi notebook | `auth_required` | `invalid_param_generic` |
| `notebook_bridge_empty_batch` | `empty_payload` | Không có text/tệp hợp lệ để lưu | `invalid_param` | `invalid_param_generic` |
| `notebook_bridge_capture_all_failed` | `all_items_failed` | Batch chạy nhưng tất cả item đều fail | `automation_run_failed` | `automation_block_error` |
| `notebook_bridge_no_attachment` / `notebook_bridge_empty_url` / `notebook_bridge_download_failed` / `notebook_bridge_sideload_failed` | `capture_failed` | Lỗi đọc/tải/sideload attachment hoặc ingest file | `automation_run_failed` | `automation_block_error` |

### 3.9 Catch-all — mọi block

| Throwable | reason_bucket | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `block_exception` (PHP Exception/Error) | `block_error` | Block ném exception không được handle | `automation_block_error` | `automation_block_error` |

---

## 4 · Surface D — Cron Dispatcher (`on_cron_dispatch()`)

| Condition | reason_bucket ghi vào meta | Mô tả | ERROR-UX code | help_code |
|---|---|---|---|---|
| `execute()` trả WP_Error | từ `reason_bucket()` runner | Run kết thúc FAIL trong cron batch | `automation_run_failed` | `automation_run_failed` |
| Tables missing (`SHOW TABLES` fail) | `tables_missing` | Bảng bizcity_automation_* không tồn tại | `module_not_loaded` | `module_not_loaded` |
| `every_minute` interval không có (pre BUG-1 fix) | `cron_schedule_missing` | Interval `every_minute` chưa đăng ký | `cron_failed` | `cron_meta_viewer` |

### R-CRON-META evidence (bắt buộc)
Mỗi cron tick ghi vào `bizcity_cron_runs.meta`:
```json
{
  "counters": { "runs_picked": 3, "runs_done": 2, "runs_failed": 1 },
  "events": [
    {
      "name": "automation_run_failed",
      "run_id": "run_abc123",
      "reason": "block_error",
      "error": "Action reply_zalo: channel not configured",
      "ts": "2026-06-08T04:00:01Z"
    }
  ]
}
```

---

## 5 · Surface E — CRM Bridge (`emit_crm_bridge()`)

| Condition | Mô tả | Hậu quả nếu fail | Severity |
|---|---|---|---|
| `BizCity_Automation_CRM_Bridge::create_event()` trả `<=0` | Không tạo được CRM event | Run hoàn thành nhưng Scheduler không reply về kênh — user mất tin "✅ Đã xong" | warn |
| `metadata.inbound` không có | `BizCity_Scheduler_Inbound_Provenance::is_valid()` trả false | Notifier không biết reply về kênh nào | warn |

---

## 6 · Health Probe Contract (`core.automation.runtime_errors`)

**File:** `core/diagnostics/includes/probes/class-probe-automation-runtime.php`  
**ID:** `core.automation.runtime_errors`  
**Order:** 40  
**Severity:** `warning`

### 6.1 Assertions (6 steps)

| Step ID | Label | Nguồn | Pass condition | Status khi không pass |
|---|---|---|---|---|
| `recent.fails_24h` | "Không có run FAIL trong 24h gần nhất" | `bizcity_automation_runs` | `COUNT(status=FAIL, created>-24h) = 0` | **info** (not warn/fail — runtime errors) |
| `recent.by_reason.*` | "Run Error · `<reason>`" | `bizcity_automation_runs` | bucket count = 0 | **warn** per bucket |
| `recent.stuck_queued` | "Không có run bị kẹt trạng thái queued" | `bizcity_automation_runs` | `COUNT(status=QUEUED, created>10min ago) = 0` | **warn** |
| `cron.dispatch_meta` | "Cron dispatcher ghi meta đầy đủ" | `bizcity_cron_runs` | tìm được row cho `bizcity_automation_cron_dispatch` trong 24h | **info** |
| `cron.event_failures` | "Không có automation_run_failed trong cron meta" | `bizcity_cron_runs.meta` | `events[].name != automation_run_failed` | **warn** |
| `crm.bridge_fail` | "CRM Bridge tạo event thành công cho các run gần nhất" | `bizcity_automation_runs.crm_event_id` | runs OK có `crm_event_id != NULL` | **info** |

### 6.2 Error Catalog (map reason_bucket → canonical ERROR-UX)

```php
// Trong class-probe-automation-runtime.php
private static function error_catalog(): array {
    return array(
        'block_error'          => array(
            'code'      => 'automation_block_error',
            'message'   => 'Automation block ném exception khi thực thi.',
            'hint'      => 'Mở Automation → Lịch sử → chọn run → xem step lỗi màu đỏ.',
            'help_code' => 'automation_block_error',
        ),
        'block_timeout'        => array(
            'code'      => 'automation_block_timeout',
            'message'   => 'Automation block chạy quá thời gian cho phép.',
            'hint'      => 'Rút ngắn timeout trong block config, hoặc tối ưu API downstream.',
            'help_code' => 'automation_block_error',
        ),
        'validation_failed'    => array(
            'code'      => 'automation_graph_invalid',
            'message'   => 'Workflow graph không hợp lệ (có cycle hoặc block lạ).',
            'hint'      => 'Mở editor workflow → kiểm tra không có cạnh tạo vòng tròn.',
            'help_code' => 'automation_graph_invalid',
        ),
        'unknown_block'        => array(
            'code'      => 'module_not_loaded',
            'message'   => 'Block chưa đăng ký trong registry khi chạy workflow.',
            'hint'      => 'Kiểm tra plugin chứa block đã activate; xem PHP error log.',
            'help_code' => 'module_not_loaded',
        ),
        'workflow_missing'     => array(
            'code'      => 'workflow_not_found',
            'message'   => 'Workflow bị xóa trong khi run đang chờ thực thi.',
            'hint'      => 'Xóa các run queued cũ hoặc khôi phục workflow từ backup.',
            'help_code' => 'workflow_not_found',
        ),
        'http_error'           => array(
            'code'      => 'automation_http_error',
            'message'   => 'Action HTTP Request nhận phản hồi lỗi từ server đích.',
            'hint'      => 'Kiểm tra URL và credentials trong cấu hình block. Xem detail step trong Lịch sử.',
            'help_code' => 'automation_block_error',
        ),
        'provider_unavailable' => array(
            'code'      => 'llm_error',
            'message'   => 'LLM Gateway không phản hồi khi automation chạy.',
            'hint'      => 'Kiểm tra API key BizCity và trạng thái gateway. Thử lại sau vài phút.',
            'help_code' => 'gateway_degraded',
        ),
        'invalid_param'        => array(
            'code'      => 'invalid_param',
            'message'   => 'Tham số không hợp lệ trong cấu hình block.',
            'hint'      => 'Mở workflow editor → kiểm tra cấu hình block bị lỗi.',
            'help_code' => 'invalid_param_generic',
        ),
        'enqueue_failed'       => array(
            'code'      => 'automation_enqueue_failed',
            'message'   => 'Không thể tạo run mới vào hàng đợi.',
            'hint'      => 'Kiểm tra bảng bizcity_automation_runs; xem DB error log.',
            'help_code' => 'automation_run_failed',
        ),
        'tables_missing'       => array(
            'code'      => 'module_not_loaded',
            'message'   => 'Bảng DB automation không tồn tại trên site này.',
            'hint'      => 'Vào Diagnostics → Schema Inventory → tạo bảng thiếu.',
            'help_code' => 'module_not_loaded',
        ),
        'cron_schedule_missing' => array(
            'code'      => 'cron_failed',
            'message'   => 'Interval every_minute chưa đăng ký — cron broadcast không chạy được.',
            'hint'      => 'Cập nhật plugin lên phiên bản mới nhất (BUG-1 đã vá 2026-06-08).',
            'help_code' => 'cron_meta_viewer',
        ),
    );
}
```

---

## 7 · HELP_CATALOG entries (FE)

Các `help_code` mới cần thêm vào `HELP_CATALOG` trong FE:

### `automation_block_error`
```typescript
'automation_block_error': {
  title: 'Xử lý lỗi trong Automation Block',
  summary: 'Một block trong workflow gặp lỗi khi thực thi. Lỗi này thường do cấu hình block sai hoặc service phụ thuộc không khả dụng.',
  steps: [
    'Vào WordPress Admin → Automation → Lịch sử (Runs).',
    'Tìm run bị lỗi (badge đỏ FAIL).',
    'Nhấn vào run → xem danh sách step → tìm step màu đỏ.',
    'Đọc error message → kiểm tra cấu hình block trong editor.',
    'Sửa workflow → nhấn "Chạy lại" để test.',
  ],
  related: ['automation_run_failed', 'gateway_degraded'],
},
```

### `automation_graph_invalid`
```typescript
'automation_graph_invalid': {
  title: 'Sửa cấu trúc Workflow Graph',
  summary: 'Workflow graph chứa cycle (vòng tròn) hoặc node cô lập khiến hệ thống không thể xác định thứ tự chạy.',
  steps: [
    'Mở workflow trong editor (Canvas).',
    'Kiểm tra không có cạnh nào tạo thành vòng tròn (A→B→C→A).',
    'Xóa cạnh thừa hoặc node cô lập.',
    'Lưu → kiểm tra nút Validate ở toolbar.',
  ],
},
```

### `automation_webhook_setup`
```typescript
'automation_webhook_setup': {
  title: 'Cấu hình Webhook Token',
  summary: 'Webhook secret token không khớp với caller. Automation từ chối request để bảo vệ an toàn.',
  steps: [
    'Vào Automation → chọn workflow → tab Webhook.',
    'Copy Secret Token.',
    'Cập nhật secret tương ứng trong hệ thống 3rd-party gọi webhook.',
    'Test lại với curl hoặc Postman.',
  ],
  docs_url: 'https://docs.bizcity.vn/automation/webhook',
},
```

---

## 8 · Checklist khi thêm error code mới

Khi block/surface mới emit WP_Error với code chưa có trong catalog:

1. **Thêm row** vào §3 (hoặc §1/§2 tuỳ surface) với: `code / reason_bucket / mô tả / ERROR-UX code / help_code`.
2. **Thêm entry** vào `error_catalog()` trong `class-probe-automation-runtime.php`.
3. **Thêm help_code entry** vào `HELP_CATALOG` trong FE (xem §7 pattern).
4. **Thêm vào ERROR-UX-SPEC.md §4.6** nếu code là mới hoàn toàn.
5. Chạy health probe (`core.automation.runtime_errors`) để xác nhận mapping hoạt động.

---

## 9 · Anti-patterns CẤM

- ❌ `return new WP_Error('failed', 'something failed')` — code quá chung chung, không map được catalog.
- ❌ `error_log('Block failed: ' . $e->getMessage()); return false;` — nuốt lỗi, runner không biết fail.
- ❌ Block `execute()` trả `null` hoặc `false` thay vì `WP_Error` khi có lỗi thật sự — runner coi là OK.
- ❌ Thêm block/surface mới mà không update catalog này và probe error_catalog map.
- ❌ `help_code` trỏ đến key chưa có trong `HELP_CATALOG` FE — nút "Xem hướng dẫn" mở trang trống.
