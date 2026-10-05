/**
 * Helper line overlay — renders two thin guides (vertical + horizontal) at
 * the flow coordinates passed in. Coordinates are flow-space; the SVG is
 * placed inside the xyflow viewport via a parent transform so it pans/zooms
 * along with the graph.
 */
import { useStore, useViewport } from '@xyflow/react';

export default function HelperLines({ vertical, horizontal }) {
	const [width, height] = useStore((s) => [s.width, s.height]);
	const { x: tx, y: ty, zoom } = useViewport();

	if (vertical == null && horizontal == null) return null;

	// Convert flow coords to screen coords.
	const vScreen = vertical   != null ? vertical   * zoom + tx : null;
	const hScreen = horizontal != null ? horizontal * zoom + ty : null;

	return (
		<svg
			width={width}
			height={height}
			style={{
				position: 'absolute', top: 0, left: 0,
				pointerEvents: 'none', zIndex: 10,
			}}
		>
			{vScreen != null ? (
				<line x1={vScreen} y1={0} x2={vScreen} y2={height} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" />
			) : null}
			{hScreen != null ? (
				<line x1={0} y1={hScreen} x2={width} y2={hScreen} stroke="#ec4899" strokeWidth={1} strokeDasharray="4 4" />
			) : null}
		</svg>
	);
}
