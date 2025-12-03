import { useEffect, useCallback } from "react";
import * as THREE from "three";
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
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>;
  controlsRef: React.RefObject<OrbitControls | null>;

  // Refs for undo/redo system
  paintCtxRef: React.RefObject<CanvasRenderingContext2D | null>;
  paintTextureRef: React.RefObject<THREE.CanvasTexture | null>;
  thicknessMapRef: React.RefObject<Float32Array | null>;
  undoHistoryRef: React.RefObject<UndoRedoState[]>;
  redoHistoryRef: React.RefObject<UndoRedoState[]>;

  // Canvas size for undo/redo
  canvasSize: number;

  // State setters
  setCursorMode: (mode: CursorMode) => void;
  handleBrushChange: (brush: Partial<BrushState>) => void;

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
 * - Cursor mode switching (Q/W)
 * - Brush type switching (1/2)
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
  setCursorMode,
  handleBrushChange,
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
      const currentSpherical = new THREE.Spherical().setFromVector3(offset);

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
    },
    [cameraRef, controlsRef, orbitAngle, orbitDuration]
  );

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

      // Handle cursor mode and brush shortcuts
      const key = event.key.toLowerCase();

      if (key === HOTKEYS.CURSOR_MOVE.toLowerCase()) {
        setCursorMode(CursorMode.Move);
      } else if (key === HOTKEYS.CURSOR_ROTATE.toLowerCase()) {
        setCursorMode(CursorMode.Rotate);
      } else if (key === HOTKEYS.BRUSH_AIRBRUSH) {
        handleBrushChange({ ...BRUSH_PRESETS[BrushType.Airbrush] });
      } else if (key === HOTKEYS.BRUSH_PAINTBRUSH) {
        handleBrushChange({ ...BRUSH_PRESETS[BrushType.Paintbrush] });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleOrbit, setCursorMode, handleBrushChange]);

  // Return handlers for potential external use
  return {
    handleUndo,
    handleRedo,
    handleOrbit,
  };
}
