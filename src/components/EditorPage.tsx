import React from 'react';
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
import { useEditor } from '../store/editorStore';

const EditorPage: React.FC = () => {
  const { activeLeftPanel } = useEditor();

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopBar />
      <LeftSidebar />
      {activeLeftPanel === 'layers'   && <LayersPanel />}
      {activeLeftPanel === 'symbols'  && <SymbolsPanel />}
      {activeLeftPanel === 'styles'   && <StylesPanel />}
      {activeLeftPanel === 'comments' && <CommentsPanel />}
      {activeLeftPanel === 'tables'   && <TablesPanel />}
      <Canvas />
      <BottomToolbar />
      <RightPropertiesPanel />
    </div>
  );
};

export default EditorPage;
