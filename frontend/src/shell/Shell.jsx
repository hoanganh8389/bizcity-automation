import { useLocation, Link } from 'react-router-dom';
import { BOOT } from '../lib/boot.js';

const NAV_LINKS = [
	{ to: '/',         label: 'Kịch bản' },
	{ to: '/scenarios', label: 'Tình huống' },
	{ to: '/config-data', label: 'Dữ liệu' },
	{ to: '/guide', label: 'Hướng dẫn' },
	{ to: '/calendar',  label: '📅 Lịch' },
	{ to: '/inbox',     label: 'Hộp thư' },
];

export default function Shell({ children }) {
	const { pathname } = useLocation();
	// Toolbar trên builder đã có brand bar riêng → ẩn Shell topbar.
	const isBuilder = pathname.startsWith('/builder');
	return (
		<div className="aw-shell">
			{!isBuilder && (
				<header className="aw-topbar">
					<div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
						<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
							<span style={{ fontWeight: 600, fontSize: 14 }}>BizCity Automation</span>
							<span style={{ fontSize: 11, color: '#94a3b8' }}>v{BOOT.version}</span>
						</div>
						<nav style={{ display: 'flex', gap: 4 }}>
							{NAV_LINKS.map(({ to, label }) => {
								const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
								return (
									<Link
										key={to}
										to={to}
										style={{
											fontSize: 12, padding: '4px 10px', borderRadius: 5,
											textDecoration: 'none', fontWeight: active ? 600 : 400,
											color: active ? '#6366f1' : '#475569',
											background: active ? '#eef2ff' : 'transparent',
										}}
									>
										{label}
									</Link>
								);
							})}
						</nav>
					</div>
					<div style={{ fontSize: 12, color: '#64748b' }}>
						{BOOT.caps?.manage ? '✓ Quyền quản trị' : '👁 Chỉ xem'}
					</div>
				</header>
			)}
			<main className="aw-canvas-host">{children}</main>
		</div>
	);
}
