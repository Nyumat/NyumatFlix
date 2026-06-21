"use client";

import { motion, type Transition } from "framer-motion";

export const HERO_MEDIA_TRANSITION: Transition = {
  duration: 1.4,
  ease: "easeInOut",
};

/** Single-layer cinematic vignette + bottom handoff into page background. */
const HERO_STATIC_OVERLAY = [
  "linear-gradient(to bottom, transparent 0%, transparent 58%, hsl(var(--background) / 0.55) 82%, hsl(var(--background)) 100%)",
  "linear-gradient(to top, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.38) 26%, transparent 56%)",
  "linear-gradient(to right, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.15) 36%, transparent 70%)",
  "linear-gradient(to left, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.15) 36%, transparent 70%)",
].join(", ");

/** Soft bottom feather on ambient video — fades into the page without a second overlay. */
export const HERO_AMBIENT_VIDEO_MASK =
  "linear-gradient(to top, transparent 0%, black 34%)";

interface HeroMediaOverlayProps {
  isAmbientBackdropActive: boolean;
}

export function HeroMediaOverlay({
  isAmbientBackdropActive,
}: HeroMediaOverlayProps) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10"
      style={{ backgroundImage: HERO_STATIC_OVERLAY }}
      initial={false}
      animate={{ opacity: isAmbientBackdropActive ? 0 : 1 }}
      transition={HERO_MEDIA_TRANSITION}
    />
  );
}
