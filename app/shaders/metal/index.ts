/**
 * Metal Shader
 *
 * Die-cast toy metal look - matte metallic like zinc/zamak alloy.
 * Uses custom ShaderMaterial for precise control and multi-material masking.
 * - Realistic GGX BRDF for metal specular
 * - Soft highlights (not mirror-smooth)
 * - Multi-light setup for die-cast look
 * - Material ID masking support
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  {
    name: "metalColor",
    type: "color",
    default: "#d4d4d8" // Zinc-like silver
  },
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.35,
  },
  {
    name: "reflectivity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
  {
    name: "normalScale",
    type: "number",
    min: 0,
    max: 10,
    step: 0.1,
    default: 1.0,
  },
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0,
  },
  {
    name: "specularIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.5,
  },
  {
    name: "ambientIntensity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
  },
  {
    name: "fresnelStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.0,
  },
];

// ============================================================================
// MATERIAL CREATION
// ============================================================================

function createMaterial(config: ShaderConfig): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,

    uniforms: {
      // Paint texture
      paintTexture: { value: config.paintTexture || null },

      // Original GLB textures
      normalMap: { value: config.normalMap || null },
      useNormalMap: { value: config.normalMap ? 1.0 : 0.0 },
      normalScale: { value: 1.0 },

      roughnessMap: { value: config.roughnessMap || null },
      useRoughnessMap: { value: config.roughnessMap ? 1.0 : 0.0 },

      metalnessMap: { value: config.metalnessMap || null },
      useMetalnessMap: { value: config.metalnessMap ? 1.0 : 0.0 },

      aoMap: { value: config.aoMap || null },
      useAoMap: { value: config.aoMap ? 1.0 : 0.0 },

      // Material ID mask for multi-material painting
      materialMask: { value: config.materialMask || null },
      useMaterialMask: { value: config.materialMask ? 1.0 : 0.0 },
      materialId: { value: 1.0 }, // Metal shader is material ID 1

      // Material properties
      metalColor: { value: new THREE.Color("#d4d4d8") },
      metalness: { value: 1.0 },
      roughness: { value: 0.35 },
      reflectivity: { value: 0.5 },
      anisotropy: { value: 0.0 },

      // Lighting
      lightColor: { value: new THREE.Color(1, 1, 1) },
      lightIntensity: { value: 1.0 },
      specularIntensity: { value: 1.5 },
      ambientIntensity: { value: 0.3 },
      fresnelStrength: { value: 1.0 },
    },

    side: THREE.FrontSide,
    transparent: false,
  });

  return material;
}

// ============================================================================
// UNIFORM UPDATES
// ============================================================================

function updateUniforms(
  material: THREE.Material,
  params: Record<string, any>
): void {
  const shaderMat = material as THREE.ShaderMaterial;
  const uniforms = shaderMat.uniforms;

  for (const [key, value] of Object.entries(params)) {
    if (key === "metalColor" && typeof value === "string") {
      uniforms.metalColor.value.set(value);
    } else if (key === "metalness") {
      uniforms.metalness.value = value;
    } else if (key === "roughness") {
      uniforms.roughness.value = value;
    } else if (key === "reflectivity") {
      uniforms.reflectivity.value = value;
    } else if (key === "normalScale") {
      uniforms.normalScale.value = value;
    } else if (key === "lightIntensity") {
      uniforms.lightIntensity.value = value;
    } else if (key === "specularIntensity") {
      uniforms.specularIntensity.value = value;
    } else if (key === "ambientIntensity") {
      uniforms.ambientIntensity.value = value;
    } else if (key === "fresnelStrength") {
      uniforms.fresnelStrength.value = value;
    }
  }

  shaderMat.needsUpdate = true;
}

// ============================================================================
// CLEANUP
// ============================================================================

function dispose(material: THREE.Material): void {
  material.dispose();
}

// ============================================================================
// EXPORT
// ============================================================================

export const metalShader: CustomShader = {
  name: "Die-Cast Metal",
  id: "metal",
  description: "Matte metallic zinc/zamak die-cast toy look with material masking",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
