import { useRef, useState } from 'react';
import {
	ArrowLeft, Save, Play, Square, Settings as SettingsIcon, FileDown, FileUp,
	Loader2, Activity, Undo2, Redo2, LayoutGrid, Spline, Grid3x3,
	BookmarkPlus, Pause, StepForward, RotateCcw, Workflow, Sparkles, Zap,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BOOT } from '../lib/boot.js';
import { useBuilderStore } from '../store/builderStore.js';
import { runWorkflow, stopActiveListener, replayRun } from '../runtime/runner.js';
import { autoLayout } from '../lib/autoLayout.js';
import CronHealthBadge from './CronHealthBadge.jsx';
import { templatesApi, workflowsApi, runsApi, automationApi, hubTemplatesApi, hilApi, BizCityApiError } from '../lib/api.js';
// [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder dialog
import AiBuilderDialog from './AiBuilderDialog.jsx';
import HilCompilerDialog from './HilCompilerDialog.jsx';

const EDGE_TYPES = [
	{ value: 'smoothstep', label: 'Smooth' },
	{ value: 'step',       label: 'Step' },
	{ value: 'straight',   label: 'Straight' },
	{ value: 'default',    label: 'Bezier' },
	{ value: 'button',     label: 'Button (×)' },
];

const BG_VARIANTS = [
	{ value: 'dots',  label: 'Dots' },
	{ value: 'lines', label: 'Lines' },
	{ value: 'cross', label: 'Cross' },
];

export default function Toolbar() {
	const canManage        = !!BOOT?.caps?.manage;
	const meta             = useBuilderStore((s) => s.meta);
	const updateMeta       = useBuilderStore((s) => s.updateMeta);
	const openSettings     = useBuilderStore((s) => s.openSettings);
	const toggleTimeline   = useBuilderStore((s) => s.toggleTimeline);
	const isTimelineOpen   = useBuilderStore((s) => s.isTimelineOpen);
	const isRunning        = useBuilderStore((s) => s.isRunning);
	const runDbId          = useBuilderStore((s) => s.runDbId);
	const debugState       = useBuilderStore((s) => s.debugState);
	const runStatus        = useBuilderStore((s) => s.runStatus);
	const listenActive     = useBuilderStore((s) => s.listenActive);
	const nodes            = useBuilderStore((s) => s.nodes);
	const edges            = useBuilderStore((s) => s.edges);
	const undo             = useBuilderStore((s) => s.undo);
	const redo             = useBuilderStore((s) => s.redo);
	const canUndo          = useBuilderStore((s) => s.past.length > 0);
	const canRedo          = useBuilderStore((s) => s.future.length > 0);
	const defaultEdgeType  = useBuilderStore((s) => s.defaultEdgeType);
	const setAllEdgesType  = useBuilderStore((s) => s.setAllEdgesType);
	const setNodes         = useBuilderStore((s) => s.setNodes);
	const bgVariant        = useBuilderStore((s) => s.bgVariant);
	const setBgVariant     = useBuilderStore((s) => s.setBgVariant);
	const viewport         = useBuilderStore((s) => s.viewport);
	const replaceGraph     = useBuilderStore((s) => s.replaceGraph);
	const dryRun           = useBuilderStore((s) => s.dryRun);
	const toggleDryRun     = useBuilderStore((s) => s.toggleDryRun);

	const fileInputRef = useRef(null);
	const [savedAt, setSavedAt] = useState(null);
	// [2026-06-16 Johnny Chu] PHASE-ATH W6 — submit to Hub state
	const [submittingHub, setSubmittingHub] = useState(false);
	const [saving, setSaving]   = useState(false);
	// [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder dialog state
	const [aiBuilderOpen, setAiBuilderOpen] = useState(false);
	const [hilCompilerOpen, setHilCompilerOpen] = useState(false);
	const navigate = useNavigate();
	const canEditWorkflow = canManage || !meta.customer_readonly;

	/**
	 * Detect canonical `trigger_type` (BE whitelist) từ trigger node đầu tiên.
	 * BE chấp nhận: manual / zalo_inbound / fb_comment / fb_message /
	 * telegram_inbound / cron / webhook / scheduler / twinbrain_intent /
	 * twinbrain_turn_completed / twinbrain_tool_decided.
	 */
	const detectTriggerType = (sourceNodes = nodes) => {
		const t = sourceNodes.find((n) => n.type === 'trigger');
		if (!t) return 'manual';
		const blockId = String(t.data?.blockId || '');
		return blockId.startsWith('trigger.') ? blockId.replace(/^trigger\./, '') : 'manual';
	};

	const ensureHilSpecBeforeSave = async (sourceNodes) => {
		if (!canManage) {
			return { aborted: false, nodes: sourceNodes };
		}
		const triggerNode = sourceNodes.find((node) => node.type === 'trigger');
		if (!triggerNode || !triggerNode.data || typeof triggerNode.data !== 'object') {
			return { aborted: false, nodes: sourceNodes };
		}
		const triggerData = triggerNode.data || {};
		const hilPrompt = String(triggerData.hil_prompt || '').trim();
		if (!hilPrompt) {
			return { aborted: false, nodes: sourceNodes };
		}

		const hasSpec = !!(triggerData.hil_spec && typeof triggerData.hil_spec === 'object');
		const compiledPrompt = String(triggerData.hil_compiled_prompt || '').trim();
		const needsCompile = !hasSpec || compiledPrompt !== hilPrompt;
		if (!needsCompile) {
			return { aborted: false, nodes: sourceNodes };
		}

		const ok = window.confirm(
			'HIL prompt da thay doi hoac chua co HIL spec. Compile tu dong truoc khi luu workflow?'
		);
		if (!ok) {
			return { aborted: true, nodes: sourceNodes };
		}

		const triggerId = String(triggerData.blockId || meta?.slug || `workflow_${meta?.id || 'new'}`);
		const data = await hilApi.compile(triggerId, hilPrompt, {
			workflow_id: meta?.id || '',
			intent_id: 'automation.task_execute',
			domain: 'automation',
			side_effect_level: 'explicit_confirmation',
		});
		const spec = data?.spec || data?.validation?.spec;
		if (!data?.ok || !spec) {
			throw new Error(data?.message || 'Khong compile duoc HIL spec truoc khi luu.');
		}

		const nextNodes = sourceNodes.map((node) => {
			if (node.type !== 'trigger') return node;
			const merged = {
				...(node.data || {}),
				hil_prompt: hilPrompt,
				hil_spec: spec,
				hil_spec_version: spec.spec_version || 'twin_hil.v1',
				hil_compiled_prompt: hilPrompt,
				hil_rollout: (node.data || {}).hil_rollout || 'mvp',
				hil_compiled_at: new Date().toISOString(),
			};
			return { ...node, data: merged };
		});
		setNodes(nextNodes);
		return { aborted: false, nodes: nextNodes };
	};

	const onSave = async () => {
		if (!canEditWorkflow) {
			alert('Workflow mặc định do admin publish. Hãy nhân bản workflow này để chỉnh bản riêng.');
			return;
		}
		if (saving) return;
		setSaving(true);
		let nodesForSave = nodes;

		try {
			const hilEnsure = await ensureHilSpecBeforeSave(nodesForSave);
			if (hilEnsure.aborted) {
				return;
			}
			nodesForSave = hilEnsure.nodes;
		} catch (e) {
			const msg = e instanceof BizCityApiError
				? `[${e.code || e.status}] ${e.message}`
				: (e?.message || 'Khong compile duoc HIL spec truoc khi luu.');
			alert('Luu workflow dung lai: ' + msg);
			setSaving(false);
			return;
		}

		// Local backup (giữ lại cho UX restore offline).
		const local = { meta, nodes: nodesForSave, edges, viewport };
		try {
			localStorage.setItem(`bizcity_automation_wf_${meta.id}`, JSON.stringify(local));
		} catch (_) { /* noop */ }

		// Build BE payload.
		const trigger_type = detectTriggerType(nodesForSave);
		const triggerNode  = nodesForSave.find((n) => n.type === 'trigger');
		const trigger_config = triggerNode ? { ...(triggerNode.data || {}) } : {};
		// Strip xyflow-only / display-only fields so BE doesn't choke.
		delete trigger_config.label;
		delete trigger_config.blockId;

		const payload = {
			name:           meta.name || 'Workflow mới',
			description:    meta.desc || '',
			enabled:        meta.enabled ? 1 : 0,
			trigger_type,
			trigger_config,
			tags:           Array.isArray(meta.tags) ? meta.tags : [],
			graph:          { nodes: nodesForSave, edges, viewport: viewport || null },
			debug_breakpoints: meta.debug_breakpoints && typeof meta.debug_breakpoints === 'object' ? meta.debug_breakpoints : {},
		};

		const isNumericId = Number.isInteger(meta.id) || (typeof meta.id === 'string' && /^\d+$/.test(meta.id));

		try {
			let res;
			if (isNumericId) {
				res = await workflowsApi.update(meta.id, payload);
			} else {
				res = await workflowsApi.create(payload);
			}
			const row = res?.row || res?.data?.row || res;
			if (row?.id) {
				const wasNew = !isNumericId;
				updateMeta({ id: row.id, slug: row.slug || meta.slug });
				if (wasNew) {
					// URL still /builder/new — swap to /builder/<id> so refresh restores.
					navigate(`/builder/${row.id}`, { replace: true });
				}
			}
			setSavedAt(new Date().toLocaleTimeString());
		} catch (e) {
			const msg = e instanceof BizCityApiError
				? `[${e.code || e.status}] ${e.message}`
				: (e?.message || 'Lỗi lưu workflow');
			// eslint-disable-next-line no-alert
			alert('Lưu workflow lỗi: ' + msg);
		} finally {
			setSaving(false);
		}
	};

	const onExport = () => {
		const payload = { meta, nodes, edges, viewport };
		const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
		const url  = URL.createObjectURL(blob);
		const a    = document.createElement('a');
		a.href = url; a.download = `${meta.id || 'workflow'}.json`; a.click();
		URL.revokeObjectURL(url);
	};

	const onImportClick = () => fileInputRef.current?.click();
	const onImportFile = (ev) => {
		const file = ev.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(String(reader.result || '{}'));
				replaceGraph({ meta: data.meta, nodes: data.nodes, edges: data.edges });
			} catch (e) {
				// eslint-disable-next-line no-console
				console.warn('[automation] import failed', e);
				alert('File JSON không hợp lệ');
			}
		};
		reader.readAsText(file);
		ev.target.value = '';
	};

	const onAutoLayout = () => {
		setNodes(autoLayout(nodes, edges));
	};

	// PG-S9-fix — Toggle Enable/Disable workflow inline (no full Save needed).
	// Persists via PATCH /workflows/:id (BE accepts partial), then mirrors meta.
	const [enabledSaving, setEnabledSaving] = useState(false);
	const onToggleEnabled = async () => {
		if (!canEditWorkflow) {
			alert('Workflow mặc định do admin publish. Hãy nhân bản workflow này để chỉnh bản riêng.');
			return;
		}
		const wfId = Number(meta.id);
		if (!wfId || Number.isNaN(wfId)) {
			alert('Hãy Lưu workflow trước khi Bật/Tắt.');
			return;
		}
		const next = meta.enabled ? 0 : 1;
		setEnabledSaving(true);
		try {
			await workflowsApi.update(wfId, { enabled: next });
			updateMeta({ enabled: !!next });
		} catch (e) {
			alert('Bật/Tắt workflow lỗi: ' + (e?.message || e));
		} finally {
			setEnabledSaving(false);
		}
	};

	// PG-S9-fix — Matcher trace viewer. Fetches last N matcher decisions so user
	// có thể debug khi nhắn tin thật vào kênh nhưng workflow không phản hồi.
	const [traceOpen, setTraceOpen]   = useState(false);
	const [traceRows, setTraceRows]   = useState([]);
	const [traceLoading, setTraceLoading] = useState(false);
	const onShowTrace = async () => {
		setTraceOpen(true);
		setTraceLoading(true);
		try {
			const json = await automationApi.matcherTrace(80);
			setTraceRows(Array.isArray(json?.rows) ? json.rows : []);
		} catch (e) {
			alert('Không tải được matcher trace: ' + (e?.message || e));
		} finally {
			setTraceLoading(false);
		}
	};
	const onClearTrace = async () => {
		if (!window.confirm('Xoá toàn bộ matcher trace?')) return;
		try {
			await automationApi.matcherTraceClear();
			setTraceRows([]);
		} catch (e) { alert('Clear lỗi: ' + (e?.message || e)); }
	};

	const onSaveAsTemplate = async () => {
		const wfId = Number(meta.id);
		if (!wfId || Number.isNaN(wfId)) {
			alert('Hãy lưu workflow trước khi save-as-template (workflow id bắt buộc).');
			return;
		}
		const name = window.prompt('Tên template:', `${meta.name || 'Workflow'} — template`);
		if (!name) return;
		const category = window.prompt('Nhóm (general|cskh|lead|report|webhook|mpr):', 'general') || 'general';
		try {
			const res = await templatesApi.saveFromWorkflow(wfId, { name, category });
			const tpl = res?.row || res;
			alert(`✓ Đã tạo template "${tpl?.slug || name}"`);
		} catch (e) {
			const msg = e instanceof BizCityApiError ? `${e.code || 'err'}: ${e.message}` : (e?.message || 'Lỗi save-as-template');
			alert(msg);
		}
	};

	// [2026-06-16 Johnny Chu] PHASE-ATH W6 — submit current workflow as hub template.
	const onSubmitToHub = async () => {
		const wfId = Number(meta.id);
		if (!wfId || Number.isNaN(wfId)) {
			alert('Hãy lưu workflow trước khi đăng lên Hub.');
			return;
		}
		const slug = window.prompt(
			'Slug template (ví dụ: tpl_daily_fb_post_8h_v1):',
			`tpl_${(meta.name || 'workflow').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}_v1`
		);
		if (!slug) return;
		const category = window.prompt('Danh mục (zalo|facebook|social|crm|schedule|content):', 'social') || 'social';
		const plan = window.prompt('Gói (free|pro|enterprise):', 'free') || 'free';
		setSubmittingHub(true);
		try {
			const graphJson = JSON.stringify({ nodes, edges });
			const res = await hubTemplatesApi.submit(wfId, {
				slug,
				name:         meta.name || slug,
				description:  meta.description || '',
				category,
				plan,
				trigger_type: (nodes.find((n) => n.type === 'trigger') || {}).data?.blockId || '',
				graph_json:   graphJson,
				author:       'Johnny Chu',
			});
			const data = res?.data || res;
			if (res?._degraded) {
				alert(`Hub chưa sẵn sàng: ${res.message || 'Kiểm tra API Key.'}`);
			} else {
				alert(`✓ Đã gửi lên Hub (trạng thái: ${data?.status || 'pending_review'}). Admin sẽ duyệt.`);
			}
		} catch (e) {
			const msg = e instanceof BizCityApiError ? `${e.code || 'err'}: ${e.message}` : (e?.message || 'Lỗi submit Hub');
			alert(msg);
		} finally {
			setSubmittingHub(false);
		}
	};

	return (
		<div style={{ borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
			{/* ── Row 1: Brand bar + primary actions ─────────────────────── */}
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '8px 14px', borderBottom: '1px solid #f1f5f9',
				gap: 12,
			}}>
				{/* Brand */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Workflow size={18} style={{ color: '#4f46e5' }} />
					<span style={{ fontWeight: 600, fontSize: 14 }}>BizCity Automation</span>
					<span style={{ fontSize: 11, color: '#94a3b8' }}>v{BOOT.version}</span>
				</div>
				{/* Primary action buttons */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					{/* [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder trigger */}
					{canManage && (
						<button type="button" onClick={() => setAiBuilderOpen(true)}
							className="aw-btn"
							style={{ background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 600 }}
							title="AI tự tạo workflow từ mô tả ngôn ngữ tự nhiên">
							<Sparkles size={14} /> AI Build
						</button>
					)}
					{canManage && (
						<button type="button" onClick={() => setHilCompilerOpen(true)}
							className="aw-btn aw-btn-outline" title="Compile và kiểm tra Human-in-the-loop spec">
							<Zap size={14} /> HIL Spec
						</button>
					)}
					<button type="button" onClick={openSettings} className="aw-btn aw-btn-outline">
						<SettingsIcon size={14} /> Cấu hình
					</button>
					{canManage && (
						<button type="button" onClick={onSaveAsTemplate} className="aw-btn aw-btn-outline" title="Lưu workflow hiện tại thành template">
							<BookmarkPlus size={14} /> Save as template
						</button>
					)}
					{/* [2026-06-16 Johnny Chu] PHASE-ATH W6 — submit to Hub BizCity */}
					{canManage && (
						<button type="button" onClick={onSubmitToHub} disabled={submittingHub} className="aw-btn aw-btn-outline"
							title="Đăng workflow lên Hub BizCity — chia sẻ với cộng đồng"
							style={{ borderColor: '#7c3aed', color: '#7c3aed' }}>
							{submittingHub
								? <><Loader2 size={14} className="aw-animate-spin" /> Đang gửi…</>
								: <>🌐 Đăng lên Hub</>}
						</button>
					)}
					<button type="button" onClick={onSave} disabled={saving || !canEditWorkflow} className="aw-btn aw-btn-outline">
						{saving
							? <><Loader2 size={14} className="aw-animate-spin" /> Đang lưu…</>
							: <><Save size={14} /> Lưu</>}
					</button>
					{listenActive ? (
						<button type="button" onClick={() => stopActiveListener('user_stop')}
							className="aw-btn aw-btn-outline"
							style={{ borderColor: '#dc2626', color: '#dc2626' }}
							title="Đang nghe kênh — bấm để dừng">
							<Square size={14} /> Dừng nghe
						</button>
					) : (
						<>
							<button type="button" onClick={onToggleEnabled} disabled={enabledSaving || !canEditWorkflow}
								className="aw-btn aw-btn-outline"
								title={meta.enabled
									? 'Workflow đang BẬT — matcher sẽ trigger khi có inbound. Bấm để TẮT.'
									: 'Workflow đang TẮT — matcher KHÔNG trigger. Bấm để BẬT.'}
								style={meta.enabled
									? { color: '#10b981', borderColor: '#10b981', background: '#f0fdf4' }
									: { color: '#94a3b8', borderColor: '#e2e8f0' }}>
								{enabledSaving
									? <><Loader2 size={14} className="aw-animate-spin" /> …</>
									: <>{meta.enabled ? '🟢 Đang Bật' : '⚪ Đang Tắt'}</>}
							</button>
							<button type="button" onClick={runWorkflow} disabled={isRunning}
								className="aw-btn aw-btn-primary">
								{isRunning
									? <><Loader2 size={14} className="aw-animate-spin" /> Đang chạy…</>
									: <><Play size={14} /> Chạy thử</>}
							</button>
						</>
					)}
					{/* PG-S5 — Debug controls */}
					{canManage && isRunning && runDbId && (() => {
						const isPaused  = debugState && debugState.startsWith('paused_before:');
						const isPausing = debugState === 'pausing' || debugState === 'stepping';
						const onPause = async () => {
							try { await runsApi.pause(runDbId); } catch (e) { /* eslint-disable-next-line no-alert */ alert('Pause lỗi: ' + (e?.message || e)); }
						};
						const onStep = async () => {
							try { await runsApi.step(runDbId); } catch (e) { /* eslint-disable-next-line no-alert */ alert('Step lỗi: ' + (e?.message || e)); }
						};
						const onResume = async () => {
							try { await runsApi.resume(runDbId); } catch (e) { /* eslint-disable-next-line no-alert */ alert('Resume lỗi: ' + (e?.message || e)); }
						};
						return (
							<>
								{!isPaused && (
									<button type="button" onClick={onPause} disabled={isPausing}
										className="aw-btn aw-btn-outline" title="Tạm dừng trước node tiếp theo">
										<Pause size={14} /> {isPausing ? 'Pausing…' : 'Pause'}
									</button>
								)}
								{isPaused && (
									<>
										<button type="button" onClick={onStep}
											className="aw-btn aw-btn-outline" title="Chạy đúng 1 node rồi pause lại">
											<StepForward size={14} /> Step
										</button>
										<button type="button" onClick={onResume}
											className="aw-btn aw-btn-primary" title="Tiếp tục đến breakpoint kế hoặc kết thúc">
											<Play size={14} /> Resume
										</button>
									</>
								)}
							</>
						);
					})()}
					{/* PG-S6 — Replay */}
					{!isRunning && runDbId && ['ok', 'fail', 'cancelled'].includes(runStatus) && (
						<button type="button"
							onClick={async () => {
								try { await replayRun(runDbId); }
								catch (e) { /* eslint-disable-next-line no-alert */ alert('Replay lỗi: ' + (e?.message || e)); }
							}}
							className="aw-btn aw-btn-outline"
							title="Chạy lại với same trigger payload (link parent_run_id)">
							<RotateCcw size={14} /> Replay
						</button>
					)}
				</div>
			</div>

			{/* ── Row 2: Breadcrumb + canvas tools ─────────────────────── */}
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '6px 14px',
				gap: 12,
			}}>
				{/* Breadcrumb + name */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
					<Link to="/" className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }}>
						<ArrowLeft size={14} /> Danh sách
					</Link>
					<span style={{ color: '#cbd5e1' }}>/</span>
					<input
						value={meta.name}
						onChange={(e) => updateMeta({ name: e.target.value })}
						style={{
							border: '1px solid transparent', borderRadius: 6, padding: '3px 8px',
							fontSize: 13, fontWeight: 600, minWidth: 180, maxWidth: 320,
							outline: 'none', background: 'transparent',
						}}
						onFocus={(e) => { e.target.style.border = '1px solid #cbd5e1'; e.target.style.background = '#f8fafc'; }}
						onBlur={(e) => { e.target.style.border = '1px solid transparent'; e.target.style.background = 'transparent'; }}
					/>
					{savedAt && (
						<span style={{ fontSize: 11, color: '#16a34a', whiteSpace: 'nowrap' }}>✓ Đã lưu {savedAt}</span>
					)}
					<CronHealthBadge />
				</div>

				{/* Canvas tools */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<button type="button" onClick={undo} disabled={!canUndo}
						className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }} title="Hoàn tác (Ctrl+Z)">
						<Undo2 size={14} />
					</button>
					<button type="button" onClick={redo} disabled={!canRedo}
						className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }} title="Làm lại (Ctrl+Y)">
						<Redo2 size={14} />
					</button>
					<span style={{ color: '#e2e8f0' }}>|</span>
					<button type="button" onClick={onAutoLayout}
						className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }} title="Sắp xếp tự động (L)">
						<LayoutGrid size={14} /> Layout
					</button>
					<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						<Spline size={14} style={{ color: '#64748b' }} />
						<select
							value={defaultEdgeType}
							onChange={(e) => setAllEdgesType(e.target.value)}
							style={{
								fontSize: 12, padding: '3px 6px', border: '1px solid #cbd5e1',
								borderRadius: 4, outline: 'none', background: '#fff',
							}}
							title="Kiểu cạnh nối"
						>
							{EDGE_TYPES.map((t) => (
								<option key={t.value} value={t.value}>{t.label}</option>
							))}
						</select>
					</span>
					<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
						<Grid3x3 size={14} style={{ color: '#64748b' }} />
						<select
							value={bgVariant}
							onChange={(e) => setBgVariant(e.target.value)}
							style={{
								fontSize: 12, padding: '3px 6px', border: '1px solid #cbd5e1',
								borderRadius: 4, outline: 'none', background: '#fff',
							}}
							title="Kiểu nền canvas"
						>
							{BG_VARIANTS.map((v) => (
								<option key={v.value} value={v.value}>{v.label}</option>
							))}
						</select>
					</span>
					<span style={{ color: '#e2e8f0' }}>|</span>
					<button type="button" onClick={toggleTimeline}
						className="aw-btn aw-btn-ghost"
						style={isTimelineOpen ? { color: '#4f46e5', padding: '4px 8px' } : { padding: '4px 8px' }}>
						<Activity size={14} /> Timeline
					</button>
					<button type="button" onClick={toggleDryRun}
						className="aw-btn aw-btn-ghost"
						style={dryRun
							? { color: '#fb923c', background: '#1e1b14', border: '1px solid #fb923c', padding: '4px 8px' }
							: { padding: '4px 8px' }}
						title="Dry-run: chạy workflow nhưng KHÔNG gửi tin / email / HTTP / DB write thật.">
						⚡ Dry {dryRun ? 'ON' : 'OFF'}
					</button>
					{canManage && (
						<button type="button" onClick={onShowTrace}
							className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }}
							title="Xem 80 quyết định gần nhất của Trigger Matcher">
							🔎 Trace
						</button>
					)}
					<button type="button" onClick={onExport} className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }} title="Tải JSON">
						<FileDown size={14} /> Export
					</button>
					<button type="button" onClick={onImportClick} className="aw-btn aw-btn-ghost" style={{ padding: '4px 8px' }} title="Import JSON">
						<FileUp size={14} /> Import
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/json,.json"
						onChange={onImportFile}
						style={{ display: 'none' }}
					/>
				</div>
			</div>

			{canManage && traceOpen && (
				<MatcherTraceModal
					rows={traceRows}
					loading={traceLoading}
					onClose={() => setTraceOpen(false)}
					onRefresh={onShowTrace}
					onClear={onClearTrace}
				/>
			)}

			{/* [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder dialog */}
			<AiBuilderDialog
				open={aiBuilderOpen}
				onClose={() => setAiBuilderOpen(false)}
				onApply={({ name, nodes, edges }) => {
					replaceGraph({ meta: name ? { name } : undefined, nodes, edges });
				}}
			/>
			<HilCompilerDialog
				open={hilCompilerOpen}
				onClose={() => setHilCompilerOpen(false)}
				onApply={(hilPayload) => {
					const spec = hilPayload?.spec || hilPayload;
					const compiledPrompt = typeof hilPayload?.prompt === 'string' ? hilPayload.prompt.trim() : '';
					// [2026-08-16 Johnny Chu] MPR-V5-HIL-COMPILER — pass the array shape required by builderStore.setNodes().
					setNodes(nodes.map((node) => node.type === 'trigger'
						? {
							...node,
							data: {
								...(node.data || {}),
								hil_prompt: compiledPrompt || (node.data || {}).hil_prompt || '',
								hil_spec: spec,
								hil_spec_version: spec.spec_version || 'twin_hil.v1',
								hil_compiled_prompt: compiledPrompt || (node.data || {}).hil_compiled_prompt || '',
								hil_rollout: (node.data || {}).hil_rollout || 'mvp',
								hil_compiled_at: new Date().toISOString(),
							},
						}
						: node));
				}}
				meta={meta}
				nodes={nodes}
			/>
		</div>
	);
}

/* ─── PG-S9-fix — Matcher Trace viewer ────────────────────────────────── */
function MatcherTraceModal({ rows, loading, onClose, onRefresh, onClear }) {
	const decisionColor = (d) => ({
		enter:           '#94a3b8',
		resume_pending:  '#10b981',
		matched_keyword: '#3b82f6',
		fallback_fired:  '#a855f7',
		default_reply:   '#f59e0b',
		media_stash:     '#06b6d4',
		silent:          '#ef4444',
		rejected_role:   '#64748b',
		no_trigger_type: '#ef4444',
		dedup_skip:      '#475569',
	})[d] || '#cbd5e1';

	const toJsonl = () => rows.map((r) => JSON.stringify(r)).join('\n');

	const onCopy = async () => {
		const text = toJsonl();
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const ta = document.createElement('textarea');
				ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
				document.body.appendChild(ta); ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			alert('Đã copy ' + rows.length + ' dòng JSONL vào clipboard.');
		} catch (e) {
			alert('Copy thất bại: ' + (e?.message || e));
		}
	};

	const onDownload = () => {
		const text = toJsonl();
		const blob = new Blob([text], { type: 'application/x-ndjson' });
		const url  = URL.createObjectURL(blob);
		const ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
		const a    = document.createElement('a');
		a.href = url;
		a.download = `matcher-trace-${ts}.jsonl`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	};

	return (
		<div onClick={onClose}
			style={{
				position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
				zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
			}}>
			<div onClick={(e) => e.stopPropagation()}
				style={{
					width: 'min(960px, 95vw)', maxHeight: '85vh', overflow: 'auto',
					background: '#0f172a', color: '#e2e8f0',
					border: '1px solid #334155', borderRadius: 8, padding: 16,
				}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
					<strong style={{ fontSize: 16 }}>🔎 Matcher Trace</strong>
					<span style={{ color: '#94a3b8', fontSize: 12 }}>
						{rows.length} entries · 80 max · ring buffer
					</span>
					<span style={{ flex: 1 }} />
					<button onClick={onRefresh} className="aw-btn aw-btn-outline">Refresh</button>
					<button onClick={onCopy} className="aw-btn aw-btn-outline"
						disabled={!rows.length}
						title="Copy JSONL ra clipboard">📋 Copy</button>
					<button onClick={onDownload} className="aw-btn aw-btn-outline"
						disabled={!rows.length}
						title="Tải JSONL về máy">⬇ JSONL</button>
					<button onClick={onClear} className="aw-btn aw-btn-outline"
						style={{ borderColor: '#dc2626', color: '#dc2626' }}>Clear</button>
					<button onClick={onClose} className="aw-btn aw-btn-outline">Đóng</button>
				</div>
				<div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
					Mỗi row = 1 quyết định của matcher khi tin nhắn vào kênh. Nếu không có
					row "<code>enter</code>" sau khi sếp nhắn thử → matcher KHÔNG fire (kiểm tra
					channel gateway / hook <code>bizcity_channel_message_received</code>).
				</div>
				{loading && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Đang tải…</div>}
				{!loading && rows.length === 0 && (
					<div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
						Chưa có trace. Hãy nhắn tin thử vào kênh rồi bấm Refresh.
					</div>
				)}
				{!loading && rows.length > 0 && (
					<table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
						<thead>
							<tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Time (UTC)</th>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Decision</th>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Platform</th>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Chat ID</th>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Text / Media</th>
								<th style={{ textAlign: 'left', padding: '6px 4px' }}>Detail</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((r, i) => (
								<tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
									<td style={{ padding: '6px 4px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
										{(r.ts_iso || '').replace('T', ' ').replace('Z', '')}
									</td>
									<td style={{ padding: '6px 4px' }}>
										<span style={{
											padding: '2px 6px', borderRadius: 4, fontSize: 11,
											background: decisionColor(r.decision) + '22',
											color: decisionColor(r.decision),
											border: '1px solid ' + decisionColor(r.decision),
										}}>{r.decision}</span>
									</td>
									<td style={{ padding: '6px 4px' }}>{r.platform}</td>
									<td style={{ padding: '6px 4px', fontFamily: 'monospace' }}>{r.chat_id}</td>
									<td style={{ padding: '6px 4px' }}>
										{r.text && <div>{r.text}</div>}
										{r.media_url && <div style={{ color: '#06b6d4' }}>📎 {r.media_url}</div>}
									</td>
									<td style={{ padding: '6px 4px', color: '#94a3b8' }}>
										{r.wf_id ? <strong>wf#{r.wf_id} </strong> : null}
										{r.detail}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
