/**
 * Shader System Types
 *
 * This file defines the interface for custom shaders that can be applied
 * to the painted 3D mesh. Each shader receives the paint texture and can
 * optionally use the original material's maps (normal, roughness, etc).
 */

import * as THREE from "three";

/**
 * Configuration passed to shader factory functions
 */
export interface ShaderConfig {
  /** The paint canvas texture (user's painted artwork) */
  paintTexture: THREE.CanvasTexture;

  /** Original normal map from the model (if available) */
  normalMap?: THREE.Texture | null;

  /** Original roughness map from the model (if available) */
  roughnessMap?: THREE.Texture | null;

  /** Original metalness map from the model (if available) */
  metalnessMap?: THREE.Texture | null;

  /** Original ambient occlusion map from the model (if available) */
  aoMap?: THREE.Texture | null;

  /** Original emissive map from the model (if available) */
  emissiveMap?: THREE.Texture | null;

  /** Original bump map from the model (if available) */
  bumpMap?: THREE.Texture | null;

  /** Environment map for reflections (if available) */
  envMap?: THREE.Texture | null;
}

/**
 * GUI parameter definition for shader controls
 */
export interface ShaderGuiParam {
  name: string;
  type: "number" | "color" | "boolean";
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
}

/**
 * Interface that all custom shaders must implement
 */
export interface CustomShader {
  /** Display name for the shader in the GUI */
  name: string;

  /** Unique identifier for the shader */
  id: string;

  /** Description of what the shader does */
  description: string;

  /** Factory function to create the material */
  createMaterial: (config: ShaderConfig) => THREE.Material;

  /** GUI parameters that can be adjusted */
  guiParams: ShaderGuiParam[];

  /** Update function called when GUI params change */
  updateUniforms?: (
    material: THREE.Material,
    params: Record<string, any>
  ) => void;

  /** Optional cleanup function */
  dispose?: (material: THREE.Material) => void;
}
