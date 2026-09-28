import { COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID } from "@/lib/analytics/community-watching-exclusions";

const TMDB_DETAIL_PATH_PATTERN = /^\/(movies|tvshows|anime)\/(\d+)$/;
const ANILIST_DETAIL_PATH_PATTERN = /^\/(anime|tvshows)\/anilist-(\d+)$/;

export type ParsedPopularContentPath =
  | {
      variant: "tmdb";
      mediaType: "movie" | "tv";
      id: number;
      href: string;
    }
  | {
      variant: "anilist";
      anilistId: number;
      href: string;
    };

export function parsePopularContentPath(
  urlPath: string,
): ParsedPopularContentPath | null {
  const tmdbMatch = TMDB_DETAIL_PATH_PATTERN.exec(urlPath);
  if (tmdbMatch) {
    const segment = tmdbMatch[1];
    const id = Number.parseInt(tmdbMatch[2], 10);
    if (!Number.isFinite(id) || id <= 0) return null;

    const mediaType = segment === "movies" ? "movie" : "tv";
    return {
      variant: "tmdb",
      mediaType,
      id,
      href: urlPath,
    };
  }

  const anilistMatch = ANILIST_DETAIL_PATH_PATTERN.exec(urlPath);
  if (anilistMatch) {
    const anilistId = Number.parseInt(anilistMatch[2], 10);
    if (!Number.isFinite(anilistId) || anilistId <= 0) return null;

    return {
      variant: "anilist",
      anilistId,
      href: urlPath.startsWith("/tvshows/")
        ? `/anime/anilist-${anilistId}`
        : urlPath,
    };
  }

  return null;
}

export function isExcludedPopularContentPath(
  parsed: ParsedPopularContentPath,
): boolean {
  return (
    parsed.variant === "tmdb" &&
    parsed.mediaType === "tv" &&
    parsed.id === COMMUNITY_WATCHING_EXCLUDED_TMDB_TV_ID
  );
}
