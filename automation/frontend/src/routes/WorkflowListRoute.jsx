import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
	Plus, Play, Pause, Workflow, LayoutTemplate, Loader2, RefreshCw, Inbox,
	Trash2, Copy, FileText, Download, X, ListChecks, Globe2,
} from 'lucide-react';
import TemplateGallery from '../components/TemplateGallery.jsx';
import { workflowsApi, BizCityApiError } from '../lib/api.js';
import { BOOT } from '../lib/boot.js';

const STATUS_BADGE = {
	active: { label: 'Đang chạy', cls: 'aw-bg-green-50 aw-text-green-700 aw-border-green-200', Icon: Play },
	draft:  { label: 'Nháp',       cls: 'aw-bg-slate-50 aw-text-slate-700 aw-border-slate-200', Icon: Workflow },
	paused: { label: 'Tạm dừng',   cls: 'aw-bg-amber-50 aw-text-amber-700 aw-border-amber-200', Icon: Pause },
};

function statusOf(row) {
	if (row?.enabled === false || row?.enabled === 0 || row?.enabled === '0') return 'paused';
	return 'active';
}

function formatBytes(n) {
	if (!n || n < 1024) return `${n || 0} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function pickMsg(e, fallback = 'Lỗi') {
	return e instanceof BizCityApiError
		? `[${e.code || e.status}] ${e.message}`
		: (e?.message || fallback);
}

/* ─── Log viewer modal ─────────────────────────────────────────── */
function LogModal({ workflow, onClose }) {
	const [rows, setRows]       = useState([]);
	const [bytes, setBytes]     = useState(0);
	const [loading, setLoading] = useState(true);
	const [err, setErr]         = useState('');
	const [auto, setAuto]       = useState(true);

	const load = async () => {
		setLoading(true);
		setErr('');
		try {
			const res = await workflowsApi.fileLog(workflow.id, 300);
			setRows(Array.isArray(res?.rows) ? res.rows : []);
			setBytes(res?.bytes || 0);
		} catch (e) { setErr(pickMsg(e, 'Không tải được log file')); }
		finally    { setLoading(false); }
	};

	useEffect(() => { load(); /* eslint-disable-next-line */ }, [workflow.id]);
	useEffect(() => {
		if (!auto) return;
		const t = setInterval(load, 3000);
		return () => clearInterval(t);
		/* eslint-disable-next-line */
	}, [auto, workflow.id]);

	const onClear = async () => {
		if (!window.confirm('Xoá toàn bộ log file của workflow này?')) return;
		try {
			await workflowsApi.fileLogClear(workflow.id);
			setRows([]); setBytes(0);
		} catch (e) { alert(pickMsg(e, 'Clear thất bại')); }
	};

	const onSelftest = async () => {
		try {
			const r = await workflowsApi.fileLogSelftest(workflow.id);
			alert(
				'✅ Self-test OK\n\n' +
				'log_path: ' + r.log_path + '\n' +
				'dir_writable: ' + r.dir_writable + '\n' +
				'file_exists: ' + r.file_exists + ' (size=' + r.file_size + ')\n' +
				'blog_id: ' + r.blog_id + '\n' +
				'upload_basedir: ' + r.upload_basedir
			);
			load();
		} catch (e) { alert(pickMsg(e, 'Self-test thất bại')); }
	};

	const downloadHref = workflowsApi.fileLogDownloadUrl(workflow.id);

	return (
		<div
			className="aw-fixed aw-inset-0 aw-bg-black/50 aw-z-50 aw-flex aw-items-center aw-justify-center"
			onClick={onClose}
		>
			<div
				className="aw-bg-white aw-rounded-lg aw-shadow-xl aw-w-[min(1100px,95vw)] aw-h-[85vh] aw-flex aw-flex-col"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="aw-flex aw-items-center aw-justify-between aw-px-4 aw-py-3 aw-border-b aw-border-slate-200">
					<div className="aw-flex aw-items-center aw-gap-2">
						<FileText size={18} className="aw-text-slate-500" />
						<div>
							<div className="aw-font-semibold aw-text-sm">
								Log file · {workflow.name || `Workflow #${workflow.id}`}
							</div>
							<div className="aw-text-xs aw-text-slate-500">
								wf-{workflow.id}.jsonl · {formatBytes(bytes)} · {rows.length} dòng cuối
							</div>
						</div>
					</div>
					<div className="aw-flex aw-items-center aw-gap-2">
						<label className="aw-flex aw-items-center aw-gap-1 aw-text-xs aw-text-slate-600">
							<input
								type="checkbox"
								checked={auto}
								onChange={(e) => setAuto(e.target.checked)}
							/>
							Auto refresh 3s
						</label>
						<button type="button" onClick={load} className="aw-btn aw-btn-outline aw-btn-sm">
							<RefreshCw size={14} /> Làm mới
						</button>
						<button type="button" onClick={onSelftest} className="aw-btn aw-btn-outline aw-btn-sm" title="Ghi 1 dòng probe để kiểm tra file writer">
							🧪 Self-test
						</button>
						<a
							href={downloadHref}
							target="_blank"
							rel="noopener noreferrer"
							className="aw-btn aw-btn-outline aw-btn-sm"
							title="Tải toàn bộ log JSONL"
						>
							<Download size={14} /> Tải JSONL
						</a>
						<button type="button" onClick={onClear} className="aw-btn aw-btn-outline aw-btn-sm aw-text-red-700">
							<Trash2 size={14} /> Clear
						</button>
						<button type="button" onClick={onClose} className="aw-btn aw-btn-ghost aw-btn-sm">
							<X size={16} />
						</button>
					</div>
				</div>

				<div className="aw-flex-1 aw-overflow-auto aw-p-3 aw-bg-slate-50">
					{loading && rows.length === 0 && (
						<div className="aw-text-center aw-text-slate-400 aw-py-10">
							<Loader2 size={20} className="aw-animate-spin aw-inline" />
						</div>
					)}
					{err && (
						<div className="aw-text-sm aw-text-red-700 aw-bg-red-50 aw-border aw-border-red-200 aw-rounded aw-px-3 aw-py-2">
							⚠ {err}
						</div>
					)}
					{!loading && !err && rows.length === 0 && (
						<div className="aw-text-center aw-text-slate-500 aw-py-10 aw-text-sm">
							Chưa có log nào. Bật workflow + gửi tin nhắn thật / nhấn "Chạy thử" → log sẽ xuất hiện ở đây.
						</div>
					)}
					{rows.length > 0 && (
						<div className="aw-flex aw-flex-col aw-gap-1">
							{rows.map((r, i) => <LogRow key={i} entry={r} />)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function statusPill(s) {
	const map = {
		OK:   'aw-bg-green-100 aw-text-green-800',
		FAIL: 'aw-bg-red-100 aw-text-red-800',
		SKIP: 'aw-bg-slate-100 aw-text-slate-600',
		RUN:  'aw-bg-blue-100 aw-text-blue-800',
	};
	return map[s] || 'aw-bg-slate-100 aw-text-slate-700';
}

function LogRow({ entry }) {
	const [open, setOpen] = useState(false);
	const ts  = entry.ts || '';
	const ev  = entry.event || entry.block_id || '';
	const st  = entry.status_text || '';
	const err = entry.error || '';
	return (
		<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded aw-px-2 aw-py-1.5 aw-text-xs aw-font-mono">
			<div className="aw-flex aw-items-center aw-gap-2 aw-cursor-pointer" onClick={() => setOpen(!open)}>
				<span className="aw-text-slate-400">{String(ts).slice(11, 19) || String(ts).slice(0, 19)}</span>
				{st && <span className={`aw-inline-block aw-px-1.5 aw-rounded ${statusPill(st)}`}>{st}</span>}
				{entry.run_id && <span className="aw-text-purple-600">run:{String(entry.run_id).slice(0, 8)}</span>}
				{entry.node_id && <span className="aw-text-slate-600">node:{entry.node_id}</span>}
				<span className="aw-text-slate-900">{ev}</span>
				{err && <span className="aw-text-red-600">— {err}</span>}
				{entry.text && <span className="aw-text-slate-500 aw-truncate aw-max-w-md">"{entry.text}"</span>}
			</div>
			{open && (
				<pre className="aw-mt-1 aw-bg-slate-50 aw-border aw-border-slate-100 aw-rounded aw-p-2 aw-overflow-auto aw-text-[11px] aw-whitespace-pre-wrap">
{JSON.stringify(entry, null, 2)}
				</pre>
			)}
		</div>
	);
}

/* ─── Main list route ─────────────────────────────────────────── */
export default function WorkflowListRoute() {
	// [2026-07-21 Johnny Chu] PHASE-2-TWIN-GPT-CHANNEL-AUTOMATION — customers can author own workflows; admins keep template/must-use controls.
	const canManage = !!BOOT?.caps?.manage;
	const canCreateWorkflow = canManage || BOOT?.caps?.create_workflow !== false;
	// [2026-07-21 Johnny Chu] PHASE-2-TWIN-GPT-CHANNEL-AUTOMATION — /gpt customer users need template library and listener inbox tools, without admin publish controls.
	const canUseCustomerTools = canCreateWorkflow || BOOT?.caps?.view_inbox !== false;
	const [galleryOpen, setGalleryOpen] = useState(false);
	const [rows, setRows]   = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [busy, setBusy]   = useState({}); // {id: 'toggle'|'delete'|'dup'}
	const [logFor, setLogFor] = useState(null);
	// [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W6 — skill filter tab.
	const [skillFilter, setSkillFilter] = useState('all'); // 'all' | 'active' | 'skill'
	// [2026-07-21 Johnny Chu] PHASE-2-TWIN-GPT-CHANNEL-AUTOMATION — admin filter for workflows published to customer My Workflows.
	const [customerDefaultOnly, setCustomerDefaultOnly] = useState(false);
	const navigate = useNavigate();

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await workflowsApi.list({ limit: 100 });
			const list = res?.rows || res?.data?.rows || res?.items || res || [];
			setRows(Array.isArray(list) ? list : []);
		} catch (e) {
			setError(pickMsg(e, 'Lỗi tải danh sách'));
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => { load(); }, []);

	const setRowBusy = (id, op) => setBusy((b) => ({ ...b, [id]: op }));
	const clearBusy  = (id)     => setBusy((b) => { const x = { ...b }; delete x[id]; return x; });

	const onToggle = async (wf) => {
		const next = wf.enabled ? 0 : 1;
		setRowBusy(wf.id, 'toggle');
		try {
			await workflowsApi.update(wf.id, { enabled: next });
			setRows((rs) => rs.map((r) => r.id === wf.id ? { ...r, enabled: next } : r));
		} catch (e) { alert(pickMsg(e, 'Toggle thất bại')); }
		finally    { clearBusy(wf.id); }
	};

	const onDelete = async (wf) => {
		const name = wf.name || `Workflow #${wf.id}`;
		if (!window.confirm(`Xoá VĨNH VIỄN workflow "${name}"?\n\nHành động này không thể hoàn tác.\nLog file wf-${wf.id}.jsonl cũng bị xoá.`)) return;
		setRowBusy(wf.id, 'delete');
		try {
			await workflowsApi.del(wf.id);
			setRows((rs) => rs.filter((r) => r.id !== wf.id));
		} catch (e) { alert(pickMsg(e, 'Delete thất bại')); }
		finally    { clearBusy(wf.id); }
	};

	const onDuplicate = async (wf) => {
		setRowBusy(wf.id, 'dup');
		try {
			const res = await workflowsApi.duplicate(wf.id);
			const created = res?.row || res?.data || res;
			if (created?.id) {
				setRows((rs) => [{ ...created, is_owner: true, can_edit: true, can_run: true, can_duplicate: true, customer_readonly: false }, ...rs]);
			} else { await load(); }
		} catch (e) { alert(pickMsg(e, 'Duplicate thất bại')); }
		finally    { clearBusy(wf.id); }
	};

	const onCustomerDefault = async (wf) => {
		const current = !!wf?.customer_default?.enabled;
		const next = !current;
		setRowBusy(wf.id, 'customer-default');
		try {
			const res = await workflowsApi.customerDefault(wf.id, next);
			const state = res?.customer_default || res?.row?.customer_default || { enabled: next };
			setRows((rs) => rs.map((r) => r.id === wf.id ? { ...r, customer_default: state } : r));
		} catch (e) { alert(pickMsg(e, 'Không cập nhật được Customer mặc định')); }
		finally    { clearBusy(wf.id); }
	};

	const onTemplatePicked = (wf) => {
		if (!wf?.id) return;
		const target = `/builder/${wf.id}`;
		// [2026-07-30 Johnny Chu] PHASE-1.22-RUNTIME — HashRouter updates the hash; a second manual hash write races builder hydration.
		navigate(target, { replace: false, state: { importedWorkflow: wf } });
	};

	return (
		<div className="aw-flex aw-flex-col aw-gap-4 aw-p-6">
			<div className="aw-flex aw-items-start aw-justify-between aw-gap-3 aw-flex-wrap">
				<div>
					<h1 className="aw-text-2xl aw-font-semibold aw-flex aw-items-center aw-gap-2">
						<Workflow size={22} /> Automation Workflows
					</h1>
					<p className="aw-text-sm aw-text-slate-500">
						{canManage
							? 'Danh sách workflow đã lưu — bấm "Mở canvas" để chỉnh sửa hoặc "Log" để xem log debug riêng từng workflow.'
							: 'Tạo và chỉnh workflow của bạn. Kịch bản admin publish có thể nhân bản thành bản riêng để chỉnh.'}
					</p>
				</div>
				<div className="aw-workflow-toolbar aw-flex aw-items-center aw-gap-2 aw-flex-wrap aw-justify-end">
					{canManage && (
						<button
							type="button"
							onClick={() => setCustomerDefaultOnly((v) => !v)}
							className="aw-btn aw-btn-outline"
							title="Lọc các workflow đã publish thành kịch bản mặc định cho customer"
							style={customerDefaultOnly ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' } : undefined}
						>
							<Globe2 size={16} /> Customer mặc định
						</button>
					)}
					{canUseCustomerTools && (
						<>
							<Link to="/scenarios" className="aw-btn aw-btn-outline" title="Kịch bản dạng danh sách (Bot-Bán-Hàng)">
								<ListChecks size={16} /> Kịch bản
							</Link>
							<Link to="/inbox" className="aw-btn aw-btn-outline" title="Xem webhook events thật từ Listener Bus">
								<Inbox size={16} /> Inbox (debug)
							</Link>
						</>
					)}
					<button type="button" onClick={load} className="aw-btn aw-btn-outline" title="Tải lại danh sách">
						<RefreshCw size={16} /> Làm mới
					</button>
					{canUseCustomerTools && (
						<>
							<button type="button" onClick={() => setGalleryOpen(true)} className="aw-btn aw-btn-outline">
								<LayoutTemplate size={16} /> Thư viện template
							</button>
						</>
					)}
					{canCreateWorkflow && (
						<Link to="/builder/new" className="aw-btn aw-btn-primary">
							<Plus size={16} /> Tạo workflow
						</Link>
					)}
				</div>
			</div>

			<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-overflow-hidden">
				{/* [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W6 — Skill filter tabs */}
				<div className="aw-px-4 aw-py-3 aw-border-b aw-border-slate-200 aw-flex aw-items-center aw-flex-wrap aw-gap-2">
					<h2 className="aw-text-sm aw-font-semibold aw-mr-auto">
						{skillFilter === 'skill'  ? `Skill AI (${rows.filter((r) => r.slug && r.enabled).length})` :
						 skillFilter === 'active' ? `Đang chạy (${rows.filter((r) => r.enabled).length})` :
						 `Tất cả workflow (${rows.length})`}
						{customerDefaultOnly && ` · Customer mặc định (${rows.filter((r) => r?.customer_default?.enabled).length})`}
						{loading && <Loader2 size={12} className="aw-animate-spin aw-inline aw-ml-2" />}
					</h2>
					{/* filter tabs */}
					{(['all', 'active', 'skill']).map((tab) => (
						<button
							key={tab}
							type="button"
							onClick={() => setSkillFilter(tab)}
							className="aw-btn aw-btn-sm"
							style={{
								borderRadius: 4, fontSize: 11, padding: '3px 8px',
								background:  skillFilter === tab ? '#ede9fe' : 'transparent',
								color:       skillFilter === tab ? '#5b21b6' : '#64748b',
								border:      skillFilter === tab ? '1px solid #c4b5fd' : '1px solid #e2e8f0',
								fontWeight:  skillFilter === tab ? 600 : 400,
							}}
						>
							{tab === 'all'    && 'Tất cả'}
							{tab === 'active' && '● Đang chạy'}
							{tab === 'skill'  && '🧠 Skill AI'}
						</button>
					))}
				</div>
				{error && (
					<div className="aw-px-4 aw-py-3 aw-text-sm aw-text-red-700 aw-bg-red-50 aw-border-b aw-border-red-200">
						⚠ {error}
					</div>
				)}
				<div className="aw-overflow-x-auto">
					{/* [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W6 — filtered rows */}
					{(() => {
					const filteredRows = rows.filter((r) => {
						if (customerDefaultOnly && !r?.customer_default?.enabled) return false;
						if (skillFilter === 'active') return r.enabled;
						if (skillFilter === 'skill')  return r.enabled && r.slug;
						return true;
					});
					return (
					<table className="aw-w-full aw-text-sm">
						<thead className="aw-bg-slate-50 aw-text-left aw-text-xs aw-uppercase aw-text-slate-500">
							<tr>
								<th className="aw-px-4 aw-py-2">Tên</th>
								<th className="aw-px-4 aw-py-2">Trigger</th>
								<th className="aw-px-4 aw-py-2">Trạng thái</th>
								{/* [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — Skill badge column */}
								<th className="aw-px-4 aw-py-2">Skill AI</th>
								<th className="aw-px-4 aw-py-2">Cập nhật</th>
								<th className="aw-px-4 aw-py-2 aw-text-right">Hành động</th>
							</tr>
						</thead>
						<tbody>
							{!loading && filteredRows.length === 0 && !error && (
								<tr>
									<td colSpan={6} className="aw-px-4 aw-py-6 aw-text-center aw-text-slate-500">
										{skillFilter === 'skill'  ? 'Không có Skill AI nào. Bật workflow và đặt slug để dùng /skill trong chat.' :
										 skillFilter === 'active' ? 'Không có workflow đang chạy.' :
										 'Chưa có workflow nào. Bấm "Tạo workflow" để bắt đầu.'}
									</td>
								</tr>
							)}
							{filteredRows.map((wf) => {
								const st        = statusOf(wf);
								const meta      = STATUS_BADGE[st] || STATUS_BADGE.draft;
								const Icon      = meta.Icon;
								const op        = busy[wf.id];
								const ToggleIcon = wf.enabled ? Pause : Play;
								// [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — skill badge.
								const skillSlug = wf.slug && wf.enabled ? String(wf.slug) : '';
								const customerDefault = !!wf?.customer_default?.enabled;
								const canEditWorkflow = canManage || !!wf.can_edit;
								const canDuplicateWorkflow = canManage || wf.can_duplicate !== false;
								return (
									<tr key={wf.id} className="aw-border-t aw-border-slate-100 hover:aw-bg-slate-50">
										<td className="aw-px-4 aw-py-3 aw-font-medium">
											{wf.name || `Workflow #${wf.id}`}
											{canManage && <span className="aw-text-slate-400 aw-text-xs aw-ml-2">#{wf.id}</span>}
											{customerDefault && (
												<span className="aw-ml-2 aw-inline-flex aw-items-center aw-gap-1 aw-rounded aw-border aw-border-emerald-200 aw-bg-emerald-50 aw-px-2 aw-py-0.5 aw-text-[11px] aw-font-semibold aw-text-emerald-700" title="Kịch bản mặc định do admin publish cho customer">
													<Globe2 size={11} /> Customer mặc định
												</span>
											)}
										</td>
										<td className="aw-px-4 aw-py-3 aw-text-slate-500"><code style={{ fontSize: 11 }}>{wf.trigger_type || '—'}</code></td>
										<td className="aw-px-4 aw-py-3">
											<span className={`aw-inline-flex aw-items-center aw-gap-1 aw-px-2 aw-py-0.5 aw-rounded aw-border aw-text-xs ${meta.cls}`}>
												<Icon size={12} /> {meta.label}
											</span>
										</td>
										{/* Skill AI badge — purple /slug pill when enabled+slug set */}
										<td className="aw-px-4 aw-py-3">
											{skillSlug ? (
												<span
													title={`Dùng trong chat: /${skillSlug}`}
													style={{
														display: 'inline-flex', alignItems: 'center', gap: 3,
														padding: '2px 6px', borderRadius: 4, fontSize: 11,
														background: '#ede9fe', color: '#5b21b6',
														border: '1px solid #ddd6fe',
													}}
												>
													🧠 <code style={{ fontSize: 10 }}>/{skillSlug}</code>
												</span>
											) : (
												<span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
											)}
										</td>
										<td className="aw-px-4 aw-py-3 aw-text-slate-500">{(wf.updated_at || '').slice(0, 16)}</td>
										<td className="aw-px-4 aw-py-3 aw-text-right">
											<div className="aw-inline-flex aw-items-center aw-gap-1">
												{canManage && (
													<button
														type="button"
														onClick={() => onCustomerDefault(wf)}
														disabled={!!op}
														className="aw-btn aw-btn-outline aw-btn-sm"
														title={customerDefault ? 'Tắt khỏi danh sách mặc định của customer' : 'Publish workflow này thành kịch bản mặc định cho mọi customer'}
														style={customerDefault ? { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' } : undefined}
													>
														{op === 'customer-default'
															? <Loader2 size={14} className="aw-animate-spin" />
															: <Globe2 size={14} />}
														{customerDefault ? 'Customer ON' : 'Customer OFF'}
													</button>
												)}
												{canEditWorkflow && (
													<>
														<button
															type="button"
															onClick={() => onToggle(wf)}
															disabled={!!op}
															className="aw-btn aw-btn-outline aw-btn-sm"
															title={wf.enabled ? 'Tạm dừng (enabled=0)' : 'Kích hoạt (enabled=1)'}
														>
															{op === 'toggle'
																? <Loader2 size={14} className="aw-animate-spin" />
																: <ToggleIcon size={14} />}
															{wf.enabled ? 'Tạm dừng' : 'Bật'}
														</button>
														<Link to={`/builder/${wf.id}`} className="aw-btn aw-btn-outline aw-btn-sm">Mở canvas</Link>
													</>
												)}
												{canManage && (
													<button
														type="button"
														onClick={() => setLogFor(wf)}
														className="aw-btn aw-btn-outline aw-btn-sm"
														title="Xem log JSONL (uploads/bizcity/automation-workflow-logs/wf-{id}.jsonl)"
													>
														<FileText size={14} /> Log
													</button>
												)}
												{canEditWorkflow && (
													<button
														type="button"
														onClick={() => onDelete(wf)}
														disabled={!!op}
														className="aw-btn aw-btn-outline aw-btn-sm aw-text-red-700"
														title="Xoá vĩnh viễn (hard delete)"
													>
														{op === 'delete'
															? <Loader2 size={14} className="aw-animate-spin" />
															: <Trash2 size={14} />}
														Xóa
													</button>
												)}
												{canDuplicateWorkflow && (
													<button
														type="button"
														onClick={() => onDuplicate(wf)}
														disabled={!!op}
														className="aw-btn aw-btn-ghost aw-btn-sm"
														title="Nhân bản workflow"
													>
														{op === 'dup'
															? <Loader2 size={14} className="aw-animate-spin" />
															: <Copy size={14} />}
														{canEditWorkflow ? '' : ' Nhân bản để chỉnh'}
													</button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
					); })()}
				</div>
			</div>
			{canUseCustomerTools && (
				<TemplateGallery
					open={galleryOpen}
					onClose={() => setGalleryOpen(false)}
					onPicked={onTemplatePicked}
				/>
			)}
			{canManage && logFor && (
				<LogModal workflow={logFor} onClose={() => setLogFor(null)} />
			)}
		</div>
	);
}
