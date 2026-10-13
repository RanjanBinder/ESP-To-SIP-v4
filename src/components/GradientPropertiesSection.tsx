import React from 'react';
import type { CanvasObject, GradientValue, SodAssetMeta } from '../types/scene';
import { useEditor } from '../store/editorStore';
import { PropertySection, PropertyRow } from './ui';

const inputStyle: React.CSSProperties = { width: '100%', minWidth: 0, height: 32, background: '#f4f4f5', border: '1px solid #e5e7eb', borderRadius: 8, padding: '0 8px', fontSize: 12, color: '#111827', boxSizing: 'border-box' };
/** Uses normal undoable object edits in the existing Properties experience. */
export default function GradientPropertiesSection({ obj }: { obj: CanvasObject }) {
  const { updateObject } = useEditor();
  const meta: SodAssetMeta = obj.sod ?? { assetKind: 'Gradient' };
  const edit = (patch: Partial<SodAssetMeta>) => updateObject(obj.id, { sod: { ...meta, ...patch } });
  const side = (key: 'leftGradient' | 'rightGradient', label: string) => {
    const g = meta[key];
    return <PropertyRow label={label}>
      <select aria-label={`${label} direction`} style={inputStyle} value={g?.direction ?? ''} onChange={e => edit({ [key]: e.target.value ? { ...g, direction: e.target.value as GradientValue['direction'] } : undefined })}>
        <option value="">Missing</option><option value="level">Level</option><option value="rising">Rising</option><option value="falling">Falling</option>
      </select>
      {g && g.direction !== 'level' && <input aria-label={`${label} denominator`} style={inputStyle} type="number" min="1" placeholder="1 in…" value={g.denominator ?? ''} onChange={e => edit({ [key]: { ...g, denominator: e.target.value === '' ? undefined : Number(e.target.value) } })} />}
    </PropertyRow>;
  };
  return <div style={{ flexShrink: 0, maxHeight: '45%', overflowY: 'auto' }}><PropertySection title="Gradient continuity">
    <fieldset disabled={obj.locked || meta.sourceKind === 'pdf'} style={{ border: 0, margin: 0, padding: 0 }}>
      <PropertyRow label="Track ID"><input aria-label="Gradient track ID" style={inputStyle} value={meta.trackId ?? ''} onChange={e => edit({ trackId: e.target.value })} /></PropertyRow>
      <PropertyRow label="Track name"><input aria-label="Gradient track name" style={inputStyle} value={meta.trackName ?? ''} onChange={e => edit({ trackName: e.target.value })} /></PropertyRow>
      <PropertyRow label="Chainage (m)"><input aria-label="Gradient chainage metres" style={inputStyle} type="number" value={meta.chainage ?? ''} onChange={e => edit({ chainage: e.target.value === '' ? undefined : Number(e.target.value) })} /></PropertyRow>
      {side('leftGradient', 'Left / in')}{side('rightGradient', 'Right / out')}
      <p style={{ padding: '0 8px', margin: '6px 0', fontSize: 11, color: '#6b7280' }}>Directions follow increasing chainage. Return to Validation and rerun after editing.</p>
    </fieldset>
  </PropertySection></div>;
}

export function SODMeasurementsSection({ obj }: { obj: CanvasObject }) {
  const { updateObject } = useEditor();
  const meta = obj.sod!;
  const fields: { key: keyof SodAssetMeta; label: string }[] = [];
  if (meta.assetKind === 'Track') fields.push({ key: 'spacingToAdjacentTrack', label: 'Spacing (mm)' });
  if (meta.assetKind === 'Platform' || meta.assetKind === 'Structure') {
    fields.push({ key: 'clearanceFromTrackCentre', label: 'Offset (mm)' });
    if (meta.subtype === 'goods' || meta.subtype === 'fob') fields.push({ key: 'heightAboveRailLevel', label: 'Height (mm)' });
  }
  if (meta.assetKind === 'Gradient') fields.push({ key: 'gradientDenominator', label: 'SOD 1 in' });
  return <div style={{ flexShrink: 0 }}><PropertySection title="SOD measurements">
    <fieldset disabled={obj.locked || meta.sourceKind === 'pdf'} style={{ border: 0, margin: 0, padding: 0 }}>{fields.map(({ key, label }) => <PropertyRow key={key} label={label}>
      <input aria-label={`SOD ${key}`} style={inputStyle} type="number" value={meta[key] as number ?? ''} onChange={e => updateObject(obj.id, { sod: { ...meta, [key]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
    </PropertyRow>)}</fieldset>
  </PropertySection></div>;
}
