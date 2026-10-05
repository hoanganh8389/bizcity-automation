import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, Code2, FileJson, Loader2, ShieldAlert, Sparkles, X, Zap } from 'lucide-react';
import { hilApi, BizCityApiError } from '../lib/api.js';

const inputStyle = {
	display: 'block', width: '100%', boxSizing: 'border-box', padding: '8px 10px',
	border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, fontFamily: 'inherit',
};

const HIL_PRESETS = [
	{
		id: 'order_create',
		title: 'Tạo đơn hàng',
		description: 'Chặn side-effect tạo đơn nếu còn thiếu thông tin đầu vào bắt buộc.',
		intentId: 'commerce.order_execute',
		domain: 'commerce',
		sideEffectLevel: 'explicit_confirmation',
		requiredInputs: [
			'Tên sản phẩm',
			'Giá hoặc mức thanh toán',
			'Số điện thoại người nhận',
			'Địa chỉ giao hàng',
			'Phương thức thanh toán',
		],
		promptTemplate: [
			'Bạn là HIL guard cho workflow tạo đơn hàng.',
			'Mục tiêu: chỉ cho phép chạy action.create_woo_order khi đã thu thập đủ schema đầu vào.',
			'Bắt buộc phải thu đủ các trường: tên sản phẩm, giá, số điện thoại người nhận, địa chỉ giao hàng, phương thức thanh toán.',
			'Nếu còn thiếu bất kỳ trường nào thì hỏi tiếp theo từng bước, không cho chạy side-effect.',
			'Trước khi thực thi phải tóm tắt lại toàn bộ thông tin và yêu cầu xác nhận cuối: "Xác nhận tạo đơn hay hủy?".',
		].join('\n'),
	},
	{
		id: 'fb_publish',
		title: 'Đăng Facebook',
		description: 'Dùng cho flow post FB khi thường thiếu chủ đề hoặc thiếu ảnh.',
		intentId: 'content.publish_execute',
		domain: 'content',
		sideEffectLevel: 'explicit_confirmation',
		requiredInputs: [
			'Chủ đề bài đăng',
			'Ảnh đính kèm hoặc xác nhận đăng text-only',
			'Caption cuối cùng',
		],
		promptTemplate: [
			'Bạn là HIL guard cho workflow đăng Facebook.',
			'Mục tiêu: đảm bảo đủ thông tin trước khi publish.',
			'Bắt buộc thu các trường: chủ đề bài đăng, ảnh đính kèm (hoặc xác nhận rõ text-only), caption dự kiến.',
			'Nếu thiếu chủ đề hoặc thiếu ảnh thì phải hỏi bổ sung.',
			'Trước khi đăng cần hiển thị bản tóm tắt và yêu cầu xác nhận cuối.',
		].join('\n'),
	},
	{
		id: 'image_generate',
		title: 'Tạo ảnh mới',
		description: 'Dùng cho flow generate image khi thiếu topic/yêu cầu đầu ra.',
		intentId: 'media.image_execute',
		domain: 'media',
		sideEffectLevel: 'soft_confirmation',
		requiredInputs: [
			'Topic/chủ đề ảnh',
			'Phong cách hoặc mục đích sử dụng',
			'Kích thước/tỉ lệ mong muốn (nếu có)',
		],
		promptTemplate: [
			'Bạn là HIL guard cho workflow tạo ảnh.',
			'Mục tiêu: không gọi action.generate_image khi chưa rõ chủ đề.',
			'Bắt buộc phải thu topic/chủ đề ảnh. Khuyến nghị thu thêm phong cách và tỉ lệ ảnh.',
			'Nếu thiếu topic thì tiếp tục hỏi cho đến khi có dữ liệu hợp lệ.',
			'Trước khi tạo ảnh cần xác nhận lại brief cuối cùng với người dùng.',
		].join('\n'),
	},
	{
		id: 'image_edit',
		title: 'Sửa ảnh',
		description: 'Dùng cho flow edit image khi thiếu ảnh gốc hoặc thiếu mô tả chỉnh sửa.',
		intentId: 'media.image_execute',
		domain: 'media',
		sideEffectLevel: 'explicit_confirmation',
		requiredInputs: [
			'Ảnh gốc đầu vào (source image)',
			'Mô tả chỉnh sửa mong muốn',
			'Ràng buộc đầu ra (nếu có)',
		],
		promptTemplate: [
			'Bạn là HIL guard cho workflow sửa ảnh.',
			'Mục tiêu: chỉ chạy action.edit_image khi có đủ ảnh gốc và yêu cầu chỉnh sửa.',
			'Bắt buộc thu: ảnh gốc đầu vào, mô tả chỉnh sửa cần thực hiện.',
			'Nếu không có ảnh gốc thì phải chặn side-effect và yêu cầu gửi ảnh trước.',
			'Trước khi sửa ảnh cần tóm tắt tác vụ và xác nhận cuối.',
		].join('\n'),
	},
];

function inferPresetIdFromNodes(nodes = []) {
	const actionIds = new Set(
		(nodes || []).map((node) => String(node?.data?.blockId || '').trim()).filter(Boolean)
	);
	if (actionIds.has('action.create_woo_order')) return 'order_create';
	if (actionIds.has('action.edit_image')) return 'image_edit';
	if (actionIds.has('action.generate_image')) return 'image_generate';
	if (actionIds.has('action.publish_fb_post')) return 'fb_publish';
	return '';
}

export default function HilCompilerDialog({ open, onClose, onApply, meta, nodes }) {
	const triggerNode = useMemo(() => nodes.find((node) => node.type === 'trigger'), [nodes]);
	const defaultTrigger = triggerNode?.data?.blockId || meta?.slug || `workflow_${meta?.id || 'new'}`;
	const defaultPrompt = String(triggerNode?.data?.hil_prompt || meta?.triggerConfig?.hil_prompt || '');
	const inferredPresetId = useMemo(() => inferPresetIdFromNodes(nodes), [nodes]);
	const [triggerId, setTriggerId] = useState(defaultTrigger);
	const [prompt, setPrompt] = useState(defaultPrompt);
	const [presetId, setPresetId] = useState(inferredPresetId);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [result, setResult] = useState(null);
	const [copyStatus, setCopyStatus] = useState('');
	const activePreset = useMemo(
		() => HIL_PRESETS.find((item) => item.id === presetId) || null,
		[presetId]
	);

	useEffect(() => {
		if (!open) return;
		setTriggerId(defaultTrigger);
		setPrompt(defaultPrompt);
		setPresetId(inferredPresetId);
		setError(null);
	}, [open, defaultTrigger, defaultPrompt, inferredPresetId]);

	if (!open) return null;

	const compile = async (event) => {
		event.preventDefault();
		setLoading(true);
		setError(null);
		setResult(null);
		try {
			const compileIntent = activePreset?.intentId || 'automation.task_execute';
			const compileDomain = activePreset?.domain || 'automation';
			const compileSideEffect = activePreset?.sideEffectLevel || 'explicit_confirmation';
			const data = await hilApi.compile(triggerId.trim(), prompt.trim(), {
				workflow_id: meta?.id || '',
				intent_id: compileIntent,
				domain: compileDomain,
				side_effect_level: compileSideEffect,
			});
			setResult(data);
		} catch (requestError) {
			setError({
				code: requestError instanceof BizCityApiError ? requestError.code : 'hil_compile_failed',
				message: requestError?.message || 'Không biên dịch được HIL spec.',
			});
		} finally {
			setLoading(false);
		}
	};

	const spec = result?.spec || result?.validation?.spec;
	const validation = result?.validation;
	const errors = validation?.errors || [];
	const warnings = validation?.warnings || [];
	const applySpec = () => {
		if (!result?.ok || !spec) return;
		onApply?.({
			spec,
			prompt: prompt.trim(),
			triggerId: triggerId.trim(),
		});
		onClose();
	};

	// [2026-08-16 Johnny Chu] PHASE-2-HIL-DIALOG-BUTTON — copy compiled spec for trace/audit without needing to apply first.
	const copySpecJson = async () => {
		if (!spec) return;
		try {
			await navigator.clipboard.writeText(JSON.stringify(spec, null, 2));
			setCopyStatus('✓ Copied');
		} catch (e) {
			setCopyStatus('✗ Lỗi copy');
		} finally {
			setTimeout(() => setCopyStatus(''), 1500);
		}
	};

	return (
		<div onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} style={{
			position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(15,23,42,.5)',
			display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
		}}>
			<div style={{ width: 'min(860px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 10, boxShadow: '0 24px 64px rgba(15,23,42,.28)', overflow: 'hidden' }}>
				<header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
					<Zap size={18} style={{ color: '#d97706' }} />
					<div style={{ flex: 1 }}>
						<strong style={{ display: 'block', fontSize: 15 }}>HIL Spec Compiler</strong>
						<span style={{ color: '#64748b', fontSize: 12 }}>Compile trước, review trước, chưa lưu vào workflow</span>
					</div>
					<button type="button" onClick={onClose} className="aw-icon-btn" aria-label="Đóng"><X size={16} /></button>
				</header>
				<div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 16 }}>
					<form onSubmit={compile} style={{ display: 'grid', gap: 12 }}>
						<div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, background: '#f8fafc' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#334155' }}>
								<Sparkles size={14} />
								Mẫu HIL theo kịch bản
							</div>
							<div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
								{HIL_PRESETS.map((preset) => {
									const active = preset.id === presetId;
									return (
										<button
											key={preset.id}
											type="button"
											onClick={() => setPresetId(preset.id)}
											style={{
												fontSize: 12,
												padding: '5px 9px',
												borderRadius: 999,
												cursor: 'pointer',
												border: `1px solid ${active ? '#1d4ed8' : '#cbd5e1'}`,
												background: active ? '#dbeafe' : '#fff',
												color: active ? '#1e3a8a' : '#475569',
											}}
										>
											{preset.title}
										</button>
									);
								})}
							</div>
							{activePreset && (
								<div style={{ marginTop: 8 }}>
									<div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>{activePreset.description}</div>
									<div style={{ fontSize: 12, color: '#0f172a', marginBottom: 6 }}>
										<strong>Prompt HIL cần thu đủ:</strong>
									</div>
									<ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 12 }}>
										{activePreset.requiredInputs.map((item) => <li key={item}>{item}</li>)}
									</ul>
									<div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
										<button
											type="button"
											onClick={() => setPrompt(activePreset.promptTemplate)}
											className="aw-btn aw-btn-outline"
										>
											<Sparkles size={14} /> Dùng prompt mẫu
										</button>
									</div>
								</div>
							)}
						</div>
						<label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
							Trigger ID
							<input value={triggerId} onChange={(event) => setTriggerId(event.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
						</label>
						<label style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
							Mô tả HIL
							<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={5} placeholder="Ví dụ: Khi tạo đơn hàng, hỏi tên, số điện thoại, sản phẩm và địa chỉ; xác nhận lại trước khi gửi đơn." style={{ ...inputStyle, marginTop: 5, resize: 'vertical' }} />
						</label>
						<div style={{ display: 'flex', justifyContent: 'flex-end' }}>
							<button type="submit" disabled={loading || !triggerId.trim() || !prompt.trim()} className="aw-btn aw-btn-primary">
								{loading ? <><Loader2 size={14} className="aw-animate-spin" /> Đang compile…</> : <><Zap size={14} /> Compile HIL</>}
							</button>
						</div>
					</form>

					{error && <div style={{ marginTop: 14, padding: 10, borderRadius: 6, border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', fontSize: 12 }}><ShieldAlert size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error.code}: {error.message}</div>}

					{result && (
						<section style={{ marginTop: 16, border: `1px solid ${result.ok ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, overflow: 'hidden' }}>
							<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: result.ok ? '#f0fdf4' : '#fef2f2', color: result.ok ? '#166534' : '#b91c1c' }}>
								{result.ok ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
								<strong>{result.ok ? 'HIL spec hợp lệ' : 'HIL spec chưa hợp lệ'}</strong>
								<span style={{ marginLeft: 'auto', fontSize: 11 }}>{result.code}</span>
							</div>
							{errors.length > 0 && <div style={{ padding: '10px 12px', color: '#b91c1c', fontSize: 12 }}>Lỗi: {errors.join(', ')}</div>}
							{warnings.length > 0 && <div style={{ padding: '0 12px 10px', color: '#a16207', fontSize: 12 }}>Cảnh báo: {warnings.join(', ')}</div>}
							{spec && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, .8fr) minmax(0, 1.2fr)', gap: 12, padding: 12, borderTop: '1px solid #e2e8f0' }}>
								<div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700 }}><Code2 size={14} /> Slots ({spec.slots?.length || 0})</div>
									<div style={{ display: 'grid', gap: 6 }}>
										{(spec.slots || []).map((slot) => <div key={slot.id} style={{ padding: '7px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}><strong>{slot.label || slot.id}</strong><span style={{ color: '#64748b' }}> · {slot.type}{slot.required ? ' · required' : ''}</span></div>)}
									</div>
								</div>
								<div>
									<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 700 }}>
										<FileJson size={14} /> JSON contract
										<button
											type="button"
											onClick={copySpecJson}
											className="aw-btn aw-btn-outline"
											style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11 }}
											title="Copy JSON spec để trace/audit"
										>
											<ClipboardCopy size={12} /> {copyStatus || 'Copy'}
										</button>
									</div>
									<pre style={{ maxHeight: 300, overflow: 'auto', margin: 0, padding: 10, borderRadius: 6, background: '#0f172a', color: '#dbeafe', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{JSON.stringify(spec, null, 2)}</pre>
								</div>
							</div>}
						</section>
					)}
				</div>
				<footer style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
					<button type="button" onClick={onClose} className="aw-btn aw-btn-outline">Đóng</button>
					{result?.ok && spec && <button type="button" onClick={applySpec} className="aw-btn aw-btn-primary"><CheckCircle2 size={14} /> Áp dụng vào trigger</button>}
				</footer>
			</div>
		</div>
	);
}
