import React from 'react';
import { ShapeObject, ArcObject, StrokeStyle } from '../store/editorStore';

/** Renders a shape object in world space. Pure render — selection/move/hover
 *  are handled by the canvas via the `data-object-id` hit-test attribute. */

const cssBorderStyle = (s: StrokeStyle) => (s === 'dashed' ? 'dashed' : s === 'dotted' ? 'dotted' : 'solid');
const svgDash = (s: StrokeStyle, w: number) =>
  s === 'dashed' ? `${w * 3} ${w * 2}` : s === 'dotted' ? `${w} ${w * 1.6}` : undefined;

const toRad = (d: number) => d * Math.PI / 180;

const ShapeView: React.FC<{
  shape: ShapeObject;
  selected: boolean;
  hovered: boolean;
}> = ({ shape, selected, hovered }) => {
  if (!shape.visible) return null;

  const transform = `rotate(${shape.rotation}deg) scale(${(shape.scale ?? 100) / 100})`;

  /* ── Arc (SVG) ── */
  if (shape.type === 'arc') {
    const arc = shape as ArcObject;
    const r = arc.width / 2;
    const cx = arc.x + r;
    const cy = arc.y + r;
    const { startAngle, endAngle, stroke, strokeWidth, strokeStyle } = arc;
    const pad = Math.max(8, strokeWidth);

    // Canvas point for an angle: +x right, +y up in math → -sin for Y-down screen
    const ptX = (a: number) => cx + r * Math.cos(toRad(a));
    const ptY = (a: number) => cy - r * Math.sin(toRad(a));

    const sweep = ((endAngle - startAngle) + 360) % 360;
    const isCircle = sweep < 0.001;

    // SVG viewport: full circle bbox + padding
    const vLeft = cx - r - pad;
    const vTop  = cy - r - pad;
    const vW    = 2 * r + pad * 2;
    const vH    = 2 * r + pad * 2;

    // Coordinates relative to SVG viewport top-left
    const rCx  = cx - vLeft;
    const rCy  = cy - vTop;
    const rSx  = ptX(startAngle) - vLeft;
    const rSy  = ptY(startAngle) - vTop;
    const rEx  = ptX(endAngle)   - vLeft;
    const rEy  = ptY(endAngle)   - vTop;
    const largeArc = sweep > 180 ? 1 : 0;

    // Full-circle uses two half-arcs (SVG can't draw A start=end)
    const d = isCircle
      ? `M ${rCx - r} ${rCy} a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 ${-2 * r} 0`
      : `M ${rSx} ${rSy} A ${r} ${r} 0 ${largeArc} 1 ${rEx} ${rEy}`;

    return (
      <svg
        data-object-id={arc.id}
        style={{
          position: 'absolute', left: vLeft, top: vTop,
          width: vW, height: vH,
          overflow: 'visible', cursor: 'move',
          transform, transformOrigin: 'top left',
        }}
      >
        {/* fat transparent hit area */}
        <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(strokeWidth, 12)} />
        {hovered && !selected && (
          <path d={d} fill="none"
            stroke="#93c5fd"
            strokeWidth={strokeWidth + 3}
            strokeLinecap="round"
            opacity={0.35}
          />
        )}
        <path d={d} fill="none"
          stroke={stroke} strokeWidth={strokeWidth}
          strokeDasharray={svgDash(strokeStyle, strokeWidth)}
          strokeLinecap="round"
        />
      </svg>
    );
  }

  /* ── Line (SVG, with a fat transparent hit area) ── */
  if (shape.type === 'line') {
    const { x, y, dx, dy, stroke, strokeWidth, strokeStyle } = shape;
    const pad = Math.max(6, strokeWidth);
    const minX = Math.min(0, dx), minY = Math.min(0, dy);
    const w = Math.abs(dx), h = Math.abs(dy);
    const x1 = pad - minX, y1 = pad - minY;
    const x2 = x1 + dx, y2 = y1 + dy;
    return (
      <svg
        data-object-id={shape.id}
        width={w + pad * 2}
        height={h + pad * 2}
        style={{
          position: 'absolute', left: x + minX - pad, top: y + minY - pad,
          overflow: 'visible', cursor: 'move',
          transform, transformOrigin: 'top left',
        }}
      >
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={Math.max(strokeWidth, 12)} strokeLinecap="round" />
        {hovered && !selected && (
          <line x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#93c5fd" strokeWidth={strokeWidth + 3}
            strokeLinecap="round" opacity={0.35} />
        )}
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={stroke} strokeWidth={strokeWidth}
          strokeDasharray={svgDash(strokeStyle, strokeWidth)} strokeLinecap="round" />
      </svg>
    );
  }

  /* ── Rectangle / ellipse (div bbox) ── */
  const { x, y, width, height, fill, stroke, strokeWidth, strokeStyle } = shape;
  const hoverRing = (!selected && hovered) ? '0 0 0 1.5px #93c5fd' : undefined;
  return (
    <div
      data-object-id={shape.id}
      style={{
        position: 'absolute', left: x, top: y, width, height,
        background: fill,
        border: `${strokeWidth}px ${cssBorderStyle(strokeStyle)} ${stroke}`,
        borderRadius: shape.type === 'ellipse' ? '50%' : shape.cornerRadius,
        boxShadow: hoverRing,
        transform, transformOrigin: 'top left',
        boxSizing: 'border-box',
        cursor: 'move',
      }}
    />
  );
};

export default ShapeView;
