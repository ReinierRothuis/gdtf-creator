import { useState, useEffect } from "react";
import ShaderBackground from "./shader-background.client";

interface BackgroundProps {
  opacity?: number;
  contained?: boolean;
  distance?: number;
}

export function Background({
  opacity = 0.15,
  contained = false,
  distance = 4.5,
}: BackgroundProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !ShaderBackground) return null;
  return (
    <ShaderBackground
      opacity={opacity}
      contained={contained}
      distance={distance}
    />
  );
}
