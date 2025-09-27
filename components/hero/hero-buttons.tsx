"use client";

import { Play, Youtube } from "lucide-react";
import { toast } from "sonner";
import { useEpisodeStore } from "@/lib/stores/episode-store";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

interface HeroButtonsProps {
  handleWatch(): void;
  handlePlayTrailer(): void;
  mediaType?: "tv" | "movie";
  isUpcoming?: boolean;
}

export function HeroButtons({
  handleWatch,
  handlePlayTrailer,
  mediaType,
  isUpcoming = false,
}: HeroButtonsProps) {
  const { selectedEpisode } = useEpisodeStore();

  const handleWatchClick = () => {
    // For TV shows, require episode selection
    if (mediaType === "tv") {
      if (!selectedEpisode) {
        toast.error(
          "Please select an episode from the seasons below before watching",
          {
            duration: 4000,
            action: {
              label: "Scroll Down",
              onClick: () => {
                // Scroll to episodes section
                const episodesSection =
                  document.querySelector("[data-episodes-section]") ||
                  document.querySelector('[role="tabpanel"]') ||
                  document.getElementById("seasons");
                if (episodesSection) {
                  episodesSection.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                } else {
                  // Fallback: scroll down a bit
                  window.scrollBy({ top: 400, behavior: "smooth" });
                }
              },
            },
          },
        );
        return;
      }
    }

    // Proceed with watch
    handleWatch();
  };

  const getWatchButtonText = () => {
    if (isUpcoming) {
      return "Coming Soon";
    }
    if (mediaType === "tv") {
      if (selectedEpisode) {
        return `Watch S${useEpisodeStore.getState().seasonNumber}E${selectedEpisode.episode_number}`;
      }
      return "Select Episode to Watch";
    }
    return "Watch Now";
  };

  const isWatchDisabled =
    isUpcoming || (mediaType === "tv" && !selectedEpisode);

  const getDisabledTooltip = () => {
    if (isUpcoming) {
      return "This content is not yet available for streaming";
    }
    return "Please select an episode from the seasons below";
  };

  const disabledTooltip = getDisabledTooltip();

  const WatchButton = (
    <button
      onClick={handleWatchClick}
      disabled={isWatchDisabled}
      className={cn(
        "backdrop-blur-md bg-white/20 border border-white/30 text-white py-3 px-6 rounded-full font-bold transition flex items-center shadow-lg",
        isWatchDisabled
          ? "bg-white/10 border-white/20 text-white/60 cursor-not-allowed opacity-60"
          : "hover:bg-white/30 hover:border-white/40 hover:shadow-xl",
      )}
    >
      <Play className="mr-2" size={20} />
      {getWatchButtonText()}
    </button>
  );

  return (
    <div className="flex items-center space-x-4">
      <TooltipProvider>
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
      </TooltipProvider>

      <button
        className="backdrop-blur-md bg-white/10 border border-white/30 text-white py-2 px-4 rounded-full font-bold hover:bg-white/20 hover:border-white/40 hover:shadow-xl transition flex items-center shadow-lg"
        onClick={handlePlayTrailer}
      >
        <Youtube className="mr-2" size={20} />
        Play Trailer
      </button>
    </div>
  );
}
