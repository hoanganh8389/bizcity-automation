# PHASE — Seed Templates & Guru-as-Trigger Architecture Debate

> **Status:** ~~DESIGN~~ **IMPLEMENTED** · v1.3 · 2026-06-14
> Seeds 1–30 (v1.11.0) ship 2026-06-07. Seeds 31–55 / Wave W1-W25 ship 2026-06-14 (v1.12.0).
> **Owner:** Twin AI Core (BizCity Founder)
> **Companion to:** [PHASE-R-FINAL-ACTION.md](PHASE-R-FINAL-ACTION.md) §6 W3
> **Audience:** Cả BE (block authors) lẫn FE (workflow gallery / library page)

---

## Part A · Seed Templates v1 (ship cùng plugin)

Mục tiêu: ngay khi user kích hoạt module Automation, gallery có sẵn **3
template phổ thông + 4 template chuyên ngành (TwinBrain Wave 1)** để demo
giá trị. Tất cả tuân thủ R-FINAL-ACTION quad-commit.

### Layout chung của 1 seed

```
trigger (channel keyword | webchat slash | guru @mention)
   └─ condition (optional: time-of-day, language, channel allow)
        └─ action chain (cuối luôn là final action quad-commit)
```

Seed lưu trong `core/automation/seeds/<slug>.json` (schema = workflow
export). Bootstrap đọc lần đầu và insert vào `bizcity_automation_workflows`
với `is_seed = 1`, `status = draft` (user phải Publish bằng tay để bật).

### Seed 1 — `reminder-natural-language` (nhắc lịch tự nhiên)

```
Trigger:
  - channel: zalo_bot|webchat|twinchat (any inbound)
  - keyword regex: /\bnhắc(\s+(tôi|mình|sếp))?\b|\b(remember|nhớ giúp)\b/iu

Layers:
  L1. TwinBrain.parse_datetime  (skill = time_extract)
       in:  trigger.text
       out: {when_iso, intent, title}
  L2. Condition: when_iso exists  → next, else reply "không hiểu thời gian"
  L3. Action: scheduler_create_event (event_type=reminder, start_at=when_iso)
       + Quad-commit:
         ① row trong bizcity_scheduler_events
         ② "✅ Đã nhớ: <title> lúc <when_iso>"
         ③ link sửa: scheduler#event-{id}
         ④ T-15min trước reminder → cron worker reply "⏰ Sắp tới giờ"
```

### Seed 2 — `knowledge-twinbrain-router` (hỏi & router)

```
Trigger:
  - channel: any
  - keyword: /^@(hỏi|tra|kiến\s*thức|knowledge)\b/iu  OR /^\/(ask|kb)\b/i

Layers:
  L1. TwinBrain.classify_domain  (skill = domain_router)
       in:  trigger.text
       out: domain ∈ {social|med|gov|law|nutri|scholar|tax|generic}
  L2. Dispatcher (switch on domain):
       - social  → BizCity_TwinBrain_Web_Social.run()      → [sm:N]
       - med     → BizCity_TwinBrain_Web_Med.run()         → [med:N] + disclaimer ⚕️
       - gov     → BizCity_TwinBrain_Web_Gov.run()         → [gov:N]
       - law     → BizCity_TwinBrain_Web_Law.run()         → [law:N]
       - nutri   → BizCity_TwinBrain_Web_Nutri.run()       → [nut:N]
       - scholar → BizCity_TwinBrain_Web_Scholar.run()     → [sch:N]
       - tax     → BizCity_TwinBrain_Web_Tax.run()         → [tax:N]
       - generic → BizCity_TwinBrain_Web_Quick.run()       → [web:N]
  L3. Action: final_reply (quad-commit lite)
       ① scheduler row event_type=knowledge_query (audit trail, status=done)
       ② reply nội dung + citations
       ③ link "Xem evidence": admin.php?page=...&query_id=<id>
       ④ (skipped — đã done luôn, không cần ack)
```

> **R-FINAL-ACTION exception:** Knowledge query là **synchronous final** →
> commit ④ trùng commit ② → cho phép skip ④ kèm note `ack_inline = true`
> trong metadata.

### Seed 3 — `remember-this` (memory write)

```
Trigger:
  - channel: any
  - keyword: /^@(nhớ|ghi\s*nhớ|remember)\b/iu  OR /^\/(remember|note)\b/i

Layers:
  L1. TwinBrain.memory.remember (tool from core/twinbrain/tools/memory/remember)
       in:  {scope=user|guru, content=trigger.text, ttl=null}
       out: {memory_id, recall_keyword}
  L2. Action: final_reply
       ① scheduler row event_type=memory_write (audit), user_id=owner
       ② "🧠 Đã nhớ. Recall bằng: @recall <recall_keyword>"
       ③ link "Quản lý memory": admin.php?page=bizcity-twinbrain&tab=memory
       ④ (skipped — synchronous)
```

### Seeds 4-7 — TwinBrain Wave 1 specialists (1 seed/vertical)

Mỗi seed = wrapper hỏi-đáp chuyên sâu trên 1 vertical (med, gov, law, nutri,
scholar, tax) với prompt khởi đầu chuyên ngành. Trigger keyword riêng:

| Seed slug | Keyword | Vertical | Disclaimer |
|---|---|---|---|
| `ask-med`     | `/^@(med|y\s*tế|sức\s*khỏe)\b/iu`   | Web_Med     | ⚕️ y tế bắt buộc |
| `ask-gov`     | `/^@(gov|nhà\s*nước|chính\s*phủ)\b/iu` | Web_Gov  | — |
| `ask-law`     | `/^@(law|pháp|luật)\b/iu`            | Web_Law     | ⚖️ tư vấn cá nhân disclaim |
| `ask-nutri`   | `/^@(nutri|dinh\s*dưỡng)\b/iu`        | Web_Nutri   | ⚕️ lite |
| `ask-scholar` | `/^@(scholar|nghiên\s*cứu|paper)\b/iu`| Web_Scholar | — |
| `ask-tax`     | `/^@(tax|thuế)\b/iu`                  | Web_Tax     | 💰 disclaimer |

Mỗi seed = bản chất Seed 2 nhưng skip L1 (domain đã hard-pin).

### Seeds 8-9 — Final-Action quad-commit demo

| Seed slug | Mô tả |
|---|---|
| `publish-fb-from-zalo` | Inbound Zalo keyword `@đăng_fb` → LLM compose → publish_fb_post (4 commit) — đã có working impl |
| `publish-web-from-zalo` | Inbound Zalo keyword `@đăng_web` → LLM compose → publish_web_post (4 commit) — TBD W3 |

---

## Part B · Guru-as-Trigger Architecture Debate

> **User proposal (quote 2026-06-02):**
> "Thay vì trigger là từng zalo/webchat/twinchat/facebook, để trigger là 1
> guru (character). Bind guru vào: (1) zalo bot, (2) FB campaign + keyword,
> (3) twinbrain qua `@guru` keyword hoặc `/slug` call. Lúc đó chạy tuần tự
> giống MPR thinking timeline — từng layer step by step."

### B.1 Phản biện thẳng — **không nên** dùng Guru làm trigger primary

| # | Vấn đề | Giải thích |
|---|---|---|
| 1 | **Conflate identity với event** | Guru là PERSONA (who am I), trigger là EVENT (what just happened). Trộn 2 axes → ambiguous khi 1 channel inbound match nhiều guru. |
| 2 | **Mơ hồ many-to-many** | 1 Zalo bot bind 3 guru → user gửi "@hỏi tôi mệt quá" thì guru nào nhận? Phải có rule ưu tiên → quay về channel+keyword scope cũ, chỉ thêm 1 lớp indirection vô ích. |
| 3 | **Channel scope vẫn cần thiết** | Quota, rate-limit, identity binding (Zalo chat_id, FB user_id, WP user_id), audit log — tất cả bind theo CHANNEL, không phải guru. Bỏ channel trigger = mất scope. |
| 4 | **Slug routing collision** | `/dang_fb_daily` có thể trùng giữa multi-tenant guru. Cần reserved namespace + collision check → phức tạp hơn keyword matcher hiện tại. |
| 5 | **Layer-by-layer != trigger** | MPR thinking timeline là **render mode** của ANY workflow, không phụ thuộc trigger type. Channel-trigger workflow vẫn render layer-by-layer được nếu twin_event tap hoạt động. |
| 6 | **Lock-in tới Guru entity** | Hiện workflow độc lập với Guru. Bind guru vào trigger → mất khả năng share workflow cross-guru (lib chung). |

### B.2 Đề xuất hybrid — **`guru_id` là cross-cutting filter, không phải trigger type**

Giữ taxonomy trigger hiện tại (`channel_keyword`, `webchat_slash`, `cron`,
`webhook`, `manual`) và thêm 1 trường tùy chọn:

```json
{
  "trigger": {
    "type": "channel_keyword",
    "config": {
      "channels": ["zalo_bot", "webchat"],
      "keyword_regex": "@đăng_fb",
      "guru_id": 42         // NEW — optional; nếu set, chỉ match khi binding active guru = 42
    }
  }
}
```

Matcher logic:
```
if trigger.config.guru_id != null:
    active_guru = resolve_active_guru(channel_id, chat_id)
    if active_guru != trigger.config.guru_id:
        return SKIP
```

→ Lợi: workflow vẫn là first-class, guru filter là 1 attribute. 1 workflow
chạy được cross-guru bằng cách KHÔNG set `guru_id`. Set guru_id → guard
strict.

### B.3 `@guru` mention & `/slug` slash command

Đề xuất implement bằng 2 trigger type MỚI thay vì sửa channel_keyword:

| Trigger type | Match logic | Routing |
|---|---|---|
| `guru_mention` | Inbound text bắt đầu `@<guru_slug>\b` | Lookup `guru_slug → guru_id`, set context.target_guru_id; chạy workflow nếu workflow.trigger.guru_id == target |
| `slash_command` | Inbound text bắt đầu `/<command_slug>\b` | Lookup `command_slug → workflow_id` (1:1 reserved); ưu tiên hơn keyword matcher |

Slash command có bảng riêng `bizcity_automation_slash_commands(command_slug PK, workflow_id, scope_guru_id, owner_user_id)` — chống collision bằng UNIQUE(command_slug, scope_guru_id).

### B.4 Layer-by-layer rendering — tách khỏi trigger

MPR-style step rendering chỉ cần:
1. Runner emit `twin_event_bus` events theo `layer_started`/`layer_done` (đã có).
2. Channel adapter có khả năng render streaming (twinchat ✅, webchat ✅, zalo ❌ — chỉ text final, FB ❌).

→ Cho channel không streaming, fallback = gửi 1 message "🔄 Đang xử lý
layer 2/4..." mỗi khi layer transition. Independent với guru-trigger.

### B.5 Khuyến nghị cuối

1. **KHÔNG** đổi trigger taxonomy. Giữ `channel_keyword` làm trigger primary.
2. **THÊM** `trigger.config.guru_id` optional filter (1 dòng matcher logic).
3. **THÊM** trigger type mới `guru_mention` + `slash_command` cho UX `@guru` & `/slug`.
4. **TÁCH** MPR layer-rendering thành adapter capability, không phụ thuộc trigger type.
5. **CHƯA** lock-in Guru→workflow 1:N relationship — chờ data sau 2 tháng usage rồi mới quyết phase v2.

---

## Part C · Roadmap đề xuất (sprints)

> **Cập nhật 2026-06-03 (v0.12):** GURU W2 + W3 + Skill Template được tách
> sang spec đầy đủ: **[PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md)**
> (bidirectional MD ↔ JSON converter + chi tiết schema/matcher/DCL). Phần
> dưới giữ làm summary, đọc spec gốc trước khi implement.

| Sprint | Scope | Status |
|---|---|---|
| **SEED W1** | Seeds 1-3 (reminder, knowledge-router, remember) + Seeder v1.7.0 | ✅ 2026-06-02 |
| **SEED W2** | Seeds 4-7 (TwinBrain verticals: web_med, web_social, etc.) | ⬜ |
| **SEED CRM-PATH-2** | Seeds 22-25 (care zone=crm: zalo_oa, classify, tag, fb_messenger) + v1.9.0 | ✅ 2026-06-07 |
| **SEED DEPLAO** | Seeds 26-30 (Deplao CRM-style: keyword/lead/fb-comment/out-of-hours/payment) + v1.11.0 | ✅ 2026-06-07 |
| **SEED W1-W25** | Seeds 31-55 (Woo/CRM/nội bộ/loyalty/voice/AI/HTTP/menu/broadcast) + v1.12.0 | ✅ 2026-06-14 |
| **GURU W1** | `trigger.config.guru_id` cross-cut filter + 4 trigger blocks | ✅ 2026-06-02 |
| **GURU W2** | Trigger type `guru_mention` + auto persona overlay → xem PHASE-WORKFLOW-AS-SKILL §6 | ⬜ DESIGN v0.12 |
| **GURU W3.1/W3.2** | Trigger `slash_command` + DCL `bizcity_automation_slash_commands` + REST CRUD → xem PHASE-WORKFLOW-AS-SKILL §7 | ⬜ DESIGN v0.12 |
| **SKILL W1** | Action `action.persona_overlay` (load `character.system_prompt`) → xem PHASE-WORKFLOW-AS-SKILL §4 | ⬜ DESIGN v0.12 |
| **SKILL W2-W7** | Bidirectional MD ↔ JSON converter + CLI + round-trip test + UI import/export + GitHub gallery → xem PHASE-WORKFLOW-AS-SKILL §8 | ⬜ DESIGN v0.12 |
| **MPR W1** | Channel adapter capability flag `supports_streaming` | ⬜ |
| **MPR W2** | Layer-transition fallback message cho zalo/fb | ⬜ |

### Wave W1-W25 (2026-06-14) — tóm tắt nhanh

| Nhóm | Seeds | Trigger chính |
|---|---|---|
| WooCommerce (W1-W5) | Đơn mới / shipped / giỏ bỏ dở / hoàn tiền / sắp hết hàng | `webhook` |
| CRM event (W6-W9) | Welcome / label / SLA / CSAT | `crm_event` |
| Cron nội bộ (W10-W13) | Lead nguội / standup / weekly report / task overdue | `cron` |
| Zalo media (W14-W16) | Ảnh classify / PDF extract / Voice transcribe | `zalo_inbound` |
| Loyalty (W17-W18) | Tích điểm / lên hạng | `crm_event` |
| Business ops (W19-W21) | Campaign start / nhắc hẹn / hóa đơn quá hạn | `crm_event` |
| AI tools (W22) | Tóm tắt hội thoại | `zalo_inbound` |
| HTTP/form (W23) | Form landing page → CRM | `webhook` |
| Menu bot (W24) | Menu 1-2-3 tĩnh (no AI) | `zalo_inbound` |
| Broadcast (W25) | Cron → draft VIP broadcast | `cron` |

---

## Phụ lục — Quick decision matrix khi tạo workflow mới

```
┌─────────────────────────────────────────────────────────────┐
│ Q: Workflow này dành cho 1 guru cụ thể hay dùng chung?       │
├─────────────────────────────────────────────────────────────┤
│ DÙNG CHUNG (cross-guru, library)                             │
│   → trigger: channel_keyword                                 │
│   → trigger.config.guru_id: null                             │
│                                                              │
│ CHỈ GURU A (private workflow)                                │
│   → trigger: channel_keyword + guru_id=A                     │
│   → OR trigger: guru_mention (@guru_a)                       │
│                                                              │
│ POWER-USER CLI (slash command)                               │
│   → trigger: slash_command (/dang_fb)                        │
│   → reserved trong bizcity_automation_slash_commands         │
└─────────────────────────────────────────────────────────────┘
```
