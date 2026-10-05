/**
 * InboxLivePanel — Conversation-style live tail rendered inside RunTimeline
 * while "Chạy thử" is active (listening to bizcity-channel/v1/listener bus).
 *
 * Data source: builderStore.inboxEvents — populated by runner.startChannelListen
 * (subscribeListenerStream pushes every matching event regardless of capture).
 *
 * Visual mirrors `core/channel-gateway/.../components/chat/ConversationPanel.jsx`
 * (image 2 in user spec): assistant bubbles left, user bubbles right, timestamps,
 * `Hội thoại (N) [Polling]` header with refresh button.
 *
 * @since 2026-05-31 (port from PHASE-CG-LISTENER S2)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MessagesSquare, RefreshCw, Square, Send, Pause, Play, StepForward, RotateCcw } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore.js';
import { stopActiveListener, pauseListener, resumeListener, stepListener, replayEvent } from '../runtime/runner.js';
import { automationApi } from '../lib/api.js';

function liveBadgeStyle(st) {
	if (st === 'streaming') return { bg: '#dcfce7', fg: '#166534', label: '● LIVE' };
	if (st === 'polling')   return { bg: '#fef3c7', fg: '#854d0e', label: 'Polling' };
	if (st === 'connecting')return { bg: '#e0f2fe', fg: '#0369a1', label: 'Kết nối…' };
	if (st === 'error')     return { bg: '#fee2e2', fg: '#991b1b', label: 'Lỗi' };
	return { bg: '#e2e8f0', fg: '#475569', label: 'Idle' };
}

function fmtTs(ts) {
	if (!ts) return '—';
	try {
		const d = new Date(Number(ts) * 1000);
		return d.toLocaleTimeString('vi-VN', { hour12: false });
	} catch { return String(ts); }
}

export default function InboxLivePanel() {
	const events       = useBuilderStore((s) => s.inboxEvents);
	const status       = useBuilderStore((s) => s.listenStatus);
	const filter       = useBuilderStore((s) => s.listenFilter);
	const listenActive = useBuilderStore((s) => s.listenActive);
	const listenPaused = useBuilderStore((s) => s.listenPaused);
	const pausedSize   = useBuilderStore((s) => s.pausedQueueSize);
	const clearInbox   = useBuilderStore((s) => s.clearInboxEvents);
	const pushEvent    = useBuilderStore((s) => s.pushInboxEvent);
	const scrollRef = useRef(null);

	// Manual send-as-bot input state.
	const [draft, setDraft]     = useState('');
	const [sending, setSending] = useState(false);
	const [sendErr, setSendErr] = useState('');

	// PG-S7 — Conversation history preload state.
	const [historyLoading, setHistoryLoading] = useState(false);
	const [historyErr, setHistoryErr]         = useState('');
	const loadedHistoryRef                    = useRef(new Set()); // chat_ids already preloaded

	// Auto-scroll to bottom on new event.
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [events.length]);

	const badge = liveBadgeStyle(status);
	const sorted = useMemo(() => events.slice().sort((a, b) => (a.id || 0) - (b.id || 0)), [events]);

	// PG-S8 — when replay scrubber is active, hide bubbles after cursor.
	const replayCursorMs = useBuilderStore((s) => s.replayCursorMs);
	const runStartedAtMs = useBuilderStore((s) => s.runStartedAtMs);
	const visibleSorted  = useMemo(() => {
		if (replayCursorMs === null || !runStartedAtMs) return sorted;
		const limitMs = runStartedAtMs + replayCursorMs;
		return sorted.filter((ev) => {
			// History rows (synthesized id < 0) → always visible.
			if ((ev.id || 0) < 0) return true;
			const tsMs = (Number(ev.ts) || 0) * 1000; // ts is sec-precision from listener bus
			return tsMs <= limitMs;
		});
	}, [sorted, replayCursorMs, runStartedAtMs]);

	// Derive target chat_id from latest inbound event so admin can reply as bot.
	const targetEvent = useMemo(() => {
		for (let i = sorted.length - 1; i >= 0; i -= 1) {
			const ev = sorted[i];
			if ((ev.direction === 'in' || ev.kind === 'inbound') && ev.chat_id) return ev;
		}
		return null;
	}, [sorted]);
	const targetChatId   = targetEvent?.chat_id || '';
	const targetUserName = targetEvent?.user_id || targetEvent?.chat_id || '—';

	// Auto-preload last 50 messages of a conversation the first time we see
	// its chat_id during this listening session.
	useEffect(() => {
		if (!targetChatId) return;
		if (loadedHistoryRef.current.has(targetChatId)) return;
		loadedHistoryRef.current.add(targetChatId);

		let cancelled = false;
		(async () => {
			setHistoryLoading(true);
			setHistoryErr('');
			try {
				const res = await automationApi.conversationHistory(targetChatId, 50);
				if (cancelled) return;
				const list = Array.isArray(res?.events) ? res.events : [];
				for (const ev of list) pushEvent(ev);
			} catch (err) {
				if (!cancelled) setHistoryErr(err?.message || 'Lỗi tải lịch sử');
			} finally {
				if (!cancelled) setHistoryLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [targetChatId, pushEvent]);

	const reloadHistory = async () => {
		if (!targetChatId || historyLoading) return;
		loadedHistoryRef.current.delete(targetChatId);
		setHistoryLoading(true);
		setHistoryErr('');
		try {
			const res = await automationApi.conversationHistory(targetChatId, 50);
			const list = Array.isArray(res?.events) ? res.events : [];
			for (const ev of list) pushEvent(ev);
			loadedHistoryRef.current.add(targetChatId);
		} catch (err) {
			setHistoryErr(err?.message || 'Lỗi tải lịch sử');
		} finally {
			setHistoryLoading(false);
		}
	};

	const handleSend = async () => {
		const text = draft.trim();
		if (!text || !targetChatId || sending) return;
		setSending(true);
		setSendErr('');
		try {
			const res = await automationApi.channelSend(targetChatId, text);
			if (!res?.sent) {
				throw new Error(res?.error || 'send_failed');
			}
			// Push synthetic outbound bubble immediately (listener stream may also echo).
			pushEvent({
				id: `manual_${Date.now()}`,
				direction:  'out',
				kind:       'outbound',
				message:    text,
				chat_id:    targetChatId,
				platform:   res.platform || targetEvent?.platform || '',
				account_id: targetEvent?.account_id || '',
				ts:         Math.floor(Date.now() / 1000),
				_source:    'manual_send',
			});
			setDraft('');
		} catch (err) {
			setSendErr(err?.message || 'Lỗi gửi tin');
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const canSend = !!targetChatId && draft.trim().length > 0 && !sending;

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f172a', color: '#e2e8f0' }}>
			<div style={{
				display: 'flex', alignItems: 'center', justifyContent: 'space-between',
				padding: '6px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
			}}>
				<div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
					<MessagesSquare size={14} />
					<strong style={{ fontSize: 13 }}>Hội thoại ({events.length})</strong>
					<span style={{
						fontSize: 10, padding: '2px 8px', borderRadius: 10,
						background: badge.bg, color: badge.fg, fontWeight: 600,
					}}>{badge.label}</span>
					{filter?.platform && (
						<code style={{ color: '#7dd3fc', fontSize: 11 }}>
							{filter.platform}{filter.account_id ? ` · ${filter.account_id}` : ''}
						</code>
					)}
				</div>
				<div style={{ display: 'flex', gap: 6 }}>
					{listenActive && (
						<>
							{!listenPaused ? (
								<button type="button" onClick={pauseListener} className="aw-icon-btn"
									style={{ color: '#fbbf24', fontSize: 10, padding: '2px 6px' }}
									title="Tạm dừng — sự kiện mới sẽ buffer, không vào Inbox/MPR/Capture">
									<Pause size={13} />
								</button>
							) : (
								<>
									<button type="button" onClick={resumeListener} className="aw-icon-btn"
										style={{ color: '#86efac', fontSize: 10, padding: '2px 6px' }}
										title={`Tiếp tục — drain ${pausedSize} event đã buffer`}>
										<Play size={13} />
									</button>
									<button type="button" onClick={stepListener} disabled={pausedSize === 0}
										className="aw-icon-btn"
										style={{ color: pausedSize ? '#7dd3fc' : '#475569', fontSize: 10, padding: '2px 6px' }}
										title="Step — xử lý 1 event khỏi buffer">
										<StepForward size={13} />
									</button>
									{pausedSize > 0 && (
										<span style={{
											fontSize: 10, padding: '2px 6px', borderRadius: 8,
											background: '#fde68a', color: '#78350f', fontWeight: 600,
										}} title="Số event đang buffer">
											⏸ {pausedSize}
										</span>
									)}
								</>
							)}
						</>
					)}
					{targetChatId && (
						<button type="button" onClick={reloadHistory} disabled={historyLoading}
							className="aw-icon-btn"
							style={{ color: historyLoading ? '#475569' : '#7dd3fc', fontSize: 10, padding: '2px 6px' }}
							title="Tải lại 50 tin nhắn gần nhất">
							{historyLoading ? '⏳' : '⟲ Lịch sử'}
						</button>
					)}
					<button type="button" onClick={clearInbox} className="aw-icon-btn"
						style={{ color: '#cbd5e1' }} title="Xoá danh sách">
						<RefreshCw size={14} />
					</button>
					{listenActive && (
						<button type="button" onClick={() => stopActiveListener('user_stop')}
							className="aw-icon-btn" style={{ color: '#fca5a5' }} title="Dừng nghe">
							<Square size={14} />
						</button>
					)}
				</div>
			</div>

			<div ref={scrollRef} style={{
				flex: 1, overflowY: 'auto', padding: 10,
				background: '#0b1220', color: '#e2e8f0',
			}}>
				{(historyLoading || historyErr) && (
					<div style={{
						fontSize: 11, padding: '4px 8px', marginBottom: 6,
						borderRadius: 4, textAlign: 'center',
						background: historyErr ? '#7f1d1d' : '#0c4a6e',
						color:      historyErr ? '#fecaca' : '#bae6fd',
					}}>
						{historyErr ? `⚠ ${historyErr}` : '⏳ Đang tải lịch sử hội thoại…'}
					</div>
				)}
				{sorted.length === 0 ? (
					<div style={{
						color: '#64748b', textAlign: 'center', padding: 24, fontSize: 12,
					}}>
						{listenActive
							? 'Đang chờ tin nhắn… Hãy gửi 1 tin thật vào kênh hoặc dùng "Bắn payload mẫu (dev)" trong panel bên phải.'
							: 'Bấm "▶ Chạy thử" trên toolbar để bắt đầu nghe và xem hội thoại live tại đây.'}
					</div>
				) : visibleSorted.map((ev) => {
					const isInbound = ev.direction === 'in' || ev.kind === 'inbound';
					const isHistory = ev._source === 'history';
					const isDry     = !!(ev.meta && ev.meta.dry) || /^\[DRY\]/.test(String(ev.message || ''));
					return (
						<div key={ev.id} style={{
							display: 'flex',
							justifyContent: isInbound ? 'flex-end' : 'flex-start',
							marginBottom: 6,
							opacity: isHistory ? 0.72 : 1,
						}}>
							<div style={{
								maxWidth: '78%',
								padding: '6px 10px',
								borderRadius: 10,
								background: isDry ? '#3a2a14' : (isInbound ? '#14532d' : '#1e1b4b'),
								color:      isDry ? '#fed7aa' : (isInbound ? '#bbf7d0' : '#c7d2fe'),
								fontSize: 13,
								borderLeft: isHistory ? '3px solid #475569' : (isDry ? '3px solid #fb923c' : 'none'),
							}}>
								<div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
									{isDry && (
										<span style={{
											display: 'inline-block', fontSize: 9, fontWeight: 700,
											padding: '1px 5px', marginRight: 6, borderRadius: 3,
											background: '#fb923c', color: '#1c1410', verticalAlign: 'middle',
										}}>DRY</span>
									)}
									{ev.message || <em style={{ color: '#64748b' }}>(no text)</em>}
								</div>
							<div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
								{isHistory && <span style={{ color: '#94a3b8' }}>📜 </span>}
								{isInbound ? (ev.user_id || ev.chat_id || 'User') : 'Bot'}
								{' · '}
								{fmtTs(ev.ts)}
								{ev.account_id ? ` · acct ${ev.account_id}` : ''}
								{isInbound && listenActive && (
									<button type="button"
										onClick={(e) => { e.stopPropagation(); replayEvent(ev); }}
										title="Replay event này qua workflow hiện tại"
										style={{
											marginLeft: 4, padding: '1px 5px',
											fontSize: 10, lineHeight: 1, gap: 3,
											display: 'inline-flex', alignItems: 'center',
											border: '1px solid #334155', borderRadius: 4,
											background: '#0f172a', color: '#7dd3fc', cursor: 'pointer',
										}}>
										<RotateCcw size={10} /> Replay
									</button>
								)}
							</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Manual send-as-bot input — admin gửi tin dưới danh nghĩa bot. */}
			<div style={{
				borderTop: '1px solid #1e293b',
				padding: '8px 10px',
				background: '#0b1220',
				display: 'flex',
				flexDirection: 'column',
				gap: 6,
			}}>
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					fontSize: 11, color: '#94a3b8',
				}}>
					<span>
						Gửi tin với danh nghĩa <strong style={{ color: '#e2e8f0' }}>Bot</strong>
						{targetChatId && (
							<>
								{' → '}
								<span style={{ color: '#7dd3fc' }}>{targetUserName}</span>
							</>
						)}
					</span>
					{targetChatId && (
						<code style={{ color: '#64748b', fontSize: 10 }}>{targetChatId}</code>
					)}
				</div>
				<div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
					<textarea
						value={draft}
						onChange={(e) => setDraft(e.target.value)}
						onKeyDown={handleKeyDown}
						rows={2}
						placeholder={
							targetChatId
								? 'Nhập tin nhắn… (Enter để gửi, Shift+Enter xuống dòng)'
								: 'Chưa có hội thoại nào — đợi user nhắn để khoá chat_id rồi gửi.'
						}
						disabled={!targetChatId || sending}
						style={{
							flex: 1,
							resize: 'vertical',
							minHeight: 38,
							maxHeight: 140,
							padding: '6px 8px',
							borderRadius: 6,
							border: '1px solid #334155',
							background: '#0f172a',
							color: '#e2e8f0',
							fontSize: 13,
							fontFamily: 'inherit',
							outline: 'none',
						}}
					/>
					<button
						type="button"
						onClick={handleSend}
						disabled={!canSend}
						title="Gửi (Enter)"
						style={{
							display: 'inline-flex', alignItems: 'center', gap: 4,
							padding: '8px 12px',
							borderRadius: 6,
							border: '1px solid ' + (canSend ? '#0ea5e9' : '#334155'),
							background: canSend ? '#0284c7' : '#1e293b',
							color: canSend ? '#fff' : '#64748b',
							cursor: canSend ? 'pointer' : 'not-allowed',
							fontSize: 12,
							fontWeight: 600,
						}}
					>
						<Send size={13} />
						{sending ? 'Đang gửi…' : 'Gửi'}
					</button>
				</div>
				{sendErr && (
					<div style={{
						fontSize: 11, color: '#fca5a5',
						background: '#450a0a', border: '1px solid #7f1d1d',
						padding: '4px 8px', borderRadius: 4,
					}}>
						⚠ {sendErr}
					</div>
				)}
			</div>
		</div>
	);
}
