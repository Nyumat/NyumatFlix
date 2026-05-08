"use client";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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

type GridViewProps = {
  seasons: SeasonRatings[];
  inverted: boolean;
};

export function GridView({ seasons, inverted }: GridViewProps) {
  if (seasons.length === 0) return null;

  const maxEpisodes = Math.max(...seasons.map((s) => s.episodes.length));

  if (inverted) {
    return <InvertedGridView seasons={seasons} maxEpisodes={maxEpisodes} />;
  }

  return <StandardGridView seasons={seasons} maxEpisodes={maxEpisodes} />;
}

function StandardGridView({
  seasons,
  maxEpisodes,
}: {
  seasons: SeasonRatings[];
  maxEpisodes: number;
}) {
  return (
    <ScrollArea className="w-full">
      <div className="min-w-fit w-fit">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `auto repeat(${maxEpisodes}, auto) auto`,
          }}
        >
          <div className="w-10" />
          {Array.from({ length: maxEpisodes }, (_, i) => (
            <div
              key={i}
              className="text-center text-xs sm:text-sm text-muted-foreground font-medium py-1"
            >
              E{i + 1}
            </div>
          ))}
          <div className="w-12 text-center text-xs sm:text-sm text-muted-foreground font-medium py-1">
            AVG
          </div>

          {seasons.map((season) => (
            <SeasonRow
              key={season.seasonNumber}
              season={season}
              maxEpisodes={maxEpisodes}
            />
          ))}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function SeasonRow({
  season,
  maxEpisodes,
}: {
  season: SeasonRatings;
  maxEpisodes: number;
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs sm:text-sm text-muted-foreground font-medium">
        S{season.seasonNumber}
      </div>
      {Array.from({ length: maxEpisodes }, (_, i) => {
        const episode = season.episodes.find((e) => e.episodeNumber === i + 1);
        if (!episode) {
          return <div key={i} className="w-9 h-6" />;
        }
        return (
          <EpisodeCell
            key={i}
            episode={episode}
            seasonNumber={season.seasonNumber}
          />
        );
      })}
      <SeasonAverageCell average={season.average} />
    </>
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
            "w-9 h-6 rounded-[3px] flex items-center justify-center transition-all",
            "hover:scale-105 hover:shadow-lg focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-1",
          )}
          style={{ backgroundColor: bgColor }}
          aria-label={`S${seasonNumber} E${episode.episodeNumber}: ${episode.name} - ${rating.toFixed(1)}`}
          tabIndex={0}
        >
          <span
            className="text-base font-bold leading-none"
            style={{ color: textColor }}
          >
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

function SeasonAverageCell({ average }: { average: number }) {
  const bgColor = getRatingColor(average);

  return (
    <div className="flex items-center justify-center h-6">
      <div
        className="w-1 h-full rounded-l-[2px]"
        style={{ backgroundColor: bgColor }}
      />
      <span className="text-base font-bold text-foreground ml-1.5">
        {average.toFixed(1)}
      </span>
    </div>
  );
}

function InvertedGridView({
  seasons,
  maxEpisodes,
}: {
  seasons: SeasonRatings[];
  maxEpisodes: number;
}) {
  return (
    <ScrollArea className="w-full">
      <div className="min-w-fit w-fit">
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `auto repeat(${seasons.length}, auto)`,
          }}
        >
          <div className="w-10" />
          {seasons.map((season) => (
            <div
              key={season.seasonNumber}
              className="text-center text-xs sm:text-sm text-muted-foreground font-medium py-1"
            >
              S{season.seasonNumber}
            </div>
          ))}

          {Array.from({ length: maxEpisodes }, (_, epIndex) => (
            <EpisodeRow
              key={epIndex}
              episodeNumber={epIndex + 1}
              seasons={seasons}
            />
          ))}

          <div className="flex items-center justify-end pr-2 text-xs sm:text-sm text-muted-foreground font-medium">
            AVG
          </div>
          {seasons.map((season) => (
            <InvertedSeasonAverageCell
              key={season.seasonNumber}
              average={season.average}
            />
          ))}
        </div>
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

function EpisodeRow({
  episodeNumber,
  seasons,
}: {
  episodeNumber: number;
  seasons: SeasonRatings[];
}) {
  return (
    <>
      <div className="flex items-center justify-end pr-2 text-xs sm:text-sm text-muted-foreground font-medium">
        E{episodeNumber}
      </div>
      {seasons.map((season) => {
        const episode = season.episodes.find(
          (e) => e.episodeNumber === episodeNumber,
        );
        if (!episode) {
          return <div key={season.seasonNumber} className="w-9 h-6" />;
        }
        return (
          <EpisodeCell
            key={season.seasonNumber}
            episode={episode}
            seasonNumber={season.seasonNumber}
          />
        );
      })}
    </>
  );
}

function InvertedSeasonAverageCell({ average }: { average: number }) {
  const bgColor = getRatingColor(average);

  return (
    <div className="flex flex-col items-center justify-center w-9 h-8 gap-0.5">
      <span className="text-base font-bold text-foreground leading-none">
        {average.toFixed(1)}
      </span>
      <div
        className="w-full h-1 rounded-[2px]"
        style={{ backgroundColor: bgColor }}
      />
    </div>
  );
}
