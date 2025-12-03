/**
 * Clear Plastic Shader
 *
 * A shader that creates a water bottle / clear plastic look.
 * Features:
 * - See-through transparency
 * - Visible edges and rim lighting
 * - Soft specular highlights
 * - Slight color tint
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
  { name: "plasticColor", type: "color", default: "#e6f0ff" }, // Slight blue tint
  {
    name: "opacity",
    type: "number",
    min: 0,
    max: 0.5,
    step: 0.01,
    default: 1,
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
    name: "fresnelPower",
    type: "number",
    min: 1,
    max: 6,
    step: 0.1,
    default: 2.5,
  },
  {
    name: "reflectionStrength",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
  },
  {
    name: "edgeThickness",
    type: "number",
    min: 1,
    max: 5,
    step: 0.1,
    default: 2.5,
  },
  {
    name: "rimBrightness",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.8,
  },
  { name: "lightColor", type: "color", default: "#ffffff" },
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.5,
  },
  {
    name: "specularIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.2,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates the clear plastic material
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
    plasticColor: { value: new THREE.Color("#e6f0ff") },
    opacity: { value: 0.08 },
    glossiness: { value: 0.7 },
    fresnelPower: { value: 2.5 },
    reflectionStrength: { value: 0.3 },
    edgeThickness: { value: 2.5 },
    rimBrightness: { value: 0.8 },
    lightPosition: { value: new THREE.Vector3(5, 10, 7) },
    lightPosition2: { value: new THREE.Vector3(-6, 4, -3) },
    lightColor: { value: new THREE.Color("#ffffff") },
    lightIntensity: { value: 1.5 },
    specularIntensity: { value: 1.2 },
    time: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: true,
  });

  // Animation loop for time uniform
  (material as any).__startTime = performance.now();
  const animate = () => {
    const elapsed = (performance.now() - (material as any).__startTime) / 1000;
    uniforms.time.value = elapsed;
    (material as any).__animationId = requestAnimationFrame(animate);
  };
  animate();

  return material;
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

/**
 * Cleanup function
 */
function dispose(material: THREE.Material): void {
  const shaderMaterial = material as THREE.ShaderMaterial;
  if ((shaderMaterial as any).__animationId) {
    cancelAnimationFrame((shaderMaterial as any).__animationId);
  }
  shaderMaterial.dispose();
}

// ============================================================================
// EXPORT
// ============================================================================

export const transparentPlasticShader: CustomShader = {
  name: "Clear Plastic",
  id: "transparent-plastic",
  description: "See-through plastic like a water bottle with visible edges",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
