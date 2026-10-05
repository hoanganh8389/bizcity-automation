# TRENDING RESEARCH · Prompt & Skills Template Library

> **Mục tiêu:** Bộ tài liệu học tập và reference prompt cho AI agent khi nghiên cứu xu hướng.
> **Gốc:** Phân tích pattern từ last30days-skill v3.8.1 + BizCity Platform adaptation.
> **Phiên bản:** 1.0 · 2026-06-24 · Tác giả: Johnny Chu
>
> **Liên quan:**
> - [PHASE-TRENDING-RESEARCH.md](../twinbrain/docs/PHASE-TRENDING-RESEARCH.md) — Technical spec
> - `core/twinbrain/_library/last30days-skill-main/` — Thư viện gốc (Python)
> - `core/automation/includes/blocks/actions/class-action-trending-research.php` — PHP implementation

---

## Phần 1 — GIÁO TRÌNH: 10 Nguyên Tắc Nghiên Cứu Xu Hướng

> Dựa trên last30days SKILL.md LAWs 1-10, adapted cho Vietnamese context và BizCity platform.

---

### NGUYÊN TẮC 1 · KHÔNG đặt block "Nguồn:" ở cuối bài

**Vấn đề:** Agent viết `## Nguồn:\n- [link1]\n- [link2]` ở cuối → user TikTok/Zalo không click.
**Giải pháp:** Inline citation ngay tại chỗ đề cập. Nguồn đi cùng claim.

```
❌ SAI:
Xu hướng video ngắn đang bùng nổ mạnh mẽ trong 2026.
...
## Nguồn:
- https://techcrunch.com/short-video-2026
- https://reuters.com/tiktok-growth

✅ ĐÚNG:
Theo [TechCrunch](https://techcrunch.com/short-video-2026), video ngắn dưới 60 giây
tăng 340% lượt xem so với năm ngoái. [Reuters](https://reuters.com/tiktok-growth)
xác nhận TikTok vượt 2 tỷ người dùng toàn cầu trong Q1 2026.
```

**Khi nào có thể list nguồn riêng?** Chỉ trong `sources_text` output variable — dành cho Zalo/SMS.

---

### NGUYÊN TẮC 2 · Mở bài: "Điều tôi tìm hiểu được:"

**Vấn đề:** Agent tự đặt tiêu đề sáng tạo như "📊 Báo Cáo Xu Hướng Tháng 6" →
không nhất quán, khó parse programmatically.
**Giải pháp:** Mọi trending report bắt đầu bằng đúng 5 từ này.

```
✅ Template mở bài:
Điều tôi tìm hiểu được: [1-2 câu insight nổi bật nhất].

Ví dụ:
Điều tôi tìm hiểu được: AI video generation đang chiếm lĩnh social media
Việt Nam, với 3 platform lớn cùng thử nghiệm tính năng tương tự trong tuần này.
```

**Tại sao quan trọng:** Phân biệt research result vs conversation reply. Automation workflow
có thể dùng string match để route content.

---

### NGUYÊN TẮC 3 · Bold lead-in cho mỗi paragraph

**Vấn đề:** Wall of text → user không scan được trên điện thoại.
**Giải pháp:** Mỗi paragraph có bold phrase đầu tiên (1-5 từ tóm tắt paragraph).

```
✅ Template paragraph:
**[Tóm tắt 1-5 từ].** [Nội dung paragraph chi tiết, 2-4 câu, inline citation.]

Ví dụ:
**Shorts vượt long-form.** YouTube Shorts đạt 70 tỷ lượt xem/ngày theo
[Bloomberg](https://bloomberg.com/youtube-shorts-growth), vượt cả long-form video
lần đầu tiên kể từ khi platform ra mắt. Creator tool mới cho phép chuyển đổi
2 chiều giữa Shorts và long-form trong 1 click.
```

---

### NGUYÊN TẮC 4 · KHÔNG dùng `## Section Headers` trong prose

**Vấn đề:** `## Xu hướng 1` `## Xu hướng 2` → format report → khó đọc trên chat.
**Giải pháp:** Prose flowing với bold lead-in. Headers chỉ cho tài liệu kỹ thuật, không cho trending report.

```
❌ SAI (report format):
## Xu hướng 1: AI Video
AI video đang bùng nổ...

## Xu hướng 2: Short-form
Short-form video...

✅ ĐÚNG (prose flow):
Điều tôi tìm hiểu được: AI video và short-form đang hội tụ thành 1 mega-trend.

**AI video vượt kỳ vọng.** Runway ML ghi nhận...

**Short-form là carrier signal.** TikTok và Reels...

KEY PATTERNS từ nghiên cứu:
1. AI video tools → short-form pipeline (3 ngày → 3 giờ)
2. Creator burnout → AI augmentation adoption tăng 2x
```

---

### NGUYÊN TẮC 5 · Footer signal là output var, không là bài viết

**Vấn đề:** Agent viết "Tìm kiếm từ: web, reddit, tiktok" trong body bài → làm loãng insight.
**Giải pháp:** Signal meta đi vào `sources_text` output variable riêng. Body chỉ chứa insight.

```
Output variables (tách bạch):
- answer_md     → body prose (Markdown, inline citations)
- sources_text  → "📡 Tìm từ: web, reddit (5 nguồn)" (Zalo plain text)
- key_patterns  → JSON array for structured processing
- top_sources   → [{url, title, score}] for UI rendering
```

---

### NGUYÊN TẮC 6 · Raw evidence KHÔNG dump ra user

**Vấn đề:** Agent paste URL list, JSON snippet, raw search results vào reply → spam.
**Giải pháp:** Evidence là context riêng tư của pipeline. User chỉ thấy synthesized insight.

```
Pipeline internal (KHÔNG emit):
EVIDENCE:
[1] "TikTok Creator Fund 2026" | url: tiktok.com/... | score: 0.82 | reddit_upvotes: 1340
[2] "Short video ad revenue..." | url: adweek.com/... | score: 0.71

User-facing output:
Điều tôi tìm hiểu được: TikTok Creator Fund thế hệ mới...
```

---

### NGUYÊN TẮC 7 · Agent TỰ lập kế hoạch trước khi search

**Vấn đề:** Gọi search ngay với topic thô → kết quả vague và trùng lặp.
**Giải pháp:** L0 Query Plan generation trước, phân tích entity + intent + subreddits + hashtags.

```
Input: "trending TikTok hôm nay"

L0 Query Plan (internal):
{
  "primary_entity": "TikTok",
  "intent": "trending",
  "temporal": "today",
  "search_queries": [
    "xu hướng TikTok hôm nay 2026",
    "TikTok viral trends today Vietnam",
    "TikTok algorithm update mới nhất"
  ],
  "reddit_subreddits": ["TikTok", "tiktokmarketing", "socialmedia"],
  "tiktok_hashtags": ["#TikTokTrending", "#XuHuong"],
  "scope": "1d"
}
```

---

### NGUYÊN TẮC 8 · Inline citation `[title](url)` là bắt buộc mỗi khi có claim

**Vấn đề:** "Theo nghiên cứu mới nhất..." (không link) → không verify được.
**Giải pháp:** Mọi claim có thể kiểm chứng PHẢI có inline link ngay sau đó.

```
Template chuẩn:
[claim X] theo [nguồn ngắn](url).
hoặc:
[nguồn ngắn](url): [claim X].

✅ Ví dụ đúng:
[Bloomberg](https://bloomberg.com/...) cho biết quảng cáo TikTok tăng 2.3x YoY.
Theo khảo sát [We Are Social](https://wearesocial.com/...), 67% người dùng VN
xem short-form video mỗi ngày.
```

---

### NGUYÊN TẮC 9 · Đan xen "tiếng nói cộng đồng" vào bài

**Vấn đề:** Báo cáo chỉ từ editorial sources → thiếu "pulse thật" từ user.
**Giải pháp:** Weave Reddit comment (top upvote) hoặc TikTok comment vào narrative.

```
✅ Pattern cộng đồng:
**Creator burnout là real.** Một thread [r/TikTok](https://reddit.com/r/tiktok/...)
với 2,340 upvotes mô tả áp lực post 3 lần/ngày. Top comment: *"I post every day and
still can't break 1K followers. Algorithm doesn't reward consistency anymore."*
Sentiment này xuất hiện ở 7/10 threads top-upvoted trong 48h qua.
```

---

### NGUYÊN TẮC 10 · First-party posts (high upvotes/views) = first-class signal

**Vấn đề:** Editorial blog post từ brand = PR, không phải organic trend signal.
**Giải pháp:** Scoring weighting: engagement (upvotes/views) = 40% weight.

```
Scoring formula:
final_score = 0.6 × relevance + 0.4 × (engagement / max_engagement_in_batch)

Signals:
- Reddit post: 2000 upvotes   → engagement = 1.0 (max)
- Web article: 0 upvotes      → engagement = 0.0
- TikTok hash: 5M views       → engagement_normalized (future W2)
```

---

## Phần 2 — PROMPT TEMPLATES (Copy-paste vào LLM Compose)

---

### P-001 · Daily Trending Research Prompt (Vi)

**Use case:** Cron 9h sáng → tổng hợp xu hướng hôm nay → Zalo/FB

```
BẠNLÀ: Chuyên gia phân tích xu hướng mạng xã hội Việt Nam.

EVIDENCE (top clusters từ multi-source search):
{evidence_block}

NHIỆM VỤ:
Viết báo cáo xu hướng ngắn, dễ đọc trên mobile. Đi thẳng vào insight.

QUY TẮC BẮT BUỘC (không được vi phạm):
1. Mở bài: "Điều tôi tìm hiểu được: [1-2 câu insight nổi bật nhất]."
2. Mỗi paragraph có bold lead-in (1-5 từ đầu, bold).
3. Mọi claim có thể kiểm chứng → inline link [title](url) ngay tại chỗ.
4. Đan xen comment cộng đồng nếu có (quote ngắn từ Reddit/TikTok).
5. Kết thúc bằng:
   KEY PATTERNS từ nghiên cứu:
   1. [pattern ngắn gọn]
   2. [pattern ngắn gọn]
   (3-5 patterns)
6. KHÔNG có block "## Nguồn:" ở cuối.
7. KHÔNG có "## Section Headers" phân đoạn.
8. KHÔNG sáng tạo thêm thông tin ngoài evidence.
9. Ngôn ngữ: tiếng Việt tự nhiên, không văn phòng.
10. Độ dài: 200-350 từ (đọc trong 2 phút).
```

---

### P-002 · Weekly Trend Analysis (Deeper, 7d scope)

**Use case:** Thứ 2 sáng → báo cáo tuần → email marketing + FB page

```
BẠNLÀ: Nhà phân tích digital marketing cấp cao, chuyên thị trường Việt Nam.

EVIDENCE (top 12 clusters, 7 ngày qua):
{evidence_block}

NHIỆM VỤ:
Viết phân tích xu hướng tuần, sâu hơn daily report, focus vào implication
cho digital marketer và content creator.

QUY TẮC:
1. Mở bài: "Điều tôi tìm hiểu được: [2-3 câu về big picture tuần này]."
2. Phân tích 4-6 xu hướng nổi bật, mỗi cái 3-4 câu có inline citation.
3. Mỗi xu hướng: bold lead-in + claim + citation + implication cho VN market.
4. Sau phần phân tích:
   KEY PATTERNS từ nghiên cứu:
   1. [pattern kỹ thuật ngắn]
   2. ...
   (5-7 patterns)
5. Không có Sources block cuối bài.
6. Không có ## headers.
7. Tiếng Việt chuyên nghiệp nhưng không văn phòng.
8. Độ dài: 400-600 từ (email-friendly).
```

---

### P-003 · Brand/Competitor Social Listening

**Use case:** Monitor đối thủ / brand mentions → daily alert

```
BẠNLÀ: Chuyên gia social listening và brand intelligence.

BRAND/COMPETITOR: {brand_name}
EVIDENCE:
{evidence_block}

NHIỆM VỤ:
Phân tích sentiment và chủ đề thảo luận về {brand_name} trong thời gian qua.

QUY TẮC:
1. Mở bài: "Điều tôi tìm hiểu được: [1-2 câu về sentiment chung và điều nổi bật nhất]."
2. Phân tích:
   - **Sentiment chung**: Tích cực / Trung tính / Tiêu cực + lý do cụ thể.
   - **Chủ đề thảo luận chính**: 3-5 chủ đề, có dẫn chứng từ evidence.
   - **Community voice**: Quote 1-2 comment/post thực tế từ evidence (nếu có).
   - **Cơ hội / Rủi ro**: 1-2 implication cho team marketing.
3. KEY PATTERNS:
   1. [pattern về brand perception]
   2. [pattern về user needs/complaints]
4. Không có Sources block. Inline citations bắt buộc.
5. Độ dài: 250-400 từ.
```

---

### P-004 · Topic Discovery (Research "có nên làm content về X không?")

**Use case:** User hỏi "tôi có nên làm content về [topic] không?"

```
BẠNLÀ: Strategist content cho creator và brand Việt Nam.

TOPIC: {topic}
EVIDENCE (search + reddit + tiktok):
{evidence_block}

NHIỆM VỤ:
Đánh giá tiềm năng content về topic này dựa trên signal thực tế.

QUY TẮC:
1. Mở bài: "Điều tôi tìm hiểu được: [1-2 câu về tiềm năng topic]."
2. Phân tích:
   - **Signal thực tế**: Engagement hiện tại của topic (upvotes, view counts nếu có).
   - **Góc độ chưa được khai thác**: 2-3 angle content người khác chưa làm hoặc làm kém.
   - **Target audience**: Ai đang tìm kiếm topic này (từ community discussions).
   - **Timing**: Trend đang lên / đỉnh / đi xuống?
3. KEY PATTERNS:
   1. [content angle tốt nhất]
   2. [audience insight]
   3. [timing signal]
4. Kết luận 1 câu: "Đây là cơ hội [tốt/trung bình/kém] vì [lý do]."
5. Không có Sources block. Inline citations khi claim.
6. Độ dài: 200-350 từ.
```

---

### P-005 · Key Patterns Only (compact mode)

**Use case:** Quick scan → Zalo notification ngắn / sidebar widget

```
BẠNLÀ: Analyst tóm tắt xu hướng trong danh sách ngắn gọn.

EVIDENCE:
{evidence_block}

NHIỆM VỤ:
Chỉ trả về KEY PATTERNS list. KHÔNG có prose dài. KHÔNG có introduction.

FORMAT BẮT BUỘC:
1. [Pattern tóm tắt trong 1 câu, bold keyword nếu quan trọng]
2. [Pattern...]
...
(Tối đa 7 patterns)

QUY TẮC:
- Mỗi pattern: 1 câu, ≤ 15 từ.
- Bắt đầu bằng noun phrase hoặc verb (không bắt đầu bằng "The" hay "Có thể").
- Thực tế từ evidence, không phán đoán thêm.
- Tiếng Việt.
```

---

## Phần 3 — QUERY PLAN TEMPLATES (L0 — Lập kế hoạch search)

---

### Q-001 · Social Media Trending

```json
{
  "primary_entity": "TikTok | Instagram | Facebook | YouTube",
  "intent": "trending",
  "temporal": "1d | 7d | 30d",
  "search_queries": [
    "xu hướng {platform} hôm nay {year}",
    "{platform} trending {country} tháng này",
    "{platform} viral content creator Việt Nam"
  ],
  "reddit_subreddits": ["{platform}", "{platform}marketing", "socialmedia", "contentcreation"],
  "tiktok_hashtags": ["#{platform}Trending", "#XuHuong", "#{platform}Vietnam"],
  "news_keywords": ["{platform} cập nhật thuật toán", "{platform} chính sách mới"]
}
```

---

### Q-002 · E-commerce / Business

```json
{
  "primary_entity": "{brand | category | product}",
  "intent": "market_research",
  "search_queries": [
    "{entity} xu hướng thị trường Việt Nam 2026",
    "{entity} người dùng tìm kiếm gì",
    "{entity} đối thủ cạnh tranh mới"
  ],
  "reddit_subreddits": ["ecommerce", "entrepreneur", "vietnam", "muaban"],
  "news_keywords": ["{entity} thị trường Việt Nam", "{entity} startup funding"]
}
```

---

### Q-003 · Health & Wellness

```json
{
  "primary_entity": "{health_topic}",
  "intent": "trending",
  "search_queries": [
    "{topic} xu hướng sức khỏe 2026",
    "{topic} nghiên cứu mới nhất",
    "{topic} người dùng nói gì"
  ],
  "reddit_subreddits": ["nutrition", "fitness", "HealthyFood", "diet", "medical"],
  "news_keywords": ["{topic} khoa học sức khỏe mới nhất"],
  "trust_boost": ["ncbi.nlm.nih.gov", "who.int", "webmd.com"]
}
```

---

### Q-004 · Technology & AI

```json
{
  "primary_entity": "{tech_topic | AI_model | tool}",
  "intent": "trending",
  "search_queries": [
    "{entity} review 2026",
    "{entity} so sánh alternatives",
    "{entity} use case thực tế"
  ],
  "reddit_subreddits": ["technology", "MachineLearning", "ChatGPT", "artificial", "programming"],
  "tiktok_hashtags": ["#{entity}", "#AI", "#TechTrending"],
  "news_keywords": ["{entity} release update mới"]
}
```

---

## Phần 4 — AUTOMATION WORKFLOW DESIGN GUIDE

---

### W-001 · Cấu trúc Workflow Trending cơ bản (5 nodes)

```
[TRIGGER: Cron / Keyword]
        ↓
[N1: action.trending_research]
  topic = {{trigger.text}}
  scope = 1d
  platforms = web,reddit,tiktok
        ↓
[N2: llm.compose] (optional — reformat for channel)
  prompt = "Rút gọn cho Zalo: {{n1.answer_md}}"
        ↓
[N3: action.reply_zalo / publish_fb_post / send_email]
  content = {{n2.content}}
        ↓
[N4: action.create_crm_event] (optional — log to CRM)
  title = "Trending: {{n1.scope}}"
  meta = {{n1.key_patterns}}
```

---

### W-002 · Multi-channel Distribution

```
[N1: action.trending_research]
   topic = "digital marketing Vietnam"
   scope = 7d
   output = full
          ↓               ↓                  ↓
[N2: Rút gọn Zalo]  [N3: FB Post]   [N4: Email report]
 llm.compose         llm.compose      action.send_email
 "≤150 từ"          "hook + 200 từ"  body = {{n1.answer_md}}
          ↓               ↓
 action.reply_zalo  action.publish_fb_post
```

---

### W-003 · Conditional Branch (if no results → notify differently)

```
[N1: action.trending_research]
        ↓
[CONDITION]: {{n1.ok}} == true
        ↓ YES                   ↓ NO
[N2: llm.compose]    [N2b: action.reply_zalo]
[N3: publish_fb]      text = "Hôm nay không tìm thấy xu hướng nổi bật. Thử lại sau nhé."
```

---

## Phần 5 — QUICK REFERENCE CARD

```
ACTION BLOCK:    action.trending_research
BLOCK ID:        action.trending_research
CLASS:           BizCity_Automation_Action_Trending_Research

KEY OUTPUTS:
  {{n_X.answer_md}}       → Báo cáo Markdown đầy đủ
  {{n_X.key_patterns}}    → JSON array KEY PATTERNS
  {{n_X.sources_text}}    → Plain text (Zalo-safe)
  {{n_X.top_sources}}     → JSON [{url,title,score}]
  {{n_X.ok}}              → bool (check trước khi dùng!)
  {{n_X.error}}           → error code nếu ok=false

FIELDS:
  topic     = "{{trigger.text}}" | "keyword cụ thể"
  scope     = "1d" | "7d" | "30d"
  platforms = "web,reddit,tiktok" | "web,reddit,tiktok,youtube,news"
  language  = "vi" | "en"
  output    = "full" | "compact" | "key_patterns_only"

VOICE CONTRACT (luôn đúng trong synthesis):
  ✅ Mở bài: "Điều tôi tìm hiểu được:"
  ✅ Bold lead-in mỗi paragraph
  ✅ Inline [title](url) citations
  ✅ KEY PATTERNS list ở cuối
  ✅ Community voice weaving (Reddit quotes)
  ❌ KHÔNG Sources block cuối
  ❌ KHÔNG ## Section Headers
  ❌ KHÔNG raw evidence dump
  ❌ KHÔNG invented claims
```

---

## Phần 6 — CHEAT SHEET: last30days Library Modules

| Python Module | Tương đương trong BizCity PHP | Chức năng |
|---|---|---|
| `lib/fetch.py` | `_fetch_web()`, `_fetch_reddit()` | HTTP fetch from platforms |
| `lib/score.py` | `_score_items()` | Engagement + relevance scoring |
| `lib/grounding.py` | `_entity_grounding_check()` | Head-token entity check |
| `lib/cluster.py` | `_cluster_merge()` | Jaccard dedup + merge |
| `lib/synthesize.py` | `_llm_synthesis()` | LLM report generation |
| `lib/quality_nudge.py` | `_fallback_synthesis()` | Degraded fallback |
| `SKILL.md §LAWs` | `get_synthesis_prompt()` | Voice contract definition |

> **Nguyên tắc kế thừa:** Mọi W2+ improvement (engagement API, real parallel fetch,
> community voice extraction) PHẢI tham chiếu module Python gốc trong library
> trước khi tự code.

---

_Hết tài liệu. Xem [PHASE-TRENDING-RESEARCH.md](../twinbrain/docs/PHASE-TRENDING-RESEARCH.md) cho technical spec._
