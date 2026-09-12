import "server-only";

import {
  buildFranchiseFromSeasonIds,
  resolveAniListFranchise,
  type AniListFranchise,
} from "@/lib/anilist-franchise";
import {
  collectFribbTmdbFranchiseSeasonIds,
  resolveFribbTmdbFranchiseSeasonIds,
} from "@/lib/anilist-franchise-fallback";
import { groupFranchiseSeasonsByTmdb } from "@/lib/anilist-franchise-display";
import { toAnilistTvRouteSlug } from "@/lib/anilist-route-id";
import {
  collectAniBridgeAnilistIdsForTmdbShow,
  getAniBridgeMappings,
} from "@/lib/anime/anibridge-mappings";
import {
  resolveAnilistToTmdbShow,
  resolveAnilistToTmdbShowId,
} from "@/lib/anime/cross-id-resolver";
import type {
  Episode,
  SeasonDetails,
  TvShowDetails,
} from "@/lib/domain/typings";
import {
  CACHE_REVALIDATE_SECONDS,
  CACHE_SEASON_REVALIDATE_SECONDS,
} from "@/lib/http-cache";
import { tvDetailAppend } from "@/lib/performance/tmdb-append-sets";
import { tmdbFetchInit } from "@/lib/tmdb-cache-policy";
import {
  getFribbAnimeList,
  getFribbMapping,
  type FribbAnimeRow,
} from "@/lib/fribb-mapping";
import type {
  AniListTvMedia,
  ResolvedAniListTvShow,
} from "@/lib/anilist-tv-detail";
import { buildAniListTvMediaStubFromTmdb } from "@/lib/anilist-tv-stub";

type RawEpisode = {
  air_date?: unknown;
  episode_number?: unknown;
  id?: unknown;
  name?: unknown;
  overview?: unknown;
  runtime?: unknown;
  still_path?: unknown;
  vote_average?: unknown;
  vote_count?: unknown;
};

type RawSeasonDetails = {
  episodes?: unknown;
  id?: unknown;
  name?: unknown;
  overview?: unknown;
  season_number?: unknown;
};

const readString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const readNullableString = (value: unknown) =>
  typeof value === "string" ? value : null;

const readNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const readNullableNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const toSlimEpisode = (
  episode: RawEpisode,
  index: number,
  seasonNumber: number,
): Episode => {
  const episodeNumber = readNumber(episode.episode_number, index + 1);
  return {
    id: readNumber(episode.id, seasonNumber * 1000 + episodeNumber),
    name: readString(episode.name),
    overview: readString(episode.overview),
    episode_number: episodeNumber,
    air_date: readString(episode.air_date),
    still_path: readNullableString(episode.still_path),
    runtime: readNullableNumber(episode.runtime),
    vote_average: readNumber(episode.vote_average),
    vote_count: readNumber(episode.vote_count),
  };
};

const toSlimSeasonDetails = (raw: RawSeasonDetails): SeasonDetails | null => {
  const seasonNumber = readNumber(raw.season_number, Number.NaN);
  if (!Number.isFinite(seasonNumber)) {
    return null;
  }

  const episodes = Array.isArray(raw.episodes)
    ? raw.episodes
        .filter(
          (episode): episode is RawEpisode =>
            typeof episode === "object" && episode !== null,
        )
        .map((episode, index) => toSlimEpisode(episode, index, seasonNumber))
    : [];

  return {
    id: readNumber(raw.id),
    name: readString(raw.name, `Season ${seasonNumber}`),
    overview: readString(raw.overview),
    season_number: seasonNumber,
    episodes,
  };
};

export const fetchTmdbTvShowShell = async (
  tmdbId: number,
): Promise<TvShowDetails | null> => {
  const append = tvDetailAppend("shell");
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY ?? "");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("append_to_response", append);

  const response = await fetch(
    url,
    tmdbFetchInit({
      endpoint: `/tv/${tmdbId}`,
      params: { append_to_response: append },
      revalidate: CACHE_REVALIDATE_SECONDS,
    }),
  ).catch(() => null);

  if (!response?.ok) return null;
  const data = (await response.json()) as TvShowDetails;
  return { ...data, content_rating: null, logo: null };
};

export const fetchTmdbSeasonShell = async (
  tmdbId: number,
  seasonNumber: number,
): Promise<SeasonDetails | null> => {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?api_key=${process.env.TMDB_API_KEY}&language=en-US`,
    tmdbFetchInit({
      endpoint: `/tv/${tmdbId}/season/${seasonNumber}`,
      revalidate: CACHE_SEASON_REVALIDATE_SECONDS,
    }),
  ).catch(() => null);

  if (!response?.ok) return null;
  return toSlimSeasonDetails((await response.json()) as RawSeasonDetails);
};

export const resolveTmdbShowIdForAnilist = async (
  anilistId: number,
): Promise<number | null> => resolveAnilistToTmdbShowId(anilistId);

const resolveTmdbShowIdForFranchise = async (
  franchise: AniListFranchise,
): Promise<number | null> => {
  const mapping = await getFribbMapping();
  return (
    mapping[franchise.entryAnilistId]?.tv ??
    mapping[franchise.rootAnilistId]?.tv ??
    (await resolveAnilistToTmdbShowId(franchise.entryAnilistId)) ??
    (await resolveAnilistToTmdbShowId(franchise.rootAnilistId))
  );
};

const fribbTmdbSeasonNumber = (row: FribbAnimeRow): number => {
  const season = row.season?.tmdb;
  if (season === undefined || season === null || season === 0) {
    return 1;
  }
  return season;
};

export const hydrateMissingAniListTvMedia = async (
  franchise: AniListFranchise,
  seasonsByAnilistId: Map<number, AniListTvMedia>,
): Promise<void> => {
  const missingIds = franchise.seasons
    .map((season) => season.anilistId)
    .filter((anilistId) => !seasonsByAnilistId.has(anilistId));
  if (missingIds.length === 0) return;

  const [tmdbShowId, fribbRows] = await Promise.all([
    resolveTmdbShowIdForFranchise(franchise),
    getFribbAnimeList(),
  ]);
  if (!tmdbShowId) return;

  const tmdbShow = await fetchTmdbTvShowShell(tmdbShowId);
  if (!tmdbShow) return;

  for (const anilistId of missingIds) {
    const fribbRow = fribbRows.find((row) => row.anilist_id === anilistId);
    const mapped = fribbRow ? null : await resolveAnilistToTmdbShow(anilistId);
    seasonsByAnilistId.set(
      anilistId,
      buildAniListTvMediaStubFromTmdb(
        anilistId,
        tmdbShow,
        fribbRow ??
          (mapped?.tmdbShowId === tmdbShowId && mapped.seasonNumber
            ? {
                anilist_id: anilistId,
                themoviedb_id: { tv: tmdbShowId },
                season: { tmdb: mapped.seasonNumber },
              }
            : undefined),
      ),
    );
  }
};

export const buildResolvedAniListTvShowFromTmdb = async (
  entryAnilistId: number,
  franchise: AniListFranchise,
): Promise<ResolvedAniListTvShow | null> => {
  const seasonsByAnilistId = new Map<number, AniListTvMedia>();
  await hydrateMissingAniListTvMedia(franchise, seasonsByAnilistId);

  const entry = seasonsByAnilistId.get(franchise.entryAnilistId);
  if (!entry) return null;

  const root = seasonsByAnilistId.get(franchise.rootAnilistId) ?? entry;

  return {
    routeSlug: toAnilistTvRouteSlug(franchise.rootAnilistId),
    franchise,
    seasonsByAnilistId,
    root,
    entry,
  };
};

export const resolveAniListFranchiseWithTmdbFallback = async (
  entryAnilistId: number,
): Promise<AniListFranchise> => {
  const franchise = await resolveAniListFranchise(entryAnilistId);
  if (franchise.seasons.length > 1) {
    return franchise;
  }

  const fribbSeasonIds = await collectFribbTmdbFranchiseSeasonIds(
    await getFribbAnimeList(),
    entryAnilistId,
  );
  if (fribbSeasonIds && fribbSeasonIds.length > 1) {
    return buildFranchiseFromSeasonIds(entryAnilistId, fribbSeasonIds);
  }

  return franchise;
};

export const buildResolvedAniListTvShowWithFallback = async (
  entryAnilistId: number,
): Promise<ResolvedAniListTvShow | null> => {
  const franchise =
    await resolveAniListFranchiseWithTmdbFallback(entryAnilistId);
  return buildResolvedAniListTvShowFromTmdb(entryAnilistId, franchise);
};

/**
 * Franchise + TMDB stubs from bundled Fribb/AniBridge — no live AniList GraphQL.
 * Returns null when the entry has no TMDB TV mapping in either graph.
 */
export const resolveFribbBackedFranchise = async (
  entryAnilistId: number,
): Promise<AniListFranchise | null> => {
  const mapping = await getFribbMapping();
  const entry = mapping[entryAnilistId];
  if (entry?.tv) {
    const seasonIds = await resolveFribbTmdbFranchiseSeasonIds(entryAnilistId);
    const ids = seasonIds ?? [entryAnilistId];
    return buildFranchiseFromSeasonIds(entryAnilistId, ids);
  }

  try {
    const mapped = await resolveAnilistToTmdbShow(entryAnilistId);
    if (!mapped?.tmdbShowId) {
      return null;
    }

    const anibridgeIds = collectAniBridgeAnilistIdsForTmdbShow(
      await getAniBridgeMappings(),
      mapped.tmdbShowId,
    );
    const ids = anibridgeIds.includes(entryAnilistId)
      ? anibridgeIds
      : [entryAnilistId];
    return buildFranchiseFromSeasonIds(entryAnilistId, ids);
  } catch {
    return null;
  }
};

export const buildResolvedAniListTvShowFromFribb = async (
  entryAnilistId: number,
): Promise<ResolvedAniListTvShow | null> => {
  const franchise = await resolveFribbBackedFranchise(entryAnilistId);
  if (!franchise) {
    return null;
  }

  return buildResolvedAniListTvShowFromTmdb(entryAnilistId, franchise);
};

const resolveTmdbSeasonNumberForDisplaySeason = async (
  anilistId: number,
  displaySeasonNumber: number,
): Promise<number | null> => {
  const mapping = await getFribbMapping();
  const tmdbShowId = mapping[anilistId]?.tv ?? null;
  if (!tmdbShowId) return null;

  const fribbRows = await getFribbAnimeList();
  const franchiseSeasonIds = collectFribbTmdbFranchiseSeasonIds(
    fribbRows,
    anilistId,
  );
  if (!franchiseSeasonIds || franchiseSeasonIds.length === 0) {
    return displaySeasonNumber;
  }

  const franchise = buildFranchiseFromSeasonIds(anilistId, franchiseSeasonIds);
  const grouped =
    groupFranchiseSeasonsByTmdb(
      franchise.seasons,
      mapping,
      tmdbShowId,
      fribbRows,
    ) ??
    franchise.seasons.map((season) => ({
      seasonNumber: season.seasonNumber,
      anilistIds: [season.anilistId],
    }));

  const groupedSeason = grouped.find(
    (season) => season.seasonNumber === displaySeasonNumber,
  );
  if (!groupedSeason) return displaySeasonNumber;

  const primaryAnilistId = groupedSeason.anilistIds[0];
  const row = fribbRows.find((item) => item.anilist_id === primaryAnilistId);
  return row ? fribbTmdbSeasonNumber(row) : displaySeasonNumber;
};

export const fetchAnilistSeasonDetailsFromTmdb = async (
  anilistId: number,
  displaySeasonNumber: number,
): Promise<SeasonDetails | null> => {
  const mapped = await resolveAnilistToTmdbShow(anilistId);
  if (!mapped?.tmdbShowId) return null;
  const tmdbShowId = mapped.tmdbShowId;

  const fromFribb = await resolveTmdbSeasonNumberForDisplaySeason(
    anilistId,
    displaySeasonNumber,
  );
  const tmdbSeasonNumber =
    fromFribb ??
    (displaySeasonNumber === 1 && mapped.seasonNumber && mapped.seasonNumber > 0
      ? mapped.seasonNumber
      : displaySeasonNumber);
  if (!tmdbSeasonNumber) return null;

  return fetchTmdbSeasonShell(tmdbShowId, tmdbSeasonNumber);
};
