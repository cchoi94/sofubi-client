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
  // Get triangle positions and normals for this island
  const positions = getIslandTrianglePositions(island, sourceGeometry);
  const normals = getIslandTriangleNormals(island, sourceGeometry);

  // Create new geometry for the highlight mesh
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

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

  // Create mesh
  const mesh = new THREE.Mesh(geometry, material);

  // Copy the full world transform from source mesh
  sourceMesh.updateWorldMatrix(true, false);
  mesh.matrix.copy(sourceMesh.matrixWorld);
  mesh.matrixAutoUpdate = false;

  // Render after the main mesh
  mesh.renderOrder = 1;

  return {
    mesh,
    geometry,
    material,
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
  highlight.material.uniforms.uColor.value = new THREE.Color(color);
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
      scene.add(currentHighlight.mesh);
      currentIslandIndex = islandIndex;
    }
  };

  const update = (time: number) => {
    if (currentHighlight) {
      updateHighlightTime(currentHighlight, time);
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
