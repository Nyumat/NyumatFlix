/**
 * Static hero scrim, shared by {@link HeroMediaOverlay} and the detail-page
 * loading skeleton so the placeholder reads identically to the live hero.
 */
export const HERO_STATIC_OVERLAY = [
  "linear-gradient(to bottom, transparent 0%, transparent 58%, rgb(0 0 0 / 0.55) 82%, rgb(0 0 0) 100%)",
  "linear-gradient(to top, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.38) 26%, transparent 56%)",
  "linear-gradient(to right, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.15) 36%, transparent 70%)",
  "linear-gradient(to left, rgb(0 0 0 / 0.85) 0%, rgb(0 0 0 / 0.15) 36%, transparent 70%)",
].join(", ");
