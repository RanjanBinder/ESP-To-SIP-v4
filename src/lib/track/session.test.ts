/**
 * Draw-session tests — the functional acceptance criteria in §7, plus the
 * "no dead ends" and "don't rewrite committed geometry" rules from §8.
 */

import type { CanvasObject, RectangleObject, SymbolObject } from '../../types/scene';
import type { TrackSnapCandidate, TrackToolSettings } from '../../types/track';
import { DEFAULT_TRACK_SETTINGS } from '../../types/track';
import {
  createSession, trackSessionReducer, TrackSession, TrackAction,
  computePreview, canFinish, hasWorkInProgress, canCancelPhase,
} from './session';
import { createTrackAsset, trackWorldSegments, __resetTrackCounter } from './trackAsset';
import { validateTrack } from './validate';
import { totalLength, segStart, segEnd, dist, pathEndTangent } from './geometry';

/* ── Fixtures ────────────────────────────────────────────────────── */

const baseObject = {
  layerId: 'tracks', locked: false, visible: true,
  rotation: 0, scale: 100,
};

function platform(x: number, y: number, w = 60, h = 30): RectangleObject {
  return {
    ...baseObject,
    id: 'plat-1', type: 'rectangle', name: 'Platform 1', layerId: 'platforms',
    x, y, width: w, height: h,
    fill: 'none', stroke: '#000', strokeWidth: 1, strokeStyle: 'solid', cornerRadius: 0,
  };
}

function turnout(x: number, y: number): SymbolObject {
  return {
    ...baseObject,
    id: 'to-14', type: 'symbol', name: 'T-14', layerId: 'turnouts',
    x, y, width: 40, height: 12,
    symbolId: 'turnout-112', label: 'Turnout T-14',
  };
}

/** Drive the reducer through a list of actions. */
function run(session: TrackSession, actions: TrackAction[]): TrackSession {
  return actions.reduce(trackSessionReducer, session);
}

/** A click at `world`, preceded by the pointer-move the canvas always sends. */
function clickAt(world: { x: number; y: number }, objects: CanvasObject[] = [], hitId: string | null = null): TrackAction[] {
  const candidates: TrackSnapCandidate[] = [{ type: 'free', point: world, label: 'Free position' }];
  return [
    { type: 'pointer-move', world, candidates, shift: false, ctrl: false },
    { type: 'click', world, objects, hitObjectId: hitId },
  ];
}

function snappedClickAt(
  world: { x: number; y: number },
  candidate: TrackSnapCandidate,
  objects: CanvasObject[] = [],
): TrackAction[] {
  return [
    {
      type: 'pointer-move', world, shift: false, ctrl: false,
      candidates: [candidate, { type: 'free', point: world, label: 'Free position' }],
    },
    { type: 'click', world, objects, hitObjectId: candidate.targetId ?? null },
  ];
}

beforeEach(() => __resetTrackCounter());

/* ── Drawing ─────────────────────────────────────────────────────── */

describe('draw new', () => {
  it('starts idle and takes the first click as the start point', () => {
    const s = run(createSession(), clickAt({ x: 0, y: 0 }));
    expect(s.phase).toBe('drawing');
    expect(s.anchor).toEqual({ x: 0, y: 0 });
    expect(s.segments).toHaveLength(0);
    expect(canFinish(s)).toBe(false);
  });

  it('commits one segment per click and chains from the last end', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: 0 }),
      ...clickAt({ x: 200, y: 0 }),
    ]);
    expect(s.segments).toHaveLength(2);
    expect(s.anchor).toEqual({ x: 200, y: 0 });
    expect(totalLength(s.segments)).toBeCloseTo(200);
  });

  it('ignores the near-zero second click of a double-click', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: 0 }),
      ...clickAt({ x: 100.2, y: 0 }),
    ]);
    expect(s.segments).toHaveLength(1);
  });

  it('removes the last committed segment on backspace', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: 0 }),
      ...clickAt({ x: 200, y: 0 }),
      { type: 'backspace' },
    ]);
    expect(s.segments).toHaveLength(1);
    expect(s.anchor).toEqual({ x: 100, y: 0 });
  });

  it('backspacing past the first segment returns to idle rather than dead-ending', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: 0 }),
      { type: 'backspace' },
      { type: 'backspace' },
    ]);
    expect(s.phase).toBe('idle');
    expect(s.anchor).toBeNull();
    expect(hasWorkInProgress(s)).toBe(false);
  });

  it('previews the next segment with its length and bearing', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      { type: 'pointer-move', world: { x: 100, y: 0 }, candidates: [], shift: false, ctrl: false },
    ]);
    const preview = computePreview(s)!;
    expect(preview.segmentLength).toBeCloseTo(100);
    expect(preview.bearing).toBeCloseTo(0);
  });

  it('places an exact segment from typed length and bearing', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      { type: 'commit-length-bearing', length: 250, bearing: 90 },
    ]);
    expect(s.segments).toHaveLength(1);
    // Bearing 90° is up on screen.
    expect(segEnd(s.segments[0]).x).toBeCloseTo(0);
    expect(segEnd(s.segments[0]).y).toBeCloseTo(-250);
  });

  it('constrains to 45° increments while Shift is held', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      { type: 'pointer-move', world: { x: 100, y: -90 }, candidates: [], shift: true, ctrl: false },
    ]);
    // Snapped onto the 45° diagonal: |x| === |y|.
    expect(Math.abs(s.cursor.x)).toBeCloseTo(Math.abs(s.cursor.y), 6);
  });
});

/* ── Snapping ────────────────────────────────────────────────────── */

describe('snapping', () => {
  const branch: TrackSnapCandidate = {
    type: 'turnout-branch', point: { x: 40, y: 12 },
    label: 'Turnout T-14 branch', targetId: 'to-14', targetName: 'Turnout T-14',
  };

  it('records the snapped target as a link on the start point', () => {
    const s = run(createSession(), snappedClickAt({ x: 40, y: 12 }, branch, [turnout(0, 0)]));
    expect(s.startLink).toEqual({
      snapType: 'turnout-branch',
      targetId: 'to-14',
      targetName: 'Turnout T-14',
      chainage: undefined,
    });
  });

  it('cycles alternatives with Tab instead of needing a mouse nudge', () => {
    const s0 = run(createSession(), [{
      type: 'pointer-move', world: { x: 40, y: 12 }, shift: false, ctrl: false,
      candidates: [branch, { type: 'free', point: { x: 40, y: 12 }, label: 'Free position' }],
    }]);
    expect(s0.snapIndex).toBe(0);
    const s1 = trackSessionReducer(s0, { type: 'cycle-snap' });
    expect(s1.snapIndex).toBe(1);
  });

  it('suppresses snapping while Ctrl is held', () => {
    const s = run(createSession(), [{
      type: 'pointer-move', world: { x: 40, y: 12 }, shift: false, ctrl: true,
      candidates: [{ type: 'free', point: { x: 40, y: 12 }, label: 'Snap off' }],
    }]);
    expect(s.snapSuppressed).toBe(true);
  });
});

/* ── Obstruction + curves ────────────────────────────────────────── */

describe('structure obstruction', () => {
  const objects = [platform(40, -15)];

  function upToObstruction(): TrackSession {
    return run(createSession(), [
      ...clickAt({ x: 0, y: 0 }, objects),
      ...clickAt({ x: 200, y: 0 }, objects),
    ]);
  }

  it('offers a choice rather than committing through a platform', () => {
    const s = upToObstruction();
    expect(s.phase).toBe('obstruction');
    expect(s.obstruction?.objectName).toBe('Platform 1');
    expect(s.segments).toHaveLength(0);
  });

  it('names the offending structure in the preview warning', () => {
    expect(computePreview(upToObstruction())!.warning).toBe('Crosses Platform 1');
  });

  it('Continue Straight commits the original segment', () => {
    const s = trackSessionReducer(upToObstruction(), { type: 'continue-straight' });
    expect(s.phase).toBe('drawing');
    expect(s.segments).toHaveLength(1);
    expect(segEnd(s.segments[0])).toEqual({ x: 200, y: 0 });
  });

  it('Add Curve leads to the four methods, and Escape walks back out', () => {
    const s = trackSessionReducer(upToObstruction(), { type: 'add-curve' });
    expect(s.phase).toBe('curve-method');

    const chosen = trackSessionReducer(s, { type: 'choose-curve-method', method: 'radius' });
    expect(chosen.phase).toBe('curve-input');
    // Curve by Radius is pre-filled with the last radius used (§8.4).
    expect(chosen.curveInputs.radius).toBe(chosen.lastRadius);

    // No dead ends: each cancel-phase steps back one level, keeping the track.
    expect(trackSessionReducer(chosen, { type: 'cancel-phase' }).phase).toBe('curve-method');
    expect(run(chosen, [{ type: 'cancel-phase' }, { type: 'cancel-phase' }]).phase).toBe('obstruction');
    expect(run(chosen, [{ type: 'cancel-phase' }, { type: 'cancel-phase' }, { type: 'cancel-phase' }]).phase)
      .toBe('drawing');
  });

  it('commits an arc and remembers the radius for next time', () => {
    const s = run(upToObstruction(), [
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 300 },
      { type: 'commit-curve' },
    ]);
    expect(s.phase).toBe('drawing');
    expect(s.segments.some(seg => seg.kind === 'arc')).toBe(true);
    expect(s.lastRadius).toBe(300);
    expect(s.obstruction).toBeNull();
  });

  it('swings clear of the structure when the clicked point is straight ahead through it', () => {
    // The click at (200,0) is on the current bearing, so there is nothing to
    // curve *toward* — the arc must instead deviate around the platform.
    const s = run(upToObstruction(), [
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 300 },
    ]);
    const solved = computePreview(s)!;
    expect(solved.segments).toHaveLength(1);
    expect(solved.segments[0].kind).toBe('arc');
    // A real turn, not a sub-degree nudge.
    expect(solved.segmentLength).toBeGreaterThan(10);

    const committed = trackSessionReducer(s, { type: 'commit-curve' });
    const arc = committed.segments[0];
    expect(arc.kind).toBe('arc');
    if (arc.kind === 'arc') {
      expect(arc.radius).toBe(300);
      // Deviates far enough to pass the platform (which spans y −15…15).
      const deviation = Math.abs(segEnd(arc).y);
      expect(deviation).toBeGreaterThan(15);
    }
  });

  it('still curves toward the clicked point when that point is off the bearing', () => {
    // A chain already running along +X, then a click up and to the right that
    // clips a structure: a genuine corner, so the arc aims at the clicked point
    // and a straight completes the run to it.
    const offBearing = [platform(140, -100, 40, 40)];
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }, offBearing),
      ...clickAt({ x: 100, y: 0 }, offBearing),
      ...clickAt({ x: 300, y: -200 }, offBearing),
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 100 },
      { type: 'commit-curve' },
    ]);
    expect(s.segments.map(x => x.kind)).toEqual(['line', 'arc', 'line']);
    const last = s.segments[s.segments.length - 1];
    expect(segEnd(last).x).toBeCloseTo(300, 4);
    expect(segEnd(last).y).toBeCloseTo(-200, 4);
  });

  it('has no curve to offer toward a target that is straight ahead in open space', () => {
    // With an empty chain the bearing IS the direction to the clicked point, so
    // "curve toward it" is degenerate. Without a structure to clear there is no
    // solution, and the UI says so rather than committing a no-op arc.
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      { type: 'pointer-move', world: { x: 400, y: 0 }, candidates: [], shift: false, ctrl: false },
    ]);
    const forced: TrackSession = {
      ...s, phase: 'curve-input', curveMethod: 'radius',
      pendingTarget: { x: 400, y: 0 },
      curveInputs: { radius: 300, midPoint: null, matchedRadius: null, matchedFrom: null },
    };
    expect(computePreview(forced)).toBeNull();
  });

  it('previews a below-minimum radius with a warning but still allows the commit', () => {
    const s = run(upToObstruction(), [
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 40 },
    ]);
    const preview = computePreview(s)!;
    expect(preview.warning).toMatch(/below the .* minimum/);

    const committed = trackSessionReducer(s, { type: 'commit-curve' });
    expect(committed.phase).toBe('drawing');
    expect(committed.segments.some(seg => seg.kind === 'arc')).toBe(true);
  });
});

/* ── The Escape ladder (§8.1 "no dead ends") ─────────────────────── */

describe('escape ladder', () => {
  it('reports a sub-flow to back out of only where one exists', () => {
    const objects = [platform(40, -15)];
    const atObstruction = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }, objects),
      ...clickAt({ x: 200, y: 0 }, objects),
    ]);
    expect(canCancelPhase(atObstruction)).toBe(true);
    expect(canCancelPhase(trackSessionReducer(atObstruction, { type: 'add-curve' }))).toBe(true);

    // Phases with nothing to back out of must NOT claim Escape, otherwise the
    // key is swallowed and the user is stranded in the tool.
    expect(canCancelPhase(createSession())).toBe(false);
    expect(canCancelPhase(run(createSession(), clickAt({ x: 0, y: 0 })))).toBe(false);
    expect(canCancelPhase(createSession({ ...DEFAULT_TRACK_SETTINGS, mode: 'match-existing' }))).toBe(false);
    expect(canCancelPhase(createSession({ ...DEFAULT_TRACK_SETTINGS, mode: 'parallel' }))).toBe(false);
  });

  it('leaves a freshly reset follow-mode session escapable out of the tool', () => {
    // The state after finishing a track in a follow mode: phase is
    // reference-pick with nothing in progress, so Escape must fall through to
    // "leave the tool" rather than being consumed by cancel-phase or cancel.
    const s = trackSessionReducer(
      createSession({ ...DEFAULT_TRACK_SETTINGS, mode: 'match-existing' }),
      { type: 'reset' },
    );
    expect(canCancelPhase(s)).toBe(false);
    expect(hasWorkInProgress(s)).toBe(false);
  });
});

/* ── Follow modes ────────────────────────────────────────────────── */

describe('parallel / match existing', () => {
  const settings: TrackToolSettings = { ...DEFAULT_TRACK_SETTINGS, mode: 'match-existing' };

  const reference = createTrackAsset({
    segments: [
      { kind: 'line', start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
      { kind: 'arc', center: { x: 100, y: -50 }, radius: 50, startAngle: 270, endAngle: 0, ccw: true },
    ],
    settings: DEFAULT_TRACK_SETTINGS,
    layerId: 'tracks',
    name: 'Main Line',
  });

  it('starts by asking for the reference track', () => {
    expect(createSession(settings).phase).toBe('reference-pick');
  });

  it('picking a reference moves to the portion choice, then the offset', () => {
    const picked = run(createSession(settings), clickAt({ x: 50, y: -10 }, [reference], reference.id));
    expect(picked.phase).toBe('reference-portion');
    expect(picked.reference?.trackName).toBe('Main Line');
    // Side follows the cursor: above a left-to-right track is "left".
    expect(picked.offsetSide).toBe('left');
  });

  it('parallel mode skips the portion choice and uses the whole length', () => {
    const parallel = run(
      createSession({ ...DEFAULT_TRACK_SETTINGS, mode: 'parallel' }),
      clickAt({ x: 50, y: -10 }, [reference], reference.id),
    );
    expect(parallel.phase).toBe('reference-offset');
    expect(parallel.reference?.portion).toBe('entire');
  });

  it('derives a concentric alignment at the requested offset', () => {
    const s = run(createSession(settings), [
      ...clickAt({ x: 50, y: -10 }, [reference], reference.id),
      { type: 'set-portion', portion: 'entire' },
      { type: 'set-offset', distance: 4.5 },
      { type: 'set-offset-side', side: 'left' },
      { type: 'confirm-reference' },
    ]);
    expect(s.phase).toBe('drawing');

    const arc = s.segments.find(seg => seg.kind === 'arc');
    expect(arc).toBeDefined();
    if (arc?.kind === 'arc') {
      // Same centre as the reference arc, radius tightened by the offset.
      expect(arc.center.x).toBeCloseTo(reference.x + 100);
      expect(arc.radius).toBeCloseTo(45.5);
    }
    expect(s.recentOffsets[0]).toBe(4.5);
  });

  it('trims to a chainage range when asked for one', () => {
    const s = run(createSession(settings), [
      ...clickAt({ x: 50, y: -10 }, [reference], reference.id),
      { type: 'set-portion', portion: 'between-chainages' },
      { type: 'set-chainages', from: 20, to: 60 },
    ]);
    expect(totalLength(s.reference!.portionAlignment)).toBeCloseTo(40);
  });

  it('follows only the selected curve when asked', () => {
    const s = run(createSession(settings), [
      ...clickAt({ x: 145, y: -45 }, [reference], reference.id),
      { type: 'set-portion', portion: 'selected-curve' },
    ]);
    expect(s.reference!.portionAlignment).toHaveLength(1);
    expect(s.reference!.portionAlignment[0].kind).toBe('arc');
  });
});

/* ── The finished asset ──────────────────────────────────────────── */

describe('finished asset (acceptance §7)', () => {
  it('a 5-click track with two curves is exactly one Track asset', () => {
    const platformA = platform(140, -20, 40, 40);
    let objects: CanvasObject[] = [platformA];

    // Clicks 1–3: start, a straight, then a click that runs into platform A.
    let s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }, objects),
      ...clickAt({ x: 100, y: 0 }, objects),
      ...clickAt({ x: 250, y: 0 }, objects),
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 200 },
      { type: 'commit-curve' },
    ]);
    expect(s.segments.filter(seg => seg.kind === 'arc')).toHaveLength(1);

    // Put a second structure straight ahead on the chain's *new* bearing, so
    // click 4 hits it the same way a draughtsman's would.
    const anchor = s.anchor!;
    const dir = pathEndTangent(s.segments)!;
    const ahead = { x: anchor.x + dir.x * 160, y: anchor.y + dir.y * 160 };
    const platformB: RectangleObject = {
      ...platform(ahead.x - 25, ahead.y - 25, 50, 50), id: 'plat-2', name: 'Platform 2',
    };
    objects = [platformA, platformB];

    // Click 4 → second obstruction → second curve.
    s = run(s, [
      ...clickAt({ x: anchor.x + dir.x * 320, y: anchor.y + dir.y * 320 }, objects),
      { type: 'add-curve' },
      { type: 'choose-curve-method', method: 'radius' },
      { type: 'set-curve-radius', radius: 250 },
      { type: 'commit-curve' },
    ]);
    expect(s.segments.filter(seg => seg.kind === 'arc')).toHaveLength(2);

    // Click 5 → a final straight.
    const anchor2 = s.anchor!;
    const dir2 = pathEndTangent(s.segments)!;
    s = run(s, clickAt({ x: anchor2.x + dir2.x * 120, y: anchor2.y + dir2.y * 120 }, objects));

    expect(s.segments.length).toBeGreaterThan(2);

    const asset = createTrackAsset({
      segments: s.segments, settings: s.settings, layerId: 'tracks',
      startLink: s.startLink, endLink: s.endLink,
    });

    // ONE asset, whatever the internal segment count.
    expect(asset.type).toBe('track');
    expect(asset.id).toBeTruthy();
    expect(asset.geometry.length).toBe(s.segments.length);
  });

  it('stores geometry relative to the anchor so a plain x/y move works', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 500, y: 300 }),
      ...clickAt({ x: 600, y: 300 }),
    ]);
    const asset = createTrackAsset({ segments: s.segments, settings: s.settings, layerId: 'tracks' });

    expect(asset.x).toBeCloseTo(500);
    expect(asset.y).toBeCloseTo(300);
    expect(segStart(asset.geometry[0])).toEqual({ x: 0, y: 0 });

    // Moving = patching x/y, exactly what selectTool does for every object.
    const moved = { ...asset, x: asset.x + 40, y: asset.y - 10 };
    expect(segStart(trackWorldSegments(moved)[0])).toEqual({ x: 540, y: 290 });
    expect(totalLength(moved.geometry)).toBeCloseTo(totalLength(asset.geometry));
  });

  it('reports the linked turnout in the asset properties', () => {
    const branch: TrackSnapCandidate = {
      type: 'turnout-branch', point: { x: 40, y: 12 },
      label: 'Turnout T-14 branch', targetId: 'to-14', targetName: 'Turnout T-14',
    };
    const s = run(createSession(), [
      ...snappedClickAt({ x: 40, y: 12 }, branch, [turnout(0, 0)]),
      ...clickAt({ x: 300, y: 12 }),
    ]);
    const asset = createTrackAsset({
      segments: s.segments, settings: s.settings, layerId: 'tracks',
      startLink: s.startLink, endLink: s.endLink,
    });
    expect(asset.track.startLink?.targetName).toBe('Turnout T-14');
    expect(asset.track.startLocation).toBe('Turnout T-14');
    expect(asset.track.derivedFields).toContain('startLocation');
  });

  it('derives Display Name from Track Name and marks it derived', () => {
    const s = run(createSession(), [...clickAt({ x: 0, y: 0 }), ...clickAt({ x: 100, y: 0 })]);
    const asset = createTrackAsset({ segments: s.segments, settings: s.settings, layerId: 'tracks' });
    expect(asset.track.displayName).toBe(asset.track.trackName);
    expect(asset.track.derivedFields).toContain('displayName');
  });

  it('keeps the bbox in step with the alignment', () => {
    const s = run(createSession(), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: -60 }),
    ]);
    const asset = createTrackAsset({ segments: s.segments, settings: s.settings, layerId: 'tracks' });
    expect(asset.width).toBeCloseTo(100);
    expect(asset.height).toBeCloseTo(60);
  });
});

/* ── Validation ──────────────────────────────────────────────────── */

describe('validation on finish', () => {
  function twoPointTrack(overrides: Partial<Parameters<typeof createTrackAsset>[0]> = {}) {
    return createTrackAsset({
      segments: [{ kind: 'line', start: { x: 0, y: 0 }, end: { x: 300, y: 0 } }],
      settings: DEFAULT_TRACK_SETTINGS,
      layerId: 'tracks',
      ...overrides,
    });
  }

  it('flags both unsnapped endpoints', () => {
    const issues = validateTrack(twoPointTrack());
    expect(issues.filter(i => i.ruleId === 'track-unsnapped-end')).toHaveLength(2);
  });

  it('does not flag an end that was snapped', () => {
    const issues = validateTrack(twoPointTrack({
      startLink: { snapType: 'track-end', targetId: 'x', targetName: 'Loop Line end' },
    }));
    expect(issues.filter(i => i.ruleId === 'track-unsnapped-end')).toHaveLength(1);
  });

  it('flags a curve below the minimum radius as critical', () => {
    const asset = createTrackAsset({
      segments: [{
        kind: 'arc', center: { x: 0, y: 0 }, radius: 40,
        startAngle: 0, endAngle: 90, ccw: true,
      }],
      settings: DEFAULT_TRACK_SETTINGS,
      layerId: 'tracks',
    });
    const issue = validateTrack(asset).find(i => i.ruleId === 'track-min-curve-radius');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('V1');
    expect(issue!.measured).toBe(40);
  });

  it('flags a missing mandatory property', () => {
    const asset = twoPointTrack();
    const blank = { ...asset, track: { ...asset.track, trackName: '' } };
    const issue = validateTrack(blank).find(i => i.ruleId === 'track-missing-property');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('V1');
  });

  it('anchors every issue to the asset so the panel can zoom to it', () => {
    for (const issue of validateTrack(twoPointTrack())) {
      expect(issue.assetId).toBeTruthy();
      expect(typeof issue.canvasX).toBe('number');
      expect(typeof issue.canvasY).toBe('number');
    }
  });

  it('passes a fully specified, snapped track', () => {
    const asset = twoPointTrack({
      startLink: { snapType: 'track-end', targetId: 'a', targetName: 'A' },
      endLink: { snapType: 'srj', targetId: 'b', targetName: 'B' },
    });
    expect(validateTrack(asset)).toHaveLength(0);
  });
});

/* ── Settings behaviour ──────────────────────────────────────────── */

describe('toolbar settings mid-draw (§8.2)', () => {
  it('never rewrites geometry that is already committed', () => {
    const drawn = run(createSession(), [...clickAt({ x: 0, y: 0 }), ...clickAt({ x: 100, y: 0 })]);
    const before = JSON.stringify(drawn.segments);

    const changed = trackSessionReducer(drawn, {
      type: 'set-settings',
      settings: { workStatus: 'Future', trackType: 'Siding' },
    });
    expect(JSON.stringify(changed.segments)).toBe(before);
    expect(changed.settings.workStatus).toBe('Future');
  });

  it('switching drawing mode mid-draw keeps the track and applies to the next one', () => {
    const drawn = run(createSession(), [...clickAt({ x: 0, y: 0 }), ...clickAt({ x: 100, y: 0 })]);
    const changed = trackSessionReducer(drawn, { type: 'set-settings', settings: { mode: 'parallel' } });
    expect(changed.segments).toHaveLength(1);
    expect(changed.phase).toBe('drawing');
    expect(changed.settings.mode).toBe('parallel');
  });

  it('switching mode with nothing drawn restarts the flow cleanly', () => {
    const changed = trackSessionReducer(createSession(), {
      type: 'set-settings', settings: { mode: 'match-existing' },
    });
    expect(changed.phase).toBe('reference-pick');
  });

  it('keeps the sticky settings and last radius across a reset', () => {
    const s = run(createSession({ ...DEFAULT_TRACK_SETTINGS, trackType: 'Siding' }), [
      ...clickAt({ x: 0, y: 0 }),
      ...clickAt({ x: 100, y: 0 }),
      { type: 'reset' },
    ]);
    expect(s.settings.trackType).toBe('Siding');
    expect(s.segments).toHaveLength(0);
    expect(hasWorkInProgress(s)).toBe(false);
  });

  it('restores an autosaved partial alignment ready to continue', () => {
    const segments = [{ kind: 'line' as const, start: { x: 0, y: 0 }, end: { x: 80, y: 0 } }];
    const s = trackSessionReducer(createSession(), {
      type: 'restore-draft', segments, settings: DEFAULT_TRACK_SETTINGS,
    });
    expect(s.phase).toBe('drawing');
    expect(s.restored).toBe(true);
    expect(dist(s.anchor!, { x: 80, y: 0 })).toBeCloseTo(0);
  });
});
