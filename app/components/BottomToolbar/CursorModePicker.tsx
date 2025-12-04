import { useState, useEffect } from "react";
import { ChevronDown, Hand, Rotate3d, PaintbrushVertical } from "lucide-react";
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
import { CursorMode, HOTKEYS, getHotkeyLabel } from "~/constants";

// ============================================================================
// CURSOR MODE PICKER PROPS
// ============================================================================

export interface CursorModePickerProps {
  cursorMode: CursorMode;
  onCursorModeChange: (mode: CursorMode) => void;
  hudVisible?: boolean;
}

// ============================================================================
// CURSOR MODE PICKER COMPONENT
// ============================================================================

export function CursorModePicker({
  cursorMode,
  onCursorModeChange,
  hudVisible = true,
}: CursorModePickerProps) {
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
              className={cn("h-9 px-2 gap-1.5 rounded-lg", "hover:bg-zinc-800")}
            >
              {cursorMode === CursorMode.Paint ? (
                <PaintbrushVertical className="w-4 h-4" />
              ) : cursorMode === CursorMode.Move ? (
                <Hand className="w-4 h-4" />
              ) : (
                <Rotate3d className="w-4 h-4" />
              )}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {cursorMode === CursorMode.Paint
              ? "Paint"
              : cursorMode === CursorMode.Move
                ? "Move"
                : "Rotate"}
          </p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2" align="start" side="top">
        <div className="space-y-0.5">
          <button
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
              "text-zinc-300 hover:bg-zinc-800 hover:text-white",
              { "bg-zinc-700 text-white": cursorMode === CursorMode.Paint }
            )}
            onClick={() => {
              onCursorModeChange(CursorMode.Paint);
              setOpen(false);
            }}
          >
            <PaintbrushVertical className="w-4 h-4" />
            Paint
          </button>
          <button
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
              "text-zinc-300 hover:bg-zinc-800 hover:text-white",
              { "bg-zinc-700 text-white": cursorMode === CursorMode.Move }
            )}
            onClick={() => {
              onCursorModeChange(CursorMode.Move);
              setOpen(false);
            }}
          >
            <Hand className="w-4 h-4" />
            Move
            <span className="ml-auto text-xs text-zinc-500">
              hold {getHotkeyLabel(HOTKEYS.CURSOR_MOVE_HOLD)}
            </span>
          </button>
          <button
            className={cn(
              "relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors",
              "text-zinc-300 hover:bg-zinc-800 hover:text-white",
              {
                "bg-zinc-700 text-white": cursorMode === CursorMode.Rotate,
              }
            )}
            onClick={() => {
              onCursorModeChange(CursorMode.Rotate);
              setOpen(false);
            }}
          >
            <Rotate3d className="w-4 h-4" />
            Rotate
            <span className="ml-auto text-xs text-zinc-500">
              hold {getHotkeyLabel(HOTKEYS.CURSOR_ROTATE_HOLD)}
            </span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CursorModePicker;
