import React from 'react';
import { useEditor } from '../store/editorStore';

const CanvasAxis: React.FC = () => {
  const { viewport, canvasSettings } = useEditor();

  if (!canvasSettings.axisVisible) return null;

  const { panX, panY } = viewport;

  return (
    <>
      {/* X axis: horizontal line at world Y=0, appears at screen Y = panY */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: panY,
          height: 1,
          background: 'rgba(239,68,68,0.40)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
      {/* Y axis: vertical line at world X=0, appears at screen X = panX */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: panX,
          width: 1,
          background: 'rgba(34,197,94,0.40)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />
    </>
  );
};

export default CanvasAxis;
