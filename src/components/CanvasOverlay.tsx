import React from 'react';

interface Props {
  zoom: number;
  worldX: number;
  worldY: number;
}

const pill: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #d4d8de',
  borderRadius: 6,
  boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
  userSelect: 'none',
  pointerEvents: 'none',
  position: 'absolute',
  zIndex: 20,
};

const CanvasOverlay: React.FC<Props> = ({ zoom, worldX, worldY }) => (
  <>
    {/* Zoom — clear of the centered bottom toolbar */}
    <div style={{
      ...pill,
      bottom: 130,
      right: 16,
      padding: '4px 11px',
      fontSize: 12,
      fontWeight: 500,
      color: '#374151',
      letterSpacing: '0.01em',
    }}>
      {Math.round(zoom * 100)}%
    </div>

    {/* World-space cursor coordinates */}
    <div style={{
      ...pill,
      bottom: 130,
      left: 16,
      padding: '4px 11px',
      fontSize: 11.5,
      color: '#374151',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      letterSpacing: '0.01em',
    }}>
      x:&nbsp;{worldX.toFixed(1)}&nbsp;&nbsp;y:&nbsp;{worldY.toFixed(1)}
    </div>
  </>
);

export default CanvasOverlay;
