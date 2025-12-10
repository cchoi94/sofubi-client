// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Brush type enum for paint tools
 */
export enum BrushType {
  Airbrush = "airbrush",
  Paintbrush = "paintbrush",
  Fill = "fill",
}

/**
 * Cursor mode enum for interaction modes
 */
export enum CursorMode {
  Paint = "paint",
  Move = "move",
  Rotate = "rotate",
}

/**
 * Brush state interface
 */
export interface BrushState {
  type: BrushType;
  color: string;
  radius: number;
  opacity: number;
  hardness: number;
  paintMaterial: string; // Material shader ID to paint with (e.g., "plastic", "metal")
}

/**
 * Animation state interface
 */
export interface AnimationState {
  spin: boolean;
  spinSpeed: number;
}

/**
 * Model option interface for model selection
 */
export interface ModelOption {
  id: string;
  name: string;
  path: string;
  disabled?: boolean; // If true, shows "Coming Soon" and prevents selection
}

/**
 * Share modal props interface
 */
export interface ShareModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
}

/**
 * Model selection props interface
 */
export interface ModelSelectionProps {
  onSelectModel: (model: ModelOption) => void;
}

/**
 * Bottom toolbar props interface
 */
export interface BottomToolbarProps {
  brush: BrushState;
  onBrushChange: (brush: Partial<BrushState>) => void;
  paintMaterial: string; // Material to paint with (e.g., "plastic", "metal")
  onPaintMaterialChange: (materialId: string) => void;
  cursorMode: CursorMode;
  onCursorModeChange: (mode: CursorMode) => void;
  colorHistory: string[];
  onColorChange: (color: string) => void;
  onColorCommit: (color: string) => void;
  currentModel: ModelOption | null;
  onModelChange: (model: ModelOption) => void;
  onResetAxis?: () => void;
  isTransformDirty?: boolean;
  hudVisible?: boolean;
}
