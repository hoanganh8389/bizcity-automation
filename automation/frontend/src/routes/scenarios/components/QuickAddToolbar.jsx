/**
 * QuickAddToolbar — icon-only row to add a step quickly (Bot-Bán-Hàng style).
 *
 * Mapping ngắn — 6 step types chính, dùng cùng STEP_TYPES từ schema.
 * @since 2026-06-01
 */
import {
	MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch, MoreHorizontal,
} from 'lucide-react';
import { STEP_TYPES } from '../lib/scenarioSchema.js';

const ICON_MAP = { MessageCircle, Sparkles, Globe, Database, CalendarClock, GitBranch };

export default function QuickAddToolbar({ onPick, onMore }) {
	return (
		<div className="aw-bg-white aw-border aw-border-slate-200 aw-rounded-lg aw-px-3 aw-py-2 aw-flex aw-items-center aw-gap-1.5 aw-overflow-x-auto">
			{STEP_TYPES.map((def) => {
				const Icon = ICON_MAP[def.icon] || MessageCircle;
				return (
					<button
						key={def.key}
						type="button"
						onClick={() => onPick(def.key)}
						className="aw-flex-shrink-0 aw-w-9 aw-h-9 aw-rounded-full aw-flex aw-items-center aw-justify-center aw-text-white hover:aw-opacity-90 aw-transition aw-shadow-sm"
						style={{ background: def.color }}
						title={def.label}
						aria-label={def.label}
					>
						<Icon size={15} />
					</button>
				);
			})}
			{onMore && (
				<button
					type="button"
					onClick={onMore}
					className="aw-flex-shrink-0 aw-w-9 aw-h-9 aw-rounded-full aw-flex aw-items-center aw-justify-center aw-text-slate-600 aw-bg-slate-100 hover:aw-bg-slate-200"
					title="Thêm các bước khác…"
					aria-label="Thêm các bước khác"
				>
					<MoreHorizontal size={15} />
				</button>
			)}
		</div>
	);
}
