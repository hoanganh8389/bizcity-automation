import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';

const SPLIT_RE = /[\|,;；，｜•\r\n]+/u;

function parseTags(raw) {
	const parts = String(raw || '')
		.split(SPLIT_RE)
		.map((s) => s.trim())
		.filter(Boolean);
	const seen = new Set();
	const out = [];
	for (const part of parts) {
		const key = part.toLocaleLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(part);
	}
	return out;
}

function serializeTags(tags) {
	return tags.join(' | ');
}

export default function FilterPillsInput({
	value = '',
	onChange,
	placeholder = 'Nhập từ khoá rồi Enter',
	suggestions = [],
}) {
	const [draft, setDraft] = useState('');
	const tags = useMemo(() => parseTags(value), [value]);

	const selectedSet = useMemo(
		() => new Set(tags.map((t) => t.toLocaleLowerCase())),
		[tags]
	);

	const normalizedSuggestions = useMemo(() => {
		const clean = [];
		const seen = new Set();
		for (const item of suggestions || []) {
			const label = String(item || '').trim();
			if (!label) continue;
			const key = label.toLocaleLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			clean.push(label);
		}
		return clean;
	}, [suggestions]);

	const addRaw = (raw) => {
		const incoming = parseTags(raw);
		if (!incoming.length) return;
		const next = [...tags];
		const seen = new Set(next.map((t) => t.toLocaleLowerCase()));
		for (const token of incoming) {
			const key = token.toLocaleLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			next.push(token);
		}
		onChange(serializeTags(next));
		setDraft('');
	};

	const removeAt = (idx) => {
		const next = tags.slice();
		next.splice(idx, 1);
		onChange(serializeTags(next));
	};

	return (
		<div>
			<div style={{
				display: 'flex',
				flexWrap: 'wrap',
				alignItems: 'center',
				gap: 6,
				marginTop: 4,
				padding: '6px 8px',
				fontSize: 12,
				lineHeight: 1.4,
				border: '1px solid #cbd5e1',
				borderRadius: 6,
				background: '#fff',
				boxSizing: 'border-box',
			}}>
				{tags.map((tag, idx) => (
					<span key={`${tag}_${idx}`} style={{
						display: 'inline-flex',
						alignItems: 'center',
						gap: 4,
						padding: '2px 8px',
						borderRadius: 999,
						border: '1px solid #bae6fd',
						background: '#f0f9ff',
						color: '#0369a1',
					}}>
						{tag}
						<button
							type="button"
							onClick={() => removeAt(idx)}
							aria-label={`Xoá ${tag}`}
							style={{
								border: 'none',
								background: 'transparent',
								padding: 0,
								cursor: 'pointer',
								color: '#0369a1',
								display: 'inline-flex',
								alignItems: 'center',
							}}
						>
							<X size={12} />
						</button>
					</span>
				))}
				<input
					type="text"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === '|') {
							e.preventDefault();
							addRaw(draft);
							return;
						}
						if (e.key === 'Backspace' && !draft && tags.length) {
							e.preventDefault();
							removeAt(tags.length - 1);
						}
					}}
					onBlur={() => {
						if (draft.trim()) addRaw(draft);
					}}
					onPaste={(e) => {
						const text = e.clipboardData?.getData('text') || '';
						if (!SPLIT_RE.test(text)) return;
						e.preventDefault();
						addRaw(text);
					}}
					placeholder={tags.length ? '' : placeholder}
					style={{
						flex: 1,
						minWidth: 120,
						border: 'none',
						outline: 'none',
						padding: 0,
						fontSize: 12,
					}}
				/>
				{draft.trim() && (
					<button
						type="button"
						onClick={() => addRaw(draft)}
						title="Thêm keyword"
						style={{
							border: 'none',
							background: 'transparent',
							padding: 0,
							cursor: 'pointer',
							color: '#0f766e',
							display: 'inline-flex',
							alignItems: 'center',
						}}
					>
						<Plus size={14} />
					</button>
				)}
			</div>

			{normalizedSuggestions.length > 0 && (
				<div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
					{normalizedSuggestions.map((suggestion) => {
						const selected = selectedSet.has(suggestion.toLocaleLowerCase());
						return (
							<button
								key={suggestion}
								type="button"
								onClick={() => addRaw(suggestion)}
								disabled={selected}
								style={{
									fontSize: 11,
									padding: '2px 8px',
									borderRadius: 999,
									cursor: selected ? 'default' : 'pointer',
									border: `1px solid ${selected ? '#bae6fd' : '#cbd5e1'}`,
									background: selected ? '#e0f2fe' : '#f8fafc',
									color: selected ? '#0369a1' : '#475569',
									opacity: selected ? 0.95 : 1,
								}}
							>
								{selected ? '✓ ' : '+ '}{suggestion}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
