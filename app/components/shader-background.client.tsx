import { useState, useEffect } from "react";
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react";

interface ShaderBackgroundProps {
  opacity?: number;
  contained?: boolean;
  distance?: number;
}

export default function ShaderBackground({
  opacity = 0.15,
  contained = false,
  distance = 4.5,
}: ShaderBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none inset-0 z-0 h-full w-full ${contained ? "absolute" : "fixed"}`}
      style={{ opacity }}
    >
      <ShaderGradientCanvas
        pixelDensity={1}
        pointerEvents="none"
        style={{ width: "100%", height: "100%" }}
      >
        <ShaderGradient
          control="props"
          type="waterPlane"
          cDistance={distance}
          animate={reducedMotion ? "off" : "on"}
          uSpeed={0.19}
          uStrength={1.5}
          uDensity={2}
          uFrequency={1.5}
          color1="#e8a020"
          color2="#0a1a2a"
          color3="#e8a020"
          grain="on"
          grainBlending={0.3}
          brightness={1.0}
          envPreset="lobby"
          cPolarAngle={80}
          lightType="3d"
          reflection={1}
        />
      </ShaderGradientCanvas>
    </div>
  );
}
