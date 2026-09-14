import { isHeroBackdropWideEnough } from "@/lib/hero-backdrop-aspect";
import type { Image } from "@/tmdb/models";

/** TMDB primary backdrop when wide enough; else best wide still from `images`. */
export const pickHeroBackdropPath = (detail: {
  backdrop_path?: string | null;
  images?: { backdrops?: Image[] | null } | null;
}): string | null => {
  const primary = detail.backdrop_path?.trim() ?? null;
  const backdrops = detail.images?.backdrops ?? [];

  if (primary) {
    const primaryMeta = backdrops.find(
      (backdrop) => backdrop.file_path === primary,
    );
    if (
      !primaryMeta?.width ||
      !primaryMeta?.height ||
      isHeroBackdropWideEnough(primaryMeta.width, primaryMeta.height)
    ) {
      return primary;
    }
  }

  const wideEnough = backdrops.filter(
    (backdrop) =>
      backdrop.file_path &&
      backdrop.width &&
      backdrop.height &&
      isHeroBackdropWideEnough(backdrop.width, backdrop.height),
  );
  const localized = wideEnough.filter(
    (backdrop) => backdrop.iso_639_1 === "en" || !backdrop.iso_639_1,
  );
  const pool = localized.length > 0 ? localized : wideEnough;
  const best = [...pool].sort(
    (left, right) => (right.width ?? 0) - (left.width ?? 0),
  )[0];

  return best?.file_path ?? primary;
};
