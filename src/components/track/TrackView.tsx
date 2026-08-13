/**
 * TrackView.tsx — renders one Track asset in world space.
 *
 * Pure render, like every other object view: selection, hover and move are
 * handled by the canvas through the `data-object-id` hit-test attribute, so the
 * whole multi-segment alignment is one hit target = one asset (§2).
 *
 * Appearance comes from the Styles layer via the object's `styleId`, never from
 * hard-coded per-element values (§1).
 */

import React from 'react';
import type { TrackObject } from '../../types/scene';
import { useEditor } from '../../store/editorStore';
import { segmentsToPathD, segStart, segEnd, totalLength, pointAtDistance } from '../../lib/track/geometry';
import { resolveTrackStyle, dashArrayFor, directionGlyph } from '../../lib/track/trackStyles';

const TrackView: React.FC<{
  track: TrackObject;
  selected: boolean;
  hovered: boolean;
}> = ({ track, selected, hovered }) => {
  const { styles } = useEditor();
  if (!track.visible || !track.geometry.length) return null;

  const style = resolveTrackStyle(track.styleId, track.track.workStatus, styles);
  const width = track.strokeWidth || 2;
  const pad = Math.max(10, width * 4);

  // Geometry is stored relative to (x, y); render it inside an SVG anchored at
  // the bbox corner with padding for the stroke and the direction label.
  const d = segmentsToPathD(track.geometry, { x: -pad, y: -pad });
  const first = track.geometry[0];
  const last = track.geometry[track.geometry.length - 1];
  const start = segStart(first);
  const end = segEnd(last);

  // Direction marker at the alignment's arc-length midpoint — on the track
  // itself, not at the midpoint of the straight line between its ends, which
  // would float off the geometry for an L-shaped or curved alignment.
  const midPoint = pointAtDistance(track.geometry, totalLength(track.geometry) / 2) ?? start;
  const mid = { x: midPoint.x + pad, y: midPoint.y + pad };
  const glyph = directionGlyph(track.track.direction);
  const label = `${glyph} ${track.track.direction}`;

  return (
    <svg
      data-object-id={track.id}
      width={track.width + pad * 2}
      height={track.height + pad * 2}
      style={{
        position: 'absolute',
        left: track.x - pad,
        top: track.y - pad,
        overflow: 'visible',
        cursor: 'move',
        transform: `rotate(${track.rotation}deg) scale(${(track.scale ?? 100) / 100})`,
        transformOrigin: 'top left',
      }}
    >
      {/* Fat transparent hit area — the whole asset selects as one object. */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={Math.max(width, 14)} strokeLinecap="round" />

      {hovered && !selected && (
        <path d={d} fill="none" stroke="#93c5fd" strokeWidth={width + 4} strokeLinecap="round" opacity={0.4} />
      )}
      {selected && (
        <path d={d} fill="none" stroke="#3b82f6" strokeWidth={width + 5} strokeLinecap="round" opacity={0.28} />
      )}

      <path
        d={d}
        fill="none"
        stroke={style.color}
        strokeWidth={width}
        strokeDasharray={dashArrayFor(style.strokeStyle, width)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End ticks so the extent of the asset is readable at any zoom. */}
      <circle cx={start.x + pad} cy={start.y + pad} r={width * 1.4} fill={style.color} />
      <circle cx={end.x + pad} cy={end.y + pad} r={width * 1.4} fill={style.color} />

      {/* Direction: arrow glyph + text, per §2 "rendered as arrow + text". */}
      <g transform={`translate(${mid.x},${mid.y - 10})`}>
        <rect
          x={-(label.length * 3.5 + 8)} y={-9}
          width={label.length * 7 + 16} height={18} rx={4}
          fill="#ffffff" stroke={style.color} strokeWidth={0.8} opacity={0.94}
        />
        <text
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight={700} fill={style.color}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {label}
        </text>
      </g>

      <title>
        {`${track.track.displayName || track.track.trackName} · ${track.track.trackType} · ` +
         `${track.track.workStatus} · ${totalLength(track.geometry).toFixed(1)} m`}
      </title>
    </svg>
  );
};

export default TrackView;
