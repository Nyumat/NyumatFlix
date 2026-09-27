import { pickLocalizedCatalogBackdropPath } from "@/lib/catalog-hub-backdrop";
import type { CanonicalCardLogo } from "@/lib/domain/typings";
import type { GetImagesResponse, Image } from "@/tmdb/models";

type EnrichableAnimeHubVisualItem = {
  id: number;
  media_type?: string;
  backdrop_path?: string | null;
  isAniListFallback?: boolean;
  localized_backdrop?: boolean;
  logo?: CanonicalCardLogo;
};

export const isTmdbBackdropPath = (path: string | null | undefined): boolean =>
  Boolean(path?.startsWith("/") && !path.startsWith("//"));

export const selectCatalogLogo = (
  logos: Image[] | undefined,
): CanonicalCardLogo | undefined => {
  const logo = logos?.find((entry) => entry.iso_639_1 === "en") ?? logos?.[0];
  if (!logo?.file_path) {
    return undefined;
  }

  return {
    file_path: logo.file_path,
    width: logo.width,
    height: logo.height,
  };
};

export const shouldEnrichAnimeHubCatalogVisuals = (
  item: EnrichableAnimeHubVisualItem,
): boolean => {
  if (item.isAniListFallback) {
    return false;
  }
  if (!Number.isInteger(item.id) || item.id <= 0) {
    return false;
  }
  if (isTmdbBackdropPath(item.backdrop_path)) {
    return false;
  }
  return true;
};

export const applyTmdbImagesToAnimeHubItem = <
  T extends EnrichableAnimeHubVisualItem,
>(
  item: T,
  images: GetImagesResponse,
): T & { localized_backdrop: false; logo: undefined } => {
  const picked = pickLocalizedCatalogBackdropPath({
    backdrop_path: isTmdbBackdropPath(item.backdrop_path)
      ? item.backdrop_path
      : null,
    images,
  });
  return {
    ...item,
    ...(picked.path ? { backdrop_path: picked.path } : {}),
    // localized art can include title treatment; keep text captions below the card
    localized_backdrop: false,
    logo: undefined,
  };
};
