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
  isBareAnilistRouteId,
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
import {
  buildMergedEpisodesForTmdbSeason,
  collapseSeasonSummariesForTmdb,
  groupFranchiseSeasonsByTmdb,
  type SeasonEpisodeSource,
  type TmdbGroupedFranchiseSeason,
} from "@/lib/anilist-franchise-display";
import {
  enrichAnilistSeasonDetailsWithTmdb,
  enrichAnilistTvDetailsWithTmdb,
  resolveAnilistTmdbTvIdForEnrichment,
} from "@/lib/anilist-tv-tmdb-enrich";
import {
  getFribbAnimeList,
  getFribbMapping,
  type FribbAnimeRow,
} from "@/lib/fribb-mapping";
import { hasFribbSplitCourForTmdbSeason } from "@/lib/anime/split-cour-appendix";
import { fetchSeasonDetailsServer } from "@/lib/server/tvshow-api";
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
      airingSchedule(perPage: 50) {
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

export const collectEpisodeNumbers = (media: AniListTvMedia): number[] => {
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

  if (numbers.size === 0 && media.format === "MOVIE") {
    numbers.add(1);
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
    name:
      episodeNumbers.length === 1 && media.format === "SPECIAL"
        ? getAniListTitle(asAniListMedia(media))
        : `Episode ${episodeNumber}`,
    overview: "",
    episode_number: episodeNumber,
    air_date: airingDates.get(episodeNumber) ?? defaultAirDate,
    still_path: poster,
    runtime,
    vote_average: 0,
    vote_count: 0,
    sourceAnilistId: media.id,
    sourceEpisodeNumber: episodeNumber,
  }));
};

const buildEpisodesForSeasonSource = (media: SeasonEpisodeSource): Episode[] =>
  buildEpisodes(media as AniListTvMedia);

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
      href: null,
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
  details: TvShowDetails,
): MediaAboveFoldDetail => ({
  ...details,
  media_type: "tv",
  title: details.name,
  content_rating: details.adult ? "TV-MA" : null,
  videos: extractVideoRowsFromMediaVideos(details.videos),
});

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

const resolveSpecialSequelAppendixIds = async (
  tailMedia: AniListTvMedia,
): Promise<number[]> => {
  const appendix: number[] = [];
  let current: AniListTvMedia | null = tailMedia;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    const sequelNode = current.relations?.edges?.find(
      (edge) =>
        edge.relationType === "SEQUEL" &&
        edge.node?.type === "ANIME" &&
        edge.node.format === "SPECIAL" &&
        typeof edge.node.id === "number" &&
        edge.node.id > 0,
    )?.node;
    if (!sequelNode?.id) break;

    appendix.push(sequelNode.id);
    current = await getCachedAnilistTvMedia(sequelNode.id);
  }

  return appendix;
};

const appendSpecialSequelIdsToGroupedSeasons = async (
  groupedSeasons: readonly TmdbGroupedFranchiseSeason[],
  seasonsByAnilistId: Map<number, AniListTvMedia>,
): Promise<TmdbGroupedFranchiseSeason[]> => {
  const expanded: TmdbGroupedFranchiseSeason[] = [];

  for (const groupedSeason of groupedSeasons) {
    const anilistIds = [...groupedSeason.anilistIds];
    const tailId = anilistIds[anilistIds.length - 1];
    const tailMedia = tailId ? seasonsByAnilistId.get(tailId) : undefined;
    if (tailMedia) {
      const sequelIds = await resolveSpecialSequelAppendixIds(tailMedia);
      for (const sequelId of sequelIds) {
        if (!anilistIds.includes(sequelId)) {
          anilistIds.push(sequelId);
        }
      }
    }
    expanded.push({ ...groupedSeason, anilistIds });
  }

  return expanded;
};

const hydrateSplitCourAppendixMedia = async (
  groupedSeasons: readonly TmdbGroupedFranchiseSeason[],
  seasonsByAnilistId: Map<number, AniListTvMedia>,
): Promise<void> => {
  const missingIds = [
    ...new Set(
      groupedSeasons.flatMap((season) =>
        season.anilistIds.filter(
          (anilistId) => !seasonsByAnilistId.has(anilistId),
        ),
      ),
    ),
  ];

  if (missingIds.length === 0) return;

  const loaded = await Promise.all(
    missingIds.map(async (anilistId) => {
      const media = await getCachedAnilistTvMedia(anilistId);
      return [anilistId, media] as const;
    }),
  );

  for (const [anilistId, media] of loaded) {
    if (media) {
      seasonsByAnilistId.set(anilistId, media);
    }
  }
};

const shouldMergeEpisodesForGroupedSeason = (
  groupedSeason: TmdbGroupedFranchiseSeason,
  tmdbShowId: number | null,
  fribbRows: readonly FribbAnimeRow[],
): boolean => {
  if (!tmdbShowId || groupedSeason.anilistIds.length === 0) {
    return false;
  }

  return (
    groupedSeason.anilistIds.length > 1 ||
    hasFribbSplitCourForTmdbSeason(
      fribbRows,
      tmdbShowId,
      groupedSeason.seasonNumber,
    )
  );
};

const buildSeasonForSeasonSource = (
  media: SeasonEpisodeSource,
  seasonNumber: number,
): Season => buildSeason(media as AniListTvMedia, seasonNumber);

const buildMergedEpisodeCountBySeason = (
  groupedSeasons: readonly TmdbGroupedFranchiseSeason[],
  resolved: ResolvedAniListTvShow,
  tmdbShowId: number | null,
  fribbRows: readonly FribbAnimeRow[],
): Map<number, number> => {
  const counts = new Map<number, number>();

  for (const groupedSeason of groupedSeasons) {
    if (
      !shouldMergeEpisodesForGroupedSeason(groupedSeason, tmdbShowId, fribbRows)
    ) {
      continue;
    }

    const episodes = buildMergedEpisodesForTmdbSeason({
      tmdbShowId: tmdbShowId!,
      seasonNumber: groupedSeason.seasonNumber,
      anilistIds: groupedSeason.anilistIds,
      seasonsByAnilistId: resolved.seasonsByAnilistId,
      fribbRows,
      buildEpisodes: buildEpisodesForSeasonSource,
    });
    counts.set(groupedSeason.seasonNumber, episodes.length);
  }

  return counts;
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

  const fribbMapping = await getFribbMapping();
  const fribbRows = await getFribbAnimeList();
  const entryFribb = fribbMapping[entryAnilistId];
  const tmdbShowId = entryFribb?.tv ?? null;
  if (tmdbShowId) {
    const grouped =
      groupFranchiseSeasonsByTmdb(
        franchise.seasons,
        fribbMapping,
        tmdbShowId,
        fribbRows,
      ) ??
      franchise.seasons.map((season) => ({
        seasonNumber: season.seasonNumber,
        anilistIds: [season.anilistId],
      }));
    const expandedGroups = await appendSpecialSequelIdsToGroupedSeasons(
      grouped,
      seasonsByAnilistId,
    );
    await hydrateSplitCourAppendixMedia(expandedGroups, seasonsByAnilistId);
  }

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

type AnilistRouteResolveOptions = {
  acceptBareNumeric?: boolean;
};

const resolveAnilistIdFromRoute = (
  routeId: string,
  options?: AnilistRouteResolveOptions,
): number | null => {
  if (isAnilistTvRouteId(routeId)) {
    return fromAnilistTvRouteId(routeId);
  }

  if (options?.acceptBareNumeric && isBareAnilistRouteId(routeId)) {
    return fromAnilistTvRouteId(routeId);
  }

  return null;
};

const requireResolvedAniListTvShow = async (
  routeId: string,
  options?: AnilistRouteResolveOptions,
) => {
  const anilistId = resolveAnilistIdFromRoute(routeId, {
    acceptBareNumeric: options?.acceptBareNumeric ?? true,
  });
  if (!anilistId) return null;
  return getCachedResolvedAniListTvShow(anilistId);
};

const resolveDisplaySeasonGroups = async (
  resolved: ResolvedAniListTvShow,
  tmdbShowId: number | null,
): Promise<readonly TmdbGroupedFranchiseSeason[]> => {
  const fallback = resolved.franchise.seasons.map((season) => ({
    seasonNumber: season.seasonNumber,
    anilistIds: [season.anilistId],
  }));

  if (!tmdbShowId) return fallback;

  const fribbMapping = await getFribbMapping();
  const fribbRows = await getFribbAnimeList();
  const grouped = groupFranchiseSeasonsByTmdb(
    resolved.franchise.seasons,
    fribbMapping,
    tmdbShowId,
    fribbRows,
  );

  const baseGroups = grouped ?? fallback;
  return appendSpecialSequelIdsToGroupedSeasons(
    baseGroups,
    resolved.seasonsByAnilistId,
  );
};

const collapseSplitCourAnilistSeasons = async (
  details: TvShowDetails,
  resolved: ResolvedAniListTvShow,
): Promise<TvShowDetails> => {
  const tmdbShowId = details.mappedTmdbTvId ?? null;
  if (!tmdbShowId) return details;

  const grouped = await resolveDisplaySeasonGroups(resolved, tmdbShowId);
  if (grouped.length >= resolved.franchise.seasons.length) {
    return details;
  }

  const fribbRows = await getFribbAnimeList();
  const mergedEpisodeCountBySeason = buildMergedEpisodeCountBySeason(
    grouped,
    resolved,
    tmdbShowId,
    fribbRows,
  );

  const seasons = collapseSeasonSummariesForTmdb({
    franchiseSeasons: resolved.franchise.seasons,
    groupedSeasons: grouped,
    seasonsByAnilistId: resolved.seasonsByAnilistId,
    buildSeason: buildSeasonForSeasonSource,
    tmdbSeasons: details.seasons,
    mergedEpisodeCountBySeason,
  });

  return {
    ...details,
    seasons,
    number_of_seasons: seasons.length,
    number_of_episodes: seasons.reduce(
      (sum, season) => sum + season.episode_count,
      0,
    ),
  };
};

const buildEnrichedAnilistTvShowDetails = async (
  resolved: ResolvedAniListTvShow,
) => {
  const base = mapResolvedShowToDetails(resolved);
  const enriched = await enrichAnilistTvDetailsWithTmdb(base, resolved);
  return collapseSplitCourAnilistSeasons(enriched, resolved);
};

export const getCachedAnilistTvAboveFoldDetail = async (
  routeId: string,
  options?: AnilistRouteResolveOptions,
) => {
  const resolved = await requireResolvedAniListTvShow(routeId, options);
  if (!resolved) return null;
  const details = await buildEnrichedAnilistTvShowDetails(resolved);
  return mapToAboveFoldDetail(details);
};

export const getCachedAnilistTvShowDetail = async (
  routeId: string,
  options?: AnilistRouteResolveOptions,
) => {
  const resolved = await requireResolvedAniListTvShow(routeId, options);
  return resolved ? await buildEnrichedAnilistTvShowDetails(resolved) : null;
};

const fetchMappedTmdbSeasonDetails = async (
  tmdbShowId: number,
  seasonNumber: number,
): Promise<SeasonDetails | null> =>
  fetchSeasonDetailsServer(String(tmdbShowId), seasonNumber, {
    source: "tmdb",
  });

export const getCachedAnilistTvSeasonDetails = async (
  routeId: string,
  seasonNumber: number,
  options?: AnilistRouteResolveOptions,
) => {
  const resolved = await requireResolvedAniListTvShow(routeId, options);
  if (!resolved) return null;

  const tmdbShowId = await resolveAnilistTmdbTvIdForEnrichment(
    resolved.entry.id,
  );
  const groupedSeasons = await resolveDisplaySeasonGroups(resolved, tmdbShowId);
  const groupedSeason = groupedSeasons.find(
    (season) => season.seasonNumber === seasonNumber,
  );
  if (!groupedSeason) {
    if (!tmdbShowId) return null;
    return fetchMappedTmdbSeasonDetails(tmdbShowId, seasonNumber);
  }

  const primaryAnilistId = groupedSeason.anilistIds[0];
  const media =
    (primaryAnilistId
      ? resolved.seasonsByAnilistId.get(primaryAnilistId)
      : undefined) ?? resolved.entry;
  const season = buildSeason(media, seasonNumber);
  const fribbRows = tmdbShowId ? await getFribbAnimeList() : [];
  const episodes = shouldMergeEpisodesForGroupedSeason(
    groupedSeason,
    tmdbShowId,
    fribbRows,
  )
    ? buildMergedEpisodesForTmdbSeason({
        tmdbShowId: tmdbShowId!,
        seasonNumber,
        anilistIds: groupedSeason.anilistIds,
        seasonsByAnilistId: resolved.seasonsByAnilistId,
        fribbRows,
        buildEpisodes: buildEpisodesForSeasonSource,
      })
    : buildEpisodes(media);

  const enrichedSeason = await enrichAnilistSeasonDetailsWithTmdb(
    routeId,
    {
      id: season.id,
      name: season.name,
      overview: season.overview,
      season_number: season.season_number,
      episodes,
    },
    resolved,
    {
      preserveSplitCourAppendix: shouldMergeEpisodesForGroupedSeason(
        groupedSeason,
        tmdbShowId,
        fribbRows,
      ),
    },
  );

  return enrichedSeason;
};

export const getCachedAnilistTvAllSeasons = cache(
  async (
    routeId: string,
    options?: AnilistRouteResolveOptions,
  ): Promise<Record<number, SeasonDetails>> => {
    const resolved = await requireResolvedAniListTvShow(routeId, options);
    if (!resolved) return {};

    const tmdbShowId = await resolveAnilistTmdbTvIdForEnrichment(
      resolved.entry.id,
    );
    const groupedSeasons = await resolveDisplaySeasonGroups(
      resolved,
      tmdbShowId,
    );
    const fribbRows = tmdbShowId ? await getFribbAnimeList() : [];

    const allSeasons: Record<number, SeasonDetails> = {};

    for (const groupedSeason of groupedSeasons) {
      const primaryAnilistId = groupedSeason.anilistIds[0];
      const media =
        (primaryAnilistId
          ? resolved.seasonsByAnilistId.get(primaryAnilistId)
          : undefined) ?? resolved.entry;
      const season = buildSeason(media, groupedSeason.seasonNumber);
      const episodes = shouldMergeEpisodesForGroupedSeason(
        groupedSeason,
        tmdbShowId,
        fribbRows,
      )
        ? buildMergedEpisodesForTmdbSeason({
            tmdbShowId: tmdbShowId!,
            seasonNumber: groupedSeason.seasonNumber,
            anilistIds: groupedSeason.anilistIds,
            seasonsByAnilistId: resolved.seasonsByAnilistId,
            fribbRows,
            buildEpisodes: buildEpisodesForSeasonSource,
          })
        : buildEpisodes(media);
      const baseSeason: SeasonDetails = {
        id: season.id,
        name: season.name,
        overview: season.overview,
        season_number: season.season_number,
        episodes,
      };
      allSeasons[groupedSeason.seasonNumber] =
        await enrichAnilistSeasonDetailsWithTmdb(
          routeId,
          baseSeason,
          resolved,
          {
            preserveSplitCourAppendix: shouldMergeEpisodesForGroupedSeason(
              groupedSeason,
              tmdbShowId,
              fribbRows,
            ),
          },
        );
    }

    return allSeasons;
  },
);

export const getCachedAnilistTvCredits = async (
  routeId: string,
  options?: AnilistRouteResolveOptions,
): Promise<Credits> => {
  const resolved = await requireResolvedAniListTvShow(routeId, options);
  return {
    id: resolved?.franchise.rootAnilistId ?? fromAnilistTvRouteId(routeId),
    cast: resolved ? mapCharactersToCast(resolved.root) : [],
    crew: [],
  };
};

export const getCachedAnilistTvRecommendations = async (
  routeId: string,
  options?: AnilistRouteResolveOptions,
): Promise<ListResponse<TvShow>> => {
  const details = await getCachedAnilistTvShowDetail(routeId, options);
  const results = details?.recommendations?.results ?? [];

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

  const tmdbShowId = await resolveAnilistTmdbTvIdForEnrichment(
    resolved.entry.id,
  );
  const groupedSeasons = await resolveDisplaySeasonGroups(resolved, tmdbShowId);
  const groupedSeason = groupedSeasons.find(
    (season) => season.seasonNumber === seasonNumber,
  );

  return groupedSeason?.anilistIds[0] ?? null;
};

export const getCanonicalAnilistTvRouteSlug = async (
  entryRouteId: string,
): Promise<string | null> => {
  const resolved = await requireResolvedAniListTvShow(entryRouteId);
  return resolved?.routeSlug ?? null;
};

export const resolveCanonicalAnilistRoute = async (
  entryRouteId: string,
  options?: AnilistRouteResolveOptions,
) => {
  const resolved = await requireResolvedAniListTvShow(entryRouteId, options);
  if (!resolved) return null;

  return {
    slug: resolved.routeSlug,
    season: resolved.franchise.entrySeasonNumber,
  };
};
