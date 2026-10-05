<?php
/**
 * BizCity_Automation_Schedule_Manager
 *
 * ─── Cache Contract ─────────────────────────────────────────────────────────
 * group : 'auto'
 * keys  : 'sched_events_<wf_id>'  → upcoming events for a workflow
 * TTL   : 120 s
 * flush : sync_workflow_events(), cancel_workflow_events(), mark_event_done()
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Bridges Automation workflows (trigger.cron) with bizcity_crm_events so the
 * Automation Calendar UI can read/manage upcoming runs.
 *
 * Responsibilities:
 *  1. sync_workflow_events()  — generate next N occurrences into crm_events.
 *  2. cancel_workflow_events() — cancel all 'active' events for a workflow.
 *  3. mark_event_done()       — called by on_cron_scan after successful fire.
 *  4. cron_next_timestamps()  — pure: parse cron + return N next timestamps.
 *
 * PHP 7.4 compatible (no union types, no nullsafe, no str_contains).
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Core\Automation
 * @since      AUTOMATION-CAL (2026-06-14)
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Schedule_Manager {

	const CACHE_GROUP  = 'auto';
	const EVENT_TYPE   = 'automation_workflow';
	const EVENT_SOURCE = 'workflow';

	// Maximum occurrences to pre-create per workflow.
	const DEFAULT_OCCURRENCES = 30;

	// [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-2 — rolling window (D91-35): rows for the next 14 days, max 30.
	const WINDOW_DAYS = 14;

	/** Fired by Repo_Workflows on every create / update / soft+hard delete (AS-2). */
	const SAVED_HOOK = 'bizcity_automation_workflow_saved';

	/** Per-blog option: the site-local day of the last daily top-up (AS-2). */
	const OPT_TOPUP_DAY = 'bizcity_automation_calendar_topup_day';

	/** Which clock fires a schedule (AS-1, D91-32). */
	const CLOCK_CALENDAR = 'calendar'; // path B: one Lịch row per occurrence, fired by the scheduler
	const CLOCK_SCAN     = 'scan';     // path A: the add-on minute scan (sub-hour rhythms only)

	private static $instance = null;

	/** @var bool */
	private static $hooked = false;

	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {}

	/**
	 * [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-2 — listen to the one save hook + daily top-up on the
	 * existing automation minute cron (option-guarded to once per site-local day). Idempotent.
	 */
	public static function init() {
		if ( self::$hooked ) {
			return;
		}
		self::$hooked = true;
		add_action( self::SAVED_HOOK, array( self::instance(), 'on_workflow_saved' ), 10, 1 );
		if ( class_exists( 'BizCity_Automation_Runner' ) ) {
			// Priority 4: before Trigger_Matcher::on_cron_scan (5) so a fresh deploy has rows before path A skips.
			add_action( BizCity_Automation_Runner::CRON_HOOK, array( self::instance(), 'maybe_daily_top_up' ), 4 );
		}
	}

	// ─── Clock ownership (AS-1) ──────────────────────────────────────────

	/**
	 * [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-1 — which clock owns a schedule string.
	 *
	 *  - `every:N:minutes`            ⇒ scan (the 5-field parser below cannot read it; any N)
	 *  - `* /N * * * *` with N < 60    ⇒ scan (sub-hour rhythm: no Lịch row per tick, S2)
	 *  - any other valid 5-field cron ⇒ calendar (hourly, daily, weekly, monthly … — S1)
	 *  - anything unparseable         ⇒ scan (keeps the old path-A daily fallback instead of going silent)
	 *  - ''                           ⇒ ''
	 */
	public static function clock_for_schedule( string $schedule ): string {
		$schedule = trim( $schedule );
		if ( $schedule === '' ) {
			return '';
		}
		if ( preg_match( '/^every:(\d+):minutes?$/i', $schedule ) ) {
			return self::CLOCK_SCAN;
		}
		if ( preg_match( '#^\*/(\d+)\s+\*\s+\*\s+\*\s+\*$#', $schedule, $m ) && (int) $m[1] < 60 ) {
			return self::CLOCK_SCAN;
		}
		$parts = preg_split( '/\s+/', $schedule );
		if ( ! is_array( $parts ) || count( $parts ) !== 5 ) {
			return self::CLOCK_SCAN;
		}
		foreach ( $parts as $p ) {
			if ( ! preg_match( '/^[0-9*\/,\-]+$/', $p ) ) {
				return self::CLOCK_SCAN;
			}
		}
		return self::CLOCK_CALENDAR;
	}

	/** The scheduler (path B) is present on this site. */
	public static function calendar_live(): bool {
		return class_exists( 'BizCity_Scheduler_Manager' );
	}

	/** Path A must skip this schedule: the scheduler is the only clock for it (S1). */
	public static function calendar_owns( string $schedule ): bool {
		return self::CLOCK_CALENDAR === self::clock_for_schedule( $schedule ) && self::calendar_live();
	}

	// ─── Public API ──────────────────────────────────────────────────────

	/**
	 * [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-2 — `bizcity_automation_workflow_saved` listener. Never throws back
	 * into the repository write that fired it.
	 *
	 * @param mixed $row Workflow row (hydrated), or a stub {id, enabled:0, _deleted:true} after a hard delete.
	 */
	public function on_workflow_saved( $row ) {
		if ( ! is_array( $row ) || empty( $row['id'] ) ) {
			return;
		}
		try {
			$this->sync_workflow_events( $row );
		} catch ( \Throwable $e ) {
			error_log( '[automation][schedule] on_workflow_saved swallowed ' . get_class( $e ) . ': ' . $e->getMessage() );
		}
	}

	/** Top up one workflow's window (after each fire). */
	public function top_up_workflow( $workflow ) {
		if ( is_numeric( $workflow ) && class_exists( 'BizCity_Automation_Repo_Workflows' ) ) {
			$workflow = BizCity_Automation_Repo_Workflows::find( (int) $workflow );
		}
		if ( is_array( $workflow ) && ! empty( $workflow['id'] ) ) {
			$this->on_workflow_saved( $workflow );
		}
	}

	/**
	 * [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-2 — once per site-local day, top up every enabled cron workflow.
	 * Also the deploy bridge: the first tick after this ships creates the rows that path A no longer fires.
	 */
	public function maybe_daily_top_up() {
		if ( defined( 'BIZCITY_DIAGNOSTICS_CLI' ) && BIZCITY_DIAGNOSTICS_CLI ) {
			return;
		}
		if ( ! self::calendar_live() || ! class_exists( 'BizCity_Automation_Repo_Workflows' ) ) {
			return;
		}
		$today = function_exists( 'wp_date' ) ? (string) wp_date( 'Y-m-d' ) : gmdate( 'Y-m-d' );
		if ( (string) get_option( self::OPT_TOPUP_DAY, '' ) === $today ) {
			return;
		}
		update_option( self::OPT_TOPUP_DAY, $today, false );
		try {
			$out = BizCity_Automation_Repo_Workflows::query( array( 'trigger_type' => 'cron', 'enabled' => 1, 'limit' => 200 ) );
			foreach ( (array) ( $out['rows'] ?? array() ) as $wf ) {
				$this->on_workflow_saved( $wf );
			}
		} catch ( \Throwable $e ) {
			error_log( '[automation][schedule] daily top-up swallowed ' . get_class( $e ) . ': ' . $e->getMessage() );
		}
		try {
			$this->sweep_stuck_rows();
		} catch ( \Throwable $e ) {
			error_log( '[automation][schedule] stuck-row sweep swallowed ' . get_class( $e ) . ': ' . $e->getMessage() );
		}
	}

	/**
	 * [2026-10-05 09:00 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-5 — rows the scan already marked sent (reminder_sent = 1) but
	 * still `active` past the 2-hour ceiling (HIL-held runs, workflows switched off before this wave) ⇒ `missed` with reason
	 * `stuck`. Only automation_workflow rows, only through Run_Ledger::missed() (the one writer of these statuses).
	 *
	 * @return int rows settled
	 */
	public function sweep_stuck_rows( int $limit = 200 ): int {
		if ( ! class_exists( 'BizCity_Scheduler_Run_Ledger' ) || ! class_exists( 'BizCity_Scheduler_Manager' ) ) {
			return 0;
		}
		$mgr = BizCity_Scheduler_Manager::instance();
		if ( ! method_exists( $mgr, 'is_ready' ) || ! method_exists( $mgr, 'get_table' ) || ! $mgr->is_ready() ) {
			return 0;
		}
		global $wpdb;
		$ceiling = class_exists( 'BizCity_Automation_Trigger_Matcher' ) ? BizCity_Automation_Trigger_Matcher::MAX_LATE_DEFAULT : 7200;
		$cutoff  = gmdate( 'Y-m-d H:i:s', current_time( 'timestamp' ) - $ceiling ); // site-local wall string, like start_at
		$ids    = $wpdb->get_col( $wpdb->prepare(
			'SELECT id FROM ' . $mgr->get_table() . " WHERE event_type = %s AND status = 'active' AND reminder_sent = 1 AND start_at < %s ORDER BY id ASC LIMIT %d",
			'automation_workflow',
			$cutoff,
			max( 1, $limit )
		) );
		$n = 0;
		foreach ( (array) $ids as $id ) {
			if ( BizCity_Scheduler_Run_Ledger::missed( (int) $id, 'stuck' ) ) {
				$n++;
			}
		}
		return $n;
	}

	/**
	 * Reconcile the Lịch rows of one workflow with its schedule (idempotent — safe on every save and every fire).
	 *
	 * [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-1/AS-2 — was "cancel everything, insert 30"; now:
	 *  - not an enabled calendar-clock cron workflow (disabled, deleted, other trigger, sub-hour) ⇒ cancel its `active` rows;
	 *  - else keep future `active` rows that still match, cancel the ones that do not, insert the missing occurrences
	 *    of the next WINDOW_DAYS days (max DEFAULT_OCCURRENCES future rows). `running`/past rows are never touched.
	 * start_at strings are computed exactly as before (gmdate of cron_next_timestamps — doc 103 §2 note: the UTC/local
	 * offsets cancel out against claim_due_reminders; do not "fix" one side). Occurrences whose string is already in the
	 * past by that same convention are not inserted (they would be claimed at once as catch-up).
	 *
	 * @param array $workflow Full workflow row.
	 */
	public function sync_workflow_events( array $workflow ) {
		// [2026-06-14 Johnny Chu] AUTOMATION-CAL — sync crm_events for cron workflow
		$wf_id   = (int) ( $workflow['id'] ?? 0 );
		if ( $wf_id <= 0 ) {
			return;
		}
		$enabled = (int) ( $workflow['enabled'] ?? 0 );
		$ttype   = (string) ( $workflow['trigger_type'] ?? '' );

		$cfg      = array();
		$cfg_raw  = $workflow['trigger_config_json'] ?? ( $workflow['trigger_config'] ?? '' );
		if ( is_array( $cfg_raw ) ) {
			$cfg = $cfg_raw;
		} elseif ( is_string( $cfg_raw ) && $cfg_raw !== '' ) {
			$decoded = json_decode( $cfg_raw, true );
			if ( is_array( $decoded ) ) {
				$cfg = $decoded;
			}
		}
		$schedule = trim( (string) ( $cfg['schedule'] ?? '' ) );

		$wants_rows = empty( $workflow['_deleted'] )
			&& $enabled
			&& $ttype === 'cron'
			&& self::CLOCK_CALENDAR === self::clock_for_schedule( $schedule );

		$scheduler = $this->get_scheduler();
		if ( ! $wants_rows || ! $scheduler ) {
			// Disabled / deleted / not cron / sub-hour rhythm (S2: no row per tick) ⇒ no future rows.
			$this->cancel_workflow_events( $wf_id );
			return;
		}

		$wf_name = (string) ( $workflow['name'] ?? ( 'Workflow #' . $wf_id ) );
		// [2026-07-16 Johnny Chu] PHASE-TWINWEB F4 — fail-closed owner contract: cron schedule rows must use persisted workflow owner.
		$user_id = (int) ( $workflow['created_by'] ?? 0 );
		if ( $user_id <= 0 ) {
			if ( class_exists( 'BizCity_Cron_Manager' ) ) {
				BizCity_Cron_Manager::instance()->note_event( 'automation_schedule_owner_missing', array(
					'reason'      => 'owner_missing',
					'workflow_id' => $wf_id,
				) );
			}
			return;
		}

		$now_local = current_time( 'mysql' );
		$horizon   = time() + self::WINDOW_DAYS * DAY_IN_SECONDS;
		$desired   = array(); // start_at string => occurrence index
		foreach ( $this->cron_next_timestamps( $schedule, self::DEFAULT_OCCURRENCES, 0, $horizon ) as $ts ) {
			$at = gmdate( 'Y-m-d H:i:s', $ts );
			if ( $at > $now_local ) {
				$desired[ $at ] = count( $desired ) + 1;
			}
		}

		// Existing future rows: keep the ones that still match, cancel the rest.
		$kept = 0;
		foreach ( $this->future_active_rows( $wf_id, $now_local ) as $row ) {
			$at   = (string) ( $row['start_at'] ?? '' );
			$meta = json_decode( (string) ( $row['metadata'] ?? '' ), true );
			$expr = is_array( $meta ) ? (string) ( $meta['cron_expr'] ?? '' ) : '';
			if ( isset( $desired[ $at ] ) && $expr === $schedule ) {
				unset( $desired[ $at ] );
				$kept++;
				continue;
			}
			$this->cancel_event_row( (int) $row['id'] );
		}

		foreach ( $desired as $at => $idx ) {
			if ( $kept >= self::DEFAULT_OCCURRENCES ) {
				break;
			}
			$meta = array(
				'workflow_id'   => $wf_id,
				'workflow_name' => $wf_name,
				'cron_expr'     => $schedule,
				'recurrence'    => 'cron',
				'occurrence'    => $idx,
				'run_status'    => 'pending',
				// [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-7/RUN-LEDGER-API — cron rows: milestone messages, no report-back.
				'notify'        => array( 'level' => 'full' ),
				'report_back'   => false,
				'inbound'       => array(
					'platform'  => 'ADMIN',
					'chat_id'   => '',
					'user_id'   => (string) $user_id,
					'intent_tag'=> 'workflow_cron',
				),
			);
			$scheduler->create_event( array(
				'user_id'    => $user_id,
				'title'      => $wf_name,
				'start_at'   => $at,
				'status'     => 'active',
				'event_type' => self::EVENT_TYPE,
				'source'     => self::EVENT_SOURCE,
				// [2026-06-14 Johnny Chu] GAP-1 — fire AT start_at, not 15 min early (default).
				'reminder_min' => 0,
				'metadata'   => $meta,
			) );
			$kept++;
		}

		$this->flush_cache();
	}

	/** Future `active` rows of one workflow (start_at strictly after $now_local). */
	private function future_active_rows( int $wf_id, string $now_local ): array {
		global $wpdb;
		$table = $wpdb->prefix . 'bizcity_crm_events';
		if ( ! $this->table_exists( $table ) ) {
			return array();
		}
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id, start_at, metadata FROM `{$table}`
				  WHERE event_type = %s
				    AND source = %s
				    AND status = 'active'
				    AND JSON_EXTRACT(metadata, '$.workflow_id') = %d
				    AND start_at > %s
				  ORDER BY start_at ASC
				  LIMIT 200",
				self::EVENT_TYPE,
				self::EVENT_SOURCE,
				$wf_id,
				$now_local
			),
			ARRAY_A
		);
		return is_array( $rows ) ? $rows : array();
	}

	/** Cancel one future `active` row (Schedule_Manager may cancel active rows — RUN-LEDGER-API rules). */
	private function cancel_event_row( int $id ) {
		global $wpdb;
		$table = $wpdb->prefix . 'bizcity_crm_events';
		$wpdb->query(
			$wpdb->prepare(
				"UPDATE `{$table}` SET status = 'cancelled', updated_at = %s WHERE id = %d AND status = 'active'",
				current_time( 'mysql' ),
				$id
			)
		);
	}

	private function flush_cache() {
		if ( class_exists( 'BizCity_Cache' ) ) {
			BizCity_Cache::flush_group( self::CACHE_GROUP );
		}
	}

	/**
	 * Cancel all pending events for a workflow (set status → 'cancelled').
	 *
	 * @param int $wf_id Workflow ID.
	 */
	public function cancel_workflow_events( int $wf_id ) {
		// [2026-06-14 Johnny Chu] AUTOMATION-CAL — cancel crm_events on disable/delete
		global $wpdb;
		$table = $wpdb->prefix . 'bizcity_crm_events';
		if ( ! $this->table_exists( $table ) ) {
			return;
		}

		$wpdb->query(
			$wpdb->prepare(
				"UPDATE `{$table}` SET status = 'cancelled', updated_at = %s
				  WHERE event_type = %s
				    AND source = %s
				    AND status = 'active'
				    AND JSON_EXTRACT(metadata, '$.workflow_id') = %d",
				current_time( 'mysql' ),
				self::EVENT_TYPE,
				self::EVENT_SOURCE,
				$wf_id
			)
		);

		$this->flush_cache();
	}

	/**
	 * Mark the next pending event for a workflow as done.
	 * Called by BizCity_Automation_Trigger_Matcher::on_cron_scan after firing.
	 *
	 * @param int $wf_id    Workflow ID (used to find event when event_id=0).
	 * @param int $event_id Optional: exact crm_events.id — skips lookup query.
	 */
	public function mark_event_done( int $wf_id, int $event_id = 0 ) {
		// [2026-06-14 Johnny Chu] GAP-2/GAP-3 — mark crm_event done; merge metadata (not replace); accept event_id to skip lookup
		global $wpdb;
		$table = $wpdb->prefix . 'bizcity_crm_events';
		if ( ! $this->table_exists( $table ) ) {
			return;
		}

		$now = current_time( 'mysql' );

		// Resolve the row to update.
		if ( $event_id > 0 ) {
			// Caller provided exact ID (from on_scheduler_fire) — use directly.
			$row_id = $event_id;
		} else {
			// Find the earliest active event at or before now for this workflow.
			$found = $wpdb->get_row(
				$wpdb->prepare(
					"SELECT id FROM `{$table}`
					  WHERE event_type = %s
					    AND source = %s
					    AND status = 'active'
					    AND JSON_EXTRACT(metadata, '$.workflow_id') = %d
					    AND start_at <= %s
					  ORDER BY start_at ASC
					  LIMIT 1",
					self::EVENT_TYPE,
					self::EVENT_SOURCE,
					$wf_id,
					$now
				)
			);
			if ( ! $found ) {
				$this->flush_cache();
				return;
			}
			$row_id = (int) $found->id;
		}

		$scheduler = $this->get_scheduler();
		if ( ! $scheduler ) {
			$this->flush_cache();
			return;
		}

		// [2026-06-14 Johnny Chu] GAP-2 — read existing metadata, MERGE, then update.
		// R-SCH-REPLY: NEVER replace metadata wholesale — decode → merge → encode.
		$existing_event = $scheduler->get_event( $row_id );
		$existing_meta  = array();
		if ( $existing_event && ! empty( $existing_event->metadata ) ) {
			$decoded = json_decode( $existing_event->metadata, true );
			if ( is_array( $decoded ) ) {
				$existing_meta = $decoded;
			}
		}
		$merged_meta = array_merge( $existing_meta, array(
			'run_status' => 'done',
			'done_at'    => $now,
		) );

		$scheduler->update_event( $row_id, array(
			'status'   => 'done',
			'metadata' => $merged_meta,
		) );

		$this->flush_cache();
	}

	/**
	 * Get upcoming events for a workflow from the cache or DB.
	 *
	 * @param int $wf_id     Workflow ID.
	 * @param int $limit     Max rows.
	 * @return array
	 */
	public function get_events_for_workflow( int $wf_id, int $limit = 60 ) {
		$cache_key = 'sched_events_' . $wf_id;
		$cached    = BizCity_Cache::get( self::CACHE_GROUP, $cache_key );
		if ( false !== $cached ) {
			return $cached;
		}

		$scheduler = $this->get_scheduler();
		if ( ! $scheduler ) {
			return array();
		}

		global $wpdb;
		$table = $wpdb->prefix . 'bizcity_crm_events';
		if ( ! $this->table_exists( $table ) ) {
			return array();
		}

		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM `{$table}`
				  WHERE event_type = %s
				    AND source = %s
				    AND JSON_EXTRACT(metadata, '$.workflow_id') = %d
				  ORDER BY start_at ASC
				  LIMIT %d",
				self::EVENT_TYPE,
				self::EVENT_SOURCE,
				$wf_id,
				$limit
			),
			ARRAY_A
		);

		$result = is_array( $rows ) ? $rows : array();
		BizCity_Cache::set( self::CACHE_GROUP, $cache_key, $result, 120 );
		return $result;
	}

	// ─── Cron expression parser ───────────────────────────────────────────

	/**
	 * Parse a cron expression and return the next N Unix timestamps from $start.
	 *
	 * Supports standard 5-field cron: min hour dom month dow.
	 * No year field. No special strings (@hourly etc) — keep it simple.
	 *
	 * @param string $expr    Cron expression e.g. "0 9 * * *".
	 * @param int    $count   Number of occurrences to return.
	 * @param int    $start   Unix timestamp to start searching from (default: now).
	 * @param int    $until   Optional: stop once the cursor passes this timestamp (0 = no horizon).
	 * @return int[]          Array of Unix timestamps.
	 */
	public function cron_next_timestamps( string $expr, int $count = 30, int $start = 0, int $until = 0 ) {
		// [2026-06-14 Johnny Chu] AUTOMATION-CAL — cron expression parser (5-field)
		if ( $start <= 0 ) {
			$start = time();
		}

		$parts = preg_split( '/\s+/', trim( $expr ), 5 );
		if ( ! is_array( $parts ) || count( $parts ) < 5 ) {
			return array();
		}

		list( $f_min, $f_hour, $f_dom, $f_month, $f_dow ) = $parts;

		$results = array();
		// Start from next minute boundary.
		$cursor = $start - ( $start % 60 ) + 60;

		// Safety: max 60*24*365 = 525600 iterations (~1 year look-ahead).
		$max_iter = 525600;
		$iter     = 0;

		while ( count( $results ) < $count && $iter < $max_iter ) {
			$iter++;
			// [2026-10-05 04:40 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-2 — optional horizon (rolling window); the matching itself is unchanged.
			if ( $until > 0 && $cursor > $until ) {
				break;
			}
			$m   = (int) gmdate( 'i', $cursor );
			$h   = (int) gmdate( 'G', $cursor );
			$dom = (int) gmdate( 'j', $cursor );
			$mon = (int) gmdate( 'n', $cursor );
			$dow = (int) gmdate( 'w', $cursor ); // 0=Sun…6=Sat

			if (
				$this->cron_field_matches( $f_month, $mon, 1, 12 ) &&
				$this->cron_field_matches( $f_dom,   $dom, 1, 31 ) &&
				$this->cron_field_matches( $f_dow,   $dow, 0, 6 ) &&
				$this->cron_field_matches( $f_hour,  $h,   0, 23 ) &&
				$this->cron_field_matches( $f_min,   $m,   0, 59 )
			) {
				$results[] = $cursor;
				// Skip to next minute to avoid duplicate.
				$cursor += 60;
				continue;
			}

			$cursor += 60;
		}

		return $results;
	}

	/**
	 * Check whether a single cron field matches a value.
	 *
	 * Supports: * / step / list / range (a-b) / range+step (a-b/c).
	 *
	 * @param string $field  Field string from cron expression.
	 * @param int    $value  Current value.
	 * @param int    $min    Field minimum.
	 * @param int    $max    Field maximum.
	 * @return bool
	 */
	private function cron_field_matches( string $field, int $value, int $min, int $max ) {
		// Handle comma-separated lists.
		if ( strpos( $field, ',' ) !== false ) {
			foreach ( explode( ',', $field ) as $part ) {
				if ( $this->cron_field_matches( trim( $part ), $value, $min, $max ) ) {
					return true;
				}
			}
			return false;
		}

		// Handle step: */N or a-b/N.
		if ( strpos( $field, '/' ) !== false ) {
			$sub   = explode( '/', $field, 2 );
			$range = $sub[0];
			$step  = max( 1, (int) $sub[1] );
			if ( $range === '*' || $range === '' ) {
				return ( ( $value - $min ) % $step ) === 0;
			}
			// Range/step e.g. 0-30/5
			if ( strpos( $range, '-' ) !== false ) {
				$bounds = explode( '-', $range, 2 );
				$lo     = (int) $bounds[0];
				$hi     = (int) $bounds[1];
				return $value >= $lo && $value <= $hi && ( ( $value - $lo ) % $step ) === 0;
			}
			return false;
		}

		// Wildcard.
		if ( $field === '*' ) {
			return true;
		}

		// Range a-b.
		if ( strpos( $field, '-' ) !== false ) {
			$bounds = explode( '-', $field, 2 );
			$lo     = (int) $bounds[0];
			$hi     = (int) $bounds[1];
			return $value >= $lo && $value <= $hi;
		}

		// Exact value.
		return (int) $field === $value;
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	private function get_scheduler() {
		if ( ! class_exists( 'BizCity_Scheduler_Manager' ) ) {
			return null;
		}
		return BizCity_Scheduler_Manager::instance();
	}

	private function table_exists( string $table ) {
		global $wpdb;
		return (bool) $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
	}
}
