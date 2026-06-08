import React from 'react';
import { Boxes } from 'lucide-react';
import { SymbolObject } from '../store/editorStore';

/** Renders a placed symbol instance as a labelled block reference. Pure render —
 *  selection/move/hover handled by the canvas via `data-object-id`. */
const SymbolView: React.FC<{
  symbol: SymbolObject;
  selected: boolean;
  hovered: boolean;
}> = ({ symbol, selected, hovered }) => {
  if (!symbol.visible) return null;

  const borderColor = selected ? '#3b82f6' : hovered ? '#93c5fd' : '#cbd5e1';
  const iconSize = Math.max(12, Math.min(22, symbol.height * 0.38));
  const fontSize = Math.max(9, Math.min(12, symbol.height * 0.2));

  return (
    <div
      data-object-id={symbol.id}
      style={{
        position: 'absolute',
        left: symbol.x, top: symbol.y, width: symbol.width, height: symbol.height,
        transform: `rotate(${symbol.rotation}deg) scale(${(symbol.scale ?? 100) / 100})`,
        transformOrigin: 'top left',
        border: `1.5px ${selected || hovered ? 'solid' : 'dashed'} ${borderColor}`,
        borderRadius: 6,
        background: '#f8fafc',
        boxShadow: selected ? '0 0 0 1.5px #3b82f6' : undefined,
        boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 4,
        padding: 4, overflow: 'hidden',
        cursor: 'move', userSelect: 'none',
      }}
    >
      <Boxes size={iconSize} color="#64748b" strokeWidth={1.6} />
      <span style={{
        fontSize, color: '#475569', fontWeight: 600, lineHeight: 1.1,
        maxWidth: '100%', textAlign: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {symbol.label}
      </span>
    </div>
  );
};

export default SymbolView;
