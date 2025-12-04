// Export all hooks
export { useKeyboardShortcuts } from "./useKeyboardShortcuts";
export type {
  UndoRedoState,
  KeyboardShortcutsConfig,
} from "./useKeyboardShortcuts";

export {
  usePaintPersistence,
  checkSavedPaintState,
  getSavedStateTimestamp,
  getSavedStateShaderId,
} from "./usePaintPersistence";
