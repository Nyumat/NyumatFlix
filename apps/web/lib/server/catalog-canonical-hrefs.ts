import "server-only";

import { buildAnilistTvDetailHref } from "@/lib/anilist-route-id";
import { runInChunks } from "@/lib/server/chunked-parallel";
import { getCachedTmdbResponse } from "@/lib/server/tmdb-response-cache";
import { buildTmdbAnimeDetailHref } from "@/lib/tmdb-anime-route-id";
import type { MediaItem } from "@/lib/domain/typings";
import { isAnime } from "@/utils/anilist-helpers";
import {
  getAnilistIdFromTmdbLookup,
  getAnilistIdFromTmdbMovieLookup,
} from "@/lib/anime/tmdb-anilist-lookup-server";

type TmdbCatalogItem = MediaItem & {
  href?: string;
  sourceAnilistId?: number;
  genre_ids?: number[];
  original_language?: string;
  origin_country?: string[];
};

/**
 * Link-time canonicalization: attach the canonical detail `href` to TMDB
 * catalog rows BEFORE they are slimmed, so cards navigate directly to
 * `/anime/anilist-*` with zero detail-time redirect and no URL flicker.
 *
 * Only the O(1) precomputed lookup runs here (no live AniList search, no
 * TMDB detail fetch). Cache shape mirrors the showcase API cache so repeat
 * renders are memory/incremental-cache hits.
 */
const resolveRowHref = async (
  item: TmdbCatalogItem,
  mediaType: "movie" | "tv",
): Promise<string | null> => {
  if (typeof item.href === "string" && item.href.length > 0) {
    return item.href;
  }
  if (
    typeof item.sourceAnilistId === "number" &&
    Number.isInteger(item.sourceAnilistId) &&
    item.sourceAnilistId > 0
  ) {
    return buildAnilistTvDetailHref(item.sourceAnilistId);
  }
  if (!Number.isInteger(item.id) || item.id <= 0) return null;
  if (!isAnime(item)) return null;

  const anilistId =
    mediaType === "movie"
      ? await getAnilistIdFromTmdbMovieLookup(item.id)
      : await getAnilistIdFromTmdbLookup(item.id, 1);
  if (anilistId) return buildAnilistTvDetailHref(anilistId);

  // Anime-looking but unmapped: use the deferred `/anime/tmdb-*` route so
  // the detail page resolves (or falls back to TMDB) without blocking here.
  return buildTmdbAnimeDetailHref(item.id, mediaType);
};

const enrichRowItems = async (
  items: MediaItem[],
  mediaType: "movie" | "tv",
): Promise<MediaItem[]> => {
  const enriched = await runInChunks(
    items,
    async (item) => {
      const href = await resolveRowHref(
        item as TmdbCatalogItem,
        mediaType,
      ).catch(() => null);
      if (!href) return item;
      return { ...item, href } as MediaItem;
    },
    20,
  );
  return enriched;
};

/**
 * Enrich TMDB catalog rows with canonical detail hrefs. Cached per row+type
 * so the O(1) lookups run once per showcase payload, not per card render.
 */
export const withCanonicalCatalogHrefs = async (
  rows: Array<{
    rowId: string;
    title: string;
    href: string;
    items: MediaItem[];
  }>,
  mediaType: "movie" | "tv",
): Promise<
  Array<{ rowId: string; title: string; href: string; items: MediaItem[] }>
> => {
  const rowKey = rows
    .map((row) => `${row.rowId}:${row.items.length}`)
    .join("|");
  return getCachedTmdbResponse({
    cacheKey: `catalog-canonical-hrefs:${mediaType}:${rowKey}`,
    tags: [`catalog:${mediaType}`],
    revalidateSeconds: 60 * 60,
    memoryFallback: true,
    load: async () =>
      Promise.all(
        rows.map(async (row) => ({
          ...row,
          items: await enrichRowItems(row.items, mediaType),
        })),
      ),
  });
};
