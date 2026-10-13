/**
 * sodStore.tsx — UI state for the Schedule-of-Dimensions (SOD) check.
 *
 * Holds the latest validation result and whether the Violations panel is open
 * in the right panel area. Kept separate from editorStore so the scene model
 * and the (transient, non-persisted) check state don't entangle.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ValidationResult } from '../lib/validation/validationModel';
import type { SODCheckResult } from '../lib/validation/sodValidator';

export interface SODStore {
  additionalResults: ValidationResult[];
  setAdditionalResults: (results: ValidationResult[]) => void;
  selectedValidation: ValidationResult | null;
  setSelectedValidation: (result: ValidationResult | null) => void;
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
  /** Currently highlighted violation (two-way sync between panel and canvas). */
  activeViolationId: string | null;
  setActiveViolation: (id: string | null) => void;
  /** Imperative request to centre the canvas on a world point. The Canvas owns
   *  the viewport math and consumes this via a nonce-keyed effect. */
  focusRequest: { x: number; y: number; zoom: number; nonce: number } | null;
  requestFocus: (x: number, y: number, zoom?: number) => void;
}

const SODContext = createContext<SODStore | null>(null);

export const SODProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [additionalResults, setAdditionalResults] = useState<ValidationResult[]>([]);
  const [selectedValidation, setSelectedValidation] = useState<ValidationResult | null>(null);
  const [checkResult, setCheckResultState] = useState<SODCheckResult | null>(null);
  const [panelOpen, setPanelOpenState] = useState(false);
  const [stationCode, setStationCode] = useState<string | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const [activeViolationId, setActiveViolationState] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<SODStore['focusRequest']>(null);

  const setCheckResult = useCallback((result: SODCheckResult | null) => {
    setCheckResultState(result);
    if (!result) { setAdditionalResults([]); setSelectedValidation(null); }
    setActiveViolationState(null);
  }, []);

  const setActiveViolation = useCallback((id: string | null) => {
    setActiveViolationState(id);
  }, []);

  const requestFocus = useCallback((x: number, y: number, zoom: number = 2) => {
    setFocusRequest({ x, y, zoom, nonce: Date.now() });
  }, []);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
  }, []);

  const setStation = useCallback((code: string | null, name: string | null) => {
    setStationCode(code);
    setStationName(name);
  }, []);

  const store: SODStore = {
    additionalResults, setAdditionalResults, selectedValidation, setSelectedValidation,
    checkResult, setCheckResult, panelOpen, setPanelOpen,
    stationCode, stationName, setStation,
    activeViolationId, setActiveViolation,
    focusRequest, requestFocus,
  };

  return <SODContext.Provider value={store}>{children}</SODContext.Provider>;
};

export const useSODStore = (): SODStore => {
  const ctx = useContext(SODContext);
  if (!ctx) throw new Error('useSODStore must be inside SODProvider');
  return ctx;
};
