import type { CanvasObject, Vec2, LineObject, ArcObject } from '../types/scene';

const toRad = (d: number) => d * Math.PI / 180;

/** Returns candidate snap points for an object (endpoints, midpoints, centers). */
export function getSnapPoints(obj: CanvasObject): Vec2[] {
  switch (obj.type) {
    case 'line': {
      const { x, y, dx, dy } = obj as LineObject;
      return [
        { x, y },
        { x: x + dx, y: y + dy },
        { x: x + dx / 2, y: y + dy / 2 },
      ];
    }
    case 'arc': {
      const arc = obj as ArcObject;
      const r = arc.width / 2;
      const cx = arc.x + r, cy = arc.y + r;
      return [
        { x: cx, y: cy },
        { x: cx + r * Math.cos(toRad(arc.startAngle)), y: cy - r * Math.sin(toRad(arc.startAngle)) },
        { x: cx + r * Math.cos(toRad(arc.endAngle)),   y: cy - r * Math.sin(toRad(arc.endAngle)) },
      ];
    }
    case 'ellipse': {
      const cx = obj.x + obj.width / 2, cy = obj.y + obj.height / 2;
      const rx = obj.width / 2, ry = obj.height / 2;
      return [
        { x: cx, y: cy },
        { x: cx + rx, y: cy },
        { x: cx - rx, y: cy },
        { x: cx, y: cy - ry },
        { x: cx, y: cy + ry },
      ];
    }
    case 'rectangle': {
      const { x, y, width, height } = obj;
      return [
        { x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height },
        { x: x + width / 2, y }, { x: x + width / 2, y: y + height },
        { x, y: y + height / 2 }, { x: x + width, y: y + height / 2 },
      ];
    }
    case 'text':
      return [{ x: obj.x, y: obj.y }];
    default:
      return [];
  }
}

/** Find the nearest snap point within `snapRadius` world units, or null. */
export function findSnapPoint(world: Vec2, objects: CanvasObject[], snapRadius: number): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = snapRadius;
  for (const obj of objects) {
    if (!obj.visible) continue;
    for (const pt of getSnapPoints(obj)) {
      const d = Math.hypot(pt.x - world.x, pt.y - world.y);
      if (d < bestDist) { bestDist = d; best = pt; }
    }
  }
  return best;
}
