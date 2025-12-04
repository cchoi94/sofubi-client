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
  currentShader: string;
  onShaderChange: (shaderId: string) => void;
  cursorMode: CursorMode;
  onCursorModeChange: (mode: CursorMode) => void;
  colorHistory: string[];
  onColorChange: (color: string) => void;
  onColorCommit: (color: string) => void;
  hudVisible?: boolean;
}
