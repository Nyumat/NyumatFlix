import { Badge } from "@/components/ui/badge";
import { CountryBadge } from "@/components/ui/country-badge";
import { Network, ProductionCountry, TvShowDetails } from "@/utils/typings";
import { Calendar, Star, Tv } from "lucide-react";
import { Poster } from "../media/media-poster";

type TVShowSidebarProps = {
  details: TvShowDetails;
  firstAirDate: string;
  contentRating: string;
};

export function TVShowSidebar({
  details,
  firstAirDate,
  contentRating,
}: TVShowSidebarProps) {
  return (
    <div className="lg:col-span-1">
      <div className="hidden lg:block mb-4">
        <Poster
          posterPath={details.poster_path}
          title={details.name}
          size="large"
          className="rounded-lg shadow-xl"
        />
      </div>

      <div className="bg-black/30 backdrop-blur-md border border-white/20 rounded-lg p-4 lg:p-6 space-y-3 lg:space-y-4 shadow-xl">
        <div className="flex items-center gap-2">
          <Tv
            size={16}
            className="lg:size-[18px] text-muted-foreground flex-shrink-0"
          />
          <span className="text-foreground text-sm lg:text-base">
            {details.number_of_seasons} Seasons
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar
            size={16}
            className="lg:size-[18px] text-muted-foreground flex-shrink-0"
          />
          <span className="text-foreground text-sm lg:text-base break-words">
            {firstAirDate}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
          <Star
            size={16}
            className="lg:size-[18px] text-yellow-500 flex-shrink-0"
          />
          <span className="text-foreground text-sm lg:text-base">
            {details.vote_average?.toFixed(1)}/10
          </span>
          <span className="text-muted-foreground text-xs lg:text-sm">
            ({details.vote_count?.toLocaleString()} votes)
          </span>
        </div>

        {contentRating && (
          <div className="border-t border-gray-700 pt-3 lg:pt-4">
            <div className="flex justify-between items-center gap-2">
              <span className="text-muted-foreground text-xs lg:text-sm">
                Content Rating:
              </span>
              <span className="text-foreground text-xs lg:text-sm font-medium">
                {contentRating}
              </span>
            </div>
          </div>
        )}

        {details.status && (
          <div className="flex justify-between items-center gap-2">
            <span className="text-muted-foreground text-xs lg:text-sm">
              Status:
            </span>
            <span className="text-foreground text-xs lg:text-sm font-medium">
              {details.status}
            </span>
          </div>
        )}

        {details.networks?.length > 0 && (
          <div className="border-t border-gray-700 pt-3 lg:pt-4">
            <h3 className="text-muted-foreground text-xs lg:text-sm mb-2">
              Networks
            </h3>
            <div className="flex flex-wrap gap-1.5 lg:gap-2">
              {details.networks.map((network: Network) => (
                <Badge
                  key={network.id}
                  variant="outline"
                  className="text-xs lg:text-sm"
                >
                  {network.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {details.production_countries?.length > 0 && (
          <div className="border-t border-gray-700 pt-3 lg:pt-4">
            <h3 className="text-muted-foreground text-xs lg:text-sm mb-2">
              Production Countries
            </h3>
            <div className="flex flex-wrap gap-1.5 lg:gap-2">
              {details.production_countries.map(
                (country: ProductionCountry) => (
                  <CountryBadge
                    key={country.iso_3166_1}
                    country={country}
                    variant="outline"
                    mediaType="tv"
                  />
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
