import React, { useState } from 'react';
import TopBar from './TopBar';
import DxfWorkspace from './DxfWorkspace';
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

const EditorPage: React.FC = () => {
  const { activeLeftPanel } = useEditor();
  const [dwgViewerOpen, setDwgViewerOpen] = useState(false);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopBar onOpenDwgViewer={() => setDwgViewerOpen(true)} />
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

      {/* Faithful DWG/DXF viewer (WebGL) — mounts once, overlays fullscreen when open */}
      <DxfWorkspace active={dwgViewerOpen} onExit={() => setDwgViewerOpen(false)} />
    </div>
  );
};

export default EditorPage;
