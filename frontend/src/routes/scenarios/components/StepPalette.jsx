/**
 * StepPalette — "Add step" picker — shows STEP_TYPES as buttons.
 * @since 2026-06-01
 */
import {
	MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch, Plus,
} from 'lucide-react';
import { STEP_TYPES, stepDefByKey } from '../lib/scenarioSchema.js';

const ICON_MAP = { MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch };

export default function StepPalette({ onPick }) {
	return (
		<div className="aw-bg-white aw-border aw-border-dashed aw-border-slate-300 aw-rounded-lg aw-p-3">
			<div className="aw-text-xs aw-text-slate-500 aw-mb-2 aw-flex aw-items-center aw-gap-1">
				<Plus size={12} /> Thêm bước
			</div>
			<div className="aw-grid aw-grid-cols-2 md:aw-grid-cols-3 aw-gap-2">
				{STEP_TYPES.map((def) => {
					const Icon = ICON_MAP[def.icon] || MessageCircle;
					return (
						<button
							key={def.key}
							type="button"
							onClick={() => onPick(def.key)}
							className="aw-flex aw-items-center aw-gap-2 aw-px-2 aw-py-2 aw-border aw-border-slate-200 aw-rounded hover:aw-bg-slate-50 aw-text-left"
						>
							<span
								className="aw-w-7 aw-h-7 aw-rounded aw-flex aw-items-center aw-justify-center aw-text-white aw-flex-shrink-0"
								style={{ background: def.color }}
							>
								<Icon size={13} />
							</span>
							<span className="aw-text-xs aw-text-slate-800">{def.label}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
