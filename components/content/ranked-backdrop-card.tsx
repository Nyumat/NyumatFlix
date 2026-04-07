"use client";

import { MediaLogo } from "@/components/media/media-display";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { isMovie, MediaItem, Movie, TvShow } from "@/utils/typings";
import { Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export interface RankedBackdropCardProps {
  item: MediaItem;
  rank: number;
}

export const RankedBackdropCard = ({ item, rank }: RankedBackdropCardProps) => {
  const router = useRouter();

  const movieItem = isMovie(item) ? (item as Movie) : null;
  const tvShowItem = !isMovie(item) ? (item as TvShow) : null;

  const displayTitle = movieItem
    ? movieItem.title
    : tvShowItem
      ? tvShowItem.name
      : "";
  const year =
    movieItem?.release_date?.substring(0, 4) ||
    tvShowItem?.first_air_date?.substring(0, 4);

  const handleItemClick = () => {
    const itemHref = `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;
    router.push(itemHref);
  };

  const handleItemMouseEnter = () => {
    const itemHref = `/${isMovie(item) ? "movies" : "tvshows"}/${item.id}`;
    router.prefetch(itemHref);
  };

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`
    : undefined;

  return (
    <div
      onClick={handleItemClick}
      onMouseEnter={handleItemMouseEnter}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleItemClick();
        }
      }}
      role="button"
      tabIndex={0}
      className="group relative overflow-hidden rounded-lg bg-black/40 backdrop-blur-md ring-1 ring-white/[0.08] shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-primary/5 hover:ring-primary/30 transition-all duration-300 cursor-pointer aspect-video"
      aria-label={`View details for ${displayTitle}`}
    >
      {backdropUrl ? (
        <Image
          src={backdropUrl}
          alt={displayTitle || "Backdrop"}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

      <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 z-10">
        <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <span
            className={cn(
              "text-4xl sm:text-5xl md:text-6xl font-black tabular-nums tracking-tighter w-8 sm:w-10 shrink-0",
              "bg-gradient-to-b bg-clip-text text-transparent",
              rank === 1
                ? "from-amber-300 to-amber-600"
                : "from-slate-200 to-slate-500",
            )}
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            <MediaLogo
              logo={item.logo}
              title={displayTitle}
              align="left"
              className="mb-1 sm:mb-2"
              fallbackClassName="text-lg sm:text-xl md:text-2xl font-bold text-white mb-1 sm:mb-2 line-clamp-2"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-white/80">
              {year && <span>{year}</span>}
              {item.vote_average && item.vote_average > 0 && (
                <>
                  <span className="text-white/40">•</span>
                  <div className="flex items-center gap-1">
                    <Star
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400"
                      fill="currentColor"
                    />
                    <span>{item.vote_average.toFixed(1)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
        <Icons.play className="w-10 h-10 sm:w-12 sm:h-12 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
      </div>
    </div>
  );
};
