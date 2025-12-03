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

// Environment reflection
vec3 envReflection(vec3 reflectDir) {
  float y = reflectDir.y * 0.5 + 0.5;
  vec3 skyColor = mix(vec3(0.7, 0.75, 0.85), vec3(1.0, 1.0, 1.0), pow(y, 0.6));
  vec3 groundColor = vec3(0.25, 0.22, 0.2);
  return mix(groundColor, skyColor, smoothstep(-0.2, 0.4, reflectDir.y));
}

// Specular highlight
float specularHighlight(vec3 N, vec3 H, float shine) {
  float NdotH = max(dot(N, H), 0.0);
  return pow(NdotH, shine);
}

void main() {
  vec4 paintColor = texture2D(paintTexture, vUv);
  // Paint replaces plastic color where painted (based on alpha)
  vec3 tint = mix(plasticColor, paintColor.rgb, paintColor.a);

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

  // Fresnel - plastic edges catch light
  float fresnel = pow(1.0 - NdotV, fresnelPower);

  // Specular highlights - softer than glass, factor in roughness
  float shininess = glossiness * 150.0 * (1.0 - rough * 0.5) + 30.0;
  float spec1 = specularHighlight(N, H1, shininess);
  float spec2 = specularHighlight(N, H2, shininess * 0.7);
  vec3 specular = lightColor * (spec1 + spec2 * 0.4) * specularIntensity * lightIntensity;

  // Reflection - subtle
  vec3 reflection = envReflection(vReflect) * reflectionStrength * fresnel;

  // Rim/edge lighting - this makes plastic bottles visible
  float rim = pow(1.0 - NdotV, edgeThickness);
  vec3 rimColor = tint * rimBrightness * rim;

  // Very subtle diffuse tint
  vec3 diffuseTint = tint * 0.05 * (NdotL1 * 0.5 + NdotL2 * 0.3 + 0.2);

  // Paint contribution - painted areas should be more opaque and visible
  vec3 paintContribution = paintColor.rgb * paintColor.a * (NdotL1 * 0.6 + NdotL2 * 0.3 + 0.4);

  // Combine - glass-like with mostly specular/reflection
  vec3 color = diffuseTint + specular * 1.5 + reflection * 1.2 + rimColor * 0.5 + paintContribution;

  // Alpha - glass-like transparency, mostly invisible except reflections
  float alpha = opacity * 0.03; // Nearly invisible base
  alpha += fresnel * 0.12;  // Subtle edge visibility
  alpha += rim * 0.04;      // Very faint rim
  alpha += (spec1 + spec2) * 0.4; // Specular highlights more visible
  alpha += paintColor.a * 0.95; // Painted areas opaque
  alpha = clamp(alpha, 0.02, 0.95); // Allow near-invisible

  // Light gamma correction, keep it bright
  color = pow(color, vec3(1.0 / 2.0));

  gl_FragColor = vec4(color, alpha);
}
