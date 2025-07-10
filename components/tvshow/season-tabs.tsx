import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Season, TvShowDetails } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { Suspense } from "react";
import { SeasonEpisodes } from "./season-episodes";
import { cn } from "@/lib/utils";

type SeasonTabsProps = {
  details: TvShowDetails;
  tvId: string;
  firstSeason: Season | undefined;
};

// Glassmorphism skeleton for episodes section
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

export function SeasonTabs({ details, tvId, firstSeason }: SeasonTabsProps) {
  if (!details.seasons?.length) return null;

  return (
    <section data-episodes-section id="seasons">
      <h2 className="text-2xl font-semibold text-foreground mb-4">
        Seasons & Episodes
      </h2>
      <Tabs
        defaultValue={firstSeason?.season_number.toString() || "1"}
        className="w-full"
      >
        <div className="overflow-x-auto pb-2">
          <TabsList
            className={cn(
              "mb-4 bg-black/10 backdrop-blur-md border border-white/10 p-1 rounded-lg flex w-max min-w-fit shadow-xl",
              details.seasons.length > 10 && "w-full max-w-screen-2xl",
            )}
          >
            {details.seasons
              .filter((season: Season) => season.season_number > 0)
              .map((season: Season) => (
                <TabsTrigger
                  key={season.id}
                  value={season.season_number.toString()}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  Season {season.season_number}
                </TabsTrigger>
              ))}
          </TabsList>
        </div>

        {details.seasons
          .filter((season: Season) => season.season_number > 0)
          .map((season: Season) => (
            <TabsContent
              key={season.id}
              value={season.season_number.toString()}
              className="min-h-[400px]"
            >
              <div className="grid grid-cols-1 gap-4">
                <div className="flex mb-4 items-center">
                  <div className="w-24 h-36 rounded overflow-hidden mr-4 flex-shrink-0">
                    {season.poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w185${season.poster_path}`}
                        alt={`Season ${season.season_number}`}
                        width={92}
                        height={138}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Tv size={24} className="text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-foreground text-lg font-medium">
                      {season.name}
                    </h3>
                    <div className="text-muted-foreground text-sm">
                      {season.episode_count} Episodes
                    </div>
                    {season.air_date && (
                      <div className="text-muted-foreground text-sm">
                        {new Date(season.air_date).getFullYear()}
                      </div>
                    )}
                    {season.overview && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-2">
                        {season.overview}
                      </p>
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
                    seasonNumber={season.season_number}
                  />
                </Suspense>
              </div>
            </TabsContent>
          ))}
      </Tabs>
    </section>
  );
}
