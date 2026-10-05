/**
 * FB Page picker — combo field for `action.publish_fb_post`.
 *
 * Replaces 2 free-text fields (`fb_page_id`, `fb_page_name`) with a
 * structured UX:
 *   - Mode toggle: "Đăng lên tất cả fanpage" vs "Chọn 1 fanpage".
 *   - Dropdown (mode=single) lazy-loads `/channel-registry?platform=FACEBOOK`.
 *   - Quick-link button to `admin.php?page=bizcity-facebook-bots&action=add`
 *     để staff thêm fanpage mới mà không rời khỏi Inspector.
 *
 * Writes 3 fields qua onPatch:
 *   - `fb_target_mode` ∈ { 'single', 'all' }
 *   - `fb_page_id`     (page_id khi mode=single; '' khi mode=all)
 *   - `fb_page_name`   (label hiển thị khi mode=single; 'Tất cả fanpage' khi all)
 *
 * @since AUTOMATION UX FB-PICKER (2026-06-02)
 */
import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { automationApi } from '../lib/api.js';

const ADMIN_LIST_URL = '/wp-admin/admin.php?page=bizcity-facebook-bots';
const ADMIN_ADD_URL  = '/wp-admin/admin.php?page=bizcity-facebook-bots&action=add';

export default function FbPagePicker({ data, onPatch }) {
	const [rows, setRows]       = useState(null);
	const [error, setError]     = useState('');
	const [loading, setLoading] = useState(false);
	const [reloadKey, setReload] = useState(0);

	const mode    = data?.fb_target_mode === 'all' ? 'all' : 'single';
	const pageId  = String(data?.fb_page_id ?? '');
	const pageNm  = String(data?.fb_page_name ?? '');

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		automationApi.channelRegistry('FACEBOOK')
			.then((res) => {
				if (cancelled) return;
				setRows(Array.isArray(res?.rows) ? res.rows : []);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(e?.message || 'Lỗi tải danh sách fanpage');
				setRows([]);
			})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [reloadKey]);

	const pages = rows || [];
	const hasCurrent = !pageId || pages.some((r) => String(r.instance_id) === pageId);

	useEffect(() => {
		if (mode !== 'single' || pageId || !Array.isArray(rows) || rows.length === 0) return;
		const row = rows.find((r) => r?.meta?.is_default || r?.meta?.customer_default) || rows[0];
		if (!row?.instance_id) return;
		onPatch({
			fb_target_mode: 'single',
			fb_page_id: String(row.instance_id),
			fb_page_name: String(row.label || row.instance_id),
		});
	}, [mode, pageId, rows, onPatch]);

	const setMode = (next) => {
		if (next === 'all') {
			onPatch({
				fb_target_mode: 'all',
				fb_page_id: '',
				fb_page_name: 'Tất cả fanpage',
			});
		} else {
			onPatch({
				fb_target_mode: 'single',
				fb_page_id: pageId,
				fb_page_name: pageNm,
			});
		}
	};

	const pickPage = (id) => {
		const row = pages.find((r) => String(r.instance_id) === String(id));
		onPatch({
			fb_target_mode: 'single',
			fb_page_id: String(id || ''),
			fb_page_name: row ? String(row.label || id) : pageNm,
		});
	};

	return (
		<div style={{ marginTop: 4 }}>
			{/* Mode toggle (radio cards) */}
			<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
				<ModeCard
					active={mode === 'all'}
					title="Tất cả fanpage"
					hint={`${pages.length} fanpage`}
					onClick={() => setMode('all')}
				/>
				<ModeCard
					active={mode === 'single'}
					title="1 fanpage cụ thể"
					hint={mode === 'single' && pageNm ? pageNm : 'Chọn từ danh sách'}
					onClick={() => setMode('single')}
				/>
			</div>

			{mode === 'single' && (
				<>
					{loading && !rows && (
						<div style={{ fontSize: 11, color: '#94a3b8' }}>Đang tải fanpage…</div>
					)}
					{rows && (
						<select
							value={pageId}
							onChange={(e) => pickPage(e.target.value)}
							style={selectStyle}
						>
							<option value="">— Chọn fanpage —</option>
							{!hasCurrent && pageId && (
								<option value={pageId}>
									{pageNm || pageId} (không có trong registry)
								</option>
							)}
							{pages.map((r) => (
								<option key={r.instance_id} value={r.instance_id}>
									{r.label} · {r.instance_id}
								</option>
							))}
						</select>
					)}
					{error && (
						<div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>⚠ {error}</div>
					)}
					{rows && pages.length === 0 && !error && (
						<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
							Chưa có fanpage nào đã kết nối.
						</div>
					)}
				</>
			)}

			{/* Actions: refresh + deep-link sang Channel Gateway */}
			<div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
				<a
					href={ADMIN_ADD_URL}
					target="_blank"
					rel="noopener noreferrer"
					style={linkBtnStyle}
				>
					<ExternalLink size={12} /> + Thêm fanpage
				</a>
				<a
					href={ADMIN_LIST_URL}
					target="_blank"
					rel="noopener noreferrer"
					style={linkBtnStyle}
				>
					<ExternalLink size={12} /> Quản lý
				</a>
				<button
					type="button"
					onClick={() => setReload((k) => k + 1)}
					style={{ ...linkBtnStyle, cursor: 'pointer' }}
					title="Tải lại danh sách"
				>
					<RefreshCw size={12} /> Reload
				</button>
			</div>
		</div>
	);
}

function ModeCard({ active, title, hint, onClick }) {
	return (
		<button
			type="button"
			onClick={onClick}
			style={{
				textAlign: 'left',
				padding: '8px 10px',
				borderRadius: 6,
				border: `1px solid ${active ? '#1d4ed8' : '#cbd5e1'}`,
				background: active ? '#eff6ff' : '#fff',
				cursor: 'pointer',
				fontFamily: 'inherit',
			}}
		>
			<div style={{ fontSize: 12, fontWeight: 600, color: active ? '#1d4ed8' : '#0f172a' }}>
				{title}
			</div>
			<div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{hint}</div>
		</button>
	);
}

const selectStyle = {
	display: 'block', width: '100%', marginTop: 4,
	padding: '6px 8px', fontSize: 12, lineHeight: 1.4,
	border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
	fontFamily: 'inherit', boxSizing: 'border-box',
};

const linkBtnStyle = {
	display: 'inline-flex', alignItems: 'center', gap: 4,
	padding: '4px 8px', fontSize: 11,
	border: '1px solid #cbd5e1', borderRadius: 4,
	background: '#f8fafc', color: '#0f172a',
	textDecoration: 'none', fontFamily: 'inherit',
};
