# Workflow: Xem Vận Hạn Chiêm Tinh — Zalo Bot

> **Phase-ID:** PHASE-ASTRO-WORKFLOW  
> **Tạo ngày:** 2026-07-03 · **Tác giả:** Johnny Chu  
> **Template slugs:** `tpl_astro_van_han_zalo_v1` · `tpl_astro_transit_range_zalo_v1`  
> **Trigger:** `trigger.zalo_inbound` (Zalo Bot nhận tin nhắn từ user)

---

## 1. Tổng quan flow

```
User gửi Zalo: "vận hạn ngày mai" / "xem transit tuần này" / "sự nghiệp tháng 8"
         │
         ▼
[T1] trigger.zalo_inbound  ─────────────────────────────────────────────
         │  ctx.trigger: { chat_id, text, user_id, account_id, platform }
         ▼
[N1] action.run_astro          ← Resolve chủ thể + lấy natal chart
         │  Outputs: has_chart, coachee_id, coachee_name, period,
         │           natal_url, transit_url, passages (natal + transit)
         ▼
[N2] logic.condition           ← has_chart = false → branch "no_chart"
     ├── TRUE (has_chart)  → [N3] và tiếp tục
     └── FALSE             → [ERR] reply_zalo "Chưa có bản đồ sao…"
         ▼
[N3] llm.compose_reply         ← LLM tóm tắt nhân vật theo natal chart
         │  Inputs: natal passages, coachee_name, prompt template
         │  Output: n3.output  (tổng quan natal: tính cách, điểm mạnh/yếu)
         ▼
[R1] action.reply_zalo         ← Reply 1: Tổng quan chủ thể
         │  Text: "🌟 Bản đồ sao {{n1.coachee_name}}…\n{{n3.output}}"
         ▼
[N4] action.run_astro_transit  ← NEW BLOCK (xem §4) — lấy transit day-by-day
         │  Inputs: coachee_id, range hoặc period, outer_only
         │  Output: n4.transit_text  (bảng transit: ngày · hành tinh · aspect · ℞)
         │          n4.transit_url   (/my-transit/ public link)
         │          n4.period_label  ("ngày mai", "tuần tới", v.v.)
         ▼
[R2] action.reply_zalo         ← Reply 2: Thời gian + transit chart link
         │  Text: "📅 {{n4.period_label}} — Lịch chuyển động sao:\n{{n4.transit_text}}\n\n🔗 Xem chi tiết: {{n4.transit_url}}"
         ▼
[N5] llm.compose_reply         ← LLM luận giải sâu theo chủ đề topic
         │  Inputs: natal passages + transit data + topic_prompt (topic parse từ query)
         │  System: "Chuyên gia chiêm tinh. Dựa natal + transit, phân tích:
         │           Sự nghiệp · Tài chính · Tình duyên · Đối tác · Sức khỏe · Tổng vận."
         │  Output: n5.output
         ▼
[R3] action.reply_zalo         ← Reply 3: Luận giải chi tiết
         │  Text: "🔮 Phân tích {{n4.period_label}}:\n{{n5.output}}"
         ▼
     END
```

---

## 2. Block hiện có (dùng ngay)

| Block ID | Loại | Dùng cho node |
|---|---|---|
| `trigger.zalo_inbound` | trigger | T1 |
| `action.run_astro` | action | N1 — resolve chủ thể + passages |
| `logic.condition` | logic | N2 — branch has_chart |
| `llm.compose_reply` | llm | N3, N5 — tổng quan natal + luận giải transit |
| `action.reply_zalo` | action | R1, R2, R3, ERR |

---

## 3. Block cần tạo mới — `action.run_astro_transit`

### 3.1 Mục đích

Block chuyên biệt cho transit day-by-day:
- Lấy transit **theo range** (ngày mai, 3 ngày, tuần tới, 20 ngày, tháng tới) hoặc **period** (day/week/month/year)
- Tự động build bảng text Zalo-friendly (tên ngày · hành tinh · aspect · ℞)
- Build `/my-transit/` public share URL
- Không cần FAA API call nếu có cache trong `bccm_transit_snapshots`

### 3.2 Spec block

**Block ID:** `action.run_astro_transit`  
**File:** `core/automation/includes/blocks/actions/class-action-run-astro-transit.php`

```php
/**
 * Output vars:
 *   {{n_X.ok}}            — bool
 *   {{n_X.coachee_id}}    — int
 *   {{n_X.period_label}}  — "ngày mai", "tuần tới (7 ngày)"
 *   {{n_X.range_start}}   — YYYY-MM-DD
 *   {{n_X.range_end}}     — YYYY-MM-DD
 *   {{n_X.days_count}}    — số ngày
 *   {{n_X.transit_text}}  — Bảng transit Zalo-friendly (UTF-8, ≤800 ký tự)
 *   {{n_X.transit_url}}   — /my-transit/?id=X&hash=Y&period=Z public URL
 *   {{n_X.natal_url}}     — /my-natal-chart/?id=X&hash=Y
 *   {{n_X.retrograde_planets}} — "Mercury ℞, Saturn ℞" hoặc ""
 *   {{n_X.key_aspects}}   — Top 3 aspect tight nhất, tiếng Việt
 *   {{n_X.passages_md}}   — full markdown cho LLM (không gửi Zalo, dùng cho N5)
 *
 * Fields:
 *   coachee_id   — int hoặc {{n1.coachee_id}}
 *   chat_id      — {{trigger.chat_id}} (để build transit URL với ?chat_id param)
 *   period       — day|week|month|year|3day|10day|20day hoặc {{n1.period}}
 *   start_date   — "" (auto = tomorrow) hoặc YYYY-MM-DD hoặc "{{n_X.date}}"
 *   outer_only   — true (chỉ outer planets: Jupiter→Pluto+Chiron) / false (all)
 *   format       — "short" (Zalo, ≤800c) / "full" (markdown cho LLM)
 */
```

### 3.3 PHP implementation skeleton

```php
<?php
// [2026-07-03 Johnny Chu] PHASE-ASTRO-WORKFLOW — new block
defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Action_Run_Astro_Transit extends BizCity_Automation_Block_Base {

    public function id(): string   { return 'action.run_astro_transit'; }
    public function kind(): string { return 'action'; }

    public function execute( array $ctx, array $data ) {
        $coachee_id  = (int) $this->resolve( $data['coachee_id'] ?? 0, $ctx );
        $chat_id     = (string) $this->resolve( $data['chat_id'] ?? '{{trigger.chat_id}}', $ctx );
        $period      = (string) $this->resolve( $data['period'] ?? 'day', $ctx );
        $start_date  = (string) $this->resolve( $data['start_date'] ?? '', $ctx );
        $outer_only  = ! empty( $data['outer_only'] );
        $format      = (string) ( $data['format'] ?? 'short' );

        if ( $coachee_id <= 0 ) {
            return array( 'ok' => false, 'error' => 'coachee_id empty' );
        }

        // 1. Build date range từ period
        $range = $this->build_range( $period, $start_date );

        // 2. Load natal planets từ DB
        $natal_planets = $this->load_natal_planets( $coachee_id );
        if ( empty( $natal_planets ) ) {
            return array( 'ok' => false, 'error' => 'no_natal_data' );
        }

        // 3. Load transit snapshots từ cache hoặc call FAA2
        $snapshots = $this->load_transit_snapshots( $coachee_id, $range );

        // 4. Build text output
        $transit_text = $this->build_transit_text( $snapshots, $range, $format );
        $retro_str    = $this->extract_retrograde_summary( $snapshots );
        $key_aspects  = $this->extract_key_aspects( $snapshots );
        $passages_md  = $this->build_passages_md( $snapshots, $natal_planets, $range );

        // 5. Build public URLs
        $transit_url  = $this->build_transit_url( $coachee_id, $period, $chat_id );
        $natal_url    = $this->build_natal_url( $coachee_id );

        return array(
            'ok'                  => true,
            'coachee_id'          => $coachee_id,
            'period_label'        => $range['label'],
            'range_start'         => $range['start'],
            'range_end'           => $range['end'],
            'days_count'          => $range['days'],
            'transit_text'        => $transit_text,
            'transit_url'         => $transit_url,
            'natal_url'           => $natal_url,
            'retrograde_planets'  => $retro_str,
            'key_aspects'         => $key_aspects,
            'passages_md'         => $passages_md,
        );
    }

    private function build_range( string $period, string $start_raw ): array {
        $start = $start_raw !== '' ? $start_raw : date( 'Y-m-d', strtotime( '+1 day' ) );
        $period_days = array(
            'day'   => 1,
            '3day'  => 3,
            'week'  => 7,
            '10day' => 10,
            '20day' => 20,
            'month' => 30,
            'year'  => 365,
        );
        $label_map = array(
            'day'   => 'ngày mai',
            '3day'  => '3 ngày tới',
            'week'  => 'tuần tới (7 ngày)',
            '10day' => '10 ngày tới',
            '20day' => '20 ngày tới',
            'month' => 'tháng tới (30 ngày)',
            'year'  => 'năm tới (12 tháng)',
        );
        $days  = $period_days[ $period ] ?? 7;
        $end   = date( 'Y-m-d', strtotime( $start . ' +' . ($days - 1) . ' days' ) );
        return array(
            'start' => $start,
            'end'   => $end,
            'days'  => $days,
            'label' => $label_map[ $period ] ?? $period,
        );
    }

    private function load_transit_snapshots( int $coachee_id, array $range ): array {
        global $wpdb;
        $tbl = $wpdb->prefix . 'bccm_transit_snapshots';

        // Check if table exists
        if ( ! function_exists( '_bizcity_legacy_tbl_exists' ) || ! _bizcity_legacy_tbl_exists( $tbl ) ) {
            return array();
        }

        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT snap_date, planets_json, aspects_json
             FROM {$tbl}
             WHERE coachee_id = %d
               AND snap_date BETWEEN %s AND %s
             ORDER BY snap_date ASC",
            $coachee_id, $range['start'], $range['end']
        ), ARRAY_A );

        $out = array();
        foreach ( (array) $rows as $row ) {
            $planets = json_decode( (string) ( $row['planets_json'] ?? '' ), true );
            $aspects = json_decode( (string) ( $row['aspects_json'] ?? '' ), true );
            $out[ $row['snap_date'] ] = array(
                'date'    => $row['snap_date'],
                'planets' => is_array( $planets ) ? $planets : array(),
                'aspects' => is_array( $aspects ) ? $aspects : array(),
            );
        }
        return $out;
    }

    private function load_natal_planets( int $coachee_id ) {
        global $wpdb;
        $t = $wpdb->prefix . 'bccm_astro';
        $row = $wpdb->get_row( $wpdb->prepare(
            "SELECT traits FROM {$t} WHERE coachee_id = %d AND chart_type = 'western' LIMIT 1",
            $coachee_id
        ), ARRAY_A );
        if ( ! $row ) { return array(); }
        $traits = json_decode( (string) ( $row['traits'] ?? '' ), true );
        return is_array( $traits ) ? ( $traits['positions'] ?? array() ) : array();
    }

    private function build_transit_text( array $snapshots, array $range, string $format ): string {
        if ( empty( $snapshots ) ) {
            return '⚠️ Chưa có dữ liệu transit cho kỳ này. Bấm "Cập nhật 30 ngày" trong trang chiêm tinh.';
        }

        $aspect_vi = array(
            'Conjunction'    => 'Hợp', 'Opposition' => 'Đối',
            'Trine'          => 'Tam hợp', 'Square' => 'Vuông',
            'Sextile'        => 'Lục hợp', 'Quincunx' => 'Bất điều hòa',
            'Semi-Sextile'   => 'Bán sextile',
        );
        $planet_vi = array(
            'Sun'=>'☉Mặt Trời','Moon'=>'☽Mặt Trăng','Mercury'=>'☿Sao Thủy',
            'Venus'=>'♀Sao Kim','Mars'=>'♂Sao Hỏa','Jupiter'=>'♃Sao Mộc',
            'Saturn'=>'♄Sao Thổ','Uranus'=>'♅Thiên Vương','Neptune'=>'♆Hải Vương',
            'Pluto'=>'♇Diêm Vương','Chiron'=>'⚷Chiron',
        );
        $is_short = $format === 'short';
        $lines    = array();
        $char_budget = 780;
        $total_chars = 0;

        foreach ( $snapshots as $date => $snap ) {
            $d       = new DateTime( $date );
            $day_str = $d->format( 'd/m' ) . ' (' . array( 'CN','T2','T3','T4','T5','T6','T7' )[ (int)$d->format('w') ] . ')';
            $aspects = is_array( $snap['aspects'] ) ? $snap['aspects'] : array();
            $planets = is_array( $snap['planets'] ) ? $snap['planets'] : array();

            // Retrograde
            $retro = array();
            foreach ( $planets as $p ) {
                $pname = $p['name'] ?? ( $p['planet']['en'] ?? '' );
                $is_r  = isset( $p['is_retro'] ) ? (bool) $p['is_retro']
                    : ( strtolower( (string) ( $p['isRetro'] ?? 'false' ) ) === 'true' );
                if ( $is_r ) { $retro[] = ( $planet_vi[ $pname ] ?? $pname ) . '℞'; }
            }

            // Top aspects (tight orb ≤ 3°)
            $asp_strs = array();
            usort( $aspects, function ( $a, $b ) {
                return ( $a['orb'] ?? 9 ) <=> ( $b['orb'] ?? 9 );
            } );
            $shown = 0;
            foreach ( $aspects as $asp ) {
                if ( ( $asp['orb'] ?? 9 ) > ( $is_short ? 2.5 : 4.0 ) ) { continue; }
                $tp  = $planet_vi[ $asp['transit_planet'] ?? '' ] ?? ( $asp['transit_planet'] ?? '' );
                $np  = $planet_vi[ $asp['natal_planet']   ?? '' ] ?? ( $asp['natal_planet']   ?? '' );
                $a   = $aspect_vi[  $asp['aspect']        ?? '' ] ?? ( $asp['aspect']         ?? '' );
                $orb = isset( $asp['orb'] ) ? round( (float) $asp['orb'], 1 ) . '°' : '';
                $asp_strs[] = "{$tp} {$a} natal {$np} ({$orb})";
                if ( ++$shown >= ( $is_short ? 2 : 5 ) ) { break; }
            }

            $day_line = "📅 {$day_str}";
            if ( ! empty( $retro ) )   { $day_line .= ' | ℞: ' . implode( ', ', $retro ); }
            if ( ! empty( $asp_strs ) ){ $day_line .= "\n  ⟶ " . implode( "\n  ⟶ ", $asp_strs ); }

            if ( $is_short && ( $total_chars + strlen( $day_line ) + 2 ) > $char_budget ) {
                $lines[] = '... (còn ' . ( count( $snapshots ) - count( $lines ) ) . ' ngày nữa)';
                break;
            }
            $lines[]      = $day_line;
            $total_chars += strlen( $day_line ) + 2;
        }

        return implode( "\n\n", $lines );
    }

    private function extract_retrograde_summary( array $snapshots ): string {
        $seen = array();
        foreach ( $snapshots as $snap ) {
            foreach ( (array) ( $snap['planets'] ?? array() ) as $p ) {
                $pname = $p['name'] ?? ( $p['planet']['en'] ?? '' );
                $is_r  = isset( $p['is_retro'] ) ? (bool) $p['is_retro']
                    : ( strtolower( (string) ( $p['isRetro'] ?? 'false' ) ) === 'true' );
                if ( $is_r ) { $seen[ $pname ] = true; }
            }
        }
        return empty( $seen ) ? '' : implode( ', ', array_map( fn( $n ) => $n . ' ℞', array_keys( $seen ) ) );
    }

    private function extract_key_aspects( array $snapshots ): string {
        $tightest = array();
        $seen_key = array();
        foreach ( $snapshots as $snap ) {
            foreach ( (array) ( $snap['aspects'] ?? array() ) as $asp ) {
                $key = ( $asp['transit_planet'] ?? '' ) . '_' . ( $asp['natal_planet'] ?? '' ) . '_' . ( $asp['aspect'] ?? '' );
                $orb = (float) ( $asp['orb'] ?? 9 );
                if ( ! isset( $seen_key[ $key ] ) || $orb < $seen_key[ $key ] ) {
                    $seen_key[ $key ] = $orb;
                    $tightest[ $key ] = $asp;
                }
            }
        }
        uasort( $tightest, fn( $a, $b ) => ( $a['orb'] ?? 9 ) <=> ( $b['orb'] ?? 9 ) );
        $aspect_vi  = array( 'Conjunction'=>'Hợp','Opposition'=>'Đối','Trine'=>'Tam hợp','Square'=>'Vuông','Sextile'=>'Lục hợp' );
        $planet_vi  = array( 'Jupiter'=>'Mộc','Saturn'=>'Thổ','Uranus'=>'Thiên Vương','Neptune'=>'Hải Vương','Pluto'=>'Diêm Vương','Chiron'=>'Chiron' );
        $out = array();
        foreach ( array_slice( array_values( $tightest ), 0, 3 ) as $asp ) {
            $tp = $planet_vi[ $asp['transit_planet'] ?? '' ] ?? ( $asp['transit_planet'] ?? '' );
            $np = $planet_vi[ $asp['natal_planet']   ?? '' ] ?? ( $asp['natal_planet']   ?? '' );
            $a  = $aspect_vi[ $asp['aspect']         ?? '' ] ?? ( $asp['aspect']         ?? '' );
            $out[] = "{$tp} {$a} natal {$np}";
        }
        return implode( ' · ', $out );
    }

    private function build_passages_md( array $snapshots, array $natal_planets, array $range ): string {
        $lines = array( "## Transit {$range['label']} ({$range['start']} → {$range['end']})" );
        foreach ( $snapshots as $date => $snap ) {
            $lines[] = "\n### {$date}";
            foreach ( (array) ( $snap['aspects'] ?? array() ) as $asp ) {
                $lines[] = sprintf(
                    '- **%s** %s → natal %s (orb %.1f°)',
                    $asp['transit_planet'] ?? '',
                    $asp['aspect'] ?? '',
                    $asp['natal_planet'] ?? '',
                    (float) ( $asp['orb'] ?? 0 )
                );
            }
        }
        return implode( "\n", $lines );
    }

    private function build_transit_url( int $coachee_id, string $period, string $chat_id ): string {
        // Prefer public /my-transit/ URL over admin URL
        if ( function_exists( 'bcpro_get_transit_public_url' ) ) {
            return (string) bcpro_get_transit_public_url( $coachee_id, $period );
        }
        return home_url( '/my-transit/?coachee_id=' . $coachee_id . '&period=' . rawurlencode( $period ) );
    }

    private function build_natal_url( int $coachee_id ): string {
        if ( function_exists( 'bccm_get_natal_chart_public_url' ) ) {
            return (string) bccm_get_natal_chart_public_url( $coachee_id );
        }
        return '';
    }
}
```

---

## 4. Workflow Graph JSON — Template chính

Lưu vào `core/automation/templates/astro-zalobot.json`.

```json
[
  {
    "slug": "tpl_astro_van_han_zalo_v1",
    "name": "Chiêm Tinh — Xem Vận Hạn qua Zalo Bot",
    "description": "User nhắn 'vận hạn ngày mai/tuần này/tháng 8' → Bot xác định chủ thể → tóm tắt natal → lấy transit day-by-day → reply link /my-transit/ → luận giải sự nghiệp · tài chính · tình duyên · tổng vận.",
    "category": "astrology",
    "source": "builtin",
    "trigger_type": "zalo_inbound",
    "icon": "Star",
    "tags": "zalo,astro,transit,natal,van-han,su-nghiep,tinh-duyen",
    "plan": "free",
    "trigger_config": { "instance_id": "", "filter": "vận|chiêm|bản đồ|transit|sao|tử vi" },
    "graph": {
      "meta": { "template": "tpl_astro_van_han_zalo_v1" },
      "nodes": [
        {
          "id": "t1", "type": "trigger",
          "position": { "x": 0, "y": 200 },
          "data": {
            "blockId": "trigger.zalo_inbound",
            "label": "Zalo Bot · vận hạn chiêm tinh",
            "instance_id": "",
            "filter": "vận|chiêm|bản đồ|transit|sao|tử vi"
          }
        },
        {
          "id": "n1", "type": "action",
          "position": { "x": 280, "y": 200 },
          "data": {
            "blockId": "action.run_astro",
            "label": "Resolve chủ thể + Natal",
            "chat_id": "{{trigger.chat_id}}",
            "instance_id": "{{trigger.instance_id}}",
            "query": "{{trigger.text}}",
            "compose": false
          }
        },
        {
          "id": "chk", "type": "logic",
          "position": { "x": 560, "y": 200 },
          "data": {
            "blockId": "logic.condition",
            "label": "Có bản đồ sao?",
            "condition": "{{n1.has_chart}} == 1"
          }
        },
        {
          "id": "err", "type": "action",
          "position": { "x": 560, "y": 380 },
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Thông báo chưa có bản đồ sao",
            "text": "⚠️ {{n1.coachee_name}} chưa có bản đồ sao chiêm tinh.\n\nTạo bản đồ tại: {{n1.create_chart_url}}\n\n💡 Cần ngày sinh, giờ sinh, nơi sinh."
          }
        },
        {
          "id": "n3", "type": "llm",
          "position": { "x": 840, "y": 80 },
          "data": {
            "blockId": "llm.compose_reply",
            "label": "LLM · Tổng quan natal chart",
            "model": "gpt-4o-mini",
            "system": "Bạn là chuyên gia chiêm tinh. Dựa vào dữ liệu natal chart bên dưới, hãy viết tổng quan ngắn (≤200 từ) về CHỦ NHÂN bản đồ: tính cách cốt lõi, điểm mạnh, điểm cần lưu ý, và định hướng cuộc đời theo chiêm tinh Tây phương. Viết bằng tiếng Việt, không dùng markdown.",
            "prompt": "CHỦ NHÂN: {{n1.coachee_name}}\nKỳ phân tích: {{n1.period_label}}\n\nDỮ LIỆU NATAL:\n{{n1.passages_count}} passages từ bản đồ sao."
          }
        },
        {
          "id": "r1", "type": "action",
          "position": { "x": 1120, "y": 80 },
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Reply 1 · Tổng quan chủ thể",
            "text": "🌟 *Bản đồ sao {{n1.coachee_name}}*\n\n{{n3.output}}\n\n🔗 Xem bản đồ sao đầy đủ: {{n1.natal_url}}"
          }
        },
        {
          "id": "n4", "type": "action",
          "position": { "x": 840, "y": 280 },
          "data": {
            "blockId": "action.run_astro_transit",
            "label": "Lấy Transit Day-by-Day",
            "coachee_id": "{{n1.coachee_id}}",
            "chat_id": "{{trigger.chat_id}}",
            "period": "{{n1.period}}",
            "start_date": "",
            "outer_only": true,
            "format": "short"
          }
        },
        {
          "id": "r2", "type": "action",
          "position": { "x": 1120, "y": 280 },
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Reply 2 · Transit + Link",
            "text": "📅 *Lịch chuyển động sao — {{n4.period_label}}*\n\n{{n4.transit_text}}\n\n🔗 Xem chi tiết bản đồ transit: {{n4.transit_url}}"
          }
        },
        {
          "id": "n5", "type": "llm",
          "position": { "x": 840, "y": 480 },
          "data": {
            "blockId": "llm.compose_reply",
            "label": "LLM · Luận giải sâu theo chủ đề",
            "model": "gpt-4o-mini",
            "system": "Bạn là chuyên gia chiêm tinh Tây phương. Dựa vào natal chart và dữ liệu transit bên dưới, hãy phân tích chi tiết cho kỳ được chỉ định. Bố cục rõ ràng: 1) Sự nghiệp & Công việc 2) Tài chính 3) Tình duyên & Quan hệ 4) Đối tác & Làm ăn 5) Sức khỏe 6) Tổng vận hạn & Lời khuyên. Viết tiếng Việt, ≤400 từ, không dùng markdown đặc biệt.",
            "prompt": "CHỦ NHÂN: {{n1.coachee_name}}\nKỲ PHÂN TÍCH: {{n4.period_label}} ({{n4.range_start}} → {{n4.range_end}})\n\nCÁC TRANSIT CHÍNH:\n{{n4.key_aspects}}\n\nNGHỊCH HÀNH: {{n4.retrograde_planets}}\n\nDỮ LIỆU CHI TIẾT:\n{{n4.passages_md}}"
          }
        },
        {
          "id": "r3", "type": "action",
          "position": { "x": 1120, "y": 480 },
          "data": {
            "blockId": "action.reply_zalo",
            "label": "Reply 3 · Luận giải chi tiết",
            "text": "🔮 *Phân tích {{n4.period_label}} — {{n1.coachee_name}}*\n\n{{n5.output}}"
          }
        }
      ],
      "edges": [
        { "id": "e_t1_n1",   "source": "t1",  "target": "n1" },
        { "id": "e_n1_chk",  "source": "n1",  "target": "chk" },
        { "id": "e_chk_err", "source": "chk", "target": "err",  "sourceHandle": "false" },
        { "id": "e_chk_n3",  "source": "chk", "target": "n3",   "sourceHandle": "true" },
        { "id": "e_n3_r1",   "source": "n3",  "target": "r1" },
        { "id": "e_r1_n4",   "source": "r1",  "target": "n4" },
        { "id": "e_n4_r2",   "source": "n4",  "target": "r2" },
        { "id": "e_r2_n5",   "source": "r2",  "target": "n5" },
        { "id": "e_n5_r3",   "source": "n5",  "target": "r3" }
      ]
    }
  }
]
```

---

## 5. Topic Parsing — Bóc chủ đề từ query

Nếu user gửi "vận hạn sự nghiệp tuần tới" hoặc "tình duyên tháng 8", cần extract topic.

### Option A — Đơn giản: System prompt trong N5 luôn cover tất cả chủ đề

LLM N5 đã có system prompt gồm 6 chủ đề. Nếu user không mention cụ thể → LLM tự cân đối độ dài.

### Option B — Parse topic với node LLM riêng (nâng cao)

Thêm node `n_topic` trước N5:

```json
{
  "id": "n_topic", "type": "llm",
  "position": { "x": 600, "y": 480 },
  "data": {
    "blockId": "llm.compose_reply",
    "label": "Parse chủ đề từ query",
    "model": "gpt-4o-mini",
    "system": "Từ câu hỏi của user, trích xuất CHỦ ĐỀ chính họ muốn biết. Trả về CHỈ 1 dòng: 'su_nghiep', 'tai_chinh', 'tinh_duyen', 'doi_tac', 'suc_khoe', hoặc 'tong_van' nếu không rõ.",
    "prompt": "Câu hỏi: {{trigger.text}}"
  }
}
```

Sau đó N5 dùng `{{n_topic.output}}` để focus system prompt:

```json
"system": "Bạn là chuyên gia chiêm tinh. CHỦ ĐỀ FOCUS: {{n_topic.output}}. Phân tích chi tiết chủ đề đó trước (3/4 độ dài), sau đó tổng vận hạn ngắn (1/4)."
```

---

## 6. Variation Templates — Các biến thể ngắn gọn

### V1: Chiêm tinh nhanh 1 reply (gộp hết vào N5)

```json
{
  "slug": "tpl_astro_quick_zalo_v1",
  "name": "Chiêm Tinh · Nhanh (1 reply)",
  "description": "Zalo Bot — 1 reply duy nhất: tóm tắt natal + transit + lời khuyên",
  "graph": {
    "nodes": [
      T1 trigger.zalo_inbound,
      N1 action.run_astro (compose=true),   ← dùng built-in compose
      R1 action.reply_zalo text="🌟 {{n1.coachee_name}}\n{{n1.analysis}}\n\n🔗 {{n1.transit_url}}"
    ]
  }
}
```

### V2: Lịch Transit Hàng Ngày (Cron)

```json
{
  "slug": "tpl_astro_daily_cron_v1",
  "name": "Chiêm Tinh · Gửi Transit Hàng Ngày (Cron 8:00)",
  "trigger_type": "cron",
  "trigger_config": { "schedule": "0 8 * * *" },
  "graph": {
    "nodes": [
      T1 trigger.cron (8:00),
      N4 action.run_astro_transit (coachee_id=1, period=day, format=short),
      N5 llm.compose_reply (system="tóm tắt ngắn gọn < 200 từ, tiếng Việt"),
      R1 action.reply_zalo (override_chat_id="...", text="🌅 Transit hôm nay:\n{{n5.output}}\n\n{{n4.transit_url}}")
    ]
  }
}
```

### V3: Xem bản đồ sao (không transit)

```json
{
  "slug": "tpl_astro_natal_only_zalo_v1",
  "name": "Chiêm Tinh · Chỉ Xem Bản Đồ Natal",
  "description": "User nhắn 'bản đồ sao' → reply natal chart link + AI tóm tắt"
}
```

---

## 7. File cần tạo / sửa

| File | Trạng thái | Mô tả |
|---|---|---|
| `core/automation/includes/blocks/actions/class-action-run-astro-transit.php` | ✅ **DONE** | Block `action.run_astro_transit` — PHP 7.4 compat, 12 output vars |
| `core/automation/includes/class-block-registry.php` | ✅ **DONE** | `BizCity_Automation_Action_Run_Astro_Transit` registered |
| `core/automation/templates/astro-zalobot.json` | ✅ **DONE** | 3 templates: `tpl_astro_van_han_zalo_v1`, `tpl_astro_quick_zalo_v1`, `tpl_astro_daily_cron_v1` |
| `core/automation/includes/class-automation-templates-seeder.php` | ✅ **DONE** | `SEED_VERSION = '1.30.0'` |
| `plugins/bizcoach-pro/bizcoach-pro.php` | ✅ **DONE** | `bcpro_get_transit_public_url()` với fallback chain |

### Block registration (class-block-registry.php)

```php
// [2026-07-03 Johnny Chu] PHASE-ASTRO-WORKFLOW — register transit block
require_once __DIR__ . '/blocks/actions/class-action-run-astro-transit.php';
self::register( new BizCity_Automation_Action_Run_Astro_Transit() );
```

---

## 8. `bcpro_get_transit_public_url` — Implementation

Hàm này đã được document nhưng chưa implement (xem ASTRO-MPR-CITATION-PIPELINE.md §Fix 2).  
Thêm vào `plugins/bizcoach-pro/bizcoach-pro.php` hoặc `legacy/lib/helpers.php`:

```php
// [2026-07-03 Johnny Chu] PHASE-ASTRO-WORKFLOW — canonical transit public URL
if ( ! function_exists( 'bcpro_get_transit_public_url' ) ) {
    function bcpro_get_transit_public_url( $coachee_id, $period = 'day' ) {
        $coachee_id = (int) $coachee_id;
        if ( $coachee_id <= 0 ) { return ''; }
        // Transit public page dùng hash auth giống natal chart
        // BizCoach_Pro_Transit_Public_Router::get_public_url() nếu có,
        // fallback sang home_url
        if ( class_exists( 'BizCoach_Pro_Transit_Public_Router' )
             && method_exists( 'BizCoach_Pro_Transit_Public_Router', 'get_public_url' ) ) {
            return (string) BizCoach_Pro_Transit_Public_Router::get_public_url( $coachee_id, $period );
        }
        // Fallback: generate hash như natal chart
        if ( function_exists( 'bccm_generate_natal_chart_hash' ) ) {
            $hash = bccm_generate_natal_chart_hash( $coachee_id );
            return home_url( '/my-transit/?id=' . $coachee_id . '&hash=' . $hash . '&period=' . rawurlencode( $period ) );
        }
        return '';
    }
}
```

---

## 9. Output vars reference — Template tokens

| Token | Source block | Ý nghĩa |
|---|---|---|
| `{{trigger.text}}` | T1 | Tin nhắn gốc từ user |
| `{{trigger.chat_id}}` | T1 | ID conversation Zalo |
| `{{trigger.user_id}}` | T1 | Zalo user ID |
| `{{n1.has_chart}}` | N1 run_astro | `1` = có natal chart |
| `{{n1.coachee_id}}` | N1 | ID coachee trong DB |
| `{{n1.coachee_name}}` | N1 | Tên coachee |
| `{{n1.period}}` | N1 | `day\|week\|month\|year` |
| `{{n1.period_label}}` | N1 | "ngày hôm nay", "tuần này"... |
| `{{n1.natal_url}}` | N1 | Link xem bản đồ sao |
| `{{n1.transit_url}}` | N1 | Link transit admin |
| `{{n1.create_chart_url}}` | N1 | Link tạo mới nếu chưa có |
| `{{n3.output}}` | N3 llm | Tổng quan natal (≤200 từ) |
| `{{n4.transit_text}}` | N4 run_astro_transit | Bảng transit Zalo-friendly |
| `{{n4.transit_url}}` | N4 | `/my-transit/` public URL |
| `{{n4.natal_url}}` | N4 | `/my-natal-chart/` public URL |
| `{{n4.period_label}}` | N4 | "ngày mai", "tuần tới"... |
| `{{n4.range_start}}` | N4 | YYYY-MM-DD bắt đầu |
| `{{n4.range_end}}` | N4 | YYYY-MM-DD kết thúc |
| `{{n4.retrograde_planets}}` | N4 | "Mercury ℞, Saturn ℞" |
| `{{n4.key_aspects}}` | N4 | Top 3 aspect tight nhất |
| `{{n4.passages_md}}` | N4 | Full markdown cho LLM (không gửi Zalo) |
| `{{n5.output}}` | N5 llm | Luận giải chi tiết (≤400 từ) |

---

## 10. Test checklist

- [x] Tạo block `action.run_astro_transit`, register vào block registry — `core/automation/includes/blocks/actions/class-action-run-astro-transit.php` ✅
- [x] Tạo template `tpl_astro_van_han_zalo_v1`, bump SEED_VERSION → `1.30.0` — `core/automation/templates/astro-zalobot.json` ✅
- [x] Implement `bcpro_get_transit_public_url()` trong bizcoach-pro.php ✅
- [ ] Test dry-run: trigger manual → kiểm tra tất cả output vars có giá trị
- [ ] Test với coachee chưa có transit cache → hiện message "Chưa có dữ liệu"
- [ ] Test với filter "vận hạn tuần này" → N1 trả period=week
- [ ] Test branch `has_chart=false` → ERR node reply đúng
- [ ] Test Zalo send thật với 3 reply liên tiếp
- [ ] Test cron template V2 gửi đúng 08:00 hàng ngày

---

*Tài liệu tạo: 2026-07-03 · PHASE-ASTRO-WORKFLOW · Johnny Chu*
