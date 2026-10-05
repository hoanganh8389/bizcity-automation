// [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder dialog: prompt → workflow graph
import { useCallback, useState } from 'react';
import { Sparkles, Loader2, AlertTriangle, CheckCircle2, X, ChevronRight } from 'lucide-react';
import { workflowsApi } from '../lib/api.js';

/** Node type badge colours (same palette as NodeShell). */
const TYPE_COLORS = {
	trigger:   { bg: '#eef2ff', text: '#4338ca', border: '#c7d2fe' },
	action:    { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
	llm:       { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
	output:    { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
	condition: { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
};

function NodePreviewCard({ node }) {
	const col = TYPE_COLORS[node.type] || TYPE_COLORS.action;
	return (
		<div style={{
			display: 'flex', alignItems: 'center', gap: 10,
			padding: '8px 12px', borderRadius: 8,
			border: `1px solid ${col.border}`,
			background: col.bg,
		}}>
			<span style={{
				fontSize: 10, fontWeight: 700, color: col.text, textTransform: 'uppercase',
				background: col.border, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
			}}>
				{node.type}
			</span>
			<span style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{node.data?.label || node.id}
			</span>
			<span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
				{node.data?.blockId || '—'}
			</span>
		</div>
	);
}

/**
 * AiBuilderDialog — floating dialog for AI workflow generation.
 *
 * Props:
 *   open        {boolean}
 *   onClose     {() => void}
 *   onApply     {({name, nodes, edges}) => void}
 *
 * [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — POST /bizcity-automation/v1/ai-build
 */
export default function AiBuilderDialog({ open, onClose, onApply }) {
	const [prompt, setPrompt]   = useState('');
	const [loading, setLoading] = useState(false);
	const [result, setResult]   = useState(null);  // { name, nodes, edges, model }
	const [error, setError]     = useState('');

	const handleGenerate = useCallback(async (e) => {
		e.preventDefault();
		const p = prompt.trim();
		if (!p) { return; }
		setLoading(true);
		setError('');
		setResult(null);
		try {
			const data = await workflowsApi.aiBuild(p);
			if (!data?.ok) {
				setError(data?.message || 'AI không tạo được workflow. Hãy thử lại.');
			} else {
				setResult(data);
			}
		} catch (err) {
			setError(err?.message || 'Lỗi kết nối.');
		} finally {
			setLoading(false);
		}
	}, [prompt]);

	const handleApply = useCallback(() => {
		if (!result) { return; }
		onApply({ name: result.name, nodes: result.nodes, edges: result.edges });
		setResult(null);
		setPrompt('');
		onClose();
	}, [result, onApply, onClose]);

	const handleClose = useCallback(() => {
		if (loading) { return; }
		setResult(null);
		setError('');
		onClose();
	}, [loading, onClose]);

	if (!open) { return null; }

	return (
		/* Backdrop */
		<div
			style={{
				position: 'fixed', inset: 0, zIndex: 9999,
				background: 'rgba(15,23,42,0.55)',
				display: 'flex', alignItems: 'center', justifyContent: 'center',
				padding: 16,
			}}
			onClick={(e) => { if (e.target === e.currentTarget) { handleClose(); } }}
		>
			{/* Dialog */}
			<div style={{
				background: '#fff', borderRadius: 16, boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
				width: '100%', maxWidth: 640,
				display: 'flex', flexDirection: 'column', gap: 0,
				overflow: 'hidden',
			}}>
				{/* Header */}
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
					background: 'linear-gradient(135deg,#eef2ff 0%,#f0fdf4 100%)',
				}}>
					<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
						<Sparkles size={20} style={{ color: '#7c3aed' }} />
						<div>
							<div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b' }}>AI Workflow Builder</div>
							<div style={{ fontSize: 12, color: '#64748b' }}>Mô tả bằng tiếng Việt — AI tự tạo workflow</div>
						</div>
					</div>
					<button type="button" onClick={handleClose} disabled={loading}
						style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}>
						<X size={18} />
					</button>
				</div>

				{/* Body */}
				<div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
					{/* Prompt input */}
					<form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
						<label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
							Mô tả workflow bạn muốn tạo
						</label>
						<textarea
							value={prompt}
							onChange={(e) => setPrompt(e.target.value)}
							disabled={loading}
							rows={4}
							placeholder={'Ví dụ: Khi khách nhắn Zalo OA → AI phân loại intent → Nếu là đặt hàng thì tạo CRM task + reply xác nhận. Ngược lại reply hỏi thêm.'}
							style={{
								width: '100%', resize: 'vertical', borderRadius: 8,
								border: '1px solid #cbd5e1', padding: '10px 14px',
								fontSize: 13, fontFamily: 'inherit',
								outline: 'none', transition: 'border-color .15s',
								background: loading ? '#f8fafc' : '#fff',
								boxSizing: 'border-box',
							}}
							onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; }}
							onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; }}
						/>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
							<span style={{ fontSize: 11, color: '#94a3b8' }}>
								Tip: mô tả trigger → điều kiện → hành động, AI tự phân giải.
							</span>
							<button type="submit" disabled={loading || !prompt.trim()}
								style={{
									display: 'flex', alignItems: 'center', gap: 6,
									padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
									background: (loading || !prompt.trim()) ? '#e2e8f0' : '#7c3aed',
									color: (loading || !prompt.trim()) ? '#94a3b8' : '#fff',
									fontWeight: 600, fontSize: 13, transition: 'background .2s',
								}}
							>
								{loading
									? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Đang tạo…</>
									: <><Sparkles size={14} /> Tạo workflow</>
								}
							</button>
						</div>
					</form>

					{/* Error */}
					{error && (
						<div style={{
							display: 'flex', alignItems: 'flex-start', gap: 8,
							padding: '10px 14px', borderRadius: 8,
							background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626',
						}}>
							<AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
							<span style={{ fontSize: 13 }}>{error}</span>
						</div>
					)}

					{/* Preview result */}
					{result && (
						<div style={{
							border: '1px solid #d1fae5', borderRadius: 10,
							background: '#f0fdf4', overflow: 'hidden',
						}}>
							<div style={{
								display: 'flex', alignItems: 'center', gap: 8,
								padding: '10px 14px', borderBottom: '1px solid #d1fae5',
								background: '#dcfce7',
							}}>
								<CheckCircle2 size={16} style={{ color: '#16a34a' }} />
								<span style={{ fontWeight: 600, fontSize: 13, color: '#15803d' }}>
									"{result.name}"
								</span>
								<span style={{ fontSize: 11, color: '#4ade80', marginLeft: 'auto' }}>
									{result.nodes.length} nodes · {result.edges.length} edges
									{result.model ? ` · ${result.model}` : ''}
								</span>
							</div>
							<div style={{
								padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
								maxHeight: 260, overflowY: 'auto',
							}}>
								{result.nodes.map((n) => (
									<NodePreviewCard key={n.id} node={n} />
								))}
							</div>
						</div>
					)}
				</div>

				{/* Footer */}
				<div style={{
					display: 'flex', justifyContent: 'flex-end', gap: 10,
					padding: '14px 24px', borderTop: '1px solid #f1f5f9',
					background: '#fafafa',
				}}>
					<button type="button" onClick={handleClose} disabled={loading}
						style={{
							padding: '8px 16px', borderRadius: 8,
							border: '1px solid #e2e8f0', background: '#fff',
							fontSize: 13, cursor: 'pointer', color: '#64748b',
						}}>
						Huỷ
					</button>
					<button type="button" onClick={handleApply}
						disabled={!result}
						style={{
							display: 'flex', alignItems: 'center', gap: 6,
							padding: '8px 18px', borderRadius: 8, border: 'none',
							cursor: result ? 'pointer' : 'default',
							background: result ? '#4f46e5' : '#e2e8f0',
							color: result ? '#fff' : '#94a3b8',
							fontWeight: 600, fontSize: 13,
						}}>
						<ChevronRight size={14} /> Áp dụng vào canvas
					</button>
				</div>
			</div>
		</div>
	);
}
