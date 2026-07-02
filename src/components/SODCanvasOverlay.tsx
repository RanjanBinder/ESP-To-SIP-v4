import React, { useState } from 'react';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import type { SODViolation } from '../lib/validation/sodValidator';

/**
 * SODCanvasOverlay — draws SOD violations on top of the editor canvas.
 *
 * Rendered inside the canvas <main>, in SCREEN space: each marker is placed at
 * `world · zoom + pan`, so markers track the drawing when you pan/zoom but keep
 * a constant on-screen size (the DOM equivalent of Konva's 1/stageScale trick).
 *
 * Per violation it shows a severity-coloured halo + numbered dot; a pulsing ring
 * and a measured-vs-required callout when the violation is active; and an HTML
 * tooltip on hover. Gradient violations render as a shaded zone band instead.
 */

const RED = '#dc2626';   // V2 (critical)
const AMBER = '#f59e0b'; // V1 (major)

const isGradient = (v: SODViolation) => v.ruleId === 'gradient';

const SODCanvasOverlay: React.FC = () => {
  const { viewport, objects, selectObject } = useEditor();
  const { checkResult, activeViolationId, setActiveViolation } = useSODStore();
  const [hoverId, setHoverId] = useState<string | null>(null);

  if (!checkResult || checkResult.violations.length === 0) return null;

  const { zoom, panX, panY } = viewport;
  const toX = (wx: number) => wx * zoom + panX;
  const toY = (wy: number) => wy * zoom + panY;

  const handleSelect = (v: SODViolation) => {
    setActiveViolation(activeViolationId === v.id ? null : v.id);
    const asset = v.assetId ? objects.find(o => o.id === v.assetId) : null;
    selectObject(asset?.visible ? asset.id : null);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 34 }}>
      {checkResult.violations.map(v => {
        if (v.canvasX == null || v.canvasY == null) return null;
        const isV2 = v.severity === 'V2';
        const color = isV2 ? RED : AMBER;
        const active = activeViolationId === v.id;
        const markerX = isGradient(v) ? v.canvasX : v.canvasX + (v.canvasW ?? 0) / 2;
        const markerY = isGradient(v) ? v.canvasY : v.canvasY + (v.canvasH ?? 0) / 2;
        const sx = toX(markerX);
        const sy = toY(markerY);

        /* ── Gradient / chainage violation → shaded zone band ── */
        if (isGradient(v)) {
          const bandW = Math.max((v.canvasW ?? 120) * zoom, 40);
          return (
            <div key={v.id}>
              <div
                onMouseDown={e => e.stopPropagation()}
                onClick={() => handleSelect(v)}
                onMouseEnter={() => setHoverId(v.id)}
                onMouseLeave={() => setHoverId(cur => (cur === v.id ? null : cur))}
                style={{
                  position: 'absolute',
                  left: sx, top: sy - 26,
                  width: bandW, height: 52,
                  background: 'rgba(245,158,11,0.14)',
                  border: `1.5px ${active ? 'solid' : 'dashed'} ${AMBER}`,
                  borderRadius: 4,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  boxShadow: active ? `0 0 0 3px ${AMBER}44` : undefined,
                }}
              >
                <div style={{ padding: '3px 5px', fontSize: 9, fontWeight: 700, color: '#92400e', lineHeight: 1.3 }}>
                  Gradient violation
                  <div style={{ fontWeight: 500 }}>1:{v.measured} (req {v.required ?? '≤1:400'})</div>
                </div>
              </div>
              {hoverId === v.id && <Tooltip v={v} sx={sx} sy={sy} />}
            </div>
          );
        }

        /* ── Point asset → halo + numbered dot ── */
        return (
          <div key={v.id}>
            {/* Halo behind the asset */}
            <div style={{
              position: 'absolute', left: sx, top: sy,
              width: 40, height: 40, transform: 'translate(-50%, -50%)',
              borderRadius: '50%', background: isV2 ? 'rgba(220,38,38,0.10)' : 'rgba(245,158,11,0.10)',
              border: `1.5px solid ${color}${active ? '' : '66'}`,
            }} />

            {/* Pulsing ring while active */}
            {active && (
              <div style={{
                position: 'absolute', left: sx, top: sy,
                width: 44, height: 44,
                borderRadius: '50%', border: `2px solid ${color}`,
                animation: 'sod-pulse 1.4s ease-out infinite',
              }} />
            )}

            {/* Dot */}
            <div
              onMouseDown={e => e.stopPropagation()}
              onClick={() => handleSelect(v)}
              onMouseEnter={() => setHoverId(v.id)}
              onMouseLeave={() => setHoverId(cur => (cur === v.id ? null : cur))}
              title=""
              style={{
                position: 'absolute', left: sx, top: sy,
                width: 18, height: 18, transform: 'translate(-50%, -50%)',
                borderRadius: '50%', background: color,
                border: '2px solid #fff',
                boxShadow: `0 0 0 1px ${color}, 0 2px 6px rgba(0,0,0,0.28)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 800,
                cursor: 'pointer', pointerEvents: 'auto',
              }}
            >
              {isV2 ? '2' : '1'}
            </div>

            {/* Measured-vs-required callout while active */}
            {active && <Callout v={v} sx={sx} sy={sy} color={color} />}

            {/* Hover tooltip */}
            {hoverId === v.id && <Tooltip v={v} sx={sx} sy={sy} />}
          </div>
        );
      })}
    </div>
  );
};

/* ── Active callout: leader line + measured / required ───────────────── */
const Callout: React.FC<{ v: SODViolation; sx: number; sy: number; color: string }> =
  ({ v, sx, sy, color }) => (
  <div style={{
    position: 'absolute', left: sx + 14, top: sy - 30,
    display: 'flex', alignItems: 'center', pointerEvents: 'none',
  }}>
    <div style={{ width: 20, height: 1, background: '#374151' }} />
    <div style={{
      background: '#fff', border: `1px solid ${color}`, borderRadius: 4,
      padding: '4px 7px', boxShadow: '0 2px 8px rgba(0,0,0,0.14)', whiteSpace: 'nowrap',
    }}>
      <div style={{ fontSize: 8.5, fontFamily: 'monospace', color: '#9ca3af' }}>{v.ruleCode}</div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color }}>
        {v.measured}{v.unit ?? ''}
      </div>
      {v.required && (
        <div style={{ fontSize: 9.5, color: '#15803d' }}>req {v.required}</div>
      )}
    </div>
  </div>
);

/* ── Hover tooltip (dark) ────────────────────────────────────────────── */
const Tooltip: React.FC<{ v: SODViolation; sx: number; sy: number }> = ({ v, sx, sy }) => {
  const isV2 = v.severity === 'V2';
  const accent = isV2 ? '#fca5a5' : '#fcd34d';
  return (
    <div style={{
      position: 'absolute',
      left: sx + 16, top: Math.max(sy - 64, 4),
      width: 190, background: '#111827', color: '#f9fafb',
      borderRadius: 6, padding: '8px 10px', fontSize: 11, lineHeight: 1.4,
      pointerEvents: 'none', zIndex: 1000, boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontWeight: 600, fontSize: 12, color: accent, marginBottom: 2 }}>
        {v.severity} · {v.assetName ?? v.title}
      </div>
      {v.ruleCode && (
        <div style={{ fontFamily: 'monospace', fontSize: 9, color: '#9ca3af', marginBottom: 3 }}>
          {v.ruleCode}
        </div>
      )}
      <div style={{ marginBottom: 6, color: '#d1d5db' }}>{v.detail}</div>
      {v.measured != null && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
          <div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>Measured</div>
            <div style={{ fontWeight: 700, color: accent }}>{v.measured}{v.unit ?? ''}</div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#6b7280' }}>Required</div>
            <div style={{ fontWeight: 700, color: '#6ee7b7' }}>{v.required}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SODCanvasOverlay;
