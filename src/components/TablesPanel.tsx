import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, X, Table as TableIcon, MoreHorizontal, Trash2 } from 'lucide-react';
import TableModal, { TableData } from './TableModal';

/* ── Template definitions ───────────────────────────────────────────── */
interface Template {
  id: string;
  name: string;
  description: string;
  rows: string[];
}

const TEMPLATES: Template[] = [
  {
    id: 'approval',
    name: 'Approval Table',
    description: 'Approval workflow tracking',
    rows: ['Signal A Approval', 'Track 3 Clearance'],
  },
  {
    id: 'alteration',
    name: 'Alteration Table',
    description: 'Design change requests',
    rows: ['Grade Crossing Mod', 'Signal Relocation'],
  },
  {
    id: 'custom',
    name: 'Custom',
    description: 'Create your own table',
    rows: [],
  },
];

/* ── ID generator ───────────────────────────────────────────────────── */
let _seq = 1;
const makeId = () => `tbl-${_seq++}`;

const DEFAULT_TABLES: TableData[] = [
  { id: makeId(), name: 'Table', rows: [] },
];

/* ── Template dropdown ──────────────────────────────────────────────── */
const TemplateDropdown: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (t: Template) => void;
  onClose: () => void;
}> = ({ anchorRef, onSelect, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={menuRef}
      style={{
        position: 'absolute', top: 44, right: 8,
        width: 252, background: '#fff',
        border: '1px solid #e5e7eb', borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        zIndex: 300, padding: '6px',
      }}
    >
      {TEMPLATES.map(t => (
        <div
          key={t.id}
          onClick={() => { onSelect(t); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 7,
            cursor: 'pointer', userSelect: 'none',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: '#f3f4f6', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <TableIcon size={14} strokeWidth={1.5} color="#6b7280" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.3 }}>
              {t.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#9ca3af', lineHeight: 1.3 }}>
              {t.description}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* ── More menu (per table row) ──────────────────────────────────────── */
const RowMoreMenu: React.FC<{
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onDelete: () => void;
}> = ({ anchorRef, onClose, onDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={menuRef}
      style={{
        position: 'absolute', right: 0, top: 32, width: 160, zIndex: 200,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: '4px 0',
      }}
    >
      <div
        onClick={() => { onDelete(); onClose(); }}
        style={{ height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'pointer', color: '#ef4444', fontSize: 13 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <Trash2 size={12} strokeWidth={1.75} />
        Delete Table
      </div>
    </div>
  );
};

/* ── Table row ──────────────────────────────────────────────────────── */
const TableRow: React.FC<{
  table: TableData;
  selected: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}> = ({ table, selected, onOpen, onDelete, onRename }) => {
  const [hov, setHov]         = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(table.name);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef  = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const t = draft.trim();
    if (t) onRename(t); else setDraft(table.name);
    setEditing(false);
  };

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div
        onClick={onOpen}
        style={{
          height: 36, display: 'flex', alignItems: 'center',
          padding: '0 10px', gap: 8,
          background: selected ? '#eff6ff' : hov ? '#f9fafb' : 'transparent',
          borderLeft: selected ? '2px solid #3b82f6' : '2px solid transparent',
          cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.08s',
        }}
      >
        <TableIcon size={14} strokeWidth={1.5} color={selected ? '#3b82f6' : '#9ca3af'} style={{ flexShrink: 0 }} />

        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') { setDraft(table.name); setEditing(false); }
            }}
            onClick={e => e.stopPropagation()}
            style={{
              flex: 1, fontSize: 13, color: '#111827',
              border: '1px solid #3b82f6', borderRadius: 4,
              padding: '1px 4px', outline: 'none', background: '#fff',
            }}
          />
        ) : (
          <span
            onDoubleClick={e => { e.stopPropagation(); setEditing(true); }}
            style={{ flex: 1, fontSize: 13, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {table.name}
          </span>
        )}

        {(hov || moreOpen) && !editing && (
          <button
            ref={moreRef}
            onClick={e => { e.stopPropagation(); setMoreOpen(o => !o); }}
            style={{
              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, border: 'none', background: moreOpen ? '#e5e7eb' : 'transparent',
              color: '#6b7280', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <MoreHorizontal size={12} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {moreOpen && (
        <RowMoreMenu
          anchorRef={moreRef}
          onClose={() => setMoreOpen(false)}
          onDelete={onDelete}
        />
      )}
    </div>
  );
};

/* ── Icon btn ───────────────────────────────────────────────────────── */
const IBtn: React.FC<{
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  title?: string;
  active?: boolean;
  onClick?: () => void;
}> = ({ Icon, title, active, onClick }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 4, border: 'none',
        background: hov ? '#f0f1f3' : 'transparent',
        color: active ? '#2563eb' : '#6b7280',
        cursor: 'pointer', flexShrink: 0, transition: 'background 0.1s',
      }}
    >
      <Icon size={13} strokeWidth={1.75} />
    </button>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   Main TablesPanel
════════════════════════════════════════════════════════════════════ */
const TablesPanel: React.FC = () => {
  const [tables,       setTables]       = useState<TableData[]>(DEFAULT_TABLES);
  const [openId,       setOpenId]       = useState<string | null>(null);
  const [searchOpen,   setSearchOpen]   = useState(false);
  const [searchQuery,  setSearchQuery]  = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const addFromTemplate = useCallback((t: Template) => {
    const entry: TableData = { id: makeId(), name: t.name, rows: [...t.rows] };
    setTables(prev => [...prev, entry]);
    setOpenId(entry.id);
  }, []);

  const deleteTable = useCallback((id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
    setOpenId(prev => prev === id ? null : prev);
  }, []);

  const renameTable = useCallback((id: string, name: string) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }, []);

  const updateRows = useCallback((id: string, rows: string[]) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, rows } : t));
  }, []);

  const handleSearchToggle = () => { setSearchOpen(o => !o); setSearchQuery(''); };

  useEffect(() => {
    if (!searchOpen) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [searchOpen]);

  const displayed = searchQuery
    ? tables.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables;

  const openTable = tables.find(t => t.id === openId) ?? null;

  return (
    <>
      <aside style={{
        position: 'fixed', top: 'var(--header-h)', left: 'var(--sidebar-w)',
        bottom: 0, width: 300,
        background: '#ffffff', borderRight: '1px solid #e5e7eb',
        display: 'flex', flexDirection: 'column', zIndex: 85, overflow: 'hidden',
      }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          height: 44, display: 'flex', alignItems: 'center',
          padding: '0 10px 0 14px', borderBottom: '1px solid #e5e7eb',
          gap: 4, flexShrink: 0, position: 'relative',
        }}>
          {searchOpen ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 6,
              background: '#f3f4f6', borderRadius: 6, padding: '0 8px', height: 28,
            }}>
              <Search size={12} color="#9ca3af" strokeWidth={2} />
              <input
                autoFocus value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tables…"
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12.5, color: '#111827', outline: 'none' }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 0 }}>
                  <X size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          ) : (
            <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827', letterSpacing: '-0.01em' }}>
              Tables
            </span>
          )}
          <IBtn Icon={Search} title="Search" active={searchOpen} onClick={handleSearchToggle} />
          <button
            ref={addBtnRef}
            title="Add table"
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 4, border: 'none',
              background: dropdownOpen ? '#eff6ff' : 'transparent',
              color: dropdownOpen ? '#2563eb' : '#6b7280',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Plus size={13} strokeWidth={1.75} />
          </button>

          {/* Template dropdown */}
          {dropdownOpen && (
            <TemplateDropdown
              anchorRef={addBtnRef}
              onSelect={addFromTemplate}
              onClose={() => setDropdownOpen(false)}
            />
          )}
        </div>

        {/* ── Search hint ─────────────────────────────────────────── */}
        {!searchOpen && (
          <div
            onClick={handleSearchToggle}
            style={{
              margin: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
              background: '#f3f4f6', borderRadius: 6, padding: '5px 10px', cursor: 'text',
            }}
          >
            <Search size={12} color="#9ca3af" strokeWidth={2} />
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Search (CtrlF)</span>
          </div>
        )}

        {/* ── Table list ──────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {displayed.map(t => (
            <TableRow
              key={t.id}
              table={t}
              selected={openId === t.id}
              onOpen={() => setOpenId(id => id === t.id ? null : t.id)}
              onDelete={() => deleteTable(t.id)}
              onRename={name => renameTable(t.id, name)}
            />
          ))}

          {displayed.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 12.5 }}>
              {searchQuery ? `No tables match "${searchQuery}"` : 'No tables yet. Click + to add one.'}
            </div>
          )}

          <div style={{ height: 16 }} />
        </div>
      </aside>

      {/* ── Table modal (outside aside so z-index is correct) ──── */}
      {openTable && (
        <TableModal
          table={openTable}
          onClose={() => setOpenId(null)}
          onUpdateRows={updateRows}
        />
      )}
    </>
  );
};

export default TablesPanel;
