// Export all hooks
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export type {
  UndoRedoState,
  KeyboardShortcutsConfig,
} from "./useKeyboardShortcuts";

export {
  usePaintPersistence,
  checkHasAnySavedPaintState,
  getLastSelectedModelId,
  getSavedModelIds,
} from "./usePaintPersistence";
export type {
  PersistentPaintState,
  PaintStorageRoot,
  UsePaintPersistenceOptions,
  UsePaintPersistenceReturn,
} from "./usePaintPersistence";
