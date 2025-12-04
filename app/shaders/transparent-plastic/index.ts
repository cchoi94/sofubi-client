/**
 * Frosted Plastic Shader
 *
 * See-through frosted plastic with transmission.
 * - transmission: 1 (fully see-through)
 * - roughness: 0.7 (frosted/diffused look)
 * - clearcoat: for shiny plastic surface
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#e8eaec" },
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
    default: 1.0,
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.1,
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
 * Creates a frosted plastic material with transmission.
 *
 * Key difference from glass: higher roughness (0.7) for frosted look
 * Plus clearcoat for that shiny plastic surface.
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // Essential for transmission to work
    transparent: true,

    // Core properties - roughness is key for frosted look
    metalness: 0,
    roughness: 0.7, // Frosted/diffused!
    transmission: 1,
    thickness: 1.0,
    ior: 1.5,

    // Clearcoat - shiny surface on top of frosted material
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,

    // Color - slight tint
    color: new THREE.Color("#e8eaec"),
    envMapIntensity: 1.0,

    // Paint texture
    map: config.paintTexture,

    // Normal maps
    normalMap: config.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoatNormalMap: config.normalMap ?? null,
    clearcoatNormalScale: new THREE.Vector2(0.1, 0.1),

    // Attenuation
    attenuationColor: new THREE.Color("#ffffff"),
    attenuationDistance: 0.5,
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
  const physicalMat = material as THREE.MeshPhysicalMaterial;

  for (const [key, value] of Object.entries(params)) {
    if (key === "color" && typeof value === "string") {
      physicalMat.color.set(value);
    } else if (key === "transmission") {
      physicalMat.transmission = value;
    } else if (key === "thickness") {
      physicalMat.thickness = value;
    } else if (key === "roughness") {
      physicalMat.roughness = value;
    } else if (key === "clearcoat") {
      physicalMat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      physicalMat.clearcoatRoughness = value;
    } else if (key === "envMapIntensity") {
      physicalMat.envMapIntensity = value;
    }
  }

  physicalMat.needsUpdate = true;
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

export const transparentPlasticShader: CustomShader = {
  name: "Frosted Plastic",
  id: "transparent-plastic",
  description: "See-through frosted plastic with shiny surface",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
