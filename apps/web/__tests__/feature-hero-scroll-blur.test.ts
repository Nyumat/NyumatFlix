import {
  FEATURE_HERO_MAX_SCROLL_BLUR_PX,
  getFeatureHeroScrollBlurPx,
  getFeatureHeroScrollBlurRangePx,
} from "@/lib/feature-hero-scroll-blur";

describe("feature hero scroll blur", () => {
  it("ramps blur to the ambient cap across the scroll range", () => {
    const range = getFeatureHeroScrollBlurRangePx(1000);
    expect(getFeatureHeroScrollBlurPx(0, range)).toBe(0);
    expect(getFeatureHeroScrollBlurPx(range / 2, range)).toBe(
      FEATURE_HERO_MAX_SCROLL_BLUR_PX / 4,
    );
    expect(getFeatureHeroScrollBlurPx(range, range)).toBe(
      FEATURE_HERO_MAX_SCROLL_BLUR_PX,
    );
    expect(getFeatureHeroScrollBlurPx(range * 2, range)).toBe(
      FEATURE_HERO_MAX_SCROLL_BLUR_PX,
    );
  });
});
