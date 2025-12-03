/**
 * Standard PBR Shader (MeshStandardMaterial wrapper)
 *
 * This is the default shader that wraps three.js's built-in
 * MeshStandardMaterial for PBR rendering. It serves as the baseline
 * for comparing custom shaders.
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "./types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
  },
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.0,
  },
  {
    name: "normalScale",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.5,
  },
  {
    name: "emissiveIntensity",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.0,
  },
  { name: "emissiveColor", type: "color", default: "#000000" },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates the standard PBR material
 */
function createMaterial(config: ShaderConfig): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    map: config.paintTexture,
    normalMap: config.normalMap || null,
    normalScale: new THREE.Vector2(1, 1),
    roughnessMap: config.roughnessMap || null,
    roughness: 0.7,
    metalnessMap: config.metalnessMap || null,
    metalness: 0.0,
    aoMap: config.aoMap || null,
    aoMapIntensity: 1.0,
    bumpMap: config.bumpMap || null,
    bumpScale: 1.0,
    emissive: new THREE.Color(0x000000),
    emissiveMap: config.emissiveMap || null,
    emissiveIntensity: 0.0,
    envMap: config.envMap || null,
    envMapIntensity: 0.5,
    side: THREE.FrontSide,
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
  const standardMaterial = material as THREE.MeshStandardMaterial;

  if (params.roughness !== undefined) {
    standardMaterial.roughness = params.roughness;
  }
  if (params.metalness !== undefined) {
    standardMaterial.metalness = params.metalness;
  }
  if (params.normalScale !== undefined && standardMaterial.normalScale) {
    standardMaterial.normalScale.set(params.normalScale, params.normalScale);
  }
  if (params.envMapIntensity !== undefined) {
    standardMaterial.envMapIntensity = params.envMapIntensity;
  }
  if (params.emissiveIntensity !== undefined) {
    standardMaterial.emissiveIntensity = params.emissiveIntensity;
  }
  if (params.emissiveColor !== undefined) {
    standardMaterial.emissive.set(params.emissiveColor);
  }

  standardMaterial.needsUpdate = true;
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

export const standardShader: CustomShader = {
  name: "Standard PBR",
  id: "standard-pbr",
  description:
    "Default physically-based rendering with roughness and metalness controls",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
