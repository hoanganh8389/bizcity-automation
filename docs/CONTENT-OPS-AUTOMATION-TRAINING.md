# Content Ops Automation Training

> Tài liệu đào tạo các kịch bản tự động hóa liên quan đến content, xu hướng, marketing và nhóm workflow đã gắn prefix `[content ops]`.
>
> Phạm vi: Automation Template Gallery trong BizCity Automation.  
> Cập nhật: 2026-07-21.

## 1. Mục Tiêu Đào Tạo

Sau buổi đào tạo, người dùng cần làm được 5 việc:

1. Tìm các template Content Ops bằng prefix `[content ops]` trong Template Gallery.
2. Phân biệt template chạy theo lịch `cron` và template ra lệnh trực tiếp từ Zalo `zalo_inbound`.
3. Import template về workflow riêng của site.
4. Cấu hình các node bắt buộc: Zalo Bot, Facebook Page, WordPress draft, Notebook/KG, ảnh AI.
5. Test đầu ra trước khi bật workflow chạy thật.

## 2. Danh Sách Kịch Bản

### 2.1. Đăng Content Hàng Ngày

| Template | Trigger | Mục đích |
|---|---|---|
| `[content ops] Web Research → Script Zalo (Cron 8h)` | 08:00 mỗi ngày | Tìm xu hướng web nhanh, tóm tắt thành script ngắn rồi gửi Zalo Bot. |
| `[content ops] Notebook → Bài FB hàng ngày (Cron 8h)` | 08:00 mỗi ngày | Lấy tri thức từ Notebook/Guru, soạn bài Facebook theo phong cách thương hiệu. |
| `[content ops] Notebook → Bài WP hàng ngày (Cron 9h, Draft)` | 09:00 mỗi ngày | Soạn bài blog từ Notebook và tạo bài WordPress dạng draft để duyệt. |
| `[content ops] Đăng FB hàng ngày 08:00 (Cron + LLM)` | 08:00 mỗi ngày | Tìm chủ đề từ KG, soạn caption Facebook buổi sáng và đăng page. |
| `[content ops] Đăng FB hàng ngày 09:00 (Cron + LLM)` | 09:00 mỗi ngày | Soạn bài Facebook giờ vàng, nhấn vào sản phẩm/dịch vụ và CTA. |
| `[content ops] Đăng FB hàng ngày 10:00 (Cron + LLM)` | 10:00 mỗi ngày | Soạn bài chia sẻ tips/kiến thức để tăng tương tác. |
| `[global] [content ops] Viết content đăng FB mỗi sáng (Cron 07:30)` | 07:30 mỗi ngày | Research nhanh xu hướng/ngữ cảnh hôm nay, viết caption Facebook và tự đăng lên Fanpage đã ghim trong Kênh của tôi. |
| `[global] [content ops] Video TikTok ngắn mỗi sáng (Cron 08:30)` | 08:30 mỗi ngày | Research trend TikTok/marketing, viết prompt video dọc 9:16 và submit Kling text-to-video, link trả về Zalo đã ghim. |

### 2.2. Content Có Ảnh AI

| Template | Trigger | Mục đích |
|---|---|---|
| `[content ops] Tạo Ảnh AI On-demand (@tạo ảnh)` | Zalo: `@tạo ảnh`, `@anh`, `@image`, `tạo ảnh`, `vẽ` | Tạo ảnh AI từ mô tả và gửi link ảnh qua Zalo. |
| `[content ops] Đăng FB On-demand + Ảnh Auto (@đăng fb)` | Zalo: `@đăng fb`, `@dangfb`, `đăng fb`, `post fb` | Soạn caption, tạo ảnh minh họa, đăng Facebook Page. |
| `[content ops] Đăng WP On-demand + Ảnh Auto (@đăng web)` | Zalo: `@đăng web`, `@dangweb`, `đăng web`, `viết bài` | Research web, soạn bài blog, tạo featured image, tạo WP draft. |
| `[content ops] Đăng FB Hàng Ngày 08:00 + Ảnh Auto (Cron)` | 08:00 mỗi ngày | Tự soạn caption FB, tạo ảnh minh họa, đăng page kèm ảnh. |
| `[content ops] Đăng WP Hàng Ngày 09:00 + Ảnh Auto (Cron, Draft)` | 09:00 mỗi ngày | Tìm xu hướng, viết bài blog, tạo ảnh featured, lưu draft WordPress. |
| `[global] Thợ ảnh · Gửi ảnh Zalo Bot → hỏi muốn sửa gì` | Zalo gửi ảnh | Lưu ảnh vào pending slot 60 phút, hỏi user muốn chỉnh gì. |
| `[global] Thợ ảnh · Sửa ảnh bằng Seedream 4.5 (@thợ ảnh / sửa ảnh)` | Zalo: `@thợ ảnh`, `sửa ảnh` | Lấy ảnh đã gửi, chỉnh bằng Seedream 4.5, lưu WP Media + WP draft track, gửi link ảnh đã sửa qua Zalo. |

### 2.3. Xu Hướng / News / Marketing Intelligence

| Template | Trigger | Mục đích |
|---|---|---|
| `[content ops] Xu Hướng + Link Đọc Thêm → Zalo (Cron 9h)` | 09:00 mỗi ngày | Tìm trend web/Reddit/TikTok, gửi phân tích và link đọc thêm qua Zalo. |
| `[content ops] Đọc Báo On-demand + Link → Zalo (@news)` | Zalo: `@news`, `@báo`, `@doc bao`, `@đọc báo`, `đọc báo` | Tìm tin theo chủ đề, tổng hợp nguồn và gửi link đọc thêm. |
| `[content ops] Xu Hướng Hàng Ngày → Zalo (4 tin)` | 09:00 mỗi ngày | Gửi 4 phần: nghiên cứu, nguồn, phân tích, kết luận. |
| `[content ops] Trending On-demand qua Zalo (@trending)` | Zalo: `@trending`, `@trend` | Người dùng hỏi trend bất kỳ, bot trả báo cáo compact và nguồn tham khảo. |
| `[content ops] Xu hướng hôm nay qua Zalo (từ khoá VN)` | Zalo chứa `xu hướng`, `trend hôm nay`, `hot nhất`, `@trending` | Bot tự bắt keyword tiếng Việt và trả 4 tin xu hướng. |
| `[content ops] Kịch bản Marketing Hàng Ngày 07:00 → Zalo` | 07:00 mỗi ngày | Deep research xu hướng marketing hôm nay rồi gợi ý kịch bản review sản phẩm, TikTok 30 giây, livestream, khuyến mại/khai trương có dẫn chứng/link. |
| `[content ops] Kịch bản Marketing On-demand qua Zalo` | Zalo chứa `Kịch bản`, `review sản phẩm`, `TikTok 30 giây`, `livestream`, `khuyến mại`, `khai trương` | Bot research theo yêu cầu rồi viết kịch bản marketing có nguồn và CTA. |

### 2.4. Ra Lệnh Zalo Vừa Tạo

| Template | Trigger | Mục đích |
|---|---|---|
| `[content ops] Ra lệnh Zalo: Đăng FB theo chủ đề` | Zalo: `đăng fb`, `dang fb`, `post fb`, `đăng facebook` | AI trích chủ đề, soạn caption, tạo ảnh, tạo WP draft KPI và đăng Facebook. |
| `[content ops] Ra lệnh Zalo: Đăng Web theo chủ đề` | Zalo: `đăng web`, `dang web`, `viết bài`, `post web` | AI viết bài blog, tạo ảnh featured, tạo WP draft và gửi link sửa/xem. |

## 3. Cách Chọn Template Nhanh

| Nhu cầu | Nên chọn |
|---|---|
| Đăng bài Facebook mỗi ngày | Template có `Đăng FB hàng ngày` hoặc `Daily FB`. |
| Đăng bài WordPress mỗi ngày | Template có `Bài WP`, `Đăng WP`, `Draft`. |
| Ra lệnh trực tiếp từ Zalo | Template có `On-demand`, `@đăng fb`, `@đăng web`, `Ra lệnh Zalo`. |
| Cần tạo ảnh AI kèm bài viết | Template có `Ảnh Auto`, `Tạo Ảnh AI`, `featured image`. |
| Cần sửa ảnh bằng AI từ Zalo Bot | Template có `[global] Thợ ảnh`, `Seedream`, `@thợ ảnh`, `sửa ảnh`. |
| Cần theo dõi xu hướng | Template có `Xu Hướng`, `Trending`, `Đọc Báo`, `News`. |
| Cần gửi báo cáo về Zalo mỗi sáng | Template `Xu Hướng Hàng Ngày`, `Web Research → Script Zalo`, `Xu Hướng + Link Đọc Thêm`. |
| Cần viết kịch bản marketing có dẫn chứng | Template có `Kịch bản Marketing`, tìm bằng từ khóa `[global] Kịch bản`. |
| Cần tạo video TikTok ngắn tự động | Template có `Video TikTok ngắn`, `short-video`, `Kling`. |
| Cần tự viết và đăng Facebook mỗi sáng | Template có `Viết content đăng FB mỗi sáng`. |

## 4. Quy Trình Dùng Trong Template Gallery

1. Vào BizCity Automation → Template Gallery hoặc Thư viện Templates.
2. Tìm từ khóa `[content ops]`.
3. Chọn template theo mục tiêu vận hành.
4. Import template về workflow.
5. Mở Workflow Builder để cấu hình node.
6. Chạy test bằng dữ liệu giả lập.
7. Chỉ bật workflow thật sau khi nội dung, kênh gửi và quyền đăng đều ổn.

## 5. Cấu Hình Các Node Quan Trọng

### 5.1. Zalo Bot

Áp dụng cho trigger `zalo_inbound` hoặc action `reply_zalo`.

| Trường | Cách điền |
|---|---|
| `instance_id` | Chọn Zalo Bot/kênh đã kết nối. |
| `override_chat_id` | Điền nếu muốn gửi về một nhóm/người nhận cố định. Bỏ trống nếu reply về inbound gốc. |
| `keywords` | Giữ mặc định hoặc thêm từ khóa phù hợp vận hành. |
| `mode` | `keyword_start` nếu lệnh ở đầu câu; `keyword_contains` nếu chỉ cần có từ khóa trong câu. |

Với user dùng qua Twin GPT `/gpt/`, cron template sẽ ưu tiên Zalo Bot và chat đã ghim trong **Kênh của tôi**. Chỉ cần sửa thủ công khi muốn gửi sang một bot/chat khác.

Tin nhắn test:

```text
đăng fb chủ đề khuyến mãi cuối tuần
đăng web cách chọn sản phẩm phù hợp
@trending ngành mỹ phẩm tuần này
@news thị trường bán lẻ Việt Nam
Kịch bản TikTok 30 giây về dầu ăn Sloboda
Review cho tôi sản phẩm dầu ăn Sloboda với Neptune, Simply trên thị trường
Kịch bản livestream về dầu ăn Sloboda
Kịch bản chương trình khuyến mại khai trương cho cửa hàng thực phẩm
```

### 5.1.1. Kịch Bản Marketing Có Dẫn Chứng

Template liên quan:

| Template | Link kịch bản |
|---|---|
| `[content ops] Kịch bản Marketing Hàng Ngày 07:00 → Zalo` | Template Gallery → tìm `[global] Kịch bản` → import `tpl_daily_marketing_script_7h_zalo_v1`. |
| `[content ops] Kịch bản Marketing On-demand qua Zalo` | Template Gallery → tìm `[global] Kịch bản` → import `tpl_zalo_marketing_script_keyword_v1`. |

Luồng chuẩn:

1. `action.trending_research` chạy trước để lấy xu hướng, dẫn chứng và link nguồn.
2. `action.generate_content` dùng research đó để viết kịch bản review, TikTok 30 giây, livestream hoặc chương trình khuyến mại/khai trương.
3. `action.reply_zalo` gửi kịch bản kèm `{{tr.sources_text}}` để người vận hành thấy nguồn liên quan.

Sau import qua `/gpt/`, hệ thống tự lấy Zalo Bot/chat đã ghim trong **Kênh của tôi**. Với admin hoặc workflow clone thủ công, kiểm tra lại node reply nếu muốn gửi vào nhóm cố định khác.

### 5.2. Facebook Page

Áp dụng cho action `publish_fb_post`.

| Trường | Cách điền |
|---|---|
| `fb_page_id` | ID Page Facebook được phép đăng. |
| `fb_page_name` | Tên Page để người vận hành dễ nhận ra. |
| `content` | Thường giữ placeholder `{{gen.content}}` hoặc `{{gen.output}}`. |
| `image_url` | Nếu template có ảnh AI, giữ `{{img.image_url}}`. |
| `mode` | `now` để đăng ngay, `scheduled` nếu muốn lập lịch. |
| `delay_min` | Số phút delay nếu dùng `scheduled`. |

Với user dùng qua Twin GPT `/gpt/`, nếu `fb_page_id` để trống thì workflow sẽ dùng Fanpage đã ghim trong **Kênh của tôi** và vẫn kiểm tra owner/page trước khi tạo lịch đăng.

Checklist trước khi bật:

1. Facebook Page đã kết nối.
2. Token/Page permission còn hợp lệ.
3. Nội dung test không bị lỗi font.
4. Link ảnh hợp lệ nếu bài có ảnh.
5. Kết quả trả về có `permalink` để gửi về Zalo.

### 5.3. WordPress Post

Áp dụng cho action `publish_wp_post`.

| Trường | Giá trị khuyến nghị |
|---|---|
| `status` | `draft` để duyệt trước. |
| `title` | Có thể dùng `{{trigger.text}}` hoặc title do AI tạo. |
| `content` | Giữ `{{gen.content}}`. |
| `image_url` | Giữ `{{img.image_url}}` nếu có featured image. |
| `tags` | Đặt tag phù hợp, ví dụ `ai-content,automation`. |
| `author_id` | Để `0` nếu dùng mặc định, hoặc chọn tác giả cụ thể nếu hệ thống yêu cầu. |

Sau khi test ổn định, mới cân nhắc đổi `status` thành `publish`.

### 5.4. Notebook / KG / Guru

- Notebook/KG là nguồn tri thức, không phải nơi lưu cấu hình workflow.
- Guru/character chỉ nên là ngữ cảnh/persona viết bài, không nên dùng làm trigger hay storage.
- Nếu `notebook_id = 0`, workflow có thể chạy theo cấu hình mặc định hoặc prompt tổng quát.

Nên demo 2 cách:

1. Chạy không notebook để thấy output tổng quát.
2. Gắn notebook sản phẩm/thương hiệu để thấy output đúng giọng brand hơn.

### 5.5. Tạo Ảnh AI

Áp dụng cho action `generate_image`.

| Trường | Cách dùng |
|---|---|
| `prompt` | Mô tả ảnh cần tạo. Có thể lấy từ `{{trigger.text}}` hoặc `{{gen.content}}`. |
| `model` | Giữ model mặc định của template nếu gateway hỗ trợ. |
| `size` | `1024x1024` cho social post, `1536x1024` cho blog featured image. |
| `sideload_to_wp` | Nên để `true` để lưu ảnh vào WP Media. |

Lưu ý: prompt nên yêu cầu `NO text` nếu không muốn ảnh bị sai chữ.

### 5.6. Thợ Ảnh Gemini 3 Pro

Áp dụng cho cặp template `[global] Thợ ảnh` và block `action.edit_image`.

Luồng chuẩn:

1. User gửi ảnh vào Zalo Bot.
2. Workflow capture lưu `{{trigger.media_url}}` vào pending slot 60 phút.
3. Bot hỏi user muốn chỉnh gì.
4. User nhắn `@thợ ảnh ...` hoặc `sửa ảnh ...`.
5. Workflow `consume_attachment` sideload ảnh gốc vào WP Media.
6. `action.edit_image` gọi `google/gemini-3-pro-image-preview` với `input_images[]`.
7. `publish_wp_post` tạo draft để lưu prompt, ảnh gốc, ảnh đã chỉnh khi resolve được owner; nếu không thì bỏ qua bước tracking.
8. `reply_zalo` gửi link ảnh đã sửa về đúng chat Zalo.

### 5.7. Chuẩn nhiều ảnh trong một lượt chat

Khi user gửi 2-3 ảnh liên tiếp trong cùng chat, Automation gom ảnh vào pending state `attachments[]` theo `chat_id` thay vì ghi đè `attachment_url`. Rule canonical nằm tại `RULE-AUTOMATION-MULTI-ATTACHMENT.md`.

Flow mới phải đi qua chuỗi chuẩn:

1. Inbound media append vào `BizCity_Automation_Pending_State::attachments[]`.
2. `action.consume_attachment` sideload toàn bộ ảnh sang WP Media.
3. Block sau đọc `{{consume.attachment_urls}}` hoặc `ctx.consume.attachment_urls`.
4. Facebook dùng `fb_image_urls[]` để đăng multi-photo.
5. Thợ ảnh dùng `input_images[]` để provider tham chiếu nhiều ảnh.
6. WordPress post dùng ảnh đầu làm featured image và attach/gallery toàn bộ ảnh.

Template mới không được tạo transient/option riêng cho `image_1`, `image_2`; `attachment_url` chỉ là alias legacy cho ảnh đầu/latest.

Ví dụ tin nhắn test:

```text
@thợ ảnh xoá người phía sau, làm sáng da tự nhiên, giữ nguyên khuôn mặt
sửa ảnh đổi nền thành studio trắng, tăng độ nét sản phẩm, không thêm chữ
@thợ ảnh cân màu như ảnh lookbook thời trang, giữ dáng người và quần áo
```

Checklist trước khi bật:

1. Import cả 2 template `[global] Thợ ảnh`: capture ảnh và edit ảnh.
2. Đảm bảo Zalo Bot inbound có payload `media_url` khi user gửi ảnh.
3. Giữ `sideload_to_wp=true` ở `consume_attachment` và `edit_image` để URL ảnh bền vững.
4. WP draft ở node `publish_wp_post` nên để `status=draft` để người vận hành xem lại prompt/ảnh.
5. Prompt nên nêu rõ phần cần giữ nguyên: khuôn mặt, chủ thể, bố cục, sản phẩm, màu thương hiệu.

## 6. Quy Trình Test Mẫu

### 6.1. Test Ra Lệnh Đăng Facebook

Template:

```text
[content ops] Ra lệnh Zalo: Đăng FB theo chủ đề
```

Tin nhắn test:

```text
đăng fb chủ đề ưu đãi combo chăm sóc khách hàng cuối tuần
```

Kết quả mong đợi:

1. Zalo nhận preview caption.
2. Hệ thống tạo ảnh AI.
3. Hệ thống tạo WP draft để tracking KPI Content Ops.
4. Facebook Page được đăng bài.
5. Zalo trả link Facebook permalink và link WP draft.

### 6.2. Test Ra Lệnh Đăng Web

Template:

```text
[content ops] Ra lệnh Zalo: Đăng Web theo chủ đề
```

Tin nhắn test:

```text
đăng web cách bảo trì thiết bị công nghiệp đúng cách
```

Kết quả mong đợi:

1. Zalo nhận preview bài viết.
2. Hệ thống tạo ảnh featured image.
3. WordPress tạo draft.
4. Zalo trả link sửa bài và link xem bài.

### 6.3. Test Trending On-demand

Template:

```text
[content ops] Trending On-demand qua Zalo (@trending)
```

Tin nhắn test:

```text
@trending xu hướng bán hàng B2B tại Việt Nam tháng này
```

Kết quả mong đợi:

1. Bot trả báo cáo compact.
2. Có số nguồn tham khảo.
3. Có tóm tắt để team marketing lấy làm insight.

### 6.4. Test Daily Cron

Template mẫu:

```text
[content ops] Đăng FB Hàng Ngày 08:00 + Ảnh Auto (Cron)
```

Cách test:

1. Import template.
2. Tạm thời đổi cron sang thời điểm gần hiện tại.
3. Cấu hình `fb_page_id`.
4. Chạy test/manual run nếu Workflow Builder hỗ trợ.
5. Kiểm tra bài đăng, ảnh và log.
6. Đổi lại giờ cron chính thức.

## 7. Checklist Trước Khi Go-live

- [ ] Template có prefix `[content ops]` và đúng mục đích.
- [ ] Workflow đã import thành công.
- [ ] Zalo Bot đã kết nối và bắt đúng từ khóa.
- [ ] Facebook Page đã cấu hình `fb_page_id` nếu có đăng FB.
- [ ] WordPress post đang để `draft` nếu cần duyệt.
- [ ] Notebook/KG/Guru đã gắn đúng nếu cần theo brand.
- [ ] Node tạo ảnh AI đã test có `image_url`.
- [ ] Zalo reply trả kết quả rõ ràng cho người vận hành.
- [ ] Đã test ít nhất 1 lần bằng dữ liệu giả lập.
- [ ] Đã có người chịu trách nhiệm duyệt nội dung trong giai đoạn đầu.

## 8. Lỗi Thường Gặp Và Cách Xử Lý

| Lỗi | Nguyên nhân hay gặp | Cách xử lý |
|---|---|---|
| Bot Zalo không phản hồi | Sai keyword, sai `instance_id`, trigger không match | Kiểm tra trigger node, keywords, mode. |
| Bài Facebook không đăng | Chưa điền `fb_page_id`, token hết hạn, Page không đủ quyền | Kết nối lại Page, điền đúng Page ID. |
| Bài WordPress không tạo | Sai author/status, thiếu quyền tạo post | Để `status=draft`, kiểm tra quyền user/plugin. |
| Ảnh AI không có URL | Gateway tạo ảnh fail hoặc sideload fail | Xem `img.error`, test template `Tạo Ảnh AI On-demand`. |
| Nội dung sai tone brand | Chưa gắn Notebook/Guru/KG đúng | Gắn notebook thương hiệu hoặc sửa prompt template. |
| Cron không chạy | Chưa bật workflow, cron chưa tới giờ, server cron chậm | Test manual run, kiểm tra scheduler/log. |
| Nội dung bị lỗi font | File template/dữ liệu đầu vào sai encoding | Đảm bảo JSON/CSV UTF-8 không BOM và test preview trước. |

## 9. Lộ Trình Đào Tạo Dễ Hiểu

1. Demo nhóm ra lệnh Zalo vì người học thấy kết quả ngay.
2. Demo tạo ảnh AI riêng để hiểu node `generate_image`.
3. Demo đăng Facebook có ảnh để thấy flow content marketing hoàn chỉnh.
4. Demo đăng WordPress draft để giải thích quy trình duyệt nội dung.
5. Demo trending/news để thấy automation có thể làm research marketing.
6. Demo cron hằng ngày để chuyển từ thao tác thủ công sang vận hành tự động.

## 10. Mapping File Template Kỹ Thuật

| File | Nhóm template |
|---|---|
| `core/automation/templates/daily-content.json` | Content hằng ngày từ web research, Notebook, FB/WP. |
| `core/automation/templates/daily-fb-post.json` | Lịch đăng Facebook 8h/9h/10h. |
| `core/automation/templates/content-with-image.json` | Tạo ảnh AI, đăng FB/WP kèm ảnh, news/trending có link. |
| `core/automation/templates/trending.json` | Xu hướng hằng ngày và on-demand qua Zalo. |
| `core/automation/templates/cmd-post.json` | Ra lệnh Zalo đăng FB/đăng Web theo chủ đề. |

## 11. Ghi Chú Vận Hành

- Không đổi `slug` của template đã seed vì có thể ảnh hưởng workflow đã import.
- Nếu chỉ đổi tên/hiển thị template, bump `SEED_VERSION` để gallery reseed.
- Khi sửa JSON template, luôn validate JSON parse trước khi ship.
- Khi template có tiếng Việt, lưu file UTF-8 đúng encoding, tránh mojibake và BOM.
- Khi go-live, ưu tiên `draft` cho WordPress và test với Page nội bộ trước khi đăng công khai.
