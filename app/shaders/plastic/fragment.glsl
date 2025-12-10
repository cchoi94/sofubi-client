// ============================================================================
// PVC / Sofubi Vinyl Toy Shader - Fragment Shader
// ============================================================================
// Realistic vinyl plastic with:
// - Soft specular highlights (gummy look)
// - Fake subsurface scattering (wrap lighting + backlighting)
// - Clearcoat layer (glossy lacquer on top)
// - Fresnel edge sheen
// ============================================================================

precision highp float;

// ----------------------------------------------------------------------------
// Varyings from vertex shader
// ----------------------------------------------------------------------------
varying vec3 vWorldPos;
varying vec3 vNormal;
varying vec2 vUV;
varying vec3 vViewDir;

// ----------------------------------------------------------------------------
// Lighting uniforms
// ----------------------------------------------------------------------------
uniform vec3 uLightDir;       // Directional light direction (normalized, world space)
uniform vec3 uLightColor;     // Light color
uniform vec3 uAmbientColor;   // Ambient light color

// ----------------------------------------------------------------------------
// Material uniforms
// ----------------------------------------------------------------------------
uniform vec3  baseColor;         // Base diffuse color of the vinyl
uniform float roughness;         // Surface roughness (0 = mirror, 1 = very rough)
uniform float specularStrength;  // Intensity of base specular lobe
uniform float clearcoat;         // Clearcoat strength (0–1)
uniform float clearcoatGloss;    // Clearcoat sharpness (higher = sharper)
uniform float sssStrength;       // Subsurface scattering strength
uniform float sssWidth;          // SSS wrap width (how far light wraps around)
uniform vec3  F0;                // Base Fresnel reflectance (typically ~0.04 for plastic)

// ----------------------------------------------------------------------------
// Texture uniforms
// ----------------------------------------------------------------------------
uniform sampler2D paintTexture;      // User's painted texture
uniform float usePaintTexture;       // 0 or 1 toggle

uniform sampler2D normalMap;         // Original GLB normal map
uniform float useNormalMap;          // 0 or 1 toggle
uniform float normalScale;           // Normal map intensity

uniform sampler2D roughnessMap;      // Original GLB roughness map
uniform float useRoughnessMap;       // 0 or 1 toggle

uniform sampler2D aoMap;             // Original GLB ambient occlusion map
uniform float useAoMap;              // 0 or 1 toggle

// ----------------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------------
const float PI = 3.14159265359;

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------

// Schlick Fresnel approximation
// cosTheta: dot(N, V) or dot(H, V)
// F0: base reflectance at normal incidence
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
  float f = pow(1.0 - cosTheta, 5.0);
  return F0 + (1.0 - F0) * f;
}

// Wrap diffuse lighting for fake SSS
// This softens the lighting terminator and allows light to "wrap" around the surface
// wrap: controls how much the light wraps (0 = standard Lambert, higher = more wrap)
float computeWrapDiffuse(vec3 L, vec3 N, float wrap) {
  float NdotL = dot(N, L);
  // Remap NdotL from [-1, 1] to a softer range
  // Standard wrap formula: (NdotL + wrap) / (1 + wrap)
  return max(0.0, (NdotL + wrap) / (1.0 + wrap));
}

// View-dependent backlighting for SSS
// Simulates light bleeding through thin areas when viewed from behind
// This adds a subtle glow on edges opposite the light
float computeBacklighting(vec3 L, vec3 V, vec3 N) {
  // When view direction opposes light direction, and surface faces away from light
  float backFactor = max(0.0, -dot(N, L));  // Surface facing away from light
  float viewAlign = max(0.0, dot(V, L));    // View aligned with light (looking "through" surface)
  return backFactor * viewAlign;
}

// Blinn-Phong specular term
// L: light direction, V: view direction, N: normal
// shininess: specular exponent (higher = sharper highlight)
float blinnPhongSpecular(vec3 L, vec3 V, vec3 N, float shininess) {
  vec3 H = normalize(L + V);  // Half vector
  float NdotH = max(dot(N, H), 0.0);
  return pow(NdotH, shininess);
}

// GGX / Trowbridge-Reitz normal distribution function (optional, more physically accurate)
// Uncomment this and replace Blinn-Phong if you prefer GGX
/*
float distributionGGX(vec3 N, vec3 H, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float NdotH = max(dot(N, H), 0.0);
  float NdotH2 = NdotH * NdotH;
  
  float denom = (NdotH2 * (a2 - 1.0) + 1.0);
  denom = PI * denom * denom;
  
  return a2 / denom;
}
*/

// Compute base specular lobe (vinyl surface)
// Uses Blinn-Phong with Fresnel modulation
vec3 computeSpecular(vec3 L, vec3 V, vec3 N, float rough, float strength, vec3 fresnel) {
  // Convert roughness to shininess (inverse relationship)
  // roughness 0 -> very high shininess, roughness 1 -> low shininess
  float shininess = mix(256.0, 8.0, rough);  // Range: 8–256
  
  float spec = blinnPhongSpecular(L, V, N, shininess);
  
  // Modulate by Fresnel and strength
  return fresnel * spec * strength;
}

// Compute clearcoat lobe (glossy lacquer layer on top)
// Independent specular with its own roughness and Fresnel
vec3 computeClearcoat(vec3 L, vec3 V, vec3 N, float coatStrength, float coatGloss, vec3 fresnel) {
  if (coatStrength < 0.001) return vec3(0.0);  // Skip if clearcoat disabled
  
  // Clearcoat is always sharp (low roughness)
  // coatGloss: higher = sharper (we map it to shininess directly)
  float shininess = mix(64.0, 512.0, coatGloss);  // Range: 64–512
  
  float spec = blinnPhongSpecular(L, V, N, shininess);
  
  // Clearcoat uses a fixed F0 for typical lacquer (around 0.04–0.05)
  vec3 clearcoatF0 = vec3(0.04);
  vec3 H = normalize(L + V);
  float HdotV = max(dot(H, V), 0.0);
  vec3 clearcoatFresnel = fresnelSchlick(HdotV, clearcoatF0);
  
  return clearcoatFresnel * spec * coatStrength;
}

// ----------------------------------------------------------------------------
// Main Fragment Shader
// ----------------------------------------------------------------------------
void main() {
  // Normalize interpolated vectors
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(uLightDir);
  
  // -------------------------------------------------------------------------
  // 1. NORMAL MAPPING (from original GLB)
  // -------------------------------------------------------------------------
  if (useNormalMap > 0.5) {
    // Sample normal map
    vec3 normalTex = texture2D(normalMap, vUV).xyz * 2.0 - 1.0;
    normalTex.xy *= normalScale;
    
    // For proper normal mapping, we'd need tangent space (TBN matrix)
    // For now, we'll perturb the normal in view space (simplified)
    N = normalize(N + normalTex * 0.5);
  }
  
  // -------------------------------------------------------------------------
  // 2. BASE COLOR
  // -------------------------------------------------------------------------
  vec3 albedo = baseColor;
  
  // Sample paint texture and blend with base color
  if (usePaintTexture > 0.5) {
    vec4 paintSample = texture2D(paintTexture, vUV);
    // Mix paint over base using paint alpha
    albedo = mix(albedo, paintSample.rgb, paintSample.a);
  }
  
  // -------------------------------------------------------------------------
  // 3. ROUGHNESS (from original GLB or uniform)
  // -------------------------------------------------------------------------
  float finalRoughness = roughness;
  if (useRoughnessMap > 0.5) {
    // Sample roughness from texture (typically stored in G channel)
    float roughnessSample = texture2D(roughnessMap, vUV).g;
    // Multiply with uniform roughness for control
    finalRoughness *= roughnessSample;
  }
  
  // -------------------------------------------------------------------------
  // 4. AMBIENT OCCLUSION (from original GLB)
  // -------------------------------------------------------------------------
  float ao = 1.0;
  if (useAoMap > 0.5) {
    // Sample AO from texture (typically stored in R channel)
    ao = texture2D(aoMap, vUV).r;
  }
  
  // -------------------------------------------------------------------------
  // 5. AMBIENT TERM
  // -------------------------------------------------------------------------
  vec3 ambient = uAmbientColor * albedo * ao;
  
  // -------------------------------------------------------------------------
  // 6. DIFFUSE TERM (Lambertian)
  // -------------------------------------------------------------------------
  float NdotL = max(dot(N, L), 0.0);
  vec3 diffuse = albedo * uLightColor * NdotL * ao;
  
  // -------------------------------------------------------------------------
  // 7. FAKE SUBSURFACE SCATTERING (SSS)
  // -------------------------------------------------------------------------
  // Wrap lighting: softens the terminator, makes light "bleed" around edges
  float wrapDiff = computeWrapDiffuse(L, N, sssWidth);
  
  // Backlighting: view-dependent glow when looking through thin areas
  float backlight = computeBacklighting(L, V, N);
  
  // Combine wrap and backlight, modulate by SSS strength
  // We add this to diffuse to create a soft, gummy look
  vec3 sssContrib = albedo * uLightColor * (wrapDiff * 0.5 + backlight * 0.3) * sssStrength;
  
  // -------------------------------------------------------------------------
  // 8. FRESNEL TERM
  // -------------------------------------------------------------------------
  float NdotV = max(dot(N, V), 0.0);
  vec3 fresnel = fresnelSchlick(NdotV, F0);
  
  // Edge sheen: Fresnel falloff for rim lighting effect
  float fresnelEdge = pow(1.0 - NdotV, 3.0);  // Sharper edge falloff
  
  // -------------------------------------------------------------------------
  // 9. BASE SPECULAR LOBE (vinyl surface)
  // -------------------------------------------------------------------------
  vec3 specular = computeSpecular(L, V, N, finalRoughness, specularStrength, fresnel);
  
  // -------------------------------------------------------------------------
  // 10. CLEARCOAT LOBE (glossy lacquer layer)
  // -------------------------------------------------------------------------
  // The clearcoat sits "on top" of the base, adding a sharp highlight
  vec3 clearcoatSpec = computeClearcoat(L, V, N, clearcoat, clearcoatGloss, fresnel);
  
  // -------------------------------------------------------------------------
  // 11. COMBINE ALL TERMS
  // -------------------------------------------------------------------------
  // Final color = ambient + diffuse + SSS + base specular + clearcoat + edge sheen
  vec3 color = ambient + diffuse + sssContrib + specular * uLightColor + clearcoatSpec * uLightColor;
  
  // Add subtle Fresnel edge tint (helps define silhouette)
  color += fresnel * fresnelEdge * uLightColor * 0.1;
  
  // -------------------------------------------------------------------------
  // 12. TONE MAPPING / GAMMA CORRECTION
  // -------------------------------------------------------------------------
  // Simple gamma correction for sRGB display
  // (Assumes linear lighting calculations above)
  color = pow(color, vec3(1.0 / 2.2));
  
  // -------------------------------------------------------------------------
  // 13. OUTPUT
  // -------------------------------------------------------------------------
  gl_FragColor = vec4(color, 1.0);
}
