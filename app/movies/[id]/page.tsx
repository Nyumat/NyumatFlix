import { fetchTMDBData } from "@/app/actions";
import { MediaCarousels } from "@/components/media/media-carousels";
import { MediaDetailLayout } from "@/components/media/media-detail-layout";
import { MediaErrorPage } from "@/components/media/media-error-page";
import { MediaNotFoundError } from "@/components/media/media-not-found-error";
import { Poster } from "@/components/media/media-poster";
import { CountryBadge } from "@/components/ui/country-badge";
import { PrimaryGenreBadge } from "@/components/ui/genre-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { getAnilistIdForMedia } from "@/utils/anilist-helpers";
import { generateMediaMetadata } from "@/utils/media-metadata-helpers";
import { isUpcomingMovie } from "@/utils/movie-helpers";
import { Genre, MediaItem, ProductionCountry } from "@/utils/typings";
import { Calendar, Clock, Star } from "lucide-react";
import { Metadata } from "next";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateStaticParams() {
  const [popular, topRated, nowPlaying] = await Promise.all([
    fetchTMDBData("/movie/popular", { language: "en-US", region: "US" }),
    fetchTMDBData("/movie/top_rated", { language: "en-US", region: "US" }),
    fetchTMDBData("/movie/now_playing", { language: "en-US", region: "US" }),
  ]);

  const allMovies = [
    ...((popular.results as MediaItem[]) || []),
    ...((topRated.results as MediaItem[]) || []),
    ...((nowPlaying.results as MediaItem[]) || []),
  ];

  // deduplicate by id
  const uniqueMovies = Array.from(
    new Map(allMovies.map((movie) => [movie.id, movie])).values(),
  );

  // pre-render top 60 movies at build time
  return uniqueMovies.slice(0, 60).map((movie) => ({
    id: movie.id.toString(),
  }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const movie = await fetchDetails(params.id);

  return generateMediaMetadata({
    media: movie,
    mediaType: "movie",
    mediaId: params.id,
  });
}

async function fetchDetails(id: string) {
  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.TMDB_API_KEY}&language=en-US&append_to_response=videos,images,credits,recommendations,similar,keywords,reviews`,
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch movie details: ${response.status}`);
    }
    const data = await response.json();

    const { fetchAndEnrichMediaItems } = await import("@/app/actions");
    const enrichedData = await fetchAndEnrichMediaItems([data], "movie");

    return enrichedData[0];
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch movie details");
  }
}

export default async function MoviePage(props: Props) {
  const params = await props.params;
  const { id } = params;
  try {
    const details = await fetchDetails(id);
    if (!details) {
      return <MediaNotFoundError mediaType="movie" title="Movie Not Found" />;
    }

    const isUpcoming = isUpcomingMovie(details);
    const anilistId = await getAnilistIdForMedia(details);

    const hasRuntime = details.runtime && details.runtime > 0;
    const hours = Math.floor((details.runtime || 0) / 60);
    const minutes = (details.runtime || 0) % 60;
    const formattedRuntime = hasRuntime
      ? `${hours}h ${minutes}m`
      : "Runtime TBA";

    const releaseDate = details.release_date
      ? new Date(details.release_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "Release Date TBA";

    return (
      <MediaDetailLayout
        media={[details]}
        mediaType="movie"
        isUpcoming={isUpcoming}
        anilistId={anilistId}
        contentContainerClassName="mx-auto px-4 relative z-10 max-w-7xl !pt-4 sm:!pt-6 lg:!pt-8"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-1">
            <div className="hidden lg:block mt-4 mb-4">
              <Poster
                posterPath={details.poster_path ?? undefined}
                title={details.title}
                size="large"
                className="rounded-lg shadow-xl"
              />
            </div>

            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-6 space-y-4 shadow-xl">
              {isUpcoming && details.status && (
                <div className="flex justify-center mb-4">
                  <StatusBadge status={details.status} />
                </div>
              )}

              {(hasRuntime || !isUpcoming) && (
                <div className="flex items-center space-x-3">
                  <Clock size={18} className="text-gray-400" />
                  <span
                    className={`text-white ${!hasRuntime && isUpcoming ? "text-gray-400" : ""}`}
                  >
                    {formattedRuntime}
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-3">
                <Calendar size={18} className="text-gray-400" />
                <span
                  className={`text-white ${!details.release_date && isUpcoming ? "text-gray-400" : ""}`}
                >
                  {releaseDate}
                </span>
              </div>

              {((details.vote_count && details.vote_count > 0) ||
                !isUpcoming) && (
                <div className="flex items-center space-x-3">
                  <Star size={18} className="text-yellow-500" />
                  <span className="text-white">
                    {details.vote_average && details.vote_average > 0
                      ? `${details.vote_average.toFixed(1)}/10`
                      : "Not yet rated"}
                  </span>
                  {details.vote_count && details.vote_count > 0 && (
                    <span className="text-gray-400">
                      ({details.vote_count.toLocaleString()} votes)
                    </span>
                  )}
                </div>
              )}

              {(details.budget > 0 || details.revenue > 0) && !isUpcoming && (
                <div className="border-t border-gray-700 pt-4 space-y-2">
                  {details.budget > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Budget:</span>
                      <span className="text-white">
                        ${details.budget.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {details.revenue > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Revenue:</span>
                      <span className="text-white">
                        ${details.revenue.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {isUpcoming && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm">
                      More details will be available closer to release
                    </p>
                  </div>
                </div>
              )}

              {details.production_countries?.length > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-gray-400 text-sm mb-2">
                    Production Countries
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {details.production_countries.map(
                      (country: ProductionCountry) => (
                        <CountryBadge
                          key={country.iso_3166_1}
                          country={country}
                          variant="outline"
                          mediaType="movie"
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-8 lg:mt-12">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">
                Overview
              </h2>
              <p className="text-gray-300 leading-relaxed">
                {details.overview}
              </p>

              {details.genres?.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {details.genres.map((genre: Genre) => (
                    <PrimaryGenreBadge
                      key={genre.id}
                      genreId={genre.id}
                      genreName={genre.name}
                      mediaType="movie"
                    />
                  ))}
                </div>
              )}
            </section>

            <MediaCarousels
              cast={details.credits?.cast}
              videos={details.videos?.results}
              recommendations={details.similar?.results}
              mediaType="movie"
            />
          </div>
        </div>
      </MediaDetailLayout>
    );
  } catch (error) {
    console.error("MoviePage error:", error);
    return <MediaErrorPage mediaType="movie" title="Error Loading Movie" />;
  }
}
