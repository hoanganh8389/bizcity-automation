/**
 * InboxRoute — Live tail webhook events for automation debugging.
 *
 * Mirrors `core/channel-gateway/.../ListenerRoute.jsx` but trimmed for the
 * automation app. Use this to verify webhook → Listener Bus pipeline is
 * delivering events BEFORE blaming the workflow runner. Filter by platform /
 * account_id to match exactly what a trigger node would receive.
 *
 * Subscribes to `bizcity-channel/v1/listener/{stream,feed}` (SSE → polling
 * fallback). Cùng tap data với "Chạy thử" → nếu Inbox thấy event mà runner
 * không capture, là logic match có vấn đề, không phải connectivity.
 *
 * @since 2026-05-31
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Pause, Play, RefreshCw, Trash2, Activity, Bot, Facebook, MessageSquare, Wand2 } from 'lucide-react';
import { subscribeListenerStream, fetchListenerFeed, listenerTestEmit } from '../lib/listenerStream.js';

const PLATFORM_OPTIONS = [
	{ value: '',          label: 'Tất cả nguồn' },
	{ value: 'ZALO_BOT',  label: 'Zalo Bot' },
	{ value: 'FB_MESS',   label: 'Facebook Messenger' },
	{ value: 'FB_FEED',   label: 'Facebook Page Feed' },
	{ value: 'WEBCHAT',   label: 'WebChat' },
	{ value: 'AUTOMATION', label: 'Automation Runner' },
];
const KIND_OPTIONS = [
	{ value: '',           label: 'Tất cả' },
	{ value: 'inbound',    label: 'Inbound' },
	{ value: 'outbound',   label: 'Outbound' },
	{ value: 'automation', label: 'Automation' },
	{ value: 'system',     label: 'System' },
];

function platformIcon(p) {
	if (p === 'ZALO_BOT')        return <Bot size={14} />;
	if (p === 'FB_MESS' || p === 'FB_FEED') return <Facebook size={14} />;
	if (p === 'WEBCHAT')         return <MessageSquare size={14} />;
	if (p === 'AUTOMATION')      return <Wand2 size={14} />;
	return <Activity size={14} />;
}
function formatTs(ts) {
	if (!ts) return '—';
	try {
		const d = new Date(ts * 1000);
		return d.toLocaleTimeString('vi-VN', { hour12: false });
	} catch { return String(ts); }
}

export default function InboxRoute() {
	const [paused, setPaused]       = useState(false);
	const [platform, setPlatform]   = useState('');
	const [kind, setKind]           = useState('');
	const [accountId, setAccountId] = useState('');
	const [search, setSearch]       = useState('');
	const [events, setEvents]       = useState([]);
	const [status, setStatus]       = useState('idle');
	const [picked, setPicked]       = useState(null);
	const eventsRef = useRef([]);

	const filters = useMemo(() => {
		const f = {};
		if (platform)  f.platform   = platform;
		if (kind)      f.kind       = kind;
		if (accountId) f.account_id = accountId;
		if (search.trim()) f.q      = search.trim();
		return f;
	}, [platform, kind, accountId, search]);

	const filtersKey = JSON.stringify(filters);

	useEffect(() => {
		if (paused) return undefined;
		// Initial backfill so user doesn't see empty pane on mount.
		fetchListenerFeed(filters, 0, 100).then((data) => {
			if (Array.isArray(data?.events)) {
				eventsRef.current = data.events.slice(-250);
				setEvents([...eventsRef.current]);
			}
		}).catch(() => {});

		const stop = subscribeListenerStream({
			filters,
			onStatus: setStatus,
			onEvent: (ev) => {
				eventsRef.current = eventsRef.current.concat(ev).slice(-250);
				setEvents([...eventsRef.current]);
			},
		});
		return () => { try { stop(); } catch (_) {} };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filtersKey, paused]);

	const reversed = useMemo(() => events.slice().reverse(), [events]);
	const counts = useMemo(() => {
		const c = { inbound: 0, outbound: 0, automation: 0, system: 0 };
		events.forEach((e) => { if (c[e.kind] !== undefined) c[e.kind] += 1; });
		return c;
	}, [events]);

	const clearLocal = () => { eventsRef.current = []; setEvents([]); };
	const testEmit = async () => {
		try {
			await listenerTestEmit({ message: '[Automation Inbox] test @ ' + new Date().toLocaleTimeString('vi-VN') });
		} catch (_) {}
	};

	return (
		<div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, height: 'calc(100vh - 70px)' }}>
			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<Link to="/" className="aw-btn aw-btn-outline"><ArrowLeft size={14} /> Danh sách</Link>
					<h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Inbox · Webhook live tail</h1>
					<span style={{
						fontSize: 11, padding: '2px 8px', borderRadius: 10,
						background: status === 'streaming' ? '#dcfce7' : status === 'polling' ? '#fef3c7' : status === 'error' ? '#fee2e2' : '#e2e8f0',
						color: status === 'streaming' ? '#166534' : status === 'polling' ? '#854d0e' : status === 'error' ? '#991b1b' : '#475569',
					}}>
						{status === 'streaming' ? 'SSE live' : status === 'polling' ? 'Polling 2s' : status === 'connecting' ? 'Đang kết nối…' : status === 'error' ? 'Lỗi' : 'Idle'}
					</span>
				</div>
				<div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
					<button type="button" onClick={() => setPaused((p) => !p)} className="aw-btn aw-btn-outline">
						{paused ? <><Play size={14} /> Tiếp tục</> : <><Pause size={14} /> Pause</>}
					</button>
					<button type="button" onClick={testEmit} className="aw-btn aw-btn-outline">
						<RefreshCw size={14} /> Test emit
					</button>
					<button type="button" onClick={clearLocal} className="aw-btn aw-btn-outline">
						<Trash2 size={14} /> Xoá buffer
					</button>
				</div>
			</div>

			<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
				<label style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
					Nguồn
					<select value={platform} onChange={(e) => setPlatform(e.target.value)} className="aw-input">
						{PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
				</label>
				<label style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
					Hướng
					<select value={kind} onChange={(e) => setKind(e.target.value)} className="aw-input">
						{KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
					</select>
				</label>
				<label style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
					Account ID (bot / page)
					<input value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="— tất cả —" className="aw-input" />
				</label>
				<label style={{ fontSize: 11, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 2 }}>
					Tìm trong message
					<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="substring…" className="aw-input" />
				</label>
			</div>

			<div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
				<span>Buffer {events.length}/250</span>
				<span>· In {counts.inbound}</span>
				<span>· Out {counts.outbound}</span>
				<span>· Automation {counts.automation}</span>
			</div>

			<div style={{ display: 'flex', gap: 8, flex: 1, minHeight: 0 }}>
				<div style={{ flex: picked ? 0.55 : 1, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff' }}>
					<table style={{ width: '100%', fontSize: 12 }}>
						<thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
							<tr style={{ textAlign: 'left' }}>
								<th style={th}>Thời gian</th>
								<th style={th}>Nguồn</th>
								<th style={th}>Chat ID</th>
								<th style={th}>Direction</th>
								<th style={th}>Message</th>
							</tr>
						</thead>
						<tbody>
							{reversed.length === 0 && (
								<tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
									Chưa có event. Gửi 1 tin vào Zalo/FB hoặc bấm "Test emit" để xác nhận pipeline.
								</td></tr>
							)}
							{reversed.map((ev) => (
								<tr key={ev.id} onClick={() => setPicked(ev)}
									style={{ borderTop: '1px solid #f1f5f9', cursor: 'pointer', background: picked?.id === ev.id ? '#eff6ff' : 'transparent' }}>
									<td style={td}><code style={{ fontSize: 11 }}>{formatTs(ev.ts)}</code></td>
									<td style={td}>
										<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
											{platformIcon(ev.platform)} {ev.platform}
										</span>
										<div style={{ fontSize: 10, color: '#94a3b8' }}>acct: {ev.account_id || '—'}</div>
									</td>
									<td style={td}><code style={{ fontSize: 11 }}>{ev.chat_id || '—'}</code></td>
									<td style={td}>
										<span style={{
											fontSize: 10, padding: '1px 6px', borderRadius: 3,
											background: ev.direction === 'in' ? '#dbeafe' : ev.direction === 'out' ? '#fef3c7' : '#e2e8f0',
											color: ev.direction === 'in' ? '#1e40af' : ev.direction === 'out' ? '#854d0e' : '#475569',
										}}>{ev.kind} {ev.direction ? `· ${ev.direction}` : ''}</span>
									</td>
									<td style={{ ...td, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
										{ev.message || <em style={{ color: '#94a3b8' }}>(no text)</em>}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{picked && (
					<div style={{ flex: 0.45, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', padding: 12 }}>
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
							<strong style={{ fontSize: 13 }}>Event #{picked.id}</strong>
							<button type="button" onClick={() => setPicked(null)} className="aw-btn aw-btn-outline">×</button>
						</div>
						<pre style={{
							fontSize: 11, background: '#0f172a', color: '#cbd5e1',
							padding: 10, borderRadius: 6, overflow: 'auto', margin: 0,
						}}>{JSON.stringify(picked, null, 2)}</pre>
					</div>
				)}
			</div>
		</div>
	);
}

const th = { padding: '6px 10px', fontWeight: 600, fontSize: 11, color: '#64748b', textTransform: 'uppercase' };
const td = { padding: '6px 10px', verticalAlign: 'top' };
