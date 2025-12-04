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
    id: "astro_boy",
    name: "Astro Boy",
    path: "/assets/astro_boy.glb",
    disabled: true,
  },
];

/**
 * Get a random selection of models for the selector
 * @param count Number of models to select (defaults to 3 or all if less available)
 */
export function getRandomModels(count: number = 3): ModelOption[] {
  const shuffled = [...AVAILABLE_MODELS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, AVAILABLE_MODELS.length));
}

/**
 * Find a model by its ID
 */
export function findModelById(id: string): ModelOption | undefined {
  return AVAILABLE_MODELS.find((model) => model.id === id);
}
