<?php
/**
 * BizCity_Automation_Calendar_REST — the Automation SPA "Lịch" tab reads the ONE clock (PHASE-0.91 AS-13 / C-4.6, AS-5).
 *
 * The SPA (frontend/src/lib/calendarApi.js) still calls bizcity-automation/v1/calendar/*; that backend had gone. This
 * class answers the same routes from the scheduler's `bizcity_crm_events` rows of type automation_workflow /
 * automation_run — no second store, no SPA rebuild:
 *
 *   GET    calendar/events?from&to&workflow_id&status&limit   rows (metadata decoded + workflow_name)
 *   POST   calendar/events                                     manual occurrences of a workflow (once | daily | weekly)
 *   PATCH  calendar/events/{id}                                move start_at / title of an `active` row, or status=cancelled
 *   DELETE calendar/events/{id}                                active ⇒ cancelled (history kept); finished ⇒ removed
 *   POST   calendar/events/bulk-delete {ids}
 *   POST   calendar/sync/{wf_id}                               Schedule_Manager::sync_workflow_events()
 *   POST   calendar/events/{id}/catch-up                       AS-5 "chạy bù" of a `missed` row (see catch_up())
 *
 * Statuses of automation rows change only through BizCity_Scheduler_Run_Ledger (running/done/failed/missed) or a plain
 * cancel of a row that never started. Administrators only.
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026).
 *
 * // [2026-10-05 09:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-13 / AS-5 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Automation
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 * @since      2026-10-05
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Calendar_REST {

	const NS    = 'bizcity-automation/v1';
	const TYPES = array( 'automation_workflow', 'automation_run' );

	public static function init(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	public static function register_routes(): void {
		$admin = array( __CLASS__, 'allowed' );
		register_rest_route( self::NS, '/calendar/events', array(
			array( 'methods' => 'GET', 'callback' => array( __CLASS__, 'list_events' ), 'permission_callback' => $admin ),
			array( 'methods' => 'POST', 'callback' => array( __CLASS__, 'create_events' ), 'permission_callback' => $admin ),
		) );
		register_rest_route( self::NS, '/calendar/events/bulk-delete', array(
			'methods' => 'POST', 'callback' => array( __CLASS__, 'bulk_delete' ), 'permission_callback' => $admin,
		) );
		register_rest_route( self::NS, '/calendar/events/(?P<id>\d+)', array(
			array( 'methods' => 'PATCH', 'callback' => array( __CLASS__, 'patch_event' ), 'permission_callback' => $admin ),
			array( 'methods' => 'DELETE', 'callback' => array( __CLASS__, 'delete_event' ), 'permission_callback' => $admin ),
		) );
		register_rest_route( self::NS, '/calendar/events/(?P<id>\d+)/catch-up', array(
			'methods' => 'POST', 'callback' => array( __CLASS__, 'catch_up_route' ), 'permission_callback' => $admin,
		) );
		register_rest_route( self::NS, '/calendar/sync/(?P<wf_id>\d+)', array(
			'methods' => 'POST', 'callback' => array( __CLASS__, 'sync_workflow' ), 'permission_callback' => $admin,
		) );
	}

	public static function allowed(): bool {
		return class_exists( 'BizCity_Network_Admin_Capability' ) ? BizCity_Network_Admin_Capability::can_manage() : current_user_can( 'manage_options' );
	}

	// ─── Routes ──────────────────────────────────────────────────────────

	public static function list_events( WP_REST_Request $req ) {
		// [2026-10-05 09:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-13 — the SPA tab reads the scheduler's own rows.
		$mgr = self::mgr();
		if ( is_wp_error( $mgr ) ) {
			return $mgr;
		}
		global $wpdb;
		$where  = array( 'event_type IN (%s, %s)' );
		$params = self::TYPES;
		$from   = self::datetime( (string) $req->get_param( 'from' ) );
		$to     = self::datetime( (string) $req->get_param( 'to' ) );
		if ( '' !== $from ) {
			$where[]  = 'start_at >= %s';
			$params[] = $from;
		}
		if ( '' !== $to ) {
			$where[]  = 'start_at <= %s';
			$params[] = strlen( (string) $req->get_param( 'to' ) ) <= 10 ? substr( $to, 0, 10 ) . ' 23:59:59' : $to;
		}
		$status = sanitize_key( (string) $req->get_param( 'status' ) );
		if ( '' !== $status ) {
			$where[]  = 'status = %s';
			$params[] = $status;
		}
		$wf = (int) $req->get_param( 'workflow_id' );
		if ( $wf > 0 ) {
			$where[]  = 'metadata LIKE %s';
			$params[] = '%' . $wpdb->esc_like( '"workflow_id":' . $wf ) . '%';
		}
		$limit = max( 1, min( 500, (int) ( $req->get_param( 'limit' ) ?: 200 ) ) );
		$rows  = (array) $wpdb->get_results( $wpdb->prepare(
			'SELECT * FROM ' . $mgr->get_table() . ' WHERE ' . implode( ' AND ', $where ) . ' ORDER BY start_at ASC LIMIT ' . $limit,
			$params
		), ARRAY_A );
		$names = array();
		$out   = array();
		foreach ( $rows as $r ) {
			$m = json_decode( (string) ( $r['metadata'] ?? '' ), true );
			$m = is_array( $m ) ? $m : array();
			if ( $wf > 0 && (int) ( $m['workflow_id'] ?? 0 ) !== $wf ) {
				continue; // LIKE matched "workflow_id":12 inside "workflow_id":123
			}
			$id = (int) ( $m['workflow_id'] ?? 0 );
			if ( $id > 0 && ! isset( $names[ $id ] ) ) {
				$w            = class_exists( 'BizCity_Automation_Repo_Workflows' ) ? BizCity_Automation_Repo_Workflows::find( $id ) : null;
				$names[ $id ] = is_array( $w ) ? (string) ( $w['name'] ?? '' ) : '';
			}
			if ( $id > 0 && empty( $m['workflow_name'] ) ) {
				$m['workflow_name'] = $names[ $id ];
			}
			unset( $m['_cell'] ); // requester identity never leaves the server
			$r['id']       = (int) $r['id'];
			$r['metadata'] = $m;
			$out[]         = $r;
		}
		return new WP_REST_Response( array( 'ok' => true, 'rows' => $out, 'total' => count( $out ) ), 200 );
	}

	/** Manual occurrences: once | daily | weekly × occurrences (≤ 30). They fire through the same scan as cron rows. */
	public static function create_events( WP_REST_Request $req ) {
		$mgr = self::mgr();
		if ( is_wp_error( $mgr ) ) {
			return $mgr;
		}
		$b  = (array) $req->get_json_params();
		$wf = class_exists( 'BizCity_Automation_Repo_Workflows' ) ? BizCity_Automation_Repo_Workflows::find( (int) ( $b['workflow_id'] ?? 0 ) ) : null;
		if ( ! is_array( $wf ) ) {
			return new WP_Error( 'not_found', 'Không tìm thấy kịch bản.', array( 'status' => 404 ) );
		}
		$start = self::datetime( (string) ( $b['start_at'] ?? '' ) );
		if ( '' === $start ) {
			return new WP_Error( 'invalid_start', 'Thời gian bắt đầu không hợp lệ.', array( 'status' => 422 ) );
		}
		$rec   = in_array( (string) ( $b['recurrence'] ?? 'once' ), array( 'once', 'daily', 'weekly' ), true ) ? (string) $b['recurrence'] : 'once';
		$count = 'once' === $rec ? 1 : max( 1, min( 30, (int) ( $b['occurrences'] ?? 1 ) ) );
		$step  = 'weekly' === $rec ? 7 * 86400 : 86400;
		$title = trim( (string) ( $b['title'] ?? '' ) );
		$ids   = array();
		for ( $i = 0; $i < $count; $i++ ) {
			$id = $mgr->create_event( array(
				'user_id'      => (int) get_current_user_id(),
				'title'        => '' !== $title ? $title : (string) ( $wf['name'] ?? 'Kịch bản' ),
				'description'  => (string) ( $b['description'] ?? '' ),
				'start_at'     => gmdate( 'Y-m-d H:i:s', strtotime( $start ) + $i * $step ),
				'reminder_min' => 0,
				'status'       => 'active',
				'source'       => 'workflow',
				'event_type'   => 'automation_workflow',
				'metadata'     => array(
					'workflow_id'   => (int) $wf['id'],
					'workflow_name' => (string) ( $wf['name'] ?? '' ),
					'manual'        => true,
					'report_back'   => false,
					'notify'        => false,
				),
			) );
			if ( ! is_wp_error( $id ) && (int) $id > 0 ) {
				$ids[] = (int) $id;
			}
		}
		return new WP_REST_Response( array( 'ok' => true, 'ids' => $ids ), 201 );
	}

	public static function patch_event( WP_REST_Request $req ) {
		$row = self::row( (int) $req['id'] );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		$b = (array) $req->get_json_params();
		if ( 'active' !== (string) $row['status'] ) {
			return new WP_Error( 'not_editable', 'Chỉ sửa được dòng chưa chạy.', array( 'status' => 409 ) );
		}
		$fields = array();
		if ( isset( $b['start_at'] ) ) {
			$at = self::datetime( (string) $b['start_at'] );
			if ( '' === $at ) {
				return new WP_Error( 'invalid_start', 'Thời gian không hợp lệ.', array( 'status' => 422 ) );
			}
			$fields['start_at'] = $at; // "dời một lần" (doc 103 §4.3)
		}
		if ( isset( $b['title'] ) ) {
			$fields['title'] = substr( trim( (string) $b['title'] ), 0, 190 );
		}
		if ( isset( $b['status'] ) && 'cancelled' === (string) $b['status'] ) {
			$fields['status'] = 'cancelled'; // "bỏ một lần"
		}
		if ( ! $fields ) {
			return new WP_Error( 'nothing_to_change', 'Không có gì để sửa.', array( 'status' => 422 ) );
		}
		$ok = BizCity_Scheduler_Manager::instance()->update_event( (int) $row['id'], $fields );
		return is_wp_error( $ok ) ? $ok : new WP_REST_Response( array( 'ok' => true, 'id' => (int) $row['id'] ), 200 );
	}

	public static function delete_event( WP_REST_Request $req ) {
		$r = self::remove( (int) $req['id'] );
		return is_wp_error( $r ) ? $r : new WP_REST_Response( array( 'ok' => true, 'id' => (int) $req['id'], 'action' => $r ), 200 );
	}

	public static function bulk_delete( WP_REST_Request $req ) {
		$done = array();
		foreach ( array_slice( (array) ( $req->get_json_params()['ids'] ?? array() ), 0, 200 ) as $id ) {
			if ( ! is_wp_error( self::remove( (int) $id ) ) ) {
				$done[] = (int) $id;
			}
		}
		return new WP_REST_Response( array( 'ok' => true, 'ids' => $done ), 200 );
	}

	public static function sync_workflow( WP_REST_Request $req ) {
		$wf = class_exists( 'BizCity_Automation_Repo_Workflows' ) ? BizCity_Automation_Repo_Workflows::find( (int) $req['wf_id'] ) : null;
		if ( ! is_array( $wf ) || ! class_exists( 'BizCity_Automation_Schedule_Manager' ) ) {
			return new WP_Error( 'not_found', 'Không tìm thấy kịch bản.', array( 'status' => 404 ) );
		}
		BizCity_Automation_Schedule_Manager::instance()->sync_workflow_events( $wf );
		return new WP_REST_Response( array( 'ok' => true, 'workflow_id' => (int) $wf['id'] ), 200 );
	}

	public static function catch_up_route( WP_REST_Request $req ) {
		$r = self::catch_up( (int) $req['id'], (int) get_current_user_id() );
		return is_wp_error( $r ) ? $r : new WP_REST_Response( array( 'ok' => true ) + $r, 200 );
	}

	/**
	 * AS-5 "chạy bù" of a `missed` row. `missed` is terminal in the frozen ledger, so the catch-up is a NEW automation_run
	 * row (Run_Ledger::open, source `catchup`, linked both ways: metadata.catchup_of / metadata.catchup_event) and the run
	 * goes out at once through the async loopback, exactly like a cell-requested run. One catch-up per missed row.
	 *
	 * @return array|WP_Error { event_id, run_id }
	 */
	public static function catch_up( int $event_id, int $user_id ) {
		// [2026-10-05 09:20 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-5 — the owner decides to run what the clock missed.
		$row = self::row( $event_id );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		$meta = $row['metadata'];
		if ( 'missed' !== (string) $row['status'] ) {
			return new WP_Error( 'not_missed', 'Chỉ chạy bù được dòng đã lỡ giờ.', array( 'status' => 409 ) );
		}
		if ( ! empty( $meta['catchup_event'] ) ) {
			return new WP_Error( 'already_caught_up', 'Dòng này đã được chạy bù.', array( 'status' => 409, 'event_id' => (int) $meta['catchup_event'] ) );
		}
		$wf_id = (int) ( $meta['workflow_id'] ?? 0 );
		$wf    = class_exists( 'BizCity_Automation_Repo_Workflows' ) ? BizCity_Automation_Repo_Workflows::find( $wf_id ) : null;
		if ( ! is_array( $wf ) || empty( $wf['enabled'] ) ) {
			return new WP_Error( 'workflow_off', 'Kịch bản không còn hoặc đang tắt.', array( 'status' => 409 ) );
		}
		if ( ! class_exists( 'BizCity_Scheduler_Run_Ledger' ) || ! class_exists( 'BizCity_Automation_Repo_Runs' ) ) {
			return new WP_Error( 'unavailable', 'Lịch hoặc Automation chưa sẵn sàng.', array( 'status' => 503 ) );
		}
		$new = BizCity_Scheduler_Run_Ledger::open( array(
			'user_id'     => $user_id > 0 ? $user_id : (int) $row['user_id'],
			'title'       => 'Chạy bù: ' . (string) $row['title'],
			'workflow_id' => $wf_id,
			'source'      => 'catchup',
			'report_back' => false,
			'notify'      => $meta['notify'] ?? false,
		) );
		if ( is_wp_error( $new ) ) {
			return $new;
		}
		$mgr = BizCity_Scheduler_Manager::instance();
		BizCity_Scheduler_Run_Ledger::locked( $event_id, static function () use ( $mgr, $event_id, $new ) {
			$r = BizCity_Scheduler_Run_Ledger::get( $event_id );
			$m = is_array( $r['metadata'] ?? null ) ? $r['metadata'] : array();
			$m['catchup_event'] = (int) $new;
			$mgr->update_event( $event_id, array( 'metadata' => $m ) );
		} );
		BizCity_Scheduler_Run_Ledger::locked( (int) $new, static function () use ( $mgr, $event_id, $new ) {
			$r = BizCity_Scheduler_Run_Ledger::get( (int) $new );
			$m = is_array( $r['metadata'] ?? null ) ? $r['metadata'] : array();
			$m['catchup_of'] = $event_id;
			$mgr->update_event( (int) $new, array( 'metadata' => $m ) );
		} );
		$payload = is_array( $meta['payload'] ?? null ) ? $meta['payload'] : array();
		$payload = array_merge( $payload, array(
			'_trigger'         => 'scheduler',
			'_scheduler_event' => (int) $new,
			'_catchup_of'      => $event_id,
			'scheduled_for'    => $row['start_at'],
		) );
		$run_id = BizCity_Automation_Repo_Runs::enqueue( $wf_id, $payload, '', array( 'user_id' => (int) $row['user_id'] ) );
		if ( is_wp_error( $run_id ) ) {
			BizCity_Scheduler_Run_Ledger::finish( (int) $new, 'failed', array( 'error' => 'enqueue_failed' ) );
			return $run_id;
		}
		do_action( 'bizcity_automation_run_enqueued', $run_id, $wf_id, $payload );
		if ( function_exists( 'wp_schedule_single_event' ) ) {
			wp_schedule_single_event( time(), 'bizcity_automation_run_async', array( $run_id ) );
		}
		if ( function_exists( 'spawn_cron' ) ) {
			spawn_cron();
		}
		return array( 'event_id' => (int) $new, 'run_id' => (string) $run_id );
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	private static function mgr() {
		if ( ! class_exists( 'BizCity_Scheduler_Manager' ) || ! BizCity_Scheduler_Manager::instance()->is_ready() ) {
			return new WP_Error( 'scheduler_unavailable', 'Lịch của website chưa sẵn sàng.', array( 'status' => 503 ) );
		}
		return BizCity_Scheduler_Manager::instance();
	}

	/** Automation row (metadata decoded) or WP_Error. */
	private static function row( int $id ) {
		$mgr = self::mgr();
		if ( is_wp_error( $mgr ) ) {
			return $mgr;
		}
		$r = $mgr->get_event( $id );
		$r = $r ? (array) $r : null;
		if ( ! $r || ! in_array( (string) ( $r['event_type'] ?? '' ), self::TYPES, true ) ) {
			return new WP_Error( 'not_found', 'Không tìm thấy dòng Lịch của kịch bản.', array( 'status' => 404 ) );
		}
		$m             = is_array( $r['metadata'] ?? null ) ? $r['metadata'] : json_decode( (string) ( $r['metadata'] ?? '' ), true );
		$r['metadata'] = is_array( $m ) ? $m : array();
		return $r;
	}

	/** active ⇒ cancelled (history kept); done/failed/cancelled/missed ⇒ removed; running ⇒ refused. @return string|WP_Error */
	private static function remove( int $id ) {
		$row = self::row( $id );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		$mgr = BizCity_Scheduler_Manager::instance();
		if ( 'running' === (string) $row['status'] ) {
			return new WP_Error( 'running', 'Dòng này đang chạy.', array( 'status' => 409 ) );
		}
		if ( 'active' === (string) $row['status'] ) {
			$r = $mgr->update_event( $id, array( 'status' => 'cancelled' ) );
			return is_wp_error( $r ) ? $r : 'cancelled';
		}
		$r = $mgr->delete_event( $id );
		return is_wp_error( $r ) ? $r : 'deleted';
	}

	/** "YYYY-MM-DD", "YYYY-MM-DD HH:MM[:SS]" or "…T…" ⇒ "Y-m-d H:i:s" ('' when unreadable). Site wall clock. */
	private static function datetime( string $s ): string {
		$s = trim( str_replace( 'T', ' ', $s ) );
		if ( preg_match( '/^\d{4}-\d{2}-\d{2}$/', $s ) ) {
			return $s . ' 00:00:00';
		}
		if ( preg_match( '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2})(:\d{2})?/', $s, $m ) ) {
			return $m[1] . ( $m[2] ?? ':00' );
		}
		return '';
	}
}
