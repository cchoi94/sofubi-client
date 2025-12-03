// Metal Shader - Fragment Shader
// Die-cast toy metal - matte metallic with soft highlights, like zinc/zamak alloy

precision highp float;

uniform sampler2D paintTexture;
uniform sampler2D normalMap;
uniform sampler2D roughnessMap;
uniform sampler2D metalnessMap;
uniform sampler2D aoMap;
uniform float normalScale;
uniform float useNormalMap;
uniform float useRoughnessMap;
uniform float useMetalnessMap;
uniform float useAoMap;
uniform vec3 metalColor;
uniform float metalness;
uniform float roughness;
uniform float reflectivity;
uniform float anisotropy;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float specularIntensity;
uniform float ambientIntensity;
uniform float fresnelStrength;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vReflect;
varying vec3 vTangent;
varying vec3 vBitangent;

// GGX distribution for realistic metal specular
float D_GGX(float NdotH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH2 = NdotH * NdotH;
  float denom = NdotH2 * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * denom * denom);
}

// Geometry term for GGX
float G_Smith(float NdotV, float NdotL, float roughness) {
  float k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  float g1 = NdotV / (NdotV * (1.0 - k) + k);
  float g2 = NdotL / (NdotL * (1.0 - k) + k);
  return g1 * g2;
}

// Fresnel-Schlick for metals
vec3 F_Schlick(float cosTheta, vec3 F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

void main() {
  vec4 paintColor = texture2D(paintTexture, vUv);

  // Die-cast base color - paint replaces where painted
  vec3 baseColor = mix(metalColor, paintColor.rgb, paintColor.a);

  // Normal mapping
  vec3 N = normalize(vNormal);
  if(useNormalMap > 0.5) {
    vec3 normalTex = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    normalTex.xy *= normalScale;
    vec3 T = normalize(vTangent);
    vec3 B = normalize(vBitangent);
    mat3 TBN = mat3(T, B, N);
    N = normalize(TBN * normalTex);
  }

  // Roughness - die-cast is slightly rough, not mirror-smooth
  float rough = roughness;
  if(useRoughnessMap > 0.5) {
    rough = texture2D(roughnessMap, vUv).r;
  }
  rough = clamp(rough, 0.15, 1.0); // Die-cast is never perfectly smooth

  // Metalness from map or uniform  
  float metal = metalness;
  if(useMetalnessMap > 0.5) {
    metal = texture2D(metalnessMap, vUv).r;
  }

  // AO from map
  float ao = 1.0;
  if(useAoMap > 0.5) {
    ao = texture2D(aoMap, vUv).r;
  }

  vec3 V = normalize(vViewPosition);

  // Soft studio lighting for die-cast look
  vec3 L1 = normalize(vec3(3.0, 6.0, 4.0) - vWorldPosition);  // Key light
  vec3 L2 = normalize(vec3(-4.0, 2.0, -1.0) - vWorldPosition); // Fill
  vec3 L3 = normalize(vec3(0.0, 4.0, -5.0) - vWorldPosition);  // Back rim

  vec3 H1 = normalize(V + L1);
  vec3 H2 = normalize(V + L2);
  vec3 H3 = normalize(V + L3);

  float NdotV = max(dot(N, V), 0.001);
  float NdotL1 = max(dot(N, L1), 0.0);
  float NdotL2 = max(dot(N, L2), 0.0);
  float NdotL3 = max(dot(N, L3), 0.0);
  float NdotH1 = max(dot(N, H1), 0.0);
  float NdotH2 = max(dot(N, H2), 0.0);
  float NdotH3 = max(dot(N, H3), 0.0);
  float VdotH1 = max(dot(V, H1), 0.0);

  // Metal F0 - die-cast zinc/zamak has a specific look
  vec3 F0 = mix(vec3(0.04), baseColor * 0.9, metal);

  // === DIFFUSE ===
  // Die-cast has visible surface color, not just reflections
  float diff = NdotL1 * 0.5 + NdotL2 * 0.3 + NdotL3 * 0.2;
  vec3 diffuse = baseColor * diff * (1.0 - metal * 0.7) * lightIntensity;

  // === SPECULAR (GGX BRDF) ===
  float D1 = D_GGX(NdotH1, rough);
  float D2 = D_GGX(NdotH2, rough);
  float D3 = D_GGX(NdotH3, rough);

  float G1 = G_Smith(NdotV, NdotL1, rough);
  float G2 = G_Smith(NdotV, NdotL2, rough);
  float G3 = G_Smith(NdotV, NdotL3, rough);

  vec3 F = F_Schlick(VdotH1, F0);

  // Combine specular contributions
  vec3 spec1 = (D1 * G1 * F) / (4.0 * NdotV * max(NdotL1, 0.001)) * NdotL1;
  vec3 spec2 = (D2 * G2 * F) / (4.0 * NdotV * max(NdotL2, 0.001)) * NdotL2 * 0.5;
  vec3 spec3 = (D3 * G3 * F) / (4.0 * NdotV * max(NdotL3, 0.001)) * NdotL3 * 0.3;

  vec3 specular = (spec1 + spec2 + spec3) * specularIntensity * lightIntensity;

  // === AMBIENT/ENVIRONMENT ===
  // Soft ambient that shows the metal color
  vec3 ambient = baseColor * ambientIntensity * ao * 0.6;

  // Subtle environment reflection - die-cast isn't mirror-like
  vec3 envUp = vec3(0.35, 0.38, 0.42);   // Cool sky tone
  vec3 envDown = vec3(0.15, 0.12, 0.10); // Warm ground
  vec3 envColor = mix(envDown, envUp, N.y * 0.5 + 0.5);

  // Fresnel for environment
  float envFresnel = pow(1.0 - NdotV, 4.0) * fresnelStrength;
  vec3 envReflect = envColor * mix(vec3(0.3), baseColor, metal * 0.5);
  envReflect *= reflectivity * (0.2 + envFresnel * 0.4) * (1.0 - rough * 0.6);

  // === COMBINE ===
  vec3 color = ambient + diffuse + specular + envReflect * metal;

  // Subtle edge darkening for that cast metal look
  float edgeDark = smoothstep(0.0, 0.3, NdotV);
  color *= mix(0.85, 1.0, edgeDark);

  // Apply AO more strongly in crevices
  color *= mix(ao, 1.0, 0.3);

  // Tone mapping - preserve the matte quality
  color = color / (color + vec3(0.6));

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}
