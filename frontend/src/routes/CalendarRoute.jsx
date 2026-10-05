/**
 * CalendarRoute — Automation Calendar (AUTOMATION-CAL 2026-06-14)
 *
 * Shows upcoming / past workflow cron events from bizcity_crm_events
 * (event_type = 'automation_workflow').
 *
 * Features:
 *  - Monthly calendar grid with event chips (color-coded by status)
 *  - Day panel: list events for selected day + per-event Edit/Delete
 *  - Bulk select + delete
 *  - "+ Thêm lịch" form sheet — create manual event for any workflow
 *  - "🔄 Đồng bộ" per-workflow or global re-sync (next 30 occurrences)
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
	CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Trash2,
	X, Clock, CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import { calendarApi } from '../lib/calendarApi.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad2(n) { return String(n).padStart(2, '0'); }

function localIso(date) {
	return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T00:00:00`;
}

function endOfMonth(year, month) {
	return new Date(year, month + 1, 0);
}

function daysInMonth(year, month) {
	return endOfMonth(year, month).getDate();
}

function firstDayOfMonth(year, month) {
	const d = new Date(year, month, 1).getDay(); // 0=Sun
	return d;
}

const MONTHS_VI = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
const WEEKDAYS_VI = ['CN','T2','T3','T4','T5','T6','T7'];

function eventDateKey(event) {
	// start_at is UTC MySQL datetime e.g. "2026-06-14 09:00:00"
	const s = (event.start_at || '').substring(0, 10);
	return s;
}

function statusColor(status) {
	switch (status) {
		case 'done':      return '#22c55e';
		case 'cancelled': return '#94a3b8';
		case 'active':    return '#6366f1';
		default:          return '#f59e0b';
	}
}
function statusLabel(status) {
	switch (status) {
		case 'done':      return 'Đã chạy';
		case 'cancelled': return 'Đã hủy';
		case 'active':    return 'Chờ';
		default:          return status;
	}
}
function StatusIcon({ status, size = 14 }) {
	if (status === 'done')      return <CheckCircle2 size={size} style={{ color: '#22c55e' }} />;
	if (status === 'cancelled') return <X size={size} style={{ color: '#94a3b8' }} />;
	if (status === 'active')    return <Clock size={size} style={{ color: '#6366f1' }} />;
	return <AlertCircle size={size} style={{ color: '#f59e0b' }} />;
}

function formatDateTime(s) {
	if (!s) return '—';
	try {
		return new Date(s.replace(' ', 'T') + 'Z').toLocaleString('vi-VN', {
			day: '2-digit', month: '2-digit', year: 'numeric',
			hour: '2-digit', minute: '2-digit', hour12: false,
		});
	} catch { return s; }
}

// ─── Event Form Sheet ─────────────────────────────────────────────────────────

function EventFormSheet({ onClose, onCreated }) {
	const [workflows, setWorkflows]    = useState([]);
	const [loading, setLoading]        = useState(true);
	const [saving, setSaving]          = useState(false);
	const [err, setErr]                = useState('');

	const [form, setForm] = useState({
		workflow_id:    '',
		start_at:       '',
		recurrence:     'once',
		occurrences:    1,
		title:          '',
		description:    '',
		prompt_before:  false,
		prompt_channel: 'zalo_bot',
		prompt_text:    '',
	});

	useEffect(() => {
		calendarApi.listWorkflows()
			.then(r => setWorkflows(Array.isArray(r?.rows) ? r.rows.filter(w => w.trigger_type === 'cron') : []))
			.catch(() => setWorkflows([]))
			.finally(() => setLoading(false));
	}, []);

	function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

	async function handleSubmit(e) {
		e.preventDefault();
		if (!form.workflow_id) { setErr('Chọn kịch bản trước.'); return; }
		if (!form.start_at)    { setErr('Chọn thời gian bắt đầu.'); return; }
		setSaving(true); setErr('');
		try {
			const res = await calendarApi.createEvent({
				workflow_id:    Number(form.workflow_id),
				start_at:       form.start_at,
				recurrence:     form.recurrence,
				occurrences:    form.recurrence === 'once' ? 1 : Number(form.occurrences),
				title:          form.title,
				description:    form.description,
				prompt_before:  form.prompt_before,
				prompt_channel: form.prompt_before ? form.prompt_channel : '',
				prompt_text:    form.prompt_before ? form.prompt_text : '',
			});
			onCreated(res);
		} catch (ex) {
			setErr(ex?.message || 'Lỗi khi tạo lịch.');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="aw-sheet-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
			<div className="aw-sheet">
				<div className="aw-sheet-header">
					<span style={{ fontWeight: 600, fontSize: 14 }}>+ Thêm lịch kịch bản</span>
					<button className="aw-icon-btn" onClick={onClose}><X size={16} /></button>
				</div>
				<form className="aw-sheet-body" onSubmit={handleSubmit}>
					{err && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{err}</p>}

					<label className="aw-field-label">Kịch bản (chỉ kịch bản trigger.cron)</label>
					{loading ? <p style={{ fontSize: 12, color: '#94a3b8' }}>Đang tải…</p> : (
						<select className="aw-select" value={form.workflow_id} onChange={e => set('workflow_id', e.target.value)} required>
							<option value="">— Chọn kịch bản —</option>
							{workflows.map(w => (
								<option key={w.id} value={w.id}>{w.name || `Workflow #${w.id}`}</option>
							))}
						</select>
					)}
					{workflows.length === 0 && !loading && (
						<p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
							Chưa có kịch bản nào dùng trigger "Lịch định kỳ (Cron)". Tạo workflow với trigger Cron trước.
						</p>
					)}

					<label className="aw-field-label">Tiêu đề (không bắt buộc)</label>
					<input className="aw-input" placeholder="Tên hiển thị trên calendar" value={form.title} onChange={e => set('title', e.target.value)} />

					<label className="aw-field-label">Thời gian bắt đầu</label>
					<input className="aw-input" type="datetime-local" value={form.start_at} onChange={e => set('start_at', e.target.value)} required />

					<label className="aw-field-label">Lặp lại</label>
					<select className="aw-select" value={form.recurrence} onChange={e => set('recurrence', e.target.value)}>
						<option value="once">Một lần</option>
						<option value="daily">Hàng ngày</option>
						<option value="weekly">Hàng tuần</option>
						<option value="monthly">Hàng tháng</option>
					</select>

					{form.recurrence !== 'once' && (
						<>
							<label className="aw-field-label">Số lần lặp (1–60)</label>
							<input className="aw-input" type="number" min={1} max={60} value={form.occurrences} onChange={e => set('occurrences', e.target.value)} />
						</>
					)}

					<label className="aw-field-label">Ghi chú</label>
					<textarea className="aw-input" rows={2} style={{ resize: 'vertical' }} value={form.description} onChange={e => set('description', e.target.value)} />

					<label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
						<input type="checkbox" checked={form.prompt_before} onChange={e => set('prompt_before', e.target.checked)} />
						Nhắn hỏi trước khi chạy (Prompt-before-trigger)
					</label>

					{form.prompt_before && (
						<div style={{ paddingLeft: 24, borderLeft: '2px solid #e2e8f0', marginTop: 8 }}>
							<label className="aw-field-label">Kênh gửi nhắc</label>
							<select className="aw-select" value={form.prompt_channel} onChange={e => set('prompt_channel', e.target.value)}>
								<option value="zalo_bot">Zalo Bot</option>
								<option value="telegram">Telegram</option>
							</select>
							<label className="aw-field-label">Nội dung nhắc nhở</label>
							<textarea className="aw-input" rows={2} style={{ resize: 'vertical' }}
								placeholder='VD: "9h rồi, đăng bài chưa? Nhắn đồng ý để chạy kịch bản."'
								value={form.prompt_text} onChange={e => set('prompt_text', e.target.value)} />
						</div>
					)}

					<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
						<button type="submit" className="aw-btn aw-btn-primary" disabled={saving}>
							{saving ? <Loader2 size={14} className="aw-animate-spin" /> : <Plus size={14} />}
							{saving ? 'Đang tạo…' : 'Tạo lịch'}
						</button>
						<button type="button" className="aw-btn aw-btn-outline" onClick={onClose}>Hủy</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Main CalendarRoute ───────────────────────────────────────────────────────

export default function CalendarRoute() {
	const today      = new Date();
	const [year, setYear]     = useState(today.getFullYear());
	const [month, setMonth]   = useState(today.getMonth());
	const [events, setEvents] = useState([]);
	const [loading, setLoading]     = useState(false);
	const [selectedDay, setSelectedDay] = useState(null);
	const [selected, setSelected]   = useState(new Set()); // selected event ids for bulk delete
	const [showForm, setShowForm]   = useState(false);
	const [syncing, setSyncing]     = useState(false);
	const [err, setErr]             = useState('');

	const loadEvents = useCallback(async (y, m) => {
		setLoading(true); setErr('');
		const from = `${y}-${pad2(m + 1)}-01 00:00:00`;
		const end  = endOfMonth(y, m);
		const to   = `${y}-${pad2(m + 1)}-${pad2(end.getDate())} 23:59:59`;
		try {
			const res = await calendarApi.listEvents({ from, to, limit: 500 });
			setEvents(Array.isArray(res?.rows) ? res.rows : []);
		} catch (ex) {
			setErr(ex?.message || 'Không tải được lịch.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => { loadEvents(year, month); }, [year, month, loadEvents]);

	// Group events by date key (YYYY-MM-DD).
	const byDate = events.reduce((acc, ev) => {
		const k = eventDateKey(ev);
		if (!acc[k]) acc[k] = [];
		acc[k].push(ev);
		return acc;
	}, {});

	// Events for selected day panel.
	const dayEvents = selectedDay ? (byDate[selectedDay] || []) : [];

	// Calendar grid.
	const totalDays  = daysInMonth(year, month);
	const firstDay   = firstDayOfMonth(year, month); // 0=Sun
	const gridCells  = [];
	for (let i = 0; i < firstDay; i++) gridCells.push(null);
	for (let d = 1; d <= totalDays; d++) gridCells.push(d);

	function prevMonth() {
		if (month === 0) { setYear(y => y - 1); setMonth(11); }
		else             { setMonth(m => m - 1); }
		setSelectedDay(null);
	}
	function nextMonth() {
		if (month === 11) { setYear(y => y + 1); setMonth(0); }
		else              { setMonth(m => m + 1); }
		setSelectedDay(null);
	}
	function goToday() {
		setYear(today.getFullYear()); setMonth(today.getMonth()); setSelectedDay(null);
	}

	async function handleSyncAll() {
		setSyncing(true);
		// Get unique workflow ids from current events or just reload.
		const wfIds = [...new Set(events.map(e => {
			const meta = typeof e.metadata === 'object' ? e.metadata : {};
			return meta.workflow_id;
		}).filter(Boolean))];
		try {
			for (const wid of wfIds) {
				await calendarApi.syncWorkflow(wid);
			}
		} catch { /* silent */ }
		await loadEvents(year, month);
		setSyncing(false);
	}

	async function handleDeleteEvent(id) {
		if (!window.confirm('Xóa sự kiện này?')) return;
		await calendarApi.deleteEvent(id);
		setEvents(ev => ev.filter(e => e.id !== id));
		setSelectedDay(sd => sd); // keep panel open
	}

	async function handleBulkDelete() {
		const ids = [...selected];
		if (!ids.length) return;
		if (!window.confirm(`Xóa ${ids.length} sự kiện đã chọn?`)) return;
		await calendarApi.bulkDelete(ids);
		setSelected(new Set());
		setEvents(ev => ev.filter(e => !ids.includes(e.id)));
	}

	function toggleSelect(id) {
		setSelected(prev => {
			const n = new Set(prev);
			n.has(id) ? n.delete(id) : n.add(id);
			return n;
		});
	}

	function handleCreated() {
		setShowForm(false);
		loadEvents(year, month);
	}

	const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

	return (
		<div className="aw-calendar-root">
			{/* ── Top bar ── */}
			<div className="aw-calendar-topbar">
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<CalendarDays size={18} />
					<span style={{ fontWeight: 600, fontSize: 15 }}>Lịch kịch bản</span>
				</div>
				<div style={{ display: 'flex', gap: 8 }}>
					{selected.size > 0 && (
						<button className="aw-btn aw-btn-outline" style={{ color: '#ef4444', borderColor: '#fca5a5' }} onClick={handleBulkDelete}>
							<Trash2 size={14} /> Xóa {selected.size} đã chọn
						</button>
					)}
					<button className="aw-btn aw-btn-outline" onClick={handleSyncAll} disabled={syncing}>
						{syncing ? <Loader2 size={14} className="aw-animate-spin" /> : <RefreshCw size={14} />}
						Đồng bộ
					</button>
					<button className="aw-btn aw-btn-primary" onClick={() => setShowForm(true)}>
						<Plus size={14} /> Thêm lịch
					</button>
				</div>
			</div>

			{err && <p style={{ color: '#ef4444', fontSize: 12, padding: '8px 16px' }}>{err}</p>}

			<div className="aw-calendar-body">
				{/* ── Calendar panel ── */}
				<div className="aw-calendar-panel">
					{/* Month nav */}
					<div className="aw-calendar-nav">
						<button className="aw-icon-btn" onClick={prevMonth}><ChevronLeft size={16} /></button>
						<span style={{ fontWeight: 600, fontSize: 14 }}>{MONTHS_VI[month]} {year}</span>
						<button className="aw-icon-btn" onClick={nextMonth}><ChevronRight size={16} /></button>
						<button className="aw-btn aw-btn-ghost" style={{ fontSize: 12, padding: '3px 8px', marginLeft: 8 }} onClick={goToday}>Hôm nay</button>
					</div>

					{/* Weekday header */}
					<div className="aw-cal-grid-header">
						{WEEKDAYS_VI.map(d => <span key={d}>{d}</span>)}
					</div>

					{/* Day cells */}
					{loading ? (
						<div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
							<Loader2 size={18} className="aw-animate-spin" />
						</div>
					) : (
						<div className="aw-cal-grid">
							{gridCells.map((day, i) => {
								if (!day) return <div key={`e${i}`} className="aw-cal-cell aw-cal-cell--empty" />;
								const key   = `${year}-${pad2(month + 1)}-${pad2(day)}`;
								const cells = byDate[key] || [];
								const isToday    = key === todayKey;
								const isSelected = selectedDay === key;
								return (
									<div
										key={key}
										className={`aw-cal-cell${isToday ? ' aw-cal-cell--today' : ''}${isSelected ? ' aw-cal-cell--selected' : ''}`}
										onClick={() => setSelectedDay(isSelected ? null : key)}
									>
										<span className="aw-cal-day-num">{day}</span>
										{cells.slice(0, 3).map(ev => (
											<span
												key={ev.id}
												className="aw-cal-chip"
												style={{ background: statusColor(ev.status) + '22', color: statusColor(ev.status), borderColor: statusColor(ev.status) + '55' }}
												title={(typeof ev.metadata === 'object' ? ev.metadata?.workflow_name : '') || ev.title}
											>
												{(ev.title || '…').substring(0, 12)}
											</span>
										))}
										{cells.length > 3 && (
											<span className="aw-cal-chip aw-cal-chip--more">+{cells.length - 3}</span>
										)}
									</div>
								);
							})}
						</div>
					)}
				</div>

				{/* ── Day panel ── */}
				{selectedDay && (
					<div className="aw-calendar-day-panel">
						<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
							<span style={{ fontWeight: 600, fontSize: 13 }}>
								{new Date(selectedDay + 'T12:00:00').toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
							</span>
							<button className="aw-icon-btn" onClick={() => setSelectedDay(null)}><X size={14} /></button>
						</div>

						{dayEvents.length === 0 && (
							<p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Không có sự kiện nào.</p>
						)}

						{dayEvents.map(ev => {
							const meta = typeof ev.metadata === 'object' ? ev.metadata : {};
							const isChecked = selected.has(ev.id);
							return (
								<div key={ev.id} className={`aw-day-event${isChecked ? ' aw-day-event--checked' : ''}`}>
									<input type="checkbox" checked={isChecked} onChange={() => toggleSelect(ev.id)} style={{ marginRight: 8, flexShrink: 0 }} />
									<div style={{ flex: 1, minWidth: 0 }}>
										<div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
											<StatusIcon status={ev.status} size={13} />
											<span style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
												{ev.title || meta.workflow_name || `Event #${ev.id}`}
											</span>
										</div>
										<div style={{ fontSize: 11, color: '#64748b' }}>
											<Clock size={10} style={{ display: 'inline', marginRight: 3 }} />
											{formatDateTime(ev.start_at)}
											{meta.workflow_name && (
												<> · <span style={{ color: '#6366f1' }}>{meta.workflow_name}</span></>
											)}
										</div>
										<span className="aw-status-badge" style={{ background: statusColor(ev.status) + '20', color: statusColor(ev.status), borderColor: statusColor(ev.status) + '40' }}>
											{statusLabel(ev.status)}
										</span>
									</div>
									<button className="aw-icon-btn" title="Xóa sự kiện" onClick={() => handleDeleteEvent(ev.id)} style={{ color: '#ef4444', flexShrink: 0 }}>
										<Trash2 size={13} />
									</button>
								</div>
							);
						})}

						{selected.size > 0 && (
							<button className="aw-btn aw-btn-outline" style={{ color: '#ef4444', borderColor: '#fca5a5', marginTop: 10, width: '100%' }} onClick={handleBulkDelete}>
								<Trash2 size={13} /> Xóa {selected.size} đã chọn
							</button>
						)}
					</div>
				)}
			</div>

			{/* ── Event Form Sheet ── */}
			{showForm && (
				<EventFormSheet onClose={() => setShowForm(false)} onCreated={handleCreated} />
			)}
		</div>
	);
}
