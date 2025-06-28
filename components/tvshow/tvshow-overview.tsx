import { GenreBadge } from "@/components/ui/genre-badge";
import { Creator, Genre, TvShowDetails } from "@/utils/typings";

type TVShowOverviewProps = {
  details: TvShowDetails;
};

export function TVShowOverview({ details }: TVShowOverviewProps) {
  return (
    <section>
      <h2 className="text-2xl font-semibold text-white mb-4">Overview</h2>
      <p className="text-gray-300 leading-relaxed">{details.overview}</p>

      {details.genres?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {details.genres.map((genre: Genre) => (
            <GenreBadge
              key={genre.id}
              genreId={genre.id}
              genreName={genre.name}
              mediaType="tv"
              className="bg-primary/20 text-primary border-primary"
            />
          ))}
        </div>
      )}

      {details.created_by?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-white text-sm mb-1">Created by:</h3>
          <p className="text-gray-300">
            {details.created_by
              .map((creator: Creator) => creator.name)
              .join(", ")}
          </p>
        </div>
      )}
    </section>
  );
}
