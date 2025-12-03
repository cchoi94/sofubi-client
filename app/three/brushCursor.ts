import * as THREE from "three";
import { PAINT_CANVAS_SIZE } from "~/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface BrushCursorRefs {
  cursor: THREE.Mesh;
  outline: THREE.Mesh;
}

export interface CursorState {
  targetPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  lerpSpeed: number;
  initialized: boolean;
}

// ============================================================================
// BRUSH CURSOR SETUP
// ============================================================================

export function createBrushCursor(
  scene: THREE.Scene,
  initialColor: string
): BrushCursorRefs {
  // Main cursor (filled circle)
  const cursorGeometry = new THREE.CircleGeometry(0.05, 32);
  const cursorMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(initialColor),
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const cursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
  cursor.visible = false;
  cursor.renderOrder = 999;
  scene.add(cursor);

  // Outline ring for better visibility
  const outlineGeometry = new THREE.RingGeometry(0.048, 0.052, 32);
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
  });
  const outline = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outline.renderOrder = 1000;
  cursor.add(outline);

  return { cursor, outline };
}

// ============================================================================
// CURSOR UPDATE FUNCTIONS
// ============================================================================

export function updateBrushCursorAppearance(
  cursor: THREE.Mesh,
  outline: THREE.Mesh,
  radius: number,
  color: string,
  canvasSize: number = PAINT_CANVAS_SIZE
): void {
  // Scale based on brush radius
  const worldRadius = (radius / canvasSize) * 1.2;
  cursor.scale.setScalar(worldRadius / 0.05);

  // Update fill color
  (cursor.material as THREE.MeshBasicMaterial).color.set(color);

  // Update outline to contrast with fill color
  const brushColor = new THREE.Color(color);
  const luminance =
    0.299 * brushColor.r + 0.587 * brushColor.g + 0.114 * brushColor.b;
  const outlineColor = luminance > 0.5 ? 0x333333 : 0xffffff;
  (outline.material as THREE.MeshBasicMaterial).color.setHex(outlineColor);
}

export function updateCursorBillboard(
  cursor: THREE.Mesh,
  camera: THREE.PerspectiveCamera
): void {
  if (cursor.visible) {
    cursor.quaternion.copy(camera.quaternion);
  }
}

export function createCursorState(lerpSpeed: number = 0.35): CursorState {
  return {
    targetPos: new THREE.Vector3(),
    currentPos: new THREE.Vector3(),
    lerpSpeed,
    initialized: false,
  };
}

export function updateCursorSmooth(
  cursor: THREE.Mesh,
  camera: THREE.PerspectiveCamera,
  state: CursorState
): void {
  if (cursor.visible && state.initialized) {
    state.currentPos.lerp(state.targetPos, state.lerpSpeed);
    cursor.position.copy(state.currentPos);
    updateCursorBillboard(cursor, camera);
  }
}

export function setCursorTarget(
  state: CursorState,
  cursor: THREE.Mesh,
  point: THREE.Vector3,
  normal: THREE.Vector3,
  offset: number = 0.01
): void {
  state.targetPos.copy(point);
  state.targetPos.addScaledVector(normal, offset);

  // Initialize current position on first hit
  if (!state.initialized) {
    state.currentPos.copy(state.targetPos);
    cursor.position.copy(state.currentPos);
    state.initialized = true;
  }
}

export function hideCursor(cursor: THREE.Mesh, state: CursorState): void {
  cursor.visible = false;
  state.initialized = false;
}
