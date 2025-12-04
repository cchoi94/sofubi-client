import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";
import gsap from "gsap";
import { copyUVTransform } from "./paintTexture";
import { getShaderById, DEFAULT_SHADER_ID, type ShaderConfig } from "~/shaders";

// Extend THREE.js with BVH methods
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// ============================================================================
// TYPES
// ============================================================================

export interface MaterialProps {
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  metalnessMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
  emissiveMap: THREE.Texture | null;
  bumpMap: THREE.Texture | null;
}

export interface ModelLoadResult {
  model: THREE.Object3D;
  paintableMeshes: THREE.Mesh[];
  materialPropsMap: Map<THREE.Mesh, MaterialProps>;
  scale: number;
}

export interface ModelLoadCallbacks {
  onProgress?: (percent: number) => void;
  onComplete?: (result: ModelLoadResult) => void;
  onError?: (error: unknown) => void;
}

// ============================================================================
// MODEL LOADING
// ============================================================================

export function loadModel(
  path: string,
  scene: THREE.Scene,
  paintTexture: THREE.CanvasTexture,
  callbacks?: ModelLoadCallbacks
): void {
  const loader = new GLTFLoader();

  loader.load(
    path,
    (gltf) => {
      const model = gltf.scene;

      // Compute bounding box for centering and scaling
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());

      // Calculate scale to fit model in view
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 1.5 / maxDim;
      model.scale.setScalar(scale);

      // Recalculate center after scaling
      const scaledBox = new THREE.Box3().setFromObject(model);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      model.position.sub(scaledCenter);

      // Collect paintable meshes and material properties
      const paintableMeshes: THREE.Mesh[] = [];
      const materialPropsMap = new Map<THREE.Mesh, MaterialProps>();

      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const originalMaterial = child.material as THREE.MeshStandardMaterial;

          // Store original material properties
          materialPropsMap.set(child, {
            normalMap: originalMaterial.normalMap || null,
            roughnessMap: originalMaterial.roughnessMap || null,
            metalnessMap: originalMaterial.metalnessMap || null,
            aoMap: originalMaterial.aoMap || null,
            emissiveMap: originalMaterial.emissiveMap || null,
            bumpMap: originalMaterial.bumpMap || null,
          });

          // Copy UV transform if original texture had one
          if (originalMaterial.map) {
            copyUVTransform(paintTexture, originalMaterial.map);
          }

          paintableMeshes.push(child);

          // Build BVH for fast raycasting
          if (child.geometry) {
            child.geometry.computeBoundsTree();
          }
        }
      });

      scene.add(model);

      callbacks?.onComplete?.({
        model,
        paintableMeshes,
        materialPropsMap,
        scale,
      });
    },
    (progress) => {
      const percent = (progress.loaded / progress.total) * 100;
      callbacks?.onProgress?.(percent);
    },
    (error) => {
      callbacks?.onError?.(error);
    }
  );
}

// ============================================================================
// SHADER APPLICATION
// ============================================================================

export function applyShaderToMeshes(
  meshes: THREE.Mesh[],
  shaderId: string,
  paintTexture: THREE.CanvasTexture,
  materialPropsMap: Map<THREE.Mesh, MaterialProps>
): void {
  const shader = getShaderById(shaderId);
  if (!shader) return;

  meshes.forEach((mesh) => {
    const meshProps = materialPropsMap.get(mesh);
    const config: ShaderConfig = {
      paintTexture,
      normalMap: meshProps?.normalMap || null,
      roughnessMap: meshProps?.roughnessMap || null,
      metalnessMap: meshProps?.metalnessMap || null,
      aoMap: meshProps?.aoMap || null,
      emissiveMap: meshProps?.emissiveMap || null,
      bumpMap: meshProps?.bumpMap || null,
      envMap: null,
    };

    const newMat = shader.createMaterial(config);
    newMat.transparent = true;
    mesh.material = newMat;
  });
}

// ============================================================================
// MODEL ANIMATION
// ============================================================================

export function animateModelFadeIn(
  model: THREE.Object3D,
  paintableMeshes: THREE.Mesh[],
  targetScale: number,
  onComplete?: () => void
): void {
  // Start with opacity 0 and scale slightly smaller
  paintableMeshes.forEach((mesh) => {
    const mat = mesh.material as THREE.Material;
    mat.transparent = true;
    (mat as any).opacity = 0;
  });
  model.scale.setScalar(targetScale * 0.9);

  // Animate opacity and scale
  const fadeInState = { opacity: 0, scale: targetScale * 0.9 };
  gsap.to(fadeInState, {
    opacity: 1,
    scale: targetScale,
    duration: 0.8,
    ease: "power2.out",
    onUpdate: () => {
      paintableMeshes.forEach((mesh) => {
        const mat = mesh.material as THREE.Material;
        (mat as any).opacity = fadeInState.opacity;

        // For ShaderMaterials, also update the uniform if it exists
        if ((mat as THREE.ShaderMaterial).uniforms?.opacity) {
          (mat as THREE.ShaderMaterial).uniforms.opacity.value =
            fadeInState.opacity;
        }
      });
      model.scale.setScalar(fadeInState.scale);
    },
    onComplete,
  });
}

// ============================================================================
// MODEL SPIN ANIMATION
// ============================================================================

export function updateModelSpin(
  model: THREE.Object3D | null,
  enabled: boolean,
  speed: number
): void {
  if (enabled && model) {
    model.rotation.y += 0.01 * speed;
  }
}
