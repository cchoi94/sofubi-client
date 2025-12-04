// Three.js setup utilities
export {
  setupThreeScene,
  createRenderer,
  createScene,
  createEnvironmentMap,
  createCamera,
  createControls,
  createLighting,
  createResizeHandler,
  disposeThreeScene,
  DEFAULT_RENDERER_CONFIG,
  DEFAULT_CAMERA_CONFIG,
  DEFAULT_CONTROLS_CONFIG,
  DEFAULT_LIGHTING_PARAMS,
} from "./setup";
export type {
  RendererConfig,
  CameraConfig,
  ControlsConfig,
  LightingParams,
  ThreeSetupResult,
  LightingSetup,
} from "./setup";

// Brush cursor
export {
  createBrushCursor,
  createCursorState,
  updateBrushCursorAppearance,
  updateCursorBillboard,
  updateCursorSmooth,
  setCursorTarget,
  hideCursor,
} from "./brushCursor";
export type { BrushCursorRefs, CursorState } from "./brushCursor";

// Paint texture
export {
  createPaintTexture,
  clearPaintTexture,
  copyUVTransform,
} from "./paintTexture";
export type { PaintTextureRefs } from "./paintTexture";

// Model loading
export {
  loadModel,
  applyShaderToMeshes,
  animateModelFadeIn,
  updateModelSpin,
} from "./modelLoader";
export type {
  MaterialProps,
  ModelLoadResult,
  ModelLoadCallbacks,
} from "./modelLoader";

// Raycasting
export { raycast, raycastToUV, getCursorStyle } from "./raycasting";
export type { RaycastResult } from "./raycasting";

// Painting
export { paintAtUV } from "./painting";
export type { PaintingRefs } from "./painting";
