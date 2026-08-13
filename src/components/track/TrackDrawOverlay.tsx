/**
 * TrackDrawOverlay.tsx — everything the draughtsman sees while the Track tool
 * is active: ghost preview, snap feedback, the obstruction choice, the curve
 * methods, the dynamic numeric input, the reference-following flow and the
 * keyboard hint strip.
 *
 * It renders in screen space over the canvas and composes the shared
 * drawing-interaction components (components/drawing) — no Track-specific
 * overlay widgets are invented here, so the Turnout / SRJ / Platform tools can
 * reuse the same parts.
 *
 * **No modal dialog appears at any point between tool activation and finished
 * track** (§8.9) — every decision is an inline chip row or a floating input.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useEditor } from '../../store/editorStore';
import { useTrackDraw, loadTrackDraft, clearTrackDraft } from '../../store/trackDrawStore';
import { useTrackFinish } from './useTrackFinish';
import {
  CursorBadge, SnapMarker, SnapGlyphIcon, SnapGlyph, InlineChoiceChips, ChoiceChip,
  DynamicInput, GhostPath, HighlightRect, HintStrip, KeyHint,
} from '../drawing';
import { segmentsToPathDWith } from '../../lib/track/geometry';
import { referenceAlignment, boundsOf, displayNameOf } from '../../lib/track/sceneQueries';
import { solveCurve } from '../../lib/track/session';
import { CURVE_METHODS, REF_PORTIONS, MIN_CURVE_RADIUS, CurveMethod, TrackRefPortion } from '../../types/track';
import type { Vec2 } from '../../types/scene';

/* ── Snap presentation ───────────────────────────────────────────── */

const SNAP_GLYPHS: Record<string, SnapGlyph> = {
  'track-end': 'square',
  'turnout-branch': 'triangle',
  srj: 'diamond',
  chainage: 'cross',
  free: 'dot',
};

const SNAP_COLORS: Record<string, string> = {
  'track-end': '#1d4ed8',
  'turnout-branch': '#b45309',
  srj: '#7c3aed',
  chainage: '#be185d',
  free: '#6b7280',
};

/* ── Curve method mini-diagrams (one line each, §8.4) ─────────────── */

const CurveDiagram: React.FC<{ method: CurveMethod }> = ({ method }) => {
  const s = { stroke: '#6b7280', strokeWidth: 1.4, fill: 'none' as const, strokeLinecap: 'round' as const };
  return (
    <svg width={30} height={20} viewBox="0 0 30 20" aria-hidden="true">
      {method === 'radius' && (
        <>
          <path d="M2 16 H12 A8 8 0 0 1 20 8 V3" {...s} />
          <line x1={20} y1={8} x2={26} y2={8} {...s} strokeDasharray="2 2" />
        </>
      )}
      {method === 'between-tangents' && (
        <>
          <path d="M2 17 L13 6" {...s} strokeDasharray="2 2" />
          <path d="M13 6 L28 6" {...s} strokeDasharray="2 2" />
          <path d="M7 12 A9 9 0 0 1 18 6" {...s} />
        </>
      )}
      {method === 'three-point' && (
        <>
          <path d="M3 15 A12 12 0 0 1 27 15" {...s} />
          <circle cx={3} cy={15} r={1.6} fill="#6b7280" />
          <circle cx={15} cy={4} r={1.6} fill="#6b7280" />
          <circle cx={27} cy={15} r={1.6} fill="#6b7280" />
        </>
      )}
      {method === 'match-existing' && (
        <>
          <path d="M2 15 A11 11 0 0 1 24 15" {...s} strokeDasharray="2 2" />
          <path d="M6 18 A11 11 0 0 1 28 18" {...s} />
        </>
      )}
    </svg>
  );
};

/* ── Component ───────────────────────────────────────────────────── */

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

const TrackDrawOverlay: React.FC = () => {
  const { viewport, objects, hoveredObjectId } = useEditor();
  const track = useTrackDraw();
  const finishTrack = useTrackFinish();
  const { session, preview, snap, toast, showToast } = track;

  const [chipIndex, setChipIndex] = useState(0);
  const [inputText, setInputText] = useState<Record<string, string>>({});
  const [activeField, setActiveField] = useState('');
  const [draftOffer, setDraftOffer] = useState(() => loadTrackDraft());

  /* ── World → screen ── */
  const toScreen = useCallback(
    (p: Vec2): Vec2 => ({ x: p.x * viewport.zoom + viewport.panX, y: p.y * viewport.zoom + viewport.panY }),
    [viewport],
  );
  const scaleLen = useCallback((n: number) => n * viewport.zoom, [viewport.zoom]);
  const cursorScreen = toScreen(session.cursor);

  /* Measure the canvas so floating chrome flips before it runs off the edge.
     A zero-size probe avoids reaching into Canvas for a ref. */
  const probeRef = useRef<HTMLSpanElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const parent = probeRef.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const r = parent.getBoundingClientRect();
      setCanvasSize({ width: r.width, height: r.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  /** True when a panel anchored right of / below the cursor would be clipped. */
  const flip = canvasSize.width > 0 && cursorScreen.x > canvasSize.width - 360;
  const flipY = canvasSize.height > 0 && cursorScreen.y > canvasSize.height - 300;

  /* Reset the chip cursor whenever the phase changes. */
  useEffect(() => { setChipIndex(0); }, [session.phase, session.curveMethod]);

  /* Seed the numeric input when a phase that uses one opens. */
  useEffect(() => {
    if (session.phase === 'curve-input') {
      setInputText({ radius: session.curveInputs.radius != null ? String(session.curveInputs.radius) : '' });
      setActiveField('radius');
    } else if (session.phase === 'reference-offset') {
      setInputText({ offset: String(session.offsetDistance) });
      setActiveField('offset');
    }
  // Only re-seed when the phase itself changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase]);

  const finishRef = useRef(finishTrack);
  finishRef.current = finishTrack;

  /* ── Keyboard: the fast path (§8.1) ── */
  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };

    const onKey = (e: KeyboardEvent) => {
      const s = session;

      /* Inline chip rows are answerable from the keyboard. */
      const chips = chipsForPhase(s.phase);
      if (chips.length && !isTyping(e.target)) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault(); setChipIndex(i => (i + 1) % chips.length); return;
        }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault(); setChipIndex(i => (i - 1 + chips.length) % chips.length); return;
        }
        if (e.key === 'Enter') {
          e.preventDefault(); chooseChip(chips[chipIndex].id); return;
        }
        const byHotkey = chips.find(c => c.hotkey?.toLowerCase() === e.key.toLowerCase());
        if (byHotkey) { e.preventDefault(); chooseChip(byHotkey.id); return; }
      }

      if (isTyping(e.target)) return;

      /* Enter — finish the asset. */
      if (e.key === 'Enter') {
        e.preventDefault();
        if (s.phase === 'reference-offset') { track.confirmReference(); return; }
        if (track.canFinish) finishRef.current();
        return;
      }

      /* Backspace — remove the last committed segment. */
      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (!track.hasWorkInProgress) return;
        e.preventDefault();
        track.backspace();
        showToast('Removed last segment');
        return;
      }

      /* Ctrl/Cmd+Z while drawing steps back through the session, not the scene. */
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && track.hasWorkInProgress) {
        e.preventDefault();
        track.backspace();
        showToast('Undid last segment');
        return;
      }

      /* Tab — cycle snap alternatives, or open the numeric input mid-draw. */
      if (e.key === 'Tab') {
        e.preventDefault();
        if (s.phase === 'drawing' && s.anchor) {
          setActiveField('length');
          setInputText({
            length: preview ? preview.segmentLength.toFixed(2) : '',
            bearing: preview ? preview.bearing.toFixed(1) : '0',
          });
          return;
        }
        track.cycleSnap();
        return;
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  // `session` and `preview` are read fresh on every render of this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, preview, chipIndex, track, showToast]);

  /* ── Chip definitions per phase ── */
  function chipsForPhase(phase: string): ChoiceChip[] {
    if (phase === 'obstruction') {
      return [
        { id: 'continue', label: 'Continue Straight', hotkey: 'S' },
        { id: 'curve', label: 'Add Curve', hotkey: 'C' },
      ];
    }
    if (phase === 'curve-method') {
      return CURVE_METHODS.map((m, i) => ({
        id: m.id,
        label: m.label,
        hint: m.hint,
        hotkey: String(i + 1),
        diagram: <CurveDiagram method={m.id} />,
      }));
    }
    if (phase === 'reference-portion') {
      return REF_PORTIONS.map((p, i) => ({ id: p.id, label: p.label, hotkey: String(i + 1) }));
    }
    return [];
  }

  const chooseChip = useCallback((id: string) => {
    const phase = session.phase;
    if (phase === 'obstruction') {
      if (id === 'continue') track.continueStraight();
      else track.addCurve();
      return;
    }
    if (phase === 'curve-method') {
      track.chooseCurveMethod(id as CurveMethod);
      return;
    }
    if (phase === 'reference-portion') {
      track.setPortion(id as TrackRefPortion);
    }
  }, [session.phase, track]);

  /* ── Ghost geometry ── */
  const ghostD = useMemo(
    () => (preview ? segmentsToPathDWith(preview.segments, toScreen, scaleLen) : ''),
    [preview, toScreen, scaleLen],
  );

  const committedD = useMemo(
    () => (session.segments.length ? segmentsToPathDWith(session.segments, toScreen, scaleLen) : ''),
    [session.segments, toScreen, scaleLen],
  );

  /* ── Reference hover highlight (§8.5) ── */
  const hoveredReference = useMemo(() => {
    if (session.phase !== 'reference-pick' || !hoveredObjectId) return null;
    const obj = objects.find(o => o.id === hoveredObjectId);
    if (!obj) return null;
    const alignment = referenceAlignment(obj);
    if (!alignment?.length) return null;
    return { obj, alignment };
  }, [session.phase, hoveredObjectId, objects]);

  const referenceGhostD = useMemo(() => {
    if (hoveredReference) return segmentsToPathDWith(hoveredReference.alignment, toScreen, scaleLen);
    if (session.reference) return segmentsToPathDWith(session.reference.portionAlignment, toScreen, scaleLen);
    return '';
  }, [hoveredReference, session.reference, toScreen, scaleLen]);

  /* ── Preview labels ── */
  const labels = useMemo(() => {
    if (!preview || !preview.segments.length) return [];
    const first = preview.segments[0];
    const start = first.kind === 'line' ? first.start : first.center;
    const mid = toScreen({
      x: (start.x + session.cursor.x) / 2,
      y: (start.y + session.cursor.y) / 2,
    });
    const out = [{
      x: mid.x, y: mid.y - 16,
      text: `${preview.segmentLength.toFixed(1)} m · ${preview.bearing.toFixed(1)}°`,
      tone: preview.warning ? ('warn' as const) : ('default' as const),
    }];
    if (session.segments.length) {
      out.push({ x: mid.x, y: mid.y + 14, text: `Σ ${preview.totalLength.toFixed(1)} m`, tone: 'default' as const });
    }
    return out;
  }, [preview, session.cursor, session.segments.length, toScreen]);

  /* ── Curve solution, for radius/arc labels ── */
  const curve = useMemo(
    () => (session.phase === 'curve-input' ? solveCurve(session) : null),
    [session],
  );

  const chips = chipsForPhase(session.phase);
  const modeLabel = `Track — ${labelForMode(session.settings.mode)} · ${session.settings.trackType} · ${session.settings.workStatus} · ${session.settings.direction}`;

  /* A floating panel below the cursor would sit on top of the mode badge, so
     the badge moves above the cursor while one is open. */
  const panelBelowCursor =
    chips.length > 0 ||
    session.phase === 'curve-input' ||
    session.phase === 'reference-offset' ||
    (session.phase === 'drawing' && activeField === 'length');
  const badgeY = panelBelowCursor ? cursorScreen.y - 62 : cursorScreen.y;

  const snapGlyph: SnapGlyph = SNAP_GLYPHS[snap?.type ?? 'free'] ?? 'dot';
  const snapColor = SNAP_COLORS[snap?.type ?? 'free'] ?? '#6b7280';

  /* ── Render ── */
  return (
    <>
      {/* Zero-size probe used to measure the canvas (see `flip` above). */}
      <span ref={probeRef} style={{ display: 'none' }} />

      {/* Committed part of the in-progress alignment (solid ghost). */}
      {committedD && <GhostPath d={committedD} dashed={false} width={2.5} />}

      {/* Reference track being followed / hovered — muted so it reads as
          context, distinct from the alignment being derived from it. */}
      {referenceGhostD && (
        <GhostPath d={referenceGhostD} dashed width={3} tone="reference" />
      )}

      {/* The next segment / curve / derived alignment. */}
      {ghostD && (
        <GhostPath
          d={ghostD}
          dashed
          width={2}
          tone={preview?.warning ? 'warn' : 'default'}
          labels={labels}
        />
      )}

      {/* Obstructing structure — highlighted, not thrown as an error. */}
      {session.obstruction && (() => {
        const r = session.obstruction.rect;
        const tl = toScreen({ x: r.x, y: r.y });
        return (
          <HighlightRect
            x={tl.x} y={tl.y}
            width={r.width * viewport.zoom} height={r.height * viewport.zoom}
            label={session.obstruction.objectName}
          />
        );
      })()}

      {/* Hovered candidate reference track. */}
      {hoveredReference && (() => {
        const b = boundsOf(hoveredReference.obj);
        const tl = toScreen({ x: b.x, y: b.y });
        return (
          <HighlightRect
            tone="default"
            x={tl.x - 4} y={tl.y - 4}
            width={b.width * viewport.zoom + 8} height={b.height * viewport.zoom + 8}
            label={`Follow ${displayNameOf(hoveredReference.obj)}`}
          />
        );
      })()}

      {/* Snap marker at the resolved point. */}
      {snap && <SnapMarker x={cursorScreen.x} y={cursorScreen.y} glyph={snapGlyph} color={snapColor} />}

      {/* Mode badge + snap label at the cursor. */}
      <CursorBadge
        x={cursorScreen.x}
        y={badgeY}
        flip={flip}
        text={modeLabel}
        tone={preview?.warning ? 'warn' : 'default'}
        sub={
          session.snapSuppressed ? 'Snap off'
            : snap ? `Snap: ${snap.label}`
            : undefined
        }
        subGlyph={
          session.snapSuppressed
            ? undefined
            : snap ? <SnapGlyphIcon glyph={snapGlyph} color={snapColor} size={11} /> : undefined
        }
      />

      {/* Inline choices — obstruction, curve methods, reference portion. */}
      {chips.length > 0 && (
        <InlineChoiceChips
          x={cursorScreen.x}
          y={cursorScreen.y}
          title={titleForPhase(session.phase, session.obstruction?.objectName)}
          chips={chips}
          activeIndex={chipIndex}
          flip={flip}
          flipY={flipY}
          layout={session.phase === 'obstruction' ? 'row' : 'list'}
          onHover={setChipIndex}
          onChoose={chooseChip}
        />
      )}

      {/* Numeric entry — radius, offset, or length/bearing mid-draw. */}
      {session.phase === 'curve-input' && needsRadius(session.curveMethod) && (
        <DynamicInput
          x={cursorScreen.x}
          y={cursorScreen.y}
          fields={[{ id: 'radius', label: 'Radius', unit: 'm', value: inputText.radius ?? '', placeholder: String(session.lastRadius) }]}
          activeFieldId={activeField || 'radius'}
          flip={flip}
          flipY={flipY}
          warning={curve?.belowMinimumRadius ? curve.message : null}
          hint={
            !curve
              ? `No curve solution for this radius · minimum ${MIN_CURVE_RADIUS} m`
              : curve.clearsObstruction
                // Say so plainly: the clicked point was straight ahead through
                // the structure, so the arc swings clear rather than aiming at it.
                ? `Arc ${curve.arc.length.toFixed(1)} m, clearing ${session.obstruction?.objectName ?? 'the structure'} · Enter to commit, then click to continue`
                : `Arc ${curve.arc.length.toFixed(1)} m · Enter to commit`
          }
          onChange={(id, v) => {
            setInputText(t => ({ ...t, [id]: v }));
            const n = parseFloat(v);
            track.setCurveRadius(isFinite(n) && n > 0 ? n : null);
          }}
          onFocusField={setActiveField}
          onCommit={() => track.commitCurve()}
          onCancel={() => track.cancelPhase()}
        />
      )}

      {session.phase === 'curve-input' && !needsRadius(session.curveMethod) && (
        <CursorBadge
          flip={flip}
          x={cursorScreen.x}
          y={cursorScreen.y + 26}
          text={
            session.curveMethod === 'three-point'
              ? (session.curveInputs.midPoint
                  ? 'Click to commit the curve'
                  : 'Click a point the curve should pass through')
              : (session.curveInputs.matchedRadius != null
                  ? `Matched R ${session.curveInputs.matchedRadius.toFixed(1)} m — click to commit`
                  : 'Click an existing curve to copy its radius')
          }
        />
      )}

      {session.phase === 'reference-offset' && (
        <DynamicInput
          x={cursorScreen.x}
          y={cursorScreen.y}
          fields={[{ id: 'offset', label: 'Offset', unit: 'm', value: inputText.offset ?? '', placeholder: '4.5' }]}
          activeFieldId={activeField || 'offset'}
          flip={flip}
          flipY={flipY}
          warning={null}
          hint={`Side: ${session.offsetSide} (move the mouse to switch) · Enter to commit`}
          onChange={(id, v) => {
            setInputText(t => ({ ...t, [id]: v }));
            const n = parseFloat(v);
            if (isFinite(n) && n >= 0) track.setOffset(n);
          }}
          onFocusField={setActiveField}
          onCommit={() => track.confirmReference()}
          onCancel={() => track.cancelPhase()}
        />
      )}

      {/* Recently-used offsets (§8.5). */}
      {session.phase === 'reference-offset' && session.recentOffsets.length > 1 && (
        <div style={{
          position: 'absolute',
          left: cursorScreen.x + 16,
          top: cursorScreen.y + 76,
          zIndex: 47,
          display: 'flex', gap: 4, alignItems: 'center',
          background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8,
          padding: '5px 7px', boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
        }}>
          <span style={{ fontFamily: FONT, fontSize: 10.5, color: '#9ca3af', fontWeight: 600 }}>Recent</span>
          {session.recentOffsets.map(v => (
            <button
              key={v}
              onClick={() => { track.setOffset(v); setInputText(t => ({ ...t, offset: String(v) })); }}
              style={{
                height: 24, padding: '0 8px', borderRadius: 5,
                border: '1px solid #e5e7eb', background: '#f9fafb',
                fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#374151',
                cursor: 'pointer',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      )}

      {/* Length / bearing typed mid-draw (§8.1). */}
      {session.phase === 'drawing' && activeField === 'length' && (
        <DynamicInput
          x={cursorScreen.x}
          y={cursorScreen.y}
          fields={[
            { id: 'length', label: 'Length', unit: 'm', value: inputText.length ?? '' },
            { id: 'bearing', label: 'Bearing', unit: '°', value: inputText.bearing ?? '' },
          ]}
          activeFieldId={activeField}
          flip={flip}
          flipY={flipY}
          warning={null}
          hint="Enter to place the segment · Esc to go back to the mouse"
          onChange={(id, v) => setInputText(t => ({ ...t, [id]: v }))}
          onFocusField={setActiveField}
          onCommit={() => {
            const length = parseFloat(inputText.length ?? '');
            const bearing = parseFloat(inputText.bearing ?? '0');
            if (isFinite(length) && length > 0) {
              track.commitLengthBearing(length, isFinite(bearing) ? bearing : 0);
            }
            setActiveField('');
          }}
          onCancel={() => setActiveField('')}
        />
      )}

      {/* Restore an autosaved partial alignment (§8.7). */}
      {draftOffer && !track.hasWorkInProgress && (
        <div style={{
          position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, display: 'flex', alignItems: 'center', gap: 10,
          background: '#ffffff', border: '1px solid #fcd34d', borderLeft: '3px solid #d97706',
          borderRadius: 8, padding: '8px 12px', boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
          fontFamily: FONT, fontSize: 12.5, color: '#111827',
        }}>
          <span>
            An unfinished track from {new Date(draftOffer.savedAt).toLocaleTimeString()} was recovered.
          </span>
          <button
            onClick={() => { track.restoreDraft(draftOffer); setDraftOffer(null); }}
            style={primaryBtn}
          >
            Restore
          </button>
          <button
            onClick={() => { clearTrackDraft(); setDraftOffer(null); }}
            style={secondaryBtn}
          >
            Discard
          </button>
        </div>
      )}

      {/* Toast naming what just happened (§8.7). */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 58, left: '50%', transform: 'translateX(-50%)',
          zIndex: 50, background: 'rgba(17,24,39,0.94)', color: '#f9fafb',
          fontFamily: FONT, fontSize: 12, fontWeight: 600,
          padding: '7px 14px', borderRadius: 7, boxShadow: '0 8px 24px rgba(15,23,42,0.22)',
          pointerEvents: 'none', whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

      {/* Keyboard hints, published while the tool is active (§8.1). */}
      <HintStrip
        note={noteForPhase(session.phase)}
        hints={hintsForPhase(session.phase, track.canFinish)}
      />
    </>
  );
};

/* ── Helpers ─────────────────────────────────────────────────────── */

const primaryBtn: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 6, border: 'none',
  background: '#2563eb', color: '#fff',
  fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

const secondaryBtn: React.CSSProperties = {
  height: 30, padding: '0 12px', borderRadius: 6,
  border: '1px solid #e5e7eb', background: '#f9fafb', color: '#374151',
  fontFamily: FONT, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

function needsRadius(method: CurveMethod | null): boolean {
  return method === 'radius' || method === 'between-tangents';
}

function labelForMode(mode: string): string {
  if (mode === 'parallel') return 'Parallel Track';
  if (mode === 'match-existing') return 'Match Existing';
  return 'Draw New';
}

function titleForPhase(phase: string, structureName?: string): string | undefined {
  if (phase === 'obstruction') return structureName ? `Crosses ${structureName}` : 'Structure in the way';
  if (phase === 'curve-method') return 'Curve method';
  if (phase === 'reference-portion') return 'Portion to follow';
  return undefined;
}

function noteForPhase(phase: string): string | undefined {
  if (phase === 'reference-pick') return 'Pick the reference track';
  if (phase === 'obstruction') return 'Structure ahead';
  if (phase === 'idle') return 'Click to set the start point';
  return undefined;
}

function hintsForPhase(phase: string, canFinish: boolean): KeyHint[] {
  const base: KeyHint[] = [
    { keys: 'Esc', action: 'Cancel' },
    { keys: 'Ctrl', action: 'Snap off' },
  ];
  if (phase === 'drawing' || phase === 'idle') {
    return [
      { keys: 'Click', action: 'Place point' },
      { keys: 'Tab', action: 'Type length / bearing' },
      { keys: 'Shift', action: 'Ortho / 45°' },
      { keys: 'Backspace', action: 'Undo segment' },
      { keys: canFinish ? 'Enter / Dbl-click' : 'Enter', action: 'Finish track' },
      ...base,
    ];
  }
  if (phase === 'obstruction' || phase === 'curve-method' || phase === 'reference-portion') {
    return [
      { keys: '← →', action: 'Choose' },
      { keys: 'Enter', action: 'Confirm' },
      ...base,
    ];
  }
  if (phase === 'curve-input') {
    return [{ keys: 'Enter', action: 'Commit curve' }, { keys: 'Tab', action: 'Next field' }, ...base];
  }
  if (phase === 'reference-offset') {
    return [
      { keys: 'Mouse', action: 'Choose side' },
      { keys: 'Enter', action: 'Commit alignment' },
      ...base,
    ];
  }
  return base;
}

export default TrackDrawOverlay;
