/**
 * BE-7.E — Realtime workflow runner.
 *
 * "Chạy thử" UX flow:
 *   1. POST /workflows/:id/run?async=1  →  { run_id }
 *   2. Open EventSource('/runs/:id/events')
 *   3. SSE 'log' events → store.setNodeStatus(node_id, status, output)
 *      + pushLog() (level: run/ok/error/skip)
 *   4. SSE 'end' event → store.endRun({ runStatus, runError })
 *
 * Fallback (workflow chưa lưu DB → meta.id === 'wf_new' hoặc not numeric):
 * runs the legacy MOCK BFS với `block.simulate()` để user xem được luồng
 * chạy ngay cả khi workflow chưa save. Mock vẫn populate nodeStatus +
 * nodeOutputs để node hiển thị spinner / check / X giống real run.
 */
import { BLOCKS_BY_ID } from '../blocks/registry.js';
import { useBuilderStore } from '../store/builderStore.js';
import { BOOT } from '../lib/boot.js';
import { api, runsApi } from '../lib/api.js';
import { subscribeListenerStream } from '../lib/listenerStream.js';

// Verbose tracing — set window.__AW_TRACE__ = false in console to silence.
if (typeof window !== 'undefined' && window.__AW_TRACE__ === undefined) {
	window.__AW_TRACE__ = true;
}
function trace(scope, msg, extra) {
	if (typeof window === 'undefined' || !window.__AW_TRACE__) return;
	const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false }) + '.' + String(Date.now() % 1000).padStart(3, '0');
	// eslint-disable-next-line no-console
	console.log(`%c[AW ${ts}][${scope}]%c ${msg}`,
		'color:#0ea5e9;font-weight:600', 'color:inherit',
		extra !== undefined ? extra : '');
}

// Map BE log status int → FE level + label.
const STATUS_MAP = {
	0: { level: 'run',   icon: '⏳', label: 'running' },
	1: { level: 'ok',    icon: '✓',  label: 'ok' },
	2: { level: 'error', icon: '✗',  label: 'fail' },
	3: { level: 'info',  icon: '⤼',  label: 'skip' },
};

export function isPersistedWorkflow(meta) {
	if (!meta) return false;
	const id = meta.id;
	return Number.isInteger(id) || (typeof id === 'string' && /^\d+$/.test(id));
}

// Trigger codes that are event-driven — "Chạy thử" should listen, not run.
const LISTEN_FIRST_CODES = new Set([
	'zalo_inbound', 'fb_message', 'fb_comment', 'telegram_inbound',
	'webhook', 'twinbrain_intent', 'twinbrain_turn_completed', 'twinbrain_tool_decided',
	'bot_turn_completed',
]);

export function isListenFirstTrigger(node) {
	const code = String(node?.data?.blockId || '').replace(/^trigger\./, '');
	return LISTEN_FIRST_CODES.has(code);
}

/**
 * Map automation trigger code → bizcity-channel listener stream filter.
 * Only platform-bound triggers surface through Listener Bus. Other event-driven
 * triggers (webhook/twinbrain_*) fall back to the legacy transient listener.
 */
const TRIGGER_TO_CHANNEL_FILTER = {
	zalo_inbound:     { platform: 'ZALO_BOT', kind: 'inbound' },
	fb_message:       { platform: 'FB_MESS',  kind: 'inbound' },
	fb_comment:       { platform: 'FB_FEED',  kind: 'inbound' },
	telegram_inbound: { platform: 'TELEGRAM', kind: 'inbound' },
};

const KEYWORD_SPLIT_RE = /[\|,;；，｜•\r\n]+/u;

function normalizeMatchText(input) {
	return String(input || '')
		.toLocaleLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();
}

function extractMatchTerms(raw) {
	const chunks = Array.isArray(raw) ? raw : [raw];
	const out = [];
	const seen = new Set();
	for (const chunk of chunks) {
		for (const token of String(chunk || '').split(KEYWORD_SPLIT_RE)) {
			const term = normalizeMatchText(token);
			if (!term || seen.has(term)) continue;
			seen.add(term);
			out.push(term);
		}
	}
	return out;
}

function matchTermsByMode(haystack, terms, mode = 'keyword_contains') {
	if (!haystack || !Array.isArray(terms) || terms.length === 0) return false;
	const normalizedMode = String(mode || 'keyword_contains').trim().toLowerCase();

	if (normalizedMode === 'keyword_exact') {
		return terms.some((term) => term && haystack === term);
	}

	if (normalizedMode === 'keyword_start') {
		return terms.some((term) => term && haystack.startsWith(term));
	}

	// default: keyword_contains
	return terms.some((term) => term && haystack.includes(term));
}

function resolveEventAccountId(ev) {
	const direct = String(ev?.account_id || '').trim();
	if (direct) return direct;

	const chatId = String(ev?.chat_id || '').trim();
	if (chatId.startsWith('zalobot_')) {
		const parts = chatId.split('_');
		if (parts.length >= 3 && parts[1]) {
			return String(parts[1]).trim();
		}
	}

	return '';
}

function resolveEventMessageId(ev) {
	const m = ev?.meta || {};
	return String(m.message_id || m.mid || '').trim();
}

function normalizeSignaturePart(value) {
	return String(value || '')
		.trim()
		.toLocaleLowerCase();
}

function buildTriggerSignature({ platform = '', accountId = '', chatId = '', messageId = '', message = '' }) {
	const sig = [
		normalizeSignaturePart(platform),
		normalizeSignaturePart(accountId),
		normalizeSignaturePart(chatId),
		normalizeSignaturePart(messageId),
		normalizeSignaturePart(message),
	].join('|');
	return sig && sig !== '||||' ? sig : '';
}

// Active listener singleton — only ONE listen session at a time, owned by Toolbar.
let activeListener = null; // { stop:fn, triggerCode, nodeId }

// PG-S5 — Soft pause/step gate. When listenPaused=true, onEvent buffers events
// here instead of routing to inbox/twin/capture. resumeListener() drains all,
// stepListener() drains 1.
let pausedQueue = [];                // FIFO of buffered events
let activeProcessFn = null;          // bound to startChannelListen's handleEvent

function syncPausedQueueSize() {
	try { useBuilderStore.getState().setPausedQueueSize(pausedQueue.length); } catch (_) { /* noop */ }
}

export function resumeListener() {
	const store = useBuilderStore.getState();
	store.setListenPaused(false);
	const fn = activeProcessFn;
	if (!fn) { pausedQueue = []; syncPausedQueueSize(); return; }
	const drained = pausedQueue.slice();
	pausedQueue = [];
	syncPausedQueueSize();
	(async () => {
		for (const ev of drained) {
			try { await fn(ev); } catch (_) { /* per-event isolated */ }
		}
	})();
}

export function pauseListener() {
	useBuilderStore.getState().setListenPaused(true);
}

export async function stepListener() {
	if (pausedQueue.length === 0 || !activeProcessFn) return false;
	const ev = pausedQueue.shift();
	syncPausedQueueSize();
	try { await activeProcessFn(ev); } catch (_) { /* noop */ }
	return true;
}

export function getActiveListener() { return activeListener; }

/**
 * PG-S6 — Replay a captured/historical event through the current workflow.
 *
 * Re-fires runWithCapturedPayload() with a fresh payload built from the event.
 * Requires an active listener (workflow id derived from activeListener.workflowId).
 * Pause/stop state is irrelevant — replay is an explicit user action.
 *
 * @param {object} ev  Listener-bus-shaped event (id, platform, chat_id, message, ...)
 * @return {Promise<void>}
 */
export async function replayEvent(ev) {
	const store = useBuilderStore.getState();
	if (!ev) return;
	if (!activeListener || !activeListener.workflowId) {
		store.pushLog({ level: 'warn', msg: '⚠ Replay cần đang có phiên "Chạy thử" — bấm ▶ trước rồi replay.' });
		return;
	}
	const triggerCode = activeListener.triggerCode;
	const payload = {
		trigger_code:       triggerCode,
		source:             'replay.user_action',
		platform:           ev.platform,
		account_id:         ev.account_id,
		user_id:            ev.user_id,
		chat_id:            ev.chat_id,
		message:            ev.message,
		text:               ev.message,
		direction:          ev.direction,
		event_type:         ev.event_type,
		meta:               Object.assign({}, ev.meta || {}, { replay: true, original_event_id: ev.id }),
		ts:                 Math.floor(Date.now() / 1000),
		listener_event_id:  ev.id,
		character_id:       ev.character_id,
	};
	store.pushLog({
		level: 'info',
		msg:   `↻ Replay event #${ev.id} · ${ev.platform || ''} · "${(ev.message || '').slice(0, 60)}"`,
	});
	try { await runWithCapturedPayload(activeListener.workflowId, payload); }
	catch (_) { /* logged inside */ }
}

export function stopActiveListener(reason = 'user_stop') {
	if (!activeListener) return;
	const l = activeListener;
	activeListener = null;
	try { l.stop(reason); } catch (_) { /* noop */ }
}

function buildSseUrl(runId) {
	const base = String(BOOT.restUrl || '').replace(/\/+$/, '');
	const url = `${base}/runs/${encodeURIComponent(runId)}/events?max_seconds=60`;
	// EventSource cannot send custom headers; pass nonce via query for REST permission_callback.
	return BOOT.restNonce ? `${url}&_wpnonce=${encodeURIComponent(BOOT.restNonce)}` : url;
}

/** Public entry — triggered by Toolbar "▶ Chạy thử" button. */
export async function runWorkflow() {
	const store = useBuilderStore.getState();
	if (store.isRunning) return;

	const { nodes, meta } = store;
	const triggers = nodes.filter((n) => n.type === 'trigger');
	if (triggers.length === 0) {
		store.startRun();
		store.pushLog({ level: 'error', msg: 'Workflow chưa có trigger node — không thể chạy.' });
		store.endRun({ runStatus: 'fail', runError: 'no_trigger' });
		return;
	}

	// Listen-first: trigger event-driven (zalo/fb/telegram). Toolbar "Chạy thử"
	// now subscribes DIRECTLY to bizcity-channel Listener Bus stream — no
	// separate "Bắt đầu nghe" click required. Capture xong sẽ tự execute SSE.
	const listenTrigger = triggers.find(isListenFirstTrigger);
	if (listenTrigger) {
		if (!isPersistedWorkflow(meta)) {
			alert('Workflow chưa lưu — hãy bấm "Lưu" trước khi chạy thử với trigger event-driven.');
			return;
		}
		store.select(listenTrigger.id);
		startChannelListen(listenTrigger, meta);
		return;
	}

	store.startRun();

	if (isPersistedWorkflow(meta)) {
		try {
			await runReal(meta.id);
			return;
		} catch (err) {
			store.pushLog({
				level: 'error',
				msg: '✗ REST error: ' + (err?.message || err) + ' — fallback sang MOCK.',
			});
		}
	} else {
		store.pushLog({
			level: 'info',
			msg: 'ℹ Workflow chưa lưu — chạy mock cục bộ. Lưu workflow để chạy thật + xem realtime.',
		});
	}

	await runMock();
}

/** Real BE execution: POST /workflows/:id/run?async=1 → SSE. */
async function runReal(workflowId) {
	const store = useBuilderStore.getState();
	const dry   = !!store.dryRun;
	const qs    = dry ? '&dry=1' : '';
	store.setRunMeta({ runMode: 'async' });
	store.pushLog({ level: 'info', msg: `▶ POST /workflows/${workflowId}/run?async=1${qs}${dry ? ' · DRY-RUN' : ''}` });

	let runId;
	try {
		const res = await api.post(`/workflows/${workflowId}/run?async=1${qs}`, {
			_test: true,
			source: 'builder.try',
			_dry_run: dry || undefined,
		});
		runId = res?.run_id || res?.data?.run_id;
		if (!runId) throw new Error('no run_id in response');
	} catch (err) {
		store.endRun({ runStatus: 'fail', runError: String(err?.message || err) });
		throw err;
	}

	store.setRunMeta({ runDbId: runId });
	store.pushLog({ level: 'info', msg: `✓ run_id=${runId} — đang stream SSE…` });

	await streamSse(runId);
}

/**
 * Subscribe to bizcity-channel/v1/listener/stream and run workflow on first
 * matching inbound event. This is the SINGLE entry point for "Chạy thử" with
 * event-driven triggers. Driven entirely by Toolbar — TestListenPanel no
 * longer owns this flow (per PHASE-0-DOC-CHANNEL-LISTENING §2 — Listener Bus
 * is the canonical live tail).
 *
 * Trigger filter mapping: see TRIGGER_TO_CHANNEL_FILTER.
 * For triggers not in the map (webhook / twinbrain_*) we fall back to the
 * transient listener API (legacy path through automationApi.listenStart).
 */
export function startChannelListen(triggerNode, meta) {
	stopActiveListener('replaced');

	const store = useBuilderStore.getState();
	const triggerCode = String(triggerNode?.data?.blockId || '').replace(/^trigger\./, '');
	const filter      = TRIGGER_TO_CHANNEL_FILTER[triggerCode];
	const accountId   = String(triggerNode?.data?.instance_id || '').trim();

	if (!filter) {
		// Not surfaced through channel listener bus — show explicit hint.
		store.startRun();
		if (triggerNode?.id) store.setNodeStatus(triggerNode.id, 0);
		store.pushLog({
			level: 'info',
			msg:   `⏳ Trigger '${triggerCode}' chưa support listen qua Listener Bus. Dùng "Bắn payload mẫu" trong panel bên phải để test.`,
		});
		// Mark as listener with no-op stop so Toolbar shows "Dừng nghe".
		activeListener = { triggerCode, nodeId: triggerNode?.id, stop: () => store.endRun({ runStatus: 'skip' }) };
		store.setRunMeta({ listenActive: true, listenTriggerCode: triggerCode });
		return;
	}

	store.startRun();
	store.clearInboxEvents();
	store.clearTwinEvents();
	store.clearTraceEvents();
	store.setRunMeta({
		listenActive: true,
		listenTriggerCode: triggerCode,
		listenFilter: { platform: filter.platform, kind: filter.kind, account_id: accountId || '' },
	});
	// Trigger node enters "listening" state — show spinner badge until message arrives.
	if (triggerNode?.id) {
		store.setNodeStatus(triggerNode.id, 0);
	}
	store.pushLog({
		level: 'info',
		msg:   `📡 Nghe kênh ${filter.platform}${accountId ? ' · ' + accountId : ''} — gửi 1 tin thật vào kênh, workflow sẽ tự chạy step-by-step khi capture.`,
	});

	let stopped     = false;
	let captured    = false; // first-wins guard — chỉ chạy workflow 1 lần / phiên nghe
	let hilCollecting = false; // [2026-08-16 Johnny Chu] PHASE-3-HIL-TRACE — after HIL opens, accept slot answers even when they do not contain the trigger keyword.
	const claimedEventIds   = new Set();
	const claimedMessageIds = new Set();
	const claimedSigs       = new Set();

	// [2026-07-06 Johnny Chu] PHASE-IMG-TPL — keep FE listener gate in-sync with BE matcher:
	// split multi-delimiter terms + accent-insensitive contains.
	const keywordTerms = extractMatchTerms(triggerNode?.data?.keywords);
	const filterTerms  = extractMatchTerms(triggerNode?.data?.filter);
	const mode         = String(triggerNode?.data?.mode || 'keyword_contains').trim().toLowerCase();
	const matchTerms   = Array.from(new Set([ ...keywordTerms, ...filterTerms ]));

	let unsubscribe = null;

	const cleanup = (reason) => {
		stopped = true;
		if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
		// PG-S5 — clear pause/step state when listener stops.
		activeProcessFn = null;
		pausedQueue = [];
		syncPausedQueueSize();
		useBuilderStore.getState().setListenPaused(false);
		store.setRunMeta({ listenActive: false, listenTriggerCode: '', listenFilter: null });
		store.setListenStatus('idle');
		if (activeListener && activeListener.nodeId === triggerNode?.id) activeListener = null;
		if (reason && reason !== 'captured') {
			store.pushLog({ level: 'info', msg: `⏹ Dừng nghe (${reason}).` });
			store.endRun({ runStatus: 'skip', runError: reason });
		}
	};

	activeListener = {
		triggerCode,
		nodeId: triggerNode?.id,
		workflowId: meta.id, // PG-S6 — used by replayEvent()
		stop: cleanup,
	};

	// PG-S3 — subscribe to BOTH inbound channel events AND twin events.
	// Twin kind bypasses platform/account/user/chat filters server-side.
	// CSV filter supported by BizCity_Listener_Bus::tail() since 2026-05-31.
	const subFilters = {
		platform: filter.platform,
		kind:     `${filter.kind},twin,automation`,
		access_workflow_id: meta.id,
	};
	if (accountId) subFilters.account_id = accountId;

	// PG-S5 — Extracted handler so pausedQueue drain (resume/step) can re-invoke.
	const handleEvent = async (ev) => {
		trace('listener', `event id=${ev.id} platform=${ev.platform} kind=${ev.kind} dir=${ev.direction} chat=${ev.chat_id} acct=${ev.account_id}`, ev);
		// PG-S4 — every event into raw trace (merged timeline).
		store.pushTraceEvent(ev);
		// PG-S3 — Twin Event Bus mirror routes to MPR pane, NOT inbox.
		if (ev?.kind === 'twin') {
			store.pushTwinEvent(ev);
			return;
		}
		// [2026-07-27 Johnny Chu] PHASE-LISTEN-DEDUP — automation events may carry matcher-claimed
		// trigger identity. If it matches current session, stream existing run and skip manual POST.
		if (ev?.kind === 'automation') {
			const m = ev?.meta || {};
			const claimTriggerCode = String(m.trigger_code || '').trim();
			const claimRunId = String(ev?.run_id || '').trim();
			const claimWorkflowId = Number(ev?.workflow_id || 0);
			const claimEventId = Number(m.trigger_listener_event_id || 0);
			const claimMessageId = String(m.trigger_message_id || '').trim();
			const claimSig = String(m.trigger_signature || '').trim();

			if (claimWorkflowId > 0 && String(claimWorkflowId) === String(meta.id) && (claimTriggerCode === triggerCode || claimTriggerCode === '')) {
				if (claimEventId > 0) claimedEventIds.add(claimEventId);
				if (claimMessageId) claimedMessageIds.add(claimMessageId);
				if (claimSig) claimedSigs.add(claimSig);

				if (!captured && claimRunId && (claimEventId > 0 || claimMessageId || claimSig)) {
					captured = true;
					store.setRunMeta({ runMode: 'async', runDbId: claimRunId });
					store.pushLog({
						level: 'ok',
						msg: `✓ Matcher đã claim inbound này (run_id=${claimRunId}) — bỏ qua POST tay, chuyển sang stream run hiện có.`,
					});
					trace('listener', 'matcher-claimed run detected from automation stream', { run_id: claimRunId, trigger_code: claimTriggerCode });
					streamRun(claimRunId);
				}
			}
			return;
		}
		// Always feed the live inbox panel, regardless of capture state.
		store.pushInboxEvent(ev);
		// Defensive filter (server already filters, but be paranoid).
		if (ev?.kind !== filter.kind) { trace('listener', `skip — kind mismatch (got ${ev?.kind}, want ${filter.kind})`); return; }
		if (filter.platform && ev.platform !== filter.platform) { trace('listener', 'skip — platform mismatch'); return; }
		const evAccountId = resolveEventAccountId(ev);
		if (accountId && evAccountId !== accountId) {
			trace('listener', `skip — account mismatch (got ${evAccountId || '(empty)'}, want ${accountId})`);
			return;
		}
		if (captured) { trace('listener', `skip — already captured (id=${ev.id})`); return; }

		const evMessageId = resolveEventMessageId(ev);
		const evSignature = buildTriggerSignature({
			platform: ev?.platform,
			accountId: evAccountId || ev?.account_id || '',
			chatId: ev?.meta?.conversation_chat_id || ev?.chat_id || '',
			messageId: evMessageId,
			message: ev?.message || '',
		});
		if ((Number(ev?.id || 0) > 0 && claimedEventIds.has(Number(ev.id)))
			|| (evMessageId && claimedMessageIds.has(evMessageId))
			|| (evSignature && claimedSigs.has(evSignature))) {
			captured = true;
			trace('listener', 'skip capture — matcher already claimed this inbound', { id: ev?.id, message_id: evMessageId });
			store.pushLog({
				level: 'info',
				msg: `⏭ Matcher đã claim tin #${ev?.id || ''}${evMessageId ? ` (message_id=${evMessageId})` : ''} — bỏ qua POST run thứ hai.`,
			});
			return;
		}

		// PG-S9-fix v4 — gate media-only events. Real matcher (Logic 1) đã stash
		// ảnh + reply hỏi "muốn làm gì" trên turn này. Nếu FE auto-fire workflow
		// ngay → consume_attachment thấy pending rỗng vì matcher chạy song song
		// và Pending_State chưa set xong. Skip để turn TEXT kế tiếp mới fire,
		// lúc đó pending đã sẵn sàng.
		const evType = String(ev.event_type || '').toLowerCase();
		const msgTxt = String(ev.message || '').trim();
		const isMediaPlaceholder = /^\[message\.(image|video|audio|file|sticker|gif)\.received\]$/i.test(msgTxt);
		const isMediaOnly = ['image','video','audio','file','sticker','gif'].includes(evType)
			&& (msgTxt === '' || isMediaPlaceholder);
		if (isMediaOnly) {
			trace('listener', `skip — media-only event, đợi turn text`, { id: ev.id, event_type: evType });
			store.pushLog({
				level: 'info',
				msg:   `📎 Bắt được ${evType.toUpperCase()} (event #${ev.id}) — Matcher đã lưu ảnh + hỏi "muốn làm gì". Đợi user gõ text để workflow tự fire.`,
			});
			return;
		}

		// Keyword/filter gate mirrors BE matcher exactly.
		// If both keywords[] and filter exist, accept when ANY side matches (OR).
		if (matchTerms.length > 0 && !hilCollecting) {
			const haystack = normalizeMatchText(msgTxt);
			const keywordMatched = keywordTerms.length > 0
				? matchTermsByMode(haystack, keywordTerms, mode)
				: false;
			const filterMatched = filterTerms.length > 0
				? filterTerms.some((term) => haystack.includes(term))
				: false;
			let accepted = false;
			if (keywordTerms.length > 0 && filterTerms.length > 0) {
				accepted = keywordMatched || filterMatched;
			} else if (keywordTerms.length > 0) {
				accepted = keywordMatched;
			} else {
				accepted = filterMatched;
			}
			if (!accepted) {
				trace('listener', `skip — keyword not matched (msg="${msgTxt.slice(0,60)}")`, { terms: matchTerms });
				store.pushLog({
					level: 'info',
					msg:   `⏭ Bỏ qua tin "${(ev.message || '').slice(0, 60)}" — không khớp từ khoá trigger (${matchTerms.join(', ')})`,
				});
				return;
			}
		}

		captured = true;
		trace('listener', `✓ CAPTURED — fire workflow run`, { event_id: ev.id, message: ev.message });
		const payload = {
			trigger_code:       triggerCode,
			source:             'channel.listener.stream',
			platform:           ev.platform,
			account_id:         ev.account_id,
			user_id:            ev.user_id,
			chat_id:            ev.chat_id,
			// [2026-07-22 Johnny Chu] PHASE-ZALOBOT-GROUP-TRACE — replay group/private Zalo target instead of collapsing to sender private id.
			conversation_chat_id: ev.meta?.conversation_chat_id || ev.chat_id,
			provider_chat_id:   ev.meta?.provider_chat_id || '',
			provider_chat_type: ev.meta?.provider_chat_type || '',
			chat_kind:          ev.meta?.chat_kind || '',
			mention_detected:   !!ev.meta?.mention_detected,
			reply_to_bot_message: !!ev.meta?.reply_to_bot_message,
			sender_user_id:     ev.meta?.sender_user_id || ev.user_id,
			message:            ev.message,
			text:               ev.message,
			direction:          ev.direction,
			event_type:         ev.event_type,
			meta:               ev.meta || {},
			ts:                 ev.ts,
			listener_event_id:  ev.id,
			character_id:       ev.character_id,
		};
		store.pushLog({
			level: 'ok',
			msg:   `✓ Capture ${ev.platform} · ${ev.chat_id} — "${(ev.message || '').slice(0, 80)}" (polling vẫn chạy — bấm "Dừng nghe" để stop)`,
		});
		try {
			const result = await runWithCapturedPayload(meta.id, payload);
			if (result?.hilWaiting) {
				// [2026-08-16 Johnny Chu] PHASE-3-HIL-TRACE — HIL is conversational; keep the listener open for the user's next slot answer.
				hilCollecting = true;
				captured = false;
			} else {
				hilCollecting = false;
			}
		}
		catch (_) { /* runWithCapturedPayload logs its own errors */ }
	};

	unsubscribe = subscribeListenerStream({
		filters:  subFilters,
		// PG-S5 fix #2 — start from current head_id so re-opening Chạy thử
		// không replay events cũ trong ring buffer (gây double-fire workflow,
		// gửi Zalo trùng).
		tailOnly: true,
		onStatus: (st) => {
			trace('listener', `status=${st}`, subFilters);
			store.setListenStatus(st);
			if (st === 'polling') {
				store.pushLog({ level: 'info', msg: '⚠ SSE bị chặn, chuyển sang polling 2s (vẫn nhận được tin).' });
			}
		},
		onEvent: async (ev) => {
			if (stopped) { trace('listener', 'event ignored (stopped)'); return; }
			// PG-S5 — pause gate: buffer event, no side-effects yet.
			if (useBuilderStore.getState().listenPaused) {
				pausedQueue.push(ev);
				syncPausedQueueSize();
				trace('listener', `⏸ buffered (paused, queue=${pausedQueue.length})`, { id: ev.id, kind: ev.kind });
				return;
			}
			return handleEvent(ev);
		},
	});

	// Bind active process fn AFTER unsubscribe is set.
	activeProcessFn = handleEvent;
	pausedQueue = [];
	syncPausedQueueSize();
	useBuilderStore.getState().setListenPaused(false);
}

/**
 * Run a persisted workflow with a captured trigger payload (from Test Listen).
 * Caller is responsible for `store.startRun()` semantics — this fn handles
 * the SSE lifecycle + endRun.
 */
export async function runWithCapturedPayload(workflowId, triggerPayload) {
	const store = useBuilderStore.getState();
	const dry   = !!store.dryRun;
	const qs    = dry ? '&dry=1' : '';
	// Reset run state if a previous "listening" startRun is still flagged.
	if (!store.isRunning) store.startRun();
	store.setRunMeta({ runMode: 'async' });
	store.pushLog({
		level: 'info',
		msg:   `▶ Capture xong — POST /workflows/${workflowId}/run?async=1${qs} với payload thật${dry ? ' (DRY-RUN)' : ''}`,
	});
	trace('run', `POST /workflows/${workflowId}/run?async=1${qs}`, triggerPayload);

	let runId;
	try {
		const res = await api.post(`/workflows/${workflowId}/run?async=1${qs}`, {
			_test:           true,
			source:          'test_listen.capture',
			trigger_payload: triggerPayload,
			_dry_run:        dry || undefined,
		});
		trace('run', 'POST response', res);
		if (res?.hil_waiting) {
			store.pushLog({
				level: 'info',
				msg: `⚡ HIL đang thu thập slot${res.question ? `: ${res.question}` : ''} (hil_id=${res.hil_id || 'unknown'}). Gửi câu trả lời tiếp theo vào kênh.`,
			});
			return { hilWaiting: true, hilId: res.hil_id || '', question: res.question || '' };
		}
		runId = res?.run_id || res?.data?.run_id;
		if (!runId) throw new Error('no run_id in response');
		if (res?.deduped) {
			store.pushLog({
				level: 'info',
				msg: `↺ Matcher đã chạy trước (dedup=${res?.dedup_reason || 'capture_identity'}) — dùng lại run_id=${runId}.`,
			});
		}
	} catch (err) {
		trace('run', '✗ POST failed', err);
		store.endRun({ runStatus: 'fail', runError: String(err?.message || err) });
		return;
	}

	store.setRunMeta({ runDbId: runId });
	store.pushLog({ level: 'info', msg: `✓ run_id=${runId} — đang polling /runs/:id mỗi 1s…` });
	trace('run', `run_id=${runId} — start polling`);
	await streamRun(runId);
}

/**
 * PG-S6 — Replay an existing finished run with the same trigger payload.
 * BE clones workflow_id + trigger_payload_json, links via parent_run_id, and
 * schedules async exec. FE swaps runDbId to the new run_id and resumes
 * polling so the timeline + per-node badges update live.
 */
export async function replayRun(originalRunId) {
	const store = useBuilderStore.getState();
	store.startRun(); // resets nodeStatus/runLog/timeline; sets isRunning=true.
	store.setRunMeta({ runMode: 'async', debugState: '' });
	store.pushLog({ level: 'info', msg: `↺ Replay run ${originalRunId} — POST /runs/${originalRunId}/replay` });
	trace('run', `POST /runs/${originalRunId}/replay`);

	let newRunId;
	try {
		const res = await runsApi.replay(originalRunId);
		trace('run', 'replay response', res);
		newRunId = res?.run_id || res?.data?.run_id;
		if (!newRunId) throw new Error('no run_id in replay response');
	} catch (err) {
		trace('run', '✗ replay failed', err);
		store.endRun({ runStatus: 'fail', runError: String(err?.message || err) });
		return null;
	}

	store.setRunMeta({ runDbId: newRunId, parentRunId: originalRunId });
	store.pushLog({ level: 'info', msg: `✓ Replay run_id=${newRunId} (parent=${originalRunId})` });
	streamRun(newRunId);
	return newRunId;
}

/**
 * Subscribe to run events: SSE-first, polling fallback if SSE drops or
 * server doesn't support stream. Mirrors listenerStream.js strategy.
 *
 * Strategy:
 *  - Open SSE /runs/:id/events. If `hello` arrives → mark streaming.
 *  - On error twice → close + start polling /runs/:id?since_id=... every 1s.
 *  - Polling stops when run.status ∈ {ok=2, fail=3, cancelled=4}.
 */
export function streamRun(runId) {
	return new Promise((resolve) => {
		const store = () => useBuilderStore.getState();
		let resolved = false;
		const finish = (status, error) => {
			if (resolved) return; resolved = true;
			trace('run', `■ finish status=${status}${error ? ' err=' + error : ''}`);
			store().endRun({ runStatus: status, runError: error || '' });
			// Auto-stop active listener after run finishes (any terminal state).
			// User asked: "chạy thử xong, pass qua toàn bộ, success nhưng ko tự dừng".
			// Use 'captured' sentinel so cleanup() doesn't overwrite our runStatus with 'skip'.
			if (activeListener && ['ok', 'fail', 'cancelled'].includes(status)) {
				try { stopActiveListener('captured'); } catch (_) {}
				try { useBuilderStore.getState().pushLog({ level: 'info', msg: `⏹ Tự động dừng nghe (run ${status}).` }); } catch (_) {}
			}
			resolve();
		};

		// --- Polling implementation ------------------------------------------------
		let polling      = false;
		let pollSince    = 0;
		let pollTimer    = null;
		let pollInflight = false;
		const POLL_MS = 1000;

		const dispatchLog = (log) => {
			const status = Number(log.status);
			const meta   = STATUS_MAP[status] || STATUS_MAP[0];
			const block  = BLOCKS_BY_ID[log.block_id];
			const label  = block?.label || log.block_id || log.node_id;
			trace('run', `log step=${log.step} node=${log.node_id} block=${log.block_id} status=${status} (${meta.label})`, log);
			store().setNodeStatus(log.node_id, status, log.output);
			// PG-S8 — timestamp ms for replay scrub. Prefer finished_at when terminal,
			// fallback started_at, fallback now. MySQL DATETIME → Date.parse safe.
			const tsRaw = log.finished_at || log.started_at || log.ts || null;
			const ts    = tsRaw ? Date.parse(tsRaw) : Date.now();
			if (typeof store().pushRunLogRow === 'function') {
				store().pushRunLogRow({
					step:    log.step,
					node_id: log.node_id,
					status,
					ts: Number.isFinite(ts) ? ts : Date.now(),
				});
			}
			store().pushLog({
				level:  meta.level,
				nodeId: log.node_id,
				msg:    `${meta.icon} step ${log.step} · ${label}${log.error ? ' — ' + log.error : ''}`,
				payload: { block_id: log.block_id, output: log.output, error: log.error },
			});
		};

		const pollTick = async () => {
			if (resolved) return;
			pollInflight = true;
			try {
				// Always poll FROM 0 — runner BE chạy 1 row insert (running) +
				// 1 row UPDATE (ok/fail) cùng id. since_id > 0 sẽ miss update,
				// FE hiển thị "running" mãi. Re-fetch full log mỗi tick + dedupe
				// bằng setNodeStatus (idempotent — gọi lại với status mới sẽ
				// override). Workflow ít step (<50 rows) → cost không đáng kể.
				trace('run', `poll /runs/${runId}?since_id=0`);
				const data = await runsApi.get(runId, 0);
				const logs = Array.isArray(data?.logs) ? data.logs : [];
				if (logs.length) {
					trace('run', `poll got ${logs.length} log rows (full snapshot)`);
					logs.forEach((row) => {
						dispatchLog({
							step:        row.step,
							node_id:     row.node_id,
							block_id:    row.block_id,
							status:      row.status,
							output:      row.output,
							error:       row.error,
							started_at:  row.started_at,
							finished_at: row.finished_at,
						});
					});
				}
				const runStatus = Number(data?.run?.status);
				// BizCity_Automation_Repo_Runs: 0=queued 1=running 2=ok 3=fail 4=cancelled
				trace('run', `poll run.status=${runStatus}`, data?.run);
				// PG-S5 — capture debug_state so Toolbar can show pause/step/resume buttons.
				store().setRunMeta({ debugState: String(data?.run?.debug_state || '') });
				if ([2, 3, 4].includes(runStatus)) {
					const map = { 2: 'ok', 3: 'fail', 4: 'cancelled' };
					finish(map[runStatus] || 'ok', data?.run?.error || '');
					return;
				}
			} catch (e) {
				trace('run', '✗ poll error', e);
			} finally {
				pollInflight = false;
				if (!resolved) pollTimer = setTimeout(pollTick, POLL_MS);
			}
		};

		const startPolling = () => {
			if (polling) return;
			polling = true;
			trace('run', '↪ polling /runs/:id every 1s');
			store().pushLog({
				level: 'info',
				msg:   '↪ Polling /runs/:id mỗi 1s — xem node-by-node realtime.',
			});
			pollTick(); // fire ngay, không chờ 1s
		};

		// --- SSE implementation ----------------------------------------------------
		// Default = SKIP SSE → polling only (mirrors channel-gateway working pattern).
		// Set window.__AW_USE_SSE__ = true ở console để bật lại SSE thử nghiệm.
		const useSse = (typeof window !== 'undefined') && window.__AW_USE_SSE__ === true;
		if (!useSse) {
			trace('run', 'SSE skipped — polling-only mode (set window.__AW_USE_SSE__=true để bật)');
			startPolling();
			return;
		}

		let es;
		let sseFails = 0;
		try {
			const url = buildSseUrl(runId);
			trace('run', `SSE open ${url}`);
			es = new EventSource(url, { withCredentials: true });
		} catch (err) {
			trace('run', '✗ SSE init throw', err);
			startPolling();
			return;
		}

		es.addEventListener('open', () => trace('run', 'SSE onopen'));
		es.addEventListener('hello', () => trace('run', 'SSE hello'));

		es.addEventListener('log', (e) => {
			let log; try { log = JSON.parse(e.data); } catch (_) { return; }
			pollSince = Math.max(pollSince, Number(e.lastEventId) || 0);
			dispatchLog(log);
		});

		es.addEventListener('end', (e) => {
			let data; try { data = JSON.parse(e.data); } catch (_) { data = {}; }
			trace('run', 'SSE end', data);
			const beStatus = Number(data.status);
			// 0=queued 1=running 2=ok 3=fail 4=cancelled
			let s = 'ok';
			if (beStatus === 3) s = 'fail';
			else if (beStatus === 4) s = 'cancelled';
			else if (beStatus === 2) s = 'ok';
			store().pushLog({
				level: s === 'ok' ? 'info' : 'error',
				msg:   `■ Run ${runId} kết thúc · ${s}${data.error ? ' · ' + data.error : ''}`,
			});
			try { es.close(); } catch (_) {}
			finish(s, data.error || '');
		});

		es.addEventListener('timeout', () => {
			trace('run', 'SSE timeout — fallback polling');
			try { es.close(); } catch (_) {}
			startPolling();
		});

		es.onerror = (e) => {
			sseFails += 1;
			trace('run', `SSE onerror (fail #${sseFails})`, e);
			try { es.close(); } catch (_) {}
			if (resolved) return;
			// First failure: try polling immediately (server có thể không hỗ trợ stream).
			startPolling();
		};
	});
}

// Back-compat alias.
export const streamSse = streamRun;

/** Legacy MOCK BFS — chạy local bằng block.simulate() khi WF chưa lưu DB. */
async function runMock() {
	const store = useBuilderStore.getState();
	store.setRunMeta({ runMode: 'mock' });
	const { nodes, edges } = store;
	const runId = store.runId;

	const adj = new Map();
	for (const e of edges) {
		if (!adj.has(e.source)) adj.set(e.source, []);
		adj.get(e.source).push({ target: e.target, branch: e.sourceHandle });
	}

	const triggers = nodes.filter((n) => n.type === 'trigger');
	const visited = new Set();
	const queue = triggers.map((t) => ({ id: t.id, prevBranch: null }));

	store.pushLog({ level: 'info', msg: `▶ Mock run ${runId}` });

	let step = 0;
	while (queue.length) {
		const { id } = queue.shift();
		if (visited.has(id)) continue;
		visited.add(id);
		step += 1;

		const node = nodes.find((n) => n.id === id);
		if (!node) continue;
		const block = BLOCKS_BY_ID[node.data?.blockId];
		const label = node.data?.label || block?.label || id;

		useBuilderStore.getState().setNodeStatus(id, 0); // running
		const t0 = performance.now();
		useBuilderStore.getState().pushLog({ level: 'run', nodeId: id, msg: `⏳ step ${step} · ${label}` });

		let output;
		try {
			output = block ? await block.simulate({ runId }, node.data) : { warn: 'no block.simulate' };
		} catch (err) {
			useBuilderStore.getState().setNodeStatus(id, 2, { error: String(err?.message || err) });
			useBuilderStore.getState().pushLog({ level: 'error', nodeId: id, msg: `✗ ${label} — ${err?.message || err}` });
			continue;
		}

		const dur = Math.round(performance.now() - t0);
		useBuilderStore.getState().setNodeStatus(id, 1, output);
		useBuilderStore.getState().pushLog({
			level: 'ok', nodeId: id, msg: `✓ ${label} (${dur} ms)`,
			payload: { output, duration_ms: dur },
		});

		const nexts = adj.get(id) || [];
		if (node.type === 'condition') {
			const chosen = output?.branch ?? 'true';
			for (const n of nexts) {
				if (!n.branch || n.branch === chosen) queue.push({ id: n.target, prevBranch: chosen });
			}
		} else {
			for (const n of nexts) queue.push({ id: n.target, prevBranch: null });
		}
	}

	useBuilderStore.getState().pushLog({ level: 'info', msg: `■ Mock run ${runId} kết thúc · ${visited.size} node` });
	useBuilderStore.getState().endRun({ runStatus: 'ok' });
}
