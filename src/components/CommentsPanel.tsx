import React, { useState } from 'react';
import { MessageSquare, Plus, SlidersHorizontal, Check, MoreHorizontal, MousePointer2 } from 'lucide-react';
import { useEditor, CommentThread } from '../store/editorStore';

const PANEL_W = 320;

/* ── Relative time helper ──────────────────────────────────────────── */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/* ── Avatar pill ──────────────────────────────────────────────────── */
const Avatar: React.FC<{ initials: string; color: string; size?: number }> = ({
  initials, color, size = 26,
}) => (
  <div style={{
    width: size, height: size, borderRadius: '50%',
    background: color,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: size * 0.42, fontWeight: 700,
    flexShrink: 0, userSelect: 'none',
  }}>
    {initials}
  </div>
);

/* ── Single comment list item ─────────────────────────────────────── */
const CommentListItem: React.FC<{
  thread: CommentThread;
  selected: boolean;
  onSelect: () => void;
}> = ({ thread, selected, onSelect }) => {
  const [hov, setHov] = useState(false);
  const first = thread.messages[0];
  const replyCount = thread.messages.length - 1;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', gap: 10, padding: '10px 12px',
        cursor: 'pointer',
        background: selected ? '#eef4ff' : hov ? '#f9fafb' : 'transparent',
        borderLeft: selected ? '2px solid #2563eb' : '2px solid transparent',
        transition: 'background 0.1s',
        opacity: thread.status === 'resolved' ? 0.55 : 1,
      }}
    >
      <Avatar initials={thread.createdBy.initials} color={thread.createdBy.color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
            {thread.createdBy.name}
          </span>
          {thread.status === 'resolved' && (
            <span style={{
              fontSize: 10, color: '#6b7280',
              background: '#f3f4f6', borderRadius: 4, padding: '1px 5px',
            }}>resolved</span>
          )}
          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
            {relTime(thread.createdAt)}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: '#374151',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.4,
        }}>
          {first.text}
        </div>
        {replyCount > 0 && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
          </div>
        )}
      </div>
      {hov && (
        <button
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', padding: 2, borderRadius: 4, flexShrink: 0,
          }}
          onClick={e => { e.stopPropagation(); }}
        >
          <MoreHorizontal size={14} />
        </button>
      )}
    </div>
  );
};

/* ── Filter menu ──────────────────────────────────────────────────── */
const FilterMenu: React.FC<{
  filter: 'open' | 'resolved' | 'all';
  onChange: (f: 'open' | 'resolved' | 'all') => void;
  onClose: () => void;
}> = ({ filter, onChange, onClose }) => {
  const options: { value: 'open' | 'resolved' | 'all'; label: string }[] = [
    { value: 'open', label: 'Open comments' },
    { value: 'resolved', label: 'Resolved comments' },
    { value: 'all', label: 'All comments' },
  ];
  return (
    <div
      style={{
        position: 'absolute', top: 44, right: 8,
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        minWidth: 180, zIndex: 200, overflow: 'hidden',
      }}
    >
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => { onChange(o.value); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '9px 12px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: '#374151', textAlign: 'left',
            fontWeight: filter === o.value ? 600 : 400,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          {filter === o.value && <Check size={12} color="#2563eb" />}
          {filter !== o.value && <span style={{ width: 12 }} />}
          {o.label}
        </button>
      ))}
    </div>
  );
};

/* ── CommentsPanel ────────────────────────────────────────────────── */
const CommentsPanel: React.FC = () => {
  const {
    comments, selectedCommentId, commentFilter, activeTool,
    selectComment, startAddingComment, cancelAddingComment, setCommentFilter,
  } = useEditor();
  const [filterOpen, setFilterOpen] = useState(false);

  const isPlacing = activeTool === 'comment';

  const visible = comments.filter(c => {
    if (commentFilter === 'open') return c.status === 'open';
    if (commentFilter === 'resolved') return c.status === 'resolved';
    return true;
  });

  return (
    <aside
      style={{
        position: 'fixed',
        top: 'var(--header-h)',
        left: 'var(--sidebar-w)',
        bottom: 0,
        width: PANEL_W,
        background: '#fff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 80,
        userSelect: 'none',
      }}
      onClick={() => filterOpen && setFilterOpen(false)}
    >
      {/* Header */}
      <div style={{
        height: 46,
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 6,
        borderBottom: '1px solid #f0f0f0',
        flexShrink: 0,
        position: 'relative',
      }}>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#111827' }}>
          Comments
        </span>
        <button
          title="Filter comments"
          onClick={e => { e.stopPropagation(); setFilterOpen(v => !v); }}
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: filterOpen ? '#f3f4f6' : 'none', border: 'none',
            borderRadius: 6, cursor: 'pointer', color: '#6b7280',
          }}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} />
        </button>
        <button
          title="Add comment"
          onClick={() => startAddingComment()}
          style={{
            width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isPlacing ? '#eff6ff' : 'none', border: 'none',
            borderRadius: 6, cursor: 'pointer',
            color: isPlacing ? '#2563eb' : '#6b7280',
          }}
          onMouseEnter={e => { if (!isPlacing) e.currentTarget.style.background = '#f3f4f6'; }}
          onMouseLeave={e => { if (!isPlacing) e.currentTarget.style.background = 'none'; }}
        >
          <Plus size={15} strokeWidth={2} />
        </button>

        {filterOpen && (
          <FilterMenu
            filter={commentFilter}
            onChange={setCommentFilter}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </div>

      {/* "Add comment" action row — always visible below header */}
      {!isPlacing && (
        <button
          onClick={() => startAddingComment()}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            width: '100%', padding: '10px 14px',
            background: 'none', border: 'none', borderBottom: '1px solid #f3f4f6',
            cursor: 'pointer', textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: '50%',
            background: '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Plus size={13} color="#2563eb" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Add comment</span>
        </button>
      )}

      {/* Placement-mode banner */}
      {isPlacing && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 14px 12px',
          background: '#eff6ff',
          borderBottom: '1px solid #dbeafe',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#2563eb',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <MousePointer2 size={13} color="#fff" strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8' }}>
                Click on the canvas
              </div>
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 1 }}>
                to place your comment
              </div>
            </div>
          </div>
          <button
            onClick={() => cancelAddingComment()}
            style={{
              alignSelf: 'flex-start',
              height: 26, padding: '0 10px',
              background: '#dbeafe', border: 'none', borderRadius: 6,
              fontSize: 11, fontWeight: 600, color: '#1d4ed8',
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#bfdbfe'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#dbeafe'; }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {visible.length === 0 ? (
          /* Empty state */
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: 10, padding: '0 32px',
          }}>
            <div style={{
              width: 36, height: 36,
              background: '#f3f4f6', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MessageSquare size={16} color="#9ca3af" strokeWidth={1.5} />
            </div>
            <p style={{
              fontSize: 12, color: '#6b7280', textAlign: 'center', lineHeight: 1.55, margin: 0,
            }}>
              Add comments and notations for team collaboration.{' '}
              <span style={{ color: '#2563eb', cursor: 'pointer' }}>Learn more</span>
            </p>
          </div>
        ) : (
          /* Comment list */
          <div style={{ paddingTop: 4 }}>
            {visible.map(c => (
              <CommentListItem
                key={c.id}
                thread={c}
                selected={selectedCommentId === c.id}
                onSelect={() => selectComment(selectedCommentId === c.id ? null : c.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export default CommentsPanel;
