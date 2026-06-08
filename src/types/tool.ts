/**
 * tool.ts — the pluggable tool contract (ARCHITECTURE.md §5).
 *
 * A Tool encapsulates one interaction mode (select, text, line, …). The canvas
 * owns navigation (pan/zoom) and pointer plumbing; it hit-tests the scene, builds
 * a ToolContext, and dispatches to the active tool. Adding a tool = implement this
 * interface + register it in lib/tools/registry.ts — no canvas edits.
 */
import { CanvasObject, Vec2 } from './scene';

/** Pointer state at the moment of an event, in world coordinates. */
export interface ToolPointer {
  world: Vec2;
  /** Topmost object under the pointer, or null for empty canvas. */
  hitObjectId: string | null;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Everything a tool may do, assembled fresh by the canvas for each event from
 * the store. Scene mutations and selection go through here so tools never reach
 * into the store directly.
 */
/** World-space rubber-band rectangle for marquee selection. */
export interface RubberBand { x1: number; y1: number; x2: number; y2: number; }

export interface ToolContext {
  pointer: ToolPointer;
  objects: CanvasObject[];
  selectedObjectId: string | null;
  selectedObjectIds: readonly string[];
  getObject: (id: string) => CanvasObject | undefined;

  addObject: (obj: CanvasObject) => void;
  updateObject: (id: string, patch: Partial<CanvasObject>) => void;
  /** Edit without recording history — pair with beginHistory() for drags. */
  updateObjectTransient: (id: string, patch: Partial<CanvasObject>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string | null) => void;
  selectObjects: (ids: string[]) => void;
  /** Show or clear the marquee rubber-band rectangle (world coords). */
  setRubberBand: (band: RubberBand | null) => void;
  selectLayer: (id: string | null) => void;
  /** Snapshot history once before a compound interaction (e.g. a drag). */
  beginHistory: () => void;

  /** Begin a floating text draft at a world point (text tool). */
  startTextDraft: (world: Vec2) => void;
  /** Open the editor on an existing text object (double-click). */
  enterTextEditMode: (id: string) => void;

  /** Library symbol armed for placement (resolved by the canvas), or null. */
  pendingSymbol: { id: string; name: string } | null;

  activeLayerId: string;
  setActiveTool: (id: string) => void;
}

/**
 * Returned by `onPointerDown` when a press starts a drag. The canvas drives it
 * with fresh world coords until pointer-up. onMove receives only the world point
 * because the session already closed over whatever scene actions it needs.
 */
export interface DragSession {
  onMove: (world: Vec2) => void;
  onUp?: (world: Vec2) => void;
}

/** Arc data for hover preview rendering. */
export interface ArcPreview {
  cx: number; cy: number; r: number;
  startAngle: number; endAngle: number;
}

export interface Tool {
  id: string;
  /** CSS cursor for the canvas while this tool is active. */
  cursor: string;
  /** Returns a DragSession to begin a drag, or void for a simple click. */
  onPointerDown?: (ctx: ToolContext) => DragSession | void;
  onDoubleClick?: (ctx: ToolContext) => void;
  /** Called when Escape is pressed while this tool is active (e.g. cancel polyline). */
  onCancel?(): void;
  /** Return a rubber-band line preview (anchor → cursor). Null = no preview. */
  getHoverPreview?(world: Vec2): { from: Vec2; to: Vec2 } | null;
  /** Return a rubber-band arc preview. Null = no preview. */
  getHoverArcPreview?(world: Vec2): ArcPreview | null;
}
