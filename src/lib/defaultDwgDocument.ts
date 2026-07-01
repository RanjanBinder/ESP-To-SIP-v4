import defaultDwgUrl from '../../assets/POTHULAPADU_ESP.dwg?url';
import { DEFAULT_CANVAS_SETTINGS, DEFAULT_LAYERS } from '../store/editorStore';
import type { CanvasObject, LineObject } from '../types/scene';
import { DOCUMENT_VERSION, type EspDocument } from './serialize';
import { importDwgFile } from './dwgImporter';
import { POTHULAPADU_ASSETS } from '../data/pothulapaduAssets';

export const DEFAULT_DWG_META = {
  fileName: 'POTHULAPADU_ESP.dwg',
  stationCode: POTHULAPADU_ASSETS.stationCode,
  stationName: POTHULAPADU_ASSETS.stationName,
};

let defaultDocumentPromise: Promise<EspDocument> | null = null;

function cloneDefaultLayers() {
  return DEFAULT_LAYERS.map(layer => ({
    ...layer,
    customProperties: layer.customProperties?.map(prop => ({ ...prop })),
  }));
}

function cloneDefaultCanvasSettings() {
  return {
    ...DEFAULT_CANVAS_SETTINGS,
    modelName: 'Pothulapadu ESP',
    canvasName: 'Pothulapadu DWG',
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

async function buildDefaultDwgDocument(): Promise<EspDocument> {
  const response = await fetch(defaultDwgUrl);
  if (!response.ok) {
    throw new Error(`Failed to load ${DEFAULT_DWG_META.fileName}.`);
  }

  const defaultLayers = cloneDefaultLayers();
  const result = await importDwgFile(await response.arrayBuffer(), defaultLayers, 'tracks');

  return {
    version: DOCUMENT_VERSION,
    layers: [...defaultLayers, ...result.newLayers],
    objects: result.objects,
    canvasSettings: cloneDefaultCanvasSettings(),
    activeLayerId: 'tracks',
  };
}

export async function loadDefaultDwgDocument(): Promise<EspDocument> {
  if (!defaultDocumentPromise) {
    defaultDocumentPromise = buildDefaultDwgDocument();
  }
  return cloneDocument(await defaultDocumentPromise);
}

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

export function fitDefaultDwgToViewport(
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
