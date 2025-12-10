// ============================================================================
// PVC / Sofubi Vinyl Toy Shader - Vertex Shader
// ============================================================================
// Note: Three.js automatically provides these built-ins:
// - attribute vec3 position, normal
// - attribute vec2 uv
// - uniform mat4 modelMatrix, viewMatrix, projectionMatrix
// - uniform mat3 normalMatrix
// - uniform vec3 cameraPosition
// ============================================================================

varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vViewDir;

void main() {
  vUV = uv;
  
  // Transform normal to view space for lighting calculations
  vNormal = normalize(normalMatrix * normal);
  
  // World position for lighting
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPosition.xyz;
  
  // View direction (from surface to camera) in world space
  vViewDir = normalize(cameraPosition - vWorldPos);
  
  // Final position
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
