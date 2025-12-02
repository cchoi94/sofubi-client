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

// three.js imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Animation and GUI
import gsap from "gsap";
import GUI from "lil-gui";

// ============================================================================
// META FUNCTION
// ============================================================================

export function meta({}: Route.MetaArgs) {
  return [
    { title: "3D Mesh Painter | Sofubi" },
    {
      name: "description",
      content: "Paint directly on 3D models in your browser",
    },
  ];
}

// ============================================================================
// TYPES
// ============================================================================

interface BrushState {
  color: string;
  radius: number;
  opacity: number;
}

interface ShareModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Paint canvas resolution - higher = more detail but slower
const PAINT_CANVAS_SIZE = 2048;

// Default brush settings
const DEFAULT_BRUSH: BrushState = {
  color: "#ff0000",
  radius: 16,
  opacity: 0.5,
};

// Base color for the paint canvas (light gray to see brush strokes)
const BASE_COLOR = "#e0e0e0";

// Path to the 3D model - change this to load a different GLB file
// The model should have proper UV coordinates for painting to work
const MODEL_PATH = "/assets/godzilla/godzilla.glb";

// ============================================================================
// SHARE MODAL COMPONENT
// ============================================================================

function ShareModal({ isOpen, imageUrl, onClose }: ShareModalProps) {
  if (!isOpen) return null;

  // Generate share URLs
  const shareText = encodeURIComponent(
    "Painted this 3D model in the browser 🎨"
  );
  const appUrl = encodeURIComponent(window.location.href);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${appUrl}`;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "painted-model.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Share Your Creation
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1"
            aria-label="Close modal"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Screenshot Preview */}
        <div className="p-6">
          <div className="rounded-lg overflow-hidden border border-slate-600 mb-6">
            <img
              src={imageUrl}
              alt="Screenshot of painted model"
              className="w-full h-auto"
            />
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            {/* Download PNG */}
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download PNG
            </button>

            {/* Share on X (Twitter) */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-950 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </a>

            {/* Open Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium py-3 px-4 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Open Instagram
            </a>
            <p className="text-center text-slate-400 text-sm">
              Download the PNG first, then upload it to Instagram manually
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button
            onClick={onClose}
            className="w-full py-2 text-slate-400 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CONTROLS PANEL COMPONENT
// ============================================================================

interface ControlsPanelProps {
  brush: BrushState;
  onBrushChange: (brush: Partial<BrushState>) => void;
  onClear: () => void;
  onShare: () => void;
  isLoading: boolean;
}

function ControlsPanel({
  brush,
  onBrushChange,
  onClear,
  onShare,
  isLoading,
}: ControlsPanelProps) {
  return (
    <div className="w-72 md:w-80 p-5 border-l border-slate-700 bg-slate-900/95 backdrop-blur-sm flex flex-col controls-panel overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">3D Mesh Painter</h1>
        <p className="text-slate-400 text-sm">
          Click and drag on the model to paint
        </p>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-slate-500 border-t-white rounded-full animate-spin"></div>
            <span className="text-slate-300">Loading model...</span>
          </div>
        </div>
      )}

      {/* Brush Color */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Brush Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={brush.color}
            onChange={(e) => onBrushChange({ color: e.target.value })}
            className="w-12 h-12 rounded-lg cursor-pointer border-2 border-slate-600 bg-transparent"
          />
          <input
            type="text"
            value={brush.color.toUpperCase()}
            onChange={(e) => onBrushChange({ color: e.target.value })}
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-slate-500"
          />
        </div>
      </div>

      {/* Brush Size */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Brush Size: {brush.radius}px
        </label>
        <input
          type="range"
          min="5"
          max="100"
          value={brush.radius}
          onChange={(e) => onBrushChange({ radius: Number(e.target.value) })}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>5px</span>
          <span>100px</span>
        </div>
      </div>

      {/* Brush Opacity */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Brush Opacity: {Math.round(brush.opacity * 100)}%
        </label>
        <input
          type="range"
          min="10"
          max="100"
          value={brush.opacity * 100}
          onChange={(e) =>
            onBrushChange({ opacity: Number(e.target.value) / 100 })
          }
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>10%</span>
          <span>100%</span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-slate-700 my-4"></div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Clear Button */}
        <button
          onClick={onClear}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Clear / Reset
        </button>

        {/* Share Button */}
        <button
          onClick={onShare}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          Share / Export
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-6">
        <div className="text-xs text-slate-500 space-y-1">
          <p>🎨 Left click & drag to paint</p>
          <p>💡 Right drag or arrow keys to orbit</p>
          <p>🔍 Scroll wheel to zoom</p>
        </div>
      </div>
    </div>
  );
}

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

  // Paint system refs
  const paintCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const paintCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const paintTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const brushCursorRef = useRef<THREE.Mesh | null>(null);

  // Painting state (using refs for performance in event handlers)
  const isPaintingRef = useRef<boolean>(false);
  const brushRef = useRef<BrushState>({ ...DEFAULT_BRUSH });

  // React state for UI
  const [brush, setBrush] = useState<BrushState>({ ...DEFAULT_BRUSH });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");

  // Sync brush state with ref for event handlers
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

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
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x1e293b, 1); // slate-800
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
    // Initialize Camera
    // -------------------------------------------------------------------------
    const aspect = container.clientWidth / container.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0.5, 2.5); // Closer to model
    cameraRef.current = camera;

    // -------------------------------------------------------------------------
    // Initialize OrbitControls
    // -------------------------------------------------------------------------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 0.5;
    controls.maxDistance = 8;
    controls.target.set(0, 0, 0);

    // Configure controls: RIGHT mouse button for orbit, middle for pan
    // This leaves left mouse button free for painting
    controls.mouseButtons = {
      LEFT: null as any, // Disable left click for orbit (we use it for painting)
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Enable keyboard controls for arrow keys
    controls.enablePan = true;
    controls.screenSpacePanning = false;

    controlsRef.current = controls;

    // -------------------------------------------------------------------------
    // Initialize Lighting (Lambert-friendly setup for better normal response)
    // -------------------------------------------------------------------------

    // Lighting parameters (will be controlled by lil-gui)
    const lightingParams = {
      hemiIntensity: 0.4,
      hemiSkyColor: 0xffffff,
      hemiGroundColor: 0x444444,
      keyIntensity: 1.5,
      keyColor: 0xffffff,
      fillIntensity: 0.6,
      rimIntensity: 0.4,
      ambientIntensity: 0.2,
    };

    // Ambient light for base illumination
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      lightingParams.ambientIntensity
    );
    scene.add(ambientLight);

    // Hemisphere light - creates natural sky/ground gradient lighting
    // This gives a nice Lambert-like falloff on surfaces
    const hemiLight = new THREE.HemisphereLight(
      lightingParams.hemiSkyColor,
      lightingParams.hemiGroundColor,
      lightingParams.hemiIntensity
    );
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    // Key light (main directional light) - positioned for dramatic Lambert shading
    const keyLight = new THREE.DirectionalLight(
      lightingParams.keyColor,
      lightingParams.keyIntensity
    );
    keyLight.position.set(3, 8, 5);
    scene.add(keyLight);

    // Fill light (softer, opposite side) - reduces harsh shadows
    const fillLight = new THREE.DirectionalLight(
      0xffffff,
      lightingParams.fillIntensity
    );
    fillLight.position.set(-5, 3, -3);
    scene.add(fillLight);

    // Rim light (back light for edge definition)
    const rimLight = new THREE.DirectionalLight(
      0xffffff,
      lightingParams.rimIntensity
    );
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // -------------------------------------------------------------------------
    // Initialize lil-gui for debug controls
    // -------------------------------------------------------------------------
    const gui = new GUI({ title: "🎨 Painter Settings" });
    gui.domElement.style.position = "absolute";
    gui.domElement.style.top = "10px";
    gui.domElement.style.right = "340px";

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
    lightingFolder
      .add(lightingParams, "rimIntensity", 0, 2, 0.01)
      .name("Rim Light")
      .onChange((v: number) => {
        rimLight.intensity = v;
      });
    lightingFolder.open();

    // Material folder (will be populated after model loads)
    const materialFolder = gui.addFolder("Material");
    const materialParams = {
      roughness: 0.7,
      metalness: 0.0,
      normalScale: 1.0,
      envMapIntensity: 0.5,
    };

    // Store material ref for updates
    let currentMaterial: THREE.MeshStandardMaterial | null = null;

    // -------------------------------------------------------------------------
    // Create Brush Cursor (ring that always faces the camera - billboard style)
    // -------------------------------------------------------------------------
    // Use RingGeometry for a flat circle outline that can billboard toward camera
    const cursorGeometry = new THREE.RingGeometry(0.045, 0.05, 32);
    const cursorMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(DEFAULT_BRUSH.color),
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide, // Visible from both sides
      depthTest: false, // Always render on top
      depthWrite: false,
    });
    const brushCursor = new THREE.Mesh(cursorGeometry, cursorMaterial);
    brushCursor.visible = false; // Hidden until mouse is over model
    brushCursor.renderOrder = 999; // Render last (on top)
    scene.add(brushCursor);
    brushCursorRef.current = brushCursor;
    
    // Function to update brush cursor size and color
    const updateBrushCursor = (radius: number, color: string) => {
      // Scale based on brush radius (convert from UV pixels to world units)
      // Approximate: brush radius in pixels / canvas size * model scale
      const worldRadius = (radius / PAINT_CANVAS_SIZE) * 3; // Approximate world scale
      brushCursor.scale.setScalar(worldRadius / 0.05); // 0.05 is base ring outer radius
      
      // Update color
      (brushCursor.material as THREE.MeshBasicMaterial).color.set(color);
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

    // -------------------------------------------------------------------------
    // Create Paint Canvas and Texture
    // -------------------------------------------------------------------------
    const paintCanvas = document.createElement("canvas");
    paintCanvas.width = PAINT_CANVAS_SIZE;
    paintCanvas.height = PAINT_CANVAS_SIZE;
    paintCanvasRef.current = paintCanvas;

    const paintCtx = paintCanvas.getContext("2d");
    if (paintCtx) {
      // Fill with base color
      paintCtx.fillStyle = BASE_COLOR;
      paintCtx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);
      paintCtxRef.current = paintCtx;
    }

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
    const loader = new GLTFLoader();

    loader.load(
      MODEL_PATH,
      (gltf) => {
        const model = gltf.scene;

        // Compute bounding box for the entire model for centering and scaling
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        // Calculate scale to fit model in view (target size ~1.5 units for closer view)
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.5 / maxDim;

        // Apply scale first
        model.scale.setScalar(scale);

        // Recalculate center after scaling
        const scaledBox = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // Center the model at origin
        model.position.sub(scaledCenter);

        // Store all paintable meshes for raycasting
        const paintableMeshes: THREE.Mesh[] = [];

        // Apply paint texture to ALL meshes in the model while PRESERVING original material properties
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const originalMaterial =
              child.material as THREE.MeshStandardMaterial;

            // Log what maps we found in the original material
            console.log("Original material properties:", {
              hasMap: !!originalMaterial.map,
              hasNormalMap: !!originalMaterial.normalMap,
              hasRoughnessMap: !!originalMaterial.roughnessMap,
              hasMetalnessMap: !!originalMaterial.metalnessMap,
              hasAoMap: !!originalMaterial.aoMap,
              hasBumpMap: !!originalMaterial.bumpMap,
              roughness: originalMaterial.roughness,
              metalness: originalMaterial.metalness,
            });

            // Create new material optimized for Lambert-like shading
            // Lower metalness + higher roughness = more diffuse/Lambert response
            const newMaterial = new THREE.MeshStandardMaterial({
              // Use paint texture as the base color map
              map: paintTexture,

              // Preserve normal map from original for surface detail
              normalMap: originalMaterial.normalMap || null,
              normalScale:
                originalMaterial.normalScale?.clone() ||
                new THREE.Vector2(1, 1),

              // For Lambert-like effect: high roughness, low metalness
              // This makes the surface respond more to light direction (normals)
              roughnessMap: originalMaterial.roughnessMap || null,
              roughness: materialParams.roughness, // Higher = more diffuse/matte

              metalnessMap: originalMaterial.metalnessMap || null,
              metalness: materialParams.metalness, // Lower = more Lambert-like

              // Preserve ambient occlusion map
              aoMap: originalMaterial.aoMap || null,
              aoMapIntensity: originalMaterial.aoMapIntensity ?? 1.0,

              // Preserve bump map if no normal map
              bumpMap: originalMaterial.bumpMap || null,
              bumpScale: originalMaterial.bumpScale ?? 1.0,

              // Preserve emissive properties
              emissive:
                originalMaterial.emissive?.clone() || new THREE.Color(0x000000),
              emissiveMap: originalMaterial.emissiveMap || null,
              emissiveIntensity: originalMaterial.emissiveIntensity ?? 1.0,

              // Environment map intensity for subtle reflections
              envMapIntensity: materialParams.envMapIntensity,
              side: originalMaterial.side ?? THREE.FrontSide,

              // Flat shading can enhance the geometric feel (optional)
              flatShading: false,
            });

            // Copy UV transform if the original texture had one
            if (originalMaterial.map) {
              paintTexture.repeat.copy(originalMaterial.map.repeat);
              paintTexture.offset.copy(originalMaterial.map.offset);
              paintTexture.rotation = originalMaterial.map.rotation;
              paintTexture.center.copy(originalMaterial.map.center);
            }

            child.material = newMaterial;
            currentMaterial = newMaterial; // Store for GUI updates
            paintableMeshes.push(child);
          }
        });

        // Setup material GUI controls after model loads
        materialFolder
          .add(materialParams, "roughness", 0, 1, 0.01)
          .name("Roughness")
          .onChange((v: number) => {
            paintableMeshes.forEach((mesh) => {
              (mesh.material as THREE.MeshStandardMaterial).roughness = v;
            });
          });
        materialFolder
          .add(materialParams, "metalness", 0, 1, 0.01)
          .name("Metalness")
          .onChange((v: number) => {
            paintableMeshes.forEach((mesh) => {
              (mesh.material as THREE.MeshStandardMaterial).metalness = v;
            });
          });
        materialFolder
          .add(materialParams, "normalScale", 0, 3, 0.01)
          .name("Normal Strength")
          .onChange((v: number) => {
            paintableMeshes.forEach((mesh) => {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat.normalScale) mat.normalScale.set(v, v);
            });
          });
        materialFolder
          .add(materialParams, "envMapIntensity", 0, 2, 0.01)
          .name("Env Reflection")
          .onChange((v: number) => {
            paintableMeshes.forEach((mesh) => {
              (mesh.material as THREE.MeshStandardMaterial).envMapIntensity = v;
            });
          });
        materialFolder.open();

        // Store the first mesh for raycasting (or we could store all)
        if (paintableMeshes.length > 0) {
          meshRef.current = paintableMeshes[0];
        }

        // Store model reference for raycasting against all meshes
        (model as any).__paintableMeshes = paintableMeshes;

        scene.add(model);
        
        // GSAP fade-in animation for the model
        // Start with opacity 0 and scale slightly smaller
        paintableMeshes.forEach((mesh) => {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.transparent = true;
          mat.opacity = 0;
        });
        model.scale.setScalar(scale * 0.9); // Start slightly smaller
        
        // Animate opacity and scale
        const fadeInState = { opacity: 0, scale: scale * 0.9 };
        gsap.to(fadeInState, {
          opacity: 1,
          scale: scale,
          duration: 0.8,
          ease: 'power2.out',
          onUpdate: () => {
            paintableMeshes.forEach((mesh) => {
              (mesh.material as THREE.MeshStandardMaterial).opacity = fadeInState.opacity;
            });
            model.scale.setScalar(fadeInState.scale);
          },
          onComplete: () => {
            // Optionally disable transparency after fade completes for better performance
            // paintableMeshes.forEach((mesh) => {
            //   (mesh.material as THREE.MeshStandardMaterial).transparent = false;
            // });
          }
        });
        
        setIsLoading(false);

        // Update controls target to model center
        controls.target.set(0, 0, 0);
        controls.update();

        console.log(
          `Loaded model with ${paintableMeshes.length} paintable meshes`
        );
      },
      (progress) => {
        // Optional: track loading progress
        const percent = (progress.loaded / progress.total) * 100;
        console.log(`Loading model: ${percent.toFixed(1)}%`);
      },
      (error) => {
        console.error("Error loading model:", error);
        setIsLoading(false);
      }
    );

    // -------------------------------------------------------------------------
    // Animation Loop
    // -------------------------------------------------------------------------
    const animate = () => {
      controls.update();
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
     * UV coordinates range from 0-1, we convert to pixel coordinates.
     * Y is inverted because UV origin is bottom-left, but canvas origin is top-left.
     *
     * Note: Some models have UVs outside 0-1 range (tiled/repeating textures).
     * We use modulo to wrap them back into the valid range.
     */
    const paintAtUV = (uv: THREE.Vector2) => {
      const ctx = paintCtxRef.current;
      const texture = paintTextureRef.current;
      if (!ctx || !texture) return;

      // Wrap UV coordinates to 0-1 range using modulo
      // This handles models with UVs outside the standard range
      let u = uv.x % 1;
      let v = uv.y % 1;

      // Handle negative values (JS modulo can return negative)
      if (u < 0) u += 1;
      if (v < 0) v += 1;

      // Convert UV coordinates (0-1) to pixel coordinates
      const px = u * PAINT_CANVAS_SIZE;
      // Invert Y: UV's Y=0 is at bottom, but canvas Y=0 is at top
      const py = (1 - v) * PAINT_CANVAS_SIZE;

      const brush = brushRef.current;

      // Convert hex color to rgba with opacity
      const hexToRgba = (hex: string, opacity: number): string => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      };

      // Draw brush stroke (circle) at the UV position
      ctx.fillStyle = hexToRgba(brush.color, brush.opacity);
      ctx.beginPath();
      ctx.arc(px, py, brush.radius, 0, Math.PI * 2);
      ctx.fill();

      // Mark texture for update in the next render frame
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
    
    const raycast = (event: PointerEvent | MouseEvent): RaycastResult | null => {
      const currentScene = sceneRef.current;
      const camera = cameraRef.current;
      if (!currentScene || !camera || !container) return null;

      const rect = container.getBoundingClientRect();

      // Convert screen coordinates to normalized device coordinates (-1 to 1)
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      mouseRef.current.set(x, y);
      raycasterRef.current.setFromCamera(mouseRef.current, camera);

      // Check for intersections with ALL objects in the scene
      const intersects = raycasterRef.current.intersectObjects(
        currentScene.children,
        true
      );

      // Find first intersection that has UV coordinates (is a mesh, not the cursor)
      for (const intersect of intersects) {
        // Skip the brush cursor itself
        if (intersect.object === brushCursorRef.current) continue;
        
        if (intersect.uv && intersect.object instanceof THREE.Mesh && intersect.face) {
          return {
            uv: intersect.uv.clone(),
            point: intersect.point.clone(),
            normal: intersect.face.normal.clone().transformDirection(intersect.object.matrixWorld),
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
     * Pointer down handler - LEFT click only for painting.
     * Right click is handled by OrbitControls for camera rotation.
     */
    const handlePointerDown = (event: PointerEvent) => {
      // Only paint with LEFT mouse button (button === 0)
      if (event.button === 0) {
        const uv = raycastToUV(event);

        if (uv) {
          // We hit the model, start painting
          event.preventDefault();
          isPaintingRef.current = true;
          paintAtUV(uv);
        }
      }
      // Right click (button === 2) is handled by OrbitControls automatically
    };

    /**
     * Pointer move handler - update brush cursor and paint if in painting mode.
     */
    const handlePointerMove = (event: PointerEvent) => {
      const result = raycast(event);
      
      if (result) {
        // Update brush cursor position and orientation
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = true;
          cursor.position.copy(result.point);
          
          // Add small offset along normal to prevent z-fighting
          cursor.position.addScaledVector(result.normal, 0.01);
          
          // Make the cursor face the camera (billboard style)
          updateCursorBillboard();
          
          // Update cursor appearance based on current brush settings
          updateBrushCursor(brushRef.current.radius, brushRef.current.color);
        }
        
        // Paint if in painting mode
        if (isPaintingRef.current) {
          paintAtUV(result.uv);
        }
      } else {
        // Hide cursor when not over model
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = false;
        }
      }
    };
    
    /**
     * Handle mouse leaving the canvas - hide cursor.
     */
    const handlePointerLeave = () => {
      isPaintingRef.current = false;
      const cursor = brushCursorRef.current;
      if (cursor) {
        cursor.visible = false;
      }
    };

    /**
     * Pointer up handler - stop painting.
     */
    const handlePointerUp = () => {
      isPaintingRef.current = false;
    };

    /**
     * Prevent context menu on right-click since we use it for orbit.
     */
    const handleContextMenu = (event: Event) => {
      event.preventDefault();
    };

    /**
     * Keyboard handler for arrow key orbit control with GSAP smooth animation.
     * Arrow keys rotate the camera around the model with eased lerping.
     */
    const ORBIT_ANGLE = 0.3; // Radians per keypress (larger for visible movement)
    const ORBIT_DURATION = 0.5; // Animation duration in seconds

    // Track if animation is in progress to prevent stacking
    let isAnimating = false;

    const handleKeyDown = (event: KeyboardEvent) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      // Prevent default arrow key scrolling
      if (
        ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      ) {
        event.preventDefault();
      }

      // Get current spherical coordinates relative to target
      const offset = camera.position.clone().sub(controls.target);
      const currentSpherical = new THREE.Spherical().setFromVector3(offset);

      // Calculate target spherical coordinates
      let targetTheta = currentSpherical.theta;
      let targetPhi = currentSpherical.phi;

      switch (event.key) {
        case "ArrowLeft":
          targetTheta += ORBIT_ANGLE;
          break;
        case "ArrowRight":
          targetTheta -= ORBIT_ANGLE;
          break;
        case "ArrowUp":
          targetPhi = Math.max(0.1, targetPhi - ORBIT_ANGLE);
          break;
        case "ArrowDown":
          targetPhi = Math.min(Math.PI - 0.1, targetPhi + ORBIT_ANGLE);
          break;
        default:
          return; // Don't process other keys
      }

      // Animate with GSAP for smooth lerped movement
      const animState = {
        theta: currentSpherical.theta,
        phi: currentSpherical.phi,
      };

      gsap.to(animState, {
        theta: targetTheta,
        phi: targetPhi,
        duration: ORBIT_DURATION,
        ease: "power2.out", // Smooth easing
        onUpdate: () => {
          const newSpherical = new THREE.Spherical(
            currentSpherical.radius,
            animState.phi,
            animState.theta
          );
          const newOffset = new THREE.Vector3().setFromSpherical(newSpherical);
          camera.position.copy(controls.target).add(newOffset);
          camera.lookAt(controls.target);
        },
      });
    };

    // Add event listeners
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

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
      window.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("contextmenu", handleContextMenu);

      // Dispose of lil-gui
      gui.destroy();

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
  }, []);

  // ============================================================================
  // BRUSH CHANGE HANDLER
  // ============================================================================

  const handleBrushChange = useCallback((changes: Partial<BrushState>) => {
    setBrush((prev) => ({ ...prev, ...changes }));
  }, []);

  // ============================================================================
  // CLEAR CANVAS HANDLER
  // ============================================================================

  const handleClear = useCallback(() => {
    const ctx = paintCtxRef.current;
    const texture = paintTextureRef.current;
    if (!ctx || !texture) return;

    // Fill paint canvas with base color
    ctx.fillStyle = BASE_COLOR;
    ctx.fillRect(0, 0, PAINT_CANVAS_SIZE, PAINT_CANVAS_SIZE);

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
  // RENDER
  // ============================================================================

  return (
    <div className="h-screen w-screen flex bg-slate-900 overflow-hidden">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="flex-1 relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full block"
          style={{ touchAction: "none" }} // Prevent touch scroll interference
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-slate-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-300">Loading 3D Model...</p>
            </div>
          </div>
        )}

        {/* Instructions Overlay */}
        {!isLoading && (
          <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-slate-300">
            <span className="text-slate-400">Paint:</span> Left click
            &nbsp;|&nbsp;
            <span className="text-slate-400">Orbit:</span> Right drag / Arrow
            keys &nbsp;|&nbsp;
            <span className="text-slate-400">Zoom:</span> Scroll wheel
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <ControlsPanel
        brush={brush}
        onBrushChange={handleBrushChange}
        onClear={handleClear}
        onShare={handleShare}
        isLoading={isLoading}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        imageUrl={screenshotUrl}
        onClose={handleCloseShareModal}
      />
    </div>
  );
}
