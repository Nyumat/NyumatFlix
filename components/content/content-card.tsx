"use client";

import { Card } from "@/components/ui/card";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { isMovie, isTVShow, MediaItem, Movie, TvShow } from "@/utils/typings";
import { Star } from "lucide-react";
import Image from "next/image";
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
    const backdropUrl = item.backdrop_path
      ? `https://image.tmdb.org/t/p/w342${item.backdrop_path}`
      : undefined;

    return (
      <Card
        className="group relative flex items-center gap-4 p-3 bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-xl cursor-pointer overflow-hidden"
        aria-label={`Rank ${rank}: ${title}`}
        onClick={navigate}
        onMouseEnter={prefetch}
      >
        {backdropUrl && (
          <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
            <Image
              src={backdropUrl}
              alt=""
              fill
              className="object-cover blur-[2px]"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent pointer-events-none" />

        <span
          className={cn(
            "relative text-5xl md:text-6xl font-black italic tracking-tighter opacity-20 group-hover:opacity-40 transition-opacity duration-300",
            rank === 1 && "text-yellow-500/80",
            rank === 2 && "text-slate-400/80",
            rank === 3 && "text-amber-600/80",
            rank > 3 && "text-foreground/40",
          )}
        >
          {rank}
        </span>

        <div className="relative flex items-center gap-4 flex-1 min-w-0">
          <div className="relative w-16 lg:w-20 aspect-[2/3] flex-shrink-0 overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/10 transition-all duration-500">
            <Poster
              posterPath={item.poster_path ?? undefined}
              size="small"
              className="transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
              <Icons.play className="text-primary-foreground fill-current w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex flex-col justify-center min-w-0 flex-1 md:opacity-0 md:group-hover:opacity-100 md:translate-x-2 md:group-hover:translate-x-0 transition-all duration-500">
            <MediaLogo
              logo={item.logo}
              title={title}
              align="left"
              className="mb-1.5 max-w-[120px]"
              fallbackClassName="text-sm font-semibold line-clamp-1 mb-1"
            />

            <div className="flex items-center gap-2.5 text-[10px] font-medium text-muted-foreground/80">
              {year && <span>{year}</span>}

              {item.vote_average && item.vote_average > 0 && (
                <>
                  <span className="opacity-40">•</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-yellow-400 fill-current" />
                    <span className="text-foreground">
                      {item.vote_average.toFixed(1)}
                    </span>
                  </div>
                </>
              )}

              {item.content_rating && (
                <>
                  <span className="opacity-40">•</span>
                  <span className="px-1 py-0 bg-white/5 border border-white/10 rounded-sm text-[8px] uppercase font-bold">
                    {item.content_rating}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w342${item.backdrop_path}`
    : undefined;

  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-md border border-white/10 hover:border-primary/50 transition-all duration-300 shadow-xl cursor-pointer h-full flex flex-col md:aspect-[2/3]"
      onClick={navigate}
      onMouseEnter={prefetch}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View ${title}`}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
          <Image
            src={backdropUrl}
            alt=""
            fill
            className="object-cover blur-[2px]"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent pointer-events-none md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500 z-10" />

      <div className="relative flex-shrink-0 aspect-[2/3] overflow-hidden">
        <Poster
          posterPath={item.poster_path ?? undefined}
          title={title || "Poster"}
          size="medium"
          className="rounded-none transition-transform duration-500 group-hover:scale-[1.05]"
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-20">
          <Icons.play
            className="w-8 h-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
            strokeWidth={1.5}
          />
        </div>
      </div>

      <div className="p-3 relative flex-grow flex flex-col items-center text-center transition-all duration-500 md:absolute md:bottom-0 md:left-0 md:right-0 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 z-30 md:bg-gradient-to-t md:from-black/90 md:via-black/60 md:to-transparent md:backdrop-blur-[2px]">
        <MediaLogo
          logo={item.logo}
          align="center"
          className="w-full max-h-10 mx-auto mb-2"
          title={title}
          fallbackClassName="text-sm font-semibold leading-tight line-clamp-2 mb-2"
        />

        <div className="flex flex-col items-center gap-2 w-full mt-auto">
          <div className="flex justify-center items-center gap-3 text-[10px] font-medium text-muted-foreground/80">
            {year && <span>{year}</span>}

            {item.vote_average && item.vote_average > 0 && (
              <>
                <span className="opacity-40">•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-foreground">
                    {item.vote_average.toFixed(1)}
                  </span>
                </div>
              </>
            )}

            {item.content_rating && (
              <>
                <span className="opacity-40">•</span>
                <span className="px-1 py-0 bg-white/5 border border-white/10 rounded-sm text-[8px] font-bold text-white/70 uppercase">
                  {item.content_rating}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
