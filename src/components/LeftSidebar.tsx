import React, { useState, useRef, useEffect } from 'react';
import {
  Layers, Boxes, Palette, AlertTriangle, MessageSquare,
  Clock, Settings, Table, Menu, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useEditor } from '../store/editorStore';

const NAV_ITEMS = [
  { id: 'layers',   icon: Layers,        label: 'Layers'   },
  { id: 'symbols',  icon: Boxes,         label: 'Blocks'   },
  { id: 'styles',   icon: Palette,       label: 'Styles'   },
  { id: 'issues',   icon: AlertTriangle, label: 'Issues'   },
  { id: 'tables',   icon: Table,         label: 'Tables'   },
  { id: 'comments', icon: MessageSquare, label: 'Comments' },
  { id: 'history',  icon: Clock,         label: 'History'  },
];

const PANEL_IDS = new Set(['layers', 'symbols', 'styles', 'comments', 'tables']);

/* ── shared button style helpers ── */
const navBtn = (active: boolean): React.CSSProperties => ({
  width: 44, height: 44,
  borderRadius: 'var(--radius-md)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
  background: active ? 'var(--color-primary-bg)' : 'transparent',
  transition: 'background 0.13s, color 0.13s',
  position: 'relative' as const,
  border: 'none', cursor: 'pointer', padding: 0,
  flexShrink: 0,
});

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  width: '100%', padding: '7px 14px',
  background: 'transparent', border: 'none', cursor: 'pointer',
  textAlign: 'left', fontSize: 13, color: 'var(--color-text)',
  fontFamily: 'inherit', borderRadius: 0,
  transition: 'background 0.1s',
};

const LeftSidebar: React.FC = () => {
  const { activeLeftPanel, setActiveLeftPanel } = useEditor();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* close on outside click */
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  /* close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleNav = (id: string) => {
    if (PANEL_IDS.has(id)) {
      setActiveLeftPanel(
        activeLeftPanel === id ? null : (id as 'layers' | 'symbols' | 'styles' | 'comments' | 'tables'),
      );
    }
  };

  return (
    <aside style={{
      position: 'fixed',
      top: 'var(--header-h)', left: 0, bottom: 0,
      width: 'var(--sidebar-w)',
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      zIndex: 90, gap: 2,
    }}>

      {/* ── Hamburger menu ── */}
      <div ref={menuRef} style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <button
          title="Menu"
          onClick={() => setMenuOpen(o => !o)}
          style={navBtn(menuOpen)}
          onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.background = 'var(--color-hover)'; e.currentTarget.style.color = 'var(--color-text)'; } }}
          onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; } }}
        >
          <Menu size={18} strokeWidth={1.75} />
        </button>

        {/* ── Flyout panel ── */}
        {menuOpen && (
          <div style={{
            position: 'fixed',
            top: 'var(--header-h)',
            left: 'var(--sidebar-w)',
            width: 228,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg, 10px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.13), 0 2px 6px rgba(0,0,0,0.07)',
            padding: '5px 0',
            zIndex: 300,
            overflow: 'hidden',
          }}>

            {/* Back to Station */}
            <button
              style={{ ...menuItemStyle, fontWeight: 600, paddingBottom: 9 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              onClick={() => { setMenuOpen(false); window.history.back(); }}
            >
              <ChevronLeft size={15} strokeWidth={2} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
              Back to Station
            </button>

            <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 0' }} />

            {/* Duplicate */}
            {[
              { label: 'Duplicate', sub: false },
            ].map(({ label, sub }) => (
              <button key={label}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ flex: 1 }}>{label}</span>
                {sub && <ChevronRight size={13} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />}
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 0' }} />

            {/* Import / Export */}
            {['Import', 'Export'].map(label => (
              <button key={label}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ flex: 1 }}>{label}</span>
                <ChevronRight size={13} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--color-border)', margin: '3px 0' }} />

            {/* Edit / View / Preferences */}
            {['Edit', 'View', 'Preferences'].map(label => (
              <button key={label}
                style={menuItemStyle}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ flex: 1 }}>{label}</span>
                <ChevronRight size={13} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />
              </button>
            ))}

          </div>
        )}
      </div>

      {/* ── thin divider between menu btn and nav items ── */}
      <div style={{ width: 32, height: 1, background: 'var(--color-border)', margin: '2px 0' }} />

      {/* ── Nav items ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 2, width: '100%', padding: '4px 0',
      }}>
        {NAV_ITEMS.map(({ id, icon: Icon, label }) => {
          const isActive = activeLeftPanel === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => handleNav(id)}
              style={navBtn(isActive)}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--color-hover)'; e.currentTarget.style.color = 'var(--color-text)'; } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; } }}
            >
              {isActive && (
                <span style={{
                  position: 'absolute', left: 0, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3, height: 20,
                  background: 'var(--color-primary)',
                  borderRadius: '0 3px 3px 0',
                }} />
              )}
              <Icon size={18} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

      {/* ── Divider ── */}
      <div style={{ width: 32, height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

      {/* ── Settings ── */}
      <button
        title="Settings"
        style={navBtn(false)}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-hover)'; e.currentTarget.style.color = 'var(--color-text)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-muted)'; }}
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>

    </aside>
  );
};

export default LeftSidebar;
