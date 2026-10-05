import { useEffect, useMemo, useState } from 'react';
import { X, Search, Loader2, Link2, CheckCircle2 } from 'lucide-react';
import { automationApi } from '../lib/api.js';

const panelStyle = {
	position: 'fixed', inset: 0, zIndex: 1000,
	display: 'flex', alignItems: 'center', justifyContent: 'center',
	padding: 16, background: 'rgba(2, 6, 23, 0.68)',
};

const cardStyle = {
	width: 'min(520px, 100%)', maxHeight: 'min(680px, 100%)', overflow: 'auto',
	background: '#fff', color: '#0f172a', borderRadius: 10,
	boxShadow: '0 24px 80px rgba(2, 6, 23, 0.35)',
};

function getIdentity(event) {
	const meta = event?.meta || {};
	const chatId = String(event?.chat_id || '');
	const senderUserId = String(meta.sender_user_id || event?.user_id || '');
	const conversationChatId = String(meta.conversation_chat_id || chatId);
	const chatKind = String(meta.chat_kind || meta.provider_chat_type || '').toLowerCase() ||
		(conversationChatId.includes('_group_') ? 'group' : 'private');
	const botMatch = chatId.match(/^zalobot_(\d+)_/);
	return {
		botId: botMatch ? Number(botMatch[1]) : Number(event?.account_id || 0),
		chatId,
		senderUserId,
		conversationChatId,
		chatKind,
		displayName: String(meta.display_name || meta.sender_name || ''),
	};
}

export default function BindZaloChatDialog({ event, onClose, onBound }) {
	const identity = useMemo(() => getIdentity(event), [event]);
	const [query, setQuery] = useState('');
	const [users, setUsers] = useState([]);
	const [selected, setSelected] = useState(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		automationApi.zaloWpUsers('')
			.then((response) => {
				if (!cancelled) setUsers(Array.isArray(response?.users) ? response.users : []);
			})
			.catch((err) => { if (!cancelled) setError(err?.message || 'Không tải được danh sách WP user.'); })
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	const searchUsers = async (value) => {
		setQuery(value);
		setError('');
		try {
			const response = await automationApi.zaloWpUsers(value.trim());
			setUsers(Array.isArray(response?.users) ? response.users : []);
		} catch (err) {
			setError(err?.message || 'Không tìm được WP user.');
		}
	};

	const submit = async (eventObject) => {
		eventObject.preventDefault();
		if (!identity.botId || !identity.chatId || !identity.senderUserId || !selected?.id) {
			setError('Thiếu bot, chat_id, sender_user_id hoặc WP user.');
			return;
		}
		if (identity.chatKind === 'group' && identity.chatId.includes('_group_') && !identity.senderUserId) {
			setError('Không thể bind group chat_id khi thiếu sender_user_id của người gửi.');
			return;
		}
		setSaving(true);
		setError('');
		try {
			const result = await automationApi.zaloBindUser({
				platform: 'ZALO_BOT',
				bot_id: identity.botId,
				chat_id: identity.chatId,
				sender_user_id: identity.senderUserId,
				conversation_chat_id: identity.conversationChatId,
				chat_kind: identity.chatKind,
				wp_user_id: Number(selected.id),
				display_name: identity.displayName,
				source: 'automation_run_trace',
				run_id: event?.run_id || '',
				workflow_id: event?.workflow_id || 0,
			});
			if (!result?.resolver_check?.resolved) {
				throw new Error('Bind đã ghi nhưng server chưa resolve lại được WP user.');
			}
			setSuccess(result);
			if (onBound) onBound(result);
		} catch (err) {
			setError([err?.message || 'Bind thất bại.', err?.hint].filter(Boolean).join(' '));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div style={panelStyle} role="dialog" aria-modal="true" aria-label="Bind Zalo chat">
			<div style={cardStyle}>
				<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
					<div>
						<strong style={{ fontSize: 15 }}>Bind tài khoản cho Zalo chat</strong>
						<div style={{ color: '#64748b', fontSize: 11, marginTop: 3 }}>Chỉ admin mới được thực hiện thao tác này.</div>
					</div>
					<button type="button" onClick={onClose} title="Đóng" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
				</div>
				<div style={{ padding: 16 }}>
					<div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, fontSize: 12, lineHeight: 1.7 }}>
						<div><strong>Bot:</strong> #{identity.botId || '—'}</div>
						<div><strong>chat_id:</strong> <code>{identity.chatId || '—'}</code></div>
						<div><strong>sender_user_id:</strong> <code>{identity.senderUserId || '—'}</code></div>
						<div><strong>Loại chat:</strong> {identity.chatKind}</div>
						{identity.displayName && <div><strong>Tên Zalo:</strong> {identity.displayName}</div>}
						{identity.chatKind === 'group' && <div style={{ color: '#b45309', marginTop: 4 }}>Đây là group. Chỉ bind sender, không bind group chat_id.</div>}
					</div>

					{success ? (
						<div style={{ marginTop: 14, padding: 12, background: '#ecfdf5', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 13 }}>
							<CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
							Đã bind WP user #{success.wp_user_id}. Resolver đã xác nhận danh tính.
						</div>
					) : (
						<form onSubmit={submit}>
							<label style={{ display: 'block', marginTop: 14, fontSize: 12, fontWeight: 600 }}>Chọn tài khoản WordPress</label>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, border: '1px solid #cbd5e1', borderRadius: 7, padding: '0 8px' }}>
								<Search size={14} color="#64748b" />
								<input value={query} onChange={(e) => searchUsers(e.target.value)} placeholder="Tìm username, tên hoặc email" style={{ width: '100%', border: 0, outline: 0, padding: '9px 4px', fontSize: 12 }} />
							</div>
							<div style={{ marginTop: 8, maxHeight: 210, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 7 }}>
								{loading ? <div style={{ padding: 12, color: '#64748b', fontSize: 12 }}><Loader2 size={13} className="cg-animate-spin" /> Đang tải…</div> : users.length === 0 ? <div style={{ padding: 12, color: '#64748b', fontSize: 12 }}>Không có WP user phù hợp.</div> : users.map((user) => (
									<button key={user.id} type="button" onClick={() => setSelected(user)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', border: 0, borderBottom: '1px solid #f1f5f9', background: selected?.id === user.id ? '#eff6ff' : '#fff', cursor: 'pointer' }}>
										<strong style={{ fontSize: 12 }}>{user.display_name || user.user_login}</strong>
										<span style={{ display: 'block', color: '#64748b', fontSize: 11 }}>@{user.user_login} · #{user.id} · {user.user_email}</span>
									</button>
								))}
							</div>
							{selected && <div style={{ marginTop: 8, fontSize: 12, color: '#1d4ed8' }}>Đã chọn: <strong>{selected.display_name || selected.user_login}</strong> (#{selected.id})</div>}
							{error && <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>{error}</div>}
							<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
								<button type="button" onClick={onClose} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Hủy</button>
								<button type="submit" disabled={saving || !selected || !identity.senderUserId} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '8px 12px', border: 0, borderRadius: 6, background: saving || !selected || !identity.senderUserId ? '#94a3b8' : '#2563eb', color: '#fff', cursor: saving || !selected || !identity.senderUserId ? 'not-allowed' : 'pointer' }}>
									{saving ? <Loader2 size={14} className="cg-animate-spin" /> : <Link2 size={14} />} Bind và kiểm tra lại
								</button>
							</div>
						</form>
					)}
					{success && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}><button type="button" onClick={onClose} style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>Đóng</button></div>}
				</div>
			</div>
		</div>
	);
}
