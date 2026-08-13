/**
 * trackDrawStore.tsx — transient state for the Track drawing tool.
 *
 * Thin React wrapper over the pure reducer in lib/track/session.ts: this file
 * owns nothing but the dispatch, the sticky toolbar settings and the in-progress
 * autosave. All flow logic lives in the reducer so it stays testable, and the
 * finished asset goes into `editorStore` like any other CanvasObject.
 *
 * Kept separate from editorStore because a half-drawn track is not part of the
 * document — the same reason sodStore is separate.
 */

import React, {
  createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect, ReactNode,
} from 'react';
import type { CanvasObject, TrackObject, Vec2 } from '../types/scene';
import type {
  TrackToolSettings, TrackSnapCandidate, CurveMethod, TrackRefPortion, TrackOffsetSide,
} from '../types/track';
import { DEFAULT_TRACK_SETTINGS } from '../types/track';
import {
  TrackSession, TrackAction, createSession, trackSessionReducer,
  computePreview, SessionPreview, canFinish, hasWorkInProgress, canCancelPhase, currentSnap,
} from '../lib/track/session';
import { createTrackAsset } from '../lib/track/trackAsset';

/* ── Persistence (§8.2 sticky settings, §8.7 restore a partial alignment) ── */

const SETTINGS_KEY = 'esp-editor:track-tool-settings';
const DRAFT_KEY = 'esp-editor:track-draft';
/** How often the in-progress alignment is written to storage. */
const AUTOSAVE_MS = 2000;

function loadSettings(): TrackToolSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_TRACK_SETTINGS;
    return { ...DEFAULT_TRACK_SETTINGS, ...(JSON.parse(raw) as Partial<TrackToolSettings>) };
  } catch {
    return DEFAULT_TRACK_SETTINGS;
  }
}

function saveSettings(settings: TrackToolSettings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

interface TrackDraft {
  settings: TrackToolSettings;
  segments: TrackSession['segments'];
  savedAt: string;
}

export function loadTrackDraft(): TrackDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as TrackDraft;
    return draft.segments?.length ? draft : null;
  } catch {
    return null;
  }
}

export function clearTrackDraft(): void {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

/* ── Store shape ─────────────────────────────────────────────────── */

export interface TrackDrawStore {
  session: TrackSession;
  preview: SessionPreview | null;
  /** The snap the tool would use right now, or null when nothing is snapped. */
  snap: TrackSnapCandidate | null;
  canFinish: boolean;
  hasWorkInProgress: boolean;
  /** True when Escape has a sub-flow to back out of, rather than the asset or
   *  the tool itself. Lets the caller walk the Escape ladder in order. */
  canCancelPhase: boolean;

  dispatch: (action: TrackAction) => void;
  setSettings: (patch: Partial<TrackToolSettings>) => void;

  /** Pointer plumbing, called by Canvas. */
  pointerMove: (world: Vec2, candidates: TrackSnapCandidate[], shift: boolean, ctrl: boolean) => void;
  click: (world: Vec2, objects: readonly CanvasObject[], hitObjectId: string | null) => void;
  cycleSnap: () => void;
  backspace: () => void;
  /** Abort the whole asset; returns false when there was nothing to abort. */
  cancel: () => boolean;
  /** Back out of the current sub-flow without losing the track. */
  cancelPhase: () => void;

  /** Obstruction + curve flow. */
  continueStraight: () => void;
  addCurve: () => void;
  chooseCurveMethod: (method: CurveMethod) => void;
  setCurveRadius: (radius: number | null) => void;
  commitCurve: () => void;

  /** Numeric entry mid-draw. */
  commitLengthBearing: (length: number, bearing: number) => void;

  /** Reference-following flow. */
  setPortion: (portion: TrackRefPortion) => void;
  setChainages: (from: number | null, to: number | null) => void;
  setOffset: (distance: number) => void;
  setOffsetSide: (side: TrackOffsetSide) => void;
  confirmReference: () => void;

  /** Build the finished asset. Returns null when there is nothing to finish;
   *  the caller adds it to the scene and runs validation. */
  buildAsset: (layerId: string) => TrackObject | null;
  /** Reset for the next track, keeping the sticky settings. */
  reset: () => void;
  /** Restore an autosaved partial alignment. */
  restoreDraft: (draft: TrackDraft) => void;

  /** Transient status line — "Removed last segment", "Track created". */
  toast: string | null;
  showToast: (message: string) => void;
}

const TrackDrawContext = createContext<TrackDrawStore | null>(null);

/* ── Provider ────────────────────────────────────────────────────── */

export const TrackDrawProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, dispatch] = useReducer(
    trackSessionReducer,
    undefined,
    () => createSession(loadSettings()),
  );

  const sessionRef = useRef(session);
  sessionRef.current = session;

  /* Sticky toolbar settings survive a reload (§8.2 "mode is sticky"). */
  useEffect(() => { saveSettings(session.settings); }, [session.settings]);

  /* Autosave the in-progress alignment on a timer (§8.7). */
  useEffect(() => {
    const timer = window.setInterval(() => {
      const s = sessionRef.current;
      if (!s.segments.length) { clearTrackDraft(); return; }
      try {
        const draft: TrackDraft = {
          settings: s.settings,
          segments: s.segments,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch { /* quota — ignore */ }
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const preview = useMemo(() => computePreview(session), [session]);
  const snap = useMemo(() => currentSnap(session), [session]);

  /* Transient toast, auto-cleared. The timer id lives in a ref so a rapid
     second toast replaces the first instead of being cut short by it. */
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const setSettings = useCallback((patch: Partial<TrackToolSettings>) => {
    dispatch({ type: 'set-settings', settings: patch });
  }, []);

  const pointerMove = useCallback(
    (world: Vec2, candidates: TrackSnapCandidate[], shift: boolean, ctrl: boolean) => {
      dispatch({ type: 'pointer-move', world, candidates, shift, ctrl });
    }, []);

  const click = useCallback(
    (world: Vec2, objects: readonly CanvasObject[], hitObjectId: string | null) => {
      dispatch({ type: 'click', world, objects, hitObjectId });
    }, []);

  const cancel = useCallback(() => {
    const had = hasWorkInProgress(sessionRef.current);
    if (had) {
      dispatch({ type: 'reset' });
      clearTrackDraft();
    }
    return had;
  }, []);

  const buildAsset = useCallback((layerId: string): TrackObject | null => {
    const s = sessionRef.current;
    if (!canFinish(s)) return null;
    return createTrackAsset({
      segments: s.segments,
      settings: s.settings,
      layerId,
      startLink: s.startLink,
      endLink: s.endLink,
      reference: s.reference
        ? {
            trackId: s.reference.trackId,
            trackName: s.reference.trackName,
            offset: s.offsetDistance,
            side: s.offsetSide,
          }
        : null,
    });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'reset' });
    clearTrackDraft();
  }, []);

  const restoreDraft = useCallback((draft: TrackDraft) => {
    dispatch({ type: 'restore-draft', segments: draft.segments, settings: draft.settings });
  }, []);

  const value = useMemo<TrackDrawStore>(() => ({
    session,
    preview,
    snap,
    canFinish: canFinish(session),
    hasWorkInProgress: hasWorkInProgress(session),
    canCancelPhase: canCancelPhase(session),

    dispatch,
    setSettings,
    pointerMove,
    click,
    cycleSnap: () => dispatch({ type: 'cycle-snap' }),
    backspace: () => dispatch({ type: 'backspace' }),
    cancel,
    cancelPhase: () => dispatch({ type: 'cancel-phase' }),

    continueStraight: () => dispatch({ type: 'continue-straight' }),
    addCurve: () => dispatch({ type: 'add-curve' }),
    chooseCurveMethod: (method: CurveMethod) => dispatch({ type: 'choose-curve-method', method }),
    setCurveRadius: (radius: number | null) => dispatch({ type: 'set-curve-radius', radius }),
    commitCurve: () => dispatch({ type: 'commit-curve' }),

    commitLengthBearing: (length: number, bearing: number) =>
      dispatch({ type: 'commit-length-bearing', length, bearing }),

    setPortion: (portion: TrackRefPortion) => dispatch({ type: 'set-portion', portion }),
    setChainages: (from: number | null, to: number | null) => dispatch({ type: 'set-chainages', from, to }),
    setOffset: (distance: number) => dispatch({ type: 'set-offset', distance }),
    setOffsetSide: (side: TrackOffsetSide) => dispatch({ type: 'set-offset-side', side }),
    confirmReference: () => dispatch({ type: 'confirm-reference' }),

    buildAsset,
    reset,
    restoreDraft,
    toast,
    showToast,
  }), [session, preview, snap, setSettings, pointerMove, click, cancel, buildAsset, reset,
       restoreDraft, toast, showToast]);

  return <TrackDrawContext.Provider value={value}>{children}</TrackDrawContext.Provider>;
};

export const useTrackDraw = (): TrackDrawStore => {
  const ctx = useContext(TrackDrawContext);
  if (!ctx) throw new Error('useTrackDraw must be used within a TrackDrawProvider');
  return ctx;
};
