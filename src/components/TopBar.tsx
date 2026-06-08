import React, { useRef, useState } from 'react';
import { Save, History, Upload, ChevronRight, Cpu, Check } from 'lucide-react';
import { useEditor } from '../store/editorStore';
import { downloadDocument, readDocumentFile, savePersistedDocument } from '../lib/serialize';
import { importDwgFile } from '../lib/dwgImporter';
import { importDxfFile } from '../lib/dxfImporter';

const TopBar: React.FC = () => {
  const { getDocument, loadDocument, importObjects, layers, activeLayerId } = useEditor();
  const importRef = useRef<HTMLInputElement>(null);
  const [savedTick, setSavedTick] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSave = () => {
    savePersistedDocument(getDocument());
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1600);
  };

  const handleImportPick = () => importRef.current?.click();

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    setImporting(true);
    try {
      if (ext === 'dwg') {
        const buffer = await file.arrayBuffer();
        const result = await importDwgFile(buffer, layers, activeLayerId);
        importObjects(result.objects, result.newLayers);
      } else if (ext === 'dxf') {
        const buffer = await file.arrayBuffer();
        const result = await importDxfFile(buffer, layers, activeLayerId);
        importObjects(result.objects, result.newLayers);
      } else {
        const doc = await readDocumentFile(file);
        if (doc) loadDocument(doc);
        else window.alert('Could not read that file — it is not a valid ESP drawing.');
      }
    } catch (err) {
      window.alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
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
    {/* Left: logo + project name */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <div style={{
        width: 28, height: 28,
        background: 'var(--color-primary)',
        borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Cpu size={15} color="#fff" strokeWidth={2} />
      </div>
      <span style={{
        fontWeight: 600,
        fontSize: 13.5,
        color: 'var(--color-text)',
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}>
        Digital ESP Editor
      </span>
      <ChevronRight size={14} color="#9ca3af" style={{ flexShrink: 0 }} />
      <span style={{ color: '#4b5563', fontSize: 12.5, whiteSpace: 'nowrap' }}>
        Station A — Main Yard
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
      <input
        ref={importRef}
        type="file"
        accept=".dwg,.dxf,application/json,.json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />
      <TopBarBtn icon={<History size={14} />} label="History" />
      <TopBarBtn
        icon={importing
          ? <span style={{ width: 14, height: 14, border: '2px solid #d1d5db', borderTopColor: '#6b7280', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.9s linear infinite' }} />
          : <Upload size={14} />}
        label={importing ? 'Importing…' : 'Import'}
        onClick={importing ? undefined : handleImportPick}
        title="Import a DWG, DXF, or ESP JSON file"
      />
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
    </div>
  </header>
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
