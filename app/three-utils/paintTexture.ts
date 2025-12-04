import * as THREE from "three";

// ============================================================================
// TYPES
// ============================================================================

export interface PaintTextureRefs {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  thicknessMap: Float32Array;
}

// ============================================================================
// PAINT TEXTURE SETUP
// ============================================================================

export function createPaintTexture(
  canvasSize: number,
  baseColor: string
): PaintTextureRefs {
  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;

  // Get context and fill with base color
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Create thickness map for underpainting effect
  const thicknessMap = new Float32Array(canvasSize * canvasSize);
  thicknessMap.fill(0);

  // Create Three.js texture
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;

  return { canvas, ctx, texture, thicknessMap };
}

// ============================================================================
// PAINT TEXTURE UTILITIES
// ============================================================================

export function clearPaintTexture(
  ctx: CanvasRenderingContext2D,
  texture: THREE.CanvasTexture,
  thicknessMap: Float32Array,
  canvasSize: number,
  baseColor: string
): void {
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);
  thicknessMap.fill(0);
  texture.needsUpdate = true;
}

export function copyUVTransform(
  targetTexture: THREE.CanvasTexture,
  sourceTexture: THREE.Texture
): void {
  targetTexture.repeat.copy(sourceTexture.repeat);
  targetTexture.offset.copy(sourceTexture.offset);
  targetTexture.rotation = sourceTexture.rotation;
  targetTexture.center.copy(sourceTexture.center);
}
