/**
 * selectTool — click to select/deselect, drag to move, rubber-band to multi-select.
 *
 * Interactions:
 *   Click object          → select it, start drag-to-move
 *   Shift+click object    → add/remove from multi-selection (no move)
 *   Click empty canvas    → deselect all
 *   Drag empty canvas     → rubber-band marquee select (any object whose bbox overlaps)
 *   Double-click object   → enter text-edit mode (for text objects)
 */
import { Tool } from '../../types/tool';
import type { CanvasObject, LineObject } from '../../types/scene';

/* ── Intersection helpers ──────────────────────────────────────── */

function bboxOverlap(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  return ax1 <= bx2 && ax2 >= bx1 && ay1 <= by2 && ay2 >= by1;
}

function objectIntersects(obj: CanvasObject, x1: number, y1: number, x2: number, y2: number): boolean {
  if (obj.type === 'line') {
    const lo = obj as LineObject;
    const ox1 = Math.min(lo.x, lo.x + lo.dx), ox2 = Math.max(lo.x, lo.x + lo.dx);
    const oy1 = Math.min(lo.y, lo.y + lo.dy), oy2 = Math.max(lo.y, lo.y + lo.dy);
    return bboxOverlap(ox1, oy1, ox2, oy2, x1, y1, x2, y2);
  }
  return bboxOverlap(obj.x, obj.y, obj.x + obj.width, obj.y + obj.height, x1, y1, x2, y2);
}

/* ── Tool ─────────────────────────────────────────────────────── */

export const selectTool: Tool = {
  id: 'select',
  cursor: 'default',

  onPointerDown(ctx) {
    const { hitObjectId, world, shiftKey } = ctx.pointer;

    /* ── Empty canvas: clear selection + start rubber-band ── */
    if (!hitObjectId) {
      if (!shiftKey) ctx.selectObject(null);
      const sx = world.x, sy = world.y;
      return {
        onMove(w) {
          ctx.setRubberBand({ x1: sx, y1: sy, x2: w.x, y2: w.y });
        },
        onUp(w) {
          ctx.setRubberBand(null);
          const minX = Math.min(sx, w.x), maxX = Math.max(sx, w.x);
          const minY = Math.min(sy, w.y), maxY = Math.max(sy, w.y);
          // Ignore tiny drags (they're just click-with-drift)
          if (maxX - minX < 3 && maxY - minY < 3) return;
          const ids = ctx.objects
            .filter(o => o.visible && !o.locked && objectIntersects(o, minX, minY, maxX, maxY))
            .map(o => o.id);
          if (ids.length > 0) ctx.selectObjects(ids);
        },
      };
    }

    /* ── Shift+click: toggle object in multi-selection ── */
    if (shiftKey) {
      const current = ctx.selectedObjectIds;
      const next = current.includes(hitObjectId)
        ? current.filter(id => id !== hitObjectId)
        : [...current, hitObjectId];
      ctx.selectObjects(next as string[]);
      return; // no drag-to-move for shift-click
    }

    /* ── Regular click: single-select + drag-to-move ── */
    ctx.selectObject(hitObjectId);
    const obj = ctx.getObject(hitObjectId);
    if (!obj || obj.locked) return;

    const ox = obj.x, oy = obj.y;
    const startX = world.x, startY = world.y;
    let moved = false;
    return {
      onMove(w) {
        if (!moved) { ctx.beginHistory(); moved = true; }
        ctx.updateObjectTransient(hitObjectId, {
          x: ox + (w.x - startX),
          y: oy + (w.y - startY),
        });
      },
    };
  },

  onDoubleClick(ctx) {
    if (ctx.pointer.hitObjectId) ctx.enterTextEditMode(ctx.pointer.hitObjectId);
  },
};
