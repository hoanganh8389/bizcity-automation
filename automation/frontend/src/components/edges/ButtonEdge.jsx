/**
 * Button edge — xyflow custom edge that renders an inline "×" delete button
 * at the centre of the edge. The button only becomes visible on hover or
 * when the edge is selected (CSS handles the fade). This mirrors the
 * canonical xyflow `EdgeButton` example, adapted to our store and styling.
 *
 * The edge falls back to a smoothstep path so it visually matches the
 * default `smoothstep` edge type used elsewhere — switching an edge to
 * `type:"button"` does not cause a path shape jump.
 */
import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	useReactFlow,
} from '@xyflow/react';
import { useBuilderStore } from '../../store/builderStore.js';

export default function ButtonEdge(props) {
	const {
		id, sourceX, sourceY, targetX, targetY,
		sourcePosition, targetPosition,
		markerEnd, style = {}, selected, label,
		// [2026-07-03 Johnny Chu] GAP-BRANCH-P2-1 — sourceHandle passed by xyflow for condition branch edges.
		sourceHandle,
	} = props;

	const { setEdges } = useReactFlow();
	const removeEdge   = useBuilderStore((s) => s.removeEdge);

	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX, sourceY, targetX, targetY,
		sourcePosition, targetPosition,
		borderRadius: 8,
	});

	// Derive branch badge from sourceHandle if the edge originates from a condition node.
	const branchHandle = sourceHandle === 'true' || sourceHandle === 'false' ? sourceHandle : null;
	const branchColor  = branchHandle === 'true' ? '#16a34a' : branchHandle === 'false' ? '#dc2626' : null;
	// Apply green/red tint to edge stroke when it is a branch edge.
	const edgeStroke = branchColor
		? ( selected ? branchColor : branchColor + 'aa' )
		: ( selected ? '#4f46e5' : '#94a3b8' );

	const onDelete = (e) => {
		e.stopPropagation();
		// Use store action (records history); fall back to xyflow setter.
		if (typeof removeEdge === 'function') {
			removeEdge(id);
		} else {
			setEdges((eds) => eds.filter((ed) => ed.id !== id));
		}
	};

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				markerEnd={markerEnd}
				style={{ stroke: edgeStroke, strokeWidth: selected ? 2.5 : 1.6, ...style }}
			/>
			<EdgeLabelRenderer>
				<div
					className={`aw-edge-button ${selected ? 'is-selected' : ''}`}
					style={{
						position: 'absolute',
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						pointerEvents: 'all',
					}}
				>
					{branchHandle && (
						<span
							className="aw-edge-branch-badge"
							style={{
								background: branchColor,
								color: '#fff',
								borderRadius: '4px',
								padding: '1px 5px',
								fontSize: '10px',
								fontWeight: 700,
								marginRight: '2px',
								letterSpacing: '0.02em',
							}}
						>
							{branchHandle}
						</span>
					)}
					{label ? <span className="aw-edge-label">{label}</span> : null}
					<button
						type="button"
						onClick={onDelete}
						title="Xoá kết nối"
						className="aw-edge-x"
					>
						×
					</button>
				</div>
			</EdgeLabelRenderer>
		</>
	);
}
