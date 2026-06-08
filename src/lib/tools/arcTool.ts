/**
 * arcTool.ts — 3-click arc drawing tool.
 *
 * Click 1: start point (on arc)
 * Click 2: mid point  (on arc, between start and end)
 * Click 3: end point  (on arc) → arc is created through all three points
 *
 * Hover preview:
 *   Phase 1 (start set):       rubber-band line start → cursor
 *   Phase 2 (start + mid set): rubber-band arc preview through cursor as end point
 */
import { Tool, ArcPreview } from '../../types/tool';
import type { ArcObject, Vec2 } from '../../types/scene';

type Phase = null | { p1: Vec2 } | { p1: Vec2; p2: Vec2 };
let state: Phase = null;
let counter = 1;

/* ── Geometry ─────────────────────────────────────────────────── */

function circumscribedCircle(
  a: Vec2, b: Vec2, c: Vec2,
): { cx: number; cy: number; r: number } | null {
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(D) < 1e-10) return null; // collinear
  const ux = (
    (a.x * a.x + a.y * a.y) * (b.y - c.y) +
    (b.x * b.x + b.y * b.y) * (c.y - a.y) +
    (c.x * c.x + c.y * c.y) * (a.y - b.y)
  ) / D;
  const uy = (
    (a.x * a.x + a.y * a.y) * (c.x - b.x) +
    (b.x * b.x + b.y * b.y) * (a.x - c.x) +
    (c.x * c.x + c.y * c.y) * (b.x - a.x)
  ) / D;
  return { cx: ux, cy: uy, r: Math.hypot(a.x - ux, a.y - uy) };
}

function getAngle(center: Vec2, pt: Vec2): number {
  // Angle in degrees [0,360), CCW from +X in canvas coords (Y-down → negate dy)
  const deg = Math.atan2(-(pt.y - center.y), pt.x - center.x) * 180 / Math.PI;
  return (deg + 360) % 360;
}

function midOnCcw(alpha: number, mu: number, beta: number): boolean {
  // Does going CCW from alpha through mu reach beta first (before wrapping full circle)?
  const sweepToEnd = ((beta - alpha) + 360) % 360;
  const sweepToMid = ((mu  - alpha) + 360) % 360;
  return sweepToMid > 0 && sweepToMid < sweepToEnd;
}

function arcAngles(
  center: Vec2, p1: Vec2, p2: Vec2, p3: Vec2,
): { startAngle: number; endAngle: number } {
  const alpha = getAngle(center, p1);
  const mu    = getAngle(center, p2);
  const beta  = getAngle(center, p3);
  return midOnCcw(alpha, mu, beta)
    ? { startAngle: alpha, endAngle: beta }
    : { startAngle: beta,  endAngle: alpha }; // stored CCW from p3→p1 = visually CW p1→p3
}

/* ── Tool ─────────────────────────────────────────────────────── */

export const arcTool: Tool = {
  id: 'arc',
  cursor: 'crosshair',

  onPointerDown(ctx) {
    const pt = { x: ctx.pointer.world.x, y: ctx.pointer.world.y };

    if (!state) {
      state = { p1: pt };
      return;
    }

    if (!('p2' in state)) {
      // Ignore if too close to p1 (accidental double-click)
      if (Math.hypot(pt.x - state.p1.x, pt.y - state.p1.y) < 2) return;
      state = { p1: state.p1, p2: pt };
      return;
    }

    // Phase 2 → 3: p3 = current click
    const { p1, p2 } = state;
    state = null;

    if (Math.hypot(pt.x - p1.x, pt.y - p1.y) < 2) return; // degenerate

    const circle = circumscribedCircle(p1, p2, pt);
    if (!circle) return; // collinear

    const center: Vec2 = { x: circle.cx, y: circle.cy };
    const { startAngle, endAngle } = arcAngles(center, p1, p2, pt);
    const r = circle.r;

    const arc: ArcObject = {
      id: `arc-${Date.now()}-${counter++}`,
      type: 'arc',
      name: `Arc ${counter}`,
      layerId: ctx.activeLayerId,
      locked: false, visible: true, rotation: 0, scale: 100, parentId: null,
      x: circle.cx - r, y: circle.cy - r,
      width: r * 2, height: r * 2,
      startAngle, endAngle,
      stroke: '#1f2937', strokeWidth: 2, strokeStyle: 'solid',
    };
    ctx.addObject(arc);
    ctx.selectObject(arc.id);
    ctx.setActiveTool('select');
  },

  onCancel() { state = null; },

  getHoverPreview(world) {
    if (state && !('p2' in state)) {
      return { from: state.p1, to: world };
    }
    return null;
  },

  getHoverArcPreview(world): ArcPreview | null {
    if (!state || !('p2' in state)) return null;
    const { p1, p2 } = state;
    if (Math.hypot(world.x - p1.x, world.y - p1.y) < 2) return null;
    const circle = circumscribedCircle(p1, p2, world);
    if (!circle) return null;
    const center: Vec2 = { x: circle.cx, y: circle.cy };
    const { startAngle, endAngle } = arcAngles(center, p1, p2, world);
    return { cx: circle.cx, cy: circle.cy, r: circle.r, startAngle, endAngle };
  },
};
