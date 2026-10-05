# RULE — Inbound Dispatch Priority (Zalo Bot & channel listener chain)

> **Status:** ACTIVE · v1.0 · 2026-07-24
> **Owner:** Twin AI Core (BizCity Founder)
> **Tier:** 2 (module rule — enforced inside `core/automation` + `plugins/bizcity-zalo-bot`)
> **Related canon:** [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) · [RULE-AUTOMATION-MULTI-ATTACHMENT.md](RULE-AUTOMATION-MULTI-ATTACHMENT.md) · R-ZONE ([channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md §1.5](../../channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md))
> **Trigger for this doc:** Zalo Bot "Thợ ảnh" flow (user sent photo-edit + đăng FB request) was hijacked by Command Router's generic `thông tin` keyword substring match and replied with an unrelated account-info card instead of letting the automation workflow (or the image-consume flow) answer.

---

## 0. Tuyên ngôn (1 câu)

> **Một message inbound chỉ có MỘT "chủ" trả lời. Nếu automation workflow (ref / slash / keyword) đã match message đó, mọi responder tổng quát hơn (Command Router, Guru AI) BẮT BUỘC nhường quyền — không có "may is win" giữa các hook priority độc lập.**

WordPress `do_action()` không tự dừng khi một callback đã "xử lý xong" — mọi listener đăng ký trên cùng hook (dù khác priority) đều được gọi trừ khi code tự kiểm tra một tín hiệu dùng chung. Rule này định nghĩa tín hiệu đó và bắt buộc ai phải đọc nó.

---

## 1. Vấn đề gốc (root cause đã trace)

Codebase có xu hướng lặp lại anti-pattern: một listener **ghi** một cờ "tôi đã xử lý message này" vào `$GLOBALS`, nhưng **không listener nào khác đọc lại nó** — cờ chết, precedence chỉ tồn tại trên comment/ý định, không tồn tại tại runtime.

Hai cờ chết đã phát hiện (2026-07-24):

| Flag | Ghi ở đâu | Ý định ban đầu | Ai đọc? (trước fix) |
|---|---|---|---|
| `$GLOBALS['bizcity_automation_matched_mids'][$mid]` | `class-automation-trigger-matcher.php` (ref-match + keyword-match) | Báo hiệu "workflow đã match + đã ACK cho message này" để pipeline cũ (`bizgpt_chatbot_run_admin_flows`) không trả lời trùng | **KHÔNG AI** — pipeline cũ đã bị refactor đi, không còn consumer nào |
| `$GLOBALS['bizcity_zalobot_unlinked_skip']` | `class-command-router.php` (x2), `class-user-linker.php`, `class-personal-zalo-listener.php` | Ngăn Guru/AI bridge trả lời khi user chưa link tài khoản | **KHÔNG AI** — vẫn write-only, chưa có consumer (backlog, xem §6) |

Kết quả: Command Router (`bizcity_zalo_message_received` priority 4) chạy `strpos()` substring match keyword tổng quát (`"thông tin"`, `"info"`, …) mà không biết automation matcher (chạy TRƯỚC, ở hook khác) đã tìm thấy đúng workflow keyword scenario cho message này rồi.

---

## 2. Full listener chain — Zalo Bot inbound (canonical, verified 2026-07-24)

Một HTTP webhook request tới `/zalohook/` fire **2 hook riêng biệt, tuần tự, trong CÙNG request**:

```
POST /zalohook/
  → class-webhook-handler.php::handle_zalohook()
      1) do_action( 'bizcity_zalo_webhook_intake', $data, $secret_token, $intake_bot )  ← FIRES FIRST
      2) check_and_store_listener_data()  (legacy FE "Test Listen" polling store)
      3) process_zalohook_data() → process_new_zalo_format()
           → do_action( 'bizcity_zalo_message_received', $message_data )                ← FIRES SECOND
```

### 2.1 Hook `bizcity_zalo_webhook_intake` (raw payload, before normalization)

| Priority | Class::method | Purpose | Replies to user? |
|---|---|---|---|
| 1 | `BizCity_CG_Debug_Logger::on_zalo_webhook_intake` | JSONL debug mirror (R-CH-FILE-LOG) | No |
| 1 | `BizCity_Automation_Listener::on_zalo_intake` | FE Workflow Builder "Test Listen" capture only | No |
| **5** | **`BizCity_Automation_Trigger_Matcher::on_zalo_intake`** | **THE REAL DISPATCHER.** Adapts raw payload → `on_channel_message()`: resume-state → ref match → slash match → keyword match → fallback/default. Enqueues workflow runs, sends ACK reply, sets the claim flag (§3). | **Yes** (ACK + workflow's own reply actions) |
| 10 | `BizCity_Channel_Listener_Bus::on_zalo_intake` | Legacy capture/bridge into `core/channel-gateway` listener infra | Depends on bound listeners |

### 2.2 Hook `bizcity_zalo_message_received` (normalized `$message_data`)

| Priority | Class::method | Purpose | Replies to user? | Checks claim flag? |
|---|---|---|---|---|
| 1 | `BizCity_Automation_Listener::on_zalo_direct` | FE "Test Listen" capture only | No | — |
| 3 | User Linker `maybe_auto_send_link` | Auto-send login link to unlinked users | Yes (link card, cooldown-gated) | No (separate concern — always safe) |
| 4 | **`BizCity_Zalobot_Command_Router::handle`** | Explicit identity commands (`đăng nhập`/`hủy liên kết`/`thông tin`/`help`) | Yes | **✅ Yes (fixed 2026-07-24)** |
| 5 | `BizCity_Zalo_Bot_Guru_Bridge::maybe_handle` | Alternative AI reply via `BizCity_Guru_Runtime` (opt-in, `bizcity_zalo_guru_enabled=1`) | Yes, if enabled | **✅ Yes (fixed 2026-07-24)** |
| 5 | Universal Channel Listener `bridge_zalo` | Re-normalizes payload → fires `bizcity_channel_normalized` (re-enters matcher via `on_channel_normalized`, deduped by `mid_seen_persistent()`) | No direct reply | n/a (dedup handled inside matcher) |
| 10 | `BizCity_Zalo_Bot_Gateway_Bridge::bridge_to_gateway` | Legacy bridge into `core/channel-gateway` generic trigger engine (`bizcity_gateway_fire_trigger()` — a **different** rule engine than `core/automation` workflows) | Depends on Channel Gateway triggers configured | **⚠️ Not wired (known gap, §6 — different subsystem, do not blind-copy the guard)** |
| 10 | `BizCity_Channel_Listener_Bus::on_zalo_message` | Legacy capture | No | — |

---

## 3. The claim flag contract — `$GLOBALS['bizcity_automation_matched_mids']`

```php
// Written ONLY by BizCity_Automation_Trigger_Matcher::on_channel_message()
// (ref-match branch AND keyword-match branch), keyed by the raw Zalo
// message_id ($mid = (string) $message['message_id']):
$GLOBALS['bizcity_automation_matched_mids'][ $mid ] = true;
```

- **Scope:** request-local (`$GLOBALS`, not persisted) — valid only within the same PHP request that received the webhook. This is correct because both hooks (§2.1 and §2.2) fire synchronously in the same request.
- **Set when:** an ENABLED workflow matched via ref-based deep-link OR keyword/filter match (i.e. `$matched` is non-empty in `on_channel_message()`). NOT set for slash-command dispatch (handled by `BizCity_Skill_Slash_Matcher`, separate tier) or fallback/default-reply (intentional — fallback is the lowest precedence, generic responders MAY still apply when nothing more specific matched).
- **Must be checked by:** any listener on `bizcity_zalo_message_received` (or later) whose reply is a *generic* responder — i.e. NOT itself part of the matched workflow's own action chain. Currently wired:
  - ✅ `BizCity_Zalobot_Command_Router::handle()` — bails immediately if flag set for this `message_id`.
  - ✅ `BizCity_Zalo_Bot_Guru_Bridge::maybe_handle()` — bails immediately if flag set for this `message_id`.
- **Must NOT be checked by:** the matcher itself (obviously), or listeners that only capture/log (FE Test Listen, JSONL debug mirror) — capturing raw traffic for debugging must never be suppressed.

---

## 4. Precedence rule (canonical order, highest → lowest)

1. **Resume / pending multi-turn state** (`BizCity_Automation_Pending_State`) — user is mid-conversation in a workflow slot-filling step.
2. **Ref-based deep-link match** (UUID in message → specific workflow).
3. **Slash-command dispatch** (`/cmd` → `BizCity_Skill_Slash_Matcher`, Tier 1 skill or Tier 2 workflow).
4. **Keyword/filter match** — an ENABLED, non-fallback workflow whose `trigger_config.keywords`/`filter` matches the message text.
5. **Generic bot commands** (Command Router: login/unlink/info/help) — ONLY if nothing above matched (claim flag unset).
6. **Guru AI Bridge** (opt-in persona reply) — ONLY if nothing above matched (claim flag unset).
7. **Fallback workflows** (`is_fallback=true`, sorted by priority) / **TwinBrain default reply** — lowest precedence, catch-all when no workflow and no generic command applied.

Steps 1–4 happen entirely inside `BizCity_Automation_Trigger_Matcher::on_channel_message()`, driven by the `bizcity_zalo_webhook_intake` hook (fires first). Steps 5–6 happen later on `bizcity_zalo_message_received` and now correctly defer to 1–4 via the claim flag. Step 7 only fires when the matcher itself found nothing (see `on_channel_message()` empty-`$matched` branch).

---

## 5. Anti-patterns CẤM TUYỆT ĐỐI

- ❌ Thêm một `$GLOBALS['...']` claim flag mới mà không có ít nhất 1 consumer thực tế trong cùng PR — dead flag = false precedence.
- ❌ Sửa/thêm generic responder mới trên `bizcity_zalo_message_received` (hoặc hook tương đương của FB/Telegram/WebChat) mà không check `$GLOBALS['bizcity_automation_matched_mids'][$message_id]` trước khi reply.
- ❌ Dùng `strpos()`/substring match cho command keyword tổng quát (login/info/help) mà không có max-length guard — câu dài chứa từ khóa trùng ngẫu nhiên (vd "thông tin sản phẩm...") sẽ bị hijack. Xem `BizCity_Zalobot_Command_Router::MAX_COMMAND_LEN` (40 ký tự) làm mẫu.
- ❌ Generic command detect chạy trên message có `image_url`/`file_url` — attachment luôn là content/task request, không phải identity command.
- ❌ Copy cơ chế claim-flag này sang `class-gateway-bridge.php` mà không hiểu nó là **rule engine khác** (`core/channel-gateway` generic triggers, không phải `core/automation` workflows) — nhầm lẫn 2 hệ thống là bug khác, xem §6.
- ❌ Đổi flag key thành thứ khác `message_id` (vd `chat_id`) — sẽ suppress toàn bộ conversation thay vì đúng 1 message.

---

## 6. Known gaps / follow-ups (không nằm trong scope fix 2026-07-24)

1. **`class-gateway-bridge.php::bridge_to_gateway()` (priority 10) chưa check claim flag.** Đây là bridge sang `core/channel-gateway` generic trigger engine (`bizcity_gateway_fire_trigger()`), một hệ thống match/rule KHÁC với `core/automation` workflows (Channel Gateway "Notify Bindings" / legacy triggers). Trước khi wire guard vào đây cần xác nhận: (a) hệ thống này có match riêng theo keyword của chính nó không, (b) việc bail có làm mất tính năng Channel Gateway hợp pháp không liên quan gì đến automation workflow. Cần audit riêng, không blind-copy.
2. **`$GLOBALS['bizcity_zalobot_unlinked_skip']` vẫn là dead flag.** 4 nơi ghi (`class-command-router.php` x2, `class-user-linker.php`, `class-personal-zalo-listener.php`), 0 nơi đọc. Cần quyết định: wire consumer thật (Guru Bridge / Gateway Bridge nên bail khi user chưa link + flag này set) hoặc deprecate/xóa hẳn để tránh gây hiểu lầm cho contributor sau. Chưa fix trong pass này vì cần xác nhận rõ intent ban đầu trước khi implement.
3. **FB Messenger / Telegram / WebChat chưa audit tương tự.** Rule này mới verify cho Zalo Bot. Nếu các channel khác có cùng pattern (multi-listener trên cùng hook, generic command responder cạnh automation matcher), cần audit + áp cùng rule (claim-flag check) — chưa làm trong pass này.

---

## 7. Reference impl (mẫu copy khi thêm generic responder mới)

```php
// [YYYY-MM-DD Johnny Chu] RULE-INBOUND-DISPATCH-PRIORITY — bail if an
// automation workflow already claimed this message (ref/slash/keyword match
// runs earlier on bizcity_zalo_webhook_intake, priority 5).
$message_id = (string) ( $msg['message_id'] ?? '' );
if ( $message_id !== '' && ! empty( $GLOBALS['bizcity_automation_matched_mids'][ $message_id ] ) ) {
    return;
}
```

- `plugins/bizcity-zalo-bot/includes/class-command-router.php::handle()` — generic identity commands.
- `plugins/bizcity-zalo-bot/includes/class-guru-bridge.php::maybe_handle()` — opt-in Guru AI reply.
- Producer: `core/automation/includes/class-automation-trigger-matcher.php` — ref-match branch (~line 374) and keyword-match branch (~line 588).

---

## Changelog

- v1.0 (2026-07-24): Initial. Documents the verified Zalo Bot listener/hook priority chain, revives the dead `bizcity_automation_matched_mids` flag as the canonical cross-listener claim signal, wires Command Router + Guru Bridge as consumers, and records the still-open gaps (Gateway Bridge, `bizcity_zalobot_unlinked_skip`, other channels).
