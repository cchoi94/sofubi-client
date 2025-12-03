import { useState } from "react";
import { ChevronDown, Hand, Rotate3d } from "lucide-react";
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
}

// ============================================================================
// CURSOR MODE PICKER COMPONENT
// ============================================================================

export function CursorModePicker({
  cursorMode,
  onCursorModeChange,
}: CursorModePickerProps) {
  const [open, setOpen] = useState(false);

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
              {cursorMode === CursorMode.Move ? (
                <Hand className="w-4 h-4" />
              ) : (
                <Rotate3d className="w-4 h-4" />
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
            variant={cursorMode === CursorMode.Move ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              onCursorModeChange(CursorMode.Move);
              setOpen(false);
            }}
          >
            <Hand className="w-4 h-4" />
            Move
            <span className="ml-auto text-xs text-zinc-500">
              {getHotkeyLabel(HOTKEYS.CURSOR_MOVE)}
            </span>
          </Button>
          <Button
            variant={cursorMode === CursorMode.Rotate ? "secondary" : "ghost"}
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              onCursorModeChange(CursorMode.Rotate);
              setOpen(false);
            }}
          >
            <Rotate3d className="w-4 h-4" />
            Rotate
            <span className="ml-auto text-xs text-zinc-500">
              {getHotkeyLabel(HOTKEYS.CURSOR_ROTATE)}
            </span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CursorModePicker;
