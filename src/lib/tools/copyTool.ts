import { Tool } from '../../types/tool';
import { CanvasObject } from '../../types/scene';

/**
 * Copy tool — click an object and drag to place a copy of it.
 * The original stays in place; the duplicate is deposited at pointer-up.
 * After placement the tool switches back to select with the copy selected.
 */
let copyCounter = 1;

export const copyTool: Tool = {
  id: 'copy',
  cursor: 'copy',

  onPointerDown(ctx) {
    const { hitObjectId, world } = ctx.pointer;
    if (!hitObjectId) return;

    const original = ctx.getObject(hitObjectId);
    if (!original || original.locked) return;

    const sx = world.x, sy = world.y;
    const ox = original.x, oy = original.y;
    const copyId = `copy-${Date.now()}-${copyCounter++}`;
    let created = false;

    return {
      onMove(w) {
        const dx = w.x - sx, dy = w.y - sy;
        if (!created) {
          ctx.addObject({
            ...original,
            id: copyId,
            name: `${original.name} copy`,
            x: ox + dx,
            y: oy + dy,
          } as CanvasObject);
          created = true;
        } else {
          ctx.updateObjectTransient(copyId, { x: ox + (w.x - sx), y: oy + (w.y - sy) });
        }
      },
      onUp() {
        if (created) ctx.selectObject(copyId);
        ctx.setActiveTool('select');
      },
    };
  },
};
