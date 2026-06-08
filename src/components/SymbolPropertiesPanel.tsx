import React from 'react';
import { Eye, EyeOff, Lock, Unlock, Boxes } from 'lucide-react';
import { useEditor, flattenLayers, SymbolObject } from '../store/editorStore';
import {
  PropertySection, PropertyRow, NumberInput, PropertySelect, IconButton,
} from './ui';

const fmt = (n: number) => `${Math.round(n * 100) / 100}`;
const parse = (s: string) => parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;

const SymbolPropertiesPanel: React.FC<{ obj: SymbolObject }> = ({ obj }) => {
  const { updateObject, layers, symbols } = useEditor();
  const layerOptions = flattenLayers(layers).map(l => ({ value: l.id, label: l.name }));
  const set = (patch: Partial<SymbolObject>) => updateObject(obj.id, patch);
  const def = symbols.find(s => s.id === obj.symbolId);

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff' }}>

      <PropertySection title="Selection (Symbol)">
        <PropertyRow label="Name">
          <input
            value={obj.name}
            onChange={e => set({ name: e.target.value })}
            style={{
              width: '100%', minWidth: 0, height: 32, boxSizing: 'border-box',
              background: '#f4f4f5', border: '1px solid transparent', borderRadius: 8,
              padding: '0 9px', fontSize: 13, color: '#111827', outline: 'none',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#f4f4f5'; }}
          />
        </PropertyRow>

        <PropertyRow label="Layer">
          <PropertySelect value={obj.layerId} options={layerOptions} onChange={v => set({ layerId: v })} />
        </PropertyRow>

        <PropertyRow label="Status" noBorder>
          <div style={{ display: 'flex', background: '#f4f4f5', borderRadius: 8, padding: 2, gap: 1, height: 32 }}>
            <IconButton title={obj.locked ? 'Unlock' : 'Lock'} active={obj.locked} onClick={() => set({ locked: !obj.locked })}>
              {obj.locked ? <Lock size={13} strokeWidth={1.75} /> : <Unlock size={13} strokeWidth={1.75} />}
            </IconButton>
            <IconButton title={obj.visible ? 'Hide' : 'Show'} active={obj.visible} onClick={() => set({ visible: !obj.visible })}>
              {obj.visible ? <Eye size={13} strokeWidth={1.75} /> : <EyeOff size={13} strokeWidth={1.75} />}
            </IconButton>
          </div>
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Instance">
        <PropertyRow label="Symbol" noBorder>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
            <Boxes size={14} color="#64748b" strokeWidth={1.6} style={{ flexShrink: 0 }} />
            <span style={{
              fontSize: 13, color: '#374151',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {obj.label}{def ? ` · ${def.dimensions}` : ''}
            </span>
          </div>
        </PropertyRow>
      </PropertySection>

      <PropertySection title="Geometry">
        <PropertyRow label="X, Y">
          <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
            <NumberInput value={fmt(obj.x)} onChange={v => set({ x: parse(v) })} />
            <NumberInput value={fmt(obj.y)} onChange={v => set({ y: parse(v) })} />
          </div>
        </PropertyRow>
        <PropertyRow label="W, H" noBorder>
          <div style={{ flex: 1, display: 'flex', gap: 4, minWidth: 0 }}>
            <NumberInput value={fmt(obj.width)} onChange={v => set({ width: Math.max(1, parse(v)) })} />
            <NumberInput value={fmt(obj.height)} onChange={v => set({ height: Math.max(1, parse(v)) })} />
          </div>
        </PropertyRow>
      </PropertySection>
    </div>
  );
};

export default SymbolPropertiesPanel;
