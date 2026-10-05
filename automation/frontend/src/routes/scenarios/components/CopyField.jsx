/**
 * CopyField — read-only input + copy button + optional "open" button.
 * Bot-Bán-Hàng style row.
 * @since 2026-06-01
 */
import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { copyToClipboard } from '../lib/scenarioLinks.js';

export default function CopyField({ label, value, openHref = '', placeholder = '', mono = false }) {
	const [copied, setCopied] = useState(false);

	const onCopy = async () => {
		const ok = await copyToClipboard(value || '');
		if (!ok) return;
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="aw-mb-3">
			<div className="aw-text-xs aw-font-medium aw-text-slate-700 aw-mb-1">{label}</div>
			<div className="aw-flex aw-items-stretch aw-gap-1">
				<input
					readOnly
					value={value || ''}
					placeholder={placeholder || '— chưa có —'}
					className={
						'aw-flex-1 aw-px-2 aw-py-1.5 aw-text-xs aw-border aw-border-slate-300 aw-rounded aw-bg-slate-50 aw-text-slate-700 ' +
						(mono ? 'aw-font-mono' : '')
					}
					onFocus={(e) => e.target.select()}
				/>
				{openHref && (
					<a
						href={openHref}
						target="_blank"
						rel="noopener noreferrer"
						className="aw-px-2 aw-flex aw-items-center aw-justify-center aw-rounded aw-bg-orange-500 aw-text-white hover:aw-bg-orange-600"
						title="Mở trong tab mới"
					>
						<ExternalLink size={14} />
					</a>
				)}
				<button
					type="button"
					onClick={onCopy}
					disabled={!value}
					className="aw-px-2 aw-flex aw-items-center aw-justify-center aw-rounded aw-bg-emerald-500 aw-text-white hover:aw-bg-emerald-600 disabled:aw-opacity-40"
					title="Sao chép"
				>
					{copied ? <Check size={14} /> : <Copy size={14} />}
				</button>
			</div>
		</div>
	);
}
