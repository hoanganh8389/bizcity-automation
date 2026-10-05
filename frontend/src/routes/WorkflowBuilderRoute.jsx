import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
	ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
	Controls, MiniMap, Panel,
	useReactFlow, ConnectionMode,
} from '@xyflow/react';
import { useBuilderStore } from '../store/builderStore.js';
import { INITIAL_META, INITIAL_NODES, INITIAL_EDGES } from '../store/builderStore.js';
import { workflowsApi, BizCityApiError } from '../lib/api.js';
import { NODE_TYPES } from '../components/nodes/index.jsx';
import { EDGE_TYPES } from '../components/edges/index.jsx';
import Palette from '../components/Palette.jsx';
import Inspector from '../components/Inspector.jsx';
import Toolbar from '../components/Toolbar.jsx';
import RunTimeline from '../components/RunTimeline.jsx';
import { SettingsDialog, ConfirmDialog } from '../components/Dialogs.jsx';
import CustomConnectionLine from '../components/CustomConnectionLine.jsx';
import ContextMenu from '../components/ContextMenu.jsx';
import HelperLines from '../components/HelperLines.jsx';
import { autoLayout } from '../lib/autoLayout.js';
import { snapWithHelperLines } from '../lib/helperLines.js';

const DEBUG = typeof window !== 'undefined' && !!window.__AW_DEBUG__;
const dbg = (...args) => { if (DEBUG) console.log(...args); };

/**
 * Workflow Builder — S1 full UI.
 *  ┌───────────────────────────────────────────────────────────────┐
 *  │ Toolbar (name · undo/redo · layout · edge-type · save · run)  │
 *  ├──────────┬─────────────────────────────────────┬──────────────┤
 *  │ Palette  │           ReactFlow canvas          │  Inspector   │
 *  │ (drag)   │ + Bg/MiniMap/Controls/NodeToolbar   │  (node cfg)  │
 *  ├──────────┴─────────────────────────────────────┴──────────────┤
 *  │ RunTimeline (collapsible, overlays canvas)                    │
 *  └───────────────────────────────────────────────────────────────┘
 *
 * Keyboard shortcuts:
 *   Del / Backspace  → delete selected
 *   Ctrl/Cmd + Z     → undo
 *   Ctrl/Cmd + Y or Ctrl+Shift+Z → redo
 *   Ctrl/Cmd + C     → copy selection
 *   Ctrl/Cmd + X     → cut selection
 *   Ctrl/Cmd + V     → paste
 *   Ctrl/Cmd + D     → duplicate primary selected
 *   L                → auto-layout
 */
function Canvas() {
	const reactFlow = useReactFlow();
	const wrapperRef = useRef(null);

	const [isDropTarget, setIsDropTarget] = useState(false);
	const dragCounter = useRef(0);
	const reconnectSuccessful = useRef(true);
	const [menu, setMenu] = useState(null); // {top,left,items}

	const nodes        = useBuilderStore((s) => s.nodes);
	const edges        = useBuilderStore((s) => s.edges);
	const onNodesChangeStore = useBuilderStore((s) => s.onNodesChange);
	const onEdgesChange = useBuilderStore((s) => s.onEdgesChange);
	const onConnect     = useBuilderStore((s) => s.onConnect);
	const addNode       = useBuilderStore((s) => s.addNode);
	const select        = useBuilderStore((s) => s.select);
	const setSelected   = useBuilderStore((s) => s.setSelected);
	const isValidConnection = useBuilderStore((s) => s.isValidConnection);
	const removeSelected    = useBuilderStore((s) => s.removeSelected);
	const removeNode        = useBuilderStore((s) => s.removeNode);
	const reconnectEdgeAction = useBuilderStore((s) => s.reconnectEdgeAction);
	const removeEdge        = useBuilderStore((s) => s.removeEdge);
	const undo              = useBuilderStore((s) => s.undo);
	const redo              = useBuilderStore((s) => s.redo);
	const copySelection     = useBuilderStore((s) => s.copySelection);
	const cutSelection      = useBuilderStore((s) => s.cutSelection);
	const paste             = useBuilderStore((s) => s.paste);
	const duplicateNode     = useBuilderStore((s) => s.duplicateNode);
	const selectedId        = useBuilderStore((s) => s.selectedId);
	const setNodes          = useBuilderStore((s) => s.setNodes);

	const snapToGrid    = useBuilderStore((s) => s.snapToGrid);
	const snapGrid      = useBuilderStore((s) => s.snapGrid);
	const bgVariant     = useBuilderStore((s) => s.bgVariant);
	const viewport      = useBuilderStore((s) => s.viewport);
	const setViewportStore = useBuilderStore((s) => s.setViewport);
	const helperVertical   = useBuilderStore((s) => s.helperVertical);
	const helperHorizontal = useBuilderStore((s) => s.helperHorizontal);
	const setHelperLines   = useBuilderStore((s) => s.setHelperLines);
	const clearHelperLines = useBuilderStore((s) => s.clearHelperLines);

	const isPaletteDrag = (e) =>
		e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('application/automation-block');

	// Wrap nodes-change to inject helper-line snap during a single-node drag.
	const onNodesChange = useCallback((changes) => {
		const dragging = changes.find((c) => c.type === 'position' && c.dragging && c.position);
		if (dragging) {
			const all = useBuilderStore.getState().nodes;
			const node = all.find((n) => n.id === dragging.id);
			if (node) {
				const { position, vertical, horizontal } = snapWithHelperLines(
					{ ...node, position: dragging.position },
					all,
				);
				dragging.position = position;
				setHelperLines(vertical, horizontal);
			}
		}
		const dragEnd = changes.some((c) => c.type === 'position' && c.dragging === false);
		if (dragEnd) clearHelperLines();
		onNodesChangeStore(changes);
	}, [onNodesChangeStore, setHelperLines, clearHelperLines]);

	// Restore last saved viewport (zoom/pan) on mount.
	useEffect(() => {
		if (viewport && reactFlow?.setViewport) {
			try { reactFlow.setViewport(viewport, { duration: 0 }); } catch { /* noop */ }
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const onMoveEnd = useCallback((_evt, vp) => {
		setViewportStore(vp);
	}, [setViewportStore]);

	const onDragEnter = useCallback((e) => {
		if (!isPaletteDrag(e)) return;
		dragCounter.current += 1;
		if (dragCounter.current === 1) setIsDropTarget(true);
	}, []);
	const onDragLeave = useCallback((e) => {
		if (!isPaletteDrag(e)) return;
		dragCounter.current = Math.max(0, dragCounter.current - 1);
		if (dragCounter.current === 0) setIsDropTarget(false);
	}, []);
	const onDragOver = useCallback((e) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
	}, []);

	// Identify if drop point lies inside a group node — if so, attach as child.
	const findGroupAt = useCallback((flowPos) => {
		const groups = useBuilderStore.getState().nodes.filter((n) => n.type === 'group');
		for (const g of groups) {
			const w = (g.style && g.style.width)  || 320;
			const h = (g.style && g.style.height) || 200;
			if (
				flowPos.x >= g.position.x && flowPos.x <= g.position.x + w &&
				flowPos.y >= g.position.y && flowPos.y <= g.position.y + h
			) return g;
		}
		return null;
	}, []);

	const onDrop = useCallback((e) => {
		e.preventDefault();
		dragCounter.current = 0;
		setIsDropTarget(false);
		const blockId = e.dataTransfer.getData('application/automation-block');
		if (!blockId) return;
		const flowPos = reactFlow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
		const group = findGroupAt(flowPos);
		if (group && blockId !== 'layout.group') {
			// Convert position to be relative to parent group origin.
			const relPos = { x: flowPos.x - group.position.x, y: flowPos.y - group.position.y };
			addNode(blockId, relPos, group.id);
		} else {
			addNode(blockId, flowPos);
		}
	}, [reactFlow, addNode, findGroupAt]);

	// ── Edge reconnect (xyflow v12) ────────────────────────────────────────
	const onReconnectStart = useCallback((evt, edge, handleType) => {
		reconnectSuccessful.current = false;
		dbg('[AW][edge] reconnectStart', { edgeId: edge?.id, handleType });
	}, []);
	const onReconnect = useCallback((oldEdge, newConnection) => {
		dbg('[AW][edge] reconnect attempt', { oldEdge, newConnection });
		const ok = reconnectEdgeAction(oldEdge, newConnection);
		dbg('[AW][edge] reconnect result', { ok });
		reconnectSuccessful.current = ok;
	}, [reconnectEdgeAction]);
	const onReconnectEnd = useCallback((_evt, edge) => {
		dbg('[AW][edge] reconnectEnd', { edgeId: edge?.id, succeeded: reconnectSuccessful.current });
		if (!reconnectSuccessful.current) removeEdge(edge.id);
		reconnectSuccessful.current = true;
	}, [removeEdge]);

	const onConnectDebug = useCallback((params) => {
		dbg('[AW][edge] connect', params);
		onConnect(params);
	}, [onConnect]);

	const onSelectionChange = useCallback(({ nodes: selNodes, edges: selEdges }) => {
		setSelected(
			selNodes.map((n) => n.id),
			(selEdges || []).map((e) => e.id),
		);
	}, [setSelected]);

	// ── Context menus (right-click on node / edge / pane) ─────────────────
	const buildPosition = (clientX, clientY) => {
		const rect = wrapperRef.current?.getBoundingClientRect();
		if (!rect) return { top: clientY, left: clientX };
		const x = clientX - rect.left;
		const y = clientY - rect.top;
		// Flip to right/bottom if too close to edges so menu stays in view.
		return {
			top:    y < rect.height - 220 ? y : undefined,
			bottom: y < rect.height - 220 ? undefined : rect.height - y,
			left:   x < rect.width  - 220 ? x : undefined,
			right:  x < rect.width  - 220 ? undefined : rect.width  - x,
		};
	};
	const onNodeContextMenu = useCallback((evt, node) => {
		evt.preventDefault();
		setMenu({
			...buildPosition(evt.clientX, evt.clientY),
			items: [
				{ id: 'dup',  label: 'Nhân bản', shortcut: 'Ctrl+D', onClick: () => duplicateNode(node.id) },
				{ id: 'copy', label: 'Copy',     shortcut: 'Ctrl+C', onClick: () => { setSelected([node.id]); copySelection(); } },
				{ id: 'cut',  label: 'Cut',      shortcut: 'Ctrl+X', onClick: () => { setSelected([node.id]); cutSelection(); } },
				{ divider: true },
				{ id: 'del',  label: 'Xoá node', shortcut: 'Del',    danger: true, onClick: () => removeNode(node.id) },
			],
		});
	}, [duplicateNode, copySelection, cutSelection, removeNode, setSelected]);

	const onEdgeContextMenu = useCallback((evt, edge) => {
		evt.preventDefault();
		setMenu({
			...buildPosition(evt.clientX, evt.clientY),
			items: [
				{ id: 'del', label: 'Xoá kết nối', shortcut: 'Del', danger: true, onClick: () => removeEdge(edge.id) },
			],
		});
	}, [removeEdge]);

	const onPaneContextMenu = useCallback((evt) => {
		evt.preventDefault();
		setMenu({
			...buildPosition(evt.clientX, evt.clientY),
			items: [
				{ id: 'paste',  label: 'Paste',          shortcut: 'Ctrl+V', onClick: () => paste() },
				{ divider: true },
				{ id: 'fit',    label: 'Fit View',       shortcut: '⇧+1',     onClick: () => reactFlow.fitView({ duration: 300 }) },
				{ id: 'layout', label: 'Sắp xếp tự động', shortcut: 'L',
				  onClick: () => setNodes(autoLayout(useBuilderStore.getState().nodes, useBuilderStore.getState().edges)) },
			],
		});
	}, [paste, reactFlow, setNodes]);

	// Keyboard shortcuts (Ctrl/Cmd combos + L for layout). Skip when typing in
	// a text field so the inspector inputs work normally.
	useEffect(() => {
		const onKey = (ev) => {
			const tag = (ev.target?.tagName || '').toLowerCase();
			if (tag === 'input' || tag === 'textarea' || ev.target?.isContentEditable) return;

			const ctrl = ev.ctrlKey || ev.metaKey;

			if (ctrl && (ev.key === 'z' || ev.key === 'Z')) {
				ev.preventDefault();
				ev.shiftKey ? redo() : undo();
				return;
			}
			if (ctrl && (ev.key === 'y' || ev.key === 'Y')) {
				ev.preventDefault(); redo(); return;
			}
			if (ctrl && (ev.key === 'c' || ev.key === 'C')) {
				ev.preventDefault(); copySelection(); return;
			}
			if (ctrl && (ev.key === 'x' || ev.key === 'X')) {
				ev.preventDefault(); cutSelection(); return;
			}
			if (ctrl && (ev.key === 'v' || ev.key === 'V')) {
				ev.preventDefault(); paste(); return;
			}
			if (ctrl && (ev.key === 'd' || ev.key === 'D')) {
				ev.preventDefault();
				if (selectedId) duplicateNode(selectedId);
				return;
			}
			if (ev.key === 'Delete' || ev.key === 'Backspace') {
				ev.preventDefault(); removeSelected(); return;
			}
			if (!ctrl && (ev.key === 'l' || ev.key === 'L')) {
				ev.preventDefault();
				setNodes(autoLayout(useBuilderStore.getState().nodes, useBuilderStore.getState().edges));
				return;
			}
			if (!ctrl && (ev.key === 'g' || ev.key === 'G')) {
				ev.preventDefault();
				useBuilderStore.getState().toggleSnapToGrid();
				return;
			}
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	}, [undo, redo, copySelection, cutSelection, paste, duplicateNode, removeSelected, selectedId, setNodes]);

	return (
		<div
			ref={wrapperRef}
			className={isDropTarget ? 'aw-canvas-droptarget' : undefined}
			style={{ width: '100%', height: '100%', position: 'relative' }}
			onDrop={onDrop}
			onDragOver={onDragOver}
			onDragEnter={onDragEnter}
			onDragLeave={onDragLeave}
		>
			<ReactFlow
				nodes={nodes}
				edges={edges}
				nodeTypes={NODE_TYPES}
				edgeTypes={EDGE_TYPES}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnectDebug}
				onReconnect={onReconnect}
				onReconnectStart={onReconnectStart}
				onReconnectEnd={onReconnectEnd}
				onMoveEnd={onMoveEnd}
				onNodeContextMenu={onNodeContextMenu}
				onEdgeContextMenu={onEdgeContextMenu}
				onPaneContextMenu={onPaneContextMenu}
				edgesReconnectable
				reconnectRadius={30}
				connectionRadius={28}
				snapToGrid={snapToGrid}
				snapGrid={snapGrid}
				onlyRenderVisibleElements
				onNodeClick={(_, n) => select(n.id)}
				onPaneClick={() => { select(null); setMenu(null); }}
				onSelectionChange={onSelectionChange}
				isValidConnection={isValidConnection}
				connectionLineComponent={CustomConnectionLine}
				connectionMode={ConnectionMode.Loose}
				multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
				selectionKeyCode={'Shift'}
				deleteKeyCode={null}
				panOnDrag={true}
				panOnScroll
				zoomOnScroll={false}
				zoomOnPinch
				selectionOnDrag={false}
				fitView
				proOptions={{ hideAttribution: true }}
			>
				<Background
					gap={snapToGrid ? snapGrid[0] : 16}
					color="#e2e8f0"
					variant={
						bgVariant === 'lines' ? BackgroundVariant.Lines :
						bgVariant === 'cross' ? BackgroundVariant.Cross :
						BackgroundVariant.Dots
					}
				/>
				<HelperLines vertical={helperVertical} horizontal={helperHorizontal} />
				<MiniMap pannable zoomable nodeColor={(n) => {
					switch (n.type) {
						case 'trigger':   return '#7c3aed';
						case 'condition': return '#b45309';
						case 'llm':       return '#059669';
						case 'output':    return '#15803d';
						case 'group':     return '#94a3b8';
						default:          return '#475569';
					}
				}} />
				<Controls />
				<ZoomPanel />
			</ReactFlow>

			<ContextMenu menu={menu} onClose={() => setMenu(null)} />

			{isDropTarget && (
				<div className="aw-drop-hint">
					<span>Thả vào canvas để thêm khối</span>
				</div>
			)}
		</div>
	);
}

/**
 * Floating Panel rendered inside the xyflow canvas (bottom-right above
 * Controls) — shows current zoom % and provides a quick snap-to-grid toggle.
 */
function ZoomPanel() {
	const { getZoom } = useReactFlow();
	const [zoom, setZoom] = useState(1);
	const snapToGrid    = useBuilderStore((s) => s.snapToGrid);
	const toggleSnapToGrid = useBuilderStore((s) => s.toggleSnapToGrid);

	useEffect(() => {
		const t = setInterval(() => {
			try { setZoom(getZoom()); } catch { /* noop */ }
		}, 250);
		return () => clearInterval(t);
	}, [getZoom]);

	return (
		<Panel position="bottom-right" className="aw-zoom-panel">
			<label className="aw-snap-toggle" title="Snap to grid (G)">
				<input type="checkbox" checked={snapToGrid} onChange={toggleSnapToGrid} />
				<span>Snap</span>
			</label>
			<span className="aw-zoom-readout">{Math.round(zoom * 100)}%</span>
		</Panel>
	);
}

// [2026-07-03 Johnny Chu] GAP-BRANCH-P0 — migrate stale graph data: type=logic→condition, data.condition→data.expression, dedup 'out' edges from condition nodes.
function sanitizeLoadedGraph(nodes, edges) {
	const migratedNodes = (nodes || []).map((n) => {
		if (n.type === 'logic' && n.data?.blockId === 'logic.condition') {
			const newData = { ...n.data };
			if ('condition' in newData && !('expression' in newData)) {
				newData.expression = newData.condition;
				delete newData.condition;
			}
			return { ...n, type: 'condition', data: newData };
		}
		return n;
	});

	const conditionNodeIds = new Set(migratedNodes.filter((n) => n.type === 'condition').map((n) => n.id));
	// For each condition source, collect edges that have an explicit true/false handle.
	const conditionWithBranchEdge = new Set();
	for (const e of (edges || [])) {
		if (conditionNodeIds.has(e.source) && (e.sourceHandle === 'true' || e.sourceHandle === 'false')) {
			conditionWithBranchEdge.add(e.source);
		}
	}
	// Remove duplicate/stale 'out' edges from condition nodes that already have explicit branch edges.
	// Also deduplicate by (source, target, sourceHandle).
	const seen = new Set();
	const migratedEdges = (edges || []).filter((e) => {
		if (conditionNodeIds.has(e.source) && conditionWithBranchEdge.has(e.source)) {
			// Drop edges from condition nodes that have no handle or handle='out' when proper branch edges exist.
			const h = e.sourceHandle;
			if (!h || h === 'out' || h === 'default') return false;
		}
		const key = `${e.source}||${e.target}||${e.sourceHandle ?? ''}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	return { nodes: migratedNodes, edges: migratedEdges };
}

function hydrateTriggerNodeData(nodes, triggerConfig) {
	const cfg = triggerConfig && typeof triggerConfig === 'object' ? triggerConfig : null;
	if (!cfg) return nodes;
	return (nodes || []).map((node) => {
		if (node.type !== 'trigger') return node;
		const data = node.data && typeof node.data === 'object' ? node.data : {};
		// Keep explicit node values first; backfill missing keys from trigger_config.
		return { ...node, data: { ...cfg, ...data } };
	});
}

export default function WorkflowBuilderRoute() {
	const { id } = useParams();
	const location = useLocation();
	const replaceGraph    = useBuilderStore((s) => s.replaceGraph);
	const updateMeta      = useBuilderStore((s) => s.updateMeta);
	const setViewportStore= useBuilderStore((s) => s.setViewport);
	const isNumericId = id && /^\d+$/.test(String(id));
	const [loadState, setLoadState] = useState({
		loading: !!isNumericId,
		error: '',
		loadedId: isNumericId ? '' : 'new',
	});

	useEffect(() => {
		let cancelled = false;
		const isNumeric = id && /^\d+$/.test(String(id));
		if (!isNumeric) {
			// "new" or missing → reset to INITIAL demo so quay lại từ workflow
			// đã load cũ không "kẹt" graph cũ trong store singleton.
			replaceGraph({
				meta:  { ...INITIAL_META },
				nodes: INITIAL_NODES,
				edges: INITIAL_EDGES,
			});
			return;
		}
		// [2026-07-30 Johnny Chu] PHASE-1.22-RUNTIME — keep stale singleton state read-only while the imported workflow is loading.
		setLoadState({ loading: true, error: '', loadedId: '' });
		(async () => {
			try {
				// [2026-07-30 Johnny Chu] PHASE-1.22-RUNTIME — use the fresh import response first; an immediate replica read may lag behind the import write.
				const imported = location.state?.importedWorkflow;
				const res = imported && String(imported.id) === String(id)
					? { row: imported }
					: await workflowsApi.get(id);
				if (cancelled) return;
				const row   = res?.row || res?.data?.row || res;
				const graph = row?.graph || (typeof row?.graph_json === 'string' ? JSON.parse(row.graph_json) : {});
				const trgCfg = row?.trigger_config || (typeof row?.trigger_config_json === 'string' ? JSON.parse(row.trigger_config_json) : {});
				const { nodes: sanitizedNodes, edges: sanitizedEdges } = sanitizeLoadedGraph(
					Array.isArray(graph?.nodes) ? graph.nodes : [],
					Array.isArray(graph?.edges) ? graph.edges : []
				);
				const hydratedNodes = hydrateTriggerNodeData(sanitizedNodes, trgCfg || {});
				replaceGraph({
					meta: {
						id:        row.id,
						slug:      row.slug || '',
						name:      row.name || 'Workflow',
						desc:      row.description || '',
						enabled:   !!row.enabled,
						tags:      Array.isArray(row.tags_array) ? row.tags_array : [],
						version:   row.version || 1,
						triggerType:   row.trigger_type || '',
						triggerConfig: trgCfg || {},
						debug_breakpoints: row.debug_breakpoints && typeof row.debug_breakpoints === 'object' ? row.debug_breakpoints : {},
						can_edit: !!row.can_edit,
						can_run: row.can_run !== false,
						customer_readonly: !!row.customer_readonly,
					},
					nodes: hydratedNodes,
					edges: sanitizedEdges,
				});
				if (graph?.viewport) setViewportStore(graph.viewport);
				setLoadState({ loading: false, error: '', loadedId: String(id) });
			} catch (e) {
				if (cancelled) return;
				const msg = e instanceof BizCityApiError
					? `[${e.code || e.status}] ${e.message}`
					: (e?.message || 'Lỗi tải workflow');
				setLoadState({ loading: false, error: msg, loadedId: '' });
			}
		})();
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, location.state]);
	const builderReady = !isNumericId || ( !loadState.loading && loadState.loadedId === String(id) );

	return (
		<ReactFlowProvider>
			<div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)' }}>
				{builderReady ? <Toolbar /> : (
					<div style={{ minHeight: 52, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }} />
				)}
				{loadState.loading && (
					<div style={{ padding: 8, fontSize: 12, color: '#64748b', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
						Đang tải workflow #{id}…
					</div>
				)}
				{loadState.error && (
					<div style={{ padding: 8, fontSize: 12, color: '#b91c1c', borderBottom: '1px solid #fecaca', background: '#fef2f2' }}>
						⚠ Tải workflow #{id} lỗi: {loadState.error}
					</div>
				)}
				<div style={{ flex: 1, display: 'flex', position: 'relative', minHeight: 0 }}>
					<Palette />
					<div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
						<Canvas />
						<RunTimeline />
					</div>
					<Inspector />
				</div>
			</div>
			<SettingsDialog />
			<ConfirmDialog />
		</ReactFlowProvider>
	);
}
