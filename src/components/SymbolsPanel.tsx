import React, { useState, useRef, useEffect } from 'react';
import {
  Search, SlidersHorizontal, MoreHorizontal, Plus,
  ChevronDown, X, Check,
} from 'lucide-react';
import { useEditor, EspSymbol } from '../store/editorStore';

/* ═══════════════════════════════════════════════════════════════════
   Symbol SVG Previews
════════════════════════════════════════════════════════════════════ */

const SymbolPreview: React.FC<{ id: string }> = ({ id }) => {
  const W = 120, H = 70;

  const svgs: Record<string, React.ReactNode> = {
    'turnout-112': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        <line x1="4"  y1="44" x2="116" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        <line x1="70" y1="44" x2="116" y2="18" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="70" y1="46" x2="116" y2="20" stroke="#9ca3af" strokeWidth="0.75"/>
        <circle cx="70" cy="45" r="3" stroke="#6b7280" strokeWidth="1.5" fill="white"/>
        {/* Sleepers */}
        {[12,24,36,48,60].map(x => <line key={x} x1={x} y1="40" x2={x} y2="50" stroke="#d1d5db" strokeWidth="1.5"/>)}
      </svg>
    ),
    'turnout-185': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        <line x1="4"  y1="44" x2="116" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        <line x1="65" y1="44" x2="116" y2="24" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="65" y1="46" x2="116" y2="26" stroke="#9ca3af" strokeWidth="0.75"/>
        <circle cx="65" cy="45" r="3" stroke="#6b7280" strokeWidth="1.5" fill="white"/>
        {[12,24,36,48].map(x => <line key={x} x1={x} y1="40" x2={x} y2="50" stroke="#d1d5db" strokeWidth="1.5"/>)}
      </svg>
    ),
    'trap-point': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        <line x1="4"  y1="44" x2="116" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        <line x1="72" y1="44" x2="92" y2="24" stroke="#9ca3af" strokeWidth="2"/>
        {/* Red derail cross */}
        <line x1="78" y1="28" x2="88" y2="38" stroke="#ef4444" strokeWidth="1.75"/>
        <line x1="88" y1="28" x2="78" y2="38" stroke="#ef4444" strokeWidth="1.75"/>
        {[12,24,36,48,60].map(x => <line key={x} x1={x} y1="40" x2={x} y2="50" stroke="#d1d5db" strokeWidth="1.5"/>)}
      </svg>
    ),
    'buffer-stop': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        <line x1="4"  y1="38" x2="80" y2="38" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="40" x2="80" y2="40" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Buffer */}
        <line x1="80" y1="28" x2="80" y2="50" stroke="#374151" strokeWidth="3"/>
        <line x1="80" y1="28" x2="96" y2="28" stroke="#6b7280" strokeWidth="2"/>
        <line x1="80" y1="50" x2="96" y2="50" stroke="#6b7280" strokeWidth="2"/>
        <line x1="88" y1="26" x2="88" y2="52" stroke="#374151" strokeWidth="2.5"/>
        {[16,30,44,60].map(x => <line key={x} x1={x} y1="34" x2={x} y2="44" stroke="#d1d5db" strokeWidth="1.5"/>)}
      </svg>
    ),
    'gradient-post': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Post */}
        <line x1="60" y1="8" x2="60" y2="62" stroke="#6b7280" strokeWidth="2"/>
        <line x1="50" y1="8" x2="70" y2="8" stroke="#6b7280" strokeWidth="2"/>
        {/* Gradient board */}
        <rect x="30" y="16" width="58" height="20" rx="3" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1"/>
        <text x="59" y="30" textAnchor="middle" fontSize="9" fill="#374151" fontFamily="monospace">+1.2%</text>
        {/* Base */}
        <line x1="48" y1="62" x2="72" y2="62" stroke="#6b7280" strokeWidth="2"/>
      </svg>
    ),
    'km-marker': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        <rect x="34" y="16" width="52" height="36" rx="4" fill="#f3f4f6" stroke="#9ca3af" strokeWidth="1.5"/>
        <text x="60" y="32" textAnchor="middle" fontSize="10" fontWeight="600" fill="#374151" fontFamily="sans-serif">KM</text>
        <text x="60" y="44" textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">17+400</text>
        {/* Small post below */}
        <line x1="60" y1="52" x2="60" y2="62" stroke="#9ca3af" strokeWidth="1.5"/>
      </svg>
    ),
    'lc-gate': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Track */}
        <line x1="4"  y1="44" x2="116" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Road */}
        <line x1="60" y1="4"  x2="60" y2="68" stroke="#d1d5db" strokeWidth="8" strokeDasharray="5 3"/>
        {/* X crossing */}
        <line x1="50" y1="34" x2="70" y2="54" stroke="#374151" strokeWidth="1.5"/>
        <line x1="70" y1="34" x2="50" y2="54" stroke="#374151" strokeWidth="1.5"/>
        {/* Gates */}
        <line x1="60" y1="44" x2="38" y2="32" stroke="#ef4444" strokeWidth="2"/>
        <line x1="60" y1="44" x2="82" y2="32" stroke="#ef4444" strokeWidth="2"/>
        {[16,32,48].map(x => <line key={x} x1={x} y1="40" x2={x} y2="50" stroke="#d1d5db" strokeWidth="1.5"/>)}
        {[76,90,104].map(x => <line key={x} x1={x} y1="40" x2={x} y2="50" stroke="#d1d5db" strokeWidth="1.5"/>)}
      </svg>
    ),
    'fob-reference': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Bridge deck */}
        <line x1="4"  y1="32" x2="116" y2="32" stroke="#9ca3af" strokeWidth="2.5"/>
        {/* Parapet */}
        <line x1="4"  y1="26" x2="116" y2="26" stroke="#d1d5db" strokeWidth="1"/>
        <line x1="4"  y1="38" x2="116" y2="38" stroke="#d1d5db" strokeWidth="1"/>
        {/* Piers */}
        <line x1="28" y1="32" x2="28" y2="60" stroke="#6b7280" strokeWidth="2.5"/>
        <line x1="60" y1="32" x2="60" y2="60" stroke="#6b7280" strokeWidth="2.5"/>
        <line x1="92" y1="32" x2="92" y2="60" stroke="#6b7280" strokeWidth="2.5"/>
        {/* Footings */}
        <line x1="18" y1="60" x2="38" y2="60" stroke="#6b7280" strokeWidth="2"/>
        <line x1="50" y1="60" x2="70" y2="60" stroke="#6b7280" strokeWidth="2"/>
        <line x1="82" y1="60" x2="102" y2="60" stroke="#6b7280" strokeWidth="2"/>
      </svg>
    ),

    'adjacent-station': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Approach track */}
        <line x1="4"  y1="44" x2="22" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="46" x2="22" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Station boundary (dashed box) */}
        <rect x="22" y="14" width="76" height="38" rx="3" fill="#f8fafc" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="5 3"/>
        {/* Track through station */}
        <line x1="22" y1="44" x2="98" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="22" y1="46" x2="98" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Label */}
        <text x="60" y="32" textAnchor="middle" fontSize="8" fill="#374151" fontWeight="500">ADJ STN</text>
        {/* Departure track */}
        <line x1="98"  y1="44" x2="116" y2="44" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="98"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="0.75"/>
      </svg>
    ),

    'platform': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Track */}
        <line x1="4"  y1="52" x2="116" y2="52" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="54" x2="116" y2="54" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Sleepers */}
        {[12,24,36,48,60,72,84,96,104].map(x => (
          <line key={x} x1={x} y1="48" x2={x} y2="58" stroke="#d1d5db" strokeWidth="1.5"/>
        ))}
        {/* Platform slab */}
        <rect x="16" y="22" width="88" height="22" rx="2" fill="#e5e7eb" stroke="#6b7280" strokeWidth="1.5"/>
        <text x="60" y="37" textAnchor="middle" fontSize="9" fill="#374151" fontWeight="500">Platform</text>
      </svg>
    ),

    'bridge': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Track */}
        <line x1="4"  y1="28" x2="116" y2="28" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="30" x2="116" y2="30" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Sleepers */}
        {[12,26,40,54,68,82,96,110].map(x => (
          <line key={x} x1={x} y1="24" x2={x} y2="34" stroke="#d1d5db" strokeWidth="1.5"/>
        ))}
        {/* Bridge bottom chord */}
        <line x1="8" y1="56" x2="112" y2="56" stroke="#6b7280" strokeWidth="2"/>
        {/* End verticals */}
        <line x1="8"   y1="28" x2="8"   y2="56" stroke="#6b7280" strokeWidth="1.75"/>
        <line x1="112" y1="28" x2="112" y2="56" stroke="#6b7280" strokeWidth="1.75"/>
        {/* Diagonals */}
        <line x1="8"  y1="56" x2="38" y2="28" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="38" y1="56" x2="68" y2="28" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="68" y1="56" x2="98" y2="28" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="38" y1="28" x2="68" y2="56" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="68" y1="28" x2="98" y2="56" stroke="#9ca3af" strokeWidth="1"/>
        <line x1="98" y1="28" x2="112" y2="56" stroke="#9ca3af" strokeWidth="1"/>
      </svg>
    ),

    'structure': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Building body */}
        <rect x="18" y="24" width="84" height="38" rx="2" fill="#f3f4f6" stroke="#6b7280" strokeWidth="1.5"/>
        {/* Roof ridge */}
        <line x1="14"  y1="24" x2="60" y2="8"  stroke="#6b7280" strokeWidth="1.5"/>
        <line x1="106" y1="24" x2="60" y2="8"  stroke="#6b7280" strokeWidth="1.5"/>
        {/* Door */}
        <rect x="49" y="44" width="22" height="18" rx="1" fill="white" stroke="#9ca3af" strokeWidth="1"/>
        {/* Windows */}
        <rect x="24" y="32" width="16" height="10" rx="1" fill="white" stroke="#9ca3af" strokeWidth="1"/>
        <rect x="80" y="32" width="16" height="10" rx="1" fill="white" stroke="#9ca3af" strokeWidth="1"/>
      </svg>
    ),

    'srj': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Left track section */}
        <line x1="4"  y1="38" x2="50" y2="38" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="40" x2="50" y2="40" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Right track section */}
        <line x1="70" y1="38" x2="116" y2="38" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="70" y1="40" x2="116" y2="40" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Fishplate / joint bar */}
        <rect x="46" y="33" width="28" height="12" rx="1.5" fill="white" stroke="#374151" strokeWidth="1.5"/>
        {/* Joint gap */}
        <line x1="60" y1="33" x2="60" y2="45" stroke="#374151" strokeWidth="1" strokeDasharray="2 1.5"/>
        {/* Sleepers */}
        {[12,24,36,80,92,104].map(x => (
          <line key={x} x1={x} y1="34" x2={x} y2="44" stroke="#d1d5db" strokeWidth="1.5"/>
        ))}
        {/* Label */}
        <text x="60" y="20" textAnchor="middle" fontSize="9" fill="#374151" fontWeight="600">SRJ</text>
      </svg>
    ),

    'fm': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Track */}
        <line x1="4"  y1="46" x2="116" y2="46" stroke="#9ca3af" strokeWidth="2"/>
        <line x1="4"  y1="48" x2="116" y2="48" stroke="#9ca3af" strokeWidth="0.75"/>
        {/* Sleepers */}
        {[12,24,36,48,72,84,96,104].map(x => (
          <line key={x} x1={x} y1="42" x2={x} y2="52" stroke="#d1d5db" strokeWidth="1.5"/>
        ))}
        {/* Fouling mark – perpendicular bar */}
        <line x1="60" y1="28" x2="60" y2="64" stroke="#374151" strokeWidth="2.5"/>
        {/* Arrow tip pointing up */}
        <polygon points="55,34 65,34 60,26" fill="#374151"/>
        {/* Label */}
        <text x="70" y="24" fontSize="9" fill="#374151" fontWeight="700">FM</text>
      </svg>
    ),

    'railway-boundary': (
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
        {/* Main boundary line */}
        <line x1="4" y1="32" x2="116" y2="32" stroke="#374151" strokeWidth="2" strokeDasharray="8 3"/>
        {/* Perpendicular tick marks */}
        {[14, 38, 62, 86, 110].map(x => (
          <line key={x} x1={x} y1="22" x2={x} y2="42" stroke="#374151" strokeWidth="1.5"/>
        ))}
        {/* Hatching below (railway territory indicator) */}
        {[4, 16, 28, 40, 52, 64, 76, 88, 100].map(x => (
          <line key={x} x1={x} y1="42" x2={x + 12} y2="56" stroke="#d1d5db" strokeWidth="1"/>
        ))}
        {/* Label */}
        <text x="60" y="66" textAnchor="middle" fontSize="8" fill="#6b7280">Ry. Boundary</text>
      </svg>
    ),
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
      {svgs[id] ?? (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} fill="none">
          <rect x="20" y="20" width="80" height="30" rx="4" stroke="#d1d5db" strokeWidth="1.5"/>
          <text x="60" y="39" textAnchor="middle" fontSize="10" fill="#9ca3af">?</text>
        </svg>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Symbol Card
════════════════════════════════════════════════════════════════════ */

const SymbolCard: React.FC<{
  symbol: EspSymbol;
  isSelected: boolean;
  onClick: () => void;
}> = ({ symbol, isSelected, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isSelected
          ? '2px solid #3b82f6'
          : hovered
          ? '2px solid #e2e8f0'
          : '2px solid transparent',
        background: isSelected ? '#eff6ff' : '#ffffff',
        transition: 'border-color 0.1s, background 0.1s',
        boxShadow: isSelected
          ? '0 0 0 1px #bfdbfe'
          : hovered
          ? '0 1px 4px rgba(0,0,0,0.08)'
          : 'none',
      }}
    >
      {/* Preview area */}
      <div style={{
        position: 'relative',
        height: 88,
        background: '#f6f7f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Count badge */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          minWidth: 18, height: 18,
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: 4,
          fontSize: 10, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 4px',
          letterSpacing: '0.01em',
        }}>
          {symbol.count}
        </div>
        <SymbolPreview id={symbol.id} />
      </div>

      {/* Name + dimensions */}
      <div style={{ padding: '7px 8px 8px', background: '#ffffff' }}>
        <div style={{
          fontSize: 12, fontWeight: 500, color: '#111827',
          lineHeight: 1.3, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {symbol.name}
        </div>
        <div style={{
          fontSize: 10.5, color: '#9ca3af', marginTop: 1,
          lineHeight: 1.3, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {symbol.dimensions}
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   More options menu
════════════════════════════════════════════════════════════════════ */

/* ── MoreMenu sub-components ────────────────────────────────────────── */
const MenuDivider = () => (
  <div style={{ height: 1, background: '#f0f1f3', margin: '4px 0' }} />
);

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div style={{
    padding: '6px 12px 2px',
    fontSize: 11, fontWeight: 600, color: '#9ca3af',
    letterSpacing: '0.04em', userSelect: 'none',
  }}>
    {label}
  </div>
);

const CheckRow: React.FC<{ label: string; checked: boolean; onClick: () => void }> = ({ label, checked, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 32, display: 'flex', alignItems: 'center',
        padding: '0 12px', cursor: 'pointer',
        background: hov ? '#f5f6f7' : 'transparent',
        transition: 'background 0.08s',
        gap: 8,
      }}
    >
      <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>{label}</span>
      {checked && <Check size={13} strokeWidth={2.5} color="#2563eb" />}
    </div>
  );
};

const PlainRow: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 32, display: 'flex', alignItems: 'center',
        padding: '0 12px', cursor: 'pointer',
        background: hov ? '#f5f6f7' : 'transparent',
        fontSize: 13, color: '#111827',
        transition: 'background 0.08s',
      }}
    >
      {label}
    </div>
  );
};

const MoreMenu: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}> = ({ anchorRef, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  const [sortBy,          setSortBy]          = useState<'block-name' | 'instances-count' | 'library-name'>('library-name');
  const [direction,       setDirection]       = useState<'ascending' | 'descending'>('ascending');
  const [displayFamilies, setDisplayFamilies] = useState(true);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose, anchorRef]);

  return (
    <div ref={menuRef} style={{
      position: 'absolute',
      top: 44, right: 8,
      width: 224,
      background: '#ffffff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      boxShadow: '0 8px 28px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 300,
      padding: '4px 0',
    }}>
      <SectionLabel label="Sort by" />
      <CheckRow label="Block name"      checked={sortBy === 'block-name'}      onClick={() => setSortBy('block-name')} />
      <CheckRow label="Instances count" checked={sortBy === 'instances-count'} onClick={() => setSortBy('instances-count')} />
      <CheckRow label="Library name"    checked={sortBy === 'library-name'}    onClick={() => setSortBy('library-name')} />

      <MenuDivider />

      <SectionLabel label="Direction" />
      <CheckRow label="Ascending"  checked={direction === 'ascending'}  onClick={() => setDirection('ascending')} />
      <CheckRow label="Descending" checked={direction === 'descending'} onClick={() => setDirection('descending')} />

      <MenuDivider />

      <CheckRow label="Display families" checked={displayFamilies} onClick={() => setDisplayFamilies(v => !v)} />

      <MenuDivider />

      <PlainRow label="Delete unused blocks" onClick={onClose} />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   SymbolsPanel
════════════════════════════════════════════════════════════════════ */

const SymbolsPanel: React.FC = () => {
  const {
    symbols, selectedSymbolId, searchSymbolsQuery,
    selectSymbol, addSymbol, deleteSymbol, setSearchSymbolsQuery,
    activeTool, setActiveTool,
  } = useEditor();

  /** Pick a symbol → arm it for placement (click canvas to drop it). */
  const armSymbol = (id: string) => {
    if (selectedSymbolId === id && activeTool === 'symbol') {
      selectSymbol(null);
      setActiveTool('select');
    } else {
      selectSymbol(id);
      setActiveTool('symbol');
    }
  };

  const [activeTab,        setActiveTab]        = useState<'model' | 'find'>('model');
  const [sectionCollapsed, setSectionCollapsed] = useState(false);
  const [moreOpen,         setMoreOpen]         = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);

  /* Esc to close more menu */
  useEffect(() => {
    if (!moreOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setMoreOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [moreOpen]);

  const filtered = searchSymbolsQuery
    ? symbols.filter(s => s.name.toLowerCase().includes(searchSymbolsQuery.toLowerCase()))
    : symbols;

  return (
    <aside style={{
      position: 'fixed',
      top: 'var(--header-h)',
      left: 'var(--sidebar-w)',
      bottom: 0,
      width: 300,
      background: '#ffffff',
      borderRight: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      zIndex: 85, overflow: 'hidden',
    }}>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '8px 10px 6px',
        borderBottom: '1px solid #f3f4f6',
        gap: 2, flexShrink: 0,
      }}>
        {([['model', 'In model blocks'], ['find', 'Find blocks']] as const).map(([id, label]) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: 'none',
                background: active ? '#f0f1f3' : 'transparent',
                color: active ? '#111827' : '#6b7280',
                fontSize: 12, fontWeight: active ? 500 : 400,
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background 0.1s, color 0.1s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Search row ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '6px 10px', gap: 4,
        borderBottom: '1px solid #f3f4f6',
        flexShrink: 0, position: 'relative',
      }}>
        {/* More menu */}
        {moreOpen && (
          <MoreMenu
            anchorRef={moreRef}
            onClose={() => setMoreOpen(false)}
          />
        )}

        {/* Search input */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 5,
          background: '#f4f4f5', borderRadius: 7, padding: '0 8px',
          height: 28,
        }}>
          <Search size={12} color="#9ca3af" strokeWidth={2} />
          <input
            value={searchSymbolsQuery}
            onChange={e => setSearchSymbolsQuery(e.target.value)}
            placeholder="Search (CtrlF)"
            style={{
              flex: 1, border: 'none', background: 'transparent',
              fontSize: 12, color: '#111827', outline: 'none',
            }}
          />
          {searchSymbolsQuery && (
            <button onClick={() => setSearchSymbolsQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 0 }}>
              <X size={10} strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Filter with badge */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button style={{
            width: 28, height: 28, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, color: '#6b7280',
          }}>
            <SlidersHorizontal size={13} strokeWidth={1.75} />
          </button>
          <div style={{
            position: 'absolute', top: 2, right: 2,
            width: 13, height: 13, borderRadius: '50%',
            background: '#3b82f6', color: '#ffffff',
            fontSize: 8, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            letterSpacing: 0,
          }}>
            1
          </div>
        </div>

        {/* More options */}
        <button
          ref={moreRef}
          onClick={() => setMoreOpen(o => !o)}
          style={{
            width: 28, height: 28, border: 'none',
            background: moreOpen ? '#f0f1f3' : 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, color: '#6b7280', flexShrink: 0,
          }}
        >
          <MoreHorizontal size={13} strokeWidth={1.75} />
        </button>

        {/* Add */}
        <button
          onClick={addSymbol}
          title="Add symbol"
          style={{
            width: 28, height: 28, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, color: '#6b7280', flexShrink: 0,
          }}
        >
          <Plus size={14} strokeWidth={2} />
        </button>
      </div>

      {/* ── Scrollable body ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* Section header */}
        <div
          onClick={() => setSectionCollapsed(c => !c)}
          style={{
            display: 'flex', alignItems: 'center',
            height: 32, padding: '0 12px', gap: 6,
            cursor: 'pointer', userSelect: 'none',
          }}
        >
          <ChevronDown
            size={11} strokeWidth={2} color="#9ca3af"
            style={{ transform: sectionCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.14s', flexShrink: 0 }}
          />
          <span style={{ fontSize: 12, color: '#374151', fontWeight: 400 }}>
            From this model{' '}
            <span style={{ color: '#9ca3af' }}>({filtered.length})</span>
          </span>
        </div>

        {!sectionCollapsed && (
          <>
            {/* Sub-label */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 12px 6px',
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', letterSpacing: '0.01em' }}>
                Blocks
              </span>
              <span style={{
                fontSize: 10.5, color: '#9ca3af',
                background: '#f4f4f5', borderRadius: 4,
                padding: '1px 5px', letterSpacing: '0.02em',
                fontFamily: 'ui-monospace, monospace',
              }}>
                Alt3
              </span>
            </div>

            {/* Grid */}
            {filtered.length > 0 ? (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: '0 10px 20px',
              }}>
                {filtered.map(sym => (
                  <SymbolCard
                    key={sym.id}
                    symbol={sym}
                    isSelected={selectedSymbolId === sym.id}
                    onClick={() => armSymbol(sym.id)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>
                No blocks match "{searchSymbolsQuery}"
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};

export default SymbolsPanel;
