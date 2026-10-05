/**
 * Block registry — catalog of node types usable inside a workflow.
 *
 * Each block defines:
 *  - `kind`         — react-flow node type (TriggerNode / ActionNode / …)
 *  - `category`     — palette group (trigger / action / logic / llm / output)
 *  - `defaults`     — initial `data` payload when a fresh node is dropped
 *  - `fields`       — schema-lite for the right inspector
 *      [{ name, label, type: text|textarea|select|number|toggle, options?, hint? }]
 *  - `simulate(ctx, data)` — async mock executor used by RunTimeline
 *
 * S0 PHASE: registry is hard-coded in FE. S3+ swap to PHP-driven catalog via
 *           `bizcity_automation_external_blocks_paths` filter.
 */
import {
	Zap, MessageCircle, Search, Brain, Reply, GitBranch,
	Clock, Mail, Globe, Calendar, Database, FileText,
	Send, Sparkles, CheckCircle2, Wand2,
	Paperclip, Image as ImageIcon, Download, BookOpen, Link as LinkIcon, Newspaper, Facebook,
	CalendarClock, TrendingUp, ShoppingCart, Bot,
} from 'lucide-react';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Common output schemas ───────────────────────────────────────────
// `outputs` lists variables a block exposes for downstream `{{…}}` picker.
// Schema: [{ name, label, sample? }]. The picker offers `{{trigger.<name>}}`
// (via trigger payload) or `{{<nodeId|kind>.<name>}}` for action/llm outputs.
const CHANNEL_TRIGGER_OUTPUTS = [
	{ name: 'text',            label: 'Nội dung tin' },
	{ name: 'sender_id',       label: 'ID người gửi' },
	{ name: 'sender_name',     label: 'Tên người gửi' },
	{ name: 'chat_id',         label: 'Chat ID' },
	{ name: 'account_id',      label: 'Account / OA / Page ID' },
	{ name: 'platform',        label: 'Platform (ZALO_BOT/FACEBOOK/...)' },
	{ name: 'trigger_code',    label: 'Mã trigger' },
	{ name: 'media_url',       label: 'URL media (nếu có)' },
	{ name: 'attachment_type', label: 'Loại đính kèm' },
	{ name: 'message_id',      label: 'ID tin nhắn' },
];

const FILTER_TAG_SUGGESTIONS = [
	'vận hạn',
	'chiêm tinh',
	'bản đồ sao',
	'vận mệnh',
	'transit',
	'tử vi',
	'xem vận',
	'xem sao',
	'sao chiếu',
	'tarot',
	'vận thế',
	'dự báo',
	'bói',
	'natal',
];

// ─── Triggers ────────────────────────────────────────────────────────
// [2026-06-24 Johnny Chu] PHASE-0.40 — Renamed to 'Zalo Bot' to distinguish Zone 2 (admin) from Zone 1 (Zalo OA).
const TRIG_ZALO = {
	id: 'trigger.zalo_inbound',
	kind: 'trigger',
	category: 'trigger',
	label: 'Zalo Bot · tin nhắn mới',
	short: 'Zalo Bot msg',
	Icon: MessageCircle,
	color: '#7c3aed',
	// [2026-07-26 Johnny Chu] RULE-TRIGGER-SINGLE-CLAIM — expose allow_costack so intentional co-stack workflows can opt in from Inspector.
	defaults: { label: 'Zalo Bot · tin nhắn mới', instance_id: '', filter: '', guru_id: 0, allow_costack: false },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',    type: 'text' },
		{ name: 'instance_id', label: 'Zalo Bot account', type: 'channel_instance_picker', platform: 'ZALO_BOT', hint: 'để trống = mọi bot' },
		{ name: 'filter',      label: 'Bộ lọc chứa từ',  type: 'filter_pills', hint: 'để trống = nhận mọi message', suggestions: FILTER_TAG_SUGGESTIONS, placeholder: 'VD: vận hạn | chiêm tinh | transit' },
		{ name: 'allow_costack', label: 'Cho phép đồng chạy (co-stack)', type: 'toggle', hint: 'Bật khi muốn workflow này được chạy cùng workflow winner trong single-claim.' },
		// [2026-06-03 Johnny Chu] GURU-UI W0.3 — đổi number → guru_picker, preview channel bindings.
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi binding khớp)', type: 'guru_picker', hint: 'để trống = mọi guru' },
	],
	outputs: CHANNEL_TRIGGER_OUTPUTS,
	simulate: async () => { await wait(250); return { text: 'Chào shop, có hàng size M không?' }; },
};
// [2026-06-24 Johnny Chu] PHASE-0.40 — Zalo OA Zone 1 (kênh CSKH khách hàng, chat_id prefix: zalooa_).
const TRIG_ZALO_OA = {
	id: 'trigger.zalo_oa_inbound',
	kind: 'trigger',
	category: 'trigger',
	label: 'Zalo OA · tin nhắn khách',
	short: 'Zalo OA msg',
	Icon: MessageCircle,
	color: '#0077b6',
	defaults: { label: 'Zalo OA · tin nhắn khách', instance_id: '', filter: '', guru_id: 0, allow_costack: false },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',    type: 'text' },
		{ name: 'instance_id', label: 'Zalo OA account', type: 'channel_instance_picker', platform: 'ZALO_OA', hint: 'để trống = mọi OA' },
		{ name: 'filter',      label: 'Bộ lọc chứa từ',  type: 'filter_pills', hint: 'để trống = nhận mọi message', suggestions: FILTER_TAG_SUGGESTIONS, placeholder: 'VD: vận hạn | chiêm tinh | transit' },
		{ name: 'allow_costack', label: 'Cho phép đồng chạy (co-stack)', type: 'toggle', hint: 'Bật khi muốn workflow này được chạy cùng workflow winner trong single-claim.' },
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi binding khớp)', type: 'guru_picker', hint: 'để trống = mọi guru' },
	],
	outputs: CHANNEL_TRIGGER_OUTPUTS,
	simulate: async () => { await wait(250); return { text: 'Xin chào, shop tư vấn giúp em không?' }; },
};
const TRIG_FB = {
	id: 'trigger.fb_comment',
	kind: 'trigger',
	category: 'trigger',
	label: 'Facebook · comment mới',
	short: 'FB comment',
	Icon: Zap,
	color: '#1d4ed8',
	defaults: { label: 'FB · comment mới', instance_id: '', filter: '', guru_id: 0, allow_costack: false },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',  type: 'text' },
		{ name: 'instance_id', label: 'Facebook Page', type: 'channel_instance_picker', platform: 'FACEBOOK', hint: 'để trống = mọi page' },
		{ name: 'filter',      label: 'Bộ lọc chứa từ', type: 'filter_pills', suggestions: FILTER_TAG_SUGGESTIONS, placeholder: 'VD: vận hạn | chiêm tinh | transit' },
		{ name: 'allow_costack', label: 'Cho phép đồng chạy (co-stack)', type: 'toggle', hint: 'Bật khi muốn workflow này được chạy cùng workflow winner trong single-claim.' },
		// [2026-06-03 Johnny Chu] GURU-UI W0.3
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi binding khớp)', type: 'guru_picker' },
	],
	outputs: [
		{ name: 'comment',     label: 'Nội dung comment' },
		{ name: 'post_id',     label: 'Post ID' },
		...CHANNEL_TRIGGER_OUTPUTS,
	],
	simulate: async () => { await wait(250); return { comment: 'Giá bao nhiêu vậy shop?' }; },
};
const TRIG_FB_MSG = {
	id: 'trigger.fb_message',
	kind: 'trigger',
	category: 'trigger',
	label: 'Facebook · tin nhắn (Messenger)',
	short: 'FB msg',
	Icon: Send,
	color: '#2563eb',
	defaults: { label: 'FB · Messenger', instance_id: '', filter: '', guru_id: 0, allow_costack: false },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',  type: 'text' },
		{ name: 'instance_id', label: 'Facebook Page', type: 'channel_instance_picker', platform: 'FACEBOOK', hint: 'để trống = mọi page' },
		{ name: 'filter',      label: 'Bộ lọc chứa từ', type: 'filter_pills', suggestions: FILTER_TAG_SUGGESTIONS, placeholder: 'VD: vận hạn | chiêm tinh | transit' },
		{ name: 'allow_costack', label: 'Cho phép đồng chạy (co-stack)', type: 'toggle', hint: 'Bật khi muốn workflow này được chạy cùng workflow winner trong single-claim.' },
		// [2026-06-03 Johnny Chu] GURU-UI W0.3
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi binding khớp)', type: 'guru_picker' },
	],
	outputs: CHANNEL_TRIGGER_OUTPUTS,
	simulate: async () => { await wait(250); return { text: 'Inbox: shop còn hàng chứ?' }; },
};
const TRIG_TELEGRAM = {
	id: 'trigger.telegram_inbound',
	kind: 'trigger',
	category: 'trigger',
	label: 'Telegram · tin nhắn mới',
	short: 'TG msg',
	Icon: Send,
	color: '#0284c7',
	defaults: { label: 'Telegram · tin nhắn', instance_id: '', filter: '', guru_id: 0, allow_costack: false },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',  type: 'text' },
		{ name: 'instance_id', label: 'Telegram Bot',  type: 'channel_instance_picker', platform: 'TELEGRAM', hint: 'để trống = mọi bot' },
		{ name: 'filter',      label: 'Bộ lọc chứa từ', type: 'filter_pills', suggestions: FILTER_TAG_SUGGESTIONS, placeholder: 'VD: vận hạn | chiêm tinh | transit' },
		{ name: 'allow_costack', label: 'Cho phép đồng chạy (co-stack)', type: 'toggle', hint: 'Bật khi muốn workflow này được chạy cùng workflow winner trong single-claim.' },
		// [2026-06-03 Johnny Chu] GURU-UI W0.3
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi binding khớp)', type: 'guru_picker' },
	],
	outputs: CHANNEL_TRIGGER_OUTPUTS,
	simulate: async () => { await wait(250); return { text: '/start' }; },
};
const TRIG_TB_INTENT = {
	id: 'trigger.twinbrain_intent',
	kind: 'trigger',
	category: 'trigger',
	label: 'TwinBrain · intent phát hiện',
	short: 'TB intent',
	Icon: Brain,
	color: '#9333ea',
	defaults: { label: 'TB intent · tạo bảng tính', intent_id: 'create_spreadsheet' },
	fields: [
		{ name: 'label',     label: 'Tên hiển thị', type: 'text' },
		{ name: 'intent_id', label: 'Intent ID',    type: 'text', hint: 'vd: create_spreadsheet, schedule_meeting' },
	],
	outputs: [
		{ name: 'intent_id',  label: 'Intent đã match' },
		{ name: 'confidence', label: 'Confidence (0-1)' },
		{ name: 'trace_id',   label: 'Trace ID' },
		{ name: 'user_id',    label: 'User ID' },
	],
	simulate: async () => { await wait(200); return { intent_id: 'create_spreadsheet', confidence: 0.92 }; },
};
const TRIG_TB_TURN_DONE = {
	id: 'trigger.twinbrain_turn_completed',
	kind: 'trigger',
	category: 'trigger',
	label: 'TwinBrain · trả lời hoàn tất',
	short: 'TB done',
	Icon: CheckCircle2,
	color: '#7c3aed',
	defaults: { label: 'TwinBrain · trả lời hoàn tất' },
	fields: [
		{ name: 'label', label: 'Tên hiển thị', type: 'text' },
	],
	outputs: [
		{ name: 'trace_id', label: 'Trace ID' },
		{ name: 'answer',   label: 'Câu trả lời' },
		{ name: 'user_id',  label: 'User ID' },
		{ name: 'chat_id',  label: 'Chat ID' },
	],
	simulate: async () => { await wait(180); return { trace_id: 'trace_demo', answer: 'Câu trả lời mẫu' }; },
};
// [2026-09-23 Claude Sonnet 5] PHASE-0.60G G2 — Bot Studio Guru bot just replied (bizcity_bot_turn_completed).
const TRIG_BOT_TURN_DONE = {
	id: 'trigger.bot_turn_completed',
	kind: 'trigger',
	category: 'trigger',
	label: 'Bot Studio · bot vừa trả lời xong',
	short: 'Bot done',
	Icon: Bot,
	color: '#0d9488',
	defaults: { label: 'Bot Studio · bot vừa trả lời xong', instance_id: '', guru_id: 0 },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',          type: 'text' },
		{ name: 'instance_id', label: 'Account ID (Zalo cá nhân)', type: 'text', hint: 'để trống = mọi account; lấy ID ở Bot Studio → Accounts' },
		{ name: 'guru_id',     label: 'Guru (chỉ chạy khi bot của Guru này trả lời)', type: 'guru_picker', hint: 'để trống = mọi guru' },
	],
	outputs: [
		{ name: 'conversation_id', label: 'Conversation ID (CRM)' },
		{ name: 'contact_id',      label: 'Contact ID (CRM)' },
		{ name: 'message_id',      label: 'Message ID (tin bot vừa gửi)' },
		{ name: 'character_id',    label: 'Guru ID' },
		{ name: 'account_id',      label: 'Account ID' },
		{ name: 'chat_id',         label: 'Chat ID' },
		{ name: 'trace_id',        label: 'Trace ID' },
	],
	simulate: async () => { await wait(180); return { conversation_id: 1, contact_id: 1, message_id: 1, character_id: 1, account_id: 'demo', chat_id: 'demo', trace_id: 'trace_demo' }; },
};
const TRIG_TB_TOOL_DECIDED = {
	id: 'trigger.twinbrain_tool_decided',
	kind: 'trigger',
	category: 'trigger',
	label: 'TwinBrain · gợi ý tool',
	short: 'TB tool',
	Icon: Wand2,
	color: '#c026d3',
	defaults: { label: 'TwinBrain · gợi ý tool', skill_slug: '' },
	fields: [
		{ name: 'label',      label: 'Tên hiển thị', type: 'text' },
		{ name: 'skill_slug', label: 'Lọc theo skill', type: 'text', hint: 'vd: web.search — để trống = mọi tool' },
	],
	outputs: [
		{ name: 'trace_id',   label: 'Trace ID' },
		{ name: 'skill_slug', label: 'Skill được chọn' },
		{ name: 'tool',       label: 'Tool slug' },
		{ name: 'confidence', label: 'Confidence' },
	],
	simulate: async () => { await wait(180); return { trace_id: 'trace_demo', skill_slug: 'web.search', confidence: 0.88 }; },
};
// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — Contact Form 7 submit trigger
const TRIG_CF7 = {
	id: 'trigger.cf7_submit',
	kind: 'trigger',
	category: 'trigger',
	label: 'Contact Form 7 · form submit',
	short: 'CF7 submit',
	Icon: FileText,
	color: '#dc2626',
	defaults: { label: 'CF7 · form submit', form_id: 0, filter_email: '' },
	fields: [
		{ name: 'label',        label: 'Tên hiển thị',                              type: 'text' },
		{ name: 'form_id',      label: 'CF7 Form ID (0 = mọi form)',                type: 'number' },
		{ name: 'filter_email', label: 'Lọc theo email (để trống = mọi submit)',    type: 'text' },
	],
	outputs: [
		{ name: 'email',      label: 'Email khách' },
		{ name: 'name',       label: 'Tên khách' },
		{ name: 'phone',      label: 'Số điện thoại' },
		{ name: 'form_id',    label: 'CF7 Form ID' },
		{ name: 'form_title', label: 'Tên form' },
		{ name: 'source_url', label: 'URL trang gửi form' },
		{ name: 'fields',     label: 'Tất cả fields (JSON)' },
	],
	simulate: async () => { await wait(200); return { email: 'test@example.com', name: 'Nguyễn Văn A', phone: '0901234567', form_id: 1, form_title: 'Liên hệ', source_url: 'https://example.com/lien-he' }; },
};
const TRIG_WEBHOOK = {
	id: 'trigger.webhook',
	kind: 'trigger',
	category: 'trigger',
	label: 'Webhook',
	short: 'Webhook',
	Icon: Globe,
	color: '#0e7490',
	defaults: { label: 'Webhook', slug: '', secret: '' },
	fields: [
		{ name: 'label',  label: 'Tên hiển thị', type: 'text' },
		{ name: 'slug',   label: 'Slug URL',     type: 'text', hint: 'POST /wp-json/bizcity-automation/v1/webhook/{slug}' },
		{ name: 'secret', label: 'Token bí mật', type: 'text', hint: 'gửi qua header X-Bizcity-Webhook-Token' },
		// [2026-08-16 Johnny Chu] PHASE-2-HIL-TEMPLATE-AUTO-UPGRADE-MVP — expose HIL controls directly on trigger inspector.
		{ name: 'hil_prompt',  label: 'HIL prompt',  type: 'textarea', hint: 'Mô tả dữ liệu cần thu thập + xác nhận trước khi chạy side effect.' },
		{ name: 'hil_rollout', label: 'HIL rollout', type: 'select', options: ['off', 'mvp', 'strict'], hint: 'mvp = bật guard từng phần, strict = bắt buộc HIL đầy đủ.' },
	],
	outputs: [
		{ name: 'slug',    label: 'Webhook slug' },
		{ name: 'payload', label: 'Payload JSON' },
	],
	simulate: async () => {
		await wait(200);
		return {
			slug: 'woo_order_created',
			payload: { order_id: 1001, customer_name: 'Khach demo', total: 199000 },
		};
	},
};
const TRIG_CRON = {
	id: 'trigger.cron',
	kind: 'trigger',
	category: 'trigger',
	label: 'Lịch định kỳ',
	short: 'Cron',
	Icon: Clock,
	color: '#0891b2',
	defaults: { label: 'Cron · 08:00 mỗi ngày', schedule: '0 8 * * *' },
	fields: [
		{ name: 'label',    label: 'Tên hiển thị', type: 'text' },
		// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 FIX — cron_time_picker: time input auto-syncs schedule+label.
		{ name: 'schedule', label: 'Giờ chạy hàng ngày', type: 'cron_time_picker', hint: 'Chọn giờ → cron expression tự cập nhật.' },
	],
	outputs: [
		{ name: 'fired_at', label: 'Thời điểm fire (ISO)' },
	],
	simulate: async () => { await wait(150); return { fired_at: new Date().toISOString() }; },
};

// ─── Actions ─────────────────────────────────────────────────────────
// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 — action.trending_research block definition.
const ACT_TRENDING_RESEARCH = {
	id: 'action.trending_research',
	kind: 'action',
	category: 'ai',
	label: 'Tìm Trending',
	short: 'trending_research',
	Icon: TrendingUp,
	color: '#7c3aed',
	defaults: { label: 'trending_research', topic: '{{trigger.text}}', scope: '1d', platforms: 'web,reddit,tiktok', language: 'vi', output: 'full' },
	fields: [
		{ name: 'label',     label: 'Tên hiển thị',        type: 'text' },
		{ name: 'topic',     label: 'Chủ đề tìm kiếm',     type: 'textarea', hint: 'Hỗ trợ {{trigger.text}}. Ví dụ: "xu hướng mạng xã hội hôm nay"' },
		{ name: 'scope',     label: 'Khoảng thời gian',     type: 'select',   options: ['1d','7d','30d'], hint: '1d = hôm nay · 7d = 7 ngày · 30d = 30 ngày qua' },
		{ name: 'platforms', label: 'Nguồn tìm kiếm',       type: 'text',     hint: 'web, reddit, tiktok, youtube, news (comma-separated)' },
		{ name: 'language',  label: 'Ngôn ngữ kết quả',     type: 'select',   options: ['vi','en'] },
		{ name: 'output',    label: 'Định dạng output',      type: 'select',   options: ['full','compact','key_patterns_only'], hint: 'full = prose · compact = 3-para · key_patterns_only = danh sách' },
	],
	outputs: [
		{ name: 'answer_md',     label: 'Kết quả (Markdown)' },
		{ name: 'key_patterns',  label: 'Key patterns (JSON array)' },
		{ name: 'sources_text',  label: 'Nguồn (plain text, Zalo-safe)' },
		{ name: 'source_count',  label: 'Số nguồn' },
		{ name: 'scope',         label: 'Scope đã dùng' },
		{ name: 'platforms_used',label: 'Platforms có kết quả' },
		{ name: 'ok',            label: 'Thành công?' },
		{ name: 'ms',            label: 'Thời gian thực thi (ms)' },
		// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 — 4 Zalo message chunks
		{ name: 'msg_1',         label: 'Tin Zalo 1 — Nghiên cứu (prose)' },
		{ name: 'msg_2',         label: 'Tin Zalo 2 — Danh sách nguồn' },
		{ name: 'msg_3',         label: 'Tin Zalo 3 — Phân tích (đồng thuận / khác biệt)' },
		{ name: 'msg_4',         label: 'Tin Zalo 4 — Key patterns & kết luận' },
	],
	simulate: async () => { await wait(800); return { ok: true, answer_md: '📊 Xu hướng hôm nay: AI Agents đang bùng nổ với 3.2M lượt tìm kiếm...', source_count: 8, scope: '1d', platforms_used: 'web,reddit,tiktok', key_patterns: ['AI Agents', 'GPT-5', 'TikTok Vietnam'] }; },
};

const ACT_SEARCH_KG = {
	id: 'action.search_kg',
	kind: 'action',
	category: 'action',
	label: 'Tra cứu Knowledge Graph',
	short: 'search_kg',
	Icon: Search,
	color: '#475569',
	defaults: { label: 'search_kg', query: '{{trigger.text}}', top_k: 5 },
	fields: [
		{ name: 'label', label: 'Tên hiển thị', type: 'text' },
		{ name: 'query', label: 'Câu truy vấn',  type: 'textarea', hint: 'hỗ trợ {{trigger.text}}' },
		{ name: 'top_k', label: 'Top K',          type: 'number' },
	],
	outputs: [
		{ name: 'hits',    label: 'Số kết quả' },
		{ name: 'snippet', label: 'Đoạn KG (text gộp)' },
		{ name: 'passages',label: 'Mảng passages' },
	],
	simulate: async () => { await wait(600); return { hits: 3, snippet: 'Áo size M còn 12 chiếc...' }; },
};
const ACT_REPLY_ZALO = {
	id: 'action.reply_zalo',
	kind: 'action',
	category: 'output',
	label: 'Trả lời Zalo',
	short: 'reply_zalo',
	Icon: Reply,
	color: '#15803d',
	// [2026-06-25 Johnny Chu] PHASE-REPLY-ZALO-FIX — added instance_id + override_chat_id
	defaults: { label: 'reply_zalo', text: '{{llm.output}}', instance_id: '', override_chat_id: '' },
	fields: [
		{ name: 'label',            label: 'Tên hiển thị',   type: 'text' },
		{ name: 'instance_id',      label: 'Zalo Bot',        type: 'channel_instance_picker', platform: 'ZALO_BOT', hint: 'Chọn bot để gửi tin. Để trống = dùng bot từ trigger context.' },
		{ name: 'override_chat_id', label: 'Gửi đến người dùng', type: 'zalo_user_picker',    hint: 'Chọn user đã linked, hoặc để trống = lấy từ trigger context (dùng khi trigger là Zalo Bot inbound).' },
		{ name: 'text',             label: 'Nội dung',        type: 'textarea' },
	],
	simulate: async () => { await wait(400); return { sent: true, msg_id: 'z_' + Math.random().toString(36).slice(2,8) }; },
};
const ACT_SEND_EMAIL = {
	id: 'action.send_email',
	kind: 'action',
	category: 'output',
	label: 'Gửi email',
	short: 'send_email',
	Icon: Mail,
	color: '#be185d',
	defaults: { label: 'send_email', to: '', subject: '', body: '', attachment_url: '' },
	fields: [
		{ name: 'label',          label: 'Tên hiển thị',                      type: 'text' },
		{ name: 'to',             label: 'Người nhận',                        type: 'text' },
		{ name: 'subject',        label: 'Tiêu đề',                           type: 'text' },
		// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — rich_text cho body email (TinyMCE cơ bản trong WP admin)
		{ name: 'body',           label: 'Nội dung',                          type: 'rich_text' },
		// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — optional ebook/file attachment from WP Media
		{ name: 'attachment_url', label: 'Đính kèm file (URL từ WP Media)',   type: 'text', hint: 'URL file ebook từ WP Media Library (để trống = không đính kèm)' },
	],
	simulate: async () => { await wait(500); return { queued: true }; },
};
const ACT_CRM_EVENT = {
	id: 'action.create_crm_event',
	kind: 'action',
	category: 'output',
	label: 'Tạo CRM event / task',
	short: 'crm_event',
	Icon: Calendar,
	color: '#7e22ce',
	defaults: { label: 'create_crm_event', event_type: 'meeting', title: '', due_at: '' },
	fields: [
		{ name: 'label',      label: 'Tên hiển thị', type: 'text' },
		{ name: 'event_type', label: 'Loại event',   type: 'select', options: ['meeting','reminder_zalo','lead_report','fb_post','web_post'] },
		{ name: 'title',      label: 'Tiêu đề',      type: 'text' },
		{ name: 'due_at',     label: 'Hạn (ISO)',    type: 'text', hint: '2026-06-01T08:00:00' },
	],
	simulate: async () => { await wait(300); return { event_id: 42 }; },
};
const ACT_CREATE_WOO_ORDER = {
	id: 'action.create_woo_order',
	kind: 'action',
	category: 'output',
	label: 'Tạo đơn hàng WooCommerce',
	short: 'create_woo_order',
	Icon: ShoppingCart,
	color: '#16a34a',
	defaults: {
		label: 'create_woo_order',
		items_json: '[{"sku":"SKU-DEMO-001","qty":1}]',
		shipping_name: '{{trigger.sender_name}}',
		shipping_phone: '',
		shipping_addr1: '',
		shipping_city: '',
		payment_method: 'cod',
		note: '{{trigger.text}}',
		auto_recap: true,
	},
	fields: [
		{ name: 'label',          label: 'Tên hiển thị', type: 'text' },
		{ name: 'items_json',     label: 'Items JSON', type: 'textarea', hint: '[{"product_id":123,"qty":1}] hoặc [{"sku":"SKU-001","qty":1}]' },
		{ name: 'shipping_name',  label: 'Tên người nhận', type: 'text' },
		{ name: 'shipping_phone', label: 'SĐT người nhận', type: 'text' },
		{ name: 'shipping_addr1', label: 'Địa chỉ giao hàng', type: 'text' },
		{ name: 'shipping_city',  label: 'Thành phố / Tỉnh', type: 'text' },
		{ name: 'payment_method', label: 'Phương thức thanh toán', type: 'text', hint: 'cod | bacs | momo | vnpay ...' },
		{ name: 'note',           label: 'Ghi chú đơn hàng', type: 'textarea' },
		{ name: 'auto_recap',     label: 'Gửi recap tự động', type: 'toggle' },
	],
	outputs: [
		{ name: 'order_id',      label: 'Woo order ID' },
		{ name: 'order_number',  label: 'Woo order number' },
		{ name: 'order_status',  label: 'Order status' },
		{ name: 'order_total',   label: 'Tổng tiền' },
		{ name: 'currency',      label: 'Currency' },
		{ name: 'payment_url',   label: 'Link thanh toán' },
		{ name: 'tracking_url',  label: 'Link theo dõi' },
		{ name: 'tracking_token',label: 'Token theo dõi' },
	],
	simulate: async () => {
		await wait(400);
		return {
			order_id: 1001,
			order_number: '1001',
			order_status: 'pending',
			order_total: 199000,
			currency: 'VND',
			payment_url: 'https://example.com/checkout/order-pay/1001',
			tracking_url: 'https://example.com/o/demo-token',
			tracking_token: 'demo-token',
		};
	},
};
const ACT_HTTP = {
	id: 'action.http_request',
	kind: 'action',
	category: 'action',
	label: 'HTTP request',
	short: 'http',
	Icon: Globe,
	color: '#1e40af',
	defaults: { label: 'http_request', method: 'GET', url: '', body: '' },
	fields: [
		{ name: 'label',  label: 'Tên hiển thị', type: 'text' },
		{ name: 'method', label: 'Method',       type: 'select', options: ['GET','POST','PUT','DELETE'] },
		{ name: 'url',    label: 'URL',          type: 'text' },
		{ name: 'body',   label: 'Body (JSON)',  type: 'textarea' },
	],
	outputs: [
		{ name: 'status', label: 'HTTP status' },
		{ name: 'body',   label: 'Response body' },
	],
	simulate: async () => { await wait(700); return { status: 200, body: '{"ok":true}' }; },
};

// ─── Logic ───────────────────────────────────────────────────────────
const LOG_CONDITION = {
	id: 'logic.condition',
	kind: 'condition',
	category: 'logic',
	label: 'Điều kiện rẽ nhánh',
	short: 'if',
	Icon: GitBranch,
	color: '#b45309',
	defaults: { label: 'IF', expression: 'kg.hits > 0' },
	fields: [
		{ name: 'label',      label: 'Tên hiển thị',   type: 'text' },
		{ name: 'expression', label: 'Biểu thức',      type: 'textarea', hint: 'vd: kg.hits > 0' },
	],
	outputs: [
		{ name: 'branch', label: 'Nhánh đã chọn (true/false)' },
	],
	simulate: async () => { await wait(120); return { branch: 'true' }; },
};

// ─── LLM ─────────────────────────────────────────────────────────────
const LLM_REPLY = {
	id: 'llm.compose_reply',
	kind: 'llm',
	category: 'llm',
	label: 'LLM · soạn câu trả lời',
	short: 'llm',
	Icon: Brain,
	color: '#059669',
	defaults: { label: 'LLM compose', model: 'gpt-4o-mini', system: 'Bạn là trợ lý CSKH.', prompt: '{{kg.snippet}}' },
	fields: [
		{ name: 'label',  label: 'Tên hiển thị', type: 'text' },
		{ name: 'model',  label: 'Model',        type: 'select', options: ['gpt-4o-mini','gpt-4o','claude-3-haiku','claude-3-5-sonnet','gemini-1.5-flash'] },
		{ name: 'system', label: 'System prompt', type: 'textarea' },
		{ name: 'prompt', label: 'User prompt',   type: 'textarea' },
	],
	outputs: [
		{ name: 'output', label: 'Văn bản kết quả' },
		{ name: 'tokens', label: 'Tokens dùng' },
	],
	simulate: async () => { await wait(900); return { output: 'Dạ shop còn size M ạ, anh/chị inbox SĐT em gửi link đặt nhé!' }; },
};

// BE-6.E — MPR Thinking via TwinBrain bridge.
const LLM_MPR_THINK = {
	id: 'llm.mpr_think',
	kind: 'llm',
	category: 'llm',
	label: 'MPR Thinking · TwinBrain',
	short: 'mpr',
	Icon: Sparkles,
	color: '#a855f7',
	defaults: {
		label: 'MPR Thinking',
		prompt: '{{trigger.text}}',
		guru_id: 0,
		tool_force: '',
		k: 8,
	},
	fields: [
		{ name: 'label',      label: 'Tên hiển thị',                       type: 'text' },
		{ name: 'prompt',     label: 'Prompt ({{trigger.text}} OK)',        type: 'textarea' },
		{ name: 'guru_id',    label: 'Guru ID (0 = mặc định)',              type: 'number' },
		{ name: 'tool_force', label: 'Force tool slug (optional)',          type: 'text' },
		{ name: 'k',          label: 'K (retrieval depth)',                 type: 'number' },
	],
	outputs: [
		{ name: 'answer_md',    label: 'Câu trả lời (markdown)' },
		{ name: 'thinking_md',  label: 'Quá trình suy nghĩ' },
		{ name: 'citations',    label: 'Citations' },
		{ name: 'layers_count', label: 'Số layer đã chạy' },
		{ name: 'trace_id',     label: 'Trace ID' },
	],
	simulate: async () => { await wait(1200); return {
		answer_md: '(mock) Đã suy nghĩ 9 bước, kết quả: ...',
		thinking_md: '1. pre_rules_done\n2. guru_lookup\n3. tool_intent\n...',
		layers_count: 9,
	}; },
};

// ─── Persistence / store ────────────────────────────────────────────
const ACT_LOG = {
	id: 'action.log',
	kind: 'action',
	category: 'action',
	label: 'Ghi log debug',
	short: 'log',
	Icon: FileText,
	color: '#525252',
	defaults: { label: 'log', message: '{{*}}' },
	fields: [
		{ name: 'label',   label: 'Tên hiển thị', type: 'text' },
		{ name: 'message', label: 'Nội dung log', type: 'textarea' },
	],
	simulate: async () => { await wait(80); return { logged: true }; },
};
const ACT_DB = {
	id: 'action.db_write',
	kind: 'action',
	category: 'action',
	label: 'Ghi DB',
	short: 'db',
	Icon: Database,
	color: '#92400e',
	defaults: { label: 'db_write', table: 'wp_bizcity_kg_passages', payload: '{}' },
	fields: [
		{ name: 'label',   label: 'Tên hiển thị', type: 'text' },
		{ name: 'table',   label: 'Bảng',         type: 'text' },
		{ name: 'payload', label: 'Payload JSON', type: 'textarea' },
	],
	simulate: async () => { await wait(350); return { inserted_id: 99 }; },
};

// ─── Layout ──────────────────────────────────────────────────────────
const GROUP_BLOCK = {
	id: 'layout.group',
	kind: 'group',
	category: 'layout',
	label: 'Nhóm (Subflow)',
	short: 'group',
	Icon: FileText,
	color: '#64748b',
	defaults: { label: 'Nhóm mới' },
	fields: [
		{ name: 'label', label: 'Tên nhóm', type: 'text' },
	],
	simulate: async () => ({ skipped: true }),
};

// ─── BE-7.C · Pending state (multi-turn slots) ──────────────────────
const ACT_CAPTURE_ATTACHMENT = {
	id: 'action.capture_attachment',
	kind: 'action',
	category: 'output',
	label: 'Lưu ảnh vào pending state',
	short: 'capture_img',
	Icon: Paperclip,
	color: '#0891b2',
	defaults: { label: 'capture_attachment', url: '{{trigger.media_url}}', ttl_min: 15 },
	fields: [
		{ name: 'label',   label: 'Tên hiển thị',           type: 'text' },
		{ name: 'url',     label: 'URL ảnh (token OK)',      type: 'text', hint: 'mặc định {{trigger.media_url}}' },
		{ name: 'ttl_min', label: 'TTL (phút)',              type: 'number' },
	],
	simulate: async () => { await wait(120); return { stored: true }; },
};
const ACT_SET_PENDING_INTENT = {
	id: 'action.set_pending_intent',
	kind: 'action',
	category: 'output',
	label: 'Đặt pending intent (chờ lượt sau)',
	short: 'set_pending',
	Icon: Clock,
	color: '#0e7490',
	defaults: {
		label: 'set_pending_intent',
		intent: 'awaiting_image',
		workflow_id: 0,
		workflow_slug: '',
		ttl_min: 15,
		slots_json: '{}',
	},
	fields: [
		{ name: 'label',         label: 'Tên hiển thị',                    type: 'text' },
		{ name: 'intent',        label: 'Intent name',                      type: 'text' },
		{ name: 'workflow_id',   label: 'Workflow ID (0 = chính nó)',       type: 'number' },
		{ name: 'workflow_slug', label: 'Workflow slug (override theo ID)', type: 'text' },
		{ name: 'ttl_min',       label: 'TTL (phút)',                        type: 'number' },
		{ name: 'slots_json',    label: 'Slots prefill (JSON)',              type: 'textarea', hint: '{"title_hint":"{{trigger.text}}"}' },
	],
	simulate: async () => { await wait(100); return { pending: true }; },
};
const ACT_CONSUME_ATTACHMENT = {
	id: 'action.consume_attachment',
	kind: 'action',
	category: 'output',
	label: 'Đọc ảnh từ pending state',
	short: 'consume_img',
	Icon: Download,
	color: '#0d9488',
	defaults: { label: 'consume_attachment', clear_slot: true },
	fields: [
		{ name: 'label',      label: 'Tên hiển thị',          type: 'text' },
		{ name: 'clear_slot', label: 'Xoá pending sau khi đọc', type: 'toggle' },
	],
	outputs: [
		{ name: 'attachment_url', label: 'URL ảnh đã lưu' },
		{ name: 'attachment_urls', label: 'Danh sách URL ảnh đã lưu' },
		{ name: 'attachment_id', label: 'Attachment ID đầu tiên' },
		{ name: 'attachment_ids', label: 'Danh sách attachment IDs' },
		{ name: 'attachment_type', label: 'Loại ảnh' },
	],
	simulate: async () => { await wait(80); return { attachment_url: 'https://example.com/img.jpg', attachment_urls: ['https://example.com/img.jpg'] }; },
};
const ACT_CAPTURE_TO_NOTEBOOK = {
	id: 'action.capture_to_notebook',
	kind: 'action',
	category: 'output',
	label: 'Lưu vào Notebook (Bridge)',
	short: 'capture_to_notebook',
	Icon: BookOpen,
	color: '#0ea5e9',
	defaults: {
		label: 'capture_to_notebook',
		user_id: '',
		title_hint: '{{trigger.text}}',
		content: '{{trigger.text}}',
		kind: 'auto',
		channel: '',
		day_key: '',
		include_trigger_media: 1,
		include_pending_attachments: 1,
		clear_pending_after_capture: 0,
	},
	fields: [
		{ name: 'label',                       label: 'Tên hiển thị',                    type: 'text' },
		{ name: 'user_id',                     label: 'WP User ID override (optional)',  type: 'text' },
		{ name: 'title_hint',                  label: 'Tiêu đề gợi ý (template)',        type: 'text' },
		{ name: 'content',                     label: 'Nội dung text (template)',        type: 'textarea' },
		{ name: 'kind',                        label: 'Loại capture',                    type: 'text' },
		{ name: 'channel',                     label: 'Channel override (optional)',     type: 'text' },
		{ name: 'day_key',                     label: 'Ngày Ymd (optional)',              type: 'text' },
		{ name: 'include_trigger_media',       label: 'Lấy media từ trigger',             type: 'toggle' },
		{ name: 'include_pending_attachments', label: 'Lấy media từ pending state',       type: 'toggle' },
		{ name: 'clear_pending_after_capture', label: 'Xóa pending state sau khi lưu',    type: 'toggle' },
	],
	outputs: [
		{ name: 'notebook_id', label: 'Notebook ID' },
		{ name: 'notebook_name', label: 'Tên notebook' },
		{ name: 'first_source_id', label: 'Source ID đầu tiên' },
		{ name: 'captured_succeeded', label: 'Số mục đã lưu' },
		{ name: 'captured_queued', label: 'Số mục đang chờ' },
		{ name: 'upload_url', label: 'Link upload thêm tài liệu' },
		{ name: 'upload_prompt', label: 'Câu hỏi upload tiếp' },
	],
	simulate: async () => { await wait(500); return { notebook_id: 21, notebook_name: 'Notebook mẫu', first_source_id: 29, captured_succeeded: 1, captured_queued: 0 }; },
};
const ACT_LEARNING_SHARE_LINK = {
	id: 'action.learning_share_link',
	kind: 'action',
	category: 'output',
	label: 'Link theo dõi Học (Learning)',
	short: 'learning_share_link',
	Icon: LinkIcon,
	color: '#0ea5e9',
	defaults: { label: 'learning_share_link', notebook_id: '', source_id: '', job_id: '', ttl_days: 30 },
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',                       type: 'text' },
		{ name: 'notebook_id', label: 'Notebook ID (template)',             type: 'text' },
		{ name: 'source_id',   label: 'Source ID (template, optional)',     type: 'text' },
		{ name: 'job_id',      label: 'Job ID (template, optional)',        type: 'text' },
		{ name: 'ttl_days',    label: 'Hết hạn sau (ngày)',                 type: 'number' },
	],
	outputs: [
		{ name: 'share_url', label: 'Link theo dõi' },
		{ name: 'expires_at', label: 'Thời điểm hết hạn' },
		{ name: 'notebook_id', label: 'Notebook ID' },
		{ name: 'source_id', label: 'Source ID' },
		{ name: 'job_id', label: 'Learning Job ID' },
	],
	simulate: async () => { await wait(180); return { share_url: 'https://example.com/learning/share/demo', expires_at: '2026-09-12 00:00:00', notebook_id: 21, source_id: 29, job_id: 0 }; },
};
const ACT_PUBLISH_WP_POST = {
	id: 'action.publish_wp_post',
	kind: 'action',
	category: 'output',
	label: 'Đăng bài WP (draft/pending/publish)',
	short: 'wp_post',
	Icon: Newspaper,
	color: '#1d4ed8',
	defaults: {
		label: 'publish_wp_post',
		title: '{{gen.title}}',
		content: '{{gen.content}}',
		image_url: '{{consume.attachment_url}}',
		image_urls: '{{consume.attachment_urls}}',
		status: 'draft',
		category: '',
		tags: '',
		author_id: 0,
	},
	fields: [
		{ name: 'label',     label: 'Tên hiển thị',          type: 'text' },
		{ name: 'title',     label: 'Tiêu đề',                type: 'text' },
		{ name: 'content',   label: 'Nội dung',               type: 'textarea' },
		{ name: 'image_url', label: 'Featured image URL',     type: 'text' },
		{ name: 'image_urls', label: 'Nhiều ảnh (JSON/CSV)',  type: 'textarea' },
		{ name: 'status',    label: 'Status',                  type: 'select', options: ['draft','pending','publish'] },
		{ name: 'category',  label: 'Category (CSV slug)',    type: 'text' },
		{ name: 'tags',      label: 'Tags (CSV)',              type: 'text' },
		{ name: 'author_id', label: 'Author ID (0 = current)', type: 'number' },
	],
	simulate: async () => { await wait(500); return { post_id: 123, edit_url: '/wp-admin/post.php?post=123&action=edit' }; },
};
const ACT_PUBLISH_FB_POST = {
	id: 'action.publish_fb_post',
	kind: 'action',
	category: 'output',
	label: 'Đăng Facebook (qua scheduler)',
	short: 'fb_post',
	Icon: Facebook,
	color: '#1d4ed8',
	defaults: {
		label: 'publish_fb_post',
		fb_target_mode: 'single',
		fb_page_id: '',
		fb_page_name: '',
		content: '{{gen.content}}',
		image_url: '{{consume.attachment_url}}',
		image_urls: '{{consume.attachment_urls}}',
		mode: 'scheduled',
		delay_min: 5,
	},
	fields: [
		{ name: 'label',          label: 'Tên hiển thị',                      type: 'text' },
		{ name: 'fb_page_id',     label: 'Fanpage đăng bài',                  type: 'fb_page_picker' },
		{ name: 'content',        label: 'Caption',                            type: 'textarea' },
		{ name: 'image_url',      label: 'Image URL',                          type: 'text' },
		{ name: 'image_urls',     label: 'Nhiều ảnh (JSON/CSV)',               type: 'textarea' },
		{ name: 'mode',           label: 'Chế độ',                            type: 'select', options: ['scheduled','now'] },
		{ name: 'delay_min',      label: 'Delay (phút) khi mode=scheduled',   type: 'number' },
	],
	simulate: async () => { await wait(400); return { event_id: 88, scheduled_at: '+5m' }; },
};

// [2026-06-16 Johnny Chu] PHASE-ATH W8 — action.web_research (TwinBrain Web Quick/Deep).
// [2026-06-18 Johnny Chu] PHASE-ZALOBOT — add vertical domain modes + sources_text output.
const ACT_WEB_RESEARCH = {
	id: 'action.web_research',
	kind: 'action',
	category: 'ai',
	label: 'Tìm kiếm Web',
	short: 'web_research',
	Icon: Globe,
	color: '#0284c7',
	defaults: {
		label: 'web_research',
		query: '{{trigger.text}}',
		vertical: 'auto',
		mode: 'quick',
		max_results: 7,
	},
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',           type: 'text' },
		{ name: 'query',       label: 'Câu truy vấn',            type: 'textarea', hint: 'Hỗ trợ {{trigger.text}}, {{vars.topic}}' },
		{ name: 'vertical',    label: 'Lĩnh vực',               type: 'select', options: ['auto', 'tax', 'law', 'gov', 'med', 'nutri', 'scholar', 'social'], hint: 'auto = tổng hợp · tax/law/gov/med/nutri/scholar/social = chuyên sâu' },
		{ name: 'mode',        label: 'Chế độ (khi auto)',      type: 'select', options: ['quick', 'deep'], hint: 'quick ≤4s · deep ReAct ≤60s — chỉ áp dụng khi vertical=auto' },
		{ name: 'max_results', label: 'Số kết quả tối đa',   type: 'number', hint: '1–15, mặc định 7' },
	],
	outputs: [
		{ name: 'ok',            label: 'Thành công?' },
		{ name: 'answer_md',     label: 'Kết quả (Markdown)' },
		{ name: 'citation_count',label: 'Số nguồn' },
		{ name: 'citations',     label: 'Danh sách nguồn (JSON)' },
		{ name: 'sources_text',  label: 'Danh sách nguồn (plain text cho Zalo)' },
		{ name: 'mode',          label: 'Chế độ đã chạy' },
		{ name: 'ms',            label: 'Thời gian (ms)' },
	],
	simulate: async () => { await wait(600); return { ok: true, answer_md: '_Kết quả tìm kiếm demo_', citation_count: 3, sources_text: '📰 3 nguồn tham khảo:\n1. tct.gov.vn — Thuế TNCN...\n2. thuvienphapluat.vn — Luật...', mode: 'quick' }; },
};

// [2026-06-16 Johnny Chu] PHASE-ATH W8 — action.generate_content (LLM + notebook skeleton R-SK).
const ACT_GENERATE_CONTENT = {
	id: 'action.generate_content',
	kind: 'action',
	category: 'ai',
	label: 'Tạo nội dung (AI)',
	short: 'generate_content',
	Icon: Sparkles,
	color: '#7c3aed',
	defaults: {
		label: 'generate_content',
		content_type: 'fb_post',
		notebook_id: 0,
		prompt_template: '{{trigger.text}}',
		tone: '',
		max_words: 300,
		character_id: 0,
	},
	fields: [
		{ name: 'label',           label: 'Tên hiển thị',         type: 'text' },
		{ name: 'content_type',    label: 'Loại nội dung',         type: 'select', options: ['fb_post', 'web_post', 'script', 'summary', 'email', 'custom'] },
		{ name: 'notebook_id',     label: 'Notebook tham chiếu',   type: 'notebook_picker', hint: 'Bind cứng notebook để inject skeleton (R-SK)' },
		{ name: 'prompt_template', label: 'Nội dung yêu cầu',      type: 'textarea', hint: 'Hỗ trợ {{n_X.answer_md}}, {{trigger.text}}, {{vars.*}}' },
		{ name: 'tone',            label: 'Giọng văn (tuỳ chọn)',  type: 'text', hint: 'vd: thân thiện, chuyên nghiệp' },
		{ name: 'max_words',       label: 'Giới hạn từ',           type: 'number', hint: 'mặc định 300' },
		{ name: 'character_id',    label: 'Pin Guru (tuỳ chọn)',   type: 'number', hint: '0 = không pin' },
	],
	simulate: async () => { await wait(800); return { ok: true, content: 'Demo content được tạo tự động bởi AI...', content_type: 'fb_post', notebook_id: 0 }; },
};

// [2026-07-05 Johnny Chu] PHASE-IMG-TPL — action.generate_image (AI image gen + sideload WP).
const ACT_GENERATE_IMAGE = {
	id: 'action.generate_image',
	kind: 'action',
	category: 'ai',
	label: 'Tạo ảnh AI',
	short: 'generate_image',
	Icon: Sparkles,
	color: '#0ea5e9',
	defaults: {
		label: 'Tạo ảnh AI',
		prompt: '',
		model: 'nano-banana',
		size: '1024x1024',
		sideload_to_wp: true,
	},
	fields: [
		{ name: 'label',         label: 'Tên hiển thị',      type: 'text' },
		{ name: 'prompt',        label: 'Mô tả ảnh (prompt)', type: 'textarea', hint: 'Hỗ trợ {{gen.content}}, {{trigger.text}}...' },
		{ name: 'model',         label: 'Model',              type: 'select', options: ['gpt-image-1', 'gpt-image-2', 'dall-e-3', 'flux-schnell', 'flux-1.1-pro', 'nano-banana'] },
		{ name: 'size',          label: 'Kích thước',         type: 'select', options: ['1024x1024', '1536x1024', '1024x1536', '512x512'] },
		{ name: 'sideload_to_wp',label: 'Lưu vào WP Media',   type: 'toggle', hint: 'Bật = sideload thành URL bền vững (cần thiết để đăng FB)' },
	],
	outputs: [
		{ name: 'ok',          label: 'Thành công?' },
		{ name: 'image_url',   label: 'URL ảnh' },
		{ name: 'model_used',  label: 'Model đã dùng' },
		{ name: 'width',       label: 'Chiều rộng' },
		{ name: 'height',      label: 'Chiều cao' },
		{ name: 'ms',          label: 'Thời gian (ms)' },
		{ name: 'error',       label: 'Lỗi (nếu có)' },
	],
	simulate: async () => { await wait(1200); return { ok: true, image_url: 'https://example.com/ai-image.jpg', model_used: 'gpt-image-1', width: 1024, height: 1024, ms: 8000, error: '' }; },
};

// [2026-08-06 Johnny Chu] PHASE-IMG-GEMINI — expose Gemini 3 Pro as the default image-edit model.
const ACT_EDIT_IMAGE = {
	id: 'action.edit_image',
	kind: 'action',
	category: 'ai',
	label: 'Chỉnh sửa ảnh AI',
	short: 'edit_image',
	Icon: Wand2,
	color: '#a21caf',
	defaults: {
		label: 'Gemini 3 Pro · chỉnh ảnh',
		image_url: '{{consume.attachment_url}}',
		image_urls: '{{consume.attachment_urls}}',
		prompt: '{{trigger.text}}',
		model: 'google/gemini-3-pro-image-preview',
		size: '1024x1024',
		sideload_to_wp: true,
	},
	fields: [
		{ name: 'label',          label: 'Tên hiển thị',         type: 'text' },
		{ name: 'image_url',      label: 'Ảnh gốc (URL)',        type: 'text', hint: '{{consume.attachment_url}} hoặc {{trigger._resume.attachment_url}}' },
		{ name: 'image_urls',     label: 'Nhiều ảnh gốc (JSON/CSV)', type: 'textarea', hint: '{{consume.attachment_urls}} để gửi nhiều ảnh tham chiếu' },
		{ name: 'prompt',         label: 'Yêu cầu chỉnh sửa',    type: 'textarea', hint: 'VD: cho sản phẩm như đang chụp trong studio' },
		{ name: 'model',          label: 'Model AI',             type: 'select', options: ['google/gemini-3-pro-image-preview', 'openai/gpt-image-1'] },
		{ name: 'size',           label: 'Kích thước',           type: 'select', options: ['1024x1024', '1536x1024', '1024x1536', '1024x1792', '1792x1024'] },
		{ name: 'sideload_to_wp', label: 'Lưu kết quả vào WP Media', type: 'toggle' },
	],
	outputs: [
		{ name: 'ok',            label: 'Thành công?' },
		{ name: 'content_id',    label: 'Content ID' },
		{ name: 'image_url',     label: 'URL ảnh đã sửa' },
		{ name: 'source_url',    label: 'URL ảnh gốc' },
		{ name: 'source_urls',   label: 'Danh sách URL ảnh gốc' },
		{ name: 'attachment_id', label: 'Attachment ID' },
		{ name: 'model_used',    label: 'Model đã dùng' },
		{ name: 'width',         label: 'Chiều rộng' },
		{ name: 'height',        label: 'Chiều cao' },
		{ name: 'ms',            label: 'Thời gian (ms)' },
		{ name: 'error',         label: 'Lỗi (nếu có)' },
	],
	simulate: async () => { await wait(1200); return { ok: true, image_url: 'https://example.com/edited-image.jpg', source_url: 'https://example.com/source.jpg', model_used: 'google/gemini-3-pro-image-preview', width: 1024, height: 1024, ms: 9000, error: '' }; },
};

// [2026-06-18 Johnny Chu] PHASE-ZALOBOT-ASTRO — action.run_astro (TwinBrain Astro Engine).
const ACT_RUN_ASTRO = {
	id: 'action.run_astro',
	kind: 'action',
	category: 'ai',
	label: 'Chiêm tinh (Astro)',
	short: 'run_astro',
	Icon: Sparkles,
	color: '#7c3aed',
	defaults: {
		label: 'run_astro',
		chat_id: '{{trigger.chat_id}}',
		instance_id: '{{trigger.instance_id}}',
		query: '{{trigger.text}}',
		compose: true,
	},
	fields: [
		{ name: 'label',       label: 'Tên hiển thị',                    type: 'text' },
		{ name: 'chat_id',     label: 'Chat ID (Zalo)',                   type: 'text', hint: 'Mặc định {{trigger.chat_id}}' },
		{ name: 'instance_id', label: 'Bot / OA Instance ID',             type: 'text', hint: 'Mặc định {{trigger.instance_id}}' },
		{ name: 'query',       label: 'Câu hỏi chiêm tinh',               type: 'textarea', hint: 'Mặc định {{trigger.text}}' },
		{ name: 'compose',     label: 'Tạo nhận định bằng AI',          type: 'toggle', hint: 'Bật = gọi LLM soạn nhận định' },
	],
	outputs: [
		{ name: 'ok',               label: 'Thành công?' },
		{ name: 'has_chart',        label: 'Có bản đồ sao?' },
		{ name: 'coachee_id',       label: 'Coachee ID' },
		{ name: 'coachee_name',     label: 'Tên coachee' },
		{ name: 'period',           label: 'Kỳ (day/week/month/year)' },
		{ name: 'period_label',     label: 'Kỳ (tiếng Việt)' },
		{ name: 'natal_url',        label: 'URL bản đồ sao' },
		{ name: 'transit_url',      label: 'URL transit' },
		{ name: 'create_chart_url', label: 'URL tạo bản đồ sao mới' },
		{ name: 'analysis',         label: 'Nhận định AI' },
		{ name: 'passages_count',   label: 'Số passage' },
	],
	simulate: async () => { await wait(500); return { ok: true, has_chart: true, coachee_id: 42, coachee_name: 'Nguyễn Văn A', period: 'day', period_label: 'ngày hôm nay', natal_url: 'https://example.com/natal', transit_url: 'https://example.com/transit', analysis: 'Sao Kim ở vị trí thuận lợi...', passages_count: 4 }; },
};

// [2026-07-04 Johnny Chu] PHASE-ASTRO-WORKFLOW — action.run_astro_transit (Transit Day-by-Day).
const ACT_RUN_ASTRO_TRANSIT = {
	id: 'action.run_astro_transit',
	kind: 'action',
	category: 'ai',
	label: 'Transit Day-by-Day',
	short: 'run_astro_transit',
	Icon: Sparkles,
	color: '#7c3aed',
	defaults: {
		label: 'Transit Day-by-Day',
		coachee_id: '{{n1.coachee_id}}',
		chat_id: '{{trigger.chat_id}}',
		period: '{{n1.period}}',
		num_days: '{{n1.num_days}}',
		start_date: '{{n1.start_date}}',
		outer_only: true,
		format: 'short',
	},
	fields: [
		{ name: 'label',      label: 'Tên hiển thị',    type: 'text' },
		{ name: 'coachee_id', label: 'Coachee ID',       type: 'text',   hint: '{{n1.coachee_id}}' },
		{ name: 'chat_id',    label: 'Chat ID (Zalo)',   type: 'text',   hint: '{{trigger.chat_id}}' },
		{ name: 'period',     label: 'Khoảng thời gian', type: 'select',
			options: [
				{ value: 'day',   label: 'Ngày mai (1 ngày)' },
				{ value: '3day',  label: '3 ngày tới' },
				{ value: '5day',  label: '5 ngày tới' },
				{ value: 'week',  label: 'Tuần tới (7 ngày)' },
				{ value: '10day', label: '10 ngày tới' },
				{ value: '20day', label: '20 ngày tới' },
				{ value: 'month', label: 'Tháng tới (30 ngày)' },
				{ value: 'year',  label: 'Năm tới (365 ngày)' },
			],
		},
		{ name: 'num_days',   label: 'Số ngày (ưu tiên)', type: 'number', hint: '{{n1.num_days}}; >0 sẽ override period' },
		{ name: 'start_date', label: 'Ngày bắt đầu',    type: 'text',   hint: 'YYYY-MM-DD hoặc để trống = ngày mai' },
		{ name: 'outer_only', label: 'Chỉ sao chậm',    type: 'toggle', hint: 'Bật = Jupiter→Pluto+Chiron; Tắt = tất cả' },
		{ name: 'format',     label: 'Định dạng',        type: 'select',
			options: [
				{ value: 'short', label: 'Ngắn gọn (Zalo ≤800c)' },
				{ value: 'full',  label: 'Đầy đủ (Markdown cho LLM)' },
			],
		},
	],
	outputs: [
		{ name: 'ok',                label: 'Thành công?' },
		{ name: 'coachee_id',        label: 'Coachee ID' },
		{ name: 'period_label',      label: 'Nhãn kỳ (tiếng Việt)' },
		{ name: 'range_start',       label: 'Ngày bắt đầu (YYYY-MM-DD)' },
		{ name: 'range_end',         label: 'Ngày kết thúc (YYYY-MM-DD)' },
		{ name: 'days_count',        label: 'Số ngày' },
		{ name: 'transit_text',      label: 'Nội dung transit (short, Zalo)' },
		{ name: 'transit_days_md',   label: 'Transit từng ngày đầy đủ (cho LLM)' },
		{ name: 'transit_url',       label: 'URL transit' },
		{ name: 'natal_url',         label: 'URL bản đồ sao' },
		{ name: 'retrograde_planets', label: 'Sao nghịch hành' },
		{ name: 'key_aspects',       label: 'Aspect nổi bật' },
		{ name: 'passages_md',       label: 'Diễn giải passages (Markdown)' },
	],
	simulate: async () => {
		await wait(500);
		return { ok: true, coachee_id: 42, period_label: 'ngày mai', range_start: '2026-07-05', range_end: '2026-07-05', days_count: 1, transit_text: 'Jupiter hợp Mặt Trời – cơ hội mở rộng...', transit_url: 'https://example.com/transit', natal_url: 'https://example.com/natal', retrograde_planets: 'Saturn, Neptune', key_aspects: 'Jupiter ☌ Sun', passages_md: '' };
	},
};

// [2026-08-11 Johnny Chu] PHASE-TWB-WOO-BIZOPS — admin-only Woo BizOps action metadata.
const ACT_RUN_WOO_BIZOPS = {
	id: 'action.run_woo_bizops',
	kind: 'action',
	category: 'ai',
	label: 'Woo BizOps · Báo cáo shop',
	short: 'run_woo_bizops',
	Icon: TrendingUp,
	color: '#b45309',
	defaults: {
		label: 'Woo BizOps · Báo cáo shop',
		query: '{{trigger.text}}',
		max_results: 10,
	},
	fields: [
		{ name: 'label', label: 'Tên hiển thị', type: 'text' },
		{ name: 'query', label: 'Câu hỏi Woo BizOps', type: 'textarea', hint: '{{trigger.text}}' },
		{ name: 'max_results', label: 'Số dòng tối đa', type: 'number', hint: '1-20; dữ liệu lớn phải chạy async ở wave sau' },
	],
	outputs: [
		{ name: 'ok', label: 'Thành công?' },
		{ name: 'intent_group', label: 'Nhóm intent' },
		{ name: 'answer_md', label: 'Câu trả lời' },
		{ name: 'metrics_json', label: 'Metrics JSON' },
		{ name: 'citations_json', label: 'Citations JSON' },
		{ name: 'error_code', label: 'Mã lỗi' },
		{ name: 'error_message', label: 'Thông báo lỗi' },
	],
	simulate: async () => { await wait(400); return { ok: 1, intent_group: 'revenue_orders', answer_md: 'Demo Woo BizOps: doanh thu theo khoảng đã chọn.', metrics_json: '{}', citations_json: '[]', error_code: '', error_message: '' }; },
};
// [2026-08-16 Johnny Chu] PHASE-TWB-GURU-ASK — generic synchronous ask-Guru block metadata.
const ACT_ASK_GURU = {
	id: 'action.ask_guru',
	kind: 'action',
	category: 'brain',
	label: 'Hỏi Guru',
	short: 'ask_guru',
	Icon: Brain,
	color: '#0f766e',
	defaults: { label: 'Hỏi Guru', character_id: 0, query: '{{trigger.text}}', web_mode: 'off', timeout_seconds: 30 },
	fields: [
		{ name: 'label', label: 'Tên hiển thị', type: 'text' },
		{ name: 'character_id', label: 'Guru ID', type: 'number', hint: 'Server sẽ resolve lại Guru trước khi chạy.' },
		{ name: 'query', label: 'Câu hỏi', type: 'textarea', hint: '{{trigger.text}}' },
		{ name: 'web_mode', label: 'Vertical', type: 'select', options: [ { value: 'off', label: 'Notebook / Brain' }, { value: 'woo_bizops', label: 'Woo BizOps' } ] },
		{ name: 'timeout_seconds', label: 'Timeout (giây)', type: 'number', hint: '5-60' },
	],
	outputs: [
		{ name: 'ok', label: 'Thành công?' },
		{ name: 'guru_id', label: 'Guru ID' },
		{ name: 'trace_id', label: 'Trace ID' },
		{ name: 'answer_md', label: 'Câu trả lời' },
		{ name: 'citations', label: 'Citations' },
		{ name: 'error_code', label: 'Mã lỗi' },
		{ name: 'error_message', label: 'Thông báo lỗi' },
	],
	simulate: async () => { await wait(400); return { ok: 1, guru_id: 0, trace_id: 'demo-ask-guru', answer_md: 'Demo Hỏi Guru: runtime sẽ trả câu trả lời có citation.', citations: [], error_code: '', error_message: '' }; },
};
// [2026-08-11 Johnny Chu] PHASE-TWB-WOO-BIZOPS — executive digest metadata for cron workflows.
const ACT_RUN_WOO_BIZOPS_DIGEST = {
	id: 'action.run_woo_bizops_digest',
	kind: 'action',
	category: 'ai',
	label: 'Woo BizOps · Executive Digest',
	short: 'run_woo_bizops_digest',
	Icon: FileText,
	color: '#92400e',
	defaults: { label: 'Woo BizOps · Executive Digest', include_cohort: false },
	fields: [
		{ name: 'label', label: 'Tên hiển thị', type: 'text' },
		{ name: 'include_cohort', label: 'Bao gồm repeat cohort', type: 'toggle', hint: 'Tắt mặc định để tránh quét lớn trong cron.' },
	],
	outputs: [
		{ name: 'ok', label: 'Thành công?' },
		{ name: 'answer_md', label: 'Bản tóm tắt' },
		{ name: 'query_count', label: 'Số truy vấn' },
		{ name: 'failed_count', label: 'Số truy vấn lỗi' },
		{ name: 'degraded', label: 'Degraded reason' },
	],
	simulate: async () => { await wait(500); return { ok: 1, answer_md: 'Demo executive digest.', query_count: 3, failed_count: 0, degraded: '' }; },
};

// [2026-06-16 Johnny Chu] PHASE-ATH W8 GAP-1 fix: id field was stripped by prior replacement.
const ACT_SCHEDULE_EVENT = {
	id: 'action.schedule_event',
	kind: 'action',
	category: 'output',
	label: 'Lên lịch (CRM event)',
	short: 'schedule_event',
	Icon: CalendarClock,
	color: '#9333ea',
	defaults: {
		label: 'schedule_event',
		event_type: 'task',
		title: '{{trigger.text}}',
		description: '',
		start_at: '+1 hour',
		reminder_min: 15,
		zalo_bot_id: '',
		zalo_user_id: '{{trigger.sender_id}}',
		zalo_text: '{{trigger.text}}',
	},
	fields: [
		{ name: 'label',        label: 'Tên hiển thị',                           type: 'text' },
		{ name: 'event_type',   label: 'Loại event',                              type: 'select', options: ['task','meeting','reminder','reminder_zalo'] },
		{ name: 'title',        label: 'Tiêu đề',                                  type: 'text' },
		{ name: 'description',  label: 'Mô tả',                                    type: 'textarea' },
		{ name: 'start_at',     label: 'Bắt đầu (ISO hoặc strtotime)',             type: 'text', hint: '+1 hour | tomorrow 9am | 2026-06-05 14:00' },
		{ name: 'reminder_min', label: 'Reminder trước (phút)',                    type: 'number' },
		{ name: 'zalo_bot_id',  label: '[reminder_zalo] Bot ID',                   type: 'text' },
		{ name: 'zalo_user_id', label: '[reminder_zalo] Zalo user ID',             type: 'text' },
		{ name: 'zalo_text',    label: '[reminder_zalo] Nội dung gửi',             type: 'textarea' },
	],
	simulate: async () => { await wait(200); return { event_id: 99, event_type: 'task', start_at: '+1h' }; },
};

export const BLOCKS = [
	TRIG_ZALO,
	// [2026-06-24 Johnny Chu] PHASE-0.40 — Zalo OA Zone 1 trigger
	TRIG_ZALO_OA,
	TRIG_FB, TRIG_FB_MSG, TRIG_TELEGRAM, TRIG_TB_INTENT,
	TRIG_TB_TURN_DONE, TRIG_TB_TOOL_DECIDED, TRIG_BOT_TURN_DONE, TRIG_CRON,
	// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — CF7 form submit trigger
	TRIG_CF7,
	TRIG_WEBHOOK,
	ACT_SEARCH_KG, ACT_HTTP, ACT_DB, ACT_LOG,
	// [2026-06-24 Johnny Chu] PHASE-TRENDING W1 — trending_research block.
	ACT_TRENDING_RESEARCH,
	// [2026-06-16 Johnny Chu] PHASE-ATH W8 — web_research + generate_content blocks.
	ACT_WEB_RESEARCH, ACT_GENERATE_CONTENT,
	// [2026-07-05 Johnny Chu] PHASE-IMG-TPL — generate_image block.
	ACT_GENERATE_IMAGE,
	ACT_EDIT_IMAGE,
	// [2026-06-18 Johnny Chu] PHASE-ZALOBOT-ASTRO — run_astro block.
	ACT_RUN_ASTRO,
	// [2026-07-04 Johnny Chu] PHASE-ASTRO-WORKFLOW — run_astro_transit block.
	ACT_RUN_ASTRO_TRANSIT,
	ACT_RUN_WOO_BIZOPS,
	ACT_ASK_GURU,
	ACT_RUN_WOO_BIZOPS_DIGEST,
	LOG_CONDITION,
	LLM_REPLY, LLM_MPR_THINK,
	ACT_REPLY_ZALO, ACT_SEND_EMAIL, ACT_CRM_EVENT, ACT_CREATE_WOO_ORDER,
	ACT_CAPTURE_ATTACHMENT, ACT_SET_PENDING_INTENT, ACT_CONSUME_ATTACHMENT,
	ACT_CAPTURE_TO_NOTEBOOK, ACT_LEARNING_SHARE_LINK,
	ACT_PUBLISH_WP_POST, ACT_PUBLISH_FB_POST, ACT_SCHEDULE_EVENT,
	GROUP_BLOCK,
];

export const BLOCKS_BY_ID = Object.fromEntries(BLOCKS.map((b) => [b.id, b]));

export const CATEGORIES = [
	{ id: 'trigger', label: '⚡ Trigger',    desc: 'Bắt đầu workflow' },
	{ id: 'action',  label: '🔧 Hành động', desc: 'Truy vấn / gọi tool' },
	{ id: 'ai',      label: '🤖 AI',         desc: 'Tìm kiếm web / Tạo nội dung AI' },
	{ id: 'logic',   label: '🔀 Logic',      desc: 'Điều kiện / rẽ nhánh' },
	{ id: 'llm',     label: '🧠 LLM',         desc: 'Soạn nội dung AI' },
	{ id: 'output',  label: '📤 Output',     desc: 'Trả lời / phát hành' },
	{ id: 'layout',  label: '🗂 Layout',      desc: 'Nhóm / Subflow' },
];

export function blockByKind(kind) {
	return BLOCKS.find((b) => b.kind === kind) || null;
}
