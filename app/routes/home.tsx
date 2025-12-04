/**
 * 3D Mesh Painter - Deathpaint-style UV Painting Application
 *
 * This component implements a full 3D mesh painting experience using:
 * - React Router 7 framework mode
 * - three.js for WebGL rendering
 * - UV-based painting via CanvasTexture
 * - Tailwind CSS for styling
 *
 * The painting works by:
 * 1. Creating an offscreen 2D canvas that serves as the texture
 * 2. Raycasting mouse positions to find UV coordinates on the mesh
 * 3. Drawing brush strokes on the 2D canvas at those UV positions
 * 4. Updating the CanvasTexture to reflect changes on the 3D model
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Route } from "./+types/home";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import GUI from "lil-gui";

// Three.js setup utilities
import { loadModel, animateModelFadeIn } from "~/three-utils";

// Shaders
import {
  shaders,
  getShaderById,
  DEFAULT_SHADER_ID,
  type ShaderConfig,
} from "~/shaders";

// Constants & Types
import {
  PAINT_CANVAS_SIZE,
  AVAILABLE_MODELS,
  BASE_COLOR,
  getBaseColorForShader,
  CursorMode,
  HOTKEYS,
} from "~/constants";
import type {
  BrushState,
  AnimationState,
  ModelOption,
} from "~/constants/types";

// Components
import { BottomToolbar, useBrush } from "~/components/BottomToolbar";
import { TopRightToolbar } from "~/components/TopRightToolbar";
import { ShareModal } from "~/components/ShareModal";

// Hooks
import { useKeyboardShortcuts, usePaintPersistence } from "~/hooks";

// ============================================================================
// META FUNCTION
// ============================================================================

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sofubi Space" },
    {
      name: "description",
      content: "Paint directly on 3D models in your browser",
    },
  ];
}

// Components (ModelSelection, ShareModal, BottomToolbar) imported from ~/components

// ============================================================================
// MAIN HOME COMPONENT
// ============================================================================

export default function Home() {
  // Refs for three.js objects
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const modelObjRef = useRef<THREE.Object3D | null>(null); // Reference to loaded model for translation

  // Paint system refs
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const brushCursorRef = useRef<THREE.Mesh | null>(null);

  // Painting state (using refs for performance in event handlers)
  const isPaintingRef = useRef<boolean>(false);
  const isDraggingModelRef = useRef<boolean>(false); // For move mode dragging
  const dragStartMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const dragStartModelPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const thicknessMapRef = useRef<Float32Array | null>(null);

  // Undo/Redo system refs
  const undoHistoryRef = useRef<
    { imageData: ImageData; thicknessMap: Float32Array }[]
  >([]);
  const redoHistoryRef = useRef<
    { imageData: ImageData; thicknessMap: Float32Array }[]
  >([]);
  const MAX_UNDO_STEPS = 20;

  // Use brush hook for all brush-related state and handlers
  const {
    brush,
    colorHistory,
    brushRef,
    handleBrushChange,
    handleColorSelect,
    handleColorCommit,
  } = useBrush();

  // Shader system refs
  const currentShaderIdRef = useRef<string>(DEFAULT_SHADER_ID);

  // Paint persistence hook - auto-saves to localStorage
  const { saveState: savePaintState, restoreToCanvas } = usePaintPersistence(
    paintCtxRef,
    paintTextureRef,
    thicknessMapRef,
    currentShaderIdRef,
    {
      autoSaveInterval: 30000, // Auto-save every 30 seconds
    }
  );

  const shaderConfigRef = useRef<ShaderConfig | null>(null);
  const shaderGuiControllerRef = useRef<GUI | null>(null);
  const paintableMeshesRef = useRef<THREE.Mesh[]>([]);
  const originalMaterialPropsRef = useRef<
    Map<
      THREE.Mesh,
      {
        normalMap: THREE.Texture | null;
        roughnessMap: THREE.Texture | null;
        metalnessMap: THREE.Texture | null;
        aoMap: THREE.Texture | null;
        emissiveMap: THREE.Texture | null;
        bumpMap: THREE.Texture | null;
      }
    >
  >(new Map());

  // React state for UI
  const [selectedModel, setSelectedModel] = useState<ModelOption>(
    AVAILABLE_MODELS[0]
  ); // Default to Godzilla
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [animation, setAnimation] = useState<AnimationState>({
    spin: false,
    spinSpeed: 0.5,
  });
  const [currentShader, setCurrentShader] = useState<string>(DEFAULT_SHADER_ID);
  const [cursorMode, setCursorMode] = useState<CursorMode>(CursorMode.Rotate);
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const isOverModelRef = useRef<boolean>(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for cursor mode to use in event handlers
  const cursorModeRef = useRef<CursorMode>(CursorMode.Rotate);

  // Sync cursor mode with ref
  useEffect(() => {
    cursorModeRef.current = cursorMode;
    // Update controls based on mode
    const controls = controlsRef.current;
    if (controls) {
      if (cursorMode === CursorMode.Move) {
        controls.enablePan = true;
        controls.enableRotate = false;
      } else {
        controls.enablePan = false;
        controls.enableRotate = true;
      }
    }
  }, [cursorMode]);

  // ============================================================================
  // HUD AUTO-HIDE ON INACTIVITY
  // ============================================================================

  useEffect(() => {
    let isHudVisible = true;

    const resetHudTimer = () => {
      // Only trigger re-render if HUD was hidden
      if (!isHudVisible) {
        isHudVisible = true;
        setHudVisible(true);
      }

      // Clear existing timeout
      if (hudTimeoutRef.current) {
        clearTimeout(hudTimeoutRef.current);
      }

      // Set new timeout to hide HUD after 8 seconds
      hudTimeoutRef.current = setTimeout(() => {
        isHudVisible = false;
        setHudVisible(false);
      }, 8000);
    };

    // Listen for mouse movement
    window.addEventListener("mousemove", resetHudTimer);

    // Initial timer
    resetHudTimer();

    return () => {
      window.removeEventListener("mousemove", resetHudTimer);
      if (hudTimeoutRef.current) {
        clearTimeout(hudTimeoutRef.current);
      }
    };
  }, []);

  // Ref for applying shader from outside useEffect
  const applyShaderRef = useRef<((shaderId: string) => void) | null>(null);

  // Animation ref for syncing with three.js loop
  const animationRef = useRef<AnimationState>({ spin: false, spinSpeed: 0.5 });

  // Sync animation state with ref
  useEffect(() => {
    animationRef.current = animation;
  }, [animation]);

  // ============================================================================
  // THREE.JS SETUP & CLEANUP
  // ============================================================================

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // -------------------------------------------------------------------------
    // Initialize Renderer
    // -------------------------------------------------------------------------
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true, // Required for screenshot capture
      powerPreference: "high-performance", // Request high-perf GPU
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Lower pixel ratio for perf
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent to show dot grid
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    rendererRef.current = renderer;

    // -------------------------------------------------------------------------
    // Initialize Scene
    // -------------------------------------------------------------------------
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // -------------------------------------------------------------------------
    // Environment Map for Glass/Reflective Materials
    // -------------------------------------------------------------------------
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
    pmremGenerator.dispose();

    // -------------------------------------------------------------------------
    // Initialize Camera
    // -------------------------------------------------------------------------
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0.7, 0.2, 1.75); // Closer to model
    cameraRef.current = camera;

    // -------------------------------------------------------------------------
    // Initialize OrbitControls
    // -------------------------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08; // Higher = smoother ease-out (was 0.05)
    controls.rotateSpeed = 0.5; // Lower sensitivity for rotation (default is 1.0)
    controls.panSpeed = 0.5; // Lower sensitivity for panning (default is 1.0)
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    // Configure controls: LEFT mouse button for orbit/pan (when not on model), middle for zoom
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE, // Will be changed to PAN when in move mode
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: null as any, // Disable right click
    };

    // Default to rotate mode (pan disabled)
    controls.enablePan = false;
    controls.enableRotate = true;

    controlsRef.current = controls;

    // -------------------------------------------------------------------------
    // Initialize Lighting (Showcase/Display Case setup)
    // Soft, even lighting from multiple angles like a museum display
    // -------------------------------------------------------------------------

    // Lighting parameters (will be controlled by lil-gui)
    const lightingParams = {
      hemiIntensity: 0.6,
      hemiSkyColor: 0xffffff,
      hemiGroundColor: 0x888888, // Brighter ground bounce
      keyIntensity: 1.2,
      keyColor: 0xffffff,
      fillIntensity: 0.8, // Stronger fill for even lighting
      ambientIntensity: 0.4, // Higher ambient for showcase look
    };

    // -------------------------------------------------------------------------
    // Optimized Lighting Setup (reduced from 7 lights to 4 for transmission perf)
    // -------------------------------------------------------------------------

    // Ambient light - higher intensity to compensate for fewer lights
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      lightingParams.ambientIntensity * 1.2 // Boost to compensate
    );
    scene.add(ambientLight);

    // Hemisphere light - combines sky/ground lighting in one efficient light
    const hemiLight = new THREE.HemisphereLight(
      lightingParams.hemiSkyColor,
      lightingParams.hemiGroundColor,
      lightingParams.hemiIntensity * 1.3 // Boost to replace fill lights
    );
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Key light - main directional light (front-overhead)
    const keyLight = new THREE.DirectionalLight(
      lightingParams.keyColor,
      lightingParams.keyIntensity
    );
    keyLight.position.set(2, 8, 6); // Angled position for good coverage
    scene.add(keyLight);

    // Single fill light - positioned to cover both sides
    const fillLight = new THREE.DirectionalLight(
      0xffffff,
      lightingParams.fillIntensity * 1.5 // Higher intensity to cover more area
    );
    fillLight.position.set(-3, 4, 3);
    scene.add(fillLight);

    // -------------------------------------------------------------------------
    // Animation State (for model spin) - uses React ref for syncing
    // -------------------------------------------------------------------------
    // modelObjRef is defined at component level for access in event handlers

    // -------------------------------------------------------------------------
    // Initialize lil-gui for debug controls (development only)
    // -------------------------------------------------------------------------
    const isDev = import.meta.env.DEV;
    const gui = isDev ? new GUI({ title: "🎨 Debug Settings" }) : null;
    if (gui) {
      gui.domElement.style.position = "absolute";
      gui.domElement.style.top = "10px";
      gui.domElement.style.left = "10px"; // Moved to left side since panel slides

      // Animation folder (at the top for easy access) - syncs with React state
      const animationFolder = gui.addFolder("Animation");
      const guiAnimState = { spin: false, spinSpeed: 0.5 };
      animationFolder
        .add(guiAnimState, "spin")
        .name("🔄 Spin Model")
        .onChange((v: boolean) => {
          setAnimation((prev) => ({ ...prev, spin: v }));
        });
      animationFolder
        .add(guiAnimState, "spinSpeed", 0.1, 3, 0.1)
        .name("Spin Speed")
        .onChange((v: number) => {
          setAnimation((prev) => ({ ...prev, spinSpeed: v }));
        });
      animationFolder.open();

      // Lighting folder
      const lightingFolder = gui.addFolder("Lighting");
      lightingFolder
        .add(lightingParams, "ambientIntensity", 0, 1, 0.01)
        .name("Ambient")
        .onChange((v: number) => {
          ambientLight.intensity = v;
        });
      lightingFolder
        .add(lightingParams, "hemiIntensity", 0, 2, 0.01)
        .name("Hemisphere")
        .onChange((v: number) => {
          hemiLight.intensity = v;
        });
      lightingFolder
        .add(lightingParams, "keyIntensity", 0, 3, 0.01)
        .name("Key Light")
        .onChange((v: number) => {
          keyLight.intensity = v;
        });
      lightingFolder
        .add(lightingParams, "fillIntensity", 0, 2, 0.01)
        .name("Fill Light")
        .onChange((v: number) => {
          fillLight.intensity = v;
        });
      lightingFolder.open();
    }

    // -------------------------------------------------------------------------
    // Shader System Setup
    // -------------------------------------------------------------------------

    // Build shader options object for dropdown
    const shaderOptions: Record<string, string> = {};
    shaders.forEach((s) => {
      shaderOptions[s.name] = s.id;
    });

    // Current shader params storage
    const shaderParams: Record<string, any> = { shader: DEFAULT_SHADER_ID };

    // Shader folder (dev only)
    const shaderFolder = gui?.addFolder("Shader") ?? null;

    // Function to apply shader to all meshes
    const applyShader = (shaderId: string) => {
      const shader = getShaderById(shaderId);
      if (!shader) return;

      const paintTexture = paintTextureRef.current;
      if (!paintTexture) return;

      const meshes = paintableMeshesRef.current;
      if (meshes.length === 0) return;

      // Dispose old shader GUI controllers (except the shader dropdown)
      if (shaderGuiControllerRef.current) {
        // Remove all controllers except the first one (shader dropdown)
        const controllers = [...shaderGuiControllerRef.current.controllers];
        controllers.slice(1).forEach((c) => c.destroy());
        shaderGuiControllerRef.current.folders.forEach((f) => f.destroy());
      }

      // Update current shader ref
      currentShaderIdRef.current = shaderId;

      // Create shader config
      const firstMeshProps = originalMaterialPropsRef.current.get(meshes[0]);
      const config: ShaderConfig = {
        paintTexture,
        normalMap: firstMeshProps?.normalMap || null,
        roughnessMap: firstMeshProps?.roughnessMap || null,
        metalnessMap: firstMeshProps?.metalnessMap || null,
        aoMap: firstMeshProps?.aoMap || null,
        emissiveMap: firstMeshProps?.emissiveMap || null,
        bumpMap: firstMeshProps?.bumpMap || null,
        envMap: null,
      };
      shaderConfigRef.current = config;

      // Create new material from shader
      meshes.forEach((mesh) => {
        // Dispose old material
        const oldMat = mesh.material as THREE.Material;
        if (oldMat && typeof (oldMat as any).dispose === "function") {
          const currentShader = getShaderById(currentShaderIdRef.current);
          if (currentShader?.dispose) {
            currentShader.dispose(oldMat);
          } else {
            oldMat.dispose();
          }
        }

        // Get mesh-specific config
        const meshProps = originalMaterialPropsRef.current.get(mesh);
        const meshConfig: ShaderConfig = {
          paintTexture,
          normalMap: meshProps?.normalMap || null,
          roughnessMap: meshProps?.roughnessMap || null,
          metalnessMap: meshProps?.metalnessMap || null,
          aoMap: meshProps?.aoMap || null,
          emissiveMap: meshProps?.emissiveMap || null,
          bumpMap: meshProps?.bumpMap || null,
          envMap: null,
        };

        // Create and apply new material
        const newMat = shader.createMaterial(meshConfig);
        newMat.transparent = true;
        mesh.material = newMat;
      });

      // Build GUI params from shader definition
      const guiParamValues: Record<string, any> = {};
      shader.guiParams.forEach((param) => {
        guiParamValues[param.name] = param.default;
      });

      // Add shader-specific GUI controls
      if (shaderGuiControllerRef.current) {
        shader.guiParams.forEach((param) => {
          if (param.type === "number") {
            shaderGuiControllerRef
              .current!.add(
                guiParamValues,
                param.name,
                param.min,
                param.max,
                param.step
              )
              .name(
                param.name
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())
              )
              .onChange((v: number) => {
                guiParamValues[param.name] = v;
                meshes.forEach((mesh) => {
                  shader.updateUniforms?.(
                    mesh.material as THREE.Material,
                    guiParamValues
                  );
                });
              });
          } else if (param.type === "color") {
            shaderGuiControllerRef
              .current!.addColor(guiParamValues, param.name)
              .name(
                param.name
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())
              )
              .onChange((v: string) => {
                guiParamValues[param.name] = v;
                meshes.forEach((mesh) => {
                  shader.updateUniforms?.(
                    mesh.material as THREE.Material,
                    guiParamValues
                  );
                });
              });
          } else if (param.type === "boolean") {
            shaderGuiControllerRef
              .current!.add(guiParamValues, param.name)
              .name(
                param.name
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (s) => s.toUpperCase())
              )
              .onChange((v: boolean) => {
                guiParamValues[param.name] = v;
                meshes.forEach((mesh) => {
                  shader.updateUniforms?.(
                    mesh.material as THREE.Material,
                    guiParamValues
                  );
                });
              });
          }
        });
      }

      console.log(`Applied shader: ${shader.name}`);
    };

    // Expose applyShader to ref for use outside useEffect
    applyShaderRef.current = applyShader;

    // Add shader dropdown (dev only)
    if (shaderFolder) {
      shaderFolder
        .add(shaderParams, "shader", shaderOptions)
        .name("Shader")
        .onChange((shaderId: string) => {
          applyShader(shaderId);
        });

      shaderGuiControllerRef.current = shaderFolder;
      shaderFolder.open();
    }

    // Material folder (will be populated after model loads) - kept for legacy compatibility (dev only)
    const materialFolder = gui?.addFolder("Material (Legacy)") ?? null;
    const materialParams = {
      roughness: 0.7,
      metalness: 0.0,
      normalScale: 1.0,
      envMapIntensity: 0.5,
    };

    // Store material ref for updates
    let currentMaterial: THREE.MeshStandardMaterial | null = null;

    // -------------------------------------------------------------------------
    // Create Brush Cursor (filled circle that shows brush color preview)
    // -------------------------------------------------------------------------
    // Use CircleGeometry for a filled circle that shows brush color
    const cursorGeometry = new THREE.CircleGeometry(0.05, 32);
    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(brushRef.current.color),
      transparent: true,
      opacity: 0.5, // Semi-transparent to preview color
      side: THREE.DoubleSide, // Visible from both sides
      depthTest: false, // Always render on top
      depthWrite: false,
    });
    const brushCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
    brushCursor.visible = false; // Hidden until mouse is over model
    brushCursor.renderOrder = 999; // Render last (on top)
    scene.add(brushCursor);
    brushCursorRef.current = brushCursor;

    // Also create an outline ring for better visibility
    const outlineGeometry = new THREE.RingGeometry(0.048, 0.052, 32);
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    const cursorOutline = new THREE.Mesh(outlineGeometry, outlineMaterial);
    cursorOutline.renderOrder = 1000; // Render after fill
    brushCursor.add(cursorOutline); // Add as child so it moves with cursor

    // Smooth cursor position tracking
    const cursorTargetPos = new THREE.Vector3();
    const cursorCurrentPos = new THREE.Vector3();
    const cursorLerpSpeed = 0.35; // How fast cursor catches up (0-1, higher = faster)
    let cursorInitialized = false;

    // Track last paint UV for continuous airbrush spraying
    let lastPaintUV: THREE.Vector2 | null = null;

    // Function to update brush cursor size and color
    const updateBrushCursor = (radius: number, color: string) => {
      // Scale based on brush radius (convert from UV pixels to world units)
      // The model is scaled to ~1.5 units, UV spans the texture
      // Adjust multiplier to match actual painted area
      const worldRadius = (radius / PAINT_CANVAS_SIZE) * 1.2; // Smaller to match paint
      brushCursor.scale.setScalar(worldRadius / 0.05); // 0.05 is base circle radius

      // Update fill color
      (brushCursor.material as THREE.MeshBasicMaterial).color.set(color);

      // Update outline to contrast with fill color
      // Use white outline for dark colors, dark outline for light colors
      const brushColor = new THREE.Color(color);
      const luminance =
        0.299 * brushColor.r + 0.587 * brushColor.g + 0.114 * brushColor.b;
      const outlineColor = luminance > 0.5 ? 0x333333 : 0xffffff;
      (cursorOutline.material as THREE.MeshBasicMaterial).color.setHex(
        outlineColor
      );
    };

    // Function to make cursor face the camera (billboard)
    const updateCursorBillboard = () => {
      const cursor = brushCursorRef.current;
      const cam = cameraRef.current;
      if (cursor && cam && cursor.visible) {
        // Make the cursor face the camera
        cursor.quaternion.copy(cam.quaternion);
      }
    };

    // Smooth cursor position update (called in animation loop)
    const updateCursorSmooth = () => {
      const cursor = brushCursorRef.current;
      if (cursor && cursor.visible && cursorInitialized) {
        // Lerp current position toward target
        cursorCurrentPos.lerp(cursorTargetPos, cursorLerpSpeed);
        cursor.position.copy(cursorCurrentPos);
        updateCursorBillboard();
      }
    };

    // -------------------------------------------------------------------------
    // Create Paint Canvas and Texture
    // -------------------------------------------------------------------------
    const paintCanvas = document.createElement("canvas");
    paintCanvas.width = PAINT_CANVAS_SIZE;
    paintCanvas.height = PAINT_CANVAS_SIZE;
    paintCanvasRef.current = paintCanvas;

    const paintCtx = paintCanvas.getContext("2d");
    if (paintCtx) {
      // Fill with base color (fully opaque for visibility)
      paintCtx.fillStyle = BASE_COLOR;
      paintCtx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
      paintCtxRef.current = paintCtx;
    }

    // Separate array to track paint thickness (not using texture alpha)
    // This allows underpainting effect without making the texture transparent
    const thicknessMap = new Float32Array(
      PAINT_CANVAS_SIZE * PAINT_CANVAS_SIZE
    );
    thicknessMap.fill(0); // Start with no paint
    thicknessMapRef.current = thicknessMap;

    // Create texture from canvas
    const paintTexture = new THREE.CanvasTexture(paintCanvas);
    paintTexture.colorSpace = THREE.SRGBColorSpace;
    // Set wrapping mode to repeat - this handles UVs outside 0-1 range
    paintTexture.wrapS = THREE.RepeatWrapping;
    paintTexture.wrapT = THREE.RepeatWrapping;
    paintTexture.needsUpdate = true;
    paintTextureRef.current = paintTexture;

    // -------------------------------------------------------------------------
    // Load 3D Model
    // -------------------------------------------------------------------------
    loadModel(selectedModel.path, scene, paintTexture, {
      onProgress: (percent) => {
        console.log(`Loading model: ${percent.toFixed(1)}%`);
      },
      onComplete: ({ model, paintableMeshes, materialPropsMap, scale }) => {
        // Store original material properties for shader system
        materialPropsMap.forEach((props, mesh) => {
          originalMaterialPropsRef.current.set(mesh, props);
        });

        // Store paintable meshes ref for shader system
        paintableMeshesRef.current = paintableMeshes;

        // Apply default shader using the shader system
        const defaultShader = getShaderById(DEFAULT_SHADER_ID);
        if (defaultShader) {
          paintableMeshes.forEach((mesh) => {
            const meshProps = originalMaterialPropsRef.current.get(mesh);
            const config: ShaderConfig = {
              paintTexture,
              normalMap: meshProps?.normalMap || null,
              roughnessMap: meshProps?.roughnessMap || null,
              metalnessMap: meshProps?.metalnessMap || null,
              aoMap: meshProps?.aoMap || null,
              emissiveMap: meshProps?.emissiveMap || null,
              bumpMap: meshProps?.bumpMap || null,
              envMap: null,
            };

            const newMat = defaultShader.createMaterial(config);
            newMat.transparent = true;
            mesh.material = newMat;
          });

          // Initialize shader config ref
          if (paintableMeshes.length > 0) {
            const firstMeshProps = originalMaterialPropsRef.current.get(
              paintableMeshes[0]
            );
            shaderConfigRef.current = {
              paintTexture,
              normalMap: firstMeshProps?.normalMap || null,
              roughnessMap: firstMeshProps?.roughnessMap || null,
              metalnessMap: firstMeshProps?.metalnessMap || null,
              aoMap: firstMeshProps?.aoMap || null,
              emissiveMap: firstMeshProps?.emissiveMap || null,
              bumpMap: firstMeshProps?.bumpMap || null,
              envMap: null,
            };
          }

          // Add default shader GUI params
          if (
            shaderGuiControllerRef.current &&
            defaultShader.guiParams.length > 0
          ) {
            const guiParamValues: Record<string, any> = {};
            defaultShader.guiParams.forEach((param) => {
              guiParamValues[param.name] = param.default;
            });

            defaultShader.guiParams.forEach((param) => {
              if (param.type === "number") {
                shaderGuiControllerRef
                  .current!.add(
                    guiParamValues,
                    param.name,
                    param.min,
                    param.max,
                    param.step
                  )
                  .name(
                    param.name
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())
                  )
                  .onChange((v: number) => {
                    guiParamValues[param.name] = v;
                    paintableMeshes.forEach((mesh) => {
                      defaultShader.updateUniforms?.(
                        mesh.material as THREE.Material,
                        guiParamValues
                      );
                    });
                  });
              } else if (param.type === "color") {
                shaderGuiControllerRef
                  .current!.addColor(guiParamValues, param.name)
                  .name(
                    param.name
                      .replace(/([A-Z])/g, " $1")
                      .replace(/^./, (s) => s.toUpperCase())
                  )
                  .onChange((v: string) => {
                    guiParamValues[param.name] = v;
                    paintableMeshes.forEach((mesh) => {
                      defaultShader.updateUniforms?.(
                        mesh.material as THREE.Material,
                        guiParamValues
                      );
                    });
                  });
              }
            });
          }
        }

        // Setup legacy material GUI controls (only works with standard shader)
        if (materialFolder) {
          materialFolder
            .add(materialParams, "roughness", 0, 1, 0.01)
            .name("Roughness")
            .onChange((v: number) => {
              if (currentShaderIdRef.current !== "ceramic-glaze") return;
              paintableMeshes.forEach((mesh) => {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.roughness !== undefined) mat.roughness = v;
              });
            });
          materialFolder
            .add(materialParams, "metalness", 0, 1, 0.01)
            .name("Metalness")
            .onChange((v: number) => {
              if (currentShaderIdRef.current !== "standard-pbr") return;
              paintableMeshes.forEach((mesh) => {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.metalness !== undefined) mat.metalness = v;
              });
            });
          materialFolder
            .add(materialParams, "normalScale", 0, 3, 0.01)
            .name("Normal Strength")
            .onChange((v: number) => {
              if (currentShaderIdRef.current !== "standard-pbr") return;
              paintableMeshes.forEach((mesh) => {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.normalScale) mat.normalScale.set(v, v);
              });
            });
          materialFolder
            .add(materialParams, "envMapIntensity", 0, 2, 0.01)
            .name("Env Reflection")
            .onChange((v: number) => {
              if (currentShaderIdRef.current !== "standard-pbr") return;
              paintableMeshes.forEach((mesh) => {
                const mat = mesh.material as THREE.MeshStandardMaterial;
                if (mat.envMapIntensity !== undefined) mat.envMapIntensity = v;
              });
            });
          materialFolder.close(); // Close by default, shader folder is primary
        }

        // Store the first mesh for raycasting (or we could store all)
        if (paintableMeshes.length > 0) {
          meshRef.current = paintableMeshes[0];
        }

        // Store model reference for raycasting against all meshes
        (model as any).__paintableMeshes = paintableMeshes;

        // Store model reference for animation
        modelObjRef.current = model;

        // Animate model fade-in
        animateModelFadeIn(model, paintableMeshes, scale, () => {
          // Optional: disable transparency after fade completes
        });

        // Try to restore saved paint state from localStorage
        const ctx = paintCtxRef.current;
        const texture = paintTextureRef.current;
        const thicknessMap = thicknessMapRef.current;
        if (ctx && texture && thicknessMap) {
          restoreToCanvas(ctx, texture, thicknessMap).then(
            (restored: boolean) => {
              if (restored) {
                console.log(
                  "Restored previous paint session from localStorage"
                );
              }
            }
          );
        }

        setIsLoading(false);

        // Update controls target to model center
        controls.target.set(0, 0, 0);
        controls.update();

        console.log(
          `Loaded model with ${paintableMeshes.length} paintable meshes`
        );
      },
      onError: (error) => {
        console.error("Error loading model:", error);
        setIsLoading(false);
      },
    });

    // -------------------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------------------
    const animate = () => {
      controls.update();
      updateCursorSmooth(); // Smooth cursor interpolation

      // Spin model if enabled (uses React ref for state)
      if (animationRef.current.spin && modelObjRef.current) {
        modelObjRef.current.rotation.y += 0.01 * animationRef.current.spinSpeed;
      }

      // Continuous airbrush spraying while holding mouse button
      if (
        isPaintingRef.current &&
        lastPaintUV &&
        brushRef.current.type === "airbrush"
      ) {
        paintAtUV(lastPaintUV);
      }

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    // -------------------------------------------------------------------------
    // Handle Window Resize
    // -------------------------------------------------------------------------
    const handleResize = () => {
      if (!container) return;

      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener("resize", handleResize);

    // -------------------------------------------------------------------------
    // Painting Event Handlers
    // -------------------------------------------------------------------------

    /**
     * Paint at the given UV coordinates on the paint canvas.
     * OPTIMIZED VERSION with cached values and squared distance checks.
     *
     * UNDERPAINTING EFFECT:
     * Simulates real paint behavior where underlying layers show through.
     */

    // Cache for brush color parsing (avoid re-parsing same color)
    let cachedColorHex = "";
    let cachedColorRgb = { r: 0, g: 0, b: 0 };

    const paintAtUV = (uv: THREE.Vector2) => {
      const ctx = paintCtxRef.current;
      const texture = paintTextureRef.current;
      const thicknessMap = thicknessMapRef.current;
      if (!ctx || !texture || !thicknessMap) return;

      // Wrap UV coordinates to 0-1 range using modulo
      let u = uv.x % 1;
      let v = uv.y % 1;
      if (u < 0) u += 1;
      if (v < 0) v += 1;

      // Convert UV coordinates (0-1) to pixel coordinates
      const px = u * PAINT_CANVAS_SIZE;
      const py = (1 - v) * PAINT_CANVAS_SIZE;

      const brush = brushRef.current;
      const radius = brush.radius;
      const radiusSq = radius * radius; // Use squared for faster comparison

      // Parse brush color (cached)
      if (brush.color !== cachedColorHex) {
        cachedColorHex = brush.color;
        cachedColorRgb = {
          r: parseInt(brush.color.slice(1, 3), 16),
          g: parseInt(brush.color.slice(3, 5), 16),
          b: parseInt(brush.color.slice(5, 7), 16),
        };
      }
      const brushR = cachedColorRgb.r;
      const brushG = cachedColorRgb.g;
      const brushB = cachedColorRgb.b;

      // Get the area we'll be painting on
      const x = Math.floor(px - radius);
      const y = Math.floor(py - radius);
      const size = Math.ceil(radius * 2);

      // Clamp to canvas bounds
      const sx = Math.max(0, x);
      const sy = Math.max(0, y);
      const ex = Math.min(PAINT_CANVAS_SIZE, x + size);
      const ey = Math.min(PAINT_CANVAS_SIZE, y + size);
      const width = ex - sx;
      const height = ey - sy;

      if (width <= 0 || height <= 0) return;

      // Read existing pixels from the canvas
      const imageData = ctx.getImageData(sx, sy, width, height);
      const pixels = imageData.data;

      // Underpainting parameters
      const UNDERCOAT_STRENGTH = 0.4;
      const MAX_COVERAGE = 0.85;
      const brushOpacity = brush.opacity * MAX_COVERAGE;

      // Blend new color with existing pixels within the brush circle
      for (let dy = 0; dy < height; dy++) {
        const worldY = sy + dy;
        const distY = worldY - py;
        const distYSq = distY * distY;
        const rowOffset = dy * width * 4;
        const thicknessRowOffset = worldY * PAINT_CANVAS_SIZE;

        for (let dx = 0; dx < width; dx++) {
          const worldX = sx + dx;
          const distX = worldX - px;
          const distSq = distX * distX + distYSq;

          // Only paint within the brush radius (using squared distance)
          if (distSq <= radiusSq) {
            // Edge falloff based on hardness
            // hardness 0 = very soft gaussian-like falloff
            // hardness 1 = hard edge with minimal falloff
            const distRatio = Math.sqrt(distSq) / radius;
            const hardness = brush.hardness;

            // Compute falloff: soft brushes fade gradually, hard brushes stay solid longer
            let edgeFalloff: number;
            if (hardness >= 0.95) {
              // Nearly hard edge
              edgeFalloff = distRatio < 0.9 ? 1 : (1 - distRatio) * 10;
            } else {
              // Soft to medium: use power curve
              // Higher hardness = steeper curve = harder edge
              const softness = 1 - hardness;
              const curve = 0.5 + softness * 2; // 0.5 to 2.5
              edgeFalloff = Math.pow(1 - distRatio, curve);
            }

            const strokeStrength = brushOpacity * edgeFalloff;

            const idx = rowOffset + dx * 4;
            const thicknessIdx = thicknessRowOffset + worldX;

            // Get existing color (the undercoat)
            const underR = pixels[idx];
            const underG = pixels[idx + 1];
            const underB = pixels[idx + 2];

            // Get paint thickness from separate map (0-1 range)
            const existingThickness = thicknessMap[thicknessIdx];
            const undercoatBleed =
              UNDERCOAT_STRENGTH *
              (existingThickness > 1 ? 1 : existingThickness);

            // Subtractive-ish color mixing (like real paint)
            const bleedComp = 1 - undercoatBleed;
            const bleed07 = undercoatBleed * 0.7;
            const bleed03 = undercoatBleed * 0.3;

            const mixedR =
              (brushR * bleedComp +
                underR * bleed07 +
                (brushR < underR ? brushR : underR) * bleed03) |
              0;
            const mixedG =
              (brushG * bleedComp +
                underG * bleed07 +
                (brushG < underG ? brushG : underG) * bleed03) |
              0;
            const mixedB =
              (brushB * bleedComp +
                underB * bleed07 +
                (brushB < underB ? brushB : underB) * bleed03) |
              0;

            // Blend the mixed color onto the canvas
            pixels[idx] = (underR + (mixedR - underR) * strokeStrength) | 0;
            pixels[idx + 1] = (underG + (mixedG - underG) * strokeStrength) | 0;
            pixels[idx + 2] = (underB + (mixedB - underB) * strokeStrength) | 0;
            pixels[idx + 3] = 255;

            // Accumulate paint thickness
            thicknessMap[thicknessIdx] += strokeStrength * 0.3;
          }
        }
      }

      // Write blended pixels back to canvas
      ctx.putImageData(imageData, sx, sy);

      // Mark texture for update
      texture.needsUpdate = true;
    };

    /**
     * Handle raycasting from mouse position.
     * Returns intersection info including UV, position, and normal for cursor.
     */
    interface RaycastResult {
      uv: THREE.Vector2;
      point: THREE.Vector3;
      normal: THREE.Vector3;
    }

    const raycast = (
      event: PointerEvent | MouseEvent
    ): RaycastResult | null => {
      const currentScene = sceneRef.current;
      const camera = cameraRef.current;
      if (!currentScene || !camera || !container) return null;

      const rect = container.getBoundingClientRect();

      // Convert screen coordinates to normalized device coordinates (-1 to 1)
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Enable firstHitOnly for BVH optimization (we only need the first hit)
      (raycasterRef.current as any).firstHitOnly = true;

      // Check for intersections with ALL objects in the scene
      const intersects = raycasterRef.current.intersectObjects(
        currentScene.children,
        true
      );

      // Find first intersection that has UV coordinates (is a mesh, not the cursor)
      for (const intersect of intersects) {
        // Skip the brush cursor itself
        if (intersect.object === brushCursorRef.current) continue;

        if (
          intersect.uv &&
          intersect.object instanceof THREE.Mesh &&
          intersect.face
        ) {
          return {
            uv: intersect.uv.clone(),
            point: intersect.point.clone(),
            normal: intersect.face.normal
              .clone()
              .transformDirection(intersect.object.matrixWorld),
          };
        }
      }

      return null;
    };

    // Legacy wrapper for UV-only access
    const raycastToUV = (event: PointerEvent): THREE.Vector2 | null => {
      const result = raycast(event);
      return result ? result.uv : null;
    };

    /**
     * Pointer down handler - LEFT click for painting on model, or move/rotate outside.
     * OrbitControls is dynamically enabled/disabled based on raycast hit and mode.
     */
    const handlePointerDown = (event: PointerEvent) => {
      // Only handle LEFT mouse button (button === 0)
      if (event.button === 0) {
        const uv = raycastToUV(event);

        if (uv) {
          // We hit the model - disable controls, start painting
          controls.enabled = false;
          event.preventDefault();

          // Save current state for undo before painting
          const ctx = paintCtxRef.current;
          const thicknessMap = thicknessMapRef.current;
          if (ctx && thicknessMap) {
            const imageData = ctx.getImageData(
              0,
              0,
              PAINT_CANVAS_SIZE,
              PAINT_CANVAS_SIZE
            );
            const thicknessCopy = new Float32Array(thicknessMap);
            undoHistoryRef.current.push({
              imageData,
              thicknessMap: thicknessCopy,
            });
            // Limit history size
            if (undoHistoryRef.current.length > MAX_UNDO_STEPS) {
              undoHistoryRef.current.shift();
            }
            // Clear redo history when new stroke is made
            redoHistoryRef.current = [];
          }

          isPaintingRef.current = true;
          lastPaintUV = uv.clone();
          paintAtUV(uv);
        } else {
          // Clicked outside model
          if (cursorModeRef.current === CursorMode.Move) {
            // Move mode - start dragging the model
            controls.enabled = false;
            isDraggingModelRef.current = true;
            dragStartMouseRef.current.set(event.clientX, event.clientY);
            if (modelObjRef.current) {
              dragStartModelPosRef.current.copy(modelObjRef.current.position);
            }
          } else {
            // Rotate mode - enable orbit controls
            controls.enabled = true;
          }
        }
      }
    };

    /**
     * Pointer move handler - update brush cursor, paint, or drag model.
     */
    const handlePointerMove = (event: PointerEvent) => {
      // Handle model dragging in move mode
      if (isDraggingModelRef.current && modelObjRef.current) {
        const deltaX = (event.clientX - dragStartMouseRef.current.x) * 0.005;
        const deltaY = (event.clientY - dragStartMouseRef.current.y) * -0.005;

        // Move in camera-relative XY plane
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        camera.matrix.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

        modelObjRef.current.position.copy(dragStartModelPosRef.current);
        modelObjRef.current.position.addScaledVector(cameraRight, deltaX);
        modelObjRef.current.position.addScaledVector(cameraUp, deltaY);
        return;
      }

      const result = raycast(event);

      if (result) {
        // Set cursor to default when over model
        if (canvas) canvas.style.cursor = "default";
        isOverModelRef.current = true;

        // Update brush cursor target position (will be smoothly interpolated)
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = true;

          // Set target position with small offset along normal
          cursorTargetPos.copy(result.point);
          cursorTargetPos.addScaledVector(result.normal, 0.01);

          // Initialize current position on first hit to avoid lerping from origin
          if (!cursorInitialized) {
            cursorCurrentPos.copy(cursorTargetPos);
            cursor.position.copy(cursorCurrentPos);
            cursorInitialized = true;
          }

          // Update cursor appearance based on current brush settings
          updateBrushCursor(brushRef.current.radius, brushRef.current.color);
        }

        // Paint if in painting mode
        if (isPaintingRef.current) {
          lastPaintUV = result.uv.clone();
          paintAtUV(result.uv);
        }
      } else {
        // Restore cursor based on mode when not over model
        if (canvas) {
          canvas.style.cursor =
            cursorModeRef.current === CursorMode.Move ? "grab" : "all-scroll";
        }
        isOverModelRef.current = false;

        // Hide cursor when not over model
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = false;
          cursorInitialized = false; // Reset so next hit snaps immediately
        }
        lastPaintUV = null; // Clear paint UV when off model
      }
    };

    /**
     * Handle mouse leaving the canvas - hide cursor and stop dragging.
     */
    const handlePointerLeave = () => {
      isPaintingRef.current = false;
      isDraggingModelRef.current = false;
      const cursor = brushCursorRef.current;
      if (cursor) {
        cursor.visible = false;
      }
    };

    /**
     * Pointer up handler - stop painting/dragging and re-enable controls.
     */
    const handlePointerUp = () => {
      isPaintingRef.current = false;
      isDraggingModelRef.current = false;
      controls.enabled = true;
    };

    /**
     * Prevent context menu on right-click.
     */
    const handleContextMenu = (event: Event) => {
      event.preventDefault();
    };

    // Add event listeners (keyboard shortcuts handled by useKeyboardShortcuts hook)
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("contextmenu", handleContextMenu);

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    return () => {
      // Stop animation loop
      renderer.setAnimationLoop(null);

      // Kill any GSAP animations
      gsap.killTweensOf({});

      // Remove event listeners
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("contextmenu", handleContextMenu);

      // Dispose of lil-gui
      gui?.destroy();

      // Dispose of controls
      controls.dispose();

      // Dispose of scene objects
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

      // Dispose of paint texture
      paintTexture.dispose();

      // Dispose of renderer
      renderer.dispose();
    };
  }, [selectedModel]);

  // ============================================================================
  // CLEAR CANVAS HANDLER
  // ============================================================================

  const handleClear = useCallback(() => {
    const ctx = paintCtxRef.current;
    const texture = paintTextureRef.current;
    const thicknessMap = thicknessMapRef.current;
    if (!ctx || !texture) return;

    // Fill paint canvas with shader-specific base color
    const baseColor = getBaseColorForShader(currentShaderIdRef.current);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);

    // Reset thickness map
    if (thicknessMap) {
      thicknessMap.fill(0);
    }

    // Mark texture for update
    texture.needsUpdate = true;
  }, []);

  // ============================================================================
  // SHARE / SCREENSHOT HANDLER
  // ============================================================================

  const handleShare = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // Capture screenshot from WebGL canvas
    // Note: preserveDrawingBuffer must be true on the renderer for this to work
    const dataUrl = renderer.domElement.toDataURL("image/png");

    setScreenshotUrl(dataUrl);
    setShareModalOpen(true);
  }, []);

  const handleCloseShareModal = useCallback(() => {
    setShareModalOpen(false);
    setScreenshotUrl("");
  }, []);

  // ============================================================================
  // SHADER CHANGE HANDLER
  // ============================================================================

  const handleShaderChange = useCallback((shaderId: string) => {
    setCurrentShader(shaderId);
    applyShaderRef.current?.(shaderId);
    // Paint is preserved - no canvas reset here
  }, []);

  // ============================================================================
  // KEYBOARD SHORTCUTS (handled by useKeyboardShortcuts hook)
  // ============================================================================

  useKeyboardShortcuts({
    cameraRef,
    controlsRef,
    paintCtxRef,
    paintTextureRef,
    thicknessMapRef,
    undoHistoryRef,
    redoHistoryRef,
    canvasSize: PAINT_CANVAS_SIZE,
    setCursorMode,
    handleBrushChange,
    onSave: savePaintState,
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Infinite Dot Grid Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundColor: "#18181b",
          backgroundImage:
            "radial-gradient(circle, #52525b 1.5px, transparent 1.5px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* 3D Canvas Container */}
      <div ref={containerRef} className="flex-1 relative z-10 bg-transparent">
        <canvas
          ref={canvasRef}
          className="w-full h-full block bg-transparent"
          style={{
            touchAction: "none",
            cursor:
              cursorMode === CursorMode.Move
                ? isGrabbing
                  ? "grabbing"
                  : "grab"
                : "all-scroll",
          }}
          onMouseDown={() => {
            if (cursorMode === CursorMode.Move) setIsGrabbing(true);
          }}
          onMouseUp={() => setIsGrabbing(false)}
          onMouseLeave={() => setIsGrabbing(false)}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-300">Loading ...</p>
              {/* <p className="text-zinc-300">Loading {selectedModel.name}...</p> */}
            </div>
          </div>
        )}
      </div>

      {/* Top Right Toolbar */}
      <div
        className={`transition-opacity duration-300 ${hudVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <TopRightToolbar
          animation={animation}
          onAnimationChange={(changes: Partial<AnimationState>) =>
            setAnimation((prev) => ({ ...prev, ...changes }))
          }
          onClear={handleClear}
          isLoading={isLoading}
        />
      </div>

      {/* Bottom Toolbar */}
      <div
        className={`transition-opacity duration-300 ${hudVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <BottomToolbar
          brush={brush}
          onBrushChange={handleBrushChange}
          currentShader={currentShader}
          onShaderChange={handleShaderChange}
          cursorMode={cursorMode}
          onCursorModeChange={setCursorMode}
          colorHistory={colorHistory}
          onColorChange={handleColorSelect}
          onColorCommit={handleColorCommit}
          hudVisible={hudVisible}
        />
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        imageUrl={screenshotUrl}
        onClose={handleCloseShareModal}
      />
    </div>
  );
}
