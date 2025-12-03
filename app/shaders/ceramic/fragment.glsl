// Ceramic Shader - Fragment Shader
// Smooth glazed pottery with subtle subsurface scattering look

precision highp float;

uniform vec3 baseColor;
uniform vec3 glazeColor;
uniform float glazeThickness;
uniform float glossiness;
uniform float roughness;
uniform float subsurfaceStrength;
uniform float fresnelPower;
uniform vec3 lightColor;
uniform float lightIntensity;
uniform float specularIntensity;
uniform float ambientIntensity;
uniform sampler2D paintTexture;
uniform sampler2D normalMap;
uniform sampler2D roughnessMap;
uniform sampler2D aoMap;
uniform float normalScale;
uniform float useNormalMap;
uniform float useRoughnessMap;
uniform float useAoMap;

varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vTangent;
varying vec3 vBitangent;

// Fresnel effect for glaze coating
float fresnel(vec3 viewDir, vec3 normal, float power) {
  return pow(1.0 - max(dot(viewDir, normal), 0.0), power);
}

// Blinn-Phong specular for glossy glaze
float blinnPhongSpecular(vec3 lightDir, vec3 viewDir, vec3 normal, float shininess) {
  vec3 halfDir = normalize(lightDir + viewDir);
  return pow(max(dot(normal, halfDir), 0.0), shininess);
}

// Soft diffuse with wrap lighting for ceramic feel
float softDiffuse(vec3 lightDir, vec3 normal, float wrap) {
  float NdotL = dot(normal, lightDir);
  return max(0.0, (NdotL + wrap) / (1.0 + wrap));
}

void main() {
  // Normal mapping
  vec3 normal = normalize(vNormal);
  if(useNormalMap > 0.5) {
    vec3 normalTex = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    normalTex.xy *= normalScale;
    vec3 T = normalize(vTangent);
    vec3 B = normalize(vBitangent);
    mat3 TBN = mat3(T, B, normal);
    normal = normalize(TBN * normalTex);
  }

  // Roughness from map
  float actualRoughness = roughness;
  if(useRoughnessMap > 0.5) {
    actualRoughness = texture2D(roughnessMap, vUv).r;
  }

  // AO from map
  float ao = 1.0;
  if(useAoMap > 0.5) {
    ao = texture2D(aoMap, vUv).r;
  }

  vec3 viewDir = normalize(vViewPosition);

  // Sample paint texture
  vec4 paintSample = texture2D(paintTexture, vUv);

  // Main light from upper right
  vec3 lightDir1 = normalize(vec3(1.0, 1.0, 0.8));
  // Fill light from left
  vec3 lightDir2 = normalize(vec3(-0.6, 0.3, 0.5));
  // Rim light from behind
  vec3 lightDir3 = normalize(vec3(0.0, 0.2, -1.0));

  // Calculate soft diffuse lighting (ceramic has soft light transitions)
  float diff1 = softDiffuse(lightDir1, normal, 0.3);
  float diff2 = softDiffuse(lightDir2, normal, 0.4) * 0.4;
  float diff3 = softDiffuse(lightDir3, normal, 0.2) * 0.2;
  float totalDiffuse = diff1 + diff2 + diff3;

  // Specular highlights - ceramic glaze is glossy but not mirror-like, factor in roughness
  float shininess = glossiness * 120.0 * (1.0 - actualRoughness * 0.5) + 30.0;
  float spec1 = blinnPhongSpecular(lightDir1, viewDir, normal, shininess);
  float spec2 = blinnPhongSpecular(lightDir2, viewDir, normal, shininess * 0.8) * 0.3;
  float totalSpecular = (spec1 + spec2) * specularIntensity;

  // Fresnel for glaze coating effect
  float fresnelTerm = fresnel(viewDir, normal, fresnelPower);

  // Base ceramic color - paint fully replaces base where painted
  vec3 paintedBase = mix(baseColor, paintSample.rgb, paintSample.a);

  // Glaze layer - adds a slight color tint and glossiness
  vec3 glazeLayer = mix(paintedBase, glazeColor, glazeThickness * 0.3);

  // Subsurface scattering simulation - ceramics have a subtle glow
  vec3 subsurfaceColor = paintedBase * 1.2;
  float subsurface = softDiffuse(lightDir1, normal, 0.8) * subsurfaceStrength;

  // Combine layers
  vec3 diffuseResult = glazeLayer * totalDiffuse * lightIntensity;
  vec3 subsurfaceResult = subsurfaceColor * subsurface * 0.15;

  // Specular with glaze color tint
  vec3 specularResult = mix(lightColor, glazeColor, 0.1) * totalSpecular;

  // Fresnel rim - gives that glazed pottery edge glow
  vec3 fresnelRim = glazeColor * fresnelTerm * 0.15;

  // Ambient with slight warmth and AO
  vec3 ambient = paintedBase * ambientIntensity * vec3(1.0, 0.98, 0.95) * ao;

  // Final composition
  vec3 finalColor = ambient + diffuseResult + subsurfaceResult + specularResult + fresnelRim;

  // Slight tone mapping for that soft ceramic look
  finalColor = finalColor / (finalColor + vec3(0.5));
  finalColor = pow(finalColor, vec3(0.95)); // Subtle gamma for softness

  gl_FragColor = vec4(finalColor, 1.0);
}
