import { Download } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { ShareModalProps } from "~/constants/types";

// ============================================================================
// SHARE MODAL COMPONENT
// ============================================================================

export function ShareModal({ isOpen, imageUrl, onClose }: ShareModalProps) {
  // Generate share URLs (only on client side)
  const shareText = encodeURIComponent(
    "Painted this 3D model in the browser 🎨"
  );
  const appUrl =
    typeof window !== "undefined"
      ? encodeURIComponent(window.location.href)
      : "";
  const twitterUrl = `https://twitter.com/intent/tweet?text=${shareText}&url=${appUrl}`;

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = "painted-model.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg mx-4 p-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Share Your Creation</DialogTitle>
        </DialogHeader>

        {/* Screenshot Preview */}
        <div className="p-6 pt-0">
          <div className="rounded-lg overflow-hidden border border-slate-600 mb-6">
            <img
              src={imageUrl}
              alt="Screenshot of painted model"
              className="w-full h-auto"
            />
          </div>

          {/* Share Buttons */}
          <div className="space-y-3">
            {/* Download PNG */}
            <Button size="lg" onClick={handleDownload} className="w-full">
              <Download className="w-5 h-5" />
              Download PNG
            </Button>

            {/* Share on X (Twitter) */}
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-950 text-white font-medium py-3 px-4 rounded-lg transition-colors border border-slate-600"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </a>

            {/* Open Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium py-3 px-4 rounded-lg transition-all"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              Open Instagram
            </a>
            <p className="text-center text-slate-400 text-sm">
              Download the PNG first, then upload it to Instagram manually
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ShareModal;
