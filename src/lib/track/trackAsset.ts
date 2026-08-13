/**
 * trackAsset.ts — building and reading the TrackObject asset.
 *
 * ONE drawn track = ONE asset (Requirements §2). This module owns the only
 * conversion between the asset's stored geometry (relative to its x/y anchor,
 * so generic move/copy keep working) and world coordinates. Nothing else should
 * add or subtract the anchor by hand.
 *
 * Pure: no React, no store.
 */

import type { CanvasObject, TrackObject, Vec2 } from '../../types/scene';
import type {
  TrackSegment, TrackProperties, TrackToolSettings, TrackEndLink,
  TrackOffsetSide,
} from '../../types/track';
import { REQUIRED_TRACK_FIELDS, TRACK_FIELD_LABELS } from '../../types/track';
import {
  segmentsBounds, translateSegments, totalLength, pathStart, pathEnd, segLength,
} from './geometry';
import { workStatusStyleId, TRACK_STROKE_WIDTH } from './trackStyles';

/* ── World ⇄ local ───────────────────────────────────────────────── */

/** The alignment in world coordinates. */
export function trackWorldSegments(track: TrackObject): TrackSegment[] {
  return translateSegments(track.geometry, track.x, track.y);
}

/** Start and end of the alignment in world coordinates. */
export function trackWorldEnds(track: TrackObject): { start: Vec2; end: Vec2 } | null {
  const segs = trackWorldSegments(track);
  const start = pathStart(segs);
  const end = pathEnd(segs);
  return start && end ? { start, end } : null;
}

/** Alignment length in world units (metres). */
export function trackLength(track: TrackObject): number {
  return totalLength(track.geometry);
}

/* ── Construction ────────────────────────────────────────────────── */

let trackCounter = 1;

/** Reset the auto-numbering — tests only. */
export function __resetTrackCounter(): void {
  trackCounter = 1;
}

export interface CreateTrackInput {
  /** World-space alignment. Must contain at least one segment. */
  segments: TrackSegment[];
  settings: TrackToolSettings;
  layerId: string;
  startLink?: TrackEndLink | null;
  endLink?: TrackEndLink | null;
  reference?: {
    trackId: string;
    trackName: string;
    offset: number;
    side: TrackOffsetSide;
  } | null;
  /** Name override; auto-generated from the track type when omitted. */
  name?: string;
}

/**
 * Build the single TrackObject for a finished draw. Derived values (display
 * name, chainages from snapped ends) are recorded in `derivedFields` so the
 * panel can mark them as overridable (§8.6).
 */
export function createTrackAsset(input: CreateTrackInput): TrackObject {
  const { segments, settings, layerId } = input;
  const bounds = segmentsBounds(segments);
  const local = translateSegments(segments, -bounds.minX, -bounds.minY);

  const trackName = input.name ?? `${settings.trackType} Track ${trackCounter++}`;
  const derivedFields: string[] = ['displayName'];

  const startChainage = input.startLink?.chainage ?? '';
  const endChainage = input.endLink?.chainage ?? '';
  if (startChainage) derivedFields.push('startChainage');
  if (endChainage) derivedFields.push('endChainage');

  const startLocation = input.startLink?.targetName ?? '';
  const endLocation = input.endLink?.targetName ?? '';
  if (startLocation) derivedFields.push('startLocation');
  if (endLocation) derivedFields.push('endLocation');

  const properties: TrackProperties = {
    trackName,
    displayName: trackName,
    roadNumber: '',
    trackType: settings.trackType,
    direction: settings.direction,
    workStatus: settings.workStatus,
    cal: '',
    startLocation,
    endLocation,
    startChainage,
    endChainage,
    derivedFields,
    startLink: input.startLink ?? undefined,
    endLink: input.endLink ?? undefined,
    referenceTrackId: input.reference?.trackId,
    referenceTrackName: input.reference?.trackName,
    offset: input.reference?.offset,
    offsetSide: input.reference?.side,
  };

  return {
    id: `track-${Date.now()}-${trackCounter}`,
    type: 'track',
    name: trackName,
    layerId,
    locked: false,
    visible: true,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    rotation: 0,
    scale: 100,
    geometry: local,
    track: properties,
    styleId: workStatusStyleId(settings.workStatus),
    strokeWidth: TRACK_STROKE_WIDTH,
    sod: {
      assetKind: 'Track',
      subtype: settings.trackType.toLowerCase(),
      sourceAssetId: trackName,
    },
  };
}

/**
 * Re-anchor an asset after its geometry changed, keeping the bbox in sync with
 * the alignment so selection, hit-testing and the measure engine stay correct.
 */
export function withGeometry(track: TrackObject, worldSegments: TrackSegment[]): TrackObject {
  const bounds = segmentsBounds(worldSegments);
  return {
    ...track,
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
    geometry: translateSegments(worldSegments, -bounds.minX, -bounds.minY),
  };
}

/** Apply a properties patch, keeping the object name and style id in step. */
export function withProperties(track: TrackObject, patch: Partial<TrackProperties>): TrackObject {
  const properties = { ...track.track, ...patch };
  // A field the user typed is no longer "derived".
  const touched = Object.keys(patch);
  properties.derivedFields = properties.derivedFields.filter(f => !touched.includes(f));

  return {
    ...track,
    name: properties.trackName || track.name,
    track: properties,
    styleId: workStatusStyleId(properties.workStatus),
  };
}

/* ── Completeness (§8.6) ─────────────────────────────────────────── */

/** Fields that are still blank — shown as a soft badge count, never a prompt. */
export function incompleteFields(track: TrackObject): string[] {
  return TRACK_FIELD_LABELS
    .filter(({ id }) => {
      const v = track.track[id];
      return typeof v === 'string' ? v.trim() === '' : v == null;
    })
    .map(({ label }) => label);
}

/** Mandatory fields that are missing — these become validation issues. */
export function missingRequiredFields(track: TrackObject): string[] {
  return REQUIRED_TRACK_FIELDS
    .filter(id => {
      const v = track.track[id];
      return typeof v === 'string' ? v.trim() === '' : v == null;
    })
    .map(id => TRACK_FIELD_LABELS.find(f => f.id === id)?.label ?? String(id));
}

/* ── Measure-engine registration (§6) ────────────────────────────── */

/**
 * The measurable footprint of an asset: the points a Track ↔ Track or
 * Track ↔ Structure distance can be taken from. Tracks contribute their
 * alignment; everything else contributes its bounding box.
 *
 * The distance engine consumes CanvasObjects generically (bbox based), so this
 * is what a Track adds to it — exposed as a function rather than baked into a
 * renderer so the measure tool picks tracks up automatically.
 */
export function measurablePoints(obj: CanvasObject): Vec2[] {
  if (obj.type === 'track') {
    const segs = trackWorldSegments(obj);
    const pts: Vec2[] = [];
    const start = pathStart(segs);
    const end = pathEnd(segs);
    if (start) pts.push(start);
    segs.forEach(seg => {
      if (segLength(seg) > 0) pts.push(seg.kind === 'line' ? seg.end : seg.center);
    });
    if (end) pts.push(end);
    return pts;
  }
  return [
    { x: obj.x, y: obj.y },
    { x: obj.x + obj.width, y: obj.y },
    { x: obj.x + obj.width, y: obj.y + obj.height },
    { x: obj.x, y: obj.y + obj.height },
  ];
}
