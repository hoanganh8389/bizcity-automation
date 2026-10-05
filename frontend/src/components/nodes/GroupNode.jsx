import { NodeResizer } from '@xyflow/react';
import { useBuilderStore } from '../../store/builderStore.js';

/**
 * Group node — a resizable container for child nodes. Children become group
 * members by setting `parentId: <groupId>` + `extent: 'parent'`. To drop a
 * block inside a group, simply drag from the palette and release while the
 * mouse is over the group (Canvas onDrop walks up the DOM to find a group
 * node intersected by cursor).
 */
export default function GroupNode({ id, data, selected }) {
	const updateNodeData = useBuilderStore((s) => s.updateNodeData);
	const label = data?.label || 'Nhóm';

	return (
		<div
			style={{
				width: '100%', height: '100%', minWidth: 200, minHeight: 120,
				border: `1.5px dashed ${selected ? '#4f46e5' : '#94a3b8'}`,
				background: selected ? 'rgba(79,70,229,0.05)' : 'rgba(148,163,184,0.05)',
				borderRadius: 10, position: 'relative',
			}}
		>
			<NodeResizer
				minWidth={200} minHeight={120}
				isVisible={selected}
				lineStyle={{ borderColor: '#4f46e5' }}
				handleStyle={{ background: '#4f46e5', width: 8, height: 8, borderRadius: 2 }}
			/>
			<input
				value={label}
				onChange={(e) => updateNodeData(id, { label: e.target.value })}
				onClick={(e) => e.stopPropagation()}
				style={{
					position: 'absolute', top: -12, left: 12,
					fontSize: 12, fontWeight: 600, padding: '2px 8px',
					background: '#fff', border: '1px solid #cbd5e1', borderRadius: 4,
					outline: 'none', maxWidth: '60%',
				}}
			/>
		</div>
	);
}
