"use client";

import { fetchSeasonDetails } from "@/components/tvshow/tvshow-api";
import { WatchlistButton } from "@/components/watchlist/watchlist";
import { pages } from "@/config/pages";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { useMediaDetailTabStore } from "@/lib/stores/media-detail-tab-store";
import {
  formatTvWatchLabel,
  isSameTvWatchTarget,
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

interface HeroButtonsProps {
  handleWatch(): void;
  handlePlayTrailer(): void;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
  contentId: number;
  watchlistItem?: WatchlistItem | null;
  initialEpisode?: Episode | null;
  initialSeasonNumber?: number | null;
  canPlayTrailer: boolean;
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
  canPlayTrailer,
}: HeroButtonsProps) {
  const { selectedEpisode, seasonNumber, tvShowId, setSelectedEpisode } =
    useEpisodeStore();
  const router = useRouter();
  const pathname = usePathname();

  const watchTarget =
    mediaType === "tv"
      ? resolveTvWatchTarget(
          contentId,
          { selectedEpisode, tvShowId, seasonNumber },
          watchlistItem,
          initialEpisode,
          initialSeasonNumber,
        )
      : null;

  const showEpisodeList = () => {
    const id = String(contentId);
    const basePath = `${pages.tv.root.link}/${id}`;

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

    let episode: Episode;
    let targetSeasonNumber: number;

    if (watchTarget.source === "watchlist") {
      const seasonData = await fetchSeasonDetails(
        String(contentId),
        watchTarget.seasonNumber,
      );
      const resolvedEpisode = seasonData?.episodes?.find(
        (item) => item.episode_number === watchTarget.episodeNumber,
      );

      if (!resolvedEpisode) {
        showEpisodeList();
        return;
      }

      episode = resolvedEpisode;
      targetSeasonNumber = watchTarget.seasonNumber;
    } else {
      episode = watchTarget.episode;
      targetSeasonNumber = watchTarget.seasonNumber;
    }

    const storeState = useEpisodeStore.getState();
    if (
      isSameTvWatchTarget(watchTarget, storeState, contentId) &&
      storeState.selectedEpisode?.id === episode.id
    ) {
      handleWatch();
      return;
    }

    setSelectedEpisode(
      episode,
      String(contentId),
      targetSeasonNumber,
      undefined,
      false,
    );
  };

  const getWatchButtonText = () => {
    if (isUpcoming) {
      return "Coming Soon";
    }
    if (mediaType === "tv") {
      if (watchTarget) {
        return formatTvWatchLabel(watchTarget);
      }
      return "Episodes";
    }
    return "Play";
  };

  const isWatchDisabled = isUpcoming;

  const getDisabledTooltip = () => {
    if (isUpcoming) {
      return "This content is not yet available for streaming";
    }
    return "";
  };

  const disabledTooltip = getDisabledTooltip();

  const TrailerButton = (
    <button
      type="button"
      className={cn(
        "backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
        canPlayTrailer
          ? "hover:bg-white/20 hover:border-white/40 hover:shadow-xl"
          : "opacity-50 cursor-not-allowed",
      )}
      onClick={handlePlayTrailer}
      disabled={!canPlayTrailer}
      aria-disabled={!canPlayTrailer}
      aria-label={
        canPlayTrailer ? "Play trailer" : "Trailer not available for this title"
      }
    >
      <Youtube className="mr-2 h-4 w-4" />
      <span className="text-sm">Trailer</span>
    </button>
  );

  const WatchButton = (
    <button
      onClick={handleWatchClick}
      disabled={isWatchDisabled}
      className={cn(
        "backdrop-blur-md bg-white border border-white/60 text-black py-2 px-4 rounded-full font-bold transition flex items-center shadow-lg whitespace-nowrap",
        isWatchDisabled
          ? "bg-white/60 border-white/50 text-black/50 cursor-not-allowed"
          : "cursor-pointer hover:bg-white/90 hover:border-white/70 hover:shadow-xl",
      )}
    >
      <Icons.play className="mr-2 h-4 w-4 text-black fill-black stroke-black" />
      <span className="text-sm">{getWatchButtonText()}</span>
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3">
      {isWatchDisabled ? (
        <Tooltip>
          <TooltipTrigger asChild>{WatchButton}</TooltipTrigger>
          <TooltipContent>
            <p>{disabledTooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        WatchButton
      )}

      <WatchlistButton
        contentId={contentId}
        mediaType={mediaType}
        variant="outline"
        size="default"
        className="backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40"
      />

      {!canPlayTrailer ? (
        <Tooltip>
          <TooltipTrigger asChild>{TrailerButton}</TooltipTrigger>
          <TooltipContent>
            <p>No trailer is available for this title yet.</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        TrailerButton
      )}
    </div>
  );
}
