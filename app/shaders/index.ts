/**
 * Shader Registry
 *
 * Central export for all available shaders. Import this file to get
 * access to all shaders and utility functions for the shader system.
 */

import type { CustomShader, ShaderConfig, ShaderGuiParam } from "./types";
import { standardShader } from "./standard";
import { pearlescentArmorShader } from "./pearlescent-armor/index";
import { transparentPlasticShader } from "./transparent-plastic/index";
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
  TRANSPARENT_PLASTIC: "transparent-plastic",
  METAL: "metal",
  PEARLESCENT: "pearlescent-armor",
  GLASS: "glass",
} as const;

export type ShaderIdType = (typeof ShaderId)[keyof typeof ShaderId];

// ============================================================================
// SHADER REGISTRY
// ============================================================================

/**
 * All available shaders in order of display
 */
export const shaders: CustomShader[] = [
  // standardShader,
  ceramicShader,
  metalShader,
  pearlescentArmorShader,
  glassShader,
  transparentPlasticShader,
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
export const DEFAULT_SHADER_ID: ShaderIdType = ShaderId.CERAMIC;

// Named exports for individual shaders
export {
  // standardShader,
  pearlescentArmorShader,
  transparentPlasticShader,
  glassShader,
  ceramicShader,
  metalShader,
};
