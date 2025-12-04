import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

// ============================================================================
// TYPES
// ============================================================================

export interface RendererConfig {
  antialias?: boolean;
  alpha?: boolean;
  preserveDrawingBuffer?: boolean;
  powerPreference?: "default" | "high-performance" | "low-power";
  pixelRatioLimit?: number;
  toneMapping?: THREE.ToneMapping;
  toneMappingExposure?: number;
}

export interface CameraConfig {
  fov?: number;
  near?: number;
  far?: number;
  position?: THREE.Vector3Tuple;
}

export interface ControlsConfig {
  enableDamping?: boolean;
  dampingFactor?: number;
  rotateSpeed?: number;
  panSpeed?: number;
  minDistance?: number;
  maxDistance?: number;
  target?: THREE.Vector3Tuple;
}

export interface LightingParams {
  hemiIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  keyIntensity: number;
  keyColor: number;
  fillIntensity: number;
  ambientIntensity: number;
}

export interface ThreeSetupResult {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  envMap: THREE.Texture;
  lights: {
    ambient: THREE.AmbientLight;
    hemisphere: THREE.HemisphereLight;
    key: THREE.DirectionalLight;
    fill: THREE.DirectionalLight;
  };
  lightingParams: LightingParams;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

export const DEFAULT_RENDERER_CONFIG: RendererConfig = {
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
  powerPreference: "high-performance",
  pixelRatioLimit: 1.5,
  toneMapping: THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.2,
};

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  fov: 45,
  near: 0.1,
  far: 1000,
  position: [0.7, 0.2, 1.75],
};

export const DEFAULT_CONTROLS_CONFIG: ControlsConfig = {
  enableDamping: true,
  dampingFactor: 0.08,
  rotateSpeed: 0.5,
  panSpeed: 0.5,
  minDistance: 0.5,
  maxDistance: 8,
  target: [0, 0, 0],
};

export const DEFAULT_LIGHTING_PARAMS: LightingParams = {
  hemiIntensity: 0.6,
  hemiSkyColor: 0xffffff,
  hemiGroundColor: 0x888888,
  keyIntensity: 1.2,
  keyColor: 0xffffff,
  fillIntensity: 0.8,
  ambientIntensity: 0.4,
};

// ============================================================================
// RENDERER SETUP
// ============================================================================

export function createRenderer(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  config: RendererConfig = DEFAULT_RENDERER_CONFIG
): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: config.antialias,
    alpha: config.alpha,
    preserveDrawingBuffer: config.preserveDrawingBuffer,
    powerPreference: config.powerPreference,
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, config.pixelRatioLimit ?? 1.5)
  );
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  if (config.toneMapping) {
    renderer.toneMapping = config.toneMapping;
  }
  if (config.toneMappingExposure !== undefined) {
    renderer.toneMappingExposure = config.toneMappingExposure;
  }

  return renderer;
}

// ============================================================================
// SCENE & ENVIRONMENT SETUP
// ============================================================================

export function createScene(): THREE.Scene {
  return new THREE.Scene();
}

/**
 * Creates a dot grid texture that matches CSS pattern
 * Renders dots at the correct pixel density for the screen, centered
 */
function createDotGridTexture(
  width: number,
  height: number
): THREE.CanvasTexture {
  const dotSpacing = 24; // CSS backgroundSize: 24px 24px
  const dotRadius = 1.5; // CSS: 1.5px
  const bgColor = "#18181b";
  const dotColor = "#52525b";

  // Create canvas at screen resolution
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Fill background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // Calculate centered grid
  // Number of dots that fit in each dimension
  const cols = Math.ceil(width / dotSpacing) + 1;
  const rows = Math.ceil(height / dotSpacing) + 1;

  // Center the grid by calculating offset
  const totalGridWidth = (cols - 1) * dotSpacing;
  const totalGridHeight = (rows - 1) * dotSpacing;
  const offsetX = (width - totalGridWidth) / 2;
  const offsetY = (height - totalGridHeight) / 2;

  // Draw centered dots
  ctx.fillStyle = dotColor;
  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      const x = offsetX + col * dotSpacing;
      const y = offsetY + row * dotSpacing;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Don't repeat - texture is full screen size
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  return texture;
}

export function createEnvironmentMap(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): THREE.Texture {
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // Create a simple gradient environment for reflections
  const envScene = new THREE.Scene();
  const envGeo = new THREE.SphereGeometry(50, 32, 32);
  const envMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0.9, 0.95, 1.0) },
      bottomColor: { value: new THREE.Color(0.15, 0.15, 0.2) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition).y * 0.5 + 0.5;
        gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
      }
    `,
  });

  envScene.add(new THREE.Mesh(envGeo, envMat));
  const envMap = pmremGenerator.fromScene(envScene, 0.04).texture;
  scene.environment = envMap;

  // Create dot grid background at renderer size for glass transmission
  const size = renderer.getSize(new THREE.Vector2());
  scene.background = createDotGridTexture(size.x, size.y);

  pmremGenerator.dispose();

  return envMap;
}

// ============================================================================
// CAMERA SETUP
// ============================================================================

export function createCamera(
  container: HTMLElement,
  config: CameraConfig = DEFAULT_CAMERA_CONFIG
): THREE.PerspectiveCamera {
  const aspect = container.clientWidth / container.clientHeight;
  const camera = new THREE.PerspectiveCamera(
    config.fov ?? 45,
    aspect,
    config.near ?? 0.1,
    config.far ?? 1000
  );

  if (config.position) {
    camera.position.set(...config.position);
  }

  return camera;
}

// ============================================================================
// CONTROLS SETUP
// ============================================================================

export function createControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  config: ControlsConfig = DEFAULT_CONTROLS_CONFIG
): OrbitControls {
  const controls = new OrbitControls(camera, domElement);

  controls.enableDamping = config.enableDamping ?? true;
  controls.dampingFactor = config.dampingFactor ?? 0.08;
  controls.rotateSpeed = config.rotateSpeed ?? 0.5;
  controls.panSpeed = config.panSpeed ?? 0.5;
  controls.minDistance = config.minDistance ?? 0.5;
  controls.maxDistance = config.maxDistance ?? 8;

  if (config.target) {
    controls.target.set(...config.target);
  }

  // Configure mouse buttons
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: null as any,
  };

  // Default to rotate mode
  controls.enablePan = false;
  controls.enableRotate = true;

  return controls;
}

// ============================================================================
// LIGHTING SETUP
// ============================================================================

export interface LightingSetup {
  ambient: THREE.AmbientLight;
  hemisphere: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
}

export function createLighting(
  scene: THREE.Scene,
  params: LightingParams = DEFAULT_LIGHTING_PARAMS
): LightingSetup {
  // Ambient light
  const ambient = new THREE.AmbientLight(
    0xffffff,
    params.ambientIntensity * 1.2
  );
  scene.add(ambient);

  // Hemisphere light
  const hemisphere = new THREE.HemisphereLight(
    params.hemiSkyColor,
    params.hemiGroundColor,
    params.hemiIntensity * 1.3
  );
  hemisphere.position.set(0, 20, 0);
  scene.add(hemisphere);

  // Key light
  const key = new THREE.DirectionalLight(params.keyColor, params.keyIntensity);
  key.position.set(2, 8, 6);
  scene.add(key);

  // Fill light
  const fill = new THREE.DirectionalLight(0xffffff, params.fillIntensity * 1.5);
  fill.position.set(-3, 4, 3);
  scene.add(fill);

  return { ambient, hemisphere, key, fill };
}

// ============================================================================
// COMPLETE SETUP FUNCTION
// ============================================================================

export function setupThreeScene(
  canvas: HTMLCanvasElement,
  container: HTMLElement,
  options?: {
    renderer?: RendererConfig;
    camera?: CameraConfig;
    controls?: ControlsConfig;
    lighting?: LightingParams;
  }
): ThreeSetupResult {
  const renderer = createRenderer(canvas, container, options?.renderer);
  const scene = createScene();
  const envMap = createEnvironmentMap(renderer, scene);
  const camera = createCamera(container, options?.camera);
  const controls = createControls(
    camera,
    renderer.domElement,
    options?.controls
  );
  const lightingParams = { ...DEFAULT_LIGHTING_PARAMS, ...options?.lighting };
  const lights = createLighting(scene, lightingParams);

  return {
    renderer,
    scene,
    camera,
    controls,
    envMap,
    lights,
    lightingParams,
  };
}

// ============================================================================
// RESIZE HANDLER
// ============================================================================

export function createResizeHandler(
  container: HTMLElement,
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
): () => void {
  return () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

export function disposeThreeScene(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  controls: OrbitControls
): void {
  // Dispose controls
  controls.dispose();

  // Dispose scene objects
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((mat) => mat.dispose());
      } else {
        object.material?.dispose();
      }
    }
  });

  // Dispose renderer
  renderer.dispose();
}
