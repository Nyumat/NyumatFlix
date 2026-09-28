import { isHeroBackdropWideEnough } from "@/lib/hero-backdrop-aspect";
import type { Image } from "@/tmdb/models";

export type CatalogBackdropPick = {
  path: string | null;
  localized: boolean;
};

const sortBackdropsByWidth = (backdrops: Image[]): Image[] =>
  [...backdrops].sort((left, right) => (right.width ?? 0) - (left.width ?? 0));

const filterWideBackdrops = (backdrops: Image[]): Image[] =>
  backdrops.filter(
    (backdrop) =>
      backdrop.file_path &&
      backdrop.width &&
      backdrop.height &&
      isHeroBackdropWideEnough(backdrop.width, backdrop.height),
  );

export const isLocalizedBackdropImage = (backdrop: Image): boolean =>
  Boolean(backdrop.iso_639_1?.trim());

/**
 * Prefer English localized backdrops (title treatment baked in) for catalog
 * wide cards; fall back to the hero/textless picker when none exist.
 */
export const pickLocalizedCatalogBackdropPath = (detail: {
  backdrop_path?: string | null;
  images?: { backdrops?: Image[] | null } | null;
}): CatalogBackdropPick => {
  const backdrops = detail.images?.backdrops ?? [];
  const localizedEn = sortBackdropsByWidth(
    filterWideBackdrops(backdrops).filter(
      (backdrop) => backdrop.iso_639_1 === "en",
    ),
  );
  const bestLocalized = localizedEn[0];
  if (bestLocalized?.file_path) {
    return { path: bestLocalized.file_path, localized: true };
  }

  const fallbackPath = pickHeroBackdropPath(detail);
  const fallbackMeta = backdrops.find(
    (backdrop) => backdrop.file_path === fallbackPath,
  );

  return {
    path: fallbackPath,
    localized: fallbackMeta ? isLocalizedBackdropImage(fallbackMeta) : false,
  };
};

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
