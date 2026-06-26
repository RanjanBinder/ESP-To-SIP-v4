import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  AlignLeft, AlignCenter, AlignRight,
  Bold, Italic, Underline, Link, Check, X, MessageSquare,
} from 'lucide-react';
import { useEditor, DraftTextObject, TextObject, isTextObject, isShape, isSymbol } from '../store/editorStore';
import { Vec2, CanvasObject } from '../types/scene';
import { ToolContext, ToolPointer, DragSession, ArcPreview, RubberBand } from '../types/tool';
import { getTool } from '../lib/tools/registry';
import { findSnapPoint } from '../lib/snapPoints';
import {
  PARAM_DRAW_TOOLS, DrawingCommand, makeDrawingCommand, advanceToStep1,
  updateArg, cycleActiveArg,
  computeCirclePreview, computeLinePreview, computeRectPreview, computeLiveValues,
} from '../lib/drawing/drawingCommand';
import DrawingCommandPanel from './DrawingCommandPanel';
import ShapeView from './ShapeView';
import SymbolView from './SymbolView';
import CanvasGrid from './CanvasGrid';
import CanvasAxis from './CanvasAxis';
import CanvasViewport from './CanvasViewport';
import CanvasOverlay from './CanvasOverlay';
import CommentThreadCard from './CommentThreadCard';

/* ── Formatting bar helpers ──────────────────────────────────────── */

const FmtBtn: React.FC<{
  active?: boolean;
  title?: string;
  onClick?: () => void;
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
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 5, border: 'none',
        background: active ? '#eff6ff' : hov ? '#f3f4f6' : 'transparent',
        color: active ? '#2563eb' : '#6b7280',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.08s, color 0.08s',
      }}
    >
      {children}
    </button>
  );
};

const FmtSep = () => (
  <div style={{ width: 1, height: 16, background: '#e5e7eb', margin: '0 3px', flexShrink: 0 }} />
);

/* ── Formatting toolbar ──────────────────────────────────────────── */

const FormattingBar: React.FC<{
  draft: DraftTextObject;
  onUpdate: (u: Partial<DraftTextObject>) => void;
  onCommit: () => void;
  onSetLink: (url: string) => void;
  onRemoveLink: () => void;
}> = ({ draft, onUpdate, onCommit, onSetLink, onRemoveLink }) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState(draft.hyperlink?.url ?? '');

  const applyLink = () => {
    const url = linkDraft.trim();
    if (url) onSetLink(url); else onRemoveLink();
    setLinkOpen(false);
  };

  return (
  <div
    onClick={e => e.stopPropagation()}
    style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', gap: 1,
      marginTop: 6,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
      padding: '4px 6px',
      width: 'max-content',
      /* counter-scale so the toolbar stays at a readable size */
      transform: `scale(var(--canvas-inv-zoom, 1))`,
      transformOrigin: 'top left',
    }}
  >
    <FmtBtn active={draft.alignment === 'left'}   title="Align left"   onClick={() => onUpdate({ alignment: 'left' })}>
      <AlignLeft   size={13} strokeWidth={1.75} />
    </FmtBtn>
    <FmtBtn active={draft.alignment === 'center'} title="Align center" onClick={() => onUpdate({ alignment: 'center' })}>
      <AlignCenter size={13} strokeWidth={1.75} />
    </FmtBtn>
    <FmtBtn active={draft.alignment === 'right'}  title="Align right"  onClick={() => onUpdate({ alignment: 'right' })}>
      <AlignRight  size={13} strokeWidth={1.75} />
    </FmtBtn>

    <FmtSep />

    <FmtBtn active={draft.baseline === 'top'}    title="Baseline top"    onClick={() => onUpdate({ baseline: 'top' })}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="2" x2="13" y2="2" />
        <line x1="8" y1="4" x2="8" y2="13" />
        <polyline points="5,7 8,4 11,7" />
      </svg>
    </FmtBtn>
    <FmtBtn active={draft.baseline === 'middle'} title="Baseline middle" onClick={() => onUpdate({ baseline: 'middle' })}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="8" x2="13" y2="8" />
        <line x1="8" y1="2" x2="8" y2="14" />
        <polyline points="5,5 8,2 11,5" /><polyline points="5,11 8,14 11,11" />
      </svg>
    </FmtBtn>
    <FmtBtn active={draft.baseline === 'bottom'} title="Baseline bottom" onClick={() => onUpdate({ baseline: 'bottom' })}>
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="14" x2="13" y2="14" />
        <line x1="8" y1="3" x2="8" y2="12" />
        <polyline points="5,9 8,12 11,9" />
      </svg>
    </FmtBtn>

    <FmtSep />

    <FmtBtn active={draft.bold}      title="Bold"      onClick={() => onUpdate({ bold:      !draft.bold })}>
      <Bold      size={13} strokeWidth={draft.bold ? 2.5 : 1.75} />
    </FmtBtn>
    <FmtBtn active={draft.italic}    title="Italic"    onClick={() => onUpdate({ italic:    !draft.italic })}>
      <Italic    size={13} strokeWidth={1.75} />
    </FmtBtn>
    <FmtBtn active={draft.underline} title="Underline" onClick={() => onUpdate({ underline: !draft.underline })}>
      <Underline size={13} strokeWidth={1.75} />
    </FmtBtn>

    <FmtSep />

    <FmtBtn
      active={!!draft.hyperlink || linkOpen}
      title={draft.hyperlink ? `Link: ${draft.hyperlink.url}` : 'Add link'}
      onClick={() => { setLinkDraft(draft.hyperlink?.url ?? ''); setLinkOpen(o => !o); }}
    >
      <Link size={13} strokeWidth={1.75} />
    </FmtBtn>

    <button
      title="Done"
      onClick={onCommit}
      style={{
        width: 28, height: 28, marginLeft: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#2563eb', borderRadius: 7, border: 'none',
        cursor: 'pointer', flexShrink: 0,
      }}
    >
      <Check size={13} strokeWidth={2.5} color="#fff" />
    </button>

    {/* ── Hyperlink popover ── */}
    {linkOpen && (
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0,
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
          padding: 8, zIndex: 10,
        }}
      >
        <input
          autoFocus
          value={linkDraft}
          placeholder="https://example.com"
          onChange={e => setLinkDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setLinkOpen(false); }}
          style={{
            width: 200, height: 30, fontSize: 12,
            border: '1px solid #d1d5db', borderRadius: 7,
            padding: '0 9px', outline: 'none', color: '#111827',
          }}
        />
        <button
          title="Apply" onClick={applyLink}
          style={{
            width: 30, height: 30, flexShrink: 0, border: 'none', borderRadius: 7,
            background: '#2563eb', color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Check size={13} strokeWidth={2.5} />
        </button>
        {draft.hyperlink && (
          <button
            title="Remove link"
            onClick={() => { onRemoveLink(); setLinkDraft(''); setLinkOpen(false); }}
            style={{
              width: 30, height: 30, flexShrink: 0, border: '1px solid #e5e7eb', borderRadius: 7,
              background: '#f9fafb', color: '#6b7280', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        )}
      </div>
    )}
  </div>
  );
};

/* ── Floating draft text editor (renders in world space) ─────────── */

const DraftTextEditor: React.FC<{
  draft: DraftTextObject;
  onUpdate: (u: Partial<DraftTextObject>) => void;
  onCommit: () => void;
  onCancel: () => void;
  onSetLink: (url: string) => void;
  onRemoveLink: () => void;
}> = ({ draft, onUpdate, onCommit, onCancel, onSetLink, onRemoveLink }) => {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Focus and place caret at the end (re-edit seeds existing content).
    const ta = taRef.current;
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  }, []);

  return (
    <div
      style={{ position: 'absolute', left: draft.x, top: draft.y, zIndex: 50 }}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <textarea
        ref={taRef}
        value={draft.value}
        placeholder="Your text"
        onChange={e => onUpdate({ value: e.target.value })}
        onKeyDown={e => {
          if (e.key === 'Escape') { onCancel(); return; }
          // Cmd/Ctrl + Enter commits
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onCommit(); }
        }}
        style={{
          display: 'block',
          minWidth: 200, minHeight: 40,
          fontSize: draft.fontSize,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          fontWeight: draft.bold ? 700 : 400,
          fontStyle: draft.italic ? 'italic' : 'normal',
          textDecoration: draft.underline ? 'underline' : 'none',
          textAlign: draft.alignment,
          color: draft.color,
          background: 'rgba(255,255,255,0.97)',
          border: '2px solid #3b82f6',
          borderRadius: 4,
          padding: '8px 10px',
          outline: 'none',
          resize: 'both',
          lineHeight: 1.5,
          boxShadow: '0 2px 16px rgba(59,130,246,0.18)',
        }}
      />
      <FormattingBar
        draft={draft}
        onUpdate={onUpdate}
        onCommit={onCommit}
        onSetLink={onSetLink}
        onRemoveLink={onRemoveLink}
      />
    </div>
  );
};

/* ── Placed text object (renders in world space) ─────────────────── */

const PlacedTextView: React.FC<{
  text: TextObject;
  selected: boolean;
  hovered: boolean;
}> = ({ text, selected, hovered }) => {
  // Hidden text is not rendered (acceptance criterion: hidden text should not render).
  if (!text.visible) return null;

  const fontSizePx = parseFloat(text.fontSize) || 14;
  const outline =
    selected ? '1.5px solid #3b82f6'
    : hovered ? '1.5px solid #93c5fd'
    : '1.5px solid transparent';

  return (
    <div
      data-object-id={text.id}
      style={{
        position: 'absolute',
        left: text.x, top: text.y,
        padding: '4px 6px',
        fontSize: fontSizePx,
        fontFamily: text.fontFamily
          ? `${text.fontFamily}, Inter, -apple-system, sans-serif`
          : 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontWeight: text.bold ? 700 : 400,
        fontStyle: text.italic ? 'italic' : 'normal',
        textDecoration: text.underline ? 'underline' : 'none',
        textAlign: text.alignment,
        color: text.textColor,
        opacity: text.hyperlink ? 1 : 1,
        cursor: text.locked ? 'default' : text.hyperlink ? 'pointer' : 'move',
        transform: `rotate(${text.rotation}deg) scale(${(text.scale ?? 100) / 100})`,
        transformOrigin: 'top left',
        border: outline,
        borderRadius: 3,
        background: selected ? 'rgba(59,130,246,0.04)' : 'transparent',
        userSelect: 'none',
        whiteSpace: 'pre-wrap',
        maxWidth: 400,
      }}
    >
      {text.value}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   EditorCanvas
════════════════════════════════════════════════════════════════════ */

const Canvas: React.FC = () => {
  const {
    activeTool, setActiveTool,
    draftTextObject, setDraftTextObject, updateDraftTextObject, commitDraftText, cancelDraftText,
    objects, selectedObjectId, selectedObjectIds, selectObject, selectObjects, deleteSelectedObjects,
    addObject, updateObject, updateObjectTransient, deleteObject,
    editingObjectId, enterTextEditMode,
    hoveredObjectId, setHoveredObject,
    setTextHyperlink, removeTextHyperlink,
    beginHistory, undo, redo,
    activeLayerId, layers,
    selectLayer,
    symbols, selectedSymbolId,
    viewport, zoomAtPoint, panBy,
    comments, selectedCommentId, commentFilter,
    selectComment, createComment, cancelAddingComment, addCommentReply, resolveComment, reopenComment,
  } = useEditor();

  // Visible layer id set — objects on hidden layers are not rendered
  const visibleLayerIds = React.useMemo(
    () => new Set(layers.filter(l => l.visible).map(l => l.id)),
    [layers],
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const isPanningRef    = useRef(false);
  const isSpaceRef      = useRef(false);
  const hasPannedRef    = useRef(false);
  const lastPosRef      = useRef({ x: 0, y: 0 });
  const dragRef         = useRef<DragSession | null>(null);
  // Always-current viewport for use in event-handler closures
  const viewportRef     = useRef(viewport);
  viewportRef.current   = viewport;

  // Refs for values used inside stable useEffect closures (avoids stale captures).
  const activeToolRef      = useRef(activeTool);
  activeToolRef.current    = activeTool;
  const draftRef           = useRef(draftTextObject);
  draftRef.current         = draftTextObject;
  const selectedIdRef      = useRef(selectedObjectId);
  selectedIdRef.current    = selectedObjectId;
  const objectsRef2        = useRef(objects);
  objectsRef2.current      = objects;

  const [mouseWorld, setMouseWorld] = useState({ x: 0, y: 0 });
  const [hoverPreview, setHoverPreview] = useState<{ from: Vec2; to: Vec2 } | null>(null);
  const [hoverArcPreview, setHoverArcPreview] = useState<ArcPreview | null>(null);
  const [snapPoint, setSnapPoint] = useState<Vec2 | null>(null);
  const snapPointRef = useRef<Vec2 | null>(null);
  const [rubberBand, setRubberBandState] = useState<RubberBand | null>(null);
  const [draftCommentPos, setDraftCommentPos] = useState<{ x: number; y: number } | null>(null);

  /* ── Param drawing command state ──────────────────────────────── */
  const [drawCmd, setDrawCmd] = useState<DrawingCommand | null>(null);
  const drawCmdRef = useRef<DrawingCommand | null>(null);
  drawCmdRef.current = drawCmd;
  /* Always-current cursor ref for use in stable finalize callbacks */
  const mouseWorldRef = useRef<Vec2>({ x: 0, y: 0 });
  mouseWorldRef.current = mouseWorld;
  /* Monotonic counter for generated shape names */
  const drawShapeCounterRef = useRef(1);

  /* ── Context menu ──────────────────────────────────────────────── */
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  const ctxMenuOpenRef = useRef(false);
  ctxMenuOpenRef.current = !!ctxMenu;
  const clipboardRef = useRef<typeof objects[number] | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const handler = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCtxMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  // Ref for selectedObjectIds so the stable keyboard handler can read the latest value
  const selectedObjectIdsRef = useRef(selectedObjectIds);
  selectedObjectIdsRef.current = selectedObjectIds;
  // Refs for comment state used in keyboard handler closures
  const selectedCommentIdRef = useRef(selectedCommentId);
  selectedCommentIdRef.current = selectedCommentId;
  const draftCommentPosRef = useRef(draftCommentPos);
  draftCommentPosRef.current = draftCommentPos;
  const selectCommentRef = useRef(selectComment);
  selectCommentRef.current = selectComment;
  const setDraftCommentPosRef = useRef(setDraftCommentPos);
  setDraftCommentPosRef.current = setDraftCommentPos;

  const SNAP_PX = 15; // pixel radius for object snap
  const SNAP_TOOLS = new Set(['line', 'polyline', 'arc', 'rectangle', 'circle']);

  const baseCursor = activeTool === 'comment' ? 'crosshair' : getTool(activeTool).cursor;

  // When tool changes: cancel the previous tool (clears polyline vertices etc.)
  // and clear all previews and snap state.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (prevToolRef.current !== activeTool) {
      getTool(prevToolRef.current).onCancel?.();
      prevToolRef.current = activeTool;
    }
    setHoverPreview(null);
    setHoverArcPreview(null);
    setSnapPoint(null);
    snapPointRef.current = null;
    setRubberBandState(null);
  }, [activeTool]);

  /* Initialise / clear drawing command when tool changes */
  useEffect(() => {
    if (PARAM_DRAW_TOOLS.has(activeTool)) {
      setDrawCmd(makeDrawingCommand(activeTool));
    } else {
      setDrawCmd(null);
    }
  }, [activeTool]);

  /* ── Pointer → world / hit-test helpers ────────────────────────── */
  const worldFromEvent = useCallback((clientX: number, clientY: number): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const { panX, panY, zoom } = viewportRef.current;
    return { x: (clientX - rect.left - panX) / zoom, y: (clientY - rect.top - panY) / zoom };
  }, []);

  const hitFromEvent = (e: React.MouseEvent): string | null =>
    (e.target as HTMLElement).closest('[data-object-id]')?.getAttribute('data-object-id') ?? null;

  /** Begin a floating text draft at a world point (used by the text tool). */
  const startTextDraft = useCallback((world: Vec2) => {
    setDraftTextObject({
      id: `text-${Date.now()}`,
      type: 'text',
      x: world.x, y: world.y,
      width: 200, height: 40,
      value: '',
      fontSize: 14,
      fontFamily: 'Inter, -apple-system, sans-serif',
      bold: false, italic: false, underline: false,
      color: '#1f2937',
      alignment: 'left', baseline: 'top',
      layerId: activeLayerId,
    });
  }, [setDraftTextObject, activeLayerId]);

  /** Assemble a fresh ToolContext for a pointer event. */
  const buildToolContext = useCallback((pointer: ToolPointer): ToolContext => {
    const sym = selectedSymbolId ? symbols.find(s => s.id === selectedSymbolId) : undefined;
    return {
      pointer,
      objects,
      selectedObjectId,
      selectedObjectIds,
      getObject: id => objects.find(o => o.id === id),
      addObject, updateObject, updateObjectTransient, deleteObject,
      selectObject, selectObjects,
      setRubberBand: (band) => setRubberBandState(band),
      selectLayer, beginHistory,
      startTextDraft, enterTextEditMode,
      pendingSymbol: sym ? { id: sym.id, name: sym.name } : null,
      activeLayerId, setActiveTool,
    };
  }, [objects, selectedObjectId, selectedObjectIds, addObject, updateObject, updateObjectTransient,
      deleteObject, selectObject, selectObjects, selectLayer, beginHistory,
      startTextDraft, enterTextEditMode, symbols, selectedSymbolId,
      activeLayerId, setActiveTool]);

  /* ── Non-passive wheel zoom ────────────────────────────────────── */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      // Normalise across deltaMode values
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 20;
      if (e.deltaMode === 2) delta *= 300;
      const rect = el.getBoundingClientRect();
      zoomAtPoint(e.clientX - rect.left, e.clientY - rect.top, delta);
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [zoomAtPoint]);

  /* ── Global mouse-move / mouse-up for panning + tool drags ──────── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      // Panning takes priority over any tool drag.
      if (isPanningRef.current) {
        const dx = e.clientX - lastPosRef.current.x;
        const dy = e.clientY - lastPosRef.current.y;
        panBy(dx, dy);
        lastPosRef.current = { x: e.clientX, y: e.clientY };
        hasPannedRef.current = true;
        setMouseWorld(worldFromEvent(e.clientX, e.clientY));
        return;
      }
      // Active tool drag (e.g. moving an object).
      if (dragRef.current) {
        const world = worldFromEvent(e.clientX, e.clientY);
        dragRef.current.onMove(world);
        setMouseWorld(world);
      }
    };

    const onUp = (e: MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isSpaceRef.current ? 'grab' : baseCursor;
        }
        return;
      }
      if (dragRef.current) {
        dragRef.current.onUp?.(worldFromEvent(e.clientX, e.clientY));
        dragRef.current = null;
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panBy, baseCursor, worldFromEvent]);

  /* ── Space key + tool shortcuts + Escape ───────────────────────── */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };

    const down = (e: KeyboardEvent) => {
      // Space → pan mode (skip if user is typing).
      if (e.code === 'Space' && !e.repeat && !isTyping(e.target)) {
        e.preventDefault();
        isSpaceRef.current = true;
        if (canvasRef.current && !isPanningRef.current) {
          canvasRef.current.style.cursor = 'grab';
        }
      }

      // Escape — close context menu first, then other cancel logic
      if (e.key === 'Escape') {
        if (ctxMenuOpenRef.current) { setCtxMenu(null); return; }
        if (draftRef.current) {
          cancelDraftText();
          return;
        }
        // Cancel active drawing command
        if (drawCmdRef.current) {
          setDrawCmd(null);
          setActiveTool('select');
          return;
        }
        // Cancel comment draft
        if (draftCommentPosRef.current) {
          setDraftCommentPosRef.current(null);
          return;
        }
        // Deselect comment
        if (selectedCommentIdRef.current) {
          selectCommentRef.current(null);
          return;
        }
        getTool(activeToolRef.current).onCancel?.();
        setActiveTool('select');
        return;
      }

      // Enter — confirm drawing command (when not typing in a text field)
      if (e.key === 'Enter' && drawCmdRef.current?.step === 'previewing' && !isTyping(e.target)) {
        e.preventDefault();
        handleDrawCmdDoneRef.current();
        return;
      }

      // All other shortcuts — skip while a text field or draft is active.
      if (isTyping(e.target) || draftRef.current) return;

      const mod = e.metaKey || e.ctrlKey;

      // Undo / Redo
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+D — duplicate selected object
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        const selId = selectedIdRef.current;
        if (selId) {
          const obj = objectsRef2.current.find(o => o.id === selId);
          if (obj) {
            addObject({ ...obj, id: `dup-${Date.now()}`, name: `${obj.name} copy`, x: obj.x + 20, y: obj.y + 20 });
          }
        }
        return;
      }

      // Delete / Backspace — remove selected object(s)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const multiIds = selectedObjectIdsRef.current;
        if (multiIds.length > 0) {
          e.preventDefault();
          deleteSelectedObjects();
          return;
        }
      }

      // Single-key tool shortcuts (no modifier)
      if (!mod && !e.shiftKey) {
        const SHORTCUTS: Record<string, string> = {
          v: 'select',
          l: 'line',
          p: 'polyline',
          a: 'arc',
          r: 'rectangle',
          c: 'circle',
          t: 'text',
          m: 'move',
          o: 'copy',
        };
        const toolId = SHORTCUTS[e.key.toLowerCase()];
        if (toolId) {
          e.preventDefault();
          setActiveTool(toolId);
        }
      }
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpaceRef.current = false;
        if (canvasRef.current && !isPanningRef.current) {
          canvasRef.current.style.cursor = getTool(activeToolRef.current).cursor;
        }
      }
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  // Stable store callbacks only — mutable values accessed through refs above.
  }, [cancelDraftText, undo, redo, deleteObject, deleteSelectedObjects, setActiveTool, addObject]);

  /* ── Mouse handlers — pan/zoom stay here, everything else → tools ── */

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Pan: middle button, or space + left button.
    const isPanTrigger = e.button === 1 || (e.button === 0 && isSpaceRef.current);
    if (isPanTrigger) {
      e.preventDefault();
      isPanningRef.current = true;
      hasPannedRef.current = false;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0) return;

    // Comment placement mode: drop a draft pin at the clicked world position.
    if (activeTool === 'comment') {
      const world = worldFromEvent(e.clientX, e.clientY);
      setDraftCommentPos(world);
      setActiveTool('select');
      selectComment(null);
      return;
    }

    // Clicking canvas background clears comment state (pins use stopPropagation on onClick,
    // but mousedown still bubbles — only clear if not targeting a comment pin element).
    const targetEl = e.target as HTMLElement;
    const isOnPin = !!targetEl.closest('[data-comment-pin]');
    if (!isOnPin) {
      if (draftCommentPos) { setDraftCommentPos(null); }
      if (selectedCommentId) { selectComment(null); }
    }

    // Clicking the canvas while a draft is open commits it (empty → discarded).
    // The editor stops propagation, so this only fires for clicks outside it.
    if (draftTextObject) { commitDraftText(); return; }

    // Dispatch to the active tool, applying object snap if a drawing tool is active.
    const rawWorld = worldFromEvent(e.clientX, e.clientY);
    const snappedWorld = (SNAP_TOOLS.has(activeTool) && snapPointRef.current)
      ? snapPointRef.current
      : rawWorld;

    // Param drawing tools intercept the click before it reaches the drag-based tool.
    if (PARAM_DRAW_TOOLS.has(activeTool) && drawCmdRef.current) {
      handleDrawCmdPointerDown(snappedWorld);
      return;
    }

    const pointer: ToolPointer = {
      world: snappedWorld,
      hitObjectId: hitFromEvent(e),
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };
    const session = getTool(activeTool).onPointerDown?.(buildToolContext(pointer));
    if (session) dragRef.current = session;
  }, [activeTool, draftCommentPos, selectedCommentId, selectComment, draftTextObject, commitDraftText, worldFromEvent, buildToolContext]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanningRef.current || dragRef.current) return;
    const rawWorld = worldFromEvent(e.clientX, e.clientY);
    setMouseWorld(rawWorld);
    setHoveredObject(hitFromEvent(e));

    // Object snap: active only for drawing tools
    let snapped: Vec2 | null = null;
    if (SNAP_TOOLS.has(activeTool)) {
      const snapR = SNAP_PX / viewportRef.current.zoom;
      snapped = findSnapPoint(rawWorld, objectsRef2.current, snapR);
    }
    setSnapPoint(snapped);
    snapPointRef.current = snapped;

    const pw = snapped ?? rawWorld;
    const tool = getTool(activeTool);
    setHoverPreview(tool.getHoverPreview?.(pw) ?? null);
    setHoverArcPreview(tool.getHoverArcPreview?.(pw) ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldFromEvent, setHoveredObject, activeTool]);

  const handleDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const pointer: ToolPointer = {
      world: worldFromEvent(e.clientX, e.clientY),
      hitObjectId: hitFromEvent(e),
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };
    getTool(activeTool).onDoubleClick?.(buildToolContext(pointer));
  }, [activeTool, worldFromEvent, buildToolContext]);

  const handleCancelDraft = useCallback(() => {
    cancelDraftText();
  }, [cancelDraftText]);

  /* ── Param drawing helpers ─────────────────────────────────────── */

  /** Create the final CanvasObject and commit it to the scene. */
  const finalizeDrawCmd = useCallback((cmd: DrawingCommand, cursor: Vec2) => {
    const center = cmd.points[0];
    if (!center) return;
    const num = drawShapeCounterRef.current++;
    const common = {
      layerId: activeLayerId, locked: false, visible: true,
      rotation: 0, scale: 100,
      stroke: '#1f2937', strokeWidth: 2, strokeStyle: 'solid' as const,
    };
    let obj: CanvasObject;

    if (cmd.tool === 'circle') {
      const { cx, cy, r } = computeCirclePreview(center, cursor, cmd.args);
      if (r <= 0) return;
      obj = {
        ...common, id: `ellipse-${Date.now()}`, type: 'ellipse',
        name: `Circle ${num}`,
        x: cx - r, y: cy - r, width: r * 2, height: r * 2,
        fill: 'none',
      };
    } else if (cmd.tool === 'line') {
      const { x1, y1, x2, y2 } = computeLinePreview(center, cursor, cmd.args);
      const dx = x2 - x1, dy = y2 - y1;
      if (Math.hypot(dx, dy) < 1) return;
      obj = {
        ...common, id: `line-${Date.now()}`, type: 'line',
        name: `Line ${num}`,
        x: x1, y: y1, dx, dy,
        width: Math.abs(dx), height: Math.abs(dy),
      };
    } else if (cmd.tool === 'rectangle') {
      const { x, y, width, height } = computeRectPreview(center, cursor, cmd.args);
      if (width < 1 || height < 1) return;
      obj = {
        ...common, id: `rectangle-${Date.now()}`, type: 'rectangle',
        name: `Rectangle ${num}`,
        x, y, width, height,
        fill: 'none', cornerRadius: 0,
      };
    } else {
      return;
    }

    addObject(obj);
    setActiveTool('select');
    setDrawCmd(null);
  }, [activeLayerId, addObject, setActiveTool]);

  /** Called when the user clicks the canvas during a param-drawing command. */
  const handleDrawCmdPointerDown = useCallback((world: Vec2) => {
    const cmd = drawCmdRef.current;
    if (!cmd) return;
    if (cmd.step === 'awaiting_first_point') {
      setDrawCmd(advanceToStep1(cmd, world));
    } else if (cmd.step === 'previewing') {
      finalizeDrawCmd(cmd, world);
    }
  }, [finalizeDrawCmd]);

  /** Called by Done button or Enter key. */
  const handleDrawCmdDone = useCallback(() => {
    const cmd = drawCmdRef.current;
    if (!cmd || cmd.step !== 'previewing') return;
    finalizeDrawCmd(cmd, mouseWorldRef.current);
  }, [finalizeDrawCmd]);

  const handleDrawCmdArgChange = useCallback((argId: string, text: string) => {
    setDrawCmd(prev => prev ? updateArg(prev, argId, text) : null);
  }, []);

  const handleDrawCmdArgFocus = useCallback((argId: string) => {
    setDrawCmd(prev => {
      if (!prev || prev.activeArgId === argId) return prev;
      const arg = prev.args.find(a => a.id === argId);
      return { ...prev, activeArgId: argId, inputText: arg?.value != null ? String(arg.value) : '' };
    });
  }, []);

  const handleDrawCmdTabNext = useCallback(() => {
    setDrawCmd(prev => prev ? cycleActiveArg(prev, 1) : null);
  }, []);

  const handleDrawCmdTabPrev = useCallback(() => {
    setDrawCmd(prev => prev ? cycleActiveArg(prev, -1) : null);
  }, []);

  /* Stable ref so the keyboard effect can call Done without re-subscribing */
  const handleDrawCmdDoneRef = useRef(handleDrawCmdDone);
  handleDrawCmdDoneRef.current = handleDrawCmdDone;

  /* ── Render ────────────────────────────────────────────────────── */

  return (
    <main
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        top: 'var(--header-h)',
        left: 'calc(var(--sidebar-w) + var(--left-panel-w))',
        right: 'var(--panel-w)',
        bottom: 0,
        background: '#f8f9fb',
        overflow: 'hidden',
        cursor: baseCursor,
        userSelect: 'none',
      }}
    >
      {/* Scalable grid */}
      <CanvasGrid />

      {/* World-origin axis */}
      <CanvasAxis />

      {/* World-space transform container */}
      <CanvasViewport>
        {objects.filter(isShape).filter(s => visibleLayerIds.has(s.layerId)).map(s => (
          <ShapeView
            key={s.id}
            shape={s}
            selected={selectedObjectId === s.id || selectedObjectIds.includes(s.id)}
            hovered={hoveredObjectId === s.id}
          />
        ))}
        {objects.filter(isSymbol).filter(s => visibleLayerIds.has(s.layerId)).map(s => (
          <SymbolView
            key={s.id}
            symbol={s}
            selected={selectedObjectId === s.id || selectedObjectIds.includes(s.id)}
            hovered={hoveredObjectId === s.id}
          />
        ))}
        {objects
          .filter(isTextObject)
          .filter(t => visibleLayerIds.has(t.layerId) && t.id !== editingObjectId)
          .map(t => (
            <PlacedTextView
              key={t.id}
              text={t}
              selected={selectedObjectId === t.id || selectedObjectIds.includes(t.id)}
              hovered={hoveredObjectId === t.id}
            />
          ))}
        {draftTextObject && (
          <DraftTextEditor
            draft={draftTextObject}
            onUpdate={updateDraftTextObject}
            onCommit={commitDraftText}
            onCancel={handleCancelDraft}
            onSetLink={url => setTextHyperlink(draftTextObject.id, url)}
            onRemoveLink={() => removeTextHyperlink(draftTextObject.id)}
          />
        )}
      </CanvasViewport>

      {/* Selection bounding box with corner handles */}
      {(() => {
        const selIds = new Set([
          ...selectedObjectIds,
          ...(selectedObjectId ? [selectedObjectId] : []),
        ]);
        if (selIds.size === 0) return null;
        const sel = objects.filter(o => selIds.has(o.id) && o.visible);
        if (sel.length === 0) return null;
        const { zoom, panX, panY } = viewport;
        const toSX = (wx: number) => wx * zoom + panX;
        const toSY = (wy: number) => wy * zoom + panY;
        const HW = 4;
        return (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 28 }}>
            {sel.map(obj => {
              let wx1: number, wy1: number, wx2: number, wy2: number;
              if (obj.type === 'line') {
                const lo = obj as any;
                wx1 = Math.min(lo.x, lo.x + lo.dx); wy1 = Math.min(lo.y, lo.y + lo.dy);
                wx2 = Math.max(lo.x, lo.x + lo.dx); wy2 = Math.max(lo.y, lo.y + lo.dy);
              } else {
                wx1 = obj.x; wy1 = obj.y;
                wx2 = obj.x + obj.width; wy2 = obj.y + obj.height;
              }
              const sx1 = toSX(wx1), sy1 = toSY(wy1);
              const sx2 = toSX(wx2), sy2 = toSY(wy2);
              const corners: [number, number][] = [
                [sx1, sy1], [sx2, sy1], [sx1, sy2], [sx2, sy2],
              ];
              return (
                <g key={obj.id}>
                  <rect x={sx1} y={sy1} width={sx2 - sx1} height={sy2 - sy1}
                    fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                  {corners.map(([cx, cy], i) => (
                    <rect key={i}
                      x={cx - HW} y={cy - HW} width={HW * 2} height={HW * 2}
                      fill="white" stroke="#3b82f6" strokeWidth="1.5" rx="1" />
                  ))}
                </g>
              );
            })}
          </svg>
        );
      })()}

      {/* Marquee rubber-band selection rectangle */}
      {rubberBand && (() => {
        const rx1 = rubberBand.x1 * viewport.zoom + viewport.panX;
        const ry1 = rubberBand.y1 * viewport.zoom + viewport.panY;
        const rx2 = rubberBand.x2 * viewport.zoom + viewport.panX;
        const ry2 = rubberBand.y2 * viewport.zoom + viewport.panY;
        return (
          <div style={{
            position: 'absolute',
            left: Math.min(rx1, rx2), top: Math.min(ry1, ry2),
            width: Math.abs(rx2 - rx1), height: Math.abs(ry2 - ry1),
            border: '1.5px solid #3b82f6',
            background: 'rgba(59,130,246,0.08)',
            pointerEvents: 'none',
            zIndex: 29,
            borderRadius: 2,
          }} />
        );
      })()}

      {/* Rubber-band line preview (polyline, arc phase 1) */}
      {hoverPreview && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 30 }}>
          <line
            x1={hoverPreview.from.x * viewport.zoom + viewport.panX}
            y1={hoverPreview.from.y * viewport.zoom + viewport.panY}
            x2={hoverPreview.to.x   * viewport.zoom + viewport.panX}
            y2={hoverPreview.to.y   * viewport.zoom + viewport.panY}
            stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="7 4" strokeLinecap="round" opacity="0.8"
          />
          <circle
            cx={hoverPreview.from.x * viewport.zoom + viewport.panX}
            cy={hoverPreview.from.y * viewport.zoom + viewport.panY}
            r="4" fill="#3b82f6" opacity="0.6"
          />
        </svg>
      )}

      {/* Rubber-band arc preview (arc tool phase 2) */}
      {hoverArcPreview && (() => {
        const { cx, cy, r, startAngle, endAngle } = hoverArcPreview;
        const toRad = (d: number) => d * Math.PI / 180;
        const toSX = (wx: number) => wx * viewport.zoom + viewport.panX;
        const toSY = (wy: number) => wy * viewport.zoom + viewport.panY;
        const sr = r * viewport.zoom;
        const sx = toSX(cx + r * Math.cos(toRad(startAngle)));
        const sy = toSY(cy - r * Math.sin(toRad(startAngle)));
        const ex = toSX(cx + r * Math.cos(toRad(endAngle)));
        const ey = toSY(cy - r * Math.sin(toRad(endAngle)));
        const sweep = ((endAngle - startAngle) + 360) % 360;
        const largeArc = sweep > 180 ? 1 : 0;
        const d = `M ${sx} ${sy} A ${sr} ${sr} 0 ${largeArc} 1 ${ex} ${ey}`;
        return (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 30 }}>
            <path d={d} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="7 4" strokeLinecap="round" opacity="0.8" />
            <circle cx={sx} cy={sy} r="4" fill="#3b82f6" opacity="0.6" />
            <circle cx={ex} cy={ey} r="3" fill="#3b82f6" opacity="0.4" />
          </svg>
        );
      })()}

      {/* ── Param drawing preview overlay ── */}
      {drawCmd && drawCmd.step === 'previewing' && drawCmd.points[0] && (() => {
        const center = drawCmd.points[0];
        const cursor = mouseWorld;
        const { zoom, panX, panY } = viewport;
        const sx = (wx: number) => wx * zoom + panX;
        const sy = (wy: number) => wy * zoom + panY;

        if (drawCmd.tool === 'circle') {
          const { cx, cy, r } = computeCirclePreview(center, cursor, drawCmd.args);
          const scx = sx(cx), scy = sy(cy);
          const ecx = sx(cx + (cursor.x - cx) / Math.max(Math.hypot(cursor.x - cx, cursor.y - cy), 0.001) * r);
          const ecy = sy(cy + (cursor.y - cy) / Math.max(Math.hypot(cursor.x - cx, cursor.y - cy), 0.001) * r);
          const curSx = sx(cursor.x), curSy = sy(cursor.y);
          const sr = r * zoom;
          const live = computeLiveValues(drawCmd, cursor);
          const labelX = (scx + curSx) / 2;
          const labelY = (scy + curSy) / 2 - 14;

          return (
            <svg key="draw-preview" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 33 }}>
              {/* Dashed guide: center → cursor edge */}
              <line x1={scx} y1={scy} x2={curSx} y2={curSy}
                stroke="#3b6ff0" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" opacity="0.6" />
              {/* Circle outline */}
              <circle cx={scx} cy={scy} r={Math.max(sr, 1)}
                fill="rgba(59,111,240,0.05)" stroke="#3b6ff0" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.8" />
              {/* Center dot */}
              <circle cx={scx} cy={scy} r="4" fill="#3b6ff0" opacity="0.85" />
              {/* Radius label chip */}
              <g transform={`translate(${labelX},${labelY})`}>
                <rect x="-26" y="-11" width="52" height="20" rx="5" fill="#1d4ed8" opacity="0.92" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize="11"
                  fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
                  {(live.radius ?? r).toFixed(2)}
                </text>
              </g>
            </svg>
          );
        }

        if (drawCmd.tool === 'line') {
          const { x1, y1, x2, y2, length, angleDeg } = computeLinePreview(center, cursor, drawCmd.args);
          const lx1 = sx(x1), ly1 = sy(y1), lx2 = sx(x2), ly2 = sy(y2);
          const midX = (lx1 + lx2) / 2, midY = (ly1 + ly2) / 2;
          const live = computeLiveValues(drawCmd, cursor);
          return (
            <svg key="draw-preview" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 33 }}>
              <line x1={lx1} y1={ly1} x2={lx2} y2={ly2}
                stroke="#3b6ff0" strokeWidth="1.5" strokeDasharray="6 4" strokeLinecap="round" opacity="0.85" />
              <circle cx={lx1} cy={ly1} r="4" fill="#3b6ff0" opacity="0.85" />
              <circle cx={lx2} cy={ly2} r="3" fill="#3b6ff0" opacity="0.5" />
              {/* Length label */}
              <g transform={`translate(${midX},${midY - 14})`}>
                <rect x="-28" y="-11" width="56" height="20" rx="5" fill="#1d4ed8" opacity="0.92" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize="11"
                  fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
                  {(live.length ?? length).toFixed(2)}
                </text>
              </g>
              {/* Angle label */}
              <g transform={`translate(${lx1 + 22},${ly1 - 10})`}>
                <rect x="-22" y="-10" width="44" height="18" rx="4" fill="#374151" opacity="0.88" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize="10"
                  fill="white" fontFamily="Inter, system-ui, sans-serif">
                  {((live.angle ?? angleDeg) % 360 + 360).toFixed(1)}°
                </text>
              </g>
            </svg>
          );
        }

        if (drawCmd.tool === 'rectangle') {
          const { x, y, width, height } = computeRectPreview(center, cursor, drawCmd.args);
          const rx = sx(x), ry = sy(y);
          const rw = width * zoom, rh = height * zoom;
          const live = computeLiveValues(drawCmd, cursor);
          return (
            <svg key="draw-preview" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 33 }}>
              <rect x={rx} y={ry} width={rw} height={rh}
                fill="rgba(59,111,240,0.05)" stroke="#3b6ff0" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.85" />
              <circle cx={rx} cy={ry} r="4" fill="#3b6ff0" opacity="0.85" />
              {/* Width label (bottom edge) */}
              <g transform={`translate(${rx + rw / 2},${ry + rh + 14})`}>
                <rect x="-28" y="-10" width="56" height="18" rx="4" fill="#1d4ed8" opacity="0.92" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize="11"
                  fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
                  {(live.width ?? width).toFixed(2)}
                </text>
              </g>
              {/* Height label (right edge) */}
              <g transform={`translate(${rx + rw + 14},${ry + rh / 2})`}>
                <rect x="-28" y="-10" width="56" height="18" rx="4" fill="#1d4ed8" opacity="0.92" />
                <text textAnchor="middle" dominantBaseline="middle" fontSize="11"
                  fontWeight="700" fill="white" fontFamily="Inter, system-ui, sans-serif">
                  {(live.height ?? height).toFixed(2)}
                </text>
              </g>
            </svg>
          );
        }

        return null;
      })()}

      {/* Object snap indicator */}
      {snapPoint && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 32 }}>
          <rect
            x={snapPoint.x * viewport.zoom + viewport.panX - 6}
            y={snapPoint.y * viewport.zoom + viewport.panY - 6}
            width={12} height={12}
            stroke="#10b981" strokeWidth="1.5" fill="rgba(16,185,129,0.12)"
            rx="2"
          />
        </svg>
      )}

      {/* Comment pins (screen space) */}
      {(() => {
        const visible = comments.filter(c => {
          if (commentFilter === 'open') return c.status === 'open';
          if (commentFilter === 'resolved') return c.status === 'resolved';
          return true;
        });
        return visible.map(c => {
          const sx = c.x * viewport.zoom + viewport.panX;
          const sy = c.y * viewport.zoom + viewport.panY;
          const isSelected = selectedCommentId === c.id;
          return (
            <div
              key={c.id}
              data-comment-pin="true"
              title={c.createdBy.name}
              onClick={e => { e.stopPropagation(); selectComment(isSelected ? null : c.id); setDraftCommentPos(null); }}
              style={{
                position: 'absolute',
                left: sx - 13, top: sy - 13,
                width: 26, height: 26,
                borderRadius: '50%',
                background: c.status === 'resolved' ? '#9ca3af' : c.createdBy.color,
                border: isSelected ? '2.5px solid #2563eb' : '2.5px solid #fff',
                boxShadow: isSelected
                  ? '0 0 0 2px #2563eb, 0 3px 10px rgba(0,0,0,0.22)'
                  : '0 3px 10px rgba(0,0,0,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 10, fontWeight: 700,
                cursor: 'pointer',
                zIndex: 35,
                userSelect: 'none',
                opacity: c.status === 'resolved' ? 0.65 : 1,
                transition: 'transform 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              {c.createdBy.initials}
            </div>
          );
        });
      })()}

      {/* Draft comment pin (not yet submitted) */}
      {draftCommentPos && (() => {
        const sx = draftCommentPos.x * viewport.zoom + viewport.panX;
        const sy = draftCommentPos.y * viewport.zoom + viewport.panY;
        return (
          <div style={{
            position: 'absolute',
            left: sx - 13, top: sy - 13,
            width: 26, height: 26,
            borderRadius: '50%',
            background: '#db2777',
            border: '2.5px solid #fff',
            boxShadow: '0 0 0 2px #2563eb, 0 3px 10px rgba(0,0,0,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 10, fontWeight: 700,
            zIndex: 35, userSelect: 'none',
          }}>
            S
          </div>
        );
      })()}

      {/* Floating comment thread card (selected comment) */}
      {selectedCommentId && (() => {
        const thread = comments.find(c => c.id === selectedCommentId);
        if (!thread) return null;
        const rect = canvasRef.current?.getBoundingClientRect();
        const cw = rect?.width ?? window.innerWidth;
        const ch = rect?.height ?? window.innerHeight;
        const sx = thread.x * viewport.zoom + viewport.panX;
        const sy = thread.y * viewport.zoom + viewport.panY;
        return (
          <CommentThreadCard
            thread={thread}
            screenX={sx} screenY={sy}
            canvasWidth={cw} canvasHeight={ch}
            onClose={() => selectComment(null)}
            onResolve={resolveComment}
            onReopen={reopenComment}
            onReply={(id, text) => addCommentReply(id, text)}
          />
        );
      })()}

      {/* Draft comment thread card */}
      {draftCommentPos && (() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        const cw = rect?.width ?? window.innerWidth;
        const ch = rect?.height ?? window.innerHeight;
        const sx = draftCommentPos.x * viewport.zoom + viewport.panX;
        const sy = draftCommentPos.y * viewport.zoom + viewport.panY;
        return (
          <CommentThreadCard
            isDraft
            screenX={sx} screenY={sy}
            canvasWidth={cw} canvasHeight={ch}
            onClose={() => setDraftCommentPos(null)}
            onCancelDraft={() => setDraftCommentPos(null)}
            onSubmitDraft={text => {
              createComment(draftCommentPos.x, draftCommentPos.y, text);
              setDraftCommentPos(null);
            }}
          />
        );
      })()}

      {/* ── Drawing command panel ── */}
      {drawCmd && (
        <DrawingCommandPanel
          cmd={drawCmd}
          liveValues={computeLiveValues(drawCmd, mouseWorld)}
          onArgChange={handleDrawCmdArgChange}
          onArgFocus={handleDrawCmdArgFocus}
          onTabNext={handleDrawCmdTabNext}
          onTabPrev={handleDrawCmdTabPrev}
          onDone={handleDrawCmdDone}
          onCancel={() => { setDrawCmd(null); setActiveTool('select'); }}
        />
      )}

      {/* Comment placement bar (above bottom toolbar) */}
      {activeTool === 'comment' && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
            height: 44,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '0 14px',
            zIndex: 55,
            minWidth: 300,
            pointerEvents: 'auto',
          }}
        >
          <MessageSquare size={15} color="#6b7280" strokeWidth={1.75} />
          <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>
            Click to insert comment
          </span>
          <button
            onClick={() => cancelAddingComment()}
            style={{
              height: 30, padding: '0 12px',
              background: '#f3f4f6', border: 'none', borderRadius: 6,
              fontSize: 12, fontWeight: 600, color: '#374151',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e5e7eb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3f4f6'; }}
          >
            Done
          </button>
        </div>
      )}

      {/* HUD: zoom % + world coordinates */}
      <CanvasOverlay zoom={viewport.zoom} worldX={mouseWorld.x} worldY={mouseWorld.y} />

      {/* ── Right-click context menu ── */}
      {ctxMenu && (() => {
        const rect = canvasRef.current?.getBoundingClientRect();
        const cw = rect?.width  ?? window.innerWidth;
        const ch = rect?.height ?? window.innerHeight;
        const menuW = 228, menuH = 320;
        const left = ctxMenu.x + menuW > cw ? ctxMenu.x - menuW : ctxMenu.x;
        const top  = ctxMenu.y + menuH > ch ? ctxMenu.y - menuH : ctxMenu.y;

        const hasSelection = !!(selectedObjectId || selectedObjectIds.length);
        const selId = selectedObjectId ?? selectedObjectIds[0] ?? null;

        type Row =
          | { k: 'sep' }
          | { k: 'item'; label: string; shortcut?: string; sub?: boolean; disabled?: boolean; action: () => void };
        const rows: Row[] = [
          { k: 'item', label: 'Copy',           shortcut: 'Ctrl C',       disabled: !hasSelection, action: () => { const o = selId ? objects.find(x => x.id === selId) : null; if (o) clipboardRef.current = o; setCtxMenu(null); } },
          { k: 'item', label: 'Cut',             shortcut: 'Ctrl X',       disabled: !hasSelection, action: () => { const o = selId ? objects.find(x => x.id === selId) : null; if (o) { clipboardRef.current = o; deleteSelectedObjects(); } setCtxMenu(null); } },
          { k: 'item', label: 'Paste',           shortcut: 'Ctrl V',       disabled: !clipboardRef.current, action: () => { const cb = clipboardRef.current; if (cb) addObject({ ...cb, id: `paste-${Date.now()}`, x: cb.x + 20, y: cb.y + 20 }); setCtxMenu(null); } },
          { k: 'item', label: 'Paste in place',  shortcut: 'Ctrl Shift V', disabled: !clipboardRef.current, action: () => { const cb = clipboardRef.current; if (cb) addObject({ ...cb, id: `paste-${Date.now()}` }); setCtxMenu(null); } },
          { k: 'item', label: 'Delete',          shortcut: 'Del',          disabled: !hasSelection, action: () => { deleteSelectedObjects(); setCtxMenu(null); } },
          { k: 'sep' },
          { k: 'item', label: 'Select similar',  sub: true,  action: () => setCtxMenu(null) },
          { k: 'item', label: 'Edit',            shortcut: 'Ctrl E', disabled: !hasSelection, action: () => { if (selId) enterTextEditMode(selId); setCtxMenu(null); } },
          { k: 'item', label: 'Convert',         sub: true,  action: () => setCtxMenu(null) },
          { k: 'item', label: 'Transform',       sub: true,  action: () => setCtxMenu(null) },
          { k: 'item', label: 'Group',           shortcut: 'G', disabled: !hasSelection, action: () => setCtxMenu(null) },
          { k: 'item', label: 'Block',           shortcut: 'B', disabled: !hasSelection, action: () => setCtxMenu(null) },
          { k: 'sep' },
          { k: 'item', label: 'Arrange',         sub: true,  action: () => setCtxMenu(null) },
          { k: 'item', label: 'Hide',            shortcut: 'Ctrl H', disabled: !hasSelection, action: () => { if (selId) updateObject(selId, { visible: false } as any); setCtxMenu(null); } },
          { k: 'item', label: 'Lock',            shortcut: 'Ctrl L', disabled: !hasSelection, action: () => { if (selId) updateObject(selId, { locked: true } as any); setCtxMenu(null); } },
          { k: 'sep' },
          { k: 'item', label: 'Open documentation', action: () => { window.open('https://docs.pragathirail.in', '_blank'); setCtxMenu(null); } },
        ];

        return (
          <div
            ref={ctxMenuRef}
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'absolute', left, top, width: menuW,
              background: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              boxShadow: '0 4px 24px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.07)',
              padding: '4px 0',
              zIndex: 400,
              overflow: 'hidden',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              fontSize: 13,
            }}
          >
            {rows.map((row, i) => {
              if (row.k === 'sep') {
                return <div key={i} style={{ height: 1, background: '#f3f4f6', margin: '3px 0' }} />;
              }
              const { label, shortcut, sub, disabled, action } = row;
              return (
                <button
                  key={i}
                  disabled={disabled}
                  onMouseDown={e => { e.stopPropagation(); if (!disabled) action(); }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    width: '100%', padding: '6px 14px',
                    background: 'transparent', border: 'none',
                    cursor: disabled ? 'default' : 'pointer',
                    textAlign: 'left', color: disabled ? '#c0c7d0' : '#111827',
                    fontFamily: 'inherit', fontSize: 13,
                    transition: 'background 0.08s',
                  }}
                  onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#f3f4f6'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ flex: 1 }}>{label}</span>
                  {shortcut && (
                    <span style={{ fontSize: 11.5, color: '#9ca3af', marginLeft: 12, whiteSpace: 'nowrap' }}>
                      {shortcut}
                    </span>
                  )}
                  {sub && (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 6, flexShrink: 0 }}>
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}
    </main>
  );
};

export default Canvas;
