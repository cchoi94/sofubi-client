import { ShaderId } from "../shaders";

// ============================================================================
// COLOR CONSTANTS
// ============================================================================

/**
 * Default colors for the color picker palette
 */
export const DEFAULT_COLORS = [
  "#ffffff", // White
  "#ff0000", // Red
  "#00ff00", // Green
  "#0000ff", // Blue
  "#ffff00", // Yellow
];

/**
 * Base colors for different shader types
 * These define the initial canvas color for each shader style
 */
export const SHADER_BASE_COLORS: Record<string, string> = {
  [ShaderId.GLASS]: "#f0f0f0",
  [ShaderId.PLASTIC]: "#888888",
  [ShaderId.STANDARD]: "#ffffff",
  [ShaderId.CERAMIC]: "#fafafa",
  [ShaderId.PEARLESCENT]: "#e0e0e0",
  [ShaderId.METAL]: "#c0c0c0",
};

/**
 * Default base color for the paint canvas
 */
export const BASE_COLOR = "#888888";

/**
 * Get the base color for a specific shader
 * @param shaderId - The shader ID to get the base color for
 * @returns The base color hex string
 */
export function getBaseColorForShader(shaderId: string): string {
  return SHADER_BASE_COLORS[shaderId] || BASE_COLOR;
}
