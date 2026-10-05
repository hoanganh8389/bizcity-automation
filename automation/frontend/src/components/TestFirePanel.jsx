/**
 * TestFirePanel — Right Sidebar tab "🚀 Fire" cho Playground (PG-S9).
 *
 * Form gửi synthetic inbound event vào Listener Bus với payload tuỳ biến →
 * workflow chạy thật (real LLM/REST/DB), KHÔNG mock.
 *
 * Yêu cầu:
 *   - Đang nghe (listenActive = true) HOẶC canvas có 1 trigger node.
 *   - trigger_code suy ra từ:
 *       1. listenTriggerCode nếu đang nghe.
 *       2. Trigger node đầu tiên trên canvas.
 *
 * Khác `replayEvent`:
 *   - Replay re-fires 1 event đã có thật (giữ nguyên id/ts).
 *   - TestFire build payload mới từ form, đi qua POST /test/fire → Listener
 *     Bus inject → workflow capture như inbound thật.
 *
 * @since 2026-05-31 (PG-S9)
 */
import { useMemo, useState } from 'react';
import { Rocket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { automationApi } from '../lib/api.js';
import { useBuilderStore } from '../store/builderStore.js';

const TRIGGER_PRESETS = {
	zalo_inbound:     { platform: 'ZALO_BOT', sample_chat: 'user_84933000111' },
	fb_message:       { platform: 'FB_MESS',  sample_chat: 'fb_psid_100099112233' },
	fb_comment:       { platform: 'FB_FEED',  sample_chat: 'fb_post_xyz_comment_1' },
	telegram_inbound: { platform: 'TELEGRAM', sample_chat: 'tg_5511223344' },
};

function genId(prefix) {
	const t = Date.now().toString(36);
	const r = Math.random().toString(36).slice(2, 6);
	return `${prefix}_${t}_${r}`;
}

export default function TestFirePanel() {
	const listenActive = useBuilderStore((s) => s.listenActive);
	const listenCode   = useBuilderStore((s) => s.listenTriggerCode);
	const nodes        = useBuilderStore((s) => s.nodes);

	// Derive trigger code: prefer active listener, else first trigger node on canvas.
	const triggerCode = useMemo(() => {
		if (listenCode) return listenCode;
		const t = nodes.find((n) => String(n.data?.blockId || '').startsWith('trigger.'));
		return t ? String(t.data.blockId).replace(/^trigger\./, '') : '';
	}, [listenCode, nodes]);

	const triggerNode = useMemo(() => {
		if (!triggerCode) return null;
		return nodes.find((n) => String(n.data?.blockId || '') === `trigger.${triggerCode}`) || null;
	}, [triggerCode, nodes]);

	const preset = TRIGGER_PRESETS[triggerCode] || { platform: '', sample_chat: '' };

	const [chatId, setChatId]    = useState('');
	const [senderId, setSender]  = useState('dev-tester');
	const [message, setMessage]  = useState('Chào bot, đây là test fire payload.');
	const [busy, setBusy]        = useState(false);
	const [result, setResult]    = useState(null);   // { ok, hits, error }
	const [accountId, setAcct]   = useState('');

	const effChatId = chatId.trim() || preset.sample_chat || genId('chat');
	const effAcctId = accountId.trim() || String(triggerNode?.data?.instance_id || '');
	const canFire   = !!triggerCode && message.trim().length > 0 && !busy;

	const fire = async () => {
		if (!canFire) return;
		setBusy(true);
		setResult(null);
		try {
			const payload = {
				text:        message,
				message:     message,
				chat_id:     effChatId,
				sender_id:   senderId.trim() || 'dev-tester',
				user_id:     senderId.trim() || 'dev-tester',
				instance_id: effAcctId,
				account_id:  effAcctId,
				platform:    preset.platform,
				event_type:  'message',
				direction:   'in',
				_source:     'pg_s9_test_fire',
			};
			const res = await automationApi.listenFire(triggerCode, payload);
			setResult({ ok: true, hits: res?.hits ?? 0, error: '' });
		} catch (err) {
			setResult({ ok: false, hits: 0, error: err?.message || 'Lỗi bắn payload' });
		} finally {
			setBusy(false);
		}
	};

	if (!triggerCode) {
		return (
			<div style={{
				display: 'flex', flexDirection: 'column', height: '100%',
				background: '#0f172a', color: '#94a3b8',
				alignItems: 'center', justifyContent: 'center',
				padding: 24, textAlign: 'center', fontSize: 12,
			}}>
				<Rocket size={28} style={{ color: '#475569', marginBottom: 12 }} />
				<div>Cần có 1 <strong style={{ color: '#e2e8f0' }}>trigger node</strong> trên canvas
				(zalo_inbound / fb_message / fb_comment / telegram_inbound) hoặc đang trong phiên "Chạy thử".</div>
			</div>
		);
	}

	return (
		<div style={{
			display: 'flex', flexDirection: 'column', height: '100%',
			background: '#0f172a', color: '#e2e8f0',
		}}>
			<div style={{
				display: 'flex', alignItems: 'center', gap: 8,
				padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
			}}>
				<Rocket size={14} style={{ color: '#fbbf24' }} />
				<strong style={{ fontSize: 13 }}>Test Fire — Real Run</strong>
				<code style={{ color: '#7dd3fc', fontSize: 11 }}>{triggerCode}</code>
				{preset.platform && (
					<span style={{ fontSize: 10, color: '#94a3b8' }}>· {preset.platform}</span>
				)}
				{listenActive && (
					<span style={{ fontSize: 10, color: '#fbbf24' }}>● đang nghe</span>
				)}
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: 12, fontSize: 12 }}>
				<div style={{
					padding: 8, marginBottom: 12,
					background: '#1e293b', border: '1px solid #334155',
					borderRadius: 4, fontSize: 11, color: '#cbd5e1',
				}}>
					<strong style={{ color: '#fbbf24' }}>⚠ Real call</strong> — payload sẽ được
					inject vào Listener Bus và <strong>workflow chạy thật</strong>: gọi LLM,
					REST gateway, ghi DB. Không có dry-run / mock.
				</div>

				<Field label="chat_id">
					<Input value={chatId} onChange={setChatId}
						placeholder={preset.sample_chat || 'auto-generate'} />
				</Field>
				<Field label="user_id (sender)">
					<Input value={senderId} onChange={setSender} placeholder="dev-tester" />
				</Field>
				{triggerNode?.data?.instance_id ? null : (
					<Field label="instance_id / account_id">
						<Input value={accountId} onChange={setAcct} placeholder="(optional)" />
					</Field>
				)}
				<Field label="Message">
					<textarea
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						rows={4}
						style={{
							width: '100%', resize: 'vertical', minHeight: 60,
							padding: '6px 8px', borderRadius: 4,
							border: '1px solid #334155', background: '#0b1220',
							color: '#e2e8f0', fontSize: 13, fontFamily: 'inherit',
						}}
					/>
				</Field>

				<button
					type="button" onClick={fire} disabled={!canFire}
					style={{
						width: '100%', padding: '10px 12px', marginTop: 6,
						borderRadius: 6,
						border: '1px solid ' + (canFire ? '#f59e0b' : '#334155'),
						background: canFire ? '#d97706' : '#1e293b',
						color: canFire ? '#fff' : '#64748b',
						fontWeight: 700, fontSize: 13,
						cursor: canFire ? 'pointer' : 'not-allowed',
						display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
					}}
				>
					<Rocket size={14} />
					{busy ? 'Đang bắn…' : 'Fire — chạy workflow thật'}
				</button>

				{result && (
					<div style={{
						marginTop: 10, padding: 8, borderRadius: 4, fontSize: 11,
						display: 'flex', alignItems: 'flex-start', gap: 6,
						background: result.ok ? '#052e16' : '#450a0a',
						border:     result.ok ? '1px solid #166534' : '1px solid #7f1d1d',
						color:      result.ok ? '#86efac' : '#fca5a5',
					}}>
						{result.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
						<div style={{ flex: 1 }}>
							{result.ok
								? `✓ Inject OK — ${result.hits} listener match. Workflow đang chạy, theo dõi tab Run timeline / Trace.`
								: `⚠ ${result.error}`}
						</div>
					</div>
				)}

				<div style={{
					marginTop: 16, padding: 8,
					background: '#020617', border: '1px solid #1e293b',
					borderRadius: 4, fontSize: 10, color: '#64748b',
					fontFamily: 'ui-monospace, monospace',
				}}>
					<div style={{ color: '#94a3b8', marginBottom: 4 }}>Payload preview:</div>
					<pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{JSON.stringify({
	trigger_code: triggerCode,
	payload: {
		text:        message,
		chat_id:     effChatId,
		user_id:     senderId.trim() || 'dev-tester',
		instance_id: effAcctId,
		platform:    preset.platform,
		event_type:  'message',
		direction:   'in',
	},
}, null, 2)}
					</pre>
				</div>
			</div>
		</div>
	);
}

function Field({ label, children }) {
	return (
		<div style={{ marginBottom: 10 }}>
			<label style={{ display: 'block', fontSize: 10, color: '#94a3b8', marginBottom: 4, fontWeight: 600 }}>
				{label}
			</label>
			{children}
		</div>
	);
}

function Input({ value, onChange, placeholder }) {
	return (
		<input
			type="text"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			placeholder={placeholder}
			style={{
				width: '100%', padding: '6px 8px', borderRadius: 4,
				border: '1px solid #334155', background: '#0b1220',
				color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit',
			}}
		/>
	);
}
