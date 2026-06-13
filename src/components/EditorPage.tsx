import React, { useState, useMemo } from 'react';
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
import SectionConfigModal, { RowConfig } from './SectionConfigModal';
import { useEditor } from '../store/editorStore';

const MAIN_LINE_LAYER_ID = 'main-line';
const DEFAULT_TRACKS = ['Up Main Line', 'Down Main Line'];

const EditorPage: React.FC = () => {
  const { activeLeftPanel, objects } = useEditor();
  const [showSectionConfig, setShowSectionConfig] = useState(false);

  /* Detect main-line tracks from canvas objects; fall back to defaults */
  const detectedTracks = useMemo(() => {
    const names = objects
      .filter(o => o.layerId === MAIN_LINE_LAYER_ID && o.name)
      .map(o => o.name);
    const unique = [...new Set(names)];
    return unique.length > 0 ? unique : DEFAULT_TRACKS;
  }, [objects]);

  const handleSipGenerate = (rows: RowConfig[]) => {
    console.info('[SIP] Section configuration submitted:', rows);
    setShowSectionConfig(false);
    /* TODO: pass rows into the SIP generation pipeline */
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopBar onGenerateSip={() => setShowSectionConfig(true)} />
      <LeftSidebar />
      {activeLeftPanel === 'layers'   && <LayersPanel />}
      {activeLeftPanel === 'symbols'  && <SymbolsPanel />}
      {activeLeftPanel === 'styles'   && <StylesPanel />}
      {activeLeftPanel === 'comments' && <CommentsPanel />}
      {activeLeftPanel === 'tables'   && <TablesPanel />}
      <Canvas />
      <BottomToolbar />
      <RightPropertiesPanel />

      {showSectionConfig && (
        <SectionConfigModal
          trackNames={detectedTracks}
          onClose={() => setShowSectionConfig(false)}
          onGenerate={handleSipGenerate}
        />
      )}
    </div>
  );
};

export default EditorPage;
