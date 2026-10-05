# PHASE — R-FINAL-ACTION · Final-Action Quad-Commit Rule

> **Status:** RULE · v1.0 · 2026-06-02
> **Tier:** Tối thượng (cùng cấp với R-AGENTIC / R-MPRT)
> **Owner:** Twin AI Core (BizCity Founder)
> **Phạm vi:** Mọi block thuộc category `actions/*` đứng cuối nhánh DAG trong
> `core/automation/` (publish_fb_post, publish_web_post, send_email,
> reply_zalo final, create_crm_event, scheduler_create_event, …).
>
> **Liên quan:**
> - [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) §2 (Design ↔ Run)
> - [AUTOMATION-1-BE-ROADMAP.md](AUTOMATION-1-BE-ROADMAP.md) §3 (CRM-first)
> - [PHASE-0.37-SCHEDULER-AUTOMATION.md](../../scheduler/docs/PHASE-0.37-SCHEDULER-AUTOMATION.md)
> - `core/scheduler/includes/class-scheduler-manager.php::create_event()`
> - `core/cron/includes/class-cron-manager.php::note_event()`

---

## 0. Tuyên ngôn (1 câu)

> **Mọi action cuối nhánh PHẢI commit đồng thời 4 bằng chứng độc lập:
> (1) Scheduler event hẹn ≥ 3 phút, (2) thông báo cho user qua chat,
> (3) link edit/preview, (4) callback acknowledge sau khi cron worker
> publish xong. Thiếu bất kỳ commit nào → action được coi là CHƯA hoàn
> thành dù return success.**

> Scheduler row = **bằng chứng tồn tại** cho user (UI calendar).
> Channel notification = **trust signal** (user biết bot đã hiểu).
> Link = **affordance** để user kiểm tra ngay (không lệ thuộc UI calendar).
> Ack callback = **idempotent receipt** đóng vòng tròn (user biết đã ra trận).

---

## 1. Vì sao 4 commit (không phải 1)

Mô hình cũ (publish_fb_post v1) chỉ "fire & forget":
- Action gọi `BizCity_Automation_CRM_Bridge::create_event()` → trả `event_id`.
- Reply Zalo "✅ Đã đặt lịch đăng FB sau 3 phút (event #72)".
- Cron worker `BizCity_FB_Publisher::on_reminder_fire` publish → KHÔNG ai notify lại.

→ Hậu quả:
1. **Calendar trống** vì `user_id=0` (cron context, không có current_user) →
   user vào `/wp-admin/admin.php?page=bizcity-twinchat&plugin=scheduler` không
   thấy lịch → mất niềm tin "bot vừa nói đã đặt mà sao trống?"
2. **Không có affordance** sửa nhanh: user phải nhớ event_id → mở scheduler
   → tìm → edit. 80% user không bao giờ kiểm.
3. **Không khép vòng** khi publish thành công hoặc fail: user phải tự mở
   FB Page kiểm tra. Lỗi token / quota fail âm thầm.
4. **Không có audit trail** cross-channel: Zalo bot ra lệnh, FB publish
   thành công, nhưng Zalo không nhận lại receipt → user phải hỏi bot lại.

R-FINAL-ACTION giải quyết bằng 4 commit bắt buộc trong cùng 1 atomic step.

---

## 2. Quad-Commit Contract (BẮT BUỘC)

```
                ┌─────────────────────────────────────────┐
                │  Final Action.execute( $ctx, $data )    │
                └─────────────────────────────────────────┘
                              │ (ATOMIC — phải đủ 4)
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼               ▼
   ① SCHEDULER          ② NOTIFY USER         ③ AFFORDANCE     ④ ACK CALLBACK
   create_event()       channel_send()        edit_url +       on_*_published
   start_at = +3min     "✅ đã đặt lịch       preview_url      → channel_send
   user_id = OWNER      … #event_id"          (CPT edit /      "🚀 đã đăng:
   status  = active     metadata: chat_id     FB post URL /    <link>"
   meta.   = ack_chat   for ack callback      web preview)     idempotent guard
```

### Commit ① — Scheduler row (bằng chứng tồn tại)

```php
$event_id = BizCity_Automation_CRM_Bridge::create_event( array(
    'event_type'  => 'fb_post',                // hoặc 'web_post', 'email', …
    'title'       => '[automation] FB → ' . $page_name,
    'description' => mb_substr( $content, 0, 240 ),
    'start_at'    => gmdate( 'Y-m-d H:i:s', time() + 180 ),  // BẮT BUỘC ≥3min
    'user_id'     => (int) ( $ctx['_owner_user_id'] ?? 0 ),  // KHÔNG để 0
    'workflow_id' => (int) $ctx['_workflow_id'],
    'related_id'  => (string) $ctx['_run_id'],
    'status'      => 'active',
    'source'      => 'workflow',
    'metadata'    => array(
        'fb_page_id'        => $page_id,
        'fb_content'        => $content,
        'fb_image_url'      => $image,
        'fb_publish_status' => 'pending',
        // R-FINAL-ACTION §4 — ack channel để cron worker reply lại sau publish.
        'ack_channel'       => (string) $ctx['trigger']['channel']  ?? '',
        'ack_chat_id'       => (string) $ctx['trigger']['chat_id']  ?? '',
        'ack_sender_id'     => (string) $ctx['trigger']['sender_id'] ?? '',
    ),
) );
```

**Quy tắc cứng:**
- `start_at >= now + 3 minutes` → cho user time-window để cancel/edit.
- `user_id != 0` → owner = workflow.created_by (runner inject `_owner_user_id`).
- `metadata.ack_*` populate đầy đủ → cron worker dùng để callback (§4).

### Commit ② — User notification (trust signal)

```php
$msg  = "✅ Đã đặt lịch đăng FB sau 3 phút (event #{$event_id})\n";
$msg .= "📝 {$content_preview}\n";
$msg .= "🛑 Sếp muốn huỷ → vào Scheduler.";
bizcity_channel_send( $chat_id, $msg, 'text' );
```

**Quy tắc cứng:**
- Reply trong CÙNG channel với inbound trigger (không cross-channel ở step ②).
- Nội dung phải có: event_id (để user reference), preview content (xác nhận
  bot hiểu đúng), time-window (≥3 phút), hint cancel.

### Commit ③ — Affordance link (edit + preview)

Ngay sau commit ②, gửi link riêng (1 message tách → click-friendly):

```php
$edit_url = admin_url( "admin.php?page=bizcity-twinchat&plugin=scheduler#event-{$event_id}" );
bizcity_channel_send( $chat_id,
    "✏️ Sửa hoặc huỷ: {$edit_url}",
    'text'
);
```

**Per-event-type hint:**
| event_type | Link ③ |
|---|---|
| `fb_post` | `admin.php?page=bizcity-twinchat&plugin=scheduler#event-{id}` (preview CPT nếu lưu draft) |
| `web_post` | `post.php?post={post_id}&action=edit` (CPT edit screen) + preview link |
| `email` | scheduler view + draft message link |
| `reminder` | scheduler view |

### Commit ④ — Ack callback (idempotent receipt)

Cron worker khi publish thành công / fail PHẢI gửi callback về channel gốc:

```php
// Trong BizCity_FB_Publisher::on_reminder_fire( $event_id ):
$ev = BizCity_Scheduler_Manager::instance()->get_event( $event_id );
$meta = (array) ( $ev->metadata ?? array() );

$result = $this->publish_to_fb( $ev );  // thực thi

// Idempotent guard — tránh ack 2 lần khi cron retry.
if ( ! empty( $meta['_acked_at'] ) ) { return; }

if ( $result['ok'] ) {
    bizcity_channel_send( $meta['ack_chat_id'],
        "🚀 Đã đăng FB thành công!\n" .
        "🔗 Xem bài: {$result['permalink_url']}\n" .
        "📊 Reach: track sau 24h."
    );
} else {
    bizcity_channel_send( $meta['ack_chat_id'],
        "❌ Đăng FB thất bại: {$result['error']}\n" .
        "🔄 Tự retry sau 5 phút, hoặc huỷ trong Scheduler."
    );
}
// Mark acked (R-CRON-META đã có note_event riêng).
$meta['_acked_at']     = current_time( 'mysql' );
$meta['_acked_result'] = $result['ok'] ? 'ok' : 'fail';
BizCity_Scheduler_Manager::instance()->update_event_meta( $event_id, $meta );
```

---

## 3. Anti-patterns CẤM TUYỆT ĐỐI

- ❌ `create_event()` với `user_id` mặc định (rơi về `get_current_user_id() = 0` trong cron) → calendar trống.
- ❌ `start_at = now` (không có time-window cancel) → user phản xạ "sai" không kịp huỷ.
- ❌ Bỏ commit ③ (edit link) với lý do "Zalo bot tự biết" → user phải nhớ event_id, không click được.
- ❌ Bỏ commit ④ (ack callback) → user phải tự mở FB kiểm tra, lỗi token âm thầm.
- ❌ Ack message trùng lặp khi cron retry (thiếu `_acked_at` guard) → spam user.
- ❌ Cross-channel ack ở commit ② (FB inbound nhưng reply Zalo) — chỉ ack ở channel gốc.
- ❌ Lưu `ack_chat_id` plaintext trong description (PII leak qua admin list) → phải nằm trong `metadata` JSON.

---

## 4. Reference impl bắt buộc copy

### Action block template (copy-paste)

```php
final class BizCity_Automation_Action_<NAME> extends BizCity_Automation_Block_Base {

    public function execute( array $ctx, array $data ) {
        // … resolve $data tokens …

        $owner_id = (int) ( $ctx['_owner_user_id']
            ?? $ctx['trigger']['wp_user_id']
            ?? 0 );
        if ( $owner_id <= 0 ) {
            $this->note_event( '<name>_no_owner_error', array(
                'reason'      => 'owner_missing',
                'workflow_id' => (int) $ctx['_workflow_id'],
            ) );
            return new WP_Error( 'no_owner',
                'Workflow chưa có owner — không thể attach scheduler event.' );
        }

        // ① Scheduler row
        $event_id = (int) BizCity_Automation_CRM_Bridge::create_event( array(
            'event_type'  => '<type>',
            'title'       => '[automation] <…>',
            'start_at'    => gmdate( 'Y-m-d H:i:s', time() + 180 ),
            'user_id'     => $owner_id,
            'workflow_id' => (int) $ctx['_workflow_id'],
            'related_id'  => (string) $ctx['_run_id'],
            'metadata'    => array_merge( $this->meta_for_publisher(), array(
                'ack_channel'   => (string) ( $ctx['trigger']['channel'] ?? '' ),
                'ack_chat_id'   => (string) ( $ctx['trigger']['chat_id'] ?? '' ),
                'ack_sender_id' => (string) ( $ctx['trigger']['sender_id'] ?? '' ),
            ) ),
        ) );
        if ( $event_id <= 0 ) {
            return new WP_Error( 'schedule_failed', 'Scheduler create_event failed.' );
        }

        // ② Notify user
        $chat_id = (string) ( $ctx['trigger']['chat_id'] ?? '' );
        if ( $chat_id !== '' && function_exists( 'bizcity_channel_send' ) ) {
            bizcity_channel_send( $chat_id, $this->notify_body( $event_id, $data ) );
            // ③ Edit affordance
            bizcity_channel_send( $chat_id, $this->edit_link_body( $event_id ) );
        }

        return array(
            'event_id'     => $event_id,
            'scheduled_at' => gmdate( 'c', time() + 180 ),
            'ack_pending'  => true,
        );
    }

    /** Per-publisher metadata (fb_page_id, post_content, etc). */
    abstract protected function meta_for_publisher(): array;
    abstract protected function notify_body( int $event_id, array $data ): string;
    abstract protected function edit_link_body( int $event_id ): string;
}
```

### Existing impls cần refactor theo R-FINAL-ACTION

| Block | Status | TODO |
|---|---|---|
| `class-action-publish-fb-post.php` | ⚠️ partial (commit ① ✅ owner ✅; ② ✅; ③ ❌; ④ ❌) | Thêm edit link + ack callback |
| `class-action-publish-web-post.php` | TBD | Implement all 4 |
| `class-action-send-email.php` | TBD | Implement all 4 |
| `core/scheduler/includes/class-fb-publisher.php::on_reminder_fire()` | ⚠️ chỉ ① ✅ | Thêm commit ④ callback |

---

## 5. Diagnostic probe (R-DDV)

Bắt buộc 1 probe `automation.final_action_quad_commit` verify:
1. Chọn 1 final action block thực tế (e.g. publish_fb_post test page).
2. Tạo dry-run với chat_id giả → expect:
   - row mới trong `bizcity_scheduler_events` với `user_id != 0`.
   - 2 message captured qua test channel mock (① + ③).
   - cleanup() xóa row giả.
3. Probe FAIL nếu thiếu 1 trong 4 evidence.

File: `core/diagnostics/includes/probes/class-probe-automation-final-action.php`
(implement Wave 2 sau khi refactor xong publish_fb_post v2).

---

## 6. Lộ trình triển khai

| Sprint | Item | File chính |
|---|---|---|
| **R-FA W1** | Runner inject `_owner_user_id` | `class-automation-runner.php` (DONE 2026-06-02) |
| **R-FA W1** | publish_fb_post set `user_id` từ owner | `class-action-publish-fb-post.php` (DONE 2026-06-02) |
| **R-FA W2** | publish_fb_post + commit ③ (edit link) | `class-action-publish-fb-post.php` |
| **R-FA W2** | FB_Publisher + commit ④ (ack callback) | `core/scheduler/includes/class-fb-publisher.php` |
| **R-FA W3** | publish_web_post (4 commits) | `class-action-publish-web-post.php` (mới) |
| **R-FA W3** | send_email (4 commits) | `class-action-send-email.php` (mới) |
| **R-FA W4** | Probe `automation.final_action_quad_commit` | `class-probe-automation-final-action.php` |
| **R-FA W5** | Refactor cũ: notify_user / scheduler_create_event tools | `core/tools/scheduler/tools.php` |

---

## 7. Bugfix lịch sử (để không lặp lại)

- **2026-06-02:** `publish_fb_post` tạo event với `user_id = get_current_user_id() = 0` (cron context) → calendar trống dù event #72/#73 đã insert thành công. Fix: runner inject `_owner_user_id` từ `workflow.created_by`; block đọc + propagate vào payload.
