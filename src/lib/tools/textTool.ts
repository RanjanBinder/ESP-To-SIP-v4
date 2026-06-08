import { Tool } from '../../types/tool';

/**
 * Text tool — click empty canvas to start a floating text draft; click an
 * existing object to select it; double-click a text object to edit it.
 */
export const textTool: Tool = {
  id: 'text',
  cursor: 'text',

  onPointerDown(ctx) {
    const { hitObjectId, world } = ctx.pointer;
    if (hitObjectId) {
      ctx.selectObject(hitObjectId);
      return;
    }
    ctx.startTextDraft(world);
  },

  onDoubleClick(ctx) {
    if (ctx.pointer.hitObjectId) ctx.enterTextEditMode(ctx.pointer.hitObjectId);
  },
};
