/**
 * sodValidator.ts — Schedule-of-Dimensions (SOD) compliance check for the ESP.
 *
 * Runs a set of railway-drawing sanity rules over the current canvas assets and
 * returns a structured result the UI can render. Violations are graded into two
 * severities:
 *
 *   V1  — critical: breaks a hard SOD requirement (missing/mislabelled safety
 *         asset, unlabelled infrastructure). Must be fixed before sign-off.
 *   V2  — warning: a likely geometry/consistency issue worth a human review
 *         (assets overlapping, near-zero-length track, odd turnout parity).
 *
 * The rules operate on the generic CanvasObject model (see types/scene.ts) so
 * they keep working as new tools land. Everything here is pure + deterministic:
 * the same assets always yield the same result.
 */

import type { CanvasObject } from '../../types/scene';

export type ViolationSeverity = 'V1' | 'V2';

export interface SODViolation {
  id: string;
  severity: ViolationSeverity;
  /** Stable rule identifier (for grouping / dedupe). */
  ruleId: string;
  /** Schedule-of-Dimensions clause code, e.g. 'SOD-I-01'. */
  ruleCode?: string;
  /** Short, human-readable headline. */
  title: string;
  /** One-line explanation of what/where. */
  detail: string;
  /** Measured value from the drawing (mm) and the limit it breached. */
  measured?: number;
  required?: string;
  unit?: string;
  /** The offending asset, when a single asset is implicated. */
  assetId?: string;
  assetName?: string;
  /** World position + size of the asset — used to place markers on the canvas. */
  canvasX?: number;
  canvasY?: number;
  canvasW?: number;
  canvasH?: number;
}

export interface SODCheckResult {
  id: string;
  /** What was validated — e.g. 'existing-esp'. */
  source: string;
  /** Validation source kind; PDF means non-editable anchors mapped to a PDF underlay. */
  sourceKind?: 'canvas' | 'pdf';
  sourceFileName?: string;
  sourceUrl?: string;
  sourcePage?: number;
  /** ISO timestamp the check completed. */
  ranAt: string;
  /** How many SOD-annotated assets were considered. */
  assetsChecked: number;
  /** How many individual rule evaluations ran across those assets. */
  checksRun: number;
  violations: SODViolation[];
  counts: { V1: number; V2: number; total: number };
  /** Rule evaluations that passed = checksRun − total violations. */
  checksPassed: number;
  /** True when zero violations were found. */
  passed: boolean;
}

export interface SODValidationOptions {
  sourceKind?: 'canvas' | 'pdf';
  sourceFileName?: string;
  sourceUrl?: string;
  sourcePage?: number;
}

/* ── Geometry helpers (world units) ──────────────────────────────────── */

interface Box { x: number; y: number; w: number; h: number; }

function boxOf(o: CanvasObject): Box {
  return { x: o.x, y: o.y, w: Math.abs(o.width), h: Math.abs(o.height) };
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function centerDistance(a: Box, b: Box): number {
  const ax = a.x + a.w / 2, ay = a.y + a.h / 2;
  const bx = b.x + b.w / 2, by = b.y + b.h / 2;
  return Math.hypot(ax - bx, ay - by);
}

/* The layer each symbol library id is expected to live on. Symbols placed on a
 * different layer usually mean a drafting slip that breaks layer-based takeoff. */
const SYMBOL_EXPECTED_LAYER: Record<string, string> = {
  'turnout-112': 'turnouts',
  'turnout-185': 'turnouts',
  'trap-point':  'trap-points',
  'buffer-stop': 'tracks',
  'platform':    'platforms',
  'bridge':      'structures',
  'structure':   'structures',
};

/* ── The check ───────────────────────────────────────────────────────── */

export function runSODValidation(
  assets: CanvasObject[] | undefined | null,
  source: string = 'existing-esp',
  options: SODValidationOptions = {},
): SODCheckResult {
  const list = Array.isArray(assets) ? assets : [];
  const violations: SODViolation[] = [];
  let seq = 0;
  const push = (v: Omit<SODViolation, 'id'>) =>
    violations.push({ id: `sodv-${++seq}`, ...v });

  const symbols = list.filter(o => o.type === 'symbol') as Extract<CanvasObject, { type: 'symbol' }>[];
  const texts   = list.filter(o => o.type === 'text');
  const lines   = list.filter(o => o.type === 'line') as Extract<CanvasObject, { type: 'line' }>[];

  /* ── Rule 1 (V1): symbol on the wrong layer ─────────────────────────── */
  for (const s of symbols) {
    const expected = SYMBOL_EXPECTED_LAYER[s.symbolId];
    if (expected && s.layerId !== expected) {
      push({
        severity: 'V1',
        ruleId: 'symbol-layer-mismatch',
        title: 'Asset on incorrect layer',
        detail: `${s.label || s.name} should sit on the "${expected}" layer but is on "${s.layerId}".`,
        assetId: s.id,
        assetName: s.label || s.name,
      });
    }
  }

  /* ── Rule 2 (V1): infrastructure symbol with no nearby label ─────────── */
  /* Every placed asset should carry a chainage / identity label within reach. */
  const LABEL_RADIUS = 160; // world units
  for (const s of symbols) {
    const sBox = boxOf(s);
    const labelled = texts.some(t => {
      const hasText = t.type === 'text' && t.value.trim().length > 0;
      return hasText && centerDistance(sBox, boxOf(t)) <= LABEL_RADIUS;
    });
    if (!labelled) {
      push({
        severity: 'V1',
        ruleId: 'asset-unlabelled',
        title: 'Unlabelled asset',
        detail: `${s.label || s.name} has no chainage/identity label within ${LABEL_RADIUS} units.`,
        assetId: s.id,
        assetName: s.label || s.name,
      });
    }
  }

  /* ── Rule 3 (V1): empty text placed on the drawing ──────────────────── */
  for (const t of texts) {
    if (t.type === 'text' && t.value.trim().length === 0) {
      push({
        severity: 'V1',
        ruleId: 'empty-label',
        title: 'Empty label',
        detail: 'A text annotation was placed with no content.',
        assetId: t.id,
        assetName: t.name,
      });
    }
  }

  /* ── Rule 4 (V2): two assets overlapping ────────────────────────────── */
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      if (boxesOverlap(boxOf(symbols[i]), boxOf(symbols[j]))) {
        const a = symbols[i], b = symbols[j];
        push({
          severity: 'V2',
          ruleId: 'asset-overlap',
          title: 'Overlapping assets',
          detail: `${a.label || a.name} overlaps ${b.label || b.name} — check clearance.`,
          assetId: a.id,
          assetName: a.label || a.name,
        });
      }
    }
  }

  /* ── Rule 5 (V2): near-zero-length track segment ────────────────────── */
  for (const l of lines) {
    const len = Math.hypot(l.dx, l.dy);
    if (len < 1) {
      push({
        severity: 'V2',
        ruleId: 'degenerate-line',
        title: 'Zero-length segment',
        detail: `A track/line segment is effectively zero length (${len.toFixed(2)} units).`,
        assetId: l.id,
        assetName: l.name,
      });
    }
  }

  /* ── Rule 6 (V2): odd turnout parity ────────────────────────────────── */
  /* Turnouts on running lines are normally laid as crossover pairs; an odd
   * count is a common sign of a missing partner. */
  const turnouts = symbols.filter(s => s.symbolId.startsWith('turnout'));
  if (turnouts.length > 0 && turnouts.length % 2 === 1) {
    push({
      severity: 'V2',
      ruleId: 'turnout-parity',
      title: 'Odd turnout count',
      detail: `${turnouts.length} turnouts placed — crossovers are usually paired; verify none is missing.`,
    });
  }

  /* ═══════════════════════════════════════════════════════════════════
     Schedule-of-Dimensions rules (BG) over parsed ESP assets.

     These run only on objects that carry `obj.sod` engineering measurements
     (i.e. assets extracted from an ESP drawing). Each evaluation is counted in
     `checksRun`; a breach becomes a violation. Every rule is scoped to a single
     asset kind, so e.g. a track's own gradient field is never graded by the
     gradient rule (only Gradient assets are).
  ════════════════════════════════════════════════════════════════════ */

  const sodAssets = list.filter(o => o.sod);
  let checksRun = 0;

  for (const o of sodAssets) {
    const m = o.sod!;
    const name = o.name;
    const at = {
      assetId: o.id, assetName: name,
      canvasX: o.x, canvasY: o.y, canvasW: o.width, canvasH: o.height,
    };

    /* SOD-I-01 — adjacent running-track centres ≥ 4265 mm. */
    if (m.assetKind === 'Track' && m.spacingToAdjacentTrack != null) {
      checksRun++;
      if (m.spacingToAdjacentTrack < 4265) {
        push({
          severity: 'V1', ruleId: 'track-spacing', ruleCode: 'SOD-I-01',
          title: 'Track spacing below minimum',
          detail: `${name} centre-to-centre spacing is ${m.spacingToAdjacentTrack}mm.`,
          measured: m.spacingToAdjacentTrack, required: '≥ 4265 mm', unit: 'mm', ...at,
        });
      }
    }

    /* SOD-II-03 — passenger platform face ≥ 1670 mm from track centre. */
    if (m.assetKind === 'Platform' && m.clearanceFromTrackCentre != null) {
      checksRun++;
      if (m.clearanceFromTrackCentre < 1670) {
        push({
          severity: 'V2', ruleId: 'platform-clearance', ruleCode: 'SOD-II-03',
          title: 'Platform face clearance too small',
          detail: `${name} face is ${m.clearanceFromTrackCentre}mm from track centre.`,
          measured: m.clearanceFromTrackCentre, required: '≥ 1670 mm', unit: 'mm', ...at,
        });
      }
    }

    /* SOD-II-04 — goods platform height ≤ 1065 mm above rail level. */
    if (m.assetKind === 'Platform' && m.subtype === 'goods' && m.heightAboveRailLevel != null) {
      checksRun++;
      if (m.heightAboveRailLevel > 1065) {
        push({
          severity: 'V1', ruleId: 'goods-platform-height', ruleCode: 'SOD-II-04',
          title: 'Goods platform too high',
          detail: `${name} is ${m.heightAboveRailLevel}mm above rail level.`,
          measured: m.heightAboveRailLevel, required: '≤ 1065 mm', unit: 'mm', ...at,
        });
      }
    }

    /* SOD-I-07 — permanent structure ≥ 1675 mm from track centre. */
    if (m.assetKind === 'Structure' && m.clearanceFromTrackCentre != null) {
      checksRun++;
      if (m.clearanceFromTrackCentre < 1675) {
        push({
          severity: 'V1', ruleId: 'structure-clearance', ruleCode: 'SOD-I-07',
          title: 'Structure clearance below minimum',
          detail: `${name} is ${m.clearanceFromTrackCentre}mm from track centre.`,
          measured: m.clearanceFromTrackCentre, required: '≥ 1675 mm', unit: 'mm', ...at,
        });
      }
    }

    /* SOD-II-10 — foot-over-bridge soffit ≥ 6250 mm above rail level. */
    if (m.assetKind === 'Structure' && m.subtype === 'fob' && m.heightAboveRailLevel != null) {
      checksRun++;
      if (m.heightAboveRailLevel < 6250) {
        push({
          severity: 'V2', ruleId: 'fob-height', ruleCode: 'SOD-II-10',
          title: 'FOB clearance below minimum',
          detail: `${name} soffit is ${m.heightAboveRailLevel}mm above rail level.`,
          measured: m.heightAboveRailLevel, required: '≥ 6250 mm', unit: 'mm', ...at,
        });
      }
    }

    /* SOD-II-02 — ruling gradient no steeper than 1:400 (denominator ≥ 400). */
    if (m.assetKind === 'Gradient' && m.gradientDenominator != null) {
      checksRun++;
      if (m.gradientDenominator < 400) {
        push({
          severity: 'V1', ruleId: 'gradient', ruleCode: 'SOD-II-02',
          title: 'Gradient steeper than permitted',
          detail: `${name} is 1:${m.gradientDenominator}.`,
          measured: m.gradientDenominator, required: '≤ 1:400 (denominator ≥ 400)', ...at,
        });
      }
    }
  }

  const v1 = violations.filter(v => v.severity === 'V1').length;
  const v2 = violations.filter(v => v.severity === 'V2').length;

  return {
    id: `sod-${Date.now()}`,
    source,
    ...options,
    ranAt: new Date().toISOString(),
    assetsChecked: sodAssets.length,
    checksRun,
    violations,
    counts: { V1: v1, V2: v2, total: violations.length },
    checksPassed: Math.max(0, checksRun - violations.length),
    passed: violations.length === 0,
  };
}
