/**
 * offset.ts — deriving one alignment from another (Requirements §4 and §5).
 *
 * The hard rule: **offsets preserve arc geometry**. An arc is offset by
 * adjusting its radius about the same centre, so the result is concentric with
 * the reference. Nothing here samples an arc into points and re-fits a
 * polyline — that would chord the curve and fail acceptance test §7.3.
 *
 * Also provides arc-length trimming (`subPath`), used by the "between two
 * chainages" and "selected curve only" portions.
 *
 * Pure: no React, no store.
 */

import type { Vec2 } from '../../types/scene';
import type { TrackSegment, TrackArcSegment, TrackLineSegment, TrackOffsetSide } from '../../types/track';
import {
  EPS, add, scale, sub, dist, normalize, leftNormal, normalizeDeg,
  segStart, segEnd, segLength, segStartTangent, segEndTangent, arcSweep, arcAngleAt,
  arcPointAt, arcTangentAt, lineLineIntersection, cross,
} from './geometry';

export interface OffsetResult {
  segments: TrackSegment[];
  /** Arcs whose offset radius collapsed to (or through) zero — the offset is
   *  larger than the curve radius on the inside of the bend. Advisory only:
   *  those arcs are dropped and the neighbours joined. */
  degenerateArcs: number;
}

/* ── Single-primitive offset ─────────────────────────────────────── */

/** Offset a straight by `distance` to the given side of travel. */
export function offsetLine(seg: TrackLineSegment, distance: number, side: TrackOffsetSide): TrackLineSegment {
  const dir = normalize(sub(seg.end, seg.start));
  const n = leftNormal(dir);
  const shift = scale(n, side === 'left' ? distance : -distance);
  return { kind: 'line', start: add(seg.start, shift), end: add(seg.end, shift) };
}

/**
 * Offset an arc **concentrically** — same centre, same angles, adjusted radius.
 *
 * Which way the radius moves depends on the turn direction: travelling CCW the
 * centre is to the left, so offsetting left means a smaller radius. Returns
 * null when the radius would reach zero or invert.
 */
export function offsetArc(seg: TrackArcSegment, distance: number, side: TrackOffsetSide): TrackArcSegment | null {
  const towardCentre = seg.ccw ? side === 'left' : side === 'right';
  const radius = towardCentre ? seg.radius - distance : seg.radius + distance;
  if (radius <= EPS) return null;
  return { ...seg, radius };
}

export function offsetSegment(seg: TrackSegment, distance: number, side: TrackOffsetSide): TrackSegment | null {
  return seg.kind === 'line' ? offsetLine(seg, distance, side) : offsetArc(seg, distance, side);
}

/* ── Chain offset with joint repair ──────────────────────────────── */

/**
 * Offset a whole alignment.
 *
 * Each primitive is offset independently (arcs stay arcs), then joints are
 * repaired:
 *  - tangent-continuous joints (what the Track tool produces) already meet
 *    exactly — nothing to do;
 *  - a kinked line/line joint is mitred by intersecting the two offset lines;
 *  - any other kink is closed with a short straight, so the alignment stays
 *    continuous without inventing curvature the reference never had.
 */
export function offsetSegments(
  segs: readonly TrackSegment[],
  distance: number,
  side: TrackOffsetSide,
): OffsetResult {
  if (!segs.length || Math.abs(distance) < EPS) {
    return { segments: segs.map(s => ({ ...s })), degenerateArcs: 0 };
  }

  let degenerateArcs = 0;
  const offset: TrackSegment[] = [];
  for (const seg of segs) {
    const o = offsetSegment(seg, distance, side);
    if (o) offset.push(o);
    else degenerateArcs++;
  }
  if (!offset.length) return { segments: [], degenerateArcs };

  const out: TrackSegment[] = [offset[0]];
  for (let i = 1; i < offset.length; i++) {
    const prev = out[out.length - 1];
    const next = offset[i];
    const gap = dist(segEnd(prev), segStart(next));
    if (gap <= 0.01) { out.push(next); continue; }

    if (prev.kind === 'line' && next.kind === 'line') {
      const hit = lineLineIntersection(
        prev.start, sub(prev.end, prev.start),
        next.start, sub(next.end, next.start),
      );
      if (hit) {
        out[out.length - 1] = { kind: 'line', start: prev.start, end: hit };
        out.push({ kind: 'line', start: hit, end: next.end });
        continue;
      }
    }

    out.push({ kind: 'line', start: segEnd(prev), end: segStart(next) });
    out.push(next);
  }

  return { segments: out, degenerateArcs };
}

/**
 * Which side of the reference the cursor is on — drives the Left/Right choice
 * by mouse position rather than a radio button (§8.5).
 */
export function sideOfPath(segs: readonly TrackSegment[], point: Vec2): TrackOffsetSide {
  const nearest = nearestOnPath(segs, point);
  if (!nearest) return 'left';
  // cross(travel, toPoint) < 0 ⇒ the point is to the visual left of travel.
  return cross(nearest.tangent, sub(point, nearest.point)) < 0 ? 'left' : 'right';
}

interface NearestHit { point: Vec2; tangent: Vec2; distanceAlong: number; distance: number; }

/** Closest point on the alignment to `p`, with the travel direction there. */
export function nearestOnPath(segs: readonly TrackSegment[], p: Vec2): NearestHit | null {
  let best: NearestHit | null = null;
  let consumed = 0;

  for (const seg of segs) {
    const l = segLength(seg);
    // 24 samples per primitive is plenty to pick the right side and a good
    // seed distance; the value returned is only used for UI decisions.
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const along = (l * i) / steps;
      const pt = seg.kind === 'line'
        ? add(seg.start, scale(sub(seg.end, seg.start), i / steps))
        : arcPointAt(seg, arcAngleAt(seg, i / steps));
      const d = dist(pt, p);
      if (!best || d < best.distance) {
        const tangent = seg.kind === 'line'
          ? segStartTangent(seg)
          : arcTangentAt(seg, arcAngleAt(seg, i / steps));
        best = { point: pt, tangent, distanceAlong: consumed + along, distance: d };
      }
    }
    consumed += l;
  }
  return best;
}

/* ── Trimming by arc length ──────────────────────────────────────── */

/**
 * The part of an alignment between two arc-length stations. Splitting a line
 * yields a shorter line; splitting an arc yields a shorter arc about the same
 * centre — again, no polyline re-fitting.
 */
export function subPath(segs: readonly TrackSegment[], fromDist: number, toDist: number): TrackSegment[] {
  const total = segs.reduce((s, x) => s + segLength(x), 0);
  const a = Math.max(0, Math.min(fromDist, toDist));
  const b = Math.min(total, Math.max(fromDist, toDist));
  if (b - a < EPS) return [];

  const out: TrackSegment[] = [];
  let consumed = 0;

  for (const seg of segs) {
    const l = segLength(seg);
    const segFrom = consumed;
    const segTo = consumed + l;
    consumed = segTo;

    if (segTo <= a + EPS || segFrom >= b - EPS) continue;

    const t0 = l < EPS ? 0 : Math.max(0, (a - segFrom) / l);
    const t1 = l < EPS ? 1 : Math.min(1, (b - segFrom) / l);
    if (t1 - t0 < EPS) continue;

    out.push(sliceSegment(seg, t0, t1));
  }
  return out;
}

/** The part of one segment between two fractions of its length. */
export function sliceSegment(seg: TrackSegment, t0: number, t1: number): TrackSegment {
  if (seg.kind === 'line') {
    const d = sub(seg.end, seg.start);
    return {
      kind: 'line',
      start: add(seg.start, scale(d, t0)),
      end: add(seg.start, scale(d, t1)),
    };
  }
  return {
    ...seg,
    startAngle: normalizeDeg(arcAngleAt(seg, t0)),
    endAngle: normalizeDeg(arcAngleAt(seg, t1)),
  };
}

/* ── Portion selection helpers (§4 step 1) ───────────────────────── */

/** The single arc containing `point`, as its own alignment — "selected curve only". */
export function curveAt(segs: readonly TrackSegment[], point: Vec2): TrackSegment[] {
  let bestIdx = -1;
  let bestDist = Infinity;
  segs.forEach((seg, i) => {
    if (seg.kind !== 'arc') return;
    const d = Math.abs(dist(point, seg.center) - seg.radius);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  });
  return bestIdx >= 0 ? [segs[bestIdx]] : [];
}

/** Reverse an alignment so it runs end-to-start (used when following a
 *  reference track that was drawn the other way round). */
export function reversePath(segs: readonly TrackSegment[]): TrackSegment[] {
  return segs
    .slice()
    .reverse()
    .map<TrackSegment>(seg =>
      seg.kind === 'line'
        ? { kind: 'line', start: seg.end, end: seg.start }
        : { ...seg, startAngle: seg.endAngle, endAngle: seg.startAngle, ccw: !seg.ccw },
    );
}

/** Total swept angle magnitude — handy for tests and issue messages. */
export function totalSweep(segs: readonly TrackSegment[]): number {
  return segs.reduce((s, x) => s + (x.kind === 'arc' ? Math.abs(arcSweep(x)) : 0), 0);
}

/** Travel direction where the alignment ends (re-exported for callers that
 *  only import this module). */
export function exitTangent(segs: readonly TrackSegment[]): Vec2 | null {
  return segs.length ? segEndTangent(segs[segs.length - 1]) : null;
}
