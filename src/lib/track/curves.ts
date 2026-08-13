/**
 * curves.ts — the four curve-construction methods offered at the obstruction
 * moment (Requirements §3): Curve by Radius, Curve Between Tangents, 3-Point
 * Curve, Match Existing Curve.
 *
 * Every method takes numeric inputs and returns geometry that can be previewed
 * before commit — the user never eyeballs an arc. Each returns null when the
 * inputs cannot produce a valid arc (e.g. a radius too large to fit the corner),
 * so callers can show "not solvable yet" rather than guessing.
 *
 * Pure: no React, no store.
 */

import type { Vec2 } from '../../types/scene';
import type { TrackArcSegment, TrackSegment } from '../../types/track';
import {
  EPS, add, sub, scale, dot, cross, len, dist, normalize, bearingOf, directionOf,
  lineLineIntersection, toRad, toDeg, normalizeDeg, segEndTangent, segEnd,
} from './geometry';

/** Result of a curve construction: the arc plus any straights it implies. */
export interface CurveSolution {
  /** Segments to append to the chain, in travel order. */
  segments: TrackSegment[];
  /** The arc within `segments` — for labelling radius / arc length. */
  arc: TrackArcSegment;
  /** Tangent points, for the preview labels. */
  tangentIn: Vec2;
  tangentOut: Vec2;
  arcLength: number;
}

/* ── Shared construction ─────────────────────────────────────────── */

/**
 * Build an arc from a start point, the travel direction at that point, a radius
 * and a turn side. `turnLeft` is in screen terms (left of the direction of
 * travel). `sweepDeg` is always positive — the magnitude of the turn.
 */
export function arcFromTangent(
  start: Vec2,
  direction: Vec2,
  radius: number,
  turnLeft: boolean,
  sweepDeg: number,
): TrackArcSegment {
  const d = normalize(direction);
  // Centre sits perpendicular to travel, on the side we are turning toward.
  const toCentre = turnLeft ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
  const center = add(start, scale(toCentre, radius));
  // Angle of `start` as seen from the centre.
  const startAngle = bearingOf(sub(start, center));
  // Travelling +X with the centre above (a left turn) starts at the bottom of
  // the circle, angle 270, and the angle increases from there — so a left turn
  // is CCW in our angle space.
  const ccw = turnLeft;
  const endAngle = normalizeDeg(ccw ? startAngle + sweepDeg : startAngle - sweepDeg);
  return { kind: 'arc', center, radius, startAngle, endAngle, ccw };
}

/** Is `target` to the left of the ray (origin, direction), in screen terms? */
export function isLeftOf(origin: Vec2, direction: Vec2, target: Vec2): boolean {
  // cross(dir, toTarget) < 0 means "left" once the Y-down flip is accounted for.
  return cross(direction, sub(target, origin)) < 0;
}

/* ── 1. Curve by Radius ──────────────────────────────────────────── */

/**
 * An arc leaving `start` tangent to `direction`, of the given radius, turning
 * toward `target` and ending where the arc's tangent points at `target` — i.e.
 * the classic "curve out to a new bearing" move. A straight run from the arc's
 * end to `target` is appended so the chain still reaches the clicked point.
 *
 * Returns null when `target` lies inside the turning circle (no tangent line
 * exists) — the caller shows the radius as unreachable rather than snapping to
 * something arbitrary.
 */
export function curveByRadius(
  start: Vec2,
  direction: Vec2,
  target: Vec2,
  radius: number,
): CurveSolution | null {
  if (!(radius > EPS)) return null;
  const d = normalize(direction);
  if (len(d) < EPS) return null;

  const turnLeft = isLeftOf(start, d, target);
  const toCentre = turnLeft ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
  const center = add(start, scale(toCentre, radius));

  const centreToTarget = sub(target, center);
  const D = len(centreToTarget);
  // Target inside the turning circle → the arc can never point at it.
  if (D <= radius + EPS) return null;

  const startAngle = bearingOf(sub(start, center));
  const targetAngle = bearingOf(centreToTarget);
  // Angle from the centre-to-target line back to the tangent point.
  const tangentOffset = toDeg(Math.acos(Math.min(1, radius / D)));
  const ccw = turnLeft;
  // The tangent point is offset from the target's bearing, against the travel
  // direction, so the arc ends heading at the target.
  const endAngle = normalizeDeg(ccw ? targetAngle - tangentOffset : targetAngle + tangentOffset);

  const arc: TrackArcSegment = { kind: 'arc', center, radius, startAngle, endAngle, ccw };
  const sweep = ccw ? normalizeDeg(endAngle - startAngle) : normalizeDeg(startAngle - endAngle);
  // A sweep near a full turn means the target is behind us — reject it as a
  // curve solution; the user should place another point first.
  if (sweep > 300) return null;

  const tangentOut = segEnd(arc);
  const segments: TrackSegment[] = [arc];
  if (dist(tangentOut, target) > 0.01) {
    segments.push({ kind: 'line', start: tangentOut, end: target });
  }

  return {
    segments,
    arc,
    tangentIn: start,
    tangentOut,
    arcLength: toRad(sweep) * radius,
  };
}

/* ── 1b. Curve by Radius, clearing an obstruction ────────────────── */

/** Axis-aligned box, matching lib/track/sceneQueries `Rect`. */
export interface ClearanceRect { x: number; y: number; width: number; height: number; }

/**
 * The obstruction case of Curve by Radius.
 *
 * When the point the user clicked lies straight ahead *through* a structure,
 * there is no arc that curves "toward" it — the target is already on the
 * bearing, so `curveByRadius` correctly returns a zero sweep. What the
 * draughtsman actually wants is to swing the alignment clear of the structure.
 *
 * This builds that arc: radius `R` as given, turning to whichever side needs
 * the least deviation, swept just far enough that the alignment passes the
 * structure with `margin` to spare. The chain then continues tangentially from
 * the arc end, so the next click carries on from a real bearing.
 *
 * Lateral deviation of an arc after sweep θ is R(1 − cos θ), so the sweep for a
 * required clearance c is acos(1 − c/R) — capped at 90°, which is also where a
 * radius too large to clear the structure lands (the caller shows that as a
 * warning rather than refusing to draw).
 */
export function curveClearingObstruction(
  start: Vec2,
  direction: Vec2,
  radius: number,
  rect: ClearanceRect,
  margin = 2,
): CurveSolution | null {
  if (!(radius > EPS)) return null;
  const d = normalize(direction);
  if (len(d) < EPS) return null;

  const n = { x: d.y, y: -d.x }; // unit normal, "left of travel" on screen

  const corners: Vec2[] = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];

  // Signed lateral offsets of the structure from the ray: + is to our left.
  const lateral = corners.map(c => dot(sub(c, start), n));
  const maxLeft = Math.max(...lateral);
  const maxRight = -Math.min(...lateral);

  // Deviation needed to pass on each side, then take the cheaper one.
  const needLeft = maxLeft + margin;
  const needRight = maxRight + margin;
  const turnLeft = needLeft <= needRight;
  const clearance = Math.max(0, turnLeft ? needLeft : needRight);
  if (clearance < EPS) return null; // already clear — nothing to solve

  const cos = 1 - clearance / radius;
  const sweep = cos <= -1 ? 90 : Math.min(90, toDeg(Math.acos(Math.max(-1, Math.min(1, cos)))));
  if (!(sweep > EPS)) return null;

  const arc = arcFromTangent(start, d, radius, turnLeft, sweep);
  return {
    segments: [arc],
    arc,
    tangentIn: start,
    tangentOut: segEnd(arc),
    arcLength: toRad(sweep) * radius,
  };
}

/** Sweep magnitude of a solved curve, in degrees. */
export function solutionSweep(solution: CurveSolution): number {
  return solution.arc.radius > EPS ? toDeg(solution.arcLength / solution.arc.radius) : 0;
}

/* ── 2. Curve Between Tangents ───────────────────────────────────── */

/**
 * Classic fillet: two straights p1→p2 and p2→p3 meeting at the corner `p2`,
 * replaced by straight + arc + straight with the given radius. Returns null when
 * the tangent length the radius needs is longer than either straight, or when
 * the three points are collinear.
 */
export function curveBetweenTangents(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  radius: number,
): CurveSolution | null {
  if (!(radius > EPS)) return null;
  const inDir = normalize(sub(p2, p1));
  const outDir = normalize(sub(p3, p2));
  if (len(inDir) < EPS || len(outDir) < EPS) return null;

  const turn = signedAngleBetween(inDir, outDir);
  const deflection = Math.abs(turn);
  if (deflection < 0.5 || deflection > 179.5) return null; // collinear / doubled back

  // Tangent distance from the corner to each tangent point.
  const tangentLen = radius * Math.tan(toRad(deflection) / 2);
  if (tangentLen > dist(p1, p2) - EPS || tangentLen > dist(p2, p3) - EPS) return null;

  const tangentIn = sub(p2, scale(inDir, tangentLen));
  const tangentOut = add(p2, scale(outDir, tangentLen));

  // `turn > 0` is a left-hand turn on screen (see signedAngleBetween).
  const turnLeft = turn > 0;
  const arc = arcFromTangent(tangentIn, inDir, radius, turnLeft, deflection);

  const segments: TrackSegment[] = [];
  if (dist(p1, tangentIn) > 0.01) segments.push({ kind: 'line', start: p1, end: tangentIn });
  segments.push(arc);
  if (dist(tangentOut, p3) > 0.01) segments.push({ kind: 'line', start: tangentOut, end: p3 });

  return { segments, arc, tangentIn, tangentOut, arcLength: toRad(deflection) * radius };
}

/** Signed turn from `a` to `b` in degrees; positive = a left turn on screen. */
export function signedAngleBetween(a: Vec2, b: Vec2): number {
  const c = cross(a, b);
  const d = dot(a, b);
  // Y-down flip: a negative 2-D cross is a visual left turn.
  return -toDeg(Math.atan2(c, d));
}

/* ── 3. Three-point curve ────────────────────────────────────────── */

/**
 * The arc through three points (circumcircle), travelling p1 → p2 → p3.
 * Returns null when the points are collinear.
 */
export function threePointCurve(p1: Vec2, p2: Vec2, p3: Vec2): CurveSolution | null {
  const center = circumcentre(p1, p2, p3);
  if (!center) return null;
  const radius = dist(center, p1);
  if (!(radius > EPS) || !isFinite(radius)) return null;

  const startAngle = bearingOf(sub(p1, center));
  const midAngle = bearingOf(sub(p2, center));
  const endAngle = bearingOf(sub(p3, center));

  // Travel CCW if the mid point lies on the CCW side going start → end.
  const ccwSweep = normalizeDeg(endAngle - startAngle);
  const ccwMid = normalizeDeg(midAngle - startAngle);
  const ccw = ccwMid <= ccwSweep;

  const arc: TrackArcSegment = { kind: 'arc', center, radius, startAngle, endAngle, ccw };
  const sweep = ccw ? ccwSweep : normalizeDeg(startAngle - endAngle);

  return {
    segments: [arc],
    arc,
    tangentIn: p1,
    tangentOut: p3,
    arcLength: toRad(sweep) * radius,
  };
}

/** Centre of the circle through three points, or null if they are collinear. */
export function circumcentre(a: Vec2, b: Vec2, c: Vec2): Vec2 | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

/* ── 4. Match existing curve ─────────────────────────────────────── */

/**
 * Reuse the radius of a curve already on the drawing. Once the radius is known
 * this is exactly Curve by Radius, which keeps the preview and the committed
 * geometry identical between the two methods.
 */
export function matchExistingCurve(
  start: Vec2,
  direction: Vec2,
  target: Vec2,
  referenceRadius: number,
): CurveSolution | null {
  return curveByRadius(start, direction, target, referenceRadius);
}

/* ── Tangent continuity helper ───────────────────────────────────── */

/**
 * The direction a new segment should leave the chain with, so the alignment
 * stays tangent-continuous. Falls back to the direction toward `fallbackTarget`
 * when the chain is empty.
 */
export function chainExitDirection(
  segs: readonly TrackSegment[],
  anchor: Vec2,
  fallbackTarget: Vec2,
): Vec2 {
  const t = segs.length ? segEndTangent(segs[segs.length - 1]) : null;
  if (t && len(t) > EPS) return t;
  const d = normalize(sub(fallbackTarget, anchor));
  return len(d) > EPS ? d : directionOf(0);
}

/** Intersection of the two straights implied by a corner — used by previews. */
export function cornerIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null {
  return lineLineIntersection(p1, sub(p2, p1), p3, sub(p4, p3));
}
