/**
 * Shader Registry
 *
 * Central export for all available shaders. Import this file to get
 * access to all shaders and utility functions for the shader system.
 */

import type { CustomShader, ShaderConfig, ShaderGuiParam } from "./types";
import { standardShader } from "./standard";
import { pearlescentArmorShader } from "./pearlescent-armor/index";
import { plasticShader } from "./plastic/index";
import { glassShader } from "./glass/index";
import { ceramicShader } from "./ceramic/index";
import { metalShader } from "./metal/index";

// Re-export types
export type { CustomShader, ShaderConfig, ShaderGuiParam };

// ============================================================================
// SHADER IDS - Use these enums for consistency
// ============================================================================

export const ShaderId = {
  STANDARD: "standard-pbr",
  CERAMIC: "ceramic-glaze",
  PLASTIC: "plastic",
  METAL: "metal",
  PEARLESCENT: "pearlescent-armor",
  GLASS: "glass",
} as const;

export type ShaderIdType = (typeof ShaderId)[keyof typeof ShaderId];

// ============================================================================
// MATERIAL ID REGISTRY
// ============================================================================

/**
 * Maps shader IDs to numeric material IDs (0-255) for the material mask texture.
 * Material ID 0 is reserved for the base plastic shader (unpainted areas).
 *
 * The material mask's R channel stores these IDs:
 * - 0 = Base plastic (default, unpainted)
 * - 1-255 = Painted materials
 */
/**
 * Material ID map using normalized 0-1 values.
 * These are written to the material mask texture and read by the shader.
 * Using normalized values avoids gamma correction issues.
 */
export const MATERIAL_ID_MAP: Record<string, number> = {
  [ShaderId.PLASTIC]: 0.0,      // 0/255 - Base (unpainted)
  [ShaderId.METAL]: 0.2,        // 51/255 - Die-cast metal
  [ShaderId.GLASS]: 0.4,        // 102/255 - Glass
  [ShaderId.CERAMIC]: 0.6,      // 153/255 - Ceramic
  [ShaderId.PEARLESCENT]: 0.75, // 191/255 - Pearlescent
  [ShaderId.STANDARD]: 0.9,     // 229/255 - Standard PBR
} as const;

/**
 * Reverse map: numeric ID to shader ID
 */
export const MATERIAL_ID_REVERSE_MAP: Record<number, string> = Object.fromEntries(
  Object.entries(MATERIAL_ID_MAP).map(([k, v]) => [v, k])
);

/**
 * Get numeric material ID from shader ID
 */
export function getMaterialId(shaderId: string): number {
  return MATERIAL_ID_MAP[shaderId] ?? 0; // Default to plastic
}

/**
 * Get shader ID from numeric material ID
 */
export function getShaderId(materialId: number): string | undefined {
  return MATERIAL_ID_REVERSE_MAP[materialId];
}

// ============================================================================
// SHADER REGISTRY
// ============================================================================

/**
 * All available shaders in order of display
 */
export const shaders: CustomShader[] = [
  // standardShader,
  // ceramicShader,
  metalShader,
  plasticShader,
  // pearlescentArmorShader,
  // glassShader,
];

/**
 * Map of shader id to shader for quick lookup
 */
export const shaderMap: Record<string, CustomShader> = Object.fromEntries(
  shaders.map((shader) => [shader.id, shader])
);

/**
 * Get shader by ID
 */
export function getShaderById(id: string): CustomShader | undefined {
  return shaderMap[id];
}

/**
 * Get list of shader names for dropdown
 */
export function getShaderNames(): { id: string; name: string }[] {
  return shaders.map((s) => ({ id: s.id, name: s.name }));
}

/**
 * Default shader ID
 */
export const DEFAULT_SHADER_ID: ShaderIdType = ShaderId.PLASTIC;

// Named exports for individual shaders
export {
  // standardShader,
  pearlescentArmorShader,
  plasticShader,
  glassShader,
  ceramicShader,
  metalShader,
};
