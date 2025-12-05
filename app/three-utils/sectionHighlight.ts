import * as THREE from "three";
import type { UVIsland } from "./floodFill";
import {
  getIslandTrianglePositions,
  getIslandTriangleNormals,
} from "./floodFill";

// ============================================================================
// TYPES
// ============================================================================

export interface SectionHighlight {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  sourceMesh: THREE.Mesh;
  syncTransform: () => void;
  dispose: () => void;
}

// ============================================================================
// HIGHLIGHT SHADER
// ============================================================================

const highlightVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;
  
  // Offset slightly along normal to prevent z-fighting
  vec3 offsetPosition = position + normal * 0.002;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(offsetPosition, 1.0);
}
`;

const highlightFragmentShader = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
uniform float uPulseSpeed;
uniform float uPulseAmount;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  // Pulsing opacity effect
  float pulse = sin(uTime * uPulseSpeed) * uPulseAmount + (1.0 - uPulseAmount);
  
  // Fresnel effect for edge glow
  vec3 viewDirection = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - max(dot(viewDirection, vNormal), 0.0);
  fresnel = pow(fresnel, 2.0) * 0.5 + 0.5;
  
  float finalOpacity = uOpacity * pulse * fresnel;
  
  gl_FragColor = vec4(uColor, finalOpacity);
}
`;

// ============================================================================
// CREATE HIGHLIGHT
// ============================================================================

/**
 * Create a highlight mesh for a UV island.
 * This mesh renders as a semi-transparent overlay on top of the original mesh.
 */
export function createSectionHighlight(
  island: UVIsland,
  sourceGeometry: THREE.BufferGeometry,
  sourceMesh: THREE.Mesh,
  color: THREE.Color | string = "#ffffff"
): SectionHighlight {
  // Get triangle positions and normals for this island (in local space)
  const localPositions = getIslandTrianglePositions(island, sourceGeometry);
  const localNormals = getIslandTriangleNormals(island, sourceGeometry);

  // Transform positions and normals to world space
  sourceMesh.updateWorldMatrix(true, false);
  const worldMatrix = sourceMesh.matrixWorld;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

  const worldPositions = new Float32Array(localPositions.length);
  const worldNormals = new Float32Array(localNormals.length);
  const tempVec = new THREE.Vector3();
  const tempNormal = new THREE.Vector3();

  for (let i = 0; i < localPositions.length; i += 3) {
    // Transform position to world space
    tempVec.set(
      localPositions[i],
      localPositions[i + 1],
      localPositions[i + 2]
    );
    tempVec.applyMatrix4(worldMatrix);
    worldPositions[i] = tempVec.x;
    worldPositions[i + 1] = tempVec.y;
    worldPositions[i + 2] = tempVec.z;

    // Transform normal to world space
    tempNormal.set(localNormals[i], localNormals[i + 1], localNormals[i + 2]);
    tempNormal.applyMatrix3(normalMatrix).normalize();
    worldNormals[i] = tempNormal.x;
    worldNormals[i + 1] = tempNormal.y;
    worldNormals[i + 2] = tempNormal.z;
  }

  // Create new geometry for the highlight mesh with world-space positions
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(worldPositions, 3)
  );
  geometry.setAttribute("normal", new THREE.BufferAttribute(worldNormals, 3));

  // Create highlight material
  const material = new THREE.ShaderMaterial({
    vertexShader: highlightVertexShader,
    fragmentShader: highlightFragmentShader,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: 0.4 },
      uTime: { value: 0 },
      uPulseSpeed: { value: 3.0 },
      uPulseAmount: { value: 0.15 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  // Create mesh - positions are already in world space, so no transform needed
  const mesh = new THREE.Mesh(geometry, material);
  mesh.matrixAutoUpdate = true;

  // Render after the main mesh
  mesh.renderOrder = 1;

  // Sync function updates the geometry positions when model moves
  const syncTransform = () => {
    sourceMesh.updateWorldMatrix(true, false);
    const newWorldMatrix = sourceMesh.matrixWorld;
    const newNormalMatrix = new THREE.Matrix3().getNormalMatrix(newWorldMatrix);

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const normAttr = geometry.getAttribute("normal") as THREE.BufferAttribute;

    for (let i = 0; i < localPositions.length; i += 3) {
      // Transform position to world space
      tempVec.set(
        localPositions[i],
        localPositions[i + 1],
        localPositions[i + 2]
      );
      tempVec.applyMatrix4(newWorldMatrix);
      posAttr.setXYZ(i / 3, tempVec.x, tempVec.y, tempVec.z);

      // Transform normal to world space
      tempNormal.set(localNormals[i], localNormals[i + 1], localNormals[i + 2]);
      tempNormal.applyMatrix3(newNormalMatrix).normalize();
      normAttr.setXYZ(i / 3, tempNormal.x, tempNormal.y, tempNormal.z);
    }

    posAttr.needsUpdate = true;
    normAttr.needsUpdate = true;
  };

  // Store local positions/normals for sync updates
  (geometry as any)._localPositions = localPositions;
  (geometry as any)._localNormals = localNormals;

  return {
    mesh,
    geometry,
    material,
    sourceMesh,
    syncTransform,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}

// ============================================================================
// UPDATE HIGHLIGHT
// ============================================================================

/**
 * Update the highlight's time uniform for animation.
 */
export function updateHighlightTime(
  highlight: SectionHighlight,
  time: number
): void {
  highlight.material.uniforms.uTime.value = time;
}

/**
 * Update the highlight's color.
 */
export function updateHighlightColor(
  highlight: SectionHighlight,
  color: THREE.Color | string
): void {
  const threeColor = new THREE.Color(color);
  highlight.material.uniforms.uColor.value = threeColor;

  // Dynamic Blending:
  // - Bright colors (White/Colors) -> AdditiveBlending (Glow)
  // - Dark colors (Black) -> NormalBlending (Overlay/Shadow)
  // Additive blending with black (0,0,0) is invisible, so we must switch to Normal.
  const luminance =
    0.299 * threeColor.r + 0.587 * threeColor.g + 0.114 * threeColor.b;

  if (luminance < 0.2) {
    // Dark color -> Overlay mode
    highlight.material.blending = THREE.NormalBlending;
    // Boost opacity slightly for shadow visibility
    highlight.material.uniforms.uOpacity.value = 0.6;
  } else {
    // Bright color -> Glow mode
    highlight.material.blending = THREE.AdditiveBlending;
    highlight.material.uniforms.uOpacity.value = 0.4;
  }
  
  highlight.material.needsUpdate = true;
}

/**
 * Update the highlight's opacity.
 */
export function updateHighlightOpacity(
  highlight: SectionHighlight,
  opacity: number
): void {
  highlight.material.uniforms.uOpacity.value = opacity;
}

// ============================================================================
// HIGHLIGHT MANAGER
// ============================================================================

export interface HighlightManager {
  currentHighlight: SectionHighlight | null;
  currentIslandIndex: number | null;
  scene: THREE.Scene;
  setHighlight: (
    island: UVIsland | null,
    islandIndex: number | null,
    sourceGeometry: THREE.BufferGeometry | null,
    sourceMesh: THREE.Mesh | null,
    color?: string
  ) => void;
  update: (time: number) => void;
  dispose: () => void;
}

/**
 * Create a manager for handling highlight creation/destruction.
 */
export function createHighlightManager(scene: THREE.Scene): HighlightManager {
  let currentHighlight: SectionHighlight | null = null;
  let currentIslandIndex: number | null = null;

  const setHighlight = (
    island: UVIsland | null,
    islandIndex: number | null,
    sourceGeometry: THREE.BufferGeometry | null,
    sourceMesh: THREE.Mesh | null,
    color: string = "#ffffff"
  ) => {
    // Same island - no change needed
    if (islandIndex === currentIslandIndex) {
      // Just update color if different
      if (currentHighlight && color) {
        updateHighlightColor(currentHighlight, color);
      }
      return;
    }

    // Remove existing highlight
    if (currentHighlight) {
      // Remove from scene
      scene.remove(currentHighlight.mesh);
      currentHighlight.dispose();
      currentHighlight = null;
      currentIslandIndex = null;
    }

    // Create new highlight if island provided
    if (island && sourceGeometry && sourceMesh) {
      currentHighlight = createSectionHighlight(
        island,
        sourceGeometry,
        sourceMesh,
        color
      );
      // Add to scene (positions are in world space)
      scene.add(currentHighlight.mesh);
      currentIslandIndex = islandIndex;
    }
  };

  const update = (time: number) => {
    if (currentHighlight) {
      updateHighlightTime(currentHighlight, time);
      // Sync transform with source mesh (important when model is rotated/moved)
      currentHighlight.syncTransform();
    }
  };

  const dispose = () => {
    if (currentHighlight) {
      scene.remove(currentHighlight.mesh);
      currentHighlight.dispose();
      currentHighlight = null;
      currentIslandIndex = null;
    }
  };

  return {
    get currentHighlight() {
      return currentHighlight;
    },
    get currentIslandIndex() {
      return currentIslandIndex;
    },
    scene,
    setHighlight,
    update,
    dispose,
  };
}
