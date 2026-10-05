/**
 * RawTracePanel — Right Sidebar tab "📜 Trace" cho Playground.
 *
 * Merged timeline của TẤT CẢ events trong listener bus suốt phiên Chạy thử:
 * inbound · outbound · automation · twin · system. Sort by id ascending.
 *
 * Filter chips cho phép toggle từng kind. Mỗi row click → expand JSON.
 *
 * Data source: builderStore.traceEvents (push từ runner.subscribeListenerStream
 * trước khi route sang inbox/twin pane).
 *
 * @since 2026-05-31 (PG-S4)
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollText, Trash2, RotateCcw, Link2 } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore.js';
import { replayEvent } from '../runtime/runner.js';
import BindZaloChatDialog from './BindZaloChatDialog.jsx';

const KIND_STYLE = {
	inbound:    { color: '#15803d', bg: '#052e16', label: 'IN',   icon: '📥' },
	outbound:   { color: '#0369a1', bg: '#082f49', label: 'OUT',  icon: '📤' },
	automation: { color: '#b45309', bg: '#451a03', label: 'AUTO', icon: '⚙' },
	twin:       { color: '#a855f7', bg: '#3b0764', label: 'TWIN', icon: '🧠' },
	system:     { color: '#64748b', bg: '#1e293b', label: 'SYS',  icon: '·' },
};

const ALL_KINDS = ['inbound', 'outbound', 'automation', 'twin', 'system'];

function fmtTs(ts) {
	if (!ts) return '—';
	try {
		const d = new Date(Number(ts) * 1000);
		const t = d.toLocaleTimeString('vi-VN', { hour12: false });
		const ms = String(Math.floor((Number(ts) % 1) * 1000)).padStart(3, '0');
		return `${t}.${ms}`;
	} catch { return String(ts); }
}

function TraceRow({ ev, focused }) {
	const [open, setOpen] = useState(false);
	const [bindOpen, setBindOpen] = useState(false);
	const style = KIND_STYLE[ev.kind] || KIND_STYLE.system;
	const hasMeta = ev.meta && Object.keys(ev.meta).length > 0;
	const canBindZalo = ev.platform === 'ZALO_BOT'
		&& ev.kind === 'inbound'
		&& ev.direction !== 'out'
		&& String(ev.chat_id || '').startsWith('zalobot_')
		&& Number(ev.meta?.wp_user_id || ev.wp_user_id || 0) <= 0
		&& String(ev.meta?.sender_user_id || ev.user_id || '') !== '';
	const detail = {
		platform: ev.platform,
		account_id: ev.account_id,
		user_id: ev.user_id,
		chat_id: ev.chat_id,
		event_type: ev.event_type,
		direction: ev.direction,
		run_id: ev.run_id,
		node_id: ev.node_id,
		status: ev.status,
		meta: ev.meta,
	};

	return (
		<div style={{
			borderLeft: `3px solid ${style.color}`,
			margin: '1px 0',
			padding: '3px 8px',
			background: focused ? '#1e293b' : '#0b1220',
			outline: focused ? '1px solid #7dd3fc' : 'none',
			borderRadius: 2,
			fontSize: 11,
			fontFamily: 'ui-monospace, monospace',
		}}>
			<div
				onClick={() => setOpen((v) => !v)}
				style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
			>
				<span style={{ color: '#475569', minWidth: 90 }}>{fmtTs(ev.ts)}</span>
				<span style={{
					padding: '0 5px', borderRadius: 3, minWidth: 38, textAlign: 'center',
					background: style.bg, color: style.color, fontSize: 9, fontWeight: 700,
				}}>{style.label}</span>
				<code style={{ color: '#7dd3fc', fontSize: 10 }}>
					{ev.platform || '—'}
				</code>
				<span style={{ color: '#cbd5e1', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
					{ev.message || <em style={{ color: '#475569' }}>(no msg)</em>}
				</span>
				{canBindZalo && (
					<button
						type="button"
						onClick={(event) => { event.stopPropagation(); setBindOpen(true); }}
						title="Bind chat này với WP user"
						style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', border: '1px solid #38bdf8', borderRadius: 4, background: '#082f49', color: '#7dd3fc', cursor: 'pointer', fontSize: 10 }}
					>
						<Link2 size={11} /> Bind
					</button>
				)}
				<span style={{ color: '#475569', fontSize: 9 }}>#{ev.id}</span>
			</div>
			{open && hasMeta && (
				<pre style={{
					margin: '4px 0 0 96px', padding: 6,
					background: '#020617', color: '#94a3b8',
					fontSize: 10, lineHeight: 1.4,
					borderRadius: 3, overflowX: 'auto', maxHeight: 240,
				}}>
					{JSON.stringify(detail, null, 2)}
				</pre>
			)}
			{bindOpen && (
				<BindZaloChatDialog event={ev} onClose={() => setBindOpen(false)} />
			)}
		</div>
	);
}

export default function RawTracePanel() {
	const events       = useBuilderStore((s) => s.traceEvents);
	const clearTrace   = useBuilderStore((s) => s.clearTraceEvents);
	const listenActive = useBuilderStore((s) => s.listenActive);
	const [enabledKinds, setEnabledKinds] = useState(new Set(ALL_KINDS));
	// PG-S8 — Replay scrubber: focusIdx into filtered[]; followLatest auto-tracks tail.
	const [focusIdx, setFocusIdx]     = useState(0);
	const [followLatest, setFollow]   = useState(true);

	const counts = useMemo(() => {
		const c = { inbound: 0, outbound: 0, automation: 0, twin: 0, system: 0 };
		events.forEach((ev) => { if (c[ev.kind] !== undefined) c[ev.kind] += 1; });
		return c;
	}, [events]);

	const filtered = useMemo(() => {
		return events
			.filter((ev) => enabledKinds.has(ev.kind))
			.slice()
			.sort((a, b) => (a.id || 0) - (b.id || 0));
	}, [events, enabledKinds]);

	// Auto-snap focus to latest when followLatest is on.
	useEffect(() => {
		if (followLatest && filtered.length > 0) {
			setFocusIdx(filtered.length - 1);
		}
	}, [filtered.length, followLatest]);

	const focused = filtered.length > 0 ? filtered[Math.min(focusIdx, filtered.length - 1)] : null;
	const focusedKey = focused ? `${focused.kind}:${focused.id}` : '';

	const toggleKind = (k) => {
		setEnabledKinds((prev) => {
			const next = new Set(prev);
			if (next.has(k)) next.delete(k); else next.add(k);
			return next;
		});
	};

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', color: '#e2e8f0' }}>
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
				gap: 8, flexWrap: 'wrap',
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
					<ScrollText size={14} />
					<strong style={{ fontSize: 13 }}>Raw Trace ({events.length})</strong>
				</div>
				<div style={{ display: 'flex', gap: 4, flex: 1, minWidth: 0, overflowX: 'auto' }}>
					{ALL_KINDS.map((k) => {
						const st = KIND_STYLE[k];
						const enabled = enabledKinds.has(k);
						return (
							<button
								key={k}
								type="button"
								onClick={() => toggleKind(k)}
								style={{
									padding: '2px 8px', borderRadius: 10,
									border: `1px solid ${enabled ? st.color : '#334155'}`,
									background: enabled ? st.bg : 'transparent',
									color: enabled ? st.color : '#64748b',
									fontSize: 10, fontWeight: 600,
									cursor: 'pointer', whiteSpace: 'nowrap',
								}}
								title={`Toggle ${k}`}
							>
								{st.icon} {st.label} ({counts[k] || 0})
							</button>
						);
					})}
				</div>
				<button type="button" onClick={clearTrace} className="aw-icon-btn"
					style={{ color: '#cbd5e1', flex: '0 0 auto' }} title="Xoá trace">
					<Trash2 size={14} />
				</button>
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
				{filtered.length === 0 ? (
					<div style={{
						color: '#94a3b8', textAlign: 'center', padding: 24, fontSize: 12,
					}}>
						{listenActive
							? 'Đang chờ events… Trace pane sẽ gom mọi event qua Listener Bus theo thời gian thực.'
							: 'Bấm "▶ Chạy thử" để bắt đầu trace.'}
					</div>
				) : (
					filtered.map((ev) => (
						<TraceRow key={`${ev.kind}:${ev.id}`} ev={ev} focused={focusedKey === `${ev.kind}:${ev.id}`} />
					))
				)}
			</div>

			{/* PG-S8 — Replay scrubber footer. */}
			{filtered.length > 0 && (
				<div style={{
					borderTop: '1px solid #1e293b',
					padding: '6px 10px',
					background: '#0b1220',
					display: 'flex', flexDirection: 'column', gap: 4,
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
						<input
							type="range"
							min={0}
							max={Math.max(0, filtered.length - 1)}
							value={Math.min(focusIdx, filtered.length - 1)}
							onChange={(e) => { setFocusIdx(Number(e.target.value)); setFollow(false); }}
							style={{ flex: 1 }}
						/>
						<span style={{ fontSize: 10, color: '#94a3b8', minWidth: 70, textAlign: 'right' }}>
							{Math.min(focusIdx, filtered.length - 1) + 1} / {filtered.length}
						</span>
						<button type="button" onClick={() => setFollow((v) => !v)}
							title={followLatest ? 'Đang follow tail — bấm để pin' : 'Đang pin — bấm để follow tail'}
							style={{
								padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600,
								border: '1px solid ' + (followLatest ? '#22d3ee' : '#475569'),
								background: followLatest ? '#0e7490' : '#1e293b',
								color: followLatest ? '#fff' : '#94a3b8',
								cursor: 'pointer', whiteSpace: 'nowrap',
							}}>
							{followLatest ? '● Live' : '⏸ Pin'}
						</button>
					</div>
					{focused && (
						<div style={{
							display: 'flex', alignItems: 'center', gap: 8,
							fontSize: 11, color: '#cbd5e1',
							padding: '4px 6px',
							background: '#020617', borderRadius: 4,
							border: '1px solid #1e293b',
						}}>
							<span style={{ color: '#475569' }}>{fmtTs(focused.ts)}</span>
							<span style={{
								padding: '0 5px', borderRadius: 3,
								background: (KIND_STYLE[focused.kind] || KIND_STYLE.system).bg,
								color: (KIND_STYLE[focused.kind] || KIND_STYLE.system).color,
								fontSize: 9, fontWeight: 700,
							}}>{(KIND_STYLE[focused.kind] || KIND_STYLE.system).label}</span>
							<span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
								{focused.message || focused.event_type || <em style={{ color: '#475569' }}>(no msg)</em>}
							</span>
							{focused.kind === 'inbound' && (
								<button type="button"
									onClick={() => replayEvent(focused)}
									disabled={!listenActive}
									title={listenActive
										? 'Replay event này qua workflow hiện tại'
										: 'Cần bấm ▶ Chạy thử trước rồi mới replay được'}
									style={{
										padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
										border: '1px solid ' + (listenActive ? '#0ea5e9' : '#334155'),
										background: listenActive ? '#0284c7' : '#1e293b',
										color: listenActive ? '#fff' : '#64748b',
										cursor: listenActive ? 'pointer' : 'not-allowed',
										display: 'inline-flex', alignItems: 'center', gap: 3,
									}}>
									<RotateCcw size={11} /> Replay
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
