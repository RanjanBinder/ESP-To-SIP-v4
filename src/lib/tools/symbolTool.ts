import { Tool } from '../../types/tool';
import { SymbolObject } from '../../types/scene';

/**
 * Symbol tool — places an instance of the armed library symbol at the click
 * point (click-to-place, centered), then returns to the select tool. The armed
 * symbol comes from the SymbolsPanel via ctx.pendingSymbol.
 */
const DEFAULT_W = 120;
const DEFAULT_H = 64;
let counter = 1;

export const symbolTool: Tool = {
  id: 'symbol',
  cursor: 'crosshair',

  onPointerDown(ctx) {
    const sym = ctx.pendingSymbol;
    if (!sym) return; // nothing armed — ignore

    const { world } = ctx.pointer;
    const obj: SymbolObject = {
      id: `symbol-inst-${Date.now()}-${counter++}`,
      type: 'symbol',
      name: sym.name,
      layerId: ctx.activeLayerId,
      locked: false,
      visible: true,
      x: world.x - DEFAULT_W / 2,
      y: world.y - DEFAULT_H / 2,
      width: DEFAULT_W,
      height: DEFAULT_H,
      rotation: 0,
      scale: 100,
      symbolId: sym.id,
      label: sym.name,
      sourceId: sym.id,
    };
    ctx.addObject(obj);       // pushes history + auto-selects
    ctx.setActiveTool('select');
  },
};
