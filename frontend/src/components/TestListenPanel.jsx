/**
 * Test Listen panel — STATUS-ONLY (since 2026-05-31 unify).
 *
 * "Chạy thử" trên toolbar là entry point duy nhất cho trigger event-driven.
 * Toolbar gọi `runner.startChannelListen()` để subscribe trực tiếp vào
 * `bizcity-channel/v1/listener/stream` (Listener Bus — single source of truth
 * theo PHASE-0-DOC-CHANNEL-LISTENING §2/§6).
 *
 * Panel này chỉ:
 *   - Hiển thị trạng thái nghe của trigger node hiện tại (đang nghe / chưa).
 *   - Cho phép bắn payload mẫu (dev) khi đang nghe để test UI nhanh.
 *   - KHÔNG còn nút "Bắt đầu nghe" riêng — tránh 2 nguồn truth.
 */
import { Radio, RefreshCw, Square, Zap, Play } from 'lucide-react';
import { useState } from 'react';
import { automationApi } from '../lib/api.js';
import { useBuilderStore } from '../store/builderStore.js';
// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 FIX — import runWorkflow for cron dispatch.
import { stopActiveListener, runWorkflow } from '../runtime/runner.js';

// 'cron' removed — handled separately with a Dispatch Now button.
const UNSUPPORTED_CODES = new Set(['manual']);

export default function TestListenPanel({ node }) {
	const triggerCode  = String(node?.data?.blockId || '').replace(/^trigger\./, '');
	const supported    = triggerCode && !UNSUPPORTED_CODES.has(triggerCode);
	const listenActive = useBuilderStore((s) => s.listenActive);
	const listenCode   = useBuilderStore((s) => s.listenTriggerCode);
	const isRunning    = useBuilderStore((s) => s.isRunning);
	const [error, setError]         = useState('');
	const [fireBusy, setFireBusy]   = useState(false);
	const [dispBusy, setDispBusy]   = useState(false);

	// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 FIX — cron: show Dispatch Now panel instead of warning.
	if (triggerCode === 'cron' || triggerCode === 'scheduler') {
		const handleDispatch = async () => {
			setDispBusy(true);
			setError('');
			try {
				await runWorkflow();
			} catch (e) {
				setError(e?.message || 'Lỗi dispatch');
			} finally {
				setDispBusy(false);
			}
		};
		return (
			<div style={{ ...panelStyle, background: '#f0fdf4', borderColor: '#86efac' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
					<Play size={13} style={{ color: '#16a34a' }} />
					<strong style={{ fontSize: 12, color: '#15803d' }}>Chạy thử (Dispatch ngay)</strong>
				</div>
				<div style={{ ...hintStyle, marginBottom: 8 }}>
					Trigger <code>cron</code> không có event thật để nghe. Bấm bên dưới để
					dispatch workflow ngay, quan sát Trace giống cron thật.
				</div>
				<button
					type="button"
					onClick={handleDispatch}
					disabled={dispBusy || isRunning}
					className="aw-btn aw-btn-outline"
					style={{ width: '100%', color: '#15803d', borderColor: '#86efac' }}
				>
					<Play size={14} />
					{dispBusy || isRunning ? 'Đang chạy…' : '▶ Dispatch cron ngay'}
				</button>
				{error && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>⚠ {error}</div>}
			</div>
		);
	}

	if (!supported) {
		return (
			<div style={panelStyle}>
				<div style={{ fontSize: 11, color: '#94a3b8' }}>
					Trigger <code>{node?.data?.blockId}</code> không hỗ trợ "Chạy thử"
					(không phải event-driven).
				</div>
			</div>
		);
	}

	const listeningThisNode = listenActive && listenCode === triggerCode;

	const fire = async () => {
		setError('');
		setFireBusy(true);
		try {
			await automationApi.listenFire(triggerCode, {
				text:        `[DEV] gửi thử cho ${triggerCode} lúc ${new Date().toLocaleTimeString()}`,
				instance_id: String(node?.data?.instance_id || ''),
				sender_id:   'dev-tester',
			});
		} catch (e) {
			setError(e?.message || 'Lỗi bắn thử');
		} finally {
			setFireBusy(false);
		}
	};

	return (
		<div style={panelStyle}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
				<Radio size={13} style={{ color: listeningThisNode ? '#dc2626' : '#64748b' }} />
				<strong style={{ fontSize: 12 }}>Chạy thử (Test Listen)</strong>
			</div>

			{!listenActive && (
				<div style={hintStyle}>
					Bấm <strong>▶ Chạy thử</strong> trên toolbar để bắt đầu nghe kênh
					<code style={{ marginLeft: 4 }}>{triggerCode}</code>. Khi có tin thật
					đến webhook, workflow sẽ tự chạy step-by-step.
				</div>
			)}

			{listeningThisNode && (
				<>
					<div style={{ fontSize: 12, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
						<RefreshCw size={12} className="aw-animate-spin" />
						Đang nghe <code>{triggerCode}</code> — gửi 1 tin thật vào kênh.
					</div>
					<button type="button" onClick={() => stopActiveListener('user_stop')}
						className="aw-btn aw-btn-outline" style={{ width: '100%', marginTop: 8 }}>
						<Square size={14} /> Dừng nghe
					</button>
					<button type="button" onClick={fire} disabled={fireBusy}
						className="aw-btn aw-btn-outline"
						style={{ width: '100%', marginTop: 6, fontSize: 11 }}
						title="Bỏ qua bước gửi tin thật — nội bộ chỉ test UI">
						<Zap size={12} /> {fireBusy ? 'Đang bắn…' : 'Bắn payload mẫu (dev)'}
					</button>
				</>
			)}

			{listenActive && !listeningThisNode && (
				<div style={{ fontSize: 11, color: '#b45309' }}>
					⚠ Đang nghe trigger khác (<code>{listenCode}</code>). Dừng trên toolbar
					trước khi nghe node này.
				</div>
			)}

			{error && (
				<div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>⚠ {error}</div>
			)}
		</div>
	);
}

const panelStyle = {
	marginTop: 12, padding: 10,
	background: '#fefce8', border: '1px solid #fde68a',
	borderRadius: 6,
};
const hintStyle = {
	fontSize: 11, color: '#64748b', lineHeight: 1.5,
};
