import type { ModelOption } from "./types";

// ============================================================================
// MODEL CONSTANTS
// ============================================================================

/**
 * Available 3D models for painting
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: "godzilla",
    name: "Godzilla",
    path: "/assets/godzilla.glb",
  },
  {
    id: "king_ghidorah",
    name: "King Ghidorah",
    path: "/assets/king_ghidorah.glb",
  },
  {
    id: "mothra",
    name: "Mothra",
    path: "/assets/mothra.glb",
  },
];
