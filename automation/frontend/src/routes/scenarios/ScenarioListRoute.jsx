/**
 * ScenarioListRoute — danh sách kịch bản (Bot-Bán-Hàng style).
 *
 * Dùng cùng `bizcity_automation_workflows`, lọc `tag=scenario` để chỉ hiện
 * các workflow tuyến tính. Workflow phức tạp vẫn nằm ở /builder.
 *
 * @since 2026-06-01
 */
import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
	Plus, Workflow, Loader2, RefreshCw, Trash2, Copy, ListChecks, Play, Pause,
	ArrowLeft,
} from 'lucide-react';
import { workflowsApi, BizCityApiError } from '../../lib/api.js';
import { triggerKeyByBlockId, triggerDefByKey } from './lib/scenarioSchema.js';
import { decompileWorkflowToLinear } from './lib/compileLinear.js';

function pickMsg(e, fallback = 'Lỗi') {
	return e instanceof BizCityApiError
		? `[${e.code || e.status}] ${e.message}`
		: (e?.message || fallback);
}

function summariseRow(row) {
	const linear = decompileWorkflowToLinear(row);
	if (!linear) return { triggerLabel: row.trigger_type || '—', steps: 0, keywords: [], linear: false };
	const trigKey = linear.trigger.key;
	const trig = triggerDefByKey(trigKey);
	return {
		triggerLabel: trig ? trig.label : (row.trigger_type || '—'),
		steps:        linear.steps.length,
		keywords:     linear.trigger.keywords || [],
		linear:       true,
	};
}

export default function ScenarioListRoute() {
	const [rows, setRows]   = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [busy, setBusy]   = useState({});
	const navigate = useNavigate();

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const res = await workflowsApi.list({ tag: 'scenario', limit: 200 });
			const list = res?.rows || res?.data?.rows || res?.items || res || [];
			setRows(Array.isArray(list) ? list : []);
		} catch (e) {
			setError(pickMsg(e, 'Lỗi tải danh sách kịch bản'));
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
		const name = wf.name || `Kịch bản #${wf.id}`;
		if (!window.confirm(`Xoá VĨNH VIỄN kịch bản "${name}"?\nHành động này không thể hoàn tác.`)) return;
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
				setRows((rs) => [created, ...rs]);
			} else { await load(); }
		} catch (e) { alert(pickMsg(e, 'Duplicate thất bại')); }
		finally    { clearBusy(wf.id); }
	};

	return (
		<div className="aw-flex aw-flex-col aw-gap-4 aw-p-6">
			<div className="aw-flex aw-items-center aw-justify-between">
				<div>
					<h1 className="aw-text-2xl aw-font-semibold aw-flex aw-items-center aw-gap-2">
						<ListChecks size={22} /> Kịch bản (Bot-Bán-Hàng)
					</h1>
					<p className="aw-text-sm aw-text-slate-500">
						Tạo kịch bản dạng <em>danh sách bước</em> — mỗi bước nối tiếp nhau khi khách gõ trúng từ khoá. Workflow phức tạp (rẽ nhánh, song song) vẫn dùng <Link to="/" className="aw-text-blue-600 hover:aw-underline">canvas advanced</Link>.
					</p>
				</div>
				<div className="aw-flex aw-items-center aw-gap-2">
					<Link to="/" className="aw-btn aw-btn-outline" title="Về danh sách workflow advanced">
						<ArrowLeft size={16} /> Workflow advanced
					</Link>
					<button type="button" onClick={load} className="aw-btn aw-btn-outline">
						<RefreshCw size={16} /> Làm mới
					</button>
					<Link to="/scenarios/new" className="aw-btn aw-btn-primary">
						<Plus size={16} /> Tạo kịch bản
					</Link>
				</div>
			</div>

			<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-overflow-hidden">
				<div className="aw-px-4 aw-py-3 aw-border-b aw-border-slate-200">
					<h2 className="aw-text-sm aw-font-semibold">
						Tất cả kịch bản ({rows.length})
						{loading && <Loader2 size={12} className="aw-animate-spin aw-inline aw-ml-2" />}
					</h2>
				</div>
				{error && (
					<div className="aw-px-4 aw-py-3 aw-text-sm aw-text-red-700 aw-bg-red-50 aw-border-b aw-border-red-200">
						⚠ {error}
					</div>
				)}
				<div className="aw-overflow-x-auto">
					<table className="aw-w-full aw-text-sm">
						<thead className="aw-bg-slate-50 aw-text-left aw-text-xs aw-uppercase aw-text-slate-500">
							<tr>
								<th className="aw-px-4 aw-py-2">Tên</th>
								<th className="aw-px-4 aw-py-2">Kênh</th>
								<th className="aw-px-4 aw-py-2">Từ khoá</th>
								<th className="aw-px-4 aw-py-2">Số bước</th>
								<th className="aw-px-4 aw-py-2">Trạng thái</th>
								<th className="aw-px-4 aw-py-2 aw-text-right">Hành động</th>
							</tr>
						</thead>
						<tbody>
							{!loading && rows.length === 0 && !error && (
								<tr>
									<td colSpan={6} className="aw-px-4 aw-py-6 aw-text-center aw-text-slate-500">
										Chưa có kịch bản nào. Bấm "Tạo kịch bản" để bắt đầu.
									</td>
								</tr>
							)}
							{rows.map((wf) => {
								const sum = summariseRow(wf);
								const op  = busy[wf.id];
								return (
									<tr key={wf.id} className="aw-border-t aw-border-slate-100 hover:aw-bg-slate-50">
										<td className="aw-px-4 aw-py-3">
											<Link to={`/scenarios/${wf.id}`} className="aw-font-medium aw-text-blue-700 hover:aw-underline">
												{wf.name || `Kịch bản #${wf.id}`}
											</Link>
											<span className="aw-text-slate-400 aw-text-xs aw-ml-2">#{wf.id}</span>
											{!sum.linear && (
												<span className="aw-ml-2 aw-text-[11px] aw-text-amber-700 aw-bg-amber-50 aw-border aw-border-amber-200 aw-rounded aw-px-1.5">
													Không tuyến tính — mở canvas
												</span>
											)}
										</td>
										<td className="aw-px-4 aw-py-3 aw-text-slate-600">{sum.triggerLabel}</td>
										<td className="aw-px-4 aw-py-3">
											{sum.keywords.length === 0
												? <span className="aw-text-slate-400 aw-text-xs">(mọi tin nhắn)</span>
												: (
													<div className="aw-flex aw-flex-wrap aw-gap-1">
														{sum.keywords.slice(0, 3).map((k, i) => (
															<span key={i} className="aw-inline-block aw-px-1.5 aw-py-0.5 aw-rounded aw-text-[11px] aw-bg-emerald-50 aw-text-emerald-800 aw-border aw-border-emerald-200">{k}</span>
														))}
														{sum.keywords.length > 3 && <span className="aw-text-xs aw-text-slate-500">+{sum.keywords.length - 3}</span>}
													</div>
												)}
										</td>
										<td className="aw-px-4 aw-py-3 aw-text-slate-600">{sum.steps}</td>
										<td className="aw-px-4 aw-py-3">
											{wf.enabled
												? <span className="aw-inline-flex aw-items-center aw-gap-1 aw-px-2 aw-py-0.5 aw-rounded aw-border aw-text-xs aw-bg-green-50 aw-text-green-700 aw-border-green-200"><Play size={12} /> Đang chạy</span>
												: <span className="aw-inline-flex aw-items-center aw-gap-1 aw-px-2 aw-py-0.5 aw-rounded aw-border aw-text-xs aw-bg-slate-50 aw-text-slate-700 aw-border-slate-200"><Pause size={12} /> Tạm dừng</span>}
										</td>
										<td className="aw-px-4 aw-py-3 aw-text-right">
											<div className="aw-inline-flex aw-items-center aw-gap-1">
												<button
													type="button"
													onClick={() => onToggle(wf)}
													disabled={!!op}
													className="aw-btn aw-btn-outline aw-btn-sm"
													title={wf.enabled ? 'Tạm dừng' : 'Kích hoạt'}
												>
													{op === 'toggle' ? <Loader2 size={14} className="aw-animate-spin" /> : (wf.enabled ? <Pause size={14} /> : <Play size={14} />)}
												</button>
												<button
													type="button"
													onClick={() => onDuplicate(wf)}
													disabled={!!op}
													className="aw-btn aw-btn-outline aw-btn-sm"
													title="Nhân bản"
												>
													{op === 'dup' ? <Loader2 size={14} className="aw-animate-spin" /> : <Copy size={14} />}
												</button>
												{!sum.linear && (
													<button
														type="button"
														onClick={() => navigate(`/builder/${wf.id}`)}
														className="aw-btn aw-btn-outline aw-btn-sm"
														title="Mở canvas advanced"
													>
														<Workflow size={14} />
													</button>
												)}
												<button
													type="button"
													onClick={() => onDelete(wf)}
													disabled={!!op}
													className="aw-btn aw-btn-outline aw-btn-sm aw-text-red-700"
													title="Xoá"
												>
													{op === 'delete' ? <Loader2 size={14} className="aw-animate-spin" /> : <Trash2 size={14} />}
												</button>
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
