# PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP

> Status: IN PROGRESS · order product matcher code landed, canary pending
> Date: 2026-08-16
> Owner: Twin AI Core (Johnny Chu)
> Scope: core/automation templates + seeder + workflow upgrade policy
> Related: R-AUTO-TPL, R-ERROR-UX, R-DDV, MPR V5 HIL roadmap

---

## 0. Muc tieu

Tai lieu nay chot 1 ke hoach thuc thi cho viec viet lai cac kich ban automation de:

1. Co HIL contract mac dinh trong template (khong bat admin setup thu cong tung cai).
2. Co co che auto check version va auto bump khi template doi.
3. Co nang cap tu dong cho kich ban da seed/import truoc day theo nguyen tac an toan, idempotent.
4. Dam bao MVP HIL chay thanh cong o runtime, khong vo side-effect safety gate.

---

## 1. Hien trang va GAP

### 1.1 Hien trang da co

- Runtime HIL da duoc noi vao matcher va runner:
  - Matcher goi HIL step truoc enqueue (`prepare_hil_payload()`).
  - Runner block side-effect neu co `hil_spec` nhung chua `_hil_ready` (`hil_not_ready`).
- Builder da co HIL compiler dialog de compile va apply thu cong vao trigger node.
- REST save workflow da validate `trigger_config.hil_spec` fail-closed.

### 1.2 GAP can dong trong phase nay

- Chua co HIL mac dinh trong bo template JSON (future + builtin groups).
- Chua co policy nang cap tu dong cho workflow da tao tu template cu.
- Chua co co che auto-compile theo prompt (hien tai van bam tay Compile/Apply).
- Chua co matrix acceptance MVP theo nhom kich ban uu tien.

---

## 2. Pham vi kich ban rewrite (uu tien MVP)

### 2.1 Nhom A - FB/Web content publishing

- `tpl_daily_fb_post_8h_v1`
- `tpl_daily_fb_post_9h_v1`
- `tpl_daily_fb_post_10h_v1`
- `tpl_daily_notebook_fb_post_v1`
- `tpl_daily_notebook_wp_post_v1`
- `tpl_fb_post_with_auto_image_v1`
- `tpl_wp_post_with_auto_image_v1`
- `tpl_global_fb_post_image_first_v1`

### 2.2 Nhom B - Photo/Image workflows

- `tpl_generate_image_v1`
- `tpl_zalobot_seedream_photo_capture_v1`
- `tpl_zalobot_seedream_photo_edit_v1`
- `tpl_daily_fb_content_image_v1`
- `tpl_daily_wp_content_image_v1`

### 2.3 Nhom C - Order/Commerce trigger workflows

- `tpl_woo_order_created_v1`
- `tpl_woo_order_shipped_v1`
- `tpl_woo_abandoned_cart_v1`
- `tpl_woo_refund_notify_v1`

Co the mo rong tiep theo wave sau cho CRM/staff templates, nhung MVP HIL phai pass tren 3 nhom tren truoc.

---

## 3. Contract rewrite cho tung template

## 3.1 Trigger config bo sung

Moi template trong scope phai co them trong `trigger_config`:

```json
{
  "hil_prompt": "<author prompt mo ta cac slot can thu va dieu kien confirm>",
  "hil_spec": { "spec_version": "twin_hil.v1", "slots": [], "final_confirmation": {} },
  "hil_spec_version": "twin_hil.v1",
  "hil_rollout": "mvp"
}
```

Quy tac:

- `hil_prompt` de truy vet y do tac gia, su dung cho auto-compile va audit.
- `hil_spec` la contract runtime that su duoc matcher/runner dung.
- `hil_spec_version` giu compatibility gate trong cac wave sau.
- `hil_rollout` de segment rollout (`mvp`, `pilot`, `ga`).

## 3.2 Mapping side-effect level theo nhom

- FB/Web publish: `explicit_confirmation` bat buoc.
- Order/Commerce create-update: `explicit_confirmation` bat buoc.
- Photo edit/generate:
  - neu chi tao output xem truoc: `soft_confirmation`.
  - neu co publish/send/customer-impact: `explicit_confirmation`.

## 3.3 Rule an toan khi rewrite

- Khong xoa node/edge business da on dinh neu khong can.
- Chi chen HIL contract vao trigger path, uu tien patch nho.
- Khong thay doi slug template dang active chi de "them HIL".
- Neu thay doi nghiep vu lon (breaking behavior): tao template `_v2` moi.

---

## 4. Auto check version va bump strategy

## 4.1 Template content version

- Minor patch HIL-only (khong doi logic node): bump `template_version` theo MINOR/PATCH.
- Breaking behavior (doi flow/target side effect): tao slug `_v2` + `template_uuid` moi.

## 4.2 Seeder version + fingerprint

Dung cap doi da co san:

- `SEED_VERSION` (manual bump, bat buoc trong PR).
- `HASH_OPTION` + `current_blueprints_hash()` (auto detect drift neu quen bump).

Contract execute:

1. Neu `SEED_VERSION` khac -> reseed.
2. Neu `SEED_VERSION` giong nhung hash khac -> reseed.
3. Neu khong khac -> skip (co TTL recheck de tranh query/rerender nang).

## 4.3 Workflow row version

Workflow update da tu bump `version = old + 1` trong repo update path.
Phase nay phai tai su dung logic do, khong tu tao counter rieng.

---

## 5. Co che nang cap tu dong kich ban

## 5.1 Tang 1 - Builtin template library (seed path)

Sau khi rewrite JSON template:

1. Seed lai (`maybe_seed/force_reseed`) de upsert template rows.
2. `sync_to_hub()` day template len Hub (neu main site), giu dong bo ecosystem.

Ket qua mong doi:

- Template moi import vao workflow se co HIL ngay tu dau.

## 5.2 Tang 2 - Workflow da ton tai (upgrade path)

Them 1 upgrader policy (service moi hoac hook trong seeder):

1. Chon workflows thuoc `scope slug list`.
2. Chi patch neu workflow thieu `trigger_config.hil_spec`.
3. Giu nguyen custom graph/business fields cua user.
4. Ghi marker `trigger_config.hil_upgrade = { from_template_version, upgraded_at, policy }`.
5. Update qua repo update de auto bump row `version`.

Safe patch mode:

- `safe_only`: chi patch khi trigger type va trigger skeleton con hop le.
- `force`: chi cho admin explicit action (khong chay mac dinh).

Idempotent bat buoc:

- Chay upgrader nhieu lan van cho ket qua nhu nhau (khong duplicate payload, khong mutate vo han).

## 5.3 Reason bucket khi skip/fail

MVP upgrader phai tra ve thong ke co ly do:

- `upgraded`
- `already_hil`
- `skipped_customized`
- `skipped_scope_miss`
- `failed_spec_invalid`
- `failed_workflow_not_found`

---

## 6. UI intelligence (auto compile + apply policy)

Builder hien tai da co compile/apply thu cong. Phase nay mo rong:

1. Khi admin sua `hil_prompt`, FE debounce compile (khong auto save ngay).
2. Neu compile hop le:
   - hien diff nho (spec cu vs spec moi),
   - cho phep `Apply to trigger` 1 click.
3. Neu compile loi:
   - show payload theo R-ERROR-UX (`code/message/hint/help_code`),
   - khong overwrite `hil_spec` cu.
4. Neu user save workflow khi `hil_prompt` doi nhung `hil_spec` chua apply:
   - canh bao ro rang va cho lua chon keep old / apply new.

Muc tieu la giam thao tac tay, khong tao "save la override" gay nguy hiem.

## 6.1 HIL Config Dialog (button-based)

De giam loi khi edit Raw JSON tay, Builder bo sung 1 nut trong Inspector:

- Vi tri: `Workflow Builder -> Chon trigger node -> panel Cấu hình node`.
- CTA: `Cau hinh HIL` (button).
- Hanh vi: bam nut -> mo `HIL Spec Compiler Dialog`.
- Ket qua: compile xong -> `Apply` -> ghi ve trigger node:
   - `hil_prompt`
   - `hil_spec`
   - `hil_spec_version`
   - `hil_compiled_prompt`
   - `hil_compiled_at`

Dialog phai co `Preset` theo kich ban de tao prompt nhanh dung schema input.

## 6.2 Prompt requirement matrix (bat buoc)

### A. Dang Facebook (thieu anh / thieu chu de)

Prompt HIL bat buoc nhac den cac input:

1. `topic` (chu de bai dang)
2. `image` (anh dinh kem hoac xac nhan text-only)
3. `caption` (noi dung cuoi truoc publish)
4. `final_confirm` truoc side-effect publish

### B. Tao don (thieu thong tin dat hang)

Prompt HIL bat buoc thu du:

1. `product_name` (ten san pham)
2. `price` (gia/thanh toan)
3. `receiver_phone` (SDT nguoi nhan)
4. `receiver_address` (dia chi giao hang)
5. `payment_method` (COD/chuyen khoan/...)
6. `final_confirm` truoc khi chay `action.create_woo_order`

### C. Tao anh (thieu topic)

Prompt HIL bat buoc co:

1. `topic` (chu de anh) — REQUIRED
2. `style_or_usecase` (khuyen nghi)
3. `final_confirm` truoc generation/publish tiep theo

### D. Sua anh (thieu anh goc)

Prompt HIL bat buoc co:

1. `source_image` (anh dau vao truoc khi sua) — REQUIRED
2. `edit_instruction` (mo ta sua)
3. `final_confirm` truoc side-effect

Neu thieu slot REQUIRED, HIL phai tiep tuc hoi tiep va block runner side-effect.

## 6.3 Order product suggestion + small-model matching

Voi workflow co `action.create_woo_order`, slot `product_name` KHONG duoc coi la
mot chuoi tu do du de tao don. HIL phai dung catalog Woo lam nguon ung vien va
chi chuan hoa cau tra loi cua khach ve mot san pham da ton tai.

### Luong canonical

```text
HIL toi slot product_name
   -> BizCity_TwinBrain_Product_Provider::suggestions(8)
   -> HIL gui danh sach ten/gia/SKU de khach chon so hoac noi ten
   -> khach tra loi
   -> exact number/name/SKU match truoc
   -> neu chua ro: BizCity_LLM_Client::chat() voi model gpt-4o-mini
          candidates[] + reply -> {candidate_index, confidence}
   -> confidence < 0.75 / candidate ngoai danh sach
          -> re-ask + hien lai danh sach, KHONG tao san pham moi
   -> chi luu product_name canonical sau khi match hop le
```

Quy tac bat buoc:

- Candidate chi lay tu Woo `publish + visible`, gioi han toi da 8 san pham cho
   mot cau hoi; cache dung group `bcpro`, TTL ngan.
- LLM matcher la JSON-only, `temperature=0`, `max_tokens` nho, `no_fallback=true`.
   Model khong duoc tra ve ten san pham tu sinh; chi duoc chon `candidate_index`.
- Neu Woo catalog khong san sang, fallback chi giu text bounded de tiep tuc
   hoi/xac minh; khong tu dong coi text la product_id/SKU va khong tao san pham
   ao.
- `product_name`, `quantity`, `price`, `recipient_name`, `receiver_phone`,
   `shipping_address`, `payment_method` phai duoc map vao `trigger.hil_slots`
   trong runner memory sau khi HIL `ready`; khong ghi slot PII vao
   `trigger_payload_json`.
- `bank_transfer` phai normalize ve Woo gateway slug `bacs`.
- Confidence gate la safety gate, khong phai UX hint: khong dat nguong thi
   HIL van o collecting va side-effect van bi block.

### Acceptance cho product matcher

- [ ] Cau hoi product co danh sach catalog co ten + gia (neu co).
- [ ] Chon `1` map dung candidate thu nhat.
- [ ] Exact name/SKU map dung candidate ma khong goi LLM.
- [ ] Ambiguous reply goi `gpt-4o-mini` voi candidates dong, chi nhan index hop le.
- [ ] Confidence duoi `0.75` re-ask, khong enqueue/khong tao order.
- [ ] Woo/provider/LLM unavailable khong lam fatal HIL; fallback fail-safe.
- [ ] Probe `twinbrain.hil` co Disk/Loader/Runtime evidence cho wiring nay.

---

## 7. MVP acceptance criteria (PASS gate)

MVP HIL chi duoc coi PASS khi dat dong thoi:

1. Template coverage:
   - 100% slug trong scope co `hil_prompt + hil_spec` hop le.
2. Runtime safety:
   - side-effect block duoc chan neu chua `_hil_ready`.
3. Upgrade safety:
   - upgrader idempotent, co reason stats ro rang.
4. Diagnostics:
   - `twinbrain.hil` PASS,
   - probe lien quan runner/matcher PASS,
   - khong tao regression notice/owner continuity.
5. Canary:
   - moi nhom A/B/C co it nhat 1 run thanh cong voi HIL open -> progress -> ready -> close.

---

## 8. Rollout plan de tranh vo runtime

## 8.1 Wave thu tu

1. Docs + scope freeze (tai lieu nay).
2. Rewrite JSON templates + bump `SEED_VERSION`.
3. Enable upgrader `safe_only` cho workflow cu.
4. Bat auto-compile UI policy.
5. Chay probe/canary + log review.
6. Neu on dinh -> mo rong scope them CRM templates.

## 8.2 Rollback

- Giu backup template JSON truoc khi rewrite.
- Co feature flag tat upgrader ngay lap tuc neu thay skip/fail ratio bat thuong.
- Workflow da patch co marker `hil_upgrade` de rollback script nhan dien duoc.

---

## 9. Checklist implementation

- [ ] Rewrite template JSON trong 3 nhom scope voi `hil_prompt/hil_spec`.
- [ ] Bump `SEED_VERSION` + verify hash drift trigger.
- [ ] Them upgrader service va summary report endpoint/log.
- [ ] Them FE auto-compile policy cho HIL prompt.
- [ ] Them nut `Cau hinh HIL` trong Inspector trigger node + dialog preset.
- [ ] Them matrix prompt requirement cho FB/Order/Image create/edit.
- [ ] Them catalog product suggestion + `gpt-4o-mini` candidate matcher cho order HIL.
- [ ] Bo sung/doi moi DDV evidence cho rollout nay.
- [ ] Cap nhat roadmap MPR V5 voi runtime evidence sau canary.

---

## 10. Notes cho team

- Tai lieu nay la contract implementation cho sprint tiep theo, chua claim runtime PASS.
- Moi change code PHP lien quan matcher/runner/rest tiep tuc bat buoc stamp theo R-STAMP.
- Neu dot toi schema moi cho upgrader state, phai di dung R-DCL + R-CR + Site Provisioner + DDV.
