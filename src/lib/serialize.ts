/**
 * serialize.ts — document model + persistence (ARCHITECTURE.md §8).
 *
 * The whole scene is plain serializable data, so a document is just
 * `{ version, layers, objects, canvasSettings, activeLayerId }`. This module
 * owns the schema version, migration, JSON (de)serialization, localStorage
 * autosave, and file download/upload. It stays runtime-pure — the store-type
 * imports below are `import type` (erased at build), so there is no runtime
 * dependency on the store and no import cycle.
 */
import type { Layer, CanvasSettings } from '../store/editorStore';
import type { CanvasObject } from '../types/scene';

export const DOCUMENT_VERSION = 1;
const STORAGE_KEY = 'esp-editor:document';

export interface EspDocument {
  version: number;
  layers: Layer[];
  objects: CanvasObject[];
  canvasSettings: CanvasSettings;
  activeLayerId: string;
}

/** Bring an older document up to the current schema. Add cases as the schema
 *  evolves, e.g. `if (d.version < 2) { …; d = { ...d, version: 2 }; }`. */
export function migrateDocument(doc: EspDocument): EspDocument {
  const d = doc;
  // (no migrations yet)
  return { ...d, version: DOCUMENT_VERSION };
}

export function serializeDocument(doc: EspDocument): string {
  return JSON.stringify(doc, null, 2);
}

/** Parse + shape-validate + migrate a JSON string. Returns null if invalid.
 *  canvasSettings is optional — missing or malformed settings fall through to
 *  the store's DEFAULT_CANVAS_SETTINGS fallback rather than wiping the whole doc. */
export function parseDocument(json: string): EspDocument | null {
  try {
    const raw = JSON.parse(json);
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.layers) || !Array.isArray(raw.objects)) return null;
    return migrateDocument(raw as EspDocument);
  } catch {
    return null;
  }
}

/* ── localStorage autosave ───────────────────────────────────────── */

export function savePersistedDocument(doc: EspDocument): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeDocument(doc));
  } catch {
    /* quota or disabled storage — ignore */
  }
}

export function loadPersistedDocument(): EspDocument | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? parseDocument(json) : null;
  } catch {
    return null;
  }
}

export function clearPersistedDocument(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/* ── File download / upload ──────────────────────────────────────── */

export function downloadDocument(doc: EspDocument, filename = 'esp-drawing.json'): void {
  const blob = new Blob([serializeDocument(doc)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readDocumentFile(file: File): Promise<EspDocument | null> {
  return file.text().then(parseDocument).catch(() => null);
}
