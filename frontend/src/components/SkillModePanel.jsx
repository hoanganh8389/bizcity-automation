import { useState, useEffect, useCallback, useRef } from 'react';
import { Brain, CheckCircle, XCircle, AlertCircle, ExternalLink, RefreshCw, Pencil, Check, X as XIcon } from 'lucide-react';
import { workflowsApi } from '../lib/api.js';
import { useBuilderStore } from '../store/builderStore.js';

/**
 * SkillModePanel — shows Automation Workflow readiness for #slug execution.
 * Shown in Inspector EmptyState (no node selected).
 *
 * Calls GET /workflows/{id}/validate-skill and renders:
 *   - 4 check rows (slug / work node / compose / enabled)
 *   - Issue list if not valid
 *   - Inline slug editor when slug is missing
 *   - "Thử trong Chat" deep-link into twinweb /chat?skill=<slug>
 *
 * [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — Skill Designer panel.
 * [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W6 — Inline slug edit.
 */
export default function SkillModePanel({ workflowId, workflowSlug, workflowEnabled }) {
	const [result, setResult]       = useState(null);
	const [loading, setLoading]     = useState(false);
	const [err, setErr]             = useState('');
	// inline slug edit
	const [editingSlug, setEditingSlug] = useState(false);
	const [slugInput, setSlugInput]     = useState('');
	const [slugSaving, setSlugSaving]   = useState(false);
	const [commandSaving, setCommandSaving] = useState(false);
	const slugRef = useRef(null);

	const updateMeta = useBuilderStore((s) => s.updateMeta);
	const workflowDbId = normalizeWorkflowId(workflowId);

	const validate = useCallback(async () => {
		if (!workflowDbId) {
			setErr('');
			setResult(null);
			return;
		}
		setLoading(true);
		setErr('');
		try {
			const data = await workflowsApi.validateSkill(workflowDbId);
			setResult(data);
		} catch (e) {
			setErr(e?.message || 'Lỗi validate');
			setResult(null);
		} finally {
			setLoading(false);
		}
	}, [workflowDbId]);

	// Auto-validate on mount (and when workflowId changes).
	useEffect(() => { validate(); }, [validate]);

	// Focus slug input when editing opens.
	useEffect(() => {
		if (editingSlug && slugRef.current) {
			slugRef.current.focus();
			slugRef.current.select();
		}
	}, [editingSlug]);

	const openSlugEdit = () => {
		const current = result?.slug || workflowSlug || '';
		setSlugInput(current);
		setEditingSlug(true);
	};

	const saveSlug = async () => {
		const trimmed = slugInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').replace(/__+/g, '_').replace(/^_|_$/g, '');
		if (!trimmed || !workflowDbId) { setEditingSlug(false); return; }
		setSlugSaving(true);
		try {
			await workflowsApi.update(workflowDbId, { slug: trimmed });
			updateMeta({ slug: trimmed });
			setEditingSlug(false);
			validate(); // re-validate to reflect new slug
		} catch (e) {
			alert(e?.message || 'Lỗi lưu slug');
		} finally {
			setSlugSaving(false);
		}
	};

	const cancelSlug = () => setEditingSlug(false);

	// Derive twinweb chat URL from BOOT.siteUrl if available.
	const slug    = result?.slug || workflowSlug || '';
	const chatUrl = slug && typeof BOOT !== 'undefined' && BOOT.siteUrl
		? `${String(BOOT.siteUrl).replace(/\/$/, '')}/?page_id=twin#skill=${encodeURIComponent(slug)}`
		: '';

	const score = result?.score ?? 0;
	const commandInvokable = !!result?.checks?.command_invokable;

	const toggleCommandInvokable = async () => {
		if (!workflowDbId) return;
		setCommandSaving(true);
		try {
			await workflowsApi.setCommandInvokable(workflowDbId, !commandInvokable);
			await validate();
		} catch (e) {
			setErr(e?.message || 'Không thể cập nhật quyền chạy bằng #slug');
		} finally {
			setCommandSaving(false);
		}
	};

	return (
		<div style={{
			marginTop: 12,
			border: '1px solid #e0e7ff',
			borderRadius: 8,
			background: '#f5f3ff',
			padding: '10px 12px',
			fontSize: 12,
		}}>
			{/* ── Header ── */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
				<Brain size={15} color="#7c3aed" />
				<strong style={{ color: '#5b21b6', fontSize: 12 }}>Automation Workflow</strong>
				<span style={{ marginLeft: 'auto', color: '#a78bfa', fontSize: 11 }}>
					{score}/4
				</span>
				<button
					type="button"
					onClick={validate}
					disabled={loading}
					className="aw-icon-btn"
					title="Kiểm tra lại"
					style={{ color: '#7c3aed', marginLeft: 2 }}
				>
					<RefreshCw size={12} className={loading ? 'aw-animate-spin' : ''} />
				</button>
			</div>

			{err && (
				<div style={{ color: '#dc2626', fontSize: 11, marginBottom: 6 }}>⚠ {err}</div>
			)}

			{!workflowDbId && !loading && (
				<div style={{
					color: '#92400e',
					fontSize: 11,
					marginBottom: 6,
					padding: '6px 8px',
					background: '#fef3c7',
					border: '1px solid #fde68a',
					borderRadius: 4,
				}}>
					Lưu workflow trước để cấu hình Automation command.
				</div>
			)}

			{/* ── Check rows ── */}
			{result && (
				<>
					<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '7px 8px', background: '#fff', border: '1px solid #ddd6fe', borderRadius: 5 }}>
						<input type="checkbox" checked={commandInvokable} disabled={commandSaving} onChange={toggleCommandInvokable} />
						<span style={{ color: '#374151', flex: 1 }}>Cho phép chạy bằng <code>#slug</code></span>
						{commandSaving && <RefreshCw size={11} className="aw-animate-spin" color="#7c3aed" />}
					</div>
					{/* Slug row — inline edit when missing */}
					{!result.checks?.has_slug && !editingSlug ? (
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
							<XCircle size={12} color="#dc2626" style={{ flexShrink: 0 }} />
							<span style={{ color: '#6b7280', flex: 1 }}>Chưa đặt slug</span>
							<button type="button" onClick={openSlugEdit} className="aw-icon-btn" title="Đặt slug" style={{ color: '#7c3aed' }}>
								<Pencil size={11} />
							</button>
						</div>
					) : editingSlug ? (
						<div style={{ marginBottom: 6 }}>
							<div style={{ fontSize: 11, color: '#5b21b6', marginBottom: 3 }}>Slug (a-z, 0-9, _-):</div>
							<div style={{ display: 'flex', gap: 4 }}>
								<input
									ref={slugRef}
									type="text"
									value={slugInput}
									onChange={(e) => setSlugInput(e.target.value)}
									onKeyDown={(e) => { if (e.key === 'Enter') saveSlug(); if (e.key === 'Escape') cancelSlug(); }}
									placeholder="vi-du-slug"
									style={{
										flex: 1, fontSize: 11, padding: '3px 6px',
										border: '1px solid #c4b5fd', borderRadius: 4, outline: 'none',
									}}
								/>
								<button type="button" onClick={saveSlug} disabled={slugSaving} className="aw-icon-btn" title="Lưu" style={{ color: '#059669' }}>
									{slugSaving ? <RefreshCw size={11} className="aw-animate-spin" /> : <Check size={11} />}
								</button>
								<button type="button" onClick={cancelSlug} className="aw-icon-btn" title="Huỷ" style={{ color: '#dc2626' }}>
									<XIcon size={11} />
								</button>
							</div>
						</div>
					) : (
						<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
							<CheckCircle size={12} color="#059669" style={{ flexShrink: 0 }} />
							<span style={{ color: '#374151' }}>Slug: <code style={{ fontSize: 11 }}>/{result.slug}</code></span>
							<button type="button" onClick={openSlugEdit} className="aw-icon-btn" title="Sửa slug" style={{ color: '#94a3b8' }}>
								<Pencil size={10} />
							</button>
						</div>
					)}
					<CheckRow
						ok={result.checks?.has_work_node}
						label="Có node xử lý (search / think / fetch…)"
					/>
					<CheckRow
						ok={result.checks?.has_compose_terminal}
						label="Có compose terminal (llm.compose)"
					/>
					<CheckRow
						ok={result.checks?.is_enabled}
						label={result.checks?.is_enabled ? 'Workflow đang BẬT' : 'Workflow đang TẮT'}
						warn={!result.checks?.is_enabled}
					/>

					{/* ── Issues ── */}
					{result.issues && result.issues.length > 0 && (
						<div style={{ marginTop: 8, padding: '6px 8px', background: '#fef3c7', borderRadius: 4, border: '1px solid #fde68a' }}>
							{result.issues.map((iss, i) => (
								<div key={i} style={{ color: '#92400e', lineHeight: 1.5 }}>• {iss}</div>
							))}
						</div>
					)}

					{/* ── Valid banner ── */}
					{result.valid && (
						<div style={{ marginTop: 8, padding: '5px 8px', background: '#ecfdf5', borderRadius: 4, border: '1px solid #6ee7b7', color: '#065f46', fontWeight: 600 }}>
							✅ Sẵn sàng dùng qua <code>/{result.slug}</code> trong chat
						</div>
					)}

					{/* ── Try in Chat link ── */}
					{result.valid && chatUrl && (
						<a
							href={chatUrl}
							target="_blank"
							rel="noopener noreferrer"
							style={{
								display: 'inline-flex', alignItems: 'center', gap: 4,
								marginTop: 8, fontSize: 11, color: '#7c3aed', textDecoration: 'none',
							}}
						>
							<ExternalLink size={11} /> Thử trong TwinWeb Chat →
						</a>
					)}
				</>
			)}

			{!result && !loading && !err && (
				<div style={{ color: '#94a3b8', fontSize: 11 }}>Nhấn refresh để kiểm tra…</div>
			)}
		</div>
	);
}

function normalizeWorkflowId(workflowId) {
	if (Number.isInteger(workflowId) && workflowId > 0) return workflowId;
	if (typeof workflowId === 'string' && /^\d+$/.test(workflowId)) {
		const n = parseInt(workflowId, 10);
		return Number.isFinite(n) && n > 0 ? n : null;
	}
	return null;
}

function CheckRow({ ok, label, warn = false }) {
	const Icon  = ok ? CheckCircle : (warn ? AlertCircle : XCircle);
	const color = ok ? '#059669'   : (warn ? '#d97706'   : '#dc2626');
	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
			<Icon size={12} color={color} style={{ flexShrink: 0 }} />
			<span style={{ color: ok ? '#374151' : '#6b7280' }}>{label}</span>
		</div>
	);
}
