import "server-only";

import {
  fromKitsuAnimeRouteId,
  isKitsuAnimeRouteId,
} from "@/lib/kitsu/route-id";
import type { KitsuAnimeResource } from "@/lib/kitsu/client";
import { kitsuResourceToAniListMedia } from "@/lib/anime-kitsu-fallback";
import { jikanItemToAniListMedia } from "@/lib/anime-jikan-fallback";
import { fetchJikanAnimeByMalId } from "@/lib/jikan/client";
import { isMalAnimeRouteId, fromMalAnimeRouteId } from "@/lib/mal/route-id";
import { readKitsuAnimeById, readKitsuAnimeByMalId } from "@/lib/kitsu/detail";
import type { AniListMedia } from "@/lib/anilist-shared";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
import type { TvShowDetails } from "@/lib/domain/typings";

type KitsuRouteKind = "kitsu" | "mal";

const parseKitsuRoute = (
  routeId: string,
): { kind: KitsuRouteKind; id: number } | null => {
  if (isKitsuAnimeRouteId(routeId)) {
    const kitsuId = fromKitsuAnimeRouteId(routeId);
    return Number.isInteger(kitsuId) && kitsuId > 0
      ? { kind: "kitsu", id: kitsuId }
      : null;
  }
  if (isMalAnimeRouteId(routeId)) {
    const malId = fromMalAnimeRouteId(routeId);
    return Number.isInteger(malId) && malId > 0
      ? { kind: "mal", id: malId }
      : null;
  }
  return null;
};

export const isKitsuBackedAnimeRouteId = (routeId: string): boolean =>
  parseKitsuRoute(routeId) !== null;

type ResolvedProviderMedia = {
  item: KitsuAnimeResource | null;
  media: AniListMedia;
  anilistId: number | null;
  malId: number | null;
};

const resolveProviderMedia = async (
  kind: KitsuRouteKind,
  id: number,
): Promise<ResolvedProviderMedia | null> => {
  if (kind === "kitsu") {
    const detail = await readKitsuAnimeById(id);
    if (!detail) return null;
    const media = kitsuResourceToAniListMedia(
      detail.item,
      [],
      detail.anilistId,
      detail.malId,
    );
    if (!media) return null;
    return {
      item: detail.item,
      media,
      anilistId: detail.anilistId,
      malId: detail.malId,
    };
  }

  const byMal = await readKitsuAnimeByMalId(id);
  if (byMal) {
    const media = kitsuResourceToAniListMedia(
      byMal.item,
      [],
      byMal.anilistId,
      byMal.malId ?? id,
    );
    if (!media) return null;
    return {
      item: byMal.item,
      media,
      anilistId: byMal.anilistId,
      malId: byMal.malId ?? id,
    };
  }

  // Kitsu has no mapping for this MAL id — Jikan direct lookup instead.
  const jikanItem = await fetchJikanAnimeByMalId(id);
  const media = jikanItem ? jikanItemToAniListMedia(jikanItem) : null;
  if (!media) return null;
  return { item: null, media, anilistId: null, malId: id };
};

export const getKitsuAnimeDetail = async (
  routeId: string,
): Promise<TvShowDetails | null> => {
  const parsed = parseKitsuRoute(routeId);
  if (!parsed) return null;

  const resolved = await resolveProviderMedia(parsed.kind, parsed.id);
  if (!resolved) return null;
  const { item, media } = resolved;

  const attributes = item?.attributes ?? {};
  const poster =
    attributes.posterImage?.large ??
    attributes.posterImage?.medium ??
    attributes.posterImage?.original ??
    media.coverImage?.large ??
    null;
  const banner =
    attributes.coverImage?.large ??
    attributes.coverImage?.original ??
    media.bannerImage ??
    poster;
  const year = media.seasonYear ?? media.startDate?.year ?? null;
  const title =
    media.title.english ??
    media.title.romaji ??
    media.title.native ??
    "Untitled";
  const trailerVideos = attributes.youtubeVideoId?.trim()
    ? [
        {
          type: "Trailer",
          key: attributes.youtubeVideoId.trim(),
          site: "YouTube",
          name: "Official Trailer",
          official: true,
        },
      ]
    : [];

  return {
    id: media.id,
    name: title,
    original_name: media.title.romaji ?? title,
    overview: media.description ?? "",
    poster_path: poster,
    backdrop_path: banner,
    first_air_date: media.startDate?.year
      ? `${media.startDate.year}-${String(media.startDate.month ?? 1).padStart(2, "0")}-${String(media.startDate.day ?? 1).padStart(2, "0")}`
      : "",
    last_air_date: "",
    status:
      media.status === "RELEASING"
        ? "Returning Series"
        : media.status === "FINISHED"
          ? "Ended"
          : media.status === "NOT_YET_RELEASED"
            ? "Planned"
            : "Unknown",
    type: "Scripted",
    adult: media.isAdult === true,
    genre_ids: [16],
    genres: (media.genres ?? []).map((name, index) => ({
      id: 16_000 + index,
      name,
    })),
    origin_country: ["JP"],
    original_language: "ja",
    popularity: media.popularity ?? 0,
    vote_average: media.averageScore ? media.averageScore / 10 : 0,
    vote_count: media.popularity ?? 0,
    number_of_seasons: 1,
    number_of_episodes: media.episodes ?? 0,
    episode_run_time: [],
    seasons: [
      {
        id: media.id,
        name: media.format === "MOVIE" ? "Movie" : "Season 1",
        season_number: 1,
        episode_count: media.episodes ?? 0,
        air_date: year ? `${year}-01-01` : null,
        overview: media.description ?? "",
        poster_path: poster,
      },
    ],
    networks: [],
    production_countries: [{ iso_3166_1: "JP", name: "Japan" }],
    created_by: [],
    content_ratings: { results: [] },
    videos: { results: trailerVideos },
    credits: { cast: [], crew: [] },
    recommendations: { results: [] },
    similar: { results: [] },
    reviews: { results: [], page: 1, total_pages: 0, total_results: 0 },
    mappedKitsuId: parsed.kind === "kitsu" ? parsed.id : undefined,
  } as TvShowDetails & { mappedKitsuId?: number };
};

export const getKitsuAnimeAboveFoldDetail = async (
  routeId: string,
): Promise<MediaAboveFoldDetail | null> => {
  const details = await getKitsuAnimeDetail(routeId);
  if (!details) return null;
  return {
    ...details,
    media_type: "tv",
    title: details.name,
    content_rating: details.adult ? "TV-MA" : null,
    videos: extractVideoRowsFromMediaVideos(details.videos),
  };
};

/**
 * Canonicalize provider routes when a stronger id exists: kitsu-{id} with an
 * `anilist/anime` mapping redirects to the canonical `anilist-{id}` page, and
 * mal-{id} with a `myanimelist/anime` Kitsu mapping stays (MAL route already
 * redirects to AniList via resolveMalAnimeDetailRedirects when mapped).
 */
export async function resolveKitsuAnimeDetailRedirects(
  _routeId: string,
): Promise<void> {
  // Detail rendering handles kitsu-/mal- slugs directly; canonicalization to
  // anilist-{id} happens at href build time via provider mappings.
}
