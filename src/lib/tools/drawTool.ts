import { Tool } from '../../types/tool';
import { CanvasObject, Vec2 } from '../../types/scene';

/**
 * drawTool — factory for the click-drag shape tools (rectangle, ellipse, line).
 * The object is created on the first drag move (a click with no drag creates
 * nothing) and resized transiently until pointer-up, so the whole draw is a
 * single undo step. After drawing, the tool switches back to select.
 */

type ShapeKind = 'rectangle' | 'ellipse' | 'line';

let shapeCounter = 1;
const DEFAULT_STROKE = '#1f2937';
const DEFAULT_FILL = 'none';

const titleCase = (k: ShapeKind) => k.charAt(0).toUpperCase() + k.slice(1);

function createShape(kind: ShapeKind, id: string, sx: number, sy: number, w: Vec2, layerId: string): CanvasObject {
  const name = `${titleCase(kind)} ${shapeCounter++}`;
  const common = {
    id, name, layerId, locked: false, visible: true,
    rotation: 0, scale: 100,
    stroke: DEFAULT_STROKE, strokeWidth: 2, strokeStyle: 'solid' as const,
  };

  if (kind === 'line') {
    const dx = w.x - sx, dy = w.y - sy;
    return { ...common, type: 'line', x: sx, y: sy, width: Math.abs(dx), height: Math.abs(dy), dx, dy };
  }

  const x = Math.min(sx, w.x), y = Math.min(sy, w.y);
  const width = Math.abs(w.x - sx), height = Math.abs(w.y - sy);
  if (kind === 'rectangle') {
    return { ...common, type: 'rectangle', x, y, width, height, fill: DEFAULT_FILL, cornerRadius: 0 };
  }
  return { ...common, type: 'ellipse', x, y, width, height, fill: DEFAULT_FILL };
}

function geometryFrom(kind: ShapeKind, sx: number, sy: number, w: Vec2): Partial<CanvasObject> {
  if (kind === 'line') {
    const dx = w.x - sx, dy = w.y - sy;
    return { x: sx, y: sy, dx, dy, width: Math.abs(dx), height: Math.abs(dy) };
  }
  return {
    x: Math.min(sx, w.x), y: Math.min(sy, w.y),
    width: Math.abs(w.x - sx), height: Math.abs(w.y - sy),
  };
}

export function makeDrawTool(kind: ShapeKind, id: string): Tool {
  return {
    id,
    cursor: 'crosshair',
    onPointerDown(ctx) {
      const sx = ctx.pointer.world.x;
      const sy = ctx.pointer.world.y;
      const objId = `${kind}-${Date.now()}-${shapeCounter}`;
      let created = false;
      return {
        onMove(w) {
          if (!created) {
            // First real movement → create the object (one history entry).
            ctx.addObject(createShape(kind, objId, sx, sy, w, ctx.activeLayerId));
            created = true;
          } else {
            ctx.updateObjectTransient(objId, geometryFrom(kind, sx, sy, w));
          }
        },
        onUp() {
          ctx.setActiveTool('select');
        },
      };
    },
  };
}
