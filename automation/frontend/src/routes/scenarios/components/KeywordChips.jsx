/**
 * KeywordChips — Bot-Bán-Hàng style multi-keyword input.
 * @since 2026-06-01
 */
import { useState } from 'react';
import { X, Plus } from 'lucide-react';

export default function KeywordChips({ value = [], onChange, placeholder = 'gõ từ khoá rồi Enter' }) {
	const [draft, setDraft] = useState('');

	const add = (raw) => {
		const tokens = String(raw || '')
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter((s) => s && !value.includes(s));
		if (!tokens.length) return;
		onChange([...value, ...tokens]);
		setDraft('');
	};

	const remove = (idx) => {
		const next = value.slice();
		next.splice(idx, 1);
		onChange(next);
	};

	return (
		<div className="aw-flex aw-flex-wrap aw-items-center aw-gap-1.5 aw-px-2 aw-py-1.5 aw-border aw-border-slate-300 aw-rounded aw-bg-white aw-min-h-[38px]">
			{value.map((kw, i) => (
				<span
					key={`${kw}_${i}`}
					className="aw-inline-flex aw-items-center aw-gap-1 aw-px-2 aw-py-0.5 aw-rounded aw-text-xs aw-bg-emerald-50 aw-text-emerald-800 aw-border aw-border-emerald-200"
				>
					{kw}
					<button
						type="button"
						onClick={() => remove(i)}
						className="aw-text-emerald-700 hover:aw-text-emerald-900"
						aria-label={`Xoá ${kw}`}
					>
						<X size={12} />
					</button>
				</span>
			))}
			<input
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ',') {
						e.preventDefault();
						add(draft);
					} else if (e.key === 'Backspace' && !draft && value.length) {
						remove(value.length - 1);
					}
				}}
				onBlur={() => draft && add(draft)}
				placeholder={value.length ? '' : placeholder}
				className="aw-flex-1 aw-min-w-[120px] aw-text-xs aw-outline-none aw-bg-transparent"
			/>
			{draft && (
				<button
					type="button"
					onClick={() => add(draft)}
					className="aw-text-emerald-700 hover:aw-text-emerald-900"
				>
					<Plus size={14} />
				</button>
			)}
		</div>
	);
}
