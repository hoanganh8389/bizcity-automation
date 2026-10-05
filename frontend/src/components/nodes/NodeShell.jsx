import { Handle, Position, NodeToolbar } from '@xyflow/react';
import { Trash2, Copy, Loader2, CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { BLOCKS_BY_ID } from '../../blocks/registry.js';
import { useBuilderStore } from '../../store/builderStore.js';

/**
 * Shared node shell — colored header with icon + label, body with summary,
 * hover-action buttons (duplicate/delete). Handles are configurable by
 * caller (hasInput / hasOutput / branches).
 *
 * BE-7.E: hiển thị status badge realtime khi runner chạy.
 *   nodeStatus: 0=running (spinner), 1=ok (check xanh),
 *               2=fail (X đỏ), 3=skip (dấu trừ xám).
 */
export default function NodeShell({
	id, data, selected,
	hasInput = true, hasOutput = true, branches = null,
}) {
	const block = BLOCKS_BY_ID[data?.blockId] || null;
	const Icon  = block?.Icon;
	const color = block?.color || '#475569';
	const removeNode    = useBuilderStore((s) => s.removeNode);
	const duplicateNode = useBuilderStore((s) => s.duplicateNode);
	const openConfirm   = useBuilderStore((s) => s.openConfirm);
	const runStatusInt  = useBuilderStore((s) => s.nodeStatus?.[id]);

	const onDelete = (e) => {
		e.stopPropagation();
		openConfirm({
			title: 'Xoá node?',
			message: `Xoá "${data?.label || id}" khỏi workflow. Hành động không thể hoàn tác.`,
			onConfirm: () => removeNode(id),
		});
	};
	const onDuplicate = (e) => { e.stopPropagation(); duplicateNode(id); };

	const summary = block ? buildSummary(block, data) : '';

	const statusBadge = renderStatusBadge(runStatusInt);
	const ringColor = STATUS_RING[runStatusInt];

	return (
		<div
			className={`aw-node ${selected ? 'aw-node-selected' : ''}`}
			style={{
				background: '#fff',
				border: `1.5px solid ${ringColor || (selected ? color : '#e2e8f0')}`,
				borderRadius: 10,
				minWidth: 220,
				boxShadow: ringColor
					? `0 0 0 3px ${ringColor}33`
					: (selected ? `0 0 0 3px ${color}33` : '0 1px 2px rgba(15,23,42,.06)'),
				fontSize: 13,
				// overflow visible để status badge (top:-8/right:-8) không bị clip.
				// Header & body tự bo góc riêng để giữ visual.
				overflow: 'visible',
				position: 'relative',
			}}
		>
			{statusBadge}
			<NodeToolbar isVisible={selected} position={Position.Top} offset={6}>
				<div style={{
					display: 'flex', gap: 4, background: '#0f172a', color: '#fff',
					padding: '4px 6px', borderRadius: 6, fontSize: 11,
					boxShadow: '0 4px 14px rgba(15,23,42,.2)',
				}}>
					<button type="button" onClick={onDuplicate} title="Nhân bản (Ctrl+D)"
						className="aw-icon-btn" style={{ color: '#fff' }}>
						<Copy size={12} />
					</button>
					<button type="button" onClick={onDelete} title="Xoá (Del)"
						className="aw-icon-btn" style={{ color: '#fff' }}>
						<Trash2 size={12} />
					</button>
				</div>
			</NodeToolbar>

			{hasInput && <Handle id="in" type="target" position={Position.Left}  style={{ background: color, width: 10, height: 10 }} />}

			<div
				style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					padding: '6px 10px', background: color, color: '#fff', fontWeight: 600,
					borderTopLeftRadius: 9, borderTopRightRadius: 9,
				}}
			>
				<span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					{Icon ? <Icon size={14} /> : null}
					<span style={{ fontSize: 11, opacity: .85, textTransform: 'uppercase', letterSpacing: .3 }}>
						{block?.short || 'block'}
					</span>
				</span>
				<span className="aw-node-actions" style={{ display: 'flex', gap: 4 }}>
					<button type="button" onClick={onDuplicate} title="Nhân bản"
						className="aw-icon-btn" style={{ color: '#fff' }}>
						<Copy size={12} />
					</button>
					<button type="button" onClick={onDelete} title="Xoá"
						className="aw-icon-btn" style={{ color: '#fff' }}>
						<Trash2 size={12} />
					</button>
				</span>
			</div>

			<div style={{ padding: '8px 10px', borderBottomLeftRadius: 9, borderBottomRightRadius: 9 }}>
				<div style={{ fontWeight: 600, color: '#0f172a' }}>{data?.label || block?.label || 'Node'}</div>
				{summary ? (
					<div style={{ marginTop: 4, color: '#64748b', fontSize: 12, lineHeight: 1.35, whiteSpace: 'pre-wrap' }}>
						{summary}
					</div>
				) : null}
			</div>

			{branches
				? branches.map((b, i) => (
					<Handle
						key={b.id}
						type="source"
						position={Position.Right}
						id={b.id}
						style={{ top: 40 + i * 22, background: b.color || color }}
					>
						<span style={{ position: 'absolute', right: 10, top: -8, fontSize: 10, color: '#64748b' }}>{b.label}</span>
					</Handle>
				))
				: hasOutput
				? <Handle id="out" type="source" position={Position.Right} style={{ background: color, width: 10, height: 10 }} />
				: null}
		</div>
	);
}

function buildSummary(block, data) {
	if (block.id === 'action.search_kg') return `query: ${trim(data.query)}\ntop_k: ${data.top_k}`;
	if (block.id === 'llm.compose_reply') return `model: ${data.model}`;
	if (block.id === 'action.reply_zalo') return `text: ${trim(data.text)}`;
	if (block.id === 'action.send_email') return `to: ${data.to || '—'}`;
	if (block.id === 'action.http_request') return `${data.method} ${trim(data.url, 28)}`;
	if (block.id === 'logic.condition')  return `if: ${trim(data.expression, 32)}`;
	if (block.id === 'trigger.cron')     return `cron: ${data.schedule}`;
	if (block.id === 'trigger.zalo_inbound' && data.filter) return `filter: ${trim(data.filter)}`;
	if (block.id === 'action.create_crm_event') return `${data.event_type} · ${trim(data.title, 24)}`;
	return '';
}
function trim(s, n = 36) {
	const v = (s == null ? '' : String(s));
	return v.length > n ? v.slice(0, n - 1) + '…' : v;
}

// BE-7.E — per-node runtime status visualization.
const STATUS_RING = {
	0: '#f59e0b', // running — amber
	1: '#16a34a', // ok — green
	2: '#dc2626', // fail — red
	3: '#94a3b8', // skip — slate
};

function renderStatusBadge(status) {
	if (status === undefined || status === null) return null;
	const ring = STATUS_RING[status] || '#e2e8f0';
	const wrap = {
		position: 'absolute', top: -10, right: -10, zIndex: 50,
		width: 24, height: 24, borderRadius: '50%',
		background: '#fff',
		boxShadow: `0 0 0 2px ${ring}, 0 2px 6px rgba(15,23,42,.25)`,
		display: 'flex', alignItems: 'center', justifyContent: 'center',
		pointerEvents: 'none',
	};
	let body;
	let label = 'idle';
	if (status === 0) {
		wrap.animation = 'aw-status-pulse 1.4s ease-in-out infinite';
		body = <Loader2 size={14} className="aw-animate-spin" style={{ color: '#f59e0b' }} />;
		label = 'running';
	} else if (status === 1) {
		body = <CheckCircle2 size={16} style={{ color: '#16a34a' }} />;
		label = 'ok';
	} else if (status === 2) {
		body = <XCircle size={16} style={{ color: '#dc2626' }} />;
		label = 'fail';
	} else if (status === 3) {
		body = <MinusCircle size={14} style={{ color: '#94a3b8' }} />;
		label = 'skip';
	} else {
		return null;
	}
	return <div style={wrap} title={'status=' + status + ' (' + label + ')'}>{body}</div>;
}
