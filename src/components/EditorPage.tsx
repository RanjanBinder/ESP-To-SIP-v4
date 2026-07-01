import React, { useEffect, useState } from 'react';
import TopBar from './TopBar';
import LeftSidebar from './LeftSidebar';
import Canvas from './Canvas';
import BottomToolbar from './BottomToolbar';
import RightPropertiesPanel from './RightPropertiesPanel';
import LayersPanel from './LayersPanel';
import SymbolsPanel from './SymbolsPanel';
import StylesPanel from './StylesPanel';
import CommentsPanel from './CommentsPanel';
import TablesPanel from './TablesPanel';
import CompareBar from './CompareBar';
import { useEditor } from '../store/editorStore';
import { useSODStore } from '../store/sodStore';
import { DEFAULT_DWG_META, fitDefaultDwgToViewport, loadDefaultDwgDocument } from '../lib/defaultDwgDocument';

const EditorPage: React.FC = () => {
  const { activeLeftPanel, loadDocument, setZoom, setPan } = useEditor();
  const { setStation, setCheckResult, setPanelOpen } = useSODStore();
  const [defaultLoad, setDefaultLoad] = useState<{ status: 'loading' | 'ready' | 'error'; message?: string }>({
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    setDefaultLoad({ status: 'loading' });
    loadDefaultDwgDocument()
      .then(doc => {
        if (cancelled) return;
        loadDocument(doc);
        setStation(DEFAULT_DWG_META.stationCode, DEFAULT_DWG_META.stationName);
        setCheckResult(null);
        setPanelOpen(false);
        setDefaultLoad({ status: 'ready', message: `${doc.objects.length} DWG objects loaded` });
        window.requestAnimationFrame(() => fitDefaultDwgToViewport(doc.objects, setZoom, setPan));
      })
      .catch(err => {
        if (cancelled) return;
        setDefaultLoad({
          status: 'error',
          message: err instanceof Error ? err.message : String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [loadDocument, setCheckResult, setPanelOpen, setPan, setStation, setZoom]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopBar />
      <CompareBar />
      <LeftSidebar />
      {activeLeftPanel === 'layers'   && <LayersPanel />}
      {activeLeftPanel === 'symbols'  && <SymbolsPanel />}
      {activeLeftPanel === 'styles'   && <StylesPanel />}
      {activeLeftPanel === 'comments' && <CommentsPanel />}
      {activeLeftPanel === 'tables'   && <TablesPanel />}
      <Canvas />
      <BottomToolbar />
      <RightPropertiesPanel />

      {defaultLoad.status !== 'ready' && (
        <div style={{
          position: 'fixed',
          top: 'calc(var(--header-h) + 16px)',
          left: 'calc(var(--sidebar-w) + var(--left-panel-w) + 16px)',
          zIndex: 260,
          background: defaultLoad.status === 'error' ? '#fef2f2' : '#ffffff',
          color: defaultLoad.status === 'error' ? '#991b1b' : '#374151',
          border: `1px solid ${defaultLoad.status === 'error' ? '#fecaca' : '#e5e7eb'}`,
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.12)',
          padding: '9px 12px',
          fontSize: 12.5,
          fontWeight: 600,
        }}>
          {defaultLoad.status === 'error' ? defaultLoad.message : `Loading ${DEFAULT_DWG_META.fileName}...`}
        </div>
      )}
    </div>
  );
};

export default EditorPage;
