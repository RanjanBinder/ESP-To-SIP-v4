import React, {
  createContext, useContext, useState, useCallback, useRef,
  useEffect, ReactNode,
} from 'react';
import { GridSettings, DEFAULT_GRID_SETTINGS } from '../lib/grid';
import type {
  TextObject, DraftTextObject, TextHyperlink,
  CanvasObject, CanvasObjectType, BaseCanvasObject, Vec2,
  RectangleObject, EllipseObject, ArcObject, LineObject, ShapeObject, StrokeStyle, SymbolObject,
} from '../types/scene';
import { isTextObject, isShape, isRectangle, isEllipse, isArc, isLine, isSymbol } from '../types/scene';
import {
  EspDocument, DOCUMENT_VERSION, migrateDocument,
  loadPersistedDocument, savePersistedDocument,
} from '../lib/serialize';

/* ═══════════════════════════════════════════════════════════════════
   Types
════════════════════════════════════════════════════════════════════ */

/* ── Viewport ────────────────────────────────────────────────────── */

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
}

const MIN_ZOOM = 0.005;
const MAX_ZOOM = 8;
const DEFAULT_VIEWPORT: ViewportState = { zoom: 1, panX: 0, panY: 0 };

/* ── Styles ──────────────────────────────────────────────────────── */

export type StyleCategory = 'shapes' | 'text' | 'annotations';

export interface EditorStyle {
  id: string;
  name: string;
  category: StyleCategory;
  meta: string;
  previewType: 'text' | 'line' | 'annotation';
  color?: string;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  fontSize?: number;
  fontWeight?: 'regular' | 'medium' | 'bold';
}

const DEFAULT_STYLES: EditorStyle[] = [
  /* Text */
  { id: 'esp-title',       name: 'ESP Title',        category: 'text', meta: '24 pt • Bold',    previewType: 'text', fontSize: 24, fontWeight: 'bold' },
  { id: 'chainage-label',  name: 'Chainage Label',   category: 'text', meta: '12 pt • Regular', previewType: 'text', fontSize: 12, fontWeight: 'regular' },
  { id: 'track-label',     name: 'Track Label',      category: 'text', meta: '14 pt • Medium',  previewType: 'text', fontSize: 14, fontWeight: 'medium' },
  { id: 'dimension-text',  name: 'Dimension Text',   category: 'text', meta: '10 pt • Regular', previewType: 'text', fontSize: 10, fontWeight: 'regular' },
  { id: 'note-text',       name: 'Note Text',        category: 'text', meta: '11 pt • Regular', previewType: 'text', fontSize: 11, fontWeight: 'regular' },
  { id: 'table-header',    name: 'Table Header',     category: 'text', meta: '12 pt • Bold',    previewType: 'text', fontSize: 12, fontWeight: 'bold' },
  { id: 'warning-text',    name: 'Warning Text',     category: 'text', meta: '12 pt • Red',     previewType: 'text', color: '#ef4444', fontSize: 12, fontWeight: 'regular' },
  { id: 'muted-reference', name: 'Muted Reference',  category: 'text', meta: '10 pt • Grey',    previewType: 'text', color: '#9ca3af', fontSize: 10, fontWeight: 'regular' },
  /* Shapes */
  { id: 'existing-line',    name: 'Existing Line',    category: 'shapes', meta: 'Black • Solid',  previewType: 'line', color: '#111827', strokeStyle: 'solid' },
  { id: 'proposed-work',    name: 'Proposed Work',    category: 'shapes', meta: 'Red • Solid',    previewType: 'line', color: '#ef4444', strokeStyle: 'solid' },
  { id: 'dismantling-work', name: 'Dismantling Work', category: 'shapes', meta: 'Amber • Dashed', previewType: 'line', color: '#f59e0b', strokeStyle: 'dashed' },
  { id: 'future-work',      name: 'Future Work',      category: 'shapes', meta: 'Blue • Solid',   previewType: 'line', color: '#3b82f6', strokeStyle: 'solid' },
  { id: 'land-boundary',    name: 'Land Boundary',    category: 'shapes', meta: 'Green • Solid',  previewType: 'line', color: '#22c55e', strokeStyle: 'solid' },
  { id: 'reference-line',   name: 'Reference Line',   category: 'shapes', meta: 'Grey • Dashed',  previewType: 'line', color: '#6b7280', strokeStyle: 'dashed' },
  /* Annotations */
  { id: 'dimension-arrow', name: 'Dimension Arrow', category: 'annotations', meta: 'Black • 1px',      previewType: 'annotation', color: '#111827' },
  { id: 'chainage-marker', name: 'Chainage Marker', category: 'annotations', meta: 'Magenta • Label',  previewType: 'annotation', color: '#db2777' },
  { id: 'km-marker-style', name: 'KM Marker',       category: 'annotations', meta: 'Black • Marker',  previewType: 'annotation', color: '#111827' },
  { id: 'issue-callout',   name: 'Issue Callout',   category: 'annotations', meta: 'Red • Callout',   previewType: 'annotation', color: '#ef4444' },
  { id: 'approval-note',   name: 'Approval Note',   category: 'annotations', meta: 'Blue • Note',     previewType: 'annotation', color: '#3b82f6' },
];

let styleCounter = 1;

/* ── Symbol ──────────────────────────────────────────────────────── */

export interface EspSymbol {
  id: string;
  name: string;
  dimensions: string;
  count: number;
}

const DEFAULT_SYMBOLS: EspSymbol[] = [
  { id: 'turnout-112',      name: 'Turnout 1:12',       dimensions: '60 m × 12 m',  count: 8 },
  { id: 'turnout-185',      name: 'Turnout 1:8.5',      dimensions: '50 m × 10 m',  count: 1 },
  { id: 'trap-point',       name: 'Trap Point',          dimensions: '15 m × 5 m',   count: 1 },
  { id: 'buffer-stop',      name: 'Buffer Stop',         dimensions: '3 m × 2 m',    count: 1 },
  { id: 'gradient-post',    name: 'Gradient Post',       dimensions: '1 m × 2 m',    count: 1 },
  { id: 'km-marker',        name: 'KM Marker',           dimensions: '1 m × 1 m',    count: 1 },
  { id: 'lc-gate',          name: 'LC Gate',             dimensions: '12 m × 4 m',   count: 1 },
  { id: 'fob-reference',    name: 'FOB Reference',       dimensions: '20 m × 6 m',   count: 1 },
  { id: 'adjacent-station', name: 'Adjacent Station',    dimensions: 'ref element',   count: 0 },
  { id: 'platform',         name: 'Platform',            dimensions: '120 m × 8 m',  count: 0 },
  { id: 'bridge',           name: 'Bridge',              dimensions: '40 m × 5 m',   count: 0 },
  { id: 'structure',        name: 'Structure',           dimensions: '15 m × 10 m',  count: 0 },
  { id: 'srj',              name: 'SRJ',                 dimensions: '0.5 m',         count: 0 },
  { id: 'fm',               name: 'FM – Fouling Mark',  dimensions: 'marker',        count: 0 },
  { id: 'railway-boundary', name: 'Railway Boundary',   dimensions: 'linear',        count: 0 },
];

let symbolCounter = 1;

/* ── Canvas-object domain types ──────────────────────────────────────
   The model lives in types/scene.ts (single source of truth). Re-exported
   here for backward compatibility with existing `from '../store/editorStore'`
   imports — prefer importing from '../types/scene' in new code. */

export type {
  TextObject, DraftTextObject, TextHyperlink,
  CanvasObject, CanvasObjectType, BaseCanvasObject, Vec2,
  RectangleObject, EllipseObject, ArcObject, LineObject, ShapeObject, StrokeStyle, SymbolObject,
};
export { isTextObject, isShape, isRectangle, isEllipse, isArc, isLine, isSymbol };

/* ── Comments ────────────────────────────────────────────────────── */

export interface CommentMessage {
  id: string;
  userId: string;
  userName: string;
  userInitials: string;
  userColor: string;
  text: string;
  createdAt: string;
}

export interface CommentThread {
  id: string;
  x: number;
  y: number;
  status: 'open' | 'resolved';
  createdBy: { id: string; name: string; initials: string; color: string };
  createdAt: string;
  messages: CommentMessage[];
}

function fontStyleFrom(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'Bold Italic';
  if (bold) return 'Bold';
  if (italic) return 'Italic';
  return 'Regular';
}

/** Draft → committed TextObject (used when creating a brand-new text). */
function convertToTextObject(draft: DraftTextObject): TextObject {
  return {
    id: draft.id,
    type: 'text',
    name: draft.value.substring(0, 20) || 'Unnamed',
    layerId: draft.layerId,
    locked: false,
    visible: true,
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    rotation: 0,
    scale: 100,
    anchor: 'Top left',
    value: draft.value,
    textColor: draft.color,
    fontSize: `${draft.fontSize}px`,
    fontFamily: draft.fontFamily,
    fontStyle: fontStyleFrom(draft.bold, draft.italic),
    bold: draft.bold,
    italic: draft.italic,
    underline: draft.underline,
    alignment: draft.alignment,
    baseline: draft.baseline,
    hyperlink: draft.hyperlink,
  };
}

/** TextObject → editable draft (used when double-clicking to re-edit). */
export function draftFromTextObject(obj: TextObject): DraftTextObject {
  return {
    id: obj.id,
    type: 'text',
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height,
    value: obj.value,
    fontSize: parseFloat(obj.fontSize) || 14,
    fontFamily: obj.fontFamily,
    bold: obj.bold,
    italic: obj.italic,
    underline: obj.underline,
    color: obj.textColor,
    alignment: obj.alignment,
    baseline: obj.baseline,
    layerId: obj.layerId,
    hyperlink: obj.hyperlink,
  };
}

/* ── Layer ───────────────────────────────────────────────────────── */

export interface LayerCustomProperty {
  id: string;
  name: string;
  value: string;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  opacity: number;           // 0–1
  parentId: string | null;
  order: number;             // sort index within the same parent
  collapsed?: boolean;
  customProperties?: LayerCustomProperty[];
}

export interface CanvasSettings {
  modelName: string;
  owner: string;
  canvasName: string;
  wireframe: boolean;
  gridVisible: boolean;
  axisVisible: boolean;
  viewsVisible: boolean;
  strokeScale: string;
  background: string;
  unit: string;
  scaleDisplayText: string;
  gridSettings: GridSettings;
}

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  modelName:        'AWB ESP Draft',
  owner:            'smruti',
  canvasName:       'Pothulapadu DWG',
  wireframe:        false,
  gridVisible:      true,
  axisVisible:      true,
  viewsVisible:     true,
  strokeScale:      '1:40',
  background:       '#FFFFFF',
  unit:             'Meters',
  scaleDisplayText: '41123 cm',
  gridSettings:     DEFAULT_GRID_SETTINGS,
};

/* ═══════════════════════════════════════════════════════════════════
   Default layer data
════════════════════════════════════════════════════════════════════ */

export const DEFAULT_LAYERS: Layer[] = [
  /* Root layers (order = index in root list) */
  { id: 'tracks',        name: 'Tracks',           color: '#3b82f6', visible: true, locked: false, opacity: 1, parentId: null,     order: 0  },
  { id: 'turnouts',      name: 'Turnouts',          color: '#f59e0b', visible: true, locked: false, opacity: 1, parentId: null,     order: 1  },
  { id: 'trap-points',   name: 'Trap Points',       color: '#ef4444', visible: true, locked: false, opacity: 1, parentId: null,     order: 2  },
  { id: 'gradients',     name: 'Gradients / RL',    color: '#10b981', visible: true, locked: false, opacity: 1, parentId: null,     order: 3  },
  { id: 'curves',        name: 'Curves & Geometry', color: '#8b5cf6', visible: true, locked: false, opacity: 1, parentId: null,     order: 4  },
  { id: 'platforms',     name: 'Platforms',         color: '#f97316', visible: true, locked: false, opacity: 1, parentId: null,     order: 5  },
  { id: 'structures',    name: 'Structures',        color: '#64748b', visible: true, locked: false, opacity: 1, parentId: null,     order: 6  },
  { id: 'land-boundary', name: 'Land Boundary',     color: '#84cc16', visible: true, locked: false, opacity: 1, parentId: null,     order: 7  },
  { id: 'dimensions',    name: 'Dimensions',        color: '#0ea5e9', visible: true, locked: false, opacity: 1, parentId: null,     order: 8  },
  { id: 'annotation',    name: 'Annotation',        color: '#6b7280', visible: true, locked: false, opacity: 1, parentId: null,     order: 9  },
  { id: 'dxf-underlay',  name: 'DXF Underlay',      color: '#a78bfa', visible: true, locked: false, opacity: 1, parentId: null,     order: 10 },
  { id: 'pdf-underlay',  name: 'PDF Underlay',      color: '#f43f5e', visible: true, locked: false, opacity: 1, parentId: null,     order: 11 },
  { id: 'proposed',      name: 'Proposed Works',    color: '#22c55e', visible: true, locked: false, opacity: 1, parentId: null,     order: 12 },
  { id: 'dismantling',   name: 'Dismantling Works', color: '#dc2626', visible: true, locked: false, opacity: 1, parentId: null,     order: 13 },
  /* Children of 'tracks' */
  { id: 'main-line',     name: 'Main Line',         color: '#2563eb', visible: true, locked: false, opacity: 1, parentId: 'tracks', order: 0  },
  { id: 'loop-lines',    name: 'Loop Lines',        color: '#60a5fa', visible: true, locked: false, opacity: 1, parentId: 'tracks', order: 1  },
  { id: 'sidings',       name: 'Sidings',           color: '#93c5fd', visible: true, locked: false, opacity: 1, parentId: 'tracks', order: 2  },
];

/* ═══════════════════════════════════════════════════════════════════
   Flat-array helpers  (layers is now a plain flat list with order + parentId)
════════════════════════════════════════════════════════════════════ */

export function findLayer(layers: Layer[], id: string): Layer | null {
  return layers.find(l => l.id === id) ?? null;
}

function mapLayer(layers: Layer[], id: string, fn: (l: Layer) => Layer): Layer[] {
  return layers.map(l => l.id === id ? fn(l) : l);
}

function mapAll(layers: Layer[], fn: (l: Layer) => Layer): Layer[] {
  return layers.map(fn);
}

function getDescendantIds(layers: Layer[], id: string): string[] {
  const children = layers.filter(l => l.parentId === id);
  return children.flatMap(c => [c.id, ...getDescendantIds(layers, c.id)]);
}

/** Re-assigns 0-based orders within each parent group. */
function normalizeOrder(layers: Layer[]): Layer[] {
  const byParent: Record<string, Layer[]> = {};
  for (const l of layers) {
    const k = l.parentId ?? '__root__';
    if (!byParent[k]) byParent[k] = [];
    byParent[k].push(l);
  }
  const result: Layer[] = [];
  Object.values(byParent).forEach(group => {
    group.sort((a: Layer, b: Layer) => a.order - b.order);
    group.forEach((l: Layer, i: number) => result.push({ ...l, order: i }));
  });
  return result;
}

/** Returns all layers in tree-traversal order (for dropdowns, search). */
export function flattenLayers(layers: Layer[]): Layer[] {
  return [...layers].sort((a, b) => a.order - b.order);
}

/** True if candidateId is a descendant of ancestorId in the flat list. */
export function isDescendantOf(layers: Layer[], ancestorId: string, candidateId: string): boolean {
  const byId = new Map(layers.map(l => [l.id, l]));
  let parentId = byId.get(candidateId)?.parentId ?? null;
  while (parentId) {
    if (parentId === ancestorId) return true;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   Store interface
════════════════════════════════════════════════════════════════════ */

export interface EditorStore {
  /* Viewport */
  viewport: ViewportState;
  setZoom: (zoom: number) => void;
  setPan: (panX: number, panY: number) => void;
  zoomAtPoint: (screenX: number, screenY: number, delta: number) => void;
  panBy: (dx: number, dy: number) => void;
  screenToWorld: (screenX: number, screenY: number) => { x: number; y: number };
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };

  /* Layers */
  layers: Layer[];
  activeLayerId: string;
  selectedLayerId: string | null;
  canvasSettings: CanvasSettings;

  /* Panels */
  activeLeftPanel: 'layers' | 'symbols' | 'styles' | 'comments' | 'tables' | null;
  layersPanelOpen: boolean;           // derived: activeLeftPanel === 'layers'
  setActiveLeftPanel: (panel: 'layers' | 'symbols' | 'styles' | 'comments' | 'tables' | null) => void;
  setLayersPanelOpen: (open: boolean) => void; // kept for compat

  /* Symbols */
  symbols: EspSymbol[];
  selectedSymbolId: string | null;
  searchSymbolsQuery: string;
  selectSymbol: (id: string | null) => void;
  addSymbol: () => void;
  deleteSymbol: (id: string) => void;
  setSearchSymbolsQuery: (q: string) => void;

  /* Styles */
  styles: EditorStyle[];
  selectedStyleId: string | null;
  styleSearchQuery: string;
  collapsedStyleCategories: StyleCategory[];
  selectStyle: (id: string | null) => void;
  setStyleSearchQuery: (q: string) => void;
  toggleStyleCategory: (cat: StyleCategory) => void;
  addStyle: (category?: StyleCategory) => void;
  deleteStyle: (id: string) => void;

  /* Layer actions */
  getLayer: (id: string) => Layer | null;
  toggleLayerVisibility: (id: string) => void;
  toggleLayerLock: (id: string) => void;
  setActiveLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  addLayer: () => void;
  deleteLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Omit<Layer, 'id'>>) => void;
  toggleLayerCollapse: (id: string) => void;
  expandLayer: (id: string) => void;
  lockAll: () => void;
  showAll: () => void;
  updateCanvasSettings: (updates: Partial<CanvasSettings>) => void;
  clearSelection: () => void;
  updateLayerParent: (id: string, parentId: string | null) => void;
  reorderLayer: (params: { draggedId: string; targetId: string; position: 'before' | 'after' | 'inside' }) => void;
  addLayerCustomProperty: (layerId: string, property: { name: string; value: string }) => void;
  updateLayerCustomProperty: (layerId: string, propertyId: string, updates: { name?: string; value?: string }) => void;
  deleteLayerCustomProperty: (layerId: string, propertyId: string) => void;

  /* ── Scene objects (the canvas document) ────────────────────────────
     `objects` is the canonical, generalized list of everything on the
     canvas (a CanvasObject discriminated union — text today, shapes/
     symbols/dimensions next). Selection is a single id into this list. */
  objects: CanvasObject[];
  selectedObjectId: string | null;
  /** All currently selected object ids (single-select keeps exactly one entry). */
  selectedObjectIds: string[];
  selectedObject: CanvasObject | null;
  hoveredObjectId: string | null;
  editingObjectId: string | null;
  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, updates: Partial<CanvasObject>) => void;
  updateObjectTransient: (id: string, updates: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  deleteSelectedObject: () => void;
  /** Delete all objects currently in `selectedObjectIds` as one undoable step. */
  deleteSelectedObjects: () => void;
  selectObject: (id: string | null) => void;
  /** Replace the full multi-selection; sets `selectedObjectId` to the sole id if only one. */
  selectObjects: (ids: string[]) => void;
  setHoveredObject: (id: string | null) => void;

  /* Undo / redo (snapshot history of the scene) */
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /* Document load / export (save/open) */
  getDocument: () => EspDocument;
  loadDocument: (doc: EspDocument) => void;
  /** Batch-load objects + optional new layers as a single undoable step. */
  importObjects: (objects: CanvasObject[], newLayers: Layer[]) => void;

  /* Text-specific conveniences, built on the scene API above. */
  selectedTextObject: TextObject | null;
  updateTextObject: (updates: Partial<TextObject>) => void;
  setTextHyperlink: (id: string, url: string) => void;
  removeTextHyperlink: (id: string) => void;
  enterTextEditMode: (id: string) => void;

  /* Active tool + draft text editing */
  activeTool: string;
  setActiveTool: (id: string) => void;
  draftTextObject: DraftTextObject | null;
  setDraftTextObject: (obj: DraftTextObject | null) => void;
  updateDraftTextObject: (updates: Partial<DraftTextObject>) => void;
  commitDraftText: () => void;
  cancelDraftText: () => void;

  /* Comments */
  comments: CommentThread[];
  selectedCommentId: string | null;
  commentFilter: 'open' | 'resolved' | 'all';
  startAddingComment: () => void;
  cancelAddingComment: () => void;
  createComment: (x: number, y: number, text: string) => CommentThread;
  selectComment: (id: string | null) => void;
  addCommentReply: (commentId: string, text: string) => void;
  resolveComment: (commentId: string) => void;
  reopenComment: (commentId: string) => void;
  deleteComment: (commentId: string) => void;
  setCommentFilter: (filter: 'open' | 'resolved' | 'all') => void;
}

/* ═══════════════════════════════════════════════════════════════════
   Context + Provider
════════════════════════════════════════════════════════════════════ */

const PANEL_W = 300;
const EditorContext = createContext<EditorStore | null>(null);

let layerCounter = 1;

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [viewport, setViewport] = useState<ViewportState>(DEFAULT_VIEWPORT);

  const setZoom = useCallback((zoom: number) => {
    setViewport(prev => ({ ...prev, zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) }));
  }, []);

  const setPan = useCallback((panX: number, panY: number) => {
    setViewport(prev => ({ ...prev, panX, panY }));
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    setViewport(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }));
  }, []);

  const zoomAtPoint = useCallback((screenX: number, screenY: number, delta: number) => {
    setViewport(prev => {
      let d = delta;
      const factor = Math.pow(0.999, d);
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev.zoom * factor));
      const worldX = (screenX - prev.panX) / prev.zoom;
      const worldY = (screenY - prev.panY) / prev.zoom;
      return {
        zoom: newZoom,
        panX: screenX - worldX * newZoom,
        panY: screenY - worldY * newZoom,
      };
    });
  }, []);

  const screenToWorld = useCallback((screenX: number, screenY: number) => ({
    x: (screenX - viewport.panX) / viewport.zoom,
    y: (screenY - viewport.panY) / viewport.zoom,
  }), [viewport]);

  const worldToScreen = useCallback((worldX: number, worldY: number) => ({
    x: worldX * viewport.zoom + viewport.panX,
    y: worldY * viewport.zoom + viewport.panY,
  }), [viewport]);

  /* Restore the autosaved document once (null if none / corrupt). */
  const [persisted] = useState<EspDocument | null>(() => loadPersistedDocument());

  const [layers,                    setLayers]                    = useState<Layer[]>(persisted?.layers ?? DEFAULT_LAYERS);
  const [activeLayerId,             setActiveLayerId]              = useState<string>(persisted?.activeLayerId ?? 'tracks');
  const [selectedLayerId,           setSelectedLayerId]            = useState<string | null>(null);
  const [activeTool,           setActiveTool]                      = useState<string>('select');
  const [draftTextObject,      setDraftTextObject]                 = useState<DraftTextObject | null>(null);
  /* ── Scene state ── */
  const [objects,              setObjects]                         = useState<CanvasObject[]>(persisted?.objects ?? []);
  const [selectedObjectId,     setSelectedObjectId]                = useState<string | null>(null);
  const [selectedObjectIds,    setSelectedObjectIds]               = useState<string[]>([]);
  const [editingObjectId,      setEditingObjectId]                 = useState<string | null>(null);
  const [hoveredObjectId,      setHoveredObjectId]                 = useState<string | null>(null);

  /* ── Undo/redo history (snapshot-based; see ARCHITECTURE.md §6) ── */
  const [past,   setPast]   = useState<CanvasObject[][]>([]);
  const [future, setFuture] = useState<CanvasObject[][]>([]);
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  /** Object id whose consecutive edits coalesce into one undo step. */
  const coalesceRef = useRef<string | null>(null);

  /* Derived selection — single source of truth is (objects, selectedObjectId). */
  const selectedObject = objects.find(o => o.id === selectedObjectId) ?? null;
  const selectedTextObject =
    selectedObject && selectedObject.type === 'text' ? selectedObject : null;
  const [activeLeftPanel,           setActiveLeftPanelRaw]         = useState<'layers' | 'symbols' | 'styles' | 'comments' | 'tables' | null>('layers');
  const [canvasSettings,            setCanvasSettings]             = useState<CanvasSettings>(persisted?.canvasSettings ?? DEFAULT_CANVAS_SETTINGS);
  const [symbols,                   setSymbols]                   = useState<EspSymbol[]>(DEFAULT_SYMBOLS);
  const [selectedSymbolId,          setSelectedSymbolId]           = useState<string | null>(null);
  const [searchSymbolsQuery,        setSearchSymbolsQuery]         = useState('');
  const [styles,                    setStyles]                     = useState<EditorStyle[]>(DEFAULT_STYLES);
  const [selectedStyleId,           setSelectedStyleId]            = useState<string | null>(null);
  const [styleSearchQuery,          setStyleSearchQueryState]      = useState('');
  const [collapsedStyleCategories,  setCollapsedStyleCategories]   = useState<StyleCategory[]>(['shapes', 'annotations']);
  const [comments,                  setComments]                   = useState<CommentThread[]>([]);
  const [selectedCommentId,         setSelectedCommentId]          = useState<string | null>(null);
  const [commentFilter,             setCommentFilterState]         = useState<'open' | 'resolved' | 'all'>('open');

  // Always-current refs for stable callbacks and beforeunload flush.
  const layersRef = useRef(layers);
  layersRef.current = layers;
  const canvasSettingsRef = useRef(canvasSettings);
  canvasSettingsRef.current = canvasSettings;
  const activeLayerIdRef = useRef(activeLayerId);
  activeLayerIdRef.current = activeLayerId;

  /* Sync CSS variable — any open left panel offsets the canvas */
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--left-panel-w',
      activeLeftPanel !== null ? `${PANEL_W}px` : '0px',
    );
  }, [activeLeftPanel]);

  /* Initialise CSS var on mount */
  useEffect(() => {
    document.documentElement.style.setProperty('--left-panel-w', `${PANEL_W}px`);
  }, []);

  const setActiveLeftPanel = useCallback((panel: 'layers' | 'symbols' | 'styles' | 'comments' | 'tables' | null) => {
    setActiveLeftPanelRaw(panel);
  }, []);

  /* Kept for backward compat — toggles the layers sub-panel */
  const setLayersPanelOpen = useCallback((open: boolean) => {
    setActiveLeftPanelRaw(open ? 'layers' : null);
  }, []);

  const toggleLayerVisibility = useCallback((id: string) => {
    setLayers(prev => mapLayer(prev, id, l => ({ ...l, visible: !l.visible })));
  }, []);

  const toggleLayerLock = useCallback((id: string) => {
    setLayers(prev => mapLayer(prev, id, l => ({ ...l, locked: !l.locked })));
  }, []);

  const setActiveLayer = useCallback((id: string) => {
    setActiveLayerId(id);
    setSelectedLayerId(id);
  }, []);

  const selectLayer = useCallback((id: string | null) => {
    setSelectedLayerId(id);
  }, []);

  const addLayer = useCallback(() => {
    const newId = `layer-${Date.now()}`;
    setLayers(prev => {
      const rootCount = prev.filter(l => !l.parentId).length;
      const newLayer: Layer = {
        id: newId,
        name: `New Layer ${layerCounter++}`,
        color: '#94a3b8',
        visible: true, locked: false, opacity: 1,
        parentId: null, order: rootCount,
      };
      return [newLayer, ...prev];
    });
    setActiveLayerId(newId);
    setSelectedLayerId(newId);
  }, []);

  const deleteLayer = useCallback((id: string) => {
    setLayers(prev => {
      const toDelete = new Set([id, ...getDescendantIds(prev, id)]);
      return prev.filter(l => !toDelete.has(l.id));
    });
    setSelectedLayerId(prev => (prev === id ? null : prev));
    setActiveLayerId(prev => (prev === id ? 'tracks' : prev));
  }, []);

  const updateLayer = useCallback((id: string, updates: Partial<Omit<Layer, 'id'>>) => {
    setLayers(prev => mapLayer(prev, id, l => ({ ...l, ...updates })));
  }, []);

  const toggleLayerCollapse = useCallback((id: string) => {
    setLayers(prev => mapLayer(prev, id, l => ({ ...l, collapsed: !(l.collapsed ?? false) })));
  }, []);

  const expandLayer = useCallback((id: string) => {
    setLayers(prev => mapLayer(prev, id, l => ({ ...l, collapsed: false })));
  }, []);

  const lockAll = useCallback(() => {
    setLayers(prev => mapAll(prev, l => ({ ...l, locked: true })));
  }, []);

  const showAll = useCallback(() => {
    setLayers(prev => mapAll(prev, l => ({ ...l, visible: true })));
  }, []);

  const getLayer = useCallback((id: string) => findLayer(layers, id), [layers]);

  const updateCanvasSettings = useCallback((updates: Partial<CanvasSettings>) => {
    setCanvasSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLayerId(null);
  }, []);

  const updateLayerParent = useCallback((id: string, newParentId: string | null) => {
    setLayers(prev => {
      if (newParentId !== null && (newParentId === id || isDescendantOf(prev, id, newParentId))) {
        return prev;
      }
      const layer = prev.find(l => l.id === id);
      if (!layer) return prev;
      const siblings = prev.filter(l => l.parentId === newParentId && l.id !== id);
      const newOrder = siblings.length;
      return normalizeOrder(prev.map(l => l.id === id ? { ...l, parentId: newParentId, order: newOrder } : l));
    });
  }, []);

  const reorderLayer = useCallback((params: {
    draggedId: string;
    targetId: string;
    position: 'before' | 'after' | 'inside';
  }) => {
    const { draggedId, targetId, position } = params;
    setLayers(prev => {
      const dragged = prev.find(l => l.id === draggedId);
      const target  = prev.find(l => l.id === targetId);
      if (!dragged || !target || draggedId === targetId) return prev;
      if (isDescendantOf(prev, draggedId, targetId)) return prev;

      if (position === 'inside') {
        if (target.locked) return prev;
        // Depth guard: max depth index = 2 (3 levels: 0, 1, 2)
        const byId = new Map(prev.map(l => [l.id, l]));
        let depth = 0;
        let parentId = target.parentId ?? null;
        while (parentId) { depth++; parentId = byId.get(parentId)?.parentId ?? null; }
        if (depth >= 2) return prev;
      }

      const newParentId: string | null =
        position === 'inside' ? targetId : (target.parentId ?? null);

      // Remove dragged from flat list
      const without = prev.filter(l => l.id !== draggedId);

      // Expand target if nesting inside it
      const expanded = position === 'inside'
        ? without.map(l => l.id === targetId ? { ...l, collapsed: false } : l)
        : without;

      // Ordered siblings of new parent (dragged already removed)
      const siblings = expanded
        .filter(l => l.parentId === newParentId)
        .sort((a, b) => a.order - b.order);

      let insertAt: number;
      if (position === 'inside') {
        insertAt = siblings.length;
      } else {
        const idx = siblings.findIndex(l => l.id === targetId);
        insertAt = position === 'before' ? Math.max(idx, 0) : idx + 1;
      }

      // Build new siblings with dragged inserted
      const newSiblings = [
        ...siblings.slice(0, insertAt),
        { ...dragged, parentId: newParentId },
        ...siblings.slice(insertAt),
      ].map((s, i) => ({ ...s, order: i }));

      // Non-sibling layers + new sibling group
      const nonSiblings = expanded.filter(l => l.parentId !== newParentId);
      return [...nonSiblings, ...newSiblings];
    });
  }, []);

  const addLayerCustomProperty = useCallback((layerId: string, property: { name: string; value: string }) => {
    setLayers(prev => mapLayer(prev, layerId, l => ({
      ...l,
      customProperties: [
        ...(l.customProperties ?? []),
        { id: `prop-${Date.now()}`, ...property },
      ],
    })));
  }, []);

  const updateLayerCustomProperty = useCallback((
    layerId: string, propertyId: string, updates: { name?: string; value?: string },
  ) => {
    setLayers(prev => mapLayer(prev, layerId, l => ({
      ...l,
      customProperties: (l.customProperties ?? []).map(p =>
        p.id === propertyId ? { ...p, ...updates } : p,
      ),
    })));
  }, []);

  const deleteLayerCustomProperty = useCallback((layerId: string, propertyId: string) => {
    setLayers(prev => mapLayer(prev, layerId, l => ({
      ...l,
      customProperties: (l.customProperties ?? []).filter(p => p.id !== propertyId),
    })));
  }, []);

  /* ── Generalized scene API ──────────────────────────────────────────
     Single source of truth = (objects, selectedObjectId). Selection-derived
     views recompute on render. All setState updaters are pure + top-level
     (StrictMode-safe — see ARCHITECTURE.md §4). */

  /* History primitives — snapshot the objects array at edit boundaries. */
  const HISTORY_LIMIT = 100;
  const pushHistory = useCallback(() => {
    setPast(p => {
      const next = [...p, objectsRef.current];
      return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
    });
    setFuture([]);
  }, []);

  /** Snapshot once before a compound interaction (e.g. a drag-move). */
  const beginHistory = useCallback(() => {
    pushHistory();
    coalesceRef.current = null;
  }, [pushHistory]);

  const addObject = useCallback((obj: CanvasObject) => {
    pushHistory();
    coalesceRef.current = null;
    setObjects(list => [...list, obj]);
    setSelectedObjectId(obj.id); // newly created objects become selected
  }, [pushHistory]);

  /** History-tracked edit; consecutive edits to the same id coalesce into one
      undo step (so e.g. typing a name is a single undo, not one-per-keystroke). */
  const updateObject = useCallback((id: string, updates: Partial<CanvasObject>) => {
    if (coalesceRef.current !== id) { pushHistory(); coalesceRef.current = id; }
    setObjects(list => list.map(o => (o.id === id ? { ...o, ...updates } as CanvasObject : o)));
  }, [pushHistory]);

  /** Transient edit with NO history — used during a drag after beginHistory(). */
  const updateObjectTransient = useCallback((id: string, updates: Partial<CanvasObject>) => {
    setObjects(list => list.map(o => (o.id === id ? { ...o, ...updates } as CanvasObject : o)));
  }, []);

  const deleteObject = useCallback((id: string) => {
    pushHistory();
    coalesceRef.current = null;
    setObjects(list => list.filter(o => o.id !== id));
    setSelectedObjectId(prev => (prev === id ? null : prev));
    setSelectedObjectIds(prev => prev.filter(oid => oid !== id));
    setHoveredObjectId(prev => (prev === id ? null : prev));
    setEditingObjectId(prev => (prev === id ? null : prev));
  }, [pushHistory]);

  const deleteSelectedObject = useCallback(() => {
    if (selectedObjectId) deleteObject(selectedObjectId);
  }, [selectedObjectId, deleteObject]);

  const selectObjects = useCallback((ids: string[]) => {
    coalesceRef.current = null;
    setSelectedObjectIds(ids);
    setSelectedObjectId(ids.length === 1 ? ids[0] : null);
  }, []);

  const deleteSelectedObjects = useCallback(() => {
    if (selectedObjectIds.length === 0) return;
    pushHistory();
    coalesceRef.current = null;
    const toDelete = new Set(selectedObjectIds);
    setObjects(list => list.filter(o => !toDelete.has(o.id)));
    setSelectedObjectIds([]);
    setSelectedObjectId(null);
    setHoveredObjectId(null);
  }, [selectedObjectIds, pushHistory]);

  const selectObject = useCallback((id: string | null) => {
    coalesceRef.current = null;
    if (!id) { setSelectedObjectId(null); setSelectedObjectIds([]); return; }
    const obj = objectsRef.current.find(o => o.id === id);
    if (obj && !obj.locked) { setSelectedObjectId(id); setSelectedObjectIds([id]); }
  }, []);

  const setHoveredObject = useCallback((id: string | null) => {
    setHoveredObjectId(id);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture(f => [objectsRef.current, ...f]);
    setObjects(prev);
    coalesceRef.current = null;
  }, [past]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast(p => [...p, objectsRef.current]);
    setObjects(next);
    coalesceRef.current = null;
  }, [future]);

  /* ── Document load / export ─────────────────────────────────────── */

  const getDocument = useCallback((): EspDocument => ({
    version: DOCUMENT_VERSION,
    layers, objects, canvasSettings, activeLayerId,
  }), [layers, objects, canvasSettings, activeLayerId]);

  const loadDocument = useCallback((doc: EspDocument) => {
    const d = migrateDocument(doc);
    setLayers(d.layers);
    setObjects(d.objects);
    setCanvasSettings(d.canvasSettings ?? DEFAULT_CANVAS_SETTINGS);
    setActiveLayerId(d.activeLayerId || 'tracks');
    // Reset transient/selection/history for the freshly-loaded scene.
    setSelectedObjectId(null);
    setSelectedObjectIds([]);
    setSelectedLayerId(null);
    setEditingObjectId(null);
    setDraftTextObject(null);
    setPast([]);
    setFuture([]);
    coalesceRef.current = null;
    // Flush immediately — the debounce timer may not fire before a fast refresh.
    savePersistedDocument(d);
  }, []);

  const importObjects = useCallback((newObjs: CanvasObject[], newLayers: Layer[]) => {
    if (newObjs.length === 0 && newLayers.length === 0) return;
    pushHistory();
    coalesceRef.current = null;

    // Compute next state synchronously using always-current refs so we can
    // flush an immediate save — the debounce timer may not fire before a refresh.
    const currentLayers = layersRef.current;
    const currentObjects = objectsRef.current;
    const existing = new Set(currentLayers.map(l => l.name.toLowerCase()));
    const filteredNewLayers = newLayers.filter(l => !existing.has(l.name.toLowerCase()));
    const nextObjects = [...currentObjects, ...newObjs];
    const nextLayers = filteredNewLayers.length > 0
      ? [...currentLayers, ...filteredNewLayers]
      : currentLayers;

    setObjects(nextObjects);
    if (filteredNewLayers.length > 0) setLayers(nextLayers);

    savePersistedDocument({
      version: DOCUMENT_VERSION,
      layers: nextLayers,
      objects: nextObjects,
      canvasSettings: canvasSettingsRef.current,
      activeLayerId: activeLayerIdRef.current,
    });
  }, [pushHistory]);

  /* ── Text-specific conveniences (built on the scene API) ── */

  /** Patch the currently selected object (text panel binds to this). */
  const updateTextObject = useCallback((updates: Partial<TextObject>) => {
    if (selectedObjectId) updateObject(selectedObjectId, updates);
  }, [selectedObjectId, updateObject]);

  const updateDraftTextObject = useCallback((updates: Partial<DraftTextObject>) => {
    setDraftTextObject(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const commitDraftText = useCallback(() => {
    const current = draftTextObject;
    if (!current) { setActiveTool('select'); setEditingObjectId(null); return; }
    const trimmed = current.value.trim();
    const editingId = editingObjectId;

    if (editingId) {
      // ── Re-editing an existing object ──
      if (!trimmed) {
        pushHistory(); coalesceRef.current = null;
        setObjects(list => list.filter(o => o.id !== editingId));
        setSelectedObjectId(null);
      } else {
        const existing = objects.find(o => o.id === editingId);
        if (existing && existing.type === 'text') {
          const merged: TextObject = {
            ...existing,
            value: trimmed,
            name: trimmed.substring(0, 20) || existing.name,
            textColor: current.color,
            fontSize: `${current.fontSize}px`,
            fontFamily: current.fontFamily,
            fontStyle: fontStyleFrom(current.bold, current.italic),
            bold: current.bold,
            italic: current.italic,
            underline: current.underline,
            alignment: current.alignment,
            baseline: current.baseline,
            hyperlink: current.hyperlink,
          };
          pushHistory(); coalesceRef.current = null;
          setObjects(list => list.map(o => (o.id === editingId ? merged : o)));
          setSelectedObjectId(editingId);
        }
      }
    } else if (trimmed) {
      // ── Brand-new object ──
      const placed = convertToTextObject({ ...current, value: trimmed });
      pushHistory(); coalesceRef.current = null;
      setObjects(list => [...list, placed]);
      setSelectedObjectId(placed.id);
    }

    setDraftTextObject(null);
    setEditingObjectId(null);
    setActiveTool('select');
  }, [draftTextObject, editingObjectId, objects, pushHistory]);

  const cancelDraftText = useCallback(() => {
    setDraftTextObject(null);
    setEditingObjectId(null);
    setActiveTool('select');
  }, []);

  const enterTextEditMode = useCallback((id: string) => {
    const obj = objects.find(o => o.id === id);
    if (obj && obj.type === 'text' && !obj.locked) {
      setDraftTextObject(draftFromTextObject(obj));
      setEditingObjectId(id);
      setActiveTool('text');
    }
  }, [objects]);

  const setTextHyperlink = useCallback((id: string, url: string) => {
    const link: TextHyperlink = { url, target: '_blank' };
    pushHistory(); coalesceRef.current = null;
    setObjects(list => list.map(o => (o.id === id && o.type === 'text' ? { ...o, hyperlink: link } : o)));
    setDraftTextObject(prev => (prev && prev.id === id ? { ...prev, hyperlink: link } : prev));
  }, [pushHistory]);

  const removeTextHyperlink = useCallback((id: string) => {
    pushHistory(); coalesceRef.current = null;
    setObjects(list => list.map(o => (o.id === id && o.type === 'text' ? { ...o, hyperlink: undefined } : o)));
    setDraftTextObject(prev => (prev && prev.id === id ? { ...prev, hyperlink: undefined } : prev));
  }, [pushHistory]);

  /* Style actions */
  const selectStyle = useCallback((id: string | null) => {
    setSelectedStyleId(id);
  }, []);

  const handleSetStyleSearchQuery = useCallback((q: string) => {
    setStyleSearchQueryState(q);
  }, []);

  const toggleStyleCategory = useCallback((cat: StyleCategory) => {
    setCollapsedStyleCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );
  }, []);

  const addStyle = useCallback((category: StyleCategory = 'text') => {
    const s: EditorStyle = {
      id: `style-${Date.now()}`,
      name: `New Style ${styleCounter++}`,
      category,
      meta: '12 pt • Regular',
      previewType: category === 'shapes' ? 'line' : category === 'annotations' ? 'annotation' : 'text',
      color: '#374151',
    };
    setStyles(prev => [s, ...prev]);
    setSelectedStyleId(s.id);
  }, []);

  const deleteStyle = useCallback((id: string) => {
    setStyles(prev => prev.filter(s => s.id !== id));
    setSelectedStyleId(prev => (prev === id ? null : prev));
  }, []);

  /* Symbol actions */
  const selectSymbol = useCallback((id: string | null) => {
    setSelectedSymbolId(id);
  }, []);

  const addSymbol = useCallback(() => {
    const sym: EspSymbol = {
      id: `symbol-${Date.now()}`,
      name: `New Symbol ${symbolCounter++}`,
      dimensions: '– m × – m',
      count: 0,
    };
    setSymbols(prev => [sym, ...prev]);
    setSelectedSymbolId(sym.id);
  }, []);

  const deleteSymbol = useCallback((id: string) => {
    setSymbols(prev => prev.filter(s => s.id !== id));
    setSelectedSymbolId(prev => (prev === id ? null : prev));
  }, []);

  const handleSetSearchSymbolsQuery = useCallback((q: string) => {
    setSearchSymbolsQuery(q);
  }, []);

  /* ── Comment actions ─────────────────────────────────────────────── */

  const CURRENT_USER = { id: 'user-1', name: 'smruti', initials: 'S', color: '#db2777' };

  const startAddingComment = useCallback(() => {
    setActiveTool('comment');
  }, []);

  const cancelAddingComment = useCallback(() => {
    setActiveTool('select');
  }, []);

  const createComment = useCallback((x: number, y: number, text: string): CommentThread => {
    const now = new Date().toISOString();
    const msg: CommentMessage = {
      id: `msg-${Date.now()}`,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userInitials: CURRENT_USER.initials,
      userColor: CURRENT_USER.color,
      text,
      createdAt: now,
    };
    const thread: CommentThread = {
      id: `comment-${Date.now()}`,
      x, y,
      status: 'open',
      createdBy: CURRENT_USER,
      createdAt: now,
      messages: [msg],
    };
    setComments(prev => [...prev, thread]);
    setSelectedCommentId(thread.id);
    return thread;
  }, []);

  const selectComment = useCallback((id: string | null) => {
    setSelectedCommentId(id);
  }, []);

  const addCommentReply = useCallback((commentId: string, text: string) => {
    const now = new Date().toISOString();
    const msg: CommentMessage = {
      id: `msg-${Date.now()}`,
      userId: CURRENT_USER.id,
      userName: CURRENT_USER.name,
      userInitials: CURRENT_USER.initials,
      userColor: CURRENT_USER.color,
      text,
      createdAt: now,
    };
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, messages: [...c.messages, msg] } : c,
    ));
  }, []);

  const resolveComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, status: 'resolved' } : c,
    ));
  }, []);

  const reopenComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, status: 'open' } : c,
    ));
  }, []);

  const deleteComment = useCallback((commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    setSelectedCommentId(prev => prev === commentId ? null : prev);
  }, []);

  const setCommentFilter = useCallback((filter: 'open' | 'resolved' | 'all') => {
    setCommentFilterState(filter);
  }, []);

  /* ── Debounced autosave to localStorage ─────────────────────────── */

  // Always-current snapshot ref — lets the beforeunload handler flush without
  // needing to capture any render-time closures.
  const latestDocRef = useRef<EspDocument>({ version: DOCUMENT_VERSION, layers, objects, canvasSettings, activeLayerId });
  latestDocRef.current = { version: DOCUMENT_VERSION, layers, objects, canvasSettings, activeLayerId };

  useEffect(() => {
    const doc: EspDocument = { version: DOCUMENT_VERSION, layers, objects, canvasSettings, activeLayerId };
    const t = setTimeout(() => savePersistedDocument(doc), 500);
    return () => clearTimeout(t);
  }, [layers, objects, canvasSettings, activeLayerId]);

  // Synchronous flush — saves the latest state right before the page unloads
  // so a fast refresh (within the 500ms debounce window) never loses data.
  useEffect(() => {
    const flush = () => savePersistedDocument(latestDocRef.current);
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, []);

  const store: EditorStore = {
    /* viewport */
    viewport, setZoom, setPan, panBy, zoomAtPoint, screenToWorld, worldToScreen,
    /* layers */
    layers, activeLayerId, selectedLayerId,
    canvasSettings,
    /* panels */
    activeLeftPanel,
    layersPanelOpen: activeLeftPanel === 'layers',
    setActiveLeftPanel,
    setLayersPanelOpen,
    /* symbols */
    symbols, selectedSymbolId, searchSymbolsQuery,
    selectSymbol, addSymbol, deleteSymbol,
    setSearchSymbolsQuery: handleSetSearchSymbolsQuery,
    /* styles */
    styles, selectedStyleId, styleSearchQuery, collapsedStyleCategories,
    selectStyle, setStyleSearchQuery: handleSetStyleSearchQuery,
    toggleStyleCategory, addStyle, deleteStyle,
    /* layer actions */
    getLayer,
    toggleLayerVisibility, toggleLayerLock,
    setActiveLayer, selectLayer,
    addLayer, deleteLayer, updateLayer,
    toggleLayerCollapse, expandLayer,
    lockAll, showAll,
    updateCanvasSettings,
    clearSelection,
    updateLayerParent, reorderLayer,
    addLayerCustomProperty, updateLayerCustomProperty, deleteLayerCustomProperty,
    /* scene objects */
    objects, selectedObjectId, selectedObjectIds, selectedObject, hoveredObjectId, editingObjectId,
    addObject, updateObject, updateObjectTransient, deleteObject, deleteSelectedObject, deleteSelectedObjects,
    selectObject, selectObjects, setHoveredObject,
    /* history */
    beginHistory, undo, redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    /* document */
    getDocument, loadDocument, importObjects,
    /* text conveniences */
    selectedTextObject, updateTextObject,
    setTextHyperlink, removeTextHyperlink, enterTextEditMode,
    /* tool + draft */
    activeTool, setActiveTool,
    draftTextObject, setDraftTextObject, updateDraftTextObject, commitDraftText, cancelDraftText,
    /* comments */
    comments, selectedCommentId, commentFilter,
    startAddingComment, cancelAddingComment, createComment, selectComment,
    addCommentReply, resolveComment, reopenComment, deleteComment, setCommentFilter,
  };

  return <EditorContext.Provider value={store}>{children}</EditorContext.Provider>;
};

export const useEditor = (): EditorStore => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be inside EditorProvider');
  return ctx;
};
