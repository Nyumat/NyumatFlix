import {
  buildAnilistTvDetailHref,
  normalizeAnilistAnimeDetailHref,
} from "@/lib/anilist-route-id";
import { buildMalAnimeDetailHref } from "@/lib/mal/route-id";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import {
  isJikanFallbackId,
  jikanFallbackIdToMalId,
} from "@/lib/anime-jikan-fallback";
import {
  isKitsuFallbackId,
  kitsuFallbackIdToKitsuId,
} from "@/lib/anime-kitsu-fallback";
export type AnimePageHrefInput = {
  id: number;
  media_type?: string;
  href?: string;
  isAniListFallback?: boolean;
  sourceAnilistId?: number;
  tmdbFallback?: { id: number; type: "movie" | "tv" };
};

export type AnimePageHrefResult<
  T extends AnimePageHrefInput = AnimePageHrefInput,
> = T & { href: string };

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

const ANILIST_HREF_ID = /(?:anilist\.co\/anime\/|\/anime\/anilist-)(\d+)/;

const positiveInt = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;

const anilistIdFromHref = (href: string | undefined): number | null => {
  if (!href) return null;
  const match = href.match(ANILIST_HREF_ID);
  if (!match?.[1]) return null;
  return positiveInt(Number.parseInt(match[1], 10));
};

const resolveAnimeCatalogAnilistId = (
  item: AnimePageHrefInput,
): number | null => {
  const explicit = positiveInt(item.sourceAnilistId);
  if (explicit) return explicit;

  if (item.isAniListFallback) {
    const fallbackId = positiveInt(item.id);
    if (fallbackId) return fallbackId;
  }

  return anilistIdFromHref(item.href);
};

const mappedAnimeMovieTmdbId = (item: AnimePageHrefInput): number | null => {
  const anilistId = resolveAnimeCatalogAnilistId(item);
  const itemId = positiveInt(item.id);
  if (
    item.media_type === "movie" &&
    !item.isAniListFallback &&
    itemId &&
    itemId !== anilistId
  ) {
    return itemId;
  }

  if (item.tmdbFallback?.type === "movie") {
    return positiveInt(item.tmdbFallback.id);
  }

  return null;
};

/** Keep anime hub/grid links on NyumatFlix — never outbound to AniList or non-anime /tvshows routes. */
export const withAnimePageHref = <T extends AnimePageHrefInput>(
  item: T,
): AnimePageHrefResult<T> => {
  const anilistId = resolveAnimeCatalogAnilistId(item);
  const tmdbMovieId = mappedAnimeMovieTmdbId(item);

  if (tmdbMovieId) {
    return {
      ...item,
      href: `/movies/${tmdbMovieId}`,
    };
  }

  if (anilistId) {
    return {
      ...item,
      href: buildAnilistTvDetailHref(anilistId),
    };
  }

  // Kitsu/Jikan fallback sentinels without a canonical AniList id resolve to
  // their own detail route namespaces (kitsu-/mal- slugs).
  if (item.tmdbFallback) {
    const { id, type } = item.tmdbFallback;
    return {
      ...item,
      href:
        type === "movie" ? `/movies/${id}` : buildTmdbAnimeDetailHref(id, "tv"),
    };
  }

  if (Number.isInteger(item.id) && item.id < 0) {
    if (isKitsuFallbackId(item.id)) {
      const kitsuId = kitsuFallbackIdToKitsuId(item.id);
      if (kitsuId) {
        return { ...item, href: `/anime/kitsu-${kitsuId}` };
      }
    }
    if (isJikanFallbackId(item.id)) {
      const malId = jikanFallbackIdToMalId(item.id);
      if (malId) {
        return { ...item, href: buildMalAnimeDetailHref(malId) };
      }
    }
  }

  const existingHref = typeof item.href === "string" ? item.href : undefined;
  if (existingHref && !isExternalHref(existingHref)) {
    return {
      ...item,
      href: normalizeAnilistAnimeDetailHref(existingHref),
    };
  }

  const id = Math.abs(item.id);
  const detailHref =
    item.media_type === "movie"
      ? `/movies/${id}`
      : buildTmdbAnimeDetailHref(id, "tv");

  return { ...item, href: detailHref };
};

export const withAnimePageHrefs = <T extends AnimePageHrefInput>(items: T[]) =>
  items.map(withAnimePageHref);
