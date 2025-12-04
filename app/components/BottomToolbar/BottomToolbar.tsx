import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import type { BottomToolbarProps } from "~/constants/types";

// Components
import { BrushTypePicker, ColorPicker } from "./Brush";
import { CursorModePicker } from "./CursorModePicker";
import { MaterialPicker } from "./MaterialPicker";

// ============================================================================
// BOTTOM TOOLBAR COMPONENT (Figma-style)
// ============================================================================

export function BottomToolbar({
  brush,
  onBrushChange,
  currentShader,
  onShaderChange,
  cursorMode,
  onCursorModeChange,
  colorHistory,
  onColorChange,
  onColorCommit,
  hudVisible = true,
}: BottomToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl">
          {/* Cursor Mode Picker */}
          <CursorModePicker
            cursorMode={cursorMode}
            onCursorModeChange={onCursorModeChange}
            hudVisible={hudVisible}
          />

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Brush Type Picker */}
          <BrushTypePicker
            brush={brush}
            onBrushChange={onBrushChange}
            hudVisible={hudVisible}
          />

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Color Picker */}
          <ColorPicker
            color={brush.color}
            colorHistory={colorHistory}
            onColorChange={onColorChange}
            onColorCommit={onColorCommit}
            hudVisible={hudVisible}
          />

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Material Picker */}
          <MaterialPicker
            currentShader={currentShader}
            onShaderChange={onShaderChange}
            hudVisible={hudVisible}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BottomToolbar;
