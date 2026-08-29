export const MIN_HERO_BACKDROP_ASPECT_RATIO = 1.5;

export const isTmdbStyleBackdropPath = (
  path: string | null | undefined,
): boolean => Boolean(path?.startsWith("/") && !path.startsWith("//"));

export const isHeroBackdropWideEnough = (
  width: number,
  height: number,
  minAspectRatio: number = MIN_HERO_BACKDROP_ASPECT_RATIO,
): boolean => {
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return false;
  }

  return width / height >= minAspectRatio;
};
