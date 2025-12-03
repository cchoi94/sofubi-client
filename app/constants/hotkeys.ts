// ============================================================================
// HOTKEY CONSTANTS
// ============================================================================

/**
 * Centralized hotkey configuration.
 * All keyboard shortcuts should be defined here so they can be easily
 * changed and the UI will automatically reflect the new bindings.
 */
export const HOTKEYS = {
  // Cursor mode shortcuts
  CURSOR_MOVE: "q",
  CURSOR_ROTATE: "w",

  // Brush shortcuts
  BRUSH_AIRBRUSH: "1",
  BRUSH_PAINTBRUSH: "2",

  // Camera orbit shortcuts
  ORBIT_LEFT: "ArrowLeft",
  ORBIT_RIGHT: "ArrowRight",
  ORBIT_UP: "ArrowUp",
  ORBIT_DOWN: "ArrowDown",
} as const;

/**
 * Display labels for hotkeys (for showing in UI tooltips, etc.)
 * Maps the key code to a human-readable label.
 */
export const HOTKEY_LABELS: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  // Single letter keys display as uppercase
};

/**
 * Get the display label for a hotkey.
 * Returns uppercase letter for single chars, or mapped label for special keys.
 */
export function getHotkeyLabel(key: string): string {
  if (HOTKEY_LABELS[key]) {
    return HOTKEY_LABELS[key];
  }
  // Single character keys display as uppercase
  if (key.length === 1) {
    return key.toUpperCase();
  }
  return key;
}
