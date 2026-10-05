import { useEffect, useState } from 'react';
import { useBuilderStore } from '../store/builderStore.js';
import { Trash2, ChevronDown, Copy, Download, ChevronRight } from 'lucide-react';
import InboxLivePanel from './InboxLivePanel.jsx';
import MprLayerPanel from './MprLayerPanel.jsx';
import RawTracePanel from './RawTracePanel.jsx';
import TestFirePanel from './TestFirePanel.jsx';
import ReplayScrubber from './ReplayScrubber.jsx';
import HILTracePanel from './HILTracePanel.jsx';

const LEVEL_STYLE = {
	info:  { color: '#0369a1', bg: '#e0f2fe' },
	run:   { color: '#b45309', bg: '#fef3c7' },
	ok:    { color: '#15803d', bg: '#dcfce7' },
	error: { color: '#b91c1c', bg: '#fee2e2' },
};

export default function RunTimeline() {
	const open      = useBuilderStore((s) => s.isTimelineOpen);
	const toggle    = useBuilderStore((s) => s.toggleTimeline);
	const isRunning = useBuilderStore((s) => s.isRunning);
	const log       = useBuilderStore((s) => s.runLog);
	const clearLog  = useBuilderStore((s) => s.clearLog);
	const runId     = useBuilderStore((s) => s.runId);
	const select    = useBuilderStore((s) => s.select);
	const listenActive = useBuilderStore((s) => s.listenActive);
	const inboxCount   = useBuilderStore((s) => s.inboxEvents.length);
	const twinCount    = useBuilderStore((s) => s.twinEvents.length);
	const traceCount   = useBuilderStore((s) => s.traceEvents.length);
	const runDbId      = useBuilderStore((s) => s.runDbId);
	const latestChatId  = useBuilderStore((s) => {
		const events = Array.isArray(s.inboxEvents) ? s.inboxEvents : [];
		return String(events[events.length - 1]?.chat_id || '');
	});

	const [tab, setTab] = useState('log'); // 'log' | 'inbox' | 'mpr' | 'trace' | 'fire' | 'hil'
	const [expanded, setExpanded] = useState(() => new Set()); // log row indices showing full payload
	const [copyStatus, setCopyStatus] = useState('');

	const toggleExpand = (i) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(i)) next.delete(i); else next.add(i);
			return next;
		});
	};

	const buildExportPayload = () => ({
		exported_at: new Date().toISOString(),
		run_id: runId || null,
		run_db_id: runDbId || null,
		entries: log,
	});

	const copyLogJson = async () => {
		try {
			const json = JSON.stringify(buildExportPayload(), null, 2);
			await navigator.clipboard.writeText(json);
			setCopyStatus('✓ Copied');
			setTimeout(() => setCopyStatus(''), 1500);
		} catch (e) {
			setCopyStatus('✗ Lỗi');
			setTimeout(() => setCopyStatus(''), 1500);
		}
	};

	const downloadLogJson = () => {
		const json = JSON.stringify(buildExportPayload(), null, 2);
		const blob = new Blob([json], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		a.href = url;
		a.download = `run-timeline-${runId || 'local'}-${ts}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	// Auto-switch to inbox tab khi bắt đầu nghe (Chạy thử với event-driven trigger).
	useEffect(() => {
		if (listenActive) setTab('inbox');
	}, [listenActive]);

	// Auto-switch BACK to log tab ngay khi capture xong & async run được enqueue
	// (runDbId set → đã có run_id thật từ BE) → user thấy luồng node chạy live.
	useEffect(() => {
		if (runDbId) setTab('log');
	}, [runDbId]);

	if (!open) return null;

	return (
		<div style={{
			position: 'absolute', left: 0, right: 0, bottom: 0,
			height: 260, background: '#0f172a', color: '#e2e8f0',
			borderTop: '1px solid #1e293b', zIndex: 6,
			display: 'flex', flexDirection: 'column',
		}}>
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
					<TabBtn active={tab === 'log'} onClick={() => setTab('log')}>
						Run timeline{log.length > 0 ? ` (${log.length})` : ''}
					</TabBtn>
					<TabBtn active={tab === 'inbox'} onClick={() => setTab('inbox')}>
						Inbox{inboxCount > 0 ? ` (${inboxCount})` : ''}
						{listenActive && <span style={{ marginLeft: 6, color: '#fbbf24' }}>● nghe</span>}
					</TabBtn>
					<TabBtn active={tab === 'mpr'} onClick={() => setTab('mpr')}>
						🧠 MPR{twinCount > 0 ? ` (${twinCount})` : ''}
					</TabBtn>
					<TabBtn active={tab === 'trace'} onClick={() => setTab('trace')}>
						📜 Trace{traceCount > 0 ? ` (${traceCount})` : ''}
					</TabBtn>
					<TabBtn active={tab === 'fire'} onClick={() => setTab('fire')}>
						🚀 Fire
					</TabBtn>
					<TabBtn active={tab === 'hil'} onClick={() => setTab('hil')}>
						⚡ HIL
					</TabBtn>
					{tab === 'log' && runId && <code style={{ color: '#7dd3fc', marginLeft: 8 }}>{runId}</code>}
					{tab === 'log' && isRunning && <span style={{ color: '#fbbf24', marginLeft: 8 }}>● đang chạy</span>}
				</div>
				<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
					{tab === 'log' && log.length > 0 && (
						<>
							{copyStatus && (
								<span style={{ color: '#7dd3fc', fontSize: 11 }}>{copyStatus}</span>
							)}
							<button type="button" onClick={copyLogJson} className="aw-icon-btn"
								style={{ color: '#cbd5e1' }} title="Copy timeline JSON vào clipboard">
								<Copy size={14} />
							</button>
							<button type="button" onClick={downloadLogJson} className="aw-icon-btn"
								style={{ color: '#cbd5e1' }} title="Tải timeline JSON về máy">
								<Download size={14} />
							</button>
						</>
					)}
					{tab === 'log' && (
						<button type="button" onClick={clearLog} className="aw-icon-btn"
							style={{ color: '#cbd5e1' }} title="Xoá log">
							<Trash2 size={14} />
						</button>
					)}
					<button type="button" onClick={toggle} className="aw-icon-btn"
						style={{ color: '#cbd5e1' }} title="Đóng">
						<ChevronDown size={14} />
					</button>
				</div>
			</div>

			{/* PG-S8 — Time scrubber after run done. Auto-hides while running. */}
			<ReplayScrubber />

			{tab === 'inbox' ? (
				<div style={{ flex: 1, minHeight: 0 }}>
					<InboxLivePanel />
				</div>
			) : tab === 'mpr' ? (
				<div style={{ flex: 1, minHeight: 0 }}>
					<MprLayerPanel />
				</div>
			) : tab === 'trace' ? (
				<div style={{ flex: 1, minHeight: 0 }}>
					<RawTracePanel />
				</div>
			) : tab === 'fire' ? (
				<div style={{ flex: 1, minHeight: 0 }}>
					<TestFirePanel />
				</div>
			) : tab === 'hil' ? (
				<div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '6px 12px' }}>
					<HILTracePanel runId={runDbId || ''} chatId={latestChatId} active={isRunning || listenActive} />
				</div>
			) : (
				<div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px', fontFamily: 'monospace', fontSize: 12 }}>
					{log.length === 0 ? (
						<div style={{ color: '#64748b', padding: 12 }}>Chưa có log. Bấm "Chạy thử" để bắt đầu.</div>
					) : log.map((entry, i) => {
						const meta = LEVEL_STYLE[entry.level] || LEVEL_STYLE.info;
						const t = new Date(entry.ts);
						const hasPayload = entry.payload !== undefined && entry.payload !== null;
						const isExpanded = expanded.has(i);
						const payloadStr = hasPayload ? JSON.stringify(entry.payload, null, isExpanded ? 2 : 0) : '';
						return (
							<div key={i} style={{
								padding: '3px 6px', borderRadius: 4,
								background: isExpanded ? '#0b1220' : 'transparent',
							}}>
								<div
									onClick={() => entry.nodeId && select(entry.nodeId)}
									style={{
										display: 'flex', gap: 10, alignItems: 'flex-start',
										cursor: entry.nodeId ? 'pointer' : 'default',
									}}
									onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.parentElement.style.background = '#1e293b'; }}
									onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.parentElement.style.background = 'transparent'; }}
								>
									{hasPayload ? (
										<button type="button"
											onClick={(e) => { e.stopPropagation(); toggleExpand(i); }}
											style={{
												background: 'transparent', border: 'none', color: '#7dd3fc',
												cursor: 'pointer', padding: 0, lineHeight: 1, alignSelf: 'center',
												transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 120ms',
											}}
											title={isExpanded ? 'Thu gọn payload' : 'Mở rộng payload'}>
											<ChevronRight size={12} />
										</button>
									) : (
										<span style={{ width: 12, display: 'inline-block' }} />
									)}
									<span style={{ color: '#475569', minWidth: 80 }}>{t.toLocaleTimeString()}</span>
									<span style={{
										padding: '0 6px', borderRadius: 3, fontSize: 10, fontWeight: 700,
										color: meta.color, background: meta.bg, alignSelf: 'center',
									}}>{entry.level}</span>
									{entry.nodeId && (
										<span style={{ color: '#7dd3fc', minWidth: 90 }}>{entry.nodeId}</span>
									)}
									<span style={{ flex: 1 }}>{entry.msg}</span>
									{hasPayload && !isExpanded && (
										<span style={{ color: '#94a3b8', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
											{payloadStr.slice(0, 200)}
										</span>
									)}
								</div>
								{hasPayload && isExpanded && (
									<div style={{ marginLeft: 22, marginTop: 4 }}>
										<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
											<button type="button"
												onClick={() => navigator.clipboard?.writeText(payloadStr)}
												style={{
													background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1',
													fontSize: 10, padding: '2px 8px', borderRadius: 3, cursor: 'pointer',
												}}
												title="Copy payload JSON">
												<Copy size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
												Copy
											</button>
										</div>
										<pre style={{
											margin: 0, padding: 8, background: '#020617', border: '1px solid #1e293b',
											borderRadius: 4, color: '#a5f3fc', fontSize: 11, lineHeight: 1.5,
											maxHeight: 280, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
										}}>{payloadStr}</pre>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}

function TabBtn({ active, onClick, children }) {
	return (
		<button type="button" onClick={onClick} style={{
			border: 'none',
			background: active ? '#1e293b' : 'transparent',
			color: active ? '#e2e8f0' : '#94a3b8',
			padding: '4px 10px', borderRadius: 4, fontSize: 12, fontWeight: 600,
			cursor: 'pointer',
		}}>
			{children}
		</button>
	);
}
