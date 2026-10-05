/**
 * Zalo User Picker — dropdown loads linked users for a specific Zalo Bot instance.
 *
 * Used as Inspector field with `type: 'zalo_user_picker'` in action.reply_zalo.
 * Depends on sibling field `instance_id` (the bot). When `instanceId` is empty,
 * falls back to free-text input (for trigger-context override_chat_id).
 *
 * REST: GET /bizcity-automation/v1/zalo-users?instance_id=<bot_db_id>
 * Returns: { ok, rows: [{chat_id, zalo_user_id, display_name, label}] }
 *
 * [2026-06-25 Johnny Chu] PHASE-REPLY-ZALO-FIX — new component.
 * [2026-06-29 Johnny Chu] PHASE-REPLY-ZALO-FIX — prominent warning + chatid keyword hint.
 *
 * @since PHASE-REPLY-ZALO-FIX (2026-06-25)
 */
import { useEffect, useState } from 'react';
import { automationApi } from '../lib/api.js';
import { BOOT } from '../lib/boot.js';

const inputStyle = {
	display: 'block', width: '100%', marginTop: 4,
	padding: '6px 8px', fontSize: 12, lineHeight: 1.4,
	border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
	fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function ZaloUserPicker({ instanceId, value, onChange }) {
	const [rows, setRows]       = useState(null);
	const [error, setError]     = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (!instanceId) { setRows(null); setError(''); return; }

		let cancelled = false;
		setLoading(true);
		setError('');
		setRows(null);

		automationApi.zaloUsers(instanceId)
			.then((res) => {
				if (cancelled) return;
				setRows(Array.isArray(res?.rows) ? res.rows : []);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(e?.message || 'Lỗi tải user links');
				setRows([]);
			})
			.finally(() => { if (!cancelled) setLoading(false); });

		return () => { cancelled = true; };
	}, [instanceId]);

	// No bot selected — free text input (trigger context will provide chat_id)
	if (!instanceId) {
		return (
			<div style={{ marginTop: 4 }}>
				<input
					type="text"
					value={value ?? ''}
					placeholder="Chọn Zalo Bot ở trên để load danh sách, hoặc nhập chat_id thủ công"
					onChange={(e) => onChange(e.target.value)}
					style={inputStyle}
				/>
				<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
					Để trống = lấy chat_id từ trigger context (dùng khi trigger là Zalo Bot inbound).
				</div>
			</div>
		);
	}

	if (loading && !rows) {
		return <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Đang tải user links…</div>;
	}

	if (error && (!rows || rows.length === 0)) {
		return (
			<div style={{ marginTop: 4 }}>
				<input
					type="text"
					value={value ?? ''}
					placeholder="Không tải được — nhập chat_id thủ công"
					onChange={(e) => onChange(e.target.value)}
					style={inputStyle}
				/>
				<div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {error}</div>
			</div>
		);
	}

	const list = rows || [];
	const hasCurrent = !value || list.some((r) => r.chat_id === value || r.zalo_user_id === value);

	return (
		<div style={{ marginTop: 4 }}>
			<select
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value)}
				style={inputStyle}
			>
				<option value="">— Lấy từ trigger context —</option>
				{!hasCurrent && value && (
					<option value={value}>{value} (không có trong danh sách)</option>
				)}
				{list.map((r) => (
					<option key={r.chat_id} value={r.chat_id}>
						{r.label}
					</option>
				))}
			</select>
			{list.length === 0 && (
				// [2026-06-29 Johnny Chu] PHASE-REPLY-ZALO-FIX — prominent warning with guide + link.
				<div style={{
					marginTop: 6, padding: '8px 10px',
					background: '#fff7ed', border: '1px solid #fed7aa',
					borderRadius: 6, fontSize: 11, color: '#92400e', lineHeight: 1.6,
				}}>
					<strong>⚠ Bot #{instanceId} chưa có user nào linked.</strong><br />
					Để workflow biết gửi tin nhắn cho ai, thực hiện 3 bước:<br />
					<ol style={{ margin: '4px 0 4px 16px', padding: 0 }}>
						<li>Người dùng nhắn <code style={{ background: '#fef3c7', padding: '0 3px', borderRadius: 3 }}>chatid</code> cho bot → bot tự trả lời chat_id</li>
						<li>Vào{' '}
							<a
								href={String(BOOT.adminUrl || '#').replace(/page=[^&]+/, 'page=bizchat-gateway-spa')}
								target="_blank"
								rel="noreferrer"
								style={{ color: '#c2410c', textDecoration: 'underline' }}
							>
								Channel Gateway → Bot #{instanceId} → User links
							</a>
							{' '}→ Bind user với chat_id vừa lấy
						</li>
						<li>Quay lại đây → danh sách hiện user → chọn người nhận</li>
					</ol>
					💡 <em>Dùng template "Zalo Bot · Trả lời Chat ID" để bot tự động hóa bước 1.</em>
				</div>
			)}
			{list.length > 0 && (
				<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
					{list.length} user đã linked · để trống = lấy từ trigger · nhắn <code>chatid</code> cho bot để lấy chat_id mới
				</div>
			)}
		</div>
	);
}
