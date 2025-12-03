import { useState } from "react";
import {
  Brush,
  ChevronDown,
  Hand,
  RotateCcw,
  SprayCan,
  Sparkles,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Separator } from "~/components/ui/separator";
import { Slider } from "~/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { shaders } from "~/shaders";
import {
  BRUSH_PRESETS,
  DEFAULT_COLORS,
  BrushType,
  CursorMode,
} from "~/constants";
import type { BottomToolbarProps } from "~/constants/types";

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
}: BottomToolbarProps) {
  const [modeOpen, setModeOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl">
          {/* Cursor Mode Dropdown */}
          <Popover open={modeOpen} onOpenChange={setModeOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-9 px-2 gap-1.5 rounded-lg",
                      "hover:bg-zinc-800"
                    )}
                  >
                    {cursorMode === CursorMode.Move ? (
                      <Hand className="w-4 h-4" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>{cursorMode === CursorMode.Move ? "Move" : "Rotate"}</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-40! p-1" align="start" side="top">
              <div className="space-y-0.5">
                <Button
                  variant={
                    cursorMode === CursorMode.Move ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    onCursorModeChange(CursorMode.Move);
                    setModeOpen(false);
                  }}
                >
                  <Hand className="w-4 h-4" />
                  Move
                  <span className="ml-auto text-xs text-zinc-500">M</span>
                </Button>
                <Button
                  variant={
                    cursorMode === CursorMode.Rotate ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => {
                    onCursorModeChange(CursorMode.Rotate);
                    setModeOpen(false);
                  }}
                >
                  <RotateCcw className="w-4 h-4" />
                  Rotate
                  <span className="ml-auto text-xs text-zinc-500">R</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Material Dropdown */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 gap-1.5 rounded-lg hover:bg-zinc-800"
                  >
                    <Sparkles className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Material</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-40! p-1!" align="center" side="top">
              <div className="space-y-0.5">
                {shaders.map((shader) => (
                  <Button
                    key={shader.id}
                    variant={
                      currentShader === shader.id ? "secondary" : "ghost"
                    }
                    size="sm"
                    className="w-full justify-start text-sm"
                    onClick={() => onShaderChange(shader.id)}
                  >
                    {shader.name}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Brush Type Dropdown */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 gap-1.5 rounded-lg hover:bg-zinc-800"
                  >
                    {brush.type === BrushType.Airbrush ? (
                      <SprayCan className="w-4 h-4" />
                    ) : (
                      <Brush className="w-4 h-4" />
                    )}
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>
                  {brush.type === BrushType.Airbrush
                    ? "Airbrush"
                    : "Paintbrush"}
                </p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-40! p-1" align="center" side="top">
              <div className="space-y-0.5">
                <Button
                  variant={
                    brush.type === BrushType.Airbrush ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() =>
                    onBrushChange({ ...BRUSH_PRESETS[BrushType.Airbrush] })
                  }
                >
                  <SprayCan className="w-4 h-4" />
                  Airbrush
                </Button>
                <Button
                  variant={
                    brush.type === BrushType.Paintbrush ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() =>
                    onBrushChange({ ...BRUSH_PRESETS[BrushType.Paintbrush] })
                  }
                >
                  <Brush className="w-4 h-4" />
                  Paintbrush
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Color Picker with History */}
          <Popover
            open={colorPickerOpen}
            onOpenChange={(open) => {
              setColorPickerOpen(open);
              if (!open) {
                // Commit color when closing picker
                onColorCommit(brush.color);
                setShowFullPicker(false);
              }
            }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-12 p-0 rounded! hover:bg-zinc-800"
                  >
                    <div
                      className="w-6 h-6 rounded! border-2 border-zinc-600"
                      style={{ backgroundColor: brush.color }}
                    />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Color</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-auto p-2" align="center" side="top">
              {showFullPicker ? (
                <div className="space-y-2">
                  <input
                    type="color"
                    value={brush.color}
                    onChange={(e) => onColorChange(e.target.value)}
                    className="w-40 h-40 rounded-lg cursor-pointer bg-transparent border-0 block"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  {/* Color swatches - history + defaults to fill 5 slots */}
                  {[
                    ...colorHistory,
                    ...DEFAULT_COLORS.filter((c) => !colorHistory.includes(c)),
                  ]
                    .slice(0, 5)
                    .map((color, index) => (
                      <button
                        key={`${color}-${index}`}
                        className={cn(
                          "w-7 h-7 rounded border-2 transition-all",
                          brush.color.toLowerCase() === color.toLowerCase()
                            ? "border-white scale-110"
                            : "border-zinc-700 hover:border-zinc-500"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => {
                          onColorChange(color);
                          setColorPickerOpen(false);
                        }}
                      />
                    ))}
                  {/* Rainbow circle for color picker */}
                  <button
                    className="w-7 h-7 rounded-full border-2 border-zinc-700 hover:border-zinc-500 transition-all"
                    style={{
                      background:
                        "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
                    }}
                    onClick={() => setShowFullPicker(true)}
                  />
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Size Slider */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 gap-1.5 rounded-lg hover:bg-zinc-800"
                  >
                    <span className="text-xs font-mono w-6">
                      {brush.radius}
                    </span>
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Brush Size</p>
              </TooltipContent>
            </Tooltip>
            <PopoverContent className="w-48 p-3" align="center" side="top">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Size</Label>
                  <span className="text-xs text-zinc-500">
                    {brush.radius}px
                  </span>
                </div>
                <Slider
                  min={5}
                  max={brush.type === BrushType.Airbrush ? 150 : 100}
                  step={1}
                  value={[brush.radius]}
                  onValueChange={([value]) => onBrushChange({ radius: value })}
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default BottomToolbar;
