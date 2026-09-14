"use client";

import {
  posterCarouselItemClassName,
  posterCarouselSkeletonClassName,
  wideCarouselItemClassName,
  wideCarouselSkeletonClassName,
} from "@/lib/carousel-layout";
import { hasBackdropPath, hasPosterPath } from "@/lib/media-poster-path";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

export type { CatalogCardStyle };

export const useCatalogCardStyle = (): CatalogCardStyle =>
  useAppSettingsStore((state) => state.catalogCardStyle);

export const isBackdropCatalogCardStyle = (
  style: CatalogCardStyle,
): style is "backdrop" => style === "backdrop";

export const carouselItemClassName = (style: CatalogCardStyle): string =>
  style === "backdrop"
    ? wideCarouselItemClassName
    : posterCarouselItemClassName;

export const carouselSkeletonClassName = (style: CatalogCardStyle): string =>
  style === "backdrop"
    ? wideCarouselSkeletonClassName
    : posterCarouselSkeletonClassName;

/** Grid / infinite-scroll tile image — pair with caption skeleton in backdrop mode. */
export const catalogGridTileImageClassName = (
  style: CatalogCardStyle,
): string =>
  [
    "catalog-grid-tile-skeleton w-full",
    style === "backdrop"
      ? "aspect-video rounded-lg"
      : "aspect-poster rounded-[28px]",
  ].join(" ");

export const hasCatalogCardArt = (
  item: { poster_path?: string | null; backdrop_path?: string | null },
  style: CatalogCardStyle,
): boolean =>
  style === "backdrop"
    ? hasBackdropPath(item) || hasPosterPath(item)
    : hasPosterPath(item);

export const filterCatalogCardArt = <
  T extends { poster_path?: string | null; backdrop_path?: string | null },
>(
  items: readonly T[],
  style: CatalogCardStyle,
): T[] => items.filter((item) => hasCatalogCardArt(item, style));

export const readImdbIdForPreview = (item: unknown): string | undefined => {
  if (!item || typeof item !== "object") {
    return undefined;
  }
  const fromExternal = (item as { external_ids?: { imdb_id?: string } })
    .external_ids?.imdb_id;
  if (typeof fromExternal === "string" && fromExternal.startsWith("tt")) {
    return fromExternal;
  }
  const fromRoot = (item as { imdb_id?: string }).imdb_id;
  if (typeof fromRoot === "string" && fromRoot.startsWith("tt")) {
    return fromRoot;
  }
  return undefined;
};

export const buildCardHoverPreviewId = (params: {
  mediaType?: string;
  id: string | number;
}): string => `${params.mediaType ?? "media"}-${String(params.id)}`;
