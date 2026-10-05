# PHASE 0 — AUTOMATION CORE CANON

> **Module:** `core/automation/` — Visual workflow builder for TwinBrain MPR Thinking Timeline.
> **Status:** ACTIVE · v0.24 · 2026-08-16
> **Owner:** Twin AI Core (BizCity Founder)
> **Docs index:** [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md) — bản đồ + quy ước đặt tên +
> rule bump changelog cho mọi tài liệu trong `core/automation/docs/`. Đọc trước khi thêm doc mới.
>
> **Changelog:**
> - v0.24 (2026-08-16): **PHASE 2 HIL PRODUCT MATCHER CONTRACT + DDV.**
>   Ghi vao roadmap contract product catalog suggestions qua
>   `BizCity_TwinBrain_Product_Provider`, exact/SKU/number match va
>   `gpt-4o-mini` JSON candidate matcher voi confidence gate; mo rong probe
>   `twinbrain.hil` Disk/Loader/Runtime evidence. Live Woo catalog/LLM canary
>   van pending, khong danh dau runtime PASS gia.
> - v0.23 (2026-08-16): **PHASE 3 HIL TRACE RECONCILIATION.** Rà lại code so
>   với canonical MPR V5: đồng bộ action `open/cancelled`, thay các mô tả
>   "chưa code" sau khi MVP đã landed, sửa route/payload contract sang
>   `trigger_payload_json`, thêm physical database dimension cho cache HIL,
>   history TTL 5 giây, và ghi rõ 3 GAP còn lại: live canary, slot-progress
>   notice chi tiết, correlation `run_id` trước thời điểm HIL ready.
> - v0.22 (2026-08-16): **PHASE 3 HIL STEP TRACE MVP CODE LANDED · CANARY PENDING.**
>   Them tai lieu [PHASE-3-HIL-STEP-TRACE.md](PHASE-3-HIL-STEP-TRACE.md) va
>   code `BizCity_TwinBrain_HIL_Repository::history()`, REST
>   `/bizcity-automation/v1/hil-trace`, scoped `_hil_id` identity/session hints,
>   tab HIL trong RunTimeline (checklist slot/footnote/polling/Copy/Tai JSON),
>   redaction projection va probe contract. Khong tao event_type/bang moi
>   (R-EVT). UX PHASE-2 da co Copy JSON spec + HIL Config box xanh "Da ap dung
>   HIL (N slots)".
> - v0.21 (2026-08-16): **DOCS-ONLY · PHASE 2 HIL TEMPLATE AUTO-UPGRADE PLAN.**
>   Them tai lieu
>   [PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md](PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP.md)
>   de chot scope rewrite templates FB/Web/Photo/Order, contract
>   `hil_prompt/hil_spec`, auto-check version + auto-bump + auto-upgrade
>   policy cho MVP HIL. Khong co thay doi runtime code trong muc nay.
> - v0.20 (2026-08-16): **CCG-1 BACKEND SLICE IN PROGRESS.** Added shared
>   `BizCity_Automation_Command_Resolver` for exact `#workflow_slug`, scoped
>   `/command-suggestions` REST, and TwinChat/TwinWeb backend dispatch. UI
>   suggestion scopes, timeline hydration, channel milestones and runtime DDV
>   remain pending. No schema change.
> - v0.19 (2026-08-16): **DOCS-ONLY · COMPOSER COMMAND GRAMMAR CANONICAL.**
>   Chốt contract chung TwinChat/TwinWeb/channel tại
>   [TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md](../../../modules/twinchat/docs/TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md):
>   `@guru_slug` = Guru Workspace/notebook policy; `/vertical_slug` = Vertical
>   Brain Mode/Plugin Bridge; `#workflow_slug` = exact single workflow run.
>   Các path `/slash_command` và `@directed workflow` đã ship ở v0.12/v0.18 là
>   **legacy compatibility trong migration window**, không phải grammar mới.
>   `#workflow_slug` phải reuse runner + `workflow_node_*` + SSE/polling +
>   Scheduler Completion Notifier hiện có; không xây timeline/runner thứ hai.
> - v0.18 (2026-07-26): **TRIGGER SINGLE-CLAIM @DIRECTED PRIORITY HOTFIX.** Theo phản hồi runtime,
>   lớp single-claim core v0.17 vẫn cần ưu tiên cứng cho message có `@` command. Đã update matcher để
>   nếu message có `@` + workflow match term `@...` (vd `@ghichu`) thì suppress workflow keyword chung
>   bằng reason `at_keyword_priority` và chỉ chọn winner trong nhóm `@`-directed; đồng thời fallback
>   match `@term` trên `raw_text` khi `message_text_clean` đã strip mention. Mục tiêu: case
>   `@ghichu ... kịch bản ... marketing ...` phải ưu tiên workflow ghi chú, không chạy marketing.
>   Rule cập nhật tại [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md) v1.2.
> - v0.17 (2026-07-26): **TRIGGER SINGLE-CLAIM CORE SHIPPED.** Đã implement matcher single-claim theo
>   [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md): nhánh keyword/filter giờ reduce
>   competing workflows xuống 1 winner (trừ workflow tự khai báo `allow_costack=true`) ở cả 2 call site
>   `on_channel_message()` (dispatch thật) và `find_matching_workflows_for_payload()` (preview bridge).
>   Bổ sung trace `matched_keyword_singleclaim_reduced`, file-log decision `matcher.singleclaim_suppressed`
>   và rollout filter `bizcity_automation_single_claim_enabled`. Đồng bộ status trong
>   [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md) + update R-DCL contract-only
>   `core/diagnostics/changelog/core.automation.json` (v1.13.1) thêm vocab
>   `trigger_config_json.allow_costack`.
> - v0.16 (2026-07-26): **DOCS GOVERNANCE + TRIGGER SINGLE-CLAIM SPEC.** User báo cáo bug fan-out:
>   nhắn `Ghi chú: ...` kèm nội dung chứa chữ "kịch bản"/"marketing" khiến matcher chạy CẢ 3 workflow
>   (Ghi chú + Kịch bản + Marketing) thay vì chỉ 1 workflow đúng ý định. Root cause đã trace trong
>   `class-automation-trigger-matcher.php::on_channel_message()` (nhánh BE-7.E matched-keyword):
>   `exclusive` chỉ lọc NHÓM (không chọn 1 người thắng), `usort()` chỉ đổi thứ tự chạy chứ không cắt
>   bớt `$matched` — mọi workflow match keyword đều được `enqueue_and_optionally_run()`. Đặc tả đầy đủ
>   thuật toán **Single-Claim Resolution** (mode strictness → prefix-anchor → matched-term-length →
>   priority → id tie-break) + cờ đối lập `trigger_config.allow_costack` cho workflow cố ý fan-out
>   (utility/audit-log) tại [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md) — **Status:
>   SPEC, chưa implement code**, chờ pick up theo checklist §7-§8 của rule. Đồng thời thêm
>   [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md) MỚI — index hoá toàn bộ 21 doc cũ +
>   2 doc mới, chuẩn hoá quy ước đặt tên `PHASE-<seq>` / `RULE-` / `GAP-ANALYSIS-` / `WORKFLOW-` /
>   `AUTOMATION-<KEBAB>` cho file tương lai (không rename file cũ — tránh vỡ cross-reference), và lập
>   rule bắt buộc: mọi doc mới PHẢI có 1 dòng trong bảng chỉ mục của index NGAY TRONG CÙNG PR khi bump
>   changelog này.
> - v0.15 (2026-06-07): **UI DUAL-PATH SPEC** — tách mặt tiền automation thành 2 path trên cùng 1 backend: (A) nhánh **ADMIN builder** canvas kéo-thả "giao việc cho não" (Zone 2, hiện hữu) và (B) nhánh **CRM-CARE** recipe chăm sóc kênh khách hàng (Zone 1, mới — recipe gallery + bind-to-channel, KHÔNG canvas CRUD theo R-ZONE-5). Map vào 3 dispatch mode §2 (`run.source` thêm `crm_care`). Lộ trình `CRM-PATH-1..5`: port Zalo (zalo_oa/zalo_personal) trước, Facebook Messenger sau. Spec độc lập: [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md). Tuân R-ZONE ([PHASE-0.40 §1.5](../../channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md#15)).
> - v0.14 (2026-06-03): **WAVE E SHIPPED — Community Gallery PoC (read-only).** **WF-AUTO W7:** `BizCity_Automation_Community` MỚI tại `core/automation/includes/class-automation-community.php` — singleton, fetch GitHub raw `manifest.json` + `.workflow.md` với SSRF guards: HTTPS-only + allowlist host (`raw.githubusercontent.com`, `gist.githubusercontent.com`, filter `bizcity_community_allowed_hosts`) + reject `..` path traversal + size cap (manifest 256KB, MD 512KB) + transient cache 5′ theo md5(URL). Method: `default_manifest_url()` (option `bizcity_automation_community_manifest_url` + filter `bizcity_community_manifest_url`), `validate_url()`, `fetch_manifest()` (whitelist sanitize per item), `fetch_workflow_md()`, `preview_workflow()` (compile qua `BizCity_Workflow_MD_Compiler` — KHÔNG ghi DB). 3 REST route mới trong `class-automation-rest.php` (NS `bizcity-automation/v1`): `GET /community/workflows?manifest_url=` → `community_list()` (fail-OPEN `_degraded`), `GET /community/workflow?url=` → `community_preview()` (fetch + compile preview), `POST /community/workflows/import` body `{url}` → `community_import()` (creates workflow `enabled=0` + slash collision 409 guard + tag suffix `,community`). Wired `core/automation/bootstrap.php` (require sau `class-workflow-md-compiler.php`). **DDV Probe:** `core/diagnostics/includes/probes/class-probe-automation-community.php` MỚI — id `automation.community_gallery`, severity `warning`, 9 steps read-only (disk + loader + allowlist accept + 3 SSRF rejects (`url_not_https`, `url_host_not_allowed`, `url_path_traversal`) + 3 REST routes). Registered `core/diagnostics/bootstrap.php`.
> - v0.13 (2026-06-03): **WAVE D SHIPPED — Seed templates + Matcher hardening + Canvas import/export.** **WF-AUTO W4:** `class-automation-templates-seeder.php` bump `SEED_VERSION` `1.7.0` → `1.8.0` + 2 blueprints mới: `tpl_slash_kg_query_v1` (`trigger.slash_command /kg` → `action.search_kg` → `llm.compose_reply` → `action.reply_zalo`, category=`cskh`) + `tpl_skill_intent_invoke_v1` (`trigger.skill_intent any` → `action.invoke_skill` → `action.log`, category=`mpr`). **WF-AUTO W5:** `class-skill-slash-matcher.php` hardening — `extract_command()`: add len guard `strlen(cmd) > 64 → null`; `try_dispatch()`: request-scoped dedup `static $dispatched = []` — same `/cmd` trong cùng PHP request bị skip (detail=`dedup_skip:already_dispatched_this_request`). **WF-AUTO W6:** Canvas import/export — 2 REST routes mới trong `class-automation-rest.php`: `GET /bizcity-automation/v1/workflows/:id/export-md` → `export_workflow_md()` (gọi `BizCity_Workflow_MD_Compiler::workflow_to_md()`, trả `{ok, md, filename}`, fail-OPEN `_degraded`) + `POST /bizcity-automation/v1/workflows/import-md` → `import_workflow_md()` (body `{md}`, gọi `md_to_workflow()`, slug collision guard, `enabled=0`, 201). **DDV Probe:** `core/diagnostics/includes/probes/class-probe-slash-matcher.php` MỚI — id `automation.slash_matcher`, 8 steps read-only (disk + loader + extract_command unit × 5 + collision empty + try_dispatch plain text + TRIGGER_TYPES vocab + canvas export route + canvas import route); registered `core/diagnostics/bootstrap.php`.
> - v0.12 (2026-06-03): **WAVE C SHIPPED — Dual-tier slash matcher + G2 collision.** **GURU W2:** `BizCity_Skill_Slash_Matcher` MỚI tại `core/skills/includes/class-skill-slash-matcher.php` — singleton, `extract_command(text): {cmd,args}|null` (regex `/^\/[a-zA-Z0-9_\-]+/`, lowercase, args trim), `lookup(cmd): {source,skill?,workflow?}` (Tier 1 skill via `BizCity_Skill_Database::get_by_slash_command()` FIND_IN_SET CSV + skill_key fallback → Tier 2 workflow `trigger_type='slash_command'` + `cfg.slash_command='/cmd'`), `try_dispatch(payload, text): {matched,source,detail,skill_id?,workflow_id?,run_id?}`. Skill hit → fire `bizcity_skill_trigger_pipeline($skill, $args)` (canonical, archetype detected via `BizCity_Skill_Context::detect_archetype()`) + `bizcity_skill_invoked` mirror (chain vo BRIDGE W2 trigger.skill_intent). Workflow hit → `BizCity_Automation_Repo_Runs::enqueue()` + `bizcity_automation_run_enqueued` defer. Wired vo `core/skills/bootstrap.php` (require sau skill-context). **Automation matcher integration:** `class-automation-trigger-matcher.php::on_channel_message()` thêm slash dispatch step giữa `_resume`/`_ref` v keyword — hit → trace `matched_slash` (tier=skill|workflow) + `BizCity_Automation_File_Logger::note_decision('matcher.matched_slash')` (workflow tier) → preempt keyword/fallback. **TRIGGER_TYPES vocab:** `class-automation-repo-workflows.php` extend `'slash_command'` (Tier 2). **GURU W3 G2 collision 409:** `BizCity_Skill_Slash_Matcher::detect_collision($list, $self_kind, $self_id)` — wired vo `class-skill-rest-api.php::update_skill_db()` (skill PUT → check workflow tier) + `class-automation-rest.php::create_workflow|update_workflow()` (workflow POST/PUT — helper `check_slash_collision()` → check skill tier). Conflict → 409 `error: slash_collision` + `conflict: {cmd, conflicts_with, conflict_id, conflict_label}` (machine-readable). **Test:** `tests/test-slash-matcher.php` (admin gate `?bizc_test_slash_matcher=1`) — 12 case: M1 class+extract matrix (6 case incl edge `/`/empty/no-slash) · M2 lookup unknown → source=null · T1 plain text matched=false · T2 bogus /cmd matched=false detail=no_skill_no_workflow_* · T3 detect_collision unknown/empty → null · T4 TRIGGER_TYPES vocab · T5 find_workflow/skill_for_slash safe. **Sẵn sng Wave D (WF-AUTO W4-W6 seed templates port + matcher hardening + Canvas import/export).**
> - v0.11 (2026-06-03): **WAVE B SHIPPED — Bridge blocks (skill ↔ workflow cross-tier).** **BRIDGE W1:** `action.invoke_skill` block MỚI tại `core/automation/includes/blocks/actions/class-action-invoke-skill.php` — fields: `skill_slug` + `prompt_template` ({{trigger.text}} / {{vars.*}}) + `vars_json` + `character_id` + `timeout_seconds`. Resolve skill qua `BizCity_Skill_Database::get_by_slash_command()` (FIND_IN_SET trên `slash_commands` + fallback `skill_key` per R-SKILL); dispatch qua `BizCity_TwinBrain_Runtime::start_turn()` same-process (KHÔNG HTTP). Fail-OPEN hoàn toàn: empty slug / skill_db_missing / skill_not_found / runtime_missing / runtime_error → return `{ok:false, _degraded:true, skill_output:'', reason}` → runner KHÔNG break workflow. R-CRON-META: `note_event('invoke_skill_ok|skipped|failed')`. **BRIDGE W2:** `trigger.skill_intent` block + `BizCity_Automation_Skill_Bridge` subscriber — listen trên `bizcity_skill_trigger_pipeline` (archetype C matcher dispatch) + `bizcity_skill_invoked` (emit từ invoke_skill block + future REST adapter); `class-automation-repo-workflows.php` TRIGGER_TYPES extend thêm `'skill_intent'`. Filter 2-lớp: `skill_slug` (CSV exact match, empty=any) + `archetype` (any/A/B/C). Request-scoped dedup md5 payload. Inject Listener Bus (`BizCity_Automation_Listener::inject('skill_intent', …)`) cho FE Test Listen panel. **Tests:** `tests/test-action-invoke-skill.php` (4 group: meta/empty-slug/unknown-skill/template-resolve/malformed-json/registry) + `tests/test-trigger-skill-intent.php` (5 group: class load/meta/TRIGGER_TYPES/pass-through execute/dispatch no-fatal). Wired `bootstrap.php` (require + `Skill_Bridge::init()`) + `class-block-registry.php` (register both blocks). **Sẵn sàng Wave C (GURU W2 dual-tier slash matcher).**
> - v0.10 (2026-06-03): **WAVE A SHIPPED — Workflow-MD round-trip compiler.** **WF-AUTO W1:** schema audit `bizcity_automation_workflows` — `trigger_type` (VARCHAR 32) + `trigger_config_json` (TEXT NULL) đều đã có từ 1.0.0 → DCL contract-only bump `core.automation.json` 1.7.0 → 1.7.1 (vocab lock + G1 archetype reminder). **WF-AUTO W2:** `BizCity_Skill_Recipe_Parser` extend 2 method MỚI — `require_archetype(fm, expected): true|WP_Error` (Guardrail G1 enforcement: reject khi `archetype != workflow`) + `extract_workflow_steps(body): [{id, block_id, label, config}]` (grammar `## Steps` → `### N. \`block_id\` — label` + fenced YAML block) + private `extract_yaml_block()` YAML-subset reader (PHP 7.4 floor, không cần ext yaml; hỗ trợ scalar + `key: |` block-scalar + cast bool/null/int). KHÔNG dùng cho `.skill.md`. **WF-AUTO W3:** `BizCity_Workflow_MD_Compiler` MỚI tại `core/automation/includes/class-workflow-md-compiler.php` — 3 API public: `md_to_workflow(md): array|WP_Error` (G1 + parser → xyflow `{nodes,edges,meta}` + linear default edges + position fallback `(i*320, 80)`), `workflow_to_md(wf): string` (round-trip emit frontmatter + `## Steps` + `## Edges` conditional + `## Layout` always), `validate_md(md): true|WP_Error` (slug/name/no_steps/edge_orphan sanity). Wired vào `core/automation/bootstrap.php` sau `class-automation-twin-event-tap.php`. **Test suite** `core/automation/tests/test-workflow-md-compiler.php` (admin-gate `?bizc_test_wf_md=1` or wp-cli eval-file) — 15 case PASS coverage: G1 reject missing/wrong archetype · linear 3-step round-trip · block-scalar preserve · node type inferred (trigger/llm/action) · branching `## Edges` với sourceHandle (`yes`/`no`) · `## Layout` x/y persist · `validate_md` reject no_steps. **Sẵn sàng Wave B (BRIDGE W1 `action.invoke_skill`).**
> - v0.9 (2026-06-03): **WAVE 0 SHIPPED — Guru-Channel UI end-to-end.** R-DA second pass xác nhận mọi REST infra đã ship Phase 0.33 → scope giảm "no new file" strategy. **W0.1:** R-GCB-7 validation trong `rest_binding_upsert` — reject Guru `status ∉ {active, published}` với code `guru_not_publishable / guru_not_found`. **W0.2:** Tab "Channels" trong `core/knowledge/views/character-edit.php` — inline JS lazy-load, reuse `bizcity-channel/v1/inspector/*` endpoints; bind dialog (platform picker, mode select, auto-reply, fallback assignee), disable binding, badge mode (auto/manual/hybrid/roundrobin). **W0.3:** `GuruChannelPicker.jsx` (new) — dropdown gurus + binding preview (yellow warn nếu 0 channels); wired vào `Inspector.jsx` FieldRow type `guru_picker`; 4 trigger blocks (Zalo OA/FB comment/FB message/Telegram) đổi `guru_id` từ `number` → `guru_picker`; `automationApi.gurus()` + `guruChannels(id)` cross-namespace fetch; `npm run build` PASS. **W0.4+W0.5:** `class-probe-channel-binding.php` (new) — DDV 3-layer (disk+BOM, 3 class load + DB table, 3 REST routes + 2 live dispatches + resolve callable + orphan scan); registered trong `core/diagnostics/bootstrap.php`. **R-DCL debt trả:** `core.channel-gateway.json` bump 1.0.0 → 1.2.0 + `bizcity_channel_bindings` table formalized (columns, mode enum auto/manual/hybrid/roundrobin, all indexes). **3 Guardrails adopted:** G1 archetype frontmatter discriminator (Wave A), G2 cross-tier slash collision 409 (Wave C), G3 ≥70% action blocks ported = trigger PHASE-X-RUNNER-UNIFY kickoff (quarterly monitor). Doc [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) bumped v1.3 → v1.4.
> - v0.8 (2026-06-03): **R-SKILL §7 CONFLICT RESOLVED — Hướng Z+ adopted.** [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) bump **v1.3** unparking Wave A-D với 5 quyết định cốt lõi: (Z+1) `bizcity_skills` chỉ chứa Archetype A/B/C — Twin Runner DUY NHẤT; KHÔNG thêm cột workflow vào table này. (Z+2) `bizcity_automation_workflows` + `BizCity_Automation_Runner` giữ độc lập với vocabulary "workflow" (≠ "skill"). (Z+3) File extension tách: `.skill.md` (A/B/C) ↔ `.workflow.md` (D); parser **chung class** `BizCity_Skill_Recipe_Parser` với method `extract_workflow_steps()` chỉ gọi cho `.workflow.md`. (Z+4) Workflow tham chiếu skill qua block `action.invoke_skill {skill_slug}` build /run request → Twin Runner xử lý (R-SKILL §3.4 surface pattern). (Z+5) Slash/guru_mention dual-tier matcher: skill path trước (qua `bizcity_skills.slash_commands` CSV), workflow path sau (qua `wp_bizcity_automation_workflows.trigger_config_json`). Sprint plan đổi tên `SKILL-AUTO W*` → `WF-AUTO W*` + thêm Wave B BRIDGE blocks (`action.invoke_skill` + `trigger.skill_intent`) cross-tier. Migration tương lai sang Hướng Y (hợp nhất runner) đặt tên `PHASE-X-RUNNER-UNIFY` (TBD, ngoài scope hiện tại).
> - v0.7 (2026-06-03): **WAVE 0 PRIORITY + R-DA + R-GCB ship.** User mandate "Guru phụ trách kênh nào phải làm trước, ưu tiên". Audit lại R-SKILL §0+§7 phát hiện đề xuất v1.1 "Skill Archetype D chạy bằng `BizCity_Automation_Runner`" có thể vi phạm "không runner riêng → Twin Runner là engine DUY NHẤT". [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) **bump v1.2** — Wave A-D PARKING chờ user duyệt 1 trong 3 hướng (X tách biệt strict / Y hợp nhất runner / Z file chung table khác — khuyến nghị Z). Wave 0 **TOP PRIORITY** = Guru ↔ Channel Binding UI (REST `/character/{id}/channels/*` + tab "Channels" trong character-edit + Guru picker trong trigger Zalo/FB/Telegram/WebChat block + DDV row + payload.character_id injection audit). BE đã ship Phase 0.33 (`bizcity_channel_bindings` + `BizCity_Channel_Binding` API). 2 rule mới: [PHASE-0-RULE-DESIGN-AUDIT.md](../../../docs/rules/PHASE-0-RULE-DESIGN-AUDIT.md) (R-DA, Tier 0 — audit `docs/rules/` → `core/` → `docs/roadmaps/` trước khi viết doc/code; sinh ra từ case 3 lần đại tu v1.0 → v1.1 → v1.2) + [PHASE-0-RULE-GURU-CHANNEL-BINDING.md](../../../docs/rules/PHASE-0-RULE-GURU-CHANNEL-BINDING.md) (R-GCB, Tier 2 — `channel_bindings.(platform, account_id) → character_id` SoT duy nhất; cấm bảng/option phụ).
> - v0.6 (2026-06-03): **REVISION** — audit `core/skills/` phát hiện module skill library đã ship đầy đủ (bảng `wp_bizcity_skills` v1.4.1 + parser + REST `bizcity/skill/v1` + archetype A/B/C/D). [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md) **v1.1** đảo quyết định: KHÔNG tạo bảng/dir/parser/REST mới; reuse `core/skills/` và extend 3 cột (`archetype`, `trigger_type`, `trigger_config_json`). Workflow Automation = **Skill Archetype D**. Slash command dùng `bizcity_skills.slash_commands` CSV col (đã có) thay vì bảng mới. Persona overlay = `BizCity_Skill_Context` priority 93 (đã có). Cải tiến sắp xếp wave A-D xem PHASE-WORKFLOW-AS-SKILL §11.
> - v0.5 (2026-06-03): Thêm **PHASE-WORKFLOW-AS-SKILL** — bidirectional Skill MD ↔ Workflow JSON converter + chi tiết spec **GURU W2** (`trigger.guru_mention`) + **GURU W3** (`trigger.slash_command` + DCL table `bizcity_automation_slash_commands`) + **SKILL W1** (`action.persona_overlay`). Tuyên ngôn: workflow = chain skill; guru = persona context layer phủ lên skill, không phải loại workflow riêng. Chi tiết: [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md).
> - v0.4 (2026-06-02): Thêm **R-FINAL-ACTION** (Tier tối thượng) — mọi action cuối nhánh DAG phải quad-commit (scheduler row · notify · edit link · ack callback). Chi tiết: [PHASE-R-FINAL-ACTION.md](PHASE-R-FINAL-ACTION.md). Thêm **SEED W1** roadmap: seed knowledge-router + remember-this (xem [PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md](PHASE-SEED-TEMPLATES-AND-GURU-TRIGGER.md)).
> - v0.3 (2026-05-28): **Đảo chiều UI** sau khi rà Channel Gateway SPA hiện hữu (`?page=bizchat-gateway-spa` — Redux Toolkit + Tailwind + Radix UI, 10+ routes). KHÔNG build React app riêng dưới `core/automation/admin/ui/`. Thay đó **mount vào SPA hiện có** dưới route `/automation/*` + `redux/api/automationApi.js`. Xóa §7 bố cục `admin/ui/` cũ. Thêm §20 UI integration plan + §21 Zalo Bot binding flow + §22 Campaign ⋋ Workflow relationship + §23 UI-first sprint reorder.
> - v0.2 (2026-05-28): Vá 4 gap từ phản biện khả thi.
> - v0.1 (2026-05-28): Initial canon.
> **Related rules:** **R-FINAL-ACTION** (Tier tối thượng) · R-AGENTIC · R-MPRT (Tier 2) · R-EVT (Tier 1) · R-DCL (Tier 0) · R-CRON-META (Tier 1) · R-CH-NS · R-GW-8 · R-NO-CONFLICT · [RULE-INBOUND-DISPATCH-PRIORITY.md](RULE-INBOUND-DISPATCH-PRIORITY.md) (Tier 2) · [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md) (Tier 2, ACTIVE/SHIPPED core + legacy @ compatibility)
> **Source legacy port:** [plugins/bizcity-automation/modules/workflow/](../../../../bizcity-automation/modules/workflow/) (WAIC engine — extract minimal core only)
> **UI library chosen:** [`@xyflow/react`](https://reactflow.dev/) v12 — MIT — confirmed fit (xem §6)

---

## 0. Tuyên ngôn (1 câu)

> **Workflow Builder là cùng-một-bộ-não với TwinChat: bạn build kịch bản trên canvas → khi user hỏi qua TwinChat hoặc Zalo Bot, runtime chạy đúng kịch bản đó và stream từng step lên UI như chat hiện tại. Builder = mode design-time, Chat = mode run-time. CHUNG 1 event stream, CHUNG 1 runner, CHUNG 1 block registry.**

→ KHÔNG có "engine workflow" tách biệt khỏi TwinBrain. Workflow JSON chỉ là một dạng **forced reasoning trace** đã được user-edit.

---

## 0.1 RULE TỐI THƯỢNG — R-AUTO-TEMPLATE-ID · Template UUID / Version / Visibility

Mọi automation template JSON mới PHẢI có định danh nội dung ổn định, không phụ thuộc tên hiển thị hoặc slug:

```json
{
  "template_uuid": "018fb5fd-8a22-7a10-9f79-4b6474dbb004",
  "template_version": "1.0.0",
  "visibility": "global",
  "slug": "tpl_example_v1",
  "name": "[global] Example template"
}
```

Rules:

- `template_uuid` là canonical identity để seeder/Hub update template. Slug chỉ là human/stable handle và legacy fallback.
- `template_version` là version nội dung do tác giả bump theo semver. DB column `version` chỉ là row revision, không thay thế `template_version`.
- `visibility` bắt buộc là `global` hoặc `private`:
  - `global`: public ZaloBot / public-safe workflow, có thể match selector toàn cục và reply đúng private/group chat.
  - `private`: cần linked `wp_user_id`, có thể dùng private memory/notebook/resource, không được public global.
- Template `visibility=global` PHẢI prefix `name` bằng `[global]`, ví dụ `[global] Zalo Bot · Tra cứu pháp luật`.
- Không đổi `slug` chỉ để thêm `[global]`; đổi `name`, `tags`, `visibility`, `template_version` và giữ `template_uuid`.
- Seeder update priority phải là `template_uuid` trước, rồi fallback `slug` cho legacy template chưa migrate.
- Mọi thay đổi thêm cột/index cho template identity phải đi qua R-DCL + R-CR + DDV trước khi code runtime phụ thuộc vào field mới.

Anti-patterns CẤM:

- ❌ Template JSON mới thiếu `template_uuid`, `template_version`, hoặc `visibility`.
- ❌ Dùng slug rename (`tpl_x_v1` → `tpl_global_x_v1`) để tránh duplicate thay vì dùng UUID.
- ❌ Coi `bizcity_automation_templates.version` là version nội dung template.
- ❌ Global ZaloBot template đọc private memory/resource khi chưa resolve linked `wp_user_id`.
- ❌ Group ZaloBot global template reply về sender identity thay vì `conversation_chat_id`.

---

## 0.2 RULE — Customer Workflow Authoring vs Admin Must-Use Library

Twin GPT customer surface `/gpt/myworkflows/` / `/flow/` không phải read-only gallery. Customer đã đăng nhập (`read`) được dùng canvas workflow bình thường:

- tạo workflow mới;
- mở canvas editor;
- lưu, bật/tắt, xóa workflow do chính họ tạo (`created_by=current_user_id`);
- chạy thử workflow do chính họ tạo;
- nhìn thấy workflow admin publish dạng `customer_default` / `must-use` và duplicate thành bản riêng để chỉnh.

Khác biệt của admin (`manage_options`):

- admin được dùng Template Gallery, Hub import, Community import và Save as template;
- admin được publish hoặc unpublish workflow thành `customer_default` / `must-use` áp cho toàn bộ user trong blog client;
- admin được sửa/xóa mọi workflow trong blog.

Customer không được sửa trực tiếp workflow must-use/global do admin tạo. Nếu cần chỉnh, customer duplicate workflow đó để tạo bản riêng. REST phải enforce theo ownership, không chỉ ẩn nút trên FE.

---

## 1. Tại sao port `bizcity-automation/modules/workflow/` (mà không port toàn plugin)

Audit plugin `plugins/bizcity-automation/`:

| Module | Vai trò | Port? |
|---|---|---|
| `modules/workflow/lib/execute-api.php` | BFS executor, variable resolver, HIL pause | **✅ PORT** — 100% portable, no external dep |
| `modules/workflow/lib/listener-api.php` | "Listen for test event" — real-time capture | **✅ PORT** — pattern test/replay rất chuẩn |
| `modules/workflow/lib/ai-dashboard-api.php` | NLP→workflow JSON gen | **⚠️ PHASE 2** — sau khi runtime ổn |
| `modules/workflow/blocks/trigger.php` `action.php` `logic.php` | Base abstractions | **✅ PORT** — base class WaicAction/Trigger/Logic |
| `modules/workflow/blocks/triggers/*` (36 files) | wu_zalobot_msg, sy_schedule, bc_adminchat_message... | **✅ PORT CHỌN LỌC** — chỉ những cái dùng channel-gateway |
| `modules/workflow/blocks/actions/ai_*.php` (40+) | ai_generate_content, ai_intent_router_json... | **✅ GIỮ NGUYÊN tại modules/webchat/blocks** (đã có) |
| `modules/workflow/blocks/actions/it_*.php` | TwinBrain-aware (it_call_tool, it_call_memory...) | **✅ GIỮ NGUYÊN tại modules/webchat/blocks** (đã có) |
| `modules/workflow/blocks/actions/wp_send_zalo_bot_*.php` | Channel distributor | **✅ PORT** — sau khi xác nhận hook channel-gateway |
| `modules/workflow/models/`, `controller.php`, `mod.php` | WaicFrame MVC | **✅ PORT** chỉ phần models cho workflows/runs |
| `modules/workspace/` | Task mgmt UI | **❌ BỎ** — dùng `core/scheduler/` (crm_events) |
| `modules/options/`, `modules/adminmenu/`, `modules/mcp/` | Settings, legacy menu | **❌ BỎ** — không cần |
| `classes/*` (WaicFrame, Dispatcher, Db, Utils) | 35+ framework class | **⚠️ PORT TỐI THIỂU** — chỉ `WaicBuilderBlock`, `WaicAction`, `WaicTrigger`, `WaicLogic`, `WaicUtils::getArrayValue`. Replace `WaicDb` → `$wpdb` direct. Replace `WaicFrame` → service container của core. |

**Tổng tỷ lệ port:** ~15% codebase plugin gốc. Phần còn lại là bloat workspace/options/legacy install framework — vứt.

---

## 2. Kiến trúc đôi mode (Design ↔ Run)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       DESIGN TIME (Builder UI)                          │
│                                                                         │
│   React (@xyflow/react) Canvas                                          │
│        │                                                                │
│        ├─ NodePalette ── danh sách blocks (từ block registry REST)     │
│        ├─ FlowCanvas   ── kéo-thả, edge connect, sourceHandle           │
│        ├─ NodeConfigPanel ── form theo getSettings() schema             │
│        ├─ TestRunner   ── "Listen for test event" (listener-api port)  │
│        └─ Timeline     ── live SSE từ test run (twin_event subscribe)   │
│        │                                                                │
│        ▼                                                                │
│   POST /bizcity-channel/v1/automation/workflows {definition_json}       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        RUN TIME (3 dispatch modes)                      │
│                                                                         │
│  ┌─ A. TwinChat (Agent Mode) ──────────────────────────────────────┐   │
│  │  user: "@workflow:dang_fb_daily run"                            │   │
│  │   → TwinBrain_Runtime::start_turn(opts={workflow_id})           │   │
│  │   → Compiler: workflow JSON → forced chain of phase events      │   │
│  │   → Mỗi node run = 1 phase event lên SSE twin_event             │   │
│  │   → ChatPanel render = timeline workingSteps[] (đã có)          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ B. Inbound Channel (Zalo / FB / WebChat) ─────────────────────┐    │
│  │  POST /bizcity-channel/v1/webhook/zalo_bot/{oa_id}              │   │
│  │   → Channel Gateway normalize → fires:                          │   │
│  │     do_action('waic_twf_process_flow', 'bizcity_zalo_message    │   │
│  │                                          _received', $payload)  │   │
│  │   → Trigger_Matcher tìm workflows active match trigger          │   │
│  │   → Scheduler_Manager::create_event(type=workflow_scheduled)    │   │
│  │     ← USER NHÌN THẤY TRONG SCHEDULER ✓ (R-CRM-EVENTS)           │   │
│  │   → Runner.run() (sync nếu instant, qua cron nếu delay)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─ C. Cron / Schedule ───────────────────────────────────────────┐    │
│  │  bizcity_scheduler_reminder_fire → Trigger sy_schedule          │   │
│  │   → Same Runner path as B                                       │   │
│  │   → R-CRON-META: note_event('workflow_step_*', ...)            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Quan sát then chốt:** Mode A và Mode B/C **chia sẻ cùng `BizCity_Automation_Runner`**. Khác nhau duy nhất ở `source` field của run row (`agent_mode` vs `zalo_msg` vs `cron`).

---

## 3. Tại sao `@xyflow/react` là lựa chọn đúng

Đã verify [core/automation/_library/xyflow-main/README.md](../_library/xyflow-main/README.md):

| Tiêu chí | xyflow/react v12 | Verdict |
|---|---|---|
| **License** | MIT | ✅ ship vô tư |
| **Tuổi/maintain** | wbkd/xyflow, active, >25K stars npm pulls hàng triệu/tuần | ✅ |
| **Schema node/edge** | `{id, position, data, type}` + `{source, target, sourceHandle}` | ✅ **ăn 1-1** với WAIC `{nodes[], edges[]}` (xem §4) — KHÔNG cần convert |
| **Custom node types** | `nodeTypes={ trigger:TriggerNode, action:ActionNode, logic:LogicNode }` | ✅ map đúng 3 base class WAIC |
| **sourceHandle routing** | Native — multi handle per node | ✅ khớp logic block branch (true/false handle WAIC) |
| **Controlled mode** | `useNodesState` / `useEdgesState` | ✅ Zustand wrap dễ |
| **Bundle size** | ~50KB gzipped (system + react) | ✅ |
| **Vietnamese community** | Đủ docs EN; team đã quen React+Zustand | ✅ |
| **Vs activepieces** | Activepieces là Zapier-clone full-stack TS monorepo, không lift component được | ✅ xyflow đúng layer (engine canvas), activepieces sai layer |

**Kết luận:** xyflow vừa khít. KHÔNG cần build canvas tay. KHÔNG dùng activepieces.

`_library/activepieces-main/` giữ làm reference design only (đọc pattern UX node palette, không port code).

---

## 4. JSON Workflow Schema (canonical)

**Quy tắc tối thượng:** Schema = **superset của WAIC `params` JSON cũ** + **subset của xyflow native**. Không invent format mới.

```jsonc
{
  "version": 1,                            // schema version
  "meta": {
    "name": "Đăng bài FB hàng ngày",
    "guru_id": 12,                         // (optional) pin Guru cho cả workflow
    "trust_tier": 2                        // max tier of any node — used for ACL
  },

  "trigger": {                              // resolved meta from first trigger node (cache)
    "type": "zalo_msg",                    // manual|agent_mention|zalo_msg|fb_msg|cron|webhook
    "match": { "text_contains": "đặt lịch" }
  },

  "nodes": [
    {
      "id": "n1",
      "type": "trigger",                   // xyflow nodeType — maps to base class WaicTrigger
      "position": { "x": 0, "y": 0 },
      "data": {
        "block_code": "wu_zalobot_message_received",  // WAIC block code
        "label": "Tin nhắn Zalo OA đến",
        "params": { "oa_id": "12345" }
      }
    },
    {
      "id": "n2",
      "type": "action",
      "position": { "x": 260, "y": 0 },
      "data": {
        "block_code": "it_call_tool",                 // existing TwinBrain block
        "label": "🔍 Search KG",
        "params": {
          "tool_id": "search_kg",
          "input_json": "{\"query\":\"{{node#n1.text}}\",\"k\":5}"
        }
      }
    },
    {
      "id": "n3",
      "type": "action",
      "position": { "x": 520, "y": 0 },
      "data": {
        "block_code": "it_call_content",
        "label": "✍️ Compose reply",
        "params": {
          "skill_key": "zalo_friendly_reply",
          "input_vars": "{{node#n2.result_json}}"
        }
      }
    },
    {
      "id": "n4",
      "type": "logic",
      "position": { "x": 780, "y": 0 },
      "data": {
        "block_code": "un_if",
        "label": "Confidence ≥ 0.7 ?",
        "params": { "expression": "{{node#n3.confidence}} >= 0.7" }
      }
    },
    {
      "id": "n5",
      "type": "action",
      "position": { "x": 1040, "y": -100 },
      "data": {
        "block_code": "wp_send_zalo_bot_text",
        "label": "📤 Reply qua Zalo",
        "params": { "user_id": "{{node#n1.user_id}}", "text": "{{node#n3.content}}" }
      }
    },
    {
      "id": "n6",
      "type": "action",
      "position": { "x": 1040, "y": 100 },
      "data": {
        "block_code": "it_summary_verifier",
        "label": "🧐 HIL verify",
        "params": { "preview_to_admin": true }
      }
    }
  ],

  "edges": [
    { "id": "e1", "source": "n1", "target": "n2", "sourceHandle": "out" },
    { "id": "e2", "source": "n2", "target": "n3", "sourceHandle": "out" },
    { "id": "e3", "source": "n3", "target": "n4", "sourceHandle": "out" },
    { "id": "e4", "source": "n4", "target": "n5", "sourceHandle": "output-right" },  // true branch
    { "id": "e5", "source": "n4", "target": "n6", "sourceHandle": "output-left"  }   // false branch
  ]
}
```

**Biến chaining (port nguyên xi từ WAIC):**

| Pattern | Resolves |
|---|---|
| `{{node#n1.text}}` | Output `text` của node n1 |
| `{{node#n2.result_json.products[0].name}}` | Dot-path vào JSON |
| `{{trigger.user_id}}` | Alias node trigger |
| `{{user.display_name}}` | WP user current (run context) |
| `{{skill.content}}` | Skill content injected từ provider |

Resolver: port `WaicBuilderBlock::replaceVariables()` → `BizCity_Automation_Var_Resolver::resolve($str, $ctx)`.

---

## 5. Block taxonomy trong `core/automation/`

| Type | Source code | Vai trò | Tier (R-MPRT-12) |
|---|---|---|---|
| **trigger** | `core/automation/blocks/triggers/*` | Khởi động flow (channel msg / cron / manual) | retriever side |
| **action** | `core/automation/blocks/actions/*` (rỗng — chỉ block riêng cho core) **HOẶC** discover từ `modules/webchat/blocks/actions/` qua filter `bizcity_automation_external_blocks_paths` | Thực thi work | producer/distributor |
| **logic** | `core/automation/blocks/logics/*` | If/loop/switch — KHÔNG side-effect | system |

**Cơ chế discovery (port WAIC):**

```php
// core/automation/includes/class-automation-block-registry.php
public function get_block_paths(): array {
    $paths = [
        BIZCITY_AUTOMATION_DIR . 'blocks/',  // core blocks
    ];
    /**
     * Plugin / module register paths của mình.
     * Ví dụ: modules/webchat/bootstrap.php → add 'modules/webchat/blocks/'
     *        plugins/bizcity-zalo-bot/bootstrap.php → add 'blocks/'
     */
    return apply_filters( 'bizcity_automation_external_blocks_paths', $paths );
}
```

→ **KHÔNG copy `modules/webchat/blocks/actions/it_*.php`** sang `core/automation/`. Cứ để nguyên tại chỗ + register path qua filter. **Single source of truth cho mỗi block**.

---

## 6. Mapping MPR Thinking Layers ↔ Workflow Nodes (2 chiều)

### 6.1 Reverse: Live MPR turn → render timeline (read-only)
TwinChat hiện tại đã render timeline từ `twin_event` SSE stream. Không cần thay đổi.

### 6.2 Forward: Workflow JSON → forced MPR turn (Builder ↦ Runner)

Mỗi node ↦ phase event chính nó emit. Builder không invent layer mới — chỉ **chốt sequence** mà runner phải đi.

| Workflow node `block_code` | TwinBrain layer | Phase event emit |
|---|---|---|
| `bc_instant_run` | Layer 0 (pre_rules) | `pre_rules_done` |
| `wu_zalobot_message_received` / `bc_adminchat_message` | Layer 0 (inbound) | `pre_rules_done` |
| (implicit) | Layer 1 (Guru Lookup) — luôn chạy nếu workflow có `meta.guru_id` | `guru_resolved` |
| `it_call_skill` | Layer 1 ext | `guru_skill_resolved` |
| `it_call_research` | Layer 2.5 retriever | `tool_done(tool=web_research)` |
| `it_call_tool` (tool_id=search_kg) | Layer 2.5 retriever | `tool_done(tool=search_kg)` |
| `it_call_memory` | Layer 3 memory | `memory_recall` |
| `it_todos_planner` | Layer 4 planning | `synthesis_started` |
| `it_call_content` | Layer 4.5 composer | `synthesis_done` + `final_compose` |
| `it_summary_verifier` | Layer 5 cite verify | `cite_resolved` |
| `wp_send_zalo_bot_text` | Layer 6 distributor | `tool_done(tool=zalo_send)` |
| `un_if` / `un_loop` | (control flow — không phải MPR layer) | `workflow_branch_taken` (event_type mới) |

**Tuân thủ R-EVT-2:** KHÔNG tạo bảng log mới. Mọi step trace đi vào `bizcity_twin_event_stream`. Cần 2 event_type mới (qua RFC):
- `workflow_node_started { workflow_id, node_id, block_code }`
- `workflow_node_done { workflow_id, node_id, ok, ms, output_ref }`

→ FE `<WorkflowTimeline>` subscribe `twin_event`, filter `event_type IN ('workflow_node_*', 'tool_done', 'pre_rules_done', ...)`, render xyflow nodes với status badge `pending/running/done/failed`.

### 6.3 Canonical explicit command `#workflow_slug` (2026-08-16)

Contract cross-surface nằm tại
[TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md §6](../../../modules/twinchat/docs/TWINBRAIN-VERTICAL-PLUGIN-BRIDGE-UNIFY.md).
Automation nhận `#workflow_slug` như explicit directed trigger:

1. exact tenant-local slug lookup + `command_invokable=true` +
  actor/Zone/resource authorization;
2. single-claim đúng một workflow, không fall-through fuzzy keyword/fallback;
3. giữ `metadata.inbound` và run provenance TwinChat/TwinWeb/Zalo Bot;
4. reuse `BizCity_Automation_Runner`, `workflow_node_*`, SSE
  `/runs/{run_id}/events`, polling fallback và Scheduler Completion Notifier;
5. channel chỉ nhận ACK + milestone có `notify_progress=true`/failure + final,
  throttle/dedupe `(run_id,node_id,status)` — không spam mọi internal node;
6. cron không có inbound chỉ ghi run timeline + JSONL + R-CRON-META, không
  fallback gửi cho admin/user khác.

`/slash_command` và `@directed workflow` đã ship giữ compatibility trong
migration window, nhưng không được dùng làm grammar/template mới.

---

## 7. Bố cục thư mục đề xuất

```
core/automation/
├─ bootstrap.php                                  # require + ::init() sau require_once (tránh anti-pattern)
├─ AUTOMATION-0-CANON.md                          # ← file này
│
├─ includes/
│  ├─ class-automation-block-registry.php         # discovery + filter ext paths (port WAIC pattern)
│  ├─ class-automation-workflow-repo.php          # CRUD wp_bizcity_automation_workflows
│  ├─ class-automation-run-repo.php               # CRUD wp_bizcity_automation_runs
│  ├─ class-automation-var-resolver.php           # port WaicBuilderBlock::replaceVariables()
│  ├─ class-automation-executor.php               # PORT execute-api.php BFS loop
│  ├─ class-automation-listener.php               # PORT listener-api.php transient-based capture
│  ├─ class-automation-trigger-matcher.php        # hook 'waic_twf_process_flow' → match workflow
│  ├─ class-automation-runner.php                 # 1 entrypoint chung cho cả 3 mode A/B/C
│  ├─ class-automation-scheduler-bridge.php       # bind crm_events (R-CRM tối thượng)
│  ├─ class-automation-event-emitter.php          # emit workflow_node_started/done qua Event_Bus
│  ├─ class-automation-twinbrain-bridge.php       # adapter mode A: start_turn(opts.workflow_id)
│  ├─ class-automation-rest-api.php               # /bizcity-channel/v1/automation/* (R-CH-NS)
│  └─ base/
│     ├─ class-block-base.php                     # PORT WaicBuilderBlock
│     ├─ class-block-trigger.php                  # PORT WaicTrigger
│     ├─ class-block-action.php                   # PORT WaicAction
│     └─ class-block-logic.php                    # PORT WaicLogic
│
├─ blocks/                                        # CORE blocks only (không phải mọi block)
│  ├─ triggers/
│  │  ├─ sy_manual.php                            # PORT
│  │  └─ sy_schedule.php                          # PORT (cron)
│  └─ logics/
│     ├─ un_if.php                                # PORT
│     ├─ un_switch.php
│     └─ un_loop.php
│
├─ admin/
│  └─ class-automation-admin-bridge.php          # NHÚNG vào channel-gateway SPA — KHÔNG menu riêng.
│                                                  # Inject route config + boot data vào window.BIZCITY_CG_BOOT.automation
│                                                  # (xem §20 UI Integration Plan)
│
│  (KHÔNG có admin/ui/ — v0.3 mất React app riêng. UI sống trong SPA của Channel Gateway.)
│
├─ samples/
│  ├─ zalo-auto-reply.json
│  ├─ scheduled-fb-post.json
│  └─ agent-mention-task.json
│
└─ _library/                                       # reference only — NOT loaded
   ├─ xyflow-main/                                # MIT, study only
   └─ activepieces-main/                          # MIT + EE, study only
```

---

## 8. Schema DB (R-DCL — đăng ký trước khi viết code)

File: `core/diagnostics/changelog/core.automation.json` v0.1.0

```jsonc
{
  "module_id": "core.automation",
  "current_version": "0.1.0",
  "tables": {
    "bizcity_automation_workflows": {
      "columns": {
        "id":             { "type": "BIGINT UNSIGNED", "pk": true, "auto_increment": true, "since": "0.1.0" },
        "owner_id":       { "type": "BIGINT UNSIGNED", "null": false, "since": "0.1.0" },
        "guru_id":        { "type": "BIGINT UNSIGNED", "null": true,  "since": "0.1.0" },
        "name":           { "type": "VARCHAR(190)",    "null": false, "since": "0.1.0" },
        "slug":           { "type": "VARCHAR(190)",    "null": false, "since": "0.1.0" },
        "trigger_type":   { "type": "VARCHAR(64)",     "null": false, "since": "0.1.0",
                            "comment": "manual|agent_mention|zalo_msg|fb_msg|webchat_msg|cron|webhook" },
        "trigger_config": { "type": "LONGTEXT",        "null": true,  "since": "0.1.0" },
        "definition_json":{ "type": "LONGTEXT",        "null": false, "since": "0.1.0",
                            "comment": "xyflow {nodes:[],edges:[]} — superset WAIC params" },
        "version":        { "type": "INT UNSIGNED",    "null": false, "default": 1, "since": "0.1.0" },
        "status":         { "type": "VARCHAR(16)",     "null": false, "default": "'draft'", "since": "0.1.0",
                            "comment": "draft|active|paused|archived" },
        "trust_tier_max": { "type": "TINYINT",         "null": false, "default": 4, "since": "0.1.0" },
        "created_at":     { "type": "DATETIME",        "null": false, "since": "0.1.0" },
        "updated_at":     { "type": "DATETIME",        "null": false, "since": "0.1.0" }
      },
      "indexes": {
        "idx_owner_status":  { "cols": ["owner_id","status"], "since": "0.1.0" },
        "idx_trigger":       { "cols": ["trigger_type","status"], "since": "0.1.0" },
        "uk_owner_slug":     { "cols": ["owner_id","slug"], "unique": true, "since": "0.1.0" }
      }
    },
    "bizcity_automation_runs": {
      "columns": {
        "id":             { "type": "BIGINT UNSIGNED", "pk": true, "auto_increment": true, "since": "0.1.0" },
        "workflow_id":    { "type": "BIGINT UNSIGNED", "null": false, "since": "0.1.0" },
        "trace_id":       { "type": "VARCHAR(64)",     "null": false, "since": "0.1.0",
                            "comment": "LINK to bizcity_twin_event_stream.trace_id — KHÔNG duplicate steps (R-EVT-2)" },
        "scheduler_event_id": { "type": "BIGINT UNSIGNED", "null": true, "since": "0.1.0",
                                "comment": "LINK to wp_bizcity_crm_events.id — user nhìn thấy" },
        "source":         { "type": "VARCHAR(32)",  "null": false, "since": "0.1.0",
                            "comment": "agent_mode|zalo_msg|fb_msg|webchat_msg|cron|manual|test" },
        "source_ref":     { "type": "VARCHAR(190)", "null": true,  "since": "0.1.0" },
        "status":         { "type": "VARCHAR(16)",  "null": false, "default": "'queued'", "since": "0.1.0",
                            "comment": "queued|running|waiting|completed|failed|cancelled" },
        "waiting_until":  { "type": "DATETIME",  "null": true, "since": "0.1.0",
                            "comment": "HIL pause expiry — port WAIC pattern" },
        "current_node_id":{ "type": "VARCHAR(64)","null": true, "since": "0.1.0" },
        "started_at":     { "type": "DATETIME",  "null": true, "since": "0.1.0" },
        "ended_at":       { "type": "DATETIME",  "null": true, "since": "0.1.0" },
        "error_text":     { "type": "TEXT",      "null": true, "since": "0.1.0" }
      },
      "indexes": {
        "idx_workflow":   { "cols": ["workflow_id","status"], "since": "0.1.0" },
        "idx_trace":      { "cols": ["trace_id"], "since": "0.1.0" },
        "idx_sched_evt":  { "cols": ["scheduler_event_id"], "since": "0.1.0" },
        "idx_waiting":    { "cols": ["status","waiting_until"], "since": "0.1.0" }
      }
    }
  },
  "history": [
    { "version": "0.1.0", "date": "2026-05-28",
      "change": "Initial schema — workflows + runs. NO step log table (reuse bizcity_twin_event_stream per R-EVT-2). NO duplicate logger (R-EVT-1)." }
  ]
}
```

**Probe đi kèm:** `core/diagnostics/includes/probes/class-probe-automation.php` — check (1) tables exist (2) REST endpoint live (3) listener-api transients writable (4) executor có thể chạy sample workflow `samples/agent-mention-task.json` end-to-end.

---

## 9. REST API contract (R-CH-NS bắt buộc `bizcity-channel/v1`)

```
GET    /wp-json/bizcity-channel/v1/automation/blocks
       → list block registry (cho NodePalette)

GET    /wp-json/bizcity-channel/v1/automation/workflows
POST   /wp-json/bizcity-channel/v1/automation/workflows
GET    /wp-json/bizcity-channel/v1/automation/workflows/{id}
PUT    /wp-json/bizcity-channel/v1/automation/workflows/{id}
DELETE /wp-json/bizcity-channel/v1/automation/workflows/{id}

POST   /wp-json/bizcity-channel/v1/automation/workflows/{id}/run
       → mode=test|live, returns {run_id, trace_id}

POST   /wp-json/bizcity-channel/v1/automation/test/listen
POST   /wp-json/bizcity-channel/v1/automation/test/poll
POST   /wp-json/bizcity-channel/v1/automation/test/stop
       → port listener-api.php REST adapter

GET    /wp-json/bizcity-channel/v1/automation/runs?workflow_id=&status=
GET    /wp-json/bizcity-channel/v1/automation/runs/{id}
       → run history list, link to trace timeline

GET    /wp-json/bizcity-channel/v1/automation/runs/{id}/timeline?since=<event_id>
       → POLL fallback khi SSE không khả dụng (cron/inbound nền — no HTTP alive).
         Trả events từ bizcity_twin_event_stream WHERE trace_id=? AND id > since
         Recommend FE poll 1-2s/lần.

POST   /wp-json/bizcity-channel/v1/automation/runs/{id}/nodes/{node_id}/retry
       → re-execute 1 node với state hiện tại (port wp_ajax_waic_workflow_execute_node).
         Yêu cầu run.status IN ('failed','waiting','completed'). Tạo run mới hoặc patch in-place tuỳ ?mode=fork|inline.

GET    /wp-json/bizcity-channel/v1/automation/runs/{id}/nodes/{node_id}
       → node detail (input_resolved, output, vars_snapshot, retries) — cho NodeDetailDrawer

GET    /wp-json/bizcity-channel/v1/automation/stream?trace_id=
       → SSE proxy nếu cần (else dùng /bizcity-twin/v1/stream chung) — chỉ primary cho mode A (Agent/TwinChat).
```

---

## 10. Triết lý hook bridging — KHÔNG đẻ namespace mới

WAIC dùng `do_action('waic_twf_process_flow', $trigger_key, $payload)` làm xương sống trigger. **Giữ nguyên hook name** vì:

1. Channel Gateway hiện đã fire hook này (xác nhận tại `core/channel-gateway/includes/class-gateway-bridge.php`).
2. Mọi block trigger trong `modules/webchat/blocks/triggers/*` đã subscribe hook này.
3. Đổi tên = vỡ E2E. KHÔNG đáng.

**Tuy nhiên:** alias thêm `bizcity_automation_trigger_fired` (priority 5) cho code mới dùng — `waic_twf_process_flow` mark `@deprecated_alias` trong docblock nhưng KHÔNG xoá. Tuân thủ R-NS — namespace mới prefix `bizcity_` cho tất cả thứ tạo mới.

---

## 11. Tuân thủ rule (checklist trước commit)

- [x] **R-DCL** — `core/diagnostics/changelog/core.automation.json` tạo trước khi viết `dbDelta`. Validator exit 0.
- [x] **R-EVT-1/2** — KHÔNG tạo bảng log workflow steps mới. Dùng `bizcity_twin_event_stream` + 2 event_type mới qua RFC.
- [x] **R-CRON-META** — cron `bizcity_scheduler_reminder_fire` chạy workflow PHẢI `BizCity_Cron_Manager::note_event('workflow_step_ok|failed', {...})` với reason bucket.
- [x] **R-AGENTIC / R-MPRT** — Workflow runner **KHÔNG** là engine thứ hai. Mode A đi qua `BizCity_TwinBrain_Runtime::start_turn()` với opts forced chain. Mode B/C dispatch các block trực tiếp NHƯNG mỗi block đã/đang gọi vào cùng tool registry / cùng Event Bus.
- [x] **R-GW-8** — Client standalone. Không FE call `bizcity.vn/*`. Mọi LLM/tool đi qua `BizCity_LLM_Client` server-side.
- [x] **R-CH-NS** — REST namespace `bizcity-channel/v1/automation/*`.
- [x] **R-NS** — option `bizcity_automation_*`, table `wp_bizcity_automation_*`, class `BizCity_Automation_*`, hook `bizcity_automation_*`.
- [x] **R-NO-CONFLICT** với `plugins/bizcity-automation/` legacy: namespace tách hoàn toàn (xem bảng dưới). Cho phép coexist; sau khi `core/automation/` GA → đặt legacy plugin vào deprecate notice, archive sau.
- [x] **CRM-EVENTS** — Mọi run dispatch PHẢI tạo row trong `wp_bizcity_crm_events` qua `BizCity_Scheduler_Manager::create_event()`. Status cập nhật theo lifecycle. **Đây là "rule tối thượng" của founder — user PHẢI nhìn thấy task.**
- [x] **PowerShell BOM** — Mọi PHP file tạo qua `create_file` tool (UTF-8 no BOM).

| Conflict surface | Legacy (Tree A) | Core mới (Tree này) |
|---|---|---|
| Plugin slug | `bizcity-automation` | (none — là core module của `bizcity-twin-ai`) |
| DB prefix | `wp_waic_*` | `wp_bizcity_automation_*` |
| Option prefix | `waic_*` | `bizcity_automation_*` |
| REST namespace | `aiwu/v1` + `waic-workflow/v1` | `bizcity-channel/v1/automation` |
| Admin menu | `bizcity-workspace` | `bizcity-automation` |
| Hook fire | `waic_twf_process_flow` | **GIỮ NGUYÊN** (xương sống) + alias mới |
| Block class prefix | `WaicAction_*` / `WaicTrigger_*` | **GIỮ NGUYÊN** (block file ăn theo file name) |

---

## 12. Sprint roadmap (đề xuất thứ tự)

| Sprint | Output | Evidence |
|---|---|---|
| **S1** | `core.automation.json` v0.1.0 + probe scaffold + validator exit 0 | DDV row PASS |
| **S2** | Base classes port (`WaicBuilderBlock`→`BizCity_Automation_Block_Base` etc.) + `class-automation-block-registry.php` + REST `GET /blocks` | curl 200 + có ≥ 10 block discovered |
| **S3** | `class-automation-workflow-repo.php` + REST CRUD | curl CRUD PASS |
| **S4** | `class-automation-executor.php` (port BFS) + `class-automation-var-resolver.php` | sample workflow JSON chạy được sync |
| **S5** | `class-automation-listener.php` (port) + REST `/test/listen|poll|stop` | "Listen for test event" works |
| **S6** | `class-automation-trigger-matcher.php` hook `waic_twf_process_flow` + `class-automation-scheduler-bridge.php` (crm_events) | Zalo msg → row scheduler + run completed |
| **S7** | `class-automation-twinbrain-bridge.php` mode A (Agent mention) | TwinChat `@workflow_x` chạy đủ phase events |
| **S8** | `class-automation-event-emitter.php` 2 event_type mới (RFC trước) | event_stream rows mới |
| **S9** | Admin page + React shell (xyflow canvas + node palette + config panel) | UI load + save workflow JSON |
| **S10** | TestRunner + RunTimeline (live SSE) | E2E test inside UI |
| **S11** | 3 sample JSON + 1 doc walkthrough | Founder demo |
| **S12** *(optional)* | Port `ai-dashboard-api.php` — NLP → workflow draft | Chat→workflow gen |

---

## 13. Open questions / decisions parked

1. **Forced reasoning chain trong TwinBrain** — `start_turn(opts.forced_chain[])` cần extend. Đề xuất PHASE-X-FORCED-CHAIN doc riêng khi tới S7.
2. **Parallel branches** — xyflow support. Executor port WAIC hiện tại là BFS sequential. Khi cần parallel, wrap nhóm node thành sub-flow async (Phase 2).
3. **HIL resume từ Scheduler** — WAIC dùng transient `waic_exec_*`. Migrate sang `runs.status='waiting' + waiting_until`. Cron `bizcity_scheduler_reminder_fire` poll bảng `runs` thay vì transient.
4. **Trust tier ACL** — block tier ≥ 2 (distributor) cần consent UI ở canvas (banner "block này sẽ gửi tin ra ngoài"). Phase 2.
5. **Marketplace export** — workflow JSON portable giữa site → ý tưởng "workflow template marketplace" (Phase 3, sau khi pin xong agent mode E2E).

---

## 14. Tóm tắt 1 dòng cho mỗi câu hỏi của founder

> **Q1: Có thể dựa trên `bizcity-automation` để làm builder cho MPR Thinking Timeline?**
> **A:** CÓ. Port 15% (executor + listener + base block classes), bỏ 85% (workspace, options, install framework). Reuse `modules/webchat/blocks/*` đã có sẵn 11 TwinBrain-aware block (it_call_tool, it_call_content, it_call_research, it_call_memory, it_call_skill, it_call_reflection, it_todos_planner, it_summary_verifier, bc_adminchat_message, bc_instant_run, bc_scheduler_run) — KHÔNG copy, register qua filter path.

> **Q2: Vừa là công cụ gắn trigger nhận việc qua Zalo Bot?**
> **A:** CÓ. Hook `waic_twf_process_flow` đã được Channel Gateway (`class-gateway-bridge.php`) fire khi Zalo OA webhook về. Block `wu_zalobot_message_received` đã subscribe. Chỉ cần `class-automation-trigger-matcher.php` match workflow active + `scheduler_bridge` tạo `crm_events` row + `runner` chạy.

> **Q3: `@xyflow/react` đúng chưa?**
> **A:** ĐÚNG. MIT, schema ăn 1-1 với WAIC `{nodes,edges}`, sourceHandle native, ~50KB. Activepieces sai layer (full-stack TS clone), `_library/` cả 2 chỉ làm reference, KHÔNG load.

> **Q4: Channel-gateway đã unify, adapter automation cần rà lại?**
> **A:** ĐÚNG đã rà. Bridge `class-gateway-bridge.php` đã fire `waic_twf_process_flow` với compat trigger key (`bizcity_zalo_message_received` etc.). KHÔNG cần code lại adapter — chỉ verify mỗi channel adapter có fire hook. AdmInChat hiện chưa fire (legacy `biz_send_adminchat_message`) → cần patch khi tới S6.

---

---

## 15. Feasibility matrix (v0.2 — sau phản biện)

| Trục | Khả thi | Rủi ro chính | Đã vá ở v0.2 |
|---|---|---|---|
| Realtime live check | 🟡 → 🟢 sau vá | SSE không alive khi cron/Zalo chạy nền | ✅ thêm `/runs/{id}/timeline?since=` polling endpoint (§9) |
| Branch / loop / wait | 🟢 95% | port nguyên xi WAIC | — |
| **Parallel thật (edge-level)** | 🟡 60% | xyflow vẽ song song được, executor BFS chạy tuần tự | ✅ chốt: parallel = composite opaque node (§16). KHÔNG promise edge-level. Composite gọi `Perspective_Runner` có sẵn `curl_multi_exec`. |
| LLM / function action | 🟢 90% | Reuse `it_*` blocks | Token-streaming Phase 2 (acceptable) |
| Debug per-step | 🟡 → 🟢 sau vá | event_stream payload chưa đủ chi tiết | ✅ extend payload schema (§17) + `/nodes/{node_id}/retry` + `NodeDetailDrawer` |
| Studio Canvas trong workflow | 🟡 70% | Block `studio_enabled=true` mở Canvas chỉ trong TwinChat (HTTP alive). Mode B/C ghi artifact_id, user xem qua link trong scheduler row. | acceptable v1 |
| Inline code block (như Activepieces) | ❌ | WAIC chỉ chấp file PHP file-system | Phase 3 nếu cần |

**Khả thi toàn cục v0.2: 85%.** Sẵn sàng vào S1.

---

## 16. Realtime channel matrix (vá gap #1)

| Mode | HTTP socket alive | SSE primary? | Polling primary? | TestRunner listener |
|---|---|---|---|---|
| A. TwinChat agent mention | ✅ alive trong turn | ✅ `/bizcity-twin/v1/stream` | fallback | — |
| B. Inbound Zalo / FB webhook | ❌ webhook trả 200 ngay, work nền | ❌ | ✅ `/runs/{id}/timeline?since=` | — |
| C. Cron sy_schedule | ❌ cron tick rồi xong | ❌ | ✅ FE nếu user mở run detail | — |
| D. Test run trong builder UI | ✅ user mở canvas | ✅ ưu tiên | fallback nếu SSE timeout | ✅ `/test/listen` + `/test/poll` (port WAIC) |

**Quy tắc FE:** mở SSE; nếu sau 2s không có event đầu tiên hoặc connection lost → switch sang polling endpoint. Component `useRunTimeline(runId, traceId)` tự handle.

---

## 17. Extended `workflow_node_*` event payload (vá gap #4 — debug-grade)

**RFC mở rộng `BizCity_Event_Taxonomy`** (R-EVT-2 tuân thủ):

```jsonc
// event_type: workflow_node_started
{
  "workflow_id": 12, "run_id": 345,
  "node_id": "n3", "block_code": "it_call_tool", "block_type": "action",
  "input_resolved": { "tool_id": "search_kg", "input_json": {"query":"...","k":5} },
  "input_raw":      { "tool_id": "search_kg", "input_json": "{\"query\":\"{{node#n1.text}}\",\"k\":5}" },
  "vars_snapshot_size": 8,
  "attempt": 1
}

// event_type: workflow_node_done
{
  "workflow_id": 12, "run_id": 345,
  "node_id": "n3", "block_code": "it_call_tool",
  "ok": true,
  "output": { /* result của getResults() — cap 8KB; nếu lớn hơn, lưu output_ref */ },
  "output_ref": null,         // hoặc "automation_run_outputs/345/n3.json" (file ref nếu > 8KB)
  "output_truncated": false,
  "duration_ms": 1234,
  "sourceHandle": "out",      // branch lấy edge nào
  "attempt": 1,
  "error": null,
  "error_bucket": null        // theo R-CRON-META reason buckets nếu failed
}

// event_type: workflow_node_failed (chỉ phát thay cho _done khi ok=false)
// Có thêm: stack_trace_short, error_code, fb_code (nếu distributor)

// event_type: workflow_branch_taken (logic block)
{
  "workflow_id": 12, "run_id": 345,
  "node_id": "n4", "block_code": "un_if",
  "expression": "{{node#n3.confidence}} >= 0.7",
  "resolved_value": 0.82,
  "branch_taken": "output-right"
}
```

**Cap rule:** `output` JSON > 8KB → spill ra `wp-content/uploads/bizcity/automation_run_outputs/<run_id>/<node_id>.json`, set `output_ref` thay cho `output`. Tránh blow `bizcity_twin_event_stream` (R-VFS thinking).

---

## 18. Parallel execution — chốt design (vá gap #2)

**Quy tắc:** Canvas xyflow có thể vẽ 1 node → N nhánh. **Runtime sẽ KHÔNG chạy N nhánh đồng thời** ở v1. Lý do:
- PHP-FPM request → blocking IO; `curl_multi_exec` chỉ work cho HTTP outbound (LLM/tool gọi ra ngoài), không cho callback PHP nội bộ.
- Background parallel = `wp_remote_post(non_block=true)` self-call → mất context, debug khó.

**Pattern thay thế: Composite "opaque parallel" node.**

```
Một node duy nhất trên canvas:  [ 🧠 MPR Fan-out K=5 ]
   ↓
   internally: BizCity_TwinBrain_Perspective_Runner::run_parallel($k=5)
   (đã có curl_multi cho sub-agent calls)
   ↓
   output: { perspectives: [ {nb_id,stance,confidence,evidence}, ... ] }
```

User muốn xem từng perspective → drill-down trong NodeDetailDrawer (mỗi perspective = 1 row sub-event).

**Pattern "giả parallel" cho UX:** edge song song xyflow vẫn vẽ được, executor xử lý tuần tự nhưng UI badge chạy chéo (round-robin animation). Truyền thông trong tooltip canvas: *"Song song hiển thị = chạy tuần tự (BFS). Cần true parallel → dùng MPR-Fanout composite."*

**Phase 2 candidate:** nếu user push mạnh — eval `wp_async_task` library hoặc Action Scheduler async runner. Không hứa v1.

---

## 19. Studio Canvas trong mode B/C (vá gap #3 phụ)

Block có `studio_enabled=true` (vd `it_call_content` mở DocStudio) chạy trong TwinChat: Canvas panel mở ngay. Chạy từ Zalo/cron: không có FE → block ghi `artifact_id` vào output. Scheduler row hiển thị link:

```
[ Workflow "FB daily post" ─ ✅ completed ─ 2 phút trước ]
      ↳ 📄 Bài viết: "5 mẹo bán hàng Tết" → [Mở DocStudio]
      ↳ 🖼️ Ảnh bìa: tet-2026-001.png    → [Xem ImageStudio]
```

Click link → mở admin page tương ứng với artifact_id. Không cần thay đổi Canvas Panel logic.

---

**End of canon v0.3 · Sẵn sàng vào S0 (POC UI canvas trong SPA).**

---

## 20. UI Integration Plan — mount vào Channel Gateway SPA (vá v0.3)

### 20.1 Reality check
Channel Gateway SPA đã production:
- Menu: `wp-admin/admin.php?page=bizchat-gateway-spa`
- Bundle: `core/channel-gateway/assets/dist/channel-gateway-app.js` (built từ `core/channel-gateway/frontend/src/`)
- Stack: **React + Redux Toolkit + Tailwind CSS + Radix UI + lucide-react**
- 10+ route: Overview / Health / Channels / Campaigns / Flows / Tasks / Settings / Playground / Logs / Platform (FB/Zalo/WebChat)
- Boot data inject: `window.BIZCITY_CG_BOOT` (xem [class-admin-menu-spa.php](../../channel-gateway/includes/class-admin-menu-spa.php))

→ **Tạo React app riêng = vi phạm R-NO-CONFLICT với SPA hiện có, xé nhỏ bundle, split state.**

### 20.2 Strategy: mount như sub-app trong SPA

Thêm folder `core/channel-gateway/frontend/src/routes/automation/`:

```
frontend/src/routes/automation/
├─ AutomationListRoute.jsx           # /automation — list workflows table
├─ AutomationBuilderRoute.jsx        # /automation/:id/edit — xyflow canvas full screen
├─ AutomationRunsRoute.jsx           # /automation/:id/runs — history + drill
├─ AutomationRunDetailRoute.jsx      # /automation/runs/:runId — timeline + node drawer
│
├─ canvas/
│  ├─ FlowCanvas.jsx                 # <ReactFlow> root, controlled mode
│  ├─ nodes/TriggerNode.jsx          # custom node with handle 'out'
│  ├─ nodes/ActionNode.jsx           # status badge (pending/running/done/failed)
│  ├─ nodes/LogicNode.jsx            # 2 handles output-right/output-left
│  └─ edges/AnimatedEdge.jsx         # animated khi node đang running
│
├─ palette/
│  ├─ NodePalette.jsx                # left rail — dừng list block_code group by category
│  └─ BlockSearch.jsx                # filter / search
│
├─ config/
│  ├─ NodeConfigPanel.jsx            # right drawer — render form theo getSettings()
│  ├─ FieldInput.jsx                 # type=input/textarea/select + variables true
│  └─ VariableHint.jsx               # autocomplete {{node#x.y}} từ upstream nodes
│
├─ test/
│  ├─ TestRunnerBar.jsx              # button "Listen for test event" + "Run all"
│  └─ ListenerStatusChip.jsx         # 5-min countdown
│
├─ timeline/
│  ├─ RunTimeline.jsx                # use SSE primary + poll fallback
│  ├─ useRunTimeline.js              # custom hook: SSE → poll fallback after 2s
│  └─ NodeDetailDrawer.jsx           # click node → input/output/error/retry button
│
└─ index.js                          # export routes to navConfig
```

Người installer (`class-automation-admin-bridge.php`):
1. Add route entry vào `nav_config` (filter PHP → inject `window.BIZCITY_CG_BOOT.routes`).
2. Inject `window.BIZCITY_CG_BOOT.automation = { restUrl, listenerTtlSec, blockCategoriesOrder }` extra.
3. `core/automation/bootstrap.php` gọi `BizCity_Channel_Menu_Registry::add_section('automation', ...)` nếu API có.

**Tách redux slice mới:**
```
frontend/src/redux/api/automationApi.js     # RTK Query — endpoints khai báo §9 REST
frontend/src/redux/slices/workflowSlice.js  # local state: selected node, dirty flag, listener id
```
Reuse `store.js` gốc, chỉ add reducer miền. Không split store.

**xyflow install:**
```bash
cd core/channel-gateway/frontend
npm i @xyflow/react
```
Them vào `package.json` cũa SPA (không install riêng). Vite build chung ra baǹ gớc.

### 20.3 NavConfig thêm
```js
// frontend/src/shell/navConfig.js
{ id: 'automation', label: 'Automation',
  icon: 'workflow', path: '/automation',
  badge: workflows_count_active }
```
Verdict: 1 menu item mới trong sidenav SPA. KHÔNG cần admin menu WP top-level.

---

## 21. Zalo Bot binding — dùng hạ tầng sẵn có (vá v0.3)

### 21.1 Đã có gì
- [class-gateway-bridge.php](../../channel-gateway/includes/class-gateway-bridge.php) đã fire `do_action('waic_twf_process_flow', $compat_trigger, $raw)` tại [line ~268](../../channel-gateway/includes/class-gateway-bridge.php) cho mọi inbound webhook đã register adapter (Zalo Bot included).
- [class-channel-binding.php](../../channel-gateway/includes/class-channel-binding.php) có bảng `wp_bizcity_channel_bindings` map `(platform='ZALO_BOT', account_id='oa_xxx') → character_id` + `mode` (auto/manual/hybrid/roundrobin).
- [zalo.php integration](../../channel-gateway/integrations/zalo.php) quản lý credential (App ID/Secret/OAuth) qua `BizCity_Integration_Registry`.
- [class-admin-menu-spa.php platform catalog](../../channel-gateway/includes/class-admin-menu-spa.php) đã expose `zalo_bot` và `zalo_hotline` vào wizard.

### 21.2 Với workflow builder, cần thêm gì
**KHÔNG** code zalo binding riêng. **Reuse 100%** cơ chế trên. Workflow `trigger.type='zalo_msg'` + `trigger_config.oa_id='xxx'`:

```
Zalo OA webhook → /zalohook/ (handler in plugins/bizcity-zalo-bot)
   → Gateway Bridge::handle_inbound() → fires waic_twf_process_flow
   → BizCity_Automation_Trigger_Matcher::on_flow_fired($trigger_key, $raw)
       SELECT workflows WHERE status='active'
         AND trigger_type='zalo_msg'
         AND (trigger_config.oa_id IS NULL OR trigger_config.oa_id = ?)
         AND match_conditions($trigger_config.match, $payload)  // text_contains/regex
   → for each match:
       BizCity_Automation_Scheduler_Bridge::queue_run($workflow_id, $payload)
         → Scheduler_Manager::create_event(event_type='workflow_scheduled',
             metadata={workflow_id, payload, run_id_pending}, start_at=now)
         → user nhìn thấy trong /scheduler tab ngay ✅ (R-CRM-EVENTS)
       Runner::run_sync($workflow_id, $payload) HOẮC return + cron poll
```

**Quan trọng:** 
- KHÔNG cần sửa code Zalo Bot plugin.
- KHÔNG cần sửa Gateway Bridge.
- Chỉ add `class-automation-trigger-matcher.php` subscribe hook `waic_twf_process_flow` priority 5 (trước legacy WAIC priority 10) — vậy cả legacy `bizcity-automation` lan workflow mới đều nhận được event.
- Khi user mở builder → trigger node `wu_zalobot_message_received` → settings panel render dropdown OA từ `BizCity_Channel_Binding::all()` filtered by platform=ZALO_BOT.

### 21.3 Bind workflow vào OA cụ thể — 2 cu̧e

**Cách A (workflow-side):** trigger_config.oa_id='12345' — 1 workflow phục vụ 1 OA cụ thể.

**Cách B (binding-side):** thêm cột `default_workflow_id` vào `wp_bizcity_channel_bindings` — mỗi OA có 1 workflow mặc định. (Phase 2 — cần bump schema binding 1.1.0 → 1.2.0).

v1 chỉ dùng Cách A (đơn giản, không đụng bảng binding).

---

## 22. Campaign ⋋ Workflow — phân vai rõ (vá v0.3)

SPA hiện có page **Campaigns** (`/campaigns`) đã chiếm "workflow surface" theo nav config. Cần chốt **không xóa, không trùng**:

| Aspect | **Campaign** (đã có) | **Workflow Automation** (mới) |
|---|---|---|
| UI | Table + form sheet | xyflow canvas drag-drop |
| Shape | Flat 1-1 (1 scủ cảnh, 1 action chính, +reminder, +loyalty) | Graph (N nodes, branch if/else, loop) |
| Action | `send_message` / `run_shortcode` / `kg_grounded_reply` / `delay_only` | Full block registry (60+ block: AI, channel, KG, scheduler, logic…) |
| Trigger | `crm_campaign_visit_recorded` (link click / keyword) | `wu_*` / `bc_*` / `nb_*` / `sy_schedule` — 11+ trigger type |
| Storage | `wp_bizcity_crm_campaigns` | `wp_bizcity_automation_workflows` |
| Auto-import từ | `bizgpt_custom_flows` (legacy) | n/a |
| Audience | Marketing/CX team — set & quit | Builder/agent op — customize logic |

**Quy tắc co-exist:**
1. Campaign có thể *trigger* một workflow: thêm action type `run_workflow` (Phase 2) — từng campaign config một workflow_id.
2. Workflow KHÔNG gọi campaign back (tránh loop).
3. SideNav SPA: 2 menu item rạch ròi — `Campaigns` (template marketing) + `Automation` (workflow builder).
4. Trang Campaigns giữ nguyên, KHÔNG đụng vào code.

---

## 23. UI-first sprint reorder (vá v0.3 — priority yêu cầu founder)

Founder say: *"đi từ UI trước, các luồng edit flow, tạo flow… giao diện kéo thả, live, listener, edit block, logic…"*

Reorder sprint roadmap §12 → **UI-first 4 sprint POC + BE follow**:

| Sprint | Output | Evidence |
|---|---|---|
| **S0 (POC)** | Cài `@xyflow/react` vào SPA + trêng `/automation/builder` với 3 hard-coded node và 2 edge. KHÔNG save, KHÔNG run. | Mở URL thấy canvas, kéo thả nodes được |
| **S1 (UI list)** | `/automation` list page + RTK Query `automationApi.useListWorkflows()` mock data từ static JSON | Table 5 row hiển thị |
| **S2 (UI build)** | NodePalette (left) + FlowCanvas (center) + NodeConfigPanel (right). Block list **mock** — hard-code 8 block (1 trigger, 5 action, 2 logic). Save vào localStorage. | Kéo block → canvas → edit param → save → reload vẫn còn |
| **S3 (BE schema)** | `core.automation.json` v0.1.0 (R-DCL) + probe + REST CRUD workflows (§9). Wire RTK Query thật. | Save canvas → row vào DB |
| **S4 (BE blocks)** | `class-automation-block-registry.php` + REST `/blocks` discover từ `modules/webchat/blocks/*` và `bizcity-automation/.../blocks/*` qua filter | NodePalette load >= 30 block thật |
| **S5 (Run sync)** | `class-automation-executor.php` + `class-automation-var-resolver.php` + REST `POST /workflows/{id}/run?mode=test` | Click "Run all" → chạy sync → badge done |
| **S6 (Listener)** | Port `listener-api.php` + REST `/test/listen|poll|stop` + `TestRunnerBar` UI | Click "Listen" → gửi Zalo test → trigger node capture payload |
| **S7 (Live timeline)** | `class-automation-event-emitter.php` (2 event_type mới via RFC) + `RunTimeline` + `useRunTimeline` (SSE → poll fallback) | Run live, FE thấy badge đổi realtime |
| **S8 (Trigger matcher)** | `class-automation-trigger-matcher.php` hook `waic_twf_process_flow` + `class-automation-scheduler-bridge.php` (crm_events row) | Zalo OA inbound → row scheduler + run completed |
| **S9 (TwinBrain agent mode)** | `class-automation-twinbrain-bridge.php` mode A — `@workflow_name` trong TwinChat | Mention → phase event stream → timeline render |
| **S10 (Debug/retry)** | `NodeDetailDrawer` + REST `/runs/{id}/nodes/{node_id}/retry` + 3 sample JSON | E2E test từ canvas → retry node fail |

**Lý do reorder:** UI loặn cứng hơn; nếu fail UX, BE làm thừa. POC S0-S2 dùng mock data, kiểm được canvas xyflow thực sự fit pattern node/edge của WAIC và fit theme Tailwind/Radix của SPA, sau đó mới wire BE thật. **S0 có thể ship trong 1 ngày** — rủi ro 0%.

---

## 24. Wave 0 — Guru-Channel Binding UI (SHIPPED 2026-06-03)

> **Wave 0 là prerequisite cho mọi Wave A-D.** Trigger Zalo/FB/Telegram có `guru_id` mà không biết Guru nào bind kênh nào = workflow mù. Wave 0 fix điều đó.

### 24.1 Deliverables đã ship

| ID | Deliverable | File(s) | Status |
|---|---|---|---|
| **W0.1** | R-GCB-7 validation: reject bind Guru `status ∉ {active,published}` | `core/channel-gateway/includes/class-webhook-inspector.php` `rest_binding_upsert()` | ✅ SHIPPED |
| **W0.1b** | DCL trả nợ: `bizcity_channel_bindings` formalized in `core.channel-gateway.json` v1.2.0 (mode enum, all indexes) | `core/diagnostics/changelog/core.channel-gateway.json` | ✅ SHIPPED |
| **W0.2** | Tab "Channels" trong character-edit — list bindings, bind dialog, disable, badge mode | `core/knowledge/views/character-edit.php` | ✅ SHIPPED |
| **W0.3** | `GuruChannelPicker.jsx` + Inspector.jsx branch + 4 trigger blocks `guru_picker` type + api.js gurus/guruChannels helpers + FE build | `core/automation/frontend/src/components/GuruChannelPicker.jsx` (new), `Inspector.jsx`, `api.js`, `blocks/registry.js` | ✅ SHIPPED · build PASS |
| **W0.4** | Listener audit: `BizCity_Universal_Channel_Listener` đã resolve `character_id` (Phase 0.33 M3) — W0.4 = probe only | (no code change needed) | ✅ CONFIRMED |
| **W0.5** | DDV probe 3-layer: disk+BOM → 3 class load + DB table → 3 REST routes + live dispatch + resolve + orphan scan | `core/diagnostics/includes/probes/class-probe-channel-binding.php` (new) + `core/diagnostics/bootstrap.php` | ✅ SHIPPED |

### 24.2 R-DA findings (reuse, không tạo mới)

R-DA pass 2 xác nhận mọi infra đã có từ Phase 0.33:
- `BizCity_Channel_Binding` (SoT, API resolve/upsert/disable/all) — **reuse 100%**
- `BizCity_Webhook_Inspector` (`/inspector/bindings`, `/inspector/gurus`, `/inspector/channels`) — **reuse 100%**
- `BizCity_Universal_Channel_Listener` (resolve + inject `character_id`) — **W0.4 = probe chứng minh, không sửa**
- Mode enum thực tế: `auto/manual/hybrid/roundrobin` (doc v1.3 sai `guru/user/manual` → fixed v1.4)

### 24.3 3 Guardrails (G1/G2/G3) — KHÔNG chặn Wave 0

| ID | Rule | Activate when | Implement at |
|---|---|---|---|
| **G1** | `archetype: skill\|workflow` BẮT BUỘC trong frontmatter | Wave A WF-AUTO W2 parser | `BizCity_Skill_Recipe_Parser::extract_workflow_steps()` |
| **G2** | REST validation 409 `conflict_slash_collision` cross-tier | Wave C GURU W3 upsert | Trước khi save slash_commands (skill tier) HOẶC trigger_config.slash_command (workflow tier) |
| **G3** | ≥70% action blocks ported to tool registry → kickoff `PHASE-X-RUNNER-UNIFY.md` | Quarterly audit | `BizCity_Automation_Block_Registry` vs Twin Runner tool registry |

### 24.4 Next: Wave A (WF-AUTO W1) — sau Wave 0

Wave A bắt đầu khi Wave 0 probe có row `PASS` trong diagnostic page.
Đầu tiên: **WF-AUTO W1** — xem §11 Wave A trong [PHASE-WORKFLOW-AS-SKILL.md](PHASE-WORKFLOW-AS-SKILL.md).

---

## 25. Wave A — Workflow-MD compiler (SHIPPED 2026-06-03)

> **Goal Wave A:** chuyển workflow từ "xyflow JSON only" sang "`.workflow.md` portable + xyflow JSON" với round-trip lossless. Cho phép seed templates (Wave D) viết bằng Markdown thay vì hard-code JSON trong `class-automation-templates-seeder.php`.

### 25.1 Deliverables

| ID | Deliverable | File(s) | Status |
|---|---|---|---|
| **WF-AUTO W1** | DCL audit + contract bump 1.7.1 (vocab lock + G1 reminder) | `core/diagnostics/changelog/core.automation.json` | ✅ |
| **WF-AUTO W2** | Parser extend: `require_archetype()` (G1) + `extract_workflow_steps()` + YAML-subset reader | `core/skills/includes/class-skill-recipe-parser.php` | ✅ |
| **WF-AUTO W3** | `BizCity_Workflow_MD_Compiler` (md→wf / wf→md / validate) + round-trip test (15 case PASS) | `core/automation/includes/class-workflow-md-compiler.php` (new), `core/automation/tests/test-workflow-md-compiler.php` (new), `core/automation/bootstrap.php` (require) | ✅ |

### 25.2 Canonical `.workflow.md` grammar

```
---
archetype: workflow         # G1 — REQUIRED, reject khi sai/thiếu
name: <human title>
slug: tpl_xxx_v1
description: <prose>
trigger_type: zalo_inbound  # manual|zalo_inbound|fb_message|fb_comment|telegram_inbound|cron|webhook|twinbrain_intent
icon: MessageCircle         # lucide-react name
tags: a,b,c
enabled: false
---

# <Name>

<Description prose>

## Steps

### 1. `trigger.zalo_inbound` — Zalo · tin nhắn

```yaml
instance_id: ""
filter: ""
```

### 2. `llm.compose_reply` — Soạn

```yaml
model: gpt-4o-mini
prompt: |
  Câu hỏi: {{trigger.text}}
  Trả lời ngắn gọn.
```

## Edges                 # OPTIONAL — chỉ emit khi non-linear

- n1 -> n2
- n2 -> n3 [via: yes]
- n2 -> n4 [via: no]

## Layout                # OPTIONAL parse / ALWAYS emit (round-trip lossless)

- n1: x=0 y=80
- n2: x=320 y=80
```

### 25.3 Round-trip contract

- `md_to_workflow(md)` → `array { slug, name, description, trigger_type, tags, icon, enabled, trigger_config, graph{nodes,edges,meta} }` — chấp nhận trực tiếp vào `BizCity_Automation_Repo_Workflows::create()` / `update()`.
- `workflow_to_md(wf)` → re-emit canonical MD; linear chains drop `## Edges` block; branches with `sourceHandle` emit `[via: handle]` annotation.
- `validate_md(md)` → `true | WP_Error` (codes: `archetype_missing` · `archetype_mismatch` · `no_steps` · `slug_missing` · `name_missing` · `edge_orphan` · `parser_missing`).
- Edge IDs deterministic: `e_<src>_<tgt>[_<handle>]` (khớp seeder pattern).
- Node `type` inferred từ `block_id` prefix: `trigger.*` → trigger · `llm.*` → llm · `logic.*` → logic · else → action.
- Node `data` preserve: `{ blockId, label, ...config }` (label/blockId moved out of YAML config block when serialising).

### 25.4 Guardrail G1 enforcement matrix

| Frontmatter input | `require_archetype('workflow')` | `md_to_workflow()` |
|---|---|---|
| `archetype: workflow` | `true` | OK |
| `archetype: skill` | `WP_Error('archetype_mismatch')` | propagate error |
| (missing) | `WP_Error('archetype_missing')` | propagate error |

File extension `.workflow.md` chỉ là **naming convention**, KHÔNG phải single source of truth. Parser phải nhìn `archetype` field.

### 25.5 Next: Wave B (BRIDGE W1) → SHIPPED 2026-06-03 (xem §26).

---

## 26. Wave B — Bridge blocks (SHIPPED 2026-06-03)

Cross-tier connectors cho phép workflow ↔ skill chain qua hooks WordPress chuẩn, KHÔNG runner mới (per Hướng Z+).

### 26.1 Deliverables

| Layer | File | API / Hook |
|---|---|---|
| Action block | `core/automation/includes/blocks/actions/class-action-invoke-skill.php` | `id=action.invoke_skill`, fields: `skill_slug`, `prompt_template`, `vars_json`, `character_id`, `timeout_seconds` |
| Trigger block | `core/automation/includes/blocks/triggers/class-trigger-skill-intent.php` | `id=trigger.skill_intent`, fields: `skill_slug`, `archetype` |
| Bridge subscriber | `core/automation/includes/class-automation-skill-bridge.php` | Listen `bizcity_skill_trigger_pipeline` + `bizcity_skill_invoked` → enqueue workflows `trigger_type=skill_intent` |
| Vocab extension | `class-automation-repo-workflows.php::TRIGGER_TYPES` | `+ 'skill_intent'` |
| Tests | `tests/test-action-invoke-skill.php` + `tests/test-trigger-skill-intent.php` | admin gates `?bizc_test_invoke_skill=1` / `?bizc_test_skill_intent=1` |

### 26.2 Fail-OPEN matrix (action.invoke_skill)

| Condition | Return | Runner behavior |
|---|---|---|
| `skill_slug` empty / template empty | `{ok:false, _degraded:true, reason:'invalid_param'}` | continue with `skill_output=''` |
| `BizCity_Skill_Database` missing | `{ok:false, _degraded:true, reason:'skill_db_missing'}` | continue |
| Slug not found in DB | `{ok:false, _degraded:true, reason:'skill_not_found'}` | continue |
| `BizCity_TwinBrain_Runtime` missing | `{ok:false, _degraded:true, reason:'runtime_missing'}` | continue |
| `start_turn()` throws | `{ok:false, _degraded:true, reason:'runtime_error', error}` | continue |
| Success | `{ok:true, skill_slug, skill_id, trace_id, skill_output, duration_ms}` | downstream uses `skill_output` |

### 26.3 Hook flow (full chain)

```text
User /sales_post (skill A) ──▶ Intent matcher (archetype A inject)
                                 │
                                 │  archetype C only
                                 ▼
                        bizcity_skill_trigger_pipeline
                                 │
                                 ▼
                  Skill_Bridge::on_skill_pipeline
                                 │
                                 ▼
                  Repo_Workflows::query(trigger_type=skill_intent)
                                 │ filter skill_slug + archetype
                                 ▼
                  Repo_Runs::enqueue(wf_id, payload)
                                 │
                                 ▼
                  Runner async dispatch ─▶ workflow steps (LLM compose, publish, …)


Workflow node action.invoke_skill ──▶ start_turn (same-process)
                                       │
                                       ▼
                              do_action('bizcity_skill_invoked', $slug, $payload)
                                       │
                                       ▼
                            Skill_Bridge::on_skill_invoked
                                       │
                                       ▼
                            (downstream skill_intent workflows fire)
```

### 26.4 Filter rules (skill_intent trigger)

- `cfg.skill_slug = ""` → match any slug.
- `cfg.skill_slug = "X"` → exact match `slug == X`.
- `cfg.archetype = "any"` → match any archetype.
- `cfg.archetype ∈ {A,B,C}` → match `strtoupper(payload.archetype) === cfg.archetype`.

### 26.5 R-EVT-2 / R-DCL compliance

- KHÔNG tạo bảng log mới (R-EVT-2). Mọi enqueue chỉ ghi vào `bizcity_automation_runs` qua `Repo_Runs::enqueue()`.
- KHÔNG bump DCL version (W1+W2 không đụng schema). Vẫn `core.automation.json` 1.7.1 (bumped Wave A W1).
- Listener Bus inject (`BizCity_Automation_Listener::inject('skill_intent', …)`) để FE "Chạy thử" panel có thể capture skill events realtime.

### 26.6 Next: Wave C → SHIPPED 2026-06-03 (xem §27)

---

## 27. Wave C — Dual-tier slash matcher (SHIPPED 2026-06-03)

Giao thức **`/cmd`** thnh ranh giới giữa skill tier v workflow tier khng
biểu tượng — user g đng 1 slash, hệ thống tự chọn engine ph hợp.

### 27.1 Deliverables

| File | Vai tr |
|------|---------|
| `core/skills/includes/class-skill-slash-matcher.php` (NEW) | Singleton `BizCity_Skill_Slash_Matcher` — `extract_command()` / `lookup()` / `try_dispatch()` / `detect_collision()` |
| `core/skills/bootstrap.php` | Require sau `class-skill-context.php` |
| `core/automation/includes/class-automation-trigger-matcher.php` | Slash dispatch step trong `on_channel_message()` — preempt keyword/fallback |
| `core/automation/includes/class-automation-repo-workflows.php` | `TRIGGER_TYPES += 'slash_command'` |
| `core/skills/includes/class-skill-rest-api.php` | `update_skill_db()` G2 collision check 409 |
| `core/automation/includes/class-automation-rest.php` | `create_workflow|update_workflow` G2 collision helper 409 |
| `core/automation/tests/test-slash-matcher.php` (NEW) | Admin-gate test — 12 case |

### 27.2 Resolution flow

```
Text "/cmd args" → extract_command → lookup(cmd)
   ├─ Tier 1: bizcity_skills.slash_commands FIND_IN_SET
   │    HIT → fire bizcity_skill_trigger_pipeline + skill_invoked mirror
   │         (archetype A/B inject prompt by Skill_Context;
   │          C/D fire pipeline action by Pipeline_Bridge)
   └─ Tier 2: workflows trigger_type='slash_command' + cfg.slash_command='/cmd'
        HIT → enqueue run + bizcity_automation_run_enqueued (defer)
NO HIT → fall through to keyword/fallback (existing matcher logic).
```

### 27.3 G2 collision matrix

| Action | Tier checked | Block on conflict |
|--------|--------------|-------------------|
| PUT `/wp-json/bizcity/skill/v1/skill/{id}` | Workflow tier (`find_workflow_for_slash`) | 409 `slash_collision` |
| POST `/wp-json/bizcity-channel/v1/workflows` (trigger_type=slash_command) | Skill tier (`find_skill_for_slash`) | 409 `slash_collision` |
| PUT `/wp-json/bizcity-channel/v1/workflows/{id}` (trigger_type=slash_command) | Skill tier (excl self_id) | 409 `slash_collision` |

Response shape:
```json
{ "ok": false, "error": "slash_collision",
  "message": "Slash /foo đ được skill #12 \"Write Article\" sở hữu…",
  "conflict": { "cmd": "/foo", "conflicts_with": "skill",
                 "conflict_id": 12, "conflict_label": "Write Article" } }
```

### 27.4 R-CH-NS / R-CRON-META / R-DCL

- **R-CH-NS:** workflow REST stays on `bizcity-channel/v1`; skill REST stays on `bizcity/skill/v1` — G2 cross-tier check is a CALL into helper, no namespace mixing.
- **R-CRON-META:** matcher trace `matched_slash` row injected through existing `BizCity_Automation_Matcher_Trace::note()` (no new log table).
- **R-DCL:** zero schema change — reuse `bizcity_skills.slash_commands` CSV (1.4.1) + `bizcity_automation_workflows.trigger_config_json` (1.7.1). No DCL bump.

### 27.5 Next: Wave D (WF-AUTO W4-W6)

Seed templates port (legacy `.workflow` library → `.workflow.md`) + matcher hardening + Canvas import/export FE feature.

---

## §28 — Wave D Deliverables (WF-AUTO W4/W5/W6) · 2026-06-03

### W4 — Seed Templates (SEED_VERSION 1.8.0)

| Slug | Trigger | Nodes | Category |
|---|---|---|---|
| `tpl_slash_kg_query_v1` | `slash_command` `/kg` | trigger.slash_command → action.search_kg → llm.compose_reply → action.reply_zalo | `cskh` |
| `tpl_skill_intent_invoke_v1` | `skill_intent` (any) | trigger.skill_intent → action.invoke_skill → action.log | `mpr` |

Reseed sau deploy: `POST /bizcity-automation/v1/templates/reseed` (admin only).

### W5 — Matcher Hardening

| Guard | File | Detail |
|---|---|---|
| `/cmd` slug length > 64 → `null` | `class-skill-slash-matcher.php::extract_command()` | Prevent DoS via oversized slug |
| Request-scoped dedup `static $dispatched[]` | `class-skill-slash-matcher.php::try_dispatch()` | Skip repeat `/cmd` in same PHP request → `dedup_skip:already_dispatched_this_request` |

### W6 — Canvas Import/Export REST

| Route | Handler | Notes |
|---|---|---|
| `GET /bizcity-automation/v1/workflows/:id/export-md` | `export_workflow_md()` | Returns `{ok, md, filename:*.workflow.md}`. Fail-OPEN `_degraded` if compiler missing. |
| `POST /bizcity-automation/v1/workflows/import-md` | `import_workflow_md()` | Body `{md:string}`. Creates workflow with `enabled=0`. Slash collision 409 guard. Fail-OPEN. |

### DDV Probe — `automation.slash_matcher`

**File:** `core/diagnostics/includes/probes/class-probe-slash-matcher.php`  
**8 Steps** (all read-only):
1. Disk — `class-skill-slash-matcher.php` readable.
2. Loader — `BizCity_Skill_Slash_Matcher` class_exists.
3. `extract_command` unit × 5 cases (blank / no-slash / bare-slash / `/kg some args` / 65-char slug W5 guard).
4. `detect_collision([], skill, 0)` → null.
5. `try_dispatch([], 'hello world')` → `{matched:false}`.
6. `TRIGGER_TYPES` has `'slash_command'`.
7. Canvas export route registered.
8. Canvas import route registered.

---

## §29 — Wave E Deliverables (WF-AUTO W7) · 2026-06-03

### Service — `BizCity_Automation_Community`

**File:** `core/automation/includes/class-automation-community.php`  
**Default manifest URL option:** `bizcity_automation_community_manifest_url` (filter `bizcity_community_manifest_url`)  
**Allowlist hosts:** `raw.githubusercontent.com`, `gist.githubusercontent.com` (extend qua filter `bizcity_community_allowed_hosts`).

### Security Posture (SSRF prevention)

| Guard | Behavior |
|---|---|
| HTTPS-only | `http://` → `WP_Error('url_not_https')` |
| Host allowlist | non-listed host → `WP_Error('url_host_not_allowed')` |
| Path traversal | `..` in path → `WP_Error('url_path_traversal')` |
| Size cap | manifest > 256 KB / md > 512 KB → `WP_Error('response_too_large')` |
| HTTP timeout | 8s + 3 redirects max + sslverify=true |
| Cache | transient 5′ per md5(URL) (manifest + md sễpạrate keys) |

### REST Routes

| Route | Handler | Notes |
|---|---|---|
| `GET /bizcity-automation/v1/community/workflows?manifest_url=` | `community_list()` | Fetch + sanitize manifest. Fail-OPEN `_degraded` for any error. |
| `GET /bizcity-automation/v1/community/workflow?url=` | `community_preview()` | Fetch raw + compile via `BizCity_Workflow_MD_Compiler`. NO DB write. |
| `POST /bizcity-automation/v1/community/workflows/import` | `community_import()` | Body `{url}`. Creates workflow `enabled=0`. Slash collision 409 guard. Tag suffix `,community`. |

### DDV Probe — `automation.community_gallery`

**File:** `core/diagnostics/includes/probes/class-probe-automation-community.php`  
**Severity:** warning (Optional PoC).  
**9 Steps** (all read-only, no external HTTP):
1. Disk — `class-automation-community.php` readable.
2. Loader — `BizCity_Automation_Community` class_exists.
3. `validate_url('https://raw.githubusercontent.com/...')` → true.
4. SSRF — `http://...` → `url_not_https`.
5. SSRF — `https://evil.example.com/...` → `url_host_not_allowed`.
6. SSRF — path with `..` → `url_path_traversal`.
7. REST route `GET /community/workflows` registered.
8. REST route `GET /community/workflow` registered.
9. REST route `POST /community/workflows/import` registered.

### Manifest format (community repo contract)

```json
{
  "version": "1.0",
  "name": "BizCity Community Workflows",
  "items": [
    {
      "slug": "tpl_zalo_welcome_v1",
      "name": "Zalo welcome reply",
      "description": "Auto-reply chào mừng khách mới.",
      "category": "cskh",
      "tags": "zalo,welcome",
      "url": "https://raw.githubusercontent.com/.../zalo-welcome.workflow.md",
      "author": "@bizcity",
      "version": "1.0.0",
      "icon": "MessageCircle"
    }
  ]
}
```

---

---

## §30 — CRM-PATH (PHASE-0.41 UI Dual-Path) · SHIPPED 2026-06-07

> Spec độc lập: [PHASE-0.41-AUTOMATION-CRM-PATH.md](PHASE-0.41-AUTOMATION-CRM-PATH.md).
> R-ZONE spec: [PHASE-0.40 §1.5](../../channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md#15) + [PHASE-0.39 §4.3](../../channel-gateway/docs/PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md).

### CRM-PATH-1 — Zone flag + scoped REST

| File | Change |
|---|---|
| `class-automation-repo-workflows.php` | `hydrate()` reads `trigger_config['zone']` (default `'admin'`). `normalise()` merges `zone` into `trigger_config_json`. `query()` supports `$args['zone']`: `zone=crm` → SQL `JSON_UNQUOTE(JSON_EXTRACT(trigger_config_json, '$.zone'))='crm'`; `zone=admin` → includes NULL/empty (legacy). |
| `class-automation-repo-templates.php` | `CATEGORIES` += `'care'`. `instantiate()` forwards `$overrides['zone']` to workflow create. |
| `class-automation-rest.php` | `crm_care_or_admin()` perm helper. `list_workflows()` zone-scoped for CRM-only users. New route `POST /templates/:id/crm-instantiate` (category gate + forces `zone='crm'`). New route `POST /workflows/:id/bind` (Zone-1 platform guard, stores `platform+account_id+zone=crm` in `trigger_config_json`). |

### CRM-PATH-2 — Care recipe seeder (SEED_VERSION 1.9.0)

3 builtin Zone-1 templates (category `cskh`/`care`, `zone=crm`):

| Slug | Trigger | Pipeline |
|---|---|---|
| `tpl_zalo_oa_auto_reply_v1` | `zalo_inbound` | trigger → search_kg → llm.compose_reply → reply_zalo + create_crm_event |
| `tpl_zalo_classify_route_v1` | `zalo_inbound` | trigger → llm (classify MUA_HANG/KHIEU_NAI/KY_THUAT/KHAC) → logic.condition → create_crm_event (2 branches) → reply_zalo |
| `tpl_zalo_tag_assign_v1` | `zalo_inbound` | trigger → llm (tag VIP/new/churn_risk JSON) → create_crm_event → reply_zalo |

### CRM-PATH-3 — CRM-care FE surface

| File | Change |
|---|---|
| `redux/api/crmCareApi.js` (NEW) | RTK Query slice: `listCareTemplates`, `listCareTemplates2`, `crmInstantiateTemplate`, `listCareWorkflows`, `bindWorkflow`, `toggleWorkflow`, `listCareRuns` |
| `redux/store.js` | Register `crmCareApi` reducer + middleware |
| `routes/CareAutomationRoute.jsx` (NEW) | Route component: gallery (templates) ← 2-col → my-recipes (workflows) + bind-to-channel panel + enable/disable toggle + run history (read-only). R-ZONE-5: NO ReactFlow canvas. |
| `shell/Workspace.jsx` | Route `/care-automation` → `<CareAutomationRoute />` |
| `shell/navConfig.js` | `MARKETING_NAV` += `{ id:'care-automation', label:'Tự động hoá CSKH', icon:Bot, path:'/care-automation' }` |

### CRM-PATH-4 — Zalo Zone-1 trigger isolation (R-ZONE-2)

| File | Change |
|---|---|
| `class-automation-trigger-matcher.php` | `platform_to_zone($platform, $event_subtype)` helper: `ZALO_OA`/`ZALO_PERSONAL`→`'crm'`; `ZALO_BOT`/`ZALO`→`'admin'`; else `''` (no filter). Called before `find_active_workflows()`. `run_payload['run_source']='crm_care'` stamped when zone=crm. `find_active_workflows($type, $zone='')` passes `zone` to `query()`. Match loop: `instance_id ?? account_id` fallback for CRM-bound workflows. |

### CRM-PATH-5 — Facebook Messenger care recipe (SEED_VERSION 1.10.0)

| File | Change |
|---|---|
| `class-automation-templates-seeder.php` | `bp_care_fb_messenger_reply()` — slug `tpl_fb_messenger_auto_reply_v1`, category `cskh`, trigger `fb_message`, zone=crm. Nodes: trigger.fb_message → search_kg → llm.compose_reply → action.reply_fb_message + action.create_crm_event. SEED_VERSION `1.9.0` → `1.10.0`. |
| `class-automation-trigger-matcher.php` | `platform_to_zone()`: `FB_MESS`/`MESSENGER`→`'crm'`; `FACEBOOK+event_subtype=messenger`→`'crm'`; `FB_FEED`/`FACEBOOK(feed)`→`''` (backward compat). |

### R-DCL — core.automation.json v1.8.0 (contract-only)

`core/diagnostics/changelog/core.automation.json` bumped `current_version` `1.7.1`→`1.8.0`. New history row documents: `trigger_config_json.zone` vocab `admin|crm`, `run_source=crm_care` in run payload, seeder 1.9.0/1.10.0 blueprints, `category` enum += `'care'`. No DDL change.

### DDV Probe — `core.automation.crm_path`

**File:** `core/diagnostics/includes/probes/class-probe-automation-crm-path.php`  
**Severity:** critical · order: 41 · estimate: 2000ms  
**5 assertion rows** (per PHASE-0.41 §8):

| Row | Assert |
|---|---|
| `zone_filter` | `query(zone=crm)` only returns crm rows; `query(zone=admin)` only returns admin/legacy rows |
| `recipe_catalog` | ≥1 template category=cskh + ≥1 template category=care seeded |
| `instantiate` | `crm-instantiate` via `rest_do_request` creates workflow with `zone=crm` |
| `bind_channel` | After bind(), `trigger_config` has `platform+account_id+zone=crm` |
| `zone_isolation` | Synthetic `ZALO_OA` dispatches only zone=crm workflow; synthetic `ZALO_BOT` dispatches only zone=admin workflow |

Registered in `core/diagnostics/bootstrap.php`.

---

## §31 — Docs governance + Trigger Single-Claim SPEC (2026-07-26)

> Rule đầy đủ: [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md) · Index đầy đủ:
> [AUTOMATION-DOCS-INDEX.md](AUTOMATION-DOCS-INDEX.md).

### 31.1 Bug — keyword fan-out (báo cáo user, chưa fix)

Một tin nhắn dài (ghi chú/checklist) tình cờ chứa nhiều từ khóa của nhiều workflow độc lập (vd
"Ghi chú", "Kịch bản", "Marketing") khiến `on_channel_message()` (nhánh matched-keyword BE-7.E) enqueue
**TẤT CẢ** workflow match thay vì đúng 1 workflow user thật sự muốn. Nguyên nhân: bước lọc
`exclusive` chỉ loại NHÓM (không chọn 1 winner duy nhất) và `usort()` theo `priority`/`version` chỉ
đổi thứ tự chạy, không cắt bớt `$matched` trước khi loop `enqueue_and_optionally_run()`.

### 31.2 Giải pháp SPEC — Single-Claim Resolution

`RULE-TRIGGER-SINGLE-CLAIM.md` đặc tả bước reduce mới chèn SAU lọc `exclusive`, TRƯỚC `usort()`, ở
cả 2 call site (`on_channel_message()` dispatch thật + `find_matching_workflows_for_payload()` preview
Twin GPT): chấm điểm mỗi workflow theo `(mode_strictness, is_prefix_anchor, matched_term_len,
priority, -wf_id)`, chỉ giữ lại 1 winner trừ khi workflow tự khai báo
`trigger_config.allow_costack=true` (utility/audit-log cố ý chạy song song). Rollout qua filter
`bizcity_automation_single_claim_enabled` (default bật). **Status: SHIPPED (core matcher)**; follow-up
còn mở: expose field `allow_costack` trên Inspector/FE và thêm DDV probe synthetic cho case 3 keyword
cạnh tranh.

### 31.3 Docs governance — AUTOMATION-DOCS-INDEX.md

Module có 23 doc (21 cũ + 2 mới đợt này) với 4 quy ước đặt tên trộn lẫn, không có index tổng.
`AUTOMATION-DOCS-INDEX.md` MỚI chuẩn hoá naming convention cho file tương lai
(`PHASE-<seq>[.<sub>]-<KEBAB>` / `RULE-<KEBAB>` / `GAP-ANALYSIS-<KEBAB>` / `WORKFLOW-<KEBAB>` /
`AUTOMATION-<KEBAB>`), index hoá toàn bộ doc hiện có theo 6 nhóm (Canon/Index · Rule · Phase-Roadmap ·
Gap-Analysis · Workflow · Reference), và lập rule bắt buộc: mọi PR thêm/sửa doc automation PHẢI bump
cả bảng chỉ mục của index LẪN changelog canon này trong CÙNG PR (§4 của index). File cũ KHÔNG bị
rename (tránh vỡ cross-reference) — chỉ được gắn ghi chú nếu tên gây hiểu nhầm (§2.2 của index, vd
`PHASE-R-FINAL-ACTION.md` thực chất là 1 RULE).

### 31.4 Next

Wave F (FE Community Gallery tab) vẫn còn mở từ v0.15. Single-Claim core đã
SHIPPED; follow-up hiện tại là Inspector/DDV và roadmap CCG-0..CCG-8 cho
`#workflow_slug`, không mở rộng thêm legacy `@workflow`/`/workflow`.

---

**End of canon v0.20 · Wave A+B+C+D+E SHIPPED · CRM-PATH-1..5 SHIPPED · Trigger Single-Claim shipped · CCG-1 backend slice in progress · Next: Wave F + CCG UI/timeline/DDV + Inspector follow-up.**
