/**
 * Ceramic Glaze Shader
 *
 * Smooth glazed pottery look using MeshPhysicalMaterial.
 * Based on: https://threejs.org/manual/#en/materials
 * - Low metalness (non-metallic)
 * - Low roughness (glossy glaze)
 * - Clearcoat for that glazed layer effect
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#f5f0e8" }, // Warm off-white clay
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.2, // Smooth glazed surface
  },
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0, // Non-metallic
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0, // Full glaze coating
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.1, // Smooth glaze
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 0.8,
  },
  {
    name: "ior",
    type: "number",
    min: 1,
    max: 2.5,
    step: 0.01,
    default: 1.5, // Glass-like glaze
  },
  {
    name: "reflectivity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates a ceramic glaze material using MeshPhysicalMaterial
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#f5f0e8"), // Warm off-white
    roughness: 0.2,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.8,
    ior: 1.5,
    reflectivity: 0.5,
    side: THREE.DoubleSide,
    // Use paint texture as the base map
    map: config.paintTexture,
    // Use original maps if available
    normalMap: config.normalMap || null,
    roughnessMap: config.roughnessMap || null,
    aoMap: config.aoMap || null,
  });

  // Set normal scale if normal map exists
  if (config.normalMap) {
    material.normalScale = new THREE.Vector2(1, 1);
  }

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
    } else if (key === "roughness") {
      physicalMat.roughness = value;
    } else if (key === "metalness") {
      physicalMat.metalness = value;
    } else if (key === "clearcoat") {
      physicalMat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      physicalMat.clearcoatRoughness = value;
    } else if (key === "envMapIntensity") {
      physicalMat.envMapIntensity = value;
    } else if (key === "ior") {
      physicalMat.ior = value;
    } else if (key === "reflectivity") {
      physicalMat.reflectivity = value;
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

export const ceramicShader: CustomShader = {
  name: "Ceramic Glaze",
  id: "ceramic-glaze",
  description: "Smooth glazed pottery with glossy clearcoat finish",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
