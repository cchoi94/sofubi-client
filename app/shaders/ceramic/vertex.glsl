// Ceramic Shader - Vertex Shader
// Smooth glazed pottery look

attribute vec4 tangent;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Tangent space for normal mapping
  vTangent = normalize(normalMatrix * tangent.xyz);
  vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;
  vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  gl_Position = projectionMatrix * mvPosition;
}
