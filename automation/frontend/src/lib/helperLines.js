/**
 * Helper alignment lines — show vertical/horizontal guides while dragging a
 * node so it snaps visually to other nodes' edges/centres. Implemented as a
 * Zustand-friendly pure function: given the dragging node + the rest, return
 * the snapped position + the guide lines to render.
 *
 * Mirrors the canonical xyflow "Helper Lines" example.
 */
const TOLERANCE = 5;

/**
 * @param {object} dragNode  — node being dragged (with .position .width .height)
 * @param {Array}  others    — other nodes
 * @returns {{position:{x,y}, vertical?:number, horizontal?:number}}
 */
export function snapWithHelperLines(dragNode, others) {
	const nodeA = withBounds(dragNode);
	if (!nodeA) return { position: dragNode.position };

	let snapX = null;
	let snapY = null;

	for (const o of others) {
		if (o.id === dragNode.id) continue;
		const nodeB = withBounds(o);
		if (!nodeB) continue;

		// Vertical alignment candidates (left/centre/right of A vs left/centre/right of B).
		const xCandidates = [
			[nodeA.left,   nodeB.left,   nodeB.left],
			[nodeA.right,  nodeB.right,  nodeB.right - nodeA.width],
			[nodeA.left,   nodeB.right,  nodeB.right],
			[nodeA.right,  nodeB.left,   nodeB.left - nodeA.width],
			[nodeA.centerX, nodeB.centerX, nodeB.centerX - nodeA.width / 2],
		];
		for (const [a, b, newX] of xCandidates) {
			if (Math.abs(a - b) < TOLERANCE) {
				snapX = { x: newX, line: b };
				break;
			}
		}

		const yCandidates = [
			[nodeA.top,    nodeB.top,    nodeB.top],
			[nodeA.bottom, nodeB.bottom, nodeB.bottom - nodeA.height],
			[nodeA.top,    nodeB.bottom, nodeB.bottom],
			[nodeA.bottom, nodeB.top,    nodeB.top - nodeA.height],
			[nodeA.centerY, nodeB.centerY, nodeB.centerY - nodeA.height / 2],
		];
		for (const [a, b, newY] of yCandidates) {
			if (Math.abs(a - b) < TOLERANCE) {
				snapY = { y: newY, line: b };
				break;
			}
		}

		if (snapX && snapY) break;
	}

	return {
		position: {
			x: snapX ? snapX.x : dragNode.position.x,
			y: snapY ? snapY.y : dragNode.position.y,
		},
		vertical:   snapX ? snapX.line : null,
		horizontal: snapY ? snapY.line : null,
	};
}

function withBounds(n) {
	if (!n || !n.position) return null;
	const w = n.measured?.width  || n.width  || 240;
	const h = n.measured?.height || n.height || 80;
	return {
		id: n.id,
		left:   n.position.x,
		top:    n.position.y,
		right:  n.position.x + w,
		bottom: n.position.y + h,
		centerX: n.position.x + w / 2,
		centerY: n.position.y + h / 2,
		width:  w,
		height: h,
	};
}
