// Frosted Glass / Smoked Plastic Shader
// See-through material with visible form and soft highlights

precision highp float;

uniform sampler2D paintTexture;
uniform sampler2D normalMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;
uniform float normalScale;
uniform float useNormalMap;
uniform float useRoughnessMap;
uniform float useAoMap;
uniform vec3 plasticColor;
uniform float opacity;
uniform float glossiness;
uniform float fresnelPower;
uniform float reflectionStrength;
uniform float edgeThickness;
uniform float rimBrightness;
uniform vec3 lightPosition;
uniform vec3 lightPosition2;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float specularIntensity;
uniform float time;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vWorldNormal;
varying vec3 vReflect;
varying vec3 vTangent;
varying vec3 vBitangent;

// Fresnel - how much edge reflection
float fresnelSchlick(float cosTheta, float F0) {
  return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

// Blinn-Phong specular
float blinnPhong(vec3 lightDir, vec3 viewDir, vec3 normal, float shininess) {
  vec3 halfDir = normalize(lightDir + viewDir);
  return pow(max(dot(normal, halfDir), 0.0), shininess);
}

// Soft diffuse wrap
float wrapDiffuse(vec3 lightDir, vec3 normal, float wrap) {
  float NdotL = dot(normal, lightDir);
  return max(0.0, (NdotL + wrap) / (1.0 + wrap));
}

void main() {
  // Sample paint
  vec4 paintColor = texture2D(paintTexture, vUv);

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

  // Roughness
  float rough = 0.3;
  if(useRoughnessMap > 0.5) {
    rough = texture2D(roughnessMap, vUv).r;
  }

  // AO
  float ao = 1.0;
  if(useAoMap > 0.5) {
    ao = texture2D(aoMap, vUv).r;
  }

  vec3 V = normalize(vViewPosition);

  // Light directions
  vec3 L1 = normalize(vec3(1.0, 1.0, 0.8));  // Main light
  vec3 L2 = normalize(vec3(-0.6, 0.3, 0.5)); // Fill light
  vec3 L3 = normalize(vec3(0.0, 0.2, -1.0)); // Rim/back light

  float NdotV = max(dot(N, V), 0.0);

  // Diffuse lighting - soft wrap for frosted look
  float diff1 = wrapDiffuse(L1, N, 0.4);
  float diff2 = wrapDiffuse(L2, N, 0.5) * 0.4;
  float diff3 = wrapDiffuse(L3, N, 0.3) * 0.25;
  float totalDiff = (diff1 + diff2 + diff3) * lightIntensity;

  // Specular - softer for frosted glass
  float shininess = glossiness * 60.0 * (1.0 - rough * 0.5) + 10.0;
  float spec1 = blinnPhong(L1, V, N, shininess);
  float spec2 = blinnPhong(L2, V, N, shininess * 0.7) * 0.3;
  float totalSpec = (spec1 + spec2) * specularIntensity;

  // Fresnel for edge glow
  float fresnel = fresnelSchlick(NdotV, 0.04);
  float fresnelEdge = pow(1.0 - NdotV, fresnelPower);

  // Rim lighting
  float rim = pow(1.0 - NdotV, edgeThickness);

  // Base glass color - very subtle tint, mostly transparent
  vec3 glassBase = plasticColor * totalDiff * ao * 0.3;

  // Specular highlights - main visible element
  vec3 specColor = lightColor * totalSpec;

  // Rim/edge highlight - helps see the shape
  vec3 rimColor = lightColor * rim * rimBrightness * 0.5;

  // Fresnel edge - subtle
  vec3 fresnelColor = lightColor * fresnelEdge * reflectionStrength * 0.2;

  // Paint contribution - painted areas show through
  vec3 paintContrib = paintColor.rgb * paintColor.a;

  // Combine - glass is mostly specular highlights, minimal color
  vec3 color = glassBase + specColor + rimColor + fresnelColor + paintContrib;

  // Gamma correction only
  color = pow(color, vec3(1.0 / 2.2));

  // Alpha - LOW base, glass is mostly invisible
  float alpha = opacity * 0.15;          // Very transparent base
  alpha += fresnelEdge * 0.25;           // Edges more visible (Fresnel)
  alpha += rim * 0.1;                    // Subtle rim
  alpha += totalSpec * 0.6;              // Specular highlights pop
  alpha += paintColor.a;                 // Paint is opaque
  alpha = clamp(alpha, 0.05, 1.0);       // Can be very transparent

  gl_FragColor = vec4(color, alpha);
}
