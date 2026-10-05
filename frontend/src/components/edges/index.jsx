/**
 * Edge type registry — passed to `<ReactFlow edgeTypes={EDGE_TYPES} />`.
 * - `button`: BaseEdge + delete X on hover (canonical xyflow EdgeButton).
 * Other edge types (`smoothstep`, `step`, `straight`, `default`) come from
 * xyflow's built-ins.
 */
import ButtonEdge from './ButtonEdge.jsx';

export const EDGE_TYPES = {
	button: ButtonEdge,
};
