import { Tool } from '../../types/tool';

/**
 * Track tool registry entry (Assets → ESP → Track).
 *
 * The Track tool's interaction is richer than the click/drag `Tool` contract —
 * it has phases, inline choices and numeric entry — so its state lives in the
 * pure reducer at lib/track/session.ts, driven by `trackDrawStore` and rendered
 * by `TrackDrawOverlay`. This entry exists so the canvas picks up the crosshair
 * cursor and the toolbar highlights Track like any other tool.
 *
 * Pointer events are routed to the session by `Canvas` (the same pattern the
 * parameter-drawing tools already use), not through `onPointerDown` here.
 */
export const trackTool: Tool = {
  id: 'track',
  cursor: 'crosshair',
};
