# PHASE — Workflow ↔ Skill Markdown · Bidirectional Template Format

> **Status:** DESIGN · v1.4 · 2026-06-03 (Wave 0 in-flight; 3 guardrails G1/G2/G3 adopted from reflect audit)
> **Owner:** Twin AI Core (BizCity Founder)
> **Pre-design audit (R-DA):** done — see §11 audit table
> **Companion to:**
> - [docs/rules/PHASE-0-RULE-DESIGN-AUDIT.md](../../../docs/rules/PHASE-0-RULE-DESIGN-AUDIT.md) — R-DA meta-rule (audit `docs/rules/` → `core/` → `docs/roadmaps/`)
> - [docs/rules/PHASE-0-RULE-SKILL-CONTRACT.md](../../../docs/rules/PHASE-0-RULE-SKILL-CONTRACT.md) — R-SKILL §7 cấm runner riêng (chốt Wave A-D parking)
> - [docs/rules/PHASE-0-RULE-GURU-CHANNEL-BINDING.md](../../../docs/rules/PHASE-0-RULE-GURU-CHANNEL-BINDING.md) — R-GCB (SoT cho Wave 0)
> - [PHASE-R-FINAL-ACTION.md](PHASE-R-FINAL-ACTION.md) (quad-commit contract)
> - [PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md](PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md) (Part B guru hybrid)
> - [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) §2 (Design ↔ Run)
> - [docs/rules/PHASE-0-RULE-TWIN-GURU.md](../../../docs/rules/PHASE-0-RULE-TWIN-GURU.md) §L1 (`character.system_prompt`)
> - **[docs/roadmaps/PHASE-1.7-SKILL-LIBRARY-ARCHITECTURE.md](../../../docs/roadmaps/PHASE-1.7-SKILL-LIBRARY-ARCHITECTURE.md) — Canonical skill library spec (PHẢI ĐỌC TRƯỚC)**
> - [docs/roadmaps/PHASE-0.20-CHARACTER-SKILLS-TAB.md](../../../docs/roadmaps/PHASE-0.20-CHARACTER-SKILLS-TAB.md) — Guru ↔ skill binding UI
> - [docs/roadmaps/PHASE-1.10-AGENTIC-SKILL-ORCHESTRATION-v2.md](../../../docs/roadmaps/PHASE-1.10-AGENTIC-SKILL-ORCHESTRATION-v2.md) — Archetype A/B/C/D + 5-step pipeline

---

## ⚠️ REVISION NOTICE 2026-06-03 — Đọc trước §0

Sau khi audit toàn workspace, **`core/skills/` module đã ship đầy đủ
infrastructure cho "skill library"**. Doc v1.0 (bên dưới) suýt tạo
hệ thống song song. Phần này SUPERSEDE mọi quyết định va chạm trong v1.0.

### Cái đã có (KHÔNG tạo lại)

| Thành phần | Đã có ở | Tận dụng thế nào |
|---|---|---|
| Storage `.md` skills | `wp-content/uploads/bizcity-skills/{blog_id}/` | Reuse — automation templates cũng đặt ở đây hoặc seeded ở `core/automation/templates/` (read-only) |
| Bảng `wp_bizcity_skills` v1.4.1 | `core/skills/includes/class-skill-database.php` | Reuse — thêm 3 cột (`archetype`, `trigger_type`, `trigger_config_json`) |
| Bảng `wp_bizcity_skill_tool_map` | `class-skill-tool-map.php` | Reuse cho block-skill binding (extend ENUM nếu cần) |
| Parser MD + YAML frontmatter | `class-skill-recipe-parser.php` | **Extend** thay vì viết `BizCity_Automation_Skill_Converter` mới — thêm method `extract_workflow_steps()` cho Archetype D |
| Slash command resolver | `bizcity_skills.slash_commands` (CSV) | Reuse — KHÔNG tạo bảng `bizcity_automation_slash_commands` mới (xem §7 đã bị deprecate) |
| System-prompt injection | `class-skill-context.php` priority 93 | Reuse — persona overlay = đã có via `character_id` binding |
| Skill matching algorithm | `BizCity_Skill_Database::find_matching()` | Reuse — Trigger_Matcher có thể delegate cho skill-matcher khi `trigger_type` không phải channel webhook |
| Archetype A/B/C/D | `class-skill-context.php::detect_archetype()` | Reuse — Automation workflow = **Archetype D** (`execution_plan` YAML / `## Steps` section) |
| REST API | `bizcity/skill/v1` (7 routes) | Extend với query `?archetype=D&trigger_type=…` thay vì namespace mới |
| Tool ref extractor `@tool` | `extract_tool_refs()` regex | Reuse cho block_id refs `@block_id` nếu cần linking |

### Frontmatter canonical (PHẢI dùng key names này)

Đã ship trên prod:

```yaml
---
title: "Display name"          # canonical (KHÔNG đổi sang 'name')
description: "..."
modes: [content, planning, execution]
triggers: ["nhắc", "remind me"]      # array, KHÔNG phải scalar 'filter'
tools: [create_post, search_kg]      # array tool refs
slash_commands: "/remind,/nhac"       # CSV string trong DB col
plugins: []
priority: 70                          # 0..100
status: active                        # draft|active|archived
version: "1.0"
category: content
character_id: 0                       # 0=global, >0=guru-bound
---
```

### Mở rộng để hỗ trợ workflow automation (Archetype D)

Bổ sung optional keys (chỉ active khi `archetype: D`):

```yaml
archetype: D                          # A|B|C|D — D = automation workflow
trigger_type: channel_keyword         # manual|channel_keyword|guru_mention|slash_command|cron|webhook|twinbrain_intent|twinbrain_tool_decided
trigger_config:
  channel: zalo_inbound               # ngữ cảnh tuỳ trigger_type
  guru_id: 0                          # cross-cut filter (GURU W1 đã ship)
  instance_id: ""                     # oa_id Zalo / page_id FB
  priority: 11
  is_fallback: false
  schedule: "*/5 * * * *"             # khi trigger_type=cron
  webhook_slug: ""                    # khi trigger_type=webhook
  skill_slug: ""                      # khi trigger_type=twinbrain_tool_decided
final_action:                         # R-FINAL-ACTION quad-commit flags
  scheduler_evidence: true
  notify_user: true
  edit_link: true
  ack_callback: false
```

→ **`triggers[]` (existing) vẫn dùng cho keyword matching trong chat;
`trigger_type` + `trigger_config{}` (mới) thêm để Trigger_Matcher route được
channel/cron/webhook context. Hai field cùng tồn tại, không conflict.**

### Quyết định kiến trúc bị đảo

| v1.0 (sai — duplicate) | v1.1 (đúng — reuse) |
|---|---|
| Tạo `core/automation/skills/*.skill.md` dir mới | **Bỏ.** Curated templates ở `core/automation/templates/*.skill.md` (read-only seed); user skills ở `wp-content/uploads/bizcity-skills/` (đã có) |
| Bảng `bizcity_automation_slash_commands` + DCL JSON | **Bỏ.** Dùng `bizcity_skills.slash_commands` CSV column (đã có). Per-guru scope qua `character_id` (đã có UNIQUE key `(skill_key, user_id, character_id)`) |
| Class `BizCity_Automation_Slash_Registry` | **Bỏ.** Thêm method `BizCity_Skill_Database::resolve_slash($cmd, $character_id)` |
| Class `BizCity_Automation_Skill_Converter` riêng | **Bỏ.** Extend `BizCity_Skill_Recipe_Parser` với `extract_workflow_steps()` + thêm class `BizCity_Skill_Workflow_Compiler` (md_to_workflow + workflow_to_md) ĐẶT TRONG `core/skills/includes/` |
| Class `BizCity_Character_Repo::find_by_slug()` mới | **Bỏ.** Đã có `wp_bizcity_characters.slug` UNIQUE; dùng helper hiện có hoặc 1 query `WHERE slug=%s` |
| `action.persona_overlay` block tự load system_prompt | **Giữ** nhưng đơn giản hơn: chỉ resolve `character_id`, không cần preload — `BizCity_Skill_Context` priority 93 sẽ tự inject khi `_persona.character_id` set trong ctx |
| Frontmatter key `slug` / `name` / `trigger.filter` | **Đổi** sang canonical `title` (text) + `triggers[]` (array). `slug` đã có riêng trong DB col `skill_key` — derive từ filename stem |
| Slash priority CAO HƠN guru_mention | **Giữ** nhưng route qua skill registry: slash → skill lookup; mention → skill lookup theo `character_id` |
| Namespace `bizcity-channel/v1` cho slash CRUD | **Bỏ.** REST `bizcity/skill/v1` đã có toàn bộ CRUD; thêm filter `?slash=…` nếu cần list. |

### Tổng kết REVISION

> **Automation Workflow KHÔNG phải concept tách biệt — nó là Skill Archetype
> D với trigger_type ≠ manual.** Mọi storage, DB, parser, REST đã có ở
> `core/skills/`. Phần Automation chỉ cần:
>
> 1. Extend `bizcity_skills` table thêm 3 cột (`archetype` enum, `trigger_type` varchar(32), `trigger_config_json` longtext).
> 2. Extend `BizCity_Skill_Recipe_Parser` parse `## Steps` section + block_id syntax → trả về node graph.
> 3. Thêm `BizCity_Skill_Workflow_Compiler` (đặt trong `core/skills/includes/`) lo md_to_workflow + workflow_to_md.
> 4. Thêm hook trong `BizCity_Automation_Trigger_Matcher` query `bizcity_skills WHERE archetype='D' AND trigger_type=?` thay vì query `bizcity_automation_workflows` riêng.
> 5. `wp_bizcity_automation_workflows` (đã có) giữ làm runtime cache / canvas-edit state — KHÔNG phải canonical storage. Canonical = `.md` file + `bizcity_skills` row.

### Phần dưới (v1.0 nguyên bản) — đọc cho tham khảo concept

Mọi quyết định trong §1-§10 v1.0 mà conflict với REVISION NOTICE bên trên
→ tuân theo REVISION. Sprint plan thật sự nằm ở §11 (mới, sau v1.0).

---

## 0. Tuyên ngôn (1 câu)

> **Workflow JSON là form chạy được của runtime — Skill Markdown là form
> đọc-được-cho-người-và-AI. Hai dạng PHẢI convert qua lại lossless theo rule
> chặt, để cộng đồng có thể fork / PR template trên GitHub, còn runner vẫn
> ăn JSON như cũ. Skill = sequence of automation blocks. Guru = persona
> context layer wrap quanh skill khi cần.**

> **Đẳng thức quan trọng:**
> ```
> Skill (alone)              = Workflow chạy không persona, không nhớ ai gọi.
> Guru.system_prompt + Skill = Workflow chạy với persona "tôi là ai, tôi nói thế nào".
> ```
> @guru trigger không phải feature mới — nó chỉ là 1 skill được wrap bởi
> persona layer ở step 0 (load `character.system_prompt` vào context).

---

## 1. Vì sao cần Skill Markdown (3 lý do)

1. **Cộng đồng share template** — Skill MD lưu trên GitHub, ai cũng đọc
   được, AI agent (Claude / Copilot) edit được. JSON workflow blob quá thô,
   không ai PR review được.
2. **Round-trip với AI** — User mô tả tự nhiên → LLM generate Skill MD →
   convert JSON → import vào builder. Builder edit JSON → export MD → push
   GitHub PR. Vòng tròn không lossy.
3. **Skill registry song song với TwinBrain skills** — TwinBrain đã có
   `skill_slug` (web_search, image_gen…) định tuyến qua tool registry. Giờ
   Automation cũng có "skill" = workflow template → cùng vocabulary,
   user/AI không phải phân biệt 2 khái niệm.

---

## 2. Skill Markdown — Canonical Format (`*.skill.md`)

### 2.1 File layout

```
core/automation/skills/
├── reminder-natural-language.skill.md
├── knowledge-router.skill.md
├── remember-this.skill.md
├── ask-med.skill.md
├── publish-fb-from-zalo.skill.md
└── … (community contrib via PR)
```

### 2.2 Anatomy của 1 file `.skill.md`

```markdown
---
# REQUIRED — Skill identity (YAML frontmatter)
slug: reminder-natural-language          # PK, snake_case, must match filename stem
name: "Nhắc lịch tự nhiên qua Zalo"
description: "Khách nhắn 'nhắc tôi …' qua Zalo → LLM parse datetime → tạo CRM event reminder → cron tự nhắn nhắc lại đúng giờ."
version: 1.0.0
category: general                        # cskh|mpr|crm|general|content|reporting
icon: CalendarClock                      # lucide-react icon name
tags: [reminder, calendar, zalo, r-final-action]

# REQUIRED — Trigger spec
trigger:
  type: channel_keyword                  # channel_keyword|guru_mention|slash_command|cron|webhook|manual
  channel: zalo_inbound                  # với channel_keyword: zalo_inbound|fb_message|fb_comment|telegram_inbound
  filter: "nhắc"                         # substring/regex hoặc keywords[] array
  guru_id: 0                             # 0 = mọi guru; >0 = chỉ chạy khi character_id binding khớp
  priority: 11
  is_fallback: false

# OPTIONAL — Persona overlay (GURU W2)
# Khi trigger.type=guru_mention HOẶC khi muốn force persona dù trigger khác:
# runner sẽ load character.system_prompt và inject vào ctx._persona.
persona:
  enabled: false                         # true → auto-inject character.system_prompt vào ctx
  guru_slug: ""                          # snake_case slug từ wp_bizcity_characters.slug

# OPTIONAL — Slash command (GURU W3)
# Nếu set → workflow này được register vào bizcity_automation_slash_commands.
slash:
  command: ""                            # vd "remind" → user gõ "/remind 30 phút nữa nhắc tôi…"
  scope_guru_id: 0                       # 0 = global; >0 = chỉ active khi user đang chat guru đó

# REQUIRED — Final-action contract (R-FINAL-ACTION)
final_action:
  scheduler_evidence: true               # ① commit scheduler row
  notify_user: true                      # ② commit channel reply
  edit_link: true                        # ③ commit affordance link
  ack_callback: false                    # ④ skip nếu synchronous reply
---

# Nhắc lịch tự nhiên qua Zalo

> Người dùng nhắn "nhắc tôi 5h chiều mai họp khách" → bot tự hiểu thời
> gian, tạo event trong scheduler, gửi reminder qua Zalo đúng giờ.

## Steps

### 1. `llm.compose_reply` — Extract title + when (strtotime)

```yaml
model: gpt-4o-mini
system: |
  Bạn là bộ trích xuất reminder. Đọc câu của user và trả về DUY NHẤT 1 dòng
  JSON (không markdown): {"title":"…","when":"<PHP strtotime hợp lệ>"}.
  Quy tắc when: "5h chiều mai" → "tomorrow 17:00"; "thứ 2 tuần sau 9h"
  → "next monday 09:00"; nếu không xác định → "+1 hour".
prompt: "Câu của user: {{trigger.text}}"
```

### 2. `action.schedule_event` — Tạo reminder CRM event

```yaml
event_type: reminder_zalo
title: "{{trigger.text}}"
description: |
  Tạo từ Zalo bot.
  Extract: {{extract.output}}
  Original: {{trigger.text}}
start_at: "+1 hour"
reminder_min: 0
zalo_user_id: "{{trigger.chat_id}}"
zalo_text: "⏰ Nhắc Sếp: {{trigger.text}}"
```

### 3. `action.reply_zalo` — Báo lại Zalo (commit ② + ③)

```yaml
text: |
  ✅ Đã tạo nhắc lịch (event #{{sched.event_id}})
  🕘 {{sched.start_at}}
  📋 Extract: {{extract.output}}
  ✏️ Sửa/huỷ: {{sched.edit_url}}
```

## Edges

```text
1 → 2 → 3
```

(Linear chain implied by step order. Branching dùng `### 2.a` / `### 2.b`
+ explicit `## Edges` graph syntax — xem §3.2.)

## Outputs

| Step | Output keys |
|---|---|
| 1 (`extract`) | `output` (raw JSON string) |
| 2 (`sched`)   | `event_id`, `start_at`, `edit_url` |
| 3 (`reply`)   | `message_id` |

## Notes

- Google Calendar OAuth chưa ship → tạm dùng CRM events table.
- TODO khi GCal ready: swap step 2 sang `action.gcal_create_event` (cùng schema).
```

### 2.3 Quy tắc chặt khi viết Skill MD (BẮT BUỘC parser tuân theo)

| Rule | Mô tả |
|---|---|
| **R-SK-1** | Frontmatter phải là YAML hợp lệ, mở/đóng bằng `---`. |
| **R-SK-2** | `slug` PHẢI match filename stem (file `foo-bar.skill.md` → slug `foo-bar`). |
| **R-SK-3** | `## Steps` section bắt buộc. Mỗi step = heading `### <N>. \`<block_id>\` — <label>` + 1 fenced code block (`yaml` / `json`) chứa config. |
| **R-SK-4** | Step ID nội bộ derive từ heading: `step_<N>` (vd `step_1`, `step_2`). Token reference dùng alias đặt bằng underscore trong label hoặc `id:` field trong YAML config. |
| **R-SK-5** | `## Edges` optional. Nếu vắng → linear `1→2→…→N`. Nếu có → DSL dạng `1→2`, `2→3.a`, `2→3.b` trên từng dòng. |
| **R-SK-6** | `## Outputs` optional (parser tự suy từ block registry). |
| **R-SK-7** | `block_id` PHẢI tồn tại trong block registry runtime — converter validate trước khi convert sang JSON, fail nếu không tìm thấy. |
| **R-SK-8** | Config code block chỉ chứa fields được declare trong `block.fields[]` registry — fields lạ → warning (không fail) để dễ forward-compat. |
| **R-SK-9** | `trigger.guru_id` và `persona.guru_slug` mutually-coherent: nếu `persona.enabled=true` và `persona.guru_slug` không rỗng → converter resolve slug → id, set `trigger.guru_id = <id>` tự động. |
| **R-SK-10** | `final_action.*` flags PHẢI khớp với behavior thực tế của blocks cuối (linter check). Vd `notify_user=true` nhưng workflow không có `action.reply_*` ở step cuối → warning. |

### 2.4 Branching syntax (multi-path workflow)

```markdown
## Steps

### 1. `trigger.zalo_inbound` — Inbound Zalo
… (no config — trigger spec ở frontmatter)

### 2. `logic.condition` — Đã có ảnh?
```yaml
expression: "trigger._resume.attachment_url != ''"
```

### 3.a `action.consume_attachment` — Lấy ảnh (branch TRUE)
```yaml
clear_slot: 1
```

### 3.b `action.set_pending_intent` — Đặt slot chờ ảnh (branch FALSE)
```yaml
intent: awaiting_post_image
ttl_min: 15
```

### 4.a `action.publish_wp_post` — Đăng web (sau 3.a)
…

### 4.b `action.reply_zalo` — Hỏi gửi ảnh (sau 3.b)
…

## Edges

```text
1 → 2
2 →[true] 3.a
2 →[false] 3.b
3.a → 4.a
3.b → 4.b
```
```

`→[true]` / `→[false]` map sang `sourceHandle` của edge. Bất kỳ label
khác (vd `→[premium]`) đều forward nguyên xi vào `sourceHandle`.

---

## 3. Bi-directional Converter — API & Algorithm

### 3.1 PHP API contract

```php
namespace BizCity\Automation\Skills;

interface BizCity_Automation_Skill_Converter {

    /**
     * MD → workflow JSON (definition_json shape của repo_workflows).
     *
     * @param string $markdown Skill MD content.
     * @return array{
     *   ok: bool,
     *   workflow?: array,     // {slug,name,description,category,icon,tags,trigger_type,trigger_config,graph:{nodes,edges}}
     *   warnings?: string[],
     *   error?: string,
     * }
     */
    public function md_to_workflow( string $markdown ): array;

    /**
     * Workflow JSON → MD canonical (lossless với MD gốc nếu round-trip).
     */
    public function workflow_to_md( array $workflow ): string;

    /**
     * Validate MD (R-SK-1..R-SK-10) mà không cần convert.
     *
     * @return array{ ok:bool, errors:string[], warnings:string[] }
     */
    public function validate_md( string $markdown ): array;
}
```

**Reference impl:** `core/automation/includes/skills/class-skill-converter.php` (TBD W4).

### 3.2 MD → JSON algorithm

```
1. Split frontmatter (--- … ---) → parse YAML → $meta.
2. Validate R-SK-1, R-SK-2 (filename ↔ slug).
3. Tokenize body theo regex `^### (\d+)(\.([a-z]))?\. `\` <block_id>\`` — collect steps[].
4. Cho mỗi step:
   a. Đọc fenced code block ngay sau heading (yaml hoặc json).
   b. Parse → config_array. Validate fields theo block registry (R-SK-7, R-SK-8).
   c. Build node = { id: "step_<N>"+[<branch>], type: kind_of(block_id), block_id, data: config_array, position: auto-layout grid }.
5. Parse `## Edges` block (nếu có):
   a. Mỗi dòng = "<src> →[<handle>?] <tgt>" (handle optional).
   b. Build edges[] = { source: "step_<src>", target: "step_<tgt>", sourceHandle? }.
   Nếu không có `## Edges` → linear: step_1 → step_2 → … → step_N.
6. Build trigger_config từ $meta.trigger.* + persona.* + slash.*:
   - trigger_config = { instance_id: '', filter: meta.trigger.filter, guru_id: meta.trigger.guru_id, priority: meta.trigger.priority, is_fallback: meta.trigger.is_fallback }
   - Nếu meta.persona.enabled && meta.persona.guru_slug:
       resolve_guru_id_from_slug(...) → set trigger_config.guru_id (overwrite nếu rỗng)
       node persona_inject (auto-prepend step 0) = action.persona_overlay với guru_slug
   - Nếu meta.slash.command:
       register row vào bizcity_automation_slash_commands (deferred — sau khi workflow upsert).
7. Return $workflow shape.
```

### 3.3 JSON → MD algorithm

```
1. Build frontmatter:
   - slug/name/description/category/icon/tags từ workflow row.
   - trigger: { type: trigger_type, channel: derive_from_trigger_type, filter, guru_id, priority, is_fallback } từ trigger_config.
   - persona: nếu graph có node id=step_0 và block_id=action.persona_overlay → { enabled:true, guru_slug: data.guru_slug }; else { enabled:false }.
   - slash: query bizcity_automation_slash_commands WHERE workflow_id=$id → render nếu có.
   - final_action: scan blocks cuối DAG → suy ra flags.
2. Body:
   - `# {name}` + description paragraph.
   - `## Steps` — topo-sort nodes (bỏ qua persona_overlay step 0 vì đã ở frontmatter), render từng node = `### <N>. \`<block_id>\` — <label>` + fenced ```yaml block với data.* fields.
   - `## Edges` — luôn render (kể cả linear) để rõ ràng + dễ diff khi PR.
   - `## Outputs` — render bảng từ block registry outputs[].
3. Dump UTF-8 no-BOM.
```

### 3.4 Round-trip guarantee

```
md₀ → JSON → md₁  ⇒  md₀ và md₁ phải bằng nhau (modulo whitespace canonical).
```

Test: `BizCity_Automation_Skill_Converter_Test::test_round_trip_all_seeds()` — load tất cả `core/automation/skills/*.skill.md`, convert qua lại, diff bằng `===` sau khi normalize EOL + trailing whitespace. Fail = converter bug.

---

## 4. Persona overlay block — `action.persona_overlay` (mới)

> File: `core/automation/includes/blocks/actions/class-action-persona-overlay.php` (TBD W3)

```php
final class BizCity_Automation_Action_Persona_Overlay extends BizCity_Automation_Block_Base {

    public function id(): string   { return 'action.persona_overlay'; }
    public function kind(): string { return 'action'; }

    public function meta(): array {
        return array(
            'label'    => 'Persona · Load Guru context',
            'category' => 'action',
            'color'    => '#a855f7',
            'icon'     => 'user-circle',
            'defaults' => array( 'guru_slug' => '' ),
            'fields'   => array(
                array( 'name' => 'guru_slug', 'label' => 'Guru slug', 'type' => 'text',
                       'hint' => 'snake_case slug từ Character Edit' ),
            ),
        );
    }

    public function execute( array $ctx, array $data ) {
        $slug = trim( (string) $this->resolve( $data['guru_slug'] ?? '', $ctx ) );
        if ( $slug === '' ) { return array( 'persona_loaded' => false ); }

        $char = BizCity_Character_Repo::find_by_slug( $slug );
        if ( ! $char ) { return array( 'persona_loaded' => false, 'reason' => 'guru_not_found' ); }

        // Mutate runner ctx → mọi step sau đọc được _persona.system_prompt.
        // Runner sẽ merge return.persona_patch vào ctx (xem runner W2).
        return array(
            'persona_loaded' => true,
            'guru_slug'      => $slug,
            'guru_id'        => (int) $char->id,
            'persona_patch'  => array(
                '_persona' => array(
                    'guru_id'       => (int) $char->id,
                    'guru_slug'     => $slug,
                    'guru_name'     => (string) $char->name,
                    'system_prompt' => (string) $char->system_prompt,
                ),
            ),
        );
    }
}
```

Block llm cuối (compose_reply / mpr_think) đọc `ctx._persona.system_prompt`
và prepend vào field `system` của LLM call.

---

## 5. Convergence với TwinBrain skill_slug

| Vocabulary | Automation | TwinBrain |
|---|---|---|
| **Skill** | 1 workflow template (`*.skill.md`) — chain of automation blocks | 1 tool registered (web_search, image_gen…) |
| **Skill slug** | `{filename-stem}` (e.g. `remind`) | `{namespace.action}` (e.g. `web.search`) |
| **Trigger** | Channel keyword / mention / slash / cron | TwinBrain stage 3 router (tool intent) |
| **Result** | Side effects + scheduler evidence + reply | Tool output → continue MPR thinking |

→ Cùng chữ "skill" nhưng 2 ngữ cảnh KHÔNG mix:
- **Automation skill** = side-effect runner (làm gì đó cho user).
- **TwinBrain skill** = retrieval/transformation step in MPR (nội bộ reasoning).

Một workflow Automation CÓ THỂ gọi TwinBrain skill thông qua block
`llm.mpr_think` (xem seed `tpl_knowledge_router_v1`).

---

## 6. GURU W2 — `guru_mention` Trigger Type (DETAILED SPEC)

> **Mục tiêu:** User gõ `@<guru_slug> <text>` trên bất kỳ channel → match
> workflow đã đăng ký cho guru đó, auto-load persona.

### 6.1 Trigger type registration

File: `core/automation/includes/blocks/triggers/class-trigger-guru-mention.php`

```php
final class BizCity_Automation_Trigger_Guru_Mention extends BizCity_Automation_Block_Base {

    public function id(): string   { return 'trigger.guru_mention'; }
    public function kind(): string { return 'trigger'; }

    public function meta(): array {
        return array(
            'label'    => 'Guru · @mention từ bất kỳ channel',
            'short'    => '@guru',
            'category' => 'trigger',
            'color'    => '#9333ea',
            'icon'     => 'at-sign',
            'defaults' => array(
                'label'     => '@guru mention',
                'guru_slug' => '',
                'channels'  => array( 'zalo_bot', 'fb_message', 'telegram', 'webchat' ),
            ),
            'fields'   => array(
                array( 'name' => 'label',     'label' => 'Tên hiển thị', 'type' => 'text' ),
                array( 'name' => 'guru_slug', 'label' => 'Guru slug',
                       'type' => 'guru_picker', 'hint' => 'rỗng = mọi guru' ),
                array( 'name' => 'channels',  'label' => 'Cho phép channel',
                       'type' => 'multiselect',
                       'options' => array( 'zalo_bot', 'fb_message', 'telegram', 'webchat' ) ),
            ),
        );
    }

    public function execute( array $ctx, array $data ) {
        return isset( $ctx['trigger'] ) ? (array) $ctx['trigger'] : array();
    }
}
```

### 6.2 Matcher integration

Thêm vào `BizCity_Automation_Trigger_Matcher::on_channel_normalized()`,
chỗ build `$trigger_type`:

```php
// [2026-06-03 Johnny Chu] GURU W2 — detect @guru_slug mention.
$mentioned_slug = $this->extract_guru_mention( $text );  // null hoặc 'sales_bot'
if ( $mentioned_slug !== '' ) {
    $guru = BizCity_Character_Repo::find_by_slug( $mentioned_slug );
    if ( $guru ) {
        // Override trigger_type sang guru_mention + inject character_id vào payload.
        $trigger_type             = 'guru_mention';
        $payload['character_id']  = (int) $guru->id;
        $payload['mentioned_slug'] = $mentioned_slug;
        // Strip "@<slug>" prefix khỏi text trước khi pass xuống LLM.
        $text = trim( preg_replace( '/^@' . preg_quote( $mentioned_slug, '/' ) . '\b\s*/u', '', $text ) );
    }
}
```

Khi `trigger_type = guru_mention`, query workflow filter theo
`trigger_config.guru_slug = $mentioned_slug` (hoặc `guru_slug = ''` = wildcard
listen mọi guru).

### 6.3 Auto persona overlay

Runner (`BizCity_Automation_Runner::execute()`) khi detect
`trigger_type=guru_mention` → tự inject step 0 = `action.persona_overlay`
với `guru_slug = trigger.mentioned_slug` TRƯỚC khi chạy DAG, mà không cần
user thêm node thủ công.

```php
// Trong runner, sau khi build $ctx, trước khi BFS:
if ( ( $run['trigger_type'] ?? '' ) === 'guru_mention' ) {
    $slug = (string) ( $ctx['trigger']['mentioned_slug'] ?? '' );
    if ( $slug !== '' ) {
        $block = BizCity_Automation_Block_Registry::instance()
            ->get( 'action.persona_overlay' );
        $out = $block->execute( $ctx, array( 'guru_slug' => $slug ) );
        if ( is_array( $out ) && ! empty( $out['persona_patch'] ) ) {
            $ctx = array_replace_recursive( $ctx, $out['persona_patch'] );
        }
    }
}
```

### 6.4 Slug extractor

```php
private function extract_guru_mention( string $text ): string {
    if ( $text === '' ) { return ''; }
    if ( ! preg_match( '/^@([a-z][a-z0-9_]{1,40})\b/u', mb_strtolower( $text ), $m ) ) {
        return '';
    }
    return (string) $m[1];
}
```

### 6.5 Priority order trong matcher

```
1. slash_command   (GURU W3 — exact route)
2. guru_mention    (GURU W2 — @slug detected)
3. channel_keyword + guru_id filter  (GURU W1 — backward compat)
4. fallback        (is_fallback=true workflows)
```

---

## 7. GURU W3 — `slash_command` Trigger Type (DETAILED SPEC)

### 7.1 Schema (R-DCL compliant)

File: `core/diagnostics/changelog/core.automation.slash-commands.json`

```json
{
  "module_id": "core.automation.slash-commands",
  "current_version": "1.0.0",
  "history": [
    { "version": "1.0.0", "date": "2026-06-03",
      "change": "Initial table for slash_command trigger routing." }
  ],
  "tables": [
    {
      "name": "bizcity_automation_slash_commands",
      "since": "1.0.0",
      "columns": [
        { "name": "id",             "type": "BIGINT UNSIGNED AUTO_INCREMENT", "since": "1.0.0" },
        { "name": "command_slug",   "type": "VARCHAR(64) NOT NULL",           "since": "1.0.0" },
        { "name": "workflow_id",    "type": "BIGINT UNSIGNED NOT NULL",       "since": "1.0.0" },
        { "name": "scope_guru_id",  "type": "BIGINT UNSIGNED NOT NULL DEFAULT 0", "since": "1.0.0" },
        { "name": "owner_user_id",  "type": "BIGINT UNSIGNED NOT NULL DEFAULT 0", "since": "1.0.0" },
        { "name": "description",    "type": "VARCHAR(255) NOT NULL DEFAULT ''",   "since": "1.0.0" },
        { "name": "created_at",     "type": "DATETIME NOT NULL",              "since": "1.0.0" },
        { "name": "updated_at",     "type": "DATETIME NOT NULL",              "since": "1.0.0" }
      ],
      "indexes": [
        { "name": "PRIMARY",        "type": "PRIMARY KEY",  "cols": ["id"],                          "since": "1.0.0" },
        { "name": "uq_cmd_scope",   "type": "UNIQUE KEY",   "cols": ["command_slug","scope_guru_id"], "since": "1.0.0" },
        { "name": "idx_workflow",   "type": "KEY",          "cols": ["workflow_id"],                  "since": "1.0.0" }
      ]
    }
  ]
}
```

`UNIQUE(command_slug, scope_guru_id)` chống collision cross-tenant: cùng
slug `/remind` được phép tồn tại 1 lần global (scope=0) + N lần per guru.

### 7.2 Resolve order

```php
public function resolve_slash( string $cmd, int $active_guru_id ): ?int {
    global $wpdb;
    $t = $wpdb->prefix . 'bizcity_automation_slash_commands';

    // 1. Per-guru match (cụ thể trước).
    if ( $active_guru_id > 0 ) {
        $wid = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT workflow_id FROM $t WHERE command_slug=%s AND scope_guru_id=%d",
            $cmd, $active_guru_id
        ) );
        if ( $wid > 0 ) { return $wid; }
    }

    // 2. Global fallback.
    $wid = (int) $wpdb->get_var( $wpdb->prepare(
        "SELECT workflow_id FROM $t WHERE command_slug=%s AND scope_guru_id=0",
        $cmd
    ) );
    return $wid > 0 ? $wid : null;
}
```

### 7.3 Trigger registration

File: `core/automation/includes/blocks/triggers/class-trigger-slash-command.php`

```php
public function meta(): array {
    return array(
        'label'    => 'Slash command · /<command>',
        'category' => 'trigger',
        'color'    => '#0891b2',
        'icon'     => 'terminal',
        'defaults' => array(
            'label'         => '/command',
            'command_slug'  => '',
            'scope_guru_id' => 0,
            'description'   => '',
        ),
        'fields'   => array(
            array( 'name' => 'label',         'label' => 'Tên hiển thị', 'type' => 'text' ),
            array( 'name' => 'command_slug',  'label' => 'Command (không gồm /)', 'type' => 'text',
                   'hint' => 'snake_case, vd "remind" → user gõ "/remind …"' ),
            array( 'name' => 'scope_guru_id', 'label' => 'Scope Guru ID (0 = global)', 'type' => 'number' ),
            array( 'name' => 'description',   'label' => 'Mô tả ngắn (hiện trong /help)', 'type' => 'text' ),
        ),
    );
}
```

Khi workflow upsert (REST PUT/POST), nếu `trigger_type=slash_command` →
hook upsert pipeline ghi/update row vào `bizcity_automation_slash_commands`
với `UNIQUE(command_slug, scope_guru_id)` enforce. Conflict → REST trả 409.

### 7.4 Matcher integration

```php
// Trong on_channel_normalized() — TRƯỚC khi vào loop find_active_workflows.
if ( preg_match( '/^\/([a-z][a-z0-9_]{1,32})(\s|$)/u', mb_strtolower( $text ), $m ) ) {
    $cmd       = (string) $m[1];
    $guru_id   = (int) ( $payload['character_id'] ?? 0 );
    $workflow_id = BizCity_Automation_Slash_Registry::instance()->resolve_slash( $cmd, $guru_id );
    if ( $workflow_id ) {
        $wf = BizCity_Automation_Repo_Workflows::find( $workflow_id );
        if ( $wf && ! empty( $wf['enabled'] ) ) {
            // Strip "/<cmd>" prefix khỏi text trước khi pass cho block.
            $stripped = trim( preg_replace( '/^\/' . preg_quote( $cmd, '/' ) . '\b\s*/u', '', $text ) );
            $run_payload['text']         = $stripped;
            $run_payload['message']      = $stripped;
            $run_payload['_slash_cmd']   = $cmd;
            $this->enqueue_and_optionally_run( $wf, $run_payload, false );
            return; // skip keyword path — slash là exact route.
        }
    }
}
```

### 7.5 Help / discovery

REST GET `/bizcity-channel/v1/automation/slash` → trả mảng `[{command,
description, scope_guru_id, workflow_name}]` cho `/help` command auto-generate
in-chat menu (W3.2).

---

## 8. Roadmap update (chèn vào AUTOMATION-1-BE-ROADMAP §13 mới)

| Sprint | Item | File chính | Status |
|---|---|---|---|
| **GURU W1** | `trigger.config.guru_id` cross-cut filter | `class-automation-trigger-matcher.php` | ✅ 2026-06-02 |
| **GURU W2** | Trigger `guru_mention` + slug extractor + auto persona overlay | `class-trigger-guru-mention.php` · runner patch | ⬜ |
| **GURU W3.1** | DCL schema `bizcity_automation_slash_commands` + registry class | DCL JSON + `class-automation-slash-registry.php` | ⬜ |
| **GURU W3.2** | Trigger `slash_command` + matcher early-route + `/help` REST | `class-trigger-slash-command.php` + REST | ⬜ |
| **SKILL W1** | Persona overlay block `action.persona_overlay` | `class-action-persona-overlay.php` | ⬜ |
| **SKILL W2** | Skill MD ↔ JSON converter (PHP) | `class-skill-converter.php` | ⬜ |
| **SKILL W3** | CLI import/export: `wp bizcity automation skill import/export <slug>` | `class-skill-cli.php` | ⬜ |
| **SKILL W4** | Round-trip test suite + lint command | `tests/test-skill-converter.php` | ⬜ |
| **SKILL W5** | Migrate seed templates `*.skill.md` (3 seed W1 + 6 vertical asks) | `core/automation/skills/*.skill.md` | ⬜ |
| **SKILL W6** | Builder UI: "Import .skill.md" / "Export .skill.md" buttons | SPA workflow panel | ⬜ |
| **SKILL W7** | GitHub-pull "Community skills" gallery (read-only PoC) | REST proxy → GitHub raw | ⬜ |

---

## 9. Anti-patterns CẤM

- ❌ Lưu workflow chỉ ở 1 dạng (chỉ JSON hoặc chỉ MD) — phải đồng bộ 2 chiều, JSON là runtime canonical.
- ❌ Hard-code persona system_prompt vào MD body — phải reference qua `persona.guru_slug` để character edit propagate.
- ❌ Register slash_command global (scope=0) cho workflow private cho 1 user — leak vào tenant khác. Phải scope_guru_id > 0.
- ❌ MD frontmatter syntax cron expression (`*/5 * * * *`) đặt trong block YAML mà thiếu quote → YAML parser break. Phải `schedule: "*/5 * * * *"` có quote (xem memory `php-docblock-cron-comment-trap.md` — same trap, different lang).
- ❌ Filename không khớp slug → R-SK-2 violation, converter từ chối.
- ❌ Block_id không tồn tại trong registry → R-SK-7, converter từ chối (không tạo workflow zombie).

---

## 10. Mindset đúng

> "Workflow là sự kết nối các skill thành 1 kịch bản — JSON là form chạy, MD
> là form đọc. Guru chỉ là 1 lớp persona context phủ lên, không phải 1 loại
> workflow khác. @guru mention = skill + persona overlay. /slash = skill +
> exact route. Skill alone = chạy thô, không persona, không nhớ ai gọi."

---

## 11. Sprint Plan REVISED v1.2 (2026-06-03)

### ⚠️ Pre-design audit (R-DA — compulsory, đã thực hiện 2026-06-03)

| Nguồn | File checked | Phát hiện |
|---|---|---|
| `docs/rules/` | [PHASE-0-RULE-SKILL-CONTRACT.md](../../../docs/rules/PHASE-0-RULE-SKILL-CONTRACT.md) §0 + §7 | **R-SKILL stricter than v1.1 assumed.** "Skill KHÔNG có engine, KHÔNG có runner riêng. Twin Runner là engine DUY NHẤT." → Đề xuất v1.1 thêm `archetype='D' + ## Steps + block_id` chạy bằng `BizCity_Automation_Runner` có thể vi phạm "không tạo runner thứ 2". Phải re-decision: (a) skill table chỉ chứa A/B/C, workflow giữ table+runner riêng độc lập KHÔNG gọi là "skill"; (b) hợp nhất Automation_Runner vào Twin Runner; (c) `.skill.md` format chung nhưng route table khác theo archetype. **Quyết định parking** — chờ user duyệt một trong 3 hướng. |
| `docs/rules/` | [PHASE-0-RULE-GURU-CHANNEL-BINDING.md](../../../docs/rules/PHASE-0-RULE-GURU-CHANNEL-BINDING.md) (mới 2026-06-03) | `bizcity_channel_bindings` đã có sẵn từ Phase 0.33. UI binding chưa có → là TOP priority của user. |
| `core/` | `core/skills/` | Đầy đủ Manager/DB/REST/Parser/Context/Bridge. |
| `core/` | `core/channel-gateway/includes/class-channel-binding.php` | Table + class + 4 method (`resolve`, `upsert`, `disable`, `resolve_target`) shipped. CHỈ thiếu UI character-edit tab "Channels". |
| `docs/roadmaps/` | [PHASE-0.20-CHARACTER-SKILLS-TAB.md](../../../docs/roadmaps/PHASE-0.20-CHARACTER-SKILLS-TAB.md) | Pattern UI tab cho character-edit đã có. Wave 0 dưới đây mượn nguyên pattern. |
| `docs/roadmaps/` | [PHASE-1.10-AGENTIC-SKILL-ORCHESTRATION-v2.md](../../../docs/roadmaps/PHASE-1.10-AGENTIC-SKILL-ORCHESTRATION-v2.md) | Archetype A/B/C/D đã định nghĩa — D = "workflow". Cần cross-check decision parking ở Wave A. |

### Wave 0 — Guru ↔ Channel Binding UI (HIGHEST PRIORITY, 2026-06-03)

> **User mandate 2026-06-03:** *"Với workflow gắn theo guru, UI theo hướng
> chọn Guru ghép vào trigger và giao Guru phụ trách các kênh nào, cũng phải
> làm trước, ưu tiên."*
>
> **BE đã sẵn sàng** — `bizcity_channel_bindings` table + `BizCity_Channel_Binding` API đầy đủ. Wave 0 chỉ lấp UI gap + trigger picker.

| Sprint | Item | File chính | Phụ thuộc |
|---|---|---|---|
| **GURU-UI W0.1** | REST routes: 5 endpoints `bizcity-channel/v1/character/{id}/channels/*` (GET list, POST upsert, PATCH mode, DELETE soft-disable, GET available) trong adapter mới `class-channel-binding-rest.php`. Wrap `BizCity_Channel_Binding::*` API. Validate `character.status IN ('active','published')` (R-GCB-7). | `core/channel-gateway/includes/class-channel-binding-rest.php` (mới) + register trong `bootstrap.php` | R-GCB shipped (đã có) |
| **GURU-UI W0.2** | Character-edit tab "Channels": thêm tab nav + `#tab-channels` div trong `core/knowledge/views/character-edit.php`. Vanilla jQuery handler trong `character-edit.js` — list bindings (card layout), modal "Giao kênh mới" (platform dropdown + account picker + mode radio + fallback user picker), button gỡ bind (soft-disable). CSS reuse `.bk-source-card` pattern. | `core/knowledge/views/character-edit.php` + `core/knowledge/assets/js/character-edit.js` + `core/knowledge/assets/css/character-edit.css` | W0.1 |
| **GURU-UI W0.3** | Trigger config Guru picker: cập nhật FE block panel cho 4 trigger channel (`trigger.zalo` / `.fb-message` / `.fb-comment` / `.telegram`) — field `guru_id` đổi từ raw number input thành dropdown: `(●) Mọi Guru / ( ) Chỉ Guru: [picker]`. Khi chọn Guru cụ thể → call `GET /character/{id}/channels` show preview list account đã bind ("Trigger sẽ fire ở: Zalo OA 1234, FB Page 9876"). Warning yellow nếu Guru chưa bind kênh nào. | `core/automation/frontend/src/blocks/triggers/*.{tsx,jsx}` + `src/components/GuruChannelPicker.tsx` (mới) + rebuild registry | W0.1 + GURU W1 (đã ship) |
| **GURU-UI W0.4** | Channel listener `payload.character_id` injection audit: review 4 adapter listener (`class-universal-channel-listener.php` + zalo/fb/telegram listener cụ thể) — đảm bảo TẤT CẢ gọi `BizCity_Channel_Binding::resolve()` set `payload.character_id` trước khi dispatch event `channel.message.received`. Thêm DDV probe `class-probe-channel-binding-injection.php` real-call. | `core/channel-gateway/includes/class-*-listener.php` + `core/diagnostics/includes/probes/class-probe-channel-binding-injection.php` (mới) | R-GCB-3 |
| **GURU-UI W0.5** | Stamp + DDV row: row diagnostic `R-GCB · Guru-Channel Binding UI` (probe class_exists Channel_Binding_REST + hook attached `rest_api_init` + real-call `GET /character/{test_id}/channels` → 200) trong `core/diagnostics` page. | `core/diagnostics/includes/probes/class-probe-channel-binding-rest.php` (mới) | W0.1 |

**DoD Wave 0:**
- Admin character-edit có tab "Channels" — bind/unbind Guru cho Zalo OA / FB Page / Telegram bot / WebChat hoạt động end-to-end.
- Canvas automation trigger Zalo có Guru picker; chọn Guru → thấy ngay danh sách OA đã bind.
- Diagnostic row PASS với 3 layers + real-call.
- KHÔNG tạo bảng mới (R-GCB-1 enforce — chỉ dùng `bizcity_channel_bindings` đã có).
- Code stamp `[YYYY-MM-DD Johnny Chu] GURU-UI W0.X — desc` tại mọi điểm thay đổi.

### 🔍 Pre-design audit REVISION 2026-06-03 (R-DA second pass) — REUSE existing REST

> Audit phase 2 phát hiện: **TOÀN BỘ REST infrastructure đã ship Phase 0.33 M3**.
> Wave 0 KHÔNG cần file `class-channel-binding-rest.php` mới như spec ban đầu.

| Endpoint (đã ship trong `class-webhook-inspector.php`) | Dùng cho |
|---|---|
| `GET /bizcity-channel/v1/inspector/bindings?character_id=X` | W0.2 list bindings cho 1 Guru |
| `POST /bizcity-channel/v1/inspector/bindings` (upsert) | W0.2 bind kênh mới |
| `POST /bizcity-channel/v1/inspector/bindings/{id}/disable` | W0.2 soft-disable |
| `GET /bizcity-channel/v1/inspector/channels` | W0.2 + W0.3 platform/account picker |
| `GET /bizcity-channel/v1/inspector/gurus` | W0.3 Guru picker dropdown |

→ **W0.1 reduce scope:** chỉ thêm **R-GCB-7 validation** vào `rest_binding_upsert` (reject nếu Guru `status NOT IN ('active','published')`) — KHÔNG tạo file/route mới.
→ **W0.2 reduce scope:** chỉ thêm HTML tab + inline JS gọi endpoints có sẵn — KHÔNG tạo controller mới.
→ **W0.5 reduce scope:** probe verify class + routes existing + real-call ping — KHÔNG cần probe REST gate mới.

### 🛡️ 3 Guardrails từ reflect audit (G1/G2/G3 — adopted 2026-06-03)

| ID | Guardrail | Tier ảnh hưởng | Implement at |
|---|---|---|---|
| **G1** | Field `archetype: skill\|workflow` BẮT BUỘC trong frontmatter (KHÔNG chỉ trust extension `.skill.md` vs `.workflow.md`) | Wave A WF-AUTO W2 — parser | `BizCity_Skill_Recipe_Parser::extract_workflow_steps()` reject nếu thiếu/sai `archetype` field. Frontmatter là single SoT, extension chỉ là gợi ý naming. |
| **G2** | REST validation chống slash collision cross-tier khi upsert | Wave C GURU W3 — matcher upsert flow | Trước khi save `bizcity_skills.slash_commands` (skill tier) HOẶC `bizcity_automation_workflows.trigger_config_json.slash_command` (workflow tier), query tier kia: nếu cmd đã tồn tại → trả `409 conflict_slash_collision` trừ khi caller set `force_tier=workflow\|skill` explicit. |
| **G3** | Milestone "≥70% action blocks port thành tool registry = trigger `PHASE-X-RUNNER-UNIFY`" ghi vào AUTOMATION-0-CANON | Continuous (monitoring) | Mỗi quarter audit số block trong `BizCity_Automation_Block_Registry` đã có tool tương đương trong Twin Runner. Khi đạt 70% → kickoff doc `PHASE-X-RUNNER-UNIFY.md` để deprecate Automation_Runner DAG executor. Tránh Z+ debt thành vĩnh viễn. |

**Guardrails có chặn Wave 0 KHÔNG?** → KHÔNG. G1/G2 chỉ ảnh hưởng Wave A/C. G3 chỉ là monitoring. Wave 0 ship được ngay.

**Reflect findings khác (informational — không chặn):**
- **A1' (1 account = 1 Guru):** nếu nhu cầu "ngày sales / đêm support" phát sinh → tạm dùng `/slash` override + workflow cron đổi binding theo giờ. Schema không đụng cho tới khi có ≥3 user request.
- **A2' (orphan binding):** Wave 0.5 probe đã cover (xem `class-probe-channel-binding.php` dưới).
- **A4' (fallback_assignee UI inbox):** defer — chưa có yêu cầu cụ thể, fallback assignee field đã tồn tại trong upsert payload, chỉ thiếu inbox UI (chấp nhận trống cho Wave 0).
- **B2' (idempotency key xuyên tier):** defer sang Wave B BRIDGE W1 design note (block `action.invoke_skill` cần `idempotency_key` field).

---

### 🔗 Resolution Hướng Z+ (adopted 2026-06-03) — Workflow ≠ Skill (vocabulary tier separation)

> **User-approved 2026-06-03.** Conflict với R-SKILL §7 ("không runner riêng — Twin Runner là engine DUY NHẤT cho skill") resolved theo Hướng Z+ — variant pragmatic của Hướng Z với extension tách bạch.

**5 quyết định cốt lõi:**

| # | Decision | Ràng buộc |
|---|---|---|
| Z+1 | **Skill table `bizcity_skills` chỉ chứa Archetype A/B/C** (LLM-driven: instructions injection + tool whitelist). Twin Runner DUY NHẤT xuử lý. KHÔNG thêm cột `archetype='D'` / `trigger_type` / `trigger_config_json` vào table này. R-SKILL §7 giữ nguyên. | Wave A SKILL-AUTO W1 (3-col DB extend) **HUẦN**. |
| Z+2 | **Workflow table `bizcity_automation_workflows` + `BizCity_Automation_Runner` giữ độc lập** với vocabulary "workflow" (KHÔNG gọi là "skill"). DAG executor, scheduler, channel trigger — tất cả thuộc workflow domain. KHÔNG vi phạm R-SKILL vì workflow KHÔNG tiếp thị thành skill engine. | Tên class / docs luôn dùng "workflow" — cấm gọi `.workflow.md` row trong DB là "skill". |
| Z+3 | **File extension tách:** `.skill.md` (A/B/C → `bizcity_skills`) và `.workflow.md` (D → `bizcity_automation_workflows`). Parser **chung class** `BizCity_Skill_Recipe_Parser` (`parse_frontmatter()` + `extract_tool_refs()` reuse), nhưng method `extract_workflow_steps()` (mới) chỉ gọi cho `.workflow.md`. | KHÔNG tạo parser mới. Mọi `.skill.md` đang ship giữ nguyên format. |
| Z+4 | **Workflow tham chiếu skill qua block `action.invoke_skill {skill_slug}`** — block đó build `/run` request gọi Twin Runner (R-SKILL §3.4 "surface pattern"). Workflow "dùng" skill mà KHÔNG trở thành skill. Workflow bản thân là một surface của Twin Runner (cron/webhook/channel → build /run request → Twin Runner inject skill ctx → run). | Block `action.invoke_skill` = canonical bridge. Cấm runner chạy LLM tool-loop bên trong workflow bản thân. |
| Z+5 | **Slash command + guru_mention SoT = `bizcity_skills.slash_commands` CSV** (existing) cho A/B/C; **workflow trigger `slash_command` / `guru_mention`** chỉ được dùng cho `.workflow.md` và lưu trong `wp_bizcity_automation_workflows.trigger_config_json`. Matcher order: (1) skill slash → (2) workflow slash → (3) skill guru\_mention → (4) workflow guru\_mention → (5) channel\_keyword. | KHÔNG tạo bảng `bizcity_automation_slash_commands` (vi phạm R-DCL ” default reuse”). |

**Tóm tắt Hướng Z+ bằng sơ đồ:**

```
.skill.md  → bizcity_skills (A/B/C)        → Twin Runner [§R-SKILL §7 compliant]
                                                  ↑
.workflow.md → bizcity_automation_workflows (D) → Automation Runner → (block action.invoke_skill) →
```

**Tại sao KHÔNG chọn Hướng X (strict separation, parser riêng):**
- Tốn công viết parser thứ 2 cho ít lợi ích — frontmatter YAML + tool refs giống nhau 90%.
- Cuối cùng vẫn phải đồng bộ schema convention → tạo nợ maintain.

**Tại sao KHÔNG chọn Hướng Y (hợp nhất runner ngay):**
- Refactor `BizCity_Automation_Runner` thành "trigger fanout build /run" là việc **đúng** về mặt architectural nhưng tốn 1-2 sprint. Z+ cho phép **miện cưỡng converge** dần dần: mỗi block `action.*` có thể refactor thành tool call trong Twin Runner riêng lẻ sau khi từng action stable. KHÔNG block Wave A-D.

**Migration tương lai (không bắt buộc trong scope hiện tại):**
- Khi tất cả `action.*` blocks đã có phiên bản tool tương đương trong Twin Runner registry → deprecate Automation_Runner DAG executor → chuyển sang Hướng Y. Kế hoạch đó đặt tên **PHASE-X-RUNNER-UNIFY** (TBD, không trong scope doc này).

---

### Wave A — Workflow MD format + parser shared (SKILL-AUTO W1-W3) — Hướng Z+

| Sprint | Item | File chính | DCL bump |
|---|---|---|---|
| **WF-AUTO W1** | DB schema audit: `wp_bizcity_automation_workflows` phải có đủ cột `trigger_type` + `trigger_config_json` (likely đã có từ GURU W1). Ensure bằng cross-check `core/diagnostics/changelog/core.automation.json`. **KHÔNG đụng `wp_bizcity_skills`** — table đó thuộc R-SKILL domain. | `core/diagnostics/changelog/core.automation.json` + audit script | bump nếu thiếu col |
| **WF-AUTO W2** | Parser shared: `BizCity_Skill_Recipe_Parser::extract_workflow_steps($body): array` — method MỚI parse `## Steps` section + `### N. \`block_id\` — label` headings + fenced YAML config blocks → trả `[{id, block_id, label, config}]`. **CHỊ gọi method này khi file extension `.workflow.md`**. `.skill.md` (A/B/C) KHÔNG dùng. | `core/skills/includes/class-skill-recipe-parser.php` (extend) | — |
| **WF-AUTO W3** | Compiler: class mới `BizCity_Workflow_MD_Compiler` với `md_to_workflow($md)` + `workflow_to_md($wf)` + `validate_md($md)`. ĐẶT TRONG `core/automation/includes/` (không đặt `core/skills/`). Round-trip test suite. Block `action.invoke_skill` được parser nhận ra và validate `skill_slug` tồn tại trong `bizcity_skills`. | `core/automation/includes/class-workflow-md-compiler.php` + `tests/test-workflow-md-compiler.php` | — |

### Wave B — Bridge blocks (BRIDGE W1-W2)

| Sprint | Item | File chính | DCL bump |
|---|---|---|---|
| **BRIDGE W1** | Block `action.invoke_skill {skill_slug, vars?}` — build `/run` request (theo R-SKILL §3.4 "automation surface" pattern), POST tới Twin Runner same-process, capture response → emit `ctx.skill_output`. Thêm test phủ case skill không tồn tại (fail-OPEN — log warning, skip block, không break workflow). | `core/automation/includes/blocks/actions/class-action-invoke-skill.php` (mới) | — |
| **BRIDGE W2** | Trigger `trigger.skill_intent` — cho phép workflow "lắng nghe" khi Twin Runner trong skill A/B/C emit event `skill.tool_decided` với `skill_slug=X`. Subscribe qua `bizcity_twin_event_stream`. Use case: user gõ `/sales_post_with_image` (skill A) → Twin Runner xong → workflow `post_publishing_pipeline` (D) catch event → tự chạy. | `core/automation/includes/blocks/triggers/class-trigger-skill-intent.php` (mới) + event subscriber | — |

### Wave C — Guru/Slash routing (GURU W2-W3 — dual-tier, REDESIGNED)

| Sprint | Item | File chính | DCL bump |
|---|---|---|---|
| **GURU W2** | Trigger `guru_mention` (dual-tier matcher): extractor regex `^@([a-z][a-z0-9_]{1,40})\b` trong matcher; lookup `wp_bizcity_characters` WHERE `slug=%s`; set `payload.character_id` + strip prefix. Order: (1) thử `bizcity_skills` WHERE `category='guru_mention' AND character_id=$resolved` (R-SKILL §3.2 slash flow ext) → nếu match → build /run; (2) thử `bizcity_automation_workflows` WHERE `trigger_type='guru_mention' AND character_id=$resolved` → enqueue workflow. KHÔNG cần persona_overlay block — `BizCity_Skill_Context` priority 93 tự inject `character.system_prompt` cho skill path; workflow path inherit qua `payload.character_id` (R-GCB-3). | `core/automation/includes/class-automation-trigger-matcher.php` + `core/skills/includes/class-skill-database.php::find_by_guru_mention()` (mới) | — |
| **GURU W3** | Trigger `slash_command` (dual-tier): matcher early-route `^\/([a-z][a-z0-9_]{1,32})\b` → Order: (1) `BizCity_Skill_Database::resolve_slash($cmd, $active_character_id)` (per-char trước global; query CSV col `slash_commands LIKE '%/cmd%'`) → nếu match → build /run skill ctx; (2) workflow slash via `wp_bizcity_automation_workflows.trigger_config_json -> '$.slash_command' = $cmd` → nếu match → enqueue workflow. **KHÔNG** tạo bảng `bizcity_automation_slash_commands` (R-DCL default reuse). | `class-automation-trigger-matcher.php` + `class-skill-database.php::resolve_slash()` + `class-trigger-slash-command.php` (block UI) | — |

### Wave D — Seed + Canvas import/export (WF-AUTO W4-W6)

| Sprint | Item | File chính | DCL bump |
|---|---|---|---|
| **WF-AUTO W4** | Seed templates port: 17 blueprints hiện tại trong `class-automation-templates-seeder.php` → generate 17 **`.workflow.md`** files trong `core/automation/templates/` (read-only seed dir). Seeder rewrite: thay vì hard-code JSON, đọc thư mục → compile MD → upsert `wp_bizcity_automation_workflows` rows. | `core/automation/templates/*.workflow.md` + `class-automation-templates-seeder.php` | bump SEED_VERSION |
| **WF-AUTO W5** | Trigger_Matcher hardening: query `wp_bizcity_automation_workflows WHERE trigger_type=$type AND enabled=1` rõ ràng; KHÔNG query `bizcity_skills` cho workflow path. Skill path qua Twin Runner riêng. | `class-automation-trigger-matcher.php` + `class-automation-repo-workflows.php` | — |
| **WF-AUTO W6** | Canvas import/export buttons: SPA workflow panel `[Import .workflow.md]` + `[Export .workflow.md]` → call `BizCity_Workflow_MD_Compiler`. Tùy chọn: button `[+ Add skill block]` mở modal chọn skill A/B/C từ `bizcity_skills` → tạo block `action.invoke_skill`. | `core/automation/frontend/src/panels/...` | — |

### Wave E — Community gallery (WF-AUTO W7)

| Sprint | Item |
|---|---|
| **WF-AUTO W7** | GitHub raw fetch read-only PoC cho cả `.skill.md` (qua `BizCity_Skill_REST_API::fetch_community_skill`) và `.workflow.md` (qua `BizCity_Automation_REST::fetch_community_workflow`). Admin UI gallery section phân tab Skills · Workflows. Optional. |

### DoD cho mỗi sprint
1. Code stamp `[YYYY-MM-DD Johnny Chu] <Sprint-ID>` tại mọi điểm thay đổi.
2. R-DCL JSON bumped + validator exit 0 (nếu đụng schema).
3. Probe `core.automation` (cho workflow path) + `core.skills` (cho bridge block `action.invoke_skill` real-call) extend coverage cho mỗi block/REST mới.
4. Round-trip test pass cho mọi `.workflow.md` seed (W3 + W4) và `.skill.md` seed (không đụng ở wave này).
5. CANON changelog row mới + cross-link sang R-SKILL §3.4 (workflow = surface của Twin Runner).

### Anti-patterns CẤM (Hướng Z+ revised)
- ❌ Thêm cột `archetype` / `trigger_type` / `trigger_config_json` vào `wp_bizcity_skills` (vi phạm Z+1 — skill table chỉ A/B/C, không tiếp thị workflow).
- ❌ Gọi `wp_bizcity_automation_workflows` row là "skill" trong code/doc — vocabulary tách bạch.
- ❌ Đặt `BizCity_Workflow_MD_Compiler` trong `core/skills/includes/` — thuộc domain automation, đặt ở `core/automation/includes/`.
- ❌ Tạo bảng mới cho slash command / workflow template — reuse `bizcity_skills.slash_commands` (skill path) và `bizcity_automation_workflows.trigger_config_json` (workflow path).
- ❌ Tạo REST namespace mới cho workflow CRUD — đã có `bizcity-channel/v1/automation/*` (workflow) + `bizcity/skill/v1` (skill).
- ❌ Tạo parser MD mới — extend `BizCity_Skill_Recipe_Parser` (W2).
- ❌ Tạo `core/automation/skills/` directory — templates nằm ở `core/automation/templates/*.workflow.md`. User skills sống ở `wp-content/uploads/bizcity-skills/*.skill.md` (đã có, không đụng).
- ❌ Bỏ qua block `action.invoke_skill` — gọi LLM tool-loop trực tiếp trong workflow runner (vi phạm R-SKILL §7 “Twin Runner DUY NHẤT”).
- ❌ Bypass `BizCity_Skill_Context` để tự inject persona trong workflow runner — character context propagate qua `payload.character_id` (R-GCB-3) + skill bridge tự nhận priority 93 hook khi /run.

### Reference impls sau khi ship Wave A
- DB extend mẫu: `core/knowledge/includes/class-database.php::ensure_phase_021_character_columns()` (idempotent ALTER pattern).
- Compiler interface mẫu: `core/intent/includes/class-intent-skill-compiler.php` (nếu có; cross-check).
- Round-trip test mẫu: tham khảo style của `tests/test-recipe-parser.php`.

