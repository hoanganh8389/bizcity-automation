import { Routes, Route, Navigate } from 'react-router-dom';
import Shell from './shell/Shell.jsx';
import WorkflowListRoute from './routes/WorkflowListRoute.jsx';
import WorkflowBuilderRoute from './routes/WorkflowBuilderRoute.jsx';
import InboxRoute from './routes/InboxRoute.jsx';
import ScenarioListRoute from './routes/scenarios/ScenarioListRoute.jsx';
import ScenarioEditorRoute from './routes/scenarios/ScenarioEditorRoute.jsx';
import CalendarRoute from './routes/CalendarRoute.jsx';
import ConfigDataTableRoute from './routes/ConfigDataTableRoute.jsx';
import ContentOpsGuideRoute from './routes/ContentOpsGuideRoute.jsx';

export default function App() {
	return (
		<Shell>
			<Routes>
				<Route path="/" element={<WorkflowListRoute />} />
				<Route path="/builder" element={<WorkflowBuilderRoute />} />
				<Route path="/builder/:id" element={<WorkflowBuilderRoute />} />
				<Route path="/scenarios" element={<ScenarioListRoute />} />
				<Route path="/scenarios/new" element={<ScenarioEditorRoute />} />
				<Route path="/scenarios/:id" element={<ScenarioEditorRoute />} />
				<Route path="/inbox" element={<InboxRoute />} />
				<Route path="/config-data" element={<ConfigDataTableRoute />} />
				<Route path="/guide" element={<ContentOpsGuideRoute />} />
				<Route path="/calendar" element={<CalendarRoute />} />
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</Shell>
	);
}
