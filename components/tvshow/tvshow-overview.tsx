import { PrimaryGenreBadge } from "@/components/ui/genre-badge";
import { Creator, Genre, TvShowDetails } from "@/utils/typings";

type TVShowOverviewProps = {
  details: TvShowDetails;
};

export function TVShowOverview({ details }: TVShowOverviewProps) {
  return (
    <section>
      <h2 className="text-xl sm:text-2xl font-semibold text-foreground mt-2 sm:mt-4">
        Overview
      </h2>
      <p className="text-muted-foreground leading-relaxed text-sm sm:text-base mt-2 sm:mt-0">
        {details.overview}
      </p>

      {(details.genres as Genre[])?.length > 0 && (
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          {(details.genres as Genre[]).map((genre: Genre) => (
            <PrimaryGenreBadge
              key={genre.id}
              genreId={genre.id}
              genreName={genre.name}
              mediaType="tv"
            />
          ))}
        </div>
      )}

      {details.created_by?.length > 0 && (
        <div className="mt-3 sm:mt-4">
          <h3 className="text-foreground text-xs sm:text-sm mb-1">
            Created by:
          </h3>
          <p className="text-muted-foreground text-sm sm:text-base">
            {details.created_by
              .map((creator: Creator) => creator.name)
              .join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}
