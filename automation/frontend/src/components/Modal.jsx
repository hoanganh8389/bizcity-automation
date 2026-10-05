import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Tiny Modal — overlay + centered card. ESC closes. No portal dep.
 */
export default function Modal({ open, onClose, title, children, footer, width = 520 }) {
	useEffect(() => {
		if (!open) return undefined;
		const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			onClick={onClose}
			style={{
				position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)',
				display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999,
			}}
		>
			<div
				onClick={(e) => e.stopPropagation()}
				style={{
					width, maxWidth: '92vw', maxHeight: '90vh', overflow: 'auto',
					background: '#fff', borderRadius: 10,
					boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)',
				}}
			>
				<div style={{
					display: 'flex', alignItems: 'center', justifyContent: 'space-between',
					padding: '12px 16px', borderBottom: '1px solid #e2e8f0',
				}}>
					<h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h3>
					<button type="button" onClick={onClose} className="aw-icon-btn" aria-label="Đóng">
						<X size={16} />
					</button>
				</div>
				<div style={{ padding: 16 }}>{children}</div>
				{footer && (
					<div style={{
						padding: '10px 16px', borderTop: '1px solid #e2e8f0',
						display: 'flex', justifyContent: 'flex-end', gap: 8, background: '#f8fafc',
					}}>
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
