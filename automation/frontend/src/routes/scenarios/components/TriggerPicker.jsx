/**
 * TriggerPicker — channel + instance + keywords editor (Bot-Bán-Hàng style).
 * @since 2026-06-01
 */
import { TRIGGER_TYPES, triggerDefByKey } from '../lib/scenarioSchema.js';
import ChannelInstancePicker from '../../../components/ChannelInstancePicker.jsx';
import KeywordChips from './KeywordChips.jsx';
import { Zap } from 'lucide-react';

export default function TriggerPicker({ value, onChange }) {
	const def = triggerDefByKey(value?.key) || TRIGGER_TYPES[0];

	const update = (patch) => onChange({ ...value, ...patch });

	return (
		<div className="aw-bg-white aw-border aw-border-amber-200 aw-rounded-lg aw-p-4 aw-shadow-sm">
			<div className="aw-flex aw-items-center aw-gap-2 aw-mb-3">
				<div className="aw-w-8 aw-h-8 aw-rounded aw-bg-amber-50 aw-flex aw-items-center aw-justify-center aw-text-amber-600">
					<Zap size={16} />
				</div>
				<div>
					<div className="aw-text-sm aw-font-semibold aw-text-slate-900">Khi nào kịch bản chạy?</div>
					<div className="aw-text-xs aw-text-slate-500">Chọn kênh nhận tin nhắn + từ khoá kích hoạt.</div>
				</div>
			</div>

			<div className="aw-grid aw-grid-cols-1 md:aw-grid-cols-2 aw-gap-3">
				<label className="aw-text-xs aw-text-slate-700">
					Kênh
					<select
						value={value?.key || 'fb_message'}
						onChange={(e) => update({ key: e.target.value })}
						className="aw-mt-1 aw-block aw-w-full aw-px-2 aw-py-1.5 aw-text-xs aw-border aw-border-slate-300 aw-rounded"
					>
						{TRIGGER_TYPES.map((t) => (
							<option key={t.key} value={t.key}>{t.label}</option>
						))}
					</select>
				</label>

				<div className="aw-text-xs aw-text-slate-700">
					Instance ID (page/bot)
					<ChannelInstancePicker
						platform={def.platform}
						value={value?.instance_id || ''}
						onChange={(v) => update({ instance_id: v })}
					/>
				</div>
			</div>

			<div className="aw-mt-3">
				<div className="aw-text-xs aw-text-slate-700 aw-mb-1">
					Từ khoá kích hoạt <span className="aw-text-slate-400">(Enter / dấu phẩy để thêm)</span>
				</div>
				<KeywordChips
					value={value?.keywords || []}
					onChange={(kws) => update({ keywords: kws })}
				/>
				{(value?.keywords || []).length > 1 && (
					<div className="aw-mt-1 aw-text-[11px] aw-text-amber-700 aw-bg-amber-50 aw-border aw-border-amber-200 aw-rounded aw-px-2 aw-py-1">
						⚠ BE matcher hiện chỉ kiểm <code>filter</code> (1 từ khoá). Tạm thời chỉ từ đầu tiên có hiệu lực; các từ còn lại lưu sẵn để BE OR-match khi rule sẵn sàng.
					</div>
				)}
				{(value?.keywords || []).length === 0 && (
					<div className="aw-mt-1 aw-text-[11px] aw-text-slate-500">
						Để trống = match mọi tin nhắn (kịch bản fallback).
					</div>
				)}
			</div>
		</div>
	);
}
