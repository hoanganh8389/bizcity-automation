# Workflow: Danh Gia Do Hop Chiem Tinh Ho So Moi - Zalo Bot

> Phase-ID: PHASE-FAA2-TWINBRAIN REL-1
> Created: 2026-07-08
> Author: Johnny Chu
> Template slug: tpl_astro_relation_profile_zalo_v1
> Trigger: trigger.zalo_inbound

---

## 1. Tong quan flow

```
User nhan: "Xem ho so nguoi nay co hop cong viec khong?"
        |
        v
[T1] trigger.zalo_inbound
        |
        v
[N1] action.run_astro
        |  Resolve subject self-profile + classifier hints
        |
        v
[N2] action.run_astro_relation_assessment   (NEW)
        |  Resolve partner profile + sync transit pair + compose relation answer
        |
        v
[N3] logic.condition  {{n2.ok}} == 1
   |TRUE                               |FALSE
   v                                   v
[R1] action.reply_zalo                 [ERR] action.reply_zalo
    reply subject+relation                 huong dan tao/chon profile
```

Muc tieu:

1. Khong gui day-by-day transit table.
2. Gui relation answer theo 4 truc:
- cong viec
- tinh cam
- hop tac lam an
- nhan su
3. Output unify voi TwinBrain ask mode.

---

## 2. Block moi: action.run_astro_relation_assessment

Block ID:

- `action.run_astro_relation_assessment`

File du kien:

- `core/automation/includes/blocks/actions/class-action-run-astro-relation-assessment.php`

### 2.1 Input fields

- `subject_coachee_id` (optional, default from self profile)
- `partner_coachee_id` (optional)
- `partner_name` (optional, fallback detect from query)
- `query` (default `{{trigger.text}}`)
- `relation_lenses` (optional CSV: `work,love,business,hr`)
- `source_marker` (default: `zalobot_chat`)
- `sync_days` (default: 7)
- `start_offset` (default: 1)

### 2.2 Output vars

- `{{nX.ok}}`
- `{{nX.subject_coachee_id}}`
- `{{nX.partner_coachee_id}}`
- `{{nX.subject_name}}`
- `{{nX.partner_name}}`
- `{{nX.subject_block_md}}`          (target ~20 lines)
- `{{nX.relation_block_md}}`         (target ~50-70 lines)
- `{{nX.final_answer_md}}`           (subject + relation + ket luan)
- `{{nX.relation_lenses}}`           (`work,love,business,hr`)
- `{{nX.subject_natal_url}}`
- `{{nX.partner_natal_url}}`
- `{{nX.subject_transit_url}}`
- `{{nX.partner_transit_url}}`
- `{{nX.citations}}`                 (JSON array `[astro:*]`)
- `{{nX.source_marker}}`             (`zalobot_chat`)
- `{{nX.sync_status}}`               (`ok|partial|failed`)
- `{{nX.error_code}}`
- `{{nX.error_message}}`

### 2.3 Shared service dependency

Block nay KHONG tu compose rieng. Bat buoc goi chung service/composer:

- `BizCity_TwinBrain_Astro_Relation_Assessment_Service`
- `BizCity_TwinBrain_Astro_Relation_Composer`

Rule:

- Zalo va TwinBrain dung 1 output contract.
- Khong duoc drift prompt giua 2 surfaces.

---

## 3. Compose contract cho block relation

### 3.1 Subject block

- 20 dong (xap xi).
- Gom: tinh cach cot loi, cach hop tac, diem de xung dot.
- Co citation natal cho subject.

### 3.2 Relation block

- 50-70 dong.
- Bat buoc 4 sections:
  - Cong viec
  - Tinh cam
  - Hop tac lam an
  - Nhan su
- Moi section bat buoc co:
  - diem hop
  - diem xung
  - hanh dong de giam xung
  - citation natal + transit

### 3.3 Citation/public links

Moi answer phai co:

- token: `[astro:natal#subject]`, `[astro:natal#partner]`
- token: `[astro:transit-range#subject/<from>..<to>]`, `[astro:transit-range#partner/<from>..<to>]`
- links: subject/partner natal_url + transit_url

---

## 4. Transit sync + source marker policy

Truoc khi tra loi:

1. Sync transit cho subject (range start_offset + sync_days).
2. Sync transit cho partner (cung range).
3. Persist snapshots vao `bccm_transit_snapshots`.
4. Ghi source marker vao `bccm_astro.llm_report` metadata:
- `source_marker = zalobot_chat`
- `trace_id`
- `chat_id`
- `subject_coachee_id`
- `partner_coachee_id`

Fail-open:

- Neu sync partial -> van tra loi, nhung `sync_status=partial` + warning line.
- Neu missing profile -> tra `ok=0` + huong dan tao/chon profile.

---

## 5. Workflow JSON template (skeleton)

Luu trong file templates theo quy uoc generic, khong ten khach hang.

```json
[
  {
    "slug": "tpl_astro_relation_profile_zalo_v1",
    "name": "Chiem tinh - Danh gia do hop profile qua Zalo",
    "description": "User hoi nguoi nay co hop khong -> bo loc relation -> danh gia 4 truc cong viec/tinh cam/hop tac/nhan su.",
    "category": "astrology",
    "source": "builtin",
    "trigger_type": "zalo_inbound",
    "tags": "zalo,astro,relation,profile,compatibility",
    "plan": "free",
    "trigger_config": {
      "instance_id": "",
      "filter": "hop|ho so|doi tac|cong viec|ket ban|nhan su"
    },
    "graph": {
      "meta": { "template": "tpl_astro_relation_profile_zalo_v1" },
      "nodes": [
        {
          "id": "t1",
          "type": "trigger",
          "data": { "blockId": "trigger.zalo_inbound", "label": "Zalo inbound relation" }
        },
        {
          "id": "n1",
          "type": "action",
          "data": {
            "blockId": "action.run_astro",
            "label": "Resolve subject",
            "query": "{{trigger.text}}",
            "compose": false
          }
        },
        {
          "id": "n2",
          "type": "action",
          "data": {
            "blockId": "action.run_astro_relation_assessment",
            "label": "Relation assessment",
            "subject_coachee_id": "{{n1.coachee_id}}",
            "partner_name": "",
            "query": "{{trigger.text}}",
            "source_marker": "zalobot_chat",
            "sync_days": 7,
            "start_offset": 1
          }
        },
        {
          "id": "chk",
          "type": "logic",
          "data": {
            "blockId": "logic.condition",
            "label": "Co ket qua?",
            "condition": "{{n2.ok}} == 1"
          }
        },
        {
          "id": "r_ok",
          "type": "action",
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Gui danh gia relation",
            "text": "{{n2.final_answer_md}}"
          }
        },
        {
          "id": "r_err",
          "type": "action",
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Huong dan khi thieu profile",
            "text": "{{n2.error_message}}"
          }
        }
      ],
      "edges": [
        { "id": "e1", "source": "t1", "target": "n1" },
        { "id": "e2", "source": "n1", "target": "n2" },
        { "id": "e3", "source": "n2", "target": "chk" },
        { "id": "e4", "source": "chk", "target": "r_ok", "sourceHandle": "true" },
        { "id": "e5", "source": "chk", "target": "r_err", "sourceHandle": "false" }
      ]
    }
  }
]
```

---

## 6. PHP skeleton (block)

```php
<?php
// [2026-07-08 Johnny Chu] PHASE-FAA2-TWINBRAIN REL-1 — new relation block
defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Action_Run_Astro_Relation_Assessment extends BizCity_Automation_Block_Base {

    public function id(): string   { return 'action.run_astro_relation_assessment'; }
    public function kind(): string { return 'action'; }

    public function execute( array $ctx, array $data ) {
        $query         = (string) $this->resolve( $data['query'] ?? '{{trigger.text}}', $ctx );
        $subject_id    = (int) $this->resolve( $data['subject_coachee_id'] ?? 0, $ctx );
        $partner_id    = (int) $this->resolve( $data['partner_coachee_id'] ?? 0, $ctx );
        $partner_name  = (string) $this->resolve( $data['partner_name'] ?? '', $ctx );
        $source_marker = (string) ( $data['source_marker'] ?? 'zalobot_chat' );
        $sync_days     = (int) ( $data['sync_days'] ?? 7 );
        $start_offset  = (int) ( $data['start_offset'] ?? 1 );

        if ( ! class_exists( 'BizCity_TwinBrain_Astro_Relation_Assessment_Service' ) ) {
            return array( 'ok' => 0, 'error_code' => 'relation_service_missing', 'error_message' => 'Service relation chua load.' );
        }

        $svc = BizCity_TwinBrain_Astro_Relation_Assessment_Service::instance();
        $res = $svc->assess_by_query( $query, array(
            'subject_coachee_id' => $subject_id,
            'partner_coachee_id' => $partner_id,
            'partner_name_hint'  => $partner_name,
            'source_marker'      => $source_marker,
            'sync_days'          => max(1, $sync_days),
            'start_offset'       => max(0, $start_offset),
            'surface'            => 'automation_zalobot',
        ) );

        if ( empty( $res['success'] ) ) {
            return array(
                'ok'            => 0,
                'error_code'    => (string) ( $res['_degraded'] ?? 'relation_failed' ),
                'error_message' => (string) ( $res['message'] ?? 'Khong danh gia duoc relation vi thieu du lieu.' ),
            );
        }

        return array(
            'ok'                  => 1,
            'subject_coachee_id'  => (int) ( $res['subject']['coachee_id'] ?? 0 ),
            'partner_coachee_id'  => (int) ( $res['partner']['coachee_id'] ?? 0 ),
            'subject_name'        => (string) ( $res['subject']['name'] ?? '' ),
            'partner_name'        => (string) ( $res['partner']['name'] ?? '' ),
            'subject_block_md'    => (string) ( $res['subject_block_md'] ?? '' ),
            'relation_block_md'   => (string) ( $res['relation_block_md'] ?? '' ),
            'final_answer_md'     => (string) ( $res['final_answer_md'] ?? '' ),
            'subject_natal_url'   => (string) ( $res['subject']['natal_url'] ?? '' ),
            'partner_natal_url'   => (string) ( $res['partner']['natal_url'] ?? '' ),
            'subject_transit_url' => (string) ( $res['subject']['transit_url'] ?? '' ),
            'partner_transit_url' => (string) ( $res['partner']['transit_url'] ?? '' ),
            'citations'           => wp_json_encode( (array) ( $res['citations'] ?? array() ) ),
            'source_marker'       => (string) ( $res['source_marker'] ?? $source_marker ),
            'sync_status'         => (string) ( $res['sync_status'] ?? 'ok' ),
        );
    }
}
```

---

## 7. File map can sua khi implement

1. `core/automation/includes/blocks/actions/class-action-run-astro-relation-assessment.php` (new)
2. `core/automation/includes/blocks/class-block-registry.php` (register block)
3. `core/automation/templates/astro-zalobot.json` (add relation template)
4. `core/automation/includes/class-automation-templates-seeder.php` (bump seed version)
5. `core/twinbrain/includes/class-twinbrain-web-astro.php` (classifier relation fields)
6. `core/twinbrain/includes/class-twinbrain-runtime.php` (relation mode pipeline)
7. `core/twinbrain/includes/class-twinbrain-astro-relation-assessment-service.php` (new)
8. `core/twinbrain/includes/class-twinbrain-astro-relation-composer.php` (new)

---

## 8. Test checklist

- [ ] Prompt relation trong TwinBrain tra `analysis_mode=relation_profile`
- [ ] Subject block dat ~20 dong
- [ ] Relation block dat 50-70 dong va du 4 lenses
- [ ] Transit sync cho subject + partner co status ok/partial ro rang
- [ ] Marker `source_marker=zalobot_chat` duoc persist vao metadata astro
- [ ] Citation token + public link xuat hien day du
- [ ] Workflow Zalo gui duoc 1 message unify khong can each-day loop
- [ ] Missing partner profile -> fail-open huong dan tao/chon profile

---

## 9. Anti-patterns

- Khong dung `action.run_astro_transit` each-day roi ep LLM gia relation.
- Khong bo qua source marker khi trigger tu Zalo.
- Khong de block relation compose theo prompt rieng khac TwinBrain.
- Khong tra ket luan relation ma thieu citation.
