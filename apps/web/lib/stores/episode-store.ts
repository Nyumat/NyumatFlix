import { Episode } from "@/lib/domain/typings";
import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { episodeNumberForProviders } from "@/lib/tv-provider-episode";
import type { MappingConfidence } from "@/lib/anime/tmdb-anilist-map";
import { rememberLastTvEpisode } from "@/lib/playback/progress-storage";
import { normalizeTvContentKey } from "@/lib/tv-watch-target";
import { create } from "zustand";
import { useServerStore, isScrapeServer } from "./server-store";

export type AnimeEpisodeMappingContext = {
  tvShowId: string;
  seasonNumber: number;
  episodeNumber: number;
};

let advanceRequestId = 0;
let advanceInFlight: Promise<boolean> | null = null;

export type NextEpisodeTarget = {
  episode: Episode;
  seasonNumber: number;
  seasonEpisodes: Episode[];
};

export type NextEpisodeInfo = {
  seasonNumber: number;
  episodeNumber: number;
  providerEpisodeNumber: number;
};

interface EpisodeState {
  selectedEpisode: Episode | null;
  tvShowId: string | null;
  seasonNumber: number | null;
  /** Episodes for the current season (used for provider numbering and auto-advance). */
  seasonEpisodes: Episode[] | null;
  /** 1-based episode index within the season for embed/scrape providers. */
  providerEpisodeNumber: number | null;
  isAnimeEpisode: boolean;
  anilistId: number | null;
  relativeEpisodeNumber: number | null;
  /** 1-based AniList-segment season when TMDB collapses cours into one season. */
  animeSeasonNumber: number | null;
  animeSegmentStart: number | null;
  animeSegmentEnd: number | null;
  mappingConfidence: MappingConfidence | null;
  isAdultAnime: boolean;
  anilistGenres: string[];
  defaultAnilistId: number | null;
  defaultIsAdultAnime: boolean;
  /** TMDB tv id for stream discovery on AniList-backed routes. */
  playbackTmdbTvId: number | null;
  /**
   * Whether TMDB→AniList episode coords are still loading for an anime show.
   * Used to avoid starting the TMDB scrape overlay before anime hosts are ready.
   */
  animeCoordsStatus: "idle" | "pending" | "resolved" | "miss";
  watchCallback: (() => void) | null;
  setSelectedEpisode: (
    episode: Episode,
    tvShowId: string,
    seasonNumber: number,
    animeInfo?: {
      anilistId: number;
      startEpisode: number;
      endEpisode: number;
    },
    skipWatchCallback?: boolean,
    seasonEpisodes?: Episode[],
    mapping?: {
      confidence: MappingConfidence;
      isAdult: boolean;
      genres?: string[];
      animeSeasonNumber?: number | null;
      relativeEpisodeNumber?: number;
    },
  ) => void;
  applyAnimeEpisodeMapping: (
    mapping: {
      animeInfo: {
        anilistId: number;
        startEpisode: number;
        endEpisode: number;
      };
      confidence: MappingConfidence;
      isAdult: boolean;
      genres?: string[];
      animeSeasonNumber?: number | null;
      relativeEpisodeNumber?: number;
    },
    context?: AnimeEpisodeMappingContext,
  ) => void;
  setAnimeCoordsStatus: (status: EpisodeState["animeCoordsStatus"]) => void;
  clearSelectedEpisode: () => void;
  setDefaultAnilistId: (anilistId: number | null, isAdult?: boolean) => void;
  setPlaybackTmdbTvId: (playbackTmdbTvId: number | null) => void;
  setSeasonNumber: (tvShowId: string, seasonNumber: number) => void;
  getEmbedUrl: () => string | null;
  /** Next episode within the loaded season, if any. */
  getNextEpisodeTarget: () => NextEpisodeTarget | null;
  /** Scrape-friendly next-episode coordinates (no embed URL). */
  getNextEpisodeInfo: () => NextEpisodeInfo | null;
  /** Advance to the next episode, including cross-season when needed. */
  advanceToNextEpisode: () => Promise<boolean>;
  setWatchCallback: (callback: (() => void) | null) => void;
}

function findNextEpisodeInSeason(
  selectedEpisode: Episode,
  seasonNumber: number,
  seasonEpisodes: readonly Episode[],
): NextEpisodeTarget | null {
  if (seasonEpisodes.length === 0) {
    return null;
  }

  const sorted = [...seasonEpisodes].sort(
    (a, b) => a.episode_number - b.episode_number,
  );
  const currentIndex = sorted.findIndex(
    (episode) =>
      episode.id === selectedEpisode.id ||
      episode.episode_number === selectedEpisode.episode_number,
  );

  if (currentIndex < 0 || currentIndex >= sorted.length - 1) {
    return null;
  }

  return {
    episode: sorted[currentIndex + 1]!,
    seasonNumber,
    seasonEpisodes: sorted,
  };
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  selectedEpisode: null,
  tvShowId: null,
  seasonNumber: null,
  seasonEpisodes: null,
  providerEpisodeNumber: null,
  isAnimeEpisode: false,
  anilistId: null,
  relativeEpisodeNumber: null,
  animeSeasonNumber: null,
  animeSegmentStart: null,
  animeSegmentEnd: null,
  mappingConfidence: null,
  isAdultAnime: false,
  anilistGenres: [],
  defaultAnilistId: null,
  defaultIsAdultAnime: false,
  playbackTmdbTvId: null,
  animeCoordsStatus: "idle",
  watchCallback: null,
  setSelectedEpisode: (
    episode,
    tvShowId,
    seasonNumber,
    animeInfo,
    skipWatchCallback = false,
    seasonEpisodes,
    mapping,
  ) => {
    const effectiveAnimeInfo = animeInfo;
    const isAnimeEpisode = !!effectiveAnimeInfo;
    const anilistId = effectiveAnimeInfo?.anilistId || null;
    const relativeEpisodeNumber = effectiveAnimeInfo
      ? (mapping?.relativeEpisodeNumber ??
        episode.episode_number - effectiveAnimeInfo.startEpisode + 1)
      : null;
    const providerEpisodeNumber = seasonEpisodes?.length
      ? episodeNumberForProviders(seasonEpisodes, episode.episode_number)
      : episode.episode_number;
    const { defaultAnilistId } = get();
    const mappingConfidence: MappingConfidence | null =
      mapping?.confidence ?? (isAnimeEpisode ? "low" : null);
    const animeCoordsStatus: EpisodeState["animeCoordsStatus"] =
      defaultAnilistId && mappingConfidence !== "high"
        ? "pending"
        : effectiveAnimeInfo
          ? "resolved"
          : defaultAnilistId
            ? "pending"
            : "idle";

    const contentKey = normalizeTvContentKey(tvShowId);
    if (contentKey !== null) {
      rememberLastTvEpisode(contentKey, seasonNumber, episode.episode_number);
    }

    set({
      selectedEpisode: episode,
      tvShowId,
      seasonNumber,
      seasonEpisodes: seasonEpisodes ?? null,
      providerEpisodeNumber,
      isAnimeEpisode,
      anilistId,
      relativeEpisodeNumber,
      animeSeasonNumber: isAnimeEpisode
        ? (mapping?.animeSeasonNumber ?? null)
        : null,
      animeSegmentStart: effectiveAnimeInfo?.startEpisode ?? null,
      animeSegmentEnd: effectiveAnimeInfo?.endEpisode ?? null,
      mappingConfidence,
      isAdultAnime: (mapping?.isAdult ?? false) || get().defaultIsAdultAnime,
      anilistGenres: mapping?.genres ?? [],
      animeCoordsStatus,
    });

    if (!skipWatchCallback) {
      const { watchCallback } = get();
      if (watchCallback) {
        watchCallback();
      }
    }
  },
  clearSelectedEpisode: () => {
    set({
      selectedEpisode: null,
      tvShowId: null,
      seasonNumber: null,
      seasonEpisodes: null,
      providerEpisodeNumber: null,
      isAnimeEpisode: false,
      anilistId: null,
      relativeEpisodeNumber: null,
      animeSeasonNumber: null,
      animeSegmentStart: null,
      animeSegmentEnd: null,
      mappingConfidence: null,
      isAdultAnime: false,
      anilistGenres: [],
      animeCoordsStatus: "idle",
    });
  },
  applyAnimeEpisodeMapping: (mapping, context) => {
    const state = get();
    const { selectedEpisode, tvShowId, seasonNumber } = state;
    if (!selectedEpisode || !tvShowId || seasonNumber == null) {
      return;
    }

    if (context) {
      if (
        tvShowId !== context.tvShowId ||
        seasonNumber !== context.seasonNumber ||
        selectedEpisode.episode_number !== context.episodeNumber
      ) {
        return;
      }
    }

    const relativeEpisodeNumber =
      mapping.relativeEpisodeNumber ??
      selectedEpisode.episode_number - mapping.animeInfo.startEpisode + 1;

    set({
      anilistId: mapping.animeInfo.anilistId,
      relativeEpisodeNumber,
      animeSeasonNumber: mapping.animeSeasonNumber ?? null,
      animeSegmentStart: mapping.animeInfo.startEpisode,
      animeSegmentEnd: mapping.animeInfo.endEpisode,
      isAnimeEpisode: true,
      mappingConfidence: mapping.confidence,
      isAdultAnime: mapping.isAdult || get().defaultIsAdultAnime,
      anilistGenres:
        mapping.genres && mapping.genres.length > 0
          ? mapping.genres
          : get().anilistGenres,
      animeCoordsStatus: "resolved",
    });
  },
  setAnimeCoordsStatus: (animeCoordsStatus) => set({ animeCoordsStatus }),
  setDefaultAnilistId: (defaultAnilistId, isAdult = false) =>
    set((state) => ({
      defaultAnilistId,
      defaultIsAdultAnime: defaultAnilistId ? isAdult === true : false,
      isAdultAnime:
        defaultAnilistId && isAdult === true ? true : state.isAdultAnime,
    })),
  setPlaybackTmdbTvId: (playbackTmdbTvId) => set({ playbackTmdbTvId }),
  setSeasonNumber: (tvShowId, seasonNumber) => {
    const { tvShowId: currentShowId, seasonNumber: currentSeason } = get();
    if (currentShowId === tvShowId && currentSeason === seasonNumber) {
      return;
    }

    set({
      tvShowId,
      seasonNumber,
      selectedEpisode: null,
      seasonEpisodes: null,
      providerEpisodeNumber: null,
      isAnimeEpisode: false,
      anilistId: null,
      relativeEpisodeNumber: null,
      animeSeasonNumber: null,
      animeSegmentStart: null,
      animeSegmentEnd: null,
      mappingConfidence: null,
      anilistGenres: [],
      animeCoordsStatus: get().defaultAnilistId ? "pending" : "idle",
    });
  },
  getEmbedUrl: () => {
    const {
      selectedEpisode,
      tvShowId,
      seasonNumber,
      providerEpisodeNumber,
      isAnimeEpisode,
      anilistId,
      relativeEpisodeNumber,
    } = get();

    if (!selectedEpisode || !tvShowId || !seasonNumber) {
      return null;
    }

    const { selectedServer, vidnestContentType, animePreference } =
      useServerStore.getState();

    if (isScrapeServer(selectedServer)) {
      return null;
    }

    if (selectedServer.id === "vidnest") {
      if (isAnimeEpisode && anilistId && relativeEpisodeNumber) {
        if (vidnestContentType === "anime") {
          return `https://vidnest.fun/anime/${anilistId}/${relativeEpisodeNumber}/${animePreference}`;
        } else if (vidnestContentType === "animepahe") {
          return `https://vidnest.fun/animepahe/${anilistId}/${relativeEpisodeNumber}/${animePreference}`;
        }
      }

      if (vidnestContentType === "tv") {
        return selectedServer.getEpisodeUrl(
          parseInt(tvShowId),
          seasonNumber,
          providerEpisodeNumber ?? selectedEpisode.episode_number,
        );
      }

      if (vidnestContentType === "movie") {
        return selectedServer.getMovieUrl(parseInt(tvShowId));
      }
    }

    if (isAnimeEpisode && anilistId && relativeEpisodeNumber) {
      if (selectedServer.getAnimeUrl) {
        return selectedServer.getAnimeUrl(anilistId, relativeEpisodeNumber);
      }
      if (selectedServer.getAnimePaheUrl) {
        return selectedServer.getAnimePaheUrl(anilistId, relativeEpisodeNumber);
      }

      return null;
    }

    const { playbackTmdbTvId } = get();
    const tmdbShowId = playbackTmdbTvId ?? normalizeTvContentKey(tvShowId);
    if (!tmdbShowId) {
      return null;
    }

    return selectedServer.getEpisodeUrl(
      tmdbShowId,
      seasonNumber,
      providerEpisodeNumber ?? selectedEpisode.episode_number,
    );
  },
  getNextEpisodeTarget: () => {
    const { selectedEpisode, seasonNumber, seasonEpisodes } = get();

    if (!selectedEpisode || seasonNumber == null || !seasonEpisodes?.length) {
      return null;
    }

    return findNextEpisodeInSeason(
      selectedEpisode,
      seasonNumber,
      seasonEpisodes,
    );
  },
  getNextEpisodeInfo: () => {
    const target = get().getNextEpisodeTarget();
    if (!target) {
      return null;
    }

    return {
      seasonNumber: target.seasonNumber,
      episodeNumber: target.episode.episode_number,
      providerEpisodeNumber: episodeNumberForProviders(
        target.seasonEpisodes,
        target.episode.episode_number,
      ),
    };
  },
  advanceToNextEpisode: async () => {
    if (advanceInFlight) {
      return advanceInFlight;
    }

    const requestId = ++advanceRequestId;
    const started = get();
    const {
      selectedEpisode,
      seasonNumber,
      tvShowId,
      seasonEpisodes,
      setSelectedEpisode,
      getNextEpisodeTarget,
    } = started;

    if (!selectedEpisode || seasonNumber == null || !tvShowId) {
      return false;
    }

    const startEpisodeId = selectedEpisode.id;
    const startEpisodeNumber = selectedEpisode.episode_number;

    const isStale = () => {
      if (requestId !== advanceRequestId) {
        return true;
      }

      const state = get();
      return (
        state.tvShowId !== tvShowId ||
        state.seasonNumber !== seasonNumber ||
        state.selectedEpisode?.id !== startEpisodeId ||
        state.selectedEpisode?.episode_number !== startEpisodeNumber
      );
    };

    const advanceEpisode = (
      episode: Episode,
      targetSeason: number,
      episodes: Episode[],
    ) => {
      if (isStale()) {
        return;
      }

      const {
        anilistId,
        animeSeasonNumber,
        animeSegmentStart,
        animeSegmentEnd,
        mappingConfidence,
        isAdultAnime,
      } = get();

      const stillInSegment =
        anilistId != null &&
        animeSegmentStart != null &&
        animeSegmentEnd != null &&
        episode.episode_number >= animeSegmentStart &&
        episode.episode_number <= animeSegmentEnd;

      const animeInfo = stillInSegment
        ? {
            anilistId,
            startEpisode: animeSegmentStart,
            endEpisode: animeSegmentEnd,
          }
        : undefined;

      setSelectedEpisode(
        episode,
        tvShowId,
        targetSeason,
        animeInfo,
        true,
        episodes,
        animeInfo
          ? {
              confidence: mappingConfidence ?? "high",
              isAdult: isAdultAnime,
              animeSeasonNumber,
            }
          : undefined,
      );
    };

    advanceInFlight = (async () => {
      try {
        const inSeasonNext = getNextEpisodeTarget();
        if (inSeasonNext) {
          if (isStale()) {
            return false;
          }
          advanceEpisode(
            inSeasonNext.episode,
            inSeasonNext.seasonNumber,
            inSeasonNext.seasonEpisodes,
          );
          return !isStale();
        }

        let currentSeasonEpisodes = seasonEpisodes;
        if (!currentSeasonEpisodes?.length) {
          const currentSeason = await fetchSeasonDetails(
            tvShowId,
            seasonNumber,
          );
          if (isStale()) {
            return false;
          }
          currentSeasonEpisodes = currentSeason?.episodes ?? [];
        }

        if (currentSeasonEpisodes.length > 0) {
          const sorted = [...currentSeasonEpisodes].sort(
            (a, b) => a.episode_number - b.episode_number,
          );
          const currentIndex = sorted.findIndex(
            (episode) =>
              episode.id === startEpisodeId ||
              episode.episode_number === startEpisodeNumber,
          );

          if (currentIndex >= 0 && currentIndex < sorted.length - 1) {
            if (isStale()) {
              return false;
            }
            advanceEpisode(sorted[currentIndex + 1]!, seasonNumber, sorted);
            return !isStale();
          }
        }

        const nextSeasonNumber = seasonNumber + 1;
        const nextSeason = await fetchSeasonDetails(tvShowId, nextSeasonNumber);
        if (isStale()) {
          return false;
        }

        const nextSeasonEpisodes = nextSeason?.episodes ?? [];
        if (nextSeasonEpisodes.length === 0) {
          return false;
        }

        const sortedNextSeason = [...nextSeasonEpisodes].sort(
          (a, b) => a.episode_number - b.episode_number,
        );
        advanceEpisode(
          sortedNextSeason[0]!,
          nextSeasonNumber,
          sortedNextSeason,
        );
        return !isStale();
      } finally {
        if (requestId === advanceRequestId) {
          advanceInFlight = null;
        }
      }
    })();

    return advanceInFlight;
  },
  setWatchCallback: (callback) => {
    set({ watchCallback: callback });
  },
}));
