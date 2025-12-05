import { useState, useCallback, useRef, useEffect } from "react";
import { DEFAULT_BRUSH } from "~/constants";
import type { BrushState } from "~/constants/types";

// ============================================================================
// USE BRUSH HOOK
// ============================================================================

export interface UseBrushReturn {
  // State
  brush: BrushState;
  colorHistory: string[];
  brushRef: React.MutableRefObject<BrushState>;

  // Handlers
  handleBrushChange: (changes: Partial<BrushState>) => void;
  handleColorSelect: (color: string) => void;
  handleColorCommit: (color: string) => void;
  setBrush: React.Dispatch<React.SetStateAction<BrushState>>;
}

/**
 * Custom hook for managing brush state and color history
 * Encapsulates all brush-related logic for the painting application
 */
export function useBrush(): UseBrushReturn {
  // Brush state
  const [brush, setBrush] = useState<BrushState>({ ...DEFAULT_BRUSH });
  const [colorHistory, setColorHistory] = useState<string[]>([]);

  // Ref for brush state (used in event handlers for performance)
  const brushRef = useRef<BrushState>({ ...DEFAULT_BRUSH });

  // Sync brush state with ref for event handlers
  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  // Load saved color from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedColor = localStorage.getItem("sofubi_last_color");
      if (savedColor) {
        setBrush((prev) => ({ ...prev, color: savedColor }));
        brushRef.current.color = savedColor;
      }
    }
  }, []);

  /**
   * Handle partial brush state changes
   */
  const handleBrushChange = useCallback((changes: Partial<BrushState>) => {
    setBrush((prev) => ({ ...prev, ...changes }));
  }, []);

  /**
   * Handle color selection (updates brush color immediately)
   */
  const handleColorSelect = useCallback((color: string) => {
    setBrush((prev) => ({ ...prev, color }));
    brushRef.current.color = color;
  }, []);

  /**
   * Handle color commit (updates brush color and adds to history)
   * Called when color picker closes or user confirms a color
   */
  const handleColorCommit = useCallback((color: string) => {
    // Update brush color
    setBrush((prev) => ({ ...prev, color }));
    brushRef.current.color = color;

    // Save to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("sofubi_last_color", color);
    }

    // Add to history (avoid duplicates, keep last 5 for history display)
    setColorHistory((prev) => {
      const filtered = prev.filter(
        (c) => c.toLowerCase() !== color.toLowerCase()
      );
      return [color, ...filtered].slice(0, 5);
    });
  }, []);

  return {
    // State
    brush,
    colorHistory,
    brushRef,

    // Handlers
    handleBrushChange,
    handleColorSelect,
    handleColorCommit,
    setBrush,
  };
}

export default useBrush;
