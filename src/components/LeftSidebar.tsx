import React from 'react';
import {
  Layers, Boxes, Palette, AlertTriangle, MessageSquare,
  Clock, Settings, Table,
} from 'lucide-react';
import { useEditor } from '../store/editorStore';

const NAV_ITEMS = [
  { id: 'layers',  icon: Layers,        label: 'Layers'   },
  { id: 'symbols', icon: Boxes,         label: 'Blocks'   },
  { id: 'styles',  icon: Palette,       label: 'Styles'   },
  { id: 'issues',  icon: AlertTriangle, label: 'Issues'   },
  { id: 'tables',  icon: Table,         label: 'Tables'   },
  { id: 'comments',icon: MessageSquare, label: 'Comments' },
  { id: 'history', icon: Clock,         label: 'History'  },
];

const PANEL_IDS = new Set(['layers', 'symbols', 'styles', 'comments', 'tables']);

const LeftSidebar: React.FC = () => {
  const { activeLeftPanel, setActiveLeftPanel } = useEditor();

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
      top: 'var(--header-h)',
      left: 0, bottom: 0,
      width: 'var(--sidebar-w)',
      background: 'var(--color-surface)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '8px 0',
      zIndex: 90, gap: 2,
    }}>
      {/* Nav items */}
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
              style={{
                width: 44, height: 44,
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                transition: 'background 0.13s, color 0.13s',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--color-hover)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }
              }}
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

      {/* Divider */}
      <div style={{ width: 32, height: 1, background: 'var(--color-border)', margin: '4px 0' }} />

      {/* Settings */}
      <button
        title="Settings"
        style={{
          width: 44, height: 44,
          borderRadius: 'var(--radius-md)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-muted)',
          transition: 'background 0.13s, color 0.13s',
          marginBottom: 4,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--color-hover)';
          e.currentTarget.style.color = 'var(--color-text)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-muted)';
        }}
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>
    </aside>
  );
};

export default LeftSidebar;
