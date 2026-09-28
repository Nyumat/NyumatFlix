"use client";

import { BackdropCardCaption } from "@/components/cards/backdrop-card-caption";
import { getDisplayTitle } from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import useMedia from "@/hooks/useMedia";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

type PosterCaptionCardProps = {
  item: CanonicalMediaCard | MediaItem;
  href?: string;
  /** Optional overlay inside the poster frame (e.g. rank ribbon). */
  frameOverlay?: ReactNode;
  className?: string;
};

/**
 * Flat poster card: image, optional frame overlay, and a plain caption
 * (title + rating · year · type) below. No hover-reveal chrome.
 */
export function PosterCaptionCard({
  item,
  href,
  frameOverlay,
  className,
}: PosterCaptionCardProps) {
  const title = getDisplayTitle(item);
  const posterPath =
    ("poster_path" in item ? item.poster_path : undefined) ||
    ("backdrop_path" in item ? item.backdrop_path : undefined) ||
    undefined;
  const isMobile = useMedia("(max-width: 768px)", false);
  const posterUrl = posterPath
    ? tmdbImage.poster(posterPath as string, "w342")
    : undefined;
  const posterSrcSet = posterPath
    ? tmdbImage.posterSrcSet(posterPath as string)
    : undefined;
  const linkHref =
    href ||
    ("href" in item && typeof item.href === "string"
      ? item.href
      : `/${item.media_type === "tv" ? "tvshows" : "movies"}/${item.id}`);
  const { schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    item,
    linkHref,
  );

  return (
    <div
      className={cn("space-y-2", className)}
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelPrefetch}
      onTouchStart={schedulePrefetch}
    >
      <div className="relative aspect-2/3 overflow-hidden rounded-lg border border-white/12 bg-card/40 shadow-lg shadow-black/10">
        {posterUrl ? (
          posterSrcSet ? (
            <img
              src={posterUrl}
              srcSet={posterSrcSet}
              sizes="(max-width: 640px) 44vw, (max-width: 768px) 32vw, 20vw"
              alt={title}
              className="pointer-events-none absolute inset-0 size-full object-cover"
              loading={isMobile ? "eager" : undefined}
              draggable={false}
            />
          ) : (
            <Image
              src={posterUrl}
              alt={title}
              fill
              className="pointer-events-none object-cover"
              sizes="(max-width: 640px) 44vw, (max-width: 768px) 32vw, 20vw"
              loading={isMobile ? "eager" : undefined}
              draggable={false}
            />
          )
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-pink-500/20 to-pink-500/5" />
        )}
        {frameOverlay}
        <Link
          href={linkHref}
          className="absolute inset-0 z-30"
          prefetch={true}
          aria-label={title || "Open title"}
        />
      </div>
      <BackdropCardCaption item={item} className="space-y-1.5" />
    </div>
  );
}
