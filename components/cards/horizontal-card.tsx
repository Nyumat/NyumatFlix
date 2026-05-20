"use client";

import { MediaLogo, Poster } from "@/components/media/media-display";
import { Card } from "@/components/ui/card";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import { Icons } from "@/lib/icons";
import {
  getBackdropPath,
  getDisplayTitle,
  getHref,
  getPosterPath,
} from "@/lib/cards";
import { tmdbImage } from "@/tmdb/utils";
import type { CanonicalMediaCard, MediaItem } from "@/utils/typings";
import Image from "next/image";
import Link from "next/link";
import { CardMeta } from "./card-meta";

type HorizontalCardProps = {
  item: CanonicalMediaCard | MediaItem;
  testIdPrefix?: string;
  overviewLines?: string;
};

export function HorizontalCard({
  item,
  testIdPrefix = "horizontal-card",
  overviewLines = "line-clamp-2 md:line-clamp-3",
}: HorizontalCardProps) {
  const title = getDisplayTitle(item);
  const href = getHref(item);
  const posterPath = getPosterPath(item) ?? undefined;
  const backdropPath = getBackdropPath(item);
  const backdropUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w780")
    : undefined;
  const { prefetch, schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    item,
    href,
  );

  return (
    <Card
      className="group relative overflow-hidden bg-card/40 backdrop-blur-xl border border-white/10 hover:border-primary/50 transition-all duration-500 cursor-pointer shadow-2xl h-full"
      data-testid={`${testIdPrefix}-${item.id}`}
      data-media-type={item.media_type}
      data-content-id={item.id}
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelPrefetch}
      onFocus={schedulePrefetch}
      onTouchStart={prefetch}
    >
      {backdropUrl && (
        <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity duration-700">
          <Image
            src={backdropUrl}
            alt={title || "Media backdrop"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="scale-110 object-cover blur-xs"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-transparent pointer-events-none" />
      <div className="relative flex gap-6 p-4 md:p-6 h-full">
        <div className="shrink-0 w-24 sm:w-28 md:w-32 lg:w-36">
          <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-muted shadow-2xl ring-1 ring-white/10 group-hover:ring-primary/30 transition-all duration-500">
            <Poster
              posterPath={posterPath}
              title={title || "Media poster"}
              size="medium"
              className="transition-transform duration-700 group-hover:scale-[1.05]"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-500 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 scale-75 group-hover:scale-100">
                <Icons.play
                  className="text-primary-foreground w-12 h-12 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                  strokeWidth={1.5}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center py-2 space-y-3">
          <div className="space-y-1">
            <MediaLogo
              logo={item.logo}
              title={title}
              align="left"
              className="mb-1 max-w-[240px]"
              fallbackClassName="text-xl sm:text-2xl md:text-3xl font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300 leading-tight tracking-tight"
            />
            <CardMeta item={item} showType />
          </div>

          {item.overview && (
            <p
              className={`text-sm text-muted-foreground/90 leading-relaxed ${overviewLines} max-w-2xl font-normal`}
            >
              {item.overview}
            </p>
          )}
        </div>
      </div>
      <Link
        href={href}
        className="absolute inset-0 z-40"
        aria-label={`View ${title}`}
      />
    </Card>
  );
}
