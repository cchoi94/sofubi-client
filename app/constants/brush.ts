import type { BrushState } from "./types";
import { BrushType } from "./types";

// ============================================================================
// BRUSH CONSTANTS
// ============================================================================

/**
 * Paint canvas size in pixels (2K resolution)
 */
export const PAINT_CANVAS_SIZE = 2048;

/**
 * Brush presets for different brush types
 */
export const BRUSH_PRESETS: Record<BrushType, Omit<BrushState, "color">> = {
  [BrushType.Airbrush]: {
    type: BrushType.Airbrush,
    radius: 50,
    opacity: 0.3,
    hardness: 0.1, // Very soft edges
  },
  [BrushType.Paintbrush]: {
    type: BrushType.Paintbrush,
    radius: 16,
    opacity: 1.0,
    hardness: 0.8, // Harder edges
  },
};

/**
 * Default brush configuration
 */
export const DEFAULT_BRUSH: BrushState = {
  ...BRUSH_PRESETS[BrushType.Airbrush],
  color: "#ff0000",
};
