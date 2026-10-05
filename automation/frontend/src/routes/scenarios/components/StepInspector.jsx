/**
 * StepInspector — render config form per step type (Bot-Bán-Hàng style).
 * @since 2026-06-01
 */
import { stepDefByKey } from '../lib/scenarioSchema.js';

const labelCls = 'aw-block aw-text-xs aw-text-slate-700 aw-mb-2';
const inputCls = 'aw-mt-1 aw-block aw-w-full aw-px-2 aw-py-1.5 aw-text-xs aw-border aw-border-slate-300 aw-rounded';
const textareaCls = `${inputCls} aw-font-mono`;

export default function StepInspector({ step, onChange }) {
	if (!step) return null;
	const def = stepDefByKey(step.type);
	if (!def) return null;

	const cfg = step.config || {};
	const setCfg = (patch) => onChange({ ...step, config: { ...cfg, ...patch } });

	return (
		<div className="aw-flex aw-flex-col aw-gap-3 aw-p-3 aw-bg-slate-50 aw-rounded">
			<div className="aw-text-xs aw-text-slate-500">
				Block: <code>{def.blockId}</code>
			</div>

			{step.type === 'send_text' && (
				<>
					<label className={labelCls}>
						Nội dung tin nhắn (hỗ trợ <code>{'{{var}}'}</code>)
						<textarea
							rows={4}
							value={cfg.text || ''}
							onChange={(e) => setCfg({ text: e.target.value })}
							className={textareaCls}
							placeholder="Chào {{name}}, em là Hương Nguyễn shop xin chào ạ…"
						/>
					</label>
					<label className={labelCls}>
						Trễ trước khi gửi (giây)
						<input
							type="number" min="0"
							value={cfg.compose_delay_seconds || 0}
							onChange={(e) => setCfg({ compose_delay_seconds: Number(e.target.value) || 0 })}
							className={inputCls}
						/>
					</label>
				</>
			)}

			{step.type === 'ai_reply' && (
				<>
					<label className={labelCls}>
						System prompt
						<textarea
							rows={2}
							value={cfg.system || ''}
							onChange={(e) => setCfg({ system: e.target.value })}
							className={textareaCls}
						/>
					</label>
					<label className={labelCls}>
						User prompt (placeholder: <code>{'{{user_message}}'}</code>)
						<textarea
							rows={4}
							value={cfg.prompt || ''}
							onChange={(e) => setCfg({ prompt: e.target.value })}
							className={textareaCls}
							placeholder="Khách hỏi: {{user_message}}\nTrả lời thân thiện, ngắn gọn."
						/>
					</label>
					<label className={labelCls}>
						Model preset
						<select
							value={cfg.model || 'fast'}
							onChange={(e) => setCfg({ model: e.target.value })}
							className={inputCls}
						>
							<option value="fast">fast (rẻ, nhanh)</option>
							<option value="reasoning">reasoning (chậm, sâu)</option>
							<option value="default">default</option>
						</select>
					</label>
				</>
			)}

			{step.type === 'http_request' && (
				<>
					<div className="aw-grid aw-grid-cols-[100px_1fr] aw-gap-2">
						<label className={labelCls}>
							Method
							<select
								value={cfg.method || 'GET'}
								onChange={(e) => setCfg({ method: e.target.value })}
								className={inputCls}
							>
								<option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
							</select>
						</label>
						<label className={labelCls}>
							URL
							<input
								value={cfg.url || ''}
								onChange={(e) => setCfg({ url: e.target.value })}
								className={inputCls}
								placeholder="https://api.example.com/leads"
							/>
						</label>
					</div>
					<label className={labelCls}>
						Body (JSON)
						<textarea
							rows={3}
							value={typeof cfg.body === 'string' ? cfg.body : JSON.stringify(cfg.body || '', null, 2)}
							onChange={(e) => setCfg({ body: e.target.value })}
							className={textareaCls}
						/>
					</label>
					<label className={labelCls}>
						Lưu kết quả vào biến
						<input
							value={cfg.save_as || 'result'}
							onChange={(e) => setCfg({ save_as: e.target.value })}
							className={inputCls}
						/>
					</label>
				</>
			)}

			{step.type === 'save_data' && (
				<>
					<label className={labelCls}>
						Khoá (key)
						<input
							value={cfg.key || ''}
							onChange={(e) => setCfg({ key: e.target.value })}
							className={inputCls}
							placeholder="customer_phone"
						/>
					</label>
					<label className={labelCls}>
						Giá trị (hỗ trợ <code>{'{{var}}'}</code>)
						<input
							value={cfg.value || ''}
							onChange={(e) => setCfg({ value: e.target.value })}
							className={inputCls}
							placeholder="{{user_message}}"
						/>
					</label>
				</>
			)}

			{step.type === 'schedule_delay' && (
				<>
					<div className="aw-grid aw-grid-cols-2 aw-gap-2">
						<label className={labelCls}>
							Chờ
							<input
								type="number" min="1"
								value={cfg.delay_value || 1}
								onChange={(e) => setCfg({ delay_value: Number(e.target.value) || 1 })}
								className={inputCls}
							/>
						</label>
						<label className={labelCls}>
							Đơn vị
							<select
								value={cfg.delay_unit || 'minute'}
								onChange={(e) => setCfg({ delay_unit: e.target.value })}
								className={inputCls}
							>
								<option value="minute">phút</option>
								<option value="hour">giờ</option>
								<option value="day">ngày</option>
							</select>
						</label>
					</div>
					<label className={labelCls}>
						Sau đó chạy kịch bản (workflow ID)
						<input
							type="number"
							value={cfg.target_workflow_id || 0}
							onChange={(e) => setCfg({ target_workflow_id: Number(e.target.value) || 0 })}
							className={inputCls}
							placeholder="0 = chỉ ghi log, không trigger workflow khác"
						/>
					</label>
				</>
			)}

			{step.type === 'condition' && (
				<label className={labelCls}>
					Biểu thức điều kiện (JS-like, có biến từ trigger/payload/save_data)
					<textarea
						rows={3}
						value={cfg.expr || ''}
						onChange={(e) => setCfg({ expr: e.target.value })}
						className={textareaCls}
						placeholder='user_message.includes("giá") || user_message.includes("price")'
					/>
				</label>
			)}

			{/* Common: condition gate */}
			<label className={labelCls}>
				Chỉ chạy khi (tuỳ chọn — biểu thức)
				<input
					value={step.condition || ''}
					onChange={(e) => onChange({ ...step, condition: e.target.value })}
					className={inputCls}
					placeholder="ví dụ: !!save_data.customer_phone"
				/>
			</label>
		</div>
	);
}
