import type { WatchlistItem } from "@/lib/domain/watchlist";
import {
  PLAYBACK_FINISH_BUFFER_SECONDS,
  listPlaybackProgress,
  playbackProgressRatio,
  type ListedPlaybackProgress,
  type PlaybackMediaType,
} from "@/lib/playback/progress-storage";

export const RECENTLY_WATCHED_LIMIT = 12;
export const VIDSRC_PROGRESS_STORAGE_KEY = "vidsrcwtf-Progress";

export type RecentlyWatchedStub = {
  mediaType: PlaybackMediaType;
  contentId: number;
  seasonNumber?: number;
  episodeNumber?: number;
  progressRatio: number | null;
  updatedAt: number;
  title?: string;
  backdropPath?: string | null;
  posterPath?: string | null;
  voteAverage?: number;
  year?: string;
};

export type RecentlyWatchedItem = {
  mediaType: PlaybackMediaType;
  contentId: number;
  title: string;
  href: string;
  backdropPath: string | null;
  posterPath: string | null;
  progressRatio: number | null;
  updatedAt: number;
  seasonNumber?: number;
  episodeNumber?: number;
  voteAverage?: number;
  year?: string;
  isAnime: boolean;
};

export type RecentlyWatchedScope = "all" | "movie" | "tv" | "anime";

type VidsrcProgressEntry = {
  id: string;
  type: "movie" | "tv";
  title?: string;
  poster_path?: string;
  backdrop_path?: string;
  progress?: { watched: number; duration: number };
  last_updated?: number;
  last_season_watched?: string;
  last_episode_watched?: string;
};

const titleKey = (mediaType: PlaybackMediaType, contentId: number) =>
  `${mediaType}:${contentId}`;

const isFinishedMovie = (entry: ListedPlaybackProgress): boolean => {
  if (entry.mediaType !== "movie" || entry.duration <= 0) {
    return false;
  }
  return entry.duration - entry.watched <= PLAYBACK_FINISH_BUFFER_SECONDS;
};

const parseOptionalInt = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

export const buildRecentlyWatchedHref = (
  mediaType: PlaybackMediaType,
  contentId: number,
  seasonNumber?: number,
): string => {
  if (mediaType === "movie") {
    return `/movies/${contentId}`;
  }

  if (seasonNumber && seasonNumber > 0) {
    return `/tvshows/${contentId}?season=${seasonNumber}`;
  }

  return `/tvshows/${contentId}`;
};

export const readVidsrcProgressEntries = (): VidsrcProgressEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(VIDSRC_PROGRESS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as
      | VidsrcProgressEntry
      | Record<string, VidsrcProgressEntry>;

    if (
      parsed &&
      typeof parsed === "object" &&
      "id" in parsed &&
      typeof (parsed as VidsrcProgressEntry).id === "string"
    ) {
      return [parsed as VidsrcProgressEntry];
    }

    return Object.values(parsed ?? {}).filter(
      (entry): entry is VidsrcProgressEntry =>
        Boolean(entry) &&
        typeof entry.id === "string" &&
        (entry.type === "movie" || entry.type === "tv"),
    );
  } catch {
    return [];
  }
};

const stubsFromPlayback = (
  playback: ListedPlaybackProgress[],
): RecentlyWatchedStub[] =>
  playback
    .filter((entry) => !isFinishedMovie(entry))
    .map((entry) => ({
      mediaType: entry.mediaType,
      contentId: entry.contentId,
      seasonNumber: entry.seasonNumber,
      episodeNumber: entry.episodeNumber,
      progressRatio: playbackProgressRatio(entry),
      updatedAt: entry.updatedAt,
    }));

const stubsFromVidsrc = (
  entries: VidsrcProgressEntry[],
): RecentlyWatchedStub[] => {
  const stubs: RecentlyWatchedStub[] = [];

  for (const entry of entries) {
    const contentId = Number.parseInt(entry.id, 10);
    if (!Number.isFinite(contentId) || contentId <= 0) {
      continue;
    }

    const seasonNumber =
      entry.type === "tv"
        ? parseOptionalInt(entry.last_season_watched)
        : undefined;
    const episodeNumber =
      entry.type === "tv"
        ? parseOptionalInt(entry.last_episode_watched)
        : undefined;

    const progress = entry.progress;
    const progressRatio =
      progress &&
      Number.isFinite(progress.watched) &&
      Number.isFinite(progress.duration) &&
      progress.duration > 0
        ? playbackProgressRatio(progress)
        : null;

    if (
      entry.type === "movie" &&
      progress &&
      progress.duration > 0 &&
      progress.duration - progress.watched <= PLAYBACK_FINISH_BUFFER_SECONDS
    ) {
      continue;
    }

    stubs.push({
      mediaType: entry.type,
      contentId,
      seasonNumber,
      episodeNumber,
      progressRatio,
      updatedAt: entry.last_updated ?? 0,
      title: entry.title,
      backdropPath: entry.backdrop_path ?? null,
      posterPath: entry.poster_path ?? null,
    });
  }

  return stubs;
};

const stubsFromWatchlist = (items: WatchlistItem[]): RecentlyWatchedStub[] =>
  items
    .filter(
      (item) =>
        item.status === "watching" ||
        (item.lastWatchedAt != null && item.status !== "finished"),
    )
    .map((item) => {
      const updatedAt = item.lastWatchedAt
        ? new Date(item.lastWatchedAt).getTime()
        : new Date(item.updatedAt).getTime();

      return {
        mediaType: item.mediaType,
        contentId: item.contentId,
        seasonNumber: item.lastWatchedSeason ?? undefined,
        episodeNumber: item.lastWatchedEpisode ?? undefined,
        progressRatio: null,
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
      };
    });

const mergeStub = (
  current: RecentlyWatchedStub | undefined,
  next: RecentlyWatchedStub,
): RecentlyWatchedStub => {
  if (!current) {
    return next;
  }

  const preferNext = next.updatedAt >= current.updatedAt;

  return {
    mediaType: next.mediaType,
    contentId: next.contentId,
    seasonNumber: preferNext
      ? (next.seasonNumber ?? current.seasonNumber)
      : (current.seasonNumber ?? next.seasonNumber),
    episodeNumber: preferNext
      ? (next.episodeNumber ?? current.episodeNumber)
      : (current.episodeNumber ?? next.episodeNumber),
    progressRatio: next.progressRatio ?? current.progressRatio ?? null,
    updatedAt: Math.max(current.updatedAt, next.updatedAt),
    title: preferNext
      ? (next.title ?? current.title)
      : (current.title ?? next.title),
    backdropPath: preferNext
      ? (next.backdropPath ?? current.backdropPath)
      : (current.backdropPath ?? next.backdropPath),
    posterPath: preferNext
      ? (next.posterPath ?? current.posterPath)
      : (current.posterPath ?? next.posterPath),
    voteAverage: preferNext
      ? (next.voteAverage ?? current.voteAverage)
      : (current.voteAverage ?? next.voteAverage),
    year: preferNext
      ? (next.year ?? current.year)
      : (current.year ?? next.year),
  };
};

export const collectRecentlyWatchedStubs = (input: {
  playback?: ListedPlaybackProgress[];
  vidsrc?: VidsrcProgressEntry[];
  watchlist?: WatchlistItem[];
  limit?: number;
  mediaTypes?: readonly PlaybackMediaType[];
}): RecentlyWatchedStub[] => {
  const merged = new Map<string, RecentlyWatchedStub>();
  const mediaTypes = input.mediaTypes;

  const sources = [
    ...stubsFromPlayback(input.playback ?? []),
    ...stubsFromVidsrc(input.vidsrc ?? []),
    ...stubsFromWatchlist(input.watchlist ?? []),
  ].filter((stub) => !mediaTypes || mediaTypes.includes(stub.mediaType));

  for (const stub of sources) {
    const key = titleKey(stub.mediaType, stub.contentId);
    merged.set(key, mergeStub(merged.get(key), stub));
  }

  return [...merged.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, input.limit ?? RECENTLY_WATCHED_LIMIT);
};

export const collectLocalRecentlyWatchedStubs = (
  watchlist: WatchlistItem[] = [],
  options: {
    limit?: number;
    mediaTypes?: readonly PlaybackMediaType[];
  } = {},
): RecentlyWatchedStub[] =>
  collectRecentlyWatchedStubs({
    playback: listPlaybackProgress(),
    vidsrc: readVidsrcProgressEntries(),
    watchlist,
    limit: options.limit ?? RECENTLY_WATCHED_LIMIT,
    mediaTypes: options.mediaTypes,
  });

export const matchesRecentlyWatchedScope = (
  item: Pick<RecentlyWatchedItem, "mediaType" | "isAnime">,
  scope: RecentlyWatchedScope,
): boolean => {
  switch (scope) {
    case "all":
      return true;
    case "movie":
      return item.mediaType === "movie";
    case "tv":
      return item.mediaType === "tv" && !item.isAnime;
    case "anime":
      return item.isAnime;
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
};

const MOVIE_SCOPE_MEDIA_TYPES = [
  "movie",
] as const satisfies readonly PlaybackMediaType[];
const TV_SCOPE_MEDIA_TYPES = [
  "tv",
] as const satisfies readonly PlaybackMediaType[];

export const mediaTypesForScope = (
  scope: RecentlyWatchedScope,
): readonly PlaybackMediaType[] | undefined => {
  switch (scope) {
    case "movie":
      return MOVIE_SCOPE_MEDIA_TYPES;
    case "tv":
      return TV_SCOPE_MEDIA_TYPES;
    case "anime":
    case "all":
      return undefined;
    default: {
      const _exhaustive: never = scope;
      return _exhaustive;
    }
  }
};

export const toRecentlyWatchedItem = (
  stub: RecentlyWatchedStub,
  media: {
    title: string;
    backdropPath?: string | null;
    posterPath?: string | null;
    voteAverage?: number;
    year?: string;
    isAnime?: boolean;
  },
): RecentlyWatchedItem => ({
  mediaType: stub.mediaType,
  contentId: stub.contentId,
  title: media.title || stub.title || "Untitled",
  href: buildRecentlyWatchedHref(
    stub.mediaType,
    stub.contentId,
    stub.seasonNumber,
  ),
  backdropPath: media.backdropPath ?? stub.backdropPath ?? null,
  posterPath: media.posterPath ?? stub.posterPath ?? null,
  progressRatio: stub.progressRatio,
  updatedAt: stub.updatedAt,
  seasonNumber: stub.seasonNumber,
  episodeNumber: stub.episodeNumber,
  voteAverage: media.voteAverage ?? stub.voteAverage,
  year: media.year ?? stub.year,
  isAnime: media.isAnime ?? false,
});
