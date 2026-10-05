<?php
/**
 * Action: Trả kết quả về cho trợ lý — the answer + links a cell-requested run reports back
 * (PHASE-0.91 AX-2.1, contract automation-scenario@1 §5, doc 101 C1).
 *
 * This block SENDS NOTHING (R-VA-7: every message goes through the cell). It only shapes `{ text, artifacts[] }`;
 * at run_ended the Ledger Bridge copies it onto the run's Lịch row (Run_Ledger::finish) and
 * BizCity_Scheduler_Report_Back posts the `job_result` letter. A run without a `_cell` requester (cron, webhook)
 * answers `skipped` — that is not an error.
 *
 * Fields: text (default "{{llm.output}}"), artifacts (one per line: `url | title` or `kind | title | url`),
 * status (auto | ok | failed — `failed` makes the run fail on purpose with this text).
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026).
 *
 * // [2026-10-05 06:12 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-2.1 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Core\Automation\Blocks\Actions
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Action_Return_To_Cell extends BizCity_Automation_Block_Base {

	const ARTIFACTS_MAX = 10;

	public function id(): string   { return 'action.return_to_cell'; }
	public function kind(): string { return 'action'; }

	public function meta(): array {
		return array(
			'label'    => 'Trả kết quả về cho trợ lý',
			'short'    => 'Trả về',
			'category' => 'action',
			'color'    => '#2563eb',
			'icon'     => 'reply',
			'defaults' => array( 'label' => 'Trả kết quả', 'text' => '{{llm.output}}', 'artifacts' => '', 'status' => 'auto' ),
			'fields'   => array(
				array( 'name' => 'label',     'label' => 'Tên hiển thị', 'type' => 'text' ),
				array( 'name' => 'text',      'label' => 'Câu trả về',   'type' => 'textarea' ),
				array( 'name' => 'artifacts', 'label' => 'Link kết quả (mỗi dòng: url | tiêu đề)', 'type' => 'textarea', 'hint' => 'Bắt buộc khi kịch bản tạo ra thứ xem được (bài, đơn, file, báo cáo).' ),
				array( 'name' => 'status',    'label' => 'Trạng thái',   'type' => 'select', 'options' => array( 'auto', 'ok', 'failed' ) ),
			),
		);
	}

	public function execute( array $ctx, array $data ) {
		// [2026-10-05 06:12 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-2.1 — shape the answer; never send.
		$cell = isset( $ctx['trigger']['_cell'] ) && is_array( $ctx['trigger']['_cell'] ) ? $ctx['trigger']['_cell'] : array();
		if ( ! $cell ) {
			return array( 'status' => 'skipped', 'reason' => 'no_cell_requester' );
		}
		$text = trim( (string) $this->resolve( (string) ( $data['text'] ?? '' ), $ctx ) );
		if ( preg_match( '/\{\{\s*[a-z0-9_.]+\s*\}\}/i', $text ) ) {
			return new WP_Error( 'unresolved_placeholder', 'return_to_cell: còn placeholder chưa resolve.' );
		}
		$artifacts = self::parse_artifacts( (string) $this->resolve( (string) ( $data['artifacts'] ?? '' ), $ctx ) );
		if ( '' === $text && ! $artifacts ) {
			return new WP_Error( 'empty_result', 'return_to_cell: không có câu trả về và cũng không có link kết quả.' );
		}
		if ( 'failed' === (string) ( $data['status'] ?? '' ) ) {
			return new WP_Error( 'scenario_reported_failure', '' !== $text ? $text : 'Kịch bản báo không làm được.' );
		}
		return array( 'status' => 'queued', 'text' => $text, 'artifacts' => $artifacts );
	}

	/**
	 * Lines `url | title`, `kind | title | url`, or a JSON list [{kind,title,url}] ⇒ [{kind,title,url}] (≤ 10).
	 * Only http(s) links; a line without a link is dropped.
	 */
	public static function parse_artifacts( string $raw ): array {
		$raw = trim( $raw );
		if ( '' === $raw ) {
			return array();
		}
		$items = array();
		$json  = json_decode( $raw, true );
		if ( is_array( $json ) ) {
			foreach ( $json as $a ) {
				if ( is_array( $a ) ) {
					$items[] = array( (string) ( $a['kind'] ?? '' ), (string) ( $a['title'] ?? '' ), (string) ( $a['url'] ?? '' ) );
				}
			}
		} else {
			foreach ( preg_split( '/\r?\n/', $raw ) as $line ) {
				$parts = array_map( 'trim', explode( '|', $line ) );
				$url   = '';
				$rest  = array();
				foreach ( $parts as $p ) {
					if ( '' === $url && preg_match( '#^https?://\S+$#i', $p ) ) {
						$url = $p;
					} elseif ( '' !== $p ) {
						$rest[] = $p;
					}
				}
				$kind  = count( $rest ) >= 2 ? $rest[0] : 'link';
				$title = count( $rest ) >= 2 ? $rest[1] : ( $rest[0] ?? '' );
				$items[] = array( $kind, $title, $url );
			}
		}
		$out = array();
		foreach ( $items as $it ) {
			list( $kind, $title, $url ) = $it;
			if ( ! preg_match( '#^https?://#i', $url ) ) {
				continue;
			}
			$kind  = strtolower( preg_replace( '/[^a-z0-9_]/i', '', $kind ) );
			$out[] = array(
				'kind'  => '' !== $kind ? substr( $kind, 0, 20 ) : 'link',
				'title' => function_exists( 'mb_substr' ) ? mb_substr( $title, 0, 160, 'UTF-8' ) : substr( $title, 0, 160 ),
				'url'   => function_exists( 'esc_url_raw' ) ? (string) esc_url_raw( $url ) : $url,
			);
			if ( count( $out ) >= self::ARTIFACTS_MAX ) {
				break;
			}
		}
		return $out;
	}
}
