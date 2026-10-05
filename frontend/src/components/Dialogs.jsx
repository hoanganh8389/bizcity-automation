import Modal from './Modal.jsx';
import { useBuilderStore } from '../store/builderStore.js';

export function SettingsDialog() {
	const open  = useBuilderStore((s) => s.isSettingsOpen);
	const close = useBuilderStore((s) => s.closeSettings);
	const meta  = useBuilderStore((s) => s.meta);
	const updateMeta = useBuilderStore((s) => s.updateMeta);

	return (
		<Modal
			open={open}
			onClose={close}
			title="Cấu hình workflow"
			width={560}
			footer={
				<>
					<button type="button" onClick={close} className="aw-btn aw-btn-outline">Đóng</button>
					<button type="button" onClick={close} className="aw-btn aw-btn-primary">Lưu cấu hình</button>
				</>
			}
		>
			<Row label="ID nội bộ">
				<input value={meta.id} onChange={(e) => updateMeta({ id: e.target.value })} style={inputStyle()} />
			</Row>
			<Row label="Tên workflow">
				<input value={meta.name} onChange={(e) => updateMeta({ name: e.target.value })} style={inputStyle()} />
			</Row>
			<Row label="Mô tả">
				<textarea value={meta.desc} onChange={(e) => updateMeta({ desc: e.target.value })} rows={3} style={inputStyle()} />
			</Row>
			<Row label="Bật / tắt">
				<label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
					<input type="checkbox" checked={!!meta.enabled} onChange={(e) => updateMeta({ enabled: e.target.checked })} />
					<span style={{ fontSize: 13 }}>Workflow đang hoạt động</span>
				</label>
			</Row>
			<Row label="Tags (phẩy ngăn cách)">
				<input
					value={(meta.tags || []).join(', ')}
					onChange={(e) => updateMeta({ tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
					style={inputStyle()}
				/>
			</Row>
		</Modal>
	);
}

export function ConfirmDialog() {
	const open    = useBuilderStore((s) => s.isConfirmOpen);
	const close   = useBuilderStore((s) => s.closeConfirm);
	const payload = useBuilderStore((s) => s.confirmPayload);
	if (!payload) return null;
	return (
		<Modal
			open={open}
			onClose={close}
			title={payload.title}
			width={420}
			footer={
				<>
					<button type="button" onClick={close} className="aw-btn aw-btn-outline">Huỷ</button>
					<button
						type="button"
						onClick={() => { payload.onConfirm?.(); close(); }}
						className="aw-btn aw-btn-primary"
						style={{ background: '#dc2626', borderColor: '#dc2626' }}
					>
						{payload.confirmLabel || 'Xác nhận'}
					</button>
				</>
			}
		>
			<p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{payload.message}</p>
		</Modal>
	);
}

function Row({ label, children }) {
	return (
		<div style={{ marginBottom: 12 }}>
			<label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</label>
			{children}
		</div>
	);
}
function inputStyle() {
	return {
		display: 'block', width: '100%', padding: '6px 8px', fontSize: 13,
		border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
		fontFamily: 'inherit', boxSizing: 'border-box',
	};
}
