/**
 * computeDiff.ts — The version-comparison engine.
 *
 * Compares two arrays of CanvasObjects (a base version and a head version) and
 * classifies each asset as added / removed / moved / modified / unchanged.
 *
 * Matching is two-phase: first by stable id (the same asset kept across
 * versions), then unmatched assets are paired by type + proximity so an asset
 * that was re-created with a new id but sits in roughly the same place is still
 * recognised as the "same" asset that moved, rather than a remove + add pair.
 */

import type { CanvasObject } from '../../types/scene';
import { AssetChange, ChangeType, VersionDiffResult } from './diffTypes';

/** Move more than this many world units (centre-to-centre) → 'moved'. */
const MOVE_THRESHOLD = 4;

/** Same-type assets within this world distance are treated as the same asset. */
const MATCH_RADIUS = 45;

/* ── Geometry helpers ──────────────────────────────────────────────── */

/** Centre point of any object in world coordinates. Lines use their midpoint. */
export function objectCenter(o: CanvasObject): { x: number; y: number } {
  if (o.type === 'line') {
    return { x: o.x + o.dx / 2, y: o.y + o.dy / 2 };
  }
  return { x: o.x + o.width / 2, y: o.y + o.height / 2 };
}

/** Half-extents of the object's bounding box (min 8 so point-like assets show). */
function halfExtents(o: CanvasObject): { hw: number; hh: number } {
  if (o.type === 'line') {
    return { hw: Math.max(Math.abs(o.dx) / 2, 8), hh: Math.max(Math.abs(o.dy) / 2, 8) };
  }
  return { hw: Math.max(o.width / 2, 8), hh: Math.max(o.height / 2, 8) };
}

/** Signature of everything EXCEPT position — a change here means 'modified'. */
function attributeSignature(o: CanvasObject): string {
  // Strip identity + geometry; whatever remains is a meaningful attribute.
  const {
    id, x, y, width, height,
    ...rest
  } = o as CanvasObject & { dx?: number; dy?: number };
  const stripped = { ...rest } as Record<string, unknown>;
  delete stripped.dx;
  delete stripped.dy;
  return JSON.stringify(stripped);
}

function makeChange(
  changeId: string,
  changeType: ChangeType,
  newObject: CanvasObject | null,
  oldObject: CanvasObject | null,
  description: string,
  extra?: { deltaX?: number; deltaY?: number },
): AssetChange {
  const anchor = newObject ?? oldObject!;
  const c = objectCenter(anchor);
  const { hw, hh } = halfExtents(anchor);
  return {
    changeId,
    changeType,
    newObject,
    oldObject,
    description,
    deltaX: extra?.deltaX,
    deltaY: extra?.deltaY,
    canvasX: c.x,
    canvasY: c.y,
    canvasHalfW: hw,
    canvasHalfH: hh,
  };
}

/* ── Classification of an id/proximity-matched pair ────────────────── */

function classifyMatched(
  base: CanvasObject,
  head: CanvasObject,
): { type: ChangeType; description: string; deltaX: number; deltaY: number } {
  const bc = objectCenter(base);
  const hc = objectCenter(head);
  const dx = hc.x - bc.x;
  const dy = hc.y - bc.y;
  const dist = Math.hypot(dx, dy);

  if (dist > MOVE_THRESHOLD) {
    const dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
    return {
      type: 'moved',
      description: `${head.type} "${head.name}" moved ${Math.round(dist)}u ${dir}`,
      deltaX: dx,
      deltaY: dy,
    };
  }

  if (attributeSignature(base) !== attributeSignature(head)) {
    const renamed = base.name !== head.name;
    return {
      type: 'modified',
      description: renamed
        ? `${head.type} "${base.name}" renamed to "${head.name}"`
        : `${head.type} "${head.name}" attributes changed`,
      deltaX: dx,
      deltaY: dy,
    };
  }

  return {
    type: 'unchanged',
    description: `${head.type} "${head.name}" unchanged`,
    deltaX: dx,
    deltaY: dy,
  };
}

/* ── Public API ────────────────────────────────────────────────────── */

export function computeVersionDiff(
  baseObjects: CanvasObject[],
  headObjects: CanvasObject[],
  baseVersion: string,
  headVersion: string,
): VersionDiffResult {
  const changes: AssetChange[] = [];
  const matchedBaseIds = new Set<string>();
  const matchedHeadIds = new Set<string>();
  let n = 0;
  const nextId = () => `CHG-${++n}`;

  /* Phase 1 — match by stable id. */
  for (const head of headObjects) {
    const base = baseObjects.find(b => b.id === head.id);
    if (!base) continue;
    matchedBaseIds.add(base.id);
    matchedHeadIds.add(head.id);
    const k = classifyMatched(base, head);
    changes.push(makeChange(nextId(), k.type, head, base, k.description, { deltaX: k.deltaX, deltaY: k.deltaY }));
  }

  /* Phase 2 — match remaining assets by type + proximity. */
  const unmatchedBase = baseObjects.filter(b => !matchedBaseIds.has(b.id));
  const unmatchedHead = headObjects.filter(h => !matchedHeadIds.has(h.id));

  for (const head of unmatchedHead) {
    const hc = objectCenter(head);
    const closest = unmatchedBase
      .filter(b => b.type === head.type && !matchedBaseIds.has(b.id))
      .map(b => {
        const bc = objectCenter(b);
        return { asset: b, dist: Math.hypot(bc.x - hc.x, bc.y - hc.y) };
      })
      .sort((a, b) => a.dist - b.dist)[0];

    if (closest && closest.dist < MATCH_RADIUS) {
      matchedBaseIds.add(closest.asset.id);
      matchedHeadIds.add(head.id);
      const k = classifyMatched(closest.asset, head);
      changes.push(makeChange(nextId(), k.type, head, closest.asset, k.description, { deltaX: k.deltaX, deltaY: k.deltaY }));
    }
  }

  /* Phase 3 — leftovers are pure additions / removals. */
  for (const head of headObjects.filter(h => !matchedHeadIds.has(h.id))) {
    changes.push(makeChange(nextId(), 'added', head, null, `${head.type} "${head.name}" added`));
  }
  for (const base of baseObjects.filter(b => !matchedBaseIds.has(b.id))) {
    changes.push(makeChange(nextId(), 'removed', null, base, `${base.type} "${base.name}" removed`));
  }

  const count = (t: ChangeType) => changes.filter(c => c.changeType === t).length;

  return {
    baseVersion,
    headVersion,
    computedAt: new Date().toISOString(),
    changes,
    added: count('added'),
    removed: count('removed'),
    moved: count('moved'),
    modified: count('modified'),
    unchanged: count('unchanged'),
  };
}
