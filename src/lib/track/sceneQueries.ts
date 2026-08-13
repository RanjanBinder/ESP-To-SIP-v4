/**
 * sceneQueries.ts — reading railway meaning out of the generic CanvasObject
 * scene: which objects are tracks, which are turnouts / SRJs, which count as
 * Structures for the obstruction check.
 *
 * Kept in one place so the Track tool, the snap engine and the validator all
 * agree on what a "turnout" is, and so the next ESP asset tool (Turnout, SRJ,
 * Platform) can reuse the same predicates instead of re-deriving them.
 *
 * Pure: no React, no store.
 */

import type { CanvasObject, LineObject, SymbolObject, TrackObject, Vec2 } from '../../types/scene';
import { isLine, isSymbol, isTrack } from '../../types/scene';
import type { TrackSegment } from '../../types/track';

/* ── Layer / symbol vocabulary ───────────────────────────────────── */

/** Layers whose linework represents running track. */
export const TRACK_LAYER_IDS = new Set(['tracks', 'main-line', 'loop-lines', 'sidings']);

/** Layers whose objects obstruct an alignment (§3 obstruction case). */
export const STRUCTURE_LAYER_IDS = new Set(['platforms', 'structures']);

/** Library symbols that represent a structure rather than a track fitting. */
export const STRUCTURE_SYMBOL_IDS = new Set([
  'platform', 'bridge', 'structure', 'fob-reference', 'adjacent-station', 'lc-gate',
]);

/* ── Predicates ──────────────────────────────────────────────────── */

export function isTrackAsset(obj: CanvasObject): obj is TrackObject {
  return isTrack(obj);
}

/** Straight linework that stands in for a track — the PDF/DXF imports and the
 *  legacy polyline tool both produce these, so the Track tool must snap to them. */
export function isLegacyTrackLine(obj: CanvasObject): obj is LineObject {
  if (!isLine(obj)) return false;
  return TRACK_LAYER_IDS.has(obj.layerId) || obj.sod?.assetKind === 'Track';
}

export function isTurnoutSymbol(obj: CanvasObject): obj is SymbolObject {
  return isSymbol(obj) && (obj.symbolId.startsWith('turnout') || /turnout/i.test(obj.label));
}

export function isSrjSymbol(obj: CanvasObject): obj is SymbolObject {
  return isSymbol(obj) && (obj.symbolId === 'srj' || /\bSRJ\b/i.test(obj.label));
}

/** Platform, FOB, station building, bridge — anything a track must not cross. */
export function isStructure(obj: CanvasObject): boolean {
  if (obj.sod?.assetKind === 'Structure' || obj.sod?.assetKind === 'Platform') return true;
  if (isSymbol(obj) && STRUCTURE_SYMBOL_IDS.has(obj.symbolId)) return true;
  if (STRUCTURE_LAYER_IDS.has(obj.layerId)) return obj.type !== 'text';
  return false;
}

/* ── Geometry extraction ─────────────────────────────────────────── */

export interface Rect { x: number; y: number; width: number; height: number; }

export function boundsOf(obj: CanvasObject): Rect {
  if (isLine(obj)) {
    return {
      x: Math.min(obj.x, obj.x + obj.dx),
      y: Math.min(obj.y, obj.y + obj.dy),
      width: Math.abs(obj.dx),
      height: Math.abs(obj.dy),
    };
  }
  return { x: obj.x, y: obj.y, width: obj.width, height: obj.height };
}

export function centreOf(obj: CanvasObject): Vec2 {
  const b = boundsOf(obj);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** The two ends of a legacy track line, in drawing order. */
export function lineEnds(obj: LineObject): [Vec2, Vec2] {
  return [{ x: obj.x, y: obj.y }, { x: obj.x + obj.dx, y: obj.y + obj.dy }];
}

/**
 * The three connection points of a placed turnout, derived from its bounding
 * box: toe (the single-track end), and the two diverging ends. Real turnout
 * geometry lands with the Turnout tool; until then the bbox gives stable,
 * nameable snap targets rather than a silent centre-point snap.
 */
export function turnoutConnections(sym: SymbolObject): { point: Vec2; role: string }[] {
  const { x, y, width, height } = sym;
  return [
    { point: { x, y: y + height / 2 }, role: 'toe' },
    { point: { x: x + width, y: y + height / 2 }, role: 'main' },
    { point: { x: x + width, y: y + height }, role: 'branch' },
  ];
}

/* ── Chainage text ───────────────────────────────────────────────── */

/** Railway chainage forms: `123/4`, `12.345`, `KM 45`, `45+300`. */
const CHAINAGE_RE = /^(?:km\s*)?\d{1,4}(?:[./+]\d{1,4})?$/i;

export function parseChainageLabel(value: string): string | null {
  const t = value.trim();
  return CHAINAGE_RE.test(t) ? t : null;
}

/* ── Track alignment access ──────────────────────────────────────── */

/**
 * The world-space alignment of any object that can act as a reference track:
 * a real Track asset, or a legacy straight line on a track layer.
 * Returns null for everything else.
 */
export function referenceAlignment(obj: CanvasObject): TrackSegment[] | null {
  if (isTrack(obj)) {
    return obj.geometry.map(seg =>
      seg.kind === 'line'
        ? {
            kind: 'line' as const,
            start: { x: seg.start.x + obj.x, y: seg.start.y + obj.y },
            end: { x: seg.end.x + obj.x, y: seg.end.y + obj.y },
          }
        : { ...seg, center: { x: seg.center.x + obj.x, y: seg.center.y + obj.y } },
    );
  }
  if (isLegacyTrackLine(obj)) {
    const [a, b] = lineEnds(obj);
    return [{ kind: 'line', start: a, end: b }];
  }
  return null;
}

/** Display name for an object in snap badges and issue messages. */
export function displayNameOf(obj: CanvasObject): string {
  if (isTrack(obj)) return obj.track.displayName || obj.track.trackName || obj.name;
  if (isSymbol(obj)) return obj.label || obj.name;
  return obj.name;
}
