/**
 * track.ts — domain model for the ESP Track asset (Requirements §4.2.1, asset 4).
 *
 * A track drawn on the canvas is ONE asset regardless of how many internal
 * geometry segments it holds. That is the hard requirement this file encodes:
 * `TrackObject.geometry` is a list of line/arc segments, but the object itself
 * is a single `CanvasObject`, so select / move / delete / undo / copy all
 * operate on the asset for free (see types/scene.ts).
 *
 * Conventions (shared with types/scene.ts and lib/grid.ts):
 *  - All geometry is in WORLD units. 1 world unit == 1 metre for the engineering
 *    values this tool shows (length, radius, offset) — see WORLD_UNITS_PER_METRE.
 *  - Angles are degrees, CCW from +X, and a point at angle `a` on a circle is
 *    `(cx + r·cos a, cy − r·sin a)` — the `−sin` matches the screen's Y-down
 *    axis, identical to ArcObject in types/scene.ts.
 *  - `TrackObject.geometry` is stored RELATIVE to the object's (x, y) anchor so
 *    the generic bbox/move code in the store and selectTool keeps working
 *    unchanged. `lib/track/trackAsset.ts` converts to/from world coordinates.
 *
 * No logic and no imports from upper layers (ARCHITECTURE.md §1).
 */

import type { Vec2 } from './scene';

/* ── Units ───────────────────────────────────────────────────────── */

/**
 * World units per metre. The drawing model treats one world unit as one metre
 * (the param-drawing command bar already labels raw world lengths "m", and the
 * station fixtures span X 100–1400 for a ~1.3 km station). Centralised here so
 * a future re-scale is a one-line change.
 */
export const WORLD_UNITS_PER_METRE = 1;

/* ── Toolbar enums (§1) ──────────────────────────────────────────── */

export type TrackType = 'Main' | 'Loop' | 'Siding';
export type TrackWorkStatus = 'Existing' | 'Proposed' | 'Future';
export type TrackDirection = 'UP' | 'DN' | 'Bidirectional';
export type TrackDrawingMode = 'draw-new' | 'parallel' | 'match-existing';

export const TRACK_TYPES: TrackType[] = ['Main', 'Loop', 'Siding'];
export const TRACK_WORK_STATUSES: TrackWorkStatus[] = ['Existing', 'Proposed', 'Future'];
export const TRACK_DIRECTIONS: TrackDirection[] = ['UP', 'DN', 'Bidirectional'];

export const TRACK_DRAWING_MODES: { id: TrackDrawingMode; label: string }[] = [
  { id: 'draw-new',       label: 'Draw New' },
  { id: 'parallel',       label: 'Parallel Track' },
  { id: 'match-existing', label: 'Match Existing Track' },
];

/** The four dropdowns in the contextual toolbar. Sticky for the session. */
export interface TrackToolSettings {
  trackType: TrackType;
  workStatus: TrackWorkStatus;
  direction: TrackDirection;
  mode: TrackDrawingMode;
}

export const DEFAULT_TRACK_SETTINGS: TrackToolSettings = {
  trackType: 'Main',
  workStatus: 'Proposed',
  direction: 'UP',
  mode: 'draw-new',
};

/* ── Geometry segments (§2) ──────────────────────────────────────── */

export interface TrackLineSegment {
  kind: 'line';
  start: Vec2;
  end: Vec2;
}

/**
 * Circular arc. `ccw` is the travel direction along the arc: true means the
 * angle increases from `startAngle` to `endAngle`. Endpoints are derived from
 * centre + radius + angles so there is exactly one source of truth.
 */
export interface TrackArcSegment {
  kind: 'arc';
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
  ccw: boolean;
}

export type TrackSegment = TrackLineSegment | TrackArcSegment;

export function isLineSegment(s: TrackSegment): s is TrackLineSegment {
  return s.kind === 'line';
}
export function isArcSegment(s: TrackSegment): s is TrackArcSegment {
  return s.kind === 'arc';
}

/* ── Snapping (§3 step 1, §8.3) ──────────────────────────────────── */

/** Snap candidate kinds, in the priority order the requirements specify. */
export type TrackSnapType = 'track-end' | 'turnout-branch' | 'srj' | 'chainage' | 'free';

export const SNAP_PRIORITY: Record<TrackSnapType, number> = {
  'track-end': 0,
  'turnout-branch': 1,
  srj: 2,
  chainage: 3,
  free: 4,
};

export interface TrackSnapCandidate {
  type: TrackSnapType;
  point: Vec2;
  /** Text shown in the snap badge, e.g. "Turnout T-14 branch". */
  label: string;
  /** Object the snap belongs to (absent for a free position). */
  targetId?: string;
  targetName?: string;
  /** Chainage carried by the target, when the snap type supplies one. */
  chainage?: string;
}

/** What a finished track end was snapped to — kept on the asset for traceability. */
export interface TrackEndLink {
  snapType: TrackSnapType;
  targetId: string;
  targetName: string;
  chainage?: string;
}

/* ── Curve methods (§3 obstruction case) ─────────────────────────── */

export type CurveMethod =
  | 'radius'
  | 'between-tangents'
  | 'three-point'
  | 'match-existing';

export const CURVE_METHODS: { id: CurveMethod; label: string; hint: string }[] = [
  { id: 'radius',           label: 'Curve by Radius',      hint: 'Arc tangent to the last segment, given radius' },
  { id: 'between-tangents', label: 'Curve Between Tangents', hint: 'Fillet the corner between two straights' },
  { id: 'three-point',      label: '3-Point Curve',        hint: 'Arc through start, a mid point and the end' },
  { id: 'match-existing',   label: 'Match Existing Curve', hint: 'Reuse the radius of a curve already drawn' },
];

/* ── Reference-following modes (§4, §5) ──────────────────────────── */

export type TrackRefPortion = 'entire' | 'between-chainages' | 'selected-curve';

export const REF_PORTIONS: { id: TrackRefPortion; label: string }[] = [
  { id: 'entire',            label: 'Entire track' },
  { id: 'between-chainages', label: 'Between two chainages' },
  { id: 'selected-curve',    label: 'Selected curve only' },
];

export type TrackOffsetSide = 'left' | 'right';

/* ── Properties panel fields (§2) ────────────────────────────────── */

/**
 * The Properties-panel payload. Only `trackName` and `direction` are required
 * at creation (§8.6); the rest may be filled in later and are reported as an
 * incomplete-field count rather than blocking the draw.
 */
export interface TrackProperties {
  trackName: string;
  displayName: string;
  roadNumber: string;
  trackType: TrackType;
  direction: TrackDirection;
  workStatus: TrackWorkStatus;
  cal: string;
  startLocation: string;
  endLocation: string;
  startChainage: string;
  endChainage: string;
  /** Field ids whose value was auto-derived — marked with an icon, overridable. */
  derivedFields: string[];
  /** What each end snapped to, when it snapped to anything. */
  startLink?: TrackEndLink;
  endLink?: TrackEndLink;
  /** Provenance for Parallel / Match Existing tracks. */
  referenceTrackId?: string;
  referenceTrackName?: string;
  offset?: number;
  offsetSide?: TrackOffsetSide;
}

/** Fields the panel treats as mandatory for a complete asset. */
export const REQUIRED_TRACK_FIELDS: (keyof TrackProperties)[] = ['trackName', 'direction'];

/** Every editable field, in panel order, with its label. */
export const TRACK_FIELD_LABELS: { id: keyof TrackProperties; label: string }[] = [
  { id: 'trackName',     label: 'Track Name' },
  { id: 'displayName',   label: 'Display Name' },
  { id: 'roadNumber',    label: 'Road Number' },
  { id: 'trackType',     label: 'Track Type' },
  { id: 'direction',     label: 'Direction' },
  { id: 'cal',           label: 'CAL' },
  { id: 'startLocation', label: 'Start Location' },
  { id: 'endLocation',   label: 'End Location' },
  { id: 'startChainage', label: 'Start Chainage' },
  { id: 'endChainage',   label: 'End Chainage' },
];

/* ── Configuration ───────────────────────────────────────────────── */

/** Minimum permissible curve radius (world units / metres). Advisory: a curve
 *  below it previews in a warning colour and raises a validation issue, but the
 *  user is never blocked (§8.4). */
export const MIN_CURVE_RADIUS = 175;

/** Default track centre-to-centre spacing offered in Parallel / Match modes. */
export const DEFAULT_TRACK_OFFSET = 4.5;
