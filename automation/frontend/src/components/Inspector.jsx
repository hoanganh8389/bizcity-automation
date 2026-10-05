import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Trash2, Variable, Circle, CircleDot, Zap, CheckCircle2 } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore.js';
// [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — Skill mode panel.
import SkillModePanel from './SkillModePanel.jsx';
import { BLOCKS_BY_ID } from '../blocks/registry.js';
import ChannelInstancePicker from './ChannelInstancePicker.jsx';
// [2026-06-03 Johnny Chu] GURU-UI W0.3 — Guru picker + binding preview.
import GuruChannelPicker from './GuruChannelPicker.jsx';
import FbPagePicker from './FbPagePicker.jsx';
// [2026-06-16 Johnny Chu] PHASE-ATH W9 — notebook_picker field type.
import NotebookPicker from './NotebookPicker.jsx';
// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — rich email body editor.
import RichEmailEditor from './RichEmailEditor.jsx';
// [2026-06-25 Johnny Chu] PHASE-REPLY-ZALO-FIX — Zalo user picker (linked users per bot).
import ZaloUserPicker from './ZaloUserPicker.jsx';
import FilterPillsInput from './FilterPillsInput.jsx';
import TestListenPanel from './TestListenPanel.jsx';
import VariablePicker from './VariablePicker.jsx';
import HilCompilerDialog from './HilCompilerDialog.jsx';

/**
 * Right Inspector — renders the selected node's `fields` schema as a form.
 * Empty state shows graph stats + workflow tips.
 */
export default function Inspector() {
	const open = useBuilderStore((s) => s.isInspectorOpen);
	const toggle = useBuilderStore((s) => s.toggleInspector);
	const selectedId = useBuilderStore((s) => s.selectedId);
	const nodes = useBuilderStore((s) => s.nodes);
	const edges = useBuilderStore((s) => s.edges);
	const updateNodeData = useBuilderStore((s) => s.updateNodeData);
	const removeNode = useBuilderStore((s) => s.removeNode);
	const openConfirm = useBuilderStore((s) => s.openConfirm);
	const meta = useBuilderStore((s) => s.meta);
	const updateMeta = useBuilderStore((s) => s.updateMeta);
	const [hilDialogOpen, setHilDialogOpen] = useState(false);
	// [2026-08-16 Johnny Chu] PHASE-2-HIL-DIALOG-BUTTON — transient "vừa áp dụng" flash separate from the permanent hil_spec-present green state.
	const [hilJustAppliedAt, setHilJustAppliedAt] = useState(null);

	const node = nodes.find((n) => n.id === selectedId);
	const block = node ? BLOCKS_BY_ID[node.data?.blockId] : null;
	const isTriggerNode = !!(node && block && block.category === 'trigger');
	// [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — expose workflow id/slug/enabled for skill panel.
	const wfId      = meta?.id      || null;
	const wfSlug    = meta?.slug    || '';
	const wfEnabled = meta?.enabled ?? false;

	useEffect(() => {
		if (!isTriggerNode) {
			setHilDialogOpen(false);
		}
	}, [isTriggerNode]);

	// Reset the transient "just applied" flash when switching to a different node.
	useEffect(() => {
		setHilJustAppliedAt(null);
	}, [selectedId]);

	if (!open) {
		return (
			<button type="button" onClick={toggle}
				className="aw-btn aw-btn-outline"
				style={{ position: 'absolute', top: 12, right: 12, zIndex: 5 }}>
				Mở inspector
			</button>
		);
	}

	return (
		<aside style={{
			width: 320, flexShrink: 0, background: '#fff',
			borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
		}}>
			<div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
				<button type="button" onClick={toggle} className="aw-icon-btn" title="Thu gọn">
					<ChevronRight size={14} />
				</button>
				<strong style={{ flex: 1, fontSize: 13 }}>
					{node ? 'Cấu hình node' : 'Inspector'}
				</strong>
			</div>

			<div style={{ overflowY: 'auto', flex: 1, padding: 12 }}>
				{!node ? (
					<>
						<EmptyState nodeCount={nodes.length} edgeCount={edges.length} />
						{/* [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — skill mode panel */}
						<SkillModePanel
							workflowId={wfId}
							workflowSlug={wfSlug}
							workflowEnabled={wfEnabled}
						/>
					</>
				) : (
					<>
						{isTriggerNode && (() => {
											const hasSpec = !!node?.data?.hil_spec && Array.isArray(node?.data?.hil_spec?.slots) && node.data.hil_spec.slots.length > 0;
											const isOrderFlow = nodes.some((item) => String(item?.data?.blockId || '') === 'action.create_woo_order');
											const specSlotIds = Array.isArray(node?.data?.hil_spec?.slots)
												? node.data.hil_spec.slots.map((slot) => String(slot?.id || '')).sort().join('|')
												: '';
											const legacyOrderSpec = isOrderFlow && specSlotIds === 'final_confirm|task_brief';
											const hilApplied = hasSpec && !legacyOrderSpec;
							const slotCount = Array.isArray(node?.data?.hil_spec?.slots) ? node.data.hil_spec.slots.length : 0;
							return (
								<div style={{
									marginBottom: 12,
													border: `1px solid ${hilApplied ? '#86efac' : '#fde68a'}`,
									borderRadius: 8,
													background: hilApplied ? '#f0fdf4' : '#fffbeb',
									padding: '8px 10px',
								}}>
									<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
										<div style={{ fontSize: 12, color: hilApplied ? '#166534' : '#92400e' }}>
											<strong style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
												{hilApplied && <CheckCircle2 size={13} />}
												HIL Config
											</strong>
											<div style={{ fontSize: 11, color: hilApplied ? '#15803d' : '#a16207' }}>Cấu hình schema đầu vào bằng dialog thay vì sửa Raw data thủ công.</div>
										</div>
										<button
											type="button"
											onClick={() => setHilDialogOpen(true)}
											className="aw-btn aw-btn-outline"
											title="Mở dialog cấu hình HIL"
										>
											<Zap size={13} /> Cấu hình HIL
										</button>
									</div>
									<div style={{ marginTop: 6, fontSize: 11, color: hilApplied ? '#166534' : '#475569', fontWeight: hilApplied ? 600 : 400 }}>
										{hilApplied
											? `✓ Đã áp dụng HIL (${slotCount} slots).`
											: legacyOrderSpec
												? 'HIL spec cũ của workflow order cần cập nhật schema đơn hàng.'
											: 'Chưa có HIL spec. Nên cấu hình trước khi lưu workflow có side-effect.'}
									</div>
									{hilJustAppliedAt && (
										<div style={{ marginTop: 4, fontSize: 11, color: '#15803d' }}>
											✓ Vừa áp dụng lúc {hilJustAppliedAt}
										</div>
									)}
								</div>
							);
						})()}
						<BreakpointToggle
							nodeId={node.id}
							breakpoints={meta.debug_breakpoints || {}}
							onToggle={(bp) => updateMeta({ debug_breakpoints: bp })}
						/>
						<NodeForm node={node} block={block} onChange={(patch) => updateNodeData(node.id, patch)} />
						{isTriggerNode && (
							<HilCompilerDialog
								open={hilDialogOpen}
								onClose={() => setHilDialogOpen(false)}
								onApply={(hilPayload) => {
									const spec = hilPayload?.spec || hilPayload;
									const compiledPrompt = typeof hilPayload?.prompt === 'string' ? hilPayload.prompt.trim() : '';
									// [2026-08-16 Johnny Chu] PHASE-2-HIL-DIALOG-BUTTON — apply compiled HIL contract directly to selected trigger node from inspector dialog.
									updateNodeData(node.id, {
										hil_prompt: compiledPrompt || (node?.data?.hil_prompt || ''),
										hil_spec: spec,
										hil_spec_version: spec?.spec_version || 'twin_hil.v1',
										hil_compiled_prompt: compiledPrompt || (node?.data?.hil_compiled_prompt || ''),
										hil_rollout: node?.data?.hil_rollout || 'mvp',
										hil_compiled_at: new Date().toISOString(),
									});
									setHilJustAppliedAt(new Date().toLocaleTimeString());
								}}
								meta={meta}
								nodes={nodes}
							/>
						)}
					</>
				)}
			</div>

			{node && (
				<div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0' }}>
					<button type="button"
						onClick={() => openConfirm({
							title: 'Xoá node?',
							message: `Xoá "${node.data?.label || node.id}".`,
							onConfirm: () => removeNode(node.id),
						})}
						className="aw-btn aw-btn-outline" style={{ width: '100%', color: '#dc2626', borderColor: '#fecaca' }}>
						<Trash2 size={14} /> Xoá node
					</button>
				</div>
			)}
		</aside>
	);
}

function EmptyState({ nodeCount, edgeCount }) {
	return (
		<div style={{ color: '#64748b', fontSize: 12 }}>
			<p style={{ marginTop: 0 }}>Chọn 1 node trên canvas để chỉnh sửa cấu hình.</p>
			<div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 10, marginTop: 8 }}>
				<div><strong>{nodeCount}</strong> node · <strong>{edgeCount}</strong> kết nối</div>
				<div style={{ marginTop: 6 }}>💡 Kéo khối từ palette bên trái, nối các handle để tạo flow.</div>
			</div>
		</div>
	);
}

/**
 * PG-S5 — Breakpoint toggle.
 * Stores `meta.debug_breakpoints[nodeId] = { before: true }` when active.
 * Runner pauses BEFORE executing a node that has `before:true`.
 */
function BreakpointToggle({ nodeId, breakpoints, onToggle }) {
	const isOn = !!(breakpoints && breakpoints[nodeId] && breakpoints[nodeId].before);
	const handle = () => {
		const next = { ...(breakpoints || {}) };
		if (isOn) {
			delete next[nodeId];
		} else {
			next[nodeId] = { ...(next[nodeId] || {}), before: true };
		}
		onToggle(next);
	};
	return (
		<div style={{
			display: 'flex', alignItems: 'center', gap: 8,
			padding: '8px 10px', marginBottom: 10,
			background: isOn ? '#fef2f2' : '#f8fafc',
			border: `1px solid ${isOn ? '#fecaca' : '#e2e8f0'}`,
			borderRadius: 6,
		}}>
			<button type="button" onClick={handle}
				className="aw-icon-btn"
				title={isOn ? 'Bỏ breakpoint' : 'Đặt breakpoint trước node này'}
				style={{ color: isOn ? '#dc2626' : '#64748b' }}>
				{isOn ? <CircleDot size={16} /> : <Circle size={16} />}
			</button>
			<div style={{ fontSize: 12, color: isOn ? '#b91c1c' : '#475569', flex: 1 }}>
				<strong>Breakpoint:</strong> {isOn ? 'Pause trước khi node này chạy.' : 'Tắt — bấm tròn đỏ để bật.'}
			</div>
		</div>
	);
}

function NodeForm({ node, block, onChange }) {
	if (!block) return <div>Block không xác định: <code>{node.data?.blockId}</code></div>;
	return (
		<div>
			<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
				{block.Icon ? <block.Icon size={18} color={block.color} /> : null}
				<div>
					<div style={{ fontSize: 13, fontWeight: 600 }}>{block.label}</div>
					<div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{block.id}</div>
				</div>
			</div>

			{block.fields.map((f) => (
				<FieldRow
					key={f.name}
					field={f}
					nodeId={node.id}
					value={node.data?.[f.name]}
					data={node.data || {}}
					onChange={(v) => onChange({ [f.name]: v })}
					onPatch={onChange}
				/>
			))}

			{block.category !== 'trigger' && (
				<label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '4px 0 14px', fontSize: 11, color: '#475569' }}>
					<input
						type="checkbox"
						checked={Boolean(node.data?.notify_progress)}
						onChange={(event) => onChange({ notify_progress: event.target.checked })}
					/>
					<span><strong>Gửi tiến độ về kênh</strong><br /><small style={{ color: '#94a3b8' }}>Gửi milestone node này tới Zalo Bot khi workflow chạy.</small></span>
				</label>
			)}

			{block.category === 'trigger' && (
				<TestListenPanel node={node} />
			)}

			<details style={{ marginTop: 16 }}>
				<summary style={{ fontSize: 11, color: '#64748b', cursor: 'pointer' }}>Raw data</summary>
				<pre style={{ fontSize: 11, background: '#0f172a', color: '#cbd5e1', padding: 8, borderRadius: 6, overflow: 'auto' }}>
					{JSON.stringify(node.data, null, 2)}
				</pre>
			</details>
		</div>
	);
}

function FieldRow({ field, value, onChange, nodeId, data, onPatch }) {
	const lbl = <label style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{field.label}</label>;
	const hint = field.hint ? <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{field.hint}</div> : null;
	const wrap = (input) => (
		<div style={{ marginBottom: 12 }}>{lbl}{input}{hint}</div>
	);

	if (field.type === 'channel_instance_picker') {
		return wrap(<ChannelInstancePicker platform={field.platform} value={value} onChange={onChange} />);
	}
	// [2026-06-03 Johnny Chu] GURU-UI W0.3 — Guru picker dropdown + binding preview.
	if (field.type === 'guru_picker') {
		return wrap(<GuruChannelPicker value={value} onChange={onChange} />);
	}
	if (field.type === 'fb_page_picker') {
		return wrap(<FbPagePicker data={data} onPatch={onPatch} />);
	}
	// [2026-06-16 Johnny Chu] PHASE-ATH W9 — notebook_picker: bind notebook_id cứng vào block.
	if (field.type === 'notebook_picker') {
		return wrap(<NotebookPicker value={value ?? 0} onChange={onChange} />);
	}
	// [2026-06-17 Johnny Chu] PHASE-CG-CF7 — rich_text: TinyMCE editor cho email body.
	if (field.type === 'rich_text') {
		return wrap(<RichEmailEditor value={value} onChange={onChange} nodeId={nodeId} />);
	}
	// [2026-06-25 Johnny Chu] PHASE-REPLY-ZALO-FIX — zalo_user_picker: linked users for reply_zalo cron.
	// instanceId = sibling field `instance_id` in same node (data prop passed down).
	if (field.type === 'zalo_user_picker') {
		const instanceId = data?.instance_id ?? '';
		return wrap(<ZaloUserPicker instanceId={instanceId} value={value} onChange={onChange} />);
	}
	if (field.type === 'filter_pills') {
		return wrap(
			<FilterPillsInput
				value={String(value ?? '')}
				onChange={onChange}
				placeholder={field.placeholder || 'Nhập từ khoá rồi Enter hoặc dấu | , ;'}
				suggestions={field.suggestions || []}
			/>
		);
	}
	// [2026-06-25 Johnny Chu] PHASE-TRENDING W1 FIX — cron_time_picker: time input + preset buttons.
	// Syncs both `schedule` (cron expr) and `label` when user picks a time.
	if (field.type === 'cron_time_picker') {
		const parts = (value || '0 8 * * *').trim().split(/\s+/);
		const hh = String(parts[1] ?? '8').padStart(2, '0');
		const mm = String(parts[0] ?? '0').padStart(2, '0');
		const timeVal = `${hh}:${mm}`;
		const presets = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '18:00', '21:00'];
		const handleTime = (t) => {
			const [h, m] = t.split(':');
			const newSchedule = `${parseInt(m, 10)} ${parseInt(h, 10)} * * *`;
			const newLabel = `Cron · ${h}:${m} mỗi ngày`;
			onPatch({ schedule: newSchedule, label: newLabel });
		};
		return (
			<div style={{ marginBottom: 12 }}>
				{lbl}
				<input
					type="time"
					value={timeVal}
					onChange={(e) => handleTime(e.target.value)}
					style={{ ...inputStyle(), marginBottom: 6 }}
				/>
				<div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
					{presets.map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => handleTime(t)}
							style={{
								fontSize: 11, padding: '2px 7px', cursor: 'pointer', borderRadius: 4,
								background: timeVal === t ? '#0891b2' : '#f1f5f9',
								color: timeVal === t ? '#fff' : '#475569',
								border: `1px solid ${timeVal === t ? '#0891b2' : '#e2e8f0'}`,
							}}
						>
							{t}
						</button>
					))}
				</div>
				<div style={{ fontSize: 11, color: '#94a3b8' }}>Cron: <code>{value}</code></div>
				{hint}
			</div>
		);
	}
	if (field.type === 'textarea') {
		return wrap(<VarTextField as="textarea" rows={3} value={value} onChange={onChange} nodeId={nodeId} />);
	}
	if (field.type === 'select') {
		// [2026-07-04 Johnny Chu] PHASE-ASTRO-WORKFLOW — support both primitive and {value,label} options.
		return wrap(<select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={inputStyle()}>
			{(field.options || []).map((opt) => {
				const isObj = opt !== null && typeof opt === 'object';
				const v = isObj ? opt.value : opt;
				const l = isObj ? opt.label : opt;
				return <option key={String(v)} value={v}>{l}</option>;
			})}
		</select>);
	}
	if (field.type === 'number') {
		return wrap(<input type="number" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} style={inputStyle()} />);
	}
	if (field.type === 'toggle') {
		return (
			<div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
				<input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
				{lbl}{hint}
			</div>
		);
	}
	return wrap(<VarTextField as="input" value={value} onChange={onChange} nodeId={nodeId} />);
}

/**
 * Text/textarea input with a `{x}` chip that opens VariablePicker. Inserts the
 * picked `{{token}}` at the current caret position (or appends if no focus).
 */
function VarTextField({ as, rows, value, onChange, nodeId }) {
	const inputRef          = useRef(null);
	const btnRef            = useRef(null);
	const [open, setOpen]   = useState(false);
	const [rect, setRect]   = useState(null);
	const nodes = useBuilderStore((s) => s.nodes);
	const edges = useBuilderStore((s) => s.edges);

	const handleOpen = () => {
		if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
		setOpen(true);
	};

	const handlePick = (token) => {
		const el = inputRef.current;
		const cur = value ?? '';
		if (!el || typeof el.selectionStart !== 'number') {
			onChange(cur + token);
			return;
		}
		const start = el.selectionStart;
		const end   = el.selectionEnd ?? start;
		const next  = cur.slice(0, start) + token + cur.slice(end);
		onChange(next);
		requestAnimationFrame(() => {
			if (!inputRef.current) return;
			const pos = start + token.length;
			try { inputRef.current.setSelectionRange(pos, pos); inputRef.current.focus(); } catch (e) {}
		});
	};

	const commonProps = {
		ref: inputRef,
		value: value ?? '',
		onChange: (e) => onChange(e.target.value),
		style: { ...inputStyle(), paddingRight: 30 },
	};

	return (
		<div style={{ position: 'relative' }}>
			{as === 'textarea'
				? <textarea {...commonProps} rows={rows || 3} />
				: <input type="text" {...commonProps} />}
			<button
				type="button"
				ref={btnRef}
				onClick={handleOpen}
				title="Chèn biến từ node phía trước"
				style={{
					position: 'absolute',
					top: as === 'textarea' ? 6 : '50%',
					transform: as === 'textarea' ? 'none' : 'translateY(-50%)',
					right: 6,
					marginTop: as === 'textarea' ? 0 : 2,
					width: 22, height: 22,
					display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
					border: '1px solid #e9d5ff', background: '#faf5ff',
					borderRadius: 6, color: '#7c3aed', cursor: 'pointer', padding: 0,
				}}
			>
				<Variable size={12} />
			</button>
			<VariablePicker
				open={open}
				onClose={() => setOpen(false)}
				onPick={handlePick}
				currentNodeId={nodeId}
				nodes={nodes}
				edges={edges}
				anchorRect={rect}
			/>
		</div>
	);
}

function inputStyle() {
	return {
		display: 'block', width: '100%', marginTop: 4,
		padding: '6px 8px', fontSize: 12, lineHeight: 1.4,
		border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
		fontFamily: 'inherit', boxSizing: 'border-box',
	};
}
