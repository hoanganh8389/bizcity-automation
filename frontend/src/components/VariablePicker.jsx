/**
 * VariablePicker — popover that lists upstream variables for the current node.
 *
 * Walks edges backward from `currentNodeId` (BFS), groups results by ancestor
 * node, and emits a `{{token}}` string when an entry is clicked. Tokens follow
 * the canonical resolver convention used by `BizCity_Automation_Block_Base::resolve()`:
 *
 *   - `{{trigger.<field>}}`   — payload from the trigger node (kind alias)
 *   - `{{<kind>.<field>}}`    — most-recent ancestor of that kind
 *   - `{{<nodeId>.<field>}}`  — explicit node id (always works, even with multiple of same kind)
 *
 * The picker is a controlled popover anchored above the host field. Click an
 * entry → calls `onPick(token)`. Caller decides whether to insert at cursor or
 * append to current value.
 *
 * Reference: plugins/bizcity-automation/.../variables.dialog.jsx ported to FE
 * stack (Zustand + lucide-react) without WAIC framework dependencies.
 *
 * @since PG-S10 (2026-05-31)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Variable, X, Search } from 'lucide-react';
import { BLOCKS_BY_ID } from '../blocks/registry.js';

/**
 * Build groups of {nodeId, label, sublabel, kind, isTrigger, vars[]} for all
 * ancestors of `currentId` (excluding the current node itself).
 */
function collectUpstreamGroups(currentId, nodes, edges) {
	if (!currentId || !Array.isArray(nodes) || !Array.isArray(edges)) return [];
	const byId = new Map(nodes.map((n) => [n.id, n]));
	// Reverse edge index: target → [sources]
	const parents = new Map();
	edges.forEach((e) => {
		if (!parents.has(e.target)) parents.set(e.target, []);
		parents.get(e.target).push(e.source);
	});

	const visited = new Set();
	const order   = []; // BFS order so closer ancestors appear first
	const queue   = [currentId];
	while (queue.length) {
		const id = queue.shift();
		const ps = parents.get(id) || [];
		for (const p of ps) {
			if (visited.has(p) || p === currentId) continue;
			visited.add(p);
			order.push(p);
			queue.push(p);
		}
	}

	return order.map((nodeId) => {
		const n     = byId.get(nodeId);
		if (!n) return null;
		const block = BLOCKS_BY_ID[n.data?.blockId];
		const kind  = block?.kind || n.type || 'node';
		const isTrigger = kind === 'trigger';
		const vars  = Array.isArray(block?.outputs) && block.outputs.length
			? block.outputs
			: defaultVars(kind);
		return {
			nodeId,
			label:    n.data?.label || block?.label || nodeId,
			sublabel: block?.id || n.type,
			kind,
			isTrigger,
			vars,
		};
	}).filter(Boolean);
}

function defaultVars(kind) {
	// Fallback when block has no `outputs` schema (legacy blocks).
	if (kind === 'condition') return [{ name: 'branch', label: 'Nhánh đã chọn' }];
	return [
		{ name: 'output', label: 'Output (mặc định)' },
		{ name: 'value',  label: 'Value' },
	];
}

/**
 * Build the canonical token. Trigger nodes always use the `trigger` alias —
 * matches the runner's ctx layout (`$ctx['trigger'] = $payload`).
 */
function buildToken(group, varName) {
	if (group.isTrigger) return `{{trigger.${varName}}}`;
	// Prefer node id over kind alias because canvases often have multiple
	// nodes of the same kind (search_kg + http_request both kind=action).
	return `{{${group.nodeId}.${varName}}}`;
}

export default function VariablePicker({
	open,
	onClose,
	onPick,
	currentNodeId,
	nodes,
	edges,
	anchorRect,
}) {
	const [q, setQ]   = useState('');
	const ref         = useRef(null);

	const groups = useMemo(
		() => collectUpstreamGroups(currentNodeId, nodes, edges),
		[currentNodeId, nodes, edges]
	);

	const filtered = useMemo(() => {
		if (!q.trim()) return groups;
		const needle = q.trim().toLowerCase();
		return groups.map((g) => ({
			...g,
			vars: g.vars.filter((v) =>
				v.name.toLowerCase().includes(needle)
				|| (v.label || '').toLowerCase().includes(needle)
			),
		})).filter((g) => g.vars.length > 0);
	}, [groups, q]);

	// Click outside to close.
	useEffect(() => {
		if (!open) return undefined;
		const onDoc = (e) => {
			if (ref.current && !ref.current.contains(e.target)) onClose();
		};
		const onKey = (e) => { if (e.key === 'Escape') onClose(); };
		document.addEventListener('mousedown', onDoc);
		document.addEventListener('keydown', onKey);
		return () => {
			document.removeEventListener('mousedown', onDoc);
			document.removeEventListener('keydown', onKey);
		};
	}, [open, onClose]);

	if (!open) return null;

	// Compute popover position from anchorRect; fallback centered if missing.
	const style = anchorRect
		? {
			position: 'fixed',
			top:  Math.min(anchorRect.bottom + 6, window.innerHeight - 360),
			left: Math.min(anchorRect.left, window.innerWidth - 340),
			width: 320, maxHeight: 360,
		}
		: { position: 'fixed', top: '20%', left: '40%', width: 320, maxHeight: 360 };

	return (
		<div ref={ref} style={{
			...style,
			background: '#fff',
			border: '1px solid #e2e8f0',
			borderRadius: 8,
			boxShadow: '0 10px 30px rgba(15,23,42,.18)',
			zIndex: 9999,
			display: 'flex', flexDirection: 'column',
			overflow: 'hidden',
		}}>
			<div style={{
				display: 'flex', alignItems: 'center', gap: 8,
				padding: '8px 10px', borderBottom: '1px solid #e2e8f0',
				background: '#f8fafc',
			}}>
				<Variable size={14} color="#7c3aed" />
				<strong style={{ fontSize: 12, flex: 1 }}>Chèn biến từ node phía trước</strong>
				<button type="button" onClick={onClose} className="aw-icon-btn" title="Đóng">
					<X size={14} />
				</button>
			</div>

			<div style={{ padding: '6px 10px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 6 }}>
				<Search size={12} color="#94a3b8" />
				<input
					type="text"
					autoFocus
					value={q}
					onChange={(e) => setQ(e.target.value)}
					placeholder="Tìm biến…"
					style={{
						flex: 1, border: 'none', outline: 'none', fontSize: 12,
						padding: '4px 0', background: 'transparent',
					}}
				/>
			</div>

			<div style={{ overflowY: 'auto', flex: 1 }}>
				{filtered.length === 0 ? (
					<div style={{ padding: 16, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>
						{groups.length === 0
							? 'Chưa có node phía trước. Hãy nối node này vào trigger / action upstream.'
							: 'Không tìm thấy biến phù hợp.'}
					</div>
				) : (
					filtered.map((g) => (
						<div key={g.nodeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
							<div style={{
								padding: '6px 10px', background: '#f8fafc',
								fontSize: 11, color: '#475569', display: 'flex', gap: 6, alignItems: 'baseline',
							}}>
								<strong style={{ color: '#0f172a' }}>{g.label}</strong>
								<span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 10 }}>
									{g.isTrigger ? 'trigger' : g.nodeId}
								</span>
							</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 8 }}>
								{g.vars.map((v) => {
									const token = buildToken(g, v.name);
									return (
										<button
											key={v.name}
											type="button"
											title={`${v.label || v.name} — ${token}`}
											onClick={() => { onPick(token); onClose(); }}
											style={pillStyle()}
										>
											<span style={{ fontFamily: 'monospace', fontSize: 11, color: '#7c3aed' }}>{v.name}</span>
											{v.label && v.label !== v.name && (
												<span style={{ fontSize: 10, color: '#64748b', marginLeft: 6 }}>{v.label}</span>
											)}
										</button>
									);
								})}
							</div>
						</div>
					))
				)}
			</div>

			<div style={{
				padding: '6px 10px', borderTop: '1px solid #e2e8f0',
				fontSize: 10, color: '#94a3b8', background: '#fafafa',
			}}>
				Cú pháp: <code>{'{{trigger.field}}'}</code> hoặc <code>{'{{nodeId.field}}'}</code>
			</div>
		</div>
	);
}

function pillStyle() {
	return {
		display: 'inline-flex', alignItems: 'center',
		padding: '4px 8px', border: '1px solid #e9d5ff',
		borderRadius: 999, background: '#faf5ff',
		fontSize: 11, cursor: 'pointer',
	};
}
