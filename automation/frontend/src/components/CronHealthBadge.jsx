/**
 * Cron Health badge — polls `/cron-health` every 30s.
 *
 * Status mapping (matches BE-6.C `BizCity_Automation_REST::cron_health`):
 *   never_ran → grey
 *   healthy   → green (<5 min since last tick)
 *   degraded  → amber (<30 min)
 *   dead      → red (>30 min OR not scheduled)
 *
 * @since AUTOMATION BE-6 (2026-05-29)
 */
import { useEffect, useState } from 'react';
import { Heart, AlertTriangle, ShieldCheck } from 'lucide-react';
import { automationApi } from '../lib/api.js';

const POLL_MS = 30_000;

export default function CronHealthBadge() {
	const [data, setData] = useState(null);
	const [err, setErr]   = useState('');

	useEffect(() => {
		let stop = false;
		const tick = async () => {
			try {
				const res = await automationApi.cronHealth();
				if (!stop) { setData(res); setErr(''); }
			} catch (e) {
				if (!stop) { setData(null); setErr(e?.message || 'err'); }
			}
		};
		tick();
		const id = setInterval(tick, POLL_MS);
		return () => { stop = true; clearInterval(id); };
	}, []);

	const status = data?.status || (err ? 'unavailable' : 'loading');
	const cfg = STATUS_CFG[status] || STATUS_CFG.loading;
	const Icon = cfg.Icon;

	const title = err
		? `Cron health error: ${err}`
		: data
			? `Cron: ${status}\nLast tick: ${data.last_tick_age_s != null ? data.last_tick_age_s + 's trước' : 'chưa tick'}\nNext: ${data.next_run_in_s != null ? data.next_run_in_s + 's' : '—'}\nDISABLE_WP_CRON: ${data.disable_wp_cron ? 'true' : 'false'}`
			: 'Cron health: loading…';

	return (
		<span
			title={title}
			style={{
				display: 'inline-flex', alignItems: 'center', gap: 4,
				padding: '3px 8px', fontSize: 11, fontWeight: 600,
				color: cfg.fg, background: cfg.bg, border: `1px solid ${cfg.border}`,
				borderRadius: 12, cursor: 'help',
			}}
		>
			<Icon size={11} />
			Cron {status === 'loading' ? '…' : status}
		</span>
	);
}

const STATUS_CFG = {
	loading:   { fg: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', Icon: Heart },
	unavailable: { fg: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', Icon: AlertTriangle },
	never_ran: { fg: '#64748b', bg: '#f1f5f9', border: '#cbd5e1', Icon: Heart },
	healthy:   { fg: '#15803d', bg: '#dcfce7', border: '#86efac', Icon: ShieldCheck },
	degraded:  { fg: '#a16207', bg: '#fef9c3', border: '#fde68a', Icon: AlertTriangle },
	dead:      { fg: '#b91c1c', bg: '#fee2e2', border: '#fca5a5', Icon: AlertTriangle },
};
