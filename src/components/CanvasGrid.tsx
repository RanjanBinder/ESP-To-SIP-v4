import React from 'react';
import { useEditor } from '../store/editorStore';
import { computeGridScreenConfig } from '../lib/grid';

/**
 * Schematic-style CAD grid.
 *
 * Uses CSS background-image gradients to draw minor + major grid lines.
 * Zoom-aware: hides minor lines when too dense, adapts major spacing when
 * very zoomed out, so the canvas never becomes visually noisy.
 *
 * World-coordinate convention: 96 world px = 1 physical inch.
 */
const CanvasGrid: React.FC = () => {
  const { viewport, canvasSettings } = useEditor();

  if (!canvasSettings.gridVisible) return null;

  const { zoom, panX, panY } = viewport;
  const gs = canvasSettings.gridSettings;

  const { minorScreen, majorScreen, minorWorldPx, majorWorldPx } =
    computeGridScreenConfig(gs, zoom);

  /* ── CSS offset helpers (keeps grid locked to world origin) ── */
  const offset = (worldPx: number, pan: number, screenPx: number) =>
    ((pan % (worldPx * zoom) % screenPx) + screenPx) % screenPx;

  /* ── Build gradient layers bottom-up ────────────────────────── */
  const images: string[] = [];
  const sizes:  string[] = [];
  const positions: string[] = [];

  const minorColor = 'rgba(0,0,0,0.055)';
  const majorColor = 'rgba(0,0,0,0.11)';

  // Major grid always rendered
  const majX = offset(majorWorldPx, panX, majorScreen);
  const majY = offset(majorWorldPx, panY, majorScreen);

  images.push(
    `linear-gradient(to right,  ${majorColor} 1px, transparent 1px)`,
    `linear-gradient(to bottom, ${majorColor} 1px, transparent 1px)`,
  );
  sizes.push(`${majorScreen}px ${majorScreen}px`, `${majorScreen}px ${majorScreen}px`);
  positions.push(`${majX}px ${majY}px`, `${majX}px ${majY}px`);

  // Minor grid only when visible
  if (minorScreen !== null && minorWorldPx !== null) {
    const minX = offset(minorWorldPx, panX, minorScreen);
    const minY = offset(minorWorldPx, panY, minorScreen);

    images.push(
      `linear-gradient(to right,  ${minorColor} 1px, transparent 1px)`,
      `linear-gradient(to bottom, ${minorColor} 1px, transparent 1px)`,
    );
    sizes.push(`${minorScreen}px ${minorScreen}px`, `${minorScreen}px ${minorScreen}px`);
    positions.push(`${minX}px ${minY}px`, `${minX}px ${minY}px`);
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        backgroundImage: images.join(','),
        backgroundSize: sizes.join(','),
        backgroundPosition: positions.join(','),
      }}
    />
  );
};

export default CanvasGrid;
