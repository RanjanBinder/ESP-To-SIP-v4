import { LibreDwg, createModule } from '@mlightcad/libredwg-web';
import type {
  DwgEntity,
  DwgLineEntity,
  DwgCircleEntity,
  DwgArcEntity,
  DwgLWPolylineEntity,
  DwgPolyline2dEntity,
  DwgTextEntity,
  DwgMTextEntity,
  DwgPointEntity,
} from '@mlightcad/libredwg-web';
import type { CanvasObject, LineObject, ArcObject, EllipseObject, TextObject } from '../types/scene';
import type { Layer } from '../store/editorStore';

const libredwgWasmUrl = new URL(
  '../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm',
  import.meta.url,
).href;

// ── WASM singleton ────────────────────────────────────────────────────────────
let cachedLib: ReturnType<typeof LibreDwg.createByWasmInstance> | null = null;

async function getLib() {
  if (!cachedLib) {
    const instance = await createModule({
      locateFile: (filename: string) => {
        if (filename === 'libredwg-web.wasm') return libredwgWasmUrl as string;
        return filename;
      },
    });
    cachedLib = LibreDwg.createByWasmInstance(instance);
  }
  return cachedLib;
}

// ── Full 255-entry AutoCAD Color Index (ACI) table ───────────────────────────
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const ACI_TABLE: string[] = (() => {
  const t = new Array<string>(256).fill('#6b7280');
  // Standard 1-9
  t[0] = '#000000'; t[1] = '#ff0000'; t[2] = '#ffff00'; t[3] = '#00ff00';
  t[4] = '#00ffff'; t[5] = '#0000ff'; t[6] = '#ff00ff';
  t[7] = '#000000'; // white → black on white background
  t[8] = '#414141'; t[9] = '#808080';
  // 10–239: 24 hue groups × 10 indices, 5 shade pairs per group
  const shades: [number, number][] = [[100,50],[100,75],[75,50],[50,50],[50,25]];
  for (let h = 0; h < 24; h++) {
    const hue = h * 15;
    const base = 10 + h * 10;
    shades.forEach(([s, l], i) => {
      const hex = hslToHex(hue, s, l);
      t[base + i * 2] = hex;
      t[base + i * 2 + 1] = hex;
    });
  }
  // 250–255: greyscale ramp
  t[250] = '#333333'; t[251] = '#505050'; t[252] = '#6a6a6a';
  t[253] = '#838383'; t[254] = '#bebebe'; t[255] = '#c8c8c8';
  return t;
})();

function aciToHex(n: number): string { return ACI_TABLE[n] ?? '#6b7280'; }

function dwgColorToHex(color: number | undefined): string {
  if (!color) return '#6b7280';
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  if (r > 230 && g > 230 && b > 230) return '#6b7280';
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function resolveEntityColor(entity: DwgEntity, layerColor: string, inheritColor: string): string {
  const e = entity as unknown as Record<string, unknown>;
  // True color (24-bit)
  if (typeof e.trueColor === 'number' && e.trueColor > 0) return dwgColorToHex(e.trueColor as number);
  if (typeof e.color24 === 'number' && e.color24 > 0) return dwgColorToHex(e.color24 as number);
  // ACI index
  const aci = e.colorIndex ?? e.color;
  if (typeof aci === 'number') {
    if (aci === 0)   return inheritColor; // BYBLOCK
    if (aci === 256) return layerColor;   // BYLAYER (default)
    if (aci > 0 && aci < 256) return aciToHex(aci);
  }
  return layerColor;
}

function resolveEntityWeight(entity: DwgEntity): number {
  const e = entity as unknown as Record<string, unknown>;
  const lw = e.lineWeight ?? e.lweight ?? e.lineWeightEnum;
  if (typeof lw !== 'number' || lw <= 0) return 1;
  if (lw <= 13) return 0.5;
  if (lw <= 25) return 1;
  if (lw <= 35) return 1.5;
  if (lw <= 50) return 2;
  if (lw <= 70) return 2.5;
  return 3;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stripMText(raw: string): string {
  return raw
    .replace(/\{\\[fFbBiIuUoOlLcCTpHqhwWaAnNA][^}]*\}/g, '')
    .replace(/\\P/g, '\n').replace(/\\~/g, ' ').replace(/\\\\/g, '\\')
    .replace(/\\[a-zA-Z][^;]*;/g, '').replace(/[{}]/g, '').trim();
}

function baseObj(
  entity: DwgEntity, layerId: string, name: string,
): Pick<CanvasObject, 'id' | 'name' | 'layerId' | 'locked' | 'visible' | 'rotation' | 'scale' | 'parentId'> {
  return { id: makeId(), name, layerId, locked: false, visible: entity.isVisible !== false, rotation: 0, scale: 100, parentId: null };
}

// ── 2-D insert transform (mirrors dxfImporter approach) ───────────────────────
interface InsertTransform {
  ix: number; iy: number;       // insertion point (DWG Y-up)
  scaleX: number; scaleY: number;
  cosR: number; sinR: number;
  bx: number; by: number;       // block base point
}
const IDENTITY: InsertTransform = { ix:0, iy:0, scaleX:1, scaleY:1, cosR:1, sinR:0, bx:0, by:0 };

function toWorld(px: number, py: number, t: InsertTransform): { x: number; y: number } {
  const rx = (px - t.bx) * t.scaleX;
  const ry = (py - t.by) * t.scaleY;
  return { x: rx * t.cosR - ry * t.sinR + t.ix, y: rx * t.sinR + ry * t.cosR + t.iy };
}
function toScreen(px: number, py: number, t: InsertTransform): { x: number; y: number } {
  const w = toWorld(px, py, t); return { x: w.x, y: -w.y };
}
function compose(outer: InsertTransform, inner: InsertTransform): InsertTransform {
  const ins = toWorld(inner.ix, inner.iy, outer);
  return {
    ix: ins.x, iy: ins.y,
    scaleX: outer.scaleX * inner.scaleX, scaleY: outer.scaleY * inner.scaleY,
    cosR: outer.cosR * inner.cosR - outer.sinR * inner.sinR,
    sinR: outer.sinR * inner.cosR + outer.cosR * inner.sinR,
    bx: inner.bx, by: inner.by,
  };
}

// ── Entity converters (transform-aware, color-aware) ─────────────────────────

function toLine(e: DwgLineEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): LineObject {
  const p1 = t === IDENTITY
    ? { x: e.startPoint.x, y: -e.startPoint.y }
    : toScreen(e.startPoint.x, e.startPoint.y, t);
  const p2 = t === IDENTITY
    ? { x: e.endPoint.x, y: -e.endPoint.y }
    : toScreen(e.endPoint.x, e.endPoint.y, t);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  return { ...baseObj(e, layerId, `Line ${idx}`), type: 'line',
    x: p1.x, y: p1.y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
    stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function toCircle(e: DwgCircleEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): EllipseObject {
  const r = e.radius * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const cen = t === IDENTITY ? { x: e.center.x, y: -e.center.y } : toScreen(e.center.x, e.center.y, t);
  return { ...baseObj(e, layerId, `Circle ${idx}`), type: 'ellipse',
    x: cen.x - r, y: cen.y - r, width: r * 2, height: r * 2,
    fill: 'transparent', stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function toArc(e: DwgArcEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): ArcObject {
  const r = e.radius * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const cen = t === IDENTITY ? { x: e.center.x, y: -e.center.y } : toScreen(e.center.x, e.center.y, t);
  const rotDeg = t === IDENTITY ? 0 : Math.atan2(t.sinR, t.cosR) * 180 / Math.PI;
  const startAngle = e.startAngle * 180 / Math.PI + rotDeg;
  const endAngle   = e.endAngle   * 180 / Math.PI + rotDeg;
  return { ...baseObj(e, layerId, `Arc ${idx}`), type: 'arc',
    x: cen.x - r, y: cen.y - r, width: r * 2, height: r * 2,
    startAngle, endAngle, stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function toLwPolyline(e: DwgLWPolylineEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): LineObject[] {
  const lines: LineObject[] = [];
  const verts = e.vertices;
  const pts = verts.map(v => t === IDENTITY ? { x: v.x, y: -v.y } : toScreen(v.x, v.y, t));
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    lines.push({ ...baseObj(e, layerId, `Poly${idx}_${i}`), type: 'line',
      x: pts[i].x, y: pts[i].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  if ((e.flag & 1) && pts.length >= 2) {
    const n = pts.length - 1;
    const dx = pts[0].x - pts[n].x, dy = pts[0].y - pts[n].y;
    lines.push({ ...baseObj(e, layerId, `Poly${idx}_close`), type: 'line',
      x: pts[n].x, y: pts[n].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  return lines;
}

function toPolyline2d(e: DwgPolyline2dEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): LineObject[] {
  const lines: LineObject[] = [];
  const verts = e.vertices;
  const pts = verts.map(v => t === IDENTITY ? { x: v.x, y: -v.y } : toScreen(v.x, v.y, t));
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    lines.push({ ...baseObj(e, layerId, `P2D${idx}_${i}`), type: 'line',
      x: pts[i].x, y: pts[i].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  return lines;
}

function toSpline(e: DwgEntity, t: InsertTransform, layerId: string, idx: number, c: string, w: number): LineObject[] {
  const se = e as unknown as Record<string, unknown>;
  // Prefer fit points when available
  let pts: { x: number; y: number }[] = [];
  const fitPts = se.fitPoints as Array<{x: number; y: number}> | undefined;
  const ctrlPts = se.controlPoints as Array<{x: number; y: number}> | undefined;
  const src = (fitPts && fitPts.length > 1) ? fitPts : (ctrlPts ?? []);
  pts = src.map(p => t === IDENTITY ? { x: p.x, y: -p.y } : toScreen(p.x, p.y, t));

  const lines: LineObject[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    lines.push({ ...baseObj(e, layerId, `Spline${idx}_${i}`), type: 'line',
      x: pts[i].x, y: pts[i].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  return lines;
}

function toText(e: DwgTextEntity, t: InsertTransform, layerId: string, idx: number, c: string): TextObject {
  const hAlign = e.halign ?? 0;
  const alignment: 'left' | 'center' | 'right' = hAlign === 1 ? 'center' : hAlign === 2 ? 'right' : 'left';
  const h = Math.max(e.textHeight ?? 12, 4);
  const pt = t === IDENTITY ? { x: e.startPoint.x, y: -e.startPoint.y - h } : toScreen(e.startPoint.x, e.startPoint.y, t);
  return { ...baseObj(e, layerId, `Text ${idx}`), type: 'text', anchor: 'top-left',
    x: pt.x, y: pt.y - h, width: Math.max(e.text.length * h * 0.6, 40), height: h * 1.4,
    value: e.text, textColor: c,
    fontSize: `${Math.round(h)}px`, fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
    bold: false, italic: false, underline: false, alignment, baseline: 'top' };
}

function toMText(e: DwgMTextEntity, t: InsertTransform, layerId: string, idx: number, c: string): TextObject {
  const text = stripMText(e.text);
  const h = Math.max(e.textHeight ?? 12, 4);
  const lines = text.split('\n').length;
  const pt = t === IDENTITY
    ? { x: e.insertionPoint.x, y: -e.insertionPoint.y }
    : toScreen(e.insertionPoint.x, e.insertionPoint.y, t);
  return { ...baseObj(e, layerId, `MText ${idx}`), type: 'text', anchor: 'top-left',
    x: pt.x, y: pt.y, width: Math.max(e.rectWidth || text.length * h * 0.6, 40), height: h * 1.4 * Math.max(lines, 1),
    value: text, textColor: c,
    fontSize: `${Math.round(h)}px`, fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
    bold: false, italic: false, underline: false, alignment: 'left', baseline: 'top' };
}

function toPoint(e: DwgPointEntity, t: InsertTransform, layerId: string, idx: number, c: string): EllipseObject {
  const pt = t === IDENTITY ? { x: e.position.x, y: -e.position.y } : toScreen(e.position.x, e.position.y, t);
  return { ...baseObj(e, layerId, `Point ${idx}`), type: 'ellipse',
    x: pt.x - 2, y: pt.y - 2, width: 4, height: 4,
    fill: c, stroke: c, strokeWidth: 1, strokeStyle: 'solid' };
}

// ── Block definition cache (from libredwg-web database) ───────────────────────
interface DwgBlockDef { baseX: number; baseY: number; entities: DwgEntity[]; }

function buildBlockMap(db: unknown): Map<string, DwgBlockDef> {
  const map = new Map<string, DwgBlockDef>();
  try {
    const d = db as Record<string, unknown>;
    const blocks = d.blocks as unknown[] | undefined;
    if (!Array.isArray(blocks)) return map;
    for (const b of blocks) {
      const block = b as Record<string, unknown>;
      const name = block.name as string | undefined;
      if (!name || name.startsWith('*')) continue; // skip *Model_Space etc.
      const bx = (block.basePoint as {x?: number})?.x ?? 0;
      const by = (block.basePoint as {y?: number})?.y ?? 0;
      const entities = (block.entities ?? block.objects ?? []) as DwgEntity[];
      map.set(name.toLowerCase(), { baseX: bx, baseY: by, entities });
    }
  } catch { /* library version may not expose blocks */ }
  return map;
}

// ── Entity dispatcher ─────────────────────────────────────────────────────────

function convertEntity(
  entity: DwgEntity,
  t: InsertTransform,
  layerId: string, idx: number,
  c: string, w: number,
  blockMap: Map<string, DwgBlockDef>,
  depth: number,
): CanvasObject | CanvasObject[] | null {
  switch (entity.type) {
    case 'LINE':       return toLine(entity as DwgLineEntity, t, layerId, idx, c, w);
    case 'CIRCLE':     return toCircle(entity as DwgCircleEntity, t, layerId, idx, c, w);
    case 'ARC':        return toArc(entity as DwgArcEntity, t, layerId, idx, c, w);
    case 'LWPOLYLINE': return toLwPolyline(entity as DwgLWPolylineEntity, t, layerId, idx, c, w);
    case 'POLYLINE2D': return toPolyline2d(entity as DwgPolyline2dEntity, t, layerId, idx, c, w);
    case 'SPLINE':     return toSpline(entity, t, layerId, idx, c, w);
    case 'TEXT':       return toText(entity as DwgTextEntity, t, layerId, idx, c);
    case 'MTEXT':      return toMText(entity as DwgMTextEntity, t, layerId, idx, c);
    case 'POINT':      return toPoint(entity as DwgPointEntity, t, layerId, idx, c);
    case 'INSERT':     return expandInsert(entity, t, layerId, idx, c, blockMap, depth);
    default:           return null;
  }
}

function expandInsert(
  entity: DwgEntity,
  parentT: InsertTransform,
  layerId: string, idx: number,
  inheritColor: string,
  blockMap: Map<string, DwgBlockDef>,
  depth: number,
): CanvasObject[] {
  if (depth > 8) return [];
  const e = entity as unknown as Record<string, unknown>;
  const blockName = (e.name ?? e.blockName ?? e.block ?? '') as string;
  const def = blockMap.get(blockName.toLowerCase());
  if (!def) return [];

  const rotRad = ((e.rotation ?? e.rotationAngle ?? 0) as number) * Math.PI / 180;
  const sx = (e.xScale ?? e.scaleX ?? 1) as number;
  const sy = (e.yScale ?? e.scaleY ?? 1) as number;
  const ip = (e.insertionPoint ?? e.position ?? { x: 0, y: 0 }) as { x: number; y: number };

  const innerT: InsertTransform = {
    ix: ip.x, iy: ip.y,
    scaleX: sx, scaleY: sy,
    cosR: Math.cos(rotRad), sinR: Math.sin(rotRad),
    bx: def.baseX, by: def.baseY,
  };
  const t = parentT === IDENTITY ? innerT : compose(parentT, innerT);

  const out: CanvasObject[] = [];
  let si = idx * 1000;
  for (const child of def.entities) {
    try {
      const cc = resolveEntityColor(child, layerId, inheritColor);
      const cw = resolveEntityWeight(child);
      const r = convertEntity(child, t, layerId, si++, cc, cw, blockMap, depth + 1);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r); else out.push(r);
    } catch { /* skip */ }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DwgImportResult {
  objects: CanvasObject[];
  newLayers: Layer[];
}

export async function importDwgFile(
  buffer: ArrayBuffer,
  existingLayers: Layer[],
  defaultLayerId: string,
): Promise<DwgImportResult> {
  const lib = await getLib();
  const ptr = lib.dwg_read_data(buffer, 0);
  if (!ptr) throw new Error('Failed to parse DWG file — file may be corrupted or unsupported.');

  const { database } = lib.convertEx(ptr);
  lib.dwg_free(ptr);

  // ── Block definitions (best-effort — not all libredwg-web versions expose this) ──
  const blockMap = buildBlockMap(database);

  // ── Layer table → ESP Layer objects ──────────────────────────────────────────
  const nameToId = new Map<string, string>();
  const layerColorMap = new Map<string, string>(); // key: lower-name → hex
  const newLayers: Layer[] = [];

  for (const l of existingLayers) {
    nameToId.set(l.name.toLowerCase(), l.id);
    layerColorMap.set(l.name.toLowerCase(), l.color);
  }

  const maxOrder = existingLayers.reduce((m, l) => Math.max(m, l.order), -1);
  let orderCtr = maxOrder + 1;

  for (const entry of database.tables.LAYER.entries) {
    const key = entry.name.toLowerCase();
    if (!nameToId.has(key)) {
      const hexColor = dwgColorToHex(entry.color);
      const id = `dwg-${entry.handle}-${Date.now()}`;
      newLayers.push({ id, name: entry.name, color: hexColor,
        visible: !entry.off && !entry.frozen, locked: entry.locked, opacity: 1, parentId: null, order: orderCtr++ });
      nameToId.set(key, id);
      layerColorMap.set(key, hexColor);
    }
  }

  const getLayerId    = (name: string) => nameToId.get(name.toLowerCase()) ?? defaultLayerId;
  const getLayerColor = (name: string) => layerColorMap.get(name.toLowerCase()) ?? '#6b7280';

  // ── Entity → CanvasObject ────────────────────────────────────────────────────
  const objects: CanvasObject[] = [];
  let idx = 0;

  for (const entity of database.entities) {
    if (entity.isInPaperSpace) continue;
    try {
      const layerName = entity.layer ?? '0';
      const layerId   = getLayerId(layerName);
      const layerColor = getLayerColor(layerName);
      const c = resolveEntityColor(entity, layerColor, '#6b7280');
      const w = resolveEntityWeight(entity);
      const converted = convertEntity(entity, IDENTITY, layerId, idx, c, w, blockMap, 0);
      if (!converted) { idx++; continue; }
      if (Array.isArray(converted)) objects.push(...converted); else objects.push(converted);
    } catch { /* skip malformed */ }
    idx++;
  }

  // ── Translate bounding box top-left to (50, 50) ───────────────────────────
  if (objects.length > 0) {
    let minX = Infinity, minY = Infinity;
    for (const obj of objects) {
      const x2 = obj.type === 'line' ? obj.x + (obj as LineObject).dx : obj.x + obj.width;
      const y2 = obj.type === 'line' ? obj.y + (obj as LineObject).dy : obj.y + obj.height;
      minX = Math.min(minX, obj.x, x2);
      minY = Math.min(minY, obj.y, y2);
    }
    const ox = 50 - minX, oy = 50 - minY;
    for (const obj of objects) { obj.x += ox; obj.y += oy; }
  }

  void defaultLayerId;
  return { objects, newLayers };
}
