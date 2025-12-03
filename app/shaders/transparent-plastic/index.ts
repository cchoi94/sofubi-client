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
 * Creates a frosted plastic material following the Codrops approach:
 * https://tympanus.net/codrops/2021/10/27/creating-the-effect-of-transparent-glass-and-plastic-in-three-js/
 *
 * Frosted glass/plastic uses:
 * - High roughness (0.7) for frosted diffusion
 * - clearcoat for shiny surface on top of frosted material
 * - normalMap affects transmission texture
 * - clearcoatNormalMap affects surface finish texture
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // Core properties from Codrops
    metalness: 0, // Non-metallic
    roughness: 0.7, // Frosted/diffused - key for plastic look!
    transmission: 1, // Fully transparent
    thickness: 1.0, // Higher thickness for more pronounced frosting

    // Refraction
    ior: 1.5, // Standard glass/plastic IOR

    // Clearcoat - shiny surface on frosted material (like polished plastic)
    clearcoat: 1.0,
    clearcoatRoughness: 0.1, // Smooth clearcoat surface

    // Color and reflections
    color: new THREE.Color("#e8eaec"), // Slight tint
    envMapIntensity: 1.0,

    // Textures - normalMap affects frosted transmission, clearcoatNormalMap affects shiny surface
    map: config.paintTexture,
    normalMap: config.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoatNormalMap: config.normalMap ?? null,
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
  name: "Clear Plastic",
  id: "transparent-plastic",
  description: "See-through frosted plastic with shiny surface",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
