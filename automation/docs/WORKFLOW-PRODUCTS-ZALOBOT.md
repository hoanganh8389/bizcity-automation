# Workflow Super-MRO — Zalo Bot

> Phase-ID: `PHASE-TWB-PRODUCTS`  
> Brand hiển thị: **Super-MRO**  
> Compatibility IDs: `products`, `action.run_products*`, `product_*` — giữ nguyên  
> Template slugs: `tpl_products_lookup_zalo_v1` · `tpl_products_need_solution_zalo_v1`  
> Canonical spec: [TwinBrain Super-MRO Vertical](../../twinbrain/docs/TWINBRAIN-EXT-VERTICAL-PRODUCTS.md)  
> Updated: 2026-07-16 · Johnny Chu

---

## 1. Mục tiêu

Đưa cùng một năng lực Super-MRO lên Zalo Bot qua Automation:

1. Tra vật tư, công cụ, SKU/model, giá và tồn kho.
2. Giải thích công dụng và compatibility.
3. Phân rã mục đích thi công/bảo trì thành vật tư chính, phụ kiện, dụng cụ,
   đo kiểm và PPE.
4. Lập danh mục/BOQ/BOM/bảng giá có citation.
5. Ưu tiên WooCommerce, sau đó `https://super-mro.com/` và nguồn kỹ thuật.
6. Bắt buộc có Source-of-Truth links block (internal Woo + public scoped links)
  để dùng chung cho TwinBrain/Twin GPT/Automation.

Automation chỉ là thin wrapper. TwinChat, Twin GPT (technical surface `twinweb`) và Zalo Bot đều gọi
`BizCity_TwinBrain_Product_Resolver_Service`; cấm fork prompt/resolver riêng.

---

## 2. Kiến trúc

```text
Zalo inbound
  → trigger.zalo_inbound
  → action.run_products | action.run_products_solution
  → BizCity_TwinBrain_Product_Resolver_Service
       → Super-MRO domain gate
       → strong OpenAI intent/decompose
       → WooCommerce price/stock/permalink
       → super-mro.com first-pass web enrichment
      → Source-of-Truth Link Layer (internal + public links + context)
       → BizCity_TwinBrain_Product_Composer
  → action.reply_zalo
```

| Surface | Entry | Shared result |
|---|---|---|
| TwinChat/Twin GPT | `web_mode=products` | detected/matched/gaps/citations + source_of_truth_links/source_block |
| Zalo Automation | `action.run_products*` | cùng contract, không SSE stream nhưng phải có source block |

---

## 3. Action blocks

### 3.1 Tra cứu Super-MRO

Internal ID: `action.run_products`

Dùng cho:

- “shop có bu lông M10 không?”
- “giá dây điện 2x2.5, còn hàng không?”
- “dây curoa B38 dùng cho máy nào?”

Input:

- `query`
- `intent_hint`: rỗng hoặc `product_lookup|stock_price|product_learn|need_solution`
- `want_enrichment`
- `max_results`
- `source_marker`

### 3.2 Lập phương án Super-MRO

Internal ID: `action.run_products_solution`

Dùng cho:

- “mình muốn lắp đèn trần”
- “cần vật tư đi điện cho căn phòng”
- “lập danh sách bảo trì motor”
- “lập BOQ sửa nhà”

Block ép `intent_hint=need_solution`, giới hạn tối đa 20 hạng mục và trả
`catalog_md`, `gaps_md`, `final_answer_md`.

### 3.3 Output contract

```php
array(
    'ok'                     => 1,
    'intent'                 => 'need_solution',
    'query'                  => 'mình muốn lắp đèn trần',
    'detected_count'         => 12,
    'detected_products_json' => '[...]',
    'need_count'             => 12,
    'matched_count'          => 7,
    'gap_count'              => 5,
    'catalog_md'             => '...',
    'gaps_md'                => '...',
    'source_of_truth_links_json' => '[...]',
    'source_block_md'        => '### Source of Truth ...',
    'internal_link_count'    => 3,
    'public_link_count'      => 2,
    'final_answer_md'        => '...',
    'citations_json'         => '["[prod:501]","[web:1#https://super-mro.com/...]"]',
    'degraded'               => '',
);
```

Matched Woo trong câu trả lời phải có citation clickable
`[prod:ID](permalink)`.

Mọi citation `[prod:*]` và `[web:*]` phải tồn tại trong
`source_of_truth_links_json` của run hiện tại.

---

## 4. Built-in templates

### `tpl_products_lookup_zalo_v1`

Tên hiển thị: **Super-MRO - Tra cứu giá/tồn kho qua Zalo**.

Trigger keywords tập trung vào `vật tư`, `công cụ`, `thiết bị`, `điện`, `đèn`,
`bu lông`, `VLXD`, `giá`, `tồn kho`.

### `tpl_products_need_solution_zalo_v1`

Tên hiển thị: **Super-MRO - Lập phương án vật tư theo mục đích**.

Trigger keywords gồm `muốn lắp`, `lắp đặt`, `xây`, `sửa`, `bảo trì`, `bảng giá`,
`BOQ`, `BOM`, `trọn bộ`.

Slugs không đổi để không làm mất liên kết của workflow đã seed/import.
Mọi thay đổi JSON phải bump `BizCity_Automation_Templates_Seeder::SEED_VERSION`.

---

## 5. Domain và source guard

In scope:

- MRO công nghiệp;
- điện/chiếu sáng/MEP;
- cơ khí/hàn/fastener;
- dụng cụ, đo kiểm, nâng hạ;
- facility maintenance và PPE;
- vật liệu xây dựng.

Out of scope:

- mỹ phẩm/skincare/nước hoa;
- thời trang/trang sức;
- thực phẩm/thuốc;
- hàng tiêu dùng không liên quan MRO.

Source order:

1. WooCommerce hiện tại — giá/tồn thật.
2. [Super MRO](https://super-mro.com/) — first-party MRO web priority.
3. Website hãng/datasheet.
4. Bộ Xây dựng/QCVN/TCVN/ISO/IEC/OSHA.
5. Catalog MRO quốc tế.

Source-of-Truth gate:

- Internal links = Woo permalink public.
- Public links = scoped search qua BizCity_Search_Client (Tavily via LLM Router Hub).
- Cấm citation ngoài danh sách link đã thu thập.

---

## 6. Error/degraded behavior

| Trạng thái | Hành vi |
|---|---|
| Query rỗng | `ok=0`, lỗi tham số rõ ràng |
| Query ngoài MRO | `ok=0`, hướng dẫn chọn mode khác |
| Woo inactive | vẫn web research, không bịa giá/tồn |
| Search gateway lỗi | trả Woo + degraded |
| LLM lỗi | deterministic work-package fallback |
| Không có permalink | citation ghi `no_link`, QA fail |

Cron/Automation failure phải ghi `note_event()` theo R-CRON-META; không swallow
exception hoặc chỉ `error_log()`.

---

## 7. QA

1. “nhà có bóng đèn ko?” → detect bóng/đèn, có match/citation nếu catalog có.
2. “nhà có bu lông ko?” → detect bu lông, thử aliases.
3. “mình muốn lắp đèn trần” → điện/chiếu sáng/phụ kiện/dụng cụ/PPE; không mỹ phẩm.
4. “mua mascara” → out-of-scope.
5. “lập bảng giá lắp 20 đèn” → BOQ preview; handoff sheet khi orchestrator bật.
6. TwinChat/Twin GPT/Zalo trả cùng detected list cho cùng query/options.
7. Web fallback tìm `super-mro.com` trước.
8. Planner không dùng Gemini Flash.
9. Output có `source_block_md` để UI/receiver render block expand/collapse.
10. Click citation mở đúng URL public trong source block.

---

## 8. Files

- `core/automation/includes/blocks/actions/class-action-run-products.php`
- `core/automation/includes/blocks/actions/class-action-run-products-solution.php`
- `core/automation/templates/products-zalobot.json`
- `core/automation/includes/class-automation-templates-seeder.php`
- `core/twinbrain/includes/class-twinbrain-product-resolver-service.php`
- `core/twinbrain/includes/class-twinbrain-product-composer.php`

*Super-MRO Automation/Zalo contract · 2026-07-15*
