// ============================================================================
// HOTKEY CONSTANTS
// ============================================================================

/**
 * Centralized hotkey configuration.
 * All keyboard shortcuts should be defined here so they can be easily
 * changed and the UI will automatically reflect the new bindings.
 */
export const HOTKEYS = {
  // Cursor mode hold-to-override shortcuts
  CURSOR_MOVE_HOLD: " ", // spacebar
  CURSOR_ROTATE_HOLD: "r",

  // Brush shortcuts
  BRUSH_AIRBRUSH: "a",
  BRUSH_PAINTBRUSH: "b",
  BRUSH_FILL: "f",
  BRUSH_SIZE_INCREASE: "=", // + key (= without shift)
  BRUSH_SIZE_DECREASE: "-",

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
  " ": "Space",
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
