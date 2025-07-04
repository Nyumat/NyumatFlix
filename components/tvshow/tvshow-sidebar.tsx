import { Badge } from "@/components/ui/badge";
import { Network, ProductionCountry, TvShowDetails } from "@/utils/typings";
import { Calendar, Star, Tv } from "lucide-react";
import Image from "next/legacy/image";

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
      <div className="rounded-lg overflow-hidden shadow-xl mb-6">
        <Image
          src={`https://image.tmdb.org/t/p/w500${details.poster_path}`}
          alt={details.name}
          width={500}
          height={750}
          className="w-full h-auto"
        />
      </div>

      <div className="bg-card rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Tv size={18} className="text-muted-foreground" />
          <span className="text-foreground">
            {details.number_of_seasons} Seasons
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-muted-foreground" />
          <span className="text-foreground">{firstAirDate}</span>
        </div>

        <div className="flex items-center space-x-3">
          <Star size={18} className="text-yellow-500" />
          <span className="text-foreground">
            {details.vote_average?.toFixed(1)}/10
          </span>
          <span className="text-muted-foreground">
            ({details.vote_count?.toLocaleString()} votes)
          </span>
        </div>

        {contentRating && (
          <div className="border-t border-gray-700 pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Content Rating:</span>
              <span className="text-foreground">{contentRating}</span>
            </div>
          </div>
        )}

        {details.status && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="text-foreground">{details.status}</span>
          </div>
        )}

        {details.networks?.length > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-muted-foreground text-sm mb-2">Networks</h3>
            <div className="flex flex-wrap gap-2">
              {details.networks.map((network: Network) => (
                <Badge key={network.id} variant="outline">
                  {network.name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {details.production_countries?.length > 0 && (
          <div className="border-t border-gray-700 pt-4">
            <h3 className="text-muted-foreground text-sm mb-2">
              Production Countries
            </h3>
            <div className="flex flex-wrap gap-2">
              {details.production_countries.map(
                (country: ProductionCountry) => (
                  <Badge key={country.iso_3166_1} variant="outline">
                    {country.name}
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
