import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
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

export interface UsePaintPersistenceOptions {
  /** Storage key prefix */
  storageKey?: string;
  /** Auto-save interval in ms (0 to disable) */
  autoSaveInterval?: number;
}

export interface UsePaintPersistenceReturn {
  /** Save current paint state to localStorage (non-blocking) */
  saveState: () => void;
  /** Load paint state from localStorage */
  loadState: () => PersistentPaintState | null;
  /** Clear saved state from localStorage */
  clearState: () => void;
  /** Check if there's saved state */
  hasSavedState: () => boolean;
  /** Restore paint state to canvas (async, loads image) */
  restoreToCanvas: (
    ctx: CanvasRenderingContext2D,
    texture: THREE.CanvasTexture,
    thicknessMap: Float32Array
  ) => Promise<boolean>;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_STORAGE_KEY = "sofubi_paint_state";
const DEFAULT_AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const STATE_VERSION = 2; // Bump when format changes

// JPEG quality for canvas export (0.0 - 1.0)
// Lower = smaller file but more artifacts
const CANVAS_JPEG_QUALITY = 0.6;

// Minimum threshold for thickness values to save (skip near-zero)
const THICKNESS_THRESHOLD = 0.001;

// ============================================================================
// SPARSE ENCODING UTILITIES
// ============================================================================

/**
 * Encode thickness map sparsely - only store non-zero values
 * Format: JSON array of [index, value] pairs
 * Much smaller than full array when most values are 0
 */
function encodeSparseThickness(arr: Float32Array): string {
  const sparse: [number, number][] = [];

  for (let i = 0; i < arr.length; i++) {
    if (arr[i] > THICKNESS_THRESHOLD) {
      // Round to 2 decimal places to save space
      sparse.push([i, Math.round(arr[i] * 100) / 100]);
    }
  }

  // If more than 25% is non-zero, use run-length encoding instead
  if (sparse.length > arr.length * 0.25) {
    return "rle:" + encodeRLE(arr);
  }

  return "sparse:" + JSON.stringify(sparse);
}

/**
 * Simple RLE encoding for dense thickness maps
 */
function encodeRLE(arr: Float32Array): string {
  const runs: [number, number][] = []; // [value * 100, count]
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

/**
 * Decode RLE back to Float32Array
 */
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

/**
 * Decode sparse thickness map back to Float32Array
 */
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

    // Legacy format (v1) - full base64
    return base64ToArray(data, length);
  } catch (e) {
    console.error("Failed to decode thickness data:", e);
    return null;
  }
}

/**
 * Convert base64 to Float32Array (for legacy support)
 */
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
      console.warn("Array size mismatch");
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Load image from data URL and draw to canvas
 */
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
// HOOK
// ============================================================================

/**
 * Hook for persisting paint state to localStorage.
 *
 * OPTIMIZATIONS:
 * - Uses JPEG with reduced quality (much smaller than PNG)
 * - Sparse encoding for thickness map (most values are 0)
 * - Non-blocking saves using requestIdleCallback
 * - Only saves on manual trigger (Cmd+S) or interval (default 30s)
 * - Does NOT save on every stroke to avoid lag
 */
export function usePaintPersistence(
  paintCtxRef: React.RefObject<CanvasRenderingContext2D | null>,
  paintTextureRef: React.RefObject<THREE.CanvasTexture | null>,
  thicknessMapRef: React.RefObject<Float32Array | null>,
  currentShaderIdRef: React.RefObject<string>,
  options: UsePaintPersistenceOptions = {}
): UsePaintPersistenceReturn {
  const {
    storageKey = DEFAULT_STORAGE_KEY,
    autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
  } = options;

  const isSavingRef = useRef(false);
  const lastSaveRef = useRef<number>(0);

  // -------------------------------------------------------------------------
  // Save State (Non-blocking via requestIdleCallback)
  // -------------------------------------------------------------------------
  const saveState = useCallback(() => {
    // Prevent concurrent saves
    if (isSavingRef.current) {
      console.log("Save already in progress, skipping");
      return;
    }

    const ctx = paintCtxRef.current;
    const thicknessMap = thicknessMapRef.current;
    const shaderId = currentShaderIdRef.current;

    if (!ctx || !thicknessMap) {
      console.warn("Cannot save paint state: missing refs");
      return;
    }

    // Capture canvas data synchronously (this is fast)
    const canvasDataUrl = ctx.canvas.toDataURL(
      "image/jpeg",
      CANVAS_JPEG_QUALITY
    );

    // Copy thickness map for async processing
    const thicknessSnapshot = new Float32Array(thicknessMap);

    isSavingRef.current = true;

    // Do the heavy work (encoding + localStorage) in idle time
    const doSave = () => {
      try {
        // Encode thickness sparsely (this can be slow for large arrays)
        const thicknessData = encodeSparseThickness(thicknessSnapshot);

        const state: PersistentPaintState = {
          canvasData: canvasDataUrl,
          thicknessData: thicknessData,
          shaderId,
          timestamp: Date.now(),
          canvasSize: ctx.canvas.width,
          version: STATE_VERSION,
        };

        const serialized = JSON.stringify(state);
        const sizeKB = (serialized.length / 1024).toFixed(1);

        // Try to save
        try {
          localStorage.setItem(storageKey, serialized);
          lastSaveRef.current = Date.now();
          console.log(`Paint state saved (${sizeKB}KB)`);
        } catch (e) {
          if (e instanceof DOMException && e.name === "QuotaExceededError") {
            // Storage full - try with even lower quality
            console.warn("Storage quota exceeded, trying lower quality...");
            const lowQualityData = ctx.canvas.toDataURL("image/jpeg", 0.3);
            state.canvasData = lowQualityData;
            const smallerSerialized = JSON.stringify(state);

            try {
              localStorage.setItem(storageKey, smallerSerialized);
              console.log(
                `Paint state saved with reduced quality (${(smallerSerialized.length / 1024).toFixed(1)}KB)`
              );
            } catch {
              console.error("Cannot save - storage full. Clearing old state.");
              localStorage.removeItem(storageKey);
            }
          } else {
            throw e;
          }
        }
      } catch (e) {
        console.error("Failed to save paint state:", e);
      } finally {
        isSavingRef.current = false;
      }
    };

    // Use requestIdleCallback for non-blocking save
    if (typeof requestIdleCallback !== "undefined") {
      requestIdleCallback(doSave, { timeout: 5000 });
    } else {
      // Fallback for Safari
      setTimeout(doSave, 0);
    }
  }, [paintCtxRef, thicknessMapRef, currentShaderIdRef, storageKey]);

  // -------------------------------------------------------------------------
  // Load State
  // -------------------------------------------------------------------------
  const loadState = useCallback((): PersistentPaintState | null => {
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) return null;

      const state = JSON.parse(data) as PersistentPaintState;

      // Handle legacy format (v1)
      if (!state.version || state.version < 2) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const legacy = state as any;
        if (legacy.canvasDataUrl) {
          state.canvasData = legacy.canvasDataUrl;
        }
        if (legacy.thicknessMapBase64) {
          state.thicknessData = legacy.thicknessMapBase64;
        }
      }

      // Validate the state
      if (!state.canvasData || !state.thicknessData) {
        console.warn("Invalid saved state, missing required fields");
        return null;
      }

      // Check if canvas size matches
      if (state.canvasSize && state.canvasSize !== PAINT_CANVAS_SIZE) {
        console.warn(
          "Canvas size mismatch, saved:",
          state.canvasSize,
          "current:",
          PAINT_CANVAS_SIZE
        );
      }

      return state;
    } catch (e) {
      console.error("Failed to load paint state:", e);
      return null;
    }
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Clear State
  // -------------------------------------------------------------------------
  const clearState = useCallback(() => {
    localStorage.removeItem(storageKey);
    console.log("Paint state cleared from localStorage");
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Check if Saved State Exists
  // -------------------------------------------------------------------------
  const hasSavedState = useCallback((): boolean => {
    return localStorage.getItem(storageKey) !== null;
  }, [storageKey]);

  // -------------------------------------------------------------------------
  // Restore State to Canvas
  // -------------------------------------------------------------------------
  const restoreToCanvas = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      texture: THREE.CanvasTexture,
      thicknessMap: Float32Array
    ): Promise<boolean> => {
      const state = loadState();
      if (!state) return false;

      try {
        // Load canvas image
        const imageLoaded = await loadImageToCanvas(state.canvasData, ctx);
        if (!imageLoaded) return false;

        // Restore thickness map
        const decodedThickness = decodeSparseThickness(
          state.thicknessData,
          PAINT_CANVAS_SIZE * PAINT_CANVAS_SIZE
        );
        if (decodedThickness) {
          thicknessMap.set(decodedThickness);
        }

        // Update texture
        texture.needsUpdate = true;

        console.log(
          "Paint state restored (saved at:",
          new Date(state.timestamp).toLocaleString(),
          ")"
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
  // Auto-save on interval (default 30s)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (autoSaveInterval <= 0) return;

    const intervalId = setInterval(() => {
      if (
        paintCtxRef.current &&
        thicknessMapRef.current &&
        !isSavingRef.current
      ) {
        saveState();
      }
    }, autoSaveInterval);

    return () => clearInterval(intervalId);
  }, [autoSaveInterval, saveState, paintCtxRef, thicknessMapRef]);

  // -------------------------------------------------------------------------
  // Save on page unload (synchronous, cannot use requestIdleCallback)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleBeforeUnload = () => {
      const ctx = paintCtxRef.current;
      const thicknessMap = thicknessMapRef.current;
      const shaderId = currentShaderIdRef.current;

      if (!ctx || !thicknessMap) return;

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

        localStorage.setItem(storageKey, JSON.stringify(state));
      } catch (e) {
        console.error("Failed to save on unload:", e);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [paintCtxRef, thicknessMapRef, currentShaderIdRef, storageKey]);

  return {
    saveState,
    loadState,
    clearState,
    hasSavedState,
    restoreToCanvas,
  };
}

// ============================================================================
// STANDALONE FUNCTIONS
// ============================================================================

export function checkSavedPaintState(
  storageKey: string = DEFAULT_STORAGE_KEY
): boolean {
  return localStorage.getItem(storageKey) !== null;
}

export function getSavedStateTimestamp(
  storageKey: string = DEFAULT_STORAGE_KEY
): Date | null {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return null;
    const state = JSON.parse(data) as PersistentPaintState;
    return new Date(state.timestamp);
  } catch {
    return null;
  }
}

export function getSavedStateShaderId(
  storageKey: string = DEFAULT_STORAGE_KEY
): string | null {
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return null;
    const state = JSON.parse(data) as PersistentPaintState;
    return state.shaderId;
  } catch {
    return null;
  }
}
