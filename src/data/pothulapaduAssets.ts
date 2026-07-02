/**
 * pothulapaduAssets.ts — Pothulapadu station (South Central Railway).
 *
 * Represents station-domain metadata for POTHULAPADU_ESP-Model.pdf. The editor
 * loads the PDF as the visual underlay; these fixtures keep SOD validation
 * anchored to the known station assets.
 *
 * Two shapes live here:
 *  - POTHULAPADU_ASSETS: the raw domain assets (engineering measurements, mm).
 *  - pothulapaduToCanvasObjects(): converts them into CanvasObjects for tests
 *    and SOD reference data, each carrying its measurements in `obj.sod`.
 *
 * Coordinates are drawing units that double as world coordinates on the canvas
 * (X 100–1400, Y 150–310), so the station lands near the top-left on load.
 */

import type { CanvasObject, LineObject, RectangleObject, TextObject, SodAssetMeta } from '../types/scene';

/* ── Domain asset shapes (parser output) ─────────────────────────────── */

interface TrackAsset {
  id: string; type: 'Track'; name: string; lineType: 'main' | 'loop' | 'siding';
  startX: number; startY: number; endX: number; endY: number;
  spacingToAdjacentTrack: number; gradient: number; length: number; isNew: boolean;
}
interface PlatformAsset {
  id: string; type: 'Platform'; name: string; platformType: 'high' | 'goods';
  startX: number; startY: number; endX: number; endY: number;
  clearanceFromTrackCentre: number; heightAboveRailLevel: number; length: number; isNew: boolean;
}
interface StructureAsset {
  id: string; type: 'Structure'; name: string; structureType: 'building' | 'fob' | 'gate';
  x: number; y: number; width: number; height: number;
  clearanceFromTrackCentre: number; heightAboveRailLevel: number; isNew: boolean;
}
interface GradientAsset {
  id: string; type: 'Gradient'; name: string;
  startChainage: number; endChainage: number; gradientDenominator: number; isNew: boolean;
}
type PothulapaduAsset = TrackAsset | PlatformAsset | StructureAsset | GradientAsset;

export interface PothulapaduDataset {
  stationId: string;
  stationCode: string;
  stationName: string;
  zone: string;
  division: string;
  adjacentStations: string[];
  drawingRef: string;
  extractedAt: string;
  assets: PothulapaduAsset[];
}

export const POTHULAPADU_ASSETS: PothulapaduDataset = {
  stationId: 'POTHULAPADU',
  stationCode: 'PTLP',
  stationName: 'Pothulapadu',
  zone: 'SCR',
  division: 'Guntur',
  adjacentStations: ['VELDURT'],
  drawingRef: 'POTHULAPADU_ESP-Model.pdf',
  extractedAt: new Date().toISOString(),

  assets: [
    /* ── TRACKS ──────────────────────────────────────────────────────── */
    { id: 'TRK-01', type: 'Track', name: 'Main Line (Up)',   lineType: 'main',
      startX: 100, startY: 200, endX: 1400, endY: 200,
      spacingToAdjacentTrack: 4265, gradient: 500, length: 650000, isNew: false },
    { id: 'TRK-02', type: 'Track', name: 'Main Line (Down)', lineType: 'main',
      startX: 100, startY: 235, endX: 1400, endY: 235,
      spacingToAdjacentTrack: 4265, gradient: 500, length: 650000, isNew: false },
    { id: 'TRK-03', type: 'Track', name: 'Loop Line 1',      lineType: 'loop',
      startX: 200, startY: 260, endX: 1200, endY: 260,
      spacingToAdjacentTrack: 4100, gradient: 380, length: 480000, isNew: false }, // ⚠ spacing
    { id: 'TRK-04', type: 'Track', name: 'Siding 1',         lineType: 'siding',
      startX: 600, startY: 290, endX: 900,  endY: 290,
      spacingToAdjacentTrack: 4650, gradient: 600, length: 180000, isNew: false },

    /* ── PLATFORMS ───────────────────────────────────────────────────── */
    { id: 'PLT-01', type: 'Platform', name: 'Platform 1 (Passenger)', platformType: 'high',
      startX: 400, startY: 185, endX: 900, endY: 185,
      clearanceFromTrackCentre: 1540, heightAboveRailLevel: 800, length: 250000, isNew: false }, // ⚠ clearance
    { id: 'PLT-02', type: 'Platform', name: 'Platform 2 (Goods)',     platformType: 'goods',
      startX: 450, startY: 310, endX: 850, endY: 310,
      clearanceFromTrackCentre: 1675, heightAboveRailLevel: 1100, length: 200000, isNew: false }, // ⚠ height

    /* ── STRUCTURES ──────────────────────────────────────────────────── */
    { id: 'STR-01', type: 'Structure', name: 'Station building', structureType: 'building',
      x: 700, y: 160, width: 120, height: 60,
      clearanceFromTrackCentre: 1400, heightAboveRailLevel: 3500, isNew: false }, // ⚠ clearance
    { id: 'STR-02', type: 'Structure', name: 'Foot over bridge (FOB)', structureType: 'fob',
      x: 750, y: 150, width: 40, height: 80,
      clearanceFromTrackCentre: 2200, heightAboveRailLevel: 5800, isNew: false }, // ⚠ FOB height
    { id: 'STR-03', type: 'Structure', name: 'Water tank', structureType: 'building',
      x: 1100, y: 155, width: 30, height: 30,
      clearanceFromTrackCentre: 2800, heightAboveRailLevel: 8000, isNew: false },
    { id: 'STR-04', type: 'Structure', name: 'Level crossing gate', structureType: 'gate',
      x: 300, y: 200, width: 10, height: 10,
      clearanceFromTrackCentre: 1800, heightAboveRailLevel: 1200, isNew: false },

    /* ── GRADIENTS ───────────────────────────────────────────────────── */
    { id: 'GRD-01', type: 'Gradient', name: 'Gradient section A',
      startChainage: 14200, endChainage: 14380, gradientDenominator: 380, isNew: false }, // ⚠ steeper than 1:400
    { id: 'GRD-02', type: 'Gradient', name: 'Gradient section B',
      startChainage: 14380, endChainage: 14650, gradientDenominator: 550, isNew: false },
  ],
};

/* Expected violations after the SOD check (see sodValidator.ts):
 *   SOD-II-03  Platform 1 face clearance 1540mm  (need ≥1670mm)   → V2
 *   SOD-II-10  FOB height 5800mm                 (need ≥6250mm)   → V2
 *   SOD-I-01   Loop Line 1 spacing 4100mm        (need ≥4265mm)   → V1
 *   SOD-I-07   Station building clearance 1400mm (need ≥1675mm)   → V1
 *   SOD-II-02  Gradient section A 1:380          (need ≤1:400)    → V1
 *   SOD-II-04  Platform 2 (Goods) height 1100mm  (need ≤1065mm)   → V1
 *   Total: 2 critical (V2), 4 major (V1). */

/* ── Conversion to renderable CanvasObjects ──────────────────────────── */

const TRACK_LAYER: Record<TrackAsset['lineType'], string> = {
  main: 'main-line', loop: 'loop-lines', siding: 'sidings',
};

function baseText(id: string, x: number, y: number, value: string, color: string): TextObject {
  return {
    id, type: 'text', name: value.slice(0, 20), layerId: 'annotation',
    locked: false, visible: true, x, y, width: 160, height: 16, rotation: 0, scale: 100,
    anchor: 'Top left', value, textColor: color, fontSize: '10px',
    fontFamily: 'Inter, -apple-system, sans-serif', fontStyle: 'Regular',
    bold: false, italic: false, underline: false, alignment: 'left', baseline: 'top',
  };
}

/** Convert the parsed Pothulapadu assets into CanvasObjects the editor renders.
 *  Each infrastructure object carries its SOD measurements in `obj.sod`. */
export function pothulapaduToCanvasObjects(data: PothulapaduDataset = POTHULAPADU_ASSETS): CanvasObject[] {
  const out: CanvasObject[] = [];

  for (const a of data.assets) {
    if (a.type === 'Track') {
      const sod: SodAssetMeta = {
        assetKind: 'Track', subtype: a.lineType, sourceAssetId: a.id,
        spacingToAdjacentTrack: a.spacingToAdjacentTrack,
      };
      const line: LineObject = {
        id: a.id, type: 'line', name: a.name, layerId: TRACK_LAYER[a.lineType],
        locked: false, visible: true,
        x: a.startX, y: a.startY, dx: a.endX - a.startX, dy: a.endY - a.startY,
        width: Math.abs(a.endX - a.startX), height: Math.abs(a.endY - a.startY),
        rotation: 0, scale: 100,
        stroke: '#374151', strokeWidth: 3, strokeStyle: 'solid', sod,
      };
      out.push(line);
      out.push(baseText(`${a.id}-lbl`, a.startX, a.startY - 15, a.name, '#6b7280'));

    } else if (a.type === 'Platform') {
      const sod: SodAssetMeta = {
        assetKind: 'Platform', subtype: a.platformType, sourceAssetId: a.id,
        clearanceFromTrackCentre: a.clearanceFromTrackCentre,
        heightAboveRailLevel: a.heightAboveRailLevel,
      };
      const rect: RectangleObject = {
        id: a.id, type: 'rectangle', name: a.name, layerId: 'platforms',
        locked: false, visible: true,
        x: a.startX, y: a.startY - 8, width: a.endX - a.startX, height: 10,
        rotation: 0, scale: 100,
        fill: '#fde68a', stroke: '#92400e', strokeWidth: 1, strokeStyle: 'solid',
        cornerRadius: 0, sod,
      };
      out.push(rect);
      out.push(baseText(`${a.id}-lbl`, a.startX + 4, a.startY - 24, a.name, '#92400e'));

    } else if (a.type === 'Structure') {
      const sod: SodAssetMeta = {
        assetKind: 'Structure', subtype: a.structureType, sourceAssetId: a.id,
        clearanceFromTrackCentre: a.clearanceFromTrackCentre,
        heightAboveRailLevel: a.heightAboveRailLevel,
      };
      const rect: RectangleObject = {
        id: a.id, type: 'rectangle', name: a.name, layerId: 'structures',
        locked: false, visible: true,
        x: a.x, y: a.y, width: a.width, height: a.height,
        rotation: 0, scale: 100,
        fill: '#e5e7eb', stroke: '#374151', strokeWidth: 1, strokeStyle: 'solid',
        cornerRadius: 0, sod,
      };
      out.push(rect);
      out.push(baseText(`${a.id}-lbl`, a.x, a.y - 13, a.name, '#374151'));

    } else if (a.type === 'Gradient') {
      const sod: SodAssetMeta = {
        assetKind: 'Gradient', sourceAssetId: a.id, gradientDenominator: a.gradientDenominator,
      };
      const x = a.startChainage / 10;
      const dx = (a.endChainage - a.startChainage) / 10;
      const line: LineObject = {
        id: a.id, type: 'line', name: a.name, layerId: 'gradients',
        locked: false, visible: true,
        x, y: 285, dx, dy: 0, width: Math.abs(dx), height: 0,
        rotation: 0, scale: 100,
        stroke: '#10b981', strokeWidth: 1.5, strokeStyle: 'dashed', sod,
      };
      out.push(line);
      out.push(baseText(`${a.id}-lbl`, x, 288, `1:${a.gradientDenominator}`, '#047857'));
    }
  }

  return out;
}
