import React, { useEffect } from 'react';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import { formatGradient } from '../lib/validation/gradientValidator';
import { boundsOf } from '../lib/track/sceneQueries';
import type { GradientValue } from '../types/scene';

export default function ValidationCanvasOverlay() {
  const { objects, viewport, selectedObjectIds, getLayer } = useEditor();
  const { selectedValidation: issue, setSelectedValidation, setActiveViolation } = useSODStore();
  const assets = objects.filter(o => issue?.assetIds?.includes(o.id));
  useEffect(() => {
    if (issue?.assetIds?.length && assets.length && !selectedObjectIds.some(id => issue.assetIds!.includes(id))) {
      setSelectedValidation(null); setActiveViolation(null);
    }
  }, [issue, assets.length, selectedObjectIds, setSelectedValidation, setActiveViolation]);
  if (!issue) return null;
  const { zoom, panX, panY } = viewport;
  const x = (v: number) => v * zoom + panX, y = (v: number) => v * zoom + panY;
  const meta = issue.metadata;
  const points = assets.map(o => {
    const b = boundsOf(o);
    return { id: o.id, name: o.name, x: b.x + b.width / 2, y: b.y + b.height / 2, w: Math.max(b.width * zoom, 20), h: Math.max(b.height * zoom, 20), hidden: !o.visible || !getLayer(o.layerId)?.visible };
  });
  if (!points.length && typeof meta?.canvasX === 'number' && typeof meta.canvasY === 'number') points.push({ id: issue.id, name: issue.ruleId, x: meta.canvasX, y: meta.canvasY, w: 30, h: 30, hidden: false });
  const gradient = issue.validationType === 'gradient_continuity';
  return <svg aria-label="Validation highlights" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 35 }}>
    {gradient && points.length === 2 && <line x1={x(points[0].x)} y1={y(points[0].y)} x2={x(points[1].x)} y2={y(points[1].y)} stroke="#6366f1" strokeWidth={8} opacity={0.3} />}
    {points.map((p, i) => <g key={p.id}>
      <rect x={x(p.x) - p.w / 2 - 6} y={y(p.y) - p.h / 2 - 6} width={p.w + 12} height={p.h + 12} fill="#6366f1" fillOpacity={0.1} stroke="#6366f1" strokeWidth={2} strokeDasharray={p.hidden ? '5 3' : undefined} rx={6} />
      <text x={x(p.x)} y={y(p.y) - p.h / 2 - 12} fill="#4338ca" stroke="white" strokeWidth={3} paintOrder="stroke" fontSize={12} textAnchor="middle">{p.name}{p.hidden ? ' (hidden asset)' : ''}{gradient ? ` ${i === 0 ? 'Right' : 'Left'}: ${formatGradient((i === 0 ? meta?.outgoingGradient : meta?.incomingGradient) as GradientValue | undefined)}` : ''}</text>
    </g>)}
  </svg>;
}
