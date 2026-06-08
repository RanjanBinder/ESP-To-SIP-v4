/**
 * dxfExporter.ts — exports ESP CanvasObjects to ASCII DXF R2000.
 *
 * Coordinate convention:
 *   Canvas Y-down → DXF Y-up: dxf_y = -canvas_y
 *   Arc angles: same convention in both (degrees CCW from +X, 0=right, 90=up).
 */
import type { CanvasObject, LineObject, ArcObject, EllipseObject, TextObject } from '../types/scene';

/* ── Group-code helpers ─────────────────────────────────────────── */

const gc = (code: number, value: string | number): string =>
  `  ${code}\n${value}\n`;

/* ── Section builders ───────────────────────────────────────────── */

function header(): string {
  return gc(0, 'SECTION') + gc(2, 'HEADER') +
    gc(9, '$ACADVER') + gc(1, 'AC1015') +
    gc(0, 'ENDSEC');
}

/* ── Entity exporters ───────────────────────────────────────────── */

function exportLine(obj: LineObject): string {
  const x1 = obj.x, y1 = -obj.y;
  const x2 = obj.x + obj.dx, y2 = -(obj.y + obj.dy);
  return gc(0, 'LINE') + gc(8, '0') +
    gc(10, x1.toFixed(6)) + gc(20, y1.toFixed(6)) + gc(30, '0.0') +
    gc(11, x2.toFixed(6)) + gc(21, y2.toFixed(6)) + gc(31, '0.0');
}

function exportArc(obj: ArcObject): string {
  const r = obj.width / 2;
  const cx = obj.x + r, cy = -(obj.y + r);
  return gc(0, 'ARC') + gc(8, '0') +
    gc(10, cx.toFixed(6)) + gc(20, cy.toFixed(6)) + gc(30, '0.0') +
    gc(40, r.toFixed(6)) +
    gc(50, obj.startAngle.toFixed(6)) +
    gc(51, obj.endAngle.toFixed(6));
}

function exportCircle(obj: EllipseObject): string {
  const r = obj.width / 2;
  const cx = obj.x + r, cy = -(obj.y + r);
  return gc(0, 'CIRCLE') + gc(8, '0') +
    gc(10, cx.toFixed(6)) + gc(20, cy.toFixed(6)) + gc(30, '0.0') +
    gc(40, r.toFixed(6));
}

function exportText(obj: TextObject): string {
  const h = parseFloat(obj.fontSize) || 12;
  const hAlign = obj.alignment === 'center' ? 1 : obj.alignment === 'right' ? 2 : 0;
  return gc(0, 'TEXT') + gc(8, '0') +
    gc(10, obj.x.toFixed(6)) + gc(20, (-obj.y).toFixed(6)) + gc(30, '0.0') +
    gc(40, h.toFixed(6)) +
    gc(1, obj.value.replace(/\n/g, '\\P')) +
    gc(72, hAlign);
}

function exportRectangle(obj: CanvasObject): string {
  // Rectangle → 4 LINE entities
  const { x, y, width, height } = obj;
  const corners = [
    [x, y, x + width, y],
    [x + width, y, x + width, y + height],
    [x + width, y + height, x, y + height],
    [x, y + height, x, y],
  ] as const;
  return corners.map(([x1, y1, x2, y2]) =>
    gc(0, 'LINE') + gc(8, '0') +
    gc(10, x1.toFixed(6)) + gc(20, (-y1).toFixed(6)) + gc(30, '0.0') +
    gc(11, x2.toFixed(6)) + gc(21, (-y2).toFixed(6)) + gc(31, '0.0')
  ).join('');
}

function exportEntity(obj: CanvasObject): string | null {
  if (!obj.visible) return null;
  switch (obj.type) {
    case 'line':      return exportLine(obj as LineObject);
    case 'arc':       return exportArc(obj as ArcObject);
    case 'ellipse':   return exportCircle(obj as EllipseObject);
    case 'text':      return exportText(obj as TextObject);
    case 'rectangle': return exportRectangle(obj);
    default:          return null;
  }
}

/* ── Public API ─────────────────────────────────────────────────── */

export function exportToDxf(objects: CanvasObject[]): string {
  const entities = objects.map(exportEntity).filter(Boolean).join('');
  return (
    header() +
    gc(0, 'SECTION') + gc(2, 'ENTITIES') +
    entities +
    gc(0, 'ENDSEC') +
    gc(0, 'EOF')
  );
}

export function downloadDxf(objects: CanvasObject[], filename = 'drawing.dxf'): void {
  const content = exportToDxf(objects);
  const blob = new Blob([content], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
