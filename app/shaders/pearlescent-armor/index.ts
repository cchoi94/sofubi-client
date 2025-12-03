/**
 * Pearlescent Shader
 *
 * Mother-of-pearl / nacre look - like the inside of an oyster shell.
 * Soft, milky iridescence with subtle rainbow color shifting.
 * - Low metalness (nacreous, not chrome)
 * - Medium roughness (soft sheen, not mirror)
 * - Subtle iridescence for color shifting
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#faf8f6" }, // Pure white pearl
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3, // Slightly lustrous
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.05, // Very smooth pearl surface
  },
  {
    name: "iridescence",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0, // Full iridescence for rainbow
  },
  {
    name: "iridescenceIOR",
    type: "number",
    min: 1,
    max: 2.5,
    step: 0.01,
    default: 1.3, // Lower = more rainbow spread
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0, // More reflections
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.8, // Natural lacquer-like surface
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.2, // Slightly soft clearcoat
  },
  {
    name: "sheen",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5, // Soft fabric-like sheen
  },
  {
    name: "sheenRoughness",
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
 * Creates a mother-of-pearl material using MeshPhysicalMaterial
 */
function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#faf8f6"), // Pure white pearl
    metalness: 0.3,
    roughness: 0.05, // Very smooth pearl surface
    iridescence: 1.0,
    iridescenceIOR: 1.3, // Lower IOR = more rainbow spread
    iridescenceThicknessRange: [100, 800], // Wider range = more color variation
    envMapIntensity: 1.0,
    clearcoat: 1.0, // Full clearcoat for glossy finish
    clearcoatRoughness: 0.0,
    sheen: 0.2,
    sheenRoughness: 0.3,
    sheenColor: new THREE.Color("#ffffff"), // White sheen
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
    } else if (key === "metalness") {
      physicalMat.metalness = value;
    } else if (key === "roughness") {
      physicalMat.roughness = value;
    } else if (key === "iridescence") {
      physicalMat.iridescence = value;
    } else if (key === "iridescenceIOR") {
      physicalMat.iridescenceIOR = value;
    } else if (key === "envMapIntensity") {
      physicalMat.envMapIntensity = value;
    } else if (key === "clearcoat") {
      physicalMat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      physicalMat.clearcoatRoughness = value;
    } else if (key === "sheen") {
      physicalMat.sheen = value;
    } else if (key === "sheenRoughness") {
      physicalMat.sheenRoughness = value;
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

export const pearlescentArmorShader: CustomShader = {
  name: "Mother of Pearl",
  id: "pearlescent-armor",
  description: "Soft nacreous iridescence like oyster shell interior",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
