import React, { useEffect, useRef } from 'react';
import { GitCompare, Crosshair } from 'lucide-react';
import { useCompareStore } from '../store/compareStore';
import { useSODStore } from '../store/sodStore';
import type { AssetChange, ChangeType } from '../lib/versionDiff/diffTypes';

/**
 * ChangeListPanel — the right-panel change list for compare mode.
 *
 * Mirrors SODViolationsPanel: KPI cards + a scrollable, two-way-synced list of
 * changes. Selecting a row highlights it on the canvas; "View" re-uses the
 * shared sodStore.requestFocus viewport plumbing to centre on the asset.
 */

const TYPE_STYLE: Record<ChangeType, { bg: string; text: string; label: string }> = {
  added:     { bg: '#dcfce7', text: '#15803d', label: 'added' },
  removed:   { bg: '#fee2e2', text: '#b91c1c', label: 'removed' },
  moved:     { bg: '#fef3c7', text: '#92400e', label: 'moved' },
  modified:  { bg: '#e0f2fe', text: '#0369a1', label: 'modified' },
  unchanged: { bg: '#f3f4f6', text: '#6b7280', label: 'unchanged' },
};

const KpiCard: React.FC<{ label: string; value: number; color: string; bg: string; border: string }> =
  ({ label, value, color, bg, border }) => (
  <div style={{
    background: value > 0 ? bg : '#f9fafb',
    border: `1px solid ${value > 0 ? border : '#e5e7eb'}`,
    borderRadius: 7, padding: '6px 4px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 16, fontWeight: 700, color: value > 0 ? color : '#9ca3af', lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 9.5, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1 }}>
      {label}
    </div>
  </div>
);

const ChangeListPanel: React.FC = () => {
  const { diffResult, activeChangeId, setActiveChange } = useCompareStore();
  const { requestFocus } = useSODStore();
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* Canvas → panel: scroll the active change into view when it changes. */
  useEffect(() => {
    if (!activeChangeId) return;
    rowRefs.current[activeChangeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeChangeId]);

  const handleView = (c: AssetChange) => {
    setActiveChange(c.changeId);
    requestFocus(c.canvasX, c.canvasY, 2.5);
  };

  if (!diffResult) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <PanelHeader subtitle={null} />
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
            Pick a saved base version and upload a DWG to compare against it.
          </p>
        </div>
      </div>
    );
  }

  const visible = diffResult.changes.filter(c => c.changeType !== 'unchanged');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      <PanelHeader subtitle={`${diffResult.baseVersion} → ${diffResult.headVersion}`} />

      {/* KPI cards */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
        padding: '10px 12px', borderBottom: '1px solid #f0f1f3', flexShrink: 0,
      }}>
        <KpiCard label="Added"    value={diffResult.added}    color="#15803d" bg="#f0fdf4" border="#86efac" />
        <KpiCard label="Removed"  value={diffResult.removed}  color="#b91c1c" bg="#fef2f2" border="#fca5a5" />
        <KpiCard label="Moved"    value={diffResult.moved}    color="#92400e" bg="#fffbeb" border="#fcd34d" />
        <KpiCard label="Modified" value={diffResult.modified} color="#0369a1" bg="#eff6ff" border="#93c5fd" />
      </div>

      {/* Change list */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: '#15803d' }}>No changes</p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#6b7280' }}>
              The two versions are identical.
            </p>
          </div>
        ) : visible.map(c => {
          const s = TYPE_STYLE[c.changeType];
          const isActive = activeChangeId === c.changeId;
          const name = c.newObject?.name ?? c.oldObject?.name ?? '';
          return (
            <div
              key={c.changeId}
              ref={el => { rowRefs.current[c.changeId] = el; }}
              onClick={() => setActiveChange(isActive ? null : c.changeId)}
              style={{
                display: 'flex', gap: 8, padding: '9px 12px',
                borderBottom: '1px solid #f3f4f6',
                borderLeft: `3px solid ${isActive ? s.text : 'transparent'}`,
                background: isActive ? '#f5f3ff' : 'transparent',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
                    color: s.text, background: s.bg, borderRadius: 4, padding: '1px 6px', flexShrink: 0,
                  }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name}
                  </span>
                </span>
                <span style={{ display: 'block', fontSize: 11.5, color: '#6b7280', lineHeight: 1.45 }}>
                  {c.description}
                </span>
              </span>
              <button
                title="View on drawing"
                onClick={e => { e.stopPropagation(); handleView(c); }}
                style={{
                  flexShrink: 0, alignSelf: 'center',
                  display: 'flex', alignItems: 'center', gap: 4,
                  border: '1px solid #e5e7eb', borderRadius: 6,
                  background: '#fff', color: '#6b7280', cursor: 'pointer',
                  padding: '4px 7px', fontSize: 10.5, fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#374151'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#6b7280'; }}
              >
                <Crosshair size={12} strokeWidth={2} />
                View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PanelHeader: React.FC<{ subtitle: string | null }> = ({ subtitle }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '0 12px', height: 40,
    borderBottom: '1px solid #e5e7eb', background: '#faf5ff', flexShrink: 0,
  }}>
    <GitCompare size={15} strokeWidth={2} color="#7c3aed" />
    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Changes</span>
    {subtitle && <span style={{ fontSize: 11, color: '#9ca3af' }}>· {subtitle}</span>}
  </div>
);

export default ChangeListPanel;
