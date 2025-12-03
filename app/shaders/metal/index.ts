/**
 * Metal Shader
 *
 * Die-cast toy metal look - matte metallic like zinc/zamak alloy.
 * Features:
 * - GGX BRDF for realistic metallic specular
 * - Soft environment lighting
 * - Visible base color (not pure chrome)
 * - Subtle edge darkening for cast metal feel
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// Import GLSL shaders
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "metalColor", type: "color", default: "#8a8a8a" }, // Die-cast zinc gray
  {
    name: "metalness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.9,
  },
  {
    name: "roughness",
    type: "number",
    min: 0.15,
    max: 1,
    step: 0.01,
    default: 0.35, // Die-cast is slightly rough, not mirror-smooth
  },
  {
    name: "reflectivity",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.6, // Moderate reflectivity
  },
  { name: "lightColor", type: "color", default: "#ffffff" },
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 5,
    step: 0.01,
    default: 1.2,
  },
  {
    name: "specularIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 0.8, // Softer specular for matte look
  },
  {
    name: "ambientIntensity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.25,
  },
  {
    name: "fresnelStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.5,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates the metal material
 */
function createMaterial(config: ShaderConfig): THREE.ShaderMaterial {
  const uniforms = {
    paintTexture: { value: config.paintTexture },
    normalMap: { value: config.normalMap || null },
    roughnessMap: { value: config.roughnessMap || null },
    metalnessMap: { value: config.metalnessMap || null },
    aoMap: { value: config.aoMap || null },
    normalScale: { value: 1.0 },
    useNormalMap: { value: config.normalMap ? 1.0 : 0.0 },
    useRoughnessMap: { value: config.roughnessMap ? 1.0 : 0.0 },
    useMetalnessMap: { value: config.metalnessMap ? 1.0 : 0.0 },
    useAoMap: { value: config.aoMap ? 1.0 : 0.0 },
    metalColor: { value: new THREE.Color("#a8a8a8") },
    metalness: { value: 1.0 },
    roughness: { value: 0.15 },
    reflectivity: { value: 1.2 },
    anisotropy: { value: 0.0 },
    lightColor: { value: new THREE.Color("#ffffff") },
    lightIntensity: { value: 1.5 },
    specularIntensity: { value: 1.5 },
    ambientIntensity: { value: 0.15 },
    fresnelStrength: { value: 0.5 },
  };

  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });
}

/**
 * Updates shader uniforms when GUI params change
 */
function updateUniforms(
  material: THREE.Material,
  params: Record<string, any>
): void {
  const shaderMaterial = material as THREE.ShaderMaterial;
  if (!shaderMaterial.uniforms) return;

  // Update each uniform based on param type
  for (const [key, value] of Object.entries(params)) {
    if (shaderMaterial.uniforms[key]) {
      if (typeof value === "string" && value.startsWith("#")) {
        // Color value
        shaderMaterial.uniforms[key].value.set(value);
      } else {
        // Numeric value
        shaderMaterial.uniforms[key].value = value;
      }
    }
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export const metalShader: CustomShader = {
  name: "Die-Cast Metal",
  id: "metal",
  description:
    "Polished die-cast metal with sharp highlights and strong reflections",
  createMaterial,
  guiParams,
  updateUniforms,
};
