import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import type { ModelOption } from "~/constants/types";
import { getRandomModels } from "~/constants/models";

// ============================================================================
// MODEL SELECTOR MODAL PROPS
// ============================================================================

export interface ModelSelectorModalProps {
  isOpen: boolean;
  onSelectModel: (model: ModelOption) => void;
  onClose?: () => void;
  /** If true, user cannot close without selecting */
  required?: boolean;
}

// ============================================================================
// MODEL CARD COMPONENT
// ============================================================================

function ModelCard({
  model,
  onSelect,
}: {
  model: ModelOption;
  onSelect: (model: ModelOption) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isDisabled = model.disabled;

  return (
    <button
      disabled={isDisabled}
      className={cn(
        "relative flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-200",
        isDisabled
          ? "bg-zinc-900/50 border-zinc-800 cursor-not-allowed opacity-60"
          : "bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-700 hover:border-zinc-500",
        !isDisabled && isHovered && "scale-105 shadow-xl shadow-black/50"
      )}
      onMouseEnter={() => !isDisabled && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => !isDisabled && onSelect(model)}
    >
      {/* Model Preview - placeholder with gradient */}
      <div
        className={cn(
          "w-32 h-32 rounded-lg mb-3 overflow-hidden",
          "bg-gradient-to-br from-zinc-700 to-zinc-800",
          "flex items-center justify-center"
        )}
      >
        {/* 3D icon placeholder */}
        <div className="text-4xl opacity-50">🎨</div>
      </div>

      {/* Model Name */}
      <span
        className={cn(
          "font-medium text-lg",
          isDisabled ? "text-zinc-500" : "text-white"
        )}
      >
        {model.name}
      </span>

      {/* Coming Soon badge for disabled models */}
      {isDisabled && (
        <span className="mt-1 text-xs text-zinc-500 italic">Coming Soon</span>
      )}

      {/* Select indicator on hover */}
      {!isDisabled && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl border-2 border-blue-500 opacity-0 transition-opacity",
            isHovered && "opacity-100"
          )}
        />
      )}
    </button>
  );
}

// ============================================================================
// MODEL SELECTOR MODAL COMPONENT
// ============================================================================

export function ModelSelectorModal({
  isOpen,
  onSelectModel,
  onClose,
  required = false,
}: ModelSelectorModalProps) {
  const [displayModels, setDisplayModels] = useState<ModelOption[]>([]);

  // Get random models when modal opens
  useEffect(() => {
    if (isOpen) {
      setDisplayModels(getRandomModels(3));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (model: ModelOption) => {
    onSelectModel(model);
  };

  const handleClose = () => {
    if (!required && onClose) {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !required) {
      handleClose();
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center",
        "bg-black/80 backdrop-blur-sm"
      )}
      onClick={handleBackdropClick}
    >
      <div
        className={cn(
          "relative max-w-2xl w-full mx-4 p-8 rounded-2xl",
          "bg-zinc-900 border border-zinc-800",
          "shadow-2xl shadow-black/50"
        )}
      >
        {/* Close button (only if not required) */}
        {!required && onClose && (
          <button
            className="absolute top-4 right-4 p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            Choose a Model to Paint
          </h2>
          <p className="text-zinc-400">
            Select a 3D model to start painting on
          </p>
        </div>

        {/* Model Cards */}
        <div className="flex justify-center gap-6 flex-wrap">
          {displayModels.map((model) => (
            <ModelCard key={model.id} model={model} onSelect={handleSelect} />
          ))}
        </div>

        {/* Footer hint */}
        <p className="text-center text-zinc-500 text-sm mt-8">
          You can change models anytime from the toolbar
        </p>
      </div>
    </div>
  );
}

export default ModelSelectorModal;
