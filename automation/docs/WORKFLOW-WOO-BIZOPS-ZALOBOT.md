# Workflow Woo BizOps — Zalo Bot (ROADMAP, chưa có code)

> **Status:** IN PROGRESS · query + digest action foundation implemented; chưa seed template/live DDV
> **Phase-ID:** `PHASE-TWB-WOO-BIZOPS`
> **Scope:** Zalo Bot Zone 2 (kênh quản trị) → TwinBrain Woo BizOps → trả lời admin
> **Canonical spec:** [TWINBRAIN-EXT-VERTICAL-WOO-BIZOPS.md](../../twinbrain/docs/TWINBRAIN-EXT-VERTICAL-WOO-BIZOPS.md)
> **Điều kiện tiên quyết (BLOCKING cho Nhóm H/I — marketing/loyalty/customer 360):** [PHASE-CRM-CONTACTS-UNIFY-WOO-USERPOINTS.md](../../../plugins/bizcity-twin-crm/docs/PHASE-CRM-CONTACTS-UNIFY-WOO-USERPOINTS.md)
> **Owner:** TwinBrain + Automation + Channel Gateway

---

## 1. Mục tiêu

Cho phép CEO/Admin hỏi số liệu kinh doanh WooCommerce (doanh thu, đơn hàng,
khách hàng, tồn kho, trạng thái giao hàng) qua Zalo Bot, dùng chung Resolver
Service với TwinChat (§6 tài liệu canonical) — không fork logic riêng cho Zalo.

**Khác biệt bắt buộc so với mọi workflow Zalo hiện có (Super-MRO, Astro, Notebook
@note/@thuky):** đây là kênh **chỉ dành cho admin/chủ shop**, không phải kênh
CSKH khách hàng. Toàn bộ thiết kế phải ưu tiên **an toàn dữ liệu doanh thu** hơn
là tiện lợi truy cập.

---

## 2. Rà soát hiện trạng (grounded)

| Contract | Anchor | Kết luận |
|---|---|---|
| Zalo Bot trigger | `trigger.zalo_inbound` (`core/automation/includes/blocks/triggers/class-trigger-zalo.php`) | Zone 2 — kênh quản trị, đúng zone cho vertical này |
| Zalo output | `action.reply_zalo` | Đã có owner/chat guard (`assert_zalo_chat_owner`) |
| Pattern action block mỏng | `action.run_products` (`core/automation/includes/blocks/actions/class-action-run-products.php`) | Copy khuôn: block chỉ gọi Resolver Service, không viết logic domain |
| Resolver Service Woo BizOps | **Foundation tồn tại** | Query revenue/points/purchase/fulfillment/top-customer/inventory đã có; advanced analytics vẫn phải xây theo §6 canonical |
| FE Builder block | `action.run_woo_bizops` + `action.run_woo_bizops_digest` trong `frontend/src/blocks/registry.js` + built artifact | Đã có metadata/outputs/simulator; chưa seed template/live Zalo |
| Woo data bridges | `plugins/bizcity-twin-crm/includes/woo/*` | Đã có Reports/Order/Customer/Invoice/Shipping bridge — dùng làm nguồn |
| Admin capability gate mẫu | `manage_woocommerce`/`manage_options` (WordPress core) | Chưa có wiring riêng cho Zalo Bot context — phải thêm mới |

**Kết luận:** `action.run_woo_bizops` đã có foundation và chưa có template seed.
`action.run_woo_bizops_digest`, advanced analytics, live Zalo workflow và DDV
vẫn là roadmap; không claim production-ready.

---

## 3. Admin identity cho Zalo Bot — vấn đề riêng cần giải quyết trước

Khác với `action.reply_zalo` hiện tại (chấp nhận trả lời bất kỳ `chat_id` nào
thuộc owner của workflow), action `run_woo_bizops` cần một lớp xác định
**"chat_id này có phải là chủ shop/admin thật không"** nghiêm ngặt hơn mức mặc
định, vì hậu quả rò rỉ là số liệu doanh thu/khách hàng.

Đề xuất (chưa code, cần thiết kế kỹ ở N9):

1. Workflow Woo BizOps **bắt buộc** cấu hình tường minh `instance_id` (Zalo Bot
   cụ thể) và không dùng cờ "để trống = mọi bot".
2. `chat_id` phải được xác nhận thuộc `wp_user_id` có capability
   `manage_woocommerce`/`manage_options` tại thời điểm hỏi (không cache quyền
   lâu dài — quyền có thể bị thu hồi giữa hai lần hỏi).
3. Nếu owner mất quyền (ví dụ bị hạ role) → workflow phải từ chối trả lời với
   thông báo rõ ràng, không fallback sang trả lời rỗng im lặng.
4. Không cho phép group chat sử dụng workflow này ở phiên bản đầu (v0.1) —
   chỉ private chat 1-1 giữa Zalo Bot và admin đã link.

---

## 4. Action blocks đề xuất (ROADMAP — chưa tạo)

### 4.1 `action.run_woo_bizops`

Mục đích: trả lời câu hỏi số liệu tức thời (Nhóm A-F trong tài liệu canonical
§3: doanh thu, thanh toán, giao hàng, khách hàng, tồn kho, hoàn tiền). Nhóm H/I
(Marketing/Loyalty/Customer 360) chỉ được bật sau khi Contacts Unify đã PASS.

Input đề xuất (theo khuôn `action.run_products`):

```text
query            — {{trigger.text}}
date_range_hint  — rỗng hoặc "today|yesterday|this_week|this_month|custom"
max_results      — giới hạn số dòng trả về cho danh sách đơn/khách hàng
require_admin    — mặc định true, không cho tắt qua UI thường
```

Output đề xuất (theo khuôn `action.run_products` output contract):

```text
ok, intent_group, date_from, date_to, metrics_json, orders_sample_json,
customers_sample_json, citations_json, degraded, error_code, error_message
```

### 4.2 `action.run_woo_bizops_digest`

Mục đích: bản tóm tắt điều hành định kỳ (Nhóm G — "tóm tắt tình hình hôm nay";
Nhóm H/I chỉ khi Contacts Unify đã PASS),
dùng cho cron báo cáo sáng, theo mẫu đã có
`bp_internal_standup_v1`/`bp_internal_weekly_v1` trong
`core/automation/includes/class-automation-templates-seeder.php`.

### 4.3 Nguyên tắc bắt buộc cho cả hai block

- Block **KHÔNG** tự viết SQL hay gọi `wc_get_orders()` trực tiếp — chỉ gọi
  `BizCity_TwinBrain_Woo_Bizops_Resolver_Service` (một khi class này tồn tại).
- Block phải guard `class_exists('BizCity_TwinBrain_Woo_Bizops_Resolver_Service')`
  và trả `module_not_loaded` rõ ràng nếu chưa có, theo đúng R-ERROR-UX.
- Mọi lỗi phải qua `BizCity_Error_Payload::make()` với đủ 4 trường
  (`code, message, hint, help_code`).

---

## 5. Template đề xuất (ROADMAP — chưa seed)

### 5.1 `tpl_zalo_woo_bizops_query_v1` (dự kiến)

```text
trigger.zalo_inbound
  instance_id: <bắt buộc chọn cụ thể, không để trống>
  filter: "@bizops" hoặc "doanh thu"/"đơn hàng"/"tồn kho" (cần thảo luận UX)
  priority: cao, exclusive: true
      │
      ▼
action.run_woo_bizops
  query: {{trigger.text}}
      │
      ├── action.reply_zalo
      │     text: {{bizops.answer_md}}
      │
      └── action.create_crm_event (audit, KHÔNG chứa số liệu nhạy cảm trong title public)
```

### 5.2 `tpl_cron_woo_bizops_morning_digest_v1` (dự kiến)

```text
trigger.cron  (0 8 * * *)
      │
      ▼
action.run_woo_bizops_digest
      │
      ▼
action.reply_zalo  (gửi tới chat_id admin đã cấu hình cố định, KHÔNG dựa vào
                     trigger context vì cron không có trigger inbound)
```

**Lưu ý bắt buộc:** với template cron, `reply_zalo` phải cấu hình
`instance_id` + `override_chat_id` tường minh trỏ đúng admin đã xác nhận —
không dùng owner fallback "My Channels" mặc định nếu owner không phải người có
`manage_woocommerce`.

### 5.3 Chưa quyết định: từ khoá kích hoạt (`filter`)

Dùng từ khoá tự nhiên ("doanh thu hôm nay") có rủi ro đụng độ với các workflow
CSKH khác nếu Zalo Bot này dùng chung cho nhiều mục đích. Khuyến nghị v0.1: bắt
buộc một Zalo Bot **riêng** cho admin (không dùng chung bot CSKH khách hàng),
hoặc dùng prefix rõ ràng (`@bizops <câu hỏi>`) giống pattern `@note`/`@thuky` đã
áp dụng cho Notebook. Quyết định cuối cùng nằm ở N9 khi có yêu cầu triển khai
thật.

---

## 6. Fail-closed matrix (đề xuất)

| Tình huống | Hành vi |
|---|---|
| `wp_user_id` không có `manage_woocommerce`/`manage_options` | Từ chối trả lời, không lộ số liệu một phần |
| Group chat | Từ chối theo mặc định v0.1 |
| WooCommerce không active | `_degraded=module_not_loaded`, không bịa số |
| Resolver Service chưa deploy | `module_not_loaded`, hướng dẫn liên hệ kỹ thuật |
| Câu hỏi mơ hồ về khoảng ngày | Hỏi lại, không tự đoán range |
| Owner bị thu hồi quyền giữa phiên | Từ chối ngay lượt hỏi tiếp theo, không dùng quyền cũ đã cache |

---

## 7. Rollout plan (chỉ khi có quyết định code — hiện tại KHÔNG code)

### R0 — Tài liệu (DONE — chính tài liệu này + tài liệu canonical)

### R1 — Nền tảng TwinBrain (phụ thuộc N2-N6 của tài liệu canonical)

- Resolver Service + Engine + Composer phải PASS DDV trên TwinChat trước khi
  đụng tới Automation/Zalo.

### R2 — Action block

- [x] Tạo `action.run_woo_bizops` theo khuôn `action.run_products`.
- [x] Tạo `action.run_woo_bizops_digest` theo khuôn thin resolver wrapper; có `note_event()` cho cron evidence.
- Thêm admin capability re-check trong block (không tin cache cũ).

### R3 — Template + seed

- Seed 2 template ở §5, bump `SEED_VERSION`, đăng ký `template_uuid`/`template_version`.
- Test single-claim, không đụng độ với workflow CSKH khác trên cùng bot.

### R4 — DDV

- Probe xác nhận: admin thật nhận được số liệu đúng; user không đủ quyền bị
  từ chối; group chat bị từ chối; cron digest gửi đúng admin cố định.

---

## 8. Anti-patterns cấm (bổ sung riêng cho Zalo)

- Không dùng chung Zalo Bot của kênh CSKH khách hàng cho vertical này nếu chưa
  có cơ chế phân quyền theo `chat_id` thật chặt chẽ.
- Không để workflow trả lời số liệu cho group chat ở v0.1.
- Không cache quyền `manage_woocommerce` lâu dài trong `trigger_config` — phải
  kiểm tra lại capability tại thời điểm chạy.
- Không seed template trước khi Resolver Service có DDV PASS trên TwinChat.
- Không dùng `filter` từ khoá trùng với workflow CSKH khách hàng đang chạy trên
  cùng instance (rủi ro RULE-TRIGGER-SINGLE-CLAIM/RULE-INBOUND-DISPATCH-PRIORITY).

---

## 9. Tài liệu liên quan

- [TWINBRAIN-EXT-VERTICAL-WOO-BIZOPS.md](../../twinbrain/docs/TWINBRAIN-EXT-VERTICAL-WOO-BIZOPS.md) — đặc tả vertical đầy đủ (bắt buộc đọc trước).
- [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md)
- [RULE-INBOUND-DISPATCH-PRIORITY.md](RULE-INBOUND-DISPATCH-PRIORITY.md)
- [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md)
- [WORKFLOW-PRODUCTS-ZALOBOT.md](WORKFLOW-PRODUCTS-ZALOBOT.md) — mẫu workflow vertical đã ship, dùng để đối chiếu khuôn mẫu.

---

## 10. GAP register cho đường Zalo Bot

| ID | Severity | GAP | Gate trước khi seed template |
|---|---|---|---|
| `ZALO-C1` | Critical | `action.run_woo_bizops` và Resolver Service chưa tồn tại | Không seed; phải có Loader/Runtime PASS |
| `ZALO-C2` | Critical | `wp_user_id` trong inbound Zalo chưa được chứng minh là capability owner của shop | Phải có handshake Zalo identity → linked WP user → capability re-check |
| `ZALO-C3` | Critical | Chưa có contract ngăn `woo_bizops` lọt sang generic default reply/public channel | Matcher phải claim đúng Zone 2 và không fallback trả số liệu |
| `ZALO-H1` | High | Cron digest không có inbound trigger để tự chứng minh quyền tại thời điểm chạy | `instance_id` + `override_chat_id` phải trỏ owner đã xác minh; re-check trước send |
| `ZALO-H2` | High | Chưa có PII masking/response-size policy cho danh sách đơn, phone, points | Chỉ trả sample/counters; chi tiết dùng citation admin-scoped |
| `ZALO-H3` | High | Chưa có replay/idempotency contract cho query và digest | Mỗi run có trace/correlation; không gửi trùng khi retry |
| `ZALO-M1` | Medium | Chưa có date/timezone contract cho "hôm nay", "tuần này" | Dùng timezone của blog/shop, echo `from/to` trong response |
| `ZALO-M2` | Medium | Chưa có degraded contract khi Contacts unify chưa PASS | Customer 360/points cohort phải trả blocked/degraded, không trả số một phần |
| `ZALO-M3` | Medium | Chưa có multisite/shard isolation E2E | Query ở blog A không được đọc Contact/order/points của blog B |

### 10.1 Zalo Definition of Done

- [ ] Admin private chat only; group chat bị từ chối ở v0.1.
- [ ] Capability được resolve từ linked `wp_user_id` và kiểm tra lại trong cùng
  request/run, không lấy từ workflow creator hoặc cached role.
- [ ] Query không có số liệu nhạy cảm trong title/log public; phone được mask
  trừ khi người hỏi có policy xem chi tiết.
- [ ] Retry không gây double reply; digest retry không gửi trùng.
- [ ] `goal_contract_ready`, `woo_bizops_domain_gate`,
  `woo_bizops_query_executed`, `final_done` và `goal_delta/post_turn` có cùng
  trace trước `action.reply_zalo`.
- [ ] Nếu `CONTACTS_UNIFY` chưa PASS, các câu hỏi repeat/customer-360/points
  cohort chuyển sang blocked/degraded với hướng dẫn, không fallback sang lookup
  phone rời rạc rồi tuyên bố đã hợp nhất.
