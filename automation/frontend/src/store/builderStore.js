/**
 * Builder store — Zustand.
 *
 * Holds the live workflow graph + UI selection + run timeline + history
 * stack for undo/redo. The reducer pattern mirrors `xyflow-system` so future
 * migration to a server-side state hydrate is mechanical.
 *
 * History strategy: every "committed" mutation (addNode/removeNode/connect/
 * updateNodeData/duplicateNode/paste/autoLayout/setEdgeType) pushes the prior
 * `{nodes, edges}` snapshot to `past[]` and clears `future[]`. Granular
 * position drag deltas go through `onNodesChange` and are NOT recorded — only
 * the final drop is captured when ReactFlow emits a `position` change with
 * `dragging: false` (we snapshot on that boundary).
 */
import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges, addEdge, reconnectEdge } from '@xyflow/react';
import { nanoid } from './nanoid.js';
import { BLOCKS_BY_ID } from '../blocks/registry.js';

const HISTORY_LIMIT = 50;

export const INITIAL_META = {
	id:        'wf_new',
	name:      'Workflow mới',
	desc:      '',
	enabled:   true,
	tags:      [],
	debug_breakpoints: {}, // PG-S5: { [nodeId]: { before: bool } }
	updatedAt: new Date().toISOString().slice(0, 10),
};

export const INITIAL_NODES = [
	{
		id: 'n_trigger',
		type: 'trigger',
		position: { x: 60, y: 200 },
		data: { ...BLOCKS_BY_ID['trigger.zalo_inbound'].defaults, blockId: 'trigger.zalo_inbound' },
	},
	{
		id: 'n_search',
		type: 'action',
		position: { x: 340, y: 200 },
		data: { ...BLOCKS_BY_ID['action.search_kg'].defaults, blockId: 'action.search_kg' },
	},
	{
		id: 'n_llm',
		type: 'llm',
		position: { x: 620, y: 200 },
		data: { ...BLOCKS_BY_ID['llm.compose_reply'].defaults, blockId: 'llm.compose_reply' },
	},
	{
		id: 'n_reply',
		type: 'action',
		position: { x: 900, y: 200 },
		data: { ...BLOCKS_BY_ID['action.reply_zalo'].defaults, blockId: 'action.reply_zalo' },
	},
];

export const INITIAL_EDGES = [
	{ id: 'e1', source: 'n_trigger', target: 'n_search', animated: true, type: 'smoothstep', reconnectable: true },
	{ id: 'e2', source: 'n_search',  target: 'n_llm',    animated: true, type: 'smoothstep', reconnectable: true },
	{ id: 'e3', source: 'n_llm',     target: 'n_reply',  animated: true, type: 'smoothstep', reconnectable: true },
];

const snapshot = (state) => ({
	nodes: state.nodes.map((n) => ({ ...n, data: { ...n.data }, position: { ...n.position } })),
	edges: state.edges.map((e) => ({ ...e })),
});

const pushHistory = (state) => {
	const past = [...state.past, snapshot(state)];
	while (past.length > HISTORY_LIMIT) past.shift();
	return { past, future: [] };
};

export const useBuilderStore = create((set, get) => ({
	meta:       { ...INITIAL_META },
	nodes:      INITIAL_NODES,
	edges:      INITIAL_EDGES,
	selectedId: null,
	selectedIds: [],
	selectedEdgeIds: [],
	clipboard:  null,
	defaultEdgeType: 'smoothstep',

	past:   [],
	future: [],

	// Canvas UX preferences (persisted with the workflow on save).
	snapToGrid:  false,
	snapGrid:    [16, 16],
	bgVariant:   'dots', // 'dots' | 'lines' | 'cross'
	viewport:    null,   // last-saved viewport for restore on open

	// Transient drag-helper state (not persisted).
	helperVertical:   null,
	helperHorizontal: null,

	isSettingsOpen: false,
	isConfirmOpen:  false,
	confirmPayload: null,
	isPaletteOpen:  true,
	isInspectorOpen: true,
	isTimelineOpen:  false,

	isRunning:  false,
	runId:      null,
	runDbId:    null,        // BE-7.E: real bizcity_automation_runs.run_id (string)
	runMode:    null,        // 'mock' | 'async' | 'sync'
	runStatus:  'idle',      // 'idle' | 'queued' | 'running' | 'ok' | 'fail' | 'cancelled'
	runError:   '',
	debugState: '',          // PG-S5: '' | 'pausing' | 'stepping' | 'paused_before:<node_id>'
	parentRunId: null,       // PG-S6: original run_id when this is a replay child
	nodeStatus: {},          // BE-7.E: { [nodeId]: 0|1|2|3 }  (0=run,1=ok,2=fail,3=skip)
	nodeOutputs: {},         // BE-7.E: { [nodeId]: outputObj } for inspector preview
	runLog:     [],

	// PG-S8 — Time scrubber (replay mode after run done).
	runStartedAtMs:  null,   // ms epoch — set on first log row
	runFinishedAtMs: null,   // ms epoch — set when run terminal
	runLogRows:      [],     // [{ step, node_id, status, ts(ms) }] for scrub recompute
	replayCursorMs:  null,   // null = realtime; otherwise ms offset from runStartedAtMs

	// ── Live inbox (channel-gateway Listener Bus mirror) ────────────────
	// Mọi event polled qua subscribeListenerStream lúc "Chạy thử" được push
	// vào đây để InboxLivePanel render conversation-style giống channel.
	inboxEvents:     [],
	listenActive:    false,
	listenTriggerCode: '',
	listenStatus:    'idle',  // 'idle'|'connecting'|'streaming'|'polling'|'error'
	listenFilter:    null,    // { platform, kind, account_id }

	// PG-S3 — Twin Event Bus mirror (kind='twin') for MPR Layer accordion.
	twinEvents:      [],

	// PG-S4 — Merged raw trace (all kinds: inbound/outbound/automation/twin/system).
	traceEvents:     [],

	// PG-S5 — Soft pause/step gate for live event stream.
	// listenPaused=true → onEvent buffers events into runner.pausedQueue
	// instead of routing to inbox/twin/capture. Resume drains all; Step drains 1.
	listenPaused:     false,
	pausedQueueSize:  0,

	// PG-S9 — Dry-run toggle (Toolbar). Truthy → runner appends `&dry=1` to
	// /workflows/:id/run, BE injects ctx._dry_run=true, side-effect blocks
	// (reply_zalo / send_email / http / db_write) skip real call và emit
	// synthetic outbound listener event với meta.dry=true.
	dryRun:           false,

	onNodesChange: (changes) => {
		const dragEnd = changes.some((c) => c.type === 'position' && c.dragging === false);
		const removed = changes.some((c) => c.type === 'remove');
		if (dragEnd || removed) {
			set((s) => ({ ...pushHistory(s), nodes: applyNodeChanges(changes, get().nodes) }));
		} else {
			set({ nodes: applyNodeChanges(changes, get().nodes) });
		}
	},
	onEdgesChange: (changes) => {
		const removed = changes.some((c) => c.type === 'remove');
		if (removed) {
			set((s) => ({ ...pushHistory(s), edges: applyEdgeChanges(changes, get().edges) }));
		} else {
			set({ edges: applyEdgeChanges(changes, get().edges) });
		}
	},
	onConnect: (params) => set((s) => ({
		...pushHistory(s),
		edges: addEdge({ ...params, animated: true, type: s.defaultEdgeType, reconnectable: true }, s.edges),
	})),

	/**
	 * Reconnect an existing edge to a new source/target Handle.
	 * Validates with the same `isValidConnection` rules. Keeps edge id + style
	 * so the visual doesn't jump style classes mid-drag.
	 */
	reconnectEdgeAction: (oldEdge, newConnection) => {
		if (!get().isValidConnection(newConnection)) return false;
		set((s) => ({
			...pushHistory(s),
			edges: reconnectEdge(oldEdge, newConnection, s.edges),
		}));
		return true;
	},

	removeEdge: (edgeId) => set((s) => ({
		...pushHistory(s),
		edges: s.edges.filter((e) => e.id !== edgeId),
	})),

	setSelected: (ids, edgeIds = []) => set({
		selectedIds: ids,
		selectedId: ids.length === 1 ? ids[0] : null,
		selectedEdgeIds: edgeIds,
	}),

	isValidConnection: (conn) => {
		const ok =
			conn.source !== conn.target &&
			!(get().nodes.find((n) => n.id === conn.target)?.type === 'trigger');
		if (typeof window !== 'undefined' && window.__AW_DEBUG__) {
			// eslint-disable-next-line no-console
			console.log('[AW][edge] isValidConnection', { conn, ok });
		}
		return ok;
	},

	addNode: (blockId, position, parentId = null) => {
		const block = BLOCKS_BY_ID[blockId];
		if (!block) return;
		const id = 'n_' + nanoid(6);
		const newNode = {
			id,
			type: block.kind,
			position,
			data: { ...block.defaults, blockId },
			...(parentId ? { parentId, extent: 'parent' } : null),
			...(block.kind === 'group' ? { style: { width: 320, height: 200 } } : null),
		};
		set((s) => ({
			...pushHistory(s),
			nodes: [...s.nodes, newNode],
			selectedId: id,
			selectedIds: [id],
			isInspectorOpen: true,
		}));
	},

	updateNodeData: (id, patch) => set((s) => ({
		...pushHistory(s),
		nodes: s.nodes.map((n) =>
			n.id === id ? { ...n, data: { ...n.data, ...patch } } : n
		),
	})),

	removeNode: (id) => set((s) => ({
		...pushHistory(s),
		nodes: s.nodes.filter((n) => n.id !== id && n.parentId !== id),
		edges: s.edges.filter((e) => e.source !== id && e.target !== id),
		selectedId:  s.selectedId === id ? null : s.selectedId,
		selectedIds: s.selectedIds.filter((x) => x !== id),
	})),

	removeSelected: () => {
		const ids     = get().selectedIds;
		const edgeIds = get().selectedEdgeIds;
		if (!ids.length && !edgeIds.length) return;
		set((s) => ({
			...pushHistory(s),
			nodes: s.nodes.filter((n) => !ids.includes(n.id) && !ids.includes(n.parentId)),
			edges: s.edges.filter(
				(e) =>
					!ids.includes(e.source) &&
					!ids.includes(e.target) &&
					!edgeIds.includes(e.id)
			),
			selectedId: null,
			selectedIds: [],
			selectedEdgeIds: [],
		}));
	},

	duplicateNode: (id) => {
		const src = get().nodes.find((n) => n.id === id);
		if (!src) return;
		const newId = 'n_' + nanoid(6);
		set((s) => ({
			...pushHistory(s),
			nodes: [
				...s.nodes,
				{
					...src,
					id: newId,
					position: { x: src.position.x + 60, y: src.position.y + 60 },
					selected: false,
				},
			],
			selectedId: newId,
			selectedIds: [newId],
		}));
	},

	copySelection: () => {
		const ids = get().selectedIds;
		if (!ids.length) return;
		const nodes = get().nodes.filter((n) => ids.includes(n.id));
		const edges = get().edges.filter((e) => ids.includes(e.source) && ids.includes(e.target));
		set({ clipboard: { nodes, edges } });
	},
	cutSelection: () => {
		get().copySelection();
		get().removeSelected();
	},
	paste: (offset = { x: 32, y: 32 }) => {
		const cb = get().clipboard;
		if (!cb || !cb.nodes.length) return;
		const idMap = new Map();
		const nodes = cb.nodes.map((n) => {
			const newId = 'n_' + nanoid(6);
			idMap.set(n.id, newId);
			return {
				...n,
				id: newId,
				position: { x: n.position.x + offset.x, y: n.position.y + offset.y },
				selected: true,
			};
		});
		const edges = cb.edges.map((e) => ({
			...e,
			id: 'e_' + nanoid(6),
			source: idMap.get(e.source) || e.source,
			target: idMap.get(e.target) || e.target,
		}));
		set((s) => ({
			...pushHistory(s),
			nodes:       [...s.nodes, ...nodes],
			edges:       [...s.edges, ...edges],
			selectedIds: nodes.map((n) => n.id),
			selectedId:  nodes.length === 1 ? nodes[0].id : null,
		}));
	},

	undo: () => {
		const { past } = get();
		if (!past.length) return;
		const prev = past[past.length - 1];
		set((s) => ({
			past:   past.slice(0, -1),
			future: [snapshot(s), ...s.future].slice(0, HISTORY_LIMIT),
			nodes:  prev.nodes,
			edges:  prev.edges,
		}));
	},
	redo: () => {
		const { future } = get();
		if (!future.length) return;
		const next = future[0];
		set((s) => ({
			future: future.slice(1),
			past:   [...s.past, snapshot(s)].slice(-HISTORY_LIMIT),
			nodes:  next.nodes,
			edges:  next.edges,
		}));
	},

	setDefaultEdgeType: (type) => set({ defaultEdgeType: type }),
	setAllEdgesType:    (type) => set((s) => ({
		...pushHistory(s),
		defaultEdgeType: type,
		edges: s.edges.map((e) => ({ ...e, type })),
	})),

	setNodes: (nodes) => set((s) => ({ ...pushHistory(s), nodes })),

	select: (id) => set({
		selectedId: id,
		selectedIds: id ? [id] : [],
		isInspectorOpen: id ? true : get().isInspectorOpen,
	}),

	updateMeta: (patch) => set({ meta: { ...get().meta, ...patch } }),

	openSettings:  () => set({ isSettingsOpen: true }),
	closeSettings: () => set({ isSettingsOpen: false }),
	openConfirm:   (payload) => set({ isConfirmOpen: true, confirmPayload: payload }),
	closeConfirm:  () => set({ isConfirmOpen: false, confirmPayload: null }),
	togglePalette:   () => set({ isPaletteOpen:   !get().isPaletteOpen }),
	toggleInspector: () => set({ isInspectorOpen: !get().isInspectorOpen }),
	toggleTimeline:  () => set({ isTimelineOpen:  !get().isTimelineOpen }),

	startRun: () => {
		const runId = 'run_' + nanoid(6);
		set({
			isRunning: true,
			runId,
			runDbId: null,
			runMode: null,
			runStatus: 'running',
			runError: '',
			debugState: '',
			parentRunId: null,
			nodeStatus: {},
			nodeOutputs: {},
			runLog: [],
			isTimelineOpen: true,
			runStartedAtMs: Date.now(),
			runFinishedAtMs: null,
			runLogRows: [],
			replayCursorMs: null,
		});
		return runId;
	},
	endRun:   (patch = {}) => set({ isRunning: false, runFinishedAtMs: Date.now(), ...patch }),
	pushLog:  (entry) => set({
		runLog: [
			...get().runLog,
			{ ts: Date.now(), ...entry },
		],
	}),
	setRunMeta: (patch) => set({ ...patch }),
	setNodeStatus: (nodeId, status, output) => set((s) => ({
		nodeStatus:  { ...s.nodeStatus, [nodeId]: status },
		nodeOutputs: output !== undefined ? { ...s.nodeOutputs, [nodeId]: output } : s.nodeOutputs,
	})),
	clearLog: () => set({
		runLog: [], nodeStatus: {}, nodeOutputs: {},
		runLogRows: [], replayCursorMs: null, runStartedAtMs: null, runFinishedAtMs: null,
	}),

	// PG-S8 — record each log row's timestamp for time-travel scrubbing.
	pushRunLogRow: (row) => set((s) => {
		if (!row || !row.node_id) return s;
		const ts = Number(row.ts) || Date.now();
		const rec = {
			step:    Number(row.step) || 0,
			node_id: String(row.node_id),
			status:  Number(row.status),
			ts,
		};
		const idx = s.runLogRows.findIndex(
			(r) => r.step === rec.step && r.node_id === rec.node_id
		);
		let runLogRows;
		if (idx >= 0) {
			runLogRows = s.runLogRows.slice();
			runLogRows[idx] = rec;
		} else {
			runLogRows = [...s.runLogRows, rec];
		}
		const patch = { runLogRows };
		if (!s.runStartedAtMs || ts < s.runStartedAtMs) {
			patch.runStartedAtMs = ts;
		}
		return patch;
	}),

	// PG-S8 — set/clear replay cursor and recompute nodeStatus snapshot at that point.
	setReplayCursor: (cursorMs) => {
		const s = get();
		if (cursorMs === null || cursorMs === undefined) {
			// Realtime — replay all rows for final state.
			const ns = {};
			s.runLogRows.forEach((r) => { ns[r.node_id] = r.status; });
			set({ replayCursorMs: null, nodeStatus: ns });
			return;
		}
		const start = s.runStartedAtMs || 0;
		const limit = start + Math.max(0, Number(cursorMs) || 0);
		const ns = {};
		s.runLogRows
			.slice()
			.sort((a, b) => a.ts - b.ts || a.step - b.step)
			.forEach((r) => { if (r.ts <= limit) ns[r.node_id] = r.status; });
		set({ replayCursorMs: Math.max(0, Number(cursorMs) || 0), nodeStatus: ns });
	},

	pushInboxEvent: (ev) => set((s) => {
		if (!ev || !ev.id) return s;
		if (s.inboxEvents.some((x) => x.id === ev.id)) return s;
		const next = [...s.inboxEvents, ev];
		return { inboxEvents: next.length > 200 ? next.slice(-200) : next };
	}),
	clearInboxEvents: () => set({ inboxEvents: [] }),
	setListenStatus:  (st) => set({ listenStatus: st }),

	// PG-S3 — Twin events (kind='twin') for MPR Layer accordion.
	pushTwinEvent: (ev) => set((s) => {
		if (!ev || !ev.id) return s;
		if (s.twinEvents.some((x) => x.id === ev.id)) return s;
		const next = [...s.twinEvents, ev];
		return { twinEvents: next.length > 200 ? next.slice(-200) : next };
	}),
	clearTwinEvents: () => set({ twinEvents: [] }),

	// PG-S4 — Raw trace (union of all kinds), capped to 500.
	pushTraceEvent: (ev) => set((s) => {
		if (!ev || !ev.id) return s;
		if (s.traceEvents.some((x) => x.id === ev.id && x.kind === ev.kind)) return s;
		const next = [...s.traceEvents, ev];
		return { traceEvents: next.length > 500 ? next.slice(-500) : next };
	}),
	clearTraceEvents: () => set({ traceEvents: [] }),

	// PG-S5 — Pause/step controls.
	setListenPaused:    (v) => set({ listenPaused: !!v }),	setPausedQueueSize: (n) => set({ pausedQueueSize: Math.max(0, Number(n) || 0) }),

	// PG-S9 — Dry-run toggle.
	setDryRun: (v) => set({ dryRun: !!v }),
	toggleDryRun: () => set((s) => ({ dryRun: !s.dryRun })),

	// ── Canvas prefs ────────────────────────────────────────────────────
	toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
	setBgVariant:     (v) => set({ bgVariant: v }),
	setViewport:      (vp) => set({ viewport: vp }),
	setHelperLines:   (vertical, horizontal) => set({ helperVertical: vertical, helperHorizontal: horizontal }),
	clearHelperLines: () => set({ helperVertical: null, helperHorizontal: null }),

	// ── Bulk graph swap (used by Import JSON) ───────────────────────────
	replaceGraph: ({ meta, nodes, edges }) => set((s) => ({
		...pushHistory(s),
		meta:  meta  ? { ...s.meta, ...meta } : s.meta,
		nodes: Array.isArray(nodes) ? nodes : s.nodes,
		edges: Array.isArray(edges) ? edges : s.edges,
		selectedId: null,
		selectedIds: [],
		selectedEdgeIds: [],
	})),
}));
