import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Slider } from "~/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { BrushType } from "~/constants";
import type { BrushState } from "~/constants/types";

// ============================================================================
// BRUSH SIZE SLIDER PROPS
// ============================================================================

export interface BrushSizeSliderProps {
  brush: BrushState;
  onBrushChange: (changes: Partial<BrushState>) => void;
}

// ============================================================================
// BRUSH SIZE SLIDER COMPONENT
// ============================================================================

export function BrushSizeSlider({
  brush,
  onBrushChange,
}: BrushSizeSliderProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-2 gap-1.5 rounded-lg hover:bg-zinc-800"
            >
              <span className="text-xs font-mono w-6">{brush.radius}</span>
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
      </PopoverContent>
    </Popover>
  );
}

export default BrushSizeSlider;
