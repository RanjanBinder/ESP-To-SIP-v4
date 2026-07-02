/**
 * versionSnapshots.ts — persistence for saved SIP/drawing versions.
 *
 * A "version" is a labelled snapshot of the scene's objects, stored in
 * localStorage alongside the autosaved document (see serialize.ts). The compare
 * feature uses a saved version as the base and a freshly-uploaded DWG as the
 * head. Snapshots are plain serializable CanvasObject arrays — no store
 * dependency at runtime (the import below is `import type`, erased at build).
 */

import type { CanvasObject } from '../types/scene';

const STORAGE_KEY = 'esp-editor:versions';

export interface SavedVersion {
  id: string;
  label: string;
  createdAt: string;   // ISO
  objects: CanvasObject[];
  sourceKind?: 'canvas' | 'pdf';
  sourceFileName?: string;
  sourcePage?: number;
  isDefaultExample?: boolean;
}

export function loadVersions(): SavedVersion[] {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    return raw.filter(v => v && typeof v.id === 'string' && Array.isArray(v.objects));
  } catch {
    return [];
  }
}

export function saveVersions(versions: SavedVersion[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  } catch {
    /* quota or disabled storage — ignore */
  }
}

export function makeVersion(label: string, objects: CanvasObject[]): SavedVersion {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `ver-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  // Deep-clone so later edits to the live scene don't mutate the snapshot.
  return { id, label, createdAt: new Date().toISOString(), objects: JSON.parse(JSON.stringify(objects)) };
}
