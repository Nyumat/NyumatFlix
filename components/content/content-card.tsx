"use client";

import { MediaItem, isMovie, isTVShow, Movie, TvShow } from "@/utils/typings";
import Image from "next/legacy/image";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getGenreName } from "./genre-helpers";
import { GenreBadge } from "@/components/ui/genre-badge";

interface ContentCardProps<T extends MediaItem> {
  item: T;
  isRanked?: boolean;
  rank?: number;
  isMobile: boolean;
  rating: string;
}

export function ContentCard<T extends MediaItem>({
  item,
  isRanked = false,
  rank,
  isMobile,
  rating,
}: ContentCardProps<T>) {
  // Cast to more specific types for type safety
  const movieItem = isMovie(item) ? (item as Movie) : null;
  const tvShowItem = isTVShow(item) ? (item as TvShow) : null;

  // Safely get the display title based on the type
  const displayTitle = movieItem
    ? movieItem.title
    : tvShowItem
      ? tvShowItem.name
      : "";

  // Get the release year based on item type
  const itemYear =
    movieItem?.release_date?.substring(0, 4) ||
    tvShowItem?.first_air_date?.substring(0, 4);

  // Determine if it's a movie for display purposes
  const isMovieItem = !!movieItem;

  // Ranked variant's desktop card is quite different, handle it separately
  if (isRanked && !isMobile && rank !== undefined) {
    return (
      <div
        className="flex items-center space-x-2 select-none"
        role="article"
        aria-label={`Ranked content: ${displayTitle}`}
      >
        <div className="z-10 flex items-center justify-center">
          <span
            className="text-4xl md:text-5xl font-bold text-white opacity-90 font-serif"
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>
        </div>
        <div className="flex flex-1 relative items-center space-x-2">
          <div className="relative overflow-hidden rounded-lg aspect-[3/4] w-20 lg:w-24">
            <Image
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={displayTitle || "Media poster"}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-300 group-hover:scale-105"
              priority={rank !== undefined && rank <= 3}
            />
          </div>
          <div className="text-white flex flex-col flex-1 max-w-[calc(100%-1rem)]">
            <h3 className="font-medium text-xs md:text-base mb-0.5 max-w-[90%]">
              {displayTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-0.5 text-[10px] mb-0.5">
              {item.genre_ids
                ?.slice(0, 2)
                .map((genreId) => (
                  <GenreBadge
                    key={genreId}
                    genreId={genreId}
                    genreName={getGenreName(genreId)}
                    mediaType={isMovieItem ? "movie" : "tv"}
                    className="bg-gray-700/50 text-gray-300 px-1 py-0.5 text-[10px] h-auto"
                    variant="outline"
                  />
                ))}
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {item.vote_average !== undefined && item.vote_average > 0 ? (
                <div
                  className="flex items-center"
                  aria-label={`Rating: ${item.vote_average?.toFixed(1)} out of 10`}
                >
                  <span className="text-yellow-400 mr-0.5" aria-hidden="true">
                    ★
                  </span>
                  <span className="font-medium text-white">
                    {item.vote_average?.toFixed(1)}
                  </span>
                </div>
              ) : null}
              {isMovieItem && (
                <span className="text-gray-400 ml-1">| Movie</span>
              )}
              {rating && (
                <Badge
                  variant="outline"
                  className="border-gray-500 text-gray-300 px-1 py-0 text-[10px] font-normal h-4 rounded ml-1"
                >
                  {rating}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full select-none"
      role="article"
      aria-label={displayTitle || "Media item"}
    >
      <div className="relative overflow-hidden rounded-lg aspect-[2/3] group">
        <Image
          src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
          alt={displayTitle || "Media poster"}
          layout="fill"
          objectFit="cover"
          className="transition-transform duration-300 group-hover:scale-105"
          priority={isRanked && rank !== undefined && rank <= 3}
        />
      </div>
      <div className="mt-2 text-white">
        <h3 className="font-semibold text-sm truncate mb-1">{displayTitle}</h3>
        <div className="flex items-center gap-2 text-xs mb-1">
          {item.vote_average !== undefined && item.vote_average > 0 ? (
            <div
              className="flex items-center text-white"
              aria-label={`Rating: ${item.vote_average?.toFixed(1)} out of 10`}
            >
              <Star
                className="w-3 h-3 mr-1 text-yellow-400"
                fill="currentColor"
                aria-hidden="true"
              />
              <span className="font-medium">
                {item.vote_average?.toFixed(1)}
              </span>
            </div>
          ) : null}
          {rating && (
            <Badge
              variant="outline"
              className="border-gray-400 text-gray-300 px-1 py-0.5 text-[10px] font-normal h-auto rounded-sm"
            >
              {rating}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-gray-400">
          {itemYear && (
            <span className="inline-block bg-gray-500/20 text-gray-300 px-1 py-0.5 rounded-sm">
              {itemYear}
            </span>
          )}
          {item.genre_ids?.[0] && (
            <GenreBadge
              genreId={item.genre_ids[0]}
              genreName={getGenreName(item.genre_ids[0])}
              mediaType={isMovieItem ? "movie" : "tv"}
              className="bg-gray-500/20 text-gray-300 px-1 py-0.5 text-[10px] h-auto"
              variant="outline"
            />
          )}
          {item.genre_ids?.[1] && !isMobile && (
            <GenreBadge
              genreId={item.genre_ids[1]}
              genreName={getGenreName(item.genre_ids[1])}
              mediaType={isMovieItem ? "movie" : "tv"}
              className="bg-gray-500/20 text-gray-300 px-1 py-0.5 text-[10px] h-auto"
              variant="outline"
            />
          )}
        </div>
      </div>
    </div>
  );
}
