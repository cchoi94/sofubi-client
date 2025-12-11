import {
  Brush as BrushIcon,
  ChevronDown,
  PaintBucket,
  SprayCan,
} from "lucide-react";
import { useState, useEffect } from "react";
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
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { BRUSH_PRESETS, BrushType, HOTKEYS, getHotkeyLabel } from "~/constants";
import type { BrushState } from "~/constants/types";
import { paintMaterials } from "~/shaders";

// ============================================================================
// BRUSH TYPE PICKER PROPS
// ============================================================================

export interface BrushTypePickerProps {
  brush: BrushState;
  onBrushChange: (changes: Partial<BrushState>) => void;
  paintMaterial: string;
  onPaintMaterialChange: (materialId: string) => void;
  hudVisible?: boolean;
}

// ============================================================================
// BRUSH TYPE PICKER COMPONENT
// ============================================================================

export function BrushTypePicker({
  brush,
  onBrushChange,
  paintMaterial,
  onPaintMaterialChange,
  hudVisible = true,
}: BrushTypePickerProps) {
  const [open, setOpen] = useState(false);

  // Close popover when HUD hides
  useEffect(() => {
    // Only close popover if HUD is hidden and popover is not open
    if (!hudVisible && !open) {
      setOpen(false);
    }
  }, [hudVisible, open]);

  const handleBrushTypeChange = (type: BrushType) => {
    // Only update brush type and related properties, keep current material
    onBrushChange({
      ...BRUSH_PRESETS[type],
      paintMaterial,
    });
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
              ) : brush.type === BrushType.Fill ? (
                <PaintBucket className="w-4 h-4" />
              ) : (
                <BrushIcon className="w-4 h-4" />
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {brush.type === BrushType.Airbrush
              ? "Airbrush"
              : brush.type === BrushType.Fill
                ? "Fill"
                : "Paintbrush"}
          </p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2" align="center" side="top">
        <div className="space-y-2">
          {/* Brush Type Selection */}
          <div className="space-y-0.5">
            <button
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                "text-zinc-300 hover:bg-zinc-800 hover:text-white",
                {
                  "bg-zinc-700 text-white": brush.type === BrushType.Airbrush,
                }
              )}
              onClick={() => handleBrushTypeChange(BrushType.Airbrush)}
            >
              <SprayCan className="w-4 h-4" />
              Airbrush
              <span className="ml-auto text-xs text-zinc-500">
                {getHotkeyLabel(HOTKEYS.BRUSH_AIRBRUSH)}
              </span>
            </button>
            <button
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                "text-zinc-300 hover:bg-zinc-800 hover:text-white focus:bg-zinc-800",
                {
                  "bg-zinc-700 text-white": brush.type === BrushType.Paintbrush,
                }
              )}
              onClick={() => handleBrushTypeChange(BrushType.Paintbrush)}
            >
              <BrushIcon className="w-4 h-4" />
              Paintbrush
              <span className="ml-auto text-xs text-zinc-500">
                {getHotkeyLabel(HOTKEYS.BRUSH_PAINTBRUSH)}
              </span>
            </button>
            <button
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                "text-zinc-300 hover:bg-zinc-800 hover:text-white focus:bg-zinc-800",
                {
                  "bg-zinc-700 text-white": brush.type === BrushType.Fill,
                }
              )}
              onClick={() => handleBrushTypeChange(BrushType.Fill)}
            >
              <PaintBucket className="w-4 h-4" />
              Fill
              <span className="ml-auto text-xs text-zinc-500">
                {getHotkeyLabel(HOTKEYS.BRUSH_FILL)}
              </span>
            </button>
          </div>

          <Separator />

          {/* Material Selection */}
          <div className="space-y-0.5">
            <Label className="text-xs px-2 text-zinc-400">Material</Label>
            {paintMaterials.map((material) => (
              <button
                key={material.id}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                  "text-zinc-300 hover:bg-zinc-800 hover:text-white focus:bg-zinc-800",
                  paintMaterial === material.id && "bg-zinc-700 text-white"
                )}
                onClick={() => onPaintMaterialChange(material.id)}
              >
                {material.name}
              </button>
            ))}
          </div>

          {/* Brush Size Slider - hide for Fill brush */}
          {brush.type !== BrushType.Fill && (
            <div className="space-y-2 px-1 pb-1">
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="text-xs">Size</Label>
                <span className="text-xs text-zinc-500">{brush.radius}px</span>
              </div>
              <Slider
                min={5}
                max={brush.type === BrushType.Airbrush ? 150 : 100}
                step={1}
                value={[brush.radius]}
                onValueChange={([value]) => onBrushChange({ radius: value })}
              />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BrushTypePicker;
