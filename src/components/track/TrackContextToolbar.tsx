/**
 * TrackContextToolbar.tsx — the contextual strip for the Track tool (§1).
 *
 * One line high, docked under the header, four dropdowns: Track Type, Work
 * Status, Direction, Drawing Mode. The combination is sticky for the session
 * (persisted by trackDrawStore), so drawing ten sidings in a row takes one
 * setup (§8.2).
 *
 * Layout budget: the whole strip fits in 1366 px without wrapping, and every
 * control is a 32 px keyboard-reachable target with a visible focus ring (§8.8).
 */

import React from 'react';
import { Train, X } from 'lucide-react';
import { useTrackDraw } from '../../store/trackDrawStore';
import {
  TRACK_TYPES, TRACK_WORK_STATUSES, TRACK_DIRECTIONS, TRACK_DRAWING_MODES,
  TrackType, TrackWorkStatus, TrackDirection, TrackDrawingMode,
} from '../../types/track';
import { resolveTrackStyle } from '../../lib/track/trackStyles';
import { useEditor } from '../../store/editorStore';

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

const Field: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  width?: number;
  swatch?: React.ReactNode;
}> = ({ label, value, options, onChange, width = 132, swatch }) => (
  <label style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
    <span style={{
      fontFamily: FONT, fontSize: 11, fontWeight: 600,
      color: '#6b7280', whiteSpace: 'nowrap', letterSpacing: '0.01em',
    }}>
      {label}
    </span>
    <span style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {swatch && (
        <span style={{
          position: 'absolute', left: 8, pointerEvents: 'none',
          display: 'flex', alignItems: 'center',
        }}>
          {swatch}
        </span>
      )}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          height: 32,
          width,
          paddingLeft: swatch ? 30 : 9,
          paddingRight: 24,
          borderRadius: 6,
          border: '1px solid #d1d5db',
          background: '#f9fafb',
          color: '#111827',
          fontFamily: FONT,
          fontSize: 12.5,
          fontWeight: 500,
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'10\' height=\'6\' viewBox=\'0 0 10 6\'><path d=\'M1 1l4 4 4-4\' stroke=\'%236b7280\' stroke-width=\'1.6\' fill=\'none\' stroke-linecap=\'round\'/></svg>")',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  </label>
);

const Divider = () => (
  <span style={{ width: 1, height: 22, background: '#e5e7eb', flexShrink: 0 }} />
);

const TrackContextToolbar: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { session, setSettings, hasWorkInProgress } = useTrackDraw();
  const { styles } = useEditor();
  const { settings } = session;

  const statusStyle = resolveTrackStyle(
    `${settings.workStatus === 'Existing' ? 'existing-line' : settings.workStatus === 'Proposed' ? 'proposed-work' : 'future-work'}`,
    settings.workStatus,
    styles,
  );

  return (
    <div
      role="toolbar"
      aria-label="Track drawing options"
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 'var(--header-h)',
        left: 'calc(var(--sidebar-w) + var(--left-panel-w))',
        right: 'var(--panel-w)',
        height: 44,
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '0 12px',
        zIndex: 95,
        overflowX: 'auto',
      }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', gap: 6,
        color: '#1d4ed8', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
        flexShrink: 0, paddingRight: 2,
      }}>
        <Train size={15} strokeWidth={2} />
        Track
      </span>

      <Divider />

      <Field
        label="Type"
        value={settings.trackType}
        options={TRACK_TYPES.map(t => ({ value: t, label: t }))}
        onChange={v => setSettings({ trackType: v as TrackType })}
        width={92}
      />

      <Field
        label="Status"
        value={settings.workStatus}
        options={TRACK_WORK_STATUSES.map(t => ({ value: t, label: t }))}
        onChange={v => setSettings({ workStatus: v as TrackWorkStatus })}
        width={112}
        swatch={
          <svg width={16} height={10} aria-hidden="true">
            <line
              x1={0} y1={5} x2={16} y2={5}
              stroke={statusStyle.color}
              strokeWidth={2}
              strokeDasharray={statusStyle.strokeStyle === 'dashed' ? '4 3' : statusStyle.strokeStyle === 'dotted' ? '1 2' : undefined}
            />
          </svg>
        }
      />

      <Field
        label="Direction"
        value={settings.direction}
        options={TRACK_DIRECTIONS.map(t => ({ value: t, label: t }))}
        onChange={v => setSettings({ direction: v as TrackDirection })}
        width={112}
      />

      <Field
        label="Mode"
        value={settings.mode}
        options={TRACK_DRAWING_MODES.map(m => ({ value: m.id, label: m.label }))}
        onChange={v => setSettings({ mode: v as TrackDrawingMode })}
        width={158}
      />

      {hasWorkInProgress && (
        <>
          <Divider />
          <span style={{
            fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#92400e',
            background: '#fffbeb', border: '1px solid #fcd34d',
            borderRadius: 5, padding: '3px 8px', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Changes apply to segments not yet committed
          </span>
        </>
      )}

      <span style={{ flex: 1, minWidth: 8 }} />

      <button
        onClick={onExit}
        title="Exit Track tool (Esc)"
        style={{
          height: 32, minWidth: 32, padding: '0 10px',
          display: 'flex', alignItems: 'center', gap: 5,
          borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb',
          color: '#374151', fontFamily: FONT, fontSize: 12, fontWeight: 600,
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <X size={13} strokeWidth={2.2} />
        Exit
      </button>
    </div>
  );
};

export default TrackContextToolbar;
