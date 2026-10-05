/**
 * Notebook Picker — dropdown field for `action.generate_content`.
 *
 * Lazy-loads list notebook từ bizcity/kg/v1/notebooks (KG REST namespace).
 * Hiển thị skeleton_status badge cạnh tên để user biết skeleton có sẵn chưa.
 *
 * Giá trị: integer notebook_id (0 = không bind).
 *
 * [2026-06-16 Johnny Chu] PHASE-ATH W9 — notebook_picker field type.
 *
 * @since PHASE-ATH W9 (2026-06-16)
 */
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { notebookApi } from '../lib/api.js';

const STATUS_BADGE = {
	ready:    { label: '📋 Ready',     color: '#16a34a' },
	building: { label: '⏳ Building',  color: '#d97706' },
	pending:  { label: '⏳ Đang xếp',  color: '#d97706' },
	stale:    { label: '⚠️ Stale',     color: '#dc2626' },
	failed:   { label: '❌ Lỗi',       color: '#dc2626' },
};

const inputStyle = {
	width: '100%',
	padding: '4px 6px',
	border: '1px solid #e2e8f0',
	borderRadius: 4,
	fontSize: 12,
	background: '#fff',
	cursor: 'pointer',
	marginTop: 4,
	boxSizing: 'border-box',
};

export default function NotebookPicker({ value, onChange }) {
	const [rows, setRows]       = useState(null);   // null = loading
	const [error, setError]     = useState('');
	const [reloadKey, setReload] = useState(0);

	useEffect(() => {
		let cancelled = false;
		notebookApi.list()
			.then((data) => {
				if (!cancelled) setRows(Array.isArray(data) ? data : []);
			})
			.catch((e) => {
				if (!cancelled) { setError(e?.message || 'Lỗi tải notebook'); setRows([]); }
			});
		return () => { cancelled = true; };
	}, [reloadKey]);

	const currentId = Number(value ?? 0);
	const current   = rows ? rows.find((r) => Number(r.id) === currentId) : null;
	const statusKey = current?.skeleton_status || null;
	const badge     = statusKey ? STATUS_BADGE[statusKey] : null;

	return (
		<div style={{ marginTop: 4 }}>
			{/* Status badge cho notebook đang chọn */}
			{current && badge && (
				<div style={{
					fontSize: 11,
					color: badge.color,
					marginBottom: 4,
					padding: '2px 6px',
					background: badge.color + '18',
					borderRadius: 4,
					display: 'inline-block',
				}}>
					{badge.label}
					{current.skeleton_version > 0 && ` · v${current.skeleton_version}`}
				</div>
			)}

			{rows === null ? (
				<div style={{ fontSize: 11, color: '#94a3b8', padding: '4px 0' }}>Đang tải notebook…</div>
			) : (
				<select
					value={currentId}
					onChange={(e) => onChange(Number(e.target.value))}
					style={inputStyle}
				>
					<option value={0}>— Không bind notebook —</option>
					{rows.map((nb) => {
						const sk = STATUS_BADGE[nb.skeleton_status];
						return (
							<option key={nb.id} value={nb.id}>
								{nb.name}
								{sk ? ` (${sk.label})` : ''}
								{nb.skeleton_version > 0 ? ` v${nb.skeleton_version}` : ''}
							</option>
						);
					})}
				</select>
			)}

			{error && (
				<div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>
					{error}
				</div>
			)}

			<button
				type="button"
				onClick={() => setReload((k) => k + 1)}
				style={{
					marginTop: 4,
					fontSize: 11,
					color: '#64748b',
					background: 'none',
					border: 'none',
					cursor: 'pointer',
					padding: 0,
					display: 'flex',
					alignItems: 'center',
					gap: 4,
				}}
				title="Tải lại danh sách notebook"
			>
				<RefreshCw size={10} /> Tải lại
			</button>

			{current && statusKey === 'stale' && (
				<div style={{ fontSize: 11, color: '#d97706', marginTop: 4 }}>
					⚠️ Skeleton cũ — notebook đã cập nhật. Vào KG Hub để rebuild.
				</div>
			)}
			{current && !statusKey && (
				<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
					Notebook này chưa có skeleton. Vào KG Hub → Rebuild để tạo.
				</div>
			)}
		</div>
	);
}
