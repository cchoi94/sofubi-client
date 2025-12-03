uniform sampler2D paintTexture;
uniform sampler2D normalMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;
uniform float normalScale;
uniform float useNormalMap;
uniform float useRoughnessMap;
uniform float useAoMap;
uniform vec3 silverColor;
uniform float silverIntensity;
uniform float shininess;
uniform float iridescenceStrength;
uniform float iridescenceScale;
uniform float fresnelPower;
uniform float reflectionStrength;
uniform vec3 lightPosition;
uniform vec3 lightPosition2;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float ambientIntensity;
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

// Rainbow iridescence based on view angle and normal
vec3 rainbow(float t) {
  // Full spectrum rainbow
  vec3 color;
  color.r = 0.5 + 0.5 * cos(6.28318 * (t + 0.0));
  color.g = 0.5 + 0.5 * cos(6.28318 * (t + 0.33));
  color.b = 0.5 + 0.5 * cos(6.28318 * (t + 0.67));
  return color;
}

// Blinn-Phong specular
float blinnPhongSpecular(vec3 N, vec3 H, float shine) {
  float NdotH = max(dot(N, H), 0.0);
  return pow(NdotH, shine);
}

// Chrome environment reflection - high contrast, bright
vec3 envReflection(vec3 reflectDir) {
  float y = reflectDir.y * 0.5 + 0.5;

  // Bright sky for chrome reflections
  vec3 skyColor = mix(vec3(0.5, 0.55, 0.65), vec3(0.95, 0.97, 1.0), pow(y, 0.7));
  vec3 groundColor = vec3(0.12, 0.1, 0.08);
  vec3 envColor = mix(groundColor, skyColor, smoothstep(-0.2, 0.3, reflectDir.y));

  // Sharp horizontal bands for that chrome look
  float bands = smoothstep(0.4, 0.6, fract(reflectDir.y * 3.0 + 0.5));
  envColor = mix(envColor * 0.7, envColor * 1.2, bands);

  return envColor;
}

void main() {
  // Sample paint texture
  vec4 paintColor = texture2D(paintTexture, vUv);

  // Chrome silver base - bright and reflective
  vec3 baseMetal = silverColor * silverIntensity;

  // Paint replaces metal color where painted (based on alpha)
  vec3 metalColor = mix(baseMetal, paintColor.rgb * silverIntensity, paintColor.a);

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

  // Roughness from map
  float rough = 0.3;
  if(useRoughnessMap > 0.5) {
    rough = texture2D(roughnessMap, vUv).r;
  }
  float actualShininess = shininess * (1.0 - rough * 0.5);

  // AO from map
  float ao = 1.0;
  if(useAoMap > 0.5) {
    ao = texture2D(aoMap, vUv).r;
  }

  vec3 V = normalize(vViewPosition);
  vec3 L1 = normalize(lightPosition - vWorldPosition);
  vec3 L2 = normalize(lightPosition2 - vWorldPosition);
  vec3 H1 = normalize(V + L1);
  vec3 H2 = normalize(V + L2);

  float NdotV = max(dot(N, V), 0.0);
  float NdotL1 = max(dot(N, L1), 0.0);
  float NdotL2 = max(dot(N, L2), 0.0);

  // === BLINN-PHONG LIGHTING ===

  // Diffuse (Lambert)
  float diff1 = NdotL1;
  float diff2 = NdotL2 * 0.5; // Secondary light dimmer
  vec3 diffuse = metalColor * (diff1 + diff2) * lightIntensity;

  // Specular (Blinn-Phong) - use actualShininess which factors in roughness map
  float spec1 = blinnPhongSpecular(N, H1, actualShininess);
  float spec2 = blinnPhongSpecular(N, H2, actualShininess * 0.8);
  vec3 specular = lightColor * (spec1 + spec2 * 0.4) * specularIntensity;

  // Ambient with AO
  vec3 ambient = metalColor * ambientIntensity * ao;

  // === ENVIRONMENT REFLECTION ===

  vec3 reflection = envReflection(vReflect);
  float fresnel = pow(1.0 - NdotV, fresnelPower);
  // Metallic reflection - tinted by metal color
  vec3 metallicReflection = reflection * mix(metalColor, vec3(1.0), 0.3) * reflectionStrength;
  // Fresnel boost at edges
  metallicReflection *= (0.4 + fresnel * 0.6);

  // === RAINBOW IRIDESCENCE ===

  // Thin-film interference based on view angle
  float filmPhase = NdotV * iridescenceScale;

  // Add position-based variation for more organic look
  float posVar = dot(vWorldNormal, vec3(0.3, 0.5, 0.4)) * 0.5;
  filmPhase += posVar;

  // Rainbow color from phase
  vec3 iridescentColor = rainbow(filmPhase);

  // Mix iridescence into specular and reflections
  float iriMix = fresnel * iridescenceStrength;

  // === COMBINE ===

  // Base metallic with diffuse lighting
  vec3 color = ambient + diffuse;

  // Add specular highlights
  color += specular;

  // Add environment reflection
  color += metallicReflection;

  // Blend in rainbow iridescence
  // Iridescence tints the specular/reflective parts
  vec3 iriContribution = iridescentColor * iriMix * 1.5;
  color = mix(color, color * iridescentColor + iriContribution, iriMix);

  // Rim light with rainbow tint
  float rim = pow(1.0 - NdotV, 3.5);
  color += iridescentColor * rim * iridescenceStrength * 0.4;

  // Tone mapping (Reinhard)
  color = color / (color + vec3(1.0));

  // Gamma correction
  color = pow(color, vec3(1.0 / 2.2));

  gl_FragColor = vec4(color, 1.0);
}
