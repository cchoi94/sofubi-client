import { useState } from "react";
import { RotateCw, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import type { AnimationState } from "~/constants/types";

// ============================================================================
// TOP RIGHT TOOLBAR PROPS
// ============================================================================

interface TopRightToolbarProps {
  animation: AnimationState;
  onAnimationChange: (changes: Partial<AnimationState>) => void;
  onClear: () => void;
  isLoading: boolean;
}

// ============================================================================
// TOP RIGHT TOOLBAR COMPONENT
// ============================================================================

export function TopRightToolbar({
  animation,
  onAnimationChange,
  onClear,
  isLoading,
}: TopRightToolbarProps) {
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed top-6 right-6 z-20">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl">
          {/* Auto Spin Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={animation.spin ? "secondary" : "ghost"}
                size="sm"
                className="h-9 px-2 rounded-lg hover:bg-zinc-800"
                onClick={() => onAnimationChange({ spin: !animation.spin })}
              >
                <RotateCw
                  className={cn("w-4 h-4", animation.spin && "animate-spin")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Auto Spin</p>
            </TooltipContent>
          </Tooltip>

          {/* Clear Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 rounded-lg hover:bg-zinc-800 hover:text-red-400"
                onClick={() => setShowClearConfirm(true)}
                disabled={isLoading}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Clear Canvas</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Clear Confirm Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title="Clear Canvas"
        description="Are you sure you want to clear the canvas? This will remove all paint and cannot be undone."
        confirmLabel="Clear"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={onClear}
      />
    </TooltipProvider>
  );
}

export default TopRightToolbar;
