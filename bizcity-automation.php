<?php
/**
 * Plugin Name:       BizCity Automation
 * Description:       Core Automation (kịch bản mở rộng cho cell — PHASE-0.91) for Bizcity Twin AI. Bán riêng theo gói
 *                     Pro/Add-on: site nào không cài/kích hoạt plugin này thì không có tool automation.run_scenario.
 * Version:           0.1.0
 * Requires Plugins:  bizcity-twin-ai
 * Requires PHP:      8.0
 * Network:           true
 * Text Domain:       bizcity-automation
 *
 * [2026-10-05 08:22 PM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-0 — tách Automation thành plugin riêng
 * `bizcity-automation`, không còn nằm trong bizcity-twin-ai/core/ (đã thử sáng nay rồi đảo lại) và không còn chung
 * với bizcity-twin-brain-addon (plugin đó giờ chỉ còn TwinBrain/knowledge-legacy/memory). Lý do: mô hình kinh doanh
 * thật của BizCity bán Automation theo gói Pro/Add-on riêng (site khách như tranghana.vn kỳ vọng "cài plugin
 * tương ứng để tiếp tục" — ảnh chụp 2026-10-05), nên Automation phải là MỘT PLUGIN CÀI ĐƯỢC RIÊNG, không gộp vào
 * core của plugin chính, và cũng không chung một khối bật/tắt với TwinBrain.
 *
 * File này không tự nạp gì. bizcity-twin-ai giữ các cổng nạp theo request (admin/REST/cron/webhook/`/flow/`) và nạp
 * phần trong thư mục `automation/` qua BizCity_Addon_Locator (includes/class-bizcity-addon-locator.php ở plugin
 * chính — phương thức `file( 'automation/...' )` giờ trỏ vào plugin NÀY, không còn trỏ vào core/ hay
 * bizcity-twin-brain-addon). Chế độ nạp mặc định `auto`: cài thư mục này vào là đủ, không bắt buộc kích hoạt.
 * Đặt `define( 'BIZCITY_AUTOMATION_LOAD', 'active' )` trong wp-config.php để bắt buộc kích hoạt mới nạp,
 * `'off'` để tắt hẳn Automation trên site đó (đúng ý "Pro/Add-on" — gỡ/tắt plugin là mất tool automation.run_scenario).
 *
 * [2026-10-06 00:10 AM Johnny Chu - Chu Hoàng Anh] PHASE-0.91-AX-0 — cấu trúc PHẲNG: bootstrap.php, includes/, templates/, tests/,
 * docs/, frontend/, assets/, _library/ nằm thẳng ở gốc plugin (không còn thư mục con `automation/`). Khoá định tuyến
 * `automation/` của BizCity_Addon_Locator::file( 'automation/...' ) giờ chỉ là TÊN PHẦN: Locator cắt tiền tố đó rồi
 * tìm trong gốc plugin này, nên 9 lời gọi sẵn có ở core/mcp, core/channel-gateway, modules/twinweb, bizcity-twin-ai.php
 * không phải sửa.
 */

defined( 'ABSPATH' ) || exit;

define( 'BIZCITY_AUTOMATION_VERSION', '0.1.0' );
if ( ! defined( 'BIZCITY_AUTOMATION_DIR' ) ) {
	define( 'BIZCITY_AUTOMATION_DIR', __DIR__ ); // same value bootstrap.php defines (no trailing slash)
}

add_action( 'admin_notices', static function () {
	if ( defined( 'BIZCITY_TWIN_AI_VERSION' ) || ! current_user_can( 'activate_plugins' ) ) {
		return;
	}
	echo '<div class="notice notice-error"><p><strong>BizCity Automation</strong> cần plugin <strong>Bizcity Twin AI</strong> đang hoạt động.</p></div>';
} );
