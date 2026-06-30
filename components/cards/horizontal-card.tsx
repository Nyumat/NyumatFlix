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
} from "@/lib/cards/selectors";
import { tmdbImage } from "@/tmdb/utils";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { CardMeta } from "./card-meta";

type HorizontalCardProps = {
  item: CanonicalMediaCard | MediaItem;
  testIdPrefix?: string;
  overviewLines?: string;
  variant?: "default" | "compact";
};

export function HorizontalCard({
  item,
  testIdPrefix = "horizontal-card",
  overviewLines,
  variant = "default",
}: HorizontalCardProps) {
  const isCompact = variant === "compact";
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
  const resolvedOverviewLines =
    overviewLines ??
    (isCompact ? "line-clamp-2" : "line-clamp-2 md:line-clamp-3");

  return (
    <Card
      className={cn(
        "group relative h-full cursor-pointer overflow-hidden border transition-all duration-300",
        isCompact
          ? "border-white/10 bg-card/40 shadow-none backdrop-blur-xl hover:border-primary/40"
          : "border-white/10 bg-card/40 shadow-2xl backdrop-blur-xl hover:border-primary/50",
      )}
      data-testid={`${testIdPrefix}-${item.id}`}
      data-media-type={item.media_type}
      data-content-id={item.id}
      onPointerEnter={schedulePrefetch}
      onPointerLeave={cancelPrefetch}
      onFocus={schedulePrefetch}
      onTouchStart={prefetch}
    >
      {backdropUrl ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-700",
            isCompact
              ? "opacity-20 group-hover:opacity-30"
              : "opacity-15 group-hover:opacity-25",
          )}
        >
          <Image
            src={backdropUrl}
            alt={title || "Media backdrop"}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="scale-110 object-cover blur-xs"
          />
        </div>
      ) : null}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-linear-to-r from-background/95 via-background/70 to-transparent",
          isCompact && "via-background/75",
        )}
      />
      <div
        className={cn(
          "relative flex h-full",
          isCompact ? "z-10 gap-3 p-3" : "gap-6 p-4 md:p-6",
        )}
      >
        <div
          className={cn(
            "shrink-0",
            isCompact ? "w-[4.5rem]" : "w-24 sm:w-28 md:w-32 lg:w-36",
          )}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg bg-muted ring-1 ring-white/10 transition-all duration-300 group-hover:ring-primary/25",
              isCompact
                ? "aspect-[2/3]"
                : "aspect-2/3 rounded-xl shadow-2xl group-hover:ring-primary/30",
            )}
          >
            <Poster
              posterPath={posterPath}
              title={title || "Media poster"}
              size={isCompact ? "small" : "medium"}
              className={cn(
                "transition-transform duration-500",
                isCompact
                  ? "group-hover:scale-[1.02]"
                  : "duration-700 group-hover:scale-[1.05]",
              )}
            />
            {!isCompact ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-500 group-hover:bg-black/20">
                <div className="scale-75 opacity-0 transition-all duration-500 group-hover:scale-100 group-hover:opacity-100">
                  <Icons.play
                    className="h-12 w-12 text-primary-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div
          className={cn(
            "flex min-w-0 flex-1 flex-col justify-center",
            isCompact ? "gap-2 py-0.5" : "space-y-3 py-2",
          )}
        >
          <div className={isCompact ? "space-y-1.5" : "space-y-1"}>
            <MediaLogo
              logo={item.logo}
              title={title}
              align="left"
              className={cn(
                "max-w-full",
                isCompact ? "mb-0 max-w-[280px]" : "mb-1 max-w-[240px]",
              )}
              fallbackClassName={cn(
                "line-clamp-2 font-semibold leading-snug tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary",
                isCompact
                  ? "text-base"
                  : "text-xl font-bold sm:text-2xl md:text-3xl",
              )}
            />
            <CardMeta item={item} showType variant={variant} />
          </div>

          {item.overview ? (
            <p
              className={cn(
                "max-w-none font-normal leading-relaxed text-muted-foreground/85",
                isCompact
                  ? "text-xs"
                  : "max-w-2xl text-sm text-muted-foreground/90",
                resolvedOverviewLines,
              )}
            >
              {item.overview}
            </p>
          ) : null}
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
