import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Upload, ZoomIn, Hand, MousePointer2, AlertTriangle, Loader2 } from 'lucide-react';
import { AcApDocManager, AcEdOpenMode } from '@mlightcad/cad-simple-viewer';

/**
 * DxfWorkspace — embeds the @mlightcad/cad-simple-viewer engine (Three.js/WebGL)
 * as a dedicated DXF/DWG mode inside our React app. The engine is a global
 * singleton (AcApDocManager); we mount it once into our container the first time
 * this mode is activated and keep it alive (never destroy) so it survives
 * mode-toggling and React StrictMode's dev double-invoke. Worker URLs match the
 * files copied by vite-plugin-static-copy (see vite.config.ts).
 */

const WORKER_URLS = {
  dxfParser: '/assets/dxf-parser-worker.js',
  dwgParser: '/assets/libredwg-parser-worker.js',
  mtextRender: '/assets/mtext-renderer-worker.js',
};

/** App-lifetime guard so the singleton engine is created exactly once. */
let engineCreated = false;

const DxfWorkspace: React.FC<{ active: boolean }> = ({ active }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(engineCreated);
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Create the engine the first time this mode is shown (container is sized). */
  useEffect(() => {
    if (!active || engineCreated || !containerRef.current) return;
    try {
      const mgr = AcApDocManager.createInstance({
        container: containerRef.current,
        autoResize: true,
        webworkerFileUrls: WORKER_URLS,
        // Skip default (Chinese) font fetch for a self-contained first load;
        // fonts can be wired later for full MTEXT glyph fidelity.
        notLoadDefaultFonts: true,
      });
      if (mgr) {
        engineCreated = true;
        setReady(true);
      } else {
        setError('CAD engine failed to initialize.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [active]);

  const openFile = useCallback(async (file: File) => {
    if (!engineCreated) return;
    setBusy(true);
    setError(null);
    try {
      const content = await file.arrayBuffer();
      const ok = await AcApDocManager.instance.openDocument(file.name, content, {
        mode: AcEdOpenMode.Write,
      });
      if (ok) setFileName(file.name);
      else setError(`Could not open "${file.name}". Unsupported or corrupt file.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) openFile(file);
  };

  /** Run an engine command; unsupported commands are reported, not thrown. */
  const cmd = (name: string) => {
    if (!engineCreated) return;
    try {
      AcApDocManager.instance.sendStringToExecute(name);
    } catch {
      setError(`Command "${name}" is not available in this build.`);
      setTimeout(() => setError(null), 2000);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 'var(--header-h)', left: 0, right: 0, bottom: 0,
      display: active ? 'flex' : 'none', flexDirection: 'column',
      background: '#0f172a',
      zIndex: 80,
    }}>
      {/* Toolbar */}
      <div style={{
        height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 12px',
        background: '#111827', borderBottom: '1px solid #1f2937',
      }}>
        <input ref={fileInputRef} type="file" accept=".dxf,.dwg" onChange={onPick} style={{ display: 'none' }} />
        <DxfBtn primary icon={<Upload size={14} />} label="Open DXF / DWG" onClick={() => fileInputRef.current?.click()} />
        <div style={{ width: 1, height: 20, background: '#374151', margin: '0 4px' }} />
        <DxfBtn icon={<MousePointer2 size={14} />} label="Select" onClick={() => cmd('select')} />
        <DxfBtn icon={<Hand size={14} />} label="Pan" onClick={() => cmd('pan')} />
        <DxfBtn icon={<ZoomIn size={14} />} label="Zoom" onClick={() => cmd('zoom')} />

        <div style={{ flex: 1 }} />

        {busy && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#93c5fd', fontSize: 12 }}>
            <Loader2 size={13} className="spin" /> Loading…
          </span>
        )}
        {fileName && !busy && (
          <span style={{ color: '#cbd5e1', fontSize: 12, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {fileName}
          </span>
        )}
        {error && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fca5a5', fontSize: 12, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <AlertTriangle size={13} /> {error}
          </span>
        )}
      </div>

      {/* Engine canvas host */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        {!fileName && ready && !busy && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#64748b', gap: 10, pointerEvents: 'none',
          }}>
            <Upload size={36} strokeWidth={1.25} />
            <div style={{ fontSize: 14 }}>Open a DXF or DWG file to view and edit it here</div>
          </div>
        )}
      </div>
    </div>
  );
};

const DxfBtn: React.FC<{
  icon: React.ReactNode; label: string; onClick: () => void; primary?: boolean;
}> = ({ icon, label, onClick, primary }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        height: 30, padding: '0 11px',
        borderRadius: 7, border: '1px solid',
        borderColor: primary ? '#2563eb' : '#374151',
        background: primary ? (hov ? '#2563eb' : '#1d4ed8') : (hov ? '#1f2937' : 'transparent'),
        color: primary ? '#fff' : '#cbd5e1',
        fontSize: 12.5, fontWeight: 500, cursor: 'pointer',
        transition: 'background 0.12s',
      }}
    >
      {icon}
      {label}
    </button>
  );
};

export default DxfWorkspace;
