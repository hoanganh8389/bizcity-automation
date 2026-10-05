/**
 * Scenario (linear) shape — projection of an Automation Workflow that has
 * exactly 1 trigger node and a single chain of action/logic nodes.
 *
 * Lưu trong meta.tags = [...other, 'scenario'] để filter ở list view.
 *
 * @since 2026-06-01 (Bot-Bán-Hàng-style scenario builder)
 */

export const SCENARIO_TAG = 'scenario';

/** Action types phơi ra ở UI linear (mỗi cái map sang 1 blockId của registry). */
export const STEP_TYPES = [
	{
		key:   'send_text',
		label: 'Gửi tin nhắn',
		short: 'Tin nhắn',
		icon:  'MessageCircle',
		color: '#16a34a',
		blockId: 'action.reply_zalo', // generic channel reply (uses trigger.instance_id)
		defaultConfig: { text: '', compose_delay_seconds: 0, condition: '' },
	},
	{
		key:   'ai_reply',
		label: 'AI sinh tin nhắn (LLM)',
		short: 'AI prompt',
		icon:  'Sparkles',
		color: '#9333ea',
		blockId: 'llm.compose_reply',
		defaultConfig: { prompt: '', system: 'Bạn là trợ lý CSKH thân thiện.', model: 'fast' },
	},
	{
		key:   'http_request',
		label: 'Gửi yêu cầu HTTP',
		short: 'HTTP',
		icon:  'Globe',
		color: '#0891b2',
		blockId: 'action.http_request',
		defaultConfig: { method: 'GET', url: '', headers: {}, body: '', save_as: 'result' },
	},
	{
		key:   'save_data',
		label: 'Lưu dữ liệu',
		short: 'Lưu',
		icon:  'Database',
		color: '#475569',
		blockId: 'action.db_write',
		defaultConfig: { key: '', value: '' },
	},
	{
		key:   'schedule_delay',
		label: 'Chờ rồi chạy kịch bản khác',
		short: 'Hẹn giờ',
		icon:  'CalendarClock',
		color: '#d97706',
		blockId: 'action.schedule_event',
		defaultConfig: { delay_value: 3, delay_unit: 'minute', target_workflow_id: 0, event_type: 'workflow_scheduled' },
	},
	{
		key:   'condition',
		label: 'Điều kiện rẽ nhánh',
		short: 'IF',
		icon:  'GitBranch',
		color: '#0f766e',
		blockId: 'logic.condition',
		defaultConfig: { expr: '' },
	},
];

export function stepDefByKey(key) {
	return STEP_TYPES.find((s) => s.key === key) || null;
}

/** Triggers UI palette. */
export const TRIGGER_TYPES = [
	{ key: 'fb_message',   label: 'Facebook · Messenger',   blockId: 'trigger.fb_message',     platform: 'FACEBOOK' },
	{ key: 'fb_comment',   label: 'Facebook · Comment',     blockId: 'trigger.fb_comment',     platform: 'FACEBOOK' },
	{ key: 'zalo_inbound', label: 'Zalo · Tin nhắn',        blockId: 'trigger.zalo_inbound',   platform: 'ZALO_BOT' },
	{ key: 'telegram',     label: 'Telegram · Tin nhắn',    blockId: 'trigger.telegram_inbound', platform: 'TELEGRAM' },
];

export function triggerDefByKey(key) {
	return TRIGGER_TYPES.find((t) => t.key === key) || null;
}

export function triggerKeyByBlockId(blockId) {
	return TRIGGER_TYPES.find((t) => t.blockId === blockId)?.key || '';
}

export function stepKeyByBlockId(blockId) {
	return STEP_TYPES.find((s) => s.blockId === blockId)?.key || '';
}
