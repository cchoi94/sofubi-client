import { useEffect, useCallback, useRef } from "react";
import { Spherical, Vector3 } from "three";
import type { PerspectiveCamera, CanvasTexture } from "three";
import gsap from "gsap";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HOTKEYS } from "~/constants/hotkeys";
import { CursorMode, BrushType, BRUSH_PRESETS } from "~/constants";
import type { BrushState } from "~/constants/types";

// ============================================================================
// TYPES
// ============================================================================

export interface UndoRedoState {
  imageData: ImageData;
  thicknessMap: Float32Array;
}

export interface KeyboardShortcutsConfig {
  // Refs for Three.js objects (for orbit control)
  cameraRef: React.RefObject<PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;

  // Refs for undo/redo system
  paintCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  paintTextureRef: React.RefObject<CanvasTexture | null>;
  thicknessMapRef: React.RefObject<Float32Array | null>;
  undoHistoryRef: React.RefObject<UndoRedoState[]>;
  redoHistoryRef: React.RefObject<UndoRedoState[]>;

  // Canvas size for undo/redo
  canvasSize: number;

  // Current cursor mode for hold-to-override
  cursorMode: CursorMode;

  // Brush ref for size adjustments
  brushRef: React.RefObject<BrushState>;

  // State setters
  setCursorMode: (mode: CursorMode) => void;
  handleBrushChange: (brush: Partial<BrushState>) => void;

  // Save callback for Cmd+S
  onSave?: () => void;

  // Orbit animation settings
  orbitAngle?: number;
  orbitDuration?: number;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook that handles all keyboard shortcuts for the painting app.
 * Includes:
 * - Cursor mode hold-to-override (Space for Move, R for Rotate)
 * - Brush type switching (A/B/F)
 * - Undo/Redo (Cmd+Z / Cmd+Shift+Z)
 * - Camera orbit (Arrow keys)
 */
export function useKeyboardShortcuts({
  cameraRef,
  controlsRef,
  paintCtxRef,
  paintTextureRef,
  thicknessMapRef,
  undoHistoryRef,
  redoHistoryRef,
  canvasSize,
  cursorMode,
  brushRef,
  setCursorMode,
  handleBrushChange,
  onSave,
  orbitAngle = 0.3,
  orbitDuration = 0.5,
}: KeyboardShortcutsConfig) {
  // -------------------------------------------------------------------------
  // Undo Handler
  // -------------------------------------------------------------------------
  const handleUndo = useCallback(() => {
    const ctx = paintCtxRef.current;
    const texture = paintTextureRef.current;
    const thicknessMap = thicknessMapRef.current;
    const undoHistory = undoHistoryRef.current;
    const redoHistory = redoHistoryRef.current;

    if (!ctx || !texture || !thicknessMap || undoHistory.length === 0) return;

    // Save current state to redo before undo
    const currentImageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const currentThickness = new Float32Array(thicknessMap);
    redoHistory.push({
      imageData: currentImageData,
      thicknessMap: currentThickness,
    });

    // Restore undo state
    const undoState = undoHistory.pop()!;
    ctx.putImageData(undoState.imageData, 0, 0);
    thicknessMap.set(undoState.thicknessMap);
    texture.needsUpdate = true;
  }, [
    paintCtxRef,
    paintTextureRef,
    thicknessMapRef,
    undoHistoryRef,
    redoHistoryRef,
    canvasSize,
  ]);

  // -------------------------------------------------------------------------
  // Redo Handler
  // -------------------------------------------------------------------------
  const handleRedo = useCallback(() => {
    const ctx = paintCtxRef.current;
    const texture = paintTextureRef.current;
    const thicknessMap = thicknessMapRef.current;
    const undoHistory = undoHistoryRef.current;
    const redoHistory = redoHistoryRef.current;

    if (!ctx || !texture || !thicknessMap || redoHistory.length === 0) return;

    // Save current state to undo before redo
    const currentImageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
    const currentThickness = new Float32Array(thicknessMap);
    undoHistory.push({
      imageData: currentImageData,
      thicknessMap: currentThickness,
    });

    // Restore redo state
    const redoState = redoHistory.pop()!;
    ctx.putImageData(redoState.imageData, 0, 0);
    thicknessMap.set(redoState.thicknessMap);
    texture.needsUpdate = true;
  }, [
    paintCtxRef,
    paintTextureRef,
    thicknessMapRef,
    undoHistoryRef,
    redoHistoryRef,
    canvasSize,
  ]);

  // -------------------------------------------------------------------------
  // Orbit Camera Handler
  // -------------------------------------------------------------------------
  const handleOrbit = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      // Get current spherical coordinates relative to target
      const offset = camera.position.clone().sub(controls.target);
      const currentSpherical = new Spherical().setFromVector3(offset);

      // Calculate target spherical coordinates
      let targetTheta = currentSpherical.theta;
      let targetPhi = currentSpherical.phi;

      switch (direction) {
        case "left":
          targetTheta += orbitAngle;
          break;
        case "right":
          targetTheta -= orbitAngle;
          break;
        case "up":
          targetPhi = Math.max(0.1, targetPhi - orbitAngle);
          break;
        case "down":
          targetPhi = Math.min(Math.PI - 0.1, targetPhi + orbitAngle);
          break;
      }

      // Animate with GSAP for smooth lerped movement
      const animState = {
        theta: currentSpherical.theta,
        phi: currentSpherical.phi,
      };

      gsap.to(animState, {
        theta: targetTheta,
        phi: targetPhi,
        duration: orbitDuration,
        ease: "power2.out",
        onUpdate: () => {
          const newSpherical = new Spherical(
            currentSpherical.radius,
            animState.phi,
            animState.theta
          );
          const newOffset = new Vector3().setFromSpherical(newSpherical);
          camera.position.copy(controls.target).add(newOffset);
          camera.lookAt(controls.target);
        },
      });
    },
    [cameraRef, controlsRef, orbitAngle, orbitDuration]
  );

  // -------------------------------------------------------------------------
  // Hold-to-override state tracking
  // -------------------------------------------------------------------------
  // Track the mode before hold-to-override was activated
  const previousModeRef = useRef<CursorMode | null>(null);
  // Track which hold key is currently pressed
  const activeHoldKeyRef = useRef<string | null>(null);

  // Keep cursorMode in ref for event handlers
  const cursorModeRef = useRef(cursorMode);
  useEffect(() => {
    cursorModeRef.current = cursorMode;
  }, [cursorMode]);

  // -------------------------------------------------------------------------
  // Main Keyboard Event Handler
  // -------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Handle Cmd+S / Ctrl+S for save
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Handle Cmd+Z / Ctrl+Z for undo, Cmd+Shift+Z / Ctrl+Shift+Z for redo
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      // Handle arrow keys for orbit
      const orbitKeys: Record<string, "left" | "right" | "up" | "down"> = {
        [HOTKEYS.ORBIT_LEFT]: "left",
        [HOTKEYS.ORBIT_RIGHT]: "right",
        [HOTKEYS.ORBIT_UP]: "up",
        [HOTKEYS.ORBIT_DOWN]: "down",
      };

      if (orbitKeys[event.key]) {
        event.preventDefault();
        handleOrbit(orbitKeys[event.key]);
        return;
      }

      // Handle hold-to-override for cursor modes (Space for Move, R for Rotate)
      const key = event.key;

      // Spacebar for Move (hold-to-override)
      if (key === HOTKEYS.CURSOR_MOVE_HOLD && !activeHoldKeyRef.current) {
        event.preventDefault();
        previousModeRef.current = cursorModeRef.current;
        activeHoldKeyRef.current = HOTKEYS.CURSOR_MOVE_HOLD;
        setCursorMode(CursorMode.Move);
        return;
      }

      // R for Rotate (hold-to-override)
      if (
        key.toLowerCase() === HOTKEYS.CURSOR_ROTATE_HOLD.toLowerCase() &&
        !activeHoldKeyRef.current
      ) {
        event.preventDefault();
        previousModeRef.current = cursorModeRef.current;
        activeHoldKeyRef.current = HOTKEYS.CURSOR_ROTATE_HOLD;
        setCursorMode(CursorMode.Rotate);
        return;
      }

      // Handle brush shortcuts (non-hold, regular toggle)
      const lowerKey = key.toLowerCase();

      if (lowerKey === HOTKEYS.BRUSH_AIRBRUSH.toLowerCase()) {
        handleBrushChange({
          ...BRUSH_PRESETS[BrushType.Airbrush],
          paintMaterial: brushRef.current.paintMaterial,
        });
      } else if (lowerKey === HOTKEYS.BRUSH_PAINTBRUSH.toLowerCase()) {
        handleBrushChange({
          ...BRUSH_PRESETS[BrushType.Paintbrush],
          paintMaterial: brushRef.current.paintMaterial,
        });
      } else if (lowerKey === HOTKEYS.BRUSH_FILL.toLowerCase()) {
        handleBrushChange({
          ...BRUSH_PRESETS[BrushType.Fill],
          paintMaterial: brushRef.current.paintMaterial,
        });
      } else if (key === HOTKEYS.BRUSH_SIZE_INCREASE || key === "+") {
        // Increase brush size by 4px
        const currentRadius = brushRef.current?.radius ?? 20;
        const newRadius = Math.min(currentRadius + 4, 200); // Max 200px
        handleBrushChange({ radius: newRadius });
      } else if (key === HOTKEYS.BRUSH_SIZE_DECREASE) {
        // Decrease brush size by 4px
        const currentRadius = brushRef.current?.radius ?? 20;
        const newRadius = Math.max(currentRadius - 4, 1); // Min 1px
        handleBrushChange({ radius: newRadius });
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = event.key;

      // Release Space (Move hold-to-override)
      if (
        key === HOTKEYS.CURSOR_MOVE_HOLD &&
        activeHoldKeyRef.current === HOTKEYS.CURSOR_MOVE_HOLD
      ) {
        if (previousModeRef.current !== null) {
          setCursorMode(previousModeRef.current);
        }
        previousModeRef.current = null;
        activeHoldKeyRef.current = null;
        return;
      }

      // Release R (Rotate hold-to-override)
      if (
        key.toLowerCase() === HOTKEYS.CURSOR_ROTATE_HOLD.toLowerCase() &&
        activeHoldKeyRef.current === HOTKEYS.CURSOR_ROTATE_HOLD
      ) {
        if (previousModeRef.current !== null) {
          setCursorMode(previousModeRef.current);
        }
        previousModeRef.current = null;
        activeHoldKeyRef.current = null;
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    handleUndo,
    handleRedo,
    handleOrbit,
    setCursorMode,
    handleBrushChange,
    onSave,
  ]);

  // Return handlers for potential external use
  return {
    handleUndo,
    handleRedo,
    handleOrbit,
  };
}
