import {
  cleanAniListDescription,
  getAniListPoster,
  getAniListTitle,
  ANILIST_ENDPOINT,
  type AniListMedia,
} from "@/lib/anilist";
import {
  resolveAniListFranchise,
  stripSeasonSuffix,
  type AniListFranchise,
} from "@/lib/anilist-franchise";
import {
  buildAnilistTvDetailHref,
  fromAnilistTvRouteId,
  isAnilistTvRouteId,
  toAnilistTvRouteSlug,
} from "@/lib/anilist-route-id";
import type { MediaAboveFoldDetail } from "@/lib/media-above-fold";
import { extractVideoRowsFromMediaVideos } from "@/lib/select-primary-trailer-video";
import type {
  Actor,
  CreditsReponse as Credits,
  Episode,
  Season,
  SeasonDetails,
  TvShow,
  TvShowDetails,
} from "@/lib/domain/typings";
import type { ListResponse } from "@/tmdb/api";
import { cache } from "react";

const ANILIST_TV_DETAIL_REVALIDATE_SECONDS = 3600;
const ANILIST_FETCH_TIMEOUT_MS = 12_000;
const ANILIST_FETCH_MAX_ATTEMPTS = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchAniListWithRetry = async (
  body: Record<string, unknown>,
): Promise<Response | null> => {
  for (let attempt = 1; attempt <= ANILIST_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ANILIST_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(ANILIST_FETCH_TIMEOUT_MS),
        next: { revalidate: ANILIST_TV_DETAIL_REVALIDATE_SECONDS },
      });

      if (response.ok || response.status < 500) {
        return response;
      }
    } catch {
      void 0;
    }

    if (attempt < ANILIST_FETCH_MAX_ATTEMPTS) {
      await sleep(250 * attempt);
    }
  }

  return null;
};
const DEFAULT_AIRING_EPISODE_COUNT = 12;

type AniListCharacterEdge = {
  role?: string | null;
  node?: {
    id: number;
    name?: { full?: string | null } | null;
    image?: { large?: string | null } | null;
  } | null;
};

type AniListRelationEdge = {
  relationType?: string | null;
  node?: {
    id: number;
    type?: string | null;
    format?: string | null;
    title?: {
      romaji?: string | null;
      english?: string | null;
    } | null;
    coverImage?: { large?: string | null } | null;
    averageScore?: number | null;
    startDate?: { year?: number | null } | null;
  } | null;
};

type AiringNode = {
  episode?: number | null;
  airingAt?: number | null;
};

export type AniListTvMedia = {
  id: number;
  type: "ANIME";
  isAdult?: boolean | null;
  title: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  };
  description?: string | null;
  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
  } | null;
  bannerImage?: string | null;
  genres?: string[] | null;
  averageScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  episodes?: number | null;
  duration?: number | null;
  status?: string | null;
  format?: string | null;
  season?: string | null;
  seasonYear?: number | null;
  trailer?: {
    id?: string | null;
    site?: string | null;
  } | null;
  startDate?: {
    year?: number | null;
    month?: number | null;
    day?: number | null;
  } | null;
  nextAiringEpisode?: {
    episode?: number | null;
    airingAt?: number | null;
  } | null;
  airingSchedule?: {
    nodes?: AiringNode[] | null;
  } | null;
  characters?: {
    edges?: AniListCharacterEdge[] | null;
  } | null;
  relations?: {
    edges?: AniListRelationEdge[] | null;
  } | null;
};

export type ResolvedAniListTvShow = {
  routeSlug: string;
  franchise: AniListFranchise;
  seasonsByAnilistId: Map<number, AniListTvMedia>;
  root: AniListTvMedia;
  entry: AniListTvMedia;
};

const ANILIST_TV_DETAIL_QUERY = `
  query AniListTvDetail($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      type
      isAdult
      title {
        romaji
        english
        native
      }
      description(asHtml: false)
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      averageScore
      popularity
      favourites
      episodes
      duration
      status
      format
      season
      seasonYear
      trailer {
        id
        site
      }
      startDate {
        year
        month
        day
      }
      nextAiringEpisode {
        episode
        airingAt
      }
      airingSchedule(notYetAired: true, perPage: 50) {
        nodes {
          episode
          airingAt
        }
      }
      characters(perPage: 24, sort: ROLE) {
        edges {
          role
          node {
            id
            name {
              full
            }
            image {
              large
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            type
            format
            title {
              romaji
              english
            }
            coverImage {
              large
            }
            averageScore
            startDate {
              year
            }
          }
        }
      }
    }
  }
`;

const asAniListMedia = (media: AniListTvMedia): AniListMedia =>
  media as AniListMedia;

const mapAniListTrailerToVideos = (
  media: AniListTvMedia,
): Array<{
  type: string;
  key: string;
  site: string;
  name: string;
  official: boolean;
}> => {
  const site = media.trailer?.site?.trim().toLowerCase();
  const key = media.trailer?.id?.trim();
  if (!key || (site && site !== "youtube")) {
    return [];
  }

  return [
    {
      type: "Trailer",
      key,
      site: "YouTube",
      name: "Official Trailer",
      official: true,
    },
  ];
};

const toAirDate = (media: AniListTvMedia) => {
  const year = media.startDate?.year ?? media.seasonYear;
  if (!year) return "";
  const month = String(media.startDate?.month ?? 1).padStart(2, "0");
  const day = String(media.startDate?.day ?? 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const airingTimestampToDate = (airingAt?: number | null) => {
  if (!airingAt) return "";
  return new Date(airingAt * 1000).toISOString().slice(0, 10);
};

const mapAniListStatus = (status?: string | null) => {
  switch (status) {
    case "RELEASING":
      return "Returning Series";
    case "FINISHED":
      return "Ended";
    case "NOT_YET_RELEASED":
      return "Planned";
    case "CANCELLED":
      return "Canceled";
    case "HIATUS":
      return "On Hiatus";
    default:
      return status ?? "Unknown";
  }
};

const collectEpisodeNumbers = (media: AniListTvMedia): number[] => {
  const numbers = new Set<number>();

  if (typeof media.episodes === "number" && media.episodes > 0) {
    for (let episode = 1; episode <= media.episodes; episode += 1) {
      numbers.add(episode);
    }
  }

  for (const node of media.airingSchedule?.nodes ?? []) {
    if (typeof node.episode === "number" && node.episode > 0) {
      numbers.add(node.episode);
    }
  }

  if (typeof media.nextAiringEpisode?.episode === "number") {
    numbers.add(media.nextAiringEpisode.episode);
    for (
      let episode = 1;
      episode < media.nextAiringEpisode.episode;
      episode += 1
    ) {
      numbers.add(episode);
    }
  }

  if (numbers.size === 0) {
    if (media.format === "MOVIE") {
      numbers.add(1);
    } else if (
      media.status === "RELEASING" ||
      media.status === "NOT_YET_RELEASED"
    ) {
      for (
        let episode = 1;
        episode <= DEFAULT_AIRING_EPISODE_COUNT;
        episode += 1
      ) {
        numbers.add(episode);
      }
    }
  }

  return [...numbers].sort((a, b) => a - b);
};

const buildEpisodes = (media: AniListTvMedia): Episode[] => {
  const episodeNumbers = collectEpisodeNumbers(media);
  if (episodeNumbers.length === 0) return [];

  const poster = getAniListPoster(asAniListMedia(media)) ?? null;
  const runtime =
    typeof media.duration === "number" && media.duration > 0
      ? media.duration
      : null;
  const defaultAirDate = toAirDate(media);
  const airingDates = new Map<number, string>();

  for (const node of media.airingSchedule?.nodes ?? []) {
    if (typeof node.episode === "number" && node.episode > 0) {
      airingDates.set(
        node.episode,
        airingTimestampToDate(node.airingAt) || defaultAirDate,
      );
    }
  }

  return episodeNumbers.map((episodeNumber) => ({
    id: media.id * 10_000 + episodeNumber,
    name: `Episode ${episodeNumber}`,
    overview: "",
    episode_number: episodeNumber,
    air_date: airingDates.get(episodeNumber) ?? defaultAirDate,
    still_path: poster,
    runtime,
    vote_average: 0,
    vote_count: 0,
  }));
};

const buildSeason = (media: AniListTvMedia, seasonNumber: number): Season => {
  const episodeCount = collectEpisodeNumbers(media).length;
  const poster = getAniListPoster(asAniListMedia(media)) ?? null;
  const seasonLabel =
    seasonNumber === 1 && episodeCount <= 1 && media.format === "MOVIE"
      ? "Movie"
      : `Season ${seasonNumber}`;

  return {
    id: media.id,
    name: seasonLabel,
    season_number: seasonNumber,
    episode_count: episodeCount,
    air_date: toAirDate(media) || null,
    overview: cleanAniListDescription(media.description),
    poster_path: poster,
  };
};

const mapCharactersToCast = (media: AniListTvMedia): Actor[] => {
  const cast: Actor[] = [];

  for (const edge of media.characters?.edges ?? []) {
    const node = edge.node;
    if (!node?.id || !node.name?.full) continue;

    cast.push({
      id: node.id,
      name: node.name.full,
      character: edge.role ?? "Main",
      profile_path: node.image?.large ?? null,
      popularity: 0,
    });
  }

  return cast;
};

const mapRelationToTvShow = (edge: AniListRelationEdge): TvShow | null => {
  const node = edge.node;
  if (!node || node.type !== "ANIME" || !node.id) return null;

  const title =
    node.title?.english?.trim() || node.title?.romaji?.trim() || "Untitled";

  return {
    id: node.id,
    name: title,
    original_name: node.title?.romaji ?? title,
    overview: "",
    poster_path: node.coverImage?.large ?? null,
    backdrop_path: node.coverImage?.large ?? null,
    first_air_date: node.startDate?.year ? `${node.startDate.year}-01-01` : "",
    genre_ids: [16],
    origin_country: ["JP"],
    original_language: "ja",
    popularity: 0,
    vote_average: node.averageScore ? node.averageScore / 10 : 0,
    vote_count: 0,
    href: buildAnilistTvDetailHref(node.id),
  } as TvShow & { href: string };
};

const getDisplayTitle = (root: AniListTvMedia, entry: AniListTvMedia) => {
  const rootTitle = getAniListTitle(asAniListMedia(root));
  const entryTitle = getAniListTitle(asAniListMedia(entry));
  return (
    stripSeasonSuffix(rootTitle) || stripSeasonSuffix(entryTitle) || entryTitle
  );
};

const getBackdrop = (root: AniListTvMedia, entry: AniListTvMedia) =>
  root.bannerImage ??
  entry.bannerImage ??
  getAniListPoster(asAniListMedia(root)) ??
  getAniListPoster(asAniListMedia(entry)) ??
  null;

const mapResolvedShowToDetails = (
  resolved: ResolvedAniListTvShow,
): TvShowDetails => {
  const { franchise, root, entry, seasonsByAnilistId } = resolved;
  const displayTitle = getDisplayTitle(root, entry);
  const poster =
    getAniListPoster(asAniListMedia(root)) ??
    getAniListPoster(asAniListMedia(entry)) ??
    null;
  const backdrop = getBackdrop(root, entry);
  const seasons = franchise.seasons.map(({ anilistId, seasonNumber }) => {
    const media = seasonsByAnilistId.get(anilistId);
    if (!media) {
      return buildSeason(entry, seasonNumber);
    }
    return buildSeason(media, seasonNumber);
  });
  const totalEpisodes = seasons.reduce(
    (sum, season) => sum + season.episode_count,
    0,
  );
  const genres = (root.genres ?? entry.genres ?? []).map((name, index) => ({
    id: 16_000 + index,
    name,
  }));
  const trailerVideos = (() => {
    const fromRoot = mapAniListTrailerToVideos(root);
    return fromRoot.length > 0 ? fromRoot : mapAniListTrailerToVideos(entry);
  })();

  return {
    id: franchise.rootAnilistId,
    name: displayTitle,
    original_name: root.title.romaji ?? entry.title.romaji ?? displayTitle,
    overview:
      cleanAniListDescription(root.description) ||
      cleanAniListDescription(entry.description),
    poster_path: poster,
    backdrop_path: backdrop,
    first_air_date: toAirDate(root) || toAirDate(entry),
    last_air_date: toAirDate(entry) || toAirDate(root),
    status: mapAniListStatus(entry.status ?? root.status),
    type: "Scripted",
    adult: root.isAdult === true || entry.isAdult === true,
    genre_ids: [16],
    genres,
    origin_country: ["JP"],
    original_language: "ja",
    popularity: entry.popularity ?? root.popularity ?? 0,
    vote_average: entry.averageScore
      ? entry.averageScore / 10
      : root.averageScore
        ? root.averageScore / 10
        : 0,
    vote_count: entry.favourites ?? root.favourites ?? entry.popularity ?? 0,
    number_of_seasons: seasons.length,
    number_of_episodes: totalEpisodes,
    episode_run_time:
      typeof entry.duration === "number" && entry.duration > 0
        ? [entry.duration]
        : typeof root.duration === "number" && root.duration > 0
          ? [root.duration]
          : [],
    seasons,
    networks: [],
    production_countries: [{ iso_3166_1: "JP", name: "Japan" }],
    created_by: [],
    content_ratings: { results: [] },
    videos: { results: trailerVideos },
    credits: {
      cast: mapCharactersToCast(root),
      crew: [],
    },
    recommendations: {
      results: (entry.relations?.edges ?? root.relations?.edges ?? [])
        .map(mapRelationToTvShow)
        .filter((show): show is TvShow => show !== null)
        .slice(0, 12),
    },
    similar: { results: [] },
    reviews: { results: [], page: 1, total_pages: 0, total_results: 0 },
  } as TvShowDetails;
};

const mapToAboveFoldDetail = (
  resolved: ResolvedAniListTvShow,
): MediaAboveFoldDetail => {
  const details = mapResolvedShowToDetails(resolved);
  return {
    ...details,
    media_type: "tv",
    title: details.name,
    content_rating: details.adult ? "TV-MA" : null,
    videos: extractVideoRowsFromMediaVideos(details.videos),
  };
};

const fetchAniListTvMediaUncached = async (
  anilistId: number,
): Promise<AniListTvMedia | null> => {
  const response = await fetchAniListWithRetry({
    query: ANILIST_TV_DETAIL_QUERY,
    variables: { id: anilistId },
  });

  if (!response?.ok) return null;

  try {
    const payload = (await response.json()) as {
      data?: { Media?: AniListTvMedia | null };
      errors?: Array<{ message: string }>;
    };

    if (payload.errors?.length || !payload.data?.Media) {
      return null;
    }

    return payload.data.Media;
  } catch {
    return null;
  }
};

const resolveAniListTvShowUncached = async (
  entryAnilistId: number,
): Promise<ResolvedAniListTvShow | null> => {
  const franchise = await resolveAniListFranchise(entryAnilistId);
  const seasonMedia = await Promise.all(
    franchise.seasons.map(async ({ anilistId }) => {
      const media = await getCachedAnilistTvMedia(anilistId);
      return [anilistId, media] as const;
    }),
  );

  const seasonsByAnilistId = new Map<number, AniListTvMedia>();
  for (const [anilistId, media] of seasonMedia) {
    if (media) {
      seasonsByAnilistId.set(anilistId, media);
    }
  }

  const entry = seasonsByAnilistId.get(franchise.entryAnilistId);
  const root = seasonsByAnilistId.get(franchise.rootAnilistId);
  if (!entry || !root) return null;

  return {
    routeSlug: toAnilistTvRouteSlug(franchise.rootAnilistId),
    franchise,
    seasonsByAnilistId,
    root,
    entry,
  };
};

export const getCachedAnilistTvMedia = cache(fetchAniListTvMediaUncached);
const getCachedResolvedAniListTvShow = cache(resolveAniListTvShowUncached);

const requireResolvedAniListTvShow = async (routeId: string) => {
  if (!isAnilistTvRouteId(routeId)) return null;
  return getCachedResolvedAniListTvShow(fromAnilistTvRouteId(routeId));
};

export const getCachedAnilistTvAboveFoldDetail = async (routeId: string) => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  return resolved ? mapToAboveFoldDetail(resolved) : null;
};

export const getCachedAnilistTvShowDetail = async (routeId: string) => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  return resolved ? mapResolvedShowToDetails(resolved) : null;
};

export const getCachedAnilistTvSeasonDetails = async (
  routeId: string,
  seasonNumber: number,
) => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  if (!resolved) return null;

  const franchiseSeason = resolved.franchise.seasons.find(
    (season) => season.seasonNumber === seasonNumber,
  );
  if (!franchiseSeason) return null;

  const media =
    resolved.seasonsByAnilistId.get(franchiseSeason.anilistId) ??
    resolved.entry;
  const season = buildSeason(media, seasonNumber);

  return {
    id: season.id,
    name: season.name,
    overview: season.overview,
    season_number: season.season_number,
    episodes: buildEpisodes(media),
  } satisfies SeasonDetails;
};

export const getCachedAnilistTvAllSeasons = async (
  routeId: string,
): Promise<Record<number, SeasonDetails>> => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  if (!resolved) return {};

  const allSeasons: Record<number, SeasonDetails> = {};

  for (const franchiseSeason of resolved.franchise.seasons) {
    const media =
      resolved.seasonsByAnilistId.get(franchiseSeason.anilistId) ??
      resolved.entry;
    const season = buildSeason(media, franchiseSeason.seasonNumber);
    allSeasons[franchiseSeason.seasonNumber] = {
      id: season.id,
      name: season.name,
      overview: season.overview,
      season_number: season.season_number,
      episodes: buildEpisodes(media),
    };
  }

  return allSeasons;
};

export const getCachedAnilistTvCredits = async (
  routeId: string,
): Promise<Credits> => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  return {
    id: resolved?.franchise.rootAnilistId ?? fromAnilistTvRouteId(routeId),
    cast: resolved ? mapCharactersToCast(resolved.root) : [],
    crew: [],
  };
};

export const getCachedAnilistTvRecommendations = async (
  routeId: string,
): Promise<ListResponse<TvShow>> => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  const results = (resolved?.entry.relations?.edges ?? [])
    .map(mapRelationToTvShow)
    .filter((show): show is TvShow => show !== null)
    .slice(0, 20);

  return {
    page: 1,
    results,
    total_pages: 1,
    total_results: results.length,
  };
};

export const resolveAnilistSeasonAnilistId = async (
  routeId: string,
  seasonNumber: number,
): Promise<number | null> => {
  const resolved = await requireResolvedAniListTvShow(routeId);
  if (!resolved) return null;

  const franchiseSeason = resolved.franchise.seasons.find(
    (season) => season.seasonNumber === seasonNumber,
  );

  return franchiseSeason?.anilistId ?? null;
};

export const getCanonicalAnilistTvRouteSlug = async (
  entryRouteId: string,
): Promise<string | null> => {
  const resolved = await requireResolvedAniListTvShow(entryRouteId);
  return resolved?.routeSlug ?? null;
};

export const resolveCanonicalAnilistRoute = async (entryRouteId: string) => {
  const resolved = await requireResolvedAniListTvShow(entryRouteId);
  if (!resolved) return null;

  return {
    slug: resolved.routeSlug,
    season: resolved.franchise.entrySeasonNumber,
  };
};
