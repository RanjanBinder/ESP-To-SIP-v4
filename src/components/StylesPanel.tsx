import React, { useState, useRef, useEffect } from 'react';
import { Search, MoreHorizontal, Plus, ChevronRight, X } from 'lucide-react';
import { useEditor, EditorStyle, StyleCategory } from '../store/editorStore';

/* ═══════════════════════════════════════════════════════════════════
   Preview components
════════════════════════════════════════════════════════════════════ */

const FONT_SIZE_MAP: Record<number, number> = {
  10: 28, 11: 30, 12: 32, 14: 36, 24: 48,
};

const TextStylePreview: React.FC<{ style: EditorStyle }> = ({ style }) => {
  const displaySize = FONT_SIZE_MAP[style.fontSize ?? 12] ?? 32;
  const weight = style.fontWeight === 'bold' ? 700 : style.fontWeight === 'medium' ? 500 : 400;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        fontSize: displaySize,
        fontWeight: weight,
        color: style.color ?? '#111827',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        fontFamily: 'Georgia, "Times New Roman", serif',
        userSelect: 'none',
      }}>
        Ab
      </span>
    </div>
  );
};

const ShapeStylePreview: React.FC<{ style: EditorStyle }> = ({ style }) => {
  const color = style.color ?? '#111827';
  const dashArray =
    style.strokeStyle === 'dashed' ? '8 5' :
    style.strokeStyle === 'dotted' ? '2 4' :
    undefined;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 120 60" width={120} height={60} fill="none">
        {/* Left tick */}
        <line x1="8" y1="22" x2="8" y2="38" stroke={color} strokeWidth="1.75" strokeLinecap="round"/>
        {/* Main line */}
        <line
          x1="8" y1="30" x2="106" y2="30"
          stroke={color} strokeWidth="2"
          strokeDasharray={dashArray}
          strokeLinecap="round"
        />
        {/* Arrowhead */}
        <polyline
          points="96,22 110,30 96,38"
          stroke={color} strokeWidth="1.75" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const ANNOTATION_PREVIEWS: Record<string, (color: string) => React.ReactNode> = {
  'dimension-arrow': (c) => (
    <svg viewBox="0 0 120 60" width={120} height={60} fill="none">
      <line x1="10" y1="30" x2="110" y2="30" stroke={c} strokeWidth="1.5"/>
      <polyline points="20,22 8,30 20,38" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <polyline points="100,22 112,30 100,38" stroke={c} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="8" y1="18" x2="8" y2="42" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="112" y1="18" x2="112" y2="42" stroke={c} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'chainage-marker': (c) => (
    <svg viewBox="0 0 120 70" width={120} height={70} fill="none">
      <line x1="60" y1="8" x2="60" y2="62" stroke={c} strokeWidth="1.5"/>
      <rect x="26" y="16" width="68" height="22" rx="3" fill="white" stroke={c} strokeWidth="1.5"/>
      <text x="60" y="31" textAnchor="middle" fontSize="9" fill={c} fontFamily="ui-monospace,monospace">CH 17+400</text>
    </svg>
  ),
  'km-marker-style': (c) => (
    <svg viewBox="0 0 120 70" width={120} height={70} fill="none">
      <rect x="34" y="14" width="52" height="32" rx="4" fill="white" stroke={c} strokeWidth="1.5"/>
      <text x="60" y="28" textAnchor="middle" fontSize="9" fontWeight="600" fill={c}>KM</text>
      <text x="60" y="40" textAnchor="middle" fontSize="8" fill={c} fontFamily="ui-monospace,monospace">17+400</text>
      <line x1="60" y1="46" x2="60" y2="58" stroke={c} strokeWidth="1.5"/>
    </svg>
  ),
  'issue-callout': (c) => (
    <svg viewBox="0 0 120 70" width={120} height={70} fill="none">
      <rect x="16" y="8" width="88" height="38" rx="6" fill="white" stroke={c} strokeWidth="1.5"/>
      <polyline points="36,46 28,60 54,46" stroke={c} strokeWidth="1.5" fill="white" strokeLinejoin="round"/>
      <circle cx="44" cy="27" r="4" fill={c}/>
      <line x1="56" y1="23" x2="88" y2="23" stroke={c} strokeWidth="1.25" strokeLinecap="round"/>
      <line x1="56" y1="31" x2="78" y2="31" stroke={c} strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  ),
  'approval-note': (c) => (
    <svg viewBox="0 0 120 70" width={120} height={70} fill="none">
      <rect x="22" y="8" width="76" height="54" rx="5" fill="white" stroke={c} strokeWidth="1.5"/>
      <path d="M83 8 L98 22 L83 22 Z" fill="#e0e7ff" stroke={c} strokeWidth="1"/>
      <line x1="32" y1="30" x2="84" y2="30" stroke={c} strokeWidth="1" strokeLinecap="round"/>
      <line x1="32" y1="39" x2="84" y2="39" stroke={c} strokeWidth="1" strokeLinecap="round"/>
      <polyline points="36,52 46,60 66,42" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const AnnotationStylePreview: React.FC<{ style: EditorStyle }> = ({ style }) => {
  const color = style.color ?? '#111827';
  const render = ANNOTATION_PREVIEWS[style.id];
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {render ? render(color) : (
        <svg viewBox="0 0 120 60" width={120} height={60} fill="none">
          <line x1="10" y1="30" x2="110" y2="30" stroke={color} strokeWidth="1.5" strokeDasharray="4 3"/>
        </svg>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   StyleCard
════════════════════════════════════════════════════════════════════ */

const StyleCard: React.FC<{
  style: EditorStyle;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ style, isSelected, onSelect }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isSelected
          ? '2px solid #3b82f6'
          : hovered
          ? '2px solid #e2e8f0'
          : '2px solid transparent',
        background: isSelected ? '#eff6ff' : '#ffffff',
        boxShadow: isSelected
          ? '0 0 0 1px #bfdbfe'
          : hovered
          ? '0 2px 6px rgba(0,0,0,0.07)'
          : '0 1px 3px rgba(0,0,0,0.05)',
        transition: 'border-color 0.1s, background 0.1s, box-shadow 0.1s',
      }}
    >
      {/* Preview box */}
      <div style={{
        height: 88,
        background: '#f8f9fa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {style.previewType === 'text'       && <TextStylePreview       style={style} />}
        {style.previewType === 'line'       && <ShapeStylePreview       style={style} />}
        {style.previewType === 'annotation' && <AnnotationStylePreview style={style} />}
      </div>

      {/* Info */}
      <div style={{ padding: '6px 8px 8px', background: '#ffffff' }}>
        <div style={{
          fontSize: 11.5, fontWeight: 500, color: '#111827',
          lineHeight: 1.3, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {style.name}
        </div>
        <div style={{
          fontSize: 10.5, color: '#9ca3af', marginTop: 1,
          lineHeight: 1.3, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {style.meta}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   StyleCategorySection
════════════════════════════════════════════════════════════════════ */

const StyleCategorySection: React.FC<{
  title: string;
  styles: EditorStyle[];
  collapsed: boolean;
  onToggle: () => void;
  selectedStyleId: string | null;
  onSelect: (id: string | null) => void;
}> = ({ title, styles, collapsed, onToggle, selectedStyleId, onSelect }) => {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <div
        onClick={onToggle}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center',
          height: 36, padding: '0 12px', gap: 6,
          cursor: 'pointer', userSelect: 'none',
          background: hov ? '#f9fafb' : 'transparent',
        }}
      >
        <ChevronRight
          size={11} strokeWidth={2.5} color="#9ca3af"
          style={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.14s', flexShrink: 0 }}
        />
        <span style={{ fontSize: 13, fontWeight: 500, color: '#374151', flex: 1 }}>
          {title}
        </span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>({styles.length})</span>
      </div>

      {!collapsed && styles.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 8, padding: '2px 10px 12px',
        }}>
          {styles.map(s => (
            <StyleCard
              key={s.id}
              style={s}
              isSelected={selectedStyleId === s.id}
              onSelect={() => onSelect(selectedStyleId === s.id ? null : s.id)}
            />
          ))}
        </div>
      )}

      {!collapsed && styles.length === 0 && (
        <div style={{ padding: '8px 14px 14px', fontSize: 12, color: '#9ca3af' }}>
          No styles found.
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Options menu
════════════════════════════════════════════════════════════════════ */

const OptionsMenuRow: React.FC<{ label: string; danger?: boolean; onClick: () => void }> = ({ label, danger, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 30, display: 'flex', alignItems: 'center',
        padding: '0 12px', cursor: 'pointer',
        background: hov ? '#f5f6f7' : 'transparent',
        color: danger ? '#ef4444' : '#111827',
        fontSize: 12.5, transition: 'background 0.08s',
      }}
    >
      {label}
    </div>
  );
};

const StylesOptionsMenu: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  selectedStyleId: string | null;
  onDeleteStyle: () => void;
  onClose: () => void;
}> = ({ anchorRef, selectedStyleId, onDeleteStyle, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose, anchorRef]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div ref={menuRef} style={{
      position: 'absolute',
      top: 44, right: 8,
      width: 192,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
      zIndex: 300, overflow: 'hidden', padding: '4px 0',
    }}>
      <OptionsMenuRow label="Rename Style"    onClick={onClose} />
      <OptionsMenuRow label="Duplicate Style" onClick={onClose} />
      <OptionsMenuRow label="Delete Style" danger onClick={() => { onDeleteStyle(); onClose(); }} />
      <div style={{ height: 1, background: '#f3f4f6', margin: '3px 0' }} />
      <OptionsMenuRow label="Import Styles" onClick={onClose} />
      <OptionsMenuRow label="Export Styles" onClick={onClose} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   StylesPanel
════════════════════════════════════════════════════════════════════ */

const StylesPanel: React.FC = () => {
  const {
    styles, selectedStyleId, styleSearchQuery, collapsedStyleCategories,
    selectStyle, setStyleSearchQuery, toggleStyleCategory, addStyle, deleteStyle,
  } = useEditor();

  const [activeTab,  setActiveTab]  = useState<'model' | 'find'>('model');
  const [moreOpen,   setMoreOpen]   = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  const filtered = styleSearchQuery
    ? styles.filter(s => s.name.toLowerCase().includes(styleSearchQuery.toLowerCase()))
    : styles;

  const textStyles       = filtered.filter(s => s.category === 'text');
  const shapeStyles      = filtered.filter(s => s.category === 'shapes');
  const annotationStyles = filtered.filter(s => s.category === 'annotations');

  /* Which category is "first expanded" — for + button default */
  const openCategory: StyleCategory = !collapsedStyleCategories.includes('text')
    ? 'text'
    : !collapsedStyleCategories.includes('shapes')
    ? 'shapes'
    : 'annotations';

  return (
    <aside style={{
      position: 'fixed',
      top: 'var(--header-h)',
      left: 'var(--sidebar-w)',
      bottom: 0,
      width: 300,
      background: '#ffffff',
      borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 85, overflow: 'hidden',
    }}>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 10px 6px',
        borderBottom: '1px solid #f3f4f6',
        gap: 2, flexShrink: 0,
      }}>
        {([['model', 'In model styles'], ['find', 'Find styles']] as const).map(([id, label]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: active ? '#f0f1f3' : 'transparent',
                color: active ? '#111827' : '#6b7280',
                fontSize: 12, fontWeight: active ? 500 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Search row ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 10px', gap: 4,
        borderBottom: '1px solid #f3f4f6',
        flexShrink: 0, position: 'relative',
      }}>
        {moreOpen && (
          <StylesOptionsMenu
            anchorRef={moreRef}
            selectedStyleId={selectedStyleId}
            onDeleteStyle={() => { if (selectedStyleId) deleteStyle(selectedStyleId); }}
            onClose={() => setMoreOpen(false)}
          />
        )}

        {/* Search input */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: '#f4f4f5', borderRadius: 7, padding: '0 8px', height: 28,
        }}>
          <Search size={12} color="#9ca3af" strokeWidth={2} />
          <input
            value={styleSearchQuery}
            onChange={e => setStyleSearchQuery(e.target.value)}
            placeholder="Search (CtrlF)"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 12, color: '#111827', outline: 'none',
            }}
          />
          {styleSearchQuery && (
            <button
              onClick={() => setStyleSearchQuery('')}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 0 }}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* More options */}
        <button
          ref={moreRef}
          onClick={() => setMoreOpen(o => !o)}
          style={{
            width: 28, height: 28, border: 'none',
            background: moreOpen ? '#f0f1f3' : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, color: '#6b7280', flexShrink: 0,
          }}
        >
          <MoreHorizontal size={13} strokeWidth={1.75} />
        </button>

        {/* Add */}
        <button
          onClick={() => addStyle(openCategory)}
          title="Add style"
          style={{
            width: 28, height: 28, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, color: '#6b7280', flexShrink: 0,
          }}
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <StyleCategorySection
          title="Shapes"
          styles={shapeStyles}
          collapsed={collapsedStyleCategories.includes('shapes')}
          onToggle={() => toggleStyleCategory('shapes')}
          selectedStyleId={selectedStyleId}
          onSelect={selectStyle}
        />
        <StyleCategorySection
          title="Text"
          styles={textStyles}
          collapsed={collapsedStyleCategories.includes('text')}
          onToggle={() => toggleStyleCategory('text')}
          selectedStyleId={selectedStyleId}
          onSelect={selectStyle}
        />
        <StyleCategorySection
          title="Annotations"
          styles={annotationStyles}
          collapsed={collapsedStyleCategories.includes('annotations')}
          onToggle={() => toggleStyleCategory('annotations')}
          selectedStyleId={selectedStyleId}
          onSelect={selectStyle}
        />

        <div style={{ height: 20 }} />
      </div>
    </aside>
  );
};

export default StylesPanel;
