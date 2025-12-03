/**
 * Ceramic Glaze Shader
 *
 * A custom shader that creates a smooth glazed pottery look.
 * Features:
 * - Soft diffuse lighting with wrap
 * - Glossy but not mirror-like specular
 * - Subtle subsurface scattering simulation
 * - Glaze coating with fresnel rim
 * - Warm ambient tones
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
  { name: "baseColor", type: "color", default: "#f5f0e8" }, // Warm off-white clay
  { name: "glazeColor", type: "color", default: "#e8e4dc" }, // Slightly warm glaze
  {
    name: "glazeThickness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
  {
    name: "glossiness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
  },
  {
    name: "subsurfaceStrength",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
  },
  {
    name: "fresnelPower",
    type: "number",
    min: 1,
    max: 5,
    step: 0.1,
    default: 2.5,
  },
  { name: "lightColor", type: "color", default: "#fffaf5" }, // Warm white light
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.2,
  },
  {
    name: "specularIntensity",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.8,
  },
  {
    name: "ambientIntensity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.25,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates the ceramic glaze material
 */
function createMaterial(config: ShaderConfig): THREE.ShaderMaterial {
  const uniforms = {
    paintTexture: { value: config.paintTexture },
    normalMap: { value: config.normalMap || null },
    roughnessMap: { value: config.roughnessMap || null },
    aoMap: { value: config.aoMap || null },
    normalScale: { value: 1.0 },
    useNormalMap: { value: config.normalMap ? 1.0 : 0.0 },
    useRoughnessMap: { value: config.roughnessMap ? 1.0 : 0.0 },
    useAoMap: { value: config.aoMap ? 1.0 : 0.0 },
    baseColor: { value: new THREE.Color("#f5f0e8") },
    glazeColor: { value: new THREE.Color("#e8e4dc") },
    glazeThickness: { value: 0.5 },
    glossiness: { value: 0.7 },
    roughness: { value: 0.3 },
    subsurfaceStrength: { value: 0.4 },
    fresnelPower: { value: 2.5 },
    lightColor: { value: new THREE.Color("#fffaf5") },
    lightIntensity: { value: 1.2 },
    specularIntensity: { value: 0.8 },
    ambientIntensity: { value: 0.25 },
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

export const ceramicShader: CustomShader = {
  name: "Ceramic Glaze",
  id: "ceramic-glaze",
  description:
    "Smooth glazed pottery with soft diffuse lighting and subtle subsurface glow",
  createMaterial,
  guiParams,
  updateUniforms,
};
