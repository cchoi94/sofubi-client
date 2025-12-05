import { Separator } from "~/components/ui/separator";
import { TooltipProvider } from "~/components/ui/tooltip";
import type { BottomToolbarProps } from "~/constants/types";

// Components
import { BrushTypePicker, ColorPicker } from "./Brush";
import { CursorModePicker } from "./CursorModePicker";
import { MaterialPicker } from "./MaterialPicker";
import { ModelPicker } from "./ModelPicker";
import { RotateCcw } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

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
  currentModel,
  onModelChange,
  onResetAxis,
  isTransformDirty = false,
  hudVisible = true,
}: BottomToolbarProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl">
          {/* CursorMode Picker */}
          <CursorModePicker
            cursorMode={cursorMode}
            onCursorModeChange={onCursorModeChange}
            hudVisible={hudVisible}
          />

          {/* Dynamic Reset Axis Button */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out flex items-center",
              isTransformDirty ? "w-[88px] opacity-100 ml-1" : "w-0 opacity-0 ml-0 pointer-events-none"
            )}
          >
            <div className="flex-shrink-0">
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost" 
                    size="sm"
                    className="h-9 px-2 gap-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white"
                    onClick={onResetAxis}
                  >
                    <div className="flex items-center justify-center w-4 h-4">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </div>
                    <span className="whitespace-nowrap text-xs font-medium">Reset</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">Reset Axis</TooltipContent>
              </Tooltip>
            </div>
            <Separator orientation="vertical" className="h-6 ml-1 mr-0" />
          </div>

          {!isTransformDirty && <Separator orientation="vertical" className="h-6 mx-1" />}

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

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Model Picker (right side) */}
          <ModelPicker
            currentModel={currentModel}
            onModelChange={onModelChange}
            hudVisible={hudVisible}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BottomToolbar;
