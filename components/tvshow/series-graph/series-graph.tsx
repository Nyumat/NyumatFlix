"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SeasonDetails } from "@/utils/typings";
import { ArrowDownUp, ArrowLeftRight, LayoutGrid, Network } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { GridView } from "./grid-view";
import { RatingLegend } from "./rating-legend";
import { ViewMode } from "./types";
import { useSeriesRatings } from "./use-series-ratings";
const CanvasView = dynamic(
  () => import("./canvas-view").then((mod) => mod.CanvasView),
  { ssr: false },
);

const LARGE_SERIES_THRESHOLD = 75;

type SeriesGraphProps = {
  allSeasonDetails: Record<number, SeasonDetails>;
};

export function SeriesGraph({ allSeasonDetails }: SeriesGraphProps) {
  const { seasonRatings } = useSeriesRatings(allSeasonDetails);

  const totalCount = useMemo(() => {
    const totalEpisodes = seasonRatings.reduce(
      (sum, season) => sum + season.episodes.length,
      0,
    );
    return seasonRatings.length + totalEpisodes;
  }, [seasonRatings]);

  const initialViewMode: ViewMode =
    totalCount > LARGE_SERIES_THRESHOLD ? "canvas" : "grid";

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [inverted, setInverted] = useState(false);

  if (seasonRatings.length === 0) {
    return null;
  }

  const handleToggleInverted = () => {
    setInverted((prev) => !prev);
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === "grid" ? "canvas" : "grid"));
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <RatingLegend />
          <div className="flex items-center gap-1">
            {viewMode === "grid" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleToggleInverted}
                    className="h-8 w-8 relative"
                    aria-label={
                      inverted
                        ? "Switch to seasons as rows"
                        : "Switch to episodes as rows"
                    }
                  >
                    <ArrowLeftRight
                      className={cn(
                        "h-4 w-4 absolute transition-all duration-300 ease-in-out",
                        inverted
                          ? "opacity-0 rotate-90 scale-0"
                          : "opacity-100 rotate-0 scale-100",
                      )}
                    />
                    <ArrowDownUp
                      className={cn(
                        "h-4 w-4 absolute transition-all duration-300 ease-in-out",
                        inverted
                          ? "opacity-100 rotate-0 scale-100"
                          : "opacity-0 -rotate-90 scale-0",
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{inverted ? "Seasons as rows" : "Episodes as rows"}</p>
                </TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleViewMode}
                  className="h-8 w-8 relative"
                  aria-label={
                    viewMode === "grid"
                      ? "Switch to canvas view"
                      : "Switch to grid view"
                  }
                >
                  <LayoutGrid
                    className={cn(
                      "h-4 w-4 absolute transition-all duration-300 ease-in-out",
                      viewMode === "canvas"
                        ? "opacity-0 rotate-90 scale-0"
                        : "opacity-100 rotate-0 scale-100",
                    )}
                  />
                  <Network
                    className={cn(
                      "h-4 w-4 absolute transition-all duration-300 ease-in-out",
                      viewMode === "canvas"
                        ? "opacity-100 rotate-0 scale-100"
                        : "opacity-0 -rotate-90 scale-0",
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>{viewMode === "grid" ? "Canvas view" : "Grid view"}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div>
          {viewMode === "grid" ? (
            <GridView seasons={seasonRatings} inverted={inverted} />
          ) : (
            <CanvasView seasons={seasonRatings} />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
