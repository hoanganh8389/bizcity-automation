/**
 * Lightweight right-click context menu for xyflow canvas.
 * Renders absolutely-positioned at the pointer location passed via `menu`.
 */
import { useEffect, useRef } from 'react';

export default function ContextMenu({ menu, onClose }) {
	const ref = useRef(null);

	useEffect(() => {
		if (!menu) return undefined;
		const onDown = (ev) => {
			if (ref.current && !ref.current.contains(ev.target)) onClose();
		};
		const onEsc = (ev) => { if (ev.key === 'Escape') onClose(); };
		window.addEventListener('mousedown', onDown);
		window.addEventListener('keydown', onEsc);
		return () => {
			window.removeEventListener('mousedown', onDown);
			window.removeEventListener('keydown', onEsc);
		};
	}, [menu, onClose]);

	if (!menu) return null;

	return (
		<div
			ref={ref}
			className="aw-context-menu"
			style={{ top: menu.top, left: menu.left, right: menu.right, bottom: menu.bottom }}
			onContextMenu={(e) => e.preventDefault()}
		>
			{menu.items.map((it, idx) => {
				if (it.divider) return <div key={`d-${idx}`} className="aw-context-divider" />;
				return (
					<button
						key={it.id || it.label}
						type="button"
						className={`aw-context-item ${it.danger ? 'is-danger' : ''}`}
						onClick={() => { it.onClick?.(); onClose(); }}
						disabled={!!it.disabled}
					>
						{it.icon ? <span className="aw-context-icon">{it.icon}</span> : null}
						<span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
						{it.shortcut ? <span className="aw-context-shortcut">{it.shortcut}</span> : null}
					</button>
				);
			})}
		</div>
	);
}
