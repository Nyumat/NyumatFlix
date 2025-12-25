"use client";

import { cn } from "@/lib/utils";
import { isMovie, isTVShow, MediaItem, Movie, TvShow } from "@/utils/typings";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { MediaLogo } from "../media/media-logo";
import { Poster } from "../media/media-poster";

interface ContentCardProps {
  item: MediaItem;
  isRanked?: boolean;
  rank?: number;
  isMobile: boolean;
  rating?: string;
  href?: string;
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

  const movie = isMovie(item) ? (item as Movie) : null;
  const show = isTVShow(item) ? (item as TvShow) : null;
  const title = movie?.title || show?.name || "";
  const year =
    movie?.release_date?.slice(0, 4) || show?.first_air_date?.slice(0, 4);
  const link = href || (movie ? `/movies/${item.id}` : `/tvshows/${item.id}`);

  const navigate = () => router.push(link);
  const prefetch = () => router.prefetch(link);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate();
    }
  };

  if (isRanked && !isMobile && rank !== undefined) {
    return (
      <article
        className="flex items-center gap-3 select-none"
        aria-label={`Rank ${rank}: ${title}`}
      >
        <span
          className={cn(
            "text-4xl md:text-5xl font-bold font-serif",
            rank === 1 && "text-yellow-400",
            rank === 2 && "text-gray-300",
            rank === 3 && "text-amber-700",
            rank > 3 && "text-foreground/80",
          )}
        >
          {rank}
        </span>

        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={navigate}
            onMouseEnter={prefetch}
            onKeyDown={handleKeyDown}
            className="relative w-20 lg:w-24 overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={`View ${title}`}
          >
            <Poster
              posterPath={item.poster_path ?? undefined}
              size="small"
              aspectRatio="3/4"
              className="transition-transform duration-300 hover:scale-105"
            />
          </button>

          <div className="flex flex-col justify-between text-foreground min-w-0">
            <div className="flex justify-between items-center gap-2">
              <h3 className="font-medium text-balance text-sm md:text-base"></h3>
              {item.content_rating && (
                <span className="w-fit whitespace-nowrap px-1 py-0.5 text-[10px] font-medium border border-white/30 text-white rounded-sm backdrop-blur-sm shrink-0">
                  {item.content_rating}
                </span>
              )}
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
              {item.vote_average && item.vote_average > 0 && (
                <div className="flex items-center gap-1">
                  <Star
                    className="w-3 h-3 text-yellow-400"
                    fill="currentColor"
                  />
                  <span className="font-medium text-foreground">
                    {item.vote_average.toFixed(1)}
                  </span>
                </div>
              )}
              {year && <span>{year}</span>}
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="select-none w-full" aria-label={title || "Media item"}>
      <button
        onClick={navigate}
        onMouseEnter={prefetch}
        onKeyDown={handleKeyDown}
        className="relative w-full overflow-hidden rounded-xl group focus:outline-none focus:ring-2 focus:ring-primary"
        aria-label={`View ${title}`}
      >
        <Poster
          posterPath={item.poster_path ?? undefined}
          title={title || "Poster"}
          size="medium"
          className="transition-transform duration-300 group-hover:scale-105"
        />
      </button>

      <div className="text-foreground flex flex-col items-center bg-black/30 backdrop-blur-sm p-2 rounded-lg">
        <MediaLogo
          logo={item.logo}
          className="w-full scale-75 max-h-full mx-auto -mb-4"
          title={title}
          fallbackClassName="text-balance text-center my-2"
          size="large"
        />

        <div className="flex flex-col items-center gap-2">
          {item.content_rating && (
            <span className="w-fit whitespace-nowrap px-1.5 py-0.5 rounded-md text-[10px] font-medium border border-white/30 text-white backdrop-blur-sm">
              {item.content_rating}
            </span>
          )}

          <div className="flex justify-center items-center gap-2 text-xs">
            {item.vote_average && item.vote_average > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400" fill="currentColor" />
                <span className="font-medium text-foreground">
                  {item.vote_average.toFixed(1)}
                </span>
              </div>
            )}
            {year && (
              <span className="text-muted-foreground font-medium">{year}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
