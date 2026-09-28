/** Subtle scroll blur on the sharp hero (ambient layer stays heavier). */
export const FEATURE_HERO_MAX_SCROLL_BLUR_PX = 28;

/** Scroll distance before the hero reaches max blur (longer = gentler ramp). */
export const FEATURE_HERO_SCROLL_BLUR_VIEWPORT_RATIO = 1.05;

export const getFeatureHeroScrollBlurRangePx = (viewportHeight: number) =>
  Math.max(1, viewportHeight * FEATURE_HERO_SCROLL_BLUR_VIEWPORT_RATIO);

export const getFeatureHeroScrollBlurPx = (
  scrollOffsetPx: number,
  rangePx: number,
): number => {
  if (rangePx <= 0 || scrollOffsetPx <= 0) return 0;
  const linear = Math.min(1, scrollOffsetPx / rangePx);
  const t = linear * linear;
  return t * FEATURE_HERO_MAX_SCROLL_BLUR_PX;
};
