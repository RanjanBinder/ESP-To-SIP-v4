import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  DndContext, DragOverlay, DragStartEvent, DragOverEvent, DragEndEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  Search, Plus, MoreHorizontal, X,
  Eye, EyeOff, Lock, Unlock, ChevronRight, GripVertical,
  Monitor, CheckCheck,
} from 'lucide-react';
import { useEditor, Layer, flattenLayers } from '../store/editorStore';
import { buildLayerTree, flattenTreeForRender, LayerTreeNode, DropPosition, canDrop } from '../lib/layerTree';
import LayerDragOverlay from './LayerDragOverlay';

/* ═══════════════════════════════════════════════════════════════════
   Micro components
════════════════════════════════════════════════════════════════════ */

const IconBtn: React.FC<{
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  title?: string;
  active?: boolean;
  muted?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ Icon, title, active, muted, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 22, height: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none',
        background: hov ? '#f0f1f3' : 'transparent',
        color: active ? '#2563eb' : muted ? '#d1d5db' : '#6b7280',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <Icon size={13} strokeWidth={1.75} />
    </button>
  );
};

const ColorSwatch: React.FC<{ color: string; size?: number }> = ({ color, size = 10 }) => (
  <div style={{
    width: size, height: size, borderRadius: 3,
    background: color, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0,
  }} />
);

/* ── Drop indicator line ──────────────────────────────────────────── */
const DropLine: React.FC<{ depth?: number }> = ({ depth = 0 }) => (
  <div style={{
    position: 'absolute', left: 6 + depth * 16, right: 0,
    height: 2, background: '#2563eb', borderRadius: 1, zIndex: 10,
    pointerEvents: 'none',
  }} />
);

/* ═══════════════════════════════════════════════════════════════════
   Sortable layer row
════════════════════════════════════════════════════════════════════ */

interface SortableLayerRowProps {
  node: LayerTreeNode;
  dropTargetId: string | null;
  dropPosition: DropPosition | null;
  isDragActive: boolean; // any drag is happening
}

const SortableLayerRow: React.FC<SortableLayerRowProps> = ({
  node, dropTargetId, dropPosition, isDragActive,
}) => {
  const {
    activeLayerId, selectedLayerId,
    selectLayer, toggleLayerVisibility, toggleLayerLock, toggleLayerCollapse,
  } = useEditor();

  const {
    attributes, listeners,
    setNodeRef, setActivatorNodeRef,
    isDragging,
  } = useSortable({ id: node.id });

  const isSelected  = selectedLayerId === node.id;
  const isActive    = activeLayerId   === node.id;
  const isCollapsed = node.collapsed ?? false;
  const hasChildren = node.children.length > 0;
  const isDropTarget = dropTargetId === node.id;

  const [hovered, setHovered] = useState(false);

  const showBefore = isDropTarget && dropPosition === 'before';
  const showAfter  = isDropTarget && dropPosition === 'after';
  const showInside = isDropTarget && dropPosition === 'inside';

  const rowOpacity = isDragging ? 0.3 : node.visible ? 1 : 0.45;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      style={{ position: 'relative', opacity: rowOpacity }}
    >
      {/* Before drop line */}
      {showBefore && <DropLine depth={node.depth} />}

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => selectLayer(node.id)}
        style={{
          height: 34,
          display: 'flex', alignItems: 'center',
          paddingLeft: 6 + node.depth * 16,
          paddingRight: 6, gap: 4,
          cursor: 'pointer',
          background: showInside
            ? '#eff6ff'
            : isSelected ? '#eff6ff'
            : hovered ? '#f9fafb' : 'transparent',
          borderLeft: isSelected ? '2px solid #3b82f6' : showInside ? '2px solid #93c5fd' : '2px solid transparent',
          outline: showInside ? '1px solid #bfdbfe' : 'none',
          outlineOffset: -1,
          userSelect: 'none',
          transition: 'background 0.08s',
        }}
      >
        {/* Drag handle */}
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          onClick={e => e.stopPropagation()}
          style={{
            color: '#c4c8d0', cursor: 'grab', opacity: hovered || isDragActive ? 1 : 0,
            flexShrink: 0, display: 'flex', alignItems: 'center',
            transition: 'opacity 0.12s',
          }}
        >
          <GripVertical size={11} strokeWidth={1.5} />
        </div>

        {/* Expand / collapse chevron */}
        <div
          onClick={e => { e.stopPropagation(); if (hasChildren) toggleLayerCollapse(node.id); }}
          style={{
            width: 14, height: 14, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: hasChildren ? '#6b7280' : 'transparent',
          }}
        >
          <ChevronRight
            size={11} strokeWidth={2}
            style={{
              transform: hasChildren && !isCollapsed ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.15s',
            }}
          />
        </div>

        {/* Color swatch */}
        <ColorSwatch color={node.color} />

        {/* Name */}
        <span style={{
          flex: 1, fontSize: 13,
          fontWeight: isActive ? 500 : 400,
          color: node.visible ? '#111827' : '#9ca3af',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: '34px',
        }}>
          {node.name}
        </span>

        {/* Active dot */}
        {isActive && (
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: isSelected ? '#2563eb' : '#94a3b8',
            flexShrink: 0, marginRight: 2,
          }} />
        )}

        {/* Visibility / lock icons */}
        <div style={{ display: 'flex', gap: 1, flexShrink: 0 }}>
          {(hovered || !node.visible) && (
            <IconBtn
              Icon={node.visible ? Eye : EyeOff}
              title={node.visible ? 'Hide' : 'Show'}
              active={!node.visible}
              muted={node.visible && !hovered}
              onClick={e => { e.stopPropagation(); toggleLayerVisibility(node.id); }}
            />
          )}
          {(hovered || node.locked) && (
            <IconBtn
              Icon={node.locked ? Lock : Unlock}
              title={node.locked ? 'Unlock' : 'Lock'}
              active={node.locked}
              muted={!node.locked && !hovered}
              onClick={e => { e.stopPropagation(); toggleLayerLock(node.id); }}
            />
          )}
        </div>

        {/* Nest-inside label */}
        {showInside && (
          <span style={{
            fontSize: 9.5, color: '#2563eb', fontWeight: 600,
            background: '#dbeafe', borderRadius: 4, padding: '1px 5px',
            flexShrink: 0, whiteSpace: 'nowrap',
          }}>
            Nest inside
          </span>
        )}
      </div>

      {/* After drop line */}
      {showAfter && <DropLine depth={node.depth} />}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Canvases section
════════════════════════════════════════════════════════════════════ */

const CanvasesSection: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [hov, setHov] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <div
        onClick={() => setCollapsed(c => !c)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          height: 32, display: 'flex', alignItems: 'center',
          padding: '0 10px', gap: 6,
          background: hov ? '#f9fafb' : '#fafafa',
          cursor: 'pointer', userSelect: 'none',
        }}
      >
        <ChevronRight
          size={11} strokeWidth={2.5} color="#6b7280"
          style={{ transform: collapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.15s' }}
        />
        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.06em', flex: 1 }}>
          CANVASES
        </span>
        <button
          title="Add canvas"
          onClick={e => e.stopPropagation()}
          style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer' }}
        >
          <Plus size={11} strokeWidth={2} />
        </button>
      </div>
      {!collapsed && (
        <div style={{ display: 'flex', alignItems: 'center', height: 30, padding: '0 10px 0 28px', gap: 8, cursor: 'default' }}>
          <Monitor size={12} strokeWidth={1.5} color="#9ca3af" />
          <span style={{ flex: 1, fontSize: 12.5, color: '#374151' }}>Import</span>
          <span style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', letterSpacing: '0.02em' }}>
            Model
          </span>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   More menu
════════════════════════════════════════════════════════════════════ */

const MoreMenu: React.FC<{
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}> = ({ onClose, anchorRef }) => {
  const { activeLayerId, selectedLayerId, lockAll, showAll, deleteLayer } = useEditor();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose, anchorRef]);

  const targetId = selectedLayerId || activeLayerId;

  const items = [
    { label: 'Delete Layer', danger: true, action: () => { if (targetId) deleteLayer(targetId); onClose(); } },
    { label: '──────', divider: true, action: () => {} },
    { label: 'Lock All',  action: () => { lockAll(); onClose(); } },
    { label: 'Show All',  action: () => { showAll(); onClose(); } },
  ];

  return (
    <div
      ref={menuRef}
      style={{
        position: 'absolute', top: '100%', right: 0, width: 196,
        background: '#ffffff', border: '1px solid #e5e7eb',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.06)',
        zIndex: 300, overflow: 'hidden', padding: '4px 0',
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ height: 1, background: '#f3f4f6', margin: '3px 0' }} />
        ) : (
          <div
            key={item.label}
            onClick={item.action}
            style={{
              height: 30, display: 'flex', alignItems: 'center',
              padding: '0 12px', cursor: 'pointer',
              color: item.danger ? '#ef4444' : '#111827',
              fontSize: 13,
            }}
          >
            {item.label}
          </div>
        )
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   More menu — positioned below its anchor via absolute in rel wrapper
════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   Active layer footer
════════════════════════════════════════════════════════════════════ */

const ActiveLayerFooter: React.FC = () => {
  const { activeLayerId, layers } = useEditor();
  const active = layers.find(l => l.id === activeLayerId);
  if (!active) return null;
  return (
    <div style={{
      height: 36, display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 12px', borderTop: '1px solid #e5e7eb', flexShrink: 0, background: '#fafafa',
    }}>
      <ColorSwatch color={active.color} size={8} />
      <span style={{ fontSize: 11.5, color: '#6b7280' }}>
        Active: <strong style={{ color: '#374151', fontWeight: 500 }}>{active.name}</strong>
      </span>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Main LayersPanel
════════════════════════════════════════════════════════════════════ */

const LayersPanel: React.FC = () => {
  const {
    layers, addLayer,
    selectedLayerId, reorderLayer, expandLayer,
  } = useEditor();

  /* ── Search / filter ────────────────────────────────────────────── */
  const [searchOpen,        setSearchOpen]        = useState(false);
  const [searchQuery,       setSearchQuery]        = useState('');
  const [moreMenuOpen,      setMoreMenuOpen]       = useState(false);
  const [showSelectedOnly,  setShowSelectedOnly]   = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const handleSearchToggle = useCallback(() => {
    setSearchOpen(o => !o);
    setSearchQuery('');
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [searchOpen]);

  /* ── Build tree ──────────────────────────────────────────────────── */
  const tree = buildLayerTree(layers);
  const flatVisible = flattenTreeForRender(tree);
  const visibleIds  = flatVisible.map(n => n.id);

  /* ── Search / show-selected filter list ─────────────────────────── */
  const displayLayers = (() => {
    const flat = flattenLayers(layers);
    if (searchQuery) return flat.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
    if (showSelectedOnly && selectedLayerId) return flat.filter(l => l.id === selectedLayerId);
    return null;
  })();

  /* ── DnD state ───────────────────────────────────────────────────── */
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);

  const pointerRef    = useRef({ y: 0 });
  const autoExpandRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track pointer Y globally while dragging
  useEffect(() => {
    const h = (e: PointerEvent) => { pointerRef.current.y = e.clientY; };
    window.addEventListener('pointermove', h);
    return () => window.removeEventListener('pointermove', h);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setDropTargetId(null);
    setDropPosition(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || !active) { setDropTargetId(null); setDropPosition(null); return; }

    const overId = over.id as string;
    const overEl = document.querySelector(`[data-layer-id="${overId}"]`);
    if (!overEl) { setDropTargetId(null); return; }

    const rect = overEl.getBoundingClientRect();
    const fraction = (pointerRef.current.y - rect.top) / rect.height;
    let pos: DropPosition = fraction < 0.25 ? 'before' : fraction > 0.75 ? 'after' : 'inside';

    // Validate
    if (!canDrop(layers, active.id as string, overId, pos)) {
      // Try adjacent positions
      if (pos === 'inside' && canDrop(layers, active.id as string, overId, 'after')) {
        pos = 'after';
      } else {
        setDropTargetId(null); setDropPosition(null); return;
      }
    }

    setDropTargetId(overId);
    setDropPosition(pos);

    // Auto-expand collapsed targets on inside-hover
    if (pos === 'inside') {
      const target = layers.find(l => l.id === overId);
      if (target?.collapsed) {
        if (!autoExpandRef.current) {
          autoExpandRef.current = setTimeout(() => {
            expandLayer(overId);
            autoExpandRef.current = null;
          }, 600);
        }
      }
    } else {
      if (autoExpandRef.current) { clearTimeout(autoExpandRef.current); autoExpandRef.current = null; }
    }
  }, [layers, expandLayer]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && dropTargetId && dropPosition && active.id !== over.id) {
      reorderLayer({ draggedId: active.id as string, targetId: dropTargetId, position: dropPosition });
    }
    setActiveId(null); setDropTargetId(null); setDropPosition(null);
    if (autoExpandRef.current) { clearTimeout(autoExpandRef.current); autoExpandRef.current = null; }
  }, [dropTargetId, dropPosition, reorderLayer]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null); setDropTargetId(null); setDropPosition(null);
    if (autoExpandRef.current) { clearTimeout(autoExpandRef.current); autoExpandRef.current = null; }
  }, []);

  const activeLayer = activeId ? layers.find(l => l.id === activeId) : null;

  /* ── LAYERS section header with tools ───────────────────────────── */
  const LayersSectionHeader = () => (
    <div style={{
      display: 'flex', alignItems: 'center',
      minHeight: 32, padding: '0 6px 0 10px', gap: 2,
      background: '#fafafa', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
    }}>
      {searchOpen ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 5, background: '#f3f4f6', borderRadius: 5, padding: '0 7px', height: 24, margin: '4px 0' }}>
          <Search size={11} color="#9ca3af" strokeWidth={2} />
          <input
            autoFocus value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search layers…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#111827', outline: 'none' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
              <X size={10} strokeWidth={2} />
            </button>
          )}
        </div>
      ) : (
        <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: '0.06em' }}>LAYERS</span>
      )}
      <IconBtn Icon={Search}    title="Search layers"       active={searchOpen}        onClick={handleSearchToggle} />
      <IconBtn Icon={CheckCheck} title="Show selected only" active={showSelectedOnly}   onClick={() => setShowSelectedOnly(o => !o)} />
      <IconBtn Icon={Plus}      title="Add layer"                                       onClick={addLayer} />
      <button
        ref={moreButtonRef as React.RefObject<HTMLButtonElement>}
        title="More options"
        onClick={() => setMoreMenuOpen(o => !o)}
        style={{
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 4, border: 'none',
          background: moreMenuOpen ? '#eff6ff' : 'transparent',
          color: moreMenuOpen ? '#2563eb' : '#6b7280',
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={13} strokeWidth={1.75} />
      </button>
    </div>
  );

  return (
    <aside style={{
      position: 'fixed', top: 'var(--header-h)', left: 'var(--sidebar-w)',
      bottom: 0, width: 300,
      background: '#ffffff', borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column', zIndex: 85,
    }}>
      {/* Canvases at top, always visible */}
      <CanvasesSection />

      {/* Layers section header with search / select-all / add / more */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <LayersSectionHeader />
        {moreMenuOpen && (
          <MoreMenu onClose={() => setMoreMenuOpen(false)} anchorRef={moreButtonRef} />
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* Search results (no DnD) */}
          {displayLayers ? (
            <>
              <div style={{ padding: '6px 14px 4px', fontSize: 11, color: '#9ca3af', borderBottom: '1px solid #f9fafb' }}>
                {displayLayers.length} result{displayLayers.length !== 1 ? 's' : ''}
              </div>
              {displayLayers.map(l => (
                <PlainLayerRow key={l.id} layer={l} />
              ))}
              {displayLayers.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>
                  No layers match "{searchQuery}"
                </div>
              )}
            </>
          ) : (
            /* Normal DnD tree view */
            <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
              {flatVisible.map(node => (
                <div key={node.id} data-layer-id={node.id}>
                  <SortableLayerRow
                    node={node}
                    dropTargetId={dropTargetId}
                    dropPosition={dropPosition}
                    isDragActive={activeId !== null}
                  />
                </div>
              ))}
            </SortableContext>
          )}

          <div style={{ height: 20 }} />
        </div>

        {/* Drag preview overlay */}
        <DragOverlay dropAnimation={null}>
          {activeLayer ? <LayerDragOverlay layer={activeLayer} /> : null}
        </DragOverlay>
      </DndContext>

      <ActiveLayerFooter />
    </aside>
  );
};

/* ── Plain (non-sortable) row for search results ─────────────────── */
const PlainLayerRow: React.FC<{ layer: Layer }> = ({ layer }) => {
  const { selectedLayerId, selectLayer } = useEditor();
  const isSelected = selectedLayerId === layer.id;
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => selectLayer(layer.id)}
      style={{
        height: 34, display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 6,
        background: isSelected ? '#eff6ff' : hov ? '#f9fafb' : 'transparent',
        borderLeft: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
        cursor: 'pointer', userSelect: 'none', opacity: layer.visible ? 1 : 0.45,
      }}
    >
      <ColorSwatch color={layer.color} />
      <span style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {layer.name}
      </span>
    </div>
  );
};

export default LayersPanel;
