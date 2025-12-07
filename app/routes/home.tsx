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
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import gsap from "gsap";
import GUI from "lil-gui";

// Three.js setup utilities
import {
  loadModel,
  animateModelFadeIn,
  setupThreeScene,
  createResizeHandler,
  disposeThreeScene,
  DEFAULT_CAMERA_CONFIG,
} from "~/three-utils";

// Fill brush utilities
import {
  buildUVIslands,
  findIslandFromFace,
  fillIslandOnCanvas,
} from "~/three-utils/floodFill";
import type { FloodFillResult, UVIsland } from "~/three-utils/floodFill";
import { createHighlightManager } from "~/three-utils/sectionHighlight";
import type { HighlightManager } from "~/three-utils/sectionHighlight";
import { createSporeEmitter } from "~/three-utils/sporeParticles";
import type { SporeEmitter } from "~/three-utils/sporeParticles";

// Shaders
import {
  shaders,
  getShaderById,
  DEFAULT_SHADER_ID,
  type ShaderConfig,
  ShaderId,
} from "~/shaders";

// Constants & Types
import {
  PAINT_CANVAS_SIZE,
  AVAILABLE_MODELS,
  BASE_COLOR,
  getBaseColorForShader,
  CursorMode,
  HOTKEYS,
  BrushType,
} from "~/constants";
import type {
  BrushState,
  AnimationState,
  ModelOption,
} from "~/constants/types";

// Components
import { BottomToolbar, useBrush } from "~/components/BottomToolbar";
import { Compass, type CompassRef } from "~/components/Compass";
import { TopToolbar } from "~/components/TopToolbar";
import { ShareModal } from "~/components/ShareModal";
import { LoadingDotsOverlay } from "~/components/LoadingDotsOverlay/LoadingDotsOverlay";
import { ModelSelectorModal } from "~/components/ModelSelectorModal";

// Hooks
import {
  useKeyboardShortcuts,
  usePaintPersistence,
  getLastSelectedModelId,
  checkHasAnySavedPaintState,
} from "~/hooks";
import { findModelById } from "~/constants/models";

// ============================================================================
// META FUNCTION
// ============================================================================

export { getMetaTags as meta } from "~/constants/meta";

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
  const modelPivotRef = useRef<THREE.Group | null>(null); // Pivot group for rotation around center

  // Paint system refs
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const brushCursorRef = useRef<THREE.Mesh | null>(null);
  const brushCursorOutlineRef = useRef<THREE.Mesh | null>(null);

  // Brush Stamp Optimization (Native Canvas)
  const brushStampCanvasRef = useRef<HTMLCanvasElement[] | null>(null);
  const lastStampRadiusRef = useRef<number>(0);
  const lastStampHardnessRef = useRef<number>(0);
  const lastStampTypeRef = useRef<BrushType | null>(null);
  const lastStampColorRef = useRef<string>("");

  // Painting state (using refs for performance in event handlers)
  const isPaintingRef = useRef<boolean>(false);
  const isDraggingModelRef = useRef<boolean>(false); // For move mode dragging
  const isRotatingModelRef = useRef<boolean>(false); // For rotate mode dragging
  const dragStartMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const dragStartModelPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const rotateStartMouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const rotateStartQuaternionRef = useRef<THREE.Quaternion>(
    new THREE.Quaternion()
  );
  const rotatePivotPointRef = useRef<THREE.Vector3>(new THREE.Vector3()); // 3D point to rotate around
  const rotateStartPivotPosRef = useRef<THREE.Vector3>(new THREE.Vector3()); // Pivot group position at start
  // Velocity tracking for momentum on release
  const lastMoveTimeRef = useRef<number>(0);
  const moveVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastRotateTimeRef = useRef<number>(0);
  const rotateVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Model ID ref for persistence
  const currentModelIdRef = useRef<string>(AVAILABLE_MODELS[0].id);

  // Paint persistence hook - auto-saves to localStorage
  const {
    saveState: savePaintState,
    restoreToCanvas,
    hasAnySavedState,
    hasSavedState,
    getLastModelId,
    setLastModelId,
  } = usePaintPersistence(
    paintCtxRef,
    paintTextureRef,
    thicknessMapRef,
    currentShaderIdRef,
    currentModelIdRef,
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

  // Fill brush system refs
  const uvIslandsRef = useRef<Map<THREE.Mesh, FloodFillResult>>(new Map());
  const highlightManagerRef = useRef<HighlightManager | null>(null);
  const sporeEmitterRef = useRef<SporeEmitter | null>(null);
  const hoveredIslandRef = useRef<{
    island: UVIsland;
    islandIndex: number;
    mesh: THREE.Mesh;
  } | null>(null);

  // Track if we've initialized from localStorage (to avoid hydration mismatch)
  const hasInitializedRef = useRef<boolean>(false);

  // React state for UI - start with null/true to avoid SSR mismatch
  // localStorage check happens in useEffect after mount
  const [selectedModel, setSelectedModel] = useState<ModelOption | null>(null);
  const [showModelSelector, setShowModelSelector] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [animation, setAnimation] = useState<AnimationState>({
    spin: false,
    spinSpeed: 0.5,
  });
  const [currentShader, setCurrentShader] = useState<string>(DEFAULT_SHADER_ID);
  const [cursorMode, setCursorMode] = useState<CursorMode>(CursorMode.Paint);
  const [isGrabbing, setIsGrabbing] = useState<boolean>(false);
  const [hudVisible, setHudVisible] = useState<boolean>(true);
  const isOverModelRef = useRef<boolean>(false);
  const hudTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Ref for cursor mode to use in event handlers
  const cursorModeRef = useRef<CursorMode>(CursorMode.Paint);
  
  // Compass Ref
  const compassRef = useRef<CompassRef>(null);

  // Track if model transformation has changed from default
  const [isTransformDirty, setIsTransformDirty] = useState<boolean>(false);

  // Sync cursor mode with ref
  useEffect(() => {
    cursorModeRef.current = cursorMode;
    // Disable OrbitControls entirely - we handle move/rotate manually on the model
    const controls = controlsRef.current;
    if (controls) {
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.enabled = false;
    }
  }, [cursorMode]);

  // ============================================================================
  // INITIALIZE FROM LOCALSTORAGE (client-side only to avoid hydration mismatch)
  // ============================================================================

  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;

    // Check localStorage for saved paint state
    if (checkHasAnySavedPaintState()) {
      const lastModelId = getLastSelectedModelId();
      if (lastModelId) {
        const model = findModelById(lastModelId);
        if (model) {
          setSelectedModel(model);
          setShowModelSelector(false);
          return;
        }
      }
    }
    // No saved state - show model selector (already set as default)
  }, []);

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
    // Initialize Three.js Scene using setup utilities
    // -------------------------------------------------------------------------
    const { renderer, scene, camera, controls, lights, lightingParams } =
      setupThreeScene(canvas, container);

    // Store refs for external access
    rendererRef.current = renderer;
    sceneRef.current = scene;
    cameraRef.current = camera;
    controlsRef.current = controls;

    // Destructure lights for GUI access
    const {
      ambient: ambientLight,
      hemisphere: hemiLight,
      key: keyLight,
      fill: fillLight,
    } = lights;

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
    brushCursorOutlineRef.current = cursorOutline;

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

    const paintCtx = paintCanvas.getContext("2d", {
      willReadFrequently: true, // Optimize for frequent readbacks
    });
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
    // Don't load model if none is selected (waiting for user to pick)
    if (!selectedModel) {
      setIsLoading(false);
      return;
    }

    // Update currentModelIdRef
    currentModelIdRef.current = selectedModel.id;

    loadModel(selectedModel.path, scene, paintTexture, {
      onProgress: (percent) => {
        // console.log(`Loading model: ${percent.toFixed(1)}%`);
      },
      onComplete: ({ model, paintableMeshes, materialPropsMap, scale }) => {
        console.log("Model loaded:", selectedModel.name);
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

        // Create pivot group for rotation around center
        // The model is already centered at origin, so the pivot at origin
        // will rotate around the model's center
        const pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);

        // Store references
        modelObjRef.current = model;
        modelPivotRef.current = pivot;

        // Animate model fade-in
        animateModelFadeIn(model, paintableMeshes, scale, () => {
          // Optional: disable transparency after fade completes
        });

        // Try to restore saved paint state from localStorage
        const ctx = paintCtxRef.current;
        const texture = paintTextureRef.current;
        const thicknessMap = thicknessMapRef.current;
        if (ctx && texture && thicknessMap && selectedModel) {
          restoreToCanvas(selectedModel.id, ctx, texture, thicknessMap).then(
            (restored: boolean) => {
              if (restored) {
                console.log(
                  "Restored previous paint session from localStorage"
                );
              }
            }
          );
        }

        // Build UV islands for fill brush feature
        uvIslandsRef.current.clear();
        paintableMeshes.forEach((mesh) => {
          if (mesh.geometry) {
            const islands = buildUVIslands(mesh.geometry);
            uvIslandsRef.current.set(mesh, islands);
            console.log(`Built ${islands.islands.length} UV islands for mesh`);
          }
        });

        // Initialize fill brush highlight manager and spore emitter
        highlightManagerRef.current = createHighlightManager(scene);
        sporeEmitterRef.current = createSporeEmitter(scene, {
          maxParticles: 150,
          particleSize: 0.012,
          emissionRate: 40,
          speed: 0.2,
          lifetime: 1.2,
          gravity: 0.08,
          spread: 0.3,
        });

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
    let animationTime = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const deltaTime = clock.getDelta();
      animationTime += deltaTime;

      updateCursorSmooth(); // Smooth cursor interpolation

      // Spin model if enabled (uses React ref for state)
      if (animationRef.current.spin && modelObjRef.current) {
        modelObjRef.current.rotation.y += 0.01 * animationRef.current.spinSpeed;
        setIsTransformDirty(true);
      }
      
      // Update Compass rotation to match model
      if (modelPivotRef.current && compassRef.current) {
        compassRef.current.updateRotation(modelPivotRef.current.quaternion);
      }

      // Continuous airbrush spraying while holding mouse button
      if (
        isPaintingRef.current &&
        lastPaintUV &&
        brushRef.current.type === "airbrush"
      ) {
        paintAtUV(lastPaintUV);
      }

      // Update fill brush highlight animation
      if (highlightManagerRef.current) {
        highlightManagerRef.current.update(animationTime);
      }

      // Update spore particle system
      if (sporeEmitterRef.current) {
        sporeEmitterRef.current.update(deltaTime);
      }

      renderer.render(scene, camera);
    };
    renderer.setAnimationLoop(animate);

    // -------------------------------------------------------------------------
    // Handle Window Resize
    // -------------------------------------------------------------------------
    const handleResize = createResizeHandler(container, camera, renderer);

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
     *
     * AIRBRUSH MODE:
     * Uses conic spray pattern with random particle distribution.
     */

    // Cache for brush color parsing (avoid re-parsing same color)
    let cachedColorHex = "";
    let cachedColorRgb = { r: 0, g: 0, b: 0 };

    // Update the pre-computed brush stamp (Native Canvas)
    const updateBrushStamp = (
      radius: number,
      hardness: number,
      color: string,
      type: BrushType
    ) => {
      // Check if we need to update
      if (
        brushStampCanvasRef.current &&
        lastStampRadiusRef.current === radius &&
        lastStampHardnessRef.current === hardness &&
        lastStampTypeRef.current === type &&
        lastStampColorRef.current === color
      ) {
        return;
      }

      const size = Math.ceil(radius * 2);
      const STAMP_COUNT = 3; // Generate 3 variations for dynamic feel without rotation
      const stamps: HTMLCanvasElement[] = [];

      // Airbrush constants
      const isAirbrush = type === BrushType.Airbrush;
      // Iwata Tuning: High sharpness for tight core, High density for fine atomization
      const GAUSSIAN_SHARPNESS = 15.0;
      const STAMP_DENSITY = 1.0;
      const radiusSq = radius * radius;

      // Parse color
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      for (let i = 0; i < STAMP_COUNT; i++) {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        const imgData = ctx.createImageData(size, size);
        const data = imgData.data;

        for (let y = 0; y < size; y++) {
          const dy = y - radius;
          const dySq = dy * dy;

          for (let x = 0; x < size; x++) {
            const dx = x - radius;
            const distSq = dx * dx + dySq;

            if (distSq > radiusSq) continue;

            const ratioSq = distSq / radiusSq;
            let alpha = 0;

            if (isAirbrush) {
              // Iwata Airbrush: Gaussian distribution
              const probability =
                Math.exp(-GAUSSIAN_SHARPNESS * ratioSq) * STAMP_DENSITY;
              const falloff = 1 - ratioSq;
              const finalProb = probability * falloff * falloff;

              // Stochastic check: bake the noise into the stamp
              if (Math.random() < finalProb) {
                alpha = 1;
              } else {
                alpha = 0;
              }
            } else {
              // Standard Brush Falloff (Smooth)
              let edgeFalloff = 0;
              if (hardness >= 0.95) {
                if (ratioSq < 0.81) {
                  edgeFalloff = 1;
                } else {
                  const r = Math.sqrt(ratioSq);
                  edgeFalloff = (1 - r) * 10;
                }
              } else {
                const distRatio = Math.sqrt(distSq) / radius;
                const softness = 1 - hardness;
                const curve = 0.5 + softness * 2;
                edgeFalloff = Math.pow(1 - distRatio, curve);
              }
              alpha = edgeFalloff;
            }

            const idx = (y * size + x) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = Math.floor(alpha * 255);
          }
        }

        ctx.putImageData(imgData, 0, 0);
        stamps.push(canvas);
      }

      brushStampCanvasRef.current = stamps;
      lastStampRadiusRef.current = radius;
      lastStampHardnessRef.current = hardness;
      lastStampTypeRef.current = type;
      lastStampColorRef.current = color;
    };

    const paintAtUV = (uv: THREE.Vector2) => {
      const ctx = paintCtxRef.current;
      const texture = paintTextureRef.current;
      if (!ctx || !texture) return;

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

      // Update stamp if needed
      updateBrushStamp(radius, brush.hardness, brush.color, brush.type);
      const stamps = brushStampCanvasRef.current;
      if (!stamps || stamps.length === 0) return;

      // Pick a random stamp to create dynamic noise effect without rotation
      const stampIndex = Math.floor(Math.random() * stamps.length);
      const stampCanvas = stamps[stampIndex];

      // Calculate draw position (centered on UV)
      const drawX = px - radius;
      const drawY = py - radius;

      // Configure context for blending
      ctx.globalCompositeOperation = "source-over";

      // Adjust opacity based on brush type
      const isAirbrush = brush.type === BrushType.Airbrush;
      const MAX_COVERAGE = 0.95;
      const typeOpacityMult = isAirbrush ? 0.6 : 1.0;

      // Apply opacity
      ctx.globalAlpha = brush.opacity * MAX_COVERAGE * typeOpacityMult;

      // Draw the stamp (No rotation for max performance)
      ctx.drawImage(stampCanvas, drawX, drawY);

      // Reset alpha
      ctx.globalAlpha = 1.0;

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
      faceIndex: number;
      mesh: THREE.Mesh;
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

      // OPTIMIZATION: Use BVH accelerated raycasting
      // firstHitOnly = true makes it stop at the first intersection, which is much faster
      // This requires the mesh geometry to have computeBoundsTree() called (done in modelLoader)
      (raycasterRef.current as any).firstHitOnly = true;

      // Check for intersections with paintable meshes
      const intersects = raycasterRef.current.intersectObjects(
        paintableMeshesRef.current,
        false
      );

      for (const intersect of intersects) {
        // Skip the brush cursor itself
        if (intersect.object === brushCursorRef.current) continue;

        if (
          intersect.uv &&
          intersect.object instanceof THREE.Mesh &&
          intersect.face &&
          intersect.faceIndex !== undefined &&
          intersect.faceIndex !== null
        ) {
          return {
            uv: intersect.uv.clone(),
            point: intersect.point.clone(),
            normal: intersect.face.normal
              .clone()
              .transformDirection(intersect.object.matrixWorld),
            faceIndex: intersect.faceIndex,
            mesh: intersect.object,
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
     * Pointer down handler - behavior depends on cursor mode:
     * - Paint mode: only paint when clicking on model, do nothing otherwise
     * - Move mode: always move/drag (even when clicking on model)
     * - Rotate mode: always rotate (even when clicking on model)
     */
    const handlePointerDown = (event: PointerEvent) => {
      // Only handle LEFT mouse button (button === 0)
      if (event.button === 0) {
        const currentMode = cursorModeRef.current;
        const result = raycast(event);

        // Move mode - always drag model regardless of hitting model
        if (currentMode === CursorMode.Move) {
          console.log(
            "Move mode - isDragging start, pivot:",
            !!modelPivotRef.current
          );
          controls.enabled = false;
          isDraggingModelRef.current = true;
          setIsGrabbing(true);
          dragStartMouseRef.current.set(event.clientX, event.clientY);
          // Initialize velocity tracking
          lastMousePosRef.current = { x: event.clientX, y: event.clientY };
          lastMoveTimeRef.current = performance.now();
          moveVelocityRef.current = { x: 0, y: 0 };
          if (modelPivotRef.current) {
            dragStartModelPosRef.current.copy(modelPivotRef.current.position);
          }
          return;
        }

        // Rotate mode - rotate the model around cursor position
        if (currentMode === CursorMode.Rotate) {
          controls.enabled = false;
          isRotatingModelRef.current = true;
          setIsGrabbing(true);
          rotateStartMouseRef.current.set(event.clientX, event.clientY);
          // Initialize velocity tracking
          lastMousePosRef.current = { x: event.clientX, y: event.clientY };
          lastRotateTimeRef.current = performance.now();
          rotateVelocityRef.current = { x: 0, y: 0 };

          // Store the 3D point to rotate around (where cursor is on model, or screen center projected)
          if (result && result.point) {
            rotatePivotPointRef.current.copy(result.point);
          } else {
            // If not hitting model, use origin as pivot
            rotatePivotPointRef.current.set(0, 0, 0);
          }

          if (modelPivotRef.current) {
            rotateStartQuaternionRef.current.copy(
              modelPivotRef.current.quaternion
            );
            rotateStartPivotPosRef.current.copy(modelPivotRef.current.position);
          }
          return;
        }

        // Paint mode - only paint if we hit the model
        if (currentMode === CursorMode.Paint) {
          if (!result) {
            // Clicked outside model in paint mode - do nothing
            controls.enabled = false;
            return;
          }

          // We hit the model - paint
          controls.enabled = false;
          event.preventDefault();
          (event.target as Element).setPointerCapture(event.pointerId);

          // Get paint context
          const ctx = paintCtxRef.current;
          const thicknessMap = thicknessMapRef.current;

          // Save current state for undo before painting
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

          // Handle Fill brush - fill the entire UV island
          if (brushRef.current.type === BrushType.Fill && ctx) {
            console.log(
              "Fill click - ctx:",
              !!ctx,
              "result.mesh:",
              result.mesh.name || result.mesh.uuid
            );

            // Try to find island data - check both the hit mesh and all stored meshes
            let islandData = uvIslandsRef.current.get(result.mesh);
            let targetMesh = result.mesh;

            console.log(
              "Direct lookup:",
              !!islandData,
              "uvIslandsRef size:",
              uvIslandsRef.current.size
            );

            // If not found, try to find by geometry match
            if (!islandData) {
              for (const [mesh, data] of uvIslandsRef.current.entries()) {
                console.log(
                  "Checking mesh:",
                  mesh.name || mesh.uuid,
                  "geometry match:",
                  mesh.geometry === result.mesh.geometry
                );
                if (mesh.geometry === result.mesh.geometry) {
                  islandData = data;
                  targetMesh = mesh;
                  break;
                }
              }
            }

            console.log(
              "Final islandData:",
              !!islandData,
              "faceIndex:",
              result.faceIndex
            );

            if (islandData) {
              const island = findIslandFromFace(result.faceIndex, islandData);
              console.log(
                "Found island:",
                !!island,
                island ? `${island.triangleIndices.length} triangles` : "none"
              );
              if (island) {
                console.log(
                  "Calling fillIslandOnCanvas with color:",
                  brushRef.current.color
                );
                fillIslandOnCanvas(
                  island,
                  targetMesh.geometry,
                  ctx,
                  PAINT_CANVAS_SIZE,
                  brushRef.current.color
                );
                const texture = paintTextureRef.current;
                if (texture) {
                  texture.needsUpdate = true;
                  console.log("Texture marked for update");
                }
              }
            }
          } else if (brushRef.current.type !== BrushType.Fill) {
            // Regular brush painting
            isPaintingRef.current = true;
            lastPaintUV = result.uv.clone();

            // OPTIMIZATION: For Airbrush, do NOT paint here.
            // The animate loop handles continuous spraying.
            // Painting here would cause a double-paint on the first frame.
            if (brushRef.current.type !== BrushType.Airbrush) {
              paintAtUV(result.uv);
            }
          }
        }
      }
    };

    /**
     * Pointer move handler - update brush cursor, paint, or drag model.
     */
    const handlePointerMove = (event: PointerEvent) => {
      const currentMode = cursorModeRef.current;

      // Handle model dragging in move mode - move the pivot so rotation center moves too
      if (isDraggingModelRef.current && modelPivotRef.current) {
        const now = performance.now();
        const dt = now - lastMoveTimeRef.current;

        const deltaX = (event.clientX - dragStartMouseRef.current.x) * 0.0015;
        const deltaY = (event.clientY - dragStartMouseRef.current.y) * -0.0015;

        // Track velocity for momentum (pixels per ms)
        if (dt > 0 && dt < 100) {
          const vx = (event.clientX - lastMousePosRef.current.x) / dt;
          const vy = (event.clientY - lastMousePosRef.current.y) / dt;
          // Smooth velocity with exponential moving average
          moveVelocityRef.current.x =
            moveVelocityRef.current.x * 0.5 + vx * 0.5;
          moveVelocityRef.current.y =
            moveVelocityRef.current.y * 0.5 + vy * 0.5;
        }
        lastMoveTimeRef.current = now;
        lastMousePosRef.current = { x: event.clientX, y: event.clientY };

        // Move in camera-relative XY plane
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        camera.matrix.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

        modelPivotRef.current.position.copy(dragStartModelPosRef.current);
        modelPivotRef.current.position.addScaledVector(cameraRight, deltaX);
        modelPivotRef.current.position.addScaledVector(cameraUp, deltaY);

        setIsTransformDirty(true);
        return;
      }

      // Handle model rotation in rotate mode - orbit around cursor pivot point (X and Y axis)
      if (isRotatingModelRef.current && modelPivotRef.current) {
        const now = performance.now();
        const dt = now - lastRotateTimeRef.current;

        const deltaX = (event.clientX - rotateStartMouseRef.current.x) * 0.003;
        const deltaY = (event.clientY - rotateStartMouseRef.current.y) * 0.003;

        // Track rotational velocity for momentum (pixels per ms)
        if (dt > 0 && dt < 100) {
          const vrx = (event.clientX - lastMousePosRef.current.x) / dt;
          const vry = (event.clientY - lastMousePosRef.current.y) / dt;
          rotateVelocityRef.current = {
            x: rotateVelocityRef.current.x * 0.5 + vrx * 0.5,
            y: rotateVelocityRef.current.y * 0.5 + vry * 0.5,
          };
        }
        lastRotateTimeRef.current = now;
        lastMousePosRef.current = { x: event.clientX, y: event.clientY };

        // Get camera basis for natural rotation
        const cameraRight = new THREE.Vector3();
        const cameraUp = new THREE.Vector3();
        camera.matrix.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

        // Create rotation quaternions around World Y (horizontal drag) and Camera Right (vertical drag)
        const rotationY = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0), // Keep World Y for ground-plane turntable feel
          deltaX
        );
        const rotationX = new THREE.Quaternion().setFromAxisAngle(
          cameraRight, // Use Camera Right for screen-relative pitch
          deltaY
        );
        const combinedRotation = new THREE.Quaternion()
          .copy(rotationY)
          .multiply(rotationX);

        // Get the pivot point in world space
        const pivotWorld = rotatePivotPointRef.current.clone();

        // Calculate new quaternion
        const newQuaternion = new THREE.Quaternion()
          .copy(combinedRotation)
          .multiply(rotateStartQuaternionRef.current);

        // Rotate the pivot position around the cursor point
        // 1. Get vector from pivot point to model center at start
        const startPos = rotateStartPivotPosRef.current.clone();
        const offsetFromPivot = startPos.clone().sub(pivotWorld);

        // 2. Rotate that offset vector
        offsetFromPivot.applyQuaternion(combinedRotation);

        // 3. New position = pivot + rotated offset
        const newPosition = pivotWorld.clone().add(offsetFromPivot);

        modelPivotRef.current.quaternion.copy(newQuaternion);
        modelPivotRef.current.position.copy(newPosition);

        setIsTransformDirty(true);
        return;
      }

      const result = raycast(event);

      // In Move or Rotate mode, just show appropriate cursor
      if (
        currentMode === CursorMode.Move ||
        currentMode === CursorMode.Rotate
      ) {
        // Hide paint cursor in move/rotate modes
        const cursor = brushCursorRef.current;
        if (cursor) cursor.visible = false;

        // Set cursor based on mode
        if (canvas) {
          if (currentMode === CursorMode.Move) {
            canvas.style.cursor = isDraggingModelRef.current
              ? "grabbing"
              : "grab";
          } else {
            // Rotate mode - use move cursor (4-way arrow) or grabbing when active
            canvas.style.cursor = isRotatingModelRef.current
              ? "grabbing"
              : "move";
          }
        }

        // Clear highlight/spores in non-paint modes
        if (highlightManagerRef.current) {
          highlightManagerRef.current.setHighlight(null, null, null, null);
        }
        if (sporeEmitterRef.current) {
          sporeEmitterRef.current.setEmitting(false);
        }
        hoveredIslandRef.current = null;
        return;
      }

      // Paint mode logic
      if (result) {
        // Set cursor to crosshair when over model in paint mode
        if (canvas) canvas.style.cursor = "crosshair";
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
          // Hide cursor for Fill brush (we use highlight instead)
          if (brushRef.current.type === BrushType.Fill) {
            cursor.visible = false;
          } else {
            updateBrushCursor(brushRef.current.radius, brushRef.current.color);
          }
        }

        // Handle Fill brush - show highlight and spores on hover
        if (brushRef.current.type === BrushType.Fill) {
          const islandData = uvIslandsRef.current.get(result.mesh);
          if (islandData) {
            const island = findIslandFromFace(result.faceIndex, islandData);
            const islandIndex =
              islandData.triangleToIsland.get(result.faceIndex) ?? null;

            if (island && islandIndex !== null) {
              // Calculate contrast color for visibility
              // Only apply high contrast if the color is grayscale (low saturation)
              const hex = brushRef.current.color.replace("#", "");
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);
              
              // Calculate Chroma (saturation proxy): max - min
              const max = Math.max(r, g, b);
              const min = Math.min(r, g, b);
              const chroma = max - min;
              
              let displayColor = brushRef.current.color;

              // If chroma is low (< 10), it's a shade of gray/black/white
              if (chroma < 10) {
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                displayColor = luminance > 0.5 ? "#000000" : "#FFFFFF";
              }

              // Update highlight
              if (highlightManagerRef.current) {
                highlightManagerRef.current.setHighlight(
                  island,
                  islandIndex,
                  result.mesh.geometry,
                  result.mesh,
                  displayColor
                );
              }

              // Update spore emitter
              if (sporeEmitterRef.current) {
                sporeEmitterRef.current.setSource(
                  island,
                  result.mesh.geometry,
                  result.mesh
                );
                sporeEmitterRef.current.setColor(displayColor);
                sporeEmitterRef.current.setEmitting(true);
              }

              hoveredIslandRef.current = {
                island,
                islandIndex,
                mesh: result.mesh,
              };
            }
          }
        } else {
          // Not fill brush - clear highlight and spores
          if (highlightManagerRef.current) {
            highlightManagerRef.current.setHighlight(null, null, null, null);
          }
          if (sporeEmitterRef.current) {
            sporeEmitterRef.current.setEmitting(false);
          }
          hoveredIslandRef.current = null;
        }

        // Handle painting while dragging
        if (isPaintingRef.current && brushRef.current.type !== BrushType.Fill) {
          lastPaintUV = result.uv.clone();

          // OPTIMIZATION: For Airbrush, do NOT paint here.
          // The animate loop handles continuous spraying.
          // Painting here would cause double-painting (once here, once in animate)
          // which kills performance during drag.
          if (brushRef.current.type !== BrushType.Airbrush) {
            paintAtUV(result.uv);
          }
        }
      } else {
        // Cursor left model
        if (canvas) canvas.style.cursor = "default";
        isOverModelRef.current = false;
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = false;
          cursorInitialized = false; // Reset so next hit snaps immediately
        }
        lastPaintUV = null; // Clear paint UV when off model
        hoveredIslandRef.current = null;

        // Clear fill brush effects
        if (highlightManagerRef.current) {
          highlightManagerRef.current.setHighlight(null, null, null, null);
        }
        if (sporeEmitterRef.current) {
          sporeEmitterRef.current.setEmitting(false);
        }
      }
    };

    /**
     * Handle mouse leaving the canvas - hide cursor and stop dragging.
     */
    const handlePointerLeave = () => {
      isPaintingRef.current = false;
      isDraggingModelRef.current = false;
      isRotatingModelRef.current = false;
      setIsGrabbing(false);
      const cursor = brushCursorRef.current;
      if (cursor) {
        cursor.visible = false;
      }

      // Clear fill brush state
      if (highlightManagerRef.current) {
        highlightManagerRef.current.setHighlight(null, null, null, null);
      }
      if (sporeEmitterRef.current) {
        sporeEmitterRef.current.setEmitting(false);
      }
      hoveredIslandRef.current = null;
    };

    /**
     * Pointer up handler - stop painting/dragging and apply momentum.
     */
    const handlePointerUp = () => {
      const wasDragging = isDraggingModelRef.current;
      const wasRotating = isRotatingModelRef.current;

      isPaintingRef.current = false;
      isDraggingModelRef.current = false;
      isRotatingModelRef.current = false;
      setIsGrabbing(false);

      // Apply momentum with GSAP ease-out for move
      if (wasDragging && modelPivotRef.current) {
        const vx = moveVelocityRef.current.x;
        const vy = moveVelocityRef.current.y;
        const speed = Math.sqrt(vx * vx + vy * vy);

        if (speed > 0.05) {
          // Calculate momentum distance (scale velocity)
          const momentumScale = 80; // How far momentum carries
          const targetDeltaX = vx * momentumScale * 0.0015;
          const targetDeltaY = -vy * momentumScale * 0.0015;

          const cameraRight = new THREE.Vector3();
          const cameraUp = new THREE.Vector3();
          camera.matrix.extractBasis(
            cameraRight,
            cameraUp,
            new THREE.Vector3()
          );

          const currentPos = modelPivotRef.current.position.clone();
          const targetPos = currentPos.clone();
          targetPos.addScaledVector(cameraRight, targetDeltaX);
          targetPos.addScaledVector(cameraUp, targetDeltaY);

          gsap.to(modelPivotRef.current.position, {
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z,
            duration: 0.6,
            ease: "power2.out",
          });
        }

        // Reset velocity
        moveVelocityRef.current = { x: 0, y: 0 };
      }

      // Apply momentum with GSAP ease-out for rotate
      if (wasRotating && modelPivotRef.current) {
        const vr = rotateVelocityRef.current;
        const hasVelocity = Math.abs(vr.x) > 0.05 || Math.abs(vr.y) > 0.05;

        if (hasVelocity) {
          // Calculate momentum rotation
          const momentumScale = 100;
          const targetDeltaRotationY = vr.x * momentumScale * 0.003;
          const targetDeltaRotationX = vr.y * momentumScale * 0.003;

          // Get current rotation from quaternion
          const euler = new THREE.Euler().setFromQuaternion(
            modelPivotRef.current.quaternion,
            "YXZ"
          );
          const targetY = euler.y + targetDeltaRotationY;
          const targetX = euler.x + targetDeltaRotationX;

          gsap.to(euler, {
            x: targetX,
            y: targetY,
            duration: 0.6,
            ease: "power2.out",
            onUpdate: () => {
              if (modelPivotRef.current) {
                modelPivotRef.current.quaternion.setFromEuler(euler);
              }
            },
          });
        }

        // Reset velocity
        rotateVelocityRef.current = { x: 0, y: 0 };
      }
    };

    /**
     * Prevent context menu on right-click.
     */
    const handleContextMenu = (event: Event) => {
      event.preventDefault();
    };

    /**
     * Handle mouse wheel for zooming towards cursor position
     */
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const zoomSpeed = 0.001;
      const delta = event.deltaY * zoomSpeed;

      // Get cursor position in normalized device coordinates
      const rect = canvas.getBoundingClientRect();
      const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Create a ray from camera through cursor position
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);

      // Get the point along the ray at a reasonable distance (or use raycast hit)
      let zoomTarget: THREE.Vector3;

      // Try to hit the model for a more accurate zoom point
      const meshes = (modelObjRef.current as any)?.__paintableMeshes as
        | THREE.Mesh[]
        | undefined;
      if (meshes && meshes.length > 0) {
        const intersects = raycaster.intersectObjects(meshes, false);
        if (intersects.length > 0) {
          zoomTarget = intersects[0].point;
        } else {
          // No hit - use a point along the ray at the distance to origin
          const distToOrigin = camera.position.length();
          zoomTarget = raycaster.ray.at(distToOrigin, new THREE.Vector3());
        }
      } else {
        // No model - zoom towards origin along cursor ray
        const distToOrigin = camera.position.length();
        zoomTarget = raycaster.ray.at(distToOrigin, new THREE.Vector3());
      }

      // Calculate direction from camera to zoom target
      const direction = zoomTarget.clone().sub(camera.position).normalize();

      // Calculate new camera position (move towards/away from target point)
      const newPos = camera.position.clone();
      newPos.addScaledVector(direction, -delta);

      // Clamp zoom distance (allow getting very close, but not too far)
      const distanceToOrigin = newPos.length();
      if (distanceToOrigin > 0.3 && distanceToOrigin < 15) {
        gsap.to(camera.position, {
          x: newPos.x,
          y: newPos.y,
          z: newPos.z,
          duration: 0.15,
          ease: "power2.out",
        });
      }
    };

    // Add event listeners (keyboard shortcuts handled by useKeyboardShortcuts hook)
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

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
      canvas.removeEventListener("wheel", handleWheel);

      // Dispose of lil-gui
      gui?.destroy();

      // Dispose of paint texture
      paintTexture.dispose();

      // Dispose fill brush systems
      if (highlightManagerRef.current) {
        highlightManagerRef.current.dispose();
        highlightManagerRef.current = null;
      }
      if (sporeEmitterRef.current) {
        sporeEmitterRef.current.dispose();
        sporeEmitterRef.current = null;
      }
      uvIslandsRef.current.clear();

      // Dispose Three.js scene, renderer, and controls
      disposeThreeScene(renderer, scene, controls);
    };
  }, [selectedModel]);

  // ============================================================================
  // UPDATE BRUSH CURSOR ON BRUSH STATE CHANGE
  // ============================================================================

  useEffect(() => {
    const cursor = brushCursorRef.current;
    const outline = brushCursorOutlineRef.current;
    if (!cursor) return;

    // Scale based on brush radius (convert from UV pixels to world units)
    const worldRadius = (brush.radius / PAINT_CANVAS_SIZE) * 1.2;
    cursor.scale.setScalar(worldRadius / 0.05); // 0.05 is base circle radius

    // Update fill color
    (cursor.material as THREE.MeshBasicMaterial).color.set(brush.color);

    // Update outline to contrast with fill color
    if (outline) {
      const brushColor = new THREE.Color(brush.color);
      const luminance =
        0.299 * brushColor.r + 0.587 * brushColor.g + 0.114 * brushColor.b;
      const outlineColor = luminance > 0.5 ? 0x333333 : 0xffffff;
      (outline.material as THREE.MeshBasicMaterial).color.setHex(outlineColor);
    }
  }, [brush.radius, brush.color]);

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
  // MODEL CHANGE HANDLER
  // ============================================================================

  const handleModelChange = useCallback(
    (newModel: ModelOption) => {
      // Don't do anything if selecting the same model
      if (selectedModel?.id === newModel.id) return;

      // Save current paint state for the current model before switching
      // This is synchronous - saves to localStorage immediately
      savePaintState();

      // Update last model ID in storage
      setLastModelId(newModel.id);

      // Set new model - this will trigger the useEffect to reload
      // The new model's paint state will be restored after loading
      setSelectedModel(newModel);
    },
    [selectedModel, savePaintState, setLastModelId]
  );

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
    cursorMode,
    brushRef,
    setCursorMode,
    handleBrushChange,
    onSave: savePaintState,
  });

  // ============================================================================
  // COMPASS HANDLERS
  // ============================================================================
  // Compass Handlers
  // Compass Handlers
  const handleCompassRotate = useCallback((dx: number, dy: number) => {
    if (!modelPivotRef.current || !cameraRef.current) return;

    // Standard Trackball / Arcball Rotation Logic
    // -----------------------------------------------------------------------
    // The goal is to rotate the model around an axis that is perpendicular 
    // to the drag direction in "Screen Space".
    //
    // Screen Drag Vector: D = (dx, dy)
    // Rotation Axis in Screen Space: A_screen = (-dy, dx)  (Perpendicular to D)
    //
    // Map Screen Axes to World Vectors via Camera:
    // Screen X+  ->  Camera Right
    // Screen Y+  ->  Camera Up
    //
    // So World Rotation Axis:
    // Axis = (CameraRight * -dy) + (CameraUp * dx)

    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    cameraRef.current.matrix.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

    // Construct the rotation axis in world space
    // Note: We might need to invert direction depending on "grab the world" vs "grab the object" feel.
    // "Grab the object": Drag Right (+dx) -> Object rotates around Up (+Y). Surface moves Right.
    // Formula above: Axis = (CameraUp * dx) + ...  (Correct)
    const rotationAxis = new THREE.Vector3()
      .addScaledVector(cameraRight, dy) // Drag Up (+dy) -> Rotate around Right (+X)
      .addScaledVector(cameraUp, dx)    // Drag Right (+dx) -> Rotate around Up (+Y)
      .normalize();

    // Calculate rotation angle based on drag distance
    const sensitivity = 0.005;
    const angle = Math.sqrt(dx * dx + dy * dy) * sensitivity;

    // Apply rotation
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(rotationAxis, angle);

    modelPivotRef.current.quaternion.premultiply(rotationQuat);
    setIsTransformDirty(true);
  }, []);

  // Render section...

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="flex-1 relative z-10 bg-transparent">
        <canvas
          ref={canvasRef}
          className="w-full h-full block bg-transparent"
          style={{
            touchAction: "none",
            cursor:
              cursorMode === CursorMode.Paint
                ? "crosshair"
                : cursorMode === CursorMode.Move
                  ? isGrabbing
                    ? "grabbing"
                    : "grab"
                  : "all-scroll",
          }}
        />

        {/* Loading Overlay with Wave Animation */}
        <LoadingDotsOverlay isLoading={isLoading} />
      </div>

      {/* Top Toolbar */}
      <div
        className={`transition-opacity duration-300 ${hudVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <TopToolbar
          animation={animation}
          onAnimationChange={(changes: Partial<AnimationState>) =>
            setAnimation((prev) => ({ ...prev, ...changes }))
          }
          onClear={handleClear}
          isLoading={isLoading}
        />

        <Compass
          ref={compassRef}
          onRotate={handleCompassRotate}
        />
      </div>

      {/* Bottom Toolbar */}
      <div
        className={`transition-opacity duration-300 ${hudVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      >
        <BottomToolbar
          brush={brush}
          onBrushChange={handleBrushChange}
          currentShader={currentShaderIdRef.current}
          onShaderChange={applyShaderRef.current || (() => {})}
          cursorMode={cursorMode}
          onCursorModeChange={setCursorMode}
          colorHistory={colorHistory}
          onColorChange={handleColorSelect}
          onColorCommit={handleColorCommit}
          currentModel={selectedModel}
          onModelChange={(model) => {
            setSelectedModel(model);
            setIsLoading(true);
          }}
          onResetAxis={() => {
            if (modelPivotRef.current) {
              // Reset position and rotation to identity/zero
              modelPivotRef.current.position.set(0, 0, 0);
              modelPivotRef.current.quaternion.identity();

              // Reset velocity trackers
              moveVelocityRef.current = { x: 0, y: 0 };
              rotateVelocityRef.current = { x: 0, y: 0 };

              setIsTransformDirty(false);

              // Reset OrbitControls target
              if (controlsRef.current) {
                controlsRef.current.target.set(0, 0, 0);
              }

              // Reset Camera Position
              if (cameraRef.current && DEFAULT_CAMERA_CONFIG.position) {
                const [x, y, z] = DEFAULT_CAMERA_CONFIG.position;
                cameraRef.current.position.set(x, y, z);
                // Ensure camera looks at the new target (0,0,0)
                cameraRef.current.lookAt(0, 0, 0);
              }

              if (controlsRef.current) {
                controlsRef.current.update();
              }
            }
          }}
          isTransformDirty={isTransformDirty}
          hudVisible={hudVisible}
        />
      </div>
      <ShareModal
        isOpen={shareModalOpen}
        imageUrl={screenshotUrl}
        onClose={handleCloseShareModal}
      />
    </div>
  );
}
