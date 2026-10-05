# PHASE-AUTOMATION-CALENDAR — Lịch & Kịch bản trong Automation

> Status: **IMPLEMENTED** — 2026-06-16
> Author: Johnny Chu
> Relates to: R-CACHE, R-DCL, core/scheduler, bizcity_crm_events

---

## Implementation Status (2026-06-16)

| Phase | Component | Status |
|---|---|---|
| AC-1 BE Core | `class-automation-schedule-manager.php` | ✅ DONE |
| AC-1 BE Core | Hook vào `BizCity_Automation_REST` save/enable/disable | ✅ DONE (lines 381, 401, 452) |
| AC-1 BE Core | Cron matcher đọc pending `automation_workflow` events | ✅ DONE (`on_cron_scan` + `mark_event_done`) |
| AC-2 BE REST | `class-automation-calendar-rest.php` — 6 endpoints | ✅ DONE |
| AC-2 BE REST | Register trong `bootstrap.php` | ✅ DONE |
| AC-3 FE | `lib/calendarApi.js` — RTK-style helpers | ✅ DONE |
| AC-3 FE | `routes/CalendarRoute.jsx` — calendar grid + event list | ✅ DONE |
| AC-3 FE | `EventFormSheet` trong CalendarRoute | ✅ DONE |
| AC-3 FE | Route `/calendar` vào `App.jsx` | ✅ DONE |
| AC-3 FE | Nav item "Lịch" trong Shell | ⏳ TODO (Shell.jsx chưa cập nhật) |
| AC-4 Polish | Google Calendar sync button | ⏳ TODO |
| AC-4 Polish | Bulk delete confirmation dialog | ⏳ TODO |
| **SEED** | `tpl_daily_fb_post_8h_v1` — Cron 8h → KG → LLM → FB post | ✅ DONE (v1.17.0) |
| **SEED** | `tpl_daily_fb_post_9h_v1` — Cron 9h → KG → LLM → FB post | ✅ DONE (v1.17.0) |
| **SEED** | `tpl_daily_fb_post_10h_v1` — Cron 10h → KG → LLM → FB post | ✅ DONE (v1.17.0) |

### Cách sử dụng templates daily FB post

1. Vào **Automation → Templates** → tìm "Đăng FB hàng ngày"
2. Instantiate template (tạo workflow từ template)
3. Mở workflow trong Builder, tìm node `publish_fb_post`
4. **Điền `fb_page_id`** (bắt buộc — chọn từ FB Page picker)
5. Tùy chỉnh:
   - Node `action.search_kg` → thay `query` bằng chủ đề muốn đăng (VD: "sản phẩm mới", "tips sức khoẻ"...)
   - Node `llm.compose_reply` → điều chỉnh system prompt theo tone thương hiệu
   - Node `action.publish_fb_post` → điền `image_url` nếu muốn kèm ảnh cố định
6. Enable workflow → hệ thống tự tạo 30 event rows vào `bizcity_crm_events`
7. Xem lịch tại **Automation → Lịch kịch bản**

### Flow đầy đủ khi workflow chạy

```
bizcity_crm_events row (event_type='automation_workflow', start_at='2026-06-17 08:00:00')
  → Scheduler cron 5min: BizCity_Automation_Trigger_Matcher::on_cron_scan()
  → Automation Runner: nodes chạy tuần tự
      kg: search_kg('chủ đề đăng Facebook hôm nay') → kg.snippet
      gen: llm.compose_reply → gen.output (FB caption 4-6 dòng + hashtag)
      publish: action.publish_fb_post(mode=now) → tạo fb_post event trong bizcity_crm_events
      log: action.log
  → mark_event_done() → automation_workflow event status='done'
  → Scheduler cron: BizCity_FB_Publisher::on_reminder_fire() → Graph API → post lên FB Page
  → BizCity_Scheduler_Completion_Notifier → reply về ADMIN channel
```

---

## 1. Mục tiêu

Automation hiện có `trigger.cron` — người dùng thả cron vào workflow và chờ cron WP-Cron tự chạy.  
Nhưng: user **không biết** lịch sắp tới, không thể xem/sửa/xóa, không sync Google Calendar.

Feature này bổ sung:

| # | Tính năng |
|---|---|
| 1 | Khi workflow có trigger.cron được save/enable → tự tạo N event rows vào `bizcity_crm_events` (30 ngày tới) |
| 2 | UI Calendar tab trong Automation SPA — list/create/edit/delete events, bulk delete |
| 3 | Các calendar khác (Channel Gateway "Lịch đăng", CRM) pull từ cùng `bizcity_crm_events` — thêm filter `event_type=automation_workflow` |
| 4 | User có thể nhấn "+ Thêm lịch" trong Calendar tab → chọn workflow + thời điểm → tạo manual event → khi đến giờ, system kích hoạt trigger (cron hoặc fire inline) |
| 5 | Prompt-before-trigger: thay vì chạy thẳng, system có thể gửi Zalo/Telegram hỏi user trước rồi chờ reply để kích hoạt |

---

## 2. Thiết kế dữ liệu

### 2.1 Dùng bảng `bizcity_crm_events` hiện có

Không cần thêm bảng. Dùng các cột sau:

| Column | Value cho automation events |
|---|---|
| `event_type` | `'automation_workflow'` (đã có trong enum) |
| `source` | `'workflow'` |
| `title` | Tên workflow |
| `start_at` | Thời điểm trigger sẽ chạy |
| `status` | `active` → `done` sau khi run xong |
| `metadata` | JSON — xem §2.2 |

### 2.2 Metadata schema cho automation events

```json
{
  "workflow_id": 21,
  "workflow_name": "Đăng FB hàng ngày",
  "cron_expr": "0 9 * * *",
  "recurrence": "daily|weekly|monthly|once",
  "recurrence_days": 30,
  "prompt_before": false,
  "prompt_channel": "zalo_bot",
  "prompt_text": "Nhắc nhở: đăng bài chưa? Nhắn 'đăng' để kích hoạt.",
  "run_id": null,
  "run_status": "pending|running|done|failed",
  "inbound": {
    "platform": "ADMIN",
    "chat_id": "",
    "user_id": "1"
  }
}
```

### 2.3 Liên kết với WP-Cron

Khi `run_status = done` (runner đã xử lý), cron matcher **không chạy lại**.  
Khi event được tạo, automation runner check `bizcity_crm_events` thay vì / song song với WP-Cron.

---

## 3. Backend — Luồng xử lý

### 3.1 Save workflow → tạo events

```
User save/enable workflow có trigger.cron
  └─ BizCity_Automation_REST::update_workflow() / create_workflow()
     └─ BizCity_Automation_Schedule_Manager::sync_workflow_events(
          $workflow_id, $nodes, $enabled
        )
        ├─ Nếu disabled → xóa các event 'active' tương ứng
        ├─ Parse cron_expr từ node trigger.cron
        ├─ Tính 30 timestamps tới từ now()
        └─ Với mỗi timestamp:
           BizCity_Scheduler_Manager::create_event([
             'event_type' => 'automation_workflow',
             'source'     => 'workflow',
             'title'      => $workflow_name,
             'start_at'   => $ts,
             'metadata'   => [ 'workflow_id' => $id, 'cron_expr' => $expr, ... ]
           ])
```

### 3.2 WP-Cron trigger → kích hoạt workflow

```
BizCity_Automation_Trigger_Matcher::on_cron_scan()
  └─ Ngoài vòng find_active_workflows() hiện tại, còn query:
     SELECT * FROM bizcity_crm_events
     WHERE event_type = 'automation_workflow'
       AND start_at <= NOW()
       AND status = 'active'
       AND JSON_EXTRACT(metadata, '$.run_status') = 'pending'
     LIMIT 50
  └─ Với mỗi event:
     ├─ Update metadata.run_status = 'running'
     ├─ BizCity_Automation_Runner::dispatch($workflow_id, $trigger_payload)
     └─ Khi runner done: update status='done', metadata.run_status='done'
```

### 3.3 REST endpoints mới (namespace `bizcity-automation/v1`)

| Method | Route | Purpose |
|---|---|---|
| GET | `/calendar/events` | List automation events (from, to, workflow_id filter) |
| POST | `/calendar/events` | Tạo manual event (chọn workflow + time + config) |
| PATCH | `/calendar/events/{id}` | Sửa title/time/config |
| DELETE | `/calendar/events/{id}` | Xóa 1 event |
| POST | `/calendar/events/bulk-delete` | Xóa nhiều `{ ids: [1,2,3] }` |
| POST | `/calendar/sync-workflow/{wf_id}` | Re-sync events cho 1 workflow (30 days) |

---

## 4. Frontend — Calendar Tab

### 4.1 Thêm route `/calendar` vào Automation SPA

```
App.jsx → thêm:
  <Route path="/calendar" element={<CalendarRoute />} />
```

### 4.2 CalendarRoute layout

```
┌──────────────────────────────────────────────────────────┐
│  📅 Lịch kịch bản          [+ Thêm lịch]  [🔄 Đồng bộ] │
├──────────────────────────────────────────────────────────┤
│  Bộ lọc: [Mọi kịch bản ▼]  [Tháng 6/2026 ◀ ▶]  [Hôm nay]│
├──────────────────────────────────────────────────────────┤
│                      CALENDAR GRID                       │
│  (Tháng — ô ngày hiện thị event chips có màu per-status)│
│  Chip: ✅ Đã chạy / 🕐 Chờ / ❌ Lỗi                     │
├──────────────────────────────────────────────────────────┤
│  Panel phải (khi click ngày):                           │
│  Danh sách events ngày đó + nút Edit / Delete           │
│  Checkbox bulk select → [Xóa đã chọn]                  │
└──────────────────────────────────────────────────────────┘
```

### 4.3 EventFormSheet (Create / Edit)

Fields:
- **Kịch bản** (select workflow có trigger.cron)
- **Thời điểm** (datetime local picker)
- **Lặp lại** (Một lần / Hàng ngày / Hàng tuần / Hàng tháng)
- **Số lần lặp** (slider 1–60)
- **Prompt trước khi chạy?** (toggle)
  - Nếu bật: Kênh (Zalo Bot / Telegram), Nội dung nhắc nhở
- **Ghi chú** (textarea)

---

## 5. Tích hợp với các calendar khác

### Channel Gateway "Lịch đăng Facebook"
- Đã dùng `bizcity_crm_events` với `event_type='fb_post'`
- **Không thay đổi** — vẫn filter riêng

### CRM Calendar (nếu có)
- Cũng dùng `bizcity_crm_events` — filter `event_type IN ('meeting','task','reminder')`
- **Không thay đổi**

### Automation Calendar
- Filter: `event_type = 'automation_workflow'`
- Endpoint `GET /bizcity-automation/v1/calendar/events` đọc từ cùng bảng

> **Unified source of truth:** Mọi calendar đều đọc `bizcity_crm_events`,
> chỉ khác filter `event_type`. Không có bảng riêng.

---

## 6. Implementation Plan

### Phase AC-1 (BE Core)
- [ ] `class-automation-schedule-manager.php` — sync_workflow_events(), create_bulk(), delete_by_workflow()
- [ ] Hook vào `BizCity_Automation_REST` save/enable/disable workflow
- [ ] Cron matcher đọc pending events từ `bizcity_crm_events`

### Phase AC-2 (BE REST)
- [ ] `class-automation-calendar-rest.php` — 6 endpoints
- [ ] Register trong `bootstrap.php`

### Phase AC-3 (FE)
- [ ] `store/calendarApi.js` — RTK Query slice
- [ ] `routes/CalendarRoute.jsx` — calendar grid + event list
- [ ] `components/EventFormSheet.jsx` — create/edit form
- [ ] Thêm nav item "Lịch" vào Shell
- [ ] Route `/calendar` vào App.jsx

### Phase AC-4 (Polish)
- [ ] Google Calendar sync button (dùng `bizcity-scheduler/v1/google/sync`)
- [ ] Bulk delete với confirmation dialog
- [ ] Status badge updates (polling mỗi 10s khi có `running` events)
