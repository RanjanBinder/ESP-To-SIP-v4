import React, { useState, useEffect, useRef } from 'react';
import {
  Table as TableIcon, X, Maximize2, Minimize2,
  ChevronDown, Plus, MoreHorizontal, SlidersHorizontal,
  CheckSquare, FileText, Zap, Cpu,
} from 'lucide-react';

/* ── Filter categories (ESP-relevant) ──────────────────────────────── */
const FILTER_PILLS = [
  { id: 'approval', label: 'Approval items', count: 2, Icon: CheckSquare },
  { id: 'changes',  label: 'Changes',         count: 0, Icon: FileText   },
  { id: 'signals',  label: 'Signals',          count: 3, Icon: Zap        },
  { id: 'equipment',label: 'Equipment',        count: 9, Icon: Cpu        },
];

/* ── Shared micro-styles ────────────────────────────────────────────── */
const actionBtn: React.CSSProperties = {
  height: 28, padding: '0 10px',
  background: '#f3f4f6', borderRadius: 6,
  border: 'none', cursor: 'pointer',
  color: '#374151', fontSize: 12.5, fontWeight: 500,
  display: 'flex', alignItems: 'center', gap: 4,
  whiteSpace: 'nowrap', flexShrink: 0,
};

const iconBtn: React.CSSProperties = {
  width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  borderRadius: 5, border: 'none',
  background: 'transparent', cursor: 'pointer',
  color: '#6b7280', flexShrink: 0,
};

/* ── Props ─────────────────────────────────────────────────────────── */
export interface TableData {
  id: string;
  name: string;
  rows: string[];
}

interface Props {
  table: TableData;
  onClose: () => void;
  onUpdateRows: (id: string, rows: string[]) => void;
}

/* ═══════════════════════════════════════════════════════════════════
   TableModal
════════════════════════════════════════════════════════════════════ */
const TableModal: React.FC<Props> = ({ table, onClose, onUpdateRows }) => {
  const [expanded, setExpanded]               = useState(false);
  const [activeFilter, setActiveFilter]       = useState('approval');
  const [importOpen, setImportOpen]           = useState(false);
  const [rows, setRows]                       = useState<string[]>(table.rows);
  const importRef                             = useRef<HTMLDivElement>(null);

  const displayCount = expanded
    ? Math.max(15, rows.length + 5)
    : Math.max(5, rows.length + 2);

  const filledCount = rows.filter(r => r.trim()).length;

  const handleCell = (i: number, val: string) => {
    const next = [...rows];
    while (next.length <= i) next.push('');
    next[i] = val;
    setRows(next);
    onUpdateRows(table.id, next);
  };

  const insertRow = () => {
    const next = [...rows, ''];
    setRows(next);
    onUpdateRows(table.id, next);
  };

  /* Close on Escape */
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  /* Close import dropdown on outside click */
  useEffect(() => {
    if (!importOpen) return;
    const h = (e: MouseEvent) => {
      if (importRef.current && !importRef.current.contains(e.target as Node))
        setImportOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [importOpen]);

  /* ── Layout ─────────────────────────────────────────────────────── */
  const wrapStyle: React.CSSProperties = expanded ? {
    position: 'fixed',
    left: 'calc(var(--sidebar-w) + 300px)',
    top: 'var(--header-h)',
    right: 0,
    bottom: 0,
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    display: 'flex', flexDirection: 'column',
    zIndex: 150,
  } : {
    position: 'fixed',
    left: 'calc(var(--sidebar-w) + 300px + 20px)',
    top: 'calc(var(--header-h) + 20px)',
    width: 600,
    maxHeight: 400,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    boxShadow: '0 16px 48px rgba(0,0,0,0.16), 0 3px 10px rgba(0,0,0,0.08)',
    display: 'flex', flexDirection: 'column',
    zIndex: 150,
    overflow: 'hidden',
  };

  return (
    <>
      {/* Click-away backdrop (small mode only) */}
      {!expanded && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 149 }}
          onClick={onClose}
        />
      )}

      <div style={wrapStyle} onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center',
          padding: '0 12px', borderBottom: '1px solid #e5e7eb',
          gap: 6, flexShrink: 0,
        }}>
          <TableIcon size={15} strokeWidth={1.5} color="#6b7280" style={{ flexShrink: 0 }} />
          <span style={{
            flex: 1, fontSize: 13.5, fontWeight: 600,
            color: '#111827', letterSpacing: '-0.01em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {table.name}
          </span>

          {/* Insert */}
          <button style={actionBtn} onClick={insertRow}
            onMouseEnter={e => (e.currentTarget.style.background = '#e9eaec')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
          >
            Insert
          </button>

          {/* Import dropdown */}
          <div ref={importRef} style={{ position: 'relative' }}>
            <button
              style={actionBtn}
              onClick={() => setImportOpen(o => !o)}
              onMouseEnter={e => (e.currentTarget.style.background = '#e9eaec')}
              onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
            >
              Import
              <ChevronDown size={11} strokeWidth={2} />
            </button>
            {importOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                width: 168, background: '#fff',
                border: '1px solid #e5e7eb', borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 400, padding: '4px 0',
              }}>
                {['Import CSV', 'Import JSON', 'Import from DXF'].map(opt => (
                  <div
                    key={opt}
                    onClick={() => setImportOpen(false)}
                    style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 12px', cursor: 'pointer', fontSize: 13, color: '#111827' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    {opt}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* More */}
          <button style={iconBtn} title="More options"
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <MoreHorizontal size={14} strokeWidth={1.75} />
          </button>

          {/* Expand / Compress */}
          <button
            style={iconBtn}
            title={expanded ? 'Compress' : 'Expand'}
            onClick={() => setExpanded(e => !e)}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {expanded
              ? <Minimize2 size={13} strokeWidth={1.75} />
              : <Maximize2 size={13} strokeWidth={1.75} />}
          </button>

          {/* Close */}
          <button
            style={iconBtn}
            title="Close"
            onClick={onClose}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Filter pills ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 6, height: 44,
          borderBottom: '1px solid #f0f1f3',
          flexShrink: 0, overflowX: 'auto',
        }}>
          {FILTER_PILLS.map(({ id, label, count, Icon }) => {
            const active = activeFilter === id;
            return (
              <button
                key={id}
                onClick={() => setActiveFilter(id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  background: active ? '#dbeafe' : '#f3f4f6',
                  color: active ? '#1d4ed8' : '#6b7280',
                  fontSize: 12, fontWeight: active ? 600 : 400,
                  border: 'none', cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              >
                <Icon size={11} strokeWidth={1.75} color={active ? '#1d4ed8' : '#9ca3af'} />
                {label} {count}
              </button>
            );
          })}
          <div style={{ flex: 1, minWidth: 8 }} />
          <button
            style={iconBtn}
            title="Filter / sort"
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
          </button>
        </div>

        {/* ── Spreadsheet ─────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 300 }}>
            <colgroup>
              <col style={{ width: 38 }} />
              <col />
              <col style={{ width: 38 }} />
            </colgroup>
            <thead>
              <tr>
                <th style={thNum} />
                <th style={th}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Name</span>
                    <ChevronDown size={11} strokeWidth={2} color="#9ca3af" />
                  </div>
                </th>
                <th style={{ ...th, padding: 0, textAlign: 'center' }}>
                  <button style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', padding: '6px 0' }}>
                    <Plus size={12} strokeWidth={2} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: displayCount }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={tdNum}>{i + 1}</td>
                  <td style={td}>
                    <input
                      value={rows[i] ?? ''}
                      onChange={e => handleCell(i, e.target.value)}
                      style={{
                        width: '100%', border: 'none', outline: 'none',
                        fontSize: 13, color: '#111827',
                        background: 'transparent', padding: 0,
                      }}
                    />
                  </td>
                  <td style={td} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{
          height: 36, display: 'flex', alignItems: 'center',
          padding: '0 10px', borderTop: '1px solid #e5e7eb',
          flexShrink: 0, background: '#fafafa',
        }}>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12.5, color: '#374151',
            border: 'none', background: 'transparent',
            cursor: 'pointer', padding: '2px 6px',
            borderRadius: 4,
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f1f3')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Count <strong style={{ color: '#111827' }}>{filledCount}</strong>
            <ChevronDown size={11} strokeWidth={2} color="#9ca3af" />
          </button>
        </div>
      </div>
    </>
  );
};

/* ── Table cell styles ──────────────────────────────────────────────── */
const th: React.CSSProperties = {
  padding: '0 10px', height: 32,
  textAlign: 'left', fontSize: 12, fontWeight: 500,
  color: '#6b7280', background: '#fafafa',
  borderBottom: '1px solid #e5e7eb',
  borderRight: '1px solid #f0f1f3',
  position: 'sticky', top: 0, zIndex: 1,
};
const thNum: React.CSSProperties = {
  ...th, textAlign: 'center', padding: 0, width: 38,
  borderRight: '1px solid #e5e7eb',
};
const td: React.CSSProperties = {
  padding: '0 10px', height: 32, fontSize: 13, color: '#111827',
  borderRight: '1px solid #f0f1f3', verticalAlign: 'middle',
};
const tdNum: React.CSSProperties = {
  ...td, textAlign: 'center', padding: 0, color: '#9ca3af',
  fontSize: 11.5, background: '#fafafa',
  borderRight: '1px solid #e5e7eb',
};

export default TableModal;
