import "server-only";

import type { EpisodeInfo } from "@/lib/domain/episodes";
import type { WatchlistItem } from "@/lib/domain/watchlist";
import { getCachedMovieDetail } from "@/lib/media-detail-cache";
import type {
  BecauseYouWatchedResult,
  BecauseYouWatchedSeed,
} from "@/lib/personalization/because-you-watched";
import {
  buildAnimeUpNextHref,
  buildUpNextHref,
  collectUpNextCandidates,
  selectWatchingShowsForEpisodeCheck,
  type UpNextCandidate,
} from "@/lib/personalization/up-next";
import {
  serializeEpisodeInfo,
  type PersonalizedHomeResponseWire,
  type PersonalizedUpNextItemWire,
} from "@/lib/personalization/personalized-home-types";
import {
  collectRecentlyWatchedStubs,
  RECENTLY_WATCHED_LIMIT,
  toRecentlyWatchedItem,
  type RecentlyWatchedItem,
  type RecentlyWatchedStub,
} from "@/lib/playback/recently-watched";
import { dismissalsFromWatchlist } from "@/lib/playback/continue-watching-dismiss";
import { listUserPlaybackProgress } from "@/lib/server/playback-progress";
import { enrichRecentlyWatchedStub } from "@/lib/playback/enrich-recently-watched";
import {
  makeEpisodeCheckCacheKey,
  resolveEpisodeCheckForShow,
} from "@/lib/server/episode-check-cache";
import { getCoalescingMemoryCache } from "@/lib/cache/coalescing-memory-cache";
import { runInChunks } from "@/lib/server/chunked-parallel";
import {
  createServerRecentlyWatchedEnrichmentFetchers,
  createTvDetailFetcher,
  type TvDetailFetcher,
} from "@/lib/server/enrich-recently-watched-server";
import { isAnime } from "@/utils/anilist-helpers";
import type { MediaItem } from "@/lib/domain/typings";
import type { MovieWithMediaType, TvShowWithMediaType } from "@/tmdb/models";
import { takeUniqueByIdInOrder } from "@/lib/catalog-page-dedupe";
import { tmdb } from "@/tmdb/api";
import {
  BECAUSE_YOU_WATCHED_LIMIT,
  BECAUSE_YOU_WATCHED_SEED_FETCH_CHUNK_SIZE,
  BECAUSE_YOU_WATCHED_SEED_LIMIT,
} from "@/lib/personalization/because-you-watched";

export type { PersonalizedHomeResponseWire as PersonalizedHomeResponse } from "@/lib/personalization/personalized-home-types";

const readMovieTitle = (
  detail: MediaItem | null | undefined,
  fallback?: string,
): string | undefined => {
  if (detail && "title" in detail && typeof detail.title === "string") {
    return detail.title;
  }
  return fallback;
};

const enrichUpNextCandidate = async (
  candidate: UpNextCandidate,
  fetchTv: TvDetailFetcher,
): Promise<PersonalizedUpNextItemWire | null> => {
  const fetched = await fetchTv(candidate.contentId);
  if (!fetched) {
    return null;
  }

  const detail = fetched.detail;
  const title = detail.name;
  if (!title) {
    return null;
  }

  const isAnimeItem = fetched.catalog === "anime" || isAnime(detail);
  const stub = {
    mediaType: "tv" as const,
    contentId: candidate.contentId,
    seasonNumber:
      candidate.episodeInfo.nextUnwatchedEpisode?.seasonNumber ??
      candidate.watchlistItem.lastWatchedSeason ??
      undefined,
    episodeNumber:
      candidate.episodeInfo.nextUnwatchedEpisode?.episodeNumber ??
      candidate.watchlistItem.lastWatchedEpisode ??
      undefined,
    progressRatio: null,
    updatedAt: candidate.watchlistItem.lastWatchedAt
      ? new Date(candidate.watchlistItem.lastWatchedAt).getTime()
      : new Date(candidate.watchlistItem.updatedAt).getTime(),
  };

  const item = toRecentlyWatchedItem(stub, {
    title,
    backdropPath: detail.backdrop_path,
    posterPath: detail.poster_path,
    voteAverage: detail.vote_average,
    year: detail.first_air_date?.substring(0, 4),
    isAnime: isAnimeItem,
  });

  const upNextHref = isAnimeItem
    ? buildAnimeUpNextHref(
        candidate.contentId,
        candidate.episodeInfo.nextUnwatchedEpisode,
        candidate.watchlistItem.lastWatchedSeason,
        candidate.watchlistItem.lastWatchedEpisode,
      )
    : buildUpNextHref(
        candidate.contentId,
        candidate.episodeInfo.nextUnwatchedEpisode,
        candidate.watchlistItem.lastWatchedSeason,
        candidate.watchlistItem.lastWatchedEpisode,
      );

  return {
    ...item,
    href: upNextHref,
    episodeInfo: serializeEpisodeInfo(candidate.episodeInfo),
    upNextHref,
  };
};

const tryBecauseYouWatchedStub = async (
  stub: RecentlyWatchedStub,
  excludeIds: ReadonlySet<number>,
  fetchTv: TvDetailFetcher,
): Promise<BecauseYouWatchedSeed | null> => {
  if (stub.mediaType === "movie") {
    const detail = await getCachedMovieDetail(String(stub.contentId), {
      append: "shell",
    });
    const seedTitle = readMovieTitle(detail, stub.title);
    if (!seedTitle) {
      return null;
    }

    const page = await tmdb.movie.recommendations({
      id: String(stub.contentId),
      page: "1",
    });
    const items = takeUniqueByIdInOrder(
      (page.results ?? []).map(
        (movie) =>
          ({
            ...movie,
            media_type: "movie",
          }) satisfies MovieWithMediaType,
      ),
      new Set(excludeIds),
      BECAUSE_YOU_WATCHED_LIMIT,
    );

    if (items.length === 0) {
      return null;
    }

    return {
      contentId: stub.contentId,
      seedTitle,
      mediaType: "movie",
      items,
    };
  }

  const fetched = await fetchTv(stub.contentId);
  const seedTitle = fetched?.detail.name ?? stub.title;
  if (!seedTitle) {
    return null;
  }

  const page = await tmdb.tv.recommendations({
    id: String(stub.contentId),
    page: "1",
  });
  const items = takeUniqueByIdInOrder(
    (page.results ?? []).map(
      (show) =>
        ({
          ...show,
          media_type: "tv",
        }) satisfies TvShowWithMediaType,
    ),
    new Set(excludeIds),
    BECAUSE_YOU_WATCHED_LIMIT,
  );

  if (items.length === 0) {
    return null;
  }

  return {
    contentId: stub.contentId,
    seedTitle,
    mediaType: "tv",
    items,
  };
};

const fetchBecauseYouWatchedRow = async (
  stubs: RecentlyWatchedStub[],
  excludeIds: ReadonlySet<number>,
  fetchTv: TvDetailFetcher,
): Promise<BecauseYouWatchedResult | null> => {
  const seedResults = await runInChunks(
    stubs.slice(0, BECAUSE_YOU_WATCHED_SEED_LIMIT),
    (stub) => tryBecauseYouWatchedStub(stub, excludeIds, fetchTv),
    BECAUSE_YOU_WATCHED_SEED_FETCH_CHUNK_SIZE,
  );

  const seeds = seedResults.filter(
    (seed): seed is BecauseYouWatchedSeed => seed !== null,
  );
  const primarySeed = seeds[0];
  if (!primarySeed) {
    return null;
  }

  return {
    ...primarySeed,
    seeds,
  };
};

const PERSONALIZED_HOME_CACHE_TTL_MS = 30_000;

const personalizedHomeCache = getCoalescingMemoryCache(
  "personalized-home-response",
  {
    ttlMs: PERSONALIZED_HOME_CACHE_TTL_MS,
    maxEntries: 100,
  },
);

const watchlistFingerprint = (watchlistItems: WatchlistItem[]): string =>
  watchlistItems
    .map(
      (item) =>
        `${item.id}:${item.status}:${item.lastWatchedSeason ?? ""}:${item.lastWatchedEpisode ?? ""}:${new Date(item.updatedAt).getTime()}`,
    )
    .join(",");

export const buildPersonalizedHomeResponse = async (
  watchlistItems: WatchlistItem[],
  userId?: string,
): Promise<PersonalizedHomeResponseWire> => {
  const fetchTv = createTvDetailFetcher();
  const enrichmentFetchers =
    createServerRecentlyWatchedEnrichmentFetchers(fetchTv);

  const playback = userId != null ? await listUserPlaybackProgress(userId) : [];

  const stubs = collectRecentlyWatchedStubs({
    playback,
    watchlist: watchlistItems,
    dismissals: dismissalsFromWatchlist(watchlistItems),
    limit: RECENTLY_WATCHED_LIMIT,
  });
  const tvWatching = selectWatchingShowsForEpisodeCheck(watchlistItems);

  const recentlyWatchedPromise = Promise.all(
    stubs.map((stub) => enrichRecentlyWatchedStub(stub, enrichmentFetchers)),
  );
  const becauseYouWatchedPromise =
    stubs.length > 0
      ? fetchBecauseYouWatchedRow(
          stubs,
          new Set(stubs.map((stub) => stub.contentId)),
          fetchTv,
        )
      : Promise.resolve(null);
  const episodeEntriesPromise = runInChunks(tvWatching, async (item) => {
    const cacheKey = makeEpisodeCheckCacheKey(
      "personalized",
      item.contentId,
      item.lastWatchedSeason,
      item.lastWatchedEpisode,
      item.status,
    );
    const episodeInfo = await resolveEpisodeCheckForShow(
      item.contentId,
      item.lastWatchedSeason,
      item.lastWatchedEpisode,
      cacheKey,
    );
    return episodeInfo ? { contentId: item.contentId, episodeInfo } : null;
  });

  const [recentlyWatchedResults, becauseYouWatched, episodeEntries] =
    await Promise.all([
      recentlyWatchedPromise,
      becauseYouWatchedPromise,
      episodeEntriesPromise,
    ]);

  const episodeData: Record<number, EpisodeInfo> = {};
  for (const entry of episodeEntries) {
    if (entry) {
      episodeData[entry.contentId] = entry.episodeInfo;
    }
  }

  const upNextResults = await Promise.all(
    collectUpNextCandidates(watchlistItems, episodeData).map((candidate) =>
      enrichUpNextCandidate(candidate, fetchTv),
    ),
  );

  return {
    recentlyWatched: recentlyWatchedResults.filter(
      (item): item is RecentlyWatchedItem => item !== null,
    ),
    upNext: upNextResults.filter(
      (item): item is PersonalizedUpNextItemWire => item !== null,
    ),
    becauseYouWatched,
  };
};

export const buildCachedPersonalizedHomeResponse = async (
  userId: string,
  watchlistItems: WatchlistItem[],
): Promise<PersonalizedHomeResponseWire> =>
  personalizedHomeCache.load(
    `${userId}:${watchlistFingerprint(watchlistItems)}`,
    () => buildPersonalizedHomeResponse(watchlistItems, userId),
  );
