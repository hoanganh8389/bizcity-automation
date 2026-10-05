# R-AUTO-MULTI-ATTACH — Canonical Multi-Attachment Contract

> Effective: 2026-07-21  
> Tier: Automation Canon  
> Owner: BizCity Automation / Twin GPT

Mọi flow automation nhận nhiều ảnh/file từ Zalo Bot, Facebook, Telegram, WebChat hoặc `/gpt/` PHẢI dùng contract `attachments[]` chung. Không tạo transient riêng, option riêng, hay field custom kiểu `image_1`, `image_2`, `photo_urls_custom`.

## 1. Pending State

Nguồn tạm thời duy nhất là `BizCity_Automation_Pending_State`, keyed theo canonical `chat_id` và alias Zalo Bot private/non-private.

```php
array(
    'intent'         => 'awaiting_media_purpose',
    'workflow_id'    => 0,
    'slots'          => array(),
    'attachment_url' => 'https://...', // legacy alias: latest image, kept for old templates
    'attachments'    => array(
        array(
            'kind'          => 'image',
            'url'           => 'https://zalo-cdn-or-wp-media/...',
            'source_url'    => 'https://zalo-cdn/...',
            'wp_url'        => 'https://site/uploads/...',
            'attachment_id' => 123,
            'message_id'    => 'provider-message-id',
            'received_at'   => 1784667205,
        ),
    ),
    'created_at'     => 1784667205,
)
```

Rules:
- Inbound media-only turns append via `append_attachment()`, never overwrite the prior image.
- Deduplicate by `message_id`; if absent, deduplicate by URL.
- Keep at most 14 attachments, matching Branch #06 image gateway reference-image ceiling.
- `attachment_url` remains a backwards-compatible alias only. New flows must read `attachments[]` or `attachment_urls[]`.

## 2. Consume To WP Media

`action.consume_attachment` is the canonical durable-media boundary. It sideloads each pending image to WP Media when `sideload_to_wp=true` and returns:

```php
array(
    'attachment_url'  => 'https://site/uploads/first.jpg',
    'attachment_urls' => array( 'https://site/uploads/first.jpg', 'https://site/uploads/second.jpg' ),
    'source_url'      => 'https://zalo-cdn/first.jpg',
    'source_urls'     => array( 'https://zalo-cdn/first.jpg', 'https://zalo-cdn/second.jpg' ),
    'attachment_id'   => 101,
    'attachment_ids'  => array( 101, 102 ),
    'attachments'     => array( /* normalized item list */ ),
    'found'           => true,
)
```

Downstream blocks should prefer `{{consume.attachment_urls}}` / `ctx.consume.attachment_urls`; keep `{{consume.attachment_url}}` only for legacy single-image templates.

## 3. Downstream Contracts

### Facebook Multi-Photo

`action.publish_fb_post` writes both fields into scheduler metadata:

```php
'fb_image_url'  => $first_url,
'fb_image_urls' => $all_urls,
```

`BizCity_FB_Publisher` publishes:
- 0 images: `/feed` text post.
- 1 image: `/photos` with caption, legacy behavior.
- 2+ images: upload each photo unpublished via `/photos?published=false`, then create `/feed` with `attached_media[]`.

### AI Image Edit / Thợ Ảnh

`action.edit_image` sends all resolved references to the gateway:

```php
'input_images' => $image_urls,
```

This supports prompts such as “tham chiếu ảnh 1 để làm ảnh 2 tương tự” or “ghép 3 ảnh thành 1 ảnh lookbook”. Provider-specific routing remains inside Branch #06 / `BizCity_LLM_Client`; FE must not call hub/provider directly.

### WordPress Multi-Image Post

`action.publish_wp_post` sideloads all image URLs:
- first image becomes the featured image;
- all images are attached to the post;
- if there are 2+ images and content has no gallery, append `[gallery ids="..."]`;
- scheduler metadata carries `web_image_url` and `web_image_urls`.

## 4. Template Authoring Rule

New templates must use this shape:

```json
{
  "id": "consume",
  "type": "action",
  "data": { "blockId": "action.consume_attachment", "sideload_to_wp": true }
},
{
  "id": "edit",
  "type": "action",
  "data": {
    "blockId": "action.edit_image",
    "image_urls": "{{consume.attachment_urls}}",
    "prompt": "{{trigger.text}}"
  }
}
```

Anti-patterns:
- Storing media in custom transients/options instead of `BizCity_Automation_Pending_State`.
- Passing only `attachment_url` in new multi-image capable templates.
- Creating one workflow branch per image index.
- Letting a provider block download/sideload images itself before `consume_attachment`.
- Sending Zalo CDN URLs directly to Graph when `consume_attachment` can create durable WP Media URLs first.
