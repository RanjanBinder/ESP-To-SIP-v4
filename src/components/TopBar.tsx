import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useSODStore } from '../store/sodStore';

const TopBar: React.FC = () => {
  const { stationCode } = useSODStore();

  return (
  <header style={{
    height: 'var(--header-h)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    gap: 12,
  }}>
    {/* Left: back button + heading */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <button
        title="Back to station"
        style={{
          width: 28, height: 28,
          background: 'transparent',
          border: 'none',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          transition: 'background 0.12s, color 0.12s',
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
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <span style={{
        fontWeight: 600,
        fontSize: 13.5,
        color: 'var(--color-text)',
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}>
        ESP Editor
      </span>
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#1d4ed8',
        background: '#dbeafe',
        border: '1px solid #bfdbfe',
        borderRadius: 5,
        padding: '2px 7px',
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
        title={stationCode ? 'Loaded station' : undefined}
      >
        {stationCode ?? 'BWK'}
      </span>
    </div>

    {/* Center: autosave badge — centered independent of side content */}
    <div style={{
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--color-surface-alt)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-pill)',
      padding: '3px 12px',
      fontSize: 12,
      color: '#374151',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: '50%',
        background: '#22c55e',
        flexShrink: 0,
        display: 'inline-block',
      }} />
      Draft v0.1 &nbsp;·&nbsp; Auto-saved
    </div>
  </header>
  );
};

export default TopBar;
