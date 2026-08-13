/**
 * session.ts — the Track tool's draw session, as a pure reducer.
 *
 * All three drawing modes (Draw New, Parallel Track, Match Existing Track) and
 * the obstruction/curve flow live here as data transitions, with no React and
 * no store access — so the whole interaction is unit-testable and the UI layer
 * is left to render state and dispatch actions.
 *
 * Design rules taken straight from the requirements:
 *  - Nothing is created by a dropdown selection alone (§8.1). Every phase that
 *    changes geometry produces a *preview*; only `finish` yields an asset.
 *  - Changing a toolbar dropdown mid-draw applies to segments not yet
 *    committed, and never rewrites what is already drawn (§8.2).
 *  - There are no dead ends (§8.1): every phase can be backed out of with
 *    `cancel-phase` without restarting the track.
 */

import type { CanvasObject, Vec2 } from '../../types/scene';
import type {
  TrackSegment, TrackToolSettings, TrackSnapCandidate, TrackEndLink,
  CurveMethod, TrackRefPortion, TrackOffsetSide,
} from '../../types/track';
import {
  DEFAULT_TRACK_SETTINGS, DEFAULT_TRACK_OFFSET, MIN_CURVE_RADIUS,
} from '../../types/track';
import {
  dist, totalLength, bearingOf, sub, normalize, pathEnd, pathEndTangent, segLength,
} from './geometry';
import {
  curveByRadius, curveBetweenTangents, threePointCurve, chainExitDirection,
  curveClearingObstruction, solutionSweep,
} from './curves';
import { offsetSegments, sideOfPath, nearestOnPath, subPath, curveAt, reversePath } from './offset';
import { findObstruction, Obstruction } from './obstruction';
import { referenceAlignment, displayNameOf } from './sceneQueries';
import { constrainToAxes } from './snapping';

/* ── Phases ──────────────────────────────────────────────────────── */

export type TrackPhase =
  /** Tool armed, no point placed yet. */
  | 'idle'
  /** A chain is in progress; clicks extend it. */
  | 'drawing'
  /** The rubber band hit a structure — Continue Straight | Add Curve. */
  | 'obstruction'
  /** Choosing between the four curve methods. */
  | 'curve-method'
  /** Collecting the numeric inputs for the chosen method. */
  | 'curve-input'
  /** Parallel / Match Existing: pick the reference track. */
  | 'reference-pick'
  /** Match Existing: pick which portion of the reference to follow. */
  | 'reference-portion'
  /** Both follow modes: offset distance + side, with a live concentric preview. */
  | 'reference-offset';

/* ── State ───────────────────────────────────────────────────────── */

export interface CurveInputs {
  radius: number | null;
  /** 3-Point Curve needs a mid point picked on the canvas. */
  midPoint: Vec2 | null;
  /** Match Existing Curve: the radius harvested from the picked curve. */
  matchedRadius: number | null;
  matchedFrom: string | null;
}

export interface ReferenceState {
  trackId: string;
  trackName: string;
  /** Reference alignment in world coordinates. */
  alignment: TrackSegment[];
  portion: TrackRefPortion;
  chainageFrom: number | null;
  chainageTo: number | null;
  /** Portion actually being followed, after the portion choice is applied. */
  portionAlignment: TrackSegment[];
}

export interface TrackSession {
  settings: TrackToolSettings;
  phase: TrackPhase;

  /** Committed segments of the asset in progress (world coordinates). */
  segments: TrackSegment[];
  /** Where the next segment starts — the end of the chain. */
  anchor: Vec2 | null;

  startLink: TrackEndLink | null;
  endLink: TrackEndLink | null;

  /** Snap alternatives under the cursor and which one is chosen (Tab cycles). */
  snapCandidates: TrackSnapCandidate[];
  snapIndex: number;
  snapSuppressed: boolean;
  /** Last resolved cursor position, after snap and Shift constraint. */
  cursor: Vec2;
  orthoConstrained: boolean;

  /** The structure the rubber band ran into, while the choice is open. */
  obstruction: Obstruction | null;
  /** Where the click that triggered the obstruction wanted to go. */
  pendingTarget: Vec2 | null;

  curveMethod: CurveMethod | null;
  curveInputs: CurveInputs;
  /** Pre-fills Curve by Radius on the next curve (§8.4). */
  lastRadius: number;

  reference: ReferenceState | null;
  offsetDistance: number;
  offsetSide: TrackOffsetSide;
  recentOffsets: number[];

  /** Set when the session was restored from an autosave (§8.7). */
  restored: boolean;
}

export function createSession(settings: TrackToolSettings = DEFAULT_TRACK_SETTINGS): TrackSession {
  return {
    settings,
    phase: settings.mode === 'draw-new' ? 'idle' : 'reference-pick',
    segments: [],
    anchor: null,
    startLink: null,
    endLink: null,
    snapCandidates: [],
    snapIndex: 0,
    snapSuppressed: false,
    cursor: { x: 0, y: 0 },
    orthoConstrained: false,
    obstruction: null,
    pendingTarget: null,
    curveMethod: null,
    curveInputs: { radius: null, midPoint: null, matchedRadius: null, matchedFrom: null },
    lastRadius: MIN_CURVE_RADIUS * 2,
    reference: null,
    offsetDistance: DEFAULT_TRACK_OFFSET,
    offsetSide: 'left',
    recentOffsets: [DEFAULT_TRACK_OFFSET],
    restored: false,
  };
}

/** Is there work in progress that Escape should abort rather than exit the tool? */
export function hasWorkInProgress(s: TrackSession): boolean {
  return s.segments.length > 0 || s.anchor !== null || s.reference !== null;
}

/**
 * Phases that `cancel-phase` can actually back out of.
 *
 * Escape walks a ladder — back out of a sub-flow, then abort the asset, then
 * leave the tool. Without this check the phases that have nothing to back out
 * of (idle, drawing, reference-pick) would swallow Escape and strand the user
 * in the tool, which §8.1 forbids ("no dead ends").
 */
export function canCancelPhase(s: TrackSession): boolean {
  return (
    s.phase === 'obstruction' ||
    s.phase === 'curve-method' ||
    s.phase === 'curve-input' ||
    s.phase === 'reference-portion' ||
    s.phase === 'reference-offset'
  );
}

/* ── Actions ─────────────────────────────────────────────────────── */

export type TrackAction =
  | { type: 'set-settings'; settings: Partial<TrackToolSettings> }
  | { type: 'pointer-move'; world: Vec2; candidates: TrackSnapCandidate[]; shift: boolean; ctrl: boolean }
  | { type: 'click'; world: Vec2; objects: readonly CanvasObject[]; hitObjectId: string | null }
  | { type: 'cycle-snap' }
  | { type: 'backspace' }
  | { type: 'cancel-phase' }
  | { type: 'reset' }
  | { type: 'restore-draft'; segments: TrackSegment[]; settings: TrackToolSettings }
  /* obstruction */
  | { type: 'continue-straight' }
  | { type: 'add-curve' }
  | { type: 'choose-curve-method'; method: CurveMethod }
  | { type: 'set-curve-radius'; radius: number | null }
  | { type: 'commit-curve' }
  /* numeric entry mid-draw */
  | { type: 'commit-length-bearing'; length: number; bearing: number }
  /* reference flow */
  | { type: 'set-portion'; portion: TrackRefPortion }
  | { type: 'set-chainages'; from: number | null; to: number | null }
  | { type: 'set-offset'; distance: number }
  | { type: 'set-offset-side'; side: TrackOffsetSide }
  | { type: 'confirm-reference' };

/* ── Reducer ─────────────────────────────────────────────────────── */

export function trackSessionReducer(state: TrackSession, action: TrackAction): TrackSession {
  switch (action.type) {
    case 'set-settings':
      return applySettings(state, action.settings);

    case 'pointer-move': {
      const raw = action.candidates[0]?.point ?? action.world;
      const chosen = action.candidates.length
        ? action.candidates[clampIndex(state.snapIndex, action.candidates.length)].point
        : raw;
      const constrained = action.shift && state.anchor
        ? constrainToAxes(state.anchor, chosen)
        : chosen;
      const next: TrackSession = {
        ...state,
        cursor: constrained,
        orthoConstrained: action.shift && state.anchor != null,
        snapCandidates: action.candidates,
        snapIndex: clampIndex(state.snapIndex, action.candidates.length || 1),
        snapSuppressed: action.ctrl,
      };
      // Offset side follows the mouse rather than a radio button (§8.5).
      if (next.reference && (next.phase === 'reference-offset' || next.phase === 'reference-portion')) {
        next.offsetSide = sideOfPath(next.reference.alignment, constrained);
      }
      return next;
    }

    case 'cycle-snap':
      return state.snapCandidates.length > 1
        ? { ...state, snapIndex: (state.snapIndex + 1) % state.snapCandidates.length }
        : state;

    case 'click':
      return handleClick(state, action);

    case 'backspace':
      return removeLastSegment(state);

    case 'cancel-phase':
      return cancelPhase(state);

    case 'reset':
      return { ...createSession(state.settings), lastRadius: state.lastRadius, recentOffsets: state.recentOffsets };

    case 'restore-draft': {
      if (!action.segments.length) return state;
      return {
        ...createSession(action.settings),
        phase: 'drawing',
        segments: action.segments,
        anchor: pathEnd(action.segments),
        lastRadius: state.lastRadius,
        recentOffsets: state.recentOffsets,
        restored: true,
      };
    }

    case 'continue-straight': {
      if (state.phase !== 'obstruction' || !state.anchor || !state.pendingTarget) return state;
      return commitSegments(
        { ...state, phase: 'drawing', obstruction: null, pendingTarget: null },
        [{ kind: 'line', start: state.anchor, end: state.pendingTarget }],
      );
    }

    case 'add-curve':
      if (state.phase !== 'obstruction') return state;
      return { ...state, phase: 'curve-method' };

    case 'choose-curve-method':
      return {
        ...state,
        phase: 'curve-input',
        curveMethod: action.method,
        curveInputs: {
          radius: action.method === 'radius' ? state.lastRadius : null,
          midPoint: null,
          matchedRadius: null,
          matchedFrom: null,
        },
      };

    case 'set-curve-radius':
      return { ...state, curveInputs: { ...state.curveInputs, radius: action.radius } };

    case 'commit-curve': {
      const solution = solveCurve(state);
      if (!solution) return state;
      const radius = solution.arc.radius;
      return commitSegments(
        {
          ...state,
          phase: 'drawing',
          obstruction: null,
          pendingTarget: null,
          curveMethod: null,
          curveInputs: { radius: null, midPoint: null, matchedRadius: null, matchedFrom: null },
          lastRadius: radius,
        },
        solution.segments,
      );
    }

    case 'commit-length-bearing': {
      if (!state.anchor || !isFinite(action.length) || action.length <= 0) return state;
      const dir = directionFor(action.bearing);
      const end = { x: state.anchor.x + dir.x * action.length, y: state.anchor.y + dir.y * action.length };
      return commitSegments(state, [{ kind: 'line', start: state.anchor, end }]);
    }

    case 'set-portion': {
      if (!state.reference) return state;
      const reference = withPortion(state.reference, action.portion, state.cursor);
      // "Entire track" needs nothing more, so go straight to the offset step.
      // The other two need a canvas pick first (which curve / which stations),
      // so they stay here until that arrives.
      return {
        ...state,
        reference,
        phase: action.portion === 'entire' ? 'reference-offset' : 'reference-portion',
      };
    }

    case 'set-chainages': {
      if (!state.reference) return state;
      const reference = {
        ...state.reference,
        chainageFrom: action.from,
        chainageTo: action.to,
        portionAlignment: portionAlignmentFor(
          state.reference.alignment, 'between-chainages', action.from, action.to, state.cursor,
        ),
      };
      // Both stations known → the portion is settled, move on to the offset.
      const settled = action.from != null && action.to != null;
      return { ...state, reference, phase: settled ? 'reference-offset' : state.phase };
    }

    case 'set-offset':
      return { ...state, offsetDistance: Math.max(0, action.distance) };

    case 'set-offset-side':
      return { ...state, offsetSide: action.side };

    case 'confirm-reference': {
      const derived = derivedAlignment(state);
      if (!derived.length) return state;
      return {
        ...state,
        phase: 'drawing',
        segments: derived,
        anchor: pathEnd(derived),
        recentOffsets: rememberOffset(state.recentOffsets, state.offsetDistance),
      };
    }

    default:
      return state;
  }
}

/* ── Click routing ───────────────────────────────────────────────── */

function handleClick(state: TrackSession, action: Extract<TrackAction, { type: 'click' }>): TrackSession {
  const point = state.cursor;
  const snap = currentSnap(state);

  switch (state.phase) {
    case 'reference-pick': {
      const target = action.hitObjectId
        ? action.objects.find(o => o.id === action.hitObjectId)
        : undefined;
      const alignment = target ? referenceAlignment(target) : null;
      if (!target || !alignment || !alignment.length) return state;

      // Parallel Track uses the whole length of the preceding track by default
      // (§5); Match Existing asks which portion to follow (§4).
      const portion: TrackRefPortion = 'entire';
      const reference: ReferenceState = {
        trackId: target.id,
        trackName: displayNameOf(target),
        alignment,
        portion,
        chainageFrom: null,
        chainageTo: null,
        portionAlignment: alignment,
      };
      const side = sideOfPath(alignment, point);
      return {
        ...state,
        reference,
        offsetSide: side,
        phase: state.settings.mode === 'parallel' ? 'reference-offset' : 'reference-portion',
      };
    }

    case 'reference-portion': {
      if (!state.reference) return state;
      // A click during portion selection picks the curve / chainage station the
      // cursor is over; the portion kind itself comes from the chip row.
      const reference = withPortion(state.reference, state.reference.portion, point);
      return { ...state, reference, phase: 'reference-offset' };
    }

    case 'reference-offset': {
      // Clicking commits the previewed alignment — same as pressing Enter.
      return trackSessionReducer(state, { type: 'confirm-reference' });
    }

    case 'curve-input': {
      // 3-Point Curve collects its mid point from the canvas.
      if (state.curveMethod === 'three-point' && !state.curveInputs.midPoint) {
        return { ...state, curveInputs: { ...state.curveInputs, midPoint: point } };
      }
      if (state.curveMethod === 'match-existing' && state.curveInputs.matchedRadius == null) {
        const picked = pickCurveRadius(action.objects, point, action.hitObjectId);
        if (picked) {
          return {
            ...state,
            curveInputs: { ...state.curveInputs, matchedRadius: picked.radius, matchedFrom: picked.name },
          };
        }
        return state;
      }
      return trackSessionReducer(state, { type: 'commit-curve' });
    }

    case 'obstruction':
      // Clicks are inert while the inline choice is open — the user answers the
      // chips (mouse or keyboard) instead of the click being silently dropped
      // into geometry.
      return state;

    case 'idle': {
      const startLink = linkFrom(snap);
      return { ...state, phase: 'drawing', anchor: point, startLink };
    }

    case 'drawing': {
      if (!state.anchor) return { ...state, anchor: point, startLink: linkFrom(snap) };
      if (dist(state.anchor, point) < 1) return state; // ignore the 2nd click of a double-click

      const candidate: TrackSegment = { kind: 'line', start: state.anchor, end: point };
      const hit = findObstruction([candidate], action.objects);
      if (hit) {
        return { ...state, phase: 'obstruction', obstruction: hit, pendingTarget: point };
      }
      return commitSegments(state, [candidate]);
    }

    default:
      return state;
  }
}

/* ── Transitions ─────────────────────────────────────────────────── */

function commitSegments(state: TrackSession, segments: TrackSegment[]): TrackSession {
  const kept = segments.filter(s => segLength(s) > 1e-6);
  if (!kept.length) return state;
  const next = [...state.segments, ...kept];
  return {
    ...state,
    phase: 'drawing',
    segments: next,
    anchor: pathEnd(next),
    endLink: linkFrom(currentSnap(state)),
  };
}

function removeLastSegment(state: TrackSession): TrackSession {
  if (!state.segments.length) {
    // Backspace with only the first point placed clears the start point, which
    // is the only "back" step that remains.
    return state.anchor ? { ...state, phase: 'idle', anchor: null, startLink: null } : state;
  }
  const segments = state.segments.slice(0, -1);
  return {
    ...state,
    phase: 'drawing',
    segments,
    anchor: segments.length ? pathEnd(segments) : state.segments[0] ? startOf(state.segments[0]) : null,
    endLink: null,
    obstruction: null,
    pendingTarget: null,
  };
}

function startOf(seg: TrackSegment): Vec2 {
  return seg.kind === 'line' ? seg.start : {
    x: seg.center.x + seg.radius * Math.cos((seg.startAngle * Math.PI) / 180),
    y: seg.center.y - seg.radius * Math.sin((seg.startAngle * Math.PI) / 180),
  };
}

/** Back out of the current sub-flow without losing the track (§8.1 "no dead ends"). */
function cancelPhase(state: TrackSession): TrackSession {
  switch (state.phase) {
    case 'obstruction':
      return { ...state, phase: 'drawing', obstruction: null, pendingTarget: null };
    case 'curve-method':
      return { ...state, phase: 'obstruction' };
    case 'curve-input':
      return { ...state, phase: 'curve-method', curveMethod: null };
    case 'reference-portion':
      return { ...state, phase: 'reference-pick', reference: null };
    case 'reference-offset':
      return state.settings.mode === 'parallel'
        ? { ...state, phase: 'reference-pick', reference: null }
        : { ...state, phase: 'reference-portion' };
    default:
      return state;
  }
}

/**
 * Toolbar changes mid-draw affect what has not been committed yet, and never
 * rewrite committed geometry (§8.2). Switching drawing mode does restart the
 * flow — but only when nothing has been drawn, so no work is ever lost.
 */
function applySettings(state: TrackSession, patch: Partial<TrackToolSettings>): TrackSession {
  const settings = { ...state.settings, ...patch };
  const modeChanged = patch.mode != null && patch.mode !== state.settings.mode;
  if (!modeChanged) return { ...state, settings };
  if (hasWorkInProgress(state)) {
    // Keep drawing; the new mode takes effect for the next track.
    return { ...state, settings };
  }
  return { ...createSession(settings), lastRadius: state.lastRadius, recentOffsets: state.recentOffsets };
}

/* ── Snap helpers ────────────────────────────────────────────────── */

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function currentSnap(state: TrackSession): TrackSnapCandidate | null {
  if (state.snapSuppressed || !state.snapCandidates.length) return null;
  const c = state.snapCandidates[clampIndex(state.snapIndex, state.snapCandidates.length)];
  return c && c.type !== 'free' ? c : null;
}

function linkFrom(snap: TrackSnapCandidate | null): TrackEndLink | null {
  if (!snap || !snap.targetId) return null;
  return {
    snapType: snap.type,
    targetId: snap.targetId,
    targetName: snap.targetName ?? snap.label,
    chainage: snap.chainage,
  };
}

function directionFor(bearingDeg: number): Vec2 {
  const r = (bearingDeg * Math.PI) / 180;
  return { x: Math.cos(r), y: -Math.sin(r) };
}

/* ── Curve solving ───────────────────────────────────────────────── */

export interface CurvePreview {
  segments: TrackSegment[];
  arc: { radius: number; center: Vec2; length: number };
  /** Below the configured minimum — previews in a warning colour, still committable. */
  belowMinimumRadius: boolean;
  /** True when the arc swings clear of the structure instead of curving toward
   *  the clicked point (which lay straight ahead, through it). */
  clearsObstruction: boolean;
  message: string;
}

/** Below this sweep a "curve toward the target" is no curve at all — the target
 *  is already on the current bearing. */
const MIN_MEANINGFUL_SWEEP_DEG = 1;

/** Solve the chosen curve method against the current chain. Null while the
 *  inputs are incomplete or the geometry has no solution. */
export function solveCurve(state: TrackSession): CurvePreview | null {
  const { anchor, pendingTarget, curveMethod, curveInputs } = state;
  if (!anchor || !pendingTarget || !curveMethod) return null;
  const direction = chainExitDirection(state.segments, anchor, pendingTarget);

  let solution = null as ReturnType<typeof curveByRadius>;
  let clearsObstruction = false;

  /** Curve toward the clicked point; if that point is straight ahead through
   *  the structure there is nothing to curve toward, so swing clear instead. */
  const byRadius = (r: number) => {
    const toward = curveByRadius(anchor, direction, pendingTarget, r);
    if (toward && solutionSweep(toward) >= MIN_MEANINGFUL_SWEEP_DEG) return toward;
    if (state.obstruction) {
      const clear = curveClearingObstruction(anchor, direction, r, state.obstruction.rect);
      if (clear) { clearsObstruction = true; return clear; }
    }
    return toward;
  };

  if (curveMethod === 'radius') {
    const r = curveInputs.radius;
    if (r == null || !(r > 0)) return null;
    solution = byRadius(r);
  } else if (curveMethod === 'between-tangents') {
    const r = curveInputs.radius;
    if (r == null || !(r > 0)) return null;
    // The incoming straight is the last committed segment (or a stub along the
    // exit direction when the chain starts with the corner).
    const back = { x: anchor.x - direction.x * Math.max(r * 2, 50), y: anchor.y - direction.y * Math.max(r * 2, 50) };
    solution = curveBetweenTangents(back, anchor, pendingTarget, r);
  } else if (curveMethod === 'three-point') {
    const mid = curveInputs.midPoint;
    if (!mid) return null;
    solution = threePointCurve(anchor, mid, pendingTarget);
  } else if (curveMethod === 'match-existing') {
    const r = curveInputs.matchedRadius;
    if (r == null || !(r > 0)) return null;
    solution = byRadius(r);
  }

  if (!solution) return null;
  // A sub-degree sweep is not a curve; treat it as unsolved so the UI says so
  // rather than committing a segment that looks like nothing happened.
  if (solutionSweep(solution) < MIN_MEANINGFUL_SWEEP_DEG) return null;

  const radius = solution.arc.radius;
  const belowMinimumRadius = radius < MIN_CURVE_RADIUS;
  return {
    segments: solution.segments,
    arc: { radius, center: solution.arc.center, length: solution.arcLength },
    belowMinimumRadius,
    clearsObstruction,
    message: belowMinimumRadius
      ? `Radius ${radius.toFixed(1)} m is below the ${MIN_CURVE_RADIUS} m minimum`
      : `R ${radius.toFixed(1)} m · arc ${solution.arcLength.toFixed(1)} m`,
  };
}

/** Find a curve on the drawing to copy a radius from (Match Existing Curve). */
function pickCurveRadius(
  objects: readonly CanvasObject[],
  point: Vec2,
  hitObjectId: string | null,
): { radius: number; name: string } | null {
  const hit = hitObjectId ? objects.find(o => o.id === hitObjectId) : undefined;
  const candidates = hit ? [hit] : objects.filter(o => o.visible);

  for (const obj of candidates) {
    if (obj.type === 'arc') return { radius: obj.width / 2, name: obj.name };
    if (obj.type === 'track') {
      const arcs = obj.geometry.filter(s => s.kind === 'arc');
      if (arcs.length) {
        const nearest = curveAt(referenceAlignment(obj) ?? [], point);
        const arc = nearest.find(s => s.kind === 'arc');
        if (arc && arc.kind === 'arc') return { radius: arc.radius, name: displayNameOf(obj) };
      }
    }
  }
  return null;
}

/* ── Reference-following ─────────────────────────────────────────── */

function portionAlignmentFor(
  alignment: TrackSegment[],
  portion: TrackRefPortion,
  from: number | null,
  to: number | null,
  cursor: Vec2,
): TrackSegment[] {
  if (portion === 'entire') return alignment;
  if (portion === 'selected-curve') return curveAt(alignment, cursor);
  const total = totalLength(alignment);
  return subPath(alignment, from ?? 0, to ?? total);
}

function withPortion(reference: ReferenceState, portion: TrackRefPortion, cursor: Vec2): ReferenceState {
  return {
    ...reference,
    portion,
    portionAlignment: portionAlignmentFor(
      reference.alignment, portion, reference.chainageFrom, reference.chainageTo, cursor,
    ),
  };
}

/**
 * The offset alignment currently previewed in a follow mode. Concentric through
 * curves — `offsetSegments` adjusts arc radii rather than re-fitting points.
 */
export function derivedAlignment(state: TrackSession): TrackSegment[] {
  if (!state.reference) return [];
  const source = state.reference.portionAlignment.length
    ? state.reference.portionAlignment
    : state.reference.alignment;
  if (!source.length) return [];
  return offsetSegments(source, state.offsetDistance, state.offsetSide).segments;
}

/** Live side-of-reference from the cursor, so Left/Right is chosen by moving
 *  the mouse rather than by a radio button (§8.5). */
export function sideFromCursor(state: TrackSession): TrackOffsetSide | null {
  if (!state.reference) return null;
  return sideOfPath(state.reference.alignment, state.cursor);
}

/** Distance along the reference under the cursor — seeds the chainage inputs. */
export function stationAtCursor(state: TrackSession): number | null {
  if (!state.reference) return null;
  return nearestOnPath(state.reference.alignment, state.cursor)?.distanceAlong ?? null;
}

function rememberOffset(recent: number[], value: number): number[] {
  const next = [value, ...recent.filter(v => Math.abs(v - value) > 1e-6)];
  return next.slice(0, 5);
}

/* ── Live preview (§8.1 "preview before commit, always") ─────────── */

export interface SessionPreview {
  /** Ghost geometry to draw over the real drawing. */
  segments: TrackSegment[];
  /** Running length of the whole alignment including the ghost. */
  totalLength: number;
  /** Length of just the next segment. */
  segmentLength: number;
  /** Bearing of the next segment, degrees CCW from +X. */
  bearing: number;
  warning: string | null;
}

/**
 * What the user sees before they click: the rubber-band next segment, the
 * curve solution while a curve is being dimensioned, or the derived alignment
 * in a follow mode.
 */
export function computePreview(state: TrackSession): SessionPreview | null {
  const committedLength = totalLength(state.segments);

  if (state.phase === 'reference-offset' || state.phase === 'reference-portion') {
    const segments = derivedAlignment(state);
    if (!segments.length) return null;
    return {
      segments,
      totalLength: totalLength(segments),
      segmentLength: totalLength(segments),
      bearing: bearingOfPath(segments),
      warning: null,
    };
  }

  if (state.phase === 'curve-input' || state.phase === 'curve-method') {
    const solved = solveCurve(state);
    if (!solved) return null;
    return {
      segments: solved.segments,
      totalLength: committedLength + totalLength(solved.segments),
      segmentLength: solved.arc.length,
      bearing: bearingOfPath(solved.segments),
      warning: solved.belowMinimumRadius ? solved.message : null,
    };
  }

  if (!state.anchor) return null;
  const target = state.phase === 'obstruction' && state.pendingTarget ? state.pendingTarget : state.cursor;
  const seg: TrackSegment = { kind: 'line', start: state.anchor, end: target };
  const length = dist(state.anchor, target);
  if (length < 1e-6) return null;

  return {
    segments: [seg],
    totalLength: committedLength + length,
    segmentLength: length,
    bearing: bearingOf(sub(target, state.anchor)),
    warning: state.phase === 'obstruction' && state.obstruction
      ? `Crosses ${state.obstruction.objectName}`
      : null,
  };
}

function bearingOfPath(segs: readonly TrackSegment[]): number {
  const t = pathEndTangent(segs);
  return t ? bearingOf(normalize(t)) : 0;
}

/* ── Finishing ───────────────────────────────────────────────────── */

/** Can `finish` produce an asset? */
export function canFinish(state: TrackSession): boolean {
  return state.segments.length > 0;
}

/** Re-export so the UI layer imports one module for the whole session API. */
export { findObstruction, reversePath };
