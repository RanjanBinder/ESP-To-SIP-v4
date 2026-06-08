import { Tool, ToolContext } from '../../types/tool';
import { LineObject, Vec2 } from '../../types/scene';

/**
 * Polyline tool — click to place vertices, double-click or Escape to finish.
 *
 * Each click-pair (vertex N → vertex N+1) commits one LineObject to the store.
 * A rubber-band dashed line from the last vertex to the cursor is returned via
 * getHoverPreview() and rendered by Canvas as a pure CSS overlay (no store touch).
 *
 * UX:
 *   • First click  → records first vertex, shows preview from it to cursor.
 *   • Each click   → commits segment, records new vertex, continues preview.
 *   • Double-click → ends the polyline (the first click of the dbl-click already
 *                    placed the final vertex; the second click has dist≈0 so it's
 *                    ignored; then onDoubleClick fires and resets).
 *   • Escape       → cancel: clears vertices (onCancel called by Canvas).
 */

let vertices: Vec2[] = [];
let segCounter = 1;

function makeId() {
  return `polyline-${Date.now()}-${segCounter++}`;
}

function makeSeg(from: Vec2, to: Vec2, layerId: string): LineObject {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return {
    id: makeId(),
    type: 'line',
    name: `Track ${segCounter}`,
    layerId,
    x: from.x, y: from.y,
    dx, dy,
    width: Math.abs(dx), height: Math.abs(dy),
    locked: false, visible: true, rotation: 0, scale: 100,
    stroke: '#1f2937', strokeWidth: 2, strokeStyle: 'solid',
  };
}

export const polylineTool: Tool = {
  id: 'polyline',
  cursor: 'crosshair',

  onPointerDown(ctx: ToolContext) {
    const pt: Vec2 = { x: ctx.pointer.world.x, y: ctx.pointer.world.y };

    if (vertices.length === 0) {
      // First vertex — just record it; no segment yet.
      vertices = [pt];
      return;
    }

    // Subsequent vertex — commit a segment if the distance is non-trivial.
    const last = vertices[vertices.length - 1];
    const dx = pt.x - last.x;
    const dy = pt.y - last.y;
    if (dx * dx + dy * dy < 4) {
      // Essentially zero-length (second click of a dbl-click lands here) — ignore.
      return;
    }

    ctx.addObject(makeSeg(last, pt, ctx.activeLayerId));
    vertices.push(pt);
  },

  onDoubleClick(ctx: ToolContext) {
    vertices = [];
    ctx.setActiveTool('select');
  },

  onCancel() {
    vertices = [];
  },

  getHoverPreview(world: Vec2) {
    if (vertices.length === 0) return null;
    return { from: vertices[vertices.length - 1], to: world };
  },
};
