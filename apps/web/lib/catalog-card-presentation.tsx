"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  posterCarouselItemClassName,
  posterCarouselSkeletonClassName,
  wideCarouselItemClassName,
  wideCarouselSkeletonClassName,
} from "@/lib/carousel-layout";
import { hasBackdropPath, hasPosterPath } from "@/lib/media-poster-path";
import { useAppSettingsStore } from "@/lib/stores/app-settings-store";
import { readDeviceCatalogCardStyle } from "@/lib/user/catalog-card-style-store";
import type { CatalogCardStyle } from "@/lib/user/user-settings-types";

export type { CatalogCardStyle };

const CatalogCardStyleContext = createContext<CatalogCardStyle | null>(null);

// first paint has to match the html the server sent. the zustand store is
// created without the request cookie, so reading it while hydrating rebuilds
// the card tree. saved prefs apply after that snapshot commits.
export function CatalogCardStyleProvider({
  initialStyle,
  locked = false,
  children,
}: {
  initialStyle: CatalogCardStyle;
  locked?: boolean;
  children: ReactNode;
}) {
  const [style, setStyle] = useState(initialStyle);

  useEffect(() => {
    const publish = (next: CatalogCardStyle) => {
      setStyle(next);
      document.documentElement.dataset.catalogCardStyle = next;
    };

    const device = locked ? null : readDeviceCatalogCardStyle();
    const next = device ?? initialStyle;
    publish(next);
    if (useAppSettingsStore.getState().catalogCardStyle !== next) {
      useAppSettingsStore.setState({ catalogCardStyle: next });
    }

    return useAppSettingsStore.subscribe((state) => {
      publish(state.catalogCardStyle);
    });
  }, [initialStyle, locked]);

  return (
    <CatalogCardStyleContext.Provider value={style}>
      {children}
    </CatalogCardStyleContext.Provider>
  );
}

export const useCatalogCardStyle = (): CatalogCardStyle => {
  const seeded = useContext(CatalogCardStyleContext);
  const stored = useAppSettingsStore((state) => state.catalogCardStyle);
  return seeded ?? stored;
};

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

/** YouTube trailer video id attached during AniList/anime enrichment. */
export const readYoutubeKeyForPreview = (item: unknown): string | undefined => {
  if (!item || typeof item !== "object") {
    return undefined;
  }
  const record = item as {
    youtube_trailer_key?: unknown;
    youtube_id?: unknown;
  };
  const key = record.youtube_trailer_key ?? record.youtube_id;
  return typeof key === "string" && key.trim().length > 0
    ? key.trim()
    : undefined;
};

export type CardPreviewSource = {
  /**
   * `stream` plays an IMDb MP4/HLS via VideasyStreamVideo; `youtube` plays the
   * AniList/Jikan YouTube trailer through the shared IFrame API layer.
   */
  kind: "stream" | "youtube";
  imdbId?: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  youtubeKey?: string;
};

export const readCardPreviewSource = (
  item: unknown,
): CardPreviewSource | undefined => {
  if (!item || typeof item !== "object") {
    return undefined;
  }

  const record = item as {
    id?: unknown;
    media_type?: unknown;
    isAniListFallback?: unknown;
  };
  const mediaType =
    record.media_type === "tv"
      ? "tv"
      : record.media_type === "movie"
        ? "movie"
        : undefined;
  const numericId =
    typeof record.id === "number" &&
    Number.isInteger(record.id) &&
    record.id > 0
      ? record.id
      : undefined;
  // Unresolved AniList fallbacks keep the AniList id in `id`, so it must never
  // be sent to TMDB as a TMDB id.
  const tmdbId =
    numericId && mediaType && record.isAniListFallback !== true
      ? numericId
      : undefined;

  const imdbId = readImdbIdForPreview(item);
  if (imdbId) {
    return { kind: "stream", imdbId, tmdbId, mediaType };
  }
  if (tmdbId && mediaType) {
    return { kind: "stream", tmdbId, mediaType };
  }

  const youtubeKey = readYoutubeKeyForPreview(item);
  if (youtubeKey) {
    return { kind: "youtube", youtubeKey };
  }

  return undefined;
};

export const buildCardHoverPreviewId = (params: {
  mediaType?: string;
  id: string | number;
}): string => `${params.mediaType ?? "media"}-${String(params.id)}`;
