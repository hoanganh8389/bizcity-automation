/**
 * REST helper — wraps fetch with X-WP-Nonce + base URL từ window.BIZCITY_AUTOMATION_BOOT.
 *
 * Usage:
 *   import { api } from '../lib/api.js';
 *   const { rows } = await api.get('/channel-registry?platform=ZALO_BOT');
 *
 * Throws BizCityApiError on !ok response (includes status + body).
 *
 * @since AUTOMATION BE-6 (2026-05-29)
 */
import { BOOT } from './boot.js';

export class BizCityApiError extends Error {
	constructor(message, { status = 0, code = '', body = null } = {}) {
		super(message);
		this.name = 'BizCityApiError';
		this.status = status;
		this.code = code;
		this.body = body;
		this.hint = body?.hint || body?.data?.hint || '';
		this.helpCode = body?.help_code || body?.data?.help_code || '';
	}
}

function joinUrl(base, path) {
	if (/^https?:\/\//i.test(path)) return path;
	const b = String(base || '').replace(/\/+$/, '');
	const p = String(path || '').replace(/^\/+/, '');
	return `${b}/${p}`;
}

function stableHash(value) {
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16).padStart(8, '0');
}

function mutationKey(method, path, body) {
	const bodyText = body === undefined ? '' : JSON.stringify(body);
	return `automation-${String(BOOT.blogId || 0)}-${String(method).toLowerCase()}-${stableHash(`${path}|${bodyText}`)}`;
}

async function request(method, path, { body, signal, headers, idempotencyKey } = {}) {
	const url = joinUrl(BOOT.restUrl, path);
	const requestHeaders = {
		Accept: 'application/json',
		...(BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {}),
		...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
		...(headers || {}),
	};
	if (method !== 'GET' && method !== 'HEAD' && !Object.keys(requestHeaders).some((key) => key.toLowerCase() === 'x-idempotency-key')) {
		requestHeaders['X-Idempotency-Key'] = idempotencyKey || mutationKey(method, path, body);
	}
	const init = {
		method,
		credentials: 'same-origin',
		headers: requestHeaders,
		signal,
	};
	if (body !== undefined) init.body = JSON.stringify(body);

	let res;
	try {
		res = await fetch(url, init);
	} catch (e) {
		throw new BizCityApiError(e?.message || 'Network error', { status: 0, code: 'network_error' });
	}

	const ct = res.headers.get('content-type') || '';
	const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();

	if (!res.ok) {
		const errorData = data?.data && typeof data.data === 'object' ? data.data : data;
		const msg = (data && (data.message || errorData?.message || data.error)) || `HTTP ${res.status}`;
		const code = (data && (data.code || errorData?.code)) || '';
		throw new BizCityApiError(msg, { status: res.status, code, body: data });
	}
	return data;
}

export const api = {
	get:    (path, opts)       => request('GET',    path, opts),
	post:   (path, body, opts) => request('POST',   path, { ...opts, body }),
	put:    (path, body, opts) => request('PUT',    path, { ...opts, body }),
	patch:  (path, body, opts) => request('PATCH',  path, { ...opts, body }),
	del:    (path, opts)       => request('DELETE', path, opts),
};

/** Convenience wrappers for BE-6 routes. */
export const automationApi = {
	channelRegistry: (platform) =>
		api.get(`/channel-registry${platform ? `?platform=${encodeURIComponent(platform)}` : ''}`),
	// [2026-06-25 Johnny Chu] PHASE-REPLY-ZALO-FIX — load user links for a Zalo Bot instance.
	zaloUsers: (instanceId) =>
		api.get(`/zalo-users?instance_id=${encodeURIComponent(instanceId)}`),
	// [2026-08-06 Johnny Chu] ZALO-BIND-DIALOG — reuse the Channel Gateway admin identity API from Run Trace.
	zaloWpUsers: (query = '') =>
		api.get(`${window.location.origin}/wp-json/bizcity-channel/v1/zalo-bot/wp-users${query ? `?q=${encodeURIComponent(query)}` : ''}`),
	zaloBindUser: (payload) =>
		api.post(`${window.location.origin}/wp-json/bizcity-channel/v1/zalo-bot/user-links`, payload),
	cronHealth:      () => api.get('/cron-health'),
	matcherTrace:    (limit = 50) => api.get(`/matcher-trace?limit=${limit}`),
	matcherTraceClear: () => api.del('/matcher-trace'),
	// [2026-08-16 Johnny Chu] PHASE-3-HIL-TRACE — read-only HIL Instance footnotes for RunTimeline.
	hilTrace: (params = {}) => {
		const qs = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null && String(value) !== '') qs.set(key, String(value));
		});
		return api.get(`/hil-trace?${qs.toString()}`);
	},
	listenStart:     (payload) => api.post('/test/listen', payload),
	listenPoll:      (listenerId) =>
		api.get(`/test/poll?listener_id=${encodeURIComponent(listenerId)}`),
	listenStop:      (listenerId) => api.post('/test/stop', { listener_id: listenerId }),
	listenFire:      (triggerCode, payload = {}) =>
		api.post('/test/fire', { trigger_code: triggerCode, payload }),
	channelSend:     (chatId, text, type = 'text') =>
		api.post('/test/channel-send', { chat_id: chatId, text, type }),
	conversationHistory: (chatId, limit = 50) =>
		api.get(`/test/conversation-history?chat_id=${encodeURIComponent(chatId)}&limit=${limit}`),

	// [2026-06-03 Johnny Chu] GURU-UI W0.3 — cross-namespace helpers to channel inspector.
	// BOOT.restUrl points to bizcity-automation/v1/; channel inspector lives at bizcity-channel/v1/.
	// Build absolute URL từ same origin để api.get short-circuit qua joinUrl.
	gurus: () => {
		const base = (typeof window !== 'undefined' ? window.location.origin : '');
		return api.get(`${base}/wp-json/bizcity-channel/v1/inspector/gurus`);
	},
	guruChannels: (guruId) => {
		const base = (typeof window !== 'undefined' ? window.location.origin : '');
		const id = parseInt(guruId, 10) || 0;
		return api.get(`${base}/wp-json/bizcity-channel/v1/inspector/bindings?character_id=${id}`);
	},
};

/** BE-7 — Workflow Templates library. */
export const templatesApi = {
	list: ({ category = '', source = '', visibility = '', search = '', is_active = '', limit = 50, offset = 0 } = {}) => {
		const qs = new URLSearchParams();
		if (category)  qs.set('category',  category);
		if (source)    qs.set('source',    source);
		if (visibility) qs.set('visibility', visibility);
		if (search)    qs.set('search',    search);
		if (is_active !== '') qs.set('is_active', String(is_active));
		qs.set('limit',  String(limit));
		qs.set('offset', String(offset));
		return api.get(`/templates?${qs.toString()}`);
	},
	get:         (id)              => api.get(`/templates/${id}`),
	instantiate: (id, payload = {}) => api.post(`/templates/${id}/instantiate`, payload),
	saveFromWorkflow: (workflowId, payload = {}) =>
		api.post(`/workflows/${workflowId}/save-as-template`, payload),
	reseed:      () => api.post('/templates/reseed', {}),
	hilUpgrade:  (opts = {}) => api.post('/templates/hil-upgrade', opts),
};

/**
 * PHASE-ATH W3 — Hub template library proxy.
 *
 * Proxy endpoint: bizcity-automation/v1/hub-templates/*
 * PHP: BizCity_Automation_Hub_Client (stub → real when Branch #17 built)
 * Fail-OPEN: browse/categories return {_degraded: true, rows: []} when hub offline.
 */
export const hubTemplatesApi = {
	/** Browse hub library. Public (no auth needed). Fail-OPEN: _degraded. */
	browse: ({ category = '', plan = '', search = '', page = 1, per_page = 18 } = {}) => {
		const qs = new URLSearchParams();
		if (category) qs.set('category', category);
		if (plan)     qs.set('plan', plan);
		if (search)   qs.set('search', search);
		qs.set('page',     String(page));
		qs.set('per_page', String(per_page));
		return api.get(`/hub-templates?${qs.toString()}`);
	},
	/** Get category list from hub. Fail-OPEN: returns {categories: []}. */
	categories: () => api.get('/hub-templates/categories'),
	/** Get full detail including graph_json. */
	get:    (id) => api.get(`/hub-templates/${id}`),
	/** Import one hub template to local → creates workflow (enabled=0). */
	import: (id, opts = {}) => api.post(`/hub-templates/${id}/import`, opts),
	/** Submit a local template to hub for community sharing. Bearer required. */
	submit: (templateId, payload = {}) =>
		api.post('/hub-templates/submit', { template_id: templateId, ...payload }),
};

/** PHASE-1-TEMPLATES-AUTOMATION — Wave 1 editable config packs. */
export const configPacksApi = {
	sampleCsv: (schemaKey = 'content_calendar') => api.get(`/config-packs/sample-csv?schema_key=${encodeURIComponent(schemaKey)}`),
	parse: (payload = {}) => api.post('/config-packs/parse', payload),
	list: ({ schema_key = '', status = '', search = '', limit = 50, offset = 0 } = {}) => {
		const qs = new URLSearchParams();
		if (schema_key) qs.set('schema_key', schema_key);
		if (status) qs.set('status', status);
		if (search) qs.set('search', search);
		qs.set('limit', String(limit));
		qs.set('offset', String(offset));
		return api.get(`/config-packs?${qs.toString()}`);
	},
	create: (payload = {}) => api.post('/config-packs', payload),
	get: (id) => api.get(`/config-packs/${id}`),
	updateRow: (packId, rowId, rowJson) => api.patch(`/config-packs/${packId}/rows/${rowId}`, { row_json: rowJson }),
	bulkRows: (packId, payload = {}) => api.post(`/config-packs/${packId}/rows/bulk`, payload),
	validate: (packId) => api.post(`/config-packs/${packId}/validate`, {}),
	activate: (packId) => api.post(`/config-packs/${packId}/activate`, {}),
};

/**
 * WF-AUTO W7 — Community gallery (GitHub raw manifest).
 * [2026-06-16 Johnny Chu] PHASE-ATH W3 — extracted to named export for CommunityTemplateTab.
 */
export const communityApi = {
	/** Fetch list from manifest URL (default: bizcity/automation-workflows GitHub). */
	list: (manifestUrl = '') => {
		const qs = manifestUrl ? `?manifest_url=${encodeURIComponent(manifestUrl)}` : '';
		return api.get(`/community/workflows${qs}`);
	},
	/** Fetch .workflow.md preview for one item. */
	preview: (url) => api.get(`/community/workflow?url=${encodeURIComponent(url)}`),
	/** Import from raw .workflow.md URL → creates local workflow (enabled=0). */
	import: (url, opts = {}) => api.post('/community/workflows/import', { url, ...opts }),
};

/** BE-1 — Core workflows CRUD (legacy hand-roll helpers). */
export const workflowsApi = {
	list:   (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		return api.get(`/workflows${qs ? `?${qs}` : ''}`);
	},
	get:    (id)              => api.get(`/workflows/${id}`),
	create: (payload)         => api.post('/workflows', payload),
	update: (id, payload)     => api.put(`/workflows/${id}`, payload),
	/** Hard-delete by default. Pass {soft:true} to keep row + only flip enabled=0. */
	del:    (id, opts = {})   => api.del(`/workflows/${id}${opts.soft ? '?soft=1' : ''}`),
	duplicate: (id)           => api.post(`/workflows/${id}/duplicate`, {}),
	// [2026-07-21 Johnny Chu] PHASE-2-TWIN-GPT-CHANNEL-AUTOMATION — publish workflow as customer-default global template for /gpt/myworkflows/.
	customerDefault: (id, enabled) => api.post(`/workflows/${id}/customer-default`, { enabled: !!enabled }),
	// PG-S9-fix v6 — per-workflow JSONL file log.
	fileLog:        (id, lines = 200) => api.get(`/workflows/${id}/file-log?lines=${lines}`),
	fileLogClear:   (id)              => api.del(`/workflows/${id}/file-log`),
	fileLogSelftest:(id)              => api.post(`/workflows/${id}/file-log/selftest`, {}),
	// BE-Scenario-AdImage (2026-06-01) — proxy gateway generate_image() cho 1 kịch bản.
	generateAdImage: (id, payload = {}) => api.post(`/workflows/${id}/ad-image`, payload),
	// [2026-06-13 Johnny Chu] PHASE-0.40 G2.7 — AI Builder: prompt → workflow graph.
	aiBuild: (prompt) => api.post('/ai-build', { prompt }),
	// [2026-06-20 Johnny Chu] PHASE-TWB-WORKFLOW W5 — brain-mode skill validator.
	validateSkill: (id) => api.get(`/workflows/${id}/validate-skill`),
	// [2026-08-16 Johnny Chu] CCG-2 — expose an Automation Workflow to the #slug picker.
	setCommandInvokable: (id, enabled) => api.patch(`/workflows/${id}/command-invokable`, { command_invokable: !!enabled }),
	fileLogDownloadUrl: (id) => {
		const base = String(BOOT.restUrl || '').replace(/\/+$/, '');
		const sep  = base.includes('?') ? '&' : '?';
		// Append nonce so direct download works without an Authorization header.
		const nonce = BOOT.restNonce ? `${sep}_wpnonce=${encodeURIComponent(BOOT.restNonce)}` : '';
		return `${base}/workflows/${id}/file-log/download${nonce}`;
	},
};

// [2026-08-15 Johnny Chu] MPR-V5-HIL-COMPILER — HIL compiler lives in the TwinBrain namespace, same origin.
export const hilApi = {
	compile: (triggerId, prompt, context = {}) => {
		const base = (typeof window !== 'undefined' ? window.location.origin : '');
		return api.post(`${base}/wp-json/bizcity-twinbrain/v1/hil/compile`, {
			trigger_id: triggerId,
			prompt,
			context,
		});
	},
};

/**
 * [2026-06-16 Johnny Chu] PHASE-ATH W9 — Notebook list (for notebook_picker field type).
 * Calls bizcity/kg/v1/notebooks — returns [{id, name, skeleton_status, skeleton_version, updated_at}].
 */
export const notebookApi = {
	/** List notebooks accessible by current user (skeleton_status included). */
	list: (params = {}) => {
		const qs = new URLSearchParams(params).toString();
		// [2026-06-16 Johnny Chu] PHASE-ATH W8 GAP-4 fix: derive wp-json base from
		// BOOT.restUrl instead of window.location.origin — window.location.origin fails
		// when WordPress is installed in a subdirectory (e.g. /wordpress/).
		const wpJsonBase = String(BOOT.restUrl || '')
			.replace(/\/bizcity-automation\/v1\/?.*$/, '') // strip automation namespace
			.replace(/\/+$/, '');
		// Fetch via KG REST namespace — falls back gracefully if KG not loaded.
		return fetch(
			`${wpJsonBase}/bizcity/kg/v1/notebooks${qs ? `?${qs}` : ''}`,
			{
				credentials: 'same-origin',
				headers: {
					Accept: 'application/json',
					...(BOOT.restNonce ? { 'X-WP-Nonce': BOOT.restNonce } : {}),
				},
			}
		)
			.then((r) => r.json())
			.then((data) => Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []))
			.catch(() => []);
	},
};

/** BE-3 — Runs detail / log polling fallback when SSE chết. */
export const runsApi = {
	get:    (runId, sinceId = 0) =>
		api.get(`/runs/${encodeURIComponent(runId)}?since_id=${sinceId}`),
	// PG-S5 — pause/step/resume.
	pause:  (runId) => api.post(`/runs/${encodeURIComponent(runId)}/pause`,  {}),
	step:   (runId) => api.post(`/runs/${encodeURIComponent(runId)}/step`,   {}),
	resume: (runId) => api.post(`/runs/${encodeURIComponent(runId)}/resume`, {}),
	// PG-S6 — replay (re-run with same payload, linked via parent_run_id).
	replay: (runId) => api.post(`/runs/${encodeURIComponent(runId)}/replay`, {}),
};
