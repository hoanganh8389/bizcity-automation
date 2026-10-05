<?php
/**
 * BizCity_Automation_Cell_Scenario — the `trigger_config.cell` declaration of a scenario the cell may call
 * (PHASE-0.91 AX-1.2, contract automation-scenario@1 §2 / §7, doc 101 A2).
 *
 * Pure functions, no DB write: sanitize · validate · blocks_cell · missing_requires · normalize_term · input_schema.
 * ONE source for the four states of a capability (on / off / not configured / unusable), used by the catalog,
 * automation.list_scenarios, automation.run_scenario and the Automation UI alike.
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026). R-BIZ-CENTRAL-BRAIN R-BCB-8 (cánh tay nối dài của não chúa).
 *
 * // [2026-10-05 06:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.2 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Automation
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 * @since      2026-10-05
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Cell_Scenario {

	/** Closed list of requirements (contract §2 `requires`). */
	const REQUIRES = array( 'fb_page_binding', 'wp_category', 'smtp', 'woo', 'crm', 'notebook', 'image_provider', 'llm_key' );

	const ROLES        = array( 'owner', 'staff' );
	const REPLIES      = array( 'verbatim', 'compose' );
	const INPUT_TYPES  = array( 'text', 'number', 'date', 'enum' );
	const NOTIFY       = array( 'full', 'result', 'failed', 'off' );
	const MAX_KEYWORDS = 12;
	const MAX_INPUTS   = 8;

	/** Blocks that only read / shape data: a graph made only of these is `read_only` (use a direct tool instead). */
	const READ_BLOCKS = array( 'action.search_kg', 'action.log', 'action.return_to_cell' );

	/** Human labels + where to fix each requirement (UI + scenario_not_configured details). */
	const REQUIRE_LABELS = array(
		'fb_page_binding' => 'Chưa chọn page Facebook cho kịch bản này.',
		'wp_category'     => 'Chưa chọn chuyên mục bài viết cho kịch bản này.',
		'smtp'            => 'Website chưa cấu hình gửi email (SMTP).',
		'woo'             => 'Website chưa bật WooCommerce.',
		'crm'             => 'Website chưa bật CRM.',
		'notebook'        => 'Website chưa có sổ tri thức (notebook).',
		'image_provider'  => 'Chưa cấu hình dịch vụ tạo ảnh.',
		'llm_key'         => 'Chưa cấu hình khoá AI cho website.',
	);

	/**
	 * Clean a raw `cell` block (doc 100 §5.1). Unknown keys are dropped; bad values fall back to the safe default.
	 * `confirm: 'never'` survives only with a complete standing_auth AND $can_authorize (manage_options) — D91-31.
	 *
	 * @param array $cfg           raw trigger_config['cell']
	 * @param bool  $can_authorize the saving user has manage_options
	 */
	public static function sanitize( array $cfg, bool $can_authorize = false ): array {
		// [2026-10-05 06:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.2 — one sanitiser for the declaration.
		$out = array(
			'enabled'          => ! empty( $cfg['enabled'] ),
			'slug'             => self::clean_slug( (string) ( $cfg['slug'] ?? '' ) ),
			'label'            => self::text( $cfg['label'] ?? '', 80 ),
			'one_line'         => self::text( $cfg['one_line'] ?? '', 160 ),
			'keywords'         => array(),
			'inputs'           => array(),
			'roles'            => array(),
			'confirm'          => 'always',
			'reply'            => in_array( (string) ( $cfg['reply'] ?? '' ), self::REPLIES, true ) ? (string) $cfg['reply'] : 'verbatim',
			'eta_seconds'      => max( 5, min( 600, (int) ( $cfg['eta_seconds'] ?? $cfg['eta'] ?? 30 ) ) ),
			'rate'             => array(),
			'requires'         => array(),
			'default_template' => self::clean_slug( (string) ( $cfg['default_template'] ?? '' ) ),
			'legacy_site_llm'  => ! empty( $cfg['legacy_site_llm'] ),
			'notify'           => in_array( (string) ( $cfg['notify'] ?? '' ), self::NOTIFY, true ) ? (string) $cfg['notify'] : 'full',
		);

		$kw = $cfg['keywords'] ?? array();
		if ( is_string( $kw ) ) {
			$kw = preg_split( '/\s*[,\n]\s*/', $kw );
		}
		foreach ( (array) $kw as $k ) {
			$k = self::normalize_term( self::text( $k, 40 ) );
			if ( '' !== $k && ! in_array( $k, $out['keywords'], true ) ) {
				$out['keywords'][] = $k;
			}
			if ( count( $out['keywords'] ) >= self::MAX_KEYWORDS ) {
				break;
			}
		}

		foreach ( (array) ( $cfg['inputs'] ?? array() ) as $in ) {
			if ( ! is_array( $in ) ) {
				continue;
			}
			$name = strtolower( preg_replace( '/[^A-Za-z0-9_]/', '', (string) ( $in['name'] ?? '' ) ) );
			if ( '' === $name || '_' === $name[0] || in_array( $name, array( 'wp_user_id', 'source' ), true ) ) {
				continue; // engine / identity keys are never declared as inputs
			}
			$type  = in_array( (string) ( $in['type'] ?? '' ), self::INPUT_TYPES, true ) ? (string) $in['type'] : 'text';
			$field = array(
				'name'     => substr( $name, 0, 40 ),
				'label'    => self::text( $in['label'] ?? $name, 60 ),
				'type'     => $type,
				'required' => ! empty( $in['required'] ),
			);
			if ( 'enum' === $type ) {
				$opts = array();
				foreach ( (array) ( $in['options'] ?? array() ) as $o ) {
					$o = self::text( $o, 40 );
					if ( '' !== $o ) {
						$opts[] = $o;
					}
				}
				$field['options'] = array_slice( array_values( array_unique( $opts ) ), 0, 20 );
			}
			$out['inputs'][] = $field;
			if ( count( $out['inputs'] ) >= self::MAX_INPUTS ) {
				break;
			}
		}

		foreach ( (array) ( $cfg['roles'] ?? array( 'owner' ) ) as $r ) {
			$r = (string) $r;
			if ( in_array( $r, self::ROLES, true ) && ! in_array( $r, $out['roles'], true ) ) {
				$out['roles'][] = $r;
			}
		}

		$per_day = (int) ( $cfg['rate']['per_day'] ?? 0 );
		if ( $per_day > 0 ) {
			$out['rate'] = array( 'per_day' => min( 1000, $per_day ) );
		}

		foreach ( (array) ( $cfg['requires'] ?? array() ) as $req ) {
			$req = (string) $req;
			if ( in_array( $req, self::REQUIRES, true ) && ! in_array( $req, $out['requires'], true ) ) {
				$out['requires'][] = $req;
			}
		}

		// D91-31 standing authorisation: never without who + when, never without manage_options.
		$auth = isset( $cfg['standing_auth'] ) && is_array( $cfg['standing_auth'] ) ? $cfg['standing_auth'] : array();
		if ( 'never' === (string) ( $cfg['confirm'] ?? '' ) && $can_authorize && (int) ( $auth['by'] ?? 0 ) > 0 && '' !== (string) ( $auth['at'] ?? '' ) ) {
			$out['confirm']       = 'never';
			$out['standing_auth'] = array(
				'by'    => (int) $auth['by'],
				'at'    => self::text( $auth['at'], 40 ),
				'label' => self::text( $auth['label'] ?? '', 80 ),
			);
		}
		return $out;
	}

	/**
	 * Save-time checks of a sanitized declaration against its workflow (422 WP_Error or true).
	 *
	 * @param array $cfg        sanitized cell block
	 * @param array $wf         workflow row (graph, trigger_config, id)
	 * @param array $raw_roles  roles as submitted (to refuse `customer` loudly instead of dropping it)
	 * @param array $taken_slugs slug => workflow id of the OTHER cell scenarios of this site
	 * @return true|WP_Error
	 */
	public static function validate( array $cfg, array $wf, array $raw_roles = array(), array $taken_slugs = array() ) {
		// [2026-10-05 06:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.2 — 422 refusals of the declaration.
		if ( in_array( 'customer', array_map( 'strval', $raw_roles ), true ) ) {
			return new WP_Error( 'scenario_role_invalid', 'Khách hàng không được chạy kịch bản. Chỉ chọn chủ hoặc nhân sự.', array( 'status' => 422 ) );
		}
		if ( '' === $cfg['slug'] ) {
			return new WP_Error( 'scenario_slug_invalid', 'Mã kịch bản chỉ gồm a-z, 0-9, _ (3–40 ký tự).', array( 'status' => 422 ) );
		}
		$own = (int) ( $wf['id'] ?? 0 );
		if ( isset( $taken_slugs[ $cfg['slug'] ] ) && (int) $taken_slugs[ $cfg['slug'] ] !== $own ) {
			return new WP_Error( 'scenario_slug_taken', 'Mã kịch bản "' . $cfg['slug'] . '" đã có kịch bản khác dùng.', array( 'status' => 422 ) );
		}
		if ( '' === $cfg['label'] || '' === $cfg['one_line'] ) {
			return new WP_Error( 'scenario_label_missing', 'Kịch bản cần tên và một câu mô tả.', array( 'status' => 422 ) );
		}
		if ( ! $cfg['roles'] ) {
			return new WP_Error( 'scenario_role_invalid', 'Chọn ít nhất một vai được gọi kịch bản (chủ hoặc nhân sự).', array( 'status' => 422 ) );
		}
		$graph = self::graph_of( $wf );
		$tc    = is_array( $wf['trigger_config'] ?? null ) ? $wf['trigger_config'] : array();
		if ( self::is_hil( $graph, $tc ) ) {
			return new WP_Error( 'scenario_needs_hil', 'Kịch bản này cần hỏi đáp từng bước trên Zalo Bot; trợ lý chưa chạy được. Hãy tách phần hỏi thành trường dữ liệu vào.', array( 'status' => 422 ) );
		}
		if ( self::is_read_only( $graph ) ) {
			return new WP_Error( 'scenario_is_read_only', 'Việc này chỉ tra cứu, trợ lý làm ngay được, không cần kịch bản.', array( 'status' => 422 ) );
		}
		return true;
	}

	/**
	 * Why the cell cannot use this scenario ('' = usable): disabled · no_slug · hil · read_only · not_configured.
	 *
	 * @param array $graph workflow graph
	 * @param array $tc    full trigger_config (holds `cell` and possibly `hil_spec`)
	 * @param bool  $wf_enabled workflow `enabled` column
	 */
	public static function blocks_cell( array $graph, array $tc, bool $wf_enabled = true ): string {
		// [2026-10-05 06:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.2 — one answer for UI, pack, list and handler.
		$cell = self::cell_of( $tc );
		if ( ! $wf_enabled || empty( $cell['enabled'] ) ) {
			return 'disabled';
		}
		if ( '' === $cell['slug'] ) {
			return 'no_slug';
		}
		if ( self::is_hil( $graph, $tc ) ) {
			return 'hil';
		}
		if ( self::is_read_only( $graph ) ) {
			return 'read_only';
		}
		if ( self::missing_requires( $cell, $graph ) ) {
			return 'not_configured';
		}
		return '';
	}

	/**
	 * Unmet requirements, each { key, label, fix_url }. A requirement nobody can check counts as unmet (never guess);
	 * owners answer through the filter `bizcity_automation_cell_requirement_met` ( null|bool $met, $key, $cell, $graph ).
	 */
	public static function missing_requires( array $cell, array $graph = array() ): array {
		// [2026-10-05 06:05 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.7 — `requires[]` ⇒ scenario_not_configured + what to fix.
		$missing = array();
		foreach ( (array) ( $cell['requires'] ?? array() ) as $key ) {
			if ( ! in_array( $key, self::REQUIRES, true ) ) {
				continue;
			}
			$met = self::requirement_met( (string) $key, $graph );
			if ( function_exists( 'apply_filters' ) ) {
				$met = apply_filters( 'bizcity_automation_cell_requirement_met', $met, (string) $key, $cell, $graph );
			}
			if ( true !== $met ) {
				$missing[] = array(
					'key'     => (string) $key,
					'label'   => self::REQUIRE_LABELS[ $key ],
					'fix_url' => function_exists( 'admin_url' ) ? (string) admin_url( 'admin.php?page=bizcity-automation' ) : '',
				);
			}
		}
		return $missing;
	}

	/** Matcher rule: remove_accents → lowercase → collapse whitespace. */
	public static function normalize_term( string $s ): string {
		if ( function_exists( 'remove_accents' ) ) {
			$s = remove_accents( $s );
		}
		$s = function_exists( 'mb_strtolower' ) ? mb_strtolower( $s, 'UTF-8' ) : strtolower( $s );
		return trim( (string) preg_replace( '/\s+/u', ' ', $s ) );
	}

	/** `inputs[]` ⇒ JSON Schema of `run_scenario.input`. */
	public static function input_schema( array $cell ): array {
		$props    = array();
		$required = array();
		foreach ( (array) ( $cell['inputs'] ?? array() ) as $in ) {
			$type = 'number' === $in['type'] ? 'number' : 'string';
			$p    = array( 'type' => $type, 'title' => (string) $in['label'] );
			if ( 'date' === $in['type'] ) {
				$p['format'] = 'date-time';
			}
			if ( 'enum' === $in['type'] && ! empty( $in['options'] ) ) {
				$p['enum'] = array_values( $in['options'] );
			}
			$props[ $in['name'] ] = $p;
			if ( ! empty( $in['required'] ) ) {
				$required[] = $in['name'];
			}
		}
		$schema = array( 'type' => 'object', 'properties' => (object) $props );
		if ( $required ) {
			$schema['required'] = $required;
		}
		return $schema;
	}

	/** Names of required inputs that are absent / blank in $input. */
	public static function missing_inputs( array $cell, array $input ): array {
		$out = array();
		foreach ( (array) ( $cell['inputs'] ?? array() ) as $in ) {
			if ( empty( $in['required'] ) ) {
				continue;
			}
			$v = $input[ $in['name'] ] ?? null;
			if ( null === $v || ( is_string( $v ) && '' === trim( $v ) ) || ( is_array( $v ) && ! $v ) ) {
				$out[] = array( 'name' => $in['name'], 'label' => $in['label'] );
			}
		}
		return $out;
	}

	/** Sanitized `cell` block of a trigger_config ('' slug + disabled when absent). */
	public static function cell_of( array $tc ): array {
		return self::sanitize( isset( $tc['cell'] ) && is_array( $tc['cell'] ) ? $tc['cell'] : array(), self::stored_authorized( $tc ) );
	}

	/** Decoded graph of a workflow row. */
	public static function graph_of( array $wf ): array {
		$g = $wf['graph'] ?? null;
		if ( ! is_array( $g ) && is_string( $wf['graph_json'] ?? null ) ) {
			$g = json_decode( (string) $wf['graph_json'], true );
		}
		return is_array( $g ) ? $g : array();
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	/** A stored standing_auth was checked at save time (manage_options) — trust it when reading back. */
	private static function stored_authorized( array $tc ): bool {
		$auth = $tc['cell']['standing_auth'] ?? null;
		return is_array( $auth ) && (int) ( $auth['by'] ?? 0 ) > 0;
	}

	private static function is_hil( array $graph, array $tc ): bool {
		if ( ! empty( $tc['hil_spec'] ) ) {
			return true;
		}
		foreach ( self::nodes( $graph ) as $n ) {
			if ( 'action.set_pending_intent' === self::block_id( $n ) || ! empty( $n['data']['hil_spec'] ) ) {
				return true;
			}
		}
		return false;
	}

	private static function is_read_only( array $graph ): bool {
		foreach ( self::nodes( $graph ) as $n ) {
			$b = self::block_id( $n );
			if ( 'trigger' === (string) ( $n['type'] ?? '' ) || 0 === strpos( $b, 'trigger.' ) || 0 === strpos( $b, 'logic.' ) ) {
				continue;
			}
			if ( ! in_array( $b, self::READ_BLOCKS, true ) ) {
				return false;
			}
		}
		return true; // no node does any work (only triggers / reads / logic)
	}

	private static function requirement_met( string $key, array $graph ) {
		switch ( $key ) {
			case 'woo':
				return class_exists( 'WooCommerce' );
			case 'crm':
				return class_exists( 'BizCity_CRM_Repository' );
			case 'smtp':
				return class_exists( 'BizCity_SMTP' );
			case 'notebook':
				return class_exists( 'BizCity_KG' );
			case 'fb_page_binding':
				// [2026-10-05 07:50 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-B2-2b — a node without a page falls back to the site's
				// chosen Fanpage (setup step ③: bizcity_fb_default_page, or the only connected page), like publish_fb_post does.
				$nodes = self::nodes_of_block( $graph, 'action.publish_fb_post' );
				foreach ( $nodes as $n ) {
					if ( '' === trim( (string) ( $n['data']['fb_page_id'] ?? '' ) ) && ! self::site_fb_page() ) {
						return false;
					}
				}
				return $nodes ? true : null;
			case 'wp_category':
				$nodes = self::nodes_of_block( $graph, 'action.publish_wp_post' );
				foreach ( $nodes as $n ) {
					$cat = trim( (string) ( $n['data']['category'] ?? '' ) );
					if ( '' === $cat ) {
						return false;
					}
					if ( function_exists( 'get_term_by' ) ) {
						foreach ( array_filter( array_map( 'trim', explode( ',', $cat ) ) ) as $slug ) {
							if ( ! get_term_by( 'slug', $slug, 'category' ) ) {
								return false;
							}
						}
					}
				}
				return $nodes ? true : null;
			default:
				return null; // image_provider, llm_key: only their owner can answer (filter)
		}
	}

	/** The site has a Fanpage chosen for posting (default page option, or exactly one connected page). */
	private static function site_fb_page(): bool {
		if ( function_exists( 'get_option' ) && '' !== trim( (string) get_option( 'bizcity_fb_default_page', '' ) ) ) {
			return true;
		}
		return class_exists( 'BizCity_FB_Channel_Adapter' ) && method_exists( 'BizCity_FB_Channel_Adapter', 'pages' )
			&& 1 === count( (array) BizCity_FB_Channel_Adapter::pages() );
	}

	private static function nodes( array $graph ): array {
		return isset( $graph['nodes'] ) && is_array( $graph['nodes'] ) ? array_filter( $graph['nodes'], 'is_array' ) : array();
	}

	private static function nodes_of_block( array $graph, string $block ): array {
		return array_values( array_filter( self::nodes( $graph ), static function ( $n ) use ( $block ) {
			return self::block_id( $n ) === $block;
		} ) );
	}

	private static function block_id( array $n ): string {
		return (string) ( $n['data']['blockId'] ?? '' );
	}

	private static function clean_slug( string $slug ): string {
		$slug = strtolower( trim( $slug ) );
		return preg_match( '/^[a-z0-9_]{3,40}$/', $slug ) ? $slug : '';
	}

	/** Plain text, no tags / control chars, cut at $max characters. */
	private static function text( $v, int $max ): string {
		$s = is_scalar( $v ) ? (string) $v : '';
		$s = trim( (string) preg_replace( '/[\x00-\x1F\x7F]+/u', ' ', strip_tags( $s ) ) );
		return function_exists( 'mb_substr' ) ? mb_substr( $s, 0, $max, 'UTF-8' ) : substr( $s, 0, $max );
	}
}
