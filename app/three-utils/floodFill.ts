import * as THREE from "three";

// ============================================================================
// TYPES
// ============================================================================

export interface UVIsland {
  triangleIndices: number[]; // Indices of triangles in this island
  uvBounds: { minU: number; maxU: number; minV: number; maxV: number };
}

export interface FloodFillResult {
  islands: UVIsland[];
  triangleToIsland: Map<number, number>; // triangle index -> island index
}

interface EdgeKey {
  key: string;
  triangleIndex: number;
  edgeIndex: number; // 0, 1, or 2 within the triangle
}

// ============================================================================
// UV ISLAND DETECTION
// ============================================================================

/**
 * Build UV islands from mesh geometry.
 * Islands are groups of triangles connected in UV space.
 * UV seams create natural boundaries between islands.
 */
export function buildUVIslands(
  geometry: THREE.BufferGeometry
): FloodFillResult {
  const position = geometry.getAttribute("position");
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();

  if (!uv) {
    console.warn("Geometry has no UV attribute");
    return { islands: [], triangleToIsland: new Map() };
  }

  const triangleCount = index ? index.count / 3 : position.count / 3;

  // Build edge connectivity map in UV space
  // Key: stringified UV edge (sorted), Value: triangles sharing this edge
  const uvEdgeMap = new Map<string, number[]>();

  const getVertexUV = (vertexIndex: number): [number, number] => {
    return [uv.getX(vertexIndex), uv.getY(vertexIndex)];
  };

  const getTriangleVertices = (triIndex: number): number[] => {
    if (index) {
      return [
        index.getX(triIndex * 3),
        index.getX(triIndex * 3 + 1),
        index.getX(triIndex * 3 + 2),
      ];
    }
    return [triIndex * 3, triIndex * 3 + 1, triIndex * 3 + 2];
  };

  // Create UV edge key (normalized so both directions match)
  const makeUVEdgeKey = (
    uv1: [number, number],
    uv2: [number, number]
  ): string => {
    // Round to avoid floating point issues
    const precision = 10000;
    const u1 = Math.round(uv1[0] * precision);
    const v1 = Math.round(uv1[1] * precision);
    const u2 = Math.round(uv2[0] * precision);
    const v2 = Math.round(uv2[1] * precision);

    // Sort to make edge direction-independent
    if (u1 < u2 || (u1 === u2 && v1 < v2)) {
      return `${u1},${v1}-${u2},${v2}`;
    }
    return `${u2},${v2}-${u1},${v1}`;
  };

  // Process each triangle and register its UV edges
  for (let triIndex = 0; triIndex < triangleCount; triIndex++) {
    const vertices = getTriangleVertices(triIndex);
    const uvs = vertices.map(getVertexUV);

    // Three edges per triangle
    const edges = [
      [uvs[0], uvs[1]],
      [uvs[1], uvs[2]],
      [uvs[2], uvs[0]],
    ] as [[number, number], [number, number]][];

    for (const [uv1, uv2] of edges) {
      const key = makeUVEdgeKey(uv1, uv2);
      const existing = uvEdgeMap.get(key) || [];
      existing.push(triIndex);
      uvEdgeMap.set(key, existing);
    }
  }

  // Build adjacency list (which triangles are connected in UV space)
  const adjacency: number[][] = Array.from({ length: triangleCount }, () => []);

  for (const triangles of uvEdgeMap.values()) {
    // If exactly 2 triangles share an edge in UV space, they're connected
    if (triangles.length === 2) {
      adjacency[triangles[0]].push(triangles[1]);
      adjacency[triangles[1]].push(triangles[0]);
    }
    // If only 1 triangle uses this edge, it's a boundary (UV seam)
    // If more than 2, it's a complex case (rare)
  }

  // Flood fill to find connected components (islands)
  const visited = new Set<number>();
  const islands: UVIsland[] = [];
  const triangleToIsland = new Map<number, number>();

  for (let triIndex = 0; triIndex < triangleCount; triIndex++) {
    if (visited.has(triIndex)) continue;

    // BFS to find all connected triangles
    const island: number[] = [];
    const queue = [triIndex];
    visited.add(triIndex);

    while (queue.length > 0) {
      const current = queue.shift()!;
      island.push(current);

      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // Calculate UV bounds for this island
    let minU = Infinity,
      maxU = -Infinity;
    let minV = Infinity,
      maxV = -Infinity;

    for (const tri of island) {
      const vertices = getTriangleVertices(tri);
      for (const v of vertices) {
        const [u, vCoord] = getVertexUV(v);
        minU = Math.min(minU, u);
        maxU = Math.max(maxU, u);
        minV = Math.min(minV, vCoord);
        maxV = Math.max(maxV, vCoord);
      }
    }

    const islandIndex = islands.length;
    islands.push({
      triangleIndices: island,
      uvBounds: { minU, maxU, minV, maxV },
    });

    // Map triangles to their island
    for (const tri of island) {
      triangleToIsland.set(tri, islandIndex);
    }
  }

  return { islands, triangleToIsland };
}

// ============================================================================
// FIND ISLAND FROM RAYCAST
// ============================================================================

/**
 * Find which UV island a raycast hit belongs to.
 */
export function findIslandFromFace(
  faceIndex: number,
  floodFillResult: FloodFillResult
): UVIsland | null {
  const islandIndex = floodFillResult.triangleToIsland.get(faceIndex);
  if (islandIndex === undefined) return null;
  return floodFillResult.islands[islandIndex];
}

// ============================================================================
// FILL ISLAND ON CANVAS
// ============================================================================

/**
 * Fill all triangles of an island on the paint canvas.
 */
export function fillIslandOnCanvas(
  island: UVIsland,
  geometry: THREE.BufferGeometry,
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  color: string
): void {
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();

  if (!uv) {
    console.warn("fillIslandOnCanvas: No UV attribute found");
    return;
  }

  const getTriangleVertices = (triIndex: number): number[] => {
    if (index) {
      return [
        index.getX(triIndex * 3),
        index.getX(triIndex * 3 + 1),
        index.getX(triIndex * 3 + 2),
      ];
    }
    return [triIndex * 3, triIndex * 3 + 1, triIndex * 3 + 2];
  };

  // Save context state
  ctx.save();

  // Ensure we're drawing with source-over compositing
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = color;

  // Helper to wrap UV to 0-1 range (handles repeat wrapping)
  const wrapUV = (value: number): number => {
    const wrapped = value % 1;
    return wrapped < 0 ? wrapped + 1 : wrapped;
  };

  for (const triIndex of island.triangleIndices) {
    const vertices = getTriangleVertices(triIndex);

    // Get UV coordinates, wrap to 0-1, and convert to canvas pixels
    const uvCoords = vertices.map((v) => {
      const u = wrapUV(uv.getX(v));
      const vCoord = wrapUV(uv.getY(v));
      return {
        x: u * canvasSize,
        y: (1 - vCoord) * canvasSize, // Flip Y for canvas
      };
    });

    // Draw triangle
    ctx.beginPath();
    ctx.moveTo(uvCoords[0].x, uvCoords[0].y);
    ctx.lineTo(uvCoords[1].x, uvCoords[1].y);
    ctx.lineTo(uvCoords[2].x, uvCoords[2].y);
    ctx.closePath();
    ctx.fill();
  }

  // Restore context state
  ctx.restore();
}

// ============================================================================
// GET ISLAND TRIANGLES FOR HIGHLIGHTING
// ============================================================================

/**
 * Get all triangle positions for an island (for highlight mesh).
 */
export function getIslandTrianglePositions(
  island: UVIsland,
  geometry: THREE.BufferGeometry
): Float32Array {
  const position = geometry.getAttribute("position");
  const index = geometry.getIndex();

  const getTriangleVertices = (triIndex: number): number[] => {
    if (index) {
      return [
        index.getX(triIndex * 3),
        index.getX(triIndex * 3 + 1),
        index.getX(triIndex * 3 + 2),
      ];
    }
    return [triIndex * 3, triIndex * 3 + 1, triIndex * 3 + 2];
  };

  const positions: number[] = [];

  for (const triIndex of island.triangleIndices) {
    const vertices = getTriangleVertices(triIndex);
    for (const v of vertices) {
      positions.push(position.getX(v), position.getY(v), position.getZ(v));
    }
  }

  return new Float32Array(positions);
}

/**
 * Get all triangle normals for an island (for particle emission).
 */
export function getIslandTriangleNormals(
  island: UVIsland,
  geometry: THREE.BufferGeometry
): Float32Array {
  const normal = geometry.getAttribute("normal");
  const index = geometry.getIndex();

  if (!normal) {
    // Compute normals if not present
    geometry.computeVertexNormals();
  }

  const normalAttr = geometry.getAttribute("normal");

  const getTriangleVertices = (triIndex: number): number[] => {
    if (index) {
      return [
        index.getX(triIndex * 3),
        index.getX(triIndex * 3 + 1),
        index.getX(triIndex * 3 + 2),
      ];
    }
    return [triIndex * 3, triIndex * 3 + 1, triIndex * 3 + 2];
  };

  const normals: number[] = [];

  for (const triIndex of island.triangleIndices) {
    const vertices = getTriangleVertices(triIndex);
    for (const v of vertices) {
      normals.push(normalAttr.getX(v), normalAttr.getY(v), normalAttr.getZ(v));
    }
  }

  return new Float32Array(normals);
}
