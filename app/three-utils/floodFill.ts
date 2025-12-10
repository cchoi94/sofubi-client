import * as THREE from "three";

/**
 * Fill all triangles of an island on the material mask canvas.
 * Used for shader masking with fill brush.
 */
export function fillIslandOnMaskCanvas(
  island: UVIsland,
  geometry: THREE.BufferGeometry,
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  materialColor: string
): void {
  const uv = geometry.getAttribute("uv");
  const index = geometry.getIndex();

  if (!uv) {
    console.warn("fillIslandOnMaskCanvas: No UV attribute found");
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

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = materialColor;

  const wrapUV = (value: number): number => {
    const wrapped = value % 1;
    return wrapped < 0 ? wrapped + 1 : wrapped;
  };

  for (const triIndex of island.triangleIndices) {
    const vertices = getTriangleVertices(triIndex);
    const uvCoords = vertices.map((v) => {
      const u = wrapUV(uv.getX(v));
      const vCoord = wrapUV(uv.getY(v));
      return {
        x: u * canvasSize,
        y: (1 - vCoord) * canvasSize,
      };
    });
    ctx.beginPath();
    ctx.moveTo(uvCoords[0].x, uvCoords[0].y);
    ctx.lineTo(uvCoords[1].x, uvCoords[1].y);
    ctx.lineTo(uvCoords[2].x, uvCoords[2].y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

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
 * Islands are groups of triangles connected in BOTH UV space AND 3D space.
 * This prevents overlapping/stacked UVs from incorrectly merging disconnected parts.
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

  // Build edge connectivity maps in both UV space and 3D space
  const uvEdgeMap = new Map<string, number[]>();
  const posEdgeMap = new Map<string, number[]>();

  const getVertexUV = (vertexIndex: number): [number, number] => {
    return [uv.getX(vertexIndex), uv.getY(vertexIndex)];
  };

  const getVertexPos = (vertexIndex: number): [number, number, number] => {
    return [
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex),
    ];
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
    const precision = 10000;
    const u1 = Math.round(uv1[0] * precision);
    const v1 = Math.round(uv1[1] * precision);
    const u2 = Math.round(uv2[0] * precision);
    const v2 = Math.round(uv2[1] * precision);

    if (u1 < u2 || (u1 === u2 && v1 < v2)) {
      return `${u1},${v1}-${u2},${v2}`;
    }
    return `${u2},${v2}-${u1},${v1}`;
  };

  // Create 3D position edge key (normalized so both directions match)
  const makePosEdgeKey = (
    p1: [number, number, number],
    p2: [number, number, number]
  ): string => {
    const precision = 10000;
    const x1 = Math.round(p1[0] * precision);
    const y1 = Math.round(p1[1] * precision);
    const z1 = Math.round(p1[2] * precision);
    const x2 = Math.round(p2[0] * precision);
    const y2 = Math.round(p2[1] * precision);
    const z2 = Math.round(p2[2] * precision);

    // Sort to make edge direction-independent
    if (
      x1 < x2 ||
      (x1 === x2 && y1 < y2) ||
      (x1 === x2 && y1 === y2 && z1 < z2)
    ) {
      return `${x1},${y1},${z1}-${x2},${y2},${z2}`;
    }
    return `${x2},${y2},${z2}-${x1},${y1},${z1}`;
  };

  // Process each triangle and register its edges in both UV and 3D space
  for (let triIndex = 0; triIndex < triangleCount; triIndex++) {
    const vertices = getTriangleVertices(triIndex);
    const uvs = vertices.map(getVertexUV);
    const positions = vertices.map(getVertexPos);

    // Three edges per triangle
    for (let e = 0; e < 3; e++) {
      const e2 = (e + 1) % 3;

      // UV edge
      const uvKey = makeUVEdgeKey(uvs[e], uvs[e2]);
      const uvExisting = uvEdgeMap.get(uvKey) || [];
      uvExisting.push(triIndex);
      uvEdgeMap.set(uvKey, uvExisting);

      // 3D position edge
      const posKey = makePosEdgeKey(positions[e], positions[e2]);
      const posExisting = posEdgeMap.get(posKey) || [];
      posExisting.push(triIndex);
      posEdgeMap.set(posKey, posExisting);
    }
  }

  // Build adjacency list - triangles must share edge in BOTH UV and 3D space
  const adjacency: number[][] = Array.from({ length: triangleCount }, () => []);

  // Find triangles that share edges in 3D space
  const pos3DNeighbors = new Map<number, Set<number>>();
  for (const triangles of posEdgeMap.values()) {
    if (triangles.length === 2) {
      const t1 = triangles[0];
      const t2 = triangles[1];
      if (!pos3DNeighbors.has(t1)) pos3DNeighbors.set(t1, new Set());
      if (!pos3DNeighbors.has(t2)) pos3DNeighbors.set(t2, new Set());
      pos3DNeighbors.get(t1)!.add(t2);
      pos3DNeighbors.get(t2)!.add(t1);
    }
  }

  // Only connect triangles that share edges in BOTH UV and 3D space
  for (const triangles of uvEdgeMap.values()) {
    if (triangles.length === 2) {
      const t1 = triangles[0];
      const t2 = triangles[1];
      // Check if they're also neighbors in 3D space
      const t1Neighbors = pos3DNeighbors.get(t1);
      if (t1Neighbors && t1Neighbors.has(t2)) {
        adjacency[t1].push(t2);
        adjacency[t2].push(t1);
      }
    }
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
