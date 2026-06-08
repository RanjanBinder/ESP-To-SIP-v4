import React, { useState, useRef, useEffect } from 'react';
import { X, Check, RotateCcw } from 'lucide-react';
import { CommentThread, CommentMessage } from '../store/editorStore';

/* ── Relative time helper ──────────────────────────────────────────── */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ── Avatar ─────────────────────────────────────────────────────────── */
const Avatar: React.FC<{ initials: string; color: string }> = ({ initials, color }) => (
  <div style={{
    width: 26, height: 26, borderRadius: '50%',
    background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 11, fontWeight: 700,
    flexShrink: 0, userSelect: 'none',
  }}>
    {initials}
  </div>
);

/* ── Single message row ─────────────────────────────────────────────── */
const MessageRow: React.FC<{ msg: CommentMessage }> = ({ msg }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
    <Avatar initials={msg.userInitials} color={msg.userColor} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{msg.userName}</span>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>{relTime(msg.createdAt)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, wordBreak: 'break-word' }}>
        {msg.text}
      </div>
    </div>
  </div>
);

/* ── CommentThreadCard ───────────────────────────────────────────────
   sx, sy  = screen-space position of the comment pin
   isDraft = true when this is a new comment being composed
*/
export interface CommentThreadCardProps {
  thread?: CommentThread;
  /** World-space pin position, converted to screen coords externally */
  screenX: number;
  screenY: number;
  isDraft?: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onClose: () => void;
  onResolve?: (id: string) => void;
  onReopen?: (id: string) => void;
  onReply?: (id: string, text: string) => void;
  onSubmitDraft?: (text: string) => void;
  onCancelDraft?: () => void;
}

const CARD_W = 280;
const CARD_H_APPROX = 200; // used only for edge-clamping

const CommentThreadCard: React.FC<CommentThreadCardProps> = ({
  thread, screenX, screenY, isDraft = false,
  canvasWidth, canvasHeight,
  onClose, onResolve, onReopen, onReply, onSubmitDraft, onCancelDraft,
}) => {
  const [replyText, setReplyText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isDraft && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isDraft]);

  /* Clamp card to stay within the canvas viewport */
  let left = screenX + 16;
  let top = screenY - 20;
  if (left + CARD_W > canvasWidth - 8) left = screenX - CARD_W - 16;
  if (left < 4) left = 4;
  if (top + CARD_H_APPROX > canvasHeight - 8) top = canvasHeight - CARD_H_APPROX - 8;
  if (top < 4) top = 4;

  const handleReplySubmit = () => {
    const t = replyText.trim();
    if (!t) return;
    if (isDraft) {
      onSubmitDraft?.(t);
    } else if (thread) {
      onReply?.(thread.id, t);
    }
    setReplyText('');
  };

  const resolved = thread?.status === 'resolved';

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute',
        left, top,
        width: CARD_W,
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
        zIndex: 50,
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Card header */}
      <div style={{
        height: 36,
        display: 'flex', alignItems: 'center',
        padding: '0 8px 0 12px', gap: 4,
        borderBottom: '1px solid #f3f4f6',
      }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#6b7280' }}>
          {isDraft ? 'New comment' : resolved ? 'Resolved' : 'Comment'}
        </span>
        {!isDraft && thread && (
          <button
            title={resolved ? 'Reopen comment' : 'Resolve comment'}
            onClick={() => resolved ? onReopen?.(thread.id) : onResolve?.(thread.id)}
            style={{
              width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: resolved ? '#dcfce7' : 'none',
              border: 'none', borderRadius: 6, cursor: 'pointer',
              color: resolved ? '#16a34a' : '#6b7280',
            }}
            onMouseEnter={e => { if (!resolved) e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={e => { if (!resolved) e.currentTarget.style.background = 'none'; }}
          >
            {resolved ? <RotateCcw size={13} strokeWidth={2} /> : <Check size={13} strokeWidth={2} />}
          </button>
        )}
        <button
          title="Close"
          onClick={onClose}
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
            color: '#9ca3af',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ padding: '12px 12px 0' }}>
        {!isDraft && thread?.messages.map(msg => (
          <MessageRow key={msg.id} msg={msg} />
        ))}
      </div>

      {/* Reply / first comment input */}
      <div style={{ padding: '10px 12px 12px' }}>
        <textarea
          ref={inputRef}
          value={replyText}
          onChange={e => setReplyText(e.target.value)}
          placeholder={isDraft ? 'Add a comment…' : 'Your reply'}
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleReplySubmit();
            }
          }}
          style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #e5e7eb', borderRadius: 6,
            padding: '7px 9px', fontSize: 13, lineHeight: 1.5,
            color: '#111827', resize: 'none', outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.1s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = '#2563eb'; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; }}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 7, justifyContent: 'flex-end' }}>
          <button
            onClick={isDraft ? onCancelDraft : onClose}
            style={{
              height: 30, padding: '0 12px',
              background: 'none', border: '1px solid #e5e7eb', borderRadius: 6,
              fontSize: 12, color: '#6b7280', cursor: 'pointer',
              fontWeight: 500,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
          >
            Cancel
          </button>
          <button
            onClick={handleReplySubmit}
            disabled={!replyText.trim()}
            style={{
              height: 30, padding: '0 12px',
              background: replyText.trim() ? '#2563eb' : '#bfdbfe',
              border: 'none', borderRadius: 6,
              fontSize: 12, color: '#fff', cursor: replyText.trim() ? 'pointer' : 'default',
              fontWeight: 600,
              transition: 'background 0.1s',
            }}
          >
            {isDraft ? 'Add' : 'Reply'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommentThreadCard;
