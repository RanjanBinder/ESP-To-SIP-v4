import React, { useState } from 'react';
import { Save, History, Check, ShieldCheck, GitCompare, BookmarkPlus } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import { useCompareStore } from '../store/compareStore';
import { runPdfSODValidation } from '../lib/validation/pdfSodValidator';
import { DEFAULT_DRAWING_META } from '../lib/defaultDwgDocument';
import { DEFAULT_PDF_COMPARE_BASE_ID, DEFAULT_PDF_COMPARE_HEAD_ID } from '../data/pothulapaduCompareVersions';
import { savePersistedDocument } from '../lib/serialize';

/* ═══════════════════════════════════════════════════════════════════
   RightPanelActions — Rayon-style icon toolbar pinned to the top of
   the right panel. Houses the actions that used to live in the top
   bar (History, Save version, Compare PDFs, Run PDF SOD) plus the
   primary Save button on the right.
════════════════════════════════════════════════════════════════════ */

const IconActionBtn: React.FC<{
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  active?: boolean;
  activeColors?: { border: string; bg: string; text: string };
  badge?: number;
  disabled?: boolean;
}> = ({ icon, title, onClick, active, activeColors, badge, disabled }) => {
  const [hov, setHov] = useState(false);
  const colors = active && activeColors ? activeColors : null;

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        width: 30, height: 30,
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: colors ? `1px solid ${colors.border}` : '1px solid transparent',
        background: colors ? colors.bg : hov ? 'var(--color-hover)' : 'transparent',
        color: colors ? colors.text : 'var(--color-text-muted)',
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      {icon}
      {!!badge && (
        <span style={{
          position: 'absolute',
          top: -4, right: -4,
          minWidth: 15, height: 15,
          padding: '0 3px',
          borderRadius: 8,
          background: '#dc2626',
          color: '#fff',
          fontSize: 9.5,
          fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxSizing: 'border-box',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
};

const RightPanelActions: React.FC = () => {
  const { getDocument, objects } = useEditor();
  const { checkResult, setCheckResult, setPanelOpen } = useSODStore();
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

  const hasResult = checkResult !== null;
  const hasViolations = hasResult && checkResult!.counts.total > 0;
  let sodColors = { border: '#93c5fd', bg: '#eff6ff', text: '#1d4ed8' }; // default / loading
  if (!isRunning && hasResult) {
    sodColors = hasViolations
      ? { border: '#fca5a5', bg: '#fef2f2', text: '#b91c1c' }  // violations found
      : { border: '#86efac', bg: '#f0fdf4', text: '#15803d' }; // all passed
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 6,
      padding: '8px 10px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-surface, #fff)',
      flexShrink: 0,
    }}>
      {/* Left cluster: secondary actions as icon buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <IconActionBtn icon={<History size={14} strokeWidth={2} />} title="History" />

        <IconActionBtn
          icon={<BookmarkPlus size={14} strokeWidth={2} />}
          title="Save version — snapshot the current drawing to compare against"
          onClick={handleSaveVersion}
        />

        <div style={{ width: 1, height: 18, background: 'var(--color-border)', margin: '0 3px', flexShrink: 0 }} />

        <IconActionBtn
          icon={<GitCompare size={14} strokeWidth={2} />}
          title="Compare two PDF versions"
          onClick={handleCompareToggle}
          active={isComparing}
          activeColors={{ border: '#c4b5fd', bg: '#f5f3ff', text: '#5b21b6' }}
        />

        <IconActionBtn
          icon={
            isRunning
              ? <span style={{
                  width: 13, height: 13,
                  border: `2px solid ${sodColors.border}`,
                  borderTopColor: sodColors.text,
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.9s linear infinite',
                }} />
              : <ShieldCheck size={14} strokeWidth={2} />
          }
          title={isRunning ? 'Checking...' : 'Run PDF SOD — validate against the Schedule of Dimensions'}
          onClick={handleRunSODCheck}
          disabled={isRunning}
          active={!isRunning && hasResult}
          activeColors={sodColors}
          badge={hasViolations ? checkResult!.counts.total : 0}
        />
      </div>

      {/* Right: primary Save action */}
      <button
        onClick={handleSave}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: savedTick ? '#16a34a' : 'var(--color-primary)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          padding: '6px 13px',
          fontSize: 12.5,
          fontWeight: 500,
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
      >
        {savedTick ? <Check size={13} /> : <Save size={13} />}
        {savedTick ? 'Saved' : 'Save'}
      </button>
    </div>
  );
};

export default RightPanelActions;
