import "server-only";

import {
  getCachedAnilistTvMedia,
  type AniListTvMedia,
  type ResolvedAniListTvShow,
} from "@/lib/anilist-tv-detail";
import {
  resolveAnilistHeroBackdropFallbacks,
  shouldResolveAnilistHeroBackdropFallbacks,
} from "@/lib/anilist-hero-backdrop";
import { resolveAnilistTvTmdbRoute } from "@/lib/anilist-tmdb-route";
import {
  getAnilistTitlesForTmdbMatch,
  pickBestTmdbTvCandidate,
  type TmdbTvMatchCandidate,
} from "@/lib/anilist-tmdb-match";
import {
  fetchAllSeasonDetails,
  fetchSeasonDetailsServer,
  fetchTVShowDetails,
} from "@/lib/server/tvshow-api";
import type {
  Episode,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";
import { tmdb } from "@/tmdb/api";
import type { TvShowWithMediaType } from "@/tmdb/models";
import { unstable_cache } from "next/cache";
import { cache } from "react";

const ENRICH_REVALIDATE_SECONDS = 60 * 60 * 24;

/**
 * OVAs/specials usually map to their parent show's TMDB record (e.g. Attack
 * on Titan: No Regrets → the main Attack on Titan show). Position-matching
 * seasons against that record would graft the parent's episode roster onto
 * the standalone entry, so only series formats merge season/episode data.
 */
const NON_SERIES_ANILIST_FORMATS = new Set([
  "OVA",
  "SPECIAL",
  "MOVIE",
  "MUSIC",
]);

const shouldMergeTmdbSeasonData = (resolved: ResolvedAniListTvShow): boolean =>
  !NON_SERIES_ANILIST_FORMATS.has(resolved.entry.format ?? "");

const toMatchCandidate = (
  candidate: TvShowWithMediaType,
): TmdbTvMatchCandidate => ({
  id: candidate.id,
  media_type: "tv",
  name: candidate.name,
  original_name: candidate.original_name,
  first_air_date: candidate.first_air_date ?? "",
  genre_ids: candidate.genre_ids ?? [],
  popularity: candidate.popularity,
  vote_average: candidate.vote_average,
});

const findScoredTmdbTvId = async (
  media: AniListTvMedia,
): Promise<number | null> => {
  const titles = getAnilistTitlesForTmdbMatch(media);
  const responses = await Promise.all(
    titles.map((query) => tmdb.search.multi({ query, adult: true })),
  );
  const candidates = responses.flatMap((response) =>
    (response.results ?? []).filter(
      (result): result is TvShowWithMediaType => result.media_type === "tv",
    ),
  );
  const best = pickBestTmdbTvCandidate(media, candidates.map(toMatchCandidate));
  return best?.id ?? null;
};

const resolveAnilistTmdbTvIdUncached = async (
  anilistId: number,
): Promise<number | null> => {
  const routeMapping = await resolveAnilistTvTmdbRoute(anilistId);
  if (routeMapping?.type === "tv") {
    return routeMapping.id;
  }

  const media = await getCachedAnilistTvMedia(anilistId);
  if (!media || media.format === "MOVIE") {
    return null;
  }

  return findScoredTmdbTvId(media);
};

const getCachedAnilistTmdbTvId = unstable_cache(
  resolveAnilistTmdbTvIdUncached,
  ["anilist-tv-tmdb-enrich-id"],
  { revalidate: ENRICH_REVALIDATE_SECONDS },
);

export const resolveAnilistTmdbTvIdForEnrichment = getCachedAnilistTmdbTvId;

const hasUsableText = (value: string | null | undefined) =>
  Boolean(value?.trim());

const mergeEpisode = (
  anilistEpisode: Episode,
  tmdbEpisode: Episode,
): Episode => ({
  ...anilistEpisode,
  name:
    anilistEpisode.name.startsWith("Episode ") &&
    hasUsableText(tmdbEpisode.name)
      ? tmdbEpisode.name
      : anilistEpisode.name,
  overview: hasUsableText(anilistEpisode.overview)
    ? anilistEpisode.overview
    : tmdbEpisode.overview,
  still_path: tmdbEpisode.still_path ?? anilistEpisode.still_path,
  runtime: anilistEpisode.runtime ?? tmdbEpisode.runtime,
  air_date: hasUsableText(anilistEpisode.air_date)
    ? anilistEpisode.air_date
    : tmdbEpisode.air_date,
  vote_average:
    (tmdbEpisode.vote_average ?? 0) > 0
      ? tmdbEpisode.vote_average
      : anilistEpisode.vote_average,
  vote_count:
    (tmdbEpisode.vote_count ?? 0) > 0
      ? tmdbEpisode.vote_count
      : anilistEpisode.vote_count,
});

export const mergeTmdbEpisodesIntoSeason = (
  season: SeasonDetails,
  tmdbEpisodes: Episode[] | undefined,
  options?: { preserveSplitCourAppendix?: boolean },
): SeasonDetails => {
  if (!tmdbEpisodes?.length) return season;

  const anilistByNumber = new Map(
    season.episodes.map((episode) => [episode.episode_number, episode]),
  );

  const episodes = [...tmdbEpisodes]
    .sort((left, right) => left.episode_number - right.episode_number)
    .map((tmdbEpisode) => {
      const anilistEpisode = anilistByNumber.get(tmdbEpisode.episode_number);
      return anilistEpisode
        ? mergeEpisode(anilistEpisode, tmdbEpisode)
        : tmdbEpisode;
    });

  if (!options?.preserveSplitCourAppendix) {
    return {
      ...season,
      overview: hasUsableText(season.overview)
        ? season.overview
        : (tmdbEpisodes.find((episode) => hasUsableText(episode.overview))
            ?.overview ?? season.overview),
      episodes,
    };
  }

  const maxTmdbEpisodeNumber = episodes.reduce(
    (max, episode) => Math.max(max, episode.episode_number),
    0,
  );
  const trailingAnilistEpisodes = season.episodes
    .filter((episode) => episode.episode_number > maxTmdbEpisodeNumber)
    .sort((left, right) => left.episode_number - right.episode_number);

  return {
    ...season,
    overview: hasUsableText(season.overview)
      ? season.overview
      : (tmdbEpisodes.find((episode) => hasUsableText(episode.overview))
          ?.overview ?? season.overview),
    episodes: [...episodes, ...trailingAnilistEpisodes],
  };
};

export const mergeTmdbIntoAnilistTvDetails = (
  anilistDetails: TvShowDetails,
  tmdbDetails: TvShowDetails,
): TvShowDetails => {
  const tmdbBackdrop = tmdbDetails.backdrop_path ?? null;
  const anilistBackdrop = anilistDetails.backdrop_path ?? null;
  // AniList "banners" are often portrait character art; TMDB backdrops are
  // better suited for the 16:9 hero when we have a mapped TMDB record.
  const preferTmdbBackdrop = Boolean(tmdbBackdrop);

  return {
    ...anilistDetails,
    backdrop_path: preferTmdbBackdrop ? tmdbBackdrop : anilistBackdrop,
    poster_path: anilistDetails.poster_path ?? tmdbDetails.poster_path ?? null,
    overview: hasUsableText(anilistDetails.overview)
      ? anilistDetails.overview
      : tmdbDetails.overview,
    vote_average:
      tmdbDetails.vote_average > 0
        ? tmdbDetails.vote_average
        : anilistDetails.vote_average,
    vote_count:
      tmdbDetails.vote_count > 0
        ? tmdbDetails.vote_count
        : anilistDetails.vote_count,
    popularity:
      tmdbDetails.popularity > 0
        ? tmdbDetails.popularity
        : anilistDetails.popularity,
    number_of_episodes:
      tmdbDetails.number_of_episodes > 0
        ? tmdbDetails.number_of_episodes
        : anilistDetails.number_of_episodes,
    number_of_seasons:
      tmdbDetails.number_of_seasons > 0
        ? tmdbDetails.number_of_seasons
        : anilistDetails.number_of_seasons,
    episode_run_time: anilistDetails.episode_run_time?.length
      ? anilistDetails.episode_run_time
      : tmdbDetails.episode_run_time,
    content_ratings: tmdbDetails.content_ratings?.results?.length
      ? tmdbDetails.content_ratings
      : anilistDetails.content_ratings,
    content_rating: tmdbDetails.content_rating ?? anilistDetails.content_rating,
    logo: anilistDetails.logo ?? tmdbDetails.logo,
    external_ids: tmdbDetails.external_ids ?? anilistDetails.external_ids,
    imdb_id:
      tmdbDetails.external_ids?.imdb_id ??
      (tmdbDetails as { imdb_id?: string | null }).imdb_id ??
      (anilistDetails as { imdb_id?: string | null }).imdb_id,
    videos: anilistDetails.videos?.results?.length
      ? anilistDetails.videos
      : tmdbDetails.videos,
    recommendations: anilistDetails.recommendations?.results?.length
      ? anilistDetails.recommendations
      : tmdbDetails.recommendations,
    similar: anilistDetails.similar?.results?.length
      ? anilistDetails.similar
      : tmdbDetails.similar,
    seasons: anilistDetails.seasons?.map((season) => {
      const tmdbSeason = tmdbDetails.seasons?.find(
        (candidate) => candidate.season_number === season.season_number,
      );
      if (!tmdbSeason) return season;

      return {
        ...season,
        overview: hasUsableText(season.overview)
          ? season.overview
          : (tmdbSeason.overview ?? season.overview),
        poster_path: season.poster_path ?? tmdbSeason.poster_path ?? null,
        air_date: season.air_date ?? tmdbSeason.air_date ?? null,
        episode_count:
          tmdbSeason.episode_count > 0
            ? tmdbSeason.episode_count
            : season.episode_count,
      };
    }),
  };
};

export const enrichAnilistTvDetailsWithTmdb = async (
  details: TvShowDetails,
  resolved: ResolvedAniListTvShow,
): Promise<TvShowDetails> => {
  const tmdbId = await resolveAnilistTmdbTvIdForEnrichment(resolved.entry.id);
  let merged: TvShowDetails = { ...details, mappedTmdbTvId: null };

  if (tmdbId) {
    try {
      const tmdbDetails = await fetchTVShowDetails(String(tmdbId));
      const mergeSource = shouldMergeTmdbSeasonData(resolved)
        ? tmdbDetails
        : {
            ...tmdbDetails,
            seasons: [],
            number_of_episodes: 0,
            number_of_seasons: 0,
          };
      merged = {
        ...mergeTmdbIntoAnilistTvDetails(details, mergeSource),
        mappedTmdbTvId: tmdbId,
      };
    } catch {
      merged = { ...details, mappedTmdbTvId: tmdbId };
    }
  }

  if (shouldResolveAnilistHeroBackdropFallbacks(merged.backdrop_path)) {
    const fallbackBackdrop = await resolveAnilistHeroBackdropFallbacks(
      resolved,
      merged,
    );
    if (fallbackBackdrop) {
      merged = { ...merged, backdrop_path: fallbackBackdrop };
    }
  }

  return merged;
};

export type TmdbSeasonEnrichmentContext = {
  tmdbId: number;
  tmdbSeasons: Record<number, SeasonDetails>;
};

const resolveTmdbSeasonEnrichmentContext = async (
  resolved: ResolvedAniListTvShow,
): Promise<TmdbSeasonEnrichmentContext | null> => {
  if (!shouldMergeTmdbSeasonData(resolved)) {
    return null;
  }

  const tmdbId = await resolveAnilistTmdbTvIdForEnrichment(resolved.entry.id);
  if (!tmdbId) {
    return null;
  }

  try {
    const tmdbDetails = await fetchTVShowDetails(String(tmdbId));
    const tmdbSeasons = await fetchAllSeasonDetails(
      String(tmdbId),
      tmdbDetails.seasons,
      { source: "tmdb" },
    );
    return { tmdbId, tmdbSeasons };
  } catch {
    return null;
  }
};

export const getTmdbSeasonEnrichmentContext = cache(
  resolveTmdbSeasonEnrichmentContext,
);

export const enrichAnilistSeasonDetailsWithTmdb = async (
  _routeId: string,
  season: SeasonDetails,
  resolved: ResolvedAniListTvShow,
  options?: {
    preserveSplitCourAppendix?: boolean;
    tmdbContext?: TmdbSeasonEnrichmentContext | null;
  },
): Promise<SeasonDetails> => {
  if (!shouldMergeTmdbSeasonData(resolved)) return season;

  let tmdbEpisodes: Episode[] | undefined;
  if (options?.tmdbContext) {
    tmdbEpisodes =
      options.tmdbContext.tmdbSeasons[season.season_number]?.episodes;
  } else {
    const tmdbId = await resolveAnilistTmdbTvIdForEnrichment(resolved.entry.id);
    if (!tmdbId) return season;

    try {
      const tmdbSeason = await fetchSeasonDetailsServer(
        String(tmdbId),
        season.season_number,
        { source: "tmdb" },
      );
      tmdbEpisodes = tmdbSeason?.episodes;
    } catch {
      return season;
    }
  }

  return mergeTmdbEpisodesIntoSeason(season, tmdbEpisodes, {
    preserveSplitCourAppendix: options?.preserveSplitCourAppendix,
  });
};
