/**
 * DrawingCommandPanel — the bottom command bar shown while a parameter-
 * drawing command (circle, line, rectangle) is active.
 *
 * Layout (vertical stack, centred horizontally above the toolbar):
 *   [Arg chips]        — one chip per arg, only in 'previewing' step
 *   [Command bar]      — tool icon · instruction · mode buttons · Done
 */

import React, { useRef, useEffect } from 'react';
import { Circle, Minus, Square, ChevronUp, RotateCw } from 'lucide-react';
import { DrawingCommand } from '../lib/drawing/drawingCommand';

/* ── Icon map ────────────────────────────────────────────────────── */

type LucideIcon = React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;

const TOOL_ICONS: Record<string, LucideIcon> = {
  circle:    Circle,
  line:      Minus,
  rectangle: Square,
};

/* ── Infinity SVG (no lucide equivalent) ─────────────────────────── */

const InfinityIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="#6b7280" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z" />
    <path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z" />
  </svg>
);

/* ── Component props ─────────────────────────────────────────────── */

export interface DrawingCommandPanelProps {
  cmd: DrawingCommand;
  /** Live computed values from cursor (shown when arg is not locked). */
  liveValues: Record<string, number>;
  onArgChange: (argId: string, text: string) => void;
  onArgFocus:  (argId: string) => void;
  onTabNext:   () => void;
  onTabPrev:   () => void;
  onDone:      () => void;
  onCancel:    () => void;
}

/* ── Keyword-bold instruction renderer ───────────────────────────── */

const KEYWORDS = ['point', 'centre', 'radius', 'length', 'angle', 'width', 'height', 'corner'];
const KW_RE = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'gi');

function renderInstruction(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  KW_RE.lastIndex = 0;
  while ((m = KW_RE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    nodes.push(<strong key={m.index} style={{ fontWeight: 600, color: '#111827' }}>{m[0]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

/* ── Shared micro-styles ─────────────────────────────────────────── */

const iconBtnStyle: React.CSSProperties = {
  width: 30, height: 30, border: 'none', borderRadius: 6,
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, transition: 'background 0.1s',
};

/* ── DrawingCommandPanel ─────────────────────────────────────────── */

const DrawingCommandPanel: React.FC<DrawingCommandPanelProps> = ({
  cmd, liveValues,
  onArgChange, onArgFocus, onTabNext, onTabPrev, onDone, onCancel,
}) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const ToolIcon = TOOL_ICONS[cmd.tool] ?? Circle;
  const canDone = cmd.step === 'previewing';

  /* Auto-focus the active arg input when it changes */
  useEffect(() => {
    if (!cmd.activeArgId) return;
    const el = inputRefs.current[cmd.activeArgId];
    if (el) { el.focus(); el.select(); }
  }, [cmd.activeArgId, cmd.step]);

  const makeKeyDown = (argId: string) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Tab')    { e.preventDefault(); e.shiftKey ? onTabPrev() : onTabNext(); }
    if (e.key === 'Enter')  { e.preventDefault(); onDone(); }
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
  };

  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        zIndex: 55,
        pointerEvents: 'auto',
        userSelect: 'none',
        /* prevent font from being affected by canvas zoom */
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* ── Arg chips (step 1 only) ── */}
      {canDone && cmd.args.length > 0 && (
        <div style={{ display: 'flex', gap: 6 }}>
          {cmd.args.map(arg => {
            const isActive = arg.id === cmd.activeArgId;
            const live = liveValues[arg.id];

            /* Display: user input text > locked value > live cursor value */
            const displayText = isActive
              ? cmd.inputText
              : arg.locked && arg.value != null
                ? arg.value.toFixed(2)
                : live != null ? live.toFixed(2) : '';

            return (
              <div
                key={arg.id}
                onClick={() => { onArgFocus(arg.id); }}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  background: '#fff',
                  border: `1.5px solid ${isActive ? '#3b6ff0' : '#e5e7eb'}`,
                  borderRadius: 8,
                  height: 36,
                  overflow: 'hidden',
                  cursor: 'text',
                  boxShadow: isActive
                    ? '0 0 0 3px rgba(59,111,240,0.14), 0 2px 8px rgba(0,0,0,0.08)'
                    : '0 2px 8px rgba(0,0,0,0.07)',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                }}
              >
                {/* Label */}
                <span style={{
                  padding: '0 10px',
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#6b7280',
                  background: '#f9fafb',
                  borderRight: '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.01em',
                }}>
                  {arg.label}
                </span>

                {/* Value input */}
                <input
                  ref={el => { inputRefs.current[arg.id] = el; }}
                  type="text"
                  inputMode="decimal"
                  value={displayText}
                  readOnly={!isActive}
                  onChange={isActive ? e => onArgChange(arg.id, e.target.value) : undefined}
                  onFocus={() => onArgFocus(arg.id)}
                  onKeyDown={makeKeyDown(arg.id)}
                  placeholder="–"
                  style={{
                    width: 68,
                    border: 'none',
                    outline: 'none',
                    fontSize: 13.5,
                    fontWeight: arg.locked ? 700 : 500,
                    color: arg.locked ? '#111827' : '#6b7280',
                    textAlign: 'center',
                    background: 'transparent',
                    cursor: isActive ? 'text' : 'pointer',
                    padding: '0 4px',
                    fontFamily: 'Inter, -apple-system, sans-serif',
                  }}
                />

                {/* Unit + toggle */}
                <div style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  borderLeft: '1px solid #e5e7eb',
                }}>
                  <span style={{
                    padding: '0 8px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#9ca3af',
                    display: 'flex',
                    alignItems: 'center',
                    background: '#f9fafb',
                  }}>
                    {arg.unit}
                  </span>
                  <button
                    tabIndex={-1}
                    style={{
                      padding: '0 7px',
                      border: 'none',
                      borderLeft: '1px solid #e5e7eb',
                      background: '#f9fafb',
                      cursor: 'pointer',
                      color: '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      transition: 'background 0.1s',
                    }}
                    onClick={e => e.stopPropagation()}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#f9fafb')}
                    title="Switch input mode"
                  >
                    <ChevronUp size={10} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Command bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        height: 46,
        padding: '0 8px 0 14px',
        gap: 8,
        minWidth: 380,
        boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
      }}>

        {/* Tool icon */}
        <ToolIcon size={14} strokeWidth={1.75} color="#3b6ff0" />

        {/* Instruction */}
        <span style={{
          flex: 1,
          fontSize: 13,
          color: '#6b7280',
          whiteSpace: 'nowrap',
          letterSpacing: '-0.01em',
        }}>
          {renderInstruction(cmd.instruction)}
        </span>

        <div style={{ width: 1, height: 20, background: '#e5e7eb', flexShrink: 0, margin: '0 2px' }} />

        {/* Circle-specific mode buttons */}
        {cmd.tool === 'circle' && (
          <>
            <button
              tabIndex={-1}
              title="Counterclockwise"
              style={iconBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <RotateCw size={14} strokeWidth={1.75} color="#6b7280" />
            </button>
            <button
              tabIndex={-1}
              title="Full circle mode"
              style={iconBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <InfinityIcon />
            </button>
          </>
        )}

        {/* Done button */}
        <button
          onClick={onDone}
          style={{
            height: 32,
            padding: '0 16px',
            background: canDone ? '#3b6ff0' : '#f3f4f6',
            color: canDone ? '#fff' : '#9ca3af',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: canDone ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            transition: 'opacity 0.12s',
            letterSpacing: '-0.01em',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => { if (canDone) e.currentTarget.style.opacity = '0.85'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default DrawingCommandPanel;
