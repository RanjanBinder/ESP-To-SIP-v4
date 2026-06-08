import React, { useState, useEffect, useRef } from 'react';
import { useEditor } from '../store/editorStore';
import {
  /* Selection */
  MousePointer2, Search,
  /* Railway Elements */
  Minus, GitBranch, CornerDownRight, TrendingDown, StopCircle, Building2, Crosshair, Waves,
  /* Shapes */
  Spline, Pencil, TrendingUp, Activity, Circle, Square, SlidersHorizontal,
  /* Annotations */
  Ruler, Type, ArrowUpRight, MessageCircle, StickyNote, MapPin, Milestone,
  /* Editing – left column */
  Copy, Layers2, Layers, Move, AlignCenter,
  ArrowRightLeft, Scissors, Package, PackageOpen,
  Maximize2, Link, RotateCw, FlipHorizontal,
  /* Editing – right column */
  Expand, MoveRight, GitMerge, RefreshCw, PaintBucket, Divide,
  /* Layout */
  FileText, LayoutGrid, Eye, Magnet, ZoomIn,
  /* Utilities */
  MessageSquare, AlertTriangle, CheckCircle2, Network, Download, Printer,
  /* Chrome */
  ChevronUp,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════
   Types
════════════════════════════════════════════════════════════════════ */

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

interface ToolItemDef {
  id: string;
  Icon: LucideIcon;
  label: string;
  shortcut?: string;
}

interface SectionDef {
  id: string;
  title: string;
  /** Column-major: [col0-row0, col0-row1, col1-row0, col1-row1]. 2 = 1-col layout; 4 = 2-col layout. */
  visibleTools: ToolItemDef[];
  /** Undefined = no chevron / no dropdown. */
  dropdownTools?: ToolItemDef[];
  /** Provided for 2-column dropdowns (Editing). */
  dropdownToolsRight?: ToolItemDef[];
}

/* ═══════════════════════════════════════════════════════════════════
   Section data
════════════════════════════════════════════════════════════════════ */

const TOOL_SECTIONS: SectionDef[] = [
  /* ── 1. Selection ─────────────────────────────────────────────── */
  {
    id: 'selection',
    title: 'Selection',
    visibleTools: [
      { id: 'select', Icon: MousePointer2, label: 'Select' },
      { id: 'zoom',   Icon: Search,        label: 'Zoom'   },
    ],
    /* No dropdown */
  },

  /* ── 2. Railway Elements ───────────────────────────────────────── */
  {
    id: 'railway-elements',
    title: 'ESP Blocks',
    /* Column-major 2×2: col0=[Track, TrapPoint], col1=[Turnout, Gradient] */
    visibleTools: [
      { id: 'track',      Icon: Minus,          label: 'Track'      },
      { id: 'trap-point', Icon: CornerDownRight, label: 'Trap Point' },
      { id: 'turnout',    Icon: GitBranch,      label: 'Turnout'    },
      { id: 'gradient',   Icon: TrendingDown,   label: 'Gradient'   },
    ],
    dropdownTools: [
      { id: 'track',        Icon: Minus,          label: 'Track',               shortcut: 'TRK' },
      { id: 'turnout',      Icon: GitBranch,      label: 'Turnout',             shortcut: 'TO'  },
      { id: 'trap-point',   Icon: CornerDownRight, label: 'Trap Point',         shortcut: 'TP'  },
      { id: 'gradient',     Icon: TrendingDown,   label: 'Gradient',            shortcut: 'GR'  },
      { id: 'buffer-stop',  Icon: StopCircle,     label: 'Buffer Stop',         shortcut: 'BS'  },
      { id: 'platform-ref', Icon: Building2,      label: 'Platform Reference',  shortcut: 'PF'  },
      { id: 'level-cross',  Icon: Crosshair,      label: 'Level Crossing',      shortcut: 'LC'  },
      { id: 'bridge',       Icon: Waves,          label: 'Bridge / FOB Ref',    shortcut: 'BR'  },
    ],
  },

  /* ── 3. Shapes ─────────────────────────────────────────────────── */
  {
    id: 'shapes',
    title: 'Shapes',
    /* Column-major 2×2: col0=[Polyline, Circle], col1=[Line, Rectangle] */
    visibleTools: [
      { id: 'polyline',  Icon: Spline,  label: 'Polyline'   },
      { id: 'circle',    Icon: Circle,  label: 'Circle'     },
      { id: 'line',      Icon: Pencil,  label: 'Line'       },
      { id: 'rectangle', Icon: Square,  label: 'Rectangle'  },
    ],
    dropdownTools: [
      { id: 'polyline',   Icon: Spline,            label: 'Polyline',  shortcut: 'PLINE' },
      { id: 'line',       Icon: Pencil,            label: 'Line',      shortcut: 'L'     },
      { id: 'arc',        Icon: TrendingUp,        label: 'Arc',       shortcut: 'A'     },
      { id: 'curve',      Icon: Activity,          label: 'Curve',     shortcut: 'SPL'   },
      { id: 'circle',     Icon: Circle,            label: 'Circle',    shortcut: 'C'     },
      { id: 'rectangle',  Icon: Square,            label: 'Rectangle', shortcut: 'REC'   },
      { id: 'guideline',  Icon: SlidersHorizontal, label: 'Guideline', shortcut: 'XL'    },
    ],
  },

  /* ── 4. Annotations ────────────────────────────────────────────── */
  {
    id: 'annotations',
    title: 'Annotations',
    /* Column-major 2×2: col0=[Dimension, Text], col1=[Arrow, Note] */
    visibleTools: [
      { id: 'dimension',    Icon: Ruler,        label: 'Dimension'     },
      { id: 'text',         Icon: Type,         label: 'Text'          },
      { id: 'arrow-leader', Icon: ArrowUpRight, label: 'Arrow / Leader' },
      { id: 'note',         Icon: StickyNote,   label: 'Note'          },
    ],
    dropdownTools: [
      { id: 'dimension',     Icon: Ruler,         label: 'Dimension',     shortcut: 'D'  },
      { id: 'text',          Icon: Type,          label: 'Text',          shortcut: 'T'  },
      { id: 'arrow-leader',  Icon: ArrowUpRight,  label: 'Arrow / Leader', shortcut: 'A' },
      { id: 'callout',       Icon: MessageCircle, label: 'Callout',       shortcut: 'CA' },
      { id: 'note',          Icon: StickyNote,    label: 'Note',          shortcut: 'N'  },
      { id: 'chainage',      Icon: MapPin,        label: 'Chainage Label', shortcut: 'CH' },
      { id: 'km-marker',     Icon: Milestone,     label: 'KM Marker',     shortcut: 'KM' },
    ],
  },

  /* ── 5. Editing (2-col visible, 2-col dropdown) ─────────────────── */
  {
    id: 'editing',
    title: 'Editing tools',
    /* Column-major: col0=[Copy,Offset], col1=[Move,Trim] → visual rows: Copy|Move / Offset|Trim */
    visibleTools: [
      { id: 'copy',   Icon: Copy,           label: 'Copy'   },
      { id: 'offset', Icon: ArrowRightLeft, label: 'Offset' },
      { id: 'move',   Icon: Move,           label: 'Move'   },
      { id: 'trim',   Icon: Scissors,       label: 'Trim'   },
    ],
    dropdownTools: [
      { id: 'copy',    Icon: Copy,           label: 'Copy',    shortcut: 'CO'  },
      { id: 'move',    Icon: Move,           label: 'Move',    shortcut: 'M'   },
      { id: 'offset',  Icon: ArrowRightLeft, label: 'Offset',  shortcut: 'O'   },
      { id: 'trim',    Icon: Scissors,       label: 'Trim',    shortcut: 'TR'  },
      { id: 'group',   Icon: Layers2,        label: 'Group',   shortcut: 'G'   },
      { id: 'ungroup', Icon: Layers,         label: 'Ungroup', shortcut: '⌃⇧G' },
      { id: 'block',   Icon: Package,        label: 'Block',   shortcut: 'B'   },
      { id: 'unblock', Icon: PackageOpen,    label: 'Unblock', shortcut: '⌃⇧B' },
      { id: 'scale',   Icon: Maximize2,      label: 'Scale',   shortcut: 'SC'  },
      { id: 'join',    Icon: Link,           label: 'Join',    shortcut: 'J'   },
      { id: 'rotate',  Icon: RotateCw,       label: 'Rotate',  shortcut: 'RO'  },
      { id: 'mirror',  Icon: FlipHorizontal, label: 'Mirror',  shortcut: 'MI'  },
    ],
    dropdownToolsRight: [
      { id: 'fillet',      Icon: Spline,      label: 'Fillet',      shortcut: 'F'   },
      { id: 'chamfer',     Icon: CornerDownRight, label: 'Chamfer', shortcut: 'CHA' },
      { id: 'explode',     Icon: Expand,      label: 'Explode',     shortcut: 'X'   },
      { id: 'extend',      Icon: MoveRight,   label: 'Extend',      shortcut: 'EX'  },
      { id: 'align',       Icon: AlignCenter, label: 'Align',       shortcut: 'AL'  },
      { id: 'boolean',     Icon: GitMerge,    label: 'Boolean',     shortcut: 'BO'  },
      { id: 'array',       Icon: LayoutGrid,  label: 'Array',       shortcut: 'AR'  },
      { id: 'polar-array', Icon: RefreshCw,   label: 'Polar Array', shortcut: 'AP'  },
      { id: 'bucket',      Icon: PaintBucket, label: 'Bucket',      shortcut: 'H'   },
      { id: 'break',       Icon: Scissors,    label: 'Break',       shortcut: 'BR'  },
      { id: 'divide',      Icon: Divide,      label: 'Divide',      shortcut: 'DIV' },
    ],
  },

  /* ── 6. Layout ─────────────────────────────────────────────────── */
  {
    id: 'layout',
    title: 'Layout',
    /* Column-major 2×2: col0=[Sheet, Grid], col1=[Guides, Snap] */
    visibleTools: [
      { id: 'sheet',  Icon: FileText,   label: 'Sheet'         },
      { id: 'grid',   Icon: LayoutGrid, label: 'Grid'          },
      { id: 'guides', Icon: Crosshair,  label: 'Guides'        },
      { id: 'snap',   Icon: Magnet,     label: 'Snap Settings' },
    ],
    dropdownTools: [
      { id: 'sheet',      Icon: FileText,   label: 'Sheet',           shortcut: 'SH'  },
      { id: 'grid',       Icon: LayoutGrid, label: 'Grid',            shortcut: 'G'   },
      { id: 'guides',     Icon: Crosshair,  label: 'Guides',          shortcut: 'GD'  },
      { id: 'snap',       Icon: Magnet,     label: 'Snap Settings',   shortcut: 'SS'  },
      { id: 'layer-vis',  Icon: Eye,        label: 'Layer Visibility', shortcut: 'LV' },
      { id: 'fit-screen', Icon: Maximize2,  label: 'Fit to Screen',   shortcut: 'FIT' },
      { id: 'zoom-sel',   Icon: ZoomIn,     label: 'Zoom to Selection', shortcut: 'ZS' },
    ],
  },

  /* ── 7. Utilities ──────────────────────────────────────────────── */
  {
    id: 'utilities',
    title: 'Utilities',
    visibleTools: [
      { id: 'comments', Icon: MessageSquare, label: 'Comments' },
      { id: 'measure',  Icon: Ruler,         label: 'Measure'  },
    ],
    dropdownTools: [
      { id: 'measure',      Icon: Ruler,          label: 'Measure',           shortcut: 'ME'  },
      { id: 'comments',     Icon: MessageSquare,  label: 'Comments',          shortcut: 'CM'  },
      { id: 'issues',       Icon: AlertTriangle,  label: 'Issues',            shortcut: 'IS'  },
      { id: 'validation',   Icon: CheckCircle2,   label: 'Validation Check',  shortcut: 'VC'  },
      { id: 'connectivity', Icon: Network,        label: 'Connectivity Check', shortcut: 'CC' },
      { id: 'export-view',  Icon: Download,       label: 'Export View',       shortcut: 'EX'  },
      { id: 'print',        Icon: Printer,        label: 'Print',             shortcut: 'PR'  },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Divider
════════════════════════════════════════════════════════════════════ */

const Divider: React.FC = () => (
  <div style={{
    width: 1,
    height: 58,
    background: '#e5e7eb',
    flexShrink: 0,
    margin: '0 3px',
  }} />
);

/* ═══════════════════════════════════════════════════════════════════
   ToolButton  — 36 × 36 icon slot
════════════════════════════════════════════════════════════════════ */

interface ToolButtonProps {
  tool: ToolItemDef;
  isActive: boolean;
  onClick: () => void;
  suppressTooltip?: boolean;
}

const ToolButton: React.FC<ToolButtonProps> = ({ tool, isActive, onClick, suppressTooltip }) => {
  const [hovered, setHovered] = useState(false);
  const { Icon, label } = tool;

  const bg     = isActive ? '#dbeafe' : hovered ? '#f3f4f6' : 'transparent';
  const color  = isActive ? '#2563eb' : hovered ? '#374151' : '#6b7280';
  const border = isActive ? '1px solid rgba(37,99,235,0.25)' : '1px solid transparent';

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, background: bg, color, border,
          transition: 'background 0.1s, color 0.1s',
          cursor: 'pointer', flexShrink: 0,
        }}
      >
        <Icon size={18} strokeWidth={1.7} />
      </button>

      {hovered && !suppressTooltip && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 8px)',
          left: '50%', transform: 'translateX(-50%)',
          background: '#1f2937', color: '#f9fafb',
          fontSize: 11, fontWeight: 500,
          padding: '4px 8px', borderRadius: 5,
          whiteSpace: 'nowrap', pointerEvents: 'none',
          zIndex: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.22)',
          letterSpacing: '0.01em',
        }}>
          {label}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1f2937',
          }} />
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ChevronStrip  — narrow secondary strip attached to right of group
════════════════════════════════════════════════════════════════════ */

interface ChevronStripProps {
  open: boolean;
  sectionTitle: string;
  onClick: () => void;
}

const ChevronStrip: React.FC<ChevronStripProps> = ({ open, sectionTitle, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={sectionTitle}
      style={{
        width: 14,
        alignSelf: 'stretch',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, marginLeft: 3,
        borderRadius: 5, border: 'none',
        background: open   ? 'rgba(37,99,235,0.11)'
                 : hovered ? '#f0f1f3'
                 : 'transparent',
        color: open   ? '#2563eb'
             : hovered ? '#6b7280'
             : '#c4c8d0',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <ChevronUp
        size={10}
        strokeWidth={2.5}
        style={{
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.15s',
        }}
      />
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ToolMenuItem  — one row inside a dropdown
════════════════════════════════════════════════════════════════════ */

interface ToolMenuItemProps {
  tool: ToolItemDef;
  isActive: boolean;
  onSelect: () => void;
}

const ToolMenuItem: React.FC<ToolMenuItemProps> = ({ tool, isActive, onSelect }) => {
  const [hovered, setHovered] = useState(false);
  const { Icon, label, shortcut } = tool;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '0 10px', height: 32, borderRadius: 6,
        background: isActive ? '#eff6ff' : hovered ? '#f5f6f7' : 'transparent',
        cursor: 'pointer', userSelect: 'none',
        transition: 'background 0.08s',
      }}
    >
      <Icon size={16} strokeWidth={1.6} color={isActive ? '#2563eb' : '#6b7280'} />
      <span style={{
        flex: 1, fontSize: 13,
        color: isActive ? '#1d4ed8' : '#111827',
        fontWeight: isActive ? 500 : 400,
        letterSpacing: '0.005em',
      }}>
        {label}
      </span>
      {shortcut && (
        <span style={{
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: 10.5, color: '#aab0bb',
          letterSpacing: '0.04em', flexShrink: 0,
          minWidth: 30, textAlign: 'right',
        }}>
          {shortcut}
        </span>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ToolDropdown  — floating panel above a section
   • single-column if toolsRight is absent  (width 260px)
   • two-column if toolsRight is present    (width 440px)
════════════════════════════════════════════════════════════════════ */

interface ToolDropdownProps {
  title: string;
  tools: ToolItemDef[];
  toolsRight?: ToolItemDef[];
  activeTool: string;
  onSelect: (id: string) => void;
}

const ToolDropdown: React.FC<ToolDropdownProps> = ({ title, tools, toolsRight, activeTool, onSelect }) => {
  const isTwoCol = !!toolsRight;

  return (
    <div style={{
      position: 'absolute',
      bottom: 'calc(100% + 10px)',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 400,
      width: isTwoCol ? 440 : 260,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      boxShadow: '0 12px 40px rgba(0,0,0,0.13), 0 2px 10px rgba(0,0,0,0.06)',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px 8px',
        fontSize: 10.5, fontWeight: 600,
        color: '#9ca3af', letterSpacing: '0.04em',
        borderBottom: '1px solid #f3f4f6',
      }}>
        {title}
      </div>

      {/* Body */}
      <div style={{ display: 'flex', padding: '6px 8px 8px', gap: 0 }}>
        {/* Left / only column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tools.map(tool => (
            <ToolMenuItem
              key={tool.id}
              tool={tool}
              isActive={activeTool === tool.id}
              onSelect={() => onSelect(tool.id)}
            />
          ))}
        </div>

        {/* Right column (Editing only) */}
        {isTwoCol && (
          <>
            <div style={{
              width: 1, background: '#f0f1f3',
              margin: '4px 6px', flexShrink: 0, borderRadius: 1,
            }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
              {toolsRight!.map(tool => (
                <ToolMenuItem
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onSelect={() => onSelect(tool.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   ToolSection  — one group in the toolbar
   Renders the visible icon grid + optional ChevronStrip + optional ToolDropdown.
   Layout rule:
     visibleTools.length === 2  → 1 column × 2 rows
     visibleTools.length === 4  → 2 columns × 2 rows (column-major ordering)
════════════════════════════════════════════════════════════════════ */

interface ToolSectionProps {
  section: SectionDef;
  activeTool: string;
  isOpen: boolean;
  onToolSelect: (id: string) => void;
  onClose: () => void;
  onChevronClick: () => void;
}

const ToolSection: React.FC<ToolSectionProps> = ({
  section, activeTool, isOpen,
  onToolSelect, onClose, onChevronClick,
}) => {
  const { visibleTools, dropdownTools, dropdownToolsRight, title } = section;
  const isWide     = visibleTools.length > 2;
  const hasDropdown = !!dropdownTools;

  /* Column-major split: slice(0, mid) → col0, slice(mid) → col1 */
  const mid  = Math.ceil(visibleTools.length / 2);
  const col0 = isWide ? visibleTools.slice(0, mid) : visibleTools;
  const col1 = isWide ? visibleTools.slice(mid)    : null;

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Toolbar face ── */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>

        {/* Icon grid */}
        <div style={{ display: 'flex', gap: 2 }}>
          {/* Column 0 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {col0.map(tool => (
              <ToolButton
                key={tool.id}
                tool={tool}
                isActive={activeTool === tool.id}
                onClick={() => onToolSelect(tool.id)}
                suppressTooltip={isOpen}
              />
            ))}
          </div>

          {/* Column 1 (wide sections only) */}
          {col1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {col1.map(tool => (
                <ToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => onToolSelect(tool.id)}
                  suppressTooltip={isOpen}
                />
              ))}
            </div>
          )}
        </div>

        {/* Chevron strip — secondary control, not an icon slot */}
        {hasDropdown && (
          <ChevronStrip
            open={isOpen}
            sectionTitle={title}
            onClick={onChevronClick}
          />
        )}
      </div>

      {/* ── Dropdown ── */}
      {isOpen && hasDropdown && (
        <ToolDropdown
          title={title}
          tools={dropdownTools!}
          toolsRight={dropdownToolsRight}
          activeTool={activeTool}
          onSelect={(id) => { onToolSelect(id); onClose(); }}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   BottomToolbar  — root floating palette
   Single source of truth for activeTool + openSectionId.
   Click-outside and Esc handling live here (one listener, not per-section).
════════════════════════════════════════════════════════════════════ */

const BottomToolbar: React.FC = () => {
  const { activeTool, setActiveTool, commitDraftText } = useEditor();
  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  /* Click outside wrapper → close any open dropdown */
  useEffect(() => {
    if (!openSectionId) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpenSectionId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openSectionId]);

  /* Esc → close dropdown */
  useEffect(() => {
    if (!openSectionId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenSectionId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [openSectionId]);

  const handleToolSelect = (id: string) => {
    setActiveTool(activeTool === id ? 'select' : id);
  };

  const toggleSection = (id: string) => {
    setOpenSectionId(prev => (prev === id ? null : id));
  };

  const inTextMode = activeTool === 'text';

  return (
    <div
      ref={wrapperRef}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 200,
        marginLeft: `calc((var(--sidebar-w) + var(--left-panel-w) - var(--panel-w)) / 2)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      {/* ── Editing Text mode bar ─────────────────────────────── */}
      {inTextMode && (
        <div style={{
          background: '#2563eb',
          borderRadius: '12px 12px 0 0',
          height: 40,
          display: 'flex', alignItems: 'center',
          padding: '0 16px', gap: 6,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.01em' }}>
            Editing
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>
            Text
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={commitDraftText}
            style={{
              background: 'rgba(255,255,255,0.95)',
              color: '#1d4ed8',
              border: 'none', borderRadius: 7,
              padding: '5px 16px',
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', letterSpacing: '0.01em',
            }}
          >
            Done
          </button>
        </div>
      )}

      {/* ── Tool palette ──────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: inTextMode ? '0 0 16px 16px' : 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.11), 0 1px 6px rgba(0,0,0,0.06)',
        padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {TOOL_SECTIONS.map((section, i) => (
          <React.Fragment key={section.id}>
            {i > 0 && <Divider />}
            <ToolSection
              section={section}
              activeTool={activeTool}
              isOpen={openSectionId === section.id}
              onToolSelect={handleToolSelect}
              onClose={() => setOpenSectionId(null)}
              onChevronClick={() => toggleSection(section.id)}
            />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default BottomToolbar;
