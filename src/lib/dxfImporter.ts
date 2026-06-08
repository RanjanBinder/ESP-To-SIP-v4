/**
 * dxfImporter.ts — DXF parser with INSERT/block expansion, colour and line-weight support.
 *
 * Key improvements over v1:
 *  - Parses the BLOCKS section and builds a block-definition map.
 *  - Expands INSERT entities by inlining the referenced block's geometry with the
 *    correct position / rotation / scale transform applied (recursion-safe, depth ≤ 8).
 *  - Parses TABLES > LAYER for layer colours.
 *  - Preserves entity colour (ACI index 62, true-colour 420) and line weight (370).
 *  - Approximates SPLINE entities as polyline segments (fit-points preferred, else control points).
 *  - Handles ATTRIB (attribute text in blocks) identically to TEXT.
 */

import type { CanvasObject, LineObject, ArcObject, EllipseObject, TextObject } from '../types/scene';
import type { Layer } from '../store/editorStore';

// ── ACI (AutoCAD Color Index) lookup ─────────────────────────────────────────
// Full 256-entry table is huge; these are the colours actually used in railway ESPs.
const ACI: Partial<Record<number, string>> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00',  4: '#00ffff',
  5: '#0000ff', 6: '#ff00ff', 7: '#000000',
  8: '#414141', 9: '#808080',
  250: '#333333', 251: '#505050', 252: '#6a6a6a',
  253: '#838383', 254: '#bebebe', 255: '#c8c8c8',
};
function aciToHex(n: number): string { return ACI[n] ?? '#6b7280'; }
function trueColorHex(c: number): string {
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  if (r > 230 && g > 230 && b > 230) return '#6b7280'; // near-white → grey on light canvas
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ── Group-code parser ─────────────────────────────────────────────────────────
interface Gc { code: number; value: string; }
function parseGroupCodes(text: string): Gc[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: Gc[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const code = parseInt(lines[i].trim(), 10);
    if (!isNaN(code)) out.push({ code, value: lines[i + 1].trim() });
  }
  return out;
}

// ── Section slicer ────────────────────────────────────────────────────────────
// Returns a map of section-name → the group codes between SECTION and ENDSEC.
function sliceSections(gcs: Gc[]): Map<string, Gc[]> {
  const map = new Map<string, Gc[]>();
  let i = 0;
  while (i < gcs.length) {
    if (gcs[i].code === 0 && gcs[i].value === 'SECTION' && gcs[i + 1]?.code === 2) {
      const name = gcs[i + 1].value;
      const start = i + 2;
      let end = start;
      while (end < gcs.length && !(gcs[end].code === 0 && gcs[end].value === 'ENDSEC')) end++;
      map.set(name, gcs.slice(start, end));
      i = end + 1;
    } else i++;
  }
  return map;
}

// ── TABLES section → layer colour map ────────────────────────────────────────
function parseLayerColors(gcs: Gc[]): Map<string, string> {
  const colors = new Map<string, string>();
  let inLayerTable = false, name = '', aci = 7, trueC = -1;
  const flush = () => {
    if (!name) return;
    colors.set(name.toLowerCase(), trueC >= 0 ? trueColorHex(trueC) : aciToHex(Math.abs(aci)));
    name = ''; aci = 7; trueC = -1;
  };
  for (const { code, value } of gcs) {
    if (code === 0) {
      if (value === 'LAYER')  { flush(); inLayerTable = true; continue; }
      if (value === 'ENDTAB') { flush(); inLayerTable = false; continue; }
      if (value === 'TABLE')  { inLayerTable = false; continue; }
      if (inLayerTable)       { flush(); }
      continue;
    }
    if (!inLayerTable) continue;
    if (code ===   2) name  = value;
    if (code ===  62) aci   = parseInt(value);
    if (code === 420) trueC = parseInt(value);
  }
  flush();
  return colors;
}

// ── Raw entity ────────────────────────────────────────────────────────────────
interface RawEntity { type: string; codes: Map<number, string[]>; }

/** Parse a flat list of group codes into ordered RawEntity objects. */
function parseEntityList(gcs: Gc[]): RawEntity[] {
  const list: RawEntity[] = [];
  let cur: RawEntity | null = null;
  for (const { code, value } of gcs) {
    if (code === 0) {
      if (cur) list.push(cur);
      cur = value === 'SEQEND' ? null : { type: value, codes: new Map() };
    } else if (cur) {
      const arr = cur.codes.get(code) ?? [];
      arr.push(value);
      cur.codes.set(code, arr);
    }
  }
  if (cur) list.push(cur);
  return list;
}

// ── BLOCKS section → block-definition map ────────────────────────────────────
interface BlockDef { name: string; baseX: number; baseY: number; entities: RawEntity[]; }

function parseBlockDefs(gcs: Gc[]): Map<string, BlockDef> {
  const defs = new Map<string, BlockDef>();
  let i = 0;
  while (i < gcs.length) {
    if (gcs[i].code === 0 && gcs[i].value === 'BLOCK') {
      // Collect everything between BLOCK and ENDBLK
      const blockGcs: Gc[] = [];
      i++;
      while (i < gcs.length && !(gcs[i].code === 0 && gcs[i].value === 'ENDBLK')) {
        blockGcs.push(gcs[i]);
        i++;
      }
      // Split header (no code-0) from entity body (from first code-0 onwards)
      let name = '', baseX = 0, baseY = 0, entityStart = blockGcs.length;
      for (let j = 0; j < blockGcs.length; j++) {
        if (blockGcs[j].code === 2  && !name)  name  = blockGcs[j].value;
        if (blockGcs[j].code === 10)            baseX = parseFloat(blockGcs[j].value);
        if (blockGcs[j].code === 20)            baseY = parseFloat(blockGcs[j].value);
        if (blockGcs[j].code === 0)             { entityStart = j; break; }
      }
      const entities = parseEntityList(blockGcs.slice(entityStart));
      // *Model_Space / *Paper_Space are pseudo-blocks — skip them
      if (name && !name.startsWith('*')) {
        defs.set(name.toLowerCase(), { name, baseX, baseY, entities });
      }
    }
    i++;
  }
  return defs;
}

// ── Accessors ─────────────────────────────────────────────────────────────────
function num(e: RawEntity, code: number, def = 0): number {
  const v = e.codes.get(code)?.[0]; return v !== undefined ? parseFloat(v) : def;
}
function str(e: RawEntity, code: number, def = ''): string {
  return e.codes.get(code)?.[0] ?? def;
}
function resolveColor(
  e: RawEntity, layerColors: Map<string, string>, layerName: string, inheritColor: string,
): string {
  const trueC = e.codes.get(420)?.[0];
  if (trueC) return trueColorHex(parseInt(trueC));
  const aciStr = e.codes.get(62)?.[0];
  if (aciStr) {
    const aci = parseInt(aciStr);
    if (aci === 0)   return inheritColor; // BYBLOCK — inherit from INSERT
    if (aci === 256 || aci < 0) return layerColors.get(layerName.toLowerCase()) ?? '#6b7280'; // BYLAYER
    return aciToHex(aci);
  }
  return layerColors.get(layerName.toLowerCase()) ?? '#6b7280';
}
function resolveWeight(e: RawEntity): number {
  const lw = parseInt(e.codes.get(370)?.[0] ?? '-1');
  if (lw <= 0)   return 1;
  if (lw <= 13)  return 0.5;
  if (lw <= 25)  return 1;
  if (lw <= 35)  return 1.5;
  if (lw <= 50)  return 2;
  if (lw <= 70)  return 2.5;
  return 3;
}
function stripMText(raw: string): string {
  return raw
    .replace(/\{\\[fFbBiIuUoOlLcCTpHqhwWaAnNA][^}]*\}/g, '')
    .replace(/\\P/g, '\n').replace(/\\~/g, ' ').replace(/\\\\/g, '\\')
    .replace(/\\[a-zA-Z][^;]*;/g, '').replace(/[{}]/g, '').trim();
}

// ── 2-D insert transform ──────────────────────────────────────────────────────
interface InsertTransform {
  ix: number; iy: number;     // insertion point (DXF Y-up world)
  scaleX: number; scaleY: number;
  cosR: number; sinR: number; // rotation (CCW in Y-up)
  bx: number; by: number;     // block base point (DXF Y-up)
}
const IDENTITY: InsertTransform = { ix:0, iy:0, scaleX:1, scaleY:1, cosR:1, sinR:0, bx:0, by:0 };

/** Transform a point from block-definition (Y-up) space to world (Y-up) space. */
function toWorld(px: number, py: number, t: InsertTransform): { x: number; y: number } {
  const rx = (px - t.bx) * t.scaleX;
  const ry = (py - t.by) * t.scaleY;
  return { x: rx * t.cosR - ry * t.sinR + t.ix, y: rx * t.sinR + ry * t.cosR + t.iy };
}
/** Transform a point to canvas screen space (Y-down). */
function toScreen(px: number, py: number, t: InsertTransform): { x: number; y: number } {
  const w = toWorld(px, py, t); return { x: w.x, y: -w.y };
}
/** Compose outer ∘ inner so a point in inner's block space maps directly to world space. */
function compose(outer: InsertTransform, inner: InsertTransform): InsertTransform {
  const ins = toWorld(inner.ix, inner.iy, outer);
  return {
    ix: ins.x, iy: ins.y,
    scaleX: outer.scaleX * inner.scaleX,
    scaleY: outer.scaleY * inner.scaleY,
    cosR: outer.cosR * inner.cosR - outer.sinR * inner.sinR,
    sinR: outer.sinR * inner.cosR + outer.cosR * inner.sinR,
    bx: inner.bx, by: inner.by,
  };
}

// ── ID / base ─────────────────────────────────────────────────────────────────
let _ctr = 1;
const makeId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `dxf-${Date.now()}-${_ctr++}`;
const BASE = { locked: false, visible: true, rotation: 0, scale: 100, parentId: null } as const;

// ── Entity converters (all transform-aware) ───────────────────────────────────

function convLine(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, w: number): LineObject {
  const p1 = toScreen(num(e, 10), num(e, 20), t);
  const p2 = toScreen(num(e, 11), num(e, 21), t);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  return { ...BASE, id: makeId(), name: `Line ${idx}`, type: 'line', layerId: lid,
    x: p1.x, y: p1.y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
    stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function convCircle(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, w: number): EllipseObject {
  const r  = num(e, 40) * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const cen = toScreen(num(e, 10), num(e, 20), t);
  return { ...BASE, id: makeId(), name: `Circle ${idx}`, type: 'ellipse', layerId: lid,
    x: cen.x - r, y: cen.y - r, width: r * 2, height: r * 2,
    fill: 'transparent', stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function convArc(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, w: number): ArcObject {
  const r   = num(e, 40) * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const cen = toScreen(num(e, 10), num(e, 20), t);
  const rotDeg = Math.atan2(t.sinR, t.cosR) * 180 / Math.PI;
  return { ...BASE, id: makeId(), name: `Arc ${idx}`, type: 'arc', layerId: lid,
    x: cen.x - r, y: cen.y - r, width: r * 2, height: r * 2,
    startAngle: num(e, 50) + rotDeg,
    endAngle:   num(e, 51) + rotDeg,
    stroke: c, strokeWidth: w, strokeStyle: 'solid' };
}

function convLwPolyline(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, w: number): LineObject[] {
  const xs = (e.codes.get(10) ?? []).map(parseFloat);
  const ys = (e.codes.get(20) ?? []).map(parseFloat);
  const closed = (Math.round(num(e, 70)) & 1) !== 0;
  const pts = xs.map((x, i) => toScreen(x, ys[i] ?? 0, t));
  const lines: LineObject[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    lines.push({ ...BASE, id: makeId(), name: `Poly${idx}_${i}`, type: 'line', layerId: lid,
      x: pts[i].x, y: pts[i].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  if (closed && pts.length >= 2) {
    const n = pts.length - 1;
    const dx = pts[0].x - pts[n].x, dy = pts[0].y - pts[n].y;
    lines.push({ ...BASE, id: makeId(), name: `Poly${idx}_close`, type: 'line', layerId: lid,
      x: pts[n].x, y: pts[n].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  return lines;
}

function convSpline(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, w: number): LineObject[] {
  // Prefer fit points (code 11/21, lie ON the curve) over control points (10/20)
  const hasFit = parseInt(e.codes.get(74)?.[0] ?? '0') > 0;
  const xs = (e.codes.get(hasFit ? 11 : 10) ?? []).map(parseFloat);
  const ys = (e.codes.get(hasFit ? 21 : 20) ?? []).map(parseFloat);
  const pts = xs.map((x, i) => toScreen(x, ys[i] ?? 0, t));
  const lines: LineObject[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i+1].x - pts[i].x, dy = pts[i+1].y - pts[i].y;
    lines.push({ ...BASE, id: makeId(), name: `Spline${idx}_${i}`, type: 'line', layerId: lid,
      x: pts[i].x, y: pts[i].y, width: Math.abs(dx), height: Math.abs(dy), dx, dy,
      stroke: c, strokeWidth: w, strokeStyle: 'solid' });
  }
  return lines;
}

function convText(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string, label: string): TextObject {
  const pt   = toScreen(num(e, 10), num(e, 20), t);
  const text = str(e, 1) || label || '?';
  const h    = Math.max(num(e, 40, 12), 4);
  const hAlign = Math.round(num(e, 72));
  const alignment: 'left'|'center'|'right' = hAlign === 1 ? 'center' : hAlign === 2 ? 'right' : 'left';
  return { ...BASE, id: makeId(), name: `Text ${idx}`, type: 'text', layerId: lid, anchor: 'top-left',
    x: pt.x, y: pt.y - h, width: Math.max(text.length * h * 0.6, 40), height: h * 1.4,
    value: text, textColor: c || '#111827',
    fontSize: `${Math.round(h)}px`, fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
    bold: false, italic: false, underline: false, alignment, baseline: 'top' };
}

function convMText(e: RawEntity, t: InsertTransform, lid: string, idx: number, c: string): TextObject {
  const raw  = [...(e.codes.get(3) ?? []), str(e, 1)].join('');
  const text = stripMText(raw);
  const pt   = toScreen(num(e, 10), num(e, 20), t);
  const h    = Math.max(num(e, 40, 12), 4);
  const lines = text.split('\n').length;
  return { ...BASE, id: makeId(), name: `MText ${idx}`, type: 'text', layerId: lid, anchor: 'top-left',
    x: pt.x, y: pt.y, width: Math.max(num(e, 43, text.length * h * 0.6), 40), height: h * 1.4 * Math.max(lines, 1),
    value: text, textColor: c || '#111827',
    fontSize: `${Math.round(h)}px`, fontFamily: 'Inter, sans-serif', fontStyle: 'normal',
    bold: false, italic: false, underline: false, alignment: 'left', baseline: 'top' };
}

// ── INSERT expansion ──────────────────────────────────────────────────────────

function convertOne(
  e: RawEntity, t: InsertTransform,
  blockDefs: Map<string, BlockDef>, lid: string, idx: number, depth: number,
  layerColors: Map<string, string>, inheritColor: string,
): CanvasObject | CanvasObject[] | null {
  const layerName = str(e, 8) || '0';
  const c = resolveColor(e, layerColors, layerName, inheritColor);
  const w = resolveWeight(e);
  switch (e.type) {
    case 'LINE':       return convLine(e, t, lid, idx, c, w);
    case 'ARC':        return convArc(e, t, lid, idx, c, w);
    case 'CIRCLE':     return convCircle(e, t, lid, idx, c, w);
    case 'LWPOLYLINE': return convLwPolyline(e, t, lid, idx, c, w);
    case 'SPLINE':     return convSpline(e, t, lid, idx, c, w);
    case 'TEXT':
    case 'ATTRIB':     return convText(e, t, lid, idx, c, '');
    case 'MTEXT':      return convMText(e, t, lid, idx, c);
    case 'INSERT':     return expandInsert(e, t, blockDefs, lid, idx, depth + 1, layerColors, c);
    default:           return null;
  }
}

function expandInsert(
  insertE: RawEntity, parentT: InsertTransform,
  blockDefs: Map<string, BlockDef>, lid: string, idx: number, depth: number,
  layerColors: Map<string, string>, inheritColor: string,
): CanvasObject[] {
  if (depth > 8) return [];
  const blockName = str(insertE, 2);
  const def = blockDefs.get(blockName.toLowerCase());
  if (!def) return [];

  const rotDeg = num(insertE, 50, 0);
  const rotRad = rotDeg * Math.PI / 180;
  const innerT: InsertTransform = {
    ix: num(insertE, 10), iy: num(insertE, 20),
    scaleX: num(insertE, 41, 1), scaleY: num(insertE, 42, 1),
    cosR: Math.cos(rotRad), sinR: Math.sin(rotRad),
    bx: def.baseX, by: def.baseY,
  };
  const t = parentT === IDENTITY ? innerT : compose(parentT, innerT);

  const out: CanvasObject[] = [];
  let si = idx * 1000;
  for (const e of def.entities) {
    try {
      const r = convertOne(e, t, blockDefs, lid, si++, depth, layerColors, inheritColor);
      if (!r) continue;
      if (Array.isArray(r)) out.push(...r); else out.push(r);
    } catch { /* skip malformed */ }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface DxfImportResult { objects: CanvasObject[]; newLayers: Layer[]; }

export async function importDxfFile(
  buffer: ArrayBuffer,
  existingLayers: Layer[],
  defaultLayerId: string,
): Promise<DxfImportResult> {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  const gcs = parseGroupCodes(text);
  const sections = sliceSections(gcs);

  const layerColors = sections.has('TABLES') ? parseLayerColors(sections.get('TABLES')!) : new Map<string, string>();
  const blockDefs   = sections.has('BLOCKS') ? parseBlockDefs(sections.get('BLOCKS')!)   : new Map<string, BlockDef>();
  const rawEntities = sections.has('ENTITIES') ? parseEntityList(sections.get('ENTITIES')!) : [];

  // Layer ID map
  const nameToId = new Map<string, string>();
  const newLayers: Layer[] = [];
  for (const l of existingLayers) nameToId.set(l.name.toLowerCase(), l.id);
  const maxOrder = existingLayers.reduce((m, l) => Math.max(m, l.order), -1);
  let orderCtr = maxOrder + 1;

  const getLayerId = (name: string): string => {
    const key = (name || '0').toLowerCase();
    if (!nameToId.has(key)) {
      const color = layerColors.get(key) ?? '#6b7280';
      const id = `dxf-layer-${key}-${Date.now()}`;
      newLayers.push({ id, name: name || '0', color, visible: true, locked: false, opacity: 1, parentId: null, order: orderCtr++ });
      nameToId.set(key, id);
    }
    return nameToId.get(key)!;
  };

  const objects: CanvasObject[] = [];
  let idx = 0;

  for (const e of rawEntities) {
    try {
      const layerName = str(e, 8) || '0';
      const lid   = getLayerId(layerName);
      const color = resolveColor(e, layerColors, layerName, '#6b7280');
      const weight = resolveWeight(e);
      let converted: CanvasObject | CanvasObject[] | null;

      if (e.type === 'INSERT') {
        converted = expandInsert(e, IDENTITY, blockDefs, lid, idx, 0, layerColors, color);
      } else {
        converted = convertOne(e, IDENTITY, blockDefs, lid, idx, 0, layerColors, color);
        // Also apply weight to top-level entities (convertOne uses resolveWeight internally)
        void weight;
      }

      if (!converted) { idx++; continue; }
      if (Array.isArray(converted)) objects.push(...converted); else objects.push(converted);
    } catch { /* skip malformed */ }
    idx++;
  }

  // Translate bounding box so top-left sits at (50, 50)
  if (objects.length > 0) {
    let minX = Infinity, minY = Infinity;
    for (const o of objects) {
      const x2 = o.type === 'line' ? o.x + (o as LineObject).dx : o.x + o.width;
      const y2 = o.type === 'line' ? o.y + (o as LineObject).dy : o.y + o.height;
      minX = Math.min(minX, o.x, x2);
      minY = Math.min(minY, o.y, y2);
    }
    const ox = 50 - minX, oy = 50 - minY;
    for (const o of objects) { o.x += ox; o.y += oy; }
  }

  void defaultLayerId;
  return { objects, newLayers };
}
