"use client";

import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { isMovie, isTVShow, MediaItem, Movie, TvShow } from "@/utils/typings";
import { Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { MediaLogo, Poster } from "@/components/media/media-display";
import { hasPosterPath } from "@/lib/media-poster-path";
import { tmdbImage } from "@/tmdb/utils";

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
  const isInteractive = !isMobile;

  const navigate = () => router.push(link);
  const prefetch = () => router.prefetch(link);
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate();
    }
  };

  if (!hasPosterPath(item)) {
    return null;
  }

  if (isRanked && !isMobile && rank !== undefined) {
    const backdropUrl = item.backdrop_path
      ? `https://image.tmdb.org/t/p/w342${item.backdrop_path}`
      : undefined;

    return (
      <div
        className={cn(
          "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-[24px] border border-white/12 bg-card/40 p-3 shadow-xl backdrop-blur-md",
          isInteractive &&
            "transition-all duration-300 hover:border-primary/50",
        )}
        aria-label={`Rank ${rank}: ${title}`}
        onClick={navigate}
        onMouseEnter={prefetch}
      >
        {backdropUrl && (
          <div
            className={cn(
              "absolute inset-0 pointer-events-none opacity-5",
              isInteractive &&
                "transition-opacity duration-500 group-hover:opacity-10",
            )}
          >
            <Image
              src={backdropUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover blur-[2px]"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-r from-background/90 via-background/40 to-transparent pointer-events-none" />

        <span
          className={cn(
            "relative text-5xl md:text-6xl font-black italic tracking-tighter opacity-20",
            isInteractive &&
              "transition-opacity duration-300 group-hover:opacity-40",
            rank === 1 && "text-yellow-500/80",
            rank === 2 && "text-slate-400/80",
            rank === 3 && "text-amber-600/80",
            rank > 3 && "text-foreground/40",
          )}
        >
          {rank}
        </span>

        <div className="relative flex items-center gap-4 flex-1 min-w-0">
          <div
            className={cn(
              "relative aspect-poster w-16 shrink-0 overflow-hidden rounded-[18px] shadow-2xl ring-1 ring-white/10 lg:w-20",
              isInteractive && "transition-all duration-500",
            )}
          >
            <Poster
              posterPath={item.poster_path ?? undefined}
              size="small"
              className={cn(
                "h-full w-full rounded-[inherit]",
                isInteractive &&
                  "transition-transform duration-500 group-hover:scale-110",
              )}
            />
            <div
              className={cn(
                "absolute inset-0 flex items-center justify-center",
                isInteractive &&
                  "bg-black/0 transition-all duration-300 group-hover:bg-black/20",
              )}
            >
              <Icons.play
                className={cn(
                  "text-primary-foreground fill-current w-4 h-4",
                  isInteractive
                    ? "opacity-0 transition-opacity group-hover:opacity-100"
                    : "hidden",
                )}
              />
            </div>
          </div>

          <div
            className={cn(
              "flex min-w-0 flex-1 flex-col justify-center",
              isInteractive &&
                "transition-all duration-500 md:translate-x-2 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100",
            )}
          >
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
                  <span className="px-1 py-0 bg-white/5 border border-white/10 rounded-xs text-[8px] uppercase font-bold">
                    {item.content_rating}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const backdropUrl = item.backdrop_path
    ? `https://image.tmdb.org/t/p/w342${item.backdrop_path}`
    : undefined;

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[28px] border border-white/12 bg-card/40 shadow-xl backdrop-blur-md",
        isInteractive && "transition-all duration-300 hover:border-primary/50",
      )}
      style={{ aspectRatio: "2 / 3" }}
      onClick={navigate}
      onMouseEnter={prefetch}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`View ${title}`}
    >
      {backdropUrl && (
        <div
          className={cn(
            "absolute inset-0 pointer-events-none opacity-10",
            isInteractive &&
              "transition-opacity duration-500 group-hover:opacity-20",
          )}
        >
          <Image
            src={backdropUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover blur-[2px]"
          />
        </div>
      )}
      <div
        className={cn(
          "absolute inset-0 z-10 pointer-events-none rounded-[28px] bg-linear-to-t from-background/95 via-background/40 to-transparent",
          isInteractive
            ? "transition-opacity duration-500 md:opacity-0 md:group-hover:opacity-100"
            : "opacity-0",
        )}
      />

      <Image
        src={tmdbImage.poster(item.poster_path ?? "", "w342")}
        alt={title || "Poster"}
        fill
        sizes="(max-width: 768px) 45vw, (max-width: 1200px) 24vw, 200px"
        className={cn(
          "absolute inset-0 z-0 rounded-[28px] object-cover",
          isInteractive &&
            "transition-transform duration-500 group-hover:scale-[1.05]",
        )}
      />

      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center pointer-events-none",
          isInteractive
            ? "opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            : "hidden",
        )}
      >
        <Icons.play
          className="w-8 h-8 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
          strokeWidth={1.5}
        />
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 flex flex-col items-center p-3 text-center",
          isInteractive &&
            "transition-all duration-500 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:bg-linear-to-t md:from-black/90 md:via-black/60 md:to-transparent md:backdrop-blur-[2px]",
        )}
      >
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
                <span className="px-1 py-0 bg-white/5 border border-white/10 rounded-xs text-[8px] font-bold text-white/70 uppercase">
                  {item.content_rating}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
