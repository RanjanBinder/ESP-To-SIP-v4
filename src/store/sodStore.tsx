/**
 * sodStore.tsx — UI state for the Schedule-of-Dimensions (SOD) check.
 *
 * Holds the latest validation result and whether the Violations panel is open
 * in the right panel area. Kept separate from editorStore so the scene model
 * and the (transient, non-persisted) check state don't entangle.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { SODCheckResult } from '../lib/validation/sodValidator';

export interface SODStore {
  /** Latest check result, or null if a check has never been run. */
  checkResult: SODCheckResult | null;
  setCheckResult: (result: SODCheckResult | null) => void;
  /** Whether the Violations panel is shown in the right panel area. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  /** Loaded station identity (from a parsed ESP), or null before any load. */
  stationCode: string | null;
  stationName: string | null;
  setStation: (code: string | null, name: string | null) => void;
}

const SODContext = createContext<SODStore | null>(null);

export const SODProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [checkResult, setCheckResultState] = useState<SODCheckResult | null>(null);
  const [panelOpen, setPanelOpenState] = useState(false);
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);

  const setCheckResult = useCallback((result: SODCheckResult | null) => {
    setCheckResultState(result);
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
  }, []);

  const setStation = useCallback((code: string | null, name: string | null) => {
    setStationCode(code);
    setStationName(name);
  }, []);

  const store: SODStore = {
    checkResult, setCheckResult, panelOpen, setPanelOpen,
    stationCode, stationName, setStation,
  };

  return <SODContext.Provider value={store}>{children}</SODContext.Provider>;
};

export const useSODStore = (): SODStore => {
  const ctx = useContext(SODContext);
  if (!ctx) throw new Error('useSODStore must be inside SODProvider');
  return ctx;
};
