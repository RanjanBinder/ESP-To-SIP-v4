import defaultPdfUrl from '../../assets/POTHULAPADU_ESP-Model.pdf?url';
import defaultPdfPreviewUrl from '../../assets/POTHULAPADU_ESP-Model-preview.png?url';
import { DEFAULT_CANVAS_SETTINGS, DEFAULT_LAYERS } from '../store/editorStore';
import type { CanvasObject, ImageObject, LineObject } from '../types/scene';
import { DOCUMENT_VERSION, type EspDocument } from './serialize';
import { POTHULAPADU_ASSETS, pothulapaduToCanvasObjects } from '../data/pothulapaduAssets';

export const DEFAULT_DRAWING_META = {
  fileName: 'POTHULAPADU_ESP-Model.pdf',
  previewFileName: 'POTHULAPADU_ESP-Model-preview.png',
  sourceUrl: defaultPdfUrl,
  stationCode: POTHULAPADU_ASSETS.stationCode,
  stationName: POTHULAPADU_ASSETS.stationName,
};

export const DEFAULT_DWG_META = DEFAULT_DRAWING_META;

let defaultDocumentPromise: Promise<EspDocument> | null = null;

const PDF_UNDERLAY = {
  x: 14,
  y: 63,
  width: 1620,
  height: 450,
  opacity: 0.72,
};

function cloneDefaultLayers() {
  return DEFAULT_LAYERS.map(layer => ({
    ...layer,
    customProperties: layer.customProperties?.map(prop => ({ ...prop })),
  }));
}

function cloneDefaultCanvasSettings() {
  return {
    ...DEFAULT_CANVAS_SETTINGS,
    modelName: 'Pothulapadu ESP Model',
    canvasName: 'Pothulapadu PDF',
    gridSettings: { ...DEFAULT_CANVAS_SETTINGS.gridSettings },
  };
}

function cloneDocument(doc: EspDocument): EspDocument {
  return {
    ...doc,
    layers: doc.layers.map(layer => ({
      ...layer,
      customProperties: layer.customProperties?.map(prop => ({ ...prop })),
    })),
    objects: doc.objects.map(obj => ({ ...obj } as CanvasObject)),
    canvasSettings: {
      ...doc.canvasSettings,
      gridSettings: { ...doc.canvasSettings.gridSettings },
    },
  };
}

function createDefaultPdfUnderlay(): ImageObject {
  return {
    id: 'pothulapadu-pdf-underlay',
    type: 'image',
    name: 'Pothulapadu ESP Model PDF',
    layerId: 'pdf-underlay',
    locked: true,
    visible: true,
    x: PDF_UNDERLAY.x,
    y: PDF_UNDERLAY.y,
    width: PDF_UNDERLAY.width,
    height: PDF_UNDERLAY.height,
    rotation: 0,
    scale: 100,
    src: defaultPdfPreviewUrl,
    alt: 'Pothulapadu ESP model PDF underlay',
    sourceFileName: DEFAULT_DRAWING_META.fileName,
    opacity: PDF_UNDERLAY.opacity,
  };
}

function createSodAnchors(): CanvasObject[] {
  return pothulapaduToCanvasObjects(POTHULAPADU_ASSETS)
    .filter(obj => obj.sod)
    .map(obj => ({
      ...obj,
      locked: true,
      visible: false,
      sourceId: DEFAULT_DRAWING_META.fileName,
      sod: {
        ...obj.sod!,
        sourceKind: 'pdf',
        sourceDrawingRef: DEFAULT_DRAWING_META.fileName,
        sourcePage: 1,
      },
    } as CanvasObject));
}

async function buildDefaultDrawingDocument(): Promise<EspDocument> {
  const defaultLayers = cloneDefaultLayers();

  return {
    version: DOCUMENT_VERSION,
    layers: defaultLayers,
    objects: [
      createDefaultPdfUnderlay(),
      ...createSodAnchors(),
    ],
    canvasSettings: cloneDefaultCanvasSettings(),
    activeLayerId: 'tracks',
  };
}

export async function loadDefaultDrawingDocument(): Promise<EspDocument> {
  if (!defaultDocumentPromise) {
    defaultDocumentPromise = buildDefaultDrawingDocument();
  }
  return cloneDocument(await defaultDocumentPromise);
}

export const loadDefaultDwgDocument = loadDefaultDrawingDocument;

function objectBounds(obj: CanvasObject): { minX: number; minY: number; maxX: number; maxY: number } {
  if (obj.type === 'line') {
    const line = obj as LineObject;
    return {
      minX: Math.min(line.x, line.x + line.dx),
      minY: Math.min(line.y, line.y + line.dy),
      maxX: Math.max(line.x, line.x + line.dx),
      maxY: Math.max(line.y, line.y + line.dy),
    };
  }
  return {
    minX: obj.x,
    minY: obj.y,
    maxX: obj.x + obj.width,
    maxY: obj.y + obj.height,
  };
}

function cssPx(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function fitDefaultDrawingToViewport(
  objects: CanvasObject[],
  setZoom: (zoom: number) => void,
  setPan: (panX: number, panY: number) => void,
) {
  if (objects.length === 0) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const obj of objects) {
    const b = objectBounds(obj);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
    maxX = Math.max(maxX, b.maxX);
    maxY = Math.max(maxY, b.maxY);
  }

  const drawingWidth = Math.max(maxX - minX, 1);
  const drawingHeight = Math.max(maxY - minY, 1);
  const header = cssPx('--header-h', 48);
  const sidebar = cssPx('--sidebar-w', 64);
  const leftPanel = cssPx('--left-panel-w', 300);
  const rightPanel = cssPx('--panel-w', 320);
  const canvasWidth = Math.max(320, window.innerWidth - sidebar - leftPanel - rightPanel);
  const canvasHeight = Math.max(240, window.innerHeight - header - 140);
  const padding = 48;
  const zoom = Math.max(
    0.005,
    Math.min(1, Math.min((canvasWidth - padding * 2) / drawingWidth, (canvasHeight - padding * 2) / drawingHeight)),
  );

  setZoom(zoom);
  setPan(
    (canvasWidth - drawingWidth * zoom) / 2 - minX * zoom,
    (canvasHeight - drawingHeight * zoom) / 2 - minY * zoom,
  );
}

export const fitDefaultDwgToViewport = fitDefaultDrawingToViewport;
