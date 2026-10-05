/**
 * CommunityTemplateTab — Browse + import templates từ GitHub community.
 *
 * [2026-06-16 Johnny Chu] PHASE-ATH W0 — Community GitHub gallery tab.
 *
 * Props:
 *   onPicked : (workflowRow) => void  — called after import succeeds
 *
 * Calls (existing endpoints):
 *   GET  /bizcity-automation/v1/community/workflows?manifest_url=…
 *   GET  /bizcity-automation/v1/community/workflow?url=…
 *   POST /bizcity-automation/v1/community/workflows/import  { url }
 */
import { useState } from 'react';
import {
	Loader2, RefreshCw, Search, ExternalLink, Download, Eye,
	FileText, Github, X,
} from 'lucide-react';
import { communityApi, BizCityApiError } from '../lib/api.js';

const DEFAULT_MANIFEST = 'https://raw.githubusercontent.com/bizcity/automation-workflows/main/manifest.json';

/* ─── Markdown preview modal ─────────────────────────────────── */
function PreviewModal({ item, md, loading, onClose, onImport, importing }) {
	return (
		<div
			style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
				zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
			onClick={onClose}
		>
			<div
				style={{ background: '#fff', borderRadius: 10, boxShadow: '0 20px 60px rgba(0,0,0,.25)',
					width: 'min(860px, 92vw)', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
					borderBottom: '1px solid #e2e8f0' }}>
					<FileText size={16} style={{ color: '#64748b' }} />
					<div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>
						{item?.name || 'Xem trước template'}
					</div>
					{item?.url && (
						<a href={item.url} target="_blank" rel="noopener noreferrer"
							style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
								color: '#2563eb', textDecoration: 'none' }}>
							<ExternalLink size={11} /> Nguồn
						</a>
					)}
					<button type="button" onClick={onClose}
						style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
						<X size={16} />
					</button>
				</div>

				{/* Body */}
				<div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
					{loading ? (
						<div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
							<Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
							<div style={{ marginTop: 8, fontSize: 12 }}>Đang tải…</div>
						</div>
					) : (
						<pre style={{ fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace',
							background: '#f8fafc', padding: 12, borderRadius: 6, margin: 0 }}>
							{md || '— Không có nội dung —'}
						</pre>
					)}
				</div>

				{/* Footer */}
				<div style={{ padding: '10px 16px', borderTop: '1px solid #e2e8f0',
					display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
					<button type="button" onClick={onClose} style={btnGhost}>Đóng</button>
					<button
						type="button"
						disabled={loading || importing}
						onClick={() => onImport(item)}
						style={btnPrimary}
					>
						{importing
							? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang import…</>
							: <><Download size={13} /> Import về site</>
						}
					</button>
				</div>
			</div>
		</div>
	);
}

/* ─── Community card ─────────────────────────────────────────── */
function CommunityCard({ item, onPreview, onImport, importing }) {
	const tags = Array.isArray(item.tags)
		? item.tags
		: (item.tags ? String(item.tags).split(',').map((t) => t.trim()).filter(Boolean) : []);

	return (
		<div style={cardStyle}>
			<div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
				<span style={{ ...iconBadge, background: '#0891b2' }}>
					<Github size={14} />
				</span>
				<div style={{ flex: 1, minWidth: 0 }}>
					<div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3, color: '#0f172a' }}>
						{item.name}
					</div>
					<div style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'monospace' }}>
						{item.slug}
					</div>
				</div>
			</div>

			<div style={{ fontSize: 11, color: '#475569', lineHeight: 1.5, minHeight: 44,
				display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
				{item.description || <em style={{ color: '#94a3b8' }}>—</em>}
			</div>

			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
				{item.category && (
					<span style={{ ...chip, color: '#0891b2', borderColor: '#0891b2' }}>{item.category}</span>
				)}
				{tags.slice(0, 3).map((t) => (
					<span key={t} style={chip}>{t}</span>
				))}
				{item.author && (
					<span style={{ ...chip, marginLeft: 'auto', maxWidth: 100,
						overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
						by {item.author}
					</span>
				)}
			</div>

			<div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
				<button
					type="button"
					onClick={() => onPreview(item)}
					style={{ ...btnGhost, flex: 1, justifyContent: 'center' }}
				>
					<Eye size={12} /> Xem
				</button>
				<button
					type="button"
					onClick={() => onImport(item)}
					disabled={importing}
					style={{ ...btnPrimary, flex: 1 }}
				>
					{importing
						? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Importing…</>
						: <><Download size={12} /> Import</>
					}
				</button>
			</div>
		</div>
	);
}

/* ─── Main component ─────────────────────────────────────────── */
export default function CommunityTemplateTab({ onPicked }) {
	const [manifestUrl, setManifestUrl] = useState(DEFAULT_MANIFEST);
	const [items, setItems]     = useState([]);
	const [loading, setLoading] = useState(false);
	const [fetched, setFetched] = useState(false);
	const [err, setErr]         = useState('');
	const [q, setQ]             = useState('');
	const [importingSlug, setImportingSlug] = useState('');
	const [preview, setPreview] = useState(null);   // { item, md }
	const [prevLoading, setPrevLoading] = useState(false);

	const doFetch = async () => {
		setLoading(true); setErr(''); setItems([]);
		try {
			const res = await communityApi.list(manifestUrl.trim() || DEFAULT_MANIFEST);
			setItems(Array.isArray(res?.items) ? res.items : (Array.isArray(res) ? res : []));
			setFetched(true);
		} catch (e) {
			const msg = e instanceof BizCityApiError
				? `[${e.code || e.status}] ${e.message}`
				: (e?.message || 'Lỗi tải manifest');
			setErr(msg);
		} finally {
			setLoading(false);
		}
	};

	const doImport = async (item) => {
		if (!item?.url) { alert('Không có URL để import.'); return; }
		setImportingSlug(item.slug || item.url);
		try {
			const res = await communityApi.import(item.url, { name: item.name });
			const wf  = res?.row || res;
			if (!wf?.id) throw new Error('Import không trả về workflow id');
			onPicked?.(wf);
			setPreview(null);
		} catch (e) {
			const msg = e instanceof BizCityApiError
				? `[${e.code || e.status}] ${e.message}`
				: (e?.message || 'Import thất bại');
			alert(msg);
		} finally {
			setImportingSlug('');
		}
	};

	const doPreview = async (item) => {
		setPreview({ item, md: '' });
		setPrevLoading(true);
		try {
			const res = await communityApi.preview(item.url);
			setPreview({ item, md: res?.md || res?.content || JSON.stringify(res, null, 2) });
		} catch (e) {
			setPreview({ item, md: `Lỗi tải preview: ${e?.message || 'unknown'}` });
		} finally {
			setPrevLoading(false);
		}
	};

	const filtered = items.filter((it) => {
		if (!q.trim()) return true;
		const needle = q.trim().toLowerCase();
		return (it.name || '').toLowerCase().includes(needle)
			|| (it.description || '').toLowerCase().includes(needle)
			|| (it.slug || '').toLowerCase().includes(needle);
	});

	return (
		<div>
			{/* ── Manifest URL bar ──────────────────────────────── */}
			<div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
				<input
					type="url"
					value={manifestUrl}
					onChange={(e) => setManifestUrl(e.target.value)}
					placeholder="https://raw.githubusercontent.com/…/manifest.json"
					style={{ flex: '1 1 300px', fontSize: 11, padding: '5px 8px',
						border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', fontFamily: 'monospace' }}
				/>
				<button type="button" onClick={doFetch} disabled={loading} style={btnPrimary}>
					{loading
						? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Đang tải…</>
						: <><RefreshCw size={13} /> Fetch manifest</>
					}
				</button>
			</div>

			{/* ── Search ────────────────────────────────────────── */}
			{fetched && items.length > 0 && (
				<div style={{ position: 'relative', marginBottom: 12 }}>
					<Search size={13} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
					<input
						type="search"
						placeholder="Lọc template cộng đồng…"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						style={{ width: '100%', padding: '6px 8px 6px 26px', fontSize: 12,
							border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none', boxSizing: 'border-box' }}
					/>
				</div>
			)}

			{/* ── Error ─────────────────────────────────────────── */}
			{err && <div style={{ color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>⚠ {err}</div>}

			{/* ── Empty prompt ──────────────────────────────────── */}
			{!fetched && !loading && (
				<div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
					<Github size={28} style={{ opacity: .4, margin: '0 auto 10px' }} />
					<div style={{ fontSize: 12 }}>
						Nhấn <strong>Fetch manifest</strong> để tải danh sách template từ GitHub.
					</div>
					<div style={{ fontSize: 11, marginTop: 4, opacity: .7 }}>
						Mặc định: kho bizcity/automation-workflows trên GitHub.
					</div>
				</div>
			)}

			{/* ── Loading ───────────────────────────────────────── */}
			{loading && (
				<div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
					<Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
					<div style={{ marginTop: 8, fontSize: 12 }}>Đang tải manifest…</div>
				</div>
			)}

			{/* ── Grid ──────────────────────────────────────────── */}
			{fetched && !loading && filtered.length === 0 && (
				<div style={{ textAlign: 'center', padding: 32, color: '#94a3b8', fontSize: 12 }}>
					Không tìm thấy template nào.
				</div>
			)}
			{fetched && !loading && filtered.length > 0 && (
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
					{filtered.map((item) => (
						<CommunityCard
							key={item.slug || item.url}
							item={item}
							onPreview={doPreview}
							onImport={doImport}
							importing={importingSlug === (item.slug || item.url)}
						/>
					))}
				</div>
			)}

			{/* ── Preview modal ─────────────────────────────────── */}
			{preview && (
				<PreviewModal
					item={preview.item}
					md={preview.md}
					loading={prevLoading}
					onClose={() => setPreview(null)}
					onImport={doImport}
					importing={!!importingSlug}
				/>
			)}
		</div>
	);
}

/* ─── Styles ─────────────────────────────────────────────────── */
const btnGhost = {
	display: 'inline-flex', alignItems: 'center', gap: 4,
	fontSize: 12, padding: '5px 10px', border: '1px solid #cbd5e1',
	borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#475569',
};
const btnPrimary = {
	display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
	padding: '6px 12px', fontSize: 12, fontWeight: 500,
	background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
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
