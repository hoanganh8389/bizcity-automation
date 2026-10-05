# Workflow @note / @thuky qua Zalo Bot

> **Status:** IN PROGRESS · N1/N2 foundation implemented; chưa claim production-ready  
> **Phase-ID:** `PHASE-TBR-NOTE-THUKY-ZALO`  
> **Scope:** Zalo Bot Zone 2 → TwinBrain Chat → Notebook/MPR → trả lời Zalo  
> **Owner:** TwinBrain + Automation + Channel Gateway  
> **Brand/runtime:** TwinBrain Chat; không tạo brain hoặc retrieval engine riêng

## 0. Quyết định cần chốt

Xây hai command có cùng một runtime canonical:

- `@note <câu hỏi hoặc yêu cầu>`: hỏi trực tiếp tri thức trong Notebook, tóm tắt,
  đối chiếu hoặc giải thích một vấn đề.
- `@thuky <mục tiêu hoặc vấn đề>`: giao cho TwinBrain đóng vai thư ký nghiên cứu,
  giữ Goal Loop xuyên các lượt, xác định việc còn thiếu, hỏi lại khi cần và trả
  bản tổng kết có nguồn.

Hai command chỉ khác **answer policy / vai trò trình bày**. Cả hai bắt buộc dùng:

```text
Zalo Bot inbound
  → command claim + canonical identity/session
  → Goal pre_turn / Answer Obligations / Scoreboard
  → Memory scope đúng goal_case
  → Notebook Selector
  → Perspective Runner
  → Tool Intent / KG graph-vector-rerank pack
  → Synthesizer
  → Draft / Reflection / Final Composer
  → Goal Delta / post_turn
  → Zalo reply + trace/evidence metadata
```

Không được tạo `action.ask_notebook`, prompt engine hoặc citation engine riêng cho
Zalo. TwinBrain là nơi quyết định goal, retrieval, notebook evidence, MPR timeline
và câu trả lời cuối.

## 1. Rà soát hiện trạng

### 1.1 Những gì đã có

| Contract | Anchor | Kết luận |
|---|---|---|
| Zalo Bot trigger | `trigger.zalo_inbound` | Có `instance_id`, `filter`, `guru_id`; thuộc Zone 2 |
| MPR bridge | `llm.mpr_think` + `BizCity_Automation_TwinBrain_Bridge` | Có cơ chế gọi TwinBrain và capture event |
| Zalo output | `action.reply_zalo` | Có owner/chat guard, gửi về canonical `chat_id` |
| Notebook evidence | TwinBrain Notebook Source Layer | Có source map, `final_context_chunks[]`, citations và source-file briefs |
| Timeline | `bizcity_twin_event` / MPR capture | Có event bus để ghi timeline; Zalo không hiển thị SSE trực tiếp |
| Goal Loop | `TWINBRAIN-0-CANON.md` §1.2 | Contract bắt buộc cho mọi channel dùng TwinBrain |
| Fallback Chat | `BizCity_Automation_Default_Reply` | Đã có đường gọi canonical với `complete => true`, channel identity và Goal fields |

### 1.2 Khoảng trống đã xác nhận

1. Trước implementation chưa có command active `@note` hoặc `@thuky`; hiện hai
  workflow đã được seed foundation và matcher có thể claim theo filter.
2. `llm.mpr_think` đã truyền `complete => true`, nhưng fixture/runtime production
  vẫn phải chứng minh `final_done` và `goal_delta/post_turn` trước reply.
3. `llm.mpr_think` đã expose context cho `session_id`, `surface`,
  `conversation_route`, `answer_depth`, `goal_case` và channel envelope; các
  field này là handoff metadata, TwinBrain vẫn là nơi validate/resolve contract.
4. Zalo là channel text; MPR event vẫn phải được capture/persist để audit, nhưng
   không nên gửi toàn bộ raw event hoặc private prompt ra từng tin nhắn Zalo.
5. `@note`/`@thuky` cần single-claim và priority rõ ràng để không chạy đồng thời
   với workflow capture note, workflow fallback hoặc generic default reply.

**Discriminating check:** khi implementation bắt đầu, một fixture `@note giá trị
của X là gì?` phải chứng minh có `goal_contract_ready`, `candidates_selected`,
`notebook_source_layer_ready`, `final_done` và `goal_delta/post_turn` trước khi
`action.reply_zalo` gửi tin cuối. Nếu thiếu `final_done`, workflow chưa phải full MPR.

## 2. Semantics của hai command

### 2.1 `@note`

Dùng khi người dùng muốn một câu trả lời Notebook trực tiếp:

```text
@note tóm tắt chính sách đổi trả trong Notebook
@note các nguồn đang nói gì khác nhau về sản phẩm X?
@note giải thích vấn đề này và dẫn nguồn passage
```

Answer policy:

- ưu tiên câu trả lời trực tiếp, có kết luận ngắn trước;
- dùng `final_context_chunks[]` làm factual context chính;
- mọi claim lấy từ Notebook phải có citation `[nb:X/pY]` hợp lệ;
- nếu có nhiều file, thêm bảng “Nguồn đã dùng” theo Notebook và source file;
- nếu evidence yếu, nói rõ thiếu dữ liệu và đưa `next_best_action`, không bịa.

### 2.2 `@thuky`

Dùng khi người dùng giao một mục tiêu nghiên cứu hoặc muốn theo dõi việc còn mở:

```text
@thuky tổng kết toàn bộ vấn đề tồn đọng trong Notebook tuần này
@thuky đối chiếu hai tài liệu và cho tôi kết luận cần làm gì tiếp
@thuky trả lời câu hỏi này, nếu thiếu dữ liệu hãy hỏi lại từng bước
```

Answer policy:

- mở hoặc resume một Goal theo canonical Zalo identity/session;
- tách `conversation_goal`, `answer_obligations`, `open_loops`, `blockers` và
  `next_best_action`;
- khi thiếu input quan trọng, hỏi tối đa số câu cần thiết thay vì kết luận giả;
- báo rõ phần nào là Notebook evidence, phần nào là suy luận;
- giữ `goal_id`, scoreboard version, trace và evidence để lượt sau tiếp tục;
- chỉ đóng goal khi DoD đạt và có closure signal hợp lệ.

`@thuky` là vai trò trình bày của TwinBrain, không phải một user/admin identity
mới và không được đọc private memory của người khác.

## 3. Identity, session và scope

Mỗi tin Zalo Bot phải giữ đủ envelope:

```json
{
  "platform": "ZALO_BOT",
  "channel": "zalo_bot",
  "account_id": "<bot_id>",
  "external_user_id": "<zalo_user_id>",
  "chat_id": "zalobot_<bot_id>_<zalo_user_id>",
  "wp_user_id": 25,
  "chat_kind": "private",
  "surface": "zalobot",
  "command": "note",
  "command_text": "tóm tắt chính sách đổi trả",
  "goal_case": "notebook_question"
}
```

Bắt buộc:

- `chat_id` canonical được resolve từ bot + user, không dùng group `chat_id` làm
  personal identity;
- owner phải là linked `wp_user_id`; thiếu mapping thì fail closed hoặc hỏi bind,
  không fallback admin/user khác;
- `session_id` phải ổn định theo Zalo identity và được truyền xuyên suốt TwinBrain;
- Notebook/Guru là context được phép dùng, không phải owner của Goal;
- group chat chỉ bật sau khi có policy Notebook shared rõ ràng; mặc định không
  inject private memory, private goal hoặc private Notebook của một thành viên;
- mọi output/trace phải được dimension theo blog/site và identity/session.

## 4. Workflow graph đề xuất

Tạo hai template riêng để matcher giữ semantics và priority dễ audit. Không dùng
một filter chung `@` vì sẽ làm mất single-claim và khó phân biệt role.

### 4.1 `tpl_zalo_note_notebook_v1`

```text
trigger.zalo_inbound
  filter: @note
  priority: 16
  visibility: private
      │
      ▼
llm.mpr_think / canonical TwinBrain Notebook Chat
  command: note
  answer_depth: deep khi câu hỏi cần tổng hợp, balanced mặc định
  k: 8
      │
      ├── action.reply_zalo
      │     text: {{brain.answer_md}} + source summary compact
      │
      └── action.create_crm_event
            kind: notebook_query
            lưu goal_id / trace_id / source counters / degraded reason
```

### 4.2 `tpl_zalo_thuky_notebook_v1`

```text
trigger.zalo_inbound
  filter: @thuky
  priority: 17
  visibility: private
      │
      ▼
llm.mpr_think / canonical TwinBrain Notebook Chat
  command: thuky
  answer_depth: high hoặc deep theo Goal Contract
  k: 8
      │
      ├── action.reply_zalo
      │     text: {{brain.answer_md}} + next best action / open loop compact
      │
      └── action.create_crm_event
            kind: notebook_secretary_turn
            lưu goal_id / scoreboard / trace_id / source counters
```

`@thuky` có priority cao hơn `@note` chỉ để làm rõ policy nếu sau này alias hoặc
filter mở rộng bị trùng. Hai template vẫn phải đi qua
`RULE-TRIGGER-SINGLE-CLAIM` và `RULE-INBOUND-DISPATCH-PRIORITY`.

### 4.3 Prompt handoff tối thiểu

Workflow chỉ nên truyền directive có cấu trúc; không nhúng toàn bộ logic MPR vào
text template:

```json
{
  "command": "note",
  "user_prompt": "{{trigger.command_text}}",
  "surface": "zalobot",
  "channel": "zalo_bot",
  "goal_case": "notebook_question",
  "notebook_policy": "askbrain_parity",
  "answer_depth": "balanced",
  "session_id": "{{trigger.session_id}}"
}
```

Với `@thuky`, đổi `command` thành `thuky`, `answer_depth` thành `high`, và thêm
`secretary_policy=goal_loop_next_action`. Backend phải validate các field này;
không tin giá trị do client/browser gửi.

## 5. Full MPR + Goal Loop contract

### 5.1 Outer Goal Contract

Mỗi turn phải đi theo thứ tự canon:

1. Goal `pre_turn`: resume/mở Goal và resolve subject/session.
2. Parse Conversation Goal và tạo `answer_obligations`.
3. Freeze scoreboard version `vN`.
4. Memory Recall theo `goal_case` và identity scope.
5. Notebook/MPR retrieval.
6. Draft Composer.
7. Reflection chấm `PASS`, `PATCH` hoặc `RETRIEVE`.
8. Nếu `RETRIEVE`, quay lại Notebook/MPR trong loop có giới hạn.
9. Final Composer tạo `answer_md` sau khi obligation bắt buộc đạt.
10. Goal Delta / `post_turn` cập nhật progress, gap, next action và closure.

Tài liệu và template không được tự tạo `goal_id`, tự sửa scoreboard hoặc tự đánh
một câu trả lời là `completed`. Những việc này thuộc TwinBrain Goal Loop.

### 5.2 Notebook layer bắt buộc

Khi command có nội dung hỏi Notebook, timeline phải có evidence tương ứng:

| Layer/event | Ý nghĩa cho Zalo |
|---|---|
| `subject_profile_resolving` / `subject_profile_resolved` | xác định user/subject đúng |
| `goal_contract_ready` | goal + obligations + scoreboard đã freeze |
| `memory_recall` | context đúng goal case, không đọc chéo |
| `candidates_selected` | Notebook candidates và lý do chọn |
| `brain_perspective_answer` / `perspective_done` | evidence theo Notebook |
| `notebook_source_layer_ready` | source map, source-file briefs, search context |
| `graph_vector_rerank_pack` / `rerank_done` | candidate top30 → final chunks top5-8 |
| `synth_done` | consensus, tensions, recommendation |
| `draft_done` / `reflection_done` | draft và resolution scoreboard |
| `final_done` | câu trả lời được phép gửi |
| `goal_delta` / `post_turn` | tiến độ và next best action |

Các event trên phải đi qua Event Bus/capture hiện hữu. Zalo chỉ nhận bản rút gọn,
ví dụ:

```text
Đã xử lý Notebook: 3 nguồn, 8 đoạn evidence, 2 điểm cần đối chiếu.
Trace: TBR_...

[Kết luận]
...

[Nguồn]
- Notebook A · 3 đoạn · [nb:30/p40712]
- Notebook B · 2 đoạn · [nb:44/p512]

[Việc tiếp theo]
Bổ sung bảng giá theo định lượng để chốt phần còn thiếu.
```

Không gửi raw `retrieval_candidates`, signed URL, full extracted text, private
prompt hoặc exception trace ra Zalo.

### 5.3 W0.20 evidence rule

Final Composer phải đọc `final_context_chunks[]` trước các payload hỗ trợ. Không
được đưa `search_context_results[]`, title file hoặc source map compact lên làm
nguồn factual chính khi `final_context_chunks[]` có dữ liệu. Vector/rerank lỗi phải
fail-open về local hybrid scoring và gắn degraded state.

## 6. Output contract của node TwinBrain

Node bridge/action nên trả một envelope thống nhất để `reply_zalo` và audit dùng:

```json
{
  "ok": true,
  "answer_md": "...",
  "command": "note",
  "trace_id": "TBR_...",
  "goal_id": "goal_...",
  "goal_status": "executing",
  "answer_obligations": [],
  "resolution_scoreboard": {},
  "next_best_action": "...",
  "notebook_source_map": [],
  "notebook_source_block_md": "...",
  "graph_vector_rerank_pack": {},
  "citations": ["[nb:30/p40712]"],
  "events": [],
  "layers_count": 0,
  "degraded": false,
  "reason_bucket": ""
}
```

Rules:

- `citations` chỉ chứa token đã được resolver xác minh trong source map hiện tại;
- citation thiếu Notebook/passage hợp lệ không được render như evidence;
- `layers_count` là số event đã capture, không tự gán đủ 9/12 layer;
- `degraded=true` phải có reason bucket và câu hướng dẫn hành động;
- `answer_md` rỗng hoặc missing Final Composer là lỗi, không gửi tin thành công.

## 7. Error và fail-closed matrix

| Tình trạng | Hành vi |
|---|---|
| Không có linked `wp_user_id` | Không đọc private Notebook; trả hướng dẫn bind Zalo rõ ràng |
| Group chat | Không dùng private goal/memory; chỉ xử lý shared policy nếu được bật |
| Không có Notebook/evidence | Nói rõ `kg_empty`/`retrieval_error`, hỏi user chọn Notebook hoặc bổ sung nguồn |
| Goal mơ hồ | Hỏi lại, giữ Goal `clarifying`, không giả kết luận |
| Reflection có `RETRIEVE` | Retrieve thêm trong giới hạn loop; quá giới hạn trả gap + next action |
| Gateway/LLM timeout | Trả degraded payload, không retry loop; giữ goal ở trạng thái resumable |
| Citation invalid | Strip token, ghi audit, không gửi citation giả |
| `complete_turn` không chạy | Không claim full MPR; workflow phải fail trước final reply |
| Reply target không thuộc owner | `action.reply_zalo` từ chối gửi |

Mọi lỗi user-visible phải map về R-ERROR-UX (`code`, `message`, `hint`,
`help_code`). Không trả raw SQL, stack trace, token hay đường dẫn file.

## 8. Rollout plan

### N0 — Tài liệu và contract

- [x] Ghi nhận hiện trạng và khoảng trống `@note`/`@thuky`.
- [x] Chốt một TwinBrain canonical path, không fork Notebook engine.
- [x] Chốt identity/session, Goal Loop, MPR event và output contract.

### N1 — Command claim

- [x] Bổ sung directive handling tạo `command` từ node config hoặc `@note/@thuky`
  prefix, strip command trước khi vào TwinBrain prompt.
- [x] Đăng ký hai template với UUID/version ổn định; bump `SEED_VERSION` và catalog.
- [x] Khai báo `exclusive`, priority và native filter để matcher single-claim;
  production fixture vẫn còn cần chạy.

### N2 — Full runtime bridge

- [x] Mở rộng bridge/node để truyền canonical session, channel envelope,
  `surface=zalobot`, `goal_case` và `answer_depth`.
- [x] Gọi completion path tương đương Default Reply (`complete => true`) trước
  `action.reply_zalo`.
- [ ] Chứng minh `goal_contract_ready` và `final_done` cùng một trace.

### N3 — Answer/evidence adapter

- [ ] Chuẩn hóa source block/citation compact cho Zalo.
- [ ] Giữ raw event trong Event Bus/automation trace, chỉ gửi summary an toàn.
- [ ] Thêm các bucket degraded và R-ERROR-UX payload.

### N4 — DDV và production gate

- [ ] Probe command claim không fan-out.
- [ ] Probe full Goal Loop + MPR + Notebook source layer trên fixture có dữ liệu.
- [ ] Probe citation resolver và invalid citation stripping.
- [ ] Probe owner/group isolation và reply đúng `zalobot_<bot>_<user>`.
- [ ] QA reload/resume `@thuky` với cùng session và Goal đang mở.

## 9. QA acceptance

| Case | Kỳ vọng bắt buộc |
|---|---|
| `@note tóm tắt Notebook X` | chọn đúng Notebook, có source map/citation, final answer gửi Zalo |
| `@note đối chiếu A và B` | có consensus/tension và citation từ cả hai phía |
| `@thuky tổng kết vấn đề còn tồn đọng` | có Goal, obligations, open loops, next best action |
| `@thuky` thiếu dữ liệu | hỏi lại, không đánh dấu completed |
| Hai tin liên tiếp cùng chat | resume cùng session/Goal, không tạo goal chéo |
| Zalo group | không đọc private goal/memory thành viên |
| Không có evidence | degraded rõ ràng, không citation giả |
| Vector/rerank unavailable | local fallback, evidence state ghi degraded |
| `@note` trùng workflow capture | single winner, không double reply |
| user chưa link | fail closed với hướng dẫn bind |

**Definition of Done:** chỉ đánh dấu workflow đã ship khi N1-N4 có evidence Disk /
Loader / Runtime và fixture Zalo chứng minh `final_done` + `goal_delta` xuất hiện
trước tin trả lời cuối. Việc tạo file tài liệu này không đồng nghĩa hai command đã
hoạt động trên production.

## 10. Tài liệu liên quan

- [TWINBRAIN-0-CANON.md](../../twinbrain/docs/TWINBRAIN-0-CANON.md)
- [TWINBRAIN-TWIN-GOAL-LOOP.md](../../twinbrain/docs/TWINBRAIN-TWIN-GOAL-LOOP.md)
- [TWINBRAIN-EXT-VERTICAL-NOTEBOOK-MOAT.md](../../twinbrain/docs/TWINBRAIN-EXT-VERTICAL-NOTEBOOK-MOAT.md)
- [TWINBRAIN-EXT-VERTICAL-CHAT-DEFAULT-ROADMAP.md](../../twinbrain/docs/TWINBRAIN-EXT-VERTICAL-CHAT-DEFAULT-ROADMAP.md)
- [AUTOMATION-0-CANON.md](AUTOMATION-0-CANON.md)
- [AUTOMATION-USER-GUIDE.md](AUTOMATION-USER-GUIDE.md)
- [RULE-INBOUND-DISPATCH-PRIORITY.md](RULE-INBOUND-DISPATCH-PRIORITY.md)
- [RULE-TRIGGER-SINGLE-CLAIM.md](RULE-TRIGGER-SINGLE-CLAIM.md)
- [WORKFLOW-PRODUCTS-ZALOBOT.md](WORKFLOW-PRODUCTS-ZALOBOT.md)
