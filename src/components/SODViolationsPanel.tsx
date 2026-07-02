import React, { useEffect, useRef } from 'react';
import { X, ShieldCheck, ShieldAlert, AlertTriangle, Crosshair, FileText, ExternalLink } from 'lucide-react';
import { useSODStore } from '../store/sodStore';
import { useEditor } from '../store/editorStore';
import type { SODCheckResult, SODViolation, ViolationSeverity } from '../lib/validation/sodValidator';

/* Severity → visual treatment. V2 = critical (red), V1 = major (amber). */
const SEVERITY_STYLE: Record<ViolationSeverity, { label: string; border: string; bg: string; text: string }> = {
  V2: { label: 'V2 · Critical', border: '#fca5a5', bg: '#fef2f2', text: '#b91c1c' },
  V1: { label: 'V1 · Major',    border: '#fcd34d', bg: '#fffbeb', text: '#b45309' },
};

const ViolationRow: React.FC<{
  v: SODViolation;
  isActive: boolean;
  onSelect: () => void;
  onView: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}> = ({ v, isActive, onSelect, onView, rowRef }) => {
  const s = SEVERITY_STYLE[v.severity];

  return (
    <div
      ref={rowRef}
      onClick={onSelect}
      style={{
        display: 'flex',
        gap: 9,
        padding: '10px 12px',
        borderBottom: '1px solid #f3f4f6',
        borderLeft: `3px solid ${isActive ? s.text : 'transparent'}`,
        background: isActive ? s.bg : 'transparent',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#fafafa'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        flexShrink: 0, marginTop: 1,
        color: s.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {v.severity === 'V2'
          ? <ShieldAlert size={15} strokeWidth={2} />
          : <AlertTriangle size={14} strokeWidth={2} />}
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>{v.title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.03em',
            color: s.text, background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          }}>
            {v.severity}
          </span>
          {v.ruleCode && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: '#6b7280',
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              borderRadius: 4, padding: '1px 5px', flexShrink: 0,
            }}>
              {v.ruleCode}
            </span>
          )}
        </span>
        <span style={{ display: 'block', fontSize: 11.5, color: '#6b7280', lineHeight: 1.5 }}>
          {v.detail}
        </span>
        {v.measured != null && v.required && (
          <span style={{ display: 'block', fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
            Measured <strong style={{ color: s.text }}>{v.measured}{v.unit ?? ''}</strong>
            {' · '}Required {v.required}
          </span>
        )}
      </span>
      {v.canvasX != null && (
        <button
          title="View on drawing"
          onClick={e => { e.stopPropagation(); onView(); }}
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
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: number; color: string; bg: string; border: string }> =
  ({ label, value, color, bg, border }) => (
  <div style={{
    background: bg, border: `1px solid ${border}`, borderRadius: 7,
    padding: '6px 4px', textAlign: 'center',
  }}>
    <div style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 9.5, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 1 }}>
      {label}
    </div>
  </div>
);

const PdfSourceStrip: React.FC<{ result: SODCheckResult }> = ({ result }) => {
  if (result.sourceKind !== 'pdf') return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minHeight: 38,
      padding: '7px 12px',
      borderBottom: '1px solid #f0f1f3',
      background: '#f8fafc',
      flexShrink: 0,
      boxSizing: 'border-box',
    }}>
      <FileText size={14} strokeWidth={1.75} color="#475569" style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontSize: 11.5,
          fontWeight: 650,
          color: '#111827',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {result.sourceFileName ?? 'PDF source'}
        </span>
        <span style={{ fontSize: 10.5, color: '#64748b' }}>
          Page {result.sourcePage ?? 1} · {result.assetsChecked} PDF anchors
        </span>
      </span>
      {result.sourceUrl && (
        <button
          title="Open PDF"
          onClick={() => window.open(result.sourceUrl, '_blank', 'noopener,noreferrer')}
          style={{
            flexShrink: 0,
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#ffffff',
            color: '#475569',
            cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
        >
          <ExternalLink size={13} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
};

const SODViolationsPanel: React.FC<{ showHeader?: boolean }> = ({ showHeader = true }) => {
  const {
    checkResult, setPanelOpen, stationName,
    activeViolationId, setActiveViolation, requestFocus,
  } = useSODStore();
  const { objects, selectObject } = useEditor();

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  /* Canvas → panel: when the active violation changes (e.g. a dot was clicked
     on the canvas), scroll its row into view. */
  useEffect(() => {
    if (!activeViolationId) return;
    rowRefs.current[activeViolationId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeViolationId]);

  const passed = checkResult?.passed ?? false;
  const v1 = checkResult?.counts.V1 ?? 0;
  const v2 = checkResult?.counts.V2 ?? 0;

  const handleSelect = (v: SODViolation) => {
    setActiveViolation(activeViolationId === v.id ? null : v.id);
    const asset = v.assetId ? objects.find(o => o.id === v.assetId) : null;
    selectObject(asset?.visible ? asset.id : null);
  };

  const handleView = (v: SODViolation) => {
    setActiveViolation(v.id);
    const asset = v.assetId ? objects.find(o => o.id === v.assetId) : null;
    selectObject(asset?.visible ? asset.id : null);
    if (v.canvasX != null && v.canvasY != null) {
      // Aim at the asset's centre so rects/bands land in view, not just a corner.
      const cx = v.canvasX + (v.canvasW ?? 0) / 2;
      const cy = v.canvasY + (v.canvasH ?? 0) / 2;
      requestFocus(cx, cy, 2.5);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Header / tab */}
      {showHeader && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 12px', height: 40,
          borderBottom: '1px solid #e5e7eb', background: '#fafafa', flexShrink: 0,
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ color: passed ? '#15803d' : '#b91c1c', display: 'flex' }}>
              {passed ? <ShieldCheck size={15} strokeWidth={2} /> : <ShieldAlert size={15} strokeWidth={2} />}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>Violations</span>
            {stationName && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>· {stationName}</span>
            )}
          </span>
          <button
            onClick={() => setPanelOpen(false)}
            title="Close"
            style={{
              width: 24, height: 24, border: 'none', background: 'transparent',
              borderRadius: 6, color: '#9ca3af', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#ececec'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      )}

      {checkResult && <PdfSourceStrip result={checkResult} />}

      {/* KPI cards */}
      {checkResult && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6,
          padding: '10px 12px', borderBottom: '1px solid #f0f1f3', flexShrink: 0,
        }}>
          <KpiCard label="Checks"   value={checkResult.checksRun}    color="#374151" bg="#f9fafb" border="#e5e7eb" />
          <KpiCard label="Passed"   value={checkResult.checksPassed} color="#15803d" bg="#f0fdf4" border="#86efac" />
          <KpiCard label="Critical" value={v2}                       color="#b91c1c" bg="#fef2f2" border="#fca5a5" />
          <KpiCard label="Major"    value={v1}                       color="#b45309" bg="#fffbeb" border="#fcd34d" />
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {!checkResult && (
          <EmptyState text="Run PDF SOD to see violations here." />
        )}
        {checkResult && passed && (
          <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <ShieldCheck size={28} strokeWidth={1.75} color="#15803d" style={{ margin: '0 auto 10px' }} />
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#15803d' }}>All checks passed</p>
            <p style={{ margin: '4px 0 0', fontSize: 11.5, color: '#6b7280', lineHeight: 1.5 }}>
              No SOD violations found across {checkResult.assetsChecked} assets.
            </p>
          </div>
        )}
        {checkResult && !passed && checkResult.violations.map(v => (
          <ViolationRow
            key={v.id}
            v={v}
            isActive={activeViolationId === v.id}
            onSelect={() => handleSelect(v)}
            onView={() => handleView(v)}
            rowRef={el => { rowRefs.current[v.id] = el; }}
          />
        ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '32px 20px', textAlign: 'center' }}>
    <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{text}</p>
  </div>
);

export default SODViolationsPanel;
