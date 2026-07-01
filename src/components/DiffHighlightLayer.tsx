import React from 'react';
import { useEditor } from '../store/editorStore';
import { useCompareStore } from '../store/compareStore';
import type { AssetChange, ChangeType } from '../lib/versionDiff/diffTypes';
import { objectCenter } from '../lib/versionDiff/computeDiff';

/**
 * DiffHighlightLayer — colour-coded version-compare highlights on the canvas.
 *
 * Like SODCanvasOverlay, it renders in SCREEN space inside the canvas <main>:
 * each marker is placed at `world · zoom + pan`, so highlights track the drawing
 * on pan/zoom. Green = added, red = removed (dashed), amber = moved (with an
 * arrow from the old position), blue = modified. Unchanged assets aren't drawn.
 */

const COLORS: Record<Exclude<ChangeType, 'unchanged'>, { fill: string; stroke: string; badge: string; letter: string }> = {
  added:    { fill: 'rgba(22,163,74,0.14)', stroke: '#16a34a', badge: '#16a34a', letter: 'A' },
  removed:  { fill: 'rgba(220,38,38,0.14)', stroke: '#dc2626', badge: '#dc2626', letter: 'R' },
  moved:    { fill: 'rgba(217,119,6,0.14)', stroke: '#d97706', badge: '#d97706', letter: 'M' },
  modified: { fill: 'rgba(2,132,199,0.14)', stroke: '#0284c7', badge: '#0284c7', letter: 'm' },
};

const DiffHighlightLayer: React.FC = () => {
  const { viewport } = useEditor();
  const { isComparing, diffResult, activeChangeId, setActiveChange } = useCompareStore();

  if (!isComparing || !diffResult) return null;

  const { zoom, panX, panY } = viewport;
  const toX = (wx: number) => wx * zoom + panX;
  const toY = (wy: number) => wy * zoom + panY;

  const visible = diffResult.changes.filter(c => c.changeType !== 'unchanged') as
    (AssetChange & { changeType: Exclude<ChangeType, 'unchanged'> })[];

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 34 }}>
      {/* Move arrows (old → new centre), drawn beneath the badges */}
      <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <defs>
          <marker id="diff-arrow" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.moved.stroke} />
          </marker>
        </defs>
        {visible.map(c => {
          if (c.changeType !== 'moved' || !c.oldObject) return null;
          const from = objectCenter(c.oldObject);
          return (
            <line
              key={`arr-${c.changeId}`}
              x1={toX(from.x)} y1={toY(from.y)}
              x2={toX(c.canvasX)} y2={toY(c.canvasY)}
              stroke={COLORS.moved.stroke} strokeWidth={1.5}
              strokeDasharray="5 4" opacity={0.85}
              markerEnd="url(#diff-arrow)"
            />
          );
        })}
      </svg>

      {visible.map(c => {
        const col = COLORS[c.changeType];
        const active = activeChangeId === c.changeId;
        const sx = toX(c.canvasX);
        const sy = toY(c.canvasY);
        const w = Math.max(c.canvasHalfW * 2 * zoom, 20) + 12;
        const h = Math.max(c.canvasHalfH * 2 * zoom, 20) + 12;
        const name = c.newObject?.name ?? c.oldObject?.name ?? '';

        return (
          <div key={c.changeId}>
            {/* Highlight box, centred on the asset */}
            <div
              onMouseDown={e => e.stopPropagation()}
              onClick={() => setActiveChange(active ? null : c.changeId)}
              style={{
                position: 'absolute',
                left: sx, top: sy,
                width: w, height: h,
                transform: 'translate(-50%, -50%)',
                background: active ? col.fill.replace('0.14', '0.30') : col.fill,
                border: `${active ? 2 : 1.5}px ${c.changeType === 'removed' ? 'dashed' : 'solid'} ${col.stroke}`,
                borderRadius: 5,
                boxShadow: active ? `0 0 0 3px ${col.stroke}44` : undefined,
                cursor: 'pointer', pointerEvents: 'auto',
              }}
            />

            {/* Badge dot (top-right of the box) */}
            <div style={{
              position: 'absolute',
              left: sx + w / 2, top: sy - h / 2,
              transform: 'translate(-50%, -50%)',
              width: 16, height: 16, borderRadius: '50%',
              background: col.badge, border: '1.5px solid #fff',
              boxShadow: `0 1px 3px rgba(0,0,0,0.28)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 10, fontWeight: 800,
              pointerEvents: 'none',
            }}>
              {col.letter}
            </div>

            {/* Active callout: leader + label + description */}
            {active && (
              <div style={{
                position: 'absolute',
                left: sx + w / 2 + 10, top: sy - h / 2 - 6,
                display: 'flex', alignItems: 'flex-start', pointerEvents: 'none',
              }}>
                <div style={{ width: 16, height: 1, background: col.stroke, marginTop: 12 }} />
                <div style={{
                  background: '#fff', border: `1px solid ${col.stroke}`, borderRadius: 5,
                  padding: '5px 8px', boxShadow: '0 2px 10px rgba(0,0,0,0.16)',
                  maxWidth: 190,
                }}>
                  <div style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: '0.05em', color: col.stroke, textTransform: 'uppercase' }}>
                    {c.changeType}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#111827' }}>{name}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.35, marginTop: 1 }}>
                    {c.description}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DiffHighlightLayer;
