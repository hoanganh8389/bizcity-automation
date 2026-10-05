import { useMemo, useState } from 'react';
import { Search, ChevronLeft } from 'lucide-react';
import { BLOCKS, CATEGORIES } from '../blocks/registry.js';
import { useBuilderStore } from '../store/builderStore.js';

/**
 * Left Palette — draggable block source. Drag image is the block id;
 * canvas onDrop reads `application/automation-block`.
 */
export default function Palette() {
	const open = useBuilderStore((s) => s.isPaletteOpen);
	const togglePalette = useBuilderStore((s) => s.togglePalette);
	const [q, setQ] = useState('');

	const groups = useMemo(() => {
		const filter = q.trim().toLowerCase();
		return CATEGORIES.map((cat) => ({
			...cat,
			items: BLOCKS.filter((b) => b.category === cat.id && (!filter ||
				b.label.toLowerCase().includes(filter) || b.short.toLowerCase().includes(filter))),
		})).filter((g) => g.items.length > 0);
	}, [q]);

	if (!open) {
		return (
			<button type="button" onClick={togglePalette}
				className="aw-btn aw-btn-outline"
				style={{ position: 'absolute', top: 12, left: 12, zIndex: 5 }}>
				Mở palette
			</button>
		);
	}

	const onDragStart = (e, blockId) => {
		e.dataTransfer.setData('application/automation-block', blockId);
		e.dataTransfer.effectAllowed = 'move';
	};

	return (
		<aside style={{
			width: 260, flexShrink: 0, background: '#fff',
			borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column',
		}}>
			<div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
				<strong style={{ flex: 1, fontSize: 13 }}>Khối logic</strong>
				<button type="button" onClick={togglePalette} className="aw-icon-btn" title="Thu gọn">
					<ChevronLeft size={14} />
				</button>
			</div>

			<div style={{ padding: 10, borderBottom: '1px solid #f1f5f9' }}>
				<div style={{ position: 'relative' }}>
					<Search size={14} style={{ position: 'absolute', left: 8, top: 8, color: '#94a3b8' }} />
					<input value={q} onChange={(e) => setQ(e.target.value)}
						placeholder="Tìm khối…"
						style={{
							width: '100%', padding: '6px 8px 6px 28px', fontSize: 12,
							border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
						}}
					/>
				</div>
			</div>

			<div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
				{groups.map((g) => (
					<div key={g.id} style={{ marginBottom: 12 }}>
						<div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, padding: '4px 6px' }}>
							{g.label}
						</div>
						{g.items.map((b) => {
							const Icon = b.Icon;
							return (
								<div key={b.id}
									draggable
									onDragStart={(e) => onDragStart(e, b.id)}
									title={`${b.label}\n${b.short || ''}\nKéo vào canvas để thêm`}
									className="aw-palette-item"
								>
									<span className="aw-palette-item-icon" style={{ background: b.color }}>
										{Icon ? <Icon size={12} /> : null}
									</span>
									<span style={{ flex: 1, color: '#0f172a' }}>{b.label}</span>
									<span className="aw-palette-item-grip" aria-hidden="true">⋮⋮</span>
								</div>
							);
						})}
					</div>
				))}
			</div>

			<div style={{ padding: '8px 12px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#94a3b8' }}>
				Kéo thả khối vào canvas →
			</div>
		</aside>
	);
}
