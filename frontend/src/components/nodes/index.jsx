import NodeShell from './NodeShell.jsx';
import GroupNode from './GroupNode.jsx';

export function TriggerNode(props) {
	return <NodeShell {...props} hasInput={false} hasOutput />;
}
export function ActionNode(props) {
	return <NodeShell {...props} hasInput hasOutput />;
}
export function LLMNode(props) {
	return <NodeShell {...props} hasInput hasOutput />;
}
export function OutputNode(props) {
	return <NodeShell {...props} hasInput hasOutput={false} />;
}
export function ConditionNode(props) {
	return (
		<NodeShell
			{...props}
			hasInput
			hasOutput={false}
			branches={[
				{ id: 'true',  label: 'true',  color: '#16a34a' },
				{ id: 'false', label: 'false', color: '#dc2626' },
			]}
		/>
	);
}

export const NODE_TYPES = {
	trigger:   TriggerNode,
	action:    ActionNode,
	llm:       LLMNode,
	output:    OutputNode,
	condition: ConditionNode,
	group:     GroupNode,
};
