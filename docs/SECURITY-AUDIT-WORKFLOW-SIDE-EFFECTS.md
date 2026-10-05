# Automation Core - Phân tích lỗ hổng side-effect và webhook

- **Ngày phân tích:** 2026-08-12
- **Phạm vi:** `core/automation` active runtime, không dùng `_archived/` làm bằng chứng runtime.
- **Trạng thái:** Phân tích và security design. Chưa coi các yêu cầu trong tài liệu này là đã triển khai cho tới khi có patch + DDV runtime.
- **Mức độ tổng quát:** CRITICAL cho workflow publish do user quyền thấp; HIGH cho owner injection và webhook abuse.

## 1. Kết luận điều hành

Việc gỡ plugin `AI Content Writing Assistant` không đóng toàn bộ đường tạo bài spam. Core Automation hiện có action `action.publish_wp_post`, cho phép workflow tạo post với `status=publish` và nhận `author_id` từ graph. Đường REST workflow hiện cho user có capability `read` tạo workflow; workflow mới có thể được bật ngay. Vì vậy một Subscriber hoặc user bị chiếm quyền có thể tạo workflow side-effect và publish bài mà không đi qua đường AJAX cũ của AIWA.

Webhook active không còn giống finding lịch sử `canAccessWebhook() luôn return true` trong plugin cũ: matcher hiện yêu cầu `trigger_config.secret` không rỗng và token phải khớp. Tuy nhiên, token được kiểm tra sau rate-limit và sau capture hook; owner lại có thể bị lấy từ `wp_user_id`/`_owner_user_id` do caller gửi. Đây vẫn là các lỗ hổng cần sửa.

## 2. Bằng chứng code active

### 2.1. Quyền tạo workflow quá rộng

- `BizCity_Automation_REST::workflow_write_allowed()` cho phép `manage_options` **hoặc** `read`.
- `create_workflow()` gọi mutation preflight nhưng context hiện cấp `content.write` cho request create mà không phân biệt workflow có side-effect hay không.
- `BizCity_Automation_Repo_Workflows::normalise()` nhận `enabled` từ input và mặc định `enabled=1` cho workflow mới.
- Graph validation kiểm tra có trigger và cấu trúc node/edge, nhưng không phải security policy cho các action side-effect.

File liên quan:

- `includes/class-automation-rest.php`
- `includes/class-automation-repo-workflows.php`
- `core/twin-core/includes/class-twin-mutation-guard.php`

### 2.2. `publish_wp_post` có khả năng publish và chọn author tùy ý

`BizCity_Automation_Action_Publish_WP_Post` hiện:

- Cho phép `status` là `draft`, `pending`, `publish`.
- Nhận `author_id` từ node data.
- Nếu `author_id` khác `0`, dùng trực tiếp giá trị đó.
- Gọi `wp_insert_post()` với `post_author` mà không kiểm tra caller có `publish_posts` hoặc author có thuộc owner hay không.

Hệ quả:

- User quyền `read` có thể tạo workflow publish nếu route workflow cho phép.
- Có thể đặt `author_id` thành user khác, bao gồm admin ID.
- `wp_insert_post()` không phải authorization boundary; caller phải kiểm quyền trước khi tạo post.

File liên quan:

- `includes/blocks/actions/class-action-publish-wp-post.php`
- `includes/blocks/abstract-block.php`

### 2.3. Webhook public route và thứ tự xác thực

Route `POST /bizcity-automation/v1/webhook/{slug}` dùng `permission_callback => __return_true` vì đây là public integration endpoint. Đây chỉ an toàn khi handler bên trong có auth đầy đủ.

Hiện tại:

1. REST handler tăng transient rate-limit theo slug.
2. REST handler đọc body và gọi matcher.
3. Matcher phát `bizcity_automation_webhook_received` để capture Test Listen.
4. Matcher mới lookup workflow và kiểm tra secret/token.
5. Sau đó mới enqueue run.

Rủi ro:

- Request không có token vẫn tiêu hao rate-limit của slug.
- Attacker biết slug có thể làm provider hợp lệ nhận `429`.
- Capture hook nhận payload trước auth; nếu admin đang Test Listen, payload rác được ghi vào transient.
- `?token=` được chấp nhận, làm secret có thể lọt vào access log, proxy log, history hoặc referrer.

File liên quan:

- `includes/class-automation-rest.php`
- `includes/class-automation-trigger-matcher.php`
- `includes/class-automation-listener.php`

### 2.4. Owner injection từ webhook payload

`dispatch_webhook()` hiện chỉ bổ sung owner khi payload chưa có:

```text
if _owner_user_id is empty:
    _owner_user_id = payload.wp_user_id OR workflow.created_by
if wp_user_id is empty:
    wp_user_id = _owner_user_id
```

Runner lại ưu tiên `trigger_payload.wp_user_id`, sau đó tới run user, `_owner_user_id`, rồi workflow creator.

Hệ quả: hệ thống gửi webhook hợp lệ có thể gửi `wp_user_id` hoặc `_owner_user_id` của user khác và làm workflow chạy với identity không thuộc owner workflow. Webhook secret xác thực nguồn gọi, không chứng minh rằng các identity tùy ý trong JSON là hợp lệ.

Owner canonical cho webhook phải là owner của workflow hoặc binding owner được server resolve. Payload chỉ được giữ như dữ liệu sự kiện, không được dùng làm authority.

## 3. Security contract bắt buộc

### Rule 1 - Workflow side-effect capability gate

Chỉ cho phép `manage_options` hoặc capability riêng, đề xuất `bizcity_automation_side_effects`, tạo hoặc bật workflow có action side-effect.

Nhóm side-effect tối thiểu:

- `action.publish_wp_post`
- `action.publish_fb_post`
- `action.reply_zalo`
- `action.reply_fb_message`
- `action.send_email`
- `action.http_request`
- `action.schedule_event`
- `action.create_crm_event`
- các action ghi DB, gửi channel, upload media, thanh toán hoặc gọi provider ngoài.

Workflow chỉ chứa trigger/logic/LLM/read-only action có thể dùng policy thấp hơn, nhưng phải có allowlist server-side. Không suy luận side-effect từ label FE.

Các điểm phải enforce:

- REST create.
- REST update khi graph hoặc trigger config chuyển workflow sang side-effect.
- REST enable/run.
- Template import/instantiate.
- Cron/scheduler/webhook enqueue nếu workflow chưa qua gate.

### Rule 2 - Customer workflow mặc định disabled

Workflow do customer tạo hoặc import phải được lưu `enabled=0`, bất kể body gửi `enabled=1`.

Chỉ admin hoặc capability riêng mới được enable workflow side-effect. UI có thể hiển thị nút bật, nhưng server phải kiểm tra lại:

```text
customer create/import -> enabled=0
admin approve + side-effect capability -> enabled=1
```

Các đường import community/Hub phải giữ nguyên `enabled=0` cho tới khi user review graph và server phê duyệt.

### Rule 3 - Publish status phải qua capability

`publish_wp_post` phải xác định capability của execution owner/caller:

```text
caller có publish_posts trên target blog -> cho phép status publish
caller không có publish_posts -> publish bị hạ xuống draft hoặc pending
```

Khuyến nghị:

- Default luôn là `draft`.
- `pending` chỉ dùng khi site có workflow editorial và caller có quyền gửi duyệt.
- Không tin `status` từ graph nếu capability không đủ.
- Cron không có current user phải dùng owner đã resolve và kiểm tra `user_can(owner, 'publish_posts')`.
- Nếu owner không tồn tại hoặc không còn quyền, fail closed, không tự dùng admin/current user.

### Rule 4 - Khóa `author_id`

Không cho customer dùng `author_id` tùy ý.

Chính sách đề xuất:

- Customer graph chỉ được `author_id=0`.
- Server resolve author bằng workflow owner hoặc canonical inbound owner.
- Admin có capability riêng mới được chọn `author_id` khác 0.
- Khi admin chọn author, phải kiểm tra `user_can(author_id, 'edit_posts')`; nếu status là publish thì phải kiểm tra thêm `user_can(author_id, 'publish_posts')`.
- Author phải thuộc blog/shard hiện tại; không nhận user ID từ payload channel để vượt ownership.
- Nếu author không hợp lệ: trả `author_not_allowed`, không fallback sang user hiện tại/admin.

Validation phải chạy lúc save graph và lặp lại lúc execute. Save-time validation không đủ vì graph/template có thể được import hoặc thay đổi qua đường khác.

### Rule 5 - Webhook owner lấy từ workflow

Sau khi lookup workflow và xác thực secret:

```text
owner_user_id = workflow.created_by
```

Nếu workflow có binding owner riêng, server resolve binding đó và kiểm tra ownership. Không nhận authority từ:

- `wp_user_id`
- `_owner_user_id`
- `user_id`
- `owner_user_id`
- `created_by`

trong webhook body.

Các field trên có thể được giữ trong `trigger_payload` dưới namespace untrusted để phục vụ dữ liệu nghiệp vụ, nhưng không được copy vào `_owner_user_id`, `run.user_id`, `post_author`, channel account hoặc private memory scope.

### Rule 6 - Token trước rate-limit và capture hook

Thứ tự bắt buộc của webhook:

```text
normalize slug
  -> lookup enabled webhook workflow
  -> require non-empty secret
  -> verify header token bằng hash_equals
  -> apply rate-limit theo token/IP/slug
  -> sanitize payload + stamp workflow owner
  -> enqueue run
  -> emit accepted/enqueued hook
```

Không phát `bizcity_automation_webhook_received` cho request chưa xác thực. Nếu cần Test Listen cho request thất bại, chỉ ghi reason bucket tối thiểu, không ghi full payload.

Rate-limit nên dimension tối thiểu theo:

- normalized slug
- client IP
- token fingerprint/hash ngắn, không ghi full token

Request thiếu hoặc sai token nên chịu backoff riêng, không làm cạn quota của provider đã xác thực.

### Rule 7 - Không nhận secret qua query

Chỉ nhận secret từ header:

```text
X-Bizcity-Webhook-Token: <secret>
```

Không nhận `?token=` hoặc body token cho production webhook. Nếu cần migration compatibility, chỉ cho phép trong thời hạn rõ ràng, log reason bucket không chứa token và trả cảnh báo deprecation.

Không ghi full token, hash đầy đủ, payload nhạy cảm hoặc query string chứa credential vào log.

## 4. Threat model

| Threat | Điều kiện | Tác động | Severity |
|---|---|---|---|
| Subscriber tạo workflow publish | User có `read`, REST workflow create cho phép | Spam post, post dưới author tùy ý | CRITICAL |
| Customer chọn admin `author_id` | Graph nhận author tùy ý | Giả mạo tác giả, vượt ownership | HIGH |
| Webhook owner spoof | Có webhook secret, payload chứa owner fields | Chạy block/private resource dưới identity khác | HIGH |
| Webhook rate-limit exhaustion | Biết slug, không cần token | Provider hợp lệ bị 429 | HIGH |
| Query token leakage | Caller dùng `?token=` | Credential exposure/replay | HIGH |
| Pre-auth Test Listen capture | Admin đang bật listener | Payload rác, nhiễu transient/debug | MEDIUM |
| Empty webhook secret | Workflow enabled nhưng thiếu secret | Hiện matcher đã từ chối 503 | CLOSED in current matcher; keep regression test |
| Legacy `/waic/v1/webhook-test` | Chỉ thấy trong `_archived/` | Không phải active evidence | CLOSED as active-path finding |

## 5. Kế hoạch triển khai an toàn

### Phase A - Block privilege escalation

1. Tạo capability `bizcity_automation_side_effects` tại activation/role migration.
2. Viết helper server-side `workflow_contains_side_effects(graph)` dựa trên block registry/allowlist.
3. Chặn create/update/enable/run side-effect nếu user không có `manage_options` hoặc capability riêng.
4. Ép customer workflow `enabled=0` tại repository boundary, không chỉ REST handler.
5. Thêm audit reason bucket `side_effect_capability_required`.

### Phase B - Harden WordPress publisher

1. Tách `resolve_publish_author()` thành helper canonical.
2. Customer không được truyền author tùy ý.
3. Hạ `publish` xuống `draft`/`pending` khi thiếu `publish_posts`.
4. Recheck tại execute trước `wp_insert_post()`.
5. Thêm test cho author admin ID, author khác owner, user bị hạ role và cron owner.

### Phase C - Harden webhook

1. Lookup workflow và verify token trước rate-limit.
2. Chỉ nhận token từ `X-Bizcity-Webhook-Token`.
3. Chuyển capture hook sau auth thành công.
4. Stamp owner từ workflow row.
5. Xóa hoặc ignore identity authority trong payload.
6. Rate-limit theo slug + IP + token fingerprint và thêm backoff cho token sai.
7. Thêm JSONL evidence cho `webhook_auth_failed`, `webhook_rate_limited`, `webhook_accepted`, `webhook_owner_resolved`.

## 6. DDV bắt buộc

### Disk

- `class-automation-rest.php` có side-effect capability helper.
- `class-automation-repo-workflows.php` ép customer workflow `enabled=0`.
- `class-action-publish-wp-post.php` không dùng `author_id` customer tùy ý.
- `class-automation-trigger-matcher.php` xác thực token trước capture và rate-limit.
- Không còn active caller dùng query `?token=`.

### Loader

- Capability migration được load trước REST registration.
- Block registry/side-effect policy đã load khi create/update/execute workflow.
- Publisher helper và webhook matcher được load trong cùng runtime path với REST, cron và webhook.

### Runtime

1. Subscriber tạo workflow có `publish_wp_post` -> `403 side_effect_capability_required`.
2. Subscriber tạo workflow read-only -> tạo được nhưng `enabled=0`.
3. Customer gửi `enabled=1` -> server vẫn lưu `0`.
4. Customer đặt `status=publish` -> post thành `draft` hoặc `pending`.
5. Customer đặt `author_id=1` -> `author_not_allowed` hoặc author bị ép về owner theo policy.
6. Webhook body chứa `wp_user_id=1` -> run vẫn dùng owner của workflow.
7. Webhook sai token -> không tăng quota provider và không tạo capture transient.
8. Webhook đúng token -> mới rate-limit, capture và enqueue.
9. `?token=` -> bị từ chối.
10. Webhook thiếu secret -> `503 webhook_secret_missing`, không enqueue.
11. Workflow chạy từ cron không có current user -> không fallback admin; dùng owner đã xác minh hoặc fail closed.
12. Multi-site/shard route fail -> không execute action và không ghi post/event sang global/current DB.

## 7. Acceptance criteria

Không coi security work hoàn tất khi chỉ sửa permission callback hoặc ẩn field trên UI. Acceptance phải chứng minh toàn chuỗi:

```text
REST create/update/import
  -> side-effect policy
  -> enabled policy
  -> webhook/token/owner policy
  -> runner context
  -> action capability/author policy
  -> wp_insert_post
```

Mọi failure phải có code, message, hint và help_code theo R-ERROR-UX; không trả lỗi string phẳng hoặc lộ secret/payload nhạy cảm.
