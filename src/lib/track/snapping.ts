/**
 * snapping.ts — snap candidates for the Track tool (Requirements §3 step 1, §8.3).
 *
 * Priority order, highest first: existing track end → turnout branch → SRJ →
 * known chainage → free canvas position. A free position is always present as
 * the last candidate, so `Tab` can always cycle back to "no snap" and the tool
 * never has an empty candidate list.
 *
 * The search radius arrives in WORLD units but callers derive it from a fixed
 * pixel radius (`SNAP_RADIUS_PX / zoom`) so the feel does not change with zoom.
 *
 * Pure: no React, no store.
 */

import type { CanvasObject, Vec2 } from '../../types/scene';
import { isTextObject, isTrack } from '../../types/scene';
import type { TrackSnapCandidate, TrackSnapType } from '../../types/track';
import { SNAP_PRIORITY } from '../../types/track';
import { dist } from './geometry';
import {
  isLegacyTrackLine, isSrjSymbol, isTurnoutSymbol, lineEnds, centreOf,
  turnoutConnections, parseChainageLabel, displayNameOf,
} from './sceneQueries';
import { trackWorldEnds } from './trackAsset';

/** Snap tolerance in screen pixels — converted to world units by the caller. */
export const SNAP_RADIUS_PX = 14;

/* ── Candidate collection ────────────────────────────────────────── */

interface RawCandidate extends TrackSnapCandidate { distance: number; }

/**
 * All snap candidates within `radius` of `world`, best first.
 *
 * Sorting is by snap-type priority, then by distance — so a track end slightly
 * further away still wins over a nearer chainage label, matching "prefer the
 * higher-priority type and let Tab cycle alternatives" (§8.3).
 */
export function findSnapCandidates(
  world: Vec2,
  objects: readonly CanvasObject[],
  radius: number,
  options: { excludeId?: string } = {},
): TrackSnapCandidate[] {
  const found: RawCandidate[] = [];

  const consider = (
    point: Vec2,
    type: TrackSnapType,
    label: string,
    target?: CanvasObject,
    chainage?: string,
  ) => {
    const d = dist(point, world);
    if (d > radius) return;
    found.push({
      type, point, label, distance: d,
      targetId: target?.id,
      targetName: target ? displayNameOf(target) : undefined,
      chainage,
    });
  };

  for (const obj of objects) {
    if (!obj.visible || obj.id === options.excludeId) continue;

    /* 1 — existing track ends (real Track assets and legacy track linework) */
    if (isTrack(obj)) {
      const ends = trackWorldEnds(obj);
      if (ends) {
        const name = displayNameOf(obj);
        consider(ends.start, 'track-end', `${name} start`, obj, obj.track.startChainage || undefined);
        consider(ends.end, 'track-end', `${name} end`, obj, obj.track.endChainage || undefined);
      }
      continue;
    }
    if (isLegacyTrackLine(obj)) {
      const [a, b] = lineEnds(obj);
      const name = displayNameOf(obj);
      consider(a, 'track-end', `${name} start`, obj);
      consider(b, 'track-end', `${name} end`, obj);
      continue;
    }

    /* 2 — turnout connection points */
    if (isTurnoutSymbol(obj)) {
      const name = displayNameOf(obj);
      for (const { point, role } of turnoutConnections(obj)) {
        consider(point, 'turnout-branch', `${name} ${role}`, obj);
      }
      continue;
    }

    /* 3 — SRJ */
    if (isSrjSymbol(obj)) {
      consider(centreOf(obj), 'srj', displayNameOf(obj), obj);
      continue;
    }

    /* 4 — known chainage (a chainage-formatted text label) */
    if (isTextObject(obj)) {
      const chainage = parseChainageLabel(obj.value);
      if (chainage) consider({ x: obj.x, y: obj.y }, 'chainage', `Chainage ${chainage}`, obj, chainage);
    }
  }

  found.sort((a, b) => {
    const p = SNAP_PRIORITY[a.type] - SNAP_PRIORITY[b.type];
    return p !== 0 ? p : a.distance - b.distance;
  });

  const candidates: TrackSnapCandidate[] = found.map(({ distance, ...c }) => c);
  // A free position is always available as the final alternative.
  candidates.push({ type: 'free', point: world, label: 'Free position' });
  return candidates;
}

/* ── Modifier-aware resolution ───────────────────────────────────── */

export interface SnapResolution {
  /** The point the tool should actually use. */
  point: Vec2;
  /** The chosen candidate (type 'free' when nothing was snapped). */
  candidate: TrackSnapCandidate;
  /** All alternatives at this position, for Tab-cycling. */
  candidates: TrackSnapCandidate[];
  index: number;
}

/**
 * Resolve the cursor to a snap point.
 *
 * `suppressed` (the Ctrl key) short-circuits to the raw position and reports a
 * 'free' candidate, so the badge can read "Snap off" — snapping is never
 * silently skipped.
 */
export function resolveSnap(
  world: Vec2,
  objects: readonly CanvasObject[],
  radius: number,
  index: number,
  suppressed: boolean,
  options: { excludeId?: string } = {},
): SnapResolution {
  if (suppressed) {
    const free: TrackSnapCandidate = { type: 'free', point: world, label: 'Snap off' };
    return { point: world, candidate: free, candidates: [free], index: 0 };
  }
  const candidates = findSnapCandidates(world, objects, radius, options);
  const i = candidates.length ? ((index % candidates.length) + candidates.length) % candidates.length : 0;
  const candidate = candidates[i];
  return { point: candidate.point, candidate, candidates, index: i };
}

/* ── Ortho / 45° constraint (Shift) ──────────────────────────────── */

/**
 * Constrain `point` to the nearest 45° ray from `anchor` — the Shift-key
 * behaviour every CAD user expects.
 */
export function constrainToAxes(anchor: Vec2, point: Vec2): Vec2 {
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return point;
  const step = Math.PI / 4;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  return { x: anchor.x + Math.cos(angle) * length, y: anchor.y + Math.sin(angle) * length };
}
