/**
 * Multi-Material Rendering System
 *
 * Manages layered rendering of multiple materials on a single mesh.
 * Creates cloned meshes for each material painted on the model and
 * layers them on top of the base plastic material.
 */

import * as THREE from "three";
import {
  getShaderById,
  getMaterialId,
  getShaderId,
  type ShaderConfig,
} from "~/shaders";

export interface MaterialLayer {
  shaderId: string;
  mesh: THREE.Mesh;
  material: THREE.Material;
}

export interface MultiMaterialRendererConfig {
  baseMesh: THREE.Mesh;
  shaderConfig: ShaderConfig;
  scene: THREE.Scene;
}

export class MultiMaterialRenderer {
  private baseMesh: THREE.Mesh;
  private shaderConfig: ShaderConfig;
  private scene: THREE.Scene;
  private materialLayers: Map<string, MaterialLayer> = new Map();

  constructor(config: MultiMaterialRendererConfig) {
    this.baseMesh = config.baseMesh;
    this.shaderConfig = config.shaderConfig;
    this.scene = config.scene;
  }

  /**
   * Update which materials are painted on the model by analyzing the material mask.
   * Creates/removes layer meshes as needed.
   */
  updateMaterialLayers(): void {
    if (!this.shaderConfig.materialMask) return;

    // Detect which materials are present in the mask
    const presentMaterials = this.detectPresentMaterials();

    // Remove layers that are no longer painted
    for (const [shaderId, layer] of this.materialLayers) {
      if (!presentMaterials.has(shaderId)) {
        this.removeLayer(shaderId);
      }
    }

    // Add new layers for newly painted materials
    for (const shaderId of presentMaterials) {
      if (!this.materialLayers.has(shaderId)) {
        this.addLayer(shaderId);
      }
    }
  }

  /**
   * Detect which material IDs are present in the material mask texture
   */
  private detectPresentMaterials(): Set<string> {
    const materials = new Set<string>();

    if (!this.shaderConfig.materialMask) return materials;

    // Sample the material mask canvas to find which materials are present
    const canvas = (this.shaderConfig.materialMask as THREE.CanvasTexture)
      .image as HTMLCanvasElement;
    if (!canvas) return materials;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return materials;

    // Sample a grid of points to detect materials (don't need to check every pixel)
    const sampleSize = 32; // 32x32 grid
    const stepX = canvas.width / sampleSize;
    const stepY = canvas.height / sampleSize;
    const normalizedValues = new Set<number>();

    for (let y = 0; y < sampleSize; y++) {
      for (let x = 0; x < sampleSize; x++) {
        const px = Math.floor(x * stepX);
        const py = Math.floor(y * stepY);
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        const grayValue = pixel[0]; // R channel (0-255)
        const normalized = grayValue / 255.0; // Convert to 0.0-1.0

        if (normalized > 0.05) {
          // Skip 0 (base plastic), round to nearest 0.05 for tolerance
          const rounded = Math.round(normalized * 20) / 20; // Round to nearest 0.05
          normalizedValues.add(rounded);
        }
      }
    }

    // Convert normalized values to shader IDs
    for (const normalizedValue of normalizedValues) {
      const shaderId = getShaderId(normalizedValue);
      if (shaderId) {
        materials.add(shaderId);
      }
    }

    return materials;
  }

  /**
   * Add a new material layer mesh
   */
  private addLayer(shaderId: string): void {
    const shader = getShaderById(shaderId);
    if (!shader) return;

    // Clone the base mesh geometry
    const layerMesh = new THREE.Mesh(
      this.baseMesh.geometry,
      undefined // Material will be set below
    );

    // Copy transform from base mesh
    layerMesh.position.copy(this.baseMesh.position);
    layerMesh.rotation.copy(this.baseMesh.rotation);
    layerMesh.scale.copy(this.baseMesh.scale);
    layerMesh.matrixAutoUpdate = this.baseMesh.matrixAutoUpdate;

    // Set render order to layer on top of base
    // Base plastic = 0, other materials = 1+
    const materialId = getMaterialId(shaderId);
    layerMesh.renderOrder = materialId;

    // Create material with masking enabled
    const material = shader.createMaterial(this.shaderConfig);
    material.transparent = true;
    material.depthWrite = false; // Allow layering
    layerMesh.material = material;

    // Add to scene
    this.scene.add(layerMesh);

    // Store reference
    this.materialLayers.set(shaderId, {
      shaderId,
      mesh: layerMesh,
      material,
    });
  }

  /**
   * Remove a material layer mesh
   */
  private removeLayer(shaderId: string): void {
    const layer = this.materialLayers.get(shaderId);
    if (!layer) return;

    // Remove from scene
    this.scene.remove(layer.mesh);

    // Dispose material
    const shader = getShaderById(shaderId);
    if (shader?.dispose) {
      shader.dispose(layer.material);
    }

    // Dispose geometry reference (don't dispose geometry itself - it's shared!)
    layer.mesh.geometry = null as any;

    // Remove from map
    this.materialLayers.delete(shaderId);
  }

  /**
   * Update shader config for all layers (e.g., when paint texture updates)
   */
  updateShaderConfig(config: Partial<ShaderConfig>): void {
    this.shaderConfig = { ...this.shaderConfig, ...config };

    // Update all layer materials
    for (const [shaderId, layer] of this.materialLayers) {
      const shader = getShaderById(shaderId);
      if (!shader) continue;

      // Dispose old material
      if (shader.dispose) {
        shader.dispose(layer.material);
      }

      // Create new material with updated config
      const newMaterial = shader.createMaterial(this.shaderConfig);
      newMaterial.transparent = true;
      newMaterial.depthWrite = false;
      layer.mesh.material = newMaterial;
      layer.material = newMaterial;
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    for (const shaderId of Array.from(this.materialLayers.keys())) {
      this.removeLayer(shaderId);
    }
  }

  /**
   * Get all material layer meshes
   */
  getLayers(): MaterialLayer[] {
    return Array.from(this.materialLayers.values());
  }
}
