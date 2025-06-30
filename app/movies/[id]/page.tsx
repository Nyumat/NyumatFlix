import { fetchMediaDetails } from "@/app/actions";
import AvatarImage from "@/components/avatar-image";
import { HeroSection } from "@/components/hero/exports";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { CountryBadge } from "@/components/ui/country-badge";
import { GenreBadge } from "@/components/ui/genre-badge";
import { Actor, Genre, Movie, ProductionCountry, Video } from "@/utils/typings";
import { Calendar, Clock, Star, Tv, User } from "lucide-react";
import { Metadata } from "next";
import Image from "next/legacy/image";

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const movie = await fetchMediaDetails(params.id);

  if (!movie) {
    return {
      title: "Movie Not Found | NyumatFlix",
      description: "The requested movie could not be found.",
    };
  }

  const title = movie.title || "Movie";
  const description = movie.overview || "Watch this movie on NyumatFlix";
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : "";

  const titleWithYear = releaseYear ? `${title} (${releaseYear})` : title;

  return {
    title: `${titleWithYear} | NyumatFlix`,
    description,
    openGraph: {
      title: titleWithYear,
      description,
      type: "video.movie",
      images: movie.backdrop_path
        ? [
            {
              url: `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`,
              width: 1280,
              height: 720,
              alt: title,
            },
            {
              url: `https://image.tmdb.org/t/p/original${movie.backdrop_path}`,
              width: 1920,
              height: 1080,
              alt: title,
            },
          ]
        : [],
    },
  };
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

    // Enrich movie data with logos
    const { fetchAndEnrichMediaItems } = await import("@/app/actions");
    const enrichedData = await fetchAndEnrichMediaItems([data], "movie");

    return enrichedData[0];
  } catch (error) {
    console.error(error);
    throw new Error("Failed to fetch movie details");
  }
}

export default async function MoviePage({ params }: Props) {
  const { id } = params;
  const details = await fetchDetails(id);

  // Format runtime
  const hours = Math.floor(details.runtime / 60);
  const minutes = details.runtime % 60;
  const formattedRuntime = `${hours}h ${minutes}m`;

  // Format release date
  const releaseDate = details.release_date
    ? new Date(details.release_date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Unknown";

  return (
    <PageContainer className="bg-black/95 pb-16">
      <HeroSection media={[details]} noSlide isWatch />

      {/* Additional content below hero */}
      <ContentContainer
        className="container mx-auto px-4 -mt-10 relative z-10"
        topSpacing={false}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left sidebar - Poster and quick info */}
          <div className="lg:col-span-1">
            <div className="rounded-lg overflow-hidden shadow-xl mt-12 mb-6">
              <Image
                src={`https://image.tmdb.org/t/p/w500${details.poster_path}`}
                alt={details.title}
                width={500}
                height={750}
                className="w-full h-auto"
              />
            </div>

            <div className="bg-gray-900 rounded-lg p-6 space-y-4">
              <div className="flex items-center space-x-3">
                <Clock size={18} className="text-gray-400" />
                <span className="text-white">{formattedRuntime}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar size={18} className="text-gray-400" />
                <span className="text-white">{releaseDate}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Star size={18} className="text-yellow-500" />
                <span className="text-white">
                  {details.vote_average?.toFixed(1)}/10
                </span>
                <span className="text-gray-400">
                  ({details.vote_count?.toLocaleString()} votes)
                </span>
              </div>

              {details.budget > 0 && (
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Budget:</span>
                    <span className="text-white">
                      ${details.budget?.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {details.revenue > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Revenue:</span>
                  <span className="text-white">
                    ${details.revenue?.toLocaleString()}
                  </span>
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
                        />
                      ),
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main content - Overview, cast, similar */}
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
                    <GenreBadge
                      key={genre.id}
                      genreId={genre.id}
                      genreName={genre.name}
                      mediaType="movie"
                      className="bg-primary/20 text-primary border-primary"
                    />
                  ))}
                </div>
              )}
            </section>

            {details.credits?.cast?.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">Cast</h2>
                <div className="relative">
                  <Carousel
                    opts={{
                      dragFree: true,
                      containScroll: "trimSnaps",
                    }}
                    className="w-full"
                  >
                    <CarouselContent>
                      {details.credits.cast
                        .slice(0, 25)
                        .map((person: Actor) => (
                          <CarouselItem
                            key={person.id}
                            className="basis-[140px] md:basis-[140px] lg:basis-[140px]"
                          >
                            <div className="w-full flex-shrink-0">
                              <div className="rounded-lg overflow-hidden mb-2 aspect-[2/3] bg-gray-800">
                                {person.profile_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                                    alt={person.name}
                                    width={185}
                                    height={278}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <User size={40} />
                                  </div>
                                )}
                              </div>
                              <h3 className="text-white font-medium text-sm">
                                {person.name}
                              </h3>
                              <p className="text-gray-400 text-xs">
                                {person.character}
                              </p>
                            </div>
                          </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                    <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                  </Carousel>
                </div>
              </section>
            )}

            {details.videos?.results?.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Videos
                </h2>
                <div className="relative">
                  <Carousel
                    opts={{
                      dragFree: true,
                      containScroll: "trimSnaps",
                    }}
                    className="w-full"
                  >
                    <CarouselContent>
                      {details.videos.results
                        .slice(0, 10)
                        .map((video: Video) => (
                          <CarouselItem
                            key={video.id}
                            className="basis-[280px] md:basis-[280px] lg:basis-[280px]"
                          >
                            <div className="w-full flex-shrink-0">
                              <div className="rounded-lg overflow-hidden mb-2 aspect-video bg-gray-800">
                                <iframe
                                  src={`https://www.youtube.com/embed/${video.key}`}
                                  title={video.name}
                                  className="w-full h-full"
                                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                ></iframe>
                              </div>
                              <h3 className="text-white font-medium text-sm truncate">
                                {video.name}
                              </h3>
                              <p className="text-gray-400 text-xs">
                                {video.type}
                              </p>
                            </div>
                          </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                    <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                  </Carousel>
                </div>
              </section>
            )}

            {details.recommendations?.results?.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Recommended
                </h2>
                <div className="relative">
                  <Carousel
                    opts={{
                      dragFree: true,
                      containScroll: "trimSnaps",
                    }}
                    className="w-full"
                  >
                    <CarouselContent>
                      {details.recommendations.results
                        .slice(0, 15)
                        .map((movie: Movie) => (
                          <CarouselItem
                            key={movie.id}
                            className="basis-[160px] md:basis-[160px] lg:basis-[160px]"
                          >
                            <a
                              href={`/movies/${movie.id}`}
                              className="w-full flex-shrink-0 hover:opacity-80 transition"
                            >
                              <div className="rounded-lg overflow-hidden mb-2 aspect-[2/3] bg-gray-800">
                                {movie.poster_path ? (
                                  <Image
                                    src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`}
                                    alt={movie.title}
                                    width={185}
                                    height={278}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                                    <Tv size={30} />
                                  </div>
                                )}
                              </div>
                              <h3 className="text-white font-medium text-sm truncate">
                                {movie.title}
                              </h3>
                              <div className="flex items-center mt-1">
                                <Star
                                  size={12}
                                  className="text-yellow-500 mr-1"
                                />
                                <span className="text-gray-400 text-xs">
                                  {movie.vote_average?.toFixed(1)}
                                </span>
                              </div>
                            </a>
                          </CarouselItem>
                        ))}
                    </CarouselContent>
                    <CarouselPrevious className="left-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                    <CarouselNext className="right-2 bg-black/50 hover:bg-black/70 border-none text-white" />
                  </Carousel>
                </div>
              </section>
            )}

            {details.reviews?.results?.length > 0 && (
              <section>
                <h2 className="text-2xl font-semibold text-white mb-4">
                  Reviews
                </h2>
                <div className="space-y-4">
                  {details.reviews.results.slice(0, 3).map(
                    (review: {
                      id: string;
                      author: string;
                      content: string;
                      url: string;
                      author_details: {
                        avatar_path?: string;
                        rating?: number;
                      };
                    }) => (
                      <div
                        key={review.id}
                        className="bg-gray-900 rounded-lg p-4"
                      >
                        <div className="flex items-center mb-2">
                          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white mr-3">
                            {review.author_details.avatar_path ? (
                              <AvatarImage
                                src={
                                  review.author_details.avatar_path.startsWith(
                                    "/",
                                  )
                                    ? `https://image.tmdb.org/t/p/w45${review.author_details.avatar_path}`
                                    : review.author_details.avatar_path.substring(
                                        1,
                                      )
                                }
                                alt={review.author}
                                fallbackText={review.author}
                              />
                            ) : (
                              review.author?.substring(0, 1).toUpperCase()
                            )}
                          </div>
                          <div>
                            <h4 className="text-white font-medium">
                              {review.author}
                            </h4>
                            {review.author_details.rating && (
                              <div className="flex items-center">
                                <Star
                                  size={12}
                                  className="text-yellow-500 mr-1"
                                />
                                <span className="text-gray-400 text-xs">
                                  {review.author_details.rating}/10
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-gray-300 text-sm line-clamp-3">
                          {review.content}
                        </p>
                        <a
                          href={review.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary text-xs mt-2 inline-block hover:underline"
                        >
                          Read full review
                        </a>
                      </div>
                    ),
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </ContentContainer>
    </PageContainer>
  );
}
