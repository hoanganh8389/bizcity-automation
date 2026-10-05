/**
 * Custom connection line — preview rendered while user drags from a Handle
 * (either creating a new edge or reconnecting an existing one). Uses the
 * same smoothstep path as the default edge type so there is no visual
 * "jump" between the live preview and the final edge.
 */
import { getSmoothStepPath } from '@xyflow/react';

export default function CustomConnectionLine({
	fromX, fromY, toX, toY, fromPosition, toPosition,
}) {
	const [d] = getSmoothStepPath({
		sourceX: fromX, sourceY: fromY,
		targetX: toX,   targetY: toY,
		sourcePosition: fromPosition,
		targetPosition: toPosition,
		borderRadius: 8,
	});

	return (
		<g className="aw-connection-line">
			<path
				fill="none"
				stroke="#6366f1"
				strokeWidth={1.6}
				strokeDasharray="5 4"
				strokeOpacity={0.85}
				d={d}
			/>
			<circle cx={toX} cy={toY} r={3.5} fill="#6366f1" stroke="#fff" strokeWidth={1.5} />
		</g>
	);
}
