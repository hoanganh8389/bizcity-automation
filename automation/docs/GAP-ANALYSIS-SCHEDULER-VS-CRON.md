# GAP Analysis — core/scheduler vs core/cron

> Produced: 2026-06-14 — Johnny Chu  
> Purpose: rà soát 2 module xác định GAP về observability, correctness, integration.

---

## 1. Module Overview

### core/cron
Infrastructure layer — "Hook X chạy mỗi N phút". Không biết business.

| Component | File | Responsibility |
|---|---|---|
| `BizCity_Cron_Manager` | `class-cron-manager.php` | Registry (bizcity_cron_registry), execution trace (bizcity_cron_runs), retry queue (bizcity_cron_retries), note()/note_event() evidence |
| `BizCity_Cron_REST` | `class-cron-rest.php` | bizcity-cron/v1 — jobs, runs, retries, logs |
| `BizCity_Cron_File_Logger` | `class-cron-file-logger.php` | JSONL logs at wp_uploads/bizcity_cron_logs/YYYY-MM-DD.jsonl |
| `BizCity_Cron_Admin_Page` | `class-cron-admin-page.php` | Tools → BizCity Cron — registry + runs + retries + JSONL section |
| `BizCity_Cron_MCP` | `class-cron-mcp.php` | TwinBrain tools: list_jobs, force_run, last_runs, disable_job |

Tables: `bizcity_cron_registry`, `bizcity_cron_runs`, `bizcity_cron_retries`

### core/scheduler
Business event layer — "Event row #123 (fb_post) đến giờ → fire reminder."

| Component | File | Responsibility |
|---|---|---|
| `BizCity_Scheduler_Manager` | `class-scheduler-manager.php` | CRUD bizcity_crm_events, claim_due_reminders, mark_reminder_sent |
| `BizCity_Scheduler_Cron` | `class-scheduler-cron.php` | 5-min scanner: claim due → fire `bizcity_scheduler_reminder_fire` hook |
| `BizCity_Scheduler_HIL_Cron` | `class-scheduler-hil-cron.php` | 1-min sweep: expire draft reminder_personal after 5min |
| `BizCity_Scheduler_REST_API` | `class-scheduler-rest-api.php` | bizcity-scheduler/v1 — events CRUD, quick-add, today |
| `BizCity_Scheduler_Automation` | `class-scheduler-automation.php` | on_reminder_fire → ai_context.automation.on_fire[] chains |
| `BizCity_Scheduler_Completion_Notifier` | `class-scheduler-completion-notifier.php` | on status=done → reply via Gateway back to inbound channel |
| `BizCity_Scheduler_HIL_Router` | `class-scheduler-hil-router.php` | Human-In-The-Loop confirm flow for reminder_personal |
| Adapters (6) | `adapters/` | fb_post, web_post, reminder_zalo, telegram_send, reminder_personal, automation_workflow |

Tables: `bizcity_crm_events` (schema v3, per-blog)

---

## 2. Integration Flow (as-built)

```
WP-Cron tick (bizcity_scheduler_reminder_scan, every 5 min)
  └─ BizCity_Scheduler_Cron::scan_reminders()
       ├─ BizCity_Cron_Manager::note()         ← R-CRON-META
       ├─ claim_due_reminders()                ← SELECT + UPDATE claim lock
       └─ for each claimed event:
            do_action('bizcity_scheduler_reminder_fire', $event)
              ├─ [p10] BizCity_Scheduler_Automation::on_reminder_fire()  ← ai_context chains
              ├─ [p45] BizCity_Automation_Trigger_Matcher::on_scheduler_fire()  ← metadata.workflow_id dispatch
              └─ [channel gateway adapters p10+]
            mark_reminder_sent($id)            ← sets reminder_sent=1 in DB

WP-Cron tick (bizcity_automation_cron, every 1 min)
  └─ BizCity_Automation_Trigger_Matcher::on_cron_scan()
       └─ for each enabled trigger.cron workflow:
            cron_should_fire() via last_opt timestamp
            BizCity_Automation_Schedule_Manager::mark_event_done(wf_id)
            enqueue_and_optionally_run()
```

---

## 3. GAP Analysis

### GAP-1 🔴 CRITICAL — reminder_min defaults to 15 for automation_workflow events

**File:** `core/automation/includes/class-automation-schedule-manager.php::sync_workflow_events()`

`BizCity_Automation_Schedule_Manager::sync_workflow_events()` calls
`$scheduler->create_event()` without setting `reminder_min`. The scheduler's
`sanitize_row()` defaults this to **15** when not provided.

**Result:** automation_workflow calendar events fire **15 minutes BEFORE** `start_at`
instead of AT `start_at`. This misaligns with the cron expression intent.

**Fix (applied 2026-06-14):** Add `'reminder_min' => 0` to the `create_event()` data array.

---

### GAP-2 🔴 CRITICAL — mark_event_done() replaces metadata, losing workflow_id + inbound

**File:** `core/automation/includes/class-automation-schedule-manager.php::mark_event_done()`

Calls `$scheduler->update_event()` with `'metadata' => ['run_status'=>'done', 'done_at'=>...]`.
`update_event()` does a full REPLACE of the metadata column — it does NOT merge.

**Result:** After `mark_event_done()`, the event's `metadata` is reduced to
`{"run_status":"done","done_at":"..."}` — losing `workflow_id`, `inbound{}`,
`workflow_name`, `cron_expr`, etc. Breaks Completion Notifier (needs `inbound.chat_id`)
and future debugging.

**Fix (applied 2026-06-14):**  
Read existing row → JSON-decode existing metadata → merge → pass merged array to update_event().

---

### GAP-3 🟡 HIGH — on_scheduler_fire() doesn't call mark_event_done()

**File:** `core/automation/includes/class-automation-trigger-matcher.php::on_scheduler_fire()`

After `enqueue_and_optionally_run()` succeeds, the scheduler calls `mark_reminder_sent(id)`
which sets `reminder_sent=1`. BUT the event `status` stays `'active'` forever.

**Result:** Calendar UI shows all automation_workflow events as "active" even after they fired.
No visual feedback that they ran.

**Fix (applied 2026-06-14):** Call `BizCity_Automation_Schedule_Manager::instance()->mark_event_done($wf_id, $event_id)` after dispatch.
Also added optional `$event_id` param to `mark_event_done()` to skip the DB lookup.

---

### GAP-4 🟡 HIGH — BizCity_Scheduler_HIL_Cron NOT registered via BizCity_Cron_Manager

**File:** `core/scheduler/includes/class-scheduler-hil-cron.php::init()`

Uses direct `wp_schedule_event()` without `BizCity_Cron_Manager::register()`.

**Result:**
- HIL timeout sweeps are **invisible** to the cron registry and admin page
- NOT traced in `bizcity_cron_runs` → no duration, no error tracking
- NOT visible in JSONL file logs
- Register miss is impossible to distinguish from "never ran"

**Fix (applied 2026-06-14):** Added `class_exists('BizCity_Cron_Manager')` path in `init()`
— identical pattern to `BizCity_Scheduler_Cron::schedule()`.

---

### GAP-5 🟡 MEDIUM — BizCity_Cron_File_Logger::reset_dir_cache() is a no-op

**File:** `core/cron/includes/class-cron-file-logger.php::reset_dir_cache()`

`reset_dir_cache()` declares a LOCAL `static $dir_cache = null`. This is a
**different** variable from the `static $dir_cache` inside `log_dir()`. Calling
`reset_dir_cache()` has zero effect on the cached path.

**Result:** On WordPress multisite with `switch_to_blog()`, the log directory
path from the first blog is permanently cached — new blog's uploads dir never
used. Logs from swapped blogs all land in blog #1's folder.

**Fix (applied 2026-06-14):** Moved `$dir_cache` to a `private static` class-level
property `$_dir_cache`. Both `log_dir()` and `reset_dir_cache()` use the same field.

---

### GAP-6 🟢 LOW — Duplicate "every minute" interval registrations

Three places register a 1-minute WP-Cron interval:

| Class | Interval Key | Registered In |
|---|---|---|
| `BizCity_Scheduler_HIL_Cron` | `every_minute` | `register_interval()` hook |
| `BizCity_Automation_Trigger_Matcher` | `bizcity_automation_minute` | `bootstrap.php` |
| _(future modules)_ | — | — |

These are functionally identical but use different keys. No crash, but wasteful.

**Recommendation (not yet fixed):** Long-term, define canonical interval keys in
`BizCity_Cron_Manager` and have all modules use those. For now both work.

---

### GAP-7 🟢 LOW — scan_reminders() doesn't call log_trigger() in File Logger

The file logger's `log_trigger()` method exists for per-event sub-entries but
`scan_reminders()` doesn't call it for each claimed event. Currently only
`note()` / `note_event()` via cron_runs.meta record the details.

**Impact:** File logs show start/end of the cron run but not individual events
claimed within the run. The DB `bizcity_cron_runs.meta` has this detail.

**Recommendation:** Low priority — `note()` already covers this. Add `log_trigger()`
calls only if richer JSONL analysis is needed later.

---

## 4. Architecture Table (unified)

| Concern | core/cron owner | core/scheduler owner | Notes |
|---|---|---|---|
| Cron schedule registration | `BizCity_Cron_Manager::register()` | `BizCity_Scheduler_Cron::schedule()` ✅ | Scheduler correctly delegates |
| HIL cron registration | — | `BizCity_Scheduler_HIL_Cron::init()` ❌ | **GAP-4 — fixed** |
| Execution tracing | `bizcity_cron_runs` + JSONL | delegates to CronManager via note() ✅ | |
| Retry on error | `bizcity_cron_retries` (3 attempts) | No retry for failed `reminder_fire` sends ⚠️ | Next sprint: wrap reminder dispatch in retry |
| Event CRUD | — | `bizcity_crm_events` ✅ | Single table |
| Event status lifecycle | — | active → done/cancelled in crm_events | Calendar UI reads this |
| Observability admin page | Tools → BizCity Cron ✅ | Scheduler admin page (separate) | No unified view |
| Manual event fire timing | — | `reminder_min=0` → fire AT start_at | **GAP-1 — fixed** |
| Metadata merge on done | — | merge read → update ✅ after fix | **GAP-2 — fixed** |
| Event done after fire | cron_scan: mark_event_done() ✅ | scheduler path: was missing ❌ | **GAP-3 — fixed** |

---

## 5. Remaining Sprint Backlog (not fixed in this session)

| ID | Priority | Task |
|---|---|---|
| SCH-RETRY-1 | Medium | Wrap `scan_reminders` per-event dispatch in retry via `BizCity_Cron_Manager::enqueue_retry()` |
| SCH-UNIFIED-VIEW | Low | Add scheduler events count/health to Cron admin page sidebar |
| CRON-INTERVAL-UNIFY | Low | Canonical interval keys in CronManager; migrate HIL + Automation to use them |
| SCH-LOG-TRIGGER | Low | Call `BizCity_Cron_File_Logger::log_trigger()` per claimed event in scan_reminders() |
