/**
 * components/drawing — the shared drawing-interaction layer.
 *
 * Requirements §8.8: "Reuse the same overlay, badge, snap and dynamic-input
 * components for every future ESP asset tool (Turnout, SRJ, Platform). Build
 * them as a shared drawing-interaction layer, not Track-specific code."
 *
 * Nothing in this file knows what a track is. Each piece takes screen
 * coordinates and plain data; the caller converts world → screen. Accessibility
 * rules that apply to all of them:
 *  - meaning is never carried by colour alone (glyph shape + text label too);
 *  - overlay text keeps WCAG AA contrast on both light and dark canvases by
 *    sitting on an opaque chip rather than directly on the drawing;
 *  - interactive targets are at least 32 px.
 */

import React, { useEffect, useRef, useState } from 'react';

/* ── Tokens ──────────────────────────────────────────────────────── */

export const OVERLAY_Z = 40;

const CHIP_SHADOW = '0 2px 10px rgba(15,23,42,0.22)';
const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';

export const drawingColors = {
  ghost: '#3b6ff0',
  ghostFill: 'rgba(59,111,240,0.08)',
  warn: '#d97706',
  warnBg: '#fffbeb',
  danger: '#dc2626',
  chipBg: '#1f2937',
  /** Geometry being followed (a reference track), not created. */
  reference: '#7c3aed',
  chipText: '#f9fafb',
  accent: '#1d4ed8',
};

/* ── CursorBadge — persistent mode label that follows the cursor ──── */

export const CursorBadge: React.FC<{
  x: number;
  y: number;
  text: string;
  tone?: 'default' | 'warn';
  /** Second line, e.g. the snap target. */
  sub?: string;
  subGlyph?: React.ReactNode;
  /** Flip to the left of the cursor so the badge never runs off the canvas. */
  flip?: boolean;
}> = ({ x, y, text, tone = 'default', sub, subGlyph, flip }) => (
  <div
    style={{
      position: 'absolute',
      ...(flip ? { right: `calc(100% - ${x - 18}px)` } : { left: x + 18 }),
      top: y + 18,
      zIndex: OVERLAY_Z + 4,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      alignItems: flip ? 'flex-end' : 'flex-start',
    }}
  >
    <span style={{
      background: tone === 'warn' ? drawingColors.warn : drawingColors.chipBg,
      color: drawingColors.chipText,
      fontFamily: FONT,
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.01em',
      padding: '3px 8px',
      borderRadius: 5,
      whiteSpace: 'nowrap',
      boxShadow: CHIP_SHADOW,
    }}>
      {text}
    </span>
    {sub && (
      <span style={{
        background: '#ffffff',
        color: '#111827',
        border: '1px solid #d1d5db',
        fontFamily: FONT,
        fontSize: 11,
        fontWeight: 600,
        padding: '3px 8px',
        borderRadius: 5,
        whiteSpace: 'nowrap',
        boxShadow: CHIP_SHADOW,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        {subGlyph}
        {sub}
      </span>
    )}
  </div>
);

/* ── SnapMarker — a distinct glyph per snap type, plus its label ──── */

export type SnapGlyph = 'square' | 'triangle' | 'diamond' | 'cross' | 'dot';

/** Glyph shapes differ per snap type so they are distinguishable without colour. */
export const SnapGlyphIcon: React.FC<{ glyph: SnapGlyph; color?: string; size?: number }> = ({
  glyph, color = drawingColors.accent, size = 12,
}) => {
  const h = size / 2;
  const common = { stroke: color, strokeWidth: 2, fill: 'none' as const };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {glyph === 'square' && <rect x={1} y={1} width={size - 2} height={size - 2} {...common} />}
      {glyph === 'triangle' && <polygon points={`${h},1 ${size - 1},${size - 1} 1,${size - 1}`} {...common} />}
      {glyph === 'diamond' && <polygon points={`${h},1 ${size - 1},${h} ${h},${size - 1} 1,${h}`} {...common} />}
      {glyph === 'cross' && (
        <g {...common} strokeLinecap="round">
          <line x1={2} y1={2} x2={size - 2} y2={size - 2} />
          <line x1={size - 2} y1={2} x2={2} y2={size - 2} />
        </g>
      )}
      {glyph === 'dot' && <circle cx={h} cy={h} r={h - 2} {...common} />}
    </svg>
  );
};

/** The marker drawn on the canvas at the snapped point. */
export const SnapMarker: React.FC<{
  x: number;
  y: number;
  glyph: SnapGlyph;
  color?: string;
}> = ({ x, y, glyph, color = drawingColors.accent }) => (
  <div style={{
    position: 'absolute',
    left: x - 8,
    top: y - 8,
    width: 16,
    height: 16,
    zIndex: OVERLAY_Z + 3,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }}>
    <SnapGlyphIcon glyph={glyph} color={color} size={16} />
  </div>
);

/* ── InlineChoiceChips — a keyboard-selectable choice at the cursor ── */

export interface ChoiceChip {
  id: string;
  label: string;
  /** Single-key accelerator shown on the chip. */
  hotkey?: string;
  hint?: string;
  /** Optional one-line diagram rendered above the label. */
  diagram?: React.ReactNode;
}

/**
 * Replaces the modal dialog that a "pick one of these" moment would normally
 * become. Rendered at the cursor, answerable by mouse, by the hotkey, or by
 * arrow keys + Enter — never blocking, and Escape always backs out.
 */
export const InlineChoiceChips: React.FC<{
  x: number;
  y: number;
  title?: string;
  chips: ChoiceChip[];
  activeIndex: number;
  layout?: 'row' | 'list';
  /** Flip to the left of the cursor near the right edge of the canvas. */
  flip?: boolean;
  /** Flip above the cursor near the bottom edge of the canvas. */
  flipY?: boolean;
  onHover: (index: number) => void;
  onChoose: (id: string) => void;
}> = ({ x, y, title, chips, activeIndex, layout = 'row', flip, flipY, onHover, onChoose }) => (
  <div
    role="group"
    aria-label={title ?? 'Choose an option'}
    style={{
      position: 'absolute',
      ...(flip ? { right: `calc(100% - ${x - 16}px)` } : { left: x + 16 }),
      ...(flipY ? { bottom: `calc(100% - ${y - 16}px)` } : { top: y + 16 }),
      zIndex: OVERLAY_Z + 6,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      boxShadow: '0 10px 32px rgba(15,23,42,0.18)',
      padding: title ? '8px 8px 8px' : 6,
      fontFamily: FONT,
      maxWidth: 320,
    }}
  >
    {title && (
      <div style={{
        fontSize: 10.5, fontWeight: 700, color: '#9ca3af',
        letterSpacing: '0.04em', textTransform: 'uppercase',
        padding: '0 4px 6px',
      }}>
        {title}
      </div>
    )}
    <div style={{ display: 'flex', flexDirection: layout === 'row' ? 'row' : 'column', gap: 4 }}>
      {chips.map((chip, i) => {
        const active = i === activeIndex;
        return (
          <button
            key={chip.id}
            onMouseEnter={() => onHover(i)}
            onClick={() => onChoose(chip.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minHeight: 32,
              padding: '6px 10px',
              borderRadius: 7,
              border: active ? `1px solid ${drawingColors.accent}` : '1px solid #e5e7eb',
              background: active ? '#eff6ff' : '#ffffff',
              color: active ? drawingColors.accent : '#111827',
              fontFamily: FONT,
              fontSize: 12.5,
              fontWeight: active ? 600 : 500,
              cursor: 'pointer',
              textAlign: 'left',
              width: layout === 'list' ? '100%' : undefined,
              outline: 'none',
            }}
          >
            {chip.diagram && <span style={{ flexShrink: 0, display: 'flex' }}>{chip.diagram}</span>}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', whiteSpace: 'nowrap' }}>{chip.label}</span>
              {chip.hint && (
                <span style={{ display: 'block', fontSize: 10.5, color: '#6b7280', fontWeight: 400 }}>
                  {chip.hint}
                </span>
              )}
            </span>
            {chip.hotkey && (
              <kbd style={{
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                fontSize: 10,
                color: '#6b7280',
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
                borderRadius: 4,
                padding: '1px 5px',
                flexShrink: 0,
              }}>
                {chip.hotkey}
              </kbd>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

/* ── DynamicInput — type an exact value near the cursor ───────────── */

export interface DynamicField {
  id: string;
  label: string;
  value: string;
  unit?: string;
  /** Live value shown greyed when the user has not typed anything. */
  placeholder?: string;
}

/**
 * The numeric fast path (§8.1: "numeric entry ranks equal to mouse entry").
 * Floats near the cursor, autofocuses the first field, `Tab` cycles fields,
 * `Enter` commits and `Escape` backs out.
 */
export const DynamicInput: React.FC<{
  x: number;
  y: number;
  fields: DynamicField[];
  activeFieldId: string;
  warning?: string | null;
  hint?: string;
  /** Flip to the left of the cursor near the right edge of the canvas. */
  flip?: boolean;
  /** Flip above the cursor near the bottom edge of the canvas. */
  flipY?: boolean;
  onChange: (id: string, value: string) => void;
  onFocusField: (id: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}> = ({ x, y, fields, activeFieldId, warning, hint, flip, flipY, onChange, onFocusField, onCommit, onCancel }) => {
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { firstRef.current?.focus(); firstRef.current?.select(); }, []);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); onCommit(); return; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    if (e.key === 'Tab' && fields.length > 1) {
      e.preventDefault();
      const i = fields.findIndex(f => f.id === activeFieldId);
      const next = (i + (e.shiftKey ? -1 : 1) + fields.length) % fields.length;
      onFocusField(fields[next].id);
    }
  };

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...(flip ? { right: `calc(100% - ${x - 16}px)` } : { left: x + 16 }),
        ...(flipY ? { bottom: `calc(100% - ${y + 16}px)` } : { top: y - 16 }),
        zIndex: OVERLAY_Z + 6,
        background: '#ffffff',
        border: `1px solid ${warning ? drawingColors.warn : '#e5e7eb'}`,
        borderRadius: 9,
        boxShadow: '0 10px 32px rgba(15,23,42,0.18)',
        padding: 8,
        fontFamily: FONT,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 190,
      }}
    >
      <div style={{ display: 'flex', gap: 6 }}>
        {fields.map((field, i) => (
          <label key={field.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#6b7280', letterSpacing: '0.03em' }}>
              {field.label}{field.unit ? ` (${field.unit})` : ''}
            </span>
            <input
              ref={i === 0 ? firstRef : undefined}
              value={field.value}
              placeholder={field.placeholder}
              onChange={e => onChange(field.id, e.target.value)}
              onFocus={() => onFocusField(field.id)}
              onKeyDown={handleKey}
              inputMode="decimal"
              style={{
                height: 32,
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: 6,
                border: field.id === activeFieldId ? `1.5px solid ${drawingColors.accent}` : '1px solid #d1d5db',
                background: '#f9fafb',
                padding: '0 8px',
                fontSize: 12.5,
                fontFamily: FONT,
                color: '#111827',
                outline: 'none',
              }}
            />
          </label>
        ))}
      </div>

      {warning && (
        <span style={{
          fontSize: 11,
          color: '#92400e',
          background: drawingColors.warnBg,
          border: `1px solid ${drawingColors.warn}`,
          borderRadius: 5,
          padding: '4px 6px',
          lineHeight: 1.4,
          display: 'flex',
          gap: 5,
        }}>
          <span aria-hidden="true">⚠</span>{warning}
        </span>
      )}

      {hint && (
        <span style={{ fontSize: 10.5, color: '#9ca3af' }}>{hint}</span>
      )}
    </div>
  );
};

/* ── GhostPath — preview geometry drawn over the real drawing ─────── */

/**
 * A ghost overlay in screen space. `d` is an SVG path already converted from
 * world coordinates by the caller, so this stays geometry-agnostic.
 */
export const GhostPath: React.FC<{
  d: string;
  /** `reference` is the muted treatment for geometry being followed rather
   *  than created, so it reads as context, not as the thing being drawn. */
  tone?: 'default' | 'warn' | 'reference';
  width?: number;
  dashed?: boolean;
  labels?: { x: number; y: number; text: string; tone?: 'default' | 'warn' }[];
}> = ({ d, tone = 'default', width = 2, dashed = true, labels = [] }) => {
  const color = tone === 'warn' ? drawingColors.warn
    : tone === 'reference' ? drawingColors.reference
    : drawingColors.ghost;
  return (
    <svg style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'visible', zIndex: OVERLAY_Z,
    }}>
      {d && (
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeDasharray={dashed ? '7 4' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={tone === 'reference' ? 0.65 : 0.9}
        />
      )}
      {labels.map((label, i) => (
        <g key={i} transform={`translate(${label.x},${label.y})`}>
          <rect
            x={-getLabelWidth(label.text) / 2} y={-10}
            width={getLabelWidth(label.text)} height={20} rx={5}
            fill={label.tone === 'warn' ? drawingColors.warn : drawingColors.accent}
            opacity={0.94}
          />
          <text
            textAnchor="middle" dominantBaseline="central" y={0}
            fontSize={11} fontWeight={700} fill="#ffffff" fontFamily={FONT}
          >
            {label.text}
          </text>
        </g>
      ))}
    </svg>
  );
};

function getLabelWidth(text: string): number {
  return Math.max(34, text.length * 6.4 + 14);
}

/* ── HighlightRect — call out an object on the canvas ─────────────── */

export const HighlightRect: React.FC<{
  x: number; y: number; width: number; height: number;
  label?: string;
  tone?: 'default' | 'warn';
}> = ({ x, y, width, height, label, tone = 'warn' }) => {
  const color = tone === 'warn' ? drawingColors.warn : drawingColors.ghost;
  return (
    <div style={{
      position: 'absolute', left: x, top: y, width, height,
      border: `2px solid ${color}`,
      background: tone === 'warn' ? 'rgba(217,119,6,0.10)' : drawingColors.ghostFill,
      borderRadius: 3,
      pointerEvents: 'none',
      zIndex: OVERLAY_Z + 1,
      boxSizing: 'border-box',
    }}>
      {label && (
        <span style={{
          position: 'absolute', left: 0, top: -22,
          background: color, color: '#fff',
          fontFamily: FONT, fontSize: 10.5, fontWeight: 700,
          padding: '2px 7px', borderRadius: 4, whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
      )}
    </div>
  );
};

/* ── HintStrip — the keyboard fast path, published while a tool runs ── */

export interface KeyHint { keys: string; action: string; }

/** Sits clear of the floating tool palette, which occupies the bottom ~115 px. */
export const HintStrip: React.FC<{ hints: KeyHint[]; note?: string }> = ({ hints, note }) => (
  <div style={{
    position: 'absolute',
    bottom: 124,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: OVERLAY_Z + 2,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 'calc(100% - 32px)',
    background: 'rgba(17,24,39,0.92)',
    borderRadius: 8,
    padding: '6px 12px',
    pointerEvents: 'none',
    boxShadow: CHIP_SHADOW,
  }}>
    {note && (
      <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: 600, color: '#fbbf24' }}>
        {note}
      </span>
    )}
    {hints.map(hint => (
      <span key={hint.keys} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <kbd style={{
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 10,
          color: '#f9fafb',
          background: 'rgba(255,255,255,0.14)',
          border: '1px solid rgba(255,255,255,0.22)',
          borderRadius: 4,
          padding: '1px 5px',
        }}>
          {hint.keys}
        </kbd>
        <span style={{ fontFamily: FONT, fontSize: 11, color: '#d1d5db' }}>{hint.action}</span>
      </span>
    ))}
  </div>
);

/* ── ProgressPip — inline progress for computations over ~200 ms ──── */

/**
 * §8.7: any computation over ~200 ms gets an inline indicator at the cursor,
 * never a blocking overlay. Mount it while work is pending; it only paints
 * after the delay so fast work stays invisible.
 */
export const ProgressPip: React.FC<{ x: number; y: number; label: string; delayMs?: number }> = ({
  x, y, label, delayMs = 200,
}) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [delayMs]);

  if (!shown) return null;
  return (
    <div style={{
      position: 'absolute', left: x + 18, top: y - 26,
      zIndex: OVERLAY_Z + 6, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 6,
      background: drawingColors.chipBg, color: drawingColors.chipText,
      fontFamily: FONT, fontSize: 11, fontWeight: 600,
      padding: '4px 9px', borderRadius: 5, boxShadow: CHIP_SHADOW,
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: '#ffffff',
        animation: 'esp-spin 0.7s linear infinite',
      }} />
      {label}
      <style>{'@keyframes esp-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
};
