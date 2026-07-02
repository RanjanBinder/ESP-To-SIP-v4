import type { CanvasObject, RectangleObject } from '../types/scene';
import { POTHULAPADU_ASSETS, pothulapaduToCanvasObjects } from './pothulapaduAssets';
import type { SavedVersion } from '../lib/versionSnapshots';

export const DEFAULT_PDF_COMPARE_BASE_ID = 'default-pdf-pothulapadu-v1';
export const DEFAULT_PDF_COMPARE_HEAD_ID = 'default-pdf-pothulapadu-v2';

const PDF_FILE_NAME = 'POTHULAPADU_ESP-Model.pdf';
const CREATED_AT = '2026-07-02T00:00:00.000Z';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makePdfAnchors(): CanvasObject[] {
  return pothulapaduToCanvasObjects(POTHULAPADU_ASSETS)
    .filter(obj => obj.sod)
    .map(obj => ({
      ...obj,
      locked: true,
      visible: false,
      sourceId: PDF_FILE_NAME,
      sod: {
        ...obj.sod!,
        sourceKind: 'pdf',
        sourceDrawingRef: PDF_FILE_NAME,
        sourcePage: 1,
      },
    } as CanvasObject));
}

function makeRelayHutAnchor(): RectangleObject {
  return {
    id: 'STR-05',
    type: 'rectangle',
    name: 'Relay hut',
    layerId: 'structures',
    locked: true,
    visible: false,
    x: 1228,
    y: 166,
    width: 34,
    height: 24,
    rotation: 0,
    scale: 100,
    fill: '#e5e7eb',
    stroke: '#374151',
    strokeWidth: 1,
    strokeStyle: 'solid',
    cornerRadius: 0,
    sourceId: PDF_FILE_NAME,
    sod: {
      assetKind: 'Structure',
      subtype: 'building',
      sourceAssetId: 'STR-05',
      sourceKind: 'pdf',
      sourceDrawingRef: PDF_FILE_NAME,
      sourcePage: 1,
      clearanceFromTrackCentre: 2450,
      heightAboveRailLevel: 3200,
    },
  };
}

function makeV2Anchors(): CanvasObject[] {
  const out = clone(makePdfAnchors());

  return out
    .filter(obj => obj.id !== 'GRD-02')
    .map(obj => {
      if (obj.id === 'TRK-03') {
        return { ...obj, y: obj.y + 14, name: 'Loop Line 1 shifted' } as CanvasObject;
      }

      if (obj.id === 'PLT-01' && obj.sod) {
        return {
          ...obj,
          name: 'Platform 1 clearance revised',
          sod: { ...obj.sod, clearanceFromTrackCentre: 1710 },
        } as CanvasObject;
      }

      if (obj.id === 'STR-02' && obj.sod) {
        return {
          ...obj,
          name: 'FOB height revised',
          sod: { ...obj.sod, heightAboveRailLevel: 6350 },
        } as CanvasObject;
      }

      return obj;
    })
    .concat(makeRelayHutAnchor());
}

export const DEFAULT_PDF_COMPARE_VERSIONS: SavedVersion[] = [
  {
    id: DEFAULT_PDF_COMPARE_BASE_ID,
    label: 'PDF v1 · Pothulapadu baseline',
    createdAt: CREATED_AT,
    sourceKind: 'pdf',
    sourceFileName: PDF_FILE_NAME,
    sourcePage: 1,
    isDefaultExample: true,
    objects: makePdfAnchors(),
  },
  {
    id: DEFAULT_PDF_COMPARE_HEAD_ID,
    label: 'PDF v2 · Pothulapadu revised',
    createdAt: CREATED_AT,
    sourceKind: 'pdf',
    sourceFileName: PDF_FILE_NAME,
    sourcePage: 1,
    isDefaultExample: true,
    objects: makeV2Anchors(),
  },
];
