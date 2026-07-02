import React, { useState } from 'react';
import { Save, History, ArrowLeft, Check, ShieldCheck, GitCompare, BookmarkPlus } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import { useCompareStore } from '../store/compareStore';
import type { SODCheckResult } from '../lib/validation/sodValidator';
import { runPdfSODValidation } from '../lib/validation/pdfSodValidator';
import { DEFAULT_DRAWING_META } from '../lib/defaultDwgDocument';
import { DEFAULT_PDF_COMPARE_BASE_ID, DEFAULT_PDF_COMPARE_HEAD_ID } from '../data/pothulapaduCompareVersions';
import { savePersistedDocument } from '../lib/serialize';

const TopBar: React.FC = () => {
  const { getDocument, objects } = useEditor();
  const { checkResult, setCheckResult, setPanelOpen, stationCode } = useSODStore();
  const {
    isComparing, enableCompare, clearCompare,
    savedVersions, baseVersionId, headVersionId, setVersionPair, saveVersion,
  } = useCompareStore();
  const [savedTick, setSavedTick] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  async function handleRunSODCheck() {
    setIsRunning(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 400)); // gives UI time to show spinner
      const result = runPdfSODValidation(objects, {
        fileName: DEFAULT_DRAWING_META.fileName,
        sourceUrl: DEFAULT_DRAWING_META.sourceUrl,
        page: 1,
      });
      setCheckResult(result);
      setPanelOpen(true);
    } catch (err) {
      console.error('SOD check failed:', err);
    } finally {
      setIsRunning(false);
    }
  }

  /** Toggle compare mode. On enter, default to the two most recent saved
   *  versions; the user can re-pick either side from the compare bar. */
  function handleCompareToggle() {
    if (isComparing) {
      clearCompare();
      return;
    }
    // Comparing and the SOD panel both take over the right panel — close SOD.
    setPanelOpen(false);
    if (savedVersions.length >= 2 && !(baseVersionId && headVersionId)) {
      const hasDefaultPair = savedVersions.some(v => v.id === DEFAULT_PDF_COMPARE_BASE_ID) &&
        savedVersions.some(v => v.id === DEFAULT_PDF_COMPARE_HEAD_ID);
      if (hasDefaultPair) {
        setVersionPair(DEFAULT_PDF_COMPARE_BASE_ID, DEFAULT_PDF_COMPARE_HEAD_ID);
      } else {
        setVersionPair(
          savedVersions[savedVersions.length - 2].id,
          savedVersions[savedVersions.length - 1].id,
        );
      }
    }
    enableCompare();
  }

  /** Snapshot the current drawing as a named version for later comparison. */
  function handleSaveVersion() {
    const suggested = `Version ${savedVersions.length + 1}`;
    const label = window.prompt('Name this version', suggested);
    if (label === null) return;
    const v = saveVersion(label.trim() || suggested, objects);
    window.alert(`Saved "${v.label}" (${objects.length} objects). Pick it as the base in Compare versions.`);
  }

  const handleSave = () => {
    savePersistedDocument(getDocument());
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  return (
  <header style={{
    height: 'var(--header-h)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    gap: 12,
  }}>
    {/* Left: back button + heading */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <button
        title="Back to station"
        style={{
          width: 28, height: 28,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          transition: 'background 0.12s, color 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--color-hover)';
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-muted)';
        }}
      >
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <span style={{
        fontWeight: 600,
        fontSize: 13.5,
        color: 'var(--color-text)',
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}>
        ESP Editor
      </span>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#1d4ed8',
        background: '#dbeafe',
        border: '1px solid #bfdbfe',
        borderRadius: 5,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
        title={stationCode ? 'Loaded station' : undefined}
      >
        {stationCode ?? 'BWK'}
      </span>
    </div>

    {/* Center: autosave badge */}
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--color-surface-alt)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-pill)',
      padding: '3px 12px',
      fontSize: 12,
      color: '#374151',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: '50%',
        background: '#22c55e',
        flexShrink: 0,
        display: 'inline-block',
      }} />
      Draft v0.1 &nbsp;·&nbsp; Auto-saved
    </div>

    {/* Right: actions */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <TopBarBtn icon={<History size={14} />} label="History" />
      <button
        onClick={handleSave}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: savedTick ? '#16a34a' : 'var(--color-primary)',
          color: '#fff',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 14px',
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: '0.01em',
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {savedTick ? <Check size={13} /> : <Save size={13} />}
        {savedTick ? 'Saved' : 'Save'}
      </button>

      <TopBarBtn
        icon={<BookmarkPlus size={14} />}
        label="Save version"
        onClick={handleSaveVersion}
        title="Snapshot the current drawing as a version to compare against"
      />

      <div style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }} />

      <button
        onClick={handleCompareToggle}
        title="Compare two PDF versions"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: `1px solid ${isComparing ? '#c4b5fd' : 'var(--color-border)'}`,
          background: isComparing ? '#f5f3ff' : 'transparent',
          color: isComparing ? '#5b21b6' : 'var(--color-text-muted)',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 14px',
          fontSize: 12.5,
          fontWeight: isComparing ? 600 : 500,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        <GitCompare size={13} strokeWidth={2} />
        Compare PDFs
      </button>

      <SODCheckButton
        checkResult={checkResult}
        isRunning={isRunning}
        onClick={handleRunSODCheck}
      />
    </div>
  </header>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Run SOD check button + violation-count badge
════════════════════════════════════════════════════════════════════ */

const SODCheckButton: React.FC<{
  checkResult: SODCheckResult | null;
  isRunning: boolean;
  onClick: () => void;
}> = ({ checkResult, isRunning, onClick }) => {
  const hasResult = checkResult !== null;
  const hasViolations = hasResult && checkResult!.counts.total > 0;

  /* State-driven colors (loading keeps the default blue). */
  let colors = { border: '#93c5fd', bg: '#eff6ff', text: '#1d4ed8' }; // default / loading
  if (!isRunning && hasResult) {
    colors = hasViolations
      ? { border: '#fca5a5', bg: '#fef2f2', text: '#b91c1c' }  // violations found
      : { border: '#86efac', bg: '#f0fdf4', text: '#15803d' }; // all passed
  }

  return (
    <>
      {/* Count badge — only when results exist and violations > 0 */}
      {hasViolations && (
        <span style={{
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fca5a5',
          borderRadius: 4,
          fontSize: 11,
          padding: '2px 8px',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {checkResult!.counts.V2} V2 · {checkResult!.counts.V1} V1
        </span>
      )}

      <button
        onClick={onClick}
        disabled={isRunning}
        title="Validate the PDF against the Schedule of Dimensions"
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.text,
          borderRadius: 'var(--radius-sm)',
          padding: '6px 14px',
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          cursor: isRunning ? 'default' : 'pointer',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { if (!isRunning) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {isRunning
          ? <span style={{
              width: 13, height: 13,
              border: `2px solid ${colors.border}`,
              borderTopColor: colors.text,
              borderRadius: '50%',
              display: 'inline-block',
              animation: 'spin 0.9s linear infinite',
            }} />
          : <ShieldCheck size={13} strokeWidth={2} />}
        {isRunning ? 'Checking...' : 'Run PDF SOD'}
      </button>
    </>
  );
};

const TopBarBtn: React.FC<{
  icon: React.ReactNode; label: string; onClick?: () => void; title?: string;
}> = ({ icon, label, onClick, title }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '5px 10px',
      borderRadius: 'var(--radius-sm)',
      fontSize: 12.5,
      color: 'var(--color-text-muted)',
      transition: 'background 0.12s, color 0.12s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = 'var(--color-hover)';
      e.currentTarget.style.color = 'var(--color-text)';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = 'transparent';
      e.currentTarget.style.color = 'var(--color-text-muted)';
    }}
  >
    {icon}
    {label}
  </button>
);

export default TopBar;
