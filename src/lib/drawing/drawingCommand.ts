/**
 * drawingCommand.ts — state model and geometry helpers for the
 * parameter-based shape drawing system.
 *
 * Design: pure functions only — no React, no side-effects.
 * Canvas.tsx owns the DrawingCommand state; this module provides
 * helpers to initialise, transition, and query it.
 */

import { Vec2 } from '../../types/scene';

/* ── Tool set ────────────────────────────────────────────────────── */

export type DrawingToolId = 'circle' | 'line' | 'rectangle';

/** Tools that use the parameter-drawing flow instead of drag-to-create. */
export const PARAM_DRAW_TOOLS = new Set<string>(['circle', 'line', 'rectangle']);

/* ── State types ──────────────────────────────────────────────────── */

export interface ShapeArg {
  id: string;
  label: string;
  /** Current locked value in world units (null = not yet entered). */
  value: number | null;
  unit: string;
  /** True once the user has typed a valid number — freezes that dimension. */
  locked: boolean;
}

export type DrawingStep = 'awaiting_first_point' | 'previewing';

export interface DrawingCommand {
  tool: DrawingToolId;
  step: DrawingStep;
  /** Anchor points collected so far (world coords). */
  points: Vec2[];
  /** Arguments for the current step (empty in step 0). */
  args: ShapeArg[];
  /** Id of the arg whose input field is currently focused. */
  activeArgId: string;
  /** Raw text in the focused arg input. */
  inputText: string;
  /** Helper text shown in the command bar. */
  instruction: string;
}

/* ── Shape-specific configuration ───────────────────────────────── */

const STEP0_INSTR: Record<DrawingToolId, string> = {
  circle:    'Select the centre point',
  line:      'Select the start point',
  rectangle: 'Select the first corner',
};

const STEP1_INSTR: Record<DrawingToolId, string> = {
  circle:    'Set another point or type radius',
  line:      'Set end point, or type length and angle',
  rectangle: 'Set opposite corner, or type width and height',
};

const STEP1_ARGS: Record<DrawingToolId, Omit<ShapeArg, 'locked'>[]> = {
  circle: [
    { id: 'radius', label: 'Radius', value: null, unit: 'm' },
  ],
  line: [
    { id: 'length', label: 'Length', value: null, unit: 'm' },
    { id: 'angle',  label: 'Angle',  value: null, unit: '°' },
  ],
  rectangle: [
    { id: 'width',  label: 'Width',  value: null, unit: 'm' },
    { id: 'height', label: 'Height', value: null, unit: 'm' },
  ],
};

/* ── State constructors / transitions ────────────────────────────── */

export function makeDrawingCommand(tool: string): DrawingCommand {
  const t = tool as DrawingToolId;
  return {
    tool: t,
    step: 'awaiting_first_point',
    points: [],
    args: [],
    activeArgId: '',
    inputText: '',
    instruction: STEP0_INSTR[t] ?? 'Select point',
  };
}

export function advanceToStep1(cmd: DrawingCommand, firstPoint: Vec2): DrawingCommand {
  const args = (STEP1_ARGS[cmd.tool] ?? []).map(a => ({ ...a, locked: false }));
  return {
    ...cmd,
    step: 'previewing',
    points: [firstPoint],
    args,
    activeArgId: args[0]?.id ?? '',
    inputText: '',
    instruction: STEP1_INSTR[cmd.tool] ?? 'Set next point',
  };
}

/** Update the arg identified by `argId` with `rawText`. Positive numbers lock the arg. */
export function updateArg(cmd: DrawingCommand, argId: string, rawText: string): DrawingCommand {
  const num = parseFloat(rawText);
  const valid = !isNaN(num) && num > 0;
  return {
    ...cmd,
    inputText: rawText,
    activeArgId: argId,
    args: cmd.args.map(a =>
      a.id === argId ? { ...a, value: valid ? num : null, locked: valid } : a,
    ),
  };
}

/** Cycle keyboard focus to the next (dir=1) or previous (dir=-1) arg. */
export function cycleActiveArg(cmd: DrawingCommand, dir: 1 | -1): DrawingCommand {
  if (!cmd.args.length) return cmd;
  const idx = cmd.args.findIndex(a => a.id === cmd.activeArgId);
  const next = (idx + dir + cmd.args.length) % cmd.args.length;
  const nextArg = cmd.args[next];
  return {
    ...cmd,
    activeArgId: nextArg.id,
    inputText: nextArg.value != null ? String(nextArg.value) : '',
  };
}

/* ── Preview geometry ────────────────────────────────────────────── */

export interface CirclePreview { cx: number; cy: number; r: number }
export interface LinePreview   { x1: number; y1: number; x2: number; y2: number; length: number; angleDeg: number }
export interface RectPreview   { x: number; y: number; width: number; height: number }

export function computeCirclePreview(
  center: Vec2, cursor: Vec2, args: ShapeArg[],
): CirclePreview {
  const rArg = args.find(a => a.id === 'radius');
  const r = (rArg?.locked && rArg.value != null)
    ? rArg.value
    : Math.hypot(cursor.x - center.x, cursor.y - center.y);
  return { cx: center.x, cy: center.y, r: Math.max(1, r) };
}

export function computeLinePreview(
  start: Vec2, cursor: Vec2, args: ShapeArg[],
): LinePreview {
  const lenArg = args.find(a => a.id === 'length');
  const angArg = args.find(a => a.id === 'angle');

  let dx = cursor.x - start.x;
  let dy = cursor.y - start.y;
  let length = Math.hypot(dx, dy) || 1;
  let angleDeg = Math.atan2(-dy, dx) * 180 / Math.PI; // CCW from +X, screen-Y-down

  if (angArg?.locked && angArg.value != null) {
    const rad = angArg.value * Math.PI / 180;
    dx = Math.cos(rad) * length;
    dy = -Math.sin(rad) * length;
    angleDeg = angArg.value;
  }
  if (lenArg?.locked && lenArg.value != null) {
    length = lenArg.value;
    const rad = angleDeg * Math.PI / 180;
    dx = Math.cos(rad) * length;
    dy = -Math.sin(rad) * length;
  }

  return { x1: start.x, y1: start.y, x2: start.x + dx, y2: start.y + dy, length, angleDeg };
}

export function computeRectPreview(
  corner: Vec2, cursor: Vec2, args: ShapeArg[],
): RectPreview {
  const wArg = args.find(a => a.id === 'width');
  const hArg = args.find(a => a.id === 'height');
  const rawW = cursor.x - corner.x;
  const rawH = cursor.y - corner.y;
  const w = (wArg?.locked && wArg.value != null) ? (rawW >= 0 ? wArg.value : -wArg.value) : rawW;
  const h = (hArg?.locked && hArg.value != null) ? (rawH >= 0 ? hArg.value : -hArg.value) : rawH;
  return {
    x: Math.min(corner.x, corner.x + w),
    y: Math.min(corner.y, corner.y + h),
    width: Math.abs(w),
    height: Math.abs(h),
  };
}

/** Compute live display values for all args from current cursor position. */
export function computeLiveValues(cmd: DrawingCommand, cursor: Vec2): Record<string, number> {
  if (cmd.step !== 'previewing' || !cmd.points[0]) return {};
  const c = cmd.points[0];
  if (cmd.tool === 'circle') {
    const { r } = computeCirclePreview(c, cursor, cmd.args);
    return { radius: r };
  }
  if (cmd.tool === 'line') {
    const { length, angleDeg } = computeLinePreview(c, cursor, cmd.args);
    return { length, angle: ((angleDeg % 360) + 360) % 360 };
  }
  if (cmd.tool === 'rectangle') {
    const { width, height } = computeRectPreview(c, cursor, cmd.args);
    return { width, height };
  }
  return {};
}
