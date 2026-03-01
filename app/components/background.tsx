import { useEffect, useRef, useMemo } from "react";

type AccentColor = "cyan" | "magenta" | "amber" | "uv";

interface BackgroundProps {
  blobCount?: number;
  opacity?: number;
  colors?: AccentColor[];
  speed?: number;
  contained?: boolean;
}

const COLOR_MAP: Record<AccentColor, [number, number, number]> = {
  cyan: [0, 212, 255],
  magenta: [224, 64, 160],
  amber: [232, 160, 32],
  uv: [128, 64, 224],
};

const DEFAULT_COLORS: AccentColor[] = ["cyan", "magenta", "amber", "uv"];

interface WashBlob {
  color: [number, number, number];
  phaseX: number;
  phaseY: number;
  phaseR: number;
  baseX: number;
  baseY: number;
}

export function Background({
  blobCount = 4,
  opacity = 0.15,
  colors = DEFAULT_COLORS,
  speed = 1,
  contained = false,
}: BackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef<WashBlob[]>([]);

  const colorKey = useMemo(() => colors.join(","), [colors]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionQuery.matches;

    const onMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
    };
    motionQuery.addEventListener("change", onMotionChange);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    blobsRef.current = Array.from({ length: blobCount }, (_, i) => {
      const colorName = colors[i % colors.length];
      return {
        color: COLOR_MAP[colorName],
        phaseX: (i * Math.PI * 2) / blobCount,
        phaseY: (i * Math.PI * 2) / blobCount + Math.PI / 3,
        phaseR: (i * Math.PI * 2) / blobCount + Math.PI / 6,
        baseX: 0.2 + (0.6 * i) / Math.max(blobCount - 1, 1),
        baseY: 0.3 + (i % 2) * 0.4,
      };
    });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (w > 0 && h > 0) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let animId = 0;

    const draw = (time: number) => {
      const w = canvas.width;
      const h = canvas.height;
      if (w === 0 || h === 0) {
        animId = requestAnimationFrame(draw);
        return;
      }

      const diagonal = Math.sqrt(w * w + h * h);
      const baseRadius = diagonal * 0.3;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      const t = reducedMotion ? 0 : (time / 1000) * speed;

      for (const blob of blobsRef.current) {
        const [r, g, b] = blob.color;

        const x = blob.baseX * w + Math.sin(t * 0.5 + blob.phaseX) * w * 0.12;
        const y = blob.baseY * h + Math.cos(t * 0.4 + blob.phaseY) * h * 0.12;
        const radius = baseRadius * (1 + 0.15 * Math.sin(t * 0.6 + blob.phaseR));

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.4)`);
        gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.15)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, w, h);
      }

      if (!reducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    animId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blobCount, colorKey, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none inset-0 z-0 h-full w-full ${contained ? "absolute" : "fixed"}`}
      style={{ opacity }}
    />
  );
}
