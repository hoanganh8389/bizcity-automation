import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Copy, Download, RefreshCw } from 'lucide-react';
import { automationApi, BizCityApiError } from '../lib/api.js';

const STATUS_LABELS = {
	collecting: 'Đang thu thập',
	confirming: 'Đang chờ xác nhận',
	ready: 'Sẵn sàng',
	blocked: 'Tạm dừng',
	expired: 'Hết hạn',
	failed: 'Lỗi',
	cancelled: 'Đã huỷ',
};

const ACTION_LABELS = {
	open: 'Mở HIL',
	ask: 'Hỏi slot',
	reask: 'Hỏi lại slot',
	confirm: 'Yêu cầu xác nhận',
	ready: 'Đủ dữ liệu',
	paused: 'Tạm dừng',
	failed: 'Thất bại',
	expired: 'Hết hạn',
	cancelled: 'Đã huỷ',
};

export default function HILTracePanel({ runId = '', chatId = '', active = false }) {
	const [data, setData] = useState(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');
	const [copyStatus, setCopyStatus] = useState('');

	const params = useMemo(() => {
		if (runId) return { run_id: runId, limit: 50 };
		if (chatId) return { chat_id: chatId, limit: 50 };
		return null;
	}, [runId, chatId]);

	const load = async () => {
		if (!params) {
			setData(null);
			setError('');
			return;
		}
		setLoading(true);
		try {
			const response = await automationApi.hilTrace(params);
			setData(response?.ok ? response : null);
			setError('');
		} catch (requestError) {
			if (requestError instanceof BizCityApiError && requestError.status === 404) {
				setData(null);
				setError('');
			} else {
				setError(requestError?.message || 'Không tải được HIL trace.');
			}
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		if (!params || !active) return undefined;
		const timer = window.setInterval(load, 1800);
		return () => window.clearInterval(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [params, active]);

	const copyJson = async () => {
		if (!data) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
			setCopyStatus('✓ Copied');
		} catch (copyError) {
			setCopyStatus('✗ Lỗi copy');
		}
		window.setTimeout(() => setCopyStatus(''), 1500);
	};

	const downloadJson = () => {
		if (!data) return;
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `hil-trace-${data.hil_id || 'unknown'}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		window.setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	const copyHilId = async () => {
		if (!data?.hil_id) return;
		try {
			await navigator.clipboard.writeText(String(data.hil_id));
			setCopyStatus('✓ HIL ID copied');
		} catch (copyError) {
			setCopyStatus('✗ Lỗi copy');
		}
		window.setTimeout(() => setCopyStatus(''), 1500);
	};

	if (!params) {
		return <EmptyTrace message="Workflow này chưa có HIL Instance đang chạy. Bấm Cấu hình HIL trong Inspector để thêm hoặc chạy thử một inbound." />;
	}
	if (loading && !data && !error) {
		return <div style={panelStyle}>Đang tải HIL trace…</div>;
	}
	if (error) {
		return <div style={{ ...panelStyle, color: '#fca5a5' }}><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}</div>;
	}
	if (!data?.header) {
		return <EmptyTrace message="Chưa có snapshot HIL. Hãy gửi thêm một lượt inbound để HIL mở hoặc tiếp tục hỏi slot." />;
	}

	const header = data.header;
	const slots = data.footnotes?.[data.footnotes.length - 1]?.slots_status || [];
	const progress = header.slots_required > 0 ? Math.round((header.slots_filled / header.slots_required) * 100) : 0;
	const footnotes = [...(data.footnotes || [])].reverse();

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: '#e2e8f0', fontSize: 12 }}>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
				<strong style={{ color: header.ready ? '#86efac' : '#fbbf24' }}>HIL · {STATUS_LABELS[header.status] || header.status}</strong>
				<span>turn {header.turn_count}/{header.max_turns || '—'}</span>
				<span>· {header.slots_filled}/{header.slots_required} slot</span>
				<span style={{ flex: 1 }} />
				{copyStatus && <span style={{ color: '#7dd3fc' }}>{copyStatus}</span>}
				<button type="button" onClick={load} className="aw-icon-btn" style={{ color: '#cbd5e1' }} title="Tải lại HIL trace"><RefreshCw size={13} /></button>
				<button type="button" onClick={copyJson} className="aw-icon-btn" style={{ color: '#cbd5e1' }} title="Copy HIL trace JSON"><Copy size={13} /></button>
				<button type="button" onClick={downloadJson} className="aw-icon-btn" style={{ color: '#cbd5e1' }} title="Tải HIL trace JSON"><Download size={13} /></button>
			</div>
			<div style={{ height: 5, borderRadius: 3, background: '#1e293b', marginBottom: 8 }}>
				<div style={{ width: `${Math.min(100, progress)}%`, height: '100%', borderRadius: 3, background: header.ready ? '#22c55e' : '#f59e0b' }} />
			</div>
			{header.status === 'blocked' && (
				<div style={{ padding: '6px 8px', marginBottom: 8, border: '1px solid #f59e0b', borderRadius: 4, color: '#fde68a' }}>
					<AlertTriangle size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />HIL đang tạm dừng do vượt giới hạn lượt hỏi. HIL ID: <code>{data.hil_id}</code>
					<button type="button" onClick={copyHilId} className="aw-btn aw-btn-outline" style={{ marginLeft: 8, padding: '2px 7px', fontSize: 10, color: '#fde68a', borderColor: '#f59e0b' }} title="Copy HIL ID để tra Diagnostics"><Copy size={11} /> Copy HIL ID</button>
				</div>
			)}
			<div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, .8fr) minmax(260px, 1.2fr)', gap: 10, flex: 1, minHeight: 0 }}>
				<div style={{ overflowY: 'auto', paddingRight: 4 }}>
					<div style={{ color: '#94a3b8', marginBottom: 5 }}>Slot checklist</div>
					{slots.length === 0 && <div style={{ color: '#64748b' }}>Spec chưa có slot để hiển thị.</div>}
					{slots.map((slot) => (
						<div key={slot.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '4px 0', color: slot.filled ? '#86efac' : '#cbd5e1' }}>
							{slot.filled ? <CheckCircle2 size={14} /> : <Circle size={14} style={{ color: '#64748b' }} />}
							<span>{slot.label || slot.id}{slot.redacted ? ' · ••••' : ''}{slot.required ? ' *' : ''}</span>
						</div>
					))}
				</div>
				<div style={{ overflowY: 'auto', paddingRight: 4 }}>
					<div style={{ color: '#94a3b8', marginBottom: 5 }}>Footnote HIL · mới nhất trên cùng</div>
					{footnotes.map((note, index) => (
						<div key={`${note.hil_id}-${note.turn_index}-${index}`} style={{ borderBottom: '1px solid #1e293b', padding: '5px 0' }}>
							<div style={{ display: 'flex', gap: 7, alignItems: 'baseline' }}>
								<span style={{ color: '#64748b' }}>#{note.turn_index}</span>
								<strong style={{ color: note.action === 'ready' ? '#86efac' : '#7dd3fc' }}>{ACTION_LABELS[note.action] || note.action}</strong>
								<span style={{ color: '#94a3b8' }}>{note.slot_label || note.slot_id || '—'}</span>
								<span style={{ marginLeft: 'auto', color: '#64748b' }}>{note.slots_progress?.filled || 0}/{note.slots_progress?.required || 0}</span>
							</div>
							{note.question_asked && <div style={{ color: '#cbd5e1', marginTop: 2 }}>Hỏi: {note.question_asked}</div>}
							{note.answer_preview && <div style={{ color: '#94a3b8', marginTop: 2 }}>{note.answer_redacted ? 'Đã nhận (ẩn dữ liệu)' : note.answer_preview}</div>}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function EmptyTrace({ message }) {
	return <div style={{ ...panelStyle, color: '#94a3b8' }}>{message}</div>;
}

const panelStyle = {
	padding: 12,
	color: '#94a3b8',
	fontSize: 12,
};
