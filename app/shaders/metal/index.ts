/**
 * Metal Shader
 *
 * Die-cast toy metal look - matte metallic like zinc/zamak alloy.
 * Uses MeshPhysicalMaterial for realistic metallic appearance with envMap.
 * Based on: https://threejs.org/manual/#en/materials
 * - metalness: 1.0 (fully metallic)
 * - roughness: 0.3-0.4 (slightly rough, not mirror)
 * - envMapIntensity for soft environment reflections
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#ffffff" }, // Bright metal silver
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0, // Fully metallic
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.35, // Die-cast is slightly rough, not mirror-smooth
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0, // No clearcoat for raw die-cast
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates a die-cast metal material using MeshPhysicalMaterial
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#ffffff"), // Bright metal silver
    metalness: 1.0,
    roughness: 0.35,
    envMapIntensity: 1.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.0,
    side: THREE.DoubleSide,
    // Use paint texture as the base map
    map: config.paintTexture,
    // Use original maps if available
    normalMap: config.normalMap || null,
    roughnessMap: config.roughnessMap || null,
    metalnessMap: config.metalnessMap || null,
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
    } else if (key === "metalness") {
      physicalMat.metalness = value;
    } else if (key === "roughness") {
      physicalMat.roughness = value;
    } else if (key === "envMapIntensity") {
      physicalMat.envMapIntensity = value;
    } else if (key === "clearcoat") {
      physicalMat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      physicalMat.clearcoatRoughness = value;
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

export const metalShader: CustomShader = {
  name: "Die-Cast Metal",
  id: "metal",
  description: "Matte metallic zinc/zamak die-cast toy look",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
