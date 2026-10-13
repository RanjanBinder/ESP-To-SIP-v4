import React, { useEffect, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ValidationPanel from './ValidationPanel';
import { SODProvider, useSODStore } from '../store/sodStore';
import { runSODValidation } from '../lib/validation/sodValidator';
import type { CanvasObject } from '../types/scene';

let mockObjects: CanvasObject[];
const mockSelectObjects = jest.fn();
const mockSelectObject = jest.fn();
jest.mock('../store/editorStore', () => ({ useEditor: () => ({ objects: mockObjects, selectObjects: mockSelectObjects, selectObject: mockSelectObject, getLayer: () => ({ visible: true }) }) }));
function point(id: string, chainage: number, incoming: number): CanvasObject {
  return { id, name: id, type: 'symbol', symbolId: 'gradient-post', label: id, layerId: 'gradients', visible: true, locked: false, x: chainage, y: 0, width: 10, height: 10, rotation: 0, scale: 100,
    sod: { assetKind: 'Gradient', trackId: 'up', trackName: 'UP Main', chainage, leftGradient: { direction: 'rising', denominator: incoming }, rightGradient: { direction: 'rising', denominator: 150 } } };
}
function Harness() {
  const { setCheckResult, panelOpen, setPanelOpen, selectedValidation, focusRequest } = useSODStore();
  const [, update] = useState(0);
  useEffect(() => { setCheckResult(runSODValidation(mockObjects)); setPanelOpen(true); }, [setCheckResult, setPanelOpen]);
  return <><button onClick={() => setPanelOpen(true)}>Return to Validation</button><button onClick={() => { mockObjects = [point('GP-A', 10, 150), point('GP-B', 20, 150)]; update(n => n + 1); }}>Correct incoming gradient</button>
    <output data-testid="selected">{selectedValidation?.assetIds?.join(',')}</output><output data-testid="focus">{focusRequest ? 'focused' : ''}</output><output data-testid="properties">{panelOpen ? 'validation' : 'properties'}</output>
    <div style={{ display: panelOpen ? 'flex' : 'none' }}><ValidationPanel /></div></>;
}
beforeEach(() => { mockObjects = [point('GP-A', 10, 150), point('GP-B', 20, 320)]; mockSelectObject.mockClear(); mockSelectObjects.mockClear(); });

test('filters, selects both points, opens Properties, preserves context and reruns corrected data', async () => {
  const raf = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 0; });
  try {
    render(<SODProvider><Harness /></SODProvider>);
    fireEvent.click(await screen.findByRole('tab', { name: /Gradient \(2\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /^1.*Failed$/ }));
    fireEvent.change(screen.getByLabelText('Search validation results'), { target: { value: 'GP-B' } });
    fireEvent.change(screen.getByLabelText('Track', { selector: 'select' }), { target: { value: 'up' } });
    fireEvent.click(screen.getByRole('button', { name: /GC-001.*Gradient Continuity Across Track/ }));
    expect(mockSelectObjects).toHaveBeenCalledWith(['GP-A', 'GP-B']);
    expect(screen.getByTestId('selected')).toHaveTextContent('GP-A,GP-B');
    expect(screen.getByTestId('focus')).toHaveTextContent('focused');
    expect(screen.getByText('rising 1 in 150')).toBeInTheDocument();
    expect(screen.getByText('rising 1 in 320')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Properties' }));
    expect(mockSelectObject).toHaveBeenCalledWith('GP-A');
    expect(screen.getByTestId('properties')).toHaveTextContent('properties');
    fireEvent.click(screen.getByRole('button', { name: 'Return to Validation' }));
    expect(screen.getByLabelText('Search validation results')).toHaveValue('GP-B');
    expect(screen.getByLabelText('Track', { selector: 'select' })).toHaveValue('up');
    expect(screen.getByRole('tab', { name: /Gradient \(2\)/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Correct incoming gradient' }));
    fireEvent.click(screen.getByRole('button', { name: 'Re-run selected assets' }));
    await waitFor(() => expect(screen.getByRole('status', { name: 'Validation activity' })).toHaveTextContent('Validation completed'));
    expect(screen.getByRole('button', { name: /^0.*Failed$/ })).toBeInTheDocument();
    expect(screen.getByText('Consecutive gradients match.')).toBeInTheDocument();
    expect(screen.getByTestId('selected')).toHaveTextContent('GP-A,GP-B');
  } finally { raf.mockRestore(); }
});

test('search and category filters produce a clear empty state and can be cleared', async () => {
  render(<SODProvider><Harness /></SODProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: /Gradient \(2\)/ }));
  fireEvent.change(screen.getByLabelText('Search validation results'), { target: { value: 'unknown-track' } });
  expect(screen.getByText('No validation results match the current filters.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByLabelText('Search validation results')).toHaveValue('');
  expect(screen.getByRole('tab', { name: /All \(/ })).toHaveAttribute('aria-selected', 'true');
});

test('large result groups render one bounded page at a time', async () => {
  mockObjects = Array.from({ length: 120 }, (_, i) => point(`GP-${i}`, i * 20, 150));
  render(<SODProvider><Harness /></SODProvider>);
  fireEvent.click(await screen.findByRole('tab', { name: /Gradient \(120\)/ }));
  expect(screen.getAllByRole('button', { name: /GC-001.*Gradient Continuity/ })).toHaveLength(50);
  fireEvent.click(screen.getByRole('button', { name: 'Next 50' }));
  expect(screen.getAllByRole('button', { name: /GC-001.*Gradient Continuity/ })).toHaveLength(50);
  expect(screen.getByText('51–100 of 120')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next 50' }));
  expect(screen.getAllByRole('button', { name: /GC-001.*Gradient Continuity/ })).toHaveLength(20);
});
