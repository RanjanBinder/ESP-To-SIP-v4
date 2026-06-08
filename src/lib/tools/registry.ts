import { Tool } from '../../types/tool';
import { selectTool } from './selectTool';
import { textTool } from './textTool';
import { makeDrawTool } from './drawTool';
import { symbolTool } from './symbolTool';
import { polylineTool } from './polylineTool';
import { copyTool } from './copyTool';
import { arcTool } from './arcTool';

/**
 * Tool registry — maps an `activeTool` id to its Tool implementation.
 * Register new tools here. Unknown ids fall back to select.
 * Tool ids match the BottomToolbar button ids ('circle' draws an ellipse).
 */
export const TOOLS: Record<string, Tool> = {
  select: selectTool,
  text: textTool,
  line: makeDrawTool('line', 'line'),
  rectangle: makeDrawTool('rectangle', 'rectangle'),
  circle: makeDrawTool('ellipse', 'circle'),
  symbol: symbolTool,
  polyline: polylineTool,
  arc: arcTool,
  copy: copyTool,
  // 'move' reuses select behaviour — drag-to-move is already in selectTool
  move: { ...selectTool, id: 'move', cursor: 'move' },
  // 'zoom' falls back to select; wheel-zoom is always active via Canvas
  zoom: { ...selectTool, id: 'zoom', cursor: 'zoom-in' },
};

export function getTool(id: string): Tool {
  return TOOLS[id] ?? selectTool;
}
