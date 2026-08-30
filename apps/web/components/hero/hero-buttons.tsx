"use client";

import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { MalListPopoverButton } from "@/components/media/mal-list-popover-button";
import { WatchlistButton } from "@/components/watchlist/watchlist";
import { pages } from "@/config/pages";
import { useIsHydrated } from "@/hooks/use-is-hydrated";
import { useLocalTvWatchCoords } from "@/hooks/use-local-tv-watch-coords";
import { useMovieWatchButtonLabel } from "@/hooks/use-movie-watch-button-label";
import { useMalSyncStatus } from "@/hooks/use-mal-sync-status";
import { resolveEpisodeAnimeMapping } from "@/lib/anime/resolve-episode-mapping";
import { resolveEpisodeAnimeSelection } from "@/lib/anime/episode-playback-source";
import { resolveAnimeEpisodeMappingTmdbShowId } from "@/lib/anime/resolve-coords-tmdb-show-id";
import {
  isAnimeAnilistRouteId,
  resolveTvDetailRouteId,
} from "@/lib/anilist-route-id";
import { resolveTvDetailCatalogFromPathname } from "@/lib/tv-detail-catalog";
import { useTvDetailCatalog } from "@/hooks/use-tv-detail-catalog";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import {
  formatTvWatchLabel,
  isSameTvWatchTarget,
  isTvCoordsWatchTarget,
  isTvWatchlistResume,
  isTvPlaybackResume,
  resolveTvWatchTarget,
} from "@/lib/tv-watch-target";
import { cn } from "@/lib/utils";
import { WatchlistItem } from "@/lib/domain/watchlist";
import { Episode } from "@/lib/domain/typings";
import { Icons } from "@/lib/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Youtube } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
interface HeroButtonsProps {
  handleWatch(): void;
  handlePlayTrailer(): void;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
  contentId: number;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  anilistId?: number | null;
  showEnded?: boolean;
  canPlayTrailer: boolean;
  onWatchlistChange?: () => void;
}

export function HeroButtons({
  handleWatch,
  handlePlayTrailer,
  mediaType,
  isUpcoming = false,
  contentId,
  watchlistItem,
  initialEpisode,
  initialSeasonNumber,
  anilistId,
  showEnded = false,
  canPlayTrailer,
  onWatchlistChange,
}: HeroButtonsProps) {
  const {
    selectedEpisode,
    seasonNumber,
    tvShowId,
    setSelectedEpisode,
    defaultAnilistId,
    defaultIsAdultAnime,
  } = useEpisodeStore();
  const router = useRouter();
  const pathname = usePathname();
  const watchClickGenerationRef = useRef(0);
  const catalog = useTvDetailCatalog();
  const malStatusQuery = useMalSyncStatus();
  const malConnected = malStatusQuery.data?.connected === true;
  const hasAnilistId = typeof anilistId === "number" && anilistId > 0;
  const isAnimeCatalog = catalog === "anime";
  const showMalListButton =
    malConnected &&
    mediaType === "tv" &&
    (hasAnilistId || isAnimeCatalog || Boolean(defaultAnilistId));
  const isHydrated = useIsHydrated();
  const localCoords = useLocalTvWatchCoords(contentId);
  const movieButtonLabel = useMovieWatchButtonLabel(contentId, mediaType);

  const watchTarget =
    mediaType === "tv"
      ? resolveTvWatchTarget(
          contentId,
          { selectedEpisode, tvShowId, seasonNumber },
          watchlistItem,
          initialEpisode,
          initialSeasonNumber,
          localCoords,
        )
      : null;
  const tvPlaybackResume =
    isHydrated && mediaType === "tv" && watchTarget != null
      ? isTvPlaybackResume(watchTarget, contentId)
      : false;
  const tvResume =
    watchTarget != null &&
    (isTvWatchlistResume(watchTarget, watchlistItem) ||
      tvPlaybackResume ||
      watchTarget.source === "progress");
  const showEpisodeList = () => {
    const id = resolveTvDetailRouteId(pathname, contentId);
    const catalogRoot =
      resolveTvDetailCatalogFromPathname(pathname) === "anime"
        ? pages.anime.root.link
        : pages.tv.root.link;
    const basePath = `${catalogRoot}/${id}`;

    useMediaDetailTabStore
      .getState()
      .setMediaDetailTab("tv", id, "seasons-episodes");

    const scrollToEpisodePanel = (attempt = 0) => {
      const tabPanel =
        document.querySelector("[data-episode-browser]") ||
        document.getElementById("seasons-episodes-panel");

      if (tabPanel) {
        tabPanel.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
        return;
      }

      if (attempt < 8) {
        window.setTimeout(() => scrollToEpisodePanel(attempt + 1), 100);
      }
    };

    if (pathname !== basePath) {
      router.push(basePath);
      window.setTimeout(scrollToEpisodePanel, 100);
      return;
    }

    requestAnimationFrame(scrollToEpisodePanel);
  };

  const handleWatchClick = async () => {
    if (mediaType !== "tv") {
      handleWatch();
      return;
    }

    if (!watchTarget) {
      showEpisodeList();
      return;
    }

    const generation = ++watchClickGenerationRef.current;
    const isStale = () => generation !== watchClickGenerationRef.current;

    let episode: Episode;
    let targetSeasonNumber: number;
    let seasonEpisodes: Episode[] | undefined;

    if (isTvCoordsWatchTarget(watchTarget)) {
      const seasonData = await fetchSeasonDetails(
        String(contentId),
        watchTarget.seasonNumber,
      );
      if (isStale()) {
        return;
      }

      const resolvedEpisode = seasonData?.episodes?.find(
        (item) => item.episode_number === watchTarget.episodeNumber,
      );

      if (!resolvedEpisode) {
        showEpisodeList();
        return;
      }

      episode = resolvedEpisode;
      targetSeasonNumber = watchTarget.seasonNumber;
      seasonEpisodes = seasonData?.episodes;
    } else {
      episode = watchTarget.episode;
      targetSeasonNumber = watchTarget.seasonNumber;
    }

    const storeState = useEpisodeStore.getState();
    if (
      isSameTvWatchTarget(watchTarget, storeState, contentId) &&
      storeState.selectedEpisode?.id === episode.id &&
      storeState.isAnimeEpisode
    ) {
      handleWatch();
      return;
    }

    let animeInfo:
      | {
          anilistId: number;
          startEpisode: number;
          endEpisode: number;
        }
      | undefined;
    let mapping:
      | {
          confidence: "high" | "low";
          isAdult: boolean;
          genres?: string[];
          animeSeasonNumber?: number | null;
          relativeEpisodeNumber?: number;
        }
      | undefined;

    const embeddedSelection = resolveEpisodeAnimeSelection(episode, {
      animeSeasonNumber: targetSeasonNumber,
      isAdult: defaultIsAdultAnime,
    });
    if (embeddedSelection) {
      animeInfo = embeddedSelection.animeInfo;
      mapping = embeddedSelection.mapping;
    }

    const tvRouteId = resolveTvDetailRouteId(pathname, contentId);

    if (!animeInfo && defaultAnilistId && isAnimeAnilistRouteId(tvRouteId)) {
      const playbackTmdbTvId = storeState.playbackTmdbTvId;
      if (playbackTmdbTvId) {
        const coords = await resolveEpisodeAnimeMapping({
          tmdbShowId: playbackTmdbTvId,
          seasonNumber: targetSeasonNumber,
          episodeNumber: episode.episode_number,
          isAdult: defaultIsAdultAnime,
        });
        if (isStale()) {
          return;
        }
        if (coords) {
          animeInfo = coords.animeInfo;
          mapping = {
            confidence: coords.confidence,
            isAdult: coords.isAdult,
            genres: coords.genres,
            animeSeasonNumber: coords.animeSeasonNumber,
            relativeEpisodeNumber: coords.relativeEpisodeNumber,
          };
        }
      }

      if (!animeInfo) {
        const fallbackSelection = resolveEpisodeAnimeSelection(episode, {
          animeSeasonNumber: targetSeasonNumber,
          isAdult: defaultIsAdultAnime,
        });
        if (fallbackSelection) {
          animeInfo = fallbackSelection.animeInfo;
          mapping = fallbackSelection.mapping;
        } else {
          mapping = {
            confidence: "low",
            isAdult: defaultIsAdultAnime,
            animeSeasonNumber: targetSeasonNumber,
          };
        }
      }
    } else if (!animeInfo && defaultAnilistId) {
      const mappingTmdbShowId = resolveAnimeEpisodeMappingTmdbShowId(
        tvRouteId,
        defaultAnilistId,
        storeState.playbackTmdbTvId,
      );

      if (mappingTmdbShowId) {
        const coords = await resolveEpisodeAnimeMapping({
          tmdbShowId: mappingTmdbShowId,
          seasonNumber: targetSeasonNumber,
          episodeNumber: episode.episode_number,
          isAdult: defaultIsAdultAnime,
        });
        if (isStale()) {
          return;
        }
        if (coords) {
          animeInfo = coords.animeInfo;
          mapping = {
            confidence: coords.confidence,
            isAdult: coords.isAdult,
            genres: coords.genres,
            animeSeasonNumber: coords.animeSeasonNumber,
            relativeEpisodeNumber: coords.relativeEpisodeNumber,
          };
        }
      }

      if (!animeInfo) {
        const fallbackSelection = resolveEpisodeAnimeSelection(episode, {
          animeSeasonNumber: targetSeasonNumber,
          isAdult: defaultIsAdultAnime,
        });
        if (fallbackSelection) {
          animeInfo = fallbackSelection.animeInfo;
          mapping = fallbackSelection.mapping;
        }
      }
    }

    if (isStale()) {
      return;
    }

    setSelectedEpisode(
      episode,
      tvRouteId,
      targetSeasonNumber,
      animeInfo,
      false,
      seasonEpisodes,
      mapping,
    );
  };

  const getWatchButtonText = () => {
    if (isUpcoming) {
      return "Coming Soon";
    }
    if (mediaType === "tv") {
      if (watchTarget) {
        return formatTvWatchLabel(watchTarget, undefined, {
          resume: tvResume,
        });
      }
      return "Episodes";
    }
    return movieButtonLabel;
  };

  const isWatchDisabled = isUpcoming;

  const getDisabledTooltip = () => {
    if (isUpcoming) {
      return "This content is not yet available for streaming";
    }
    return "";
  };

  const disabledTooltip = getDisabledTooltip();

  const watchButtonClassName = cn(
    "backdrop-blur-md bg-white border border-white/60 text-black py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
    isWatchDisabled
      ? "bg-white/60 border-white/50 text-black/50 cursor-not-allowed"
      : "cursor-pointer hover:bg-white/90 hover:border-white/70 hover:shadow-xl",
  );

  const trailerButtonClassName = cn(
    "backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
    canPlayTrailer
      ? "hover:bg-white/20 hover:border-white/40 hover:shadow-xl"
      : "opacity-50 cursor-not-allowed",
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {isWatchDisabled ? (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className={watchButtonClassName}
            disabled={isWatchDisabled}
            onClick={handleWatchClick}
          >
            <Icons.play className="mr-2 h-4 w-4 text-black fill-black stroke-black" />
            <span className="text-sm">{getWatchButtonText()}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={handleWatchClick}
          className={watchButtonClassName}
        >
          <Icons.play className="mr-2 h-4 w-4 text-black fill-black stroke-black" />
          <span className="text-sm">{getWatchButtonText()}</span>
        </button>
      )}

      {showMalListButton ? (
        <MalListPopoverButton
          anilistId={anilistId ?? defaultAnilistId}
          contentId={contentId}
          mediaType="tv"
          seasonNumber={seasonNumber}
          showEnded={showEnded}
          onUpdated={onWatchlistChange}
        />
      ) : (
        <WatchlistButton
          contentId={contentId}
          mediaType={mediaType}
          variant="outline"
          size="default"
          className="backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40"
          onWatchlistChange={onWatchlistChange}
        />
      )}

      {!canPlayTrailer ? (
        <Tooltip>
          <TooltipTrigger
            type="button"
            className={trailerButtonClassName}
            disabled
            aria-disabled
            aria-label="Trailer not available for this title"
          >
            <Youtube className="mr-2 h-4 w-4" />
            <span className="text-sm">Trailer</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>No trailer is available for this title yet.</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <button
          type="button"
          className={trailerButtonClassName}
          onClick={handlePlayTrailer}
          aria-label="Play trailer"
        >
          <Youtube className="mr-2 h-4 w-4" />
          <span className="text-sm">Trailer</span>
        </button>
      )}
    </div>
  );
}
