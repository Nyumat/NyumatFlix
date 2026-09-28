/** Pixel tolerance for start/end alignment (Embla offset vs scrollProgress can diverge). */
export const CAROUSEL_OFFSET_EPSILON = 0.5;

export type CarouselOffsetPanState = {
  atStart: boolean;
  atEnd: boolean;
  canPanPrev: boolean;
  canPanNext: boolean;
  distanceToStart: number;
  distanceToEnd: number;
};

export const carouselOffsetPanState = (
  offset: number,
  min: number,
  max: number,
  epsilon = CAROUSEL_OFFSET_EPSILON,
): CarouselOffsetPanState => {
  const distanceToStart = max - offset;
  const distanceToEnd = offset - min;

  return {
    distanceToStart,
    distanceToEnd,
    atStart: distanceToStart <= epsilon,
    atEnd: distanceToEnd <= epsilon,
    canPanPrev: distanceToStart > epsilon,
    canPanNext: distanceToEnd > epsilon,
  };
};

/** Snap to true start/end when a wheel pan would overshoot the remaining travel. */
export const shouldSnapCarouselWheelPan = (
  direction: "prev" | "next",
  moveDistance: number,
  state: CarouselOffsetPanState,
  epsilon = CAROUSEL_OFFSET_EPSILON,
): boolean => {
  if (!Number.isFinite(moveDistance) || moveDistance <= 0) {
    return false;
  }

  if (direction === "prev") {
    return (
      state.distanceToStart > epsilon &&
      moveDistance >= state.distanceToStart - epsilon
    );
  }

  return (
    state.distanceToEnd > epsilon &&
    moveDistance >= state.distanceToEnd - epsilon
  );
};
