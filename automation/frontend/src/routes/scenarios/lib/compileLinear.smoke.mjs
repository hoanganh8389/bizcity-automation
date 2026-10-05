/**
 * compileLinear · Roundtrip smoke test (no test framework required).
 *
 * Run:  node src/routes/scenarios/lib/compileLinear.smoke.mjs
 *       (or npm script `npm run smoke:compileLinear`)
 *
 * Verifies Sprint Scenario Builder MVP §11 Gap 5:
 *   1. compileLinearToWorkflow(linear) preserves trigger_config.scenario_uuid
 *      + trigger_config.keywords[] + step ids/types/configs.
 *   2. decompileWorkflowToLinear(workflow_row) round-trips back to the
 *      original linear scenario (UUID + keywords + steps intact).
 *   3. Empty linear (no trigger / no steps) compiles to a minimal payload
 *      without throwing.
 *   4. Non-linear graph (branching) → decompile() returns null (caller
 *      falls back to advanced canvas).
 *
 * @since Scenario Builder MVP (2026-06-01)
 */
import { compileLinearToWorkflow, decompileWorkflowToLinear, isScenarioRow } from './compileLinear.js';
import { SCENARIO_TAG } from './scenarioSchema.js';

let passed = 0;
let failed = 0;
const failures = [];

function assert(cond, label, detail = '') {
	if (cond) {
		passed++;
		console.log(`  ✓ ${label}`);
	} else {
		failed++;
		failures.push({ label, detail });
		console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
	}
}

function deepEqual(a, b) {
	return JSON.stringify(a) === JSON.stringify(b);
}

console.log('\n[Test 1] compile() preserves UUID + keywords + steps');
{
	const uuid = 'abcdef0123456789abcdef0123456789';
	const linear = {
		meta:    { name: 'Probe scenario', desc: 'd', enabled: true, tags: ['custom'] },
		trigger: {
			key:           'fb_message',
			instance_id:   'page_xyz',
			page_id:       '12345',
			keywords:      ['xin chao', 'hello', 'menu'],
			scenario_uuid: uuid,
		},
		steps: [
			{ id: 's_one', type: 'send_text', config: { text: 'Hi!' } },
			{ id: 's_two', type: 'ai_reply',  config: { prompt: 'Tell joke' } },
		],
	};
	const wf = compileLinearToWorkflow(linear);

	assert(wf.trigger_type === 'fb_message', 'trigger_type derived');
	assert(wf.trigger_config.scenario_uuid === uuid, 'scenario_uuid preserved');
	assert(deepEqual(wf.trigger_config.keywords, ['xin chao', 'hello', 'menu']), 'keywords[] preserved');
	assert(wf.trigger_config.filter === 'xin chao', 'filter pre-baked from keyword[0]');
	assert(wf.tags.includes(SCENARIO_TAG), 'scenario tag injected');
	assert(wf.graph.nodes.length === 3, '3 nodes (1 trigger + 2 steps)', `got ${wf.graph.nodes.length}`);
	assert(wf.graph.edges.length === 2, '2 edges chained');
	assert(wf.graph.nodes[1].id === 's_one', 'step id preserved');
	assert(wf.graph.nodes[2].data.blockId === 'llm.compose_reply', 'ai_reply maps to llm.compose_reply');
}

console.log('\n[Test 2] decompile() round-trips back losslessly');
{
	const uuid = 'roundtripabcdef0123456789abcdef01';
	const linear = {
		meta:    { name: 'RT', desc: '', enabled: true, tags: [] },
		trigger: {
			key:           'zalo_inbound',
			instance_id:   'oa_001',
			page_id:       '',
			keywords:      ['mua hang', 'order'],
			scenario_uuid: uuid,
		},
		steps: [
			{ id: 'a1', type: 'send_text', config: { text: 'Welcome' } },
		],
	};
	const wf = compileLinearToWorkflow(linear);
	const row = {
		id:                  42,
		name:                wf.name,
		description:         wf.description,
		enabled:             wf.enabled,
		trigger_type:        wf.trigger_type,
		trigger_config:      wf.trigger_config,
		tags_array:          wf.tags,
		graph:               wf.graph,
	};
	const back = decompileWorkflowToLinear(row);

	assert(back !== null, 'decompile returns linear (not null)');
	assert(back && back.trigger.scenario_uuid === uuid, 'UUID round-tripped');
	assert(back && deepEqual(back.trigger.keywords, ['mua hang', 'order']), 'keywords[] round-tripped');
	assert(back && back.trigger.key === 'zalo_inbound', 'trigger.key round-tripped');
	assert(back && back.steps.length === 1 && back.steps[0].type === 'send_text', 'step type round-tripped');
	assert(back && back.steps[0].config.text === 'Welcome', 'step config round-tripped');
	assert(isScenarioRow(row), 'isScenarioRow → true');
}

console.log('\n[Test 3] empty linear compiles without throwing');
{
	const empty = { meta: {}, trigger: { key: '', keywords: [] }, steps: [] };
	let threw = false;
	let wf = null;
	try { wf = compileLinearToWorkflow(empty); } catch (_e) { threw = true; }
	assert(!threw, 'no exception');
	assert(wf && Array.isArray(wf.graph.nodes), 'graph.nodes is array');
	assert(wf && wf.graph.nodes.length === 0, 'no trigger → 0 nodes');
}

console.log('\n[Test 4] branching graph → decompile returns null (fallback to canvas)');
{
	const row = {
		id: 99,
		name: 'Branching',
		trigger_type: 'fb_message',
		trigger_config: { keywords: [] },
		tags_array: [],
		graph: {
			nodes: [
				{ id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { blockId: 'trigger.fb_message' } },
				{ id: 's1', type: 'action', position: { x: 100, y: 0 }, data: { blockId: 'action.reply_zalo' } },
				{ id: 's2', type: 'action', position: { x: 100, y: 100 }, data: { blockId: 'action.reply_zalo' } },
			],
			edges: [
				{ id: 'e1', source: 'trigger', target: 's1' },
				{ id: 'e2', source: 'trigger', target: 's2' },
			],
		},
	};
	const back = decompileWorkflowToLinear(row);
	assert(back === null, 'branching trigger → null');
}

console.log(`\n[Result] passed=${passed} failed=${failed}`);
if (failed > 0) {
	console.error('\nFailures:');
	failures.forEach((f) => console.error(`  - ${f.label}${f.detail ? ' :: ' + f.detail : ''}`));
	process.exit(1);
}
process.exit(0);
