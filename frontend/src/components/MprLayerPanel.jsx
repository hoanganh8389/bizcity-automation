/**
 * MprLayerPanel — Right Sidebar tab "MPR" cho Playground.
 *
 * Subscribe `builderStore.twinEvents` (mirror từ BizCity_Twin_Event_Bus qua
 * Listener Bus với kind='twin') → group theo 5 cognitive layers thành
 * accordion. Mỗi event hiển thị summary + payload preview JSON.
 *
 * Layers map (đồng bộ với class-automation-twin-event-tap.php::LAYER_MAP):
 *   L1  Perceive    pre_rules_done · user_message · brain_keywords
 *   L2  Recall      memory_recall · guru_lookup · guru_layer
 *   L3  Reason/Tool brain_perspective_selected · brain_tool_intent ·
 *                   tool_decided · tool_done · perspective_done
 *   L4  Synthesize  brain_synthesize · synthesis_done · agent_loop_done ·
 *                   pipeline_auto_degraded
 *   L4.5 Compose    assistant_message · final_done · memory_write
 *
 * @since 2026-05-31 (PG-S3)
 */
import { useMemo, useState } from 'react';
import { Brain, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore.js';

const LAYERS = [
	{ id: 1,   name: 'L1 · Perceive',   color: '#22d3ee', desc: 'Hiểu input' },
	{ id: 2,   name: 'L2 · Recall',     color: '#a855f7', desc: 'Nhớ context' },
	{ id: 3,   name: 'L3 · Reason',     color: '#f59e0b', desc: 'Quyết tool / perspective' },
	{ id: 4,   name: 'L4 · Synthesize', color: '#10b981', desc: 'Tổng hợp' },
	{ id: 5,   name: 'L4.5 · Compose',  color: '#ec4899', desc: 'Soạn final reply' },
];

function fmtTs(ts) {
	if (!ts) return '—';
	try {
		const d = new Date(Number(ts) * 1000);
		return d.toLocaleTimeString('vi-VN', { hour12: false });
	} catch { return String(ts); }
}

function EventRow({ ev, color }) {
	const [open, setOpen] = useState(false);
	const meta = ev.meta || {};
	const payload = meta.payload || {};
	const hasPayload = payload && Object.keys(payload).length > 0;
	return (
		<div style={{
			borderLeft: `3px solid ${color}`,
			padding: '4px 8px',
			margin: '2px 0',
			background: '#111827',
			borderRadius: 3,
		}}>
			<div
				onClick={() => hasPayload && setOpen((v) => !v)}
				style={{
					display: 'flex', alignItems: 'center', gap: 6,
					cursor: hasPayload ? 'pointer' : 'default',
					fontSize: 12,
				}}
			>
				{hasPayload ? (open
					? <ChevronDown size={11} style={{ color: '#94a3b8' }} />
					: <ChevronRight size={11} style={{ color: '#94a3b8' }} />
				) : <span style={{ width: 11 }} />}
				<code style={{ color: '#7dd3fc', fontSize: 10 }}>{meta.event_key || ev.event_type}</code>
				<span style={{ flex: 1, color: '#e2e8f0' }}>{ev.message}</span>
				<span style={{ color: '#475569', fontSize: 10 }}>{fmtTs(ev.ts)}</span>
			</div>
			{open && hasPayload && (
				<pre style={{
					margin: '4px 0 0', padding: 6,
					background: '#020617', color: '#94a3b8',
					fontSize: 10, lineHeight: 1.4,
					borderRadius: 3, overflowX: 'auto',
					maxHeight: 240,
				}}>
					{JSON.stringify(payload, null, 2)}
				</pre>
			)}
		</div>
	);
}

function LayerSection({ layer, events, defaultOpen }) {
	const [open, setOpen] = useState(defaultOpen);
	const hasEvents = events.length > 0;
	return (
		<div style={{ marginBottom: 6 }}>
			<div
				onClick={() => setOpen((v) => !v)}
				style={{
					display: 'flex', alignItems: 'center', gap: 8,
					padding: '6px 10px', cursor: 'pointer',
					background: '#1e293b',
					borderLeft: `4px solid ${layer.color}`,
					borderRadius: 4,
					fontSize: 12, fontWeight: 600,
					opacity: hasEvents ? 1 : 0.55,
				}}
			>
				{open
					? <ChevronDown size={13} style={{ color: '#94a3b8' }} />
					: <ChevronRight size={13} style={{ color: '#94a3b8' }} />}
				<span style={{ color: layer.color }}>{layer.name}</span>
				<span style={{
					padding: '1px 6px', borderRadius: 8,
					background: hasEvents ? layer.color : '#334155',
					color: hasEvents ? '#0f172a' : '#94a3b8',
					fontSize: 10, fontWeight: 700,
				}}>{events.length}</span>
				<span style={{ marginLeft: 'auto', color: '#64748b', fontSize: 10, fontWeight: 400 }}>
					{layer.desc}
				</span>
			</div>
			{open && hasEvents && (
				<div style={{ padding: '4px 6px 4px 14px' }}>
					{events.map((ev) => (
						<EventRow key={ev.id} ev={ev} color={layer.color} />
					))}
				</div>
			)}
		</div>
	);
}

export default function MprLayerPanel() {
	const events     = useBuilderStore((s) => s.twinEvents);
	const clearTwin  = useBuilderStore((s) => s.clearTwinEvents);
	const listenActive = useBuilderStore((s) => s.listenActive);
	const runDbId      = useBuilderStore((s) => s.runDbId);

	// PG fix #3 — scope to current automation run. Twin events emitted by
	// other concurrent TwinBrain turns (real users chatting while admin
	// tests playground) carry a different (or empty) run_id and must not
	// leak into the MPR pane.
	const scoped = useMemo(() => {
		if (!runDbId) return events; // no active run → show whatever exists
		const want = String(runDbId);
		return events.filter((ev) => {
			const rid = String(ev?.run_id || '');
			return rid === '' || rid === want;
		});
	}, [events, runDbId]);

	const grouped = useMemo(() => {
		const out = { 1: [], 2: [], 3: [], 4: [], 5: [] };
		scoped.forEach((ev) => {
			const layer = Number(ev?.meta?.layer);
			if (out[layer]) out[layer].push(ev);
		});
		// Sort each layer by id ascending so timeline is preserved.
		Object.values(out).forEach((arr) => arr.sort((a, b) => (a.id || 0) - (b.id || 0)));
		return out;
	}, [scoped]);

	// PG-S8 — when replay scrubber active, drop layer events emitted after cursor.
	const replayCursorMs = useBuilderStore((s) => s.replayCursorMs);
	const runStartedAtMs = useBuilderStore((s) => s.runStartedAtMs);
	const visibleGrouped = useMemo(() => {
		if (replayCursorMs === null || !runStartedAtMs) return grouped;
		const limitMs = runStartedAtMs + replayCursorMs;
		const out = { 1: [], 2: [], 3: [], 4: [], 5: [] };
		Object.entries(grouped).forEach(([k, arr]) => {
			out[k] = arr.filter((ev) => {
				const tsMs = (Number(ev.ts) || 0) * 1000;
				return tsMs <= limitMs;
			});
		});
		return out;
	}, [grouped, replayCursorMs, runStartedAtMs]);

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', color: '#e2e8f0' }}>
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<Brain size={14} style={{ color: '#a855f7' }} />
					<strong style={{ fontSize: 13 }}>MPR Thinking ({scoped.length})</strong>
					{listenActive && (
						<span style={{
							fontSize: 10, padding: '2px 8px', borderRadius: 10,
							background: '#581c87', color: '#f0abfc', fontWeight: 600,
						}}>● Subscribing</span>
					)}
				</div>
				<button type="button" onClick={clearTwin} className="aw-icon-btn"
					style={{ color: '#cbd5e1' }} title="Xoá tất cả twin events">
					<Trash2 size={14} />
				</button>
			</div>

			<div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
				{events.length === 0 ? (
					<div style={{
						color: '#94a3b8', textAlign: 'center', padding: 24, fontSize: 12,
					}}>
						{listenActive
							? 'Đang chờ twin events… Trigger MPR Think node hoặc gửi tin để thấy 5 layer.'
							: 'Bấm "▶ Chạy thử" rồi trigger MPR Think để xem 5 layer cognitive.'}
					</div>
				) : (
					LAYERS.map((layer) => (
						<LayerSection
							key={layer.id}
							layer={layer}
							events={visibleGrouped[layer.id] || []}
							defaultOpen={(visibleGrouped[layer.id] || []).length > 0}
						/>
					))
				)}
			</div>
		</div>
	);
}
