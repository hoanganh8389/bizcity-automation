/**
 * Compile / decompile linear scenario ↔ xyflow workflow graph.
 *
 * Linear scenario shape (in-memory):
 * {
 *   meta: { id, name, desc, enabled, tags: [...,'scenario'] },
 *   trigger: { key, instance_id, keywords: [], page_id?: '' },
 *   steps:   [ { id, type, config: {...}, condition?: '' }, ... ]
 * }
 *
 * Workflow graph (xyflow + BE):
 *   nodes: [ {id, type:'trigger'|'action'|'logic'|'llm', position, data: { blockId, label, ...config }} ]
 *   edges: [ {id, source, target, sourceHandle?, targetHandle?} ]
 *
 * Convention:
 *   - Trigger node id = 'trigger'.
 *   - Step node id = step.id (uuid-like) or `step_${index}`.
 *   - Edges form a single chain: trigger → step0 → step1 → … → stepN.
 *   - Layout: x=120 (trigger), 360, 600… ; y=140.
 *
 * @since 2026-06-01
 */
import { stepDefByKey, triggerDefByKey, stepKeyByBlockId, triggerKeyByBlockId, SCENARIO_TAG } from './scenarioSchema.js';

const X_TRIGGER = 120;
const X_STEP    = 360;
const X_GAP     = 280;
const Y         = 160;

function uid(prefix = 'step') {
	return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ─────────────────────────────────────────────────────────────────
 * compile(): linear → workflow payload (graph + meta + trigger_*)
 * Output is the same shape as `payload` in Toolbar.jsx onSave().
 * ─────────────────────────────────────────────────────────────── */
export function compileLinearToWorkflow(linear) {
	const trigDef  = triggerDefByKey(linear?.trigger?.key) || null;
	const trigConf = {
		instance_id: linear?.trigger?.instance_id || '',
		// BE matcher uses substring `filter`. Pre-bake first keyword for compat.
		filter:      (linear?.trigger?.keywords || [])[0] || '',
		// Extra: keep full keyword list so BE can adopt OR-match later.
		keywords:    Array.isArray(linear?.trigger?.keywords) ? linear.trigger.keywords : [],
		page_id:     linear?.trigger?.page_id || '',
		// Bot-Bán-Hàng compat: stable scenario UUID for deep-link / ad ref encoding.
		scenario_uuid: linear?.trigger?.scenario_uuid || '',
	};

	const nodes = [];
	const edges = [];

	if (trigDef) {
		nodes.push({
			id: 'trigger',
			type: 'trigger',
			position: { x: X_TRIGGER, y: Y },
			data: {
				blockId: trigDef.blockId,
				label:   trigDef.label,
				...trigConf,
			},
		});
	}

	let prevId = trigDef ? 'trigger' : null;
	(linear?.steps || []).forEach((step, idx) => {
		const def = stepDefByKey(step.type);
		if (!def) return;
		const nodeId = step.id || uid('step');
		const nodeType = def.blockId.startsWith('trigger.')
			? 'trigger'
			: def.blockId.startsWith('logic.')
				? 'logic'
				: def.blockId.startsWith('llm.')
					? 'llm'
					: 'action';
		nodes.push({
			id: nodeId,
			type: nodeType,
			position: { x: X_STEP + idx * X_GAP, y: Y },
			data: {
				blockId: def.blockId,
				label:   step.label || def.label,
				...(def.defaultConfig || {}),
				...(step.config || {}),
				_condition: step.condition || '',
			},
		});
		if (prevId) {
			edges.push({
				id: `e_${prevId}_${nodeId}`,
				source: prevId,
				target: nodeId,
			});
		}
		prevId = nodeId;
	});

	const tags = Array.isArray(linear?.meta?.tags) ? Array.from(new Set([...linear.meta.tags, SCENARIO_TAG])) : [SCENARIO_TAG];

	return {
		name:           linear?.meta?.name || 'Kịch bản mới',
		description:    linear?.meta?.desc || '',
		enabled:        linear?.meta?.enabled ? 1 : 0,
		trigger_type:   trigDef ? trigDef.blockId.replace(/^trigger\./, '') : '',
		trigger_config: trigConf,
		tags,
		graph:          { nodes, edges, viewport: null },
	};
}

/* ─────────────────────────────────────────────────────────────────
 * decompile(): workflow row → linear (returns null if not linear)
 * Heuristic: exactly 1 trigger + each non-trigger node has at most 1
 * incoming + 1 outgoing edge → linear. Else return null and caller
 * should redirect user to /builder/:id (advanced canvas).
 * ─────────────────────────────────────────────────────────────── */
export function decompileWorkflowToLinear(row) {
	if (!row) return null;
	const graph = row.graph
		|| (typeof row.graph_json === 'string' ? safeParse(row.graph_json) : null)
		|| {};
	const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
	const edges = Array.isArray(graph.edges) ? graph.edges : [];

	const triggerNodes = nodes.filter((n) => n.type === 'trigger');
	if (triggerNodes.length !== 1) return null;

	// Build adjacency (out-degrees, in-degrees).
	const out = new Map();
	const inn = new Map();
	for (const e of edges) {
		out.set(e.source, [...(out.get(e.source) || []), e.target]);
		inn.set(e.target, [...(inn.get(e.target) || []), e.source]);
	}
	// Each node ≤1 outgoing, ≤1 incoming → linear.
	for (const n of nodes) {
		if ((out.get(n.id) || []).length > 1) return null;
		if ((inn.get(n.id) || []).length > 1) return null;
	}

	// Walk from trigger.
	const trig = triggerNodes[0];
	const ordered = [trig];
	let cur = (out.get(trig.id) || [])[0];
	const visited = new Set([trig.id]);
	while (cur && !visited.has(cur)) {
		visited.add(cur);
		const node = nodes.find((n) => n.id === cur);
		if (!node) break;
		ordered.push(node);
		cur = (out.get(cur) || [])[0];
	}
	if (ordered.length !== nodes.length) return null; // disconnected pieces → not linear

	const trigCfg = row.trigger_config
		|| (typeof row.trigger_config_json === 'string' ? safeParse(row.trigger_config_json) : null)
		|| trig.data || {};

	const triggerKey = triggerKeyByBlockId(trig.data?.blockId || `trigger.${row.trigger_type}`);

	const linear = {
		meta: {
			id:      row.id,
			name:    row.name || '',
			desc:    row.description || '',
			enabled: !!row.enabled,
			tags:    Array.isArray(row.tags_array) ? row.tags_array : [],
		},
		trigger: {
			key:           triggerKey,
			instance_id:   String(trigCfg.instance_id || ''),
			page_id:       String(trigCfg.page_id || ''),
			keywords:      normalizeKeywords(trigCfg),
			scenario_uuid: String(trigCfg.scenario_uuid || ''),
		},
		steps: ordered.slice(1).map((n) => {
			const stepKey = stepKeyByBlockId(n.data?.blockId);
			if (!stepKey) return null;
			const def = stepDefByKey(stepKey);
			const config = {};
			Object.entries(n.data || {}).forEach(([k, v]) => {
				if (k === 'blockId' || k === 'label' || k === '_condition') return;
				config[k] = v;
			});
			return {
				id:        n.id,
				type:      stepKey,
				label:     n.data?.label || def?.label || stepKey,
				config,
				condition: n.data?._condition || '',
			};
		}).filter(Boolean),
	};

	// If any step couldn't map to a known stepKey → caller should fall back to canvas.
	if (linear.steps.length !== ordered.length - 1) return null;

	return linear;
}

/** Detect if a workflow row is a "scenario" (linear shape + tag). */
export function isScenarioRow(row) {
	const tags = Array.isArray(row?.tags_array) ? row.tags_array : [];
	if (tags.includes(SCENARIO_TAG)) return true;
	// Also accept linear-shape workflows with no tag (best-effort).
	return decompileWorkflowToLinear(row) !== null;
}

function safeParse(s) {
	try { return JSON.parse(s); } catch (_) { return null; }
}

function normalizeKeywords(cfg) {
	if (Array.isArray(cfg.keywords)) return cfg.keywords.filter(Boolean);
	const f = String(cfg.filter || '').trim();
	return f ? [f] : [];
}

export function emptyLinear() {
	return {
		meta: { id: null, name: '', desc: '', enabled: false, tags: [SCENARIO_TAG] },
		trigger: { key: 'fb_message', instance_id: '', page_id: '', keywords: [], scenario_uuid: '' },
		steps: [],
	};
}

export function newStep(typeKey) {
	const def = stepDefByKey(typeKey);
	if (!def) return null;
	return {
		id:        uid('step'),
		type:      typeKey,
		label:     def.label,
		config:    { ...(def.defaultConfig || {}) },
		condition: '',
	};
}
