import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Season, TvShowDetails } from "@/utils/typings";
import { Tv } from "lucide-react";
import Image from "next/legacy/image";
import { Suspense } from "react";
import { SeasonEpisodes } from "./season-episodes";

type SeasonTabsProps = {
  details: TvShowDetails;
  tvId: string;
  firstSeason: Season | undefined;
};

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
          <TabsList className="mb-4 bg-card p-1 rounded-lg flex w-max min-w-full">
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
                    <div className="text-muted-foreground py-4">
                      Loading episodes...
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
