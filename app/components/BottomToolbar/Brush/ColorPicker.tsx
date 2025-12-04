import { useRef, useState, useEffect } from "react";
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
  hudVisible?: boolean;
}

// ============================================================================
// COLOR PICKER COMPONENT
// ============================================================================

export function ColorPicker({
  color,
  colorHistory,
  onColorChange,
  onColorCommit,
  hudVisible = true,
}: ColorPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  // Close popover when HUD hides
  useEffect(() => {
    if (!hudVisible) {
      setOpen(false);
    }
  }, [hudVisible]);

  return (
    <>
      {/* Hidden native color input */}
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => {
          // Only update brush color during drag, don't save to palette yet
          onColorChange(e.target.value);
        }}
        onBlur={(e) => {
          // Save to palette when picker closes (loses focus)
          onColorCommit(e.target.value);
        }}
        className="sr-only"
      />
      <Popover open={open} onOpenChange={setOpen}>
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
                    // Clicking a swatch immediately applies and saves to palette
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
