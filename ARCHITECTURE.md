# ESP Editor — Architecture

Engineering-diagram editor (CAD-style) for railway ESP drawings. React 19 + TypeScript
(**built with Vite**), infinite world-coordinate canvas, layers, tools, properties panels.
Plus an embedded **DXF/DWG mode** powered by the cad-viewer engine (see §12).

This document is the contract for how the app is structured so that adding full
end-to-end functionality (tools, objects, history, persistence) does **not** break
what already works. Read it before adding a feature.

---

## 1. Layered architecture

The app is organized in strict dependency layers. **Dependencies point downward only.**

```
┌─────────────────────────────────────────────────────────────┐
│  UI / Components        EditorPage, TopBar, panels, Canvas    │  React views
│                         components/ui/* (shared primitives)    │
├─────────────────────────────────────────────────────────────┤
│  State / Store          store/editorStore (Context provider)   │  app state + actions
│                         → splits into slices (see §4)          │
├─────────────────────────────────────────────────────────────┤
│  Domain logic / lib     lib/grid, lib/layerTree, lib/tools,    │  pure functions
│                         lib/commands, lib/serialize            │  (no React)
├─────────────────────────────────────────────────────────────┤
│  Domain model / types   types/scene (CanvasObject union),      │  data shapes
│                         types/* (tools, commands, viewport)    │  (no logic)
└─────────────────────────────────────────────────────────────┘
```

Rules:
- `types/` has **no logic and no imports** from upper layers.
- `lib/` is **pure** (no React, no store). Unit-testable in isolation.
- `store/` is the only place that holds mutable state and wires actions.
- Components read state via `useEditor()` and never mutate it directly.

---

## 2. Coordinate system

One rule, applied everywhere: **all geometry is stored in world units.**
Screen ↔ world conversion happens *only* at the viewport boundary via
`screenToWorld` / `worldToScreen` (store) — never ad hoc inside components.

- `world` units → `lib/grid.ts` `PIXELS_PER_INCH` defines the inch.
- `screenX = worldX * zoom + panX` (see store viewport actions).
- The canvas renders objects inside `CanvasViewport`, which applies
  `translate(pan) scale(zoom)`; object styles use raw world coords.

---

## 3. Domain model (`types/scene.ts`) — the spine

Everything on the canvas is a `CanvasObject`, a **discriminated union on `type`**:

```ts
type CanvasObject = TextObject;          // | LineObject | RectangleObject | …
```

- `BaseCanvasObject` holds the fields every object shares: id, type, name,
  layerId, locked, visible, x/y/width/height, rotation, scale, parentId,
  override foundation (sourceId/isOverride).
- Each kind extends the base and narrows `type` (e.g. `TextObject` has
  `type: 'text'` + text fields).
- `DraftTextObject` is the transient "being edited" shape; it is converted to a
  `TextObject` on commit (`store.convertToTextObject`).

**Adding a new object = add an interface here + add it to the union + add a type
guard.** Renderers and panels switch on `obj.type`; nothing invents its own shape.

This is the single most important file for scaling. It already exists and the
store re-exports from it for backward compatibility.

---

## 4. State management (`store/editorStore.tsx`)

Today: one React Context provider holding all state. It works but is monolithic
(~900 lines) and re-renders broadly. Target: **split into focused slices** behind
the same `useEditor()` facade so component imports don't change.

Planned slices (each a hook returning its state + actions, composed in the provider):

| Slice            | Owns                                                            |
|------------------|----------------------------------------------------------------|
| `viewportSlice`  | zoom, pan, screen/world conversion                             |
| `sceneSlice`     | `objects: CanvasObject[]`, selection, hover, CRUD, z-order     |
| `layerSlice`     | layers tree, active/selected layer, reorder, visibility/lock   |
| `toolSlice`      | `activeTool`, tool registry dispatch (see §5)                  |
| `textEditSlice`  | draft text, editing target, commit/cancel                     |
| `historySlice`   | undo/redo stacks (see §6)                                      |
| `uiSlice`        | left panel, canvas settings                                    |

> DONE (Phase 2): the scene is a single `objects: CanvasObject[]` with a single
> `selectedObjectId`. `selectedObject` / `selectedTextObject` are **derived** from
> them (no duplicated copy to keep in sync). Generalized CRUD —
> `addObject` / `updateObject` / `deleteObject` / `deleteSelectedObject` /
> `selectObject` / `setHoveredObject` — plus text conveniences
> (`updateTextObject`, `enterTextEditMode`, hyperlink) built on top.

**StrictMode invariant:** every `setState` updater must be **pure and top-level**.
Never call one `setState` inside another's updater — StrictMode double-invokes
updaters and will duplicate appends. Read current state via `useCallback` deps.

---

## 5. Tools system (`lib/tools/`) — DONE (Phase 3)

Each interaction mode is a self-contained `Tool` (`types/tool.ts`); `Canvas`
owns navigation (pan/zoom) and pointer plumbing, hit-tests the scene, builds a
`ToolContext`, and dispatches to the active tool.

```ts
interface Tool {
  id: string;                                   // 'select' | 'text' | …
  cursor: string;
  onPointerDown?(ctx): DragSession | void;      // return a session to start a drag
  onDoubleClick?(ctx): void;
}
interface DragSession { onMove(world): void; onUp?(world): void; }
```

- `lib/tools/registry.ts` maps id → Tool (`getTool(id)` falls back to select).
  `BottomToolbar` sets `activeTool`; `Canvas` forwards to `getTool(activeTool)`.
- **Hit-testing** is DOM-based: object views render `data-object-id`; the canvas
  reads `e.target.closest('[data-object-id]')`. Object views are pure render —
  no per-object event handlers.
- Implemented: `selectTool` (click select/deselect, **drag to move**, dbl-click
  edit) and `textTool` (click to place a draft). Adding a tool = implement
  `Tool` + register it. **No `Canvas` edits.**
- Drag state lives in a `DragSession` returned from `onPointerDown` (closes over
  the start state); the canvas drives it from global mousemove/up.

---

## 6. Undo / redo history — DONE (Phase 4)

**Snapshot-based** rather than do/undo command pairs — objects are immutable plain
data, so a snapshot is a cheap array of structurally-shared refs and correctness
is trivial (no hand-written inverse logic to get wrong).

- Store holds `past: CanvasObject[][]` / `future: CanvasObject[][]` (capped at 100).
- `pushHistory()` snapshots the current `objects` before a mutation; `undo()` /
  `redo()` move snapshots between the stacks. `canUndo` / `canRedo` exposed for UI.
- **Coalescing:** consecutive `updateObject` edits to the *same* id collapse into
  one undo step (typing a name = one undo, not one-per-keystroke). Any other
  action (select, add, delete, drag, commit) breaks the coalesce run.
- **Drags = one entry:** a tool calls `beginHistory()` on the first move, then
  `updateObjectTransient()` (no history) for the rest. See `selectTool`.
- Wired keys (canvas, skipped while typing/editing): Cmd/Ctrl+Z undo,
  Cmd/Ctrl+Shift+Z or Ctrl+Y redo, Delete/Backspace delete selected.
- Scope: scene `objects` only. Layer/canvas-settings history is a later add.

---

## 7. Rendering

- `Canvas` (DOM) hosts grid, axis, the world-space `CanvasViewport`, overlays.
- Objects render as absolutely-positioned world-space nodes today (fine for text
  and light shapes). **If object counts grow large**, the renderer can move to a
  single `<canvas>`/SVG layer without changing the domain model — that's the
  payoff of keeping geometry in `types/scene`.
- HUD (zoom %, coords) and floating editors live above the viewport, counter-
  scaled where needed.

---

## 8. Serialization / persistence (`lib/serialize.ts`) — DONE (Phase 5)

The scene is plain serializable data, so the document is just:

```ts
interface EspDocument {
  version: number; layers; objects; canvasSettings; activeLayerId;
}
```

- `serializeDocument` / `parseDocument` (validates shape + `migrateDocument`).
- **Autosave**: store debounces (500ms) to `localStorage` on any scene change;
  the provider restores it via lazy `useState` initializers on load.
- **Store API**: `getDocument()` / `loadDocument(doc)` (load resets selection +
  history). `loadDocument` runs the migration.
- **TopBar**: Export (download JSON), Import (file picker → load), Save (persist
  now, with a "Saved ✓" tick).
- `serialize.ts` stays runtime-pure — `Layer`/`CanvasSettings` come in via
  `import type` (erased), so there's no runtime store dependency or import cycle.
- Add a migration case per schema bump; bump `DOCUMENT_VERSION`.

---

## 9. Shared UI primitives (`components/ui/`) — to consolidate

`RightPropertiesPanel` and `TextPropertiesPanel` currently each define their own
`PropertyRow`, `Section`, `SegmentedControl`, `IconButton`, `Select`,
`NumberInput`. This duplication is the #1 maintainability risk as panels multiply.

Target: one canonical set in `components/ui/` (see
[memory: right-panel-config-rules] for the exact sizing spec — 320px panel, 32px
headers, 36px rows, 86px labels, `#f4f4f5` 32px inputs, 28px icon buttons). Every
property panel composes these. New tools get a panel for free.

---

## 10. Directory layout (target)

```
src/
  types/         scene.ts, tool.ts, command.ts, document.ts
  lib/           grid.ts, layerTree.ts, tools/, commands/, serialize.ts
  store/         editorStore.tsx + slices/
  components/
    ui/          PropertyRow, Section, SegmentedControl, IconButton, …
    canvas/      Canvas, CanvasGrid, CanvasAxis, CanvasViewport, CanvasOverlay
    panels/      Right/Text/Layers/Symbols/Styles panels
    chrome/      TopBar, LeftSidebar, BottomToolbar
  App.tsx, index.tsx
```

Existing flat `components/` works; move into sub-folders opportunistically when a
file is already being edited (avoid a churn-only move commit).

---

## 11. Roadmap (sequenced to avoid regressions)

- **Phase 0 — Stabilize (DONE).** Domain model extracted to `types/scene.ts`;
  dead code removed; all lint warnings cleared; `selectedObjectId` wired;
  StrictMode-safe store actions; `tsconfig` target → es2017.
- **Phase 1 — Shared UI primitives (DONE).** `components/ui/` is the canonical
  kit; both property panels import from it.
- **Phase 2 — Generalize the scene (DONE).** `placedTextObjects` → single
  `objects: CanvasObject[]`; unified `selectedObjectId` with derived
  `selectedObject`/`selectedTextObject`; generalized CRUD (`addObject`,
  `updateObject`, `deleteObject`, `deleteSelectedObject`, `selectObject`,
  `setHoveredObject`). Canvas migrated to the new API.
- **Phase 3 — Tool registry (DONE).** `types/tool.ts` + `lib/tools/`
  (select with drag-to-move, text); `Canvas` dispatches via `getTool(activeTool)`
  with DOM hit-testing. Next tools (line/rectangle/ellipse) just register.
- **Phase 4 — Undo/redo (DONE).** Snapshot history with coalescing + drag
  batching; Cmd/Ctrl+Z / Shift+Z / Ctrl+Y / Delete wired.
- **Phase 5 — Serialization (DONE).** `lib/serialize.ts` document model +
  migration; localStorage autosave + restore; TopBar Export/Import/Save.
- **Phase 6 — Objects (in progress).** Shipped: rectangle, ellipse, line
  (`drawTool` factory, `ShapeView`, `ShapePropertiesPanel`) and **symbols** —
  `SymbolObject` in `types/scene.ts`, `symbolTool` (click-to-place the symbol
  armed from `SymbolsPanel` via `ctx.pendingSymbol`), `SymbolView` block
  renderer, `SymbolPropertiesPanel`. Each new type touched only its own new
  files + a one-line render + one-line route. No changes to history, selection,
  serialization or the canvas dispatch loop. Next: dimensions, connectors.

Phases 0–5 (the foundation) are complete; the app remains fully working after
each. Feature work now builds on a stable model, tool registry, history and
persistence without structural churn — Phase 6 added three object types touching
only their own new files plus a one-line render + one-line route.

---

## 12. DXF/DWG mode (cad-viewer integration)

The app has two **modes**, toggled in the TopBar (`EditorPage` owns `mode`):

- **ESP Editor** — everything in §1–§11 (our DOM/`CanvasObject` engine).
- **DXF / DWG** — the [`@mlightcad/cad-viewer`](https://github.com/mlightcad/cad-viewer)
  engine (`@mlightcad/cad-simple-viewer`, Three.js/WebGL) embedded for full
  DXF/DWG view + edit + tools.

These are **two independent engines** (DOM vs WebGL, our model vs AutoCAD-style
`AcDb` model). They coexist as modes; they do not share a scene. The ESP editor
is hidden (`display:none`, not unmounted) while in DXF mode so its state persists.

Key pieces:
- **`components/DxfWorkspace.tsx`** — React wrapper. Mounts the singleton
  `AcApDocManager.createInstance({ container, autoResize, webworkerFileUrls })`
  **once** (module-level `engineCreated` guard; never destroyed) on first
  activation, so it survives mode-toggling and StrictMode's dev double-invoke.
  Opens files via `openDocument(name, ArrayBuffer, { mode: Write })`; runs engine
  commands via `sendStringToExecute(...)` (wrapped in try/catch).
- **Lazy-loaded** via `React.lazy` in `EditorPage` — the engine + Three.js is a
  ~2.5 MB chunk (`DxfWorkspace-*.js`) loaded only on first DXF use; the ESP
  editor's initial bundle stays ~415 KB.
- **Workers/WASM**: the DXF parser, DWG parser, and mtext-renderer ship as worker
  JS inside `node_modules`. `vite.config.mts` copies them to `/assets/*` via
  `vite-plugin-static-copy`; `webworkerFileUrls` in `DxfWorkspace` points there.
  (DWG also needs `libredwg.wasm` from `@mlightcad/libredwg-web` — not yet added;
  **DXF works today, DWG needs that wasm**.)

Build: **Vite** (`vite.config.mts` — named `.mts` so the ESM-only static-copy
plugin loads without forcing `type:module`, which would break `react-scripts test`).
Deps installed with `--legacy-peer-deps` (CRA's `@types/node@16` vs Vite ≥18).
`lodash-es` is a required transitive dep of cad-simple-viewer.

**Verified:** `tsc` + `vite build` pass; dev server serves the app and the copied
worker assets (200). **Not yet verified in-session:** the actual WebGL DXF render
(needs a browser + a sample .dxf — run `npm start`, switch to *DXF / DWG*, Open a file).
