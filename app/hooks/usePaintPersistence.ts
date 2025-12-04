import { useCallback, useEffect, useRef } from "react";
import type * as THREE from "three";
import { PAINT_CANVAS_SIZE } from "~/constants";

// ============================================================================
// TYPES
// ============================================================================

export interface PersistentPaintState {
  // Paint canvas as base64 data URL (JPEG compressed)
  canvasData: string;
  // Thickness map - sparse encoded (only non-zero values)
  thicknessData: string;
  // Current shader ID
  shaderId: string;
  // Timestamp for versioning
  timestamp: number;
  // Canvas size (for validation)
  canvasSize: number;
  // Version for future compatibility
  version: number;
}

/** Root storage structure containing all model paint states */
export interface PaintStorageRoot {
  // Currently/last selected model ID
  lastModelId: string | null;
  // Per-model paint states
  models: Record<string, PersistentPaintState>;
  // Version for future compatibility
  version: number;
}

export interface UsePaintPersistenceOptions {
  /** Storage key */
  storageKey?: string;
  /** Auto-save interval in ms (0 to disable) */
  autoSaveInterval?: number;
}

export interface UsePaintPersistenceReturn {
  /** Save current paint state for the current model (non-blocking) */
  saveState: () => void;
  /** Load paint state for a specific model */
  loadState: (modelId: string) => PersistentPaintState | null;
  /** Clear saved state for a specific model */
  clearState: (modelId: string) => void;
  /** Clear all saved states */
  clearAllStates: () => void;
  /** Check if there's saved state for a model */
  hasSavedState: (modelId: string) => boolean;
  /** Check if there's any saved state at all */
  hasAnySavedState: () => boolean;
  /** Get all model IDs with saved paint states */
  getSavedModelIds: () => string[];
  /** Restore paint state to canvas for a specific model (async, loads image) */
  restoreToCanvas: (
    modelId: string,
    ctx: CanvasRenderingContext2D,
    texture: THREE.CanvasTexture,
    thicknessMap: Float32Array
  ) => Promise<boolean>;
  /** Get the last selected model ID */
  getLastModelId: () => string | null;
  /** Set the last selected model ID */
  setLastModelId: (modelId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_STORAGE_KEY = "sofubi_paint_state";
const DEFAULT_AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const STATE_VERSION = 3; // Bump when format changes (3 = nested per-model)
const STORAGE_ROOT_VERSION = 1;

// JPEG quality for canvas export (0.0 - 1.0)
const CANVAS_JPEG_QUALITY = 0.6;

// Minimum threshold for thickness values to save (skip near-zero)
const THICKNESS_THRESHOLD = 0.001;

// ============================================================================
// SPARSE ENCODING UTILITIES
// ============================================================================

/**
 * Encode thickness map sparsely - only store non-zero values
 */
function encodeSparseThickness(arr: Float32Array): string {
  const sparse: [number, number][] = [];

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > THICKNESS_THRESHOLD) {
      sparse.push([i, Math.round(arr[i] * 100) / 100]);
    }
  }

  if (sparse.length > arr.length * 0.25) {
    return "rle:" + encodeRLE(arr);
  }

  return "sparse:" + JSON.stringify(sparse);
}

function encodeRLE(arr: Float32Array): string {
  const runs: [number, number][] = [];
  let currentVal = Math.round(arr[0] * 100);
  let count = 1;

  for (let i = 1; i < arr.length; i++) {
    const val = Math.round(arr[i] * 100);
    if (val === currentVal) {
      count++;
    } else {
      runs.push([currentVal, count]);
      currentVal = val;
      count = 1;
    }
  }
  runs.push([currentVal, count]);

  return JSON.stringify(runs);
}

function decodeRLE(data: string, length: number): Float32Array {
  const runs: [number, number][] = JSON.parse(data);
  const arr = new Float32Array(length);
  let index = 0;

  for (const [val, count] of runs) {
    const floatVal = val / 100;
    for (let i = 0; i < count && index < length; i++) {
      arr[index++] = floatVal;
    }
  }

  return arr;
}

function decodeSparseThickness(
  data: string,
  length: number
): Float32Array | null {
  try {
    if (data.startsWith("rle:")) {
      return decodeRLE(data.slice(4), length);
    }

    if (data.startsWith("sparse:")) {
      const sparse: [number, number][] = JSON.parse(data.slice(7));
      const arr = new Float32Array(length);
      for (const [index, value] of sparse) {
        if (index < length) {
          arr[index] = value;
        }
      }
      return arr;
    }

    return base64ToArray(data, length);
  } catch (e) {
    console.error("Failed to decode thickness data:", e);
    return null;
  }
}

function base64ToArray(
  base64: string,
  expectedLength: number
): Float32Array | null {
  try {
    const binary = atob(base64);
    const uint8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      uint8[i] = binary.charCodeAt(i);
    }
    const result = new Float32Array(uint8.buffer);
    if (result.length !== expectedLength) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

function loadImageToCanvas(
  dataUrl: string,
  ctx: CanvasRenderingContext2D
): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(true);
    };
    img.onerror = () => {
      console.error("Failed to load saved canvas image");
      resolve(false);
    };
    img.src = dataUrl;
  });
}

// ============================================================================
// STORAGE HELPERS
// ============================================================================

function getStorageRoot(storageKey: string): PaintStorageRoot {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) {
      return { lastModelId: null, models: {}, version: STORAGE_ROOT_VERSION };
    }

    const parsed = JSON.parse(data);

    // Handle legacy single-model format (migrate to new format)
    if (parsed.canvasData !== undefined) {
      console.log("Migrating legacy paint state to new format...");
      // This is the old format - migrate it
      const legacyState = parsed as PersistentPaintState;
      return {
        lastModelId: "godzilla", // Assume old data was godzilla
        models: {
          godzilla: legacyState,
        },
        version: STORAGE_ROOT_VERSION,
      };
    }

    return parsed as PaintStorageRoot;
  } catch (e) {
    console.error("Failed to parse storage root:", e);
    return { lastModelId: null, models: {}, version: STORAGE_ROOT_VERSION };
  }
}

function setStorageRoot(storageKey: string, root: PaintStorageRoot): void {
  try {
    const serialized = JSON.stringify(root);
    localStorage.setItem(storageKey, serialized);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.error("Storage quota exceeded");
    } else {
      throw e;
    }
  }
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for persisting paint state to localStorage (per model).
 */
export function usePaintPersistence(
  paintCtxRef: React.RefObject<CanvasRenderingContext2D | null>,
  paintTextureRef: React.RefObject<THREE.CanvasTexture | null>,
  thicknessMapRef: React.RefObject<Float32Array | null>,
  currentShaderIdRef: React.RefObject<string>,
  currentModelIdRef: React.RefObject<string>,
  options: UsePaintPersistenceOptions = {}
): UsePaintPersistenceReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
  } = options;

  const isSavingRef = useRef(false);
  const lastSaveRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // Save State for Current Model
  // -------------------------------------------------------------------------
  const saveState = useCallback(() => {
    if (isSavingRef.current) {
      console.log("Save already in progress, skipping");
      return;
    }

    const ctx = paintCtxRef.current;
    const thicknessMap = thicknessMapRef.current;
    const shaderId = currentShaderIdRef.current;
    const modelId = currentModelIdRef.current;

    if (!ctx || !thicknessMap || !modelId) {
      console.warn("Cannot save paint state: missing refs");
      return;
    }

    const canvasDataUrl = ctx.canvas.toDataURL(
      "image/jpeg",
      CANVAS_JPEG_QUALITY
    );
    const thicknessSnapshot = new Float32Array(thicknessMap);

    isSavingRef.current = true;

    const doSave = () => {
      try {
        const thicknessData = encodeSparseThickness(thicknessSnapshot);

        const state: PersistentPaintState = {
          canvasData: canvasDataUrl,
          thicknessData: thicknessData,
          shaderId,
          timestamp: Date.now(),
          canvasSize: ctx.canvas.width,
          version: STATE_VERSION,
        };

        const root = getStorageRoot(storageKey);
        root.models[modelId] = state;
        root.lastModelId = modelId;

        setStorageRoot(storageKey, root);
        lastSaveRef.current = Date.now();

        const totalSize = JSON.stringify(root).length;
        console.log(
          `Paint state saved for ${modelId} (total: ${(totalSize / 1024).toFixed(1)}KB)`
        );
      } catch (e) {
        console.error("Failed to save paint state:", e);
      } finally {
        isSavingRef.current = false;
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(doSave, { timeout: 5000 });
    } else {
      setTimeout(doSave, 0);
    }
  }, [
    paintCtxRef,
    thicknessMapRef,
    currentShaderIdRef,
    currentModelIdRef,
    storageKey,
  ]);

  // -------------------------------------------------------------------------
  // Load State for a Specific Model
  // -------------------------------------------------------------------------
  const loadState = useCallback(
    (modelId: string): PersistentPaintState | null => {
      try {
        const root = getStorageRoot(storageKey);
        const state = root.models[modelId];

        if (!state) return null;

        if (!state.canvasData || !state.thicknessData) {
          console.warn("Invalid saved state for model:", modelId);
          return null;
        }

        return state;
      } catch (e) {
        console.error("Failed to load paint state:", e);
        return null;
      }
    },
    [storageKey]
  );

  // -------------------------------------------------------------------------
  // Clear State for a Specific Model
  // -------------------------------------------------------------------------
  const clearState = useCallback(
    (modelId: string) => {
      const root = getStorageRoot(storageKey);
      delete root.models[modelId];
      setStorageRoot(storageKey, root);
      console.log(`Paint state cleared for ${modelId}`);
    },
    [storageKey]
  );

  // -------------------------------------------------------------------------
  // Clear All States
  // -------------------------------------------------------------------------
  const clearAllStates = useCallback(() => {
    localStorage.removeItem(storageKey);
    console.log("All paint states cleared");
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Check if Saved State Exists for a Model
  // -------------------------------------------------------------------------
  const hasSavedState = useCallback(
    (modelId: string): boolean => {
      const root = getStorageRoot(storageKey);
      return modelId in root.models;
    },
    [storageKey]
  );

  // -------------------------------------------------------------------------
  // Check if Any Saved State Exists
  // -------------------------------------------------------------------------
  const hasAnySavedState = useCallback((): boolean => {
    const root = getStorageRoot(storageKey);
    return Object.keys(root.models).length > 0;
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Get All Saved Model IDs
  // -------------------------------------------------------------------------
  const getSavedModelIds = useCallback((): string[] => {
    const root = getStorageRoot(storageKey);
    return Object.keys(root.models);
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Get Last Selected Model ID
  // -------------------------------------------------------------------------
  const getLastModelId = useCallback((): string | null => {
    const root = getStorageRoot(storageKey);
    return root.lastModelId;
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Set Last Selected Model ID
  // -------------------------------------------------------------------------
  const setLastModelId = useCallback(
    (modelId: string) => {
      const root = getStorageRoot(storageKey);
      root.lastModelId = modelId;
      setStorageRoot(storageKey, root);
    },
    [storageKey]
  );

  // -------------------------------------------------------------------------
  // Restore State to Canvas
  // -------------------------------------------------------------------------
  const restoreToCanvas = useCallback(
    async (
      modelId: string,
      ctx: CanvasRenderingContext2D,
      texture: THREE.CanvasTexture,
      thicknessMap: Float32Array
    ): Promise<boolean> => {
      const state = loadState(modelId);
      if (!state) return false;

      try {
        const imageLoaded = await loadImageToCanvas(state.canvasData, ctx);
        if (!imageLoaded) return false;

        const decodedThickness = decodeSparseThickness(
          state.thicknessData,
          PAINT_CANVAS_SIZE * PAINT_CANVAS_SIZE
        );
        if (decodedThickness) {
          thicknessMap.set(decodedThickness);
        }

        texture.needsUpdate = true;

        console.log(
          `Paint state restored for ${modelId} (saved at: ${new Date(state.timestamp).toLocaleString()})`
        );
        return true;
      } catch (e) {
        console.error("Failed to restore paint state:", e);
        return false;
      }
    },
    [loadState]
  );

  // -------------------------------------------------------------------------
  // Auto-save on interval
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (autoSaveInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (
        paintCtxRef.current &&
        thicknessMapRef.current &&
        currentModelIdRef.current &&
        !isSavingRef.current
      ) {
        saveState();
      }
    }, autoSaveInterval);

    return () => clearInterval(intervalId);
  }, [
    autoSaveInterval,
    saveState,
    paintCtxRef,
    thicknessMapRef,
    currentModelIdRef,
  ]);

  // -------------------------------------------------------------------------
  // Save on page unload
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = () => {
      const ctx = paintCtxRef.current;
      const thicknessMap = thicknessMapRef.current;
      const shaderId = currentShaderIdRef.current;
      const modelId = currentModelIdRef.current;

      if (!ctx || !thicknessMap || !modelId) return;

      try {
        const canvasDataUrl = ctx.canvas.toDataURL(
          "image/jpeg",
          CANVAS_JPEG_QUALITY
        );
        const thicknessData = encodeSparseThickness(thicknessMap);

        const state: PersistentPaintState = {
          canvasData: canvasDataUrl,
          thicknessData,
          shaderId,
          timestamp: Date.now(),
          canvasSize: ctx.canvas.width,
          version: STATE_VERSION,
        };

        const root = getStorageRoot(storageKey);
        root.models[modelId] = state;
        root.lastModelId = modelId;

        localStorage.setItem(storageKey, JSON.stringify(root));
      } catch (e) {
        console.error("Failed to save on unload:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [
    paintCtxRef,
    thicknessMapRef,
    currentShaderIdRef,
    currentModelIdRef,
    storageKey,
  ]);

  return {
    saveState,
    loadState,
    clearState,
    clearAllStates,
    hasSavedState,
    hasAnySavedState,
    getSavedModelIds,
    restoreToCanvas,
    getLastModelId,
    setLastModelId,
  };
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

export function checkHasAnySavedPaintState(
  storageKey: string = DEFAULT_STORAGE_KEY
): boolean {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return false;
    const parsed = JSON.parse(data);
    // Handle legacy format
    if (parsed.canvasData !== undefined) return true;
    // New format
    return Object.keys(parsed.models || {}).length > 0;
  } catch {
    return false;
  }
}

export function getLastSelectedModelId(
  storageKey: string = DEFAULT_STORAGE_KEY
): string | null {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return null;
    const parsed = JSON.parse(data);
    // Handle legacy format
    if (parsed.canvasData !== undefined) return "godzilla";
    return parsed.lastModelId || null;
  } catch {
    return null;
  }
}

export function getSavedModelIds(
  storageKey: string = DEFAULT_STORAGE_KEY
): string[] {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return [];
    const parsed = JSON.parse(data);
    // Handle legacy format
    if (parsed.canvasData !== undefined) return ["godzilla"];
    return Object.keys(parsed.models || {});
  } catch {
    return [];
  }
}
