/**
 * trackStyles.ts — work status → Styles-layer entry.
 *
 * Requirements §1: "Work Status drives rendering (Existing = solid, Proposed =
 * distinct colour, Future = dashed) through the Styles layer — never hard-coded
 * per element." So a TrackObject stores a `styleId`, and the renderer resolves
 * it against the editor's `styles` list at paint time. Editing the style in the
 * Styles panel restyles every track that uses it.
 *
 * The fallbacks below are only used if a style has been deleted from the list —
 * they keep a track visible rather than letting it disappear.
 *
 * Pure: no React, no store (the EditorStyle type is imported as a type only).
 */

import type { EditorStyle } from '../../store/editorStore';
import type { TrackWorkStatus } from '../../types/track';
import type { StrokeStyle } from '../../types/scene';

/** Stroke width for track centre lines, in world units. */
export const TRACK_STROKE_WIDTH = 2;

/** Work status → the id of the shape style that renders it. */
const STYLE_BY_STATUS: Record<TrackWorkStatus, string> = {
  Existing: 'existing-line',
  Proposed: 'proposed-work',
  Future: 'future-work',
};

export function workStatusStyleId(status: TrackWorkStatus): string {
  return STYLE_BY_STATUS[status] ?? 'existing-line';
}

export interface ResolvedTrackStyle {
  color: string;
  strokeStyle: StrokeStyle;
  /** Style display name, for the properties panel. */
  name: string;
}

/** Last-resort appearance per status, matching the seeded Styles entries. */
const FALLBACK: Record<TrackWorkStatus, ResolvedTrackStyle> = {
  Existing: { color: '#111827', strokeStyle: 'solid',  name: 'Existing Line' },
  Proposed: { color: '#ef4444', strokeStyle: 'solid',  name: 'Proposed Work' },
  Future:   { color: '#3b82f6', strokeStyle: 'dashed', name: 'Future Work' },
};

/**
 * Resolve a track's appearance from the editor's Styles list, falling back to
 * the seeded values when the style has been removed.
 */
export function resolveTrackStyle(
  styleId: string,
  status: TrackWorkStatus,
  styles: readonly EditorStyle[],
): ResolvedTrackStyle {
  const style = styles.find(s => s.id === styleId);
  const fallback = FALLBACK[status] ?? FALLBACK.Existing;
  if (!style) return fallback;
  return {
    color: style.color ?? fallback.color,
    strokeStyle: style.strokeStyle ?? fallback.strokeStyle,
    name: style.name,
  };
}

/** SVG `stroke-dasharray` for a stroke style at a given width. */
export function dashArrayFor(strokeStyle: StrokeStyle, width: number): string | undefined {
  if (strokeStyle === 'dashed') return `${width * 4} ${width * 2.5}`;
  if (strokeStyle === 'dotted') return `${width} ${width * 1.8}`;
  return undefined;
}

/** Direction arrow marker glyph — direction is shown as arrow **and** text
 *  (§8.8: never encode meaning in colour or shape alone). */
export function directionGlyph(direction: string): string {
  if (direction === 'UP') return '▶';
  if (direction === 'DN') return '◀';
  return '◀▶';
}
