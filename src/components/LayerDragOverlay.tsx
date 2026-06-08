import React from 'react';
import { Layer } from '../store/editorStore';

interface Props {
  layer: Layer;
}

/** Floating card shown while a layer is being dragged. */
const LayerDragOverlay: React.FC<Props> = ({ layer }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 8,
    height: 34, padding: '0 10px',
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)',
    opacity: 0.92,
    cursor: 'grabbing',
    userSelect: 'none',
    minWidth: 180,
  }}>
    <div style={{
      width: 10, height: 10, borderRadius: 2,
      background: layer.color,
      border: '1px solid rgba(0,0,0,0.10)',
      flexShrink: 0,
    }} />
    <span style={{
      fontSize: 13, fontWeight: 500, color: '#111827',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}>
      {layer.name}
    </span>
  </div>
);

export default LayerDragOverlay;
