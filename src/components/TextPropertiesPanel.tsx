import React from 'react';
import {
  ChevronRight, Eye, EyeOff, Lock, Unlock,
  MoreHorizontal, RotateCcw, Type, RefreshCw,
  Pencil, Link, FlipHorizontal, FlipVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignStartVertical, AlignEndVertical, MoveHorizontal,
} from 'lucide-react';
import { useEditor, flattenLayers, TextObject } from '../store/editorStore';
import {
  PropertySection as TSection,
  PropertyRow as PRow,
  NumberInput as NumInput,
  IconButton as IconBtn,
  IconSegmented,
} from './ui';

/* ── 3×3 anchor grid dot preview ─────────────────────────────────── */

const ANCHOR_POSITIONS = [
  'Top left', 'Top center', 'Top right',
  'Middle left', 'Middle', 'Middle right',
  'Bottom left', 'Bottom center', 'Bottom right',
];

const AnchorGridIcon: React.FC<{ anchor: string }> = ({ anchor }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0 }}>
    {ANCHOR_POSITIONS.map((pos, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const cx = 4 + col * 5;
      const cy = 4 + row * 5;
      return (
        <circle
          key={pos} cx={cx} cy={cy}
          r={pos === anchor ? 2.2 : 1.3}
          fill={pos === anchor ? '#2563eb' : '#c4c8d0'}
        />
      );
    })}
  </svg>
);

/* ── Baseline SVG icons ──────────────────────────────────────────── */

const BaselineTopIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="2" x2="13" y2="2" />
    <line x1="8" y1="4" x2="8" y2="13" />
    <polyline points="5,7 8,4 11,7" />
  </svg>
);

const BaselineMidIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="8" x2="13" y2="8" />
    <line x1="8" y1="2" x2="8" y2="14" />
    <polyline points="5,5 8,2 11,5" />
    <polyline points="5,11 8,14 11,11" />
  </svg>
);

const BaselineBotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="14" x2="13" y2="14" />
    <line x1="8" y1="3" x2="8" y2="12" />
    <polyline points="5,9 8,12 11,9" />
  </svg>
);

/* ── Text paragraph-alignment icons (stacked lines) ──────────────── */

const TextAlignLeftIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="2.5" y1="4"  x2="13.5" y2="4" />
    <line x1="2.5" y1="8"  x2="9"    y2="8" />
    <line x1="2.5" y1="12" x2="11"   y2="12" />
  </svg>
);

const TextAlignCenterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="2.5" y1="4"  x2="13.5" y2="4" />
    <line x1="4.5" y1="8"  x2="11.5" y2="8" />
    <line x1="3.5" y1="12" x2="12.5" y2="12" />
  </svg>
);

const TextAlignRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
    <line x1="2.5" y1="4"  x2="13.5" y2="4" />
    <line x1="7"   y1="8"  x2="13.5" y2="8" />
    <line x1="5"   y1="12" x2="13.5" y2="12" />
  </svg>
);

/* ── Sub-section header ──────────────────────────────────────────── */

const SubHeader: React.FC<{ label: string; actions?: React.ReactNode }> = ({ label, actions }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 4px', gap: 4, boxSizing: 'border-box' }}>
    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</span>
    {actions}
  </div>
);

/* ── Text style preview card (replaces individual font rows) ─────── */

const TextStyleCard: React.FC<{ obj: TextObject }> = ({ obj }) => {
  const weight =
    obj.fontStyle.toLowerCase().includes('bold') ? 700 :
    obj.fontStyle.toLowerCase().includes('semi') ? 600 :
    obj.fontStyle.toLowerCase().includes('medium') ? 500 : 400;
  const italic = obj.fontStyle.toLowerCase().includes('italic') ? 'italic' : 'normal';

  const title = `${obj.fontSize} ${obj.fontFamily}`.slice(0, 32);
  const meta  = `${obj.fontSize} · ${obj.fontFamily} ${obj.fontStyle}`;

  return (
    <div style={{
      width: 'calc(100% - 16px)',
      height: 62,
      margin: '6px 8px',
      display: 'flex', alignItems: 'center', gap: 10,
      padding: 8,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      boxSizing: 'border-box',
      overflow: 'hidden',
      cursor: 'pointer',
      userSelect: 'none',
    }}>
      {/* Ab preview */}
      <div style={{
        width: 56, height: 44, flex: '0 0 56px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa', border: '1px solid #e5e7eb', borderRadius: 6,
      }}>
        <span style={{
          fontSize: 17, lineHeight: 1,
          color: obj.textColor,
          fontFamily: obj.fontFamily,
          fontWeight: weight,
          fontStyle: italic,
        }}>
          Ab
        </span>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12.5, fontWeight: 500, color: '#111827',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 11.5, color: '#9ca3af', marginTop: 2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {meta}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Main panel
════════════════════════════════════════════════════════════════════ */

const TextPropertiesPanel: React.FC<{ obj: TextObject }> = ({ obj }) => {
  const { updateTextObject, layers } = useEditor();
  const flatLayers = flattenLayers(layers);

  const layerOptions = flatLayers.map(l => ({ value: l.id, label: l.name }));
  if (!layerOptions.find(o => o.value === obj.layerId)) {
    layerOptions.unshift({ value: obj.layerId, label: obj.layerId });
  }

  const layerColor = flatLayers.find(l => l.id === obj.layerId)?.color ?? '#9ca3af';

  const fmtNum = (n: number) =>
    `${Number.isInteger(n) ? n : n.toFixed(2)} m`;

  const parseNum = (s: string) =>
    parseFloat(s.replace(/[^0-9.-]/g, '')) || 0;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden',
      fontSize: 13,
      boxSizing: 'border-box',
    }}>

      {/* ── SELECTION ──────────────────────────────────────────────── */}
      <TSection title="Selection" count={1}>

        {/* Name */}
        <PRow label="Name">
          <label style={{
            width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6,
            background: '#f4f4f5', border: '1px solid transparent',
            borderRadius: 8, padding: '0 8px', height: 32,
            cursor: 'text', transition: 'border-color 0.1s, background 0.1s',
            boxSizing: 'border-box',
          }}>
            <Type size={12} strokeWidth={1.75} color="#9ca3af" style={{ flexShrink: 0 }} />
            <input
              value={obj.name}
              onChange={e => updateTextObject({ name: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                fontSize: 13,
                color: '#111827',
                outline: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onFocus={e => { const el = e.currentTarget.closest('label') as HTMLElement; el.style.borderColor = '#2563eb'; el.style.background = '#fff'; }}
              onBlur={e => { const el = e.currentTarget.closest('label') as HTMLElement; el.style.borderColor = 'transparent'; el.style.background = '#f4f4f5'; }}
            />
          </label>
        </PRow>

        {/* Layer */}
        <PRow label="Layer">
          <div style={{
            width: '100%',
            minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f4f4f5', border: '1px solid transparent',
            borderRadius: 8, padding: '0 8px', height: 32,
            boxSizing: 'border-box',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: 2,
              background: layerColor, flexShrink: 0,
              border: '1px solid rgba(0,0,0,0.10)',
            }} />
            <select
              value={obj.layerId}
              onChange={e => updateTextObject({ layerId: e.target.value })}
              style={{
                flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                fontSize: 13, color: '#111827', outline: 'none', cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {layerOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronRight size={10} strokeWidth={2} color="#9ca3af" />
          </div>
        </PRow>

        {/* Status */}
        <PRow label="Status" noBorder>
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
            {/* Type indicator — always active */}
            <IconBtn title="Text object" active size={28} fluid>
              <Type size={14} strokeWidth={1.75} />
            </IconBtn>
            {/* Lock */}
            <IconBtn
              title={obj.locked ? 'Unlock' : 'Lock'}
              active={obj.locked}
              onClick={() => updateTextObject({ locked: !obj.locked })}
              size={28}
              fluid
            >
              {obj.locked ? <Lock size={14} strokeWidth={1.75} /> : <Unlock size={14} strokeWidth={1.75} />}
            </IconBtn>
            {/* Visibility */}
            <IconBtn
              title={obj.visible ? 'Hide' : 'Show'}
              active={obj.visible}
              onClick={() => updateTextObject({ visible: !obj.visible })}
              size={28}
              fluid
            >
              {obj.visible ? <Eye size={14} strokeWidth={1.75} /> : <EyeOff size={14} strokeWidth={1.75} />}
            </IconBtn>
            {/* Disable */}
            <IconBtn title="Disable" size={28} fluid>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="8" cy="8" r="5.5" />
                <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" />
              </svg>
            </IconBtn>
          </div>
        </PRow>

      </TSection>

      {/* ── MODIFY ─────────────────────────────────────────────────── */}
      <TSection title="Modify" count={1}>

        {/* Transform toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 1,
          height: 32,
          padding: '0 2px',
          margin: '0 8px 6px',
          borderBottom: '1px solid #f0f0f0',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}>
          <IconBtn title="Rotate counter-clockwise"><RotateCcw size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Flip horizontal"><FlipHorizontal size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Flip vertical"><FlipVertical size={14} strokeWidth={1.9} /></IconBtn>

          <div style={{ width: 1, height: 14, background: '#e5e7eb', margin: '0 1px', flex: '0 0 1px' }} />

          <IconBtn title="Align left edge"><AlignStartHorizontal size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Align horizontal center"><AlignCenterHorizontal size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Align right edge"><AlignEndHorizontal size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Align top edge"><AlignStartVertical size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Align bottom edge"><AlignEndVertical size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="Distribute horizontally"><MoveHorizontal size={14} strokeWidth={1.9} /></IconBtn>
          <IconBtn title="More modify actions" style={{ marginLeft: 'auto' }}><MoreHorizontal size={14} strokeWidth={1.9} /></IconBtn>
        </div>

        {/* Anchor */}
        <PRow label="Anchor">
          <div style={{
            width: '100%',
            minWidth: 0,
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#f4f4f5', border: '1px solid transparent',
            borderRadius: 8, padding: '0 8px', height: 32,
            boxSizing: 'border-box',
          }}>
            <AnchorGridIcon anchor={obj.anchor} />
            <select
              value={obj.anchor}
              onChange={e => updateTextObject({ anchor: e.target.value })}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none', background: 'transparent',
                fontSize: 13, color: '#111827', outline: 'none', cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ANCHOR_POSITIONS.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </PRow>

        {/* X, Y */}
        <PRow label="X, Y">
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 4,
            width: '100%',
            minWidth: 0,
          }}>
            <NumInput value={fmtNum(obj.x)}     onChange={v => updateTextObject({ x: parseNum(v) })} />
            <NumInput value={fmtNum(obj.y)}     onChange={v => updateTextObject({ y: parseNum(v) })} />
          </div>
        </PRow>

        {/* W, H */}
        <PRow label="W, H">
          <div style={{
            display: 'grid',
            gridTemplateColumns: '18px minmax(0, 1fr) minmax(0, 1fr)',
            alignItems: 'center',
            gap: 4,
            width: '100%',
            minWidth: 0,
          }}>
            <button
              title="Lock proportions"
              style={{
                width: 18, height: 18, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent',
                cursor: 'pointer', color: '#9ca3af',
              }}
            >
              <Lock size={10} strokeWidth={2} />
            </button>
            <NumInput value={fmtNum(obj.width)}  onChange={v => updateTextObject({ width: parseNum(v) })} />
            <NumInput value={fmtNum(obj.height)} onChange={v => updateTextObject({ height: parseNum(v) })} />
          </div>
        </PRow>

        {/* Transform pill */}
        <PRow label="Transform" noBorder>
          <div style={{ width: '100%', minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              flex: 1,
              minWidth: 0,
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#f4f4f5', borderRadius: 8,
              padding: '0 10px', height: 32,
              fontSize: 12, color: '#374151',
              fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}>
              <span>{obj.rotation}°</span>
              <span style={{ color: '#d1d5db' }}>/</span>
              <span>{obj.scale}%</span>
            </div>
            <IconBtn
              title="Reset transform"
              onClick={() => updateTextObject({ rotation: 0, scale: 100 })}
            >
              <RefreshCw size={14} strokeWidth={1.75} />
            </IconBtn>
          </div>
        </PRow>

      </TSection>

      {/* ── TEXT ───────────────────────────────────────────────────── */}
      <TSection title="Text" count={1}>

        {/* Styles sub-header */}
        <SubHeader
          label="Styles"
          actions={
            <>
              <IconBtn title="Edit style"  size={28}><Pencil        size={13} strokeWidth={1.75} /></IconBtn>
              <IconBtn title="Link style"  size={28}><Link          size={13} strokeWidth={1.75} /></IconBtn>
              <IconBtn title="More"        size={28}><MoreHorizontal size={13} strokeWidth={1.75} /></IconBtn>
            </>
          }
        />

        {/* Rayon-style text style preview card */}
        <TextStyleCard obj={obj} />

        {/* Divider before Properties */}
        <div style={{ height: 1, background: '#ebebec', margin: '4px 0 0' }} />

        {/* Properties sub-header */}
        <SubHeader label="Properties" />

        {/* Alignment */}
        <PRow label="Alignment">
          <IconSegmented
            value={obj.alignment}
            onChange={v => updateTextObject({ alignment: v as TextObject['alignment'] })}
            options={[
              { value: 'left',   title: 'Align left',   icon: <TextAlignLeftIcon /> },
              { value: 'center', title: 'Align center', icon: <TextAlignCenterIcon /> },
              { value: 'right',  title: 'Align right',  icon: <TextAlignRightIcon /> },
            ]}
          />
        </PRow>

        {/* Baseline */}
        <PRow label="Baseline" noBorder>
          <IconSegmented
            value={obj.baseline}
            onChange={v => updateTextObject({ baseline: v as TextObject['baseline'] })}
            options={[
              { value: 'top',    title: 'Top',    icon: <BaselineTopIcon /> },
              { value: 'middle', title: 'Middle', icon: <BaselineMidIcon /> },
              { value: 'bottom', title: 'Bottom', icon: <BaselineBotIcon /> },
            ]}
          />
        </PRow>

      </TSection>

    </div>
  );
};

export default TextPropertiesPanel;
