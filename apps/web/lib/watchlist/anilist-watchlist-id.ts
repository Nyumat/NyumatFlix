import type { AniListTvMedia } from "@/lib/anilist-tv-detail";
import {
  getAnilistTitlesForTmdbMatch,
  normalizeTitleForTmdbMatch,
} from "@/lib/anilist-tmdb-match";

export function anilistTitleMatchesTmdbName(
  anilistMedia: AniListTvMedia,
  tmdbName: string | null | undefined,
): boolean {
  const normalizedTmdb = normalizeTitleForTmdbMatch(tmdbName);
  if (!normalizedTmdb) return false;

  return getAnilistTitlesForTmdbMatch(anilistMedia).some((title) => {
    const normalized = normalizeTitleForTmdbMatch(title);
    if (!normalized) return false;
    if (normalized === normalizedTmdb) return true;
    if (normalized.length >= 4) {
      return (
        normalizedTmdb.includes(normalized) ||
        normalized.includes(normalizedTmdb)
      );
    }
    return false;
  });
}

/**
 * Anime detail pages save AniList ids as watchlist `contentId`. Those ids can
 * collide with unrelated TMDB tv ids (e.g. 196187), so we must not trust TMDB
 * lookups at `contentId` when AniList data disagrees.
 */
export function shouldPreferAnilistWatchlistMedia(args: {
  anilistMedia: AniListTvMedia | null;
  tmdbTitle: string | null | undefined;
  tmdbFetchSucceeded: boolean;
  mappedTmdbId: number | null;
  contentId: number;
}): boolean {
  const {
    anilistMedia,
    tmdbTitle,
    tmdbFetchSucceeded,
    mappedTmdbId,
    contentId,
  } = args;

  if (!anilistMedia) return false;
  if (!tmdbFetchSucceeded) return true;
  if (mappedTmdbId != null && mappedTmdbId !== contentId) return true;
  if (!anilistTitleMatchesTmdbName(anilistMedia, tmdbTitle)) return true;

  return false;
}
