import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Database, FileUp, Loader2, Plus, RefreshCw, Save, Search, Table2, Trash2, XCircle } from 'lucide-react';
import { BizCityApiError, configPacksApi } from '../lib/api.js';

const SCHEMAS = [
	{ value: 'content_calendar', label: 'Content Calendar' },
	{ value: 'product_catalog', label: 'Product Catalog' },
	{ value: 'automation_scenarios', label: 'Automation Scenarios' },
];

function pickMsg(e, fallback = 'Lỗi') {
	return e instanceof BizCityApiError
		? `[${e.code || e.status}] ${e.message}`
		: (e?.message || fallback);
}

function statusClass(status) {
	if (status === 'valid' || status === 'approved') return 'aw-bg-green-50 aw-text-green-700 aw-border-green-200';
	if (status === 'warning') return 'aw-bg-amber-50 aw-text-amber-700 aw-border-amber-200';
	if (status === 'error') return 'aw-bg-red-50 aw-text-red-700 aw-border-red-200';
	return 'aw-bg-slate-50 aw-text-slate-700 aw-border-slate-200';
}

function collectColumns(rows) {
	const seen = new Set();
	(rows || []).forEach((row) => {
		Object.keys(row?.row_json || row || {}).forEach((key) => seen.add(key));
	});
	return Array.from(seen).slice(0, 40);
}

function normalizePreviewRows(rows) {
	return (rows || []).map((row, index) => ({
		id: row.id || `preview_${index}`,
		row_json: row.row_json || row,
		validation_status: row.validation_status || 'draft',
		validation_errors_json: row.validation_errors_json || [],
		_dirty: false,
	}));
}

export default function ConfigDataTableRoute() {
	const [schema, setSchema] = useState('content_calendar');
	const [packName, setPackName] = useState('');
	const [sourceUrl, setSourceUrl] = useState('');
	const [rawCsv, setRawCsv] = useState('');
	const [packs, setPacks] = useState([]);
	const [activePack, setActivePack] = useState(null);
	const [rows, setRows] = useState([]);
	const [columns, setColumns] = useState([]);
	const [search, setSearch] = useState('');
	const [loading, setLoading] = useState(false);
	const [savingRow, setSavingRow] = useState({});
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [fileName, setFileName] = useState('');

	const filteredRows = useMemo(() => {
		const q = search.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((row) => JSON.stringify(row.row_json || {}).toLowerCase().includes(q));
	}, [rows, search]);

	const loadPacks = async () => {
		setError('');
		try {
			const res = await configPacksApi.list({ schema_key: schema, limit: 50 });
			setPacks(Array.isArray(res?.rows) ? res.rows : []);
		} catch (e) {
			setError(pickMsg(e, 'Không tải được danh sách bảng cấu hình'));
		}
	};

	useEffect(() => { loadPacks(); /* eslint-disable-next-line */ }, [schema]);

	const parseInput = async () => {
		setLoading(true);
		setError('');
		setNotice('');
		try {
			const res = await configPacksApi.parse({ schema_key: schema, raw_csv: rawCsv, source_url: sourceUrl });
			const nextRows = normalizePreviewRows(res.rows || []);
			setRows(nextRows);
			setColumns(res.columns?.length ? res.columns : collectColumns(nextRows));
			setActivePack(null);
			setNotice(`Đã parse ${nextRows.length} dòng. Kiểm tra rồi bấm Save pack.`);
		} catch (e) {
			setError(pickMsg(e, 'Parse CSV thất bại'));
		} finally {
			setLoading(false);
		}
	};

	const loadSample = async () => {
		setLoading(true);
		setError('');
		setNotice('');
		try {
			const res = await configPacksApi.sampleCsv(schema);
			setRawCsv(res.raw_csv || '');
			setSourceUrl('');
			setFileName(res.filename || 'sample.csv');
			setNotice('Đã nạp CSV mẫu vào ô paste. Bấm Parse vào DataTable để xem bảng.');
		} catch (e) {
			setError(pickMsg(e, 'Không tải được CSV mẫu'));
		} finally {
			setLoading(false);
		}
	};

	const onFileChange = (event) => {
		const file = event.target.files?.[0];
		if (!file) return;
		setError('');
		setNotice('');
		const reader = new FileReader();
		reader.onload = () => {
			setRawCsv(String(reader.result || ''));
			setSourceUrl('');
			setFileName(file.name);
			setNotice(`Đã đọc file ${file.name}. Bấm Parse vào DataTable để xem bảng.`);
		};
		reader.onerror = () => setError('Không đọc được file CSV.');
		reader.readAsText(file, 'utf-8');
	};

	const savePack = async () => {
		if (!rows.length) return;
		setLoading(true);
		setError('');
		try {
			const payloadRows = rows.map((row) => row.row_json || row);
			const res = activePack?.id
				? await configPacksApi.bulkRows(activePack.id, { name: packName, rows: payloadRows })
				: await configPacksApi.create({
					name: packName,
					schema_key: schema,
					source_type: sourceUrl ? 'csv_url' : 'raw_csv',
					source_ref: sourceUrl,
					rows: payloadRows,
				});
			setActivePack(res);
			setRows(normalizePreviewRows(res.rows || []));
			setColumns(collectColumns(res.rows || rows));
			setNotice(activePack?.id ? 'Đã cập nhật pack hiện tại và rebuild search_text.' : 'Đã lưu bảng cấu hình. Wave 2 mới kích hoạt automation từ pack này.');
			loadPacks();
		} catch (e) {
			setError(pickMsg(e, 'Lưu pack thất bại'));
		} finally {
			setLoading(false);
		}
	};

	const openPack = async (id) => {
		setLoading(true);
		setError('');
		try {
			const res = await configPacksApi.get(id);
			setActivePack(res);
			setRows(normalizePreviewRows(res.rows || []));
			setColumns(collectColumns(res.rows || []));
			setPackName(res.name || '');
			setNotice('');
		} catch (e) {
			setError(pickMsg(e, 'Không mở được pack'));
		} finally {
			setLoading(false);
		}
	};

	const updateCell = (rowId, column, value) => {
		setRows((prev) => prev.map((row) => row.id === rowId
			? { ...row, row_json: { ...(row.row_json || {}), [column]: value }, _dirty: true }
			: row));
	};

	const saveRow = async (row) => {
		if (!activePack?.id || String(row.id).startsWith('preview_')) return;
		setSavingRow((prev) => ({ ...prev, [row.id]: true }));
		setError('');
		try {
			const saved = await configPacksApi.updateRow(activePack.id, row.id, row.row_json || {});
			setRows((prev) => prev.map((item) => item.id === row.id ? { ...saved, _dirty: false } : item));
		} catch (e) {
			setError(pickMsg(e, 'Lưu dòng thất bại'));
		} finally {
			setSavingRow((prev) => ({ ...prev, [row.id]: false }));
		}
	};

	const addColumn = () => {
		const name = window.prompt('Tên cột mới, ví dụ x_campaign_note');
		if (!name) return;
		const key = name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
		if (!key || columns.includes(key)) return;
		setColumns((prev) => [...prev, key]);
		setRows((prev) => prev.map((row) => ({ ...row, row_json: { ...(row.row_json || {}), [key]: '' }, _dirty: true })));
	};

	const deleteColumn = () => {
		if (!columns.length) return;
		const name = window.prompt(`Xoá cột nào?\n${columns.join(', ')}`);
		if (!name) return;
		const key = name.trim();
		if (!columns.includes(key)) return;
		setColumns((prev) => prev.filter((column) => column !== key));
		setRows((prev) => prev.map((row) => {
			const nextJson = { ...(row.row_json || {}) };
			delete nextJson[key];
			return { ...row, row_json: nextJson, _dirty: true };
		}));
	};

	const addRow = () => {
		const blank = {};
		columns.forEach((column) => { blank[column] = ''; });
		setRows((prev) => [...prev, { id: `preview_${Date.now()}`, row_json: blank, validation_status: 'draft', validation_errors_json: [], _dirty: true }]);
	};

	const deleteRow = (rowId) => {
		setRows((prev) => prev.filter((row) => row.id !== rowId));
	};

	const validatePack = async () => {
		if (!activePack?.id) return;
		setLoading(true);
		setError('');
		try {
			const res = await configPacksApi.validate(activePack.id);
			setActivePack(res);
			setRows(normalizePreviewRows(res.rows || []));
			setNotice('Đã validate lại pack và rebuild search_text.');
		} catch (e) {
			setError(pickMsg(e, 'Validate thất bại'));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="aw-config-root">
			<header className="aw-config-topbar">
				<div>
					<div className="aw-config-title"><Database size={18} /> Cấu hình dữ liệu automation</div>
					<div className="aw-config-subtitle">Wave 1: import CSV/Sheet → DataTable editable → save config pack. Chưa kích hoạt workflow.</div>
				</div>
				<div className="aw-config-actions">
					<button type="button" className="aw-btn aw-btn-outline" onClick={loadPacks}><RefreshCw size={14} /> Refresh</button>
					<button type="button" className="aw-btn aw-btn-outline" onClick={addColumn}><Plus size={14} /> Cột</button>
					<button type="button" className="aw-btn aw-btn-outline" onClick={deleteColumn}><Trash2 size={14} /> Xoá cột</button>
					<button type="button" className="aw-btn aw-btn-outline" onClick={addRow}><Plus size={14} /> Dòng</button>
					<button type="button" className="aw-btn aw-btn-primary" onClick={savePack} disabled={loading || !rows.length}><Save size={14} /> {activePack?.id ? 'Update pack' : 'Save pack'}</button>
				</div>
			</header>

			<section className="aw-config-grid">
				<aside className="aw-config-sidebar">
					<label className="aw-config-label">Schema</label>
					<select className="aw-config-input" value={schema} onChange={(e) => setSchema(e.target.value)}>
						{SCHEMAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
					</select>

					<label className="aw-config-label">Tên pack</label>
					<input className="aw-config-input" value={packName} onChange={(e) => setPackName(e.target.value)} placeholder="VD: Content tháng 8" />

					<label className="aw-config-label">CSV / Google Sheet public link</label>
					<input className="aw-config-input" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://docs.google.com/.../edit" />

					<div className="aw-config-mini-actions">
						<button type="button" className="aw-btn aw-btn-outline aw-btn-sm" onClick={loadSample} disabled={loading}>Tải mẫu vào ô CSV</button>
						<label className="aw-btn aw-btn-outline aw-btn-sm aw-config-file-btn">
							Upload CSV
							<input type="file" accept=".csv,text/csv" onChange={onFileChange} />
						</label>
					</div>
					{fileName && <div className="aw-config-file-name">Nguồn: {fileName}</div>}

					<label className="aw-config-label">Hoặc paste CSV</label>
					<textarea className="aw-config-textarea" value={rawCsv} onChange={(e) => setRawCsv(e.target.value)} placeholder="day_index,date,time,..." />

					<button type="button" className="aw-btn aw-btn-primary aw-config-full" onClick={parseInput} disabled={loading || (!rawCsv && !sourceUrl)}>
						{loading ? <Loader2 size={14} className="aw-animate-spin" /> : <FileUp size={14} />} Parse vào DataTable
					</button>

					<div className="aw-config-pack-list">
						<div className="aw-config-list-title">Pack đã lưu</div>
						{packs.map((pack) => (
							<button type="button" key={pack.id} className={`aw-config-pack ${activePack?.id === pack.id ? 'is-active' : ''}`} onClick={() => openPack(pack.id)}>
								<span>{pack.name}</span>
								<small>{pack.schema_key} · {pack.status}</small>
							</button>
						))}
						{packs.length === 0 && <div className="aw-config-empty">Chưa có pack nào.</div>}
					</div>
				</aside>

				<main className="aw-config-main">
					<div className="aw-config-toolbar">
						<div className="aw-config-pack-heading">
							<Table2 size={16} />
							<span>{activePack?.name || 'Preview chưa lưu'}</span>
							<span className={`aw-config-status ${statusClass(activePack?.status || 'draft')}`}>{activePack?.status || 'draft'}</span>
						</div>
						<div className="aw-config-search">
							<Search size={14} />
							<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm trong bảng" />
						</div>
						<button type="button" className="aw-btn aw-btn-outline" onClick={validatePack} disabled={!activePack?.id || loading}>Validate</button>
					</div>

					{error && <div className="aw-config-alert is-error"><XCircle size={16} /> {error}</div>}
					{notice && <div className="aw-config-alert is-ok"><CheckCircle2 size={16} /> {notice}</div>}

					<div className="aw-config-table-wrap">
						<table className="aw-config-table">
							<thead>
								<tr>
									<th className="aw-config-rownum">#</th>
									<th>Status</th>
									{columns.map((column) => <th key={column}>{column}</th>)}
									<th>Action</th>
								</tr>
							</thead>
							<tbody>
								{filteredRows.map((row, index) => (
									<tr key={row.id}>
										<td className="aw-config-rownum">{index + 1}</td>
										<td><span className={`aw-config-status ${statusClass(row.validation_status)}`}>{row.validation_status || 'draft'}</span></td>
										{columns.map((column) => (
											<td key={column}>
												<textarea
													className="aw-config-cell"
													value={row.row_json?.[column] ?? ''}
													onChange={(e) => updateCell(row.id, column, e.target.value)}
												/>
											</td>
										))}
										<td>
											<button type="button" className="aw-btn aw-btn-outline aw-btn-sm" disabled={!activePack?.id || !row._dirty || savingRow[row.id]} onClick={() => saveRow(row)}>
												{savingRow[row.id] ? <Loader2 size={13} className="aw-animate-spin" /> : <Save size={13} />} Row
											</button>
											<button type="button" className="aw-btn aw-btn-ghost aw-btn-sm aw-config-danger" onClick={() => deleteRow(row.id)}>
												<Trash2 size={13} />
											</button>
										</td>
									</tr>
								))}
								{filteredRows.length === 0 && (
									<tr><td colSpan={columns.length + 3} className="aw-config-empty-cell">Paste CSV hoặc mở một pack đã lưu.</td></tr>
								)}
							</tbody>
						</table>
					</div>
				</main>
			</section>
		</div>
	);
}