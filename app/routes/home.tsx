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

// Utility for class names
import { cn } from "../lib/utils";

// Icons
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Trash2,
  Palette,
  Circle,
  Paintbrush,
  Sparkles,
  X,
  Download,
} from "lucide-react";

// UI Components
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";

// three.js imports
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// BVH for fast raycasting
import {
  computeBoundsTree,
  disposeBoundsTree,
  acceleratedRaycast,
} from "three-mesh-bvh";

// Extend THREE.Mesh prototype with BVH methods
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Animation and GUI
import gsap from "gsap";
import GUI from "lil-gui";

// Shader system
import {
  shaders,
  getShaderById,
  DEFAULT_SHADER_ID,
  ShaderId,
  type CustomShader,
  type ShaderConfig,
} from "../shaders";

// ============================================================================
// META FUNCTION
// ============================================================================

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Sofubi World" },
    {
      name: "description",
      content: "Paint directly on 3D models in your browser",
    },
  ];
}

// ============================================================================
// TYPES
// ============================================================================

type BrushType = "airbrush" | "paintbrush";

interface BrushState {
  type: BrushType;
  color: string;
  radius: number;
  opacity: number;
  hardness: number; // 0 = soft edges, 1 = hard edges
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

// Brush presets
const BRUSH_PRESETS: Record<BrushType, Omit<BrushState, "color">> = {
  airbrush: {
    type: "airbrush",
    radius: 50,
    opacity: 1.0,
    hardness: 0.2, // Very soft edges
  },
  paintbrush: {
    type: "paintbrush",
    radius: 16,
    opacity: 1.0,
    hardness: 0.8, // Harder edges
  },
};

// Default brush settings
const DEFAULT_BRUSH: BrushState = {
  ...BRUSH_PRESETS.airbrush,
  color: "#ff0000",
};

// Base color for the paint canvas - changes based on shader
const BASE_COLOR = "#F3E9D7"; // Default warm white

// Shader-specific base colors for better material appearance
const SHADER_BASE_COLORS: Record<string, string> = {
  [ShaderId.STANDARD]: "#F3E9D7", // Warm off-white (sofubi/vinyl look)
  [ShaderId.PEARLESCENT]: "#E8E8EC", // Cool silver-white for chrome
  [ShaderId.TRANSPARENT_PLASTIC]: "#F0F4F8", // Very light blue-white for clear plastic
  [ShaderId.CERAMIC]: "#FAF6F0", // Warm cream for ceramic
  [ShaderId.METAL]: "#C0C0C8", // Silver-gray for die-cast metal
};

// Helper to get base color for a shader
const getBaseColorForShader = (shaderId: string): string => {
  return SHADER_BASE_COLORS[shaderId] || BASE_COLOR;
};

// Available 3D models
interface ModelOption {
  id: string;
  name: string;
  path: string;
  thumbnail?: string;
}

const AVAILABLE_MODELS: ModelOption[] = [
  { id: "godzilla", name: "Godzilla", path: "/assets/godzilla.glb" },
  {
    id: "king_ghidorah",
    name: "King Ghidorah",
    path: "/assets/king_ghidorah.glb",
  },
  { id: "mothra", name: "Mothra", path: "/assets/mothra.glb" },
];

// ============================================================================
// MODEL SELECTION COMPONENT
// ============================================================================

interface ModelSelectionProps {
  onSelectModel: (model: ModelOption) => void;
}

function ModelSelection({ onSelectModel }: ModelSelectionProps) {
  return (
    <div className="fixed inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
      <div className="max-w-4xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">
            🎨 3D Mesh Painter
          </h1>
          <p className="text-slate-400 text-lg">
            Choose a model to start painting
          </p>
        </div>

        {/* Model Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {AVAILABLE_MODELS.map((model) => (
            <Card
              key={model.id}
              onClick={() => onSelectModel(model)}
              className="group cursor-pointer p-6 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10"
            >
              {/* Model Icon/Preview Area */}
              <div className="aspect-square bg-slate-900/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                  {model.id === "godzilla" && "🦖"}
                  {model.id === "king_ghidorah" && "🐉"}
                  {model.id === "mothra" && "🦋"}
                </div>
              </div>

              <CardTitle className="text-xl group-hover:text-blue-400 transition-colors">
                {model.name}
              </CardTitle>
              <CardDescription className="mt-1 group-hover:text-slate-400 transition-colors">
                Click to paint
              </CardDescription>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none" />
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-10 text-slate-500 text-sm">
          <p>
            Paint directly on 3D models • Export your creations • Share with
            friends
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SHARE MODAL COMPONENT
// ============================================================================

function ShareModal({ isOpen, imageUrl, onClose }: ShareModalProps) {
  // Generate share URLs (only on client side)
  const shareText = encodeURIComponent(
    "Painted this 3D model in the browser 🎨"
  );
  const appUrl =
    typeof window !== "undefined"
      ? encodeURIComponent(window.location.href)
      : "";
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg mx-4 p-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share Your Creation</DialogTitle>
        </DialogHeader>

        {/* Screenshot Preview */}
        <div className="p-6 pt-0">
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
            <Button
              variant="success"
              size="lg"
              onClick={handleDownload}
              className="w-full"
            >
              <Download className="w-5 h-5" />
              Download PNG
            </Button>

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

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CONTROLS PANEL COMPONENT
// ============================================================================

interface AnimationState {
  spin: boolean;
  spinSpeed: number;
}

interface ControlsPanelProps {
  brush: BrushState;
  onBrushChange: (brush: Partial<BrushState>) => void;
  onClear: () => void;
  isLoading: boolean;
  isOpen: boolean;
  onToggle: () => void;
  animation: AnimationState;
  onAnimationChange: (animation: Partial<AnimationState>) => void;
  currentShader: string;
  onShaderChange: (shaderId: string) => void;
  backgroundColor: string;
  onBackgroundChange: (color: string) => void;
}

function ControlsPanel({
  brush,
  onBrushChange,
  onClear,
  isLoading,
  isOpen,
  onToggle,
  animation,
  onAnimationChange,
  currentShader,
  onShaderChange,
  backgroundColor,
  onBackgroundChange,
}: ControlsPanelProps) {
  return (
    <>
      {/* Panel Container - includes both toggle button and panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-20",
          "transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-64"
        )}
      >
        {/* Toggle Button - attached to panel, protrudes left */}
        <Button
          variant="outline"
          size="icon"
          onClick={onToggle}
          className={cn(
            "absolute top-4 -left-6.5 z-30 w-7!",
            "bg-zinc-950/95 backdrop-blur-sm border-zinc-800",
            "rounded-l-md rounded-r-none border-r-0 border-0 hover:bg-zinc-950/95!"
          )}
        >
          {isOpen ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>

        {/* Panel */}
        <div
          className={cn(
            "h-full w-64",
            "bg-zinc-950/95 backdrop-blur-md border-l border-zinc-800",
            "flex flex-col"
          )}
        >
          {/* Header */}
          {/* <div className="p-4 border-b border-zinc-800">
          <h1 className="text-sm font-medium text-white">Sofubi Painter</h1>
        </div> */}

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <div className="w-3 h-3 border border-zinc-600 border-t-white rounded-full animate-spin" />
                Loading...
              </div>
            )}

            {/* Shader Selection */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Material
              </Label>
              <div className="grid grid-cols-1 gap-1">
                {shaders.map((shader) => (
                  <Button
                    key={shader.id}
                    variant={currentShader === shader.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => onShaderChange(shader.id)}
                    className={cn(
                      "justify-start",
                      currentShader === shader.id && "font-medium"
                    )}
                  >
                    {shader.name}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Brush Type */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Paintbrush className="w-3 h-3" />
                Brush
              </Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  variant={brush.type === "airbrush" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onBrushChange({ ...BRUSH_PRESETS.airbrush })}
                  className={brush.type === "airbrush" ? "font-medium" : ""}
                >
                  Airbrush
                </Button>
                <Button
                  variant={brush.type === "paintbrush" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onBrushChange({ ...BRUSH_PRESETS.paintbrush })}
                  className={brush.type === "paintbrush" ? "font-medium" : ""}
                >
                  Paintbrush
                </Button>
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Palette className="w-3 h-3" />
                Color
              </Label>
              <div className="flex flex-col gap-1">
                <input
                  type="color"
                  value={brush.color}
                  onChange={(e) => onBrushChange({ color: e.target.value })}
                  className="w-full h-9 rounded-md cursor-pointer bg-transparent"
                />
                <span className="text-[10px] text-right text-zinc-500 font-mono">
                  {brush.color.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Circle className="w-3 h-3" />
                  Size
                </Label>
                <span className="text-xs text-zinc-500">{brush.radius}px</span>
              </div>
              <Slider
                min={5}
                max={brush.type === "airbrush" ? 150 : 100}
                step={1}
                value={[brush.radius]}
                onValueChange={([value]) => onBrushChange({ radius: value })}
              />
            </div>

            <Separator />

            {/* Background Color */}
            <div className="space-y-2">
              <Label>Background</Label>
              <div className="flex flex-col gap-1">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => onBackgroundChange(e.target.value)}
                  className="w-full h-9 rounded-md cursor-pointer bg-transparent"
                />
                <span className="text-[10px] text-right text-zinc-500 font-mono">
                  {backgroundColor.toUpperCase()}
                </span>
              </div>
            </div>

            <Separator />

            {/* Spin Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <RotateCw
                    className={cn("w-3 h-3", animation.spin && "animate-spin")}
                  />
                  Auto Spin
                </Label>
                <Switch
                  checked={animation.spin}
                  onCheckedChange={(checked) =>
                    onAnimationChange({ spin: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-800">
            <Button
              variant="secondary"
              onClick={onClear}
              disabled={isLoading}
              className="w-full"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Canvas
            </Button>
          </div>
        </div>
      </div>
    </>
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
  const thicknessMapRef = useRef<Float32Array | null>(null);

  // Shader system refs
  const currentShaderIdRef = useRef<string>(DEFAULT_SHADER_ID);
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
  const [brush, setBrush] = useState<BrushState>({ ...DEFAULT_BRUSH });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [shareModalOpen, setShareModalOpen] = useState<boolean>(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string>("");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);
  const [animation, setAnimation] = useState<AnimationState>({
    spin: false,
    spinSpeed: 0.5,
  });
  const [currentShader, setCurrentShader] = useState<string>(DEFAULT_SHADER_ID);
  const [backgroundColor, setBackgroundColor] = useState<string>("#1C1C22"); // slate-800

  // Ref for applying shader from outside useEffect
  const applyShaderRef = useRef<((shaderId: string) => void) | null>(null);

  // Animation ref for syncing with three.js loop
  const animationRef = useRef<AnimationState>({ spin: false, spinSpeed: 0.5 });

  // Sync brush state with ref for event handlers
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

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
    camera.position.set(0.7, 0.2, 1.75); // Closer to model
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

    // Configure controls: RIGHT mouse button for orbit, middle for zoom
    // This leaves left mouse button free for painting
    controls.mouseButtons = {
      LEFT: null as any, // Disable left click for orbit (we use it for painting)
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    // Disable panning to keep model centered
    controls.enablePan = false;

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
    // Animation State (for model spin) - uses React ref for syncing
    // -------------------------------------------------------------------------
    let modelRef: THREE.Object3D | null = null; // Reference to the loaded model

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
      lightingFolder
        .add(lightingParams, "rimIntensity", 0, 2, 0.01)
        .name("Rim Light")
        .onChange((v: number) => {
          rimLight.intensity = v;
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
      color: new THREE.Color(DEFAULT_BRUSH.color),
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
    const loader = new GLTFLoader();

    loader.load(
      selectedModel.path,
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

        // First pass: collect meshes and store original material properties
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

            // Store original material properties for shader system
            originalMaterialPropsRef.current.set(child, {
              normalMap: originalMaterial.normalMap || null,
              roughnessMap: originalMaterial.roughnessMap || null,
              metalnessMap: originalMaterial.metalnessMap || null,
              aoMap: originalMaterial.aoMap || null,
              emissiveMap: originalMaterial.emissiveMap || null,
              bumpMap: originalMaterial.bumpMap || null,
            });

            // Copy UV transform if the original texture had one
            if (originalMaterial.map) {
              paintTexture.repeat.copy(originalMaterial.map.repeat);
              paintTexture.offset.copy(originalMaterial.map.offset);
              paintTexture.rotation = originalMaterial.map.rotation;
              paintTexture.center.copy(originalMaterial.map.center);
            }

            paintableMeshes.push(child);

            // Build BVH for fast raycasting
            if (child.geometry) {
              child.geometry.computeBoundsTree();
            }
          }
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
        modelRef = model;

        scene.add(model);

        // GSAP fade-in animation for the model
        // Start with opacity 0 and scale slightly smaller
        paintableMeshes.forEach((mesh) => {
          const mat = mesh.material as THREE.Material;
          mat.transparent = true;
          (mat as any).opacity = 0;
        });
        model.scale.setScalar(scale * 0.9); // Start slightly smaller

        // Animate opacity and scale
        const fadeInState = { opacity: 0, scale: scale * 0.9 };
        gsap.to(fadeInState, {
          opacity: 1,
          scale: scale,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: () => {
            paintableMeshes.forEach((mesh) => {
              const mat = mesh.material as THREE.Material;
              (mat as any).opacity = fadeInState.opacity;

              // For ShaderMaterials, also update the uniform if it exists
              if ((mat as THREE.ShaderMaterial).uniforms?.opacity) {
                (mat as THREE.ShaderMaterial).uniforms.opacity.value =
                  fadeInState.opacity;
              }
            });
            model.scale.setScalar(fadeInState.scale);
          },
          onComplete: () => {
            // Optionally disable transparency after fade completes for better performance
            // paintableMeshes.forEach((mesh) => {
            //   (mesh.material as THREE.Material).transparent = false;
            // });
          },
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
      updateCursorSmooth(); // Smooth cursor interpolation

      // Spin model if enabled (uses React ref for state)
      if (animationRef.current.spin && modelRef) {
        modelRef.rotation.y += 0.01 * animationRef.current.spinSpeed;
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
          paintAtUV(result.uv);
        }
      } else {
        // Hide cursor when not over model
        const cursor = brushCursorRef.current;
        if (cursor) {
          cursor.visible = false;
          cursorInitialized = false; // Reset so next hit snaps immediately
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
  // BACKGROUND COLOR CHANGE HANDLER
  // ============================================================================

  const handleBackgroundChange = useCallback((color: string) => {
    setBackgroundColor(color);
    const renderer = rendererRef.current;
    if (renderer) {
      renderer.setClearColor(color, 1);
    }
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
              <p className="text-slate-300">Loading ...</p>
              {/* <p className="text-slate-300">Loading {selectedModel.name}...</p> */}
            </div>
          </div>
        )}
      </div>

      {/* Controls Panel */}
      <ControlsPanel
        brush={brush}
        onBrushChange={handleBrushChange}
        onClear={handleClear}
        isLoading={isLoading}
        isOpen={isPanelOpen}
        onToggle={() => setIsPanelOpen(!isPanelOpen)}
        animation={animation}
        onAnimationChange={(changes) =>
          setAnimation((prev) => ({ ...prev, ...changes }))
        }
        currentShader={currentShader}
        onShaderChange={handleShaderChange}
        backgroundColor={backgroundColor}
        onBackgroundChange={handleBackgroundChange}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={shareModalOpen}
        imageUrl={screenshotUrl}
        onClose={handleCloseShareModal}
      />

      {/* Help Text - Bottom Left */}
      <p className="fixed bottom-4 left-4 text-[12px] text-zinc-300 z-10">
        Click to paint • Right drag to orbit • Scroll to zoom
      </p>
    </div>
  );
}
