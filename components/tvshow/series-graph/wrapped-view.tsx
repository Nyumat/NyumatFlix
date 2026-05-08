"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  getRatingCategory,
  getRatingColor,
  getTextColorForBackground,
  SeasonRatings,
} from "./types";

type WrappedViewProps = {
  seasons: SeasonRatings[];
};

export function WrappedView({ seasons }: WrappedViewProps) {
  if (seasons.length === 0) return null;

  return (
    <div className="space-y-4">
      {seasons.map((season) => (
        <SeasonRow key={season.seasonNumber} season={season} />
      ))}
    </div>
  );
}

function SeasonRow({ season }: { season: SeasonRatings }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <h4 className="text-sm font-medium text-foreground">
          Season {season.seasonNumber}
        </h4>
        <span className="text-xs text-muted-foreground">
          (avg {season.average.toFixed(1)})
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {season.episodes.map((episode) => (
          <EpisodeCell
            key={episode.id}
            episode={episode}
            seasonNumber={season.seasonNumber}
          />
        ))}
      </div>
    </div>
  );
}

function EpisodeCell({
  episode,
  seasonNumber,
}: {
  episode: { rating: number; name: string; episodeNumber: number };
  seasonNumber: number;
}) {
  const rating = episode.rating;
  const bgColor = getRatingColor(rating);
  const textColor = getTextColorForBackground(rating);
  const category = getRatingCategory(rating);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative w-11 h-11 sm:w-12 sm:h-12 rounded-md flex flex-col items-center justify-center transition-all",
            "hover:scale-105 hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1",
          )}
          style={{ backgroundColor: bgColor }}
          aria-label={`S${seasonNumber} E${episode.episodeNumber}: ${episode.name} - ${rating.toFixed(1)}`}
          tabIndex={0}
        >
          <span
            className="absolute top-0.5 left-1 text-[8px] opacity-70"
            style={{ color: textColor }}
          >
            E{episode.episodeNumber}
          </span>
          <span className="text-sm font-semibold" style={{ color: textColor }}>
            {rating.toFixed(1)}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{episode.name}</p>
          <p className="text-xs text-muted-foreground">
            S{seasonNumber} E{episode.episodeNumber}
          </p>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: bgColor }}
            />
            <span className="text-sm font-semibold">{rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground capitalize">
              ({category})
            </span>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
