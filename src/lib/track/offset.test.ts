/**
 * Offset engine tests.
 *
 * The headline requirement (§4, acceptance §7.3): a track derived at an offset
 * must be **concentric** with its reference through curves, not chorded. These
 * tests assert that directly — every sampled point of the derived arc sits at
 * exactly reference-radius ± offset from the *same* centre.
 */

import type { TrackSegment, TrackArcSegment } from '../../types/track';
import { offsetSegments, offsetArc, subPath, reversePath, sideOfPath, totalSweep } from './offset';
import { dist, segLength, segStart, segEnd, sampleSegment, totalLength } from './geometry';

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) < tol;

const straight: TrackSegment = { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } };

/** A left-hand (CCW) quarter turn continuing from `straight`. */
const leftTurn: TrackArcSegment = {
  kind: 'arc', center: { x: 100, y: -50 }, radius: 50,
  startAngle: 270, endAngle: 0, ccw: true,
};

describe('offsetting a straight', () => {
  it('shifts left of travel = upward on screen', () => {
    const [out] = offsetSegments([straight], 4.5, 'left').segments;
    expect(close(segStart(out).y, -4.5)).toBe(true);
    expect(close(segEnd(out).y, -4.5)).toBe(true);
  });

  it('shifts right of travel = downward on screen', () => {
    const [out] = offsetSegments([straight], 4.5, 'right').segments;
    expect(close(segStart(out).y, 4.5)).toBe(true);
  });

  it('preserves length', () => {
    const [out] = offsetSegments([straight], 4.5, 'left').segments;
    expect(close(segLength(out), 100)).toBe(true);
  });
});

describe('offsetting an arc', () => {
  it('keeps the same centre and adjusts the radius — never re-fits points', () => {
    const inner = offsetArc(leftTurn, 4.5, 'left')!;
    expect(inner.kind).toBe('arc');
    expect(inner.center).toEqual(leftTurn.center);
    expect(inner.startAngle).toBe(leftTurn.startAngle);
    expect(inner.endAngle).toBe(leftTurn.endAngle);
    // Travelling CCW the centre is to the left, so a left offset tightens.
    expect(close(inner.radius, 45.5)).toBe(true);
  });

  it('widens on the outside of the bend', () => {
    const outer = offsetArc(leftTurn, 4.5, 'right')!;
    expect(close(outer.radius, 54.5)).toBe(true);
  });

  it('reverses which way tightens for a CW arc', () => {
    const rightTurn: TrackArcSegment = { ...leftTurn, ccw: false };
    expect(close(offsetArc(rightTurn, 4.5, 'left')!.radius, 54.5)).toBe(true);
    expect(close(offsetArc(rightTurn, 4.5, 'right')!.radius, 45.5)).toBe(true);
  });

  it('returns null rather than an inverted arc when the offset exceeds the radius', () => {
    expect(offsetArc(leftTurn, 60, 'left')).toBeNull();
  });
});

describe('offsetting a tangent-continuous alignment (acceptance §7.3)', () => {
  const reference: TrackSegment[] = [straight, leftTurn];

  it('stays concentric through the curve at 4.5 m', () => {
    const { segments } = offsetSegments(reference, 4.5, 'left');
    const arc = segments.find(s => s.kind === 'arc') as TrackArcSegment | undefined;
    expect(arc).toBeDefined();

    // Every point of the derived arc is exactly 45.5 from the SAME centre —
    // a chorded polyline would fail this.
    for (const p of sampleSegment(arc!)) {
      expect(close(dist(p, leftTurn.center), 45.5, 1e-9)).toBe(true);
    }
  });

  it('produces exactly one line and one arc — no extra joining segments', () => {
    const { segments } = offsetSegments(reference, 4.5, 'left');
    expect(segments.map(s => s.kind)).toEqual(['line', 'arc']);
  });

  it('leaves no gap at a tangent joint', () => {
    const { segments } = offsetSegments(reference, 4.5, 'right');
    expect(dist(segEnd(segments[0]), segStart(segments[1]))).toBeLessThan(1e-9);
  });

  it('keeps the swept angle identical to the reference', () => {
    const { segments } = offsetSegments(reference, 4.5, 'left');
    expect(close(totalSweep(segments), totalSweep(reference), 1e-9)).toBe(true);
  });

  it('reports no degenerate arcs for a sane offset', () => {
    expect(offsetSegments(reference, 4.5, 'left').degenerateArcs).toBe(0);
  });
});

describe('offsetting a kinked alignment', () => {
  const kinked: TrackSegment[] = [
    { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    { kind: 'line', start: { x: 100, y: 0 }, end: { x: 100, y: -100 } },
  ];

  it('mitres the corner instead of leaving a gap', () => {
    const { segments } = offsetSegments(kinked, 10, 'left');
    expect(segments).toHaveLength(2);
    expect(dist(segEnd(segments[0]), segStart(segments[1]))).toBeLessThan(1e-9);
    // The mitre point is the intersection of the two offset lines.
    expect(close(segEnd(segments[0]).x, 90)).toBe(true);
    expect(close(segEnd(segments[0]).y, -10)).toBe(true);
  });
});

describe('subPath', () => {
  const chain: TrackSegment[] = [straight, leftTurn];

  it('trims a line without touching the arc', () => {
    const part = subPath(chain, 20, 60);
    expect(part).toHaveLength(1);
    expect(close(segStart(part[0]).x, 20)).toBe(true);
    expect(close(segEnd(part[0]).x, 60)).toBe(true);
  });

  it('splits an arc into a shorter arc about the same centre', () => {
    const arcLength = segLength(leftTurn);
    const part = subPath(chain, 100, 100 + arcLength / 2);
    expect(part).toHaveLength(1);
    const arc = part[0] as TrackArcSegment;
    expect(arc.kind).toBe('arc');
    expect(arc.center).toEqual(leftTurn.center);
    expect(arc.radius).toBe(leftTurn.radius);
    expect(close(segLength(arc), arcLength / 2, 1e-6)).toBe(true);
  });

  it('clamps to the alignment and returns nothing for an empty range', () => {
    expect(subPath(chain, 500, 900)).toHaveLength(0);
    expect(totalLength(subPath(chain, -50, 1e6))).toBeCloseTo(totalLength(chain), 6);
  });
});

describe('sideOfPath', () => {
  it('reports a point above a left-to-right track as "left"', () => {
    expect(sideOfPath([straight], { x: 50, y: -20 })).toBe('left');
  });
  it('reports a point below it as "right"', () => {
    expect(sideOfPath([straight], { x: 50, y: 20 })).toBe('right');
  });
});

describe('reversePath', () => {
  it('swaps the ends and flips the travel direction of arcs', () => {
    const reversed = reversePath([straight, leftTurn]);
    expect(close(segStart(reversed[0]).x, segEnd(leftTurn).x, 1e-9)).toBe(true);
    expect((reversed[0] as TrackArcSegment).ccw).toBe(false);
    expect(close(totalLength(reversed), totalLength([straight, leftTurn]), 1e-9)).toBe(true);
  });
});
