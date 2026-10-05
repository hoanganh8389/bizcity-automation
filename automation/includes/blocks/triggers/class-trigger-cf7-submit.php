<?php
/**
 * Trigger: Contact Form 7 submitted (PHASE-0.91 AX-5b/5c, D91-30 "CF7 có sẵn thì dùng").
 *
 * Owner of the event is Channel Gateway (BizCity_CF7_Channel_Listener::on_submit fires `bizcity_cf7_submitted` after it
 * has logged the submission, synced the CRM contact and sent its own mails). This block only exposes it to workflows —
 * no second CF7 hook, no second CRM write. Rate-limited submissions are never forwarded.
 *
 * Trigger ctx shape: form_id, form_title, sub_id, email, phone, name, fields{} (mapped), source_url, contact_id,
 * crm_action, mail_status, inbound{platform:CF7, chat_id:cf7_<form>}.
 * Filters (trigger_config or the trigger node data): form_id (0 = every form), filter_email (substring, '' = any).
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026).
 *
 * // [2026-10-05 08:35 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-5b — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Core\Automation\Blocks\Triggers
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Trigger_CF7_Submit extends BizCity_Automation_Block_Base {

	const TRIGGER_TYPE = 'cf7_submit';

	public function id(): string   { return 'trigger.cf7_submit'; }
	public function kind(): string { return 'trigger'; }

	public function meta(): array {
		return array(
			'label'    => 'Contact Form 7 · có người gửi form',
			'short'    => 'CF7',
			'category' => 'trigger',
			'color'    => '#16a34a',
			'icon'     => 'form',
			'defaults' => array( 'label' => 'CF7 · form submit', 'form_id' => 0, 'filter_email' => '' ),
			'fields'   => array(
				array( 'name' => 'label',        'label' => 'Tên hiển thị', 'type' => 'text' ),
				array( 'name' => 'form_id',      'label' => 'ID form CF7 (0 = mọi form)', 'type' => 'number' ),
				array( 'name' => 'filter_email', 'label' => 'Chỉ chạy khi email chứa', 'type' => 'text', 'hint' => 'để trống = mọi email' ),
			),
		);
	}

	public function execute( array $ctx, array $data ) {
		return isset( $ctx['trigger'] ) && is_array( $ctx['trigger'] ) ? $ctx['trigger'] : array();
	}

	/**
	 * Pure: `bizcity_cf7_submitted` payload ⇒ run payload ([] when there is no form id or the submission was rate-limited).
	 *
	 * @param mixed $event
	 */
	public static function build_payload( $event ): array {
		// [2026-10-05 08:35 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-5b — shape of the CF7 run payload.
		if ( ! is_array( $event ) || (int) ( $event['form_id'] ?? 0 ) <= 0 || ! empty( $event['rate_limited'] ) ) {
			return array();
		}
		$form_id = (int) $event['form_id'];
		$fields  = isset( $event['fields'] ) && is_array( $event['fields'] ) ? $event['fields'] : array();
		return array(
			'_trigger'               => self::TRIGGER_TYPE,
			'channel'                => 'CF7',
			'platform'               => 'CF7',
			'form_id'                => $form_id,
			'form_title'             => (string) ( $event['form_title'] ?? '' ),
			'sub_id'                 => (int) ( $event['sub_id'] ?? 0 ),
			'email'                  => (string) ( $event['email'] ?? '' ),
			'phone'                  => (string) ( $event['phone'] ?? '' ),
			'name'                   => (string) ( $event['name'] ?? ( $fields['name'] ?? '' ) ),
			'fields'                 => $fields,
			'source_url'             => (string) ( $event['source_url'] ?? '' ),
			'contact_id'             => (int) ( $event['contact_id'] ?? 0 ),
			'crm_action'             => (string) ( $event['crm_action'] ?? '' ),
			'mail_status'            => (string) ( $event['mail_status'] ?? '' ),
			'chat_id'                => 'cf7_' . $form_id,
			'inbound'                => array( 'platform' => 'CF7', 'chat_id' => 'cf7_' . $form_id, 'account_id' => (string) $form_id ),
			'_no_automation_reentry' => true,
		);
	}

	/**
	 * '' = this workflow takes the submission, else a reason bucket (form_mismatch, email_filter).
	 *
	 * @param array $cfg trigger_config merged with the trigger node data
	 */
	public static function reject_reason( array $cfg, array $payload ): string {
		$form = (int) ( $cfg['form_id'] ?? 0 );
		if ( $form > 0 && $form !== (int) $payload['form_id'] ) {
			return 'form_mismatch';
		}
		$needle = trim( (string) ( $cfg['filter_email'] ?? '' ) );
		if ( '' !== $needle && false === stripos( (string) $payload['email'], $needle ) ) {
			return 'email_filter';
		}
		return '';
	}

	/** trigger_config, overlaid with the data of the workflow's trigger.cf7_submit node (where the builder stores it). */
	public static function config_of( array $wf ): array {
		$cfg   = is_array( $wf['trigger_config'] ?? null ) ? $wf['trigger_config'] : array();
		$graph = is_array( $wf['graph'] ?? null ) ? $wf['graph'] : ( is_string( $wf['graph_json'] ?? null ) ? (array) json_decode( (string) $wf['graph_json'], true ) : array() );
		foreach ( (array) ( $graph['nodes'] ?? array() ) as $n ) {
			if ( is_array( $n ) && 'trigger.cf7_submit' === (string) ( $n['data']['blockId'] ?? '' ) ) {
				foreach ( array( 'form_id', 'filter_email' ) as $k ) {
					if ( isset( $n['data'][ $k ] ) && '' !== (string) $n['data'][ $k ] && ! isset( $cfg[ $k ] ) ) {
						$cfg[ $k ] = $n['data'][ $k ];
					}
				}
				break;
			}
		}
		return $cfg;
	}
}
