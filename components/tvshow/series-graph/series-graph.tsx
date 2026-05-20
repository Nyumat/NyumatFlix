"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LARGE_SERIES_GRAPH_NODE_THRESHOLD } from "@/lib/constants";
import { useTvDetailIsDesktop } from "@/hooks/useTvDetailDesktop";
import { cn } from "@/lib/utils";
import { SeasonDetails } from "@/utils/typings";
import { ArrowDownUp, ArrowLeftRight, LayoutGrid, Network } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { GridView } from "./grid-view";
import { ViewMode } from "./types";
import { useSeriesRatings } from "./use-series-ratings";
const CanvasView = dynamic(
  () => import("./canvas-view").then((mod) => mod.CanvasView),
  { ssr: false },
);

type SeriesGraphProps = {
  allSeasonDetails: Record<number, SeasonDetails>;
  title?: string;
};

export function SeriesGraph({ allSeasonDetails, title }: SeriesGraphProps) {
  const { seasonRatings } = useSeriesRatings(allSeasonDetails);

  const totalCount = useMemo(() => {
    const totalEpisodes = seasonRatings.reduce(
      (sum, season) => sum + season.episodes.length,
      0,
    );
    return seasonRatings.length + totalEpisodes;
  }, [seasonRatings]);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [inverted, setInverted] = useState(false);
  const isDesktop = useTvDetailIsDesktop(false);

  useEffect(() => {
    if (isDesktop) {
      setViewMode("grid");
      return;
    }
    if (totalCount > LARGE_SERIES_GRAPH_NODE_THRESHOLD) {
      setViewMode("canvas");
    }
  }, [isDesktop, totalCount]);

  if (seasonRatings.length === 0) {
    return null;
  }

  const handleToggleInverted = () => {
    setInverted((prev) => !prev);
  };

  const handleToggleViewMode = () => {
    setViewMode((prev) => (prev === "grid" ? "canvas" : "grid"));
  };

  const controls = (
    <div className="flex items-center gap-1">
      {viewMode === "grid" && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleInverted}
              className="relative h-8 w-8"
              aria-label={
                inverted
                  ? "Switch to seasons as rows"
                  : "Switch to episodes as rows"
              }
            >
              <ArrowLeftRight
                className={cn(
                  "absolute h-4 w-4 transition-all duration-300 ease-in-out",
                  inverted
                    ? "scale-0 rotate-90 opacity-0"
                    : "scale-100 rotate-0 opacity-100",
                )}
              />
              <ArrowDownUp
                className={cn(
                  "absolute h-4 w-4 transition-all duration-300 ease-in-out",
                  inverted
                    ? "scale-100 rotate-0 opacity-100"
                    : "scale-0 -rotate-90 opacity-0",
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
            className="relative h-8 w-8"
            aria-label={
              viewMode === "grid"
                ? "Switch to canvas view"
                : "Switch to grid view"
            }
          >
            <LayoutGrid
              className={cn(
                "absolute h-4 w-4 transition-all duration-300 ease-in-out",
                viewMode === "canvas"
                  ? "scale-0 rotate-90 opacity-0"
                  : "scale-100 rotate-0 opacity-100",
              )}
            />
            <Network
              className={cn(
                "absolute h-4 w-4 transition-all duration-300 ease-in-out",
                viewMode === "canvas"
                  ? "scale-100 rotate-0 opacity-100"
                  : "scale-0 -rotate-90 opacity-0",
              )}
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{viewMode === "grid" ? "Canvas view" : "Grid view"}</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {title ? (
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-3 text-2xl font-semibold text-foreground sm:text-3xl">
              <span className="h-8 w-1 rounded-full bg-primary" aria-hidden />
              {title}
            </h2>
            <div className="shrink-0">{controls}</div>
          </div>
        ) : (
          <div className="flex items-center justify-end">{controls}</div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/10 p-3 shadow-xl backdrop-blur-md sm:p-4">
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
