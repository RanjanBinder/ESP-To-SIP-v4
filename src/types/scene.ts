/**
 * scene.ts — Domain model for the engineering-diagram editor's canvas scene.
 *
 * This is the single source of truth for everything that can live on the canvas.
 * Tools, the store, renderers, the properties panels and (future) serialization
 * all speak this vocabulary. When a new tool is added (line, rectangle, symbol,
 * dimension…), add its object interface here and to the `CanvasObject` union —
 * nothing else needs to invent its own shape.
 *
 * Coordinate convention: all geometry is in WORLD units (see lib/grid.ts,
 * PIXELS_PER_INCH). Screen conversion happens only at the viewport boundary.
 */

/* ── Geometry primitives ─────────────────────────────────────────── */

export interface Vec2 {
  x: number;
  y: number;
}

/* ── SOD annotation ──────────────────────────────────────────────────
   Engineering measurements a parsed ESP asset carries so the Schedule-of-
   Dimensions validator (lib/validation/sodValidator.ts) can grade it. Optional:
   only assets extracted from an ESP drawing carry it — hand-drawn shapes don't.
   All measurements are in millimetres unless noted. */
export interface SodAssetMeta {
  /** High-level asset class the SOD rules dispatch on. */
  assetKind: 'Track' | 'Platform' | 'Structure' | 'Gradient';
  /** lineType / platformType / structureType from the source drawing. */
  subtype?: string;
  /** Source asset id from the parser (e.g. 'TRK-03'), for traceability. */
  sourceAssetId?: string;
  /** Source drawing that supplied the measurement anchor. */
  sourceDrawingRef?: string;
  /** Source type for non-editable validation anchors. */
  sourceKind?: 'pdf' | 'dwg' | 'dxf';
  /** 1-based page number when the source is a PDF. */
  sourcePage?: number;
  /** Centre-to-centre distance to the nearest adjacent track (mm). */
  spacingToAdjacentTrack?: number;
  /** Clearance from the running-track centre line to this asset (mm). */
  clearanceFromTrackCentre?: number;
  /** Height above rail level (mm). */
  heightAboveRailLevel?: number;
  /** Gradient denominator — 400 means 1:400. */
  gradientDenominator?: number;
}

/* ── Object kinds ────────────────────────────────────────────────── */

/**
 * Every kind of object the canvas can hold. `text` is implemented today; the
 * rest are the planned roadmap and are declared here so the model, type guards
 * and serialization are ready before the tools land.
 */
export type CanvasObjectType =
  | 'text'
  | 'image'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'ellipse'
  | 'arc'
  | 'symbol'
  | 'dimension'
  | 'group';

/* ── Shared base ─────────────────────────────────────────────────── */

/** Fields every placed canvas object shares. */
export interface BaseCanvasObject {
  id: string;
  type: CanvasObjectType;
  name: string;
  layerId: string;
  locked: boolean;
  visible: boolean;
  /** Top-left anchor in world coordinates. */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees
  scale: number;    // percent (100 = 1×)
  /** Grouping parent (a 'group' object id), or null/undefined for top level. */
  parentId?: string | null;
  /** Override foundation for symbol/block instances. */
  sourceId?: string | null;
  isOverride?: boolean;
  /** SOD engineering measurements, present on assets parsed from an ESP. */
  sod?: SodAssetMeta;
}

/* ── Text ────────────────────────────────────────────────────────── */

export interface TextHyperlink {
  url: string;
  target?: '_self' | '_blank';
}

export interface TextObject extends BaseCanvasObject {
  type: 'text';
  anchor: string;
  /** Rendered text content. */
  value: string;
  textColor: string;
  fontSize: string;
  fontFamily: string;
  fontStyle: string;
  /** Formatting booleans kept for faithful rendering + round-trip editing. */
  bold: boolean;
  italic: boolean;
  underline: boolean;
  alignment: 'left' | 'center' | 'right';
  baseline: 'top' | 'middle' | 'bottom';
  hyperlink?: TextHyperlink;
  /* Override foundation (text-specific extras). */
  sourceTextId?: string | null;
  overrideValue?: string | null;
}

/**
 * In-progress text being typed in the floating editor. A draft is committed
 * into a TextObject (see store.convertToTextObject) or discarded.
 */
export interface DraftTextObject {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  alignment: 'left' | 'center' | 'right';
  baseline: 'top' | 'middle' | 'bottom';
  layerId: string;
  hyperlink?: TextHyperlink;
}

/* ── Image / PDF underlay ────────────────────────────────────────── */

export interface ImageObject extends BaseCanvasObject {
  type: 'image';
  src: string;
  alt: string;
  sourceFileName?: string;
  opacity?: number;
}

/* ── Shapes ──────────────────────────────────────────────────────── */

export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

/** Rectangle / ellipse: x,y = top-left, width/height = size (bbox model). */
export interface RectangleObject extends BaseCanvasObject {
  type: 'rectangle';
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  cornerRadius: number;
}

export interface EllipseObject extends BaseCanvasObject {
  type: 'ellipse';
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
}

/** Arc: drawn CCW from startAngle to endAngle (standard math convention).
 *  Angles in degrees; 0 = +X axis, 90 = up on screen (screen Y-down, so -sin).
 *  center = (x + width/2, y + height/2); radius = width/2 (width always == height). */
export interface ArcObject extends BaseCanvasObject {
  type: 'arc';
  startAngle: number; // degrees CCW from +X
  endAngle: number;   // degrees CCW from +X
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
}

/** Line: start = (x, y); end = (x + dx, y + dy). width/height mirror |dx|,|dy|
 *  so the generic bbox/move logic keeps working. */
export interface LineObject extends BaseCanvasObject {
  type: 'line';
  dx: number;
  dy: number;
  stroke: string;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
}

export type ShapeObject = RectangleObject | EllipseObject | LineObject | ArcObject;

/* ── Symbol instance ─────────────────────────────────────────────── */

/** A placed instance of a library symbol (see store EspSymbol). `symbolId`
 *  references the library definition; `label` is the display name. The override
 *  foundation (sourceId/isOverride/BaseCanvasObject) is reserved for future
 *  per-instance overrides. */
export interface SymbolObject extends BaseCanvasObject {
  type: 'symbol';
  symbolId: string;
  label: string;
}

/* ── The union ───────────────────────────────────────────────────── */

/**
 * Discriminated union of everything on the canvas. Extend it as tools land.
 * Consumers switch on `obj.type` and rely on the guards below.
 */
export type CanvasObject = TextObject | ImageObject | RectangleObject | EllipseObject | ArcObject | LineObject | SymbolObject;

/* ── Type guards ─────────────────────────────────────────────────── */

export function isTextObject(obj: CanvasObject): obj is TextObject {
  return obj.type === 'text';
}

export function isImageObject(obj: CanvasObject): obj is ImageObject {
  return obj.type === 'image';
}

export function isRectangle(obj: CanvasObject): obj is RectangleObject {
  return obj.type === 'rectangle';
}

export function isEllipse(obj: CanvasObject): obj is EllipseObject {
  return obj.type === 'ellipse';
}

export function isLine(obj: CanvasObject): obj is LineObject {
  return obj.type === 'line';
}

export function isArc(obj: CanvasObject): obj is ArcObject {
  return obj.type === 'arc';
}

export function isShape(obj: CanvasObject): obj is ShapeObject {
  return obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'line' || obj.type === 'arc';
}

export function isSymbol(obj: CanvasObject): obj is SymbolObject {
  return obj.type === 'symbol';
}
