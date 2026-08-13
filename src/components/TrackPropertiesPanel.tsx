/**
 * TrackPropertiesPanel.tsx — the right-hand panel for a selected Track asset (§2).
 *
 * Behaviour from §8.6:
 *  - editing a property re-renders the asset immediately — there is no Apply
 *    button; each keystroke patches the object through the store;
 *  - derived values (Display Name, chainages, locations) carry a small icon and
 *    stay overridable — typing in the field clears the derived mark;
 *  - only Track Name and Direction are required; everything else shows as a
 *    soft "incomplete" count rather than a blocking prompt.
 *
 * Built from the shared components/ui kit so it matches every other panel.
 */

import React from 'react';
import { Wand2, Link2, Ruler, TriangleAlert } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import type { TrackObject } from '../types/scene';
import type { TrackProperties } from '../types/track';
import {
  TRACK_TYPES, TRACK_DIRECTIONS, TRACK_WORK_STATUSES, REQUIRED_TRACK_FIELDS,
} from '../types/track';
import { withProperties, incompleteFields, trackLength } from '../lib/track/trackAsset';
import { resolveTrackStyle, directionGlyph } from '../lib/track/trackStyles';
import { PropertySection, PropertyRow, PropertySelect, NumberInput } from './ui';

/* ── Small helpers ───────────────────────────────────────────────── */

/** A text field with the panel's standard look, plus a derived-value marker. */
const TextField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}> = ({ value, onChange, placeholder, invalid }) => (
  <input
    value={value}
    placeholder={placeholder}
    onChange={e => onChange(e.target.value)}
    style={{
      width: '100%', minWidth: 0, height: 32,
      background: '#f4f4f5',
      border: `1px solid ${invalid ? '#fca5a5' : 'transparent'}`,
      borderRadius: 8,
      padding: '0 8px', fontSize: 13, color: '#111827',
      outline: 'none', boxSizing: 'border-box',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}
    onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
    onBlur={e => {
      e.currentTarget.style.borderColor = invalid ? '#fca5a5' : 'transparent';
      e.currentTarget.style.background = '#f4f4f5';
    }}
  />
);

/** The "this value was derived from the drawing" marker (§8.6). */
const DerivedMark: React.FC<{ title: string }> = ({ title }) => (
  <span title={title} style={{ display: 'flex', flexShrink: 0, color: '#8b5cf6' }}>
    <Wand2 size={12} strokeWidth={2} />
  </span>
);

const Row: React.FC<{
  label: string;
  derived?: boolean;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, derived, required, children }) => (
  <PropertyRow label={required ? `${label} *` : label}>
    {derived && <DerivedMark title="Derived from the drawing — type to override" />}
    {children}
  </PropertyRow>
);

/* ── Panel ───────────────────────────────────────────────────────── */

const TrackPropertiesPanel: React.FC<{ track: TrackObject }> = ({ track }) => {
  const { updateObject, styles } = useEditor();

  const props = track.track;
  const derived = new Set(props.derivedFields);
  const missing = incompleteFields(track);
  const style = resolveTrackStyle(track.styleId, props.workStatus, styles);

  /** Patch a property. Immediate re-render, no Apply button (§8.6). */
  const patch = (updates: Partial<TrackProperties>) => {
    const next = withProperties(track, updates);
    updateObject(track.id, {
      name: next.name,
      track: next.track,
      styleId: next.styleId,
    } as Partial<TrackObject>);
  };

  const isBlank = (v: string) => v.trim() === '';
  const requiredMissing = (field: keyof TrackProperties) =>
    REQUIRED_TRACK_FIELDS.includes(field) && isBlank(String(props[field] ?? ''));

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

      {/* ── Identity ── */}
      <PropertySection title="Track">
        <Row label="Track Name" required>
          <TextField
            value={props.trackName}
            invalid={requiredMissing('trackName')}
            onChange={v => {
              // Display Name keeps following Track Name until the user overrides
              // it, and stays marked as derived while it does.
              const followDisplay = derived.has('displayName');
              const next = withProperties(
                track,
                followDisplay ? { trackName: v, displayName: v } : { trackName: v },
              );
              updateObject(track.id, {
                name: next.name,
                styleId: next.styleId,
                track: followDisplay
                  ? { ...next.track, derivedFields: [...next.track.derivedFields, 'displayName'] }
                  : next.track,
              } as Partial<TrackObject>);
            }}
          />
        </Row>

        <Row label="Display Name" derived={derived.has('displayName')}>
          <TextField value={props.displayName} onChange={v => patch({ displayName: v })} />
        </Row>

        <Row label="Road Number">
          <TextField value={props.roadNumber} onChange={v => patch({ roadNumber: v })} placeholder="—" />
        </Row>

        <Row label="Track Type">
          <PropertySelect
            value={props.trackType}
            options={TRACK_TYPES.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ trackType: v as TrackProperties['trackType'] })}
          />
        </Row>

        {/* Direction renders as arrow + text, per §2. */}
        <Row label="Direction" required>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 13, color: '#374151', flexShrink: 0,
          }}>
            <span aria-hidden="true">{directionGlyph(props.direction)}</span>
          </span>
          <PropertySelect
            value={props.direction}
            options={TRACK_DIRECTIONS.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ direction: v as TrackProperties['direction'] })}
          />
        </Row>

        <Row label="CAL">
          <TextField value={props.cal} onChange={v => patch({ cal: v })} placeholder="—" />
        </Row>
      </PropertySection>

      {/* ── Extent ── */}
      <PropertySection title="Extent">
        <Row label="Start Loc." derived={derived.has('startLocation')}>
          <TextField value={props.startLocation} onChange={v => patch({ startLocation: v })} placeholder="—" />
        </Row>
        <Row label="End Loc." derived={derived.has('endLocation')}>
          <TextField value={props.endLocation} onChange={v => patch({ endLocation: v })} placeholder="—" />
        </Row>
        <Row label="Start Ch." derived={derived.has('startChainage')}>
          <NumberInput value={props.startChainage} onChange={v => patch({ startChainage: v })} />
        </Row>
        <Row label="End Ch." derived={derived.has('endChainage')}>
          <NumberInput value={props.endChainage} onChange={v => patch({ endChainage: v })} />
        </Row>
        <PropertyRow label="Length">
          <span style={{
            fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <Ruler size={12} strokeWidth={2} color="#9ca3af" />
            {trackLength(track).toFixed(1)} m · {track.geometry.length} segment
            {track.geometry.length === 1 ? '' : 's'}
          </span>
        </PropertyRow>
      </PropertySection>

      {/* ── Appearance (through the Styles layer, never per element) ── */}
      <PropertySection title="Rendering">
        <Row label="Work Status">
          <PropertySelect
            value={props.workStatus}
            options={TRACK_WORK_STATUSES.map(t => ({ value: t, label: t }))}
            onChange={v => patch({ workStatus: v as TrackProperties['workStatus'] })}
          />
        </Row>
        <PropertyRow label="Style">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#374151' }}>
            <svg width={22} height={10} aria-hidden="true">
              <line
                x1={0} y1={5} x2={22} y2={5}
                stroke={style.color} strokeWidth={2}
                strokeDasharray={style.strokeStyle === 'dashed' ? '4 3' : style.strokeStyle === 'dotted' ? '1 2' : undefined}
              />
            </svg>
            {style.name}
          </span>
        </PropertyRow>
      </PropertySection>

      {/* ── Connections captured at draw time ── */}
      {(props.startLink || props.endLink || props.referenceTrackId) && (
        <PropertySection title="Connections">
          {props.startLink && (
            <PropertyRow label="Start">
              <span style={linkStyle}>
                <Link2 size={12} strokeWidth={2} color="#2563eb" />
                {props.startLink.targetName}
              </span>
            </PropertyRow>
          )}
          {props.endLink && (
            <PropertyRow label="End">
              <span style={linkStyle}>
                <Link2 size={12} strokeWidth={2} color="#2563eb" />
                {props.endLink.targetName}
              </span>
            </PropertyRow>
          )}
          {props.referenceTrackId && (
            <PropertyRow label="Follows">
              <span style={linkStyle}>
                {props.referenceTrackName} @ {props.offset?.toFixed(2)} m {props.offsetSide}
              </span>
            </PropertyRow>
          )}
        </PropertySection>
      )}

      {/* ── Soft completeness badge — never a blocking prompt (§8.6) ── */}
      {missing.length > 0 && (
        <div style={{
          margin: '10px 8px',
          display: 'flex', gap: 8, alignItems: 'flex-start',
          background: '#fffbeb', border: '1px solid #fcd34d',
          borderRadius: 8, padding: '8px 10px',
        }}>
          <TriangleAlert size={13} strokeWidth={2} color="#b45309" style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.5 }}>
            <strong>{missing.length} field{missing.length === 1 ? '' : 's'} incomplete</strong>
            <br />
            {missing.join(', ')}
          </span>
        </div>
      )}
    </div>
  );
};

const linkStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 12.5, color: '#374151',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

export default TrackPropertiesPanel;
