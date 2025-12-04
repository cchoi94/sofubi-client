import * as THREE from "three";
import type { CursorMode } from "~/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface RaycastResult {
  uv: THREE.Vector2;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

// ============================================================================
// RAYCASTING
// ============================================================================

export function raycast(
  event: PointerEvent | MouseEvent,
  container: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster,
  mouse: THREE.Vector2,
  excludeObject?: THREE.Object3D | null
): RaycastResult | null {
  const rect = container.getBoundingClientRect();

  // Convert screen coordinates to normalized device coordinates (-1 to 1)
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  mouse.set(x, y);
  raycaster.setFromCamera(mouse, camera);

  // Enable firstHitOnly for BVH optimization
  (raycaster as any).firstHitOnly = true;

  // Check for intersections with ALL objects in the scene
  const intersects = raycaster.intersectObjects(scene.children, true);

  // Find first intersection that has UV coordinates
  for (const intersect of intersects) {
    // Skip excluded object (e.g., brush cursor)
    if (excludeObject && intersect.object === excludeObject) continue;

    if (
      intersect.uv &&
      intersect.object instanceof THREE.Mesh &&
      intersect.face
    ) {
      return {
        uv: intersect.uv.clone(),
        point: intersect.point.clone(),
        normal: intersect.face.normal
          .clone()
          .transformDirection(intersect.object.matrixWorld),
      };
    }
  }

  return null;
}

export function raycastToUV(
  event: PointerEvent | MouseEvent,
  container: HTMLElement,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster,
  mouse: THREE.Vector2,
  excludeObject?: THREE.Object3D | null
): THREE.Vector2 | null {
  const result = raycast(
    event,
    container,
    scene,
    camera,
    raycaster,
    mouse,
    excludeObject
  );
  return result ? result.uv : null;
}

// ============================================================================
// CURSOR STYLE UTILITIES
// ============================================================================

export function getCursorStyle(
  cursorMode: CursorMode,
  isOverModel: boolean,
  isGrabbing: boolean
): string {
  // Paint mode - crosshair cursor for precision painting
  if (cursorMode === "paint") {
    return "crosshair";
  }
  // Move mode - grab/grabbing cursor
  if (cursorMode === "move") {
    return isGrabbing ? "grabbing" : "grab";
  }
  // Rotate mode - all-scroll cursor
  return "all-scroll";
}
