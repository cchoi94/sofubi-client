/**
 * Chrome Knight Armor Shader
 *
 * A custom shader that creates a polished chrome armor effect with
 * subtle pearlescent iridescence. Designed to look like medieval knight armor.
 * Features:
 * - High reflectivity chrome base
 * - Subtle view-angle dependent color shifting
 * - Sharp specular highlights
 * - Environment-like reflections
 * - Paint texture tinting
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
  { name: "silverColor", type: "color", default: "#c8c8d0" }, // Bright chrome silver
  {
    name: "silverIntensity",
    type: "number",
    min: 0.3,
    max: 2,
    step: 0.01,
    default: 1.1,
  },
  {
    name: "shininess",
    type: "number",
    min: 10,
    max: 500,
    step: 1,
    default: 180,
  },
  {
    name: "reflectionStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.85,
  },
  {
    name: "iridescenceStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.4,
  },
  {
    name: "iridescenceScale",
    type: "number",
    min: 0.5,
    max: 4,
    step: 0.1,
    default: 2.0,
  },
  {
    name: "fresnelPower",
    type: "number",
    min: 1,
    max: 6,
    step: 0.1,
    default: 2.0,
  },
  { name: "lightColor", type: "color", default: "#ffffff" },
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.3,
  },
  {
    name: "specularIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.2,
  },
  {
    name: "ambientIntensity",
    type: "number",
    min: 0,
    max: 0.8,
    step: 0.01,
    default: 0.2,
  },
];

// ============================================================================
// SHADER IMPLEMENTATION
// ============================================================================

/**
 * Creates the chrome knight armor material
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
    silverColor: { value: new THREE.Color("#c8c8d0") }, // Bright chrome
    silverIntensity: { value: 1.1 },
    shininess: { value: 230.0 },
    reflectionStrength: { value: 1.6 },
    iridescenceStrength: { value: 0.8 },
    iridescenceScale: { value: 2.0 },
    fresnelPower: { value: 2 },
    lightPosition: { value: new THREE.Vector3(5, 10, 7) },
    lightPosition2: { value: new THREE.Vector3(-6, 4, -3) },
    lightColor: { value: new THREE.Color("#ffffff") },
    lightIntensity: { value: 1.3 },
    specularIntensity: { value: 1.2 },
    ambientIntensity: { value: 0.2 },
    time: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  // Store start time for animation
  (material as any).__startTime = performance.now();
  (material as any).__animationId = null;

  // Animation loop for time uniform
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

export const pearlescentArmorShader: CustomShader = {
  name: "Pearlescent Armor",
  id: "pearlescent-armor",
  description:
    "Iridescent metallic armor with view-angle color shifting and rim lighting",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
