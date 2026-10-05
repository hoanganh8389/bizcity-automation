/**
 * ReplayScrubber — PG-S8
 *
 * Time slider hiển thị sau khi run kết thúc. User kéo slider → nodeStatus,
 * inbox bubbles, MPR turns rewind tới thời điểm tương ứng (ms offset từ
 * runStartedAtMs).
 *
 * Logic:
 *  - Visible khi !isRunning && runLogRows.length >= 2 && runStartedAtMs/finishedAtMs.
 *  - Cursor null = realtime (final state). Cursor số = scrub mode.
 *  - Tick markers = mỗi log row position theo ms.
 */
import { useMemo } from 'react';
import { useBuilderStore } from '../store/builderStore.js';
import { Play, RotateCcw } from 'lucide-react';

export default function ReplayScrubber() {
	const isRunning      = useBuilderStore((s) => s.isRunning);
	const startedAt      = useBuilderStore((s) => s.runStartedAtMs);
	const finishedAt     = useBuilderStore((s) => s.runFinishedAtMs);
	const logRows        = useBuilderStore((s) => s.runLogRows);
	const cursor         = useBuilderStore((s) => s.replayCursorMs);
	const setCursor      = useBuilderStore((s) => s.setReplayCursor);

	const duration = useMemo(() => {
		if (!startedAt) return 0;
		const end = finishedAt || (logRows.length ? Math.max(...logRows.map((r) => r.ts)) : startedAt);
		return Math.max(0, end - startedAt);
	}, [startedAt, finishedAt, logRows]);

	const ticks = useMemo(() => {
		if (!startedAt || !duration) return [];
		return logRows
			.filter((r) => r.ts >= startedAt)
			.map((r) => ({
				offset: r.ts - startedAt,
				node_id: r.node_id,
				status: r.status,
			}));
	}, [logRows, startedAt, duration]);

	if (isRunning || !startedAt || logRows.length < 2 || duration <= 0) {
		return null;
	}

	const value     = cursor === null ? duration : cursor;
	const isReplay  = cursor !== null;
	const formatMs  = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

	const handleChange = (e) => {
		const v = Number(e.target.value);
		setCursor(v >= duration ? null : v);
	};

	return (
		<div style={{
			display: 'flex', alignItems: 'center', gap: 8,
			padding: '6px 12px', borderTop: '1px solid #1e293b',
			background: '#0b1220', fontSize: 11, color: '#94a3b8',
		}}>
			<span style={{ minWidth: 70, color: isReplay ? '#fbbf24' : '#7dd3fc', fontWeight: 600 }}>
				{isReplay ? '⏪ replay' : '▶ live'}
			</span>
			<span style={{ minWidth: 50, fontFamily: 'monospace' }}>0ms</span>
			<div style={{ flex: 1, position: 'relative', height: 20 }}>
				{/* Tick markers */}
				<div style={{
					position: 'absolute', inset: 0, pointerEvents: 'none',
				}}>
					{ticks.map((t, i) => {
						const pct = duration ? (t.offset / duration) * 100 : 0;
						const color = t.status === 1 ? '#22c55e'
							: t.status === 2 ? '#ef4444'
							: t.status === 3 ? '#64748b'
							: '#fbbf24';
						return (
							<div key={`${t.node_id}-${i}`} title={`${t.node_id} · ${formatMs(t.offset)}`}
								style={{
									position: 'absolute', left: `${pct}%`, top: 6,
									width: 4, height: 8, background: color, borderRadius: 1,
									transform: 'translateX(-50%)',
								}} />
						);
					})}
				</div>
				<input
					type="range"
					min={0}
					max={duration}
					step={Math.max(1, Math.floor(duration / 200))}
					value={value}
					onChange={handleChange}
					style={{ width: '100%', accentColor: '#7dd3fc', position: 'relative', zIndex: 1 }}
				/>
			</div>
			<span style={{ minWidth: 60, fontFamily: 'monospace', textAlign: 'right' }}>
				{formatMs(duration)}
			</span>
			<span style={{
				minWidth: 70, textAlign: 'right', fontFamily: 'monospace',
				color: isReplay ? '#fbbf24' : '#7dd3fc',
			}}>
				{formatMs(value)}
			</span>
			<button type="button" onClick={() => setCursor(null)}
				className="aw-icon-btn"
				disabled={!isReplay}
				title="Về realtime (final state)"
				style={{ color: isReplay ? '#7dd3fc' : '#475569' }}>
				<Play size={14} />
			</button>
			<button type="button" onClick={() => setCursor(0)}
				className="aw-icon-btn"
				title="Tua về đầu"
				style={{ color: '#cbd5e1' }}>
				<RotateCcw size={14} />
			</button>
		</div>
	);
}
