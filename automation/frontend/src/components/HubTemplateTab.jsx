/**
 * HubTemplateTab — Browse + import templates từ Hub BizCity.
 *
 * [2026-06-16 Johnny Chu] PHASE-ATH W1 — Hub template library browse tab.
 *
 * Props:
 *   onPicked : (workflowRow) => void  — called after import succeeds,
 *              caller navigates to /builder/:id
 *
 * Calls:
 *   GET  /bizcity-automation/v1/hub-templates            — browse
 *   GET  /bizcity-automation/v1/hub-templates/categories — category list
 *   POST /bizcity-automation/v1/hub-templates/{id}/import — import to local
 *
 * Fail-OPEN: khi proxy trả _degraded=true → hiện info banner, không crash.
 */
import { useEffect, useState } from 'react';
import {
	Loader2, RefreshCw, Search, Star, Download, Lock, Globe,
	MessageCircle, Zap, Brain, Clock, Send, Mail, Database, Calendar,
	FileText, Sparkles,
} from 'lucide-react';
import { hubTemplatesApi, BizCityApiError } from '../lib/api.js';

/* ─── Icon whitelist ─────────────────────────────────────────── */
const ICONS = {
	FileText, MessageCircle, Zap, Brain, Clock, Globe, Send, Mail,
	Database, Calendar, Sparkles,
};

/* ─── Category labels ────────────────────────────────────────── */
const CAT_LABEL = {
	general:  'Tổng quát',
	cskh:     'CSKH',
	care:     'Chăm sóc KH',
	lead:     'Lead capture',
	zalo:     'Zalo',
	facebook: 'Facebook',
	ecom:     'E-commerce',
	report:   'Báo cáo',
	webhook:  'Webhook',
};

const CAT_COLOR = {
	general:  '#64748b',
	cskh:     '#7c3aed',
	care:     '#7c3aed',
	lead:     '#1d4ed8',
	zalo:     '#0891b2',
	facebook: '#1877f2',
	ecom:     '#ea580c',
	report:   '#0891b2',
	webhook:  '#92400e',
};

/* ─── Plan badge ─────────────────────────────────────────────── */
function PlanBadge({ plan }) {
	if (plan === 'paid') {
		return (
			<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
				padding: '2px 7px', borderRadius: 10, background: '#fef3c7',
				color: '#b45309', border: '1px solid #fcd34d', fontWeight: 600 }}>
				💎 Paid
			</span>
		);
	}
	return (
		<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10,
			padding: '2px 7px', borderRadius: 10, background: '#f0fdf4',
			color: '#15803d', border: '1px solid #86efac' }}>
			🆓 Free
		</span>
	);
}

/* ─── Star rating ────────────────────────────────────────────── */
function StarRating({ rating, count }) {
	if (!rating) return null;
	return (
		<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#92400e' }}>
			<Star size={10} fill="#f59e0b" stroke="none" />
			{Number(rating).toFixed(1)}
			{count > 0 && <span style={{ color: '#94a3b8' }}>({count})</span>}
		</span>
	);
}

/* ─── Template card ──────────────────────────────────────────── */
function HubCard({ tpl, onImport, importing }) {
	const Icon  = (tpl.icon && ICONS[tpl.icon]) || FileText;
	const cat   = tpl.category || 'general';
	const color = CAT_COLOR[cat] || '#64748b';
	const isPaid = tpl.plan === 'paid';

	return (
		<div style={cardStyle}>
			{/* Header */}
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
				<span style={{ ...iconBadge, background: color }}>
					<Icon size={14} />
				</span>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: '#0f172a' }}>
						{tpl.name}
					</div>
					<div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
						{tpl.slug}
					</div>
				</div>
				{isPaid && <Lock size={13} style={{ color: '#b45309', flexShrink: 0, marginTop: 2 }} />}
			</div>

			{/* Description */}
			<div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, minHeight: 44,
				display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
				{tpl.description || <em style={{ color: '#94a3b8' }}>—</em>}
			</div>

			{/* Chips row */}
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
				<span style={{ ...chip, color, borderColor: color }}>
					{CAT_LABEL[cat] || cat}
				</span>
				<span style={chip}>{tpl.trigger_type || 'manual'}</span>
				<PlanBadge plan={tpl.plan || 'free'} />
			</div>

			{/* Stats row */}
			<div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
				<StarRating rating={tpl.rating} count={tpl.rating_count} />
				{tpl.downloads > 0 && (
					<span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#64748b' }}>
						<Download size={10} /> {tpl.downloads}
					</span>
				)}
				{tpl.author_display && (
					<span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 'auto', maxWidth: 100,
						overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						by {tpl.author_display}
					</span>
				)}
			</div>

			{/* Action */}
			{/* [2026-06-16 Johnny Chu] PHASE-ATH W7 — paid templates link sang Marketplace (Branch #11).
			    W7 TODO: replace href with market/v1/catalog?type=automation_template&slug=tpl_xxx
			    when Branch #11 supports automation template SKU. */}
			{isPaid ? (
				<a
					href="https://bizcity.vn/marketplace"
					target="_blank"
					rel="noopener noreferrer"
					style={{ ...btnOutline, marginTop: 10, textAlign: 'center', textDecoration: 'none',
						display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
				>
					💎 Xem thêm &amp; mua
				</a>
			) : (
				<button
					type="button"
					onClick={() => onImport(tpl)}
					disabled={importing}
					style={{ ...btnPrimary, marginTop: 10 }}
				>
					{importing
						? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang import…</>
						: <>Import về site</>
					}
				</button>
			)}
		</div>
	);
}

/* ─── Main component ─────────────────────────────────────────── */
export default function HubTemplateTab({ onPicked }) {
	const [rows, setRows]         = useState([]);
	const [categories, setCats]   = useState([]);
	const [loading, setLoading]   = useState(false);
	const [degraded, setDegraded] = useState(false);
	const [err, setErr]           = useState('');
	const [filterCat, setCat]     = useState('');
	const [filterPlan, setPlan]   = useState('');
	const [q, setQ]               = useState('');
	const [importingId, setImportingId] = useState(0);
	const [page, setPage]         = useState(1);
	const [total, setTotal]       = useState(0);
	const PER_PAGE = 18;

	const load = async (pg) => {
		setLoading(true); setErr(''); setDegraded(false);
		try {
			const res = await hubTemplatesApi.browse({
				category: filterCat,
				plan:     filterPlan,
				search:   q.trim(),
				page:     pg || page,
				per_page: PER_PAGE,
			});
			if (res && res._degraded) {
				setDegraded(true);
				setRows([]);
				setTotal(0);
			} else {
				setRows(Array.isArray(res?.rows) ? res.rows : []);
				setTotal(res?.total || 0);
			}
		} catch (e) {
			if (e instanceof BizCityApiError) {
				setErr(`[${e.code || e.status}] ${e.message}`);
			} else {
				setErr(e?.message || 'Lỗi kết nối Hub');
			}
			setRows([]);
		} finally {
			setLoading(false);
		}
	};

	const loadCategories = async () => {
		try {
			const res = await hubTemplatesApi.categories();
			if (Array.isArray(res?.categories)) {
				setCats(res.categories);
			}
		} catch (_) { /* ignore — fallback to empty */ }
	};

	useEffect(() => {
		load(1);
		loadCategories();
		/* eslint-disable-next-line react-hooks/exhaustive-deps */
	}, [filterCat, filterPlan]);

	const handleSearch = (e) => {
		e.preventDefault();
		setPage(1);
		load(1);
	};

	const handleImport = async (tpl) => {
		setImportingId(tpl.id);
		try {
			const res = await hubTemplatesApi.import(tpl.id, { name: tpl.name });
			const wf  = res?.row || res;
			if (!wf?.id) throw new Error('Import không trả về workflow id');
			onPicked?.(wf);
		} catch (e) {
			const msg = e instanceof BizCityApiError
				? `[${e.code || e.status}] ${e.message}`
				: (e?.message || 'Import thất bại');
			alert(msg);
		} finally {
			setImportingId(0);
		}
	};

	const totalPages = Math.ceil(total / PER_PAGE);

	return (
		<div>
			{/* ── Toolbar ─────────────────────────────────────────── */}
			<form
				onSubmit={handleSearch}
				style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}
			>
				<div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
					<Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
					<input
						type="search"
						placeholder="Tìm template hub…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						style={inputStyle}
					/>
				</div>
				<select value={filterCat} onChange={(e) => { setCat(e.target.value); setPage(1); }} style={selectStyle}>
					<option value="">— Mọi nhóm —</option>
					{categories.length > 0
						? categories.map((c) => (
							<option key={c.slug || c} value={c.slug || c}>
								{c.name || CAT_LABEL[c.slug || c] || c}
							</option>
						))
						: Object.entries(CAT_LABEL).map(([slug, label]) => (
							<option key={slug} value={slug}>{label}</option>
						))
					}
				</select>
				<select value={filterPlan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} style={selectStyle}>
					<option value="">— Mọi plan —</option>
					<option value="free">🆓 Free</option>
					<option value="paid">💎 Paid</option>
				</select>
				<button type="submit" style={btnGhost} title="Tìm kiếm">
					<Search size={13} />
				</button>
				<button
					type="button"
					onClick={() => { setPage(1); load(1); loadCategories(); }}
					style={btnGhost}
					title="Tải lại"
				>
					<RefreshCw size={13} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
				</button>
			</form>

			{/* ── Degraded banner ───────────────────────────────── */}
			{degraded && (
				<div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px',
					background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, marginBottom: 12,
					fontSize: 12, color: '#92400e' }}>
					<Globe size={15} style={{ flexShrink: 0, marginTop: 1, color: '#b45309' }} />
					<div>
						<strong>Hub BizCity chưa kết nối.</strong>
						{' '}Kiểm tra API Key tại <strong>Cài đặt → BizCity → API Key</strong>.
						Trong thời gian chờ, bạn vẫn có thể dùng tab <em>Máy chủ</em> (local) hoặc <em>Cộng đồng</em> (GitHub).
					</div>
				</div>
			)}

			{/* ── Error ─────────────────────────────────────────── */}
			{err && (
				<div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>⚠ {err}</div>
			)}

			{/* ── Content ───────────────────────────────────────── */}
			{loading && rows.length === 0 ? (
				<div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
					<Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
					<div style={{ marginTop: 8, fontSize: 12 }}>Đang tải từ Hub BizCity…</div>
				</div>
			) : !degraded && rows.length === 0 ? (
				<div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 12 }}>
					Không có template nào. Thử xóa bộ lọc hoặc tải lại.
				</div>
			) : (
				<>
					<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
						{rows.map((tpl) => (
							<HubCard
								key={tpl.id}
								tpl={tpl}
								onImport={handleImport}
								importing={importingId === tpl.id}
							/>
						))}
					</div>

					{/* Pagination */}
					{totalPages > 1 && (
						<div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 16 }}>
							<button
								type="button"
								disabled={page <= 1}
								onClick={() => { const p = page - 1; setPage(p); load(p); }}
								style={btnGhost}
							>
								‹ Trước
							</button>
							<span style={{ fontSize: 12, color: '#475569', padding: '5px 8px' }}>
								Trang {page} / {totalPages} ({total} templates)
							</span>
							<button
								type="button"
								disabled={page >= totalPages}
								onClick={() => { const p = page + 1; setPage(p); load(p); }}
								style={btnGhost}
							>
								Sau ›
							</button>
						</div>
					)}
				</>
			)}
		</div>
	);
}

/* ─── Styles ─────────────────────────────────────────────────── */
const inputStyle = {
	width: '100%', padding: '6px 8px 6px 26px', fontSize: 12,
	border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', boxSizing: 'border-box',
};
const selectStyle = {
	fontSize: 12, padding: '5px 8px', border: '1px solid #cbd5e1',
	borderRadius: 6, background: '#fff', outline: 'none',
};
const btnGhost = {
	display: 'inline-flex', alignItems: 'center', gap: 4,
	fontSize: 12, padding: '5px 10px', border: '1px solid #cbd5e1',
	borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#475569',
};
const btnPrimary = {
	display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
	width: '100%', padding: '7px 12px', fontSize: 12, fontWeight: 500,
	background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
};
const btnOutline = {
	padding: '7px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer',
	background: '#fff', color: '#b45309', border: '1px solid #fcd34d', borderRadius: 6,
};
const cardStyle = {
	border: '1px solid #e2e8f0', borderRadius: 8, padding: 12,
	background: '#fff', display: 'flex', flexDirection: 'column',
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
