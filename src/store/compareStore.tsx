/**
 * compareStore.tsx — UI + data state for drawing version-comparison mode.
 *
 * Compare diffs a BASE (a saved version snapshot, see versionSnapshots.ts)
 * against a HEAD (a freshly-uploaded DWG, parsed to CanvasObjects). The diff
 * result drives the canvas highlight overlay (DiffHighlightLayer) and the right
 * panel (ChangeListPanel). Kept separate from editorStore so the live scene and
 * this transient compare state don't entangle — the same split the SOD feature
 * uses (sodStore.tsx). Viewport focus reuses sodStore.requestFocus.
 */

import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { CanvasObject } from '../types/scene';
import type { VersionDiffResult } from '../lib/versionDiff/diffTypes';
import { computeVersionDiff } from '../lib/versionDiff/computeDiff';
import {
  SavedVersion, loadVersions, saveVersions, makeVersion,
} from '../lib/versionSnapshots';

export interface CompareStore {
  /** Is compare mode active? */
  isComparing: boolean;
  /** Current diff result, or null until both base and head are set. */
  diffResult: VersionDiffResult | null;
  /** Change currently highlighted in the panel + canvas. */
  activeChangeId: string | null;

  /** Saved version snapshots the user can pick as base or head. */
  savedVersions: SavedVersion[];
  /** Selected base (older) version id. */
  baseVersionId: string | null;
  /** Selected head (newer) version id. */
  headVersionId: string | null;

  enableCompare: () => void;
  disableCompare: () => void;
  clearCompare: () => void;
  setActiveChange: (id: string | null) => void;

  /** Snapshot the given objects as a new saved version and select it as base. */
  saveVersion: (label: string, objects: CanvasObject[]) => SavedVersion;
  deleteVersion: (id: string) => void;
  /** Pick the base version (recomputes the diff if a head is selected). */
  setBaseVersion: (id: string) => void;
  /** Pick the head version (recomputes the diff if a base is selected). */
  setHeadVersion: (id: string) => void;
  /** Set both sides at once and recompute (used for the default pair). */
  setVersionPair: (baseId: string, headId: string) => void;
}

const CompareContext = createContext<CompareStore | null>(null);

export const CompareProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isComparing, setIsComparing] = useState(false);
  const [diffResult, setDiffResultState] = useState<VersionDiffResult | null>(null);
  const [activeChangeId, setActiveChangeState] = useState<string | null>(null);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>(() => loadVersions());
  const [baseVersionId, setBaseVersionId] = useState<string | null>(null);
  const [headVersionId, setHeadVersionId] = useState<string | null>(null);

  // Always-current mirror so recompute can read the latest versions synchronously.
  const versionsRef = useRef(savedVersions); versionsRef.current = savedVersions;

  /** Recompute the diff from explicit base + head ids, so callers get an
   *  immediate result without waiting for a state flush. */
  const recompute = useCallback((baseId: string | null, headId: string | null) => {
    const base = baseId ? versionsRef.current.find(v => v.id === baseId) : undefined;
    const head = headId ? versionsRef.current.find(v => v.id === headId) : undefined;
    if (!base || !head) { setDiffResultState(null); setActiveChangeState(null); return; }
    setDiffResultState(computeVersionDiff(base.objects, head.objects, base.label, head.label));
    setActiveChangeState(null);
  }, []);

  const enableCompare = useCallback(() => setIsComparing(true), []);
  const disableCompare = useCallback(() => {
    setIsComparing(false);
    setActiveChangeState(null);
  }, []);

  const clearCompare = useCallback(() => {
    setIsComparing(false);
    setDiffResultState(null);
    setActiveChangeState(null);
    setBaseVersionId(null);
    setHeadVersionId(null);
  }, []);

  const setActiveChange = useCallback((id: string | null) => setActiveChangeState(id), []);

  const saveVersion = useCallback((label: string, objects: CanvasObject[]): SavedVersion => {
    const v = makeVersion(label, objects);
    setSavedVersions(prev => {
      const next = [...prev, v];
      versionsRef.current = next;
      saveVersions(next);
      return next;
    });
    // Default the base to the version just saved.
    setBaseVersionId(v.id);
    return v;
  }, []);

  const deleteVersion = useCallback((id: string) => {
    setSavedVersions(prev => {
      const next = prev.filter(v => v.id !== id);
      versionsRef.current = next;
      saveVersions(next);
      return next;
    });
    setBaseVersionId(prev => (prev === id ? null : prev));
  }, []);

  const setBaseVersion = useCallback((id: string) => {
    setBaseVersionId(id);
    recompute(id, headVersionId);
  }, [recompute, headVersionId]);

  const setHeadVersion = useCallback((id: string) => {
    setHeadVersionId(id);
    recompute(baseVersionId, id);
  }, [recompute, baseVersionId]);

  const setVersionPair = useCallback((baseId: string, headId: string) => {
    setBaseVersionId(baseId);
    setHeadVersionId(headId);
    recompute(baseId, headId);
  }, [recompute]);

  const store: CompareStore = {
    isComparing, diffResult, activeChangeId,
    savedVersions, baseVersionId, headVersionId,
    enableCompare, disableCompare, clearCompare, setActiveChange,
    saveVersion, deleteVersion, setBaseVersion, setHeadVersion, setVersionPair,
  };

  return <CompareContext.Provider value={store}>{children}</CompareContext.Provider>;
};

export const useCompareStore = (): CompareStore => {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error('useCompareStore must be inside CompareProvider');
  return ctx;
};
