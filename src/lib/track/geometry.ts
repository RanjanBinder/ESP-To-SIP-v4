/**
 * geometry.ts — pure geometry for track alignments (lines + circular arcs).
 *
 * No React, no store, no side-effects (ARCHITECTURE.md §1). Everything here
 * works in world units and the project's angle convention:
 *   point(a) = (cx + r·cos a, cy − r·sin a)   — degrees, CCW from +X
 * The `−sin` compensates for the screen's Y-down axis, matching ArcObject in
 * types/scene.ts, so an angle that looks like "up" on screen really is +90°.
 */

import type { Vec2 } from '../../types/scene';
import type { TrackSegment, TrackArcSegment } from '../../types/track';

/* ── Scalar helpers ──────────────────────────────────────────────── */

export const EPS = 1e-6;

export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Wrap to [0, 360). */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Wrap to (−180, 180]. */
export function signedDeg(deg: number): number {
  const d = normalizeDeg(deg);
  return d > 180 ? d - 360 : d;
}

/* ── Vector helpers ──────────────────────────────────────────────── */

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
/** 2-D cross product (z of the 3-D cross). */
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(b.x - a.x, b.y - a.y);

export function normalize(a: Vec2): Vec2 {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

/** Bearing of a direction vector, in degrees CCW from +X (Y-down aware). */
export function bearingOf(v: Vec2): number {
  return normalizeDeg(toDeg(Math.atan2(-v.y, v.x)));
}

/** Unit direction vector for a bearing in degrees. */
export function directionOf(bearingDeg: number): Vec2 {
  const r = toRad(bearingDeg);
  return { x: Math.cos(r), y: -Math.sin(r) };
}

/** Unit normal 90° to the left of travel, as seen on screen. */
export function leftNormal(dir: Vec2): Vec2 {
  const d = normalize(dir);
  return { x: d.y, y: -d.x };
}

/* ── Arc primitives ──────────────────────────────────────────────── */

export function arcPointAt(arc: TrackArcSegment, angleDeg: number): Vec2 {
  const r = toRad(angleDeg);
  return {
    x: arc.center.x + arc.radius * Math.cos(r),
    y: arc.center.y - arc.radius * Math.sin(r),
  };
}

/** Signed sweep in degrees: positive when travelling CCW, negative when CW. */
export function arcSweep(arc: TrackArcSegment): number {
  const raw = normalizeDeg(arc.endAngle - arc.startAngle);
  if (arc.ccw) return raw < EPS ? 360 : raw;
  const cw = normalizeDeg(arc.startAngle - arc.endAngle);
  return -(cw < EPS ? 360 : cw);
}

/** Angle on the arc at fraction `t` (0…1) of the sweep. */
export function arcAngleAt(arc: TrackArcSegment, t: number): number {
  return arc.startAngle + arcSweep(arc) * t;
}

/** Unit travel direction at a given angle on the arc. */
export function arcTangentAt(arc: TrackArcSegment, angleDeg: number): Vec2 {
  const r = toRad(angleDeg);
  // d/da (cos a, −sin a) = (−sin a, −cos a) — the CCW travel direction.
  const ccwTangent = { x: -Math.sin(r), y: -Math.cos(r) };
  return arc.ccw ? ccwTangent : scale(ccwTangent, -1);
}

/* ── Segment queries ─────────────────────────────────────────────── */

export function segStart(seg: TrackSegment): Vec2 {
  return seg.kind === 'line' ? seg.start : arcPointAt(seg, seg.startAngle);
}

export function segEnd(seg: TrackSegment): Vec2 {
  return seg.kind === 'line' ? seg.end : arcPointAt(seg, seg.endAngle);
}

export function segLength(seg: TrackSegment): number {
  if (seg.kind === 'line') return dist(seg.start, seg.end);
  return Math.abs(toRad(arcSweep(seg))) * seg.radius;
}

/** Unit travel direction leaving the segment's start point. */
export function segStartTangent(seg: TrackSegment): Vec2 {
  return seg.kind === 'line'
    ? normalize(sub(seg.end, seg.start))
    : arcTangentAt(seg, seg.startAngle);
}

/** Unit travel direction arriving at the segment's end point. */
export function segEndTangent(seg: TrackSegment): Vec2 {
  return seg.kind === 'line'
    ? normalize(sub(seg.end, seg.start))
    : arcTangentAt(seg, seg.endAngle);
}

/** Point at arc-length `d` measured from the segment start. */
export function segPointAtDistance(seg: TrackSegment, d: number): Vec2 {
  const total = segLength(seg);
  const t = total < EPS ? 0 : Math.max(0, Math.min(1, d / total));
  if (seg.kind === 'line') {
    return { x: seg.start.x + (seg.end.x - seg.start.x) * t, y: seg.start.y + (seg.end.y - seg.start.y) * t };
  }
  return arcPointAt(seg, arcAngleAt(seg, t));
}

/** Travel direction at arc-length `d` from the segment start. */
export function segTangentAtDistance(seg: TrackSegment, d: number): Vec2 {
  if (seg.kind === 'line') return segStartTangent(seg);
  const total = segLength(seg);
  const t = total < EPS ? 0 : Math.max(0, Math.min(1, d / total));
  return arcTangentAt(seg, arcAngleAt(seg, t));
}

/* ── Polyline (multi-segment) queries ────────────────────────────── */

export function totalLength(segs: readonly TrackSegment[]): number {
  return segs.reduce((sum, s) => sum + segLength(s), 0);
}

export function pathStart(segs: readonly TrackSegment[]): Vec2 | null {
  return segs.length ? segStart(segs[0]) : null;
}

export function pathEnd(segs: readonly TrackSegment[]): Vec2 | null {
  return segs.length ? segEnd(segs[segs.length - 1]) : null;
}

/** Travel direction arriving at the end of the chain, or null when empty. */
export function pathEndTangent(segs: readonly TrackSegment[]): Vec2 | null {
  return segs.length ? segEndTangent(segs[segs.length - 1]) : null;
}

export function pointAtDistance(segs: readonly TrackSegment[], d: number): Vec2 | null {
  if (!segs.length) return null;
  let remaining = Math.max(0, d);
  for (const seg of segs) {
    const l = segLength(seg);
    if (remaining <= l) return segPointAtDistance(seg, remaining);
    remaining -= l;
  }
  return segEnd(segs[segs.length - 1]);
}

/* ── Transform ───────────────────────────────────────────────────── */

export function translateSegment(seg: TrackSegment, dx: number, dy: number): TrackSegment {
  if (seg.kind === 'line') {
    return {
      kind: 'line',
      start: { x: seg.start.x + dx, y: seg.start.y + dy },
      end: { x: seg.end.x + dx, y: seg.end.y + dy },
    };
  }
  return { ...seg, center: { x: seg.center.x + dx, y: seg.center.y + dy } };
}

export function translateSegments(segs: readonly TrackSegment[], dx: number, dy: number): TrackSegment[] {
  if (dx === 0 && dy === 0) return segs.slice();
  return segs.map(s => translateSegment(s, dx, dy));
}

/* ── Sampling ────────────────────────────────────────────────────── */

/**
 * Polyline approximation of a segment. Lines yield their two endpoints; arcs
 * are subdivided so the chord sagitta stays under ~0.5 world units, with a
 * floor of 8 and a ceiling of 180 steps. Used for bounds, hit-testing and
 * obstruction checks — never for storage (arcs stay arcs, §4).
 */
export function sampleSegment(seg: TrackSegment): Vec2[] {
  if (seg.kind === 'line') return [seg.start, seg.end];
  const sweep = Math.abs(arcSweep(seg));
  const steps = Math.max(8, Math.min(180, Math.ceil(sweep / 3)));
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push(arcPointAt(seg, arcAngleAt(seg, i / steps)));
  }
  return pts;
}

export function samplePath(segs: readonly TrackSegment[]): Vec2[] {
  const pts: Vec2[] = [];
  segs.forEach((seg, i) => {
    const s = sampleSegment(seg);
    pts.push(...(i === 0 ? s : s.slice(1)));
  });
  return pts;
}

/* ── Bounds ──────────────────────────────────────────────────────── */

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; }

/** Exact bounds: arcs contribute their extreme points (0/90/180/270°) when the
 *  sweep actually passes through them, not just their endpoints. */
export function segmentBounds(seg: TrackSegment): Bounds {
  const pts: Vec2[] = [segStart(seg), segEnd(seg)];
  if (seg.kind === 'arc') {
    for (const extreme of [0, 90, 180, 270]) {
      if (angleWithinArc(seg, extreme)) pts.push(arcPointAt(seg, extreme));
    }
  }
  return boundsOfPoints(pts);
}

export function boundsOfPoints(pts: readonly Vec2[]): Bounds {
  if (!pts.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function segmentsBounds(segs: readonly TrackSegment[]): Bounds {
  if (!segs.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const all = segs.map(segmentBounds);
  return {
    minX: Math.min(...all.map(b => b.minX)),
    minY: Math.min(...all.map(b => b.minY)),
    maxX: Math.max(...all.map(b => b.maxX)),
    maxY: Math.max(...all.map(b => b.maxY)),
  };
}

/** True when `angleDeg` lies inside the arc's swept range. */
export function angleWithinArc(arc: TrackArcSegment, angleDeg: number): boolean {
  const sweep = arcSweep(arc);
  const offset = arc.ccw
    ? normalizeDeg(angleDeg - arc.startAngle)
    : normalizeDeg(arc.startAngle - angleDeg);
  return offset <= Math.abs(sweep) + EPS;
}

/* ── Distance / hit-testing ──────────────────────────────────────── */

export function distancePointToLine(p: Vec2, a: Vec2, b: Vec2): number {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < EPS) return dist(p, a);
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return dist(p, add(a, scale(ab, t)));
}

export function distancePointToSegment(p: Vec2, seg: TrackSegment): number {
  if (seg.kind === 'line') return distancePointToLine(p, seg.start, seg.end);
  const v = sub(p, seg.center);
  const l = len(v);
  if (l > EPS) {
    const angle = bearingOf(v);
    if (angleWithinArc(seg, angle)) return Math.abs(l - seg.radius);
  }
  return Math.min(dist(p, segStart(seg)), dist(p, segEnd(seg)));
}

export function distancePointToPath(p: Vec2, segs: readonly TrackSegment[]): number {
  return segs.reduce((min, s) => Math.min(min, distancePointToSegment(p, s)), Infinity);
}

/* ── Intersections ───────────────────────────────────────────────── */

/**
 * Intersection of two infinite lines given a point and a direction each.
 * Returns null when they are parallel.
 */
export function lineLineIntersection(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const denom = cross(d1, d2);
  if (Math.abs(denom) < EPS) return null;
  const t = cross(sub(p2, p1), d2) / denom;
  return add(p1, scale(d1, t));
}

/* ── SVG output ──────────────────────────────────────────────────── */

/**
 * SVG path data for a chain of segments, offset by `-origin` so it can be
 * rendered inside an element positioned at the bbox corner.
 * Arcs use a real `A` command — no polyline approximation.
 */
export function segmentsToPathD(segs: readonly TrackSegment[], origin: Vec2 = { x: 0, y: 0 }): string {
  return segmentsToPathDWith(segs, p => ({ x: p.x - origin.x, y: p.y - origin.y }), r => r);
}

/**
 * Same as `segmentsToPathD` but through arbitrary point and length transforms —
 * used to draw a world-space alignment into a screen-space overlay without
 * duplicating the arc-flag logic. `scaleLength` must be uniform, otherwise the
 * circular arcs would need to become elliptical.
 */
export function segmentsToPathDWith(
  segs: readonly TrackSegment[],
  toPoint: (p: Vec2) => Vec2,
  scaleLength: (n: number) => number,
): string {
  if (!segs.length) return '';
  const px = (p: Vec2) => {
    const t = toPoint(p);
    return `${t.x.toFixed(3)} ${t.y.toFixed(3)}`;
  };
  const parts: string[] = [`M ${px(segStart(segs[0]))}`];
  let cursor = segStart(segs[0]);

  for (const seg of segs) {
    const s = segStart(seg);
    // A gap between segments (kinked joins after an offset) needs a new subpath
    // move, otherwise SVG would draw a phantom connector.
    if (dist(cursor, s) > 0.01) parts.push(`L ${px(s)}`);

    if (seg.kind === 'line') {
      parts.push(`L ${px(seg.end)}`);
    } else {
      const sweep = arcSweep(seg);
      const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
      // SVG sweep-flag 1 = "positive angle direction" = clockwise in SVG's
      // Y-down space, which is our CW (ccw === false).
      const sweepFlag = seg.ccw ? 0 : 1;
      const r = scaleLength(seg.radius).toFixed(3);
      parts.push(`A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${px(segEnd(seg))}`);
    }
    cursor = segEnd(seg);
  }
  return parts.join(' ');
}
