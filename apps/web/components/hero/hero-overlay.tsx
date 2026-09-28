"use client";

import { HERO_STATIC_OVERLAY } from "@/lib/hero-overlay-gradient";
import { motion, type Transition } from "framer-motion";

export const HERO_MEDIA_TRANSITION: Transition = {
  duration: 1.4,
  ease: "easeInOut",
};

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
