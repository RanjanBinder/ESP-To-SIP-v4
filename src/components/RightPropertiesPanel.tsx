import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Link, ChevronRight, ChevronDown, ChevronUp,
  Plus, Eye, EyeOff, Lock, Unlock, Layers,
  Crosshair, Trash2, Check, X,
} from 'lucide-react';
import { useEditor, Layer, flattenLayers, isDescendantOf, isShape, isSymbol } from '../store/editorStore';
import {
  BASE_GRID_OPTIONS, MAJOR_GRID_OPTIONS, SNAP_OPTIONS, GRID_UNIT_OPTIONS,
  BaseGridPreset, MajorGridPreset, SnapPreset, GridUnit,
} from '../lib/grid';
import TextPropertiesPanel from './TextPropertiesPanel';
import ShapePropertiesPanel from './ShapePropertiesPanel';
import SymbolPropertiesPanel from './SymbolPropertiesPanel';
import SODViolationsPanel from './SODViolationsPanel';
import ChangeListPanel from './ChangeListPanel';
import { useSODStore } from '../store/sodStore';
import { useCompareStore } from '../store/compareStore';
import {
  SegmentedControl, PropertySelect, ColorValueInput, PropertyRow, PropertySection,
} from './ui';

/* ═══════════════════════════════════════════════════════════════════
   Canvas Settings panel (default state)
════════════════════════════════════════════════════════════════════ */

const STROKE_SCALES = ['1:1','1:5','1:10','1:20','1:40','1:50','1:100','1:200','1:500','1:1000']
  .map(s => ({ value: s, label: s }));

const UNITS = ['Meters','Feet','Millimeters','Kilometers','Miles']
  .map(u => ({ value: u, label: u }));

const CanvasSettingsPanel: React.FC = () => {
  const {
    canvasSettings, updateCanvasSettings,
    layers, activeLayerId, setActiveLayer,
  } = useEditor();

  const cs = canvasSettings;
  const flatLayers = flattenLayers(layers);
  const layerOptions = flatLayers.map(l => ({ value: l.id, label: l.name }));

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

      {/* ── Section 1: Model ──────────────────────────────────────── */}
      <PropertySection title="Model">
        <PropertyRow label="Name">
          <span style={{ fontSize: 12.5, color: '#374151' }}>{cs.modelName}</span>
        </PropertyRow>
        <PropertyRow label="Owner" noBorder>
          <span style={{ fontSize: 12.5, color: '#374151' }}>{cs.owner}</span>
        </PropertyRow>
      </PropertySection>

      {/* ── Section 2: Model Canvas ───────────────────────────────── */}
      <PropertySection title="Model Canvas">
        <PropertyRow label="Name">
          <span style={{ fontSize: 12.5, color: '#374151' }}>{cs.canvasName}</span>
        </PropertyRow>

        <PropertyRow label="Wireframe">
          <SegmentedControl
            options={['On', 'Off']}
            value={cs.wireframe ? 'On' : 'Off'}
            onChange={v => updateCanvasSettings({ wireframe: v === 'On' })}
          />
        </PropertyRow>

        <PropertyRow label="Axis">
          <SegmentedControl
            options={['Show', 'Hide']}
            value={cs.axisVisible ? 'Show' : 'Hide'}
            onChange={v => updateCanvasSettings({ axisVisible: v === 'Show' })}
          />
        </PropertyRow>

        <PropertyRow label="Views">
          <SegmentedControl
            options={['Show', 'Hide']}
            value={cs.viewsVisible ? 'Show' : 'Hide'}
            onChange={v => updateCanvasSettings({ viewsVisible: v === 'Show' })}
          />
        </PropertyRow>

        <PropertyRow label="Stroke scale">
          <PropertySelect
            value={cs.strokeScale}
            options={STROKE_SCALES}
            onChange={v => updateCanvasSettings({ strokeScale: v })}
          />
        </PropertyRow>

        <PropertyRow label="Background">
          <ColorValueInput
            value={cs.background}
            onChange={v => updateCanvasSettings({ background: v })}
          />
        </PropertyRow>

        <PropertyRow label="Active layer">
          <PropertySelect
            value={activeLayerId}
            options={layerOptions}
            onChange={v => setActiveLayer(v)}
            style={{ maxWidth: 130 }}
          />
        </PropertyRow>

        <PropertyRow label="Unit" noBorder>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PropertySelect
              value={cs.unit}
              options={UNITS}
              onChange={v => updateCanvasSettings({ unit: v })}
            />
            <button style={{
              fontSize: 11, color: '#6b7280',
              padding: '3px 8px', borderRadius: 6,
              background: '#f4f4f5', border: 'none',
              cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: 'inherit',
            }}>
              More
            </button>
          </div>
        </PropertyRow>
      </PropertySection>

      {/* ── Section 3: Schematic Grid ────────────────────────────── */}
      <PropertySection title="Schematic Grid" defaultOpen>

        <PropertyRow label="Grid">
          <SegmentedControl
            options={['Show', 'Hide']}
            value={cs.gridVisible ? 'Show' : 'Hide'}
            onChange={v => updateCanvasSettings({ gridVisible: v === 'Show' })}
          />
        </PropertyRow>

        <PropertyRow label="Snap">
          <SegmentedControl
            options={['On', 'Off']}
            value={cs.gridSettings.snapEnabled ? 'On' : 'Off'}
            onChange={v => updateCanvasSettings({
              gridSettings: { ...cs.gridSettings, snapEnabled: v === 'On' },
            })}
          />
        </PropertyRow>

        <PropertyRow label="Grid unit">
          <PropertySelect
            value={cs.gridSettings.gridUnit}
            options={GRID_UNIT_OPTIONS as unknown as { value: string; label: string }[]}
            onChange={v => updateCanvasSettings({
              gridSettings: { ...cs.gridSettings, gridUnit: v as GridUnit },
            })}
            style={{ maxWidth: 150 }}
          />
        </PropertyRow>

        <PropertyRow label="Base grid">
          <PropertySelect
            value={cs.gridSettings.baseGrid}
            options={BASE_GRID_OPTIONS as unknown as { value: string; label: string }[]}
            onChange={v => updateCanvasSettings({
              gridSettings: { ...cs.gridSettings, baseGrid: v as BaseGridPreset },
            })}
            style={{ maxWidth: 150 }}
          />
        </PropertyRow>

        <PropertyRow label="Major grid">
          <PropertySelect
            value={cs.gridSettings.majorGrid}
            options={MAJOR_GRID_OPTIONS as unknown as { value: string; label: string }[]}
            onChange={v => updateCanvasSettings({
              gridSettings: { ...cs.gridSettings, majorGrid: v as MajorGridPreset },
            })}
            style={{ maxWidth: 150 }}
          />
        </PropertyRow>

        <PropertyRow label="Snap spacing" noBorder>
          <PropertySelect
            value={cs.gridSettings.snapPreset}
            options={SNAP_OPTIONS as unknown as { value: string; label: string }[]}
            onChange={v => updateCanvasSettings({
              gridSettings: { ...cs.gridSettings, snapPreset: v as SnapPreset },
            })}
            style={{ maxWidth: 150 }}
          />
        </PropertyRow>

      </PropertySection>

      {/* ── Section 4: Custom Properties ─────────────────────────── */}
      <PropertySection
        title="Custom properties"
        defaultOpen={false}
        rightSlot={
          <button
            title="Add property"
            onClick={e => e.stopPropagation()}
            style={{
              width: 20, height: 20, borderRadius: 4, border: 'none',
              background: 'transparent', color: '#9ca3af',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={12} strokeWidth={2} />
          </button>
        }
      >
        {/* Sub-header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 14px 8px',
        }}>
          <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
            Model properties
          </span>
          <Plus size={11} strokeWidth={2} color="#9ca3af" style={{ cursor: 'pointer' }} />
        </div>

        {/* Empty state */}
        <div style={{ padding: '8px 14px 12px' }}>
          <p style={{
            fontSize: 11.5, color: '#9ca3af',
            lineHeight: 1.55, margin: 0,
          }}>
            Add custom properties to your model.{' '}
            <span style={{ color: '#3b82f6', cursor: 'pointer', textDecoration: 'underline' }}>
              Learn more
            </span>
          </p>
        </div>
      </PropertySection>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Layer Properties panel (when a layer is selected)
════════════════════════════════════════════════════════════════════ */

/* ── Editable opacity badge — no native spinners, no clipping ────── */
const OpacityBadge: React.FC<{
  value: number;             // 0–100 integer
  onChange: (v: number) => void;
}> = ({ value, onChange }) => {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(value.toString());

  // Keep draft in sync when slider moves
  if (!editing && draft !== value.toString()) setDraft(value.toString());

  const commit = () => {
    const n = Math.max(0, Math.min(100, parseInt(draft) || 0));
    onChange(n);
    setDraft(n.toString());
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={e => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setDraft(value.toString()); } }}
        style={{
          width: 52, fontSize: 12.5, fontWeight: 500,
          textAlign: 'center', color: '#111827',
          border: '1.5px solid #3b82f6', borderRadius: 7,
          padding: '3px 6px', outline: 'none', background: '#fff',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <button
      onClick={() => { setDraft(value.toString()); setEditing(true); }}
      title="Click to edit"
      style={{
        width: 52, fontSize: 12.5, fontWeight: 500, textAlign: 'center',
        color: '#111827', background: '#f4f4f5',
        border: '1px solid #e5e7eb', borderRadius: 7,
        padding: '3px 6px', cursor: 'text', flexShrink: 0,
        fontFamily: 'inherit',
      }}
    >
      {value}%
    </button>
  );
};

/* ── Status icon button ──────────────────────────────────────────── */
/* ── Parent layer select ─────────────────────────────────────────── */
const ParentLayerSelect: React.FC<{
  layers: Layer[];
  currentId: string;
  parentId: string | null;
  onChange: (parentId: string | null) => void;
}> = ({ layers, currentId, parentId, onChange }) => {
  const flat = flattenLayers(layers).filter(l =>
    l.id !== currentId && !isDescendantOf(layers, currentId, l.id),
  );
  return (
    <select
      value={parentId ?? '__root__'}
      onChange={e => onChange(e.target.value === '__root__' ? null : e.target.value)}
      style={{
        width: '100%',
        minWidth: 0,
        height: 32,
        background: '#f4f4f5',
        border: '1px solid transparent', borderRadius: 8,
        padding: '0 8px', fontSize: 13,
        color: '#111827', cursor: 'pointer', outline: 'none',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#f4f4f5'; }}
    >
      <option value="__root__">Root</option>
      {flat.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
    </select>
  );
};

/* ── Custom property row ─────────────────────────────────────────── */
const CustomPropertyRow: React.FC<{
  name: string;
  value: string;
  onChangeName: (v: string) => void;
  onChangeValue: (v: string) => void;
  onDelete: () => void;
}> = ({ name, value, onChangeName, onChangeValue, onDelete }) => {
  const [hov, setHov] = useState(false);
  const cellInput: React.CSSProperties = {
    flex: 1, fontSize: 12, color: '#111827',
    border: '1px solid transparent', borderRadius: 5,
    padding: '4px 6px', outline: 'none', background: 'transparent', minWidth: 0,
  };
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        marginInline: 14, marginBlock: 2,
        background: hov ? '#f9fafb' : 'transparent',
        border: '1px solid',
        borderColor: hov ? '#e5e7eb' : 'transparent',
        borderRadius: 8, overflow: 'hidden',
      }}
    >
      <input
        value={name}
        onChange={e => onChangeName(e.target.value)}
        placeholder="Name"
        style={{ ...cellInput, color: '#6b7280', borderRight: '1px solid #f0f0f0' }}
        onFocus={e => (e.currentTarget.style.background = '#fff')}
        onBlur={e => (e.currentTarget.style.background = 'transparent')}
      />
      <input
        value={value}
        onChange={e => onChangeValue(e.target.value)}
        placeholder="Value"
        style={{ ...cellInput }}
        onFocus={e => (e.currentTarget.style.background = '#fff')}
        onBlur={e => (e.currentTarget.style.background = 'transparent')}
      />
      <button
        onClick={onDelete}
        title="Delete"
        style={{
          width: hov ? 28 : 0, height: 28, border: 'none',
          background: 'transparent', color: '#9ca3af',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', padding: 0, overflow: 'hidden',
          transition: 'width 0.12s',
        }}
      >
        <Trash2 size={11} strokeWidth={1.75} />
      </button>
    </div>
  );
};

/* ── Status button with label ────────────────────────────────────── */
const StatusBtn: React.FC<{
  active: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, title, onClick, children }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%',
        minWidth: 0,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        borderRadius: 6,
        border: 'none',
        background: active ? '#ffffff' : hov ? '#ebebec' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.14)' : 'none',
        color: active ? '#111827' : '#6b7280',
        cursor: 'pointer',
        transition: 'background 0.1s, box-shadow 0.1s, color 0.1s',
      }}
    >
      {children}
    </button>
  );
};

/* ── Full layer properties panel ─────────────────────────────────── */
const LayerPropertiesPanel: React.FC<{ layer: Layer }> = ({ layer }) => {
  const {
    layers, activeLayerId, setActiveLayer,
    updateLayer,
    updateLayerParent,
    addLayerCustomProperty, updateLayerCustomProperty, deleteLayerCustomProperty,
  } = useEditor();

  const [addingProp,   setAddingProp]   = useState(false);
  const [newPropName,  setNewPropName]  = useState('');
  const [newPropValue, setNewPropValue] = useState('');

  const isActive   = activeLayerId === layer.id;
  const propCount  = layer.customProperties?.length ?? 0;
  const opacityPct = Math.round(layer.opacity * 100);

  const commitNewProp = useCallback(() => {
    if (!newPropName.trim()) return;
    addLayerCustomProperty(layer.id, { name: newPropName.trim(), value: newPropValue });
    setNewPropName(''); setNewPropValue(''); setAddingProp(false);
  }, [layer.id, newPropName, newPropValue, addLayerCustomProperty]);

  const cancelNewProp = useCallback(() => {
    setNewPropName(''); setNewPropValue(''); setAddingProp(false);
  }, []);

  const focusBlue = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#3b82f6'; };
  const blurGrey  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = '#d1d5db'; };

  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '86px minmax(0, 1fr)',
    columnGap: 8,
    alignItems: 'center',
    padding: '0 8px',
    minHeight: 36,
    width: '100%',
    boxSizing: 'border-box',
    borderBottom: '1px solid #f3f4f6',
  };
  const label: React.CSSProperties = {
    fontSize: 13,
    color: '#6b7280',
    minWidth: 0,
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: '#fff' }}>

      {/* ══ Selection — always visible, non-collapsible header ═══════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 14px', height: 32,
        background: '#fafafa', borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>Selection (1)</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Layer</span>
      </div>

      {/* ── Name — icon prefix inside the field ──────────────────────── */}
      <div style={{ ...row }}>
        <span style={label}>Name</span>
        <label style={{
          width: '100%',
          minWidth: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          height: 32,
          border: '1px solid transparent', borderRadius: 8,
          padding: '0 9px', background: '#f4f4f5', cursor: 'text',
          transition: 'border-color 0.1s, background 0.1s',
          boxSizing: 'border-box',
        }}>
          <Layers size={12} color="#9ca3af" strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <input
            value={layer.name}
            onChange={e => updateLayer(layer.id, { name: e.target.value })}
            style={{
              flex: 1, minWidth: 0, fontSize: 13, color: '#111827',
              border: 'none', outline: 'none', background: 'transparent',
              fontFamily: 'inherit', padding: '5px 0',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onFocus={e => { const el = e.currentTarget.closest('label') as HTMLElement; el.style.borderColor = '#2563eb'; el.style.background = '#fff'; }}
            onBlur={e => { const el = e.currentTarget.closest('label') as HTMLElement; el.style.borderColor = 'transparent'; el.style.background = '#f4f4f5'; }}
          />
        </label>
      </div>

      {/* ── Layer (parent) ────────────────────────────────────────────── */}
      <div style={{ ...row }}>
        <span style={{ ...label, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Layers size={12} color="#9ca3af" strokeWidth={1.75} style={{ flexShrink: 0 }} />
          Layer
        </span>
        <ParentLayerSelect
          layers={layers}
          currentId={layer.id}
          parentId={layer.parentId}
          onChange={newParentId => updateLayerParent(layer.id, newParentId)}
        />
      </div>

      {/* ── Color ────────────────────────────────────────────────────── */}
      <div style={{ ...row }}>
        <span style={label}>Color</span>
        <ColorValueInput
          value={layer.color}
          onChange={v => updateLayer(layer.id, { color: v })}
        />
      </div>

      {/* ── Opacity — single row: label | slider | badge ─────────────── */}
      <div style={{ ...row }}>
        <span style={label}>Opacity</span>
        <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range" min={0} max={100} value={opacityPct}
            onChange={e => updateLayer(layer.id, { opacity: parseInt(e.target.value) / 100 })}
            style={{ flex: 1, accentColor: '#3b82f6', cursor: 'pointer', margin: 0, minWidth: 0 }}
          />
          <OpacityBadge
            value={opacityPct}
            onChange={v => updateLayer(layer.id, { opacity: v / 100 })}
          />
        </div>
      </div>

      {/* ── Status — 4 explicit icon buttons ─────────────────────────── */}
      <div style={{ padding: '8px', borderBottom: '1px solid #e5e7eb', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>Status</span>
          {isActive && (
            <span style={{ fontSize: 10.5, color: '#2563eb', fontWeight: 600,
              background: '#eff6ff', borderRadius: 5, padding: '2px 7px' }}>
              Active layer
            </span>
          )}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 2,
          width: '100%',
          height: 32,
          background: '#f4f4f5',
          padding: 2,
          borderRadius: 8,
          boxSizing: 'border-box',
        }}>
          {/* Unlock */}
          <StatusBtn
            active={!layer.locked}
            title="Unlock this layer"
            onClick={() => updateLayer(layer.id, { locked: false })}
          >
            <Unlock size={14} strokeWidth={1.75} />
          </StatusBtn>
          {/* Lock */}
          <StatusBtn
            active={layer.locked}
            title="Lock this layer"
            onClick={() => updateLayer(layer.id, { locked: true })}
          >
            <Lock size={14} strokeWidth={1.75} />
          </StatusBtn>
          {/* Show */}
          <StatusBtn
            active={layer.visible}
            title="Make layer visible"
            onClick={() => updateLayer(layer.id, { visible: true })}
          >
            <Eye size={14} strokeWidth={1.75} />
          </StatusBtn>
          {/* Hide */}
          <StatusBtn
            active={!layer.visible}
            title="Hide this layer"
            onClick={() => updateLayer(layer.id, { visible: false })}
          >
            <EyeOff size={14} strokeWidth={1.75} />
          </StatusBtn>
        </div>
        {/* Set active */}
        {!isActive && (
          <button
            onClick={() => setActiveLayer(layer.id)}
            style={{
              marginTop: 8, width: '100%', padding: '6px 10px',
              border: '1px solid #d1d5db', borderRadius: 7,
              background: 'transparent', color: '#374151',
              fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
            }}
          >
            <Crosshair size={13} strokeWidth={1.75} color="#6b7280" />
            Set as active layer
          </button>
        )}
      </div>

      {/* ── Custom properties section ─────────────────────────────── */}
      <PropertySection
        title={`Custom properties${propCount > 0 ? ` (${propCount})` : ''}`}
        defaultOpen={propCount > 0}
        rightSlot={
          <button
            title="Add property"
            onClick={e => { e.stopPropagation(); setAddingProp(true); }}
            style={{
              width: 22, height: 22, borderRadius: 5, border: 'none',
              background: 'transparent', color: '#6b7280',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={13} strokeWidth={2} />
          </button>
        }
      >
        {/* Column headers */}
        <div style={{ display: 'flex', padding: '4px 14px 2px', gap: 4 }}>
          <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Name</span>
          <span style={{ flex: 1, fontSize: 10.5, fontWeight: 600, color: '#9ca3af', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Value</span>
          <div style={{ width: 28 }} />
        </div>

        {/* Existing rows */}
        {(layer.customProperties ?? []).map(prop => (
          <CustomPropertyRow
            key={prop.id}
            name={prop.name}
            value={prop.value}
            onChangeName={v => updateLayerCustomProperty(layer.id, prop.id, { name: v })}
            onChangeValue={v => updateLayerCustomProperty(layer.id, prop.id, { value: v })}
            onDelete={() => deleteLayerCustomProperty(layer.id, prop.id)}
          />
        ))}

        {/* Inline add form */}
        {addingProp && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 14px 6px' }}>
            <input
              autoFocus
              placeholder="Name"
              value={newPropName}
              onChange={e => setNewPropName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNewProp(); if (e.key === 'Escape') cancelNewProp(); }}
              style={{
                flex: 1, fontSize: 12, padding: '5px 8px', minWidth: 0,
                border: '1px solid #d1d5db', borderRadius: 7,
                outline: 'none', background: '#fafafa', color: '#6b7280',
              }}
              onFocus={focusBlue} onBlur={blurGrey}
            />
            <input
              placeholder="Value"
              value={newPropValue}
              onChange={e => setNewPropValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNewProp(); if (e.key === 'Escape') cancelNewProp(); }}
              style={{
                flex: 1, fontSize: 12, padding: '5px 8px', minWidth: 0,
                border: '1px solid #d1d5db', borderRadius: 7,
                outline: 'none', background: '#fafafa', color: '#111827',
              }}
              onFocus={focusBlue} onBlur={blurGrey}
            />
            <button onClick={commitNewProp} title="Save" style={{ width: 28, height: 28, border: 'none', borderRadius: 7, background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Check size={13} strokeWidth={2.5} />
            </button>
            <button onClick={cancelNewProp} title="Cancel" style={{ width: 28, height: 28, border: 'none', borderRadius: 7, background: '#f3f4f6', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={13} strokeWidth={2} />
            </button>
          </div>
        )}

        {/* Empty state */}
        {propCount === 0 && !addingProp && (
          <div style={{ padding: '10px 14px 14px' }}>
            <button
              onClick={() => setAddingProp(true)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1.5px dashed #d1d5db', borderRadius: 8,
                background: 'transparent', color: '#6b7280',
                fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
              }}
            >
              <Plus size={13} strokeWidth={2} />
              Add a property
            </button>
          </div>
        )}

      </PropertySection>

    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   BottomScaleStatus — Rayon-style sticky bottom strip
════════════════════════════════════════════════════════════════════ */

/* ── MenuRow ─────────────────────────────────────────────────────── */
const MenuRow: React.FC<{
  label: string;
  shortcut?: React.ReactNode;
  onClick: () => void;
}> = ({ label, shortcut, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center',
        height: 30, padding: '0 12px',
        background: hov ? '#f3f4f6' : 'transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.08s',
      }}
    >
      <span style={{ flex: 1, fontSize: 12.5, color: '#111827' }}>{label}</span>
      {shortcut !== undefined && (
        <span style={{
          fontSize: 11, color: '#9ca3af',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          display: 'flex', alignItems: 'center',
        }}>
          {shortcut}
        </span>
      )}
    </div>
  );
};

/* ── CanvasSettingsMenu ───────────────────────────────────────────── */
const CanvasSettingsMenu: React.FC<{
  zoom: number;
  setZoom: (z: number) => void;
  onClose: () => void;
}> = ({ zoom, setZoom, onClose }) => (
  <div style={{
    position: 'absolute',
    bottom: 'calc(100% + 6px)',
    right: 0,
    width: 230,
    background: '#ffffff',
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    boxShadow: '0 8px 28px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 400,
    padding: '6px 0',
  }}>
    {/* Header */}
    <div style={{
      padding: '4px 12px 8px',
      fontSize: 10.5, fontWeight: 600,
      color: '#6b7280', letterSpacing: '0.07em',
      textTransform: 'uppercase',
      borderBottom: '1px solid #f0f1f3',
    }}>
      Viewport
    </div>

    <MenuRow label="Length unit" shortcut={<ChevronRight size={12} strokeWidth={2} />} onClick={onClose} />
    <MenuRow label="Area unit"   shortcut={<ChevronRight size={12} strokeWidth={2} />} onClick={onClose} />

    <div style={{ height: 1, background: '#f0f1f3', margin: '4px 0' }} />

    <MenuRow label="Zoom in"           shortcut="+"  onClick={() => { setZoom(Math.min(zoom * 1.25, 8)); onClose(); }} />
    <MenuRow label="Zoom out"          shortcut="−"  onClick={() => { setZoom(Math.max(zoom * 0.8, 0.005)); onClose(); }} />
    <MenuRow label="Zoom to selection" shortcut="⇧Z" onClick={onClose} />
    <MenuRow label="Zoom to 50%"                     onClick={() => { setZoom(0.5); onClose(); }} />
    <MenuRow label="Zoom to 100%"                    onClick={() => { setZoom(1);   onClose(); }} />
    <MenuRow label="Zoom to 200%"                    onClick={() => { setZoom(2);   onClose(); }} />
  </div>
);

/* ── ScaleRuler ──────────────────────────────────────────────────── */
const TICKS = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];

const ScaleRuler: React.FC<{
  text: string;
  menuOpen: boolean;
  onClick: () => void;
}> = ({ text, menuOpen, onClick }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1,
      height: 36, borderRadius: 8,
      background: menuOpen ? '#e8ebef' : '#f4f4f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '5px 10px 4px',
      cursor: 'pointer',
      transition: 'background 0.1s',
      overflow: 'hidden',
    }}
  >
    {/* Measurement text */}
    <span style={{
      fontSize: 11.5,
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      color: '#111827', fontWeight: 500,
      letterSpacing: '0.025em', lineHeight: 1,
    }}>
      {text}
    </span>

    {/* Ruler — line + tick marks */}
    <svg width="100%" height="10" style={{ display: 'block', overflow: 'visible' }}>
      {/* Baseline */}
      <line x1="0" y1="2" x2="100%" y2="2" stroke="#c8cdd5" strokeWidth="1" />
      {/* Ticks */}
      {TICKS.map((pct, i) => {
        const isMajor = i === 0 || i === 4 || i === 8;
        const isMid   = i === 2 || i === 6;
        const y2      = isMajor ? 9 : isMid ? 7 : 5;
        return (
          <line
            key={i}
            x1={`${pct}%`} y1="2"
            x2={`${pct}%`} y2={y2}
            stroke="#a8adb8" strokeWidth="1"
          />
        );
      })}
    </svg>
  </div>
);

/* ── SmallChevronBtn ─────────────────────────────────────────────── */
const SmallChevronBtn: React.FC<{
  up?: boolean;
  active?: boolean;
  onClick?: () => void;
}> = ({ up = true, active, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 20, height: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none',
        background: (hov || active) ? '#f0f1f3' : 'transparent',
        color: active ? '#374151' : '#9ca3af',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      {up
        ? <ChevronUp size={10} strokeWidth={2.5} />
        : <ChevronDown size={10} strokeWidth={2.5} />
      }
    </button>
  );
};

/* ── BottomScaleStatus ───────────────────────────────────────────── */
const BottomScaleStatus: React.FC = () => {
  const { canvasSettings, viewport, setZoom } = useEditor();
  const [menuOpen, setMenuOpen] = useState(false);
  const stripRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: MouseEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [menuOpen]);

  const toggle = () => setMenuOpen(o => !o);

  return (
    <div
      ref={stripRef}
      style={{
        height: 48,
        display: 'flex', alignItems: 'center',
        padding: '0 8px', gap: 4,
        borderTop: '1px solid #e5e7eb',
        background: '#ffffff',
        flexShrink: 0,
        width: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Dropdown menu — uses viewport.zoom so it actually affects the canvas */}
      {menuOpen && (
        <CanvasSettingsMenu
          zoom={viewport.zoom}
          setZoom={setZoom}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {/* Link icon — always-on blue */}
      <button style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: 'none',
        background: '#eff6ff', color: '#2563eb',
        cursor: 'pointer', flexShrink: 0,
      }}>
        <Link size={14} strokeWidth={2} />
      </button>

      {/* Small up chevron beside link */}
      <SmallChevronBtn up />

      {/* Scale ruler pill — shows live viewport zoom */}
      <ScaleRuler
        text={`${Math.round(viewport.zoom * 100)}%  ·  ${canvasSettings.scaleDisplayText}`}
        menuOpen={menuOpen}
        onClick={toggle}
      />

      {/* Right chevron — rotates when menu open */}
      <button
        onClick={toggle}
        style={{
          width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4, border: 'none',
          background: menuOpen ? '#f0f1f3' : 'transparent',
          color: menuOpen ? '#374151' : '#9ca3af',
          cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.1s',
        }}
      >
        <ChevronUp
          size={10} strokeWidth={2.5}
          style={{ transform: menuOpen ? 'none' : 'rotate(180deg)', transition: 'transform 0.15s' }}
        />
      </button>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Root panel
════════════════════════════════════════════════════════════════════ */

const RightPropertiesPanel: React.FC = () => {
  const { selectedLayerId, getLayer, selectedTextObject, selectedObject } = useEditor();
  const { panelOpen: sodPanelOpen } = useSODStore();
  const { isComparing } = useCompareStore();
  const selectedLayer = selectedLayerId ? getLayer(selectedLayerId) : null;
  const selectedShape = selectedObject && isShape(selectedObject) ? selectedObject : null;
  const selectedSymbol = selectedObject && isSymbol(selectedObject) ? selectedObject : null;

  const mode: 'canvas' | 'layer' | 'text' | 'shape' | 'symbol' =
    selectedTextObject ? 'text'
    : selectedShape     ? 'shape'
    : selectedSymbol    ? 'symbol'
    : selectedLayer     ? 'layer'
    :                    'canvas';

  return (
    <aside style={{
      position: 'fixed',
      top: 'var(--header-h)',
      right: 0, bottom: 0,
      width: 320,
      background: '#ffffff',
      borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 90,
      overflowX: 'hidden',
      overflowY: 'hidden',
      fontSize: 13,
      boxSizing: 'border-box',
    }}>
      {/* Body — compare takes over the panel first, then the Violations panel */}
      {isComparing ? (
        <ChangeListPanel />
      ) : sodPanelOpen ? (
        <SODViolationsPanel />
      ) : (
        <>
          {mode === 'text'   && selectedTextObject && <TextPropertiesPanel obj={selectedTextObject} />}
          {mode === 'shape'  && selectedShape       && <ShapePropertiesPanel obj={selectedShape} />}
          {mode === 'symbol' && selectedSymbol      && <SymbolPropertiesPanel obj={selectedSymbol} />}
          {mode === 'layer'  && selectedLayer       && <LayerPropertiesPanel layer={selectedLayer} />}
          {mode === 'canvas' && <CanvasSettingsPanel />}
        </>
      )}

      <BottomScaleStatus />
    </aside>
  );
};

export default RightPropertiesPanel;
