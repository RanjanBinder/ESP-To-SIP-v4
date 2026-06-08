import { Layer } from '../store/editorStore';

/* ── Tree node ────────────────────────────────────────────────────── */

export interface LayerTreeNode extends Layer {
  children: LayerTreeNode[];
  depth: number;
}

/** Maximum nesting depth (0 = root, 1 = child, 2 = grandchild = MAX). */
export const MAX_DEPTH = 2;

/* ── Build tree from flat array ───────────────────────────────────── */

export function buildLayerTree(layers: Layer[]): LayerTreeNode[] {
  const map = new Map<string, LayerTreeNode>();
  const sorted = [...layers].sort((a, b) => a.order - b.order);

  // First pass: create nodes
  sorted.forEach(l => map.set(l.id, { ...l, children: [], depth: 0 }));

  // Second pass: attach children
  const roots: LayerTreeNode[] = [];
  sorted.forEach(l => {
    const node = map.get(l.id)!;
    if (!l.parentId) {
      roots.push(node);
    } else {
      const parent = map.get(l.parentId);
      if (parent) {
        node.depth = parent.depth + 1;
        parent.children.push(node);
      } else {
        roots.push(node); // orphan → root
      }
    }
  });

  return roots;
}

/* ── Flatten tree respecting collapse ─────────────────────────────── */

export function flattenTreeForRender(
  nodes: LayerTreeNode[],
  collapsedIds?: Set<string>,
): LayerTreeNode[] {
  const result: LayerTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    const isCollapsed = collapsedIds ? collapsedIds.has(node.id) : (node.collapsed ?? false);
    if (node.children.length > 0 && !isCollapsed) {
      result.push(...flattenTreeForRender(node.children, collapsedIds));
    }
  }
  return result;
}

/* ── Helpers ──────────────────────────────────────────────────────── */

export function getLayerDepth(layers: Layer[], id: string): number {
  const byId = new Map(layers.map(l => [l.id, l]));
  let depth = 0;
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId) {
    depth++;
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return depth;
}

export function getLayerDescendantIds(layers: Layer[], id: string): string[] {
  const children = layers.filter(l => l.parentId === id);
  return children.flatMap(c => [c.id, ...getLayerDescendantIds(layers, c.id)]);
}

/* ── Drop position ────────────────────────────────────────────────── */

export type DropPosition = 'before' | 'after' | 'inside';

export interface DropTarget {
  targetId: string;
  position: DropPosition;
}

/**
 * Given pointer Y and the hovered row's bounding rect, returns the drop zone.
 * Top 25% → before | middle 50% → inside | bottom 25% → after
 */
export function computeDropPosition(pointerY: number, rect: DOMRect | ClientRect): DropPosition {
  const fraction = (pointerY - rect.top) / rect.height;
  if (fraction < 0.25) return 'before';
  if (fraction > 0.75) return 'after';
  return 'inside';
}

/* ── Validation ───────────────────────────────────────────────────── */

export function canDrop(
  layers: Layer[],
  draggedId: string,
  targetId: string,
  position: DropPosition,
): boolean {
  if (draggedId === targetId) return false;

  // Never nest into a descendant
  const descendants = getLayerDescendantIds(layers, draggedId);
  if (descendants.includes(targetId)) return false;

  if (position === 'inside') {
    const target = layers.find(l => l.id === targetId);
    if (!target) return false;
    if (target.locked) return false;
    // Depth check: target's depth + 1 child must not exceed MAX_DEPTH
    if (getLayerDepth(layers, targetId) >= MAX_DEPTH) return false;
  }

  return true;
}
