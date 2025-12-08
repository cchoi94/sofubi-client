/**
 * Plastic Shader
 *
 * Standard plastic material.
 * - transmission: 0 (opaque)
 * - roughness: 0.5 (standard plastic)
 * - clearcoat: for shiny plastic surface
 */

import * as THREE from "three";
import type { CustomShader, ShaderConfig, ShaderGuiParam } from "../types";

// ============================================================================
// GUI PARAMETERS
// ============================================================================

const guiParams: ShaderGuiParam[] = [
  { name: "color", type: "color", default: "#eeeeee" }, // Milky white/grey base
  {
    name: "transmission",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.6, // Semi-transparent for vinyl look
  },
  {
    name: "thickness",
    type: "number",
    min: 0,
    max: 4, // Increased max thickness
    step: 0.1,
    default: 1.2, // Substantial thickness
  },
  {
    name: "roughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.45, // Glossier vinyl
  },
  {
    name: "clearcoat",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.15, // Disabled by default - Sofubi is usually single-layer glossy
  },
  {
    name: "clearcoatRoughness",
    type: "number",
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.25, // Softer if enabled
  },
  {
    name: "envMapIntensity",
    type: "number",
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.0,
  },
];

// ...

function createMaterial(config: ShaderConfig): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    // Essential for transmission to work (if enabled)
    transparent: true, // transparent must be true for transmission

    // Core properties
    metalness: 0,
    roughness: 0.45, // Glossier defaults
    transmission: 0.6, // Semi-transparent
    thickness: 1.2, // Substantial volume
    ior: 1.5,

    // Clearcoat - shiny surface on top of plastic material
    clearcoat: 0.15, // Disabled by default
    clearcoatRoughness: 0.25,

    // Color - Milky white base
    color: new THREE.Color("#eeeeee"),
    envMapIntensity: 1.0,

    // Paint texture - we use the standard map slot but override behavior in shader
    map: config.paintTexture,
    
    // We store transmission val in userData just in case
    userData: {
      transmissionVal: 0, 
    },

    // Normal maps
    normalMap: config.normalMap ?? null,
    normalScale: new THREE.Vector2(0.3, 0.3),
    clearcoatNormalMap: config.normalMap ?? null,
    clearcoatNormalScale: new THREE.Vector2(0.1, 0.1),

    // Attenuation
    attenuationColor: new THREE.Color("#ffffff"),
    attenuationDistance: 0.5,
  });

  material.onBeforeCompile = (shader) => {
    // Inject custom varying in vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `
      #include <common>
      // Standard vMapUv is used.
      `
    );

    // Override map_fragment to use mix instead of multiply
    // We don't need to declare myPaintAlpha here anymore.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `
      #ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vMapUv );
        
        // Custom mix logic: Paint Over Base
        // Base color (diffuseColor) is mixed with Paint (sampledDiffuseColor)
        // using the paint's alpha.
        
        diffuseColor.rgb = mix(diffuseColor.rgb, sampledDiffuseColor.rgb, sampledDiffuseColor.a);
        
        // We do NOT multiply diffuseColor by sampledDiffuseColor (standard behavior)
      #endif
      `
    );

    // Mask transmission
    // We re-sample the map here to avoid variable scope issues.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <transmission_fragment>',
      `
      #include <transmission_fragment>
      
      // Reduce transmission where there is paint
      #ifdef USE_MAP
        vec4 txSample = texture2D( map, vMapUv );
        float paintAlpha = txSample.a;
        
        // 'material' is the PhysicalMaterial struct used in lights
        material.transmission *= (1.0 - paintAlpha);
      #endif
      `
    );

    // Mask Roughness
    // Make paint rougher (matte) than the vinyl
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughness_fragment>',
      `
      #include <roughness_fragment>
      
      #ifdef USE_MAP
        // Re-sample for roughness logic
        vec4 rSample = texture2D( map, vMapUv );
        // Target roughness for paint (0.3 = glossy paint)
        // Adjust existing roughnessFactor towards 0.3 based on paint alpha
        roughnessFactor = mix(roughnessFactor, 0.3, rSample.a);
      #endif
      `
    );

    // Mask Clearcoat
    // Remove clearcoat on painted areas so they don't look "under glass"
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clearcoat_fragment>',
      `
      #include <clearcoat_fragment>
      
      #ifdef USE_MAP
        // Re-sample for clearcoat logic
        vec4 cSample = texture2D( map, vMapUv );
        // Reduce clearcoat where painted
        material.clearcoat *= (1.0 - cSample.a);
      #endif
      `
    );

    // Keep reference to shader to update uniforms later
    material.userData.shader = shader;
  };

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
  const shader = material.userData.shader;

  for (const [key, value] of Object.entries(params)) {
    if (key === "color" && typeof value === "string") {
      physicalMat.color.set(value);
    } else if (key === "transmission") {
      // Update physical property for fallback/base
      physicalMat.transmission = value;
      physicalMat.userData.transmissionVal = value;
      // Enable transparency if transmission > 0
      physicalMat.transparent = value > 0;
    } else if (key === "thickness") {
      physicalMat.thickness = value;
    } else if (key === "roughness") {
      physicalMat.roughness = value;
    } else if (key === "clearcoat") {
      physicalMat.clearcoat = value;
    } else if (key === "clearcoatRoughness") {
      physicalMat.clearcoatRoughness = value;
    } else if (key === "envMapIntensity") {
      physicalMat.envMapIntensity = value;
    }
  }
  
  // If we have access to the compiled shader uniform, update it (though standard uniforms update automatically)
  // Ideally, paintTexture reference doesn't change, just content.
  
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

export const plasticShader: CustomShader = {
  name: "Plastic",
  id: "plastic",
  description: "Standard plastic material",
  createMaterial,
  guiParams,
  updateUniforms,
  dispose,
};
