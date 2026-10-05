import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';

const mountEl = document.getElementById('bizcity-automation-root');
if (mountEl) {
	createRoot(mountEl).render(
		<HashRouter>
			<App />
		</HashRouter>
	);
} else {
	// eslint-disable-next-line no-console
	console.warn('[bizcity-automation] mount #bizcity-automation-root not found');
}
