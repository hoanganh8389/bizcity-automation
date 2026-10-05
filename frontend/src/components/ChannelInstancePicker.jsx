/**
 * Channel instance picker — dropdown lazy-loads `/channel-registry`.
 *
 * Used as an Inspector field with `type: 'channel_instance_picker'` +
 * `platform: 'ZALO_BOT' | 'FACEBOOK' | 'TELEGRAM'`.
 *
 * @since AUTOMATION BE-6 (2026-05-29)
 */
import { useEffect, useState } from 'react';
import { automationApi } from '../lib/api.js';

export default function ChannelInstancePicker({ platform, value, onChange }) {
	const [rows, setRows]       = useState(null);
	const [error, setError]     = useState('');
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError('');
		automationApi.channelRegistry(platform)
			.then((res) => {
				if (cancelled) return;
				setRows(Array.isArray(res?.rows) ? res.rows : []);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(e?.message || 'Lỗi tải registry');
				setRows([]);
			})
			.finally(() => { if (!cancelled) setLoading(false); });
		return () => { cancelled = true; };
	}, [platform]);

	const inputStyle = {
		display: 'block', width: '100%', marginTop: 4,
		padding: '6px 8px', fontSize: 12, lineHeight: 1.4,
		border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
		fontFamily: 'inherit', boxSizing: 'border-box',
	};

	if (loading && !rows) {
		return <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Đang tải instance…</div>;
	}

	if (error && (!rows || rows.length === 0)) {
		return (
			<div style={{ marginTop: 4 }}>
				<input
					type="text"
					value={value ?? ''}
					placeholder="Không tải được registry — nhập tay"
					onChange={(e) => onChange(e.target.value)}
					style={inputStyle}
				/>
				<div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>⚠ {error}</div>
			</div>
		);
	}

	const list = rows || [];
	const hasCurrent = !value || list.some((r) => r.instance_id === value);

	return (
		<div style={{ marginTop: 4 }}>
			<select
				value={value ?? ''}
				onChange={(e) => onChange(e.target.value)}
				style={inputStyle}
			>
				<option value="">— Mọi instance ({list.length}) —</option>
				{!hasCurrent && value && (
					<option value={value}>{value} (không có trong registry)</option>
				)}
				{list.map((r) => (
					<option key={`${r.platform}_${r.instance_id}`} value={r.instance_id}>
						{r.label} · {r.instance_id}
					</option>
				))}
			</select>
			{list.length === 0 && (
				<div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
					Chưa có instance nào cho platform <code>{platform}</code>. Vào Channel Gateway để thêm.
				</div>
			)}
		</div>
	);
}
