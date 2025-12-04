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
    default: 0.5,
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0,
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
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates a clear glass material with proper transmission/refraction.
 *
 * Key settings for working transmission:
 * - transmission: 1 (fully transparent)
 * - thickness: controls refraction distortion amount
 * - roughness: 0 for clear glass, higher for frosted
 * - ior: index of refraction (1.5 for glass)
 * - transparent: must be true for transmission to work
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // Essential for transmission to work
    transparent: true,

    // Core glass properties
    metalness: 0,
    roughness: 0,
    transmission: 1,
    thickness: 0.5,
    ior: 1.5,

    // Color - white for clear glass
    color: new THREE.Color("#ffffff"),

    // Reflections
    envMapIntensity: 1.0,

    // Paint texture
    map: config.paintTexture,

    // Normal map for surface detail
    normalMap: config.normalMap ?? null,
    normalScale: new THREE.Vector2(0.5, 0.5),

    // Attenuation - tints light as it passes through
    attenuationColor: new THREE.Color("#ffffff"),
    attenuationDistance: 0.5,

    // Specular settings for better reflections
    specularIntensity: 1,
    specularColor: new THREE.Color("#ffffff"),
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
