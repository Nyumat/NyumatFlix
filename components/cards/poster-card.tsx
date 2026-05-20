"use client";

import { MediaLogo, Poster } from "@/components/media/media-display";
import { Card } from "@/components/ui/card";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import {
  getBackdropPath,
  getContentRatingDisplay,
  getDisplayTitle,
  getDisplayYear,
  getHref,
  getPosterPath,
  getRatingDisplay,
} from "@/lib/cards";
import type { CanonicalMediaCard, MediaItem } from "@/utils/typings";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type PosterCardProps = {
  item: CanonicalMediaCard | MediaItem;
  isMobile?: boolean;
  href?: string;
  minimal?: boolean;
  hideTitleFallback?: boolean;
};

export function PosterCard({
  item,
  isMobile = false,
  href,
  minimal = false,
  hideTitleFallback = false,
}: PosterCardProps) {
  const title = getDisplayTitle(item);
  const link = href || getHref(item);
  const isInteractive = !isMobile;
  const posterPath = getPosterPath(item) ?? undefined;
  const backdropPath = getBackdropPath(item);
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w300")
    : undefined;
  const rating = getRatingDisplay(item);
  const contentRating = getContentRatingDisplay(item);
  const year = getDisplayYear(item);
  const [showBackdrop, setShowBackdrop] = useState(minimal);
  const { prefetch, schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    item,
    link,
  );

  const handleIntent = () => {
    setShowBackdrop(true);
    schedulePrefetch();
  };

  if (minimal) {
    return (
      <Card className="group relative overflow-hidden border-0 bg-card/40 backdrop-blur-md transition-all duration-300 shadow-xl cursor-pointer aspect-2/3">
        {backdropUrl && (
          <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
            <Image
              src={backdropUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover blur-[2px]"
            />
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative h-full">
          <Poster
            posterPath={posterPath}
            title={title}
            className="rounded-none h-full transition-transform duration-500 group-hover:scale-[1.05]"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
            <Icons.play
              className="text-primary-foreground w-10 h-10 scale-75 group-hover:scale-100 transition-transform duration-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
              strokeWidth={1.5}
            />
          </div>
        </div>
        <Link
          href={link}
          className="absolute inset-0 z-40"
          aria-label={`View ${title}`}
        />
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[28px] border border-white/12 bg-card/40 shadow-xl backdrop-blur-md",
        isInteractive && "transition-all duration-300 hover:border-primary/50",
      )}
      style={{ aspectRatio: "2 / 3" }}
      tabIndex={0}
      role="button"
      aria-label={`View ${title}`}
      onPointerEnter={handleIntent}
      onPointerLeave={cancelPrefetch}
      onFocus={handleIntent}
      onTouchStart={prefetch}
    >
      {backdropUrl && showBackdrop && (
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

      <Poster
        posterPath={posterPath}
        title={title || "Poster"}
        className={cn(
          "absolute inset-0 z-0 rounded-[28px]",
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
        {item.logo?.file_path || !hideTitleFallback ? (
          <MediaLogo
            logo={item.logo}
            align="center"
            className="w-full max-h-10 mx-auto mb-2"
            title={title}
            fallbackClassName="text-sm font-semibold leading-tight line-clamp-2 mb-2"
          />
        ) : null}

        <div className="flex flex-col items-center gap-2 w-full mt-auto">
          <div className="flex justify-center items-center gap-3 text-[10px] font-medium text-muted-foreground/80">
            {year && <span>{year}</span>}

            {rating && (
              <>
                <span className="opacity-40">•</span>
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 text-yellow-400 fill-current" />
                  <span className="text-foreground">{rating}</span>
                </div>
              </>
            )}

            {contentRating && (
              <>
                <span className="opacity-40">•</span>
                <span className="px-1 py-0 bg-white/5 border border-white/10 rounded-xs text-[8px] font-bold text-white/70 uppercase">
                  {contentRating}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      <Link
        href={link}
        className="absolute inset-0 z-40"
        aria-label={`View ${title}`}
      />
    </div>
  );
}
