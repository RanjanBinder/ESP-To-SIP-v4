import React from 'react';
import { X, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';
import { useSODStore } from '../store/sodStore';
import { useEditor } from '../store/editorStore';
import type { SODViolation, ViolationSeverity } from '../lib/validation/sodValidator';

/* Severity → visual treatment (matches the top-bar button states). */
const SEVERITY_STYLE: Record<ViolationSeverity, { label: string; border: string; bg: string; text: string }> = {
  V1: { label: 'V1 · Critical', border: '#fca5a5', bg: '#fef2f2', text: '#b91c1c' },
  V2: { label: 'V2 · Warning',  border: '#fcd34d', bg: '#fffbeb', text: '#b45309' },
};

const ViolationRow: React.FC<{ v: SODViolation }> = ({ v }) => {
  const s = SEVERITY_STYLE[v.severity];
  const { selectObject } = useEditor();
  const clickable = Boolean(v.assetId);

  return (
    <button
      onClick={clickable ? () => selectObject(v.assetId!) : undefined}
      style={{
        width: '100%',
        textAlign: 'left',
        display: 'flex',
        gap: 9,
        padding: '10px 12px',
        border: 'none',
        borderBottom: '1px solid #f3f4f6',
        background: 'transparent',
        cursor: clickable ? 'pointer' : 'default',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { if (clickable) e.currentTarget.style.background = '#fafafa'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
    >
      <span style={{
        flexShrink: 0, marginTop: 1,
        color: s.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {v.severity === 'V1'
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
    </button>
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

const SODViolationsPanel: React.FC = () => {
  const { checkResult, setPanelOpen, stationName } = useSODStore();

  const passed = checkResult?.passed ?? false;
  const v1 = checkResult?.counts.V1 ?? 0;
  const v2 = checkResult?.counts.V2 ?? 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>
      {/* Header / tab */}
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
          <EmptyState text="Run the SOD check to see violations here." />
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
          <ViolationRow key={v.id} v={v} />
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
