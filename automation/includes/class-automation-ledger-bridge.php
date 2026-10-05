<?php
/**
 * BizCity_Automation_Ledger_Bridge — the ONE place where an Automation run writes back to its Lịch row
 * (PHASE-0.91 AS-4 + AS-11, doc 103 §3 S5 / §3a tier 1, doc 102 §12.3).
 *
 * Runner hook                                   ⇒ BizCity_Scheduler_Run_Ledger (core/scheduler, frozen API)
 *   bizcity_automation_run_started( run, wf )   ⇒ running( event, run, total )  — total = nodes minus triggers
 *   bizcity_automation_log_appended( run, log ) ⇒ step( event, {step,node_id,block_id,label,status,error} )
 *   bizcity_automation_run_ended( run, ok, ctx )⇒ finish( event, done|failed, {progress, error, log_url} )
 *
 * Link run → row: the run's trigger payload `_scheduler_event` (set by Trigger_Matcher::on_scheduler_fire for cron rows,
 * and by automation.run_scenario for the automation_run row it opens — PHASE-0.91 AX-2.2 / D91-34). Runs without it
 * are ignored here.
 * Logs are read through Repo_Runs::log_by_id() / logs() only — they may live in JSONL files, never SELECT the log
 * table. On failure the run_ended $ctx only carries 'error' (trap #20) ⇒ the run row is always re-read.
 * The failing node's log is updated without a log_appended hook ⇒ the fail step is recovered at run_ended.
 * Never throws back into the runner.
 *
 * // [2026-10-05 04:46 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AS-4 / AS-11 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Automation
 * @since      2026-10-05
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Ledger_Bridge {

	/** @var array<string,int> run_id => event id (0 = not a scheduler run), request cache */
	private static $events = array();

	/** @var array<string,array> run_id => { triggers:int, total:int, labels:array<string,string>, wf_id:int } */
	private static $shape = array();

	/** @var bool */
	private static $hooked = false;

	public static function init(): void {
		if ( self::$hooked ) {
			return;
		}
		self::$hooked = true;
		add_action( 'bizcity_automation_run_started', array( __CLASS__, 'on_run_started' ), 20, 2 );
		add_action( 'bizcity_automation_log_appended', array( __CLASS__, 'on_log_appended' ), 20, 2 );
		add_action( 'bizcity_automation_run_ended', array( __CLASS__, 'on_run_ended' ), 20, 3 );
	}

	public static function available(): bool {
		return class_exists( 'BizCity_Scheduler_Run_Ledger' ) && class_exists( 'BizCity_Automation_Repo_Runs' );
	}

	/** Forget request caches (tests). */
	public static function reset(): void {
		self::$events = array();
		self::$shape  = array();
	}

	// ─── Hooks ───────────────────────────────────────────────────────────

	/**
	 * @param mixed $run_id
	 * @param mixed $wf Workflow row the runner is executing.
	 */
	public static function on_run_started( $run_id, $wf = null ): void {
		try {
			$run_id   = (string) $run_id;
			$event_id = self::event_for_run( $run_id );
			if ( $event_id <= 0 ) {
				return;
			}
			$row  = BizCity_Scheduler_Run_Ledger::get( $event_id );
			$meta = is_array( $row ) && is_array( $row['metadata'] ?? null ) ? $row['metadata'] : array();
			if ( isset( $meta['run_id'] ) && (string) $meta['run_id'] === $run_id && 'running' === (string) ( $row['status'] ?? '' ) ) {
				return; // already announced: running() fires message ① — exactly once per run.
			}
			$shape = self::shape( $run_id, is_array( $wf ) ? $wf : null );
			BizCity_Scheduler_Run_Ledger::running( $event_id, $run_id, (int) $shape['total'] );
		} catch ( \Throwable $e ) {
			self::swallow( 'run_started', $e );
		}
	}

	/**
	 * @param mixed $run_id
	 * @param mixed $log_id
	 */
	public static function on_log_appended( $run_id, $log_id = 0 ): void {
		try {
			$run_id   = (string) $run_id;
			$event_id = self::event_for_run( $run_id );
			if ( $event_id <= 0 || (int) $log_id <= 0 ) {
				return;
			}
			$log = BizCity_Automation_Repo_Runs::log_by_id( $run_id, (int) $log_id );
			if ( empty( $log ) ) {
				return;
			}
			$step = self::step_from_log( $run_id, $log );
			if ( $step ) {
				BizCity_Scheduler_Run_Ledger::step( $event_id, $step );
			}
		} catch ( \Throwable $e ) {
			self::swallow( 'log_appended', $e );
		}
	}

	/**
	 * @param mixed $run_id
	 * @param mixed $ok  Unused: the run row is the truth (trap #20).
	 * @param mixed $ctx Unused: only 'error' on the failure path.
	 */
	public static function on_run_ended( $run_id, $ok = null, $ctx = null ): void {
		unset( $ok, $ctx );
		try {
			self::settle_run( (string) $run_id );
		} catch ( \Throwable $e ) {
			self::swallow( 'run_ended', $e );
		}
	}

	/**
	 * Finish the run's Lịch row from the run row. Idempotent (Run_Ledger::finish refuses a terminal row), so
	 * Trigger_Matcher may call it again after a synchronous run as a safety net.
	 *
	 * @return bool true when a finish() was written.
	 */
	public static function settle_run( string $run_id ): bool {
		$event_id = self::event_for_run( $run_id );
		if ( $event_id <= 0 ) {
			return false;
		}
		$row = BizCity_Scheduler_Run_Ledger::get( $event_id );
		if ( is_array( $row ) && in_array( (string) ( $row['status'] ?? '' ), array( 'done', 'failed', 'cancelled', 'missed' ), true ) ) {
			return false; // already settled (the safety-net call after a synchronous run lands here)
		}
		$run = BizCity_Automation_Repo_Runs::find( $run_id ); // re-read: on failure $ctx only has 'error'
		if ( ! is_array( $run ) ) {
			return false;
		}
		$status = (int) ( $run['status'] ?? -1 );
		$ok     = BizCity_Automation_Repo_Runs::STATUS_OK;
		$fail   = BizCity_Automation_Repo_Runs::STATUS_FAIL;
		$cancel = BizCity_Automation_Repo_Runs::STATUS_CANCELLED;
		if ( ! in_array( $status, array( $ok, $fail, $cancel ), true ) ) {
			return false; // still queued / running / paused — a later run_ended settles it.
		}

		$extra = array();
		$url   = self::log_url( (int) ( $run['workflow_id'] ?? 0 ), $run_id );
		if ( '' !== $url ) {
			$extra['log_url'] = $url;
		}
		// [2026-10-05 07:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-2.2 (D91-34) — the answer of the run's return_to_cell node goes
		// onto the Lịch row (reply_text + artifacts); Scheduler_Report_Back builds the job_result from the row. No second sender.
		$reply = self::return_to_cell( $run_id );
		if ( '' !== $reply['text'] ) {
			$extra['reply_text'] = $reply['text'];
		}
		if ( $reply['artifacts'] ) {
			$extra['artifacts'] = $reply['artifacts'];
		}
		if ( $status === $ok ) {
			return BizCity_Scheduler_Run_Ledger::finish( $event_id, 'done', $extra );
		}

		// failed / cancelled: recover the failing step (its log update fires no log_appended).
		$failed = self::failed_step( $run_id );
		if ( $failed ) {
			BizCity_Scheduler_Run_Ledger::step( $event_id, $failed );
			$extra['progress'] = array(
				'failed_step'  => (int) $failed['step'],
				'failed_block' => (string) $failed['block_id'],
			);
		}
		$error = trim( (string) ( $run['error'] ?? '' ) );
		if ( '' === $error && $status === $cancel ) {
			$error = 'cancelled';
		}
		if ( '' === $error && $failed && ! empty( $failed['error'] ) ) {
			$error = (string) $failed['error'];
		}
		if ( '' !== $error ) {
			$extra['error'] = $error;
		}
		return BizCity_Scheduler_Run_Ledger::finish( $event_id, 'failed', $extra );
	}

	/** Lịch row of a run (trigger payload `_scheduler_event`), 0 when the run did not come from a Lịch row. */
	public static function event_for_run( string $run_id ): int {
		if ( '' === $run_id || ! self::available() ) {
			return 0;
		}
		if ( isset( self::$events[ $run_id ] ) ) {
			return self::$events[ $run_id ];
		}
		$run     = BizCity_Automation_Repo_Runs::find( $run_id );
		$payload = is_array( $run ) && is_array( $run['trigger_payload'] ?? null ) ? $run['trigger_payload'] : array();
		return self::$events[ $run_id ] = max( 0, (int) ( $payload['_scheduler_event'] ?? 0 ) );
	}

	// ─── Helpers ─────────────────────────────────────────────────────────

	/** Workflow shape for one run: trigger count, step total (nodes minus triggers), node labels. */
	private static function shape( string $run_id, $wf = null ): array {
		if ( isset( self::$shape[ $run_id ] ) ) {
			return self::$shape[ $run_id ];
		}
		if ( ! is_array( $wf ) && class_exists( 'BizCity_Automation_Repo_Workflows' ) ) {
			$run = BizCity_Automation_Repo_Runs::find( $run_id );
			$wf  = is_array( $run ) ? BizCity_Automation_Repo_Workflows::find( (int) ( $run['workflow_id'] ?? 0 ) ) : null;
		}
		$graph = is_array( $wf ) ? ( $wf['graph'] ?? null ) : null;
		if ( ! is_array( $graph ) && is_array( $wf ) && is_string( $wf['graph_json'] ?? null ) ) {
			$graph = json_decode( (string) $wf['graph_json'], true );
		}
		$nodes    = is_array( $graph ) && is_array( $graph['nodes'] ?? null ) ? $graph['nodes'] : array();
		$triggers = 0;
		$labels   = array();
		foreach ( $nodes as $n ) {
			if ( ! is_array( $n ) ) {
				continue;
			}
			if ( self::is_trigger_node( $n ) ) {
				$triggers++;
				continue;
			}
			$label = (string) ( $n['data']['label'] ?? '' );
			if ( '' !== $label && isset( $n['id'] ) ) {
				$labels[ (string) $n['id'] ] = $label;
			}
		}
		return self::$shape[ $run_id ] = array(
			'triggers' => $triggers,
			'total'    => max( 0, count( $nodes ) - $triggers ),
			'labels'   => $labels,
		);
	}

	private static function is_trigger_node( array $n ): bool {
		if ( 'trigger' === (string) ( $n['type'] ?? '' ) ) {
			return true;
		}
		return 0 === strpos( (string) ( $n['data']['blockId'] ?? '' ), 'trigger.' );
	}

	/**
	 * Ledger step from one runner log, or null for non-terminal / trigger logs.
	 * Runner `step` counts the trigger node(s) too; the ledger counts only the n work steps (total = n).
	 */
	private static function step_from_log( string $run_id, array $log ) {
		$map    = array( 1 => 'ok', 2 => 'fail', 3 => 'skip' ); // Runner::LOG_STATUS_OK / FAIL / SKIP
		$status = (int) ( $log['status'] ?? 0 );
		if ( ! isset( $map[ $status ] ) ) {
			return null; // LOG_STATUS_RUNNING — the same log comes back once it ends
		}
		$block = (string) ( $log['block_id'] ?? '' );
		if ( 0 === strpos( $block, 'trigger.' ) ) {
			return null;
		}
		$shape = self::shape( $run_id );
		$node  = (string) ( $log['node_id'] ?? '' );
		$out   = array(
			'step'     => max( 1, (int) ( $log['step'] ?? 0 ) - (int) $shape['triggers'] ),
			'node_id'  => $node,
			'block_id' => $block,
			'status'   => $map[ $status ],
			'error'    => (string) ( $log['error'] ?? '' ),
		);
		if ( isset( $shape['labels'][ $node ] ) ) {
			$out['label'] = $shape['labels'][ $node ];
		}
		return $out;
	}

	/**
	 * {text, artifacts[]} of the last finished action.return_to_cell node of a run ('' / [] when none).
	 * Read through the repository (SQL or JSONL logs), like every other log read here.
	 */
	private static function return_to_cell( string $run_id ): array {
		// [2026-10-05 07:10 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-2.2 — the node shapes the answer, it never sends.
		$out = array( 'text' => '', 'artifacts' => array() );
		foreach ( (array) BizCity_Automation_Repo_Runs::logs( $run_id ) as $log ) {
			if ( ! is_array( $log ) || 'action.return_to_cell' !== (string) ( $log['block_id'] ?? '' ) ) {
				continue;
			}
			$o = $log['output'] ?? null;
			if ( is_string( $o ) ) {
				$o = json_decode( $o, true );
			}
			if ( 1 === (int) ( $log['status'] ?? 0 ) && is_array( $o ) && 'queued' === (string) ( $o['status'] ?? '' ) ) {
				$out = array(
					'text'      => trim( (string) ( $o['text'] ?? '' ) ),
					'artifacts' => is_array( $o['artifacts'] ?? null ) ? array_values( $o['artifacts'] ) : array(),
				);
			} elseif ( 2 === (int) ( $log['status'] ?? 0 ) && '' !== trim( (string) ( $log['error'] ?? '' ) ) ) {
				$out['text'] = trim( (string) $log['error'] ); // status "failed" on the node: its text is the answer
			}
		}
		return $out;
	}

	/** Last failed (non-trigger) step of a run, read through the repository (SQL or JSONL). */
	private static function failed_step( string $run_id ) {
		$found = null;
		foreach ( (array) BizCity_Automation_Repo_Runs::logs( $run_id ) as $log ) {
			if ( is_array( $log ) && 2 === (int) ( $log['status'] ?? 0 ) ) {
				$step = self::step_from_log( $run_id, $log );
				if ( $step ) {
					$found = $step;
				}
			}
		}
		return $found;
	}

	private static function log_url( int $wf_id, string $run_id ): string {
		if ( $wf_id <= 0 || ! function_exists( 'admin_url' ) ) {
			return '';
		}
		return (string) admin_url( 'admin.php?page=bizcity-automation&run_id=' . rawurlencode( $run_id ) . '#/builder/' . $wf_id );
	}

	private static function swallow( string $where, \Throwable $e ): void {
		error_log( '[automation][ledger-bridge] ' . $where . ' swallowed ' . get_class( $e ) . ': ' . $e->getMessage() );
	}
}
