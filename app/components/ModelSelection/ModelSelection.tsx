import { Card, CardDescription, CardTitle } from "~/components/ui/card";
import { AVAILABLE_MODELS } from "~/constants";
import type { ModelSelectionProps } from "~/constants/types";

// ============================================================================
// MODEL SELECTION COMPONENT
// ============================================================================

export function ModelSelection({ onSelectModel }: ModelSelectionProps) {
  return (
    <div className="fixed inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
      <div className="max-w-4xl w-full mx-4">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white mb-3">
            🎨 3D Mesh Painter
          </h1>
          <p className="text-slate-400 text-lg">
            Choose a model to start painting
          </p>
        </div>

        {/* Model Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {AVAILABLE_MODELS.map((model) => (
            <Card
              key={model.id}
              onClick={() => onSelectModel(model)}
              className="group cursor-pointer p-6 hover:bg-slate-700/50 hover:border-slate-500 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/10"
            >
              {/* Model Icon/Preview Area */}
              <div className="aspect-square bg-slate-900/50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                  {model.id === "godzilla" && "🦖"}
                  {model.id === "king_ghidorah" && "🐉"}
                  {model.id === "mothra" && "🦋"}
                </div>
              </div>

              <CardTitle className="text-xl group-hover:text-blue-400 transition-colors">
                {model.name}
              </CardTitle>
              <CardDescription className="mt-1 group-hover:text-slate-400 transition-colors">
                Click to paint
              </CardDescription>

              {/* Hover Glow Effect */}
              <div className="absolute inset-0 rounded-2xl bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors pointer-events-none" />
            </Card>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-10 text-slate-500 text-sm">
          <p>
            Paint directly on 3D models • Export your creations • Share with
            friends
          </p>
        </div>
      </div>
    </div>
  );
}

export default ModelSelection;
