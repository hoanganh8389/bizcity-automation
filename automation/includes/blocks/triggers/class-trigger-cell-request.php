<?php
/**
 * Trigger: Cell yêu cầu — the scenario is started by the cell (Biz Central Brain) through the MCP tool
 * automation.run_scenario (PHASE-0.91 AX-1.1, contract automation-scenario@1 §2, doc 101 A1).
 *
 * Pass-through: the payload is built by the MCP handler (inputs + the `_cell` block taken from the delegated auth
 * context — never from the caller's arguments). The declaration itself lives in trigger_config.cell; the fields below
 * are what the builder shows. No `confirm` field in this wave (D91-14): every scenario asks first, except a standing
 * authorisation set on the scenario card (D91-31, manage_options only).
 *
 * Biz Central Brain — Johnny Chu (Chu Hoàng Anh). Bizcity Central Brain, Giấy chứng nhận đăng ký quyền tác giả
 * số 8877/2026/QTG (Cục Bản quyền tác giả, 14/09/2026).
 *
 * // [2026-10-05 06:12 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.1 — new file.
 *
 * @package    Bizcity_Twin_AI
 * @subpackage Core\Automation\Blocks\Triggers
 * @author     Johnny Chu (Chu Hoàng Anh)
 * @copyright  2026 Johnny Chu (Chu Hoàng Anh) — Bizcity Central Brain
 */

defined( 'ABSPATH' ) || exit;

final class BizCity_Automation_Trigger_Cell_Request extends BizCity_Automation_Block_Base {
	public function id(): string   { return 'trigger.cell_request'; }
	public function kind(): string { return 'trigger'; }

	public function meta(): array {
		return array(
			'label'    => 'Cell yêu cầu (trợ lý AI)',
			'short'    => 'Cell',
			'category' => 'trigger',
			'color'    => '#2563eb',
			'icon'     => 'bot',
			'defaults' => array( 'label' => 'Cell yêu cầu', 'slug' => '', 'keywords' => '', 'roles' => array( 'owner' ), 'reply' => 'verbatim', 'eta' => 30 ),
			'fields'   => array(
				array( 'name' => 'label',    'label' => 'Tên hiển thị', 'type' => 'text' ),
				array( 'name' => 'slug',     'label' => 'Mã kịch bản (cell gọi bằng mã này)', 'type' => 'text', 'hint' => 'a-z, 0-9, _ — vd: astro_industry' ),
				array( 'name' => 'keywords', 'label' => 'Từ khóa nhận lệnh',  'type' => 'pills' ),
				array( 'name' => 'inputs',   'label' => 'Trường dữ liệu vào', 'type' => 'input_fields' ),
				array( 'name' => 'roles',    'label' => 'Ai được gọi',        'type' => 'multiselect', 'options' => array( 'owner', 'staff' ) ),
				array( 'name' => 'reply',    'label' => 'Báo lại',            'type' => 'select', 'options' => array( 'verbatim', 'compose' ) ),
				array( 'name' => 'eta',      'label' => 'Ước lượng (giây)',   'type' => 'number' ),
			),
		);
	}

	public function execute( array $ctx, array $data ) {
		// [2026-10-05 06:12 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-1.1 — pass-through of the payload the MCP handler built.
		return isset( $ctx['trigger'] ) && is_array( $ctx['trigger'] ) ? $ctx['trigger'] : array();
	}
}
