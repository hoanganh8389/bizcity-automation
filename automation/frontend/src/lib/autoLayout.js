/**
 * Naive layered auto-layout — no external dep (avoids dagre bloat).
 *
 * Algorithm:
 *  1. Build adjacency from edges (source → targets[]).
 *  2. Compute longest-path rank for each node (BFS from roots; nodes without
 *     incoming edges are rank 0).
 *  3. Within each rank, keep original order (stable sort).
 *  4. Layout: x = rank * COL_GAP + COL_PAD, y = idx_in_rank * ROW_GAP + ROW_PAD.
 *
 * Returns a new nodes array with updated positions; does NOT mutate input.
 */
const COL_GAP = 260;
const ROW_GAP = 130;
const COL_PAD = 40;
const ROW_PAD = 40;

export function autoLayout(nodes, edges) {
	if (!nodes.length) return nodes;

	const incoming = new Map();   // id → count
	const adj      = new Map();   // id → targets[]
	nodes.forEach((n) => { incoming.set(n.id, 0); adj.set(n.id, []); });
	edges.forEach((e) => {
		if (!adj.has(e.source)) return;
		adj.get(e.source).push(e.target);
		incoming.set(e.target, (incoming.get(e.target) || 0) + 1);
	});

	const rank = new Map();
	const queue = [];
	nodes.forEach((n) => {
		if ((incoming.get(n.id) || 0) === 0) {
			rank.set(n.id, 0);
			queue.push(n.id);
		}
	});

	while (queue.length) {
		const u = queue.shift();
		const ru = rank.get(u) || 0;
		(adj.get(u) || []).forEach((v) => {
			const rv = rank.get(v);
			const nextRank = ru + 1;
			if (rv === undefined || nextRank > rv) {
				rank.set(v, nextRank);
				queue.push(v);
			}
		});
	}

	// Any disconnected node defaults to rank 0
	nodes.forEach((n) => { if (!rank.has(n.id)) rank.set(n.id, 0); });

	// Group by rank, preserving original order
	const byRank = new Map();
	nodes.forEach((n) => {
		const r = rank.get(n.id) || 0;
		if (!byRank.has(r)) byRank.set(r, []);
		byRank.get(r).push(n.id);
	});

	const positions = new Map();
	[...byRank.keys()].sort((a, b) => a - b).forEach((r) => {
		byRank.get(r).forEach((id, idx) => {
			positions.set(id, {
				x: COL_PAD + r * COL_GAP,
				y: ROW_PAD + idx * ROW_GAP,
			});
		});
	});

	return nodes.map((n) => (
		positions.has(n.id)
			? { ...n, position: positions.get(n.id) }
			: n
	));
}
