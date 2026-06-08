import React from 'react';
import { useEditor } from '../store/editorStore';

interface Props {
  children?: React.ReactNode;
}

/**
 * Applies the pan+zoom transform so children render in world coordinates.
 * Place objects at (worldX, worldY) — the CSS transform handles screen mapping.
 */
const CanvasViewport: React.FC<Props> = ({ children }) => {
  const { viewport } = useEditor();
  const { zoom, panX, panY } = viewport;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        transformOrigin: '0 0',
        transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
      }}
    >
      {children}
    </div>
  );
};

export default CanvasViewport;
