/**
 * ScenarioEditorRoute — linear editor cho kịch bản (Bot-Bán-Hàng style layout).
 *
 * Layout reference: bebo.dinogpt.vn / Bot Bán Hàng "Chi tiết kịch bản".
 *  · Header: Lưu lại / Lưu lại và thoát / Xoá / Thoát
 *  · Row 1 : QR (left) + InfoPanel (right)
 *  · Row 2 : Tên / Mô tả / Tags
 *  · Row 3 : Trigger picker (kênh + instance + keywords)
 *  · Row 4 : Danh sách hành động (Bắt đầu → steps) + QuickAddToolbar (icon row)
 *
 * @since 2026-06-01 (initial UI, refactor 2026-06-01 to Bot-Bán-Hàng parity)
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
	Save, Loader2, Workflow, Eye, Trash2, X, LogOut, ListChecks,
	ChevronRight, AlertTriangle,
} from 'lucide-react';
import { workflowsApi, BizCityApiError } from '../../lib/api.js';
import {
	emptyLinear, newStep,
	compileLinearToWorkflow, decompileWorkflowToLinear,
} from './lib/compileLinear.js';
import { ensureScenarioUuid, buildScenarioLink, qrImageUrl } from './lib/scenarioLinks.js';
import TriggerPicker from './components/TriggerPicker.jsx';
import StepCard from './components/StepCard.jsx';
import StepPalette from './components/StepPalette.jsx';
import QuickAddToolbar from './components/QuickAddToolbar.jsx';
import QRPanel from './components/QRPanel.jsx';
import ScenarioInfoPanel from './components/ScenarioInfoPanel.jsx';

function pickMsg(e, fallback = 'Lỗi') {
	return e instanceof BizCityApiError
		? `[${e.code || e.status}] ${e.message}`
		: (e?.message || fallback);
}

export default function ScenarioEditorRoute() {
	const { id }   = useParams();
	const navigate = useNavigate();
	const isNew    = !id || id === 'new';

	const [linear, setLinear]   = useState(() => ensureScenarioUuid(emptyLinear()));
	const [loading, setLoading] = useState(!isNew);
	const [saving, setSaving]   = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [error, setError]     = useState('');
	const [warning, setWarning] = useState('');
	const [showJson, setShowJson] = useState(false);
	const [showMorePalette, setShowMorePalette] = useState(false);
	const [adImage, setAdImage] = useState(null); // { image_url, preset, ratio, model }
	const [adError, setAdError] = useState('');

	useEffect(() => {
		if (isNew) return;
		(async () => {
			setLoading(true);
			setError('');
			try {
				const res = await workflowsApi.get(id);
				const row = res?.row || res?.data || res;
				const dec = decompileWorkflowToLinear(row);
				if (!dec) {
					setWarning('Workflow này không phải dạng tuyến tính. Mở canvas advanced để chỉnh sửa.');
					setLinear(ensureScenarioUuid({
						meta: {
							id: row.id, name: row.name || '', desc: row.description || '',
							enabled: !!row.enabled, tags: row.tags_array || [],
						},
						trigger: {
							key: 'fb_message', instance_id: '', page_id: '', keywords: [],
							scenario_uuid: row.trigger_config?.scenario_uuid || '',
						},
						steps: [],
					}));
				} else {
					setLinear(ensureScenarioUuid(dec));
				}
			} catch (e) {
				setError(pickMsg(e, 'Không tải được kịch bản'));
			} finally {
				setLoading(false);
			}
		})();
	}, [id, isNew]);

	const compiled = useMemo(() => compileLinearToWorkflow(linear), [linear]);

	/* ─── Mutation helpers ──────────────────────────────────────── */
	const setMeta    = (patch) => setLinear((s) => ({ ...s, meta: { ...s.meta, ...patch } }));
	const setTrigger = (next)  => setLinear((s) => ({ ...s, trigger: { ...next, scenario_uuid: s.trigger.scenario_uuid } }));

	const addStep = (typeKey) => {
		const st = newStep(typeKey);
		if (!st) return;
		setLinear((s) => ({ ...s, steps: [...s.steps, st] }));
		setShowMorePalette(false);
	};
	const updateStep = (idx, next) => setLinear((s) => {
		const steps = s.steps.slice(); steps[idx] = next; return { ...s, steps };
	});
	const removeStep = (idx) => setLinear((s) => {
		const steps = s.steps.slice(); steps.splice(idx, 1); return { ...s, steps };
	});
	const moveStep = (from, to) => setLinear((s) => {
		if (to < 0 || to >= s.steps.length) return s;
		const steps = s.steps.slice();
		const [item] = steps.splice(from, 1);
		steps.splice(to, 0, item);
		return { ...s, steps };
	});

	/* ─── Save / Delete / AI ────────────────────────────────────── */
	const doSave = async () => {
		if (!linear.meta?.name?.trim()) {
			setError('Vui lòng nhập tên kịch bản.');
			return null;
		}
		setSaving(true);
		setError('');
		try {
			const payload = compiled;
			let res;
			if (isNew) {
				res = await workflowsApi.create(payload);
				const row = res?.row || res?.data || res;
				if (row?.id) {
					navigate(`/scenarios/${row.id}`, { replace: true });
				}
				return row;
			}
			res = await workflowsApi.update(id, payload);
			return res?.row || res?.data || res;
		} catch (e) {
			setError(pickMsg(e, 'Lưu thất bại'));
			return null;
		} finally {
			setSaving(false);
		}
	};

	const onSave         = () => doSave();
	const onSaveAndExit  = async () => {
		const ok = await doSave();
		if (ok) navigate('/scenarios');
	};
	const onExit         = () => navigate('/scenarios');
	const onDelete       = async () => {
		if (isNew) { onExit(); return; }
		if (!window.confirm(`Xoá kịch bản "${linear.meta?.name}"?`)) return;
		setDeleting(true);
		try {
			await workflowsApi.del(id);
			navigate('/scenarios', { replace: true });
		} catch (e) {
			setError(pickMsg(e, 'Xoá thất bại'));
		} finally {
			setDeleting(false);
		}
	};

	const onGenerateAdImage = async (preset) => {
		setAdError('');
		setAdImage(null);
		let wfId = id;
		if (isNew) {
			const saved = await doSave();
			if (!saved?.id) {
				setAdError('Vui lòng lưu kịch bản trước khi tạo ảnh.');
				return;
			}
			wfId = saved.id;
		}
		const link = buildScenarioLink(linear);
		if (!link) {
			setAdError('Cần chọn kênh + Instance ID để có QR. Lưu kịch bản trước.');
			return;
		}
		const qr_url = qrImageUrl(link, 720);
		try {
			const res = await workflowsApi.generateAdImage(wfId, {
				preset: preset.key,
				qr_url,
				scenario_name: linear?.meta?.name || '',
			});
			if (res?.ok) {
				setAdImage({
					image_url: res.image_url || (res.b64_json ? `data:image/png;base64,${res.b64_json}` : ''),
					preset: res.preset,
					ratio:  res.ratio,
					model:  res.model,
					prompt: res.prompt,
				});
			} else {
				setAdError(res?.message || 'Tạo ảnh thất bại.');
			}
		} catch (e) {
			setAdError(pickMsg(e, 'Tạo ảnh thất bại.'));
		}
	};

	if (loading) {
		return (
			<div className="aw-flex aw-items-center aw-justify-center aw-h-[60vh] aw-text-slate-500">
				<Loader2 size={20} className="aw-animate-spin aw-mr-2" /> Đang tải kịch bản…
			</div>
		);
	}

	const titleSuffix = linear.meta?.name ? `: ${linear.meta.name}` : '';

	return (
		<div className="aw-flex aw-flex-col aw-gap-4 aw-p-4 md:aw-p-6 aw-max-w-[1280px] aw-mx-auto aw-w-full">
			{/* Breadcrumb + header buttons */}
			<div className="aw-flex aw-items-center aw-justify-between aw-flex-wrap aw-gap-2">
				<div className="aw-flex aw-items-center aw-gap-1 aw-text-sm aw-text-slate-600">
					<Link to="/scenarios" className="aw-flex aw-items-center aw-gap-1 hover:aw-text-blue-700">
						<ListChecks size={14} /> Kịch bản
					</Link>
					<ChevronRight size={14} className="aw-text-slate-400" />
					<span className="aw-text-slate-900 aw-font-medium aw-truncate aw-max-w-[400px]">
						{isNew ? 'Tạo kịch bản' : `Chi tiết kịch bản${titleSuffix}`}
					</span>
				</div>
				<div className="aw-flex aw-items-center aw-gap-2">
					<button
						type="button"
						onClick={onSave}
						disabled={saving}
						className="aw-px-3 aw-py-1.5 aw-rounded aw-text-xs aw-font-semibold aw-text-white aw-bg-emerald-500 hover:aw-bg-emerald-600 disabled:aw-opacity-50 aw-flex aw-items-center aw-gap-1"
					>
						{saving ? <Loader2 size={13} className="aw-animate-spin" /> : <Save size={13} />} Lưu lại
					</button>
					<button
						type="button"
						onClick={onSaveAndExit}
						disabled={saving}
						className="aw-px-3 aw-py-1.5 aw-rounded aw-text-xs aw-font-semibold aw-text-white aw-bg-blue-500 hover:aw-bg-blue-600 disabled:aw-opacity-50 aw-flex aw-items-center aw-gap-1"
					>
						<LogOut size={13} /> Lưu lại và thoát
					</button>
					{!isNew && (
						<button
							type="button"
							onClick={onDelete}
							disabled={deleting}
							className="aw-px-3 aw-py-1.5 aw-rounded aw-text-xs aw-font-semibold aw-text-white aw-bg-red-500 hover:aw-bg-red-600 disabled:aw-opacity-50 aw-flex aw-items-center aw-gap-1"
						>
							{deleting ? <Loader2 size={13} className="aw-animate-spin" /> : <Trash2 size={13} />} Xoá
						</button>
					)}
					<button
						type="button"
						onClick={onExit}
						className="aw-px-3 aw-py-1.5 aw-rounded aw-text-xs aw-font-semibold aw-text-white aw-bg-orange-500 hover:aw-bg-orange-600 aw-flex aw-items-center aw-gap-1"
					>
						<X size={13} /> Thoát
					</button>
				</div>
			</div>

			{/* Inline title (matches screenshot "Kịch bản: <tên>") */}
			<div className="aw-flex aw-items-baseline aw-gap-2 aw-flex-wrap">
				<span className="aw-text-sm aw-text-slate-500">Kịch bản:</span>
				<span className="aw-text-base aw-font-semibold aw-text-slate-900">
					{linear.meta?.name || <em className="aw-text-slate-400 aw-font-normal">(chưa đặt tên)</em>}
				</span>
				{!isNew && (
					<Link to={`/builder/${id}`} className="aw-ml-2 aw-text-xs aw-text-blue-600 hover:aw-underline aw-flex aw-items-center aw-gap-1">
						<Workflow size={12} /> Mở canvas advanced
					</Link>
				)}
				<button
					type="button"
					onClick={() => setShowJson((v) => !v)}
					className="aw-ml-auto aw-text-xs aw-text-slate-500 hover:aw-text-slate-900 aw-flex aw-items-center aw-gap-1"
				>
					<Eye size={12} /> {showJson ? 'Ẩn' : 'Xem'} payload
				</button>
			</div>

			{error && (
				<div className="aw-text-sm aw-text-red-700 aw-bg-red-50 aw-border aw-border-red-200 aw-rounded aw-px-3 aw-py-2">
					⚠ {error}
				</div>
			)}
			{warning && (
				<div className="aw-text-sm aw-text-amber-800 aw-bg-amber-50 aw-border aw-border-amber-200 aw-rounded aw-px-3 aw-py-2 aw-flex aw-items-center aw-gap-2">
					<AlertTriangle size={14} /> {warning}
				</div>
			)}

			{/* ROW 1 — QR + Info Panel (layout giống screenshot) */}
			<div className="aw-grid aw-grid-cols-1 lg:aw-grid-cols-[320px_1fr] aw-gap-4">
				<QRPanel linear={linear} onGenerateAdImage={onGenerateAdImage} adImage={adImage} adError={adError} />
				<ScenarioInfoPanel linear={linear} />
			</div>

			{/* ROW 2 — Meta */}
			<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-p-4 aw-shadow-sm">
				<div className="aw-grid aw-grid-cols-1 md:aw-grid-cols-[1fr_180px] aw-gap-3">
					<label className="aw-text-xs aw-text-slate-700">
						Tên kịch bản<span className="aw-text-red-500">*</span>
						<input
							value={linear.meta?.name || ''}
							onChange={(e) => setMeta({ name: e.target.value })}
							className="aw-mt-1 aw-block aw-w-full aw-px-2 aw-py-1.5 aw-text-sm aw-border aw-border-slate-300 aw-rounded"
							placeholder="Ví dụ: Kiểm tra cân nặng Phương Nam"
						/>
					</label>
					<div className="aw-text-xs aw-text-slate-700">
						Trạng thái
						<div className="aw-mt-1 aw-flex aw-items-center aw-gap-2 aw-h-[34px]">
							<input
								type="checkbox"
								checked={!!linear.meta?.enabled}
								onChange={(e) => setMeta({ enabled: e.target.checked })}
								id="scenario-enabled"
							/>
							<label htmlFor="scenario-enabled" className="aw-text-sm aw-text-slate-700">
								{linear.meta?.enabled ? 'Đang chạy' : 'Tạm dừng'}
							</label>
						</div>
					</div>
				</div>
				<label className="aw-text-xs aw-text-slate-700 aw-block aw-mt-3">
					Mô tả về kịch bản
					<textarea
						rows={2}
						value={linear.meta?.desc || ''}
						onChange={(e) => setMeta({ desc: e.target.value })}
						className="aw-mt-1 aw-block aw-w-full aw-px-2 aw-py-1.5 aw-text-xs aw-border aw-border-slate-300 aw-rounded"
						placeholder="Nhập vào mô tả về kịch bản này…"
					/>
				</label>
				<div className="aw-mt-3 aw-text-xs aw-text-slate-700">
					Danh sách thẻ nhóm
					<div className="aw-mt-1 aw-flex aw-flex-wrap aw-gap-1.5">
						{(linear.meta?.tags || []).filter((t) => t !== 'scenario').map((t, i) => (
							<span key={`${t}_${i}`} className="aw-inline-block aw-px-2 aw-py-0.5 aw-rounded aw-text-[11px] aw-bg-slate-100 aw-text-slate-700 aw-border aw-border-slate-200">
								{t}
							</span>
						))}
						<span className="aw-text-[11px] aw-text-slate-400">
							(thẻ <code>scenario</code> tự động thêm để Backend phân loại)
						</span>
					</div>
				</div>
			</div>

			{/* ROW 3 — Trigger */}
			<TriggerPicker value={linear.trigger} onChange={setTrigger} />

			{/* ROW 4 — Action list */}
			<div className="aw-flex aw-flex-col aw-gap-2">
				<div className="aw-flex aw-items-center aw-justify-between">
					<h3 className="aw-text-sm aw-font-semibold aw-text-slate-900">
						Danh sách các hành động<span className="aw-text-red-500">*</span> ({linear.steps.length})
					</h3>
					<span className="aw-text-xs aw-text-slate-500">Các bước chạy lần lượt từ trên xuống.</span>
				</div>

				{/* "Bắt đầu" header (matches Bot-Bán-Hàng row "Bắt đầu") */}
				<div className="aw-bg-slate-100 aw-border aw-border-slate-200 aw-rounded aw-px-3 aw-py-2 aw-text-xs aw-font-semibold aw-text-slate-600">
					Bắt đầu
				</div>

				{linear.steps.map((step, idx) => (
					<StepCard
						key={step.id}
						index={idx}
						total={linear.steps.length}
						step={step}
						onChange={(next) => updateStep(idx, next)}
						onRemove={() => removeStep(idx)}
						onMoveUp={() => moveStep(idx, idx - 1)}
						onMoveDown={() => moveStep(idx, idx + 1)}
					/>
				))}

				{/* Bottom quick-add toolbar (icon row) */}
				<div className="aw-mt-1">
					<QuickAddToolbar
						onPick={addStep}
						onMore={() => setShowMorePalette((v) => !v)}
					/>
				</div>
				{showMorePalette && (
					<StepPalette onPick={addStep} />
				)}
			</div>

			{showJson && (
				<details open className="aw-bg-slate-900 aw-text-slate-100 aw-rounded aw-p-3 aw-text-xs aw-font-mono">
					<summary className="aw-cursor-pointer aw-text-slate-300">Compiled workflow payload (preview)</summary>
					<pre className="aw-mt-2 aw-overflow-auto">{JSON.stringify(compiled, null, 2)}</pre>
				</details>
			)}
		</div>
	);
}
