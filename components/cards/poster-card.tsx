"use client";

import { MediaLogo, Poster } from "@/components/media/media-display";
import { Card } from "@/components/ui/card";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import useMedia from "@/hooks/useMedia";
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
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { Star } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

type PosterCardProps = {
  item: CanonicalMediaCard | MediaItem;
  isMobile?: boolean;
  href?: string;
  minimal?: boolean;
  hideTitleFallback?: boolean;
};

export function PosterCard({
  item,
  isMobile,
  href,
  minimal = false,
  hideTitleFallback = false,
}: PosterCardProps) {
  const title = getDisplayTitle(item);
  const link = href || getHref(item);
  const detectedMobile = useMedia("(max-width: 768px)", false);
  const isMobileDevice = isMobile ?? !!detectedMobile;
  const isInteractive = !isMobileDevice;
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

  const cardLink = isExternalHref(link) ? (
    <a
      href={link}
      className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
      aria-label={`View ${title}`}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : (
    <Link
      href={link}
      className="absolute inset-0 z-40 cursor-grab active:cursor-grabbing"
      aria-label={`View ${title}`}
    />
  );

  const playControl = isExternalHref(link) ? (
    <a
      href={link}
      className="pointer-events-auto flex size-20 cursor-pointer items-center justify-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      aria-label={`View ${title}`}
      target="_blank"
      rel="noopener noreferrer"
      onFocus={handleIntent}
      onPointerEnter={handleIntent}
    >
      <Icons.play
        className={cn(
          "scale-75 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-100",
          minimal ? "h-10 w-10" : "h-8 w-8",
        )}
        strokeWidth={1.5}
      />
    </a>
  ) : (
    <Link
      href={link}
      className="pointer-events-auto flex size-20 cursor-pointer items-center justify-center rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      aria-label={`View ${title}`}
      onFocus={handleIntent}
      onPointerEnter={handleIntent}
    >
      <Icons.play
        className={cn(
          "scale-75 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-100",
          minimal ? "h-10 w-10" : "h-8 w-8",
        )}
        strokeWidth={1.5}
      />
    </Link>
  );

  if (minimal) {
    return (
      <Card
        className={cn(
          "group relative aspect-2/3 cursor-grab select-none overflow-hidden border-0 bg-card/40 shadow-xl backdrop-blur-md transition-all duration-300 active:cursor-grabbing",
        )}
        onPointerEnter={handleIntent}
        onPointerLeave={cancelPrefetch}
        onTouchStart={prefetch}
      >
        {backdropUrl && (
          <div className="pointer-events-none absolute inset-0 opacity-10 transition-opacity duration-500 group-hover:opacity-20">
            <Image
              src={backdropUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover blur-[2px]"
            />
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
        <div className="relative h-full">
          <Poster
            posterPath={posterPath}
            title={title}
            className="h-full rounded-none transition-transform duration-500 group-hover:scale-[1.05]"
          />
          {isInteractive ? (
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              {playControl}
            </div>
          ) : null}
        </div>
        {isMobileDevice ? cardLink : null}
      </Card>
    );
  }

  return (
    <div
      className={cn(
        "group relative cursor-grab select-none overflow-hidden rounded-[28px] border border-white/12 bg-card/40 shadow-xl backdrop-blur-md active:cursor-grabbing",
        isInteractive && "transition-all duration-300 hover:border-primary/50",
      )}
      style={{ aspectRatio: "2 / 3" }}
      onPointerEnter={handleIntent}
      onPointerLeave={cancelPrefetch}
      onTouchStart={prefetch}
    >
      {backdropUrl && showBackdrop && (
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-10",
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
          "pointer-events-none absolute inset-0 z-10 rounded-[28px] bg-linear-to-t from-background/95 via-background/40 to-transparent",
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

      {isInteractive ? (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
          {playControl}
        </div>
      ) : (
        cardLink
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center p-3 text-center",
          isInteractive &&
            "transition-all duration-500 md:translate-y-4 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100 md:bg-linear-to-t md:from-black/90 md:via-black/60 md:to-transparent md:backdrop-blur-[2px]",
        )}
      >
        {item.logo?.file_path || title ? (
          <MediaLogo
            logo={item.logo}
            align="center"
            className="mx-auto mb-2 max-h-10 w-full"
            title={
              hideTitleFallback && item.logo?.file_path ? undefined : title
            }
            fallbackClassName="mb-2 line-clamp-2 text-sm font-semibold leading-tight"
          />
        ) : null}

        <div className="mt-auto flex w-full flex-col items-center gap-2">
          <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-muted-foreground/80">
            {year && <span>{year}</span>}

            {rating && (
              <>
                <span className="opacity-40">•</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3 w-3 fill-current text-yellow-400" />
                  <span className="text-foreground">{rating}</span>
                </div>
              </>
            )}

            {contentRating && (
              <>
                <span className="opacity-40">•</span>
                <span className="rounded-xs border border-white/10 bg-white/5 px-1 py-0 text-[8px] font-bold uppercase text-white/70">
                  {contentRating}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
