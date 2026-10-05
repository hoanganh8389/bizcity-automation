/**
 * TemplateGallery — modal thư viện template workflow 3 tabs.
 *
 * Tabs:
 *   1. 📋 Máy chủ  — local builtin/user templates (existing BE-7)
 *   2. 👥 Cộng đồng — GitHub manifest community (WF-AUTO W7)
 *   3. 🌐 Hub BizCity — browse + import từ hub (PHASE-ATH W1)
 *
 * Props:
 *   open       : bool
 *   onClose    : fn
 *   onPicked   : (workflowRow) => void   — called after instantiate/import succeeds.
 *                Caller typically navigates to `/builder/${row.id}`.
 *
 * [2026-06-16 Johnny Chu] PHASE-ATH W1 — Added 3-tab structure (local / community / hub).
 *
 * @since AUTOMATION BE-7 (2026-05-29)
 */
import { useEffect, useMemo, useState } from 'react';
import {
	Sparkles, Loader2, RefreshCw, Wand2, FileText, Search,
	MessageCircle, Zap, Brain, Clock, Globe, Send, Mail, Database, Calendar,
	Server, Github,
} from 'lucide-react';
import Modal from './Modal.jsx';
import HubTemplateTab from './HubTemplateTab.jsx';
import CommunityTemplateTab from './CommunityTemplateTab.jsx';
import { templatesApi, BizCityApiError } from '../lib/api.js';
import { BOOT } from '../lib/boot.js';

/** Whitelist of icon names allowed in tpl.icon. Keeps bundle tree-shakeable. */
const ICONS = {
	FileText, MessageCircle, Zap, Brain, Clock, Globe, Send, Mail, Database, Calendar,
	Sparkles, Wand2,
};

// [2026-06-14 Johnny Chu] PHASE-0.41 CRM-PATH-3 — extended with W1-W25 categories
const CAT_LABEL = {
	general: 'Tổng quát',
	automation: 'Automation',
	cskh:    'CSKH',
	care:    'Chăm sóc KH',
	lead:    'Lead capture',
	report:  'Báo cáo',
	webhook: 'Webhook',
	mpr:     'MPR Thinking',
	ai:      'AI / Research',
	personal: 'Riêng tư',
	ecommerce: 'Commerce',
	test:    'Test / Smoke',
};

const CAT_COLOR = {
	general: '#64748b',
	automation: '#2563eb',
	cskh:    '#7c3aed',
	care:    '#7c3aed',
	lead:    '#1d4ed8',
	report:  '#0891b2',
	webhook: '#92400e',
	mpr:     '#a855f7',
	ai:      '#0f766e',
	personal: '#be123c',
	ecommerce: '#ea580c',
	test:    '#374151',
};

/* ─── Tab definitions ────────────────────────────────────────── */
const TABS = [
	{ id: 'local',     label: '📋 Máy chủ',     Icon: Server  },
	{ id: 'community', label: '👥 Cộng đồng',    Icon: Github  },
	{ id: 'hub',       label: '🌐 Hub BizCity',  Icon: Globe   },
];

export default function TemplateGallery({ open, onClose, onPicked }) {
	const canManage = !!BOOT?.caps?.manage;
	const [activeTab, setActiveTab] = useState('local');

	// ── Local tab state ────────────────────────────────────────
	const [rows, setRows]         = useState([]);
	const [meta, setMeta]         = useState({ categories: [], sources: [], visibilities: [] });
	const [loading, setLoading]   = useState(false);
	const [err, setErr]           = useState('');
	const [filterCat, setCat]     = useState('');
	const [filterSrc, setSrc]     = useState('');
	const [filterVis, setVis]     = useState(canManage ? '' : 'global');
	const [q, setQ]               = useState('');
	const [busyId, setBusyId]     = useState(0);
	const [hilBusy, setHilBusy]   = useState(false);
	const [hilSummary, setHilSummary] = useState(null);

	const load = async () => {
		setLoading(true); setErr('');
		try {
			const res = await templatesApi.list({ category: filterCat, source: filterSrc, visibility: canManage ? filterVis : 'global', search: q.trim() });
			setRows(Array.isArray(res?.rows) ? res.rows : []);
			setMeta({
				categories:   Array.isArray(res?.categories)   ? res.categories   : [],
				sources:      Array.isArray(res?.sources)      ? res.sources      : [],
				visibilities: Array.isArray(res?.visibilities) ? res.visibilities : [],
			});
		} catch (e) {
			setErr(e instanceof BizCityApiError ? `${e.code || 'err'}: ${e.message}` : (e?.message || 'Lỗi tải templates'));
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		if (!open) return undefined;
		load();
		return undefined;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, filterCat, filterSrc, filterVis]);

	const filtered = useMemo(() => {
		if (!q.trim()) return rows;
		const needle = q.trim().toLowerCase();
		return rows.filter((r) =>
			(r.name || '').toLowerCase().includes(needle) ||
			(r.slug || '').toLowerCase().includes(needle) ||
			(r.description || '').toLowerCase().includes(needle)
		);
	}, [rows, q]);

	const handleUse = async (tpl) => {
		setBusyId(tpl.id);
		try {
			const res = await templatesApi.instantiate(tpl.id, { name: `${tpl.name} — copy`, enabled: 0 });
			const wf  = res?.row || res;
			if (!wf?.id) throw new Error('Instantiate không trả workflow id');
			onPicked?.(wf);
			onClose?.();
		} catch (e) {
			const msg = e instanceof BizCityApiError ? `${e.code || 'err'}: ${e.message}` : (e?.message || 'Instantiate thất bại');
			alert(msg);
		} finally {
			setBusyId(0);
		}
	};

	const handleReseed = async () => {
		if (!window.confirm('Re-seed lại các template built-in? Slug uniq sẽ cập nhật version (use_count giữ nguyên).')) return;
		setLoading(true);
		try {
			await templatesApi.reseed();
			await load();
		} catch (e) {
			alert(e?.message || 'Re-seed thất bại');
		} finally {
			setLoading(false);
		}
	};

	const handleHilUpgrade = async () => {
		if (!window.confirm('Chạy HIL Upgrade cho workflow hiện có theo safe policy (chỉ trigger tương tác)?')) return;
		setHilBusy(true);
		try {
			const res = await templatesApi.hilUpgrade({ force: true });
			const r = res?.result || {};
			const toNum = (v) => {
				const n = Number(v || 0);
				return Number.isFinite(n) ? n : 0;
			};
			const summary = {
				seedVersion: String(r.seed_version || ''),
				processed: toNum(r.processed),
				upgraded: toNum(r.upgraded),
				already: toNum(r.already_hil),
				skippedScope: toNum(r.skipped_scope_miss),
				skippedNonInteractive: toNum(r.skipped_non_interactive_trigger),
				failedSpec: toNum(r.failed_spec_invalid),
				failedUpdate: toNum(r.failed_update),
			};
			setHilSummary(summary);

			alert(
				`HIL Upgrade summary\n`
				+ `seed=${summary.seedVersion || 'unknown'}\n`
				+ `processed=${summary.processed}\n`
				+ `upgraded=${summary.upgraded}\n`
				+ `already_hil=${summary.already}\n`
				+ `skipped_scope=${summary.skippedScope}\n`
				+ `skipped_non_interactive=${summary.skippedNonInteractive}\n`
				+ `failed_spec_invalid=${summary.failedSpec}\n`
				+ `failed_update=${summary.failedUpdate}`
			);
		} catch (e) {
			setHilSummary(null);
			alert(e?.message || 'HIL Upgrade thất bại');
		} finally {
			setHilBusy(false);
		}
	};

	return (
		<Modal open={open} onClose={onClose} title="Thư viện template workflow" width={960}>
			{/* ── Tab header ─────────────────────────────────────── */}
			<div style={{ borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 0, padding: '0 14px' }}>
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						style={{
							display: 'inline-flex', alignItems: 'center', gap: 6,
							padding: '10px 14px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
							color: activeTab === tab.id ? '#2563eb' : '#64748b',
							background: 'none', border: 'none', cursor: 'pointer',
							borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
							marginBottom: -1,
						}}
					>
						{tab.label}
						{tab.id === 'hub' && (
							<span style={{ fontSize: 9, background: '#dbeafe', color: '#1d4ed8',
								padding: '1px 5px', borderRadius: 8, fontWeight: 700, lineHeight: 1.4 }}>
								NEW
							</span>
						)}
					</button>
				))}
			</div>

			{/* ── Tab panels ─────────────────────────────────────── */}
			<div style={{ padding: 14 }}>

				{/* Tab: Máy chủ (local) */}
				{activeTab === 'local' && (
					<>
						{/* Filters */}
						<div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
							<div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
								<Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
								<input
									type="search"
									placeholder="Tìm template…"
									value={q}
									onChange={(e) => setQ(e.target.value)}
									style={{
										width: '100%', padding: '6px 8px 6px 26px', fontSize: 12,
										border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
									}}
								/>
							</div>
							<select value={filterSrc} onChange={(e) => setSrc(e.target.value)} style={selectStyle}>
								<option value="">— Mọi nguồn —</option>
								{meta.sources.map((s) => <option key={s} value={s}>{s}</option>)}
							</select>
							{canManage && (
								<select value={filterVis} onChange={(e) => setVis(e.target.value)} style={selectStyle}>
									<option value="">— Global / riêng tư —</option>
									{meta.visibilities.map((v) => <option key={v} value={v}>{v === 'global' ? 'Global' : 'Riêng tư'}</option>)}
								</select>
							)}
							<select value={filterCat} onChange={(e) => setCat(e.target.value)} style={selectStyle}>
								<option value="">— Mọi nhóm —</option>
								{meta.categories.map((c) => <option key={c} value={c}>{CAT_LABEL[c] || c}</option>)}
							</select>
							<button type="button" onClick={load} className="aw-btn aw-btn-ghost" title="Tải lại">
								<RefreshCw size={13} className={loading ? 'aw-animate-spin' : ''} />
							</button>
							{canManage && (
								<button type="button" onClick={handleReseed} className="aw-btn aw-btn-ghost" title="Re-seed templates built-in">
									<Wand2 size={13} /> Re-seed
								</button>
							)}
							{canManage && (
								<button
									type="button"
									onClick={handleHilUpgrade}
									disabled={hilBusy || loading}
									className="aw-btn aw-btn-ghost"
									title="Chạy pass nâng cấp HIL cho workflow cũ"
								>
									{hilBusy
										? <><Loader2 size={13} className="aw-animate-spin" /> HIL Upgrade…</>
										: <><Wand2 size={13} /> HIL Upgrade</>
									}
								</button>
							)}
						</div>

						{hilSummary && (
							<div style={{
								marginBottom: 10,
								padding: '8px 10px',
								border: '1px solid #bfdbfe',
								borderRadius: 8,
								background: '#eff6ff',
								fontSize: 12,
								color: '#1e3a8a',
							}}>
								HIL Upgrade (seed {hilSummary.seedVersion || 'unknown'}) · processed {hilSummary.processed} · upgraded {hilSummary.upgraded} · already {hilSummary.already} · skipped(scope {hilSummary.skippedScope}, non-interactive {hilSummary.skippedNonInteractive}) · failed(spec {hilSummary.failedSpec}, update {hilSummary.failedUpdate})
							</div>
						)}

						{err && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>⚠ {err}</div>}

						{loading && rows.length === 0 ? (
							<div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
								<Loader2 size={22} className="aw-animate-spin" />
								<div style={{ marginTop: 8, fontSize: 12 }}>Đang tải templates…</div>
							</div>
						) : filtered.length === 0 ? (
							<div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>
								{canManage
									? 'Không có template nào. Hãy thử "Re-seed" để load builtin.'
									: 'Chưa có template global nào khả dụng cho tài khoản của bạn.'}
							</div>
						) : (
							<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
								{filtered.map((tpl) => {
									const Icon = (tpl.icon && ICONS[tpl.icon]) || FileText;
									const cat  = tpl.category || 'general';
									return (
										<div key={tpl.id} style={cardStyle}>
											<div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
												<span style={{ ...iconBadge, background: CAT_COLOR[cat] || '#64748b' }}>
													<Icon size={14} />
												</span>
												<div style={{ flex: 1, minWidth: 0 }}>
													<div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: '#0f172a' }}>{tpl.name}</div>
													<div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>{tpl.slug}</div>
												</div>
											</div>
											<div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, minHeight: 48 }}>
												{tpl.description || <em style={{ color: '#94a3b8' }}>—</em>}
											</div>
											<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
												<span style={{ ...chip, color: CAT_COLOR[cat], borderColor: CAT_COLOR[cat] }}>
													{CAT_LABEL[cat] || cat}
												</span>
												<span style={chip}>{tpl.trigger_type}</span>
												<span style={chip}>{tpl.source}</span>
												<span style={{ ...chip, color: tpl.visibility === 'global' ? '#047857' : '#6b7280', borderColor: tpl.visibility === 'global' ? '#6ee7b7' : '#d1d5db' }}>
													{tpl.visibility === 'global' ? 'global' : 'private'}
												</span>
												{tpl.template_version && <span style={chip}>v{tpl.template_version}</span>}
												{tpl.template_uuid && (
													<span style={{ ...chip, fontFamily: 'monospace' }} title={tpl.template_uuid}>
														UUID {String(tpl.template_uuid).slice(0, 8)}…
													</span>
												)}
												{Number(tpl.use_count) > 0 && (
													<span style={{ ...chip, color: '#15803d', borderColor: '#86efac' }}>
														<Sparkles size={9} /> {tpl.use_count} lần dùng
													</span>
												)}
											</div>
											<button
												type="button"
												onClick={() => handleUse(tpl)}
												disabled={busyId === tpl.id}
												className="aw-btn aw-btn-primary"
												style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
											>
												{busyId === tpl.id
													? <><Loader2 size={13} className="aw-animate-spin" /> Đang tạo…</>
													: <>Dùng template</>
												}
											</button>
										</div>
									);
								})}
							</div>
						)}
					</>
				)}

				{/* Tab: Cộng đồng (GitHub) */}
				{activeTab === 'community' && (
					<CommunityTemplateTab
						onPicked={(wf) => { onPicked?.(wf); onClose?.(); }}
					/>
				)}

				{/* Tab: Hub BizCity */}
				{activeTab === 'hub' && (
					<HubTemplateTab
						onPicked={(wf) => { onPicked?.(wf); onClose?.(); }}
					/>
				)}
			</div>
		</Modal>
	);
}

const selectStyle = {
	fontSize: 12, padding: '5px 8px', border: '1px solid #cbd5e1',
	borderRadius: 6, background: '#fff', outline: 'none',
};
const cardStyle = {
	border: '1px solid #e2e8f0', borderRadius: 8, padding: 12,
	background: '#fff', display: 'flex', flexDirection: 'column',
	transition: 'box-shadow .15s, transform .15s',
	cursor: 'default',
};
const iconBadge = {
	display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
	width: 28, height: 28, borderRadius: 6, color: '#fff', flexShrink: 0,
};
const chip = {
	display: 'inline-flex', alignItems: 'center', gap: 3,
	fontSize: 10, padding: '2px 6px', borderRadius: 10,
	border: '1px solid #cbd5e1', color: '#475569', background: '#f8fafc',
};
