/**
 * components/ui — canonical right-sidebar property primitives.
 *
 * Single source of truth for the property-panel UI kit so every panel (canvas,
 * layer, text, and future tool panels) looks and behaves identically. See
 * ARCHITECTURE.md §9 and the sizing spec: 320px panel, 32px section headers,
 * 36px rows, 86px labels, #f4f4f5 / 32px inputs, 28px icon buttons.
 */
import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';

/* ── Collapsible section ──────────────────────────────────────────── */

export const PropertySection: React.FC<{
  title: string;
  count?: number;
  defaultOpen?: boolean;
  rightSlot?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, count, defaultOpen = true, rightSlot, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderBottom: '1px solid #f0f0f0' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center',
          height: 30, padding: '0 8px', gap: 4,
          cursor: 'pointer', userSelect: 'none',
          boxSizing: 'border-box',
        }}
      >
        <ChevronRight
          size={14} strokeWidth={2} color="#6b7280"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.14s', flexShrink: 0 }}
        />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>
          {title}
          {count !== undefined && (
            <span style={{ color: '#9ca3af', fontWeight: 400, marginLeft: 4 }}>({count})</span>
          )}
        </span>
        {rightSlot}
      </div>
      {open && <div style={{ paddingBottom: 6, background: '#ffffff' }}>{children}</div>}
    </div>
  );
};

/* ── Label + control row ──────────────────────────────────────────── */

export const PropertyRow: React.FC<{
  label: string;
  children: React.ReactNode;
  /** @deprecated rows no longer draw dividers; kept for call-site compatibility. */
  noBorder?: boolean;
}> = ({ label, children }) => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '86px minmax(0, 1fr)',
    columnGap: 8,
    alignItems: 'center',
    minHeight: 34,
    padding: '5px 8px',
    width: '100%',
    boxSizing: 'border-box',
  }}>
    <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap', minWidth: 0 }}>
      {label}
    </span>
    <div style={{
      width: '100%', minWidth: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4,
    }}>
      {children}
    </div>
  </div>
);

/* ── Text-label segmented control (2 options) ─────────────────────── */

export const SegmentedControl: React.FC<{
  options: [string, string];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
    width: '100%', height: 32, background: '#f4f4f5',
    borderRadius: 8, padding: 2, gap: 2,
    boxSizing: 'border-box', overflow: 'hidden',
  }}>
    {options.map(opt => {
      const active = value === opt;
      return (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          style={{
            width: '100%', minWidth: 0, height: 28, padding: '0 8px',
            borderRadius: 6, fontSize: 12,
            fontWeight: active ? 600 : 400,
            color: active ? '#111827' : '#4b5563',
            background: active ? '#ffffff' : 'transparent',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.14)' : 'none',
            border: 'none', cursor: 'pointer',
            transition: 'background 0.1s, color 0.1s',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {opt}
        </button>
      );
    })}
  </div>
);

/* ── Icon segmented control (N options) ───────────────────────────── */

export const IconSegmented: React.FC<{
  options: { value: string; icon: React.ReactNode; title: string }[];
  value: string;
  onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
  <div style={{
    width: '100%', maxWidth: '100%', height: 32,
    background: '#f4f4f5', borderRadius: 8, padding: 2,
    display: 'grid', gridTemplateColumns: `repeat(${options.length}, 1fr)`,
    gap: 2, boxSizing: 'border-box', overflow: 'hidden',
  }}>
    {options.map(opt => {
      const active = value === opt.value;
      return (
        <button
          key={opt.value} title={opt.title}
          onClick={() => onChange(opt.value)}
          style={{
            width: '100%', minWidth: 0, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, border: 'none',
            background: active ? '#ffffff' : 'transparent',
            boxShadow: active ? '0 1px 3px rgba(0,0,0,0.14)' : 'none',
            color: active ? '#111827' : '#6b7280',
            cursor: 'pointer', transition: 'background 0.1s',
          }}
        >
          {opt.icon}
        </button>
      );
    })}
  </div>
);

/* ── Icon button ──────────────────────────────────────────────────── */

export const IconButton: React.FC<{
  title?: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  size?: number;
  fluid?: boolean;
  style?: React.CSSProperties;
}> = ({ title, active, onClick, children, size = 28, fluid, style }) => {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: fluid ? '100%' : size, height: size, minWidth: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none',
        background: active ? '#ffffff' : hov ? '#f3f4f6' : 'transparent',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
        color: active ? '#374151' : '#6b7280',
        cursor: 'pointer',
        flex: fluid ? '1 1 0' : `0 0 ${size}px`,
        padding: 0, transition: 'background 0.1s, box-shadow 0.1s',
        ...style,
      }}
    >
      {children}
    </button>
  );
};

/* ── Styled native select ─────────────────────────────────────────── */

export const PropertySelect: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}> = ({ value, options, onChange, style }) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      height: 32, width: '100%', minWidth: 0,
      background: '#f4f4f5', border: '1px solid transparent', borderRadius: 8,
      padding: '0 8px', fontSize: 13, color: '#111827',
      cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      ...style,
    }}
    onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
    onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#f4f4f5'; }}
  >
    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
);

/* ── Monospace number/coordinate input (fluid) ────────────────────── */

export const NumberInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    style={{
      width: '100%', minWidth: 0, height: 32,
      background: '#f4f4f5', border: '1px solid transparent', borderRadius: 8,
      padding: '0 8px', fontSize: 13, color: '#111827', textAlign: 'right',
      outline: 'none', transition: 'border-color 0.1s, background 0.1s',
      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
      boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    }}
    onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; e.currentTarget.style.background = '#fff'; }}
    onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = '#f4f4f5'; }}
  />
);

/* ── Color swatch + hex input ─────────────────────────────────────── */

export const ColorValueInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 6,
    width: '100%', minWidth: 0, height: 32,
    background: '#f4f4f5', border: '1px solid transparent', borderRadius: 8,
    padding: '0 8px', cursor: 'pointer', boxSizing: 'border-box',
  }}>
    <input
      type="color"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: 18, height: 18, borderRadius: 3,
        border: '1px solid rgba(0,0,0,0.12)', padding: 0,
        cursor: 'pointer', background: 'transparent',
      }}
    />
    <input
      value={value.toUpperCase()}
      onChange={e => onChange(e.target.value)}
      style={{
        border: 'none', background: 'transparent',
        fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        color: '#111827', width: 66, minWidth: 0, outline: 'none',
        letterSpacing: '0.04em',
      }}
    />
  </div>
);
