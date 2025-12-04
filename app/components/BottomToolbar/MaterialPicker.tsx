import { useState, useEffect } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { shaders } from "~/shaders";

// ============================================================================
// MATERIAL PICKER PROPS
// ============================================================================

export interface MaterialPickerProps {
  currentShader: string;
  onShaderChange: (shaderId: string) => void;
  hudVisible?: boolean;
}

// ============================================================================
// MATERIAL PICKER COMPONENT
// ============================================================================

export function MaterialPicker({
  currentShader,
  onShaderChange,
  hudVisible = true,
}: MaterialPickerProps) {
  const [open, setOpen] = useState(false);

  // Close popover when HUD hides
  useEffect(() => {
    if (!hudVisible) {
      setOpen(false);
    }
  }, [hudVisible]);

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
              <Sparkles className="w-4 h-4" />
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Material</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-40 p-2" align="center" side="top">
        <div className="space-y-0.5">
          {shaders.map((shader) => (
            <button
              key={shader.id}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                "text-zinc-300 hover:bg-zinc-800 hover:text-white focus:bg-zinc-800",
                currentShader === shader.id && "bg-zinc-700 text-white"
              )}
              onClick={() => onShaderChange(shader.id)}
            >
              {shader.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MaterialPicker;
