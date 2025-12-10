/**
 * PVC / Sofubi Vinyl Toy Shader
 *
 * Realistic vinyl plastic material for designer toys and collectible figures.
 * Features:
 * - Soft, gummy specular highlights (non-metallic)
 * - Fake subsurface scattering (wrap lighting + backlighting)
 * - Clearcoat layer (glossy lacquer on top)
 * - Fresnel edge sheen
 * - Paint texture support
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";
import vertexShader from "./vertex.glsl?raw";
import fragmentShader from "./fragment.glsl?raw";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  // Base Material
  { 
    name: "baseColor", 
    type: "color", 
    default: "#e8d5c4"  // Warm beige/vinyl tone
  },
  
  // Surface Properties
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,  // Soft plastic highlight
  },
  {
    name: "specularStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.8,  // Moderate specular
  },
  
  // Clearcoat (Glossy Lacquer Layer)
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,  // Subtle clearcoat
  },
  {
    name: "clearcoatGloss",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,  // Sharp clearcoat highlight
  },
  
  // Subsurface Scattering (Fake SSS)
  {
    name: "sssStrength",
    type: "number",
    min: 0,
    max: 2,
    step: 0.01,
    default: 0.6,  // Moderate SSS for gummy look
  },
  {
    name: "sssWidth",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,  // Wrap lighting width
  },
  
  // Texture Maps
  {
    name: "normalScale",
    type: "number",
    min: 0,
    max: 10,
    step: 0.01,
    default: 4.0,  // Normal map intensity
  },
  
  // Lighting
  {
    name: "lightIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.8,
  },
  {
    name: "ambientIntensity",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.15,
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
      // Note: Three.js automatically provides these built-in uniforms:
      // - modelMatrix, viewMatrix, projectionMatrix
      // - normalMatrix, cameraPosition
      // We only define custom uniforms here.
      
      // Lighting
      uLightDir: { value: new THREE.Vector3(1, 1, 0.8).normalize() },
      uLightColor: { value: new THREE.Color(1, 1, 1) },
      uAmbientColor: { value: new THREE.Color(0.15, 0.15, 0.15) },
      
      // Material properties
      baseColor: { value: new THREE.Color("#e8d5c4") },
      roughness: { value: 0.4 },
      specularStrength: { value: 0.8 },
      clearcoat: { value: 0.3 },
      clearcoatGloss: { value: 0.7 },
      sssStrength: { value: 0.6 },
      sssWidth: { value: 0.3 },
      F0: { value: new THREE.Vector3(0.04, 0.04, 0.04) },  // Plastic F0
      
      // Paint texture
      paintTexture: { value: config.paintTexture || null },
      usePaintTexture: { value: config.paintTexture ? 1.0 : 0.0 },
      
      // Original GLB textures
      normalMap: { value: config.normalMap || null },
      useNormalMap: { value: config.normalMap ? 1.0 : 0.0 },
      normalScale: { value: 4.0 },
      
      roughnessMap: { value: config.roughnessMap || null },
      useRoughnessMap: { value: config.roughnessMap ? 1.0 : 0.0 },
      
      aoMap: { value: config.aoMap || null },
      useAoMap: { value: config.aoMap ? 1.0 : 0.0 },

      // Material mask for multi-material blending
      materialMask: { value: config.materialMask || null },
      useMaterialMask: { value: config.materialMask ? 1.0 : 0.0 },
    },

    // Enable transparency if needed for paint texture
    transparent: false,
    side: THREE.FrontSide,
  });
  
  // Store initial light intensity for updates
  material.userData.lightIntensity = 1.8;
  material.userData.ambientIntensity = 0.15;
  
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
    if (key === "baseColor" && typeof value === "string") {
      uniforms.baseColor.value.set(value);
    } else if (key === "roughness") {
      uniforms.roughness.value = value;
    } else if (key === "specularStrength") {
      uniforms.specularStrength.value = value;
    } else if (key === "clearcoat") {
      uniforms.clearcoat.value = value;
    } else if (key === "clearcoatGloss") {
      uniforms.clearcoatGloss.value = value;
    } else if (key === "sssStrength") {
      uniforms.sssStrength.value = value;
    } else if (key === "sssWidth") {
      uniforms.sssWidth.value = value;
    } else if (key === "normalScale") {
      uniforms.normalScale.value = value;
    } else if (key === "lightIntensity") {
      // Update light color intensity
      const intensity = value;
      uniforms.uLightColor.value.setScalar(intensity);
      shaderMat.userData.lightIntensity = intensity;
    } else if (key === "ambientIntensity") {
      // Update ambient color intensity
      const intensity = value;
      uniforms.uAmbientColor.value.setScalar(intensity);
      shaderMat.userData.ambientIntensity = intensity;
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

export const plasticShader: CustomShader = {
  name: "Plastic",
  id: "plastic",
  description: "PVC / sofubi vinyl toy material with SSS and clearcoat",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
