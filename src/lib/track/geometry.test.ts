/**
 * Geometry + curve construction tests.
 *
 * These pin down the sign conventions (which way an arc turns, which side an
 * offset lands on) that the rest of the Track tool depends on. Getting one of
 * them backwards produces geometry that looks plausible but curves the wrong
 * way, so they are asserted explicitly rather than by eye.
 */

import type { TrackArcSegment, TrackSegment } from '../../types/track';
import {
  arcPointAt, arcSweep, arcTangentAt, bearingOf, directionOf, leftNormal,
  segLength, segStart, segEnd, segmentsBounds, totalLength, segmentsToPathD,
  distancePointToSegment, normalizeDeg,
} from './geometry';
import { arcFromTangent, curveByRadius, curveBetweenTangents, threePointCurve, isLeftOf } from './curves';

const close = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) < tol;

describe('angle conventions', () => {
  it('treats +90° as up on the screen (Y-down aware)', () => {
    const p = directionOf(90);
    expect(close(p.x, 0)).toBe(true);
    expect(close(p.y, -1)).toBe(true);
  });

  it('round-trips a direction through bearingOf', () => {
    for (const deg of [0, 37, 90, 180, 271, 359]) {
      expect(close(bearingOf(directionOf(deg)), normalizeDeg(deg), 1e-9)).toBe(true);
    }
  });

  it('puts the left normal of "travelling right" upwards on screen', () => {
    const n = leftNormal({ x: 1, y: 0 });
    expect(close(n.x, 0)).toBe(true);
    expect(close(n.y, -1)).toBe(true);
  });

  it('reports "up" as left of travelling right', () => {
    expect(isLeftOf({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: -5 })).toBe(true);
    expect(isLeftOf({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 5, y: 5 })).toBe(false);
  });
});

describe('arc primitives', () => {
  const quarter: TrackArcSegment = {
    kind: 'arc', center: { x: 0, y: 0 }, radius: 10,
    startAngle: 0, endAngle: 90, ccw: true,
  };

  it('measures a CCW quarter turn as +90°', () => {
    expect(close(arcSweep(quarter), 90)).toBe(true);
  });

  it('measures the same arc travelled the other way as −270°', () => {
    expect(close(arcSweep({ ...quarter, ccw: false }), -270)).toBe(true);
  });

  it('computes arc length from radius and sweep', () => {
    expect(close(segLength(quarter), (Math.PI / 2) * 10, 1e-9)).toBe(true);
  });

  it('places the start point at +X and the end point above the centre', () => {
    expect(close(segStart(quarter).x, 10)).toBe(true);
    expect(close(segStart(quarter).y, 0)).toBe(true);
    expect(close(segEnd(quarter).x, 0, 1e-9)).toBe(true);
    expect(close(segEnd(quarter).y, -10)).toBe(true);
  });

  it('gives a tangent perpendicular to the radius', () => {
    const t = arcTangentAt(quarter, 0);
    expect(close(t.x, 0)).toBe(true);
    expect(close(t.y, -1)).toBe(true); // travelling CCW from +X heads up
  });

  it('includes arc extremes in the bounds, not just the endpoints', () => {
    // A CCW arc from −45° to +45° bulges past both endpoints at 0°.
    const bulge: TrackArcSegment = {
      kind: 'arc', center: { x: 0, y: 0 }, radius: 10,
      startAngle: 315, endAngle: 45, ccw: true,
    };
    expect(close(segmentsBounds([bulge]).maxX, 10)).toBe(true);
  });
});

describe('arcFromTangent', () => {
  it('turns left (upward on screen) when asked to', () => {
    const arc = arcFromTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, true, 90);
    // Centre must be above the start point (smaller Y = up).
    expect(close(arc.center.x, 0)).toBe(true);
    expect(close(arc.center.y, -10)).toBe(true);
    // The end point of a left quarter-turn from +X travel is up and to the right.
    const end = arcPointAt(arc, arc.endAngle);
    expect(close(end.x, 10, 1e-9)).toBe(true);
    expect(close(end.y, -10, 1e-9)).toBe(true);
  });

  it('turns right (downward on screen) when asked to', () => {
    const arc = arcFromTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, false, 90);
    expect(close(arc.center.y, 10)).toBe(true);
    const end = arcPointAt(arc, arc.endAngle);
    expect(close(end.x, 10, 1e-9)).toBe(true);
    expect(close(end.y, 10, 1e-9)).toBe(true);
  });

  it('keeps the requested sweep magnitude', () => {
    const arc = arcFromTangent({ x: 0, y: 0 }, { x: 1, y: 0 }, 10, true, 37);
    expect(close(Math.abs(arcSweep(arc)), 37, 1e-9)).toBe(true);
  });
});

describe('curveByRadius', () => {
  it('produces an arc tangent to the incoming direction, then a straight to the target', () => {
    const solution = curveByRadius({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 200, y: -200 }, 50);
    expect(solution).not.toBeNull();
    const { arc, segments } = solution!;
    expect(arc.radius).toBe(50);

    // Tangency at the start: the arc leaves along the incoming direction.
    const t = arcTangentAt(arc, arc.startAngle);
    expect(close(t.x, 1, 1e-9)).toBe(true);
    expect(close(t.y, 0, 1e-9)).toBe(true);

    // The chain reaches the target.
    const last = segments[segments.length - 1];
    expect(close(segEnd(last).x, 200, 1e-6)).toBe(true);
    expect(close(segEnd(last).y, -200, 1e-6)).toBe(true);
  });

  it('turns toward the target', () => {
    const up = curveByRadius({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 200, y: -200 }, 50)!;
    const down = curveByRadius({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 200, y: 200 }, 50)!;
    expect(up.arc.ccw).toBe(true);    // left turn = CCW
    expect(down.arc.ccw).toBe(false); // right turn = CW
  });

  it('leaves the arc tangent pointing at the target where the straight begins', () => {
    const { arc, tangentOut } = curveByRadius({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 300, y: -120 }, 40)!;
    const t = arcTangentAt(arc, arc.endAngle);
    const toTarget = { x: 300 - tangentOut.x, y: -120 - tangentOut.y };
    const lenT = Math.hypot(toTarget.x, toTarget.y);
    expect(close(t.x, toTarget.x / lenT, 1e-6)).toBe(true);
    expect(close(t.y, toTarget.y / lenT, 1e-6)).toBe(true);
  });

  it('returns null when the target sits inside the turning circle', () => {
    // Radius 100 with a target 10 units away cannot be reached tangentially.
    expect(curveByRadius({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -10 }, 100)).toBeNull();
  });
});

describe('curveBetweenTangents', () => {
  it('fillets a right-angle corner with the requested radius', () => {
    const solution = curveBetweenTangents(
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: -100 }, 20,
    );
    expect(solution).not.toBeNull();
    const { arc, tangentIn, tangentOut, segments } = solution!;
    expect(arc.radius).toBe(20);
    // For a 90° deflection the tangent length equals the radius.
    expect(close(tangentIn.x, 80, 1e-9)).toBe(true);
    expect(close(tangentOut.y, -20, 1e-9)).toBe(true);
    // straight + arc + straight, tangent-continuous end to end
    expect(segments).toHaveLength(3);
    expect(close(segEnd(segments[0]).x, segStart(segments[1]).x, 1e-9)).toBe(true);
  });

  it('refuses a radius that does not fit between the two straights', () => {
    expect(curveBetweenTangents({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -10 }, 500)).toBeNull();
  });

  it('refuses collinear points', () => {
    expect(curveBetweenTangents({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, 5)).toBeNull();
  });
});

describe('threePointCurve', () => {
  it('builds the arc through three points', () => {
    // Points on a circle of radius 10 centred at the origin.
    const solution = threePointCurve({ x: 10, y: 0 }, { x: 0, y: -10 }, { x: -10, y: 0 });
    expect(solution).not.toBeNull();
    expect(close(solution!.arc.radius, 10, 1e-9)).toBe(true);
    expect(close(solution!.arc.center.x, 0, 1e-9)).toBe(true);
    expect(close(solution!.arc.center.y, 0, 1e-9)).toBe(true);
    expect(close(solution!.arcLength, Math.PI * 10, 1e-6)).toBe(true);
  });

  it('passes through the middle point it was given', () => {
    const solution = threePointCurve({ x: 0, y: 0 }, { x: 50, y: -20 }, { x: 100, y: 0 })!;
    expect(distancePointToSegment({ x: 50, y: -20 }, solution.arc)).toBeLessThan(1e-6);
  });

  it('returns null for collinear points', () => {
    expect(threePointCurve({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 })).toBeNull();
  });
});

describe('path helpers', () => {
  const chain: TrackSegment[] = [
    { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    { kind: 'arc', center: { x: 100, y: -10 }, radius: 10, startAngle: 270, endAngle: 0, ccw: true },
  ];

  it('sums segment lengths', () => {
    expect(close(totalLength(chain), 100 + (Math.PI / 2) * 10, 1e-9)).toBe(true);
  });

  it('emits an SVG arc command rather than a polyline approximation', () => {
    const d = segmentsToPathD(chain);
    expect(d).toContain('A 10.000 10.000');
    // sweep-flag 0 for our CCW travel
    expect(d).toMatch(/A 10\.000 10\.000 0 0 0/);
  });
});
