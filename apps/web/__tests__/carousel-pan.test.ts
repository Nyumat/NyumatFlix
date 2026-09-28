import {
  carouselOffsetPanState,
  CAROUSEL_OFFSET_EPSILON,
  shouldSnapCarouselWheelPan,
} from "@/lib/carousel-pan";
import { describe, expect, it } from "vitest";

describe("carouselOffsetPanState", () => {
  const min = -1000;
  const max = 0;

  it("treats offset at max as start even when progress could read zero early", () => {
    const atStart = carouselOffsetPanState(max, min, max);
    expect(atStart.atStart).toBe(true);
    expect(atStart.canPanPrev).toBe(false);

    const almostStart = carouselOffsetPanState(max - 40, min, max);
    expect(almostStart.atStart).toBe(false);
    expect(almostStart.canPanPrev).toBe(true);
    expect(almostStart.distanceToStart).toBe(40);
  });
});

describe("shouldSnapCarouselWheelPan", () => {
  it("snaps prev when the wheel step would overshoot remaining travel to start", () => {
    const state = carouselOffsetPanState(-30, -1000, 0);
    expect(
      shouldSnapCarouselWheelPan("prev", 35, state, CAROUSEL_OFFSET_EPSILON),
    ).toBe(true);
    expect(
      shouldSnapCarouselWheelPan("prev", 10, state, CAROUSEL_OFFSET_EPSILON),
    ).toBe(false);
  });
});
