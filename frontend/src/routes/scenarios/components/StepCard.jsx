/**
 * StepCard — single linear step row (collapsible).
 * @since 2026-06-01
 */
import { useState } from 'react';
import {
	MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch,
	ChevronDown, ChevronRight, Trash2, GripVertical, ArrowUp, ArrowDown,
} from 'lucide-react';
import { stepDefByKey } from '../lib/scenarioSchema.js';
import StepInspector from './StepInspector.jsx';

const ICON_MAP = {
	MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch,
};

function summarize(step) {
	const cfg = step.config || {};
	switch (step.type) {
		case 'send_text':       return cfg.text ? `"${String(cfg.text).slice(0, 60)}${cfg.text.length > 60 ? '…' : ''}"` : '(chưa nhập tin nhắn)';
		case 'ai_reply':        return cfg.prompt ? `prompt: ${String(cfg.prompt).slice(0, 50)}…` : '(chưa nhập prompt)';
		case 'http_request':    return `${cfg.method || 'GET'} ${cfg.url || '(chưa nhập URL)'}`;
		case 'save_data':       return cfg.key ? `${cfg.key} = ${cfg.value || ''}` : '(chưa nhập key)';
		case 'schedule_delay':  return `Chờ ${cfg.delay_value || '?'} ${cfg.delay_unit || 'minute'} → workflow #${cfg.target_workflow_id || '?'}`;
		case 'condition':       return cfg.expr ? `IF: ${cfg.expr}` : '(chưa nhập điều kiện)';
		default:                return '';
	}
}

export default function StepCard({ index, total, step, onChange, onRemove, onMoveUp, onMoveDown }) {
	const [open, setOpen] = useState(false);
	const def = stepDefByKey(step.type);
	if (!def) return null;
	const Icon = ICON_MAP[def.icon] || MessageCircle;

	return (
		<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-shadow-sm">
			<div className="aw-flex aw-items-center aw-gap-2 aw-px-3 aw-py-2 aw-border-b aw-border-slate-100">
				<button
					type="button"
					onClick={() => setOpen(!open)}
					className="aw-text-slate-500 hover:aw-text-slate-900"
					aria-label={open ? 'Thu gọn' : 'Mở rộng'}
				>
					{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				</button>
				<div
					className="aw-w-8 aw-h-8 aw-rounded aw-flex aw-items-center aw-justify-center aw-text-white"
					style={{ background: def.color }}
				>
					<Icon size={14} />
				</div>
				<div className="aw-flex-1 aw-min-w-0">
					<div className="aw-flex aw-items-center aw-gap-2">
						<span className="aw-text-xs aw-text-slate-400">Bước {index + 1}</span>
						<span className="aw-text-sm aw-font-semibold aw-text-slate-900 aw-truncate">{def.label}</span>
					</div>
					<div className="aw-text-xs aw-text-slate-500 aw-truncate">{summarize(step)}</div>
				</div>
				<div className="aw-flex aw-items-center aw-gap-1">
					<button
						type="button"
						onClick={onMoveUp}
						disabled={index === 0}
						className="aw-p-1 aw-text-slate-500 hover:aw-text-slate-900 disabled:aw-opacity-30"
						title="Lên"
					>
						<ArrowUp size={14} />
					</button>
					<button
						type="button"
						onClick={onMoveDown}
						disabled={index === total - 1}
						className="aw-p-1 aw-text-slate-500 hover:aw-text-slate-900 disabled:aw-opacity-30"
						title="Xuống"
					>
						<ArrowDown size={14} />
					</button>
					<button
						type="button"
						onClick={onRemove}
						className="aw-p-1 aw-text-red-500 hover:aw-text-red-700"
						title="Xoá bước"
					>
						<Trash2 size={14} />
					</button>
				</div>
			</div>

			{open && (
				<div className="aw-p-3">
					<StepInspector step={step} onChange={onChange} />
				</div>
			)}
		</div>
	);
}
