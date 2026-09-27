"use client";

import { useAmbientGlow } from "@/hooks/use-ambient-glow";
import { useAmbientGlowEnabled } from "@/hooks/use-ambient-glow-enabled";
import useMedia from "@/hooks/useMedia";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { cn } from "@/lib/utils";

/** Flip to `false` to restore desktop-only ambient glow. */
const AMBIENT_GLOW_ALLOW_MOBILE = true;

const DESKTOP_QUERY =
  "(min-width: 1024px) and (hover: hover) and (pointer: fine)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type AmbientGlowLayerProps = {
  getVideo: () => HTMLVideoElement | null;
  className?: string;
  blur?: number;
  saturate?: number;
  brightness?: number;
  opacity?: number;
  scale?: number;
};

export function AmbientGlowLayer({
  getVideo,
  className,
  blur,
  saturate = 2,
  brightness = 1.05,
  opacity,
  scale = 1.18,
}: AmbientGlowLayerProps) {
  const featureEnabled = useAmbientGlowEnabled();
  const userEnabled = useAppSettingsStore((state) => state.ambientGlow);
  const isDesktop = useMedia(DESKTOP_QUERY, false);
  const prefersReducedMotion = useMedia(REDUCED_MOTION_QUERY, false);
  const active =
    featureEnabled &&
    userEnabled &&
    (AMBIENT_GLOW_ALLOW_MOBILE || isDesktop) &&
    !prefersReducedMotion;
  const canvasRef = useAmbientGlow(getVideo, {
    active,
    intervalMs: isDesktop ? 80 : 120,
  });
  const resolvedBlur = blur ?? (isDesktop ? 40 : 28);
  const resolvedOpacity = opacity ?? (isDesktop ? 0.5 : 0.4);

  if (!active) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full rounded-[1.35rem]",
        className,
      )}
      style={{
        filter: `blur(${resolvedBlur}px) saturate(${saturate}) brightness(${brightness})`,
        opacity: resolvedOpacity,
        transform: `scale(${scale})`,
        maskImage:
          "radial-gradient(140% 130% at 50% 50%, black 28%, transparent 78%)",
        WebkitMaskImage:
          "radial-gradient(140% 130% at 50% 50%, black 28%, transparent 78%)",
        willChange: "filter",
      }}
    />
  );
}
