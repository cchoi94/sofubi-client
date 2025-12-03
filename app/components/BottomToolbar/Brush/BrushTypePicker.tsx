import { Brush as BrushIcon, ChevronDown, SprayCan } from "lucide-react";
import { useState } from "react";
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

// ============================================================================
// BRUSH TYPE PICKER PROPS
// ============================================================================

export interface BrushTypePickerProps {
  brush: BrushState;
  onBrushChange: (changes: Partial<BrushState>) => void;
}

// ============================================================================
// BRUSH TYPE PICKER COMPONENT
// ============================================================================

export function BrushTypePicker({
  brush,
  onBrushChange,
}: BrushTypePickerProps) {
  const [open, setOpen] = useState(false);

  const handleBrushTypeChange = (type: BrushType) => {
    onBrushChange({ ...BRUSH_PRESETS[type] });
    setOpen(false);
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
              ) : (
                <BrushIcon className="w-4 h-4" />
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{brush.type === BrushType.Airbrush ? "Airbrush" : "Paintbrush"}</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2" align="center" side="top">
        <div className="space-y-2">
          {/* Brush Type Selection */}
          <div className="space-y-0.5">
            <Button
              variant={
                brush.type === BrushType.Airbrush ? "secondary" : "ghost"
              }
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => handleBrushTypeChange(BrushType.Airbrush)}
            >
              <SprayCan className="w-4 h-4" />
              Airbrush
              <span className="ml-auto text-xs text-zinc-500">
                {getHotkeyLabel(HOTKEYS.BRUSH_AIRBRUSH)}
              </span>
            </Button>
            <Button
              variant={
                brush.type === BrushType.Paintbrush ? "secondary" : "ghost"
              }
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => handleBrushTypeChange(BrushType.Paintbrush)}
            >
              <BrushIcon className="w-4 h-4" />
              Paintbrush
              <span className="ml-auto text-xs text-zinc-500">
                {getHotkeyLabel(HOTKEYS.BRUSH_PAINTBRUSH)}
              </span>
            </Button>
          </div>

          <Separator />

          {/* Brush Size Slider */}
          <div className="space-y-2 px-1 pb-1">
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default BrushTypePicker;
