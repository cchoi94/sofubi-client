import * as THREE from "three";
import type { BrushState } from "~/constants/types";

// ============================================================================
// TYPES
// ============================================================================

export interface PaintingRefs {
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  thicknessMap: Float32Array;
  canvasSize: number;
}

// ============================================================================
// COLOR PARSING CACHE
// ============================================================================

let cachedColorHex = "";
let cachedColorRgb = { r: 0, g: 0, b: 0 };

function parseHexColor(hex: string): { r: number; g: number; b: number } {
  if (hex !== cachedColorHex) {
    cachedColorHex = hex;
    cachedColorRgb = {
      r: parseInt(hex.slice(1, 3), 16),
      g: parseInt(hex.slice(3, 5), 16),
      b: parseInt(hex.slice(5, 7), 16),
    };
  }
  return cachedColorRgb;
}

// ============================================================================
// PAINT AT UV
// ============================================================================

/**
 * Paint at the given UV coordinates on the paint canvas.
 * Uses underpainting effect for realistic paint behavior.
 */
export function paintAtUV(
  uv: THREE.Vector2,
  brush: BrushState,
  refs: PaintingRefs
): void {
  const { ctx, texture, thicknessMap, canvasSize } = refs;

  // Wrap UV coordinates to 0-1 range using modulo
  let u = uv.x % 1;
  let v = uv.y % 1;
  if (u < 0) u += 1;
  if (v < 0) v += 1;

  // Convert UV coordinates (0-1) to pixel coordinates
  const px = u * canvasSize;
  const py = (1 - v) * canvasSize;

  const radius = brush.radius;
  const radiusSq = radius * radius;

  // Parse brush color (cached)
  const { r: brushR, g: brushG, b: brushB } = parseHexColor(brush.color);

  // Get the area we'll be painting on
  const x = Math.floor(px - radius);
  const y = Math.floor(py - radius);
  const size = Math.ceil(radius * 2);

  // Clamp to canvas bounds
  const sx = Math.max(0, x);
  const sy = Math.max(0, y);
  const ex = Math.min(canvasSize, x + size);
  const ey = Math.min(canvasSize, y + size);
  const width = ex - sx;
  const height = ey - sy;

  if (width <= 0 || height <= 0) return;

  // Read existing pixels from the canvas
  const imageData = ctx.getImageData(sx, sy, width, height);
  const pixels = imageData.data;

  // Underpainting parameters
  const UNDERCOAT_STRENGTH = 0.4;
  const MAX_COVERAGE = 0.85;
  const brushOpacity = brush.opacity * MAX_COVERAGE;

  // Blend new color with existing pixels within the brush circle
  for (let dy = 0; dy < height; dy++) {
    const worldY = sy + dy;
    const distY = worldY - py;
    const distYSq = distY * distY;
    const rowOffset = dy * width * 4;
    const thicknessRowOffset = worldY * canvasSize;

    for (let dx = 0; dx < width; dx++) {
      const worldX = sx + dx;
      const distX = worldX - px;
      const distSq = distX * distX + distYSq;

      // Only paint within the brush radius
      if (distSq <= radiusSq) {
        // Edge falloff based on hardness
        const distRatio = Math.sqrt(distSq) / radius;
        const hardness = brush.hardness;

        // Compute falloff
        let edgeFalloff: number;
        if (hardness >= 0.95) {
          edgeFalloff = distRatio < 0.9 ? 1 : (1 - distRatio) * 10;
        } else {
          const softness = 1 - hardness;
          const curve = 0.5 + softness * 2;
          edgeFalloff = Math.pow(1 - distRatio, curve);
        }

        const strokeStrength = brushOpacity * edgeFalloff;

        const idx = rowOffset + dx * 4;
        const thicknessIdx = thicknessRowOffset + worldX;

        // Get existing color (the undercoat)
        const underR = pixels[idx];
        const underG = pixels[idx + 1];
        const underB = pixels[idx + 2];

        // Get paint thickness from separate map
        const existingThickness = thicknessMap[thicknessIdx];
        const undercoatBleed =
          UNDERCOAT_STRENGTH * (existingThickness > 1 ? 1 : existingThickness);

        // Subtractive-ish color mixing (like real paint)
        const bleedComp = 1 - undercoatBleed;
        const bleed07 = undercoatBleed * 0.7;
        const bleed03 = undercoatBleed * 0.3;

        const mixedR =
          (brushR * bleedComp +
            underR * bleed07 +
            (brushR < underR ? brushR : underR) * bleed03) |
          0;
        const mixedG =
          (brushG * bleedComp +
            underG * bleed07 +
            (brushG < underG ? brushG : underG) * bleed03) |
          0;
        const mixedB =
          (brushB * bleedComp +
            underB * bleed07 +
            (brushB < underB ? brushB : underB) * bleed03) |
          0;

        // Blend the mixed color onto the canvas
        pixels[idx] = (underR + (mixedR - underR) * strokeStrength) | 0;
        pixels[idx + 1] = (underG + (mixedG - underG) * strokeStrength) | 0;
        pixels[idx + 2] = (underB + (mixedB - underB) * strokeStrength) | 0;
        pixels[idx + 3] = 255;

        // Accumulate paint thickness
        thicknessMap[thicknessIdx] += strokeStrength * 0.3;
      }
    }
  }

  // Write blended pixels back to canvas
  ctx.putImageData(imageData, sx, sy);

  // Mark texture for update
  texture.needsUpdate = true;
}
