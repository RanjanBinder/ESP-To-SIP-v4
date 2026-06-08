/* ═══════════════════════════════════════════════════════════════════
   Schematic Grid Model
   World coordinate convention:
     96 world units = 1 physical inch (screen-DPI independent)
     100 world units ≈ 1.04 inch  (minor grid spacing at zoom=1)
════════════════════════════════════════════════════════════════════ */

/** World pixels that equal one physical inch. Never change at runtime. */
export const PIXELS_PER_INCH = 96;

/* ── Types ────────────────────────────────────────────────────────── */

export type GridUnit       = 'in' | 'mil' | 'mm' | 'm';
export type BaseGridPreset = '0.1in' | '0.05in' | '0.025in' | '2.54mm' | '1mm' | 'custom';
export type MajorGridPreset= '1in'   | '0.5in'  | '10x'     | 'custom';
export type SnapPreset     = 'grid'  | '0.1in'  | '0.05in'  | 'custom';

export interface GridSettings {
  gridUnit:    GridUnit;
  baseGrid:    BaseGridPreset;
  majorGrid:   MajorGridPreset;
  snapEnabled: boolean;
  snapPreset:  SnapPreset;
}

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  gridUnit:    'in',
  baseGrid:    '0.1in',
  majorGrid:   '1in',
  snapEnabled: true,
  snapPreset:  'grid',
};

/* ── Unit conversion ──────────────────────────────────────────────── */

/** Returns base grid spacing in inches for a given preset. */
export function baseGridToInches(preset: BaseGridPreset): number {
  switch (preset) {
    case '0.1in':   return 0.1;
    case '0.05in':  return 0.05;
    case '0.025in': return 0.025;
    case '2.54mm':  return 0.1;           // 2.54 mm == 0.1 inch exactly
    case '1mm':     return 1 / 25.4;
    default:        return 0.1;
  }
}

/** Returns major grid spacing in inches for a given preset. */
export function majorGridToInches(preset: MajorGridPreset, baseInches: number): number {
  switch (preset) {
    case '1in':  return 1.0;
    case '0.5in':return 0.5;
    case '10x':  return baseInches * 10;
    default:     return 1.0;
  }
}

/** Returns snap grid spacing in inches. */
export function snapGridToInches(preset: SnapPreset, baseInches: number): number {
  switch (preset) {
    case 'grid':   return baseInches;
    case '0.1in':  return 0.1;
    case '0.05in': return 0.05;
    default:       return baseInches;
  }
}

/* ── World-pixel spacing ──────────────────────────────────────────── */

export interface GridWorldPx {
  minorPx: number;   // world pixels per minor grid interval
  majorPx: number;   // world pixels per major grid interval
  snapPx:  number;   // world pixels per snap interval
}

/** Computes world-pixel spacing for the three grid levels. */
export function computeGridWorldPx(settings: GridSettings): GridWorldPx {
  const base  = baseGridToInches(settings.baseGrid);
  const major = majorGridToInches(settings.majorGrid, base);
  const snap  = snapGridToInches(settings.snapPreset, base);
  return {
    minorPx: base  * PIXELS_PER_INCH,
    majorPx: major * PIXELS_PER_INCH,
    snapPx:  snap  * PIXELS_PER_INCH,
  };
}

/* ── Zoom-aware screen-px spacing ────────────────────────────────── */

/** Minimum screen-pixel gap below which a grid level is hidden. */
const MINOR_HIDE_PX  = 6;
const MAJOR_HIDE_PX  = 8;

export interface GridScreenConfig {
  /** Screen-pixel minor spacing, or null if too dense to render. */
  minorScreen: number | null;
  /** Screen-pixel major spacing (may be a multiple of the world major). */
  majorScreen: number;
  /** World-pixel value that produced majorScreen (for CSS offset math). */
  majorWorldPx: number;
  /** World-pixel value that produced minorScreen (for CSS offset math). */
  minorWorldPx: number | null;
}

/**
 * Given grid settings and current zoom, returns the effective screen-pixel
 * spacings to use for CSS background-image grid rendering.
 */
export function computeGridScreenConfig(
  settings: GridSettings,
  zoom: number,
): GridScreenConfig {
  const { minorPx, majorPx } = computeGridWorldPx(settings);

  const minorScreen = minorPx * zoom;
  let   majorScreen = majorPx * zoom;
  let   majorWorldPx = majorPx;

  // If major grid is too dense, step up in multiples of 5 until visible
  while (majorScreen < MAJOR_HIDE_PX && majorScreen > 0) {
    majorWorldPx  *= 5;
    majorScreen   *= 5;
  }

  return {
    minorScreen:  minorScreen >= MINOR_HIDE_PX ? minorScreen : null,
    majorScreen,
    majorWorldPx,
    minorWorldPx: minorScreen >= MINOR_HIDE_PX ? minorPx : null,
  };
}

/* ── Snap utility ─────────────────────────────────────────────────── */

/** Snaps a world coordinate to the nearest snap-grid point. */
export function snapPoint(
  worldX: number,
  worldY: number,
  settings: GridSettings,
): { x: number; y: number } {
  if (!settings.snapEnabled) return { x: worldX, y: worldY };
  const { snapPx } = computeGridWorldPx(settings);
  return {
    x: Math.round(worldX / snapPx) * snapPx,
    y: Math.round(worldY / snapPx) * snapPx,
  };
}

/* ── Display label helpers ────────────────────────────────────────── */

export const BASE_GRID_OPTIONS = [
  { value: '0.1in',   label: '0.1 in / 100 mil' },
  { value: '0.05in',  label: '0.05 in / 50 mil'  },
  { value: '0.025in', label: '0.025 in / 25 mil'  },
  { value: '2.54mm',  label: '2.54 mm (= 0.1 in)' },
  { value: '1mm',     label: '1 mm'                },
] as const;

export const MAJOR_GRID_OPTIONS = [
  { value: '1in',  label: 'Every 1 inch'       },
  { value: '0.5in',label: 'Every 0.5 inch'     },
  { value: '10x',  label: 'Every 10 minor gaps' },
] as const;

export const SNAP_OPTIONS = [
  { value: 'grid',   label: 'Same as grid'      },
  { value: '0.1in',  label: '0.1 in / 100 mil'  },
  { value: '0.05in', label: '0.05 in / 50 mil'  },
] as const;

export const GRID_UNIT_OPTIONS = [
  { value: 'in',  label: 'Inches'      },
  { value: 'mil', label: 'Mils'        },
  { value: 'mm',  label: 'Millimeters' },
  { value: 'm',   label: 'Meters'      },
] as const;
