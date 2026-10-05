# PHASE 0.41 — AUTOMATION UI DUAL-PATH (Admin builder ↔ CRM-care)

> **Module:** `core/automation/` (UI surface) — tách 2 path độc lập trên cùng 1 backend.
> **Status:** ~~SPEC~~ **IN PROGRESS** · v1.0 · 2026-06-07 → v1.1 · 2026-06-14
> CRM-PATH-1, CRM-PATH-2, CRM-PATH-3 ✅ DONE. CRM-PATH-4 🟡 backend/probe PASS;
> exact Personal bind and inbound Runtime evidence pending. CRM-PATH-5 ⏳ pending.
> **Owner:** Twin AI Core (Johnny Chu)
>
> **Quan hệ doc:**
> - Nền kiến trúc dual-mode + 3 dispatch: [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) §0 + §2.
> - Backend roadmap (BE-1→BE-7 đã ship): [AUTOMATION-1-BE-ROADMAP.md](AUTOMATION-1-BE-ROADMAP.md).
> - Zone separation (TỐI THƯỢNG): [PHASE-0.40-CRM-DEPLAO-PARITY.md](../../channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md) §1.5 R-ZONE.
> - Channel Zalo Personal/OA (nguồn inbound Zone 1): [PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md](../../channel-gateway/docs/PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md).
> - Deplao reference: `plugins/bizcity-twin-crm/_library/deplao-builder-main/src/`.
>
> **Related rules:** R-ZONE (§1.5 của 0.40) · R-GW-8 · R-CH-NS · R-ERROR-UX · R-DDV · R-DCL · R-CRON-META · R-STAMP.

---

## 0. Tuyên ngôn (1 câu)

> **Một backend automation (`BizCity_Automation_Runner` + block registry + REST `bizcity-automation/v1`),
> HAI mặt tiền UI tách bạch: (A) nhánh ADMIN/QUẢN TRỊ — canvas builder kéo-thả "giao việc cho não"
> (Zone 2, hiện hữu); (B) nhánh CRM-CARE — recipe chăm sóc kênh khách hàng (Zone 1, mới). Cùng 1 não,
> khác quyền, khác surface, khác zone — KHÔNG trộn luồng.**

→ Đây là phần **UI split** của R-ZONE-3 ("Workflow builder thuộc Zone 2"). 0.41 đặc tả cách Zone 1
*tiêu thụ* automation như **dịch vụ** mà KHÔNG nhúng raw workflow CRUD vào CRM Inbox SPA.

---

## 1. Sơ đồ 2 path trên 1 backend

```
                         ┌──────────────────────────────────────────────┐
                         │   BACKEND CHUNG (đã ship BE-1→BE-7)           │
                         │   • BizCity_Automation_Runner                 │
                         │   • class-block-registry.php (11 trig+15 act) │
                         │   • REST  bizcity-automation/v1/*             │
                         │   • bizcity_automation_workflows/runs/logs    │
                         └──────────────────────────────────────────────┘
                              ▲                                   ▲
        ┌─────────────────────┘                                   └─────────────────────┐
        │ PATH A — ADMIN BUILDER (Zone 2)            │ PATH B — CRM-CARE RECIPE (Zone 1) │
        │ (HIỆN HỮU — nhánh quản trị)                │ (MỚI — nhánh chăm sóc)            │
        ├────────────────────────────────────────────┼────────────────────────────────────┤
        │ Surface: Channel Gateway admin SPA          │ Surface: CRM SPA → tab "Tự động      │
        │   route /automation/* (canvas ReactFlow)    │   hoá CSKH" (recipe + binding)       │
        │ Permission: manage_options                  │ Permission: cap CRM (bizcity_crm_*)  │
        │ Đối tượng: admin/founder                    │ Đối tượng: CSKH/nhân viên chăm sóc   │
        │ Tác vụ: build DAG tự do, giao việc cho não  │ Tác vụ: bật/tắt recipe care, gán kênh │
        │ Trigger phơi bày: slash_command · cron ·    │ Trigger phơi bày: zalo_oa · zalo_    │
        │   webhook · skill_intent · zalo_bot         │   personal (sau: facebook_messenger) │
        │ Template category: mpr · admin · giao-việc  │ Template category: cskh · care        │
        │ Inbound nguồn: bizcity-zalo-bot (ZALO_BOT)  │ Inbound nguồn: CRM channels (Zone 1) │
        └────────────────────────────────────────────┴────────────────────────────────────┘
```

**Then chốt:** cả 2 path gọi **cùng REST** `bizcity-automation/v1`. Khác biệt chỉ ở: (1) **scope quyền**,
(2) **bộ trigger/template được phơi bày**, (3) **mức trừu tượng UI** (canvas tự do vs recipe đóng gói),
(4) **zone** của inbound. KHÔNG fork backend, KHÔNG đẻ bảng mới.

---

## 2. R-ZONE-5 — CRM path là RECIPE surface, KHÔNG phải canvas CRUD

> **Bổ sung cho R-ZONE-3.** Path B (CRM-care) TUYỆT ĐỐI không phơi bày raw workflow canvas (kéo-thả
> node, sửa edge, sửa graph_json) trong CRM SPA. Path B chỉ được phép:

| ✅ Path B (CRM-care) ĐƯỢC làm | ❌ Path B CẤM làm |
|---|---|
| Duyệt **recipe gallery** (template category `cskh`/`care`) | Mở ReactFlow canvas sửa node/edge |
| **Instantiate** recipe → workflow `enabled=0` (clone từ template) | `PUT /workflows/:id` sửa `graph_json` thủ công |
| **Bind** recipe vào kênh Zone 1 (zalo_oa/zalo_personal) + bật/tắt | Tạo workflow trống from-scratch |
| Sửa **tham số an toàn** đã whitelist (reply template, delay, assignee) | Sửa block_id / thêm action HTTP/db_write tuỳ ý |
| Xem **run history** + trace per-recipe (read-only) | Sửa permission / trigger_type của workflow |

**Lý do:** raw canvas = công cụ quản trị (Zone 2). CSKH cần *bật recipe chăm sóc* an toàn, không cần
(và không được) build DAG tự do — tránh nhân viên vô tình tạo automation đụng schema/gửi mail hàng loạt.
Recipe = workflow đã được admin duyệt sẵn ở Path A, Path B chỉ *kích hoạt theo kênh*.

> **R-ZONE-6 — Một workflow, một owner-zone.** Mỗi row `bizcity_automation_workflows` mang cờ
> `zone` (`admin` | `crm`) trong `trigger_config_json.zone` (KHÔNG đẻ cột — reuse JSON field đã có).
> REST list lọc theo zone + capability: Path A thấy `zone=admin` (+ tất cả nếu super-admin);
> Path B chỉ thấy `zone=crm`. Recipe gallery CRM = workflow `is_template=1 AND category∈{cskh,care}`.

---

## 3. Bám sát AUTOMATION-0-CANON (dual-mode + 3 dispatch)

0.41 KHÔNG đổi runtime. Map 2 path vào 3 dispatch mode đã chốt ở CANON §2:

| Path | Design-time surface | Run-time dispatch (CANON §2) | `run.source` |
|---|---|---|---|
| A — Admin | Canvas ReactFlow `/automation/*` | A. TwinChat agent · C. Cron · B. inbound `ZALO_BOT` | `agent_mode` / `cron` / `zalo_bot` |
| B — CRM-care | Recipe gallery + binding (CRM SPA) | B. Inbound Channel (zalo_oa/zalo_personal → sau: fb_messenger) | `crm_care` |

→ Thêm 1 giá trị `source` mới `crm_care` cho run khởi từ recipe Zone 1, để Scheduler/diagnostic phân biệt
nguồn. Vẫn **cùng** `BizCity_Automation_Runner::run()` (CANON "khác nhau duy nhất ở `source` field").

---

## 4. Tham khảo Deplao — cách họ làm care automation

> Nguồn: `plugins/bizcity-twin-crm/_library/deplao-builder-main/src/`.

| Deplao | bizcity Path B mapping |
|---|---|
| `services/WorkflowEngineService` (48 node types) chạy nền theo account | `BizCity_Automation_Runner` (đã có) — KHÔNG port engine, chỉ port UX recipe |
| Care automations gắn theo từng account/conversation | Recipe **bind theo kênh** Zone 1 (`bizcity_channel_bindings` đã có ở 0.33) |
| `CRMQueueService` token-bucket 60/hr (chống spam khi gửi hàng loạt) | Rate-limit khi recipe auto-reply (reuse `BizCity_Gateway_Sender` throttle) |
| Template gallery care (auto-reply, classify, tag, route) | Template category `cskh`/`care` qua `class-automation-templates-seeder.php` |
| Boss↔employee tunnel (giao việc) | **Thuộc Path A / Zone 2** — KHÔNG vào Path B. *(2026-09-19, PHASE-0.50 C-05/N-06, [R-LM-8](../../../docs/rules/PHASE-0-RULE-LEADER-MEMBER-WORKSPACE.md)):* đã có bản mặc định (CRM tự gửi qua Path A khi leader giao việc); leader muốn tuỳ biến lời nhắn thì tự dựng một workflow **Path A** (`trigger.webhook` → `action.reply_zalo`) và trỏ CRM Settings vào đó — xem ví dụ ở [AUTOMATION-USER-GUIDE.md §3.5](AUTOMATION-USER-GUIDE.md#35-triggerwebhook). Không phải Path B: nhân viên CSKH không tự cấu hình cái này. |

**Nguyên tắc port:** lấy **UX pattern** (recipe gallery + per-channel binding + run history care), KHÔNG
port code Electron/better-sqlite3. Backend đã đủ — chỉ thêm **scope + surface FE**.

---

## 5. Lộ trình (đồng bộ với AUTOMATION-1-BE-ROADMAP)

> Đặt tên sprint `CRM-PATH-*` để KHÔNG gãy đánh số BE-1→BE-7 hiện hữu. Path A đã ship (canvas builder).

| Sprint | Tên | Output | Phụ thuộc | Status |
|---|---|---|---|---|
| CRM-PATH-1 | Zone flag + scoped REST | thêm `trigger_config_json.zone` (admin\|crm); REST `GET /workflows?zone=crm` lọc theo cap CRM; capability gate `bizcity_crm_manage` cho route Path B | BE-1..BE-7 (đã ship) | ✅ DONE 2026-06-07 |
| CRM-PATH-2 | Care recipe seeder | bump `SEED_VERSION`; thêm 3+1 template category `cskh`/`care` (Zalo OA auto-reply, classify+route, tag+assign, FB Messenger); `is_template=1` | CRM-PATH-1 | ✅ DONE 2026-06-07 |
| CRM-PATH-3 | CRM-care FE surface | tab "Tự động hoá CSKH" trong CRM SPA: recipe gallery + bind-to-channel + bật/tắt + run history (read-only); KHÔNG canvas; 55 templates seeded (W1-W25 thêm 2026-06-14) | CRM-PATH-2 + 0.39 channels | ✅ DONE 2026-06-14 |
| CRM-PATH-4 | Port kênh Zalo (Zone 1) | bind recipe vào `zalo_oa` + `zalo_personal` inbound (R-ZONE-2 discriminator); `run.source='crm_care'` | CRM-PATH-3 + 0.39 inbound | 🟡 BACKEND/PROBE PASS; Personal runtime evidence pending |
| CRM-PATH-5 | Trigger Facebook Messenger | thêm `trigger.fb_messenger` (Zone 1) vào recipe care — "sau chỉ cần thêm trigger là ok" | CRM-PATH-4 + FB adapter | ⏳ PENDING |

**Thứ tự bắt buộc:** port **Zalo trước** (CRM-PATH-4, kênh đã có ở 0.39) → FB Messenger sau (CRM-PATH-5),
đúng yêu cầu "đang có thì port luôn trước, sau chỉ cần thêm trigger facebook messenger là ok".

**0.39 handoff (2026-09-04):** Realtime Zalo Personal inbound and the live
account/session path remain available for CRM-PATH-4. The separate experimental
Group History reader is blocked by `3/3` provider HTTP 404 responses through
`zca-js@2.1.2`; this does not block CRM-care recipe binding because CRM-PATH-4
must consume the supported realtime/CRM inbound owner, not historical backfill.
Historical revalidation remains owned by 0.39F and follows its upstream rerun
checklist; it must not create a second automation or CRM history owner.

---

## 6. REST đổi/ thêm (NS `bizcity-automation/v1`)

| Route | Path | Thay đổi |
|---|---|---|
| `GET /workflows?zone=crm&is_template=1` | B | filter theo `zone` + `category∈{cskh,care}`; cap `bizcity_crm_manage` |
| `POST /workflows/:id/instantiate` | B | clone template → workflow `enabled=0`, `zone=crm` (thay vì cho sửa graph) |
| `POST /workflows/:id/bind` | B | gắn workflow vào `(platform, account_id)` qua `bizcity_channel_bindings` (0.33) |
| `GET /runs?zone=crm&workflow_id=` | B | run history read-only, lọc zone |
| `GET /workflows` (hiện hữu) | A | mặc định `zone=admin` khi caller chỉ có `manage_options`; super-admin thấy cả 2 |

> **R-GW-8:** AI builder (nếu Path B cần gợi ý recipe) gọi `BizCity_LLM_Client` (client standalone),
> KHÔNG fetch thẳng `bizcity.vn`. **R-CH-NS:** mọi route giữ namespace `bizcity-automation/v1`.
> **R-ERROR-UX:** lỗi bind/instantiate trả `BizCity_Error_Payload::make(code,message,hint,help_code)`.

---

## 7. R-DCL — schema changelog

Không thêm bảng mới. `zone` reuse `trigger_config_json` (TEXT đã có từ 1.0.0). Vẫn phải:
- Contract-only bump `core/diagnostics/changelog/core.automation.json` (ghi rõ `trigger_config_json.zone`
  vocab `admin|crm` + `run.source` thêm `crm_care` trong `history[]`).
- Chạy `php core/diagnostics/validate-schema-changelog.php` exit 0 trước commit.

---

## 8. R-DDV — probe rows (3 layer)

Probe `core.automation.crm_path` (severity `warning`):

| Row | Disk | Loader | Runtime |
|---|---|---|---|
| `crm_path.zone_filter` | helper `zone` filter tồn tại | REST class loaded | `GET /workflows?zone=crm` với cap thấp KHÔNG trả `zone=admin` |
| `crm_path.recipe_catalog` | seeder có category `cskh/care` | seeder loaded | synthetic list trả ≥1 template care |
| `crm_path.instantiate` | route `instantiate` đăng ký | route callable | synthetic instantiate → workflow `enabled=0,zone=crm` |
| `crm_path.bind_channel` | bind route tồn tại | binding API loaded | synthetic bind zalo_oa → row `bizcity_channel_bindings` |
| `crm_path.zone_isolation` | guard tồn tại | guard attached | recipe Zone 1 KHÔNG lộ canvas CRUD; workflow `zone=admin` KHÔNG hiện ở Path B |

> Mỗi sprint `CRM-PATH-*` đụng REST/SQL/hook PHẢI có ≥1 row PASS mới coi DONE (R-DDV).

---

## 9. PHP 7.4 + R-STAMP

- Code compat PHP 7.4 floor (KHÔNG union return type, `match`, nullsafe `?->`, enum, `str_contains`).
- Mọi file `.php` sửa/tạo ghi stamp: `// [YYYY-MM-DD Johnny Chu] PHASE-0.41 — <mô tả>`.
- Ghi file PHP qua tool (no BOM), KHÔNG `Set-Content -Encoding UTF8`.

---

## 10. Checklist DONE (gate Phase 0.41)

- [x] **Zone:** `trigger_config_json.zone` (`admin|crm`) ghi + REST lọc theo cap; Path B KHÔNG thấy `zone=admin`. ✅ CRM-PATH-1
- [x] **R-ZONE-5:** Path B chỉ recipe/bind/toggle — KHÔNG canvas CRUD; xác nhận trên SPA. ✅ CRM-PATH-3
- [x] **Recipe:** seeder có 55 template (4 `cskh/care` zone=crm + 51 admin); instantiate → `enabled=0,zone=crm`. ✅ CRM-PATH-2 + W1-W25
- [x] **FE CRM-care tab:** `CrmCareTab.jsx` + `automationCareApi.js` + `navConfig.js` + `Workspace.jsx` + `store.js` built. ✅ CRM-PATH-3
- [x] **BOOT.automationRestUrl:** exposed qua `class-admin-menu.php` + PHP stamp. ✅ CRM-PATH-3
- [~] **Bind:** REST callback bind checks for both `ZALO_OA` and
  `ZALO_PERSONAL`, recipe instantiate, zone filter and CRM-care source stamping
  are covered by `core.automation.crm_path` PASS on blog `1526`
  (`1 pass · 0 fail · 0 skip`); live inbound `run.source=crm_care`, member
  ownership and production activation evidence remain pending. CRM-PATH-4 is
  not production-complete yet.
- [ ] **FB sau Zalo:** trigger `fb_messenger` chỉ thêm ở CRM-PATH-5, sau khi Zalo port xong. ⏳ CRM-PATH-5
- [ ] **Canon:** thêm cross-link 0.41 vào [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) + roadmap.
- [ ] **DCL:** `core.automation.json` contract bump (vocab `zone` + `source=crm_care`); validator exit 0.
- [x] **DDV:** probe `core.automation.crm_path` passed 5 runtime rows on blog
  `1526` with `1 pass · 0 fail · 0 skip`; exact Personal runtime and
  production evidence remain separate gates.
- [ ] **Error UX:** lỗi bind/instantiate đủ 4 trường + help_code.
- [x] **R-STAMP** đủ; PHP 7.4 grep guard sạch. ✅

---

## 11. Cross-link cần cập nhật khi merge

- [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md) — changelog row + §2 ghi chú 2 path UI.
- [AUTOMATION-1-BE-ROADMAP.md](AUTOMATION-1-BE-ROADMAP.md) — thêm block sprint `CRM-PATH-*`.
- [PHASE-0.40-CRM-DEPLAO-PARITY.md](../../channel-gateway/docs/PHASE-0.40-CRM-DEPLAO-PARITY.md) §2.3 — đã trỏ sang 0.41.
- [PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md](../../channel-gateway/docs/PHASE-0.39-ZALO-PERSONAL-OA-CHANNEL.md) — nguồn inbound Zone 1.
