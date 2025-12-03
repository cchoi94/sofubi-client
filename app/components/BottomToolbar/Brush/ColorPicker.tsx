import { useRef } from "react";
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
import { DEFAULT_COLORS } from "~/constants";

// ============================================================================
// COLOR PICKER PROPS
// ============================================================================

export interface ColorPickerProps {
  color: string;
  colorHistory: string[];
  onColorChange: (color: string) => void;
  onColorCommit: (color: string) => void;
}

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

export function ColorPicker({
  color,
  colorHistory,
  onColorChange,
  onColorCommit,
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => {
          onColorChange(e.target.value);
          onColorCommit(e.target.value);
        }}
        className="sr-only"
      />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0! rounded hover:bg-zinc-800"
              >
                <div
                  className="w-6! h-6 rounded border-2 border-zinc-600"
                  style={{ backgroundColor: color }}
                />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Color</p>
          </TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2" align="center" side="top">
          <div className="flex items-center gap-1.5">
            {/* Color swatches - history + defaults to fill 5 slots */}
            {[
              ...colorHistory,
              ...DEFAULT_COLORS.filter((c) => !colorHistory.includes(c)),
            ]
              .slice(0, 5)
              .map((swatchColor, index) => (
                <button
                  key={`${swatchColor}-${index}`}
                  className={cn(
                    "w-7 h-7 rounded border-2 transition-all",
                    color.toLowerCase() === swatchColor.toLowerCase()
                      ? "border-white scale-110"
                      : "border-zinc-700 hover:border-zinc-500"
                  )}
                  style={{ backgroundColor: swatchColor }}
                  onClick={() => {
                    onColorChange(swatchColor);
                    onColorCommit(swatchColor);
                  }}
                />
              ))}
            {/* Rainbow circle to open native color picker */}
            <button
              className="w-7 h-7 rounded border-2 border-zinc-700 hover:border-zinc-500 transition-all"
              style={{
                background:
                  "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)",
              }}
              onClick={() => inputRef.current?.click()}
            />
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

export default ColorPicker;
