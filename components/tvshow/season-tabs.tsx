"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Season, TvShowDetails } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { Suspense, useEffect, useState } from "react";
import { SeasonEpisodes } from "./season-episodes";
import { WatchlistItem } from "@/app/watchlist/actions";

type SeasonTabsProps = {
  details: TvShowDetails;
  tvId: string;
  firstSeason: Season | undefined;
  watchlistItem: WatchlistItem | null;
};

const ENHANCED_SEASON_SHOWS = [
  { tmdbId: "1429", name: "Attack on Titan", enhancedSeasons: [4] }, // all because of tmdb... 🤦🏿‍♂️
];

type AnilistMapping = {
  segments: Array<{
    startEpisode: number;
    endEpisode: number;
    anilistMediaId: number;
  }>;
};

type EnhancedSeason = {
  id: string;
  name: string;
  seasonNumber: number;
  episodeCount: number;
  airDate?: string;
  posterPath?: string;
  overview?: string;
  isAniListPart?: boolean;
  anilistId?: number;
  startEpisode?: number;
  endEpisode?: number;
  originalSeasonNumber?: number;
};

function EpisodesSkeleton() {
  return (
    <div className="space-y-4 mt-2">
      <div className="h-6 w-20 bg-gradient-to-r from-white/15 to-white/5 backdrop-blur-sm border border-white/10 rounded-md animate-pulse" />
      <div className="min-h-[200px] max-h-[300px] overflow-hidden space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-lg p-4 animate-pulse"
          >
            <div className="flex">
              <div className="w-32 h-20 rounded overflow-hidden mr-4 flex-shrink-0">
                <div className="w-full h-full bg-gradient-to-br from-white/12 to-white/6 backdrop-blur-md border border-white/20 shadow-lg">
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-48 bg-gradient-to-r from-white/12 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                  <div className="h-4 w-16 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                </div>
                <div className="h-3 w-20 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-sm" />
                <div className="space-y-1">
                  <div className="h-3 w-full bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
                  <div className="h-3 w-2/3 bg-gradient-to-r from-white/8 to-white/4 backdrop-blur-sm border border-white/10 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SeasonTabs({
  details,
  tvId,
  firstSeason,
  watchlistItem,
}: SeasonTabsProps) {
  const [enhancedSeasons, setEnhancedSeasons] = useState<EnhancedSeason[]>([]);
  const [_, setMappings] = useState<Record<number, AnilistMapping>>({});

  useEffect(() => {
    const loadEnhancedSeasons = async () => {
      if (!details.seasons?.length) return;
      const enhancedShow = ENHANCED_SEASON_SHOWS.find(
        (show) => show.tmdbId === tvId,
      );
      const seasons = details.seasons.filter(
        (season: Season) => season.season_number > 0,
      );
      if (!enhancedShow) {
        const enhanced: EnhancedSeason[] = seasons.map((season) => ({
          id: season.id.toString(),
          name: `Season ${season.season_number}`,
          seasonNumber: season.season_number,
          episodeCount: season.episode_count,
          airDate: season.air_date,
          posterPath: season.poster_path,
          overview: season.overview,
        }));
        setEnhancedSeasons(enhanced);
        return;
      }

      const newMappings: Record<number, AnilistMapping> = {};
      const seasonsToEnhance = seasons.filter((season) =>
        enhancedShow.enhancedSeasons.includes(season.season_number),
      );

      await Promise.all(
        seasonsToEnhance.map(async (season) => {
          try {
            const response = await fetch(
              `/api/map?tmdbShowId=${tvId}&tmdbSeason=${season.season_number}`,
            );
            if (response.ok) {
              const mapping = await response.json();
              if (mapping.segments && mapping.segments.length > 0) {
                newMappings[season.season_number] = mapping;
              }
            }
          } catch (_error) {
            // Silently ignore errors for individual season mappings to avoid breaking the entire load
          }
        }),
      );

      setMappings(newMappings);
      const enhanced: EnhancedSeason[] = [];
      for (const season of seasons) {
        const mapping = newMappings[season.season_number];
        if (mapping && mapping.segments.length > 1) {
          mapping.segments.forEach((segment, index) => {
            const partNumber = index + 1;
            const partName =
              segment.endEpisode <= 16 && mapping.segments.length === 2
                ? `Final Season Part ${partNumber}`
                : segment.endEpisode <= 16
                  ? `Season ${season.season_number} Part ${partNumber}`
                  : `Final Season Part ${partNumber}`;

            enhanced.push({
              id: `${season.id}-part-${partNumber}`,
              name: partName,
              seasonNumber: season.season_number * 100 + partNumber,
              episodeCount: segment.endEpisode - segment.startEpisode + 1,
              airDate: season.air_date,
              posterPath: season.poster_path,
              overview: season.overview,
              isAniListPart: true,
              anilistId: segment.anilistMediaId,
              startEpisode: segment.startEpisode,
              endEpisode: segment.endEpisode,
              originalSeasonNumber: season.season_number,
            });
          });
        } else {
          enhanced.push({
            id: season.id.toString(),
            name: season.name || `Season ${season.season_number}`,
            seasonNumber: season.season_number,
            episodeCount: season.episode_count,
            airDate: season.air_date,
            posterPath: season.poster_path,
            overview: season.overview,
          });
        }
      }

      setEnhancedSeasons(enhanced);
    };

    loadEnhancedSeasons();
  }, [details.seasons, tvId]);

  if (!enhancedSeasons.length) return null;

  return (
    <section data-episodes-section id="seasons">
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 sm:mb-4">
        Seasons & Episodes
      </h2>
      <Tabs
        defaultValue={firstSeason?.season_number.toString() || "1"}
        className="w-full"
      >
        <div className="overflow-x-auto pb-2 -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList
            className={cn(
              "mb-3 sm:mb-4 bg-black/10 backdrop-blur-md border border-white/10 p-1 rounded-lg flex w-max min-w-fit shadow-xl",
              enhancedSeasons.length > 10 && "w-full max-w-screen-2xl",
            )}
          >
            {enhancedSeasons.map((season) => (
              <TabsTrigger
                key={season.id}
                value={season.seasonNumber.toString()}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
              >
                {season.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {enhancedSeasons.map((season) => (
          <TabsContent
            key={season.id}
            value={season.seasonNumber.toString()}
            className="min-h-[400px]"
          >
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
              <div className="flex mb-3 sm:mb-4 items-start sm:items-center">
                <div className="w-16 h-24 sm:w-24 sm:h-36 rounded overflow-hidden mr-3 sm:mr-4 flex-shrink-0">
                  {season.posterPath ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w185${season.posterPath}`}
                      alt={season.name}
                      width={92}
                      height={138}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Tv
                        size={20}
                        className="sm:size-6 text-muted-foreground"
                      />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-foreground text-base sm:text-lg font-medium">
                    {season.name}
                  </h3>
                  <div className="text-muted-foreground text-xs sm:text-sm">
                    {season.episodeCount} Episodes
                  </div>
                  {season.airDate && (
                    <div className="text-muted-foreground text-xs sm:text-sm">
                      {new Date(season.airDate).getFullYear()}
                    </div>
                  )}
                  {season.overview && (
                    <p className="text-muted-foreground text-xs sm:text-sm mt-1 sm:mt-2 line-clamp-2 sm:line-clamp-2">
                      {season.overview}
                    </p>
                  )}
                  {season.isAniListPart && season.anilistId && (
                    <div className="text-muted-foreground text-[10px] sm:text-xs mt-1">
                      AniList ID: {season.anilistId}
                    </div>
                  )}
                </div>
              </div>

              <Suspense
                fallback={
                  <div className="min-h-[600px]">
                    <EpisodesSkeleton />
                  </div>
                }
              >
                <SeasonEpisodes
                  tvId={tvId}
                  seasonNumber={
                    season.originalSeasonNumber || season.seasonNumber
                  }
                  episodeRange={
                    season.isAniListPart
                      ? {
                          start: season.startEpisode!,
                          end: season.endEpisode!,
                        }
                      : undefined
                  }
                  animeInfo={
                    season.isAniListPart
                      ? {
                          anilistId: season.anilistId!,
                          startEpisode: season.startEpisode!,
                          endEpisode: season.endEpisode!,
                        }
                      : undefined
                  }
                  watchlistItem={watchlistItem}
                />
              </Suspense>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
