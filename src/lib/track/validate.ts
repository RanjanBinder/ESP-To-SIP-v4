/**
 * validate.ts — the validation check emitted when a track is finished (§6).
 *
 * Results are **advisory**: they are returned as SODViolations so they land in
 * the existing Validation / Issue Navigation panel with click-to-zoom, and are
 * never raised as a blocking dialog. An engineer who knowingly commits a tight
 * radius gets an issue to answer later, not a wall (§8.4).
 *
 * Severities follow lib/validation/sodValidator.ts: V1 = critical (breaks a hard
 * requirement), V2 = warning (worth a human review).
 *
 * Pure: no React, no store.
 */

import type { CanvasObject, TrackObject, Vec2 } from '../../types/scene';
import type { SODViolation } from '../validation/sodValidator';
import { MIN_CURVE_RADIUS } from '../../types/track';
import { segLength, segmentsBounds, segStart, segEnd } from './geometry';
import { trackWorldSegments, missingRequiredFields } from './trackAsset';

export interface TrackValidationOptions {
  /** Overrides the configured minimum curve radius (world units / metres). */
  minCurveRadius?: number;
}

/**
 * Grade one finished track. Returns an empty array when the asset is clean.
 *
 * Checks (all from §6):
 *  - unsnapped endpoints
 *  - zero-length segments
 *  - radius below the configured minimum
 *  - missing mandatory properties
 */
export function validateTrack(
  track: TrackObject,
  _objects: readonly CanvasObject[] = [],
  options: TrackValidationOptions = {},
): SODViolation[] {
  const minRadius = options.minCurveRadius ?? MIN_CURVE_RADIUS;
  const issues: SODViolation[] = [];
  const world = trackWorldSegments(track);
  const bounds = segmentsBounds(world);
  const name = track.track.displayName || track.track.trackName || track.name;

  const anchor = {
    assetId: track.id,
    assetName: name,
    canvasX: bounds.minX,
    canvasY: bounds.minY,
    canvasW: bounds.maxX - bounds.minX,
    canvasH: bounds.maxY - bounds.minY,
  };

  /* ── Mandatory properties ── */
  for (const field of missingRequiredFields(track)) {
    issues.push({
      id: `${track.id}-missing-${field.replace(/\s+/g, '-').toLowerCase()}`,
      severity: 'V1',
      ruleId: 'track-missing-property',
      ruleCode: 'TRK-P01',
      title: `${field} is not set`,
      detail: `${name} cannot be signed off until ${field} is filled in.`,
      ...anchor,
    });
  }

  /* ── Unsnapped endpoints ── */
  if (!track.track.startLink) {
    issues.push({
      id: `${track.id}-unsnapped-start`,
      severity: 'V2',
      ruleId: 'track-unsnapped-end',
      ruleCode: 'TRK-G01',
      title: 'Start point is not snapped',
      detail: `${name} begins at a free canvas position — it is not tied to a track end, turnout, SRJ or chainage.`,
      ...anchor,
      canvasX: world.length ? startPoint(track).x : anchor.canvasX,
      canvasY: world.length ? startPoint(track).y : anchor.canvasY,
    });
  }
  if (!track.track.endLink) {
    issues.push({
      id: `${track.id}-unsnapped-end`,
      severity: 'V2',
      ruleId: 'track-unsnapped-end',
      ruleCode: 'TRK-G01',
      title: 'End point is not snapped',
      detail: `${name} ends at a free canvas position — it is not tied to a track end, turnout, SRJ or chainage.`,
      ...anchor,
      canvasX: world.length ? endPoint(track).x : anchor.canvasX,
      canvasY: world.length ? endPoint(track).y : anchor.canvasY,
    });
  }

  /* ── Zero-length segments ── */
  const zeroLength = world.filter(s => segLength(s) < 0.01).length;
  if (zeroLength > 0) {
    issues.push({
      id: `${track.id}-zero-length`,
      severity: 'V2',
      ruleId: 'track-zero-length-segment',
      ruleCode: 'TRK-G02',
      title: `${zeroLength} zero-length segment${zeroLength === 1 ? '' : 's'}`,
      detail: `${name} contains geometry with no length, which will not export cleanly.`,
      measured: zeroLength,
      required: '0',
      ...anchor,
    });
  }

  /* ── Curve radius below the configured minimum ── */
  world.forEach((seg, i) => {
    if (seg.kind !== 'arc' || seg.radius >= minRadius) return;
    issues.push({
      id: `${track.id}-radius-${i}`,
      severity: 'V1',
      ruleId: 'track-min-curve-radius',
      ruleCode: 'TRK-C01',
      title: 'Curve radius below minimum',
      detail: `${name} has a curve of ${seg.radius.toFixed(1)} m, tighter than the permitted minimum.`,
      measured: Number(seg.radius.toFixed(1)),
      required: `≥ ${minRadius} m`,
      unit: ' m',
      ...anchor,
      canvasX: seg.center.x - seg.radius,
      canvasY: seg.center.y - seg.radius,
      canvasW: seg.radius * 2,
      canvasH: seg.radius * 2,
    });
  });

  return issues;
}

function startPoint(track: TrackObject): Vec2 {
  return segStart(trackWorldSegments(track)[0]);
}

function endPoint(track: TrackObject): Vec2 {
  const segs = trackWorldSegments(track);
  return segEnd(segs[segs.length - 1]);
}
