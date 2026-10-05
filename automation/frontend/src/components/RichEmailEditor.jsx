/**
 * RichEmailEditor — trình soạn thảo email cơ bản dùng WordPress TinyMCE.
 *
 * - Khởi tạo `window.tinymce` (có sẵn trong WP admin, không cần npm thêm).
 * - Toolbar tối giản: bold / italic / underline / lists / link / removeformat.
 * - Nút "Chèn biến" mở VariablePicker → `editor.insertContent(token)`.
 * - Fallback sang <textarea> taller nếu tinymce chưa load (không phải WP admin).
 *
 * [2026-06-17 Johnny Chu] PHASE-CG-CF7 — rich email body editor cho ACT_SEND_EMAIL.
 */
import { useEffect, useRef, useState } from 'react';
import { Variable } from 'lucide-react';
import { useBuilderStore } from '../store/builderStore.js';
import VariablePicker from './VariablePicker.jsx';

export default function RichEmailEditor({ value, onChange, nodeId }) {
	// Unique stable ID per instance (safe across React strict-mode remount pairs).
	const editorIdRef = useRef(null);
	if (!editorIdRef.current) {
		editorIdRef.current = 'bce_email_' + Math.random().toString(36).slice(2, 8);
	}

	const editorRef    = useRef(null); // tinymce editor instance
	const isMounted    = useRef(true);
	const initDone     = useRef(false);
	const prevValue    = useRef(value);

	const btnRef                    = useRef(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const [pickerRect, setPickerRect] = useState(null);

	const nodes = useBuilderStore((s) => s.nodes);
	const edges = useBuilderStore((s) => s.edges);

	const hasTinyMCE = typeof window !== 'undefined' && !!window.tinymce;

	/* ── Mount / Unmount TinyMCE ───────────────────────────────────── */
	useEffect(() => {
		isMounted.current = true;

		if (!hasTinyMCE || initDone.current) return;
		initDone.current = true;

		const editorId = editorIdRef.current;

		window.tinymce.init({
			selector: '#' + editorId,
			menubar:     false,
			statusbar:   false,
			height:      220,
			plugins:     'lists link',
			toolbar:     'bold italic underline | bullist numlist | link | removeformat',
			content_style: 'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 13px; line-height: 1.55; }',
			setup: (editor) => {
				editorRef.current = editor;

				// Sync to store on every keystroke / format change
				editor.on('Change Undo Redo KeyUp', () => {
					if (!isMounted.current) return;
					onChange(editor.getContent());
				});

				// Set initial value once editor is ready
				editor.on('init', () => {
					if (!isMounted.current) return;
					editor.setContent(value ?? '');
					prevValue.current = value;
				});
			},
		});

		return () => {
			isMounted.current = false;
			try {
				if (window.tinymce) {
					window.tinymce.remove('#' + editorId);
				}
			} catch (_) {}
			editorRef.current = null;
			initDone.current  = false;
		};
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	/* ── Sync external value changes (e.g. template re-load) ────────── */
	useEffect(() => {
		if (!editorRef.current) return;
		if (prevValue.current === value) return;
		prevValue.current = value;
		try {
			const cur = editorRef.current.getContent();
			if (cur !== (value ?? '')) {
				editorRef.current.setContent(value ?? '');
			}
		} catch (_) {}
	}, [value]);

	/* ── Variable picker handlers ───────────────────────────────────── */
	const handleOpenPicker = () => {
		if (btnRef.current) setPickerRect(btnRef.current.getBoundingClientRect());
		setPickerOpen(true);
	};

	const handlePick = (token) => {
		setPickerOpen(false);
		if (editorRef.current) {
			// Focus editor first so cursor position is preserved
			editorRef.current.focus();
			editorRef.current.insertContent(token);
			onChange(editorRef.current.getContent());
		} else {
			onChange((value ?? '') + token);
		}
	};

	/* ── Fallback: no TinyMCE ───────────────────────────────────────── */
	if (!hasTinyMCE) {
		return (
			<div style={{ position: 'relative', marginTop: 4 }}>
				<textarea
					value={value ?? ''}
					onChange={(e) => onChange(e.target.value)}
					rows={8}
					style={taStyle}
					placeholder="Nội dung email (HTML hoặc plain text). Dùng nút biến để chèn {{trigger.email}}…"
				/>
				<button type="button" ref={btnRef} onClick={handleOpenPicker}
					title="Chèn biến từ node phía trước" style={varBtnAbsStyle}>
					<Variable size={12} />
				</button>
				<VariablePicker open={pickerOpen} onClose={() => setPickerOpen(false)}
					onPick={handlePick} currentNodeId={nodeId}
					nodes={nodes} edges={edges} anchorRect={pickerRect} />
			</div>
		);
	}

	/* ── TinyMCE path ────────────────────────────────────────────────── */
	return (
		<div style={{ marginTop: 4 }}>
			{/* Toolbar: variable picker button aligned right */}
			<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 3 }}>
				<button type="button" ref={btnRef} onClick={handleOpenPicker}
					title="Chèn biến {{...}} tại vị trí con trỏ trong editor"
					style={varBtnInlineStyle}>
					<Variable size={11} style={{ marginRight: 4 }} />
					Chèn biến
				</button>
			</div>

			{/* TinyMCE attaches to this textarea */}
			<textarea id={editorIdRef.current} defaultValue={value ?? ''} />

			<VariablePicker open={pickerOpen} onClose={() => setPickerOpen(false)}
				onPick={handlePick} currentNodeId={nodeId}
				nodes={nodes} edges={edges} anchorRect={pickerRect} />
		</div>
	);
}

/* ── Styles ─────────────────────────────────────────────────────────── */
const taStyle = {
	display: 'block', width: '100%',
	padding: '6px 30px 6px 8px', fontSize: 12, lineHeight: 1.4,
	border: '1px solid #cbd5e1', borderRadius: 6, outline: 'none',
	fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
};
const varBtnAbsStyle = {
	position: 'absolute', top: 6, right: 6,
	width: 22, height: 22,
	display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
	border: '1px solid #e9d5ff', background: '#faf5ff',
	borderRadius: 6, color: '#7c3aed', cursor: 'pointer', padding: 0,
};
const varBtnInlineStyle = {
	display: 'inline-flex', alignItems: 'center',
	fontSize: 11, padding: '3px 8px',
	border: '1px solid #e9d5ff', background: '#faf5ff',
	borderRadius: 6, color: '#7c3aed', cursor: 'pointer',
};
