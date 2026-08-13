/**
 * obstruction.ts — "the running polyline would cross a Structure" (§3).
 *
 * Detects the conflict *as the rubber band crosses it* so the UI can highlight
 * the offending structure and offer Continue Straight | Add Curve inline,
 * instead of throwing an error after the fact.
 *
 * Pure: no React, no store.
 */

import type { CanvasObject, Vec2 } from '../../types/scene';
import type { TrackSegment } from '../../types/track';
import { sampleSegment } from './geometry';
import { boundsOf, isStructure, displayNameOf, Rect } from './sceneQueries';

export interface Obstruction {
  objectId: string;
  objectName: string;
  /** The structure's bounding box, for the highlight. */
  rect: Rect;
  /** Where the alignment first enters the structure — anchors the inline chips. */
  entry: Vec2;
}

/* ── Rect intersection ───────────────────────────────────────────── */

function pointInRect(p: Vec2, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
}

/** Segment/segment intersection test (proper or touching). */
function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d = (a: Vec2, b: Vec2, c: Vec2) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** Does the polyline a→b cross or enter the rectangle? */
function crossesRect(a: Vec2, b: Vec2, r: Rect): boolean {
  if (pointInRect(a, r) || pointInRect(b, r)) return true;
  const c1 = { x: r.x, y: r.y };
  const c2 = { x: r.x + r.width, y: r.y };
  const c3 = { x: r.x + r.width, y: r.y + r.height };
  const c4 = { x: r.x, y: r.y + r.height };
  return (
    segmentsIntersect(a, b, c1, c2) ||
    segmentsIntersect(a, b, c2, c3) ||
    segmentsIntersect(a, b, c3, c4) ||
    segmentsIntersect(a, b, c4, c1)
  );
}

/* ── Detection ───────────────────────────────────────────────────── */

/**
 * The first structure the proposed segments run into, or null.
 *
 * Arcs are tested through their sampled polyline — sampling here is a
 * *query*, not a change to the stored geometry, so the "arcs stay arcs" rule
 * is untouched.
 */
export function findObstruction(
  segments: readonly TrackSegment[],
  objects: readonly CanvasObject[],
  options: { ignoreIds?: readonly string[] } = {},
): Obstruction | null {
  if (!segments.length) return null;
  const ignore = new Set(options.ignoreIds ?? []);
  const structures = objects.filter(o => o.visible && !ignore.has(o.id) && isStructure(o));
  if (!structures.length) return null;

  for (const seg of segments) {
    const pts = sampleSegment(seg);
    for (let i = 0; i < pts.length - 1; i++) {
      for (const s of structures) {
        const rect = boundsOf(s);
        if (rect.width <= 0 || rect.height <= 0) continue;
        if (crossesRect(pts[i], pts[i + 1], rect)) {
          return {
            objectId: s.id,
            objectName: displayNameOf(s),
            rect,
            entry: pts[i],
          };
        }
      }
    }
  }
  return null;
}

/** Convenience for the live preview: does this candidate segment conflict? */
export function obstructionFor(
  from: Vec2,
  to: Vec2,
  objects: readonly CanvasObject[],
): Obstruction | null {
  return findObstruction([{ kind: 'line', start: from, end: to }], objects);
}
