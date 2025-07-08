"use client";

import { Badge } from "@/components/ui/badge";
import {
  PrimaryGenreBadge,
  SmartGenreBadgeGroup,
} from "@/components/ui/genre-badge";
import { isMovie, isTVShow, MediaItem, Movie, TvShow } from "@/utils/typings";
import { Star } from "lucide-react";
import Image from "next/legacy/image";
import { useRouter } from "next/navigation";
import { getGenreName } from "./genre-helpers";

interface ContentCardProps {
  item: MediaItem;
  isRanked?: boolean;
  rank?: number;
  isMobile: boolean;
  rating?: string;
  href?: string; // Optional link href
}

export function ContentCard({
  item,
  isRanked = false,
  rank,
  isMobile,
  rating,
  href,
}: ContentCardProps) {
  const router = useRouter();
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

  // Generate href if not provided
  const cardHref =
    href || (isMovieItem ? `/movies/${item.id}` : `/tvshows/${item.id}`);

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
            className="text-4xl md:text-5xl font-bold text-foreground opacity-90 font-serif"
            style={{
              color:
                rank === 1
                  ? "#FFD700"
                  : rank === 2
                    ? "#C0C0C0"
                    : rank === 3
                      ? "#CD7F32"
                      : undefined,
            }}
            aria-label={`Rank ${rank}`}
          >
            {rank}
          </span>
        </div>
        <div className="flex flex-1 relative items-center space-x-2">
          <div
            className="relative overflow-hidden rounded-lg aspect-[3/4] w-20 lg:w-24"
            onClick={() => {
              router.push(cardHref);
            }}
          >
            <Image
              src={`https://image.tmdb.org/t/p/w300${item.poster_path}`}
              alt={displayTitle || "Media poster"}
              layout="fill"
              objectFit="cover"
              className="transition-transform duration-300 group-hover:scale-105"
              priority={rank !== undefined && rank <= 3}
            />
          </div>

          <div className="text-foreground flex flex-col flex-1 max-w-[calc(100%-1rem)]">
            <h3 className="font-medium text-xs md:text-base mb-0.5 max-w-[90%]">
              {displayTitle}
            </h3>
            <div className="flex flex-wrap items-center gap-0.5 text-[10px] mb-0.5">
              {item.genre_ids
                ?.slice(0, 2)
                .map((genreId) => (
                  <PrimaryGenreBadge
                    key={genreId}
                    genreId={genreId}
                    genreName={getGenreName(
                      genreId,
                      isMovieItem ? "movie" : "tv",
                    )}
                    mediaType={isMovieItem ? "movie" : "tv"}
                    className="text-[10px] h-auto"
                  />
                ))}
            </div>
            <div className="flex items-center gap-1 text-[10px]">
              {item.vote_average !== undefined && item.vote_average > 0 ? (
                <div
                  className="flex items-center text-foreground"
                  aria-label={`Rating: ${item.vote_average?.toFixed(1)} out of 10`}
                >
                  <span className="text-yellow-400 mr-0.5" aria-hidden="true">
                    ★
                  </span>
                  <span className="font-medium">
                    {item.vote_average?.toFixed(1)}
                  </span>
                </div>
              ) : null}
              {isMovieItem && (
                <span className="text-muted-foreground ml-1">| Movie</span>
              )}
              {rating && (
                <Badge
                  variant="outline"
                  className="border-border text-muted-foreground px-1 py-0 text-[10px] font-normal h-4 rounded ml-1"
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

  // Default card for standard and mobile ranked views
  return (
    <div
      className="w-full select-none"
      role="article"
      aria-label={displayTitle || "Media item"}
    >
      <div
        className="relative overflow-hidden rounded-lg aspect-[2/3] group"
        onClick={() => {
          router.push(cardHref);
        }}
      >
        <Image
          src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
          alt={displayTitle || "Media poster"}
          layout="fill"
          objectFit="cover"
          className="transition-transform duration-300 group-hover:scale-105"
          priority={isRanked && rank !== undefined && rank <= 3}
        />
      </div>
      <div className="mt-2 text-foreground">
        <h3 className="font-semibold text-sm mb-1 leading-tight">
          {displayTitle}
        </h3>
        <div className="flex items-center gap-2 text-xs mb-1">
          {item.vote_average !== undefined && item.vote_average > 0 ? (
            <div
              className="flex items-center text-foreground"
              aria-label={`Rating: ${item.vote_average.toFixed(1)} out of 10`}
            >
              <Star
                className="w-3 h-3 mr-1 text-yellow-400"
                fill="currentColor"
                aria-hidden="true"
              />
              <span className="font-medium">
                {item.vote_average.toFixed(1)}
              </span>
            </div>
          ) : null}
          {rating && (
            <Badge
              variant="outline"
              className="border-border text-muted-foreground px-1 py-0 text-xs font-normal"
            >
              {rating}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {itemYear && (
            <span className="inline-block bg-muted/20 text-muted-foreground px-1 py-0.5 rounded-sm">
              {itemYear}
            </span>
          )}
          {item.genre_ids && item.genre_ids.length > 0 && (
            <SmartGenreBadgeGroup
              genreIds={item.genre_ids}
              mediaType={isMovieItem ? "movie" : "tv"}
              maxVisible={isMobile ? 1 : 2}
              className="flex-wrap"
              badgeClassName="text-[10px] h-auto bg-muted/20 text-muted-foreground px-1 py-0.5 border border-border"
              variant="outline"
            />
          )}
        </div>
      </div>
    </div>
  );
}
