<?php
/**
 * BizCity_Automation_Cell_Catalog — the scenarios of this site the cell may call, looked up by `cell.slug`
 * (PHASE-0.91 AX-1.3, contract automation-scenario@1 §4 rule 1, doc 101 A3).
 *
 * Reads through BizCity_Automation_Repo_Workflows::query() only (no matcher, no SQL on the workflows table).
 * Cached 300 s in a transient, flushed with the workflow catalog whenever a workflow is saved.
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026).
 *
 * // [2026-10-05 06:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.3 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Automation
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 * @since      2026-10-05
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Cell_Catalog {

	const CACHE_KEY = 'bizcity_automation_cell_catalog_v1';
	const CACHE_TTL = 300;
	const LIST_MAX  = 60;

	/** @var array|null request cache: slug => entry */
	private static $entries = null;

	private static $hooked = false;

	public static function init(): void {
		if ( self::$hooked ) {
			return;
		}
		self::$hooked = true;
		add_action( 'bizcity_automation_workflow_saved', array( __CLASS__, 'flush_cache' ), 5 );
	}

	/**
	 * The scenario declared with this slug — WHATEVER its state, so the handler can say why it cannot run.
	 * Shape: { workflow_id, name, cell (sanitized), graph, blocks ('' = usable), missing (requires) }. null = no such slug.
	 */
	public static function find_by_slug( string $slug ) {
		// [2026-10-05 06:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.3 — lookup by slug, never by matcher.
		$slug = strtolower( trim( $slug ) );
		$all  = self::entries();
		return '' !== $slug && isset( $all[ $slug ] ) ? $all[ $slug ] : null;
	}

	/**
	 * Usable scenarios for a role (blocks = '' and role ∈ cell.roles), newest first, ≤ 60. Optional $q filters on
	 * name / label / slug / normalised keywords.
	 *
	 * @return array<int,array> entries as find_by_slug()
	 */
	public static function list_for_cell( string $role = 'owner', string $q = '' ): array {
		// [2026-10-05 06:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.5 — never lists off / not-configured / HIL / read-only cards.
		$q   = class_exists( 'BizCity_Automation_Cell_Scenario' ) ? BizCity_Automation_Cell_Scenario::normalize_term( $q ) : strtolower( trim( $q ) );
		$out = array();
		foreach ( self::entries() as $e ) {
			if ( '' !== $e['blocks'] || ! in_array( $role, $e['cell']['roles'], true ) ) {
				continue;
			}
			if ( '' !== $q ) {
				$hay = BizCity_Automation_Cell_Scenario::normalize_term( $e['name'] . ' ' . $e['cell']['label'] . ' ' . $e['cell']['slug'] . ' ' . implode( ' ', $e['cell']['keywords'] ) );
				if ( false === strpos( $hay, $q ) ) {
					continue;
				}
			}
			$out[] = $e;
			if ( count( $out ) >= self::LIST_MAX ) {
				break;
			}
		}
		return $out;
	}

	/** slug => workflow id of every declared scenario (save-time uniqueness, AX-1.2). */
	public static function slug_owners(): array {
		// [2026-10-05 08:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.2 — scenario_slug_taken check.
		$out = array();
		foreach ( self::entries() as $slug => $e ) {
			$out[ $slug ] = (int) $e['workflow_id'];
		}
		return $out;
	}

	/** Up to 3 declared slugs closest to $slug (scenario_not_found suggestions). */
	public static function nearest_slugs( string $slug, int $max = 3 ): array {
		$scored = array();
		foreach ( array_keys( self::entries() ) as $s ) {
			$scored[ $s ] = levenshtein( substr( $slug, 0, 40 ), (string) $s );
		}
		asort( $scored );
		return array_slice( array_keys( $scored ), 0, $max );
	}

	/**
	 * Runs of a workflow started today by this requester (rate.per_day). One COUNT on the runs table — the user_hash is
	 * hex so it is safe inside LIKE; a WP-user fallback is used for requests without a hash (TwinWeb).
	 */
	public static function runs_today( int $workflow_id, string $user_hash, int $user_id = 0 ): int {
		// [2026-10-05 06:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.4 — trần rate.per_day, no new column.
		global $wpdb;
		if ( $workflow_id <= 0 || ! class_exists( 'BizCity_Automation_Repo_Runs' ) || ! is_object( $wpdb ) ) {
			return 0;
		}
		$hash  = strtolower( preg_replace( '/[^a-f0-9]/i', '', $user_hash ) );
		$since = function_exists( 'current_time' ) ? substr( (string) current_time( 'mysql' ), 0, 10 ) . ' 00:00:00' : gmdate( 'Y-m-d 00:00:00' );
		if ( '' !== $hash ) {
			$needle = '%' . $wpdb->esc_like( '"user_hash":"' . $hash . '"' ) . '%';
		} elseif ( $user_id > 0 ) {
			$needle = '%' . $wpdb->esc_like( '"_owner_user_id":' . (int) $user_id . ',' ) . '%';
		} else {
			return 0;
		}
		return (int) $wpdb->get_var( $wpdb->prepare(
			'SELECT COUNT(*) FROM ' . BizCity_Automation_Repo_Runs::table_runs() . ' WHERE workflow_id = %d AND created_at >= %s AND trigger_payload_json LIKE %s',
			$workflow_id,
			$since,
			$needle
		) );
	}

	const DEFAULTS_OPTION  = 'bizcity_automation_cell_defaults';
	const DEFAULTS_VERSION = '1';
	const DEFAULTS_FILE    = 'cell-default-scenarios.json';

	/**
	 * Provision the system's default scenarios once per site (PHASE-0.91 B2-2b / AX-3a: `fb_post`). A scenario already
	 * declared with the same `default_template` (or the same slug) is never touched — the owner may have edited it.
	 * Idempotent, guarded by an option version; the scenario stays `not_configured` until its `requires` are met.
	 *
	 * @return string[] slugs created by this call
	 */
	public static function ensure_defaults(): array {
		// [2026-10-05 07:55 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-B2-2b — default scenario fb_post ⇒ the model posts through a scenario.
		if ( ! function_exists( 'get_option' ) || self::DEFAULTS_VERSION === (string) get_option( self::DEFAULTS_OPTION, '' ) ) {
			return array();
		}
		if ( ! class_exists( 'BizCity_Automation_Repo_Workflows' ) || ! class_exists( 'BizCity_Automation_Cell_Scenario' ) ) {
			return array();
		}
		$file = dirname( __DIR__ ) . '/templates/' . self::DEFAULTS_FILE;
		$list = is_readable( $file ) ? json_decode( (string) file_get_contents( $file ), true ) : null;
		if ( ! is_array( $list ) ) {
			return array();
		}
		$have = array();
		foreach ( self::entries() as $slug => $e ) {
			$have[ $slug ] = true;
			if ( '' !== $e['cell']['default_template'] ) {
				$have[ 'tpl:' . $e['cell']['default_template'] ] = true;
			}
		}
		$created = array();
		foreach ( $list as $tpl ) {
			$cell = is_array( $tpl['trigger_config']['cell'] ?? null ) ? $tpl['trigger_config']['cell'] : array();
			$slug = (string) ( $cell['slug'] ?? '' );
			$def  = (string) ( $cell['default_template'] ?? '' );
			if ( '' === $slug || isset( $have[ $slug ] ) || ( '' !== $def && isset( $have[ 'tpl:' . $def ] ) ) ) {
				continue;
			}
			$row = BizCity_Automation_Repo_Workflows::create( array(
				'slug'           => 'cell_' . $slug,
				'name'           => (string) ( $tpl['name'] ?? $slug ),
				'description'    => (string) ( $tpl['description'] ?? '' ),
				'enabled'        => 1,
				'trigger_type'   => 'cell_request',
				'trigger_config' => $tpl['trigger_config'],
				'graph'          => $tpl['graph'],
				'tags'           => (string) ( $tpl['tags'] ?? 'cell,default' ),
			) );
			if ( is_array( $row ) ) {
				$created[] = $slug;
			}
		}
		update_option( self::DEFAULTS_OPTION, self::DEFAULTS_VERSION, false );
		self::flush_cache();
		return $created;
	}

	public static function flush_cache(): void {
		self::$entries = null;
		if ( function_exists( 'delete_transient' ) ) {
			delete_transient( self::CACHE_KEY );
		}
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	/** slug => entry, for every enabled workflow that declares a cell block (or uses trigger.cell_request). */
	private static function entries(): array {
		if ( null !== self::$entries ) {
			return self::$entries;
		}
		$cached = function_exists( 'get_transient' ) ? get_transient( self::CACHE_KEY ) : false;
		if ( is_array( $cached ) ) {
			return self::$entries = $cached;
		}
		$out = array();
		if ( class_exists( 'BizCity_Automation_Repo_Workflows' ) && class_exists( 'BizCity_Automation_Cell_Scenario' ) ) {
			$res = BizCity_Automation_Repo_Workflows::query( array( 'limit' => 200 ) );
			foreach ( (array) ( $res['rows'] ?? array() ) as $wf ) {
				if ( ! is_array( $wf ) || ! empty( $wf['deleted_at'] ) ) {
					continue;
				}
				$tc = is_array( $wf['trigger_config'] ?? null ) ? $wf['trigger_config'] : array();
				if ( ! isset( $tc['cell'] ) || ! is_array( $tc['cell'] ) ) {
					continue;
				}
				$cell = BizCity_Automation_Cell_Scenario::cell_of( $tc );
				if ( '' === $cell['slug'] || isset( $out[ $cell['slug'] ] ) ) {
					continue; // no slug, or a duplicate slug (first = newest wins; save-time validate refuses duplicates)
				}
				$graph = BizCity_Automation_Cell_Scenario::graph_of( $wf );
				$out[ $cell['slug'] ] = array(
					'workflow_id' => (int) $wf['id'],
					'name'        => (string) ( $wf['name'] ?? '' ),
					'cell'        => $cell,
					'blocks'      => BizCity_Automation_Cell_Scenario::blocks_cell( $graph, $tc, ! empty( $wf['enabled'] ) ),
					'missing'     => BizCity_Automation_Cell_Scenario::missing_requires( $cell, $graph ),
				);
			}
		}
		if ( function_exists( 'set_transient' ) ) {
			set_transient( self::CACHE_KEY, $out, self::CACHE_TTL );
		}
		return self::$entries = $out;
	}
}
