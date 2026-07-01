import { Dwg_File_Type, LibreDwg, createModule } from '@mlightcad/libredwg-web';
import type {
  DwgArcEdge,
  DwgArcEntity,
  DwgBoundaryPath,
  DwgCircleEntity,
  DwgDatabase,
  DwgEdgeBoundaryPath,
  DwgEllipseEdge,
  DwgEllipseEntity,
  DwgEntity,
  DwgHatchEntity,
  DwgLineEdge,
  DwgLineEntity,
  DwgLeaderEntity,
  DwgLWPolylineEntity,
  DwgMTextEntity,
  DwgOle2FrameEntity,
  DwgPointEntity,
  DwgPolyline2dEntity,
  DwgPolyline3dEntity,
  DwgSplineEdge,
  DwgTextEntity,
} from '@mlightcad/libredwg-web';
import type { CanvasObject, LineObject, EllipseObject, TextObject } from '../types/scene';
import type { Layer } from '../store/editorStore';

const libredwgWasmUrl = new URL(
  '../../node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.wasm',
  import.meta.url,
).href;

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

// AutoCAD Color Index values. Missing entries fall back to a readable neutral.
const ACI: Partial<Record<number, string>> = {
  1: '#ff0000',
  2: '#ffff00',
  3: '#00ff00',
  4: '#00ffff',
  5: '#0000ff',
  6: '#ff00ff',
  7: '#000000',
  8: '#414141',
  9: '#808080',
  250: '#333333',
  251: '#505050',
  252: '#6a6a6a',
  253: '#838383',
  254: '#bebebe',
  255: '#c8c8c8',
};

const EPS = 1e-7;
const ID_PREFIX = 'dwg';

interface Point2 {
  x: number;
  y: number;
}

interface Point3 extends Point2 {
  z?: number;
}

interface InsertTransform {
  ix: number;
  iy: number;
  scaleX: number;
  scaleY: number;
  cosR: number;
  sinR: number;
  bx: number;
  by: number;
}

interface DwgBlockDef {
  baseX: number;
  baseY: number;
  entities: DwgEntity[];
}

interface ImportContext {
  blockMap: Map<string, DwgBlockDef>;
  getLayerId: (name: string) => string;
  getLayerColor: (name: string) => string;
}

const IDENTITY: InsertTransform = {
  ix: 0,
  iy: 0,
  scaleX: 1,
  scaleY: 1,
  cosR: 1,
  sinR: 0,
  bx: 0,
  by: 0,
};

function aciToHex(n: number): string {
  return ACI[Math.abs(Math.round(n))] ?? '#6b7280';
}

function rgbIntToHex(color: number | undefined): string {
  if (!color || color <= 0) return '#6b7280';
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  if (r > 235 && g > 235 && b > 235) return '#6b7280';
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function resolveLayerColor(entry: { colorIndex?: number; color?: number }): string {
  if (typeof entry.colorIndex === 'number' && entry.colorIndex > 0 && entry.colorIndex < 256) {
    return aciToHex(entry.colorIndex);
  }
  return rgbIntToHex(entry.color);
}

function resolveEntityColor(entity: DwgEntity, layerColor: string, inheritColor: string): string {
  const e = entity as unknown as Record<string, unknown>;
  if (typeof e.trueColor === 'number' && e.trueColor > 0) return rgbIntToHex(e.trueColor);
  if (typeof e.color24 === 'number' && e.color24 > 0) return rgbIntToHex(e.color24);
  if (typeof e.color === 'number' && e.color > 255) return rgbIntToHex(e.color);

  const aci = e.colorIndex ?? e.color;
  if (typeof aci === 'number') {
    if (aci === 0) return inheritColor;
    if (aci === 256 || aci < 0) return layerColor;
    if (aci > 0 && aci < 256) return aciToHex(aci);
  }
  return layerColor;
}

function resolveEntityWeight(entity: DwgEntity): number {
  const e = entity as unknown as Record<string, unknown>;
  const lw = e.lineweight ?? e.lineWeight ?? e.lweight ?? e.lineWeightEnum;
  if (typeof lw !== 'number' || lw <= 0) return 1;
  if (lw <= 13) return 0.5;
  if (lw <= 25) return 1;
  if (lw <= 35) return 1.5;
  if (lw <= 50) return 2;
  if (lw <= 70) return 2.5;
  return 3;
}

function makeId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${ID_PREFIX}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stripMText(raw: string): string {
  return raw
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\P/g, '\n')
    .replace(/\\~/g, ' ')
    .replace(/\\\\/g, '\\')
    .replace(/%%(d|p|c|%)/gi, '')
    .replace(/\\[Ff][^;\\]*?(?:\|[^;\\]*)*;/g, '')
    .replace(/\\[a-zA-Z][^;]*;?/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function baseObj(
  entity: DwgEntity,
  layerId: string,
  name: string,
): Pick<CanvasObject, 'id' | 'name' | 'layerId' | 'locked' | 'visible' | 'rotation' | 'scale' | 'parentId'> {
  return {
    id: makeId(),
    name,
    layerId,
    locked: false,
    visible: entity.isVisible !== false,
    rotation: 0,
    scale: 100,
    parentId: null,
  };
}

function toWorld(px: number, py: number, t: InsertTransform): Point2 {
  const rx = (px - t.bx) * t.scaleX;
  const ry = (py - t.by) * t.scaleY;
  return {
    x: rx * t.cosR - ry * t.sinR + t.ix,
    y: rx * t.sinR + ry * t.cosR + t.iy,
  };
}

function toScreen(px: number, py: number, t: InsertTransform): Point2 {
  const w = toWorld(px, py, t);
  return { x: w.x, y: -w.y };
}

function compose(outer: InsertTransform, inner: InsertTransform): InsertTransform {
  const ins = toWorld(inner.ix, inner.iy, outer);
  return {
    ix: ins.x,
    iy: ins.y,
    scaleX: outer.scaleX * inner.scaleX,
    scaleY: outer.scaleY * inner.scaleY,
    cosR: outer.cosR * inner.cosR - outer.sinR * inner.sinR,
    sinR: outer.sinR * inner.cosR + outer.cosR * inner.sinR,
    bx: inner.bx,
    by: inner.by,
  };
}

function screenPoint(point: Point3, t: InsertTransform): Point2 {
  return t === IDENTITY ? { x: point.x, y: -point.y } : toScreen(point.x, point.y, t);
}

function lineObject(
  entity: DwgEntity,
  layerId: string,
  name: string,
  from: Point2,
  to: Point2,
  color: string,
  weight: number,
): LineObject | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < EPS) return null;
  return {
    ...baseObj(entity, layerId, name),
    type: 'line',
    x: from.x,
    y: from.y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    dx,
    dy,
    stroke: color,
    strokeWidth: weight,
    strokeStyle: 'solid',
  };
}

function pointsToLines(
  entity: DwgEntity,
  points: Point2[],
  layerId: string,
  idx: number,
  color: string,
  weight: number,
  prefix: string,
): LineObject[] {
  const lines: LineObject[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const line = lineObject(entity, layerId, `${prefix}${idx}_${i}`, points[i], points[i + 1], color, weight);
    if (line) lines.push(line);
  }
  return lines;
}

function normalizeAngleRange(start: number, end: number): { start: number; end: number; sweep: number } {
  let sweep = end - start;
  while (sweep <= 0) sweep += Math.PI * 2;
  if (Math.abs(sweep) < EPS || Math.abs(sweep - Math.PI * 2) < EPS) sweep = Math.PI * 2;
  return { start, end: start + sweep, sweep };
}

function ellipsePoints(
  center: Point3,
  majorAxisEndPoint: Point3,
  axisRatio: number,
  startAngle: number,
  endAngle: number,
  t: InsertTransform,
): Point2[] {
  const rx = Math.hypot(majorAxisEndPoint.x, majorAxisEndPoint.y);
  const ry = Math.max(Math.abs(axisRatio * rx), EPS);
  const axisAngle = Math.atan2(majorAxisEndPoint.y, majorAxisEndPoint.x);
  const { start, sweep } = normalizeAngleRange(startAngle, endAngle);
  const segments = Math.max(24, Math.min(144, Math.ceil(Math.abs(sweep) / (Math.PI / 36))));
  const pts: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (sweep * i) / segments;
    const lx = Math.cos(a) * rx;
    const ly = Math.sin(a) * ry;
    const x = center.x + lx * Math.cos(axisAngle) - ly * Math.sin(axisAngle);
    const y = center.y + lx * Math.sin(axisAngle) + ly * Math.cos(axisAngle);
    pts.push(screenPoint({ x, y }, t));
  }
  return pts;
}

function bulgeIntermediates(from: Point3, to: Point3, bulge = 0): Point3[] {
  if (Math.abs(bulge) < EPS) return [];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord < EPS) return [];

  const sweep = 4 * Math.atan(bulge);
  const radius = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const left = { x: -dy / chord, y: dx / chord };
  const centerDist = (chord * (1 - bulge * bulge)) / (4 * bulge);
  const center = {
    x: mid.x + left.x * centerDist,
    y: mid.y + left.y * centerDist,
  };
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  const segments = Math.max(4, Math.min(72, Math.ceil(Math.abs(sweep) / (Math.PI / 24))));
  const pts: Point3[] = [];
  for (let i = 1; i < segments; i++) {
    const a = start + (sweep * i) / segments;
    pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
  }
  return pts;
}

function polylinePoints(vertices: Array<Point3 & { bulge?: number }>, closed: boolean, t: InsertTransform): Point2[] {
  if (vertices.length === 0) return [];
  const source = closed ? [...vertices, vertices[0]] : vertices;
  const pts: Point3[] = [];
  for (let i = 0; i < source.length - 1; i++) {
    const from = source[i];
    const to = source[i + 1];
    pts.push(from);
    pts.push(...bulgeIntermediates(from, to, from.bulge));
    if (i === source.length - 2) pts.push(to);
  }
  if (source.length === 1) pts.push(source[0]);
  return pts.map(p => screenPoint(p, t));
}

function toLine(e: DwgLineEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject | null {
  return lineObject(
    e,
    layerId,
    `Line ${idx}`,
    screenPoint(e.startPoint, t),
    screenPoint(e.endPoint, t),
    color,
    weight,
  );
}

function toCircle(e: DwgCircleEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): EllipseObject {
  const r = e.radius * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const cen = screenPoint(e.center, t);
  return {
    ...baseObj(e, layerId, `Circle ${idx}`),
    type: 'ellipse',
    x: cen.x - r,
    y: cen.y - r,
    width: r * 2,
    height: r * 2,
    fill: 'transparent',
    stroke: color,
    strokeWidth: weight,
    strokeStyle: 'solid',
  };
}

function toArcLines(e: DwgArcEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const { start, sweep } = normalizeAngleRange(e.startAngle, e.endAngle);
  const segments = Math.max(12, Math.min(96, Math.ceil(Math.abs(sweep) / (Math.PI / 36))));
  const pts: Point2[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + (sweep * i) / segments;
    pts.push(screenPoint({
      x: e.center.x + Math.cos(a) * e.radius,
      y: e.center.y + Math.sin(a) * e.radius,
    }, t));
  }
  return pointsToLines(e, pts, layerId, idx, color, weight, 'Arc');
}

function toLwPolyline(e: DwgLWPolylineEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const closed = (e.flag & 1) !== 0 || (e.flag & 0x200) !== 0;
  return pointsToLines(e, polylinePoints(e.vertices, closed, t), layerId, idx, color, weight, 'Poly');
}

function toPolyline(
  e: DwgPolyline2dEntity | DwgPolyline3dEntity,
  t: InsertTransform,
  layerId: string,
  idx: number,
  color: string,
  weight: number,
): LineObject[] {
  const closed = (e.flag & 1) !== 0;
  return pointsToLines(e, polylinePoints(e.vertices as Array<Point3 & { bulge?: number }>, closed, t), layerId, idx, color, weight, 'PLine');
}

function toSpline(e: DwgEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const se = e as unknown as Record<string, unknown>;
  const fitPts = se.fitPoints as Point3[] | undefined;
  const ctrlPts = se.controlPoints as Point3[] | undefined;
  const src = fitPts && fitPts.length > 1 ? fitPts : ctrlPts ?? [];
  return pointsToLines(e, src.map(p => screenPoint(p, t)), layerId, idx, color, weight, 'Spline');
}

function toEllipse(e: DwgEllipseEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  return pointsToLines(
    e,
    ellipsePoints(e.center, e.majorAxisEndPoint, e.axisRatio, e.startAngle, e.endAngle, t),
    layerId,
    idx,
    color,
    weight,
    'Ellipse',
  );
}

function textRotation(entityRotation: number | undefined, t: InsertTransform): number {
  const base = (entityRotation ?? 0) * 180 / Math.PI;
  const insertRot = t === IDENTITY ? 0 : Math.atan2(t.sinR, t.cosR) * 180 / Math.PI;
  return -(base + insertRot);
}

function toTextBase(
  e: DwgEntity,
  value: string,
  startPoint: Point3,
  textHeight: number | undefined,
  rotation: number | undefined,
  halign: number | undefined,
  t: InsertTransform,
  layerId: string,
  idx: number,
  color: string,
  name = 'Text',
): TextObject {
  const h = Math.max(textHeight ?? 12, 4) * Math.sqrt(Math.abs(t.scaleX * t.scaleY));
  const alignment: 'left' | 'center' | 'right' = halign === 1 ? 'center' : halign === 2 ? 'right' : 'left';
  const pt = screenPoint(startPoint, t);
  return {
    ...baseObj(e, layerId, `${name} ${idx}`),
    type: 'text',
    anchor: 'top-left',
    x: pt.x,
    y: pt.y - h,
    width: Math.max(value.length * h * 0.6, 40),
    height: h * 1.4 * Math.max(value.split('\n').length, 1),
    rotation: textRotation(rotation, t),
    value,
    textColor: color,
    fontSize: `${Math.round(h)}px`,
    fontFamily: 'Inter, sans-serif',
    fontStyle: 'normal',
    bold: false,
    italic: false,
    underline: false,
    alignment,
    baseline: 'top',
  };
}

function toText(e: DwgTextEntity, t: InsertTransform, layerId: string, idx: number, color: string): TextObject {
  return toTextBase(e, e.text, e.startPoint, e.textHeight, e.rotation, e.halign, t, layerId, idx, color);
}

function toAttrib(e: DwgEntity, t: InsertTransform, layerId: string, idx: number, color: string): TextObject | null {
  const attrib = e as unknown as {
    text?: Partial<DwgTextEntity> & { text?: string };
    tag?: string;
    attrTag?: string;
    flags?: number;
  };
  if (attrib.flags && (attrib.flags & 1) !== 0) return null;
  const text = attrib.text;
  const value = text?.text ?? attrib.tag ?? attrib.attrTag ?? '';
  if (!value) return null;
  return toTextBase(
    e,
    value,
    (text?.startPoint ?? { x: 0, y: 0 }) as Point3,
    text?.textHeight,
    text?.rotation,
    text?.halign,
    t,
    layerId,
    idx,
    color,
    'Attrib',
  );
}

function toMText(e: DwgMTextEntity, t: InsertTransform, layerId: string, idx: number, color: string): TextObject {
  const text = stripMText(e.text);
  const obj = toTextBase(e, text, e.insertionPoint, e.textHeight, e.rotation, undefined, t, layerId, idx, color, 'MText');
  obj.width = Math.max((e.rectWidth || e.extentsWidth || text.length * parseFloat(obj.fontSize) * 0.6), 40);
  return obj;
}

function toPoint(e: DwgPointEntity, t: InsertTransform, layerId: string, idx: number, color: string): EllipseObject {
  const pointEntity = e as DwgPointEntity & { position?: Point3; point?: Point3 };
  const pt = screenPoint(pointEntity.position ?? pointEntity.point ?? { x: 0, y: 0 }, t);
  return {
    ...baseObj(e, layerId, `Point ${idx}`),
    type: 'ellipse',
    x: pt.x - 2,
    y: pt.y - 2,
    width: 4,
    height: 4,
    fill: color,
    stroke: color,
    strokeWidth: 1,
    strokeStyle: 'solid',
  };
}

function toSolidOutline(e: DwgEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const solid = e as unknown as { points?: Point3[]; corner1?: Point3; corner2?: Point3; corner3?: Point3; corner4?: Point3 };
  const source = solid.points ?? [solid.corner1, solid.corner2, solid.corner3, solid.corner4].filter((p): p is Point3 => !!p);
  const pts = source.map(p => screenPoint(p, t));
  if (pts.length >= 3) pts.push(pts[0]);
  return pointsToLines(e, pts, layerId, idx, color, weight, 'Solid');
}

function to3dFaceOutline(e: DwgEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const face = e as unknown as { corner1: Point3; corner2: Point3; corner3: Point3; corner4?: Point3; flag?: number };
  const corners = [face.corner1, face.corner2, face.corner3, face.corner4 ?? face.corner3].filter(Boolean);
  const pts = corners.map(p => screenPoint(p, t));
  if (pts.length >= 3) pts.push(pts[0]);
  return pointsToLines(e, pts, layerId, idx, color, weight, 'Face');
}

function toLeader(e: DwgLeaderEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const pts = (e.vertices ?? []).map(p => screenPoint(p, t));
  const lines = pointsToLines(e, pts, layerId, idx, color, weight, 'Leader');
  if (!e.isArrowheadEnabled || pts.length < 2) return lines;

  const tip = pts[0];
  const next = pts[1];
  const angle = Math.atan2(next.y - tip.y, next.x - tip.x);
  const length = Math.max(6, Math.min(18, weight * 7));
  const spread = Math.PI / 7;
  const left = {
    x: tip.x + Math.cos(angle + spread) * length,
    y: tip.y + Math.sin(angle + spread) * length,
  };
  const right = {
    x: tip.x + Math.cos(angle - spread) * length,
    y: tip.y + Math.sin(angle - spread) * length,
  };
  const leftLine = lineObject(e, layerId, `LeaderArrow${idx}_0`, tip, left, color, weight);
  const rightLine = lineObject(e, layerId, `LeaderArrow${idx}_1`, tip, right, color, weight);
  if (leftLine) lines.push(leftLine);
  if (rightLine) lines.push(rightLine);
  return lines;
}

function toOle2Frame(e: DwgOle2FrameEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const p1 = e.leftUpPoint;
  const p3 = e.rightDownPoint;
  const pts = [
    screenPoint(p1, t),
    screenPoint({ x: p3.x, y: p1.y }, t),
    screenPoint(p3, t),
    screenPoint({ x: p1.x, y: p3.y }, t),
    screenPoint(p1, t),
  ];
  return pointsToLines(e, pts, layerId, idx, color, weight, 'OLE');
}

function hatchPathPoints(path: DwgBoundaryPath, t: InsertTransform): Point2[] {
  if ('vertices' in path) {
    return polylinePoints(path.vertices, path.isClosed, t);
  }

  const pts: Point2[] = [];
  for (const edge of (path as DwgEdgeBoundaryPath<DwgLineEdge | DwgArcEdge | DwgEllipseEdge | DwgSplineEdge>).edges ?? []) {
    if (edge.type === 1) {
      const e = edge as DwgLineEdge;
      if (pts.length === 0) pts.push(screenPoint(e.start, t));
      pts.push(screenPoint(e.end, t));
    } else if (edge.type === 2) {
      const e = edge as DwgArcEdge;
      const start = (e.startAngle * Math.PI) / 180;
      const end = (e.endAngle * Math.PI) / 180;
      const range = normalizeAngleRange(start, end);
      const sweep = e.isCCW === false ? range.sweep - Math.PI * 2 : range.sweep;
      const segments = Math.max(8, Math.min(72, Math.ceil(Math.abs(sweep) / (Math.PI / 24))));
      for (let i = pts.length === 0 ? 0 : 1; i <= segments; i++) {
        const a = start + (sweep * i) / segments;
        pts.push(screenPoint({ x: e.center.x + Math.cos(a) * e.radius, y: e.center.y + Math.sin(a) * e.radius }, t));
      }
    } else if (edge.type === 3) {
      const e = edge as DwgEllipseEdge;
      const start = (e.startAngle * Math.PI) / 180;
      const end = (e.endAngle * Math.PI) / 180;
      const major = e.end;
      const axisRatio = e.lengthOfMinorAxis / Math.max(Math.hypot(major.x, major.y), EPS);
      const ep = ellipsePoints(e.center, major, axisRatio, start, end, t);
      pts.push(...(pts.length === 0 ? ep : ep.slice(1)));
    } else if (edge.type === 4) {
      const e = edge as DwgSplineEdge;
      const source = e.fitDatum?.length > 1 ? e.fitDatum : e.controlPoints ?? [];
      const sp = source.map(p => screenPoint(p, t));
      pts.push(...(pts.length === 0 ? sp : sp.slice(1)));
    }
  }
  return pts;
}

function toHatch(e: DwgHatchEntity, t: InsertTransform, layerId: string, idx: number, color: string, weight: number): LineObject[] {
  const lines: LineObject[] = [];
  let pathIdx = 0;
  for (const path of e.boundaryPaths ?? []) {
    lines.push(...pointsToLines(e, hatchPathPoints(path, t), layerId, idx * 100 + pathIdx, color, weight, 'Hatch'));
    pathIdx++;
  }
  return lines;
}

function isModelOrPaperBlock(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[_\s-]/g, '');
  return normalized.includes('modelspace') || normalized.includes('paperspace');
}

function buildBlockMap(db: DwgDatabase): Map<string, DwgBlockDef> {
  const map = new Map<string, DwgBlockDef>();
  for (const block of db.tables.BLOCK_RECORD?.entries ?? []) {
    if (!block.name || isModelOrPaperBlock(block.name)) continue;
    const source = block as typeof block & { basePoint?: Point3; base?: Point3; origin?: Point3 };
    const base = source.basePoint ?? source.base ?? source.origin ?? { x: 0, y: 0 };
    map.set(block.name.toLowerCase(), {
      baseX: base.x,
      baseY: base.y,
      entities: block.entities ?? [],
    });
  }
  return map;
}

function effectiveLayer(entity: DwgEntity, parentLayerId: string, parentLayerName: string, ctx: ImportContext) {
  const entityLayer = entity.layer || parentLayerName || '0';
  if (entityLayer === '0' && parentLayerName && parentLayerName !== '0') {
    return {
      layerName: parentLayerName,
      layerId: parentLayerId,
      layerColor: ctx.getLayerColor(parentLayerName),
    };
  }
  return {
    layerName: entityLayer,
    layerId: ctx.getLayerId(entityLayer),
    layerColor: ctx.getLayerColor(entityLayer),
  };
}

function convertEntity(
  entity: DwgEntity,
  t: InsertTransform,
  parentLayerId: string,
  parentLayerName: string,
  idx: number,
  inheritColor: string,
  ctx: ImportContext,
  depth: number,
): CanvasObject | CanvasObject[] | null {
  const { layerName, layerId, layerColor } = effectiveLayer(entity, parentLayerId, parentLayerName, ctx);
  const color = resolveEntityColor(entity, layerColor, inheritColor);
  const weight = resolveEntityWeight(entity);

  switch (entity.type) {
    case 'LINE':
      return toLine(entity as DwgLineEntity, t, layerId, idx, color, weight);
    case 'CIRCLE':
      return toCircle(entity as DwgCircleEntity, t, layerId, idx, color, weight);
    case 'ARC':
      return toArcLines(entity as DwgArcEntity, t, layerId, idx, color, weight);
    case 'ELLIPSE':
      return toEllipse(entity as DwgEllipseEntity, t, layerId, idx, color, weight);
    case 'LWPOLYLINE':
      return toLwPolyline(entity as DwgLWPolylineEntity, t, layerId, idx, color, weight);
    case 'POLYLINE':
    case 'POLYLINE2D':
    case 'POLYLINE3D':
      return toPolyline(entity as DwgPolyline2dEntity | DwgPolyline3dEntity, t, layerId, idx, color, weight);
    case 'SPLINE':
      return toSpline(entity, t, layerId, idx, color, weight);
    case 'TEXT':
      return toText(entity as DwgTextEntity, t, layerId, idx, color);
    case 'ATTRIB':
      return toAttrib(entity, t, layerId, idx, color);
    case 'MTEXT':
      return toMText(entity as DwgMTextEntity, t, layerId, idx, color);
    case 'POINT':
      return toPoint(entity as DwgPointEntity, t, layerId, idx, color);
    case 'SOLID':
      return toSolidOutline(entity, t, layerId, idx, color, weight);
    case '3DFACE':
      return to3dFaceOutline(entity, t, layerId, idx, color, weight);
    case 'LEADER':
      return toLeader(entity as DwgLeaderEntity, t, layerId, idx, color, weight);
    case 'OLE2FRAME':
      return toOle2Frame(entity as DwgOle2FrameEntity, t, layerId, idx, color, weight);
    case 'HATCH':
      return toHatch(entity as DwgHatchEntity, t, layerId, idx, color, weight);
    case 'DIMENSION':
      return expandBlockReference(entity, t, layerId, layerName, idx, color, ctx, depth, (entity as unknown as { name?: string }).name);
    case 'INSERT':
      return expandInsert(entity, t, layerId, layerName, idx, color, ctx, depth);
    default:
      return null;
  }
}

function asRadians(value: unknown): number {
  const n = typeof value === 'number' ? value : 0;
  return Math.abs(n) > Math.PI * 2 + EPS ? (n * Math.PI) / 180 : n;
}

function expandBlockReference(
  entity: DwgEntity,
  parentT: InsertTransform,
  layerId: string,
  layerName: string,
  idx: number,
  inheritColor: string,
  ctx: ImportContext,
  depth: number,
  blockName?: string,
  localOffset: Point2 = { x: 0, y: 0 },
): CanvasObject[] {
  if (depth > 10 || !blockName) return [];
  const def = ctx.blockMap.get(blockName.toLowerCase());
  if (!def) return [];

  const t = localOffset.x || localOffset.y
    ? compose(parentT, { ...IDENTITY, ix: localOffset.x, iy: localOffset.y, bx: 0, by: 0 })
    : parentT;

  const out: CanvasObject[] = [];
  let childIdx = idx * 1000;
  for (const child of def.entities) {
    try {
      const converted = convertEntity(child, t, layerId, layerName, childIdx++, inheritColor, ctx, depth + 1);
      if (!converted) continue;
      if (Array.isArray(converted)) out.push(...converted);
      else out.push(converted);
    } catch {
      // Skip malformed block children; keep importing the rest of the DWG.
    }
  }
  return out;
}

function expandInsert(
  entity: DwgEntity,
  parentT: InsertTransform,
  layerId: string,
  layerName: string,
  idx: number,
  inheritColor: string,
  ctx: ImportContext,
  depth: number,
): CanvasObject[] {
  const e = entity as unknown as {
    name?: string;
    blockName?: string;
    block?: string;
    rotation?: number;
    rotationAngle?: number;
    xScale?: number;
    yScale?: number;
    scaleX?: number;
    scaleY?: number;
    insertionPoint?: Point3;
    position?: Point3;
    columnCount?: number;
    rowCount?: number;
    columnSpacing?: number;
    rowSpacing?: number;
    attribs?: DwgEntity[];
    attributes?: DwgEntity[];
  };
  const blockName = e.name ?? e.blockName ?? e.block;
  if (!blockName) return [];
  const def = ctx.blockMap.get(blockName.toLowerCase());
  if (!def) return [];

  const ip = e.insertionPoint ?? e.position ?? { x: 0, y: 0 };
  const sx = e.xScale ?? e.scaleX ?? 1;
  const sy = e.yScale ?? e.scaleY ?? 1;
  const rotRad = asRadians(e.rotation ?? e.rotationAngle ?? 0);
  const baseT: InsertTransform = {
    ix: ip.x,
    iy: ip.y,
    scaleX: sx,
    scaleY: sy,
    cosR: Math.cos(rotRad),
    sinR: Math.sin(rotRad),
    bx: def.baseX,
    by: def.baseY,
  };
  const insertT = parentT === IDENTITY ? baseT : compose(parentT, baseT);
  const cols = Math.max(1, Math.round(e.columnCount ?? 1));
  const rows = Math.max(1, Math.round(e.rowCount ?? 1));
  const colSpacing = e.columnSpacing ?? 0;
  const rowSpacing = e.rowSpacing ?? 0;

  const out: CanvasObject[] = [];
  let instanceIdx = idx;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      out.push(...expandBlockReference(
        entity,
        insertT,
        layerId,
        layerName,
        instanceIdx++,
        inheritColor,
        ctx,
        depth,
        blockName,
        { x: col * colSpacing, y: row * rowSpacing },
      ));
    }
  }

  const attributes = e.attribs ?? e.attributes ?? [];
  let attrIdx = idx * 1000 + out.length;
  for (const attrib of attributes) {
    const converted = convertEntity(attrib, insertT, layerId, layerName, attrIdx++, inheritColor, ctx, depth + 1);
    if (!converted) continue;
    if (Array.isArray(converted)) out.push(...converted);
    else out.push(converted);
  }

  return out;
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
  const ptr = lib.dwg_read_data(buffer, Dwg_File_Type.DWG);
  if (!ptr) throw new Error('Failed to parse DWG file. The file may be corrupted or use an unsupported DWG version.');

  let database: DwgDatabase;
  try {
    ({ database } = lib.convertEx(ptr));
  } finally {
    lib.dwg_free(ptr);
  }

  const nameToId = new Map<string, string>();
  const layerColorMap = new Map<string, string>();
  const newLayers: Layer[] = [];

  for (const layer of existingLayers) {
    nameToId.set(layer.name.toLowerCase(), layer.id);
    layerColorMap.set(layer.name.toLowerCase(), layer.color);
  }

  const maxOrder = existingLayers.reduce((max, layer) => Math.max(max, layer.order), -1);
  let orderCtr = maxOrder + 1;

  for (const entry of database.tables.LAYER?.entries ?? []) {
    const name = entry.name || '0';
    const key = name.toLowerCase();
    const color = resolveLayerColor(entry);
    if (!nameToId.has(key)) {
      const id = `dwg-layer-${entry.handle}-${Date.now()}`;
      newLayers.push({
        id,
        name,
        color,
        visible: !entry.off && !entry.frozen,
        locked: entry.locked,
        opacity: 1,
        parentId: null,
        order: orderCtr++,
      });
      nameToId.set(key, id);
    }
    layerColorMap.set(key, color);
  }

  const getLayerId = (name: string) => nameToId.get((name || '0').toLowerCase()) ?? defaultLayerId;
  const getLayerColor = (name: string) => layerColorMap.get((name || '0').toLowerCase()) ?? '#6b7280';
  const ctx: ImportContext = { blockMap: buildBlockMap(database), getLayerId, getLayerColor };

  const objects: CanvasObject[] = [];
  let idx = 0;
  for (const entity of database.entities ?? []) {
    if (entity.isInPaperSpace) continue;
    try {
      const layerName = entity.layer || '0';
      const layerId = getLayerId(layerName);
      const color = resolveEntityColor(entity, getLayerColor(layerName), '#6b7280');
      const converted = convertEntity(entity, IDENTITY, layerId, layerName, idx, color, ctx, 0);
      if (!converted) {
        idx++;
        continue;
      }
      if (Array.isArray(converted)) objects.push(...converted);
      else objects.push(converted);
    } catch {
      // Keep going when one entity is malformed or unsupported.
    }
    idx++;
  }

  if (objects.length === 0) {
    throw new Error('DWG parsed, but no drawable model-space entities were found. The file may be empty, corrupted, or use unsupported entities.');
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const obj of objects) {
    const b = objectBounds(obj);
    minX = Math.min(minX, b.minX);
    minY = Math.min(minY, b.minY);
  }
  const ox = 50 - minX;
  const oy = 50 - minY;
  for (const obj of objects) {
    obj.x += ox;
    obj.y += oy;
  }

  return { objects, newLayers };
}
