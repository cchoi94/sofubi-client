/**
 * Glass Shader
 *
 * Clear, transparent glass with refraction.
 * Uses transmission for real glass effect.
 * - roughness: 0 (perfectly smooth)
 * - transmission: 1 (fully transparent)
 * - thickness for refraction depth
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#ffffff" },
  {
    name: "transmission",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "thickness",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.5, // Higher for more refraction
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.05, // Slight roughness to soften aliasing
  },
  {
    name: "ior",
    type: "number",
    min: 1,
    max: 2.5,
    step: 0.01,
    default: 1.5,
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0, // Shiny surface coating
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0, // Perfectly smooth clearcoat
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.5, // Strong environment reflections
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates a clear glass material following the Codrops approach:
 * https://tympanus.net/codrops/2021/10/27/creating-the-effect-of-transparent-glass-and-plastic-in-three-js/
 *
 * Key insights from Codrops:
 * - thickness is "the magic" for refraction
 * - Small roughness (0.05-0.15) helps soften aliasing
 * - clearcoat adds polished surface reflections
 * - Always use envMap for best results
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // Core glass properties from Codrops
    metalness: 0, // Non-metallic - essential for glass
    roughness: 0.05, // Slight roughness to soften aliasing on transmitted content
    transmission: 1, // Fully transparent
    thickness: 1.5, // Higher thickness for more pronounced refraction

    // Refraction settings
    ior: 1.5, // Index of refraction (glass ~1.5)

    // Clearcoat - adds polished surface reflections
    clearcoat: 1.0,
    clearcoatRoughness: 0.0, // Smooth surface

    // Color and reflections
    color: new THREE.Color("#ffffff"),
    envMapIntensity: 1.5, // Strong reflections

    // Textures
    map: config.paintTexture,
    normalMap: config.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoatNormalMap: config.normalMap ?? null, // Surface finish texture
    clearcoatNormalScale: new THREE.Vector2(0.1, 0.1),
  });

  return material;
}

/**
 * Updates material properties when GUI params change
 */
function updateUniforms(
  material: THREE.Material,
  params: Record<string, any>
): void {
  const mat = material as THREE.MeshPhysicalMaterial;

  for (const [key, value] of Object.entries(params)) {
    if (key === "color" && typeof value === "string") {
      mat.color.set(value);
    } else if (key === "transmission") {
      mat.transmission = value;
    } else if (key === "thickness") {
      mat.thickness = value;
    } else if (key === "roughness") {
      mat.roughness = value;
    } else if (key === "ior") {
      mat.ior = value;
    } else if (key === "clearcoat") {
      mat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      mat.clearcoatRoughness = value;
    } else if (key === "envMapIntensity") {
      mat.envMapIntensity = value;
    }
  }

  mat.needsUpdate = true;
}

/**
 * Cleanup function
 */
function dispose(material: THREE.Material): void {
  material.dispose();
}

// ============================================================================
// EXPORT
// ============================================================================

export const glassShader: CustomShader = {
  name: "Glass",
  id: "glass",
  description: "Clear transparent glass with refraction",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
