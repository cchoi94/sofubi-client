// Metal Shader - Vertex Shader
// Realistic metallic surface

attribute vec4 tangent;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vReflect;
varying vec3 vTangent;
varying vec3 vBitangent;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);

  // Tangent space for normal mapping
  vTangent = normalize(normalMatrix * tangent.xyz);
  vBitangent = normalize(cross(vNormal, vTangent) * tangent.w);

  vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);

  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = -mvPosition.xyz;

  // Reflection vector for environment mapping
  vec3 worldViewDir = normalize(cameraPosition - worldPosition.xyz);
  vReflect = reflect(-worldViewDir, vWorldNormal);

  gl_Position = projectionMatrix * mvPosition;
}
