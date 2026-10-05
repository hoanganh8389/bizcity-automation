/**
 * Channel-gateway Listener Bus subscriber — SSE-first, polling fallback.
 *
 * Mirrors the channel-gateway `useListenerStream` hook strategy so that
 * "Chạy thử" capture survives Cloudflare / nginx SSE buffering: when SSE
 * connection drops or buffers, we fall back to polling `/listener/feed`
 * every 2s. Both runner.js (workflow execute on first match) and the Inbox
 * route (live tail UI) build on this.
 *
 * Per PHASE-0-DOC-CHANNEL-LISTENING §6 — Listener Bus is the single canonical
 * live tail (network-scoped option, multisite-safe).
 *
 * @since 2026-05-31
 */
import { BOOT } from './boot.js';

const NS         = '/wp-json/bizcity-channel/v1/listener';
const POLL_MS    = 2000;
const SSE_FAIL_MAX = 2;

function trace(msg, extra) {
	if (typeof window === 'undefined' || !window.__AW_TRACE__) return;
	const ts = new Date().toLocaleTimeString('vi-VN', { hour12: false });
	// eslint-disable-next-line no-console
	console.log(`%c[AW ${ts}][listenerStream]%c ${msg}`,
		'color:#a855f7;font-weight:600', 'color:inherit',
		extra !== undefined ? extra : '');
}

function buildQuery(filters = {}, sinceId = 0, extra = {}) {
	const sp = new URLSearchParams();
	if (sinceId > 0) sp.set('since', String(sinceId));
	Object.entries(filters || {}).forEach(([k, v]) => {
		if (v === null || v === undefined || v === '') return;
		sp.set(k, Array.isArray(v) ? v.join(',') : String(v));
	});
	Object.entries(extra || {}).forEach(([k, v]) => {
		if (v !== null && v !== undefined && v !== '') sp.set(k, String(v));
	});
	if (BOOT.restNonce) sp.set('_wpnonce', BOOT.restNonce);
	return sp.toString();
}

/**
 * Subscribe to listener stream.
 *
 * @param {Object} opts
 * @param {Object} opts.filters   — { platform, kind, account_id, user_id, q, ... }
 * @param {Function} opts.onEvent — (ev) => void, called per inbound event
 * @param {Function} [opts.onStatus] — (status) => void, status ∈ idle|connecting|streaming|polling|error
 * @param {boolean} [opts.tailOnly] — when true, fetch current head_id first and
 *   start subscription from there. Avoids replaying ring-buffer history (which
 *   would re-fire workflows in runner.js). Default false (gives full backlog,
 *   used by InboxRoute live-tail UI).
 * @returns {Function} stop() — unsubscribe + close all connections
 */
export function subscribeListenerStream({ filters = {}, onEvent, onStatus, tailOnly = false }) {
	let stopped   = false;
	let es        = null;
	let pollTimer = null;
	let sseFail   = 0;
	let since     = 0;

	const setStatus = (s) => { if (onStatus) try { onStatus(s); } catch (_) {} };
	const dispatch  = (ev) => {
		if (!ev?.id) return;
		since = Math.max(since, Number(ev.id) || 0);
		try { onEvent(ev); } catch (_) {}
	};

	const stopAll = () => {
		if (es)        { try { es.close(); } catch (_) {} es = null; }
		if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
	};

	const startPolling = () => {
		stopAll();
		setStatus('polling');
		trace('startPolling', { since, filters });
		const tick = async () => {
			if (stopped) return;
			try {
				const qs  = buildQuery(filters, since, { limit: 100 });
				trace(`poll tick since=${since}`);
				const res = await fetch(`${NS}/feed?${qs}`, {
					headers: BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {},
					credentials: 'same-origin',
				});
				if (res.ok) {
					const data = await res.json();
					const n = Array.isArray(data?.events) ? data.events.length : 0;
					trace(`poll got ${n} events`);
					if (n) data.events.forEach(dispatch);
				} else {
					trace(`poll http_${res.status}`);
				}
			} catch (e) { trace('poll error', e); }
			finally {
				if (!stopped) pollTimer = setTimeout(tick, POLL_MS);
			}
		};
		// Fire FIRST tick immediately (no 2s wait) so backfill arrives instantly.
		tick();
	};

	const startSSE = () => {
		// Default = SKIP SSE → polling only (mirrors channel-gateway working pattern).
		// Set window.__AW_USE_SSE__ = true ở console để bật lại SSE thử nghiệm.
		const useSse = (typeof window !== 'undefined') && window.__AW_USE_SSE__ === true;
		if (!useSse) {
			trace('SSE skipped — polling-only mode (set window.__AW_USE_SSE__=true để bật)');
			startPolling();
			return;
		}
		if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
			startPolling();
			return;
		}
		stopAll();
		setStatus('connecting');
		const qs  = buildQuery(filters, since);
		const url = `${NS}/stream?${qs}`;
		trace(`SSE open ${url}`);
		try { es = new EventSource(url, { withCredentials: true }); }
		catch (_) { sseFail += 1; trace('SSE init throw'); startPolling(); return; }

		es.addEventListener('hello', () => {
			setStatus('streaming');
			sseFail = 0;
			trace('SSE hello');
		});
		es.addEventListener('message', (evt) => {
			try {
				const d = JSON.parse(evt.data || '{}');
				if (d?.id) { trace(`SSE message id=${d.id}`); dispatch(d); }
			} catch (_) {}
		});
		es.addEventListener('bye', () => {
			trace('SSE bye — reconnect');
			if (!stopped) startSSE(); // server closed gracefully → reconnect
		});
		es.onerror = () => {
			sseFail += 1;
			trace(`SSE onerror (#${sseFail})`);
			try { es.close(); } catch (_) {}
			es = null;
			if (stopped) return;
			if (sseFail >= SSE_FAIL_MAX) startPolling();
			else setTimeout(() => { if (!stopped) startSSE(); }, 800);
		};
	};

	// Bootstrap: when tailOnly, fetch current head_id first so since>=head and
	// historical ring events are skipped (workflow runner stays at-most-once).
	if (tailOnly) {
		setStatus('connecting');
		(async () => {
			try {
				const qs  = buildQuery(filters, 0, { limit: 0 });
				const res = await fetch(`${NS}/feed?${qs}`, {
					headers: BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {},
					credentials: 'same-origin',
				});
				if (res.ok) {
					const data = await res.json();
					const head = Number(data?.head_id || 0);
					if (head > 0) since = head;
					trace(`tailOnly bootstrap head_id=${head} → since=${since}`);
				} else {
					trace(`tailOnly bootstrap http_${res.status} — fallback since=0`);
				}
			} catch (e) {
				trace('tailOnly bootstrap error', e);
			}
			if (!stopped) startSSE();
		})();
	} else {
		startSSE();
	}

	return function stop() {
		stopped = true;
		setStatus('idle');
		stopAll();
	};
}

/** One-shot fetch (used for backfill / debug). */
export async function fetchListenerFeed(filters = {}, sinceId = 0, limit = 100) {
	const qs  = buildQuery(filters, sinceId, { limit });
	const res = await fetch(`${NS}/feed?${qs}`, {
		headers: BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {},
		credentials: 'same-origin',
	});
	if (!res.ok) throw new Error(`feed_http_${res.status}`);
	return res.json();
}

export async function listenerTestEmit(body = {}) {
	const res = await fetch(`${NS}/test-emit`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: {
			'Content-Type': 'application/json',
			...(BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {}),
		},
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`test_emit_http_${res.status}`);
	return res.json();
}
