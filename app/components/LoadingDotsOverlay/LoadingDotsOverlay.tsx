import { useEffect, useRef } from "react";
import styles from "./LoadingDotsOverlay.module.css";

interface LoadingDotsOverlayProps {
  isLoading: boolean;
}

const DOT_SPACING = 24;
const DOT_RADIUS = 1.5;
const BG_COLOR = "#18181b";
const DIM_DOT = { r: 82, g: 82, b: 91, a: 0.35 };
const BRIGHT_DOT = { r: 228, g: 228, b: 231, a: 1 }; // #e4e4e7

export function LoadingDotsOverlay({ isLoading }: LoadingDotsOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isLoading) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    // Setup canvas
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;
    const centerX = width / 2;
    const centerY = height / 2;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Pre-calculate dot positions and distances
    const cols = Math.ceil(width / DOT_SPACING) + 1;
    const rows = Math.ceil(height / DOT_SPACING) + 1;
    const offsetX = (width - (cols - 1) * DOT_SPACING) / 2;
    const offsetY = (height - (rows - 1) * DOT_SPACING) / 2;

    // Group dots by their distance "ring" from center
    const dots: { x: number; y: number; dist: number }[] = [];
    let maxDist = 0;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * DOT_SPACING;
        const y = offsetY + row * DOT_SPACING;
        const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        // Quantize distance to dot spacing for discrete rings
        const ringDist = Math.round(dist / DOT_SPACING) * DOT_SPACING;
        dots.push({ x, y, dist: ringDist });
        maxDist = Math.max(maxDist, ringDist);
      }
    }

    startTimeRef.current = performance.now();

    const draw = (timestamp: number) => {
      const elapsed = (timestamp - startTimeRef.current) / 1000;

      ctx.fillStyle = BG_COLOR;
      ctx.fillRect(0, 0, width, height);

      // Ripple settings
      const rippleSpeed = 150; // pixels per second
      const rippleWidth = DOT_SPACING * 2; // width of the bright ring (2 dot rows)
      const cycleDuration = (maxDist + rippleWidth * 2) / rippleSpeed;
      const rippleInterval = cycleDuration / 5; // 5 sequential ripples

      for (const dot of dots) {
        let brightness = 0;

        // Check all 5 ripples
        for (let i = 0; i < 5; i++) {
          const rippleTime = elapsed - i * rippleInterval;
          if (rippleTime < 0) continue;

          const rippleRadius = (rippleTime % cycleDuration) * rippleSpeed;
          const distFromRipple = Math.abs(dot.dist - rippleRadius);

          if (distFromRipple < rippleWidth) {
            // Sharp falloff at the edge of the ring
            const intensity = 1 - distFromRipple / rippleWidth;
            brightness = Math.max(brightness, intensity);
          }
        }

        // Interpolate color
        const r = Math.round(
          DIM_DOT.r + (BRIGHT_DOT.r - DIM_DOT.r) * brightness
        );
        const g = Math.round(
          DIM_DOT.g + (BRIGHT_DOT.g - DIM_DOT.g) * brightness
        );
        const b = Math.round(
          DIM_DOT.b + (BRIGHT_DOT.b - DIM_DOT.b) * brightness
        );
        const a = DIM_DOT.a + (BRIGHT_DOT.a - DIM_DOT.a) * brightness;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);

    const handleResize = () => {
      // Re-setup on resize
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      canvas.width = newWidth * dpr;
      canvas.height = newHeight * dpr;
      canvas.style.width = `${newWidth}px`;
      canvas.style.height = `${newHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isLoading]);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-20 pointer-events-none overflow-hidden">
      <canvas ref={canvasRef} className={styles.canvas} />

      {/* Loading text overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-zinc-300 text-lg font-medium">Loading...</p>
      </div>
    </div>
  );
}
