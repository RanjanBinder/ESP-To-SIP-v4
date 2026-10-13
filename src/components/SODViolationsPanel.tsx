import React from 'react';
import ValidationPanel from './ValidationPanel';
import { useSODStore } from '../store/sodStore';

/** Backward-compatible entry point for existing SOD panel integrations. */
export default function SODViolationsPanel({ showHeader = true }: { showHeader?: boolean }) {
  const { setPanelOpen } = useSODStore();
  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
    {showHeader && <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between' }}><strong>Validation</strong><button aria-label="Close validation" onClick={() => setPanelOpen(false)}>×</button></div>}
    <ValidationPanel />
  </div>;
}
