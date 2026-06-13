import React, { useState, useEffect } from 'react';
import { X, Info, FileOutput } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────── */
type SectionType = 'absolute_block' | 'automatic' | '';
type DistantType = 'single_distant' | 'double_distant' | '';
type Side = 'entry' | 'exit';

export interface RowConfig {
  id: string;
  trackName: string;
  side: Side;
  sectionType: SectionType;
  distantTerritoryType: DistantType;
}

interface Props {
  trackNames: string[];
  onClose: () => void;
  onGenerate: (rows: RowConfig[]) => void;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */
function makeRows(trackNames: string[]): RowConfig[] {
  return trackNames.flatMap(name => [
    { id: `${name}-entry`, trackName: name, side: 'entry' as Side, sectionType: '' as SectionType, distantTerritoryType: '' as DistantType },
    { id: `${name}-exit`,  trackName: name, side: 'exit'  as Side, sectionType: '' as SectionType, distantTerritoryType: '' as DistantType },
  ]);
}

function isRowValid(r: RowConfig): boolean {
  if (!r.sectionType) return false;
  if (r.side === 'entry' && r.sectionType === 'absolute_block' && !r.distantTerritoryType) return false;
  return true;
}

/* ── Select micro-style ─────────────────────────────────────────────── */
const selectStyle = (hasValue: boolean, isRequired: boolean): React.CSSProperties => ({
  width: '100%',
  height: 30,
  border: `1px solid ${!hasValue && isRequired ? '#fca5a5' : '#d1d5db'}`,
  borderRadius: 6,
  padding: '0 6px',
  fontSize: 12.5,
  color: hasValue ? '#111827' : '#9ca3af',
  background: '#fff',
  cursor: 'pointer',
  outline: 'none',
});

/* ═══════════════════════════════════════════════════════════════════
   SectionConfigModal
════════════════════════════════════════════════════════════════════ */
const SectionConfigModal: React.FC<Props> = ({ trackNames, onClose, onGenerate }) => {
  const [rows, setRows] = useState<RowConfig[]>(() => makeRows(trackNames));

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const handleSectionType = (id: string, value: SectionType) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const keepDistant = value === 'absolute_block' && r.side === 'entry';
      return { ...r, sectionType: value, distantTerritoryType: keepDistant ? r.distantTerritoryType : '' };
    }));
  };

  const handleDistantType = (id: string, value: DistantType) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, distantTerritoryType: value } : r));
  };

  /* Per-track completion dot: green when both entry + exit rows are valid */
  const trackComplete = (name: string) => {
    const relevant = rows.filter(r => r.trackName === name);
    return relevant.length > 0 && relevant.every(isRowValid);
  };

  const allValid = rows.every(isRowValid);
  const completedCount = trackNames.filter(n => trackComplete(n)).length;

  const handleGenerate = () => { if (allValid) onGenerate(rows); };

  /* ── Empty state ─────────────────────────────────────────────────── */
  if (trackNames.length === 0) {
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 300, backdropFilter: 'blur(2px)' }} onClick={onClose} />
        <div style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 440, background: '#fff', borderRadius: 12,
          boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
          zIndex: 301, padding: 32, textAlign: 'center',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>No main line tracks detected</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>Add line objects to the Main Line layer before generating a SIP.</div>
          <button onClick={onClose} style={{ padding: '7px 20px', borderRadius: 7, border: '1px solid #d1d5db', fontSize: 13, cursor: 'pointer', background: '#fff', color: '#374151' }}>Close</button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 300, backdropFilter: 'blur(2px)' }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 780, maxWidth: 'calc(100vw - 40px)',
          maxHeight: 'calc(100vh - 80px)',
          background: '#fff', borderRadius: 12,
          boxShadow: '0 32px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)',
          zIndex: 301, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 20px', height: 54,
          borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: '#eff6ff', border: '1px solid #bfdbfe',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <FileOutput size={15} color="#2563eb" strokeWidth={1.75} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
              Configure Section Details
            </div>
            <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 1 }}>
              Required before SIP generation — define section parameters for all main line ends
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', flexShrink: 0 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#6b7280'; }}
          >
            <X size={15} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Info banner ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 20px',
          background: '#f0f9ff', borderBottom: '1px solid #bae6fd',
          flexShrink: 0,
        }}>
          <Info size={13} color="#0284c7" strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: '#0369a1' }}>
            <strong>{trackNames.length}</strong> main line track{trackNames.length !== 1 ? 's' : ''} detected.
            {' '}Configure Section Type for Entry and Exit sides; Distant Territory Type is required when Entry side uses Absolute Block Section.
          </span>
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '30%' }} />
              <col />
            </colgroup>
            <thead>
              <tr>
                {[
                  { label: 'Track Name',              req: false },
                  { label: 'Side',                    req: false },
                  { label: 'Section Type',            req: true  },
                  { label: 'Distant Territory Type',  req: false },
                ].map(({ label, req }, i) => (
                  <th key={i} style={{
                    padding: '0 14px', height: 34,
                    textAlign: 'left', fontSize: 11, fontWeight: 600,
                    color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase',
                    background: '#f9fafb', borderBottom: '1px solid #e5e7eb',
                    position: 'sticky', top: 0, zIndex: 1,
                  }}>
                    {label}{req && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const isEntry = row.side === 'entry';
                const showDistant = isEntry && row.sectionType === 'absolute_block';
                const distantRequired = showDistant;
                /* Alternating group background */
                const groupBg = Math.floor(rowIdx / 2) % 2 === 0 ? '#ffffff' : '#fafafa';

                return (
                  <tr
                    key={row.id}
                    style={{
                      background: groupBg,
                      borderBottom: isEntry ? '1px solid #f0f1f3' : '2px solid #e5e7eb',
                    }}
                  >
                    {/* Track Name */}
                    <td style={{ padding: '0 14px', height: 46, verticalAlign: 'middle' }}>
                      {isEntry ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: trackComplete(row.trackName) ? '#22c55e' : '#e5e7eb',
                            transition: 'background 0.2s',
                          }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.trackName}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#d1d5db', paddingLeft: 14 }}>↳</span>
                      )}
                    </td>

                    {/* Side badge */}
                    <td style={{ padding: '0 14px', height: 46, verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '3px 9px', borderRadius: 20,
                        fontSize: 11.5, fontWeight: 600,
                        background: isEntry ? '#eff6ff' : '#f0fdf4',
                        color: isEntry ? '#1d4ed8' : '#16a34a',
                        border: `1px solid ${isEntry ? '#bfdbfe' : '#bbf7d0'}`,
                        letterSpacing: '0.02em',
                      }}>
                        {isEntry ? 'Entry' : 'Exit'}
                      </span>
                    </td>

                    {/* Section Type */}
                    <td style={{ padding: '0 14px', height: 46, verticalAlign: 'middle' }}>
                      <select
                        value={row.sectionType}
                        onChange={e => handleSectionType(row.id, e.target.value as SectionType)}
                        style={selectStyle(!!row.sectionType, true)}
                      >
                        <option value="" disabled>Select type…</option>
                        <option value="absolute_block">Absolute Block Section</option>
                        <option value="automatic">Automatic Section</option>
                      </select>
                    </td>

                    {/* Distant Territory Type */}
                    <td style={{ padding: '0 14px', height: 46, verticalAlign: 'middle' }}>
                      {showDistant ? (
                        <select
                          value={row.distantTerritoryType}
                          onChange={e => handleDistantType(row.id, e.target.value as DistantType)}
                          style={selectStyle(!!row.distantTerritoryType, distantRequired)}
                        >
                          <option value="" disabled>Select territory…</option>
                          <option value="single_distant">Single Distant</option>
                          <option value="double_distant">Double Distant</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: 12.5, color: '#d1d5db', userSelect: 'none' }}>
                          {isEntry ? 'Not applicable for Automatic Section' : '—'}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div style={{
          height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', borderTop: '1px solid #e5e7eb',
          flexShrink: 0, background: '#fafafa',
        }}>
          <span style={{ fontSize: 12 }}>
            {allValid
              ? <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ All {trackNames.length} tracks configured</span>
              : <span style={{ color: '#6b7280' }}>{completedCount} of {trackNames.length} tracks complete — fill all required fields</span>
            }
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                height: 34, padding: '0 16px',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: 13, fontWeight: 500,
                color: '#374151', background: '#fff', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
              onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
            >
              Cancel
            </button>
            <button
              onClick={handleGenerate}
              disabled={!allValid}
              style={{
                height: 34, padding: '0 16px',
                border: 'none', borderRadius: 7,
                fontSize: 13, fontWeight: 600,
                color: allValid ? '#fff' : '#9ca3af',
                background: allValid ? '#1d4ed8' : '#f3f4f6',
                cursor: allValid ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { if (allValid) e.currentTarget.style.opacity = '0.88'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              <FileOutput size={13} strokeWidth={2} />
              Generate SIP
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SectionConfigModal;
