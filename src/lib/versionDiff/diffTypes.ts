/**
 * diffTypes.ts — Types for the SIP version-comparison feature.
 *
 * Adapted from the original Konva/SIPAsset spec to this codebase's real model:
 * assets are `CanvasObject`s (see types/scene.ts), coordinates are WORLD units
 * (the canvas converts to screen via `world · zoom + pan`), and there is no
 * separate SIPAsset shape — the diff engine reads id / type / name / geometry
 * straight off the CanvasObject union.
 */

import type { CanvasObject } from '../../types/scene';

export type ChangeType = 'added' | 'removed' | 'moved' | 'modified' | 'unchanged';

export interface AssetChange {
  changeId: string;
  changeType: ChangeType;

  /** The object in the NEWER (head) version — null when the asset was removed. */
  newObject: CanvasObject | null;
  /** The object in the OLDER (base) version — null when the asset was added. */
  oldObject: CanvasObject | null;

  /** Human-readable description of the change. */
  description: string;

  /** For 'moved': how far the asset centre moved, in world units. */
  deltaX?: number;
  deltaY?: number;

  /** Where to draw the highlight (asset centre, world coordinates). */
  canvasX: number;
  canvasY: number;
  /** Highlight box half-extents (world units) so the marker wraps the asset. */
  canvasHalfW: number;
  canvasHalfH: number;
}

export interface VersionDiffResult {
  baseVersion: string;   // e.g. "SIP v0"
  headVersion: string;   // e.g. "SIP v1"
  computedAt: string;
  changes: AssetChange[];

  /* Summary counts */
  added: number;
  removed: number;
  moved: number;
  modified: number;
  unchanged: number;
}
