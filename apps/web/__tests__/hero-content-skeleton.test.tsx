import { HeroContentSkeleton } from "@/components/hero/hero-content-skeleton";
import { IndexFeatureHeroFallback } from "@/components/catalog/index-feature-hero-fallback";
import {
  CatalogSpotlightFallback,
  TrendingSpotlightFallback,
} from "@/components/catalog/catalog-suspense-fallbacks";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

describe("hero content skeletons", () => {
  test("shared hero content skeleton renders logo and one action bar", () => {
    const { container } = render(<HeroContentSkeleton variant="detail" />);

    expect(container.querySelectorAll(".animate-shimmer").length).toBe(2);
    expect(
      container.querySelectorAll(".rounded-full.animate-shimmer").length,
    ).toBe(1);
  });

  test("index hero fallback stays minimal", () => {
    const { container } = render(<IndexFeatureHeroFallback />);

    expect(container.querySelectorAll(".animate-shimmer").length).toBe(4);
  });

  test("spotlight fallbacks stay minimal", () => {
    const spotlight = render(<CatalogSpotlightFallback />).container;
    const trending = render(<TrendingSpotlightFallback />).container;

    expect(
      spotlight.querySelectorAll(".rounded-full.animate-shimmer").length,
    ).toBe(1);
    expect(
      trending.querySelectorAll(".rounded-full.animate-shimmer").length,
    ).toBe(1);
  });
});
