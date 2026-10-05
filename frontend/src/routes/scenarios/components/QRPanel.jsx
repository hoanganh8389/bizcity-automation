/**
 * QRPanel — QR cho deep-link kịch bản + nút Sao chép / Tải xuống +
 * 3 nút "Tạo ảnh quảng cáo bằng AI" (chuẩn bị slot, chờ endpoint generate_image).
 *
 * @since 2026-06-01
 */
import { useState } from 'react';
import { Copy, Download, Sparkles, ImageIcon, AlertCircle } from 'lucide-react';
import { qrImageUrl, copyToClipboard, buildScenarioLink } from '../lib/scenarioLinks.js';

const AI_PRESETS = [
	{ key: 'cover',  label: 'Ảnh bìa quảng cáo',   ratio: '1.91:1' },
	{ key: 'square', label: 'Ảnh vuông Feed',       ratio: '1:1'    },
	{ key: 'story',  label: 'Story / Reels',        ratio: '9:16'   },
];

export default function QRPanel({ linear, onGenerateAdImage, adImage = null, adError = '' }) {
	const link = buildScenarioLink(linear);
	const qr   = link ? qrImageUrl(link, 480) : '';
	const [busy, setBusy] = useState('');
	const [toast, setToast] = useState('');

	const onCopyImage = async () => {
		// Không copy được binary trên WP nonce → fallback copy URL ảnh.
		const ok = await copyToClipboard(qr || '');
		setToast(ok ? 'Đã sao chép link ảnh QR' : 'Không sao chép được');
		setTimeout(() => setToast(''), 2000);
	};

	const onDownload = () => {
		if (!qr) return;
		const a = document.createElement('a');
		a.href = qr;
		a.download = `qr-scenario-${linear?.trigger?.scenario_uuid || 'new'}.png`;
		a.target = '_blank';
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
	};

	const onAi = async (preset) => {
		if (!onGenerateAdImage) return;
		setBusy(preset.key);
		try {
			await onGenerateAdImage(preset);
		} finally {
			setBusy('');
		}
	};

	return (
		<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-p-3 aw-flex aw-flex-col aw-gap-3">
			<div className="aw-text-xs aw-font-semibold aw-text-slate-700">Mã QR</div>

			<div className="aw-relative aw-w-full aw-aspect-square aw-bg-slate-50 aw-border aw-border-slate-200 aw-rounded aw-flex aw-items-center aw-justify-center aw-overflow-hidden">
				{qr
					? <img src={qr} alt="QR kịch bản" className="aw-w-full aw-h-full aw-object-contain" />
					: (
						<div className="aw-text-center aw-text-xs aw-text-slate-400 aw-px-4 aw-flex aw-flex-col aw-items-center aw-gap-1">
							<AlertCircle size={20} />
							<span>Cần chọn kênh + Instance ID + Lưu kịch bản để sinh QR.</span>
						</div>
					)}
			</div>

			<div className="aw-grid aw-grid-cols-2 aw-gap-2">
				<button
					type="button"
					onClick={onCopyImage}
					disabled={!qr}
					className="aw-px-3 aw-py-1.5 aw-rounded aw-bg-emerald-500 aw-text-white aw-text-xs aw-font-medium hover:aw-bg-emerald-600 disabled:aw-opacity-40 aw-flex aw-items-center aw-justify-center aw-gap-1"
				>
					<Copy size={13} /> Sao chép
				</button>
				<button
					type="button"
					onClick={onDownload}
					disabled={!qr}
					className="aw-px-3 aw-py-1.5 aw-rounded aw-bg-blue-500 aw-text-white aw-text-xs aw-font-medium hover:aw-bg-blue-600 disabled:aw-opacity-40 aw-flex aw-items-center aw-justify-center aw-gap-1"
				>
					<Download size={13} /> Tải xuống
				</button>
			</div>

			{/* AI ad image generator buttons */}
			<div className="aw-pt-2 aw-mt-1 aw-border-t aw-border-slate-100">
				<div className="aw-text-[11px] aw-text-slate-500 aw-mb-1.5 aw-flex aw-items-center aw-gap-1">
					<Sparkles size={11} className="aw-text-purple-500" />
					Tạo ảnh quảng cáo bằng AI
				</div>
				<div className="aw-flex aw-flex-col aw-gap-1">
					{AI_PRESETS.map((p) => (
						<button
							key={p.key}
							type="button"
							onClick={() => onAi(p)}
							disabled={!qr || !!busy}
							className="aw-px-2 aw-py-1.5 aw-rounded aw-border aw-border-purple-200 aw-bg-purple-50 aw-text-purple-800 aw-text-xs hover:aw-bg-purple-100 disabled:aw-opacity-50 aw-flex aw-items-center aw-justify-between"
							title={`AI sẽ ghép QR + tên kịch bản → ảnh ${p.ratio}`}
						>
							<span className="aw-flex aw-items-center aw-gap-1">
								<ImageIcon size={12} /> {p.label}
							</span>
							<span className="aw-text-[10px] aw-text-purple-500 aw-font-mono">{p.ratio}</span>
						</button>
					))}
				</div>
				<div className="aw-text-[10px] aw-text-slate-400 aw-mt-1">
					Tích hợp BizCity LLM Gateway · model image preview
				</div>
			</div>

			{adError && (
				<div className="aw-text-[11px] aw-text-rose-700 aw-bg-rose-50 aw-border aw-border-rose-200 aw-rounded aw-px-2 aw-py-1 aw-flex aw-items-start aw-gap-1">
					<AlertCircle size={12} className="aw-mt-0.5 aw-shrink-0" />
					<span>{adError}</span>
				</div>
			)}

			{adImage?.image_url && (
				<div className="aw-mt-1 aw-flex aw-flex-col aw-gap-1">
					<div className="aw-text-[11px] aw-font-semibold aw-text-purple-700 aw-flex aw-items-center aw-justify-between">
						<span>Kết quả AI · {adImage.ratio}</span>
						<a
							href={adImage.image_url}
							target="_blank"
							rel="noopener noreferrer"
							className="aw-text-[10px] aw-text-blue-600 hover:aw-underline"
						>Mở tải→</a>
					</div>
					<img
						src={adImage.image_url}
						alt="AI ad creative"
						className="aw-w-full aw-rounded aw-border aw-border-purple-200"
					/>
					{adImage.model && (
						<div className="aw-text-[10px] aw-text-slate-400 aw-font-mono">{adImage.model}</div>
					)}
				</div>
			)}

			{toast && (
				<div className="aw-text-[11px] aw-text-emerald-700 aw-bg-emerald-50 aw-border aw-border-emerald-200 aw-rounded aw-px-2 aw-py-1">
					✓ {toast}
				</div>
			)}
		</div>
	);
}
