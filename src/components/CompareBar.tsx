import React from 'react';
import { GitCompare, X } from 'lucide-react';
import { useCompareStore } from '../store/compareStore';

/**
 * CompareBar — the version-picker strip shown while compare mode is active.
 *
 * Floats just below the top bar, spanning the canvas area. Both the BASE (older)
 * and HEAD (newer) are chosen from the saved version snapshots via dropdowns;
 * the diff recomputes whenever either selection changes. A legend explains the
 * highlight colours. Create versions with the top bar's "Save version" button.
 */

const LEGEND: { color: string; label: string }[] = [
  { color: '#16a34a', label: 'Added' },
  { color: '#dc2626', label: 'Removed' },
  { color: '#d97706', label: 'Moved' },
  { color: '#0284c7', label: 'Modified' },
  { color: '#9ca3af', label: 'Unchanged' },
];

const selectStyle: React.CSSProperties = {
  fontSize: 11.5, padding: '3px 8px', borderRadius: 5,
  border: '1px solid #c4b5fd', background: '#fff', color: '#3730a3',
  cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', outline: 'none',
  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis',
};

const CompareBar: React.FC = () => {
  const {
    isComparing, savedVersions, baseVersionId, headVersionId,
    setBaseVersion, setHeadVersion, clearCompare,
  } = useCompareStore();

  if (!isComparing) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--header-h)',
      left: 'calc(var(--sidebar-w) + var(--left-panel-w))',
      right: 'var(--panel-w)',
      height: 34,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px',
      background: '#f5f3ff',
      borderBottom: '1px solid #ddd6fe',
      fontSize: 11.5,
      zIndex: 80,
      boxSizing: 'border-box',
    }}>
      <GitCompare size={14} color="#7c3aed" strokeWidth={2} />
      <span style={{ fontWeight: 600, color: '#5b21b6' }}>Comparing</span>

      {savedVersions.length < 2 ? (
        <span style={{ color: '#7c3aed', fontStyle: 'italic' }}>
          Save at least two versions (Save version) to compare
        </span>
      ) : (
        <>
          {/* Base = older version */}
          <select
            value={baseVersionId ?? ''}
            onChange={e => setBaseVersion(e.target.value)}
            style={selectStyle}
            title="Base version (older)"
          >
            <option value="" disabled>Select base…</option>
            {savedVersions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>

          <span style={{ color: '#7c3aed', fontWeight: 700 }}>→</span>

          {/* Head = newer version */}
          <select
            value={headVersionId ?? ''}
            onChange={e => setHeadVersion(e.target.value)}
            style={selectStyle}
            title="Head version (newer)"
          >
            <option value="" disabled>Select head…</option>
            {savedVersions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', alignItems: 'center' }}>
        {LEGEND.map(({ color, label }) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
            <span style={{ fontSize: 10.5, color: '#374151' }}>{label}</span>
          </span>
        ))}
      </div>

      <button
        onClick={clearCompare}
        style={{
          marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4,
          padding: '3px 9px', fontSize: 11.5, fontFamily: 'inherit',
          borderRadius: 5, border: '1px solid #c4b5fd',
          background: 'transparent', color: '#5b21b6', cursor: 'pointer',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#ede9fe'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        <X size={12} strokeWidth={2} />
        Exit compare
      </button>
    </div>
  );
};

export default CompareBar;
