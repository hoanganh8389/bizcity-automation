/**
 * Guru picker + channel bindings preview.
 *
 * Used as an Inspector field with `type: 'guru_picker'` (replaces raw `number`
 * input on channel triggers). Fetches gurus from
 * /bizcity-channel/v1/inspector/gurus and, when a guru is picked, shows the
 * channels (platform + account_id) that guru is bound to so the workflow
 * author can confirm the trigger will actually fire.
 *
 * @since GURU-UI W0.3 (2026-06-03 Johnny Chu)
 */
import { useEffect, useState } from 'react';
import { automationApi } from '../lib/api.js';

const inputStyle = {
	display: 'block', width: '100%', marginTop: 4,
	padding: '6px 8px', fontSize: 12, lineHeight: 1.4,
	border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
	fontFamily: 'inherit', boxSizing: 'border-box',
};

const previewBoxStyle = {
	marginTop: 6, padding: '6px 8px', fontSize: 11, lineHeight: 1.5,
	border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc',
	color: '#475569',
};

export default function GuruChannelPicker({ value, onChange }) {
	const [gurus, setGurus]       = useState(null);
	const [error, setError]       = useState('');
	const [loading, setLoading]   = useState(false);
	const [bindings, setBindings] = useState(null);
	const [bindingsLoading, setBindingsLoading] = useState(false);

	const currentId = parseInt(value, 10) || 0;

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		automationApi.gurus()
			.then((res) => {
				if (cancelled) return;
				const rows = (res && (res.data || res.gurus)) || [];
				setGurus(Array.isArray(rows) ? rows : []);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(e?.message || 'Lỗi tải gurus');
				setGurus([]);
			})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, []);

	useEffect(() => {
		if (!currentId) { setBindings(null); return; }
		let cancelled = false;
		setBindingsLoading(true);
		automationApi.guruChannels(currentId)
			.then((res) => {
				if (cancelled) return;
				const rows = (res && (res.data || res.bindings)) || [];
				setBindings(Array.isArray(rows) ? rows : []);
			})
			.catch(() => { if (!cancelled) setBindings([]); })
			.finally(() => { if (!cancelled) setBindingsLoading(false); });
		return () => { cancelled = true; };
	}, [currentId]);

	if (loading && !gurus) {
		return <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Đang tải Gurus…</div>;
	}

	if (error && (!gurus || gurus.length === 0)) {
		return (
			<div style={{ marginTop: 4 }}>
				<input
					type="number"
					value={value ?? 0}
					placeholder="Guru ID (không tải được danh sách)"
					onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
					style={inputStyle}
				/>
				<div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {error}</div>
			</div>
		);
	}

	const list = gurus || [];
	const hasCurrent = !currentId || list.some((g) => parseInt(g.id, 10) === currentId);
	const selected = list.find((g) => parseInt(g.id, 10) === currentId);

	return (
		<div style={{ marginTop: 4 }}>
			<select
				value={String(currentId || 0)}
				onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
				style={inputStyle}
			>
				<option value="0">— Mọi Guru ({list.length}) —</option>
				{!hasCurrent && currentId > 0 && (
					<option value={String(currentId)}>#{currentId} (không có trong danh sách)</option>
				)}
				{list.map((g) => {
					const status = String(g.status || '').toLowerCase();
					const isPublishable = status === 'active' || status === 'published' || status === '';
					return (
						<option key={g.id} value={String(g.id)}>
							{isPublishable ? '' : '⏸ '}{g.name || g.slug || `Guru #${g.id}`} · #{g.id}{status ? ` · ${status}` : ''}
						</option>
					);
				})}
			</select>

			{currentId > 0 && (
				<div style={previewBoxStyle}>
					{bindingsLoading && <span>Đang tải channel bindings…</span>}
					{!bindingsLoading && Array.isArray(bindings) && bindings.length === 0 && (
						<span style={{ color: '#b45309' }}>
							⚠ Guru <strong>{selected?.name || `#${currentId}`}</strong> chưa bind kênh nào.
							Trigger sẽ không bao giờ khớp. Vào tab <em>Channels</em> ở character-edit để bind.
						</span>
					)}
					{!bindingsLoading && Array.isArray(bindings) && bindings.length > 0 && (
						<>
							<div style={{ marginBottom: 2, color: '#0f172a' }}>
								<strong>Channels đã bind ({bindings.length}):</strong>
							</div>
							<ul style={{ margin: 0, paddingLeft: 16 }}>
								{bindings.map((b) => (
									<li key={b.id}>
										<code>{b.platform}</code> · {b.account_id}
										{b.mode ? ` (mode=${b.mode})` : ''}
										{String(b.status) === '0' || b.status === 0 ? ' · disabled' : ''}
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			)}

			{list.length === 0 && (
				<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
					Chưa có Guru nào. Tạo Guru tại Knowledge → Characters.
				</div>
			)}
		</div>
	);
}
