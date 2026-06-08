import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Unlock, Square, FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from 'lucide-react';
import {
  useEditor, flattenLayers, ShapeObject, StrokeStyle, ArcObject,
} from '../store/editorStore';
import {
  PropertySection, PropertyRow, NumberInput, ColorValueInput,
  PropertySelect, IconButton,
} from './ui';

const fmt = (n: number) => `${Math.round(n * 100) / 100}`;
const fmtC = (n: number) => `${Math.round(n * 10) / 10}`;
const parse = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;
const norm = (a: number) => ((a % 360) + 360) % 360;

const STROKE_STYLES = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

function computeLength(obj: ShapeObject): number | null {
  if (obj.type === 'line') return Math.sqrt(obj.dx * obj.dx + obj.dy * obj.dy);
  if (obj.type === 'arc') {
    const r = obj.width / 2;
    const sweep = norm(obj.endAngle - obj.startAngle) || 360;
    return (sweep * Math.PI / 180) * r;
  }
  if (obj.type === 'rectangle') return 2 * (obj.width + obj.height);
  if (obj.type === 'ellipse') {
    const a = obj.width / 2, b = obj.height / 2;
    const h = ((a - b) ** 2) / ((a + b) ** 2);
    return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
  }
  return null;
}

function computeArea(obj: ShapeObject): number | null {
  if (obj.type === 'rectangle') return obj.width * obj.height;
  if (obj.type === 'ellipse') return Math.PI * (obj.width / 2) * (obj.height / 2);
  if (obj.type === 'arc') {
    const r = obj.width / 2;
    const sweep = norm(obj.endAngle - obj.startAngle);
    return sweep < 0.001 ? Math.PI * r * r : null; // only for full circle
  }
  return null;
}

const ShapePropertiesPanel: React.FC<{ obj: ShapeObject }> = ({ obj }) => {
  const { updateObject, layers } = useEditor();
  const [arLocked, setArLocked] = useState(false);
  const layerOptions = flattenLayers(layers).map(l => ({ value: l.id, label: l.name }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (patch: any) => updateObject(obj.id, patch);

  const kindLabel = obj.type.charAt(0).toUpperCase() + obj.type.slice(1);
  const rotation = obj.rotation ?? 0;
  const scale = obj.scale ?? 100;

  const mirrorH = () => {
    if (obj.type === 'line') set({ x: obj.x + obj.dx, dx: -obj.dx });
    else if (obj.type === 'arc') {
      const arc = obj as ArcObject;
      set({ startAngle: norm(180 - arc.endAngle), endAngle: norm(180 - arc.startAngle) });
    }
  };

  const mirrorV = () => {
    if (obj.type === 'line') set({ y: obj.y + obj.dy, dy: -obj.dy });
    else if (obj.type === 'arc') {
      const arc = obj as ArcObject;
      set({ startAngle: norm(-arc.endAngle), endAngle: norm(-arc.startAngle) });
    }
  };

  const length = computeLength(obj);
  const area = computeArea(obj);

  const lengthLabel =
    obj.type === 'line' ? 'Length' :
    obj.type === 'arc' ? 'Arc length' :
    'Perimeter';

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff' }}>

      {/* ── Selection ── */}
      <PropertySection title={`Selection (${kindLabel})`}>
        <PropertyRow label="Name">
          <input
            value={obj.name}
            onChange={e => set({ name: e.target.value })}
            style={{
              width: '100%', minWidth: 0, height: 32, boxSizing: 'border-box',
              background: '#f4f4f5', border: '1px solid transparent', borderRadius: 8,
              padding: '0 9px', fontSize: 13, color: '#111827', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#f4f4f5'; }}
          />
        </PropertyRow>

        <PropertyRow label="Layer">
          <PropertySelect value={obj.layerId} options={layerOptions} onChange={v => set({ layerId: v })} />
        </PropertyRow>

        <PropertyRow label="Status" noBorder>
          <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 2, gap: 1, height: 32 }}>
            <IconButton title={obj.locked ? 'Unlock' : 'Lock'} active={obj.locked} onClick={() => set({ locked: !obj.locked })}>
              {obj.locked ? <Lock size={13} strokeWidth={1.75} /> : <Unlock size={13} strokeWidth={1.75} />}
            </IconButton>
            <IconButton title={obj.visible ? 'Hide' : 'Show'} active={obj.visible} onClick={() => set({ visible: !obj.visible })}>
              {obj.visible ? <Eye size={13} strokeWidth={1.75} /> : <EyeOff size={13} strokeWidth={1.75} />}
            </IconButton>
          </div>
        </PropertyRow>
      </PropertySection>

      {/* ── Modify ── */}
      <PropertySection title="Modify">

        {/* Transform action buttons */}
        <PropertyRow label="Modify">
          <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 2, gap: 1, height: 32 }}>
            <IconButton title="Mirror Horizontal" onClick={mirrorH}>
              <FlipHorizontal size={13} strokeWidth={1.75} />
            </IconButton>
            <IconButton title="Mirror Vertical" onClick={mirrorV}>
              <FlipVertical size={13} strokeWidth={1.75} />
            </IconButton>
            <IconButton title="Rotate CCW 90°" onClick={() => set({ rotation: norm(rotation - 90) })}>
              <RotateCcw size={13} strokeWidth={1.75} />
            </IconButton>
            <IconButton title="Rotate CW 90°" onClick={() => set({ rotation: norm(rotation + 90) })}>
              <RotateCw size={13} strokeWidth={1.75} />
            </IconButton>
          </div>
        </PropertyRow>

        {/* X, Y */}
        <PropertyRow label="X, Y">
          <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
            <NumberInput value={fmt(obj.x)} onChange={v => set({ x: parse(v) })} />
            <NumberInput value={fmt(obj.y)} onChange={v => set({ y: parse(v) })} />
          </div>
        </PropertyRow>

        {/* W, H or Δx, Δy */}
        {obj.type === 'line' ? (
          <PropertyRow label="Δx, Δy">
            <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
              <NumberInput value={fmt(obj.dx)} onChange={v => { const dx = parse(v); set({ dx, width: Math.abs(dx) }); }} />
              <NumberInput value={fmt(obj.dy)} onChange={v => { const dy = parse(v); set({ dy, height: Math.abs(dy) }); }} />
            </div>
          </PropertyRow>
        ) : (
          <PropertyRow label="W, H">
            <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0, alignItems: 'center' }}>
              <button
                title={arLocked ? 'Unlock aspect ratio' : 'Lock aspect ratio'}
                onClick={() => setArLocked(v => !v)}
                style={{
                  flexShrink: 0, width: 22, height: 22,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: arLocked ? '#2563eb' : '#9ca3af', padding: 0,
                }}
              >
                {arLocked ? <Lock size={11} strokeWidth={1.75} /> : <Unlock size={11} strokeWidth={1.75} />}
              </button>
              <NumberInput value={fmt(obj.width)} onChange={v => {
                const w = parse(v);
                set(arLocked && obj.height > 0
                  ? { width: w, height: w * obj.height / obj.width }
                  : { width: w });
              }} />
              <NumberInput value={fmt(obj.height)} onChange={v => {
                const h = parse(v);
                set(arLocked && obj.width > 0
                  ? { height: h, width: h * obj.width / obj.height }
                  : { height: h });
              }} />
            </div>
          </PropertyRow>
        )}

        {/* Rotation + Scale */}
        <PropertyRow label="Transform" noBorder>
          <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <NumberInput value={fmt(rotation)} onChange={v => set({ rotation: parse(v) })} />
              <span style={{
                position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: '#9ca3af', pointerEvents: 'none',
              }}>°</span>
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <NumberInput value={fmt(scale)} onChange={v => set({ scale: Math.max(1, parse(v)) })} />
              <span style={{
                position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                fontSize: 11, color: '#9ca3af', pointerEvents: 'none',
              }}>%</span>
            </div>
          </div>
        </PropertyRow>
      </PropertySection>

      {/* ── Shapes ── */}
      <PropertySection title="Shapes">
        <PropertyRow label="Stroke">
          <ColorValueInput value={obj.stroke} onChange={v => set({ stroke: v })} />
        </PropertyRow>

        <PropertyRow label="Stroke width">
          <NumberInput value={fmt(obj.strokeWidth)} onChange={v => set({ strokeWidth: Math.max(0, parse(v)) })} />
        </PropertyRow>

        <PropertyRow label="Stroke style" noBorder={obj.type === 'line' || obj.type === 'arc'}>
          <PropertySelect
            value={obj.strokeStyle}
            options={STROKE_STYLES}
            onChange={v => set({ strokeStyle: v as StrokeStyle })}
          />
        </PropertyRow>

        {(obj.type === 'rectangle' || obj.type === 'ellipse') && (
          <PropertyRow label="Fill" noBorder={obj.type !== 'rectangle'}>
            <ColorValueInput value={obj.fill} onChange={v => set({ fill: v })} />
          </PropertyRow>
        )}

        {obj.type === 'rectangle' && (
          <PropertyRow label="Corner" noBorder>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <Square size={13} color="#9ca3af" strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <NumberInput value={fmt(obj.cornerRadius)} onChange={v => set({ cornerRadius: Math.max(0, parse(v)) })} />
            </div>
          </PropertyRow>
        )}
      </PropertySection>

      {/* ── Properties (computed) ── */}
      {(length !== null || area !== null) && (
        <PropertySection title="Properties">
          {length !== null && (
            <PropertyRow label={lengthLabel} noBorder={area === null}>
              <span style={{ fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {fmtC(length)} px
              </span>
            </PropertyRow>
          )}
          {area !== null && (
            <PropertyRow label="Area" noBorder>
              <span style={{ fontSize: 13, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                {fmtC(area)} px²
              </span>
            </PropertyRow>
          )}
        </PropertySection>
      )}
    </div>
  );
};

export default ShapePropertiesPanel;
