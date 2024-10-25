import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { movieDb } from "@/lib/constants";
import { Clock, Play, Star } from "lucide-react";
import type { MovieResult, TvResult } from "moviedb-promise";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { match } from "ts-pattern";

const MoviePoster = ({
  posterPath,
  title,
}: {
  posterPath?: string;
  title?: string;
}) =>
  posterPath ? (
    <Image
      src={`https://image.tmdb.org/t/p/w500${posterPath}`}
      alt={title || "Movie Poster"}
      width={500}
      height={750}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center aspect-[2/3]">
      No Image
    </div>
  );

const MovieInfo = ({
  title,
  releaseDate,
  voteAverage,
  runtime,
}: {
  title?: string;
  releaseDate?: string;
  voteAverage?: number;
  runtime?: number;
}) => (
  <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white hidden sm:block backdrop-blur-sm">
    <h3 className="font-semibold text-sm mb-1 line-clamp-1">{title}</h3>
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" className="text-xs">
        {releaseDate?.split("-")[0]}
      </Badge>
      <Badge variant="outline" className="text-xs flex gap-1">
        <Star size={12} />
        {voteAverage?.toFixed(1)}
      </Badge>
      <Badge variant="outline" className="text-xs flex gap-1">
        <Clock size={12} />
        {runtime}m
      </Badge>
    </div>
  </div>
);

const MovieCard = async ({ movie }: { movie: MovieResult }) => {
  if (movie.id === undefined) {
    return <div>No content found</div>;
  }
  const details = await movieDb.movieInfo({ id: movie.id });
  return (
    <Card className="overflow-hidden group relative border-none">
      <CardContent className="p-0 relative">
        <MoviePoster posterPath={movie.poster_path} title={movie.title} />
        <MovieInfo
          title={movie.title}
          releaseDate={movie.release_date}
          voteAverage={movie.vote_average}
          runtime={details.runtime}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
          <Link
            href={`/watch/${movie.id}`}
            className="bg-primary rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300"
          >
            <Play size={24} className="stroke-black" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

const TvPoster = ({
  posterPath,
  name,
}: {
  posterPath?: string;
  name?: string;
}) =>
  posterPath ? (
    <Image
      src={`https://image.tmdb.org/t/p/w500${posterPath}`}
      alt={name || "TV Poster"}
      width={500}
      height={750}
      className="w-full h-full object-cover"
    />
  ) : (
    <div className="w-full h-full bg-gray-200 flex items-center justify-center aspect-[2/3]">
      No Image
    </div>
  );

const TvInfo = ({
  name,
  firstAirDate,
  voteAverage,
  country,
}: {
  name?: string;
  firstAirDate?: string;
  voteAverage?: number;
  country?: string[];
}) => (
  <div className="absolute bottom-0 left-0 right-0 p-2 bg-black bg-opacity-50 text-white hidden sm:block backdrop-blur-sm">
    <h3 className="font-semibold text-sm mb-1 line-clamp-1">{name}</h3>
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" className="text-xs">
        {firstAirDate?.split("-")[0]}
      </Badge>
      <Badge variant="outline" className="text-xs flex gap-1">
        <Star size={12} />
        {voteAverage?.toFixed(1)}
      </Badge>
      <Badge variant="outline" className="text-xs flex gap-1">
        {country?.join(", ")}
      </Badge>
    </div>
  </div>
);

export const TvCard = async ({ tv }: { tv: TvResult }) => {
  return (
    <Card className="overflow-hidden group relative border-none">
      <CardContent className="p-0 relative">
        <TvPoster posterPath={tv.poster_path} name={tv.name} />
        <TvInfo
          name={tv.name}
          firstAirDate={tv.first_air_date}
          voteAverage={tv.vote_average}
          country={tv.origin_country}
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 flex items-center justify-center transition-all duration-300 opacity-0 group-hover:opacity-100">
          <Link
            href={`/watch/${tv.id}`}
            className="bg-primary rounded-full p-3 transform scale-0 group-hover:scale-100 transition-transform duration-300"
          >
            <Play size={24} className="stroke-black" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

const SuspenseSkeleton = () => (
  <Card className="overflow-hidden">
    <CardContent className="p-0 relative">
      <div className="aspect-[2/3] bg-gray-900 animate-pulse" />
    </CardContent>
  </Card>
);

const Fallback = Array.from({ length: 16 }).map((_, i) => (
  <SuspenseSkeleton key={i} />
));

export function ContentGrid({
  items,
  title,
  type,
}: {
  items: MovieResult[] | TvResult[];
  title?: string;
  type: "movie" | "tv";
}) {
  if (items.length === 0) {
    return <div>No content found for {type}</div>;
  }

  const matchType = match(type)
    .with("movie", () => {
      return (items as MovieResult[]).map((item: MovieResult) => (
        <MovieCard key={item.id} movie={item} />
      ));
    })
    .with("tv", () => {
      return (items as TvResult[]).map((item: TvResult) => (
        <TvCard key={item.id} tv={item} />
      ));
    })
    .otherwise(() => {
      return <div>No content found for {type}</div>;
    });

  return (
    <div className="p-4">
      {title && <h2 className="text-2xl font-bold mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
        <Suspense fallback={Fallback}>{matchType}</Suspense>
      </div>
    </div>
  );
}
