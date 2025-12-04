import { useState, useEffect } from "react";
import { ChevronDown, Box } from "lucide-react";
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
import type { ModelOption } from "~/constants/types";
import { AVAILABLE_MODELS } from "~/constants/models";

// ============================================================================
// MODEL PICKER PROPS
// ============================================================================

export interface ModelPickerProps {
  currentModel: ModelOption | null;
  onModelChange: (model: ModelOption) => void;
  hudVisible?: boolean;
}

// ============================================================================
// MODEL PICKER COMPONENT
// ============================================================================

export function ModelPicker({
  currentModel,
  onModelChange,
  hudVisible = true,
}: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  // Close popover when HUD hides
  useEffect(() => {
    if (!hudVisible) {
      setOpen(false);
    }
  }, [hudVisible]);

  // Don't render if no model selected (selector modal showing)
  if (!currentModel) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-3 gap-2 rounded-lg",
                "hover:bg-zinc-800",
                "text-zinc-300 hover:text-white"
              )}
            >
              <Box className="w-4 h-4" />
              <span className="text-sm font-medium max-w-[200px] truncate">
                {currentModel.name}
              </span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>Change Model</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2" align="end" side="top">
        <div className="space-y-0.5">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              disabled={model.disabled}
              className={cn(
                "relative flex w-full select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
                model.disabled
                  ? "cursor-not-allowed text-zinc-500"
                  : "cursor-pointer text-zinc-300 hover:bg-zinc-800 hover:text-white",
                {
                  "bg-zinc-700 text-white":
                    !model.disabled && currentModel?.id === model.id,
                }
              )}
              onClick={() => {
                if (model.disabled) return;
                if (model.id !== currentModel?.id) {
                  onModelChange(model);
                }
                setOpen(false);
              }}
            >
              <Box className="w-4 h-4" />
              <div className="flex flex-col">
                <span className="flex-1 text-left">{model.name}</span>
                {model.disabled && (
                  <span className="text-xs text-zinc-500 italic">
                    Coming Soon
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ModelPicker;
