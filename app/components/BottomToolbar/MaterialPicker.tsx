import { ChevronDown, Sparkles } from "lucide-react";
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
}

// ============================================================================
// MATERIAL PICKER COMPONENT
// ============================================================================

export function MaterialPicker({
  currentShader,
  onShaderChange,
}: MaterialPickerProps) {
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
              variant={currentShader === shader.id ? "secondary" : "ghost"}
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
  );
}

export default MaterialPicker;
