"use client";

import { MarkContinueWatchingCompleteControl } from "@/components/home/mark-continue-watching-complete-control";
import { useHoverSound } from "@/components/providers/hover-sound-provider";
import { VideasyStreamVideo } from "@/components/hero/videasy-stream-video";
import { useCardHoverPreview } from "@/hooks/use-card-hover-preview";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import { useTrailerPrefetch } from "@/hooks/use-trailer-prefetch";
import { EpisodeIndicator } from "@/components/watchlist/watchlist";
import { Icons } from "@/lib/icons";
import {
  buildCardHoverPreviewId,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import { useCardHoverPreviewContext } from "@/components/providers/card-hover-preview-provider";
import type { EpisodeInfo } from "@/lib/domain/episodes";
import type { MediaItem } from "@/lib/domain/typings";
import type { RecentlyWatchedItem } from "@/lib/playback/recently-watched";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { Pause, Star, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";

export interface RecentlyWatchedCardProps {
  item: RecentlyWatchedItem;
  priority?: boolean;
  isMarkCompletePending?: boolean;
  onMarkComplete?: () => void | Promise<void>;
  showProgress?: boolean;
  playAriaLabel?: string;
  episodeInfo?: EpisodeInfo | null;
}

const continueWatchingProgressFillClass =
  "bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.55)]";
const continueWatchingProgressFallbackFillClass = "bg-pink-500/45";
const continueWatchingProgressTrackClass = "bg-white/15";

const Dot = () => (
  <span className="text-white/35" aria-hidden>
    ·
  </span>
);

export function RecentlyWatchedCard({
  item,
  priority = false,
  isMarkCompletePending = false,
  onMarkComplete,
  showProgress = true,
  playAriaLabel,
  episodeInfo = null,
}: RecentlyWatchedCardProps) {
  const playHoverSound = useHoverSound();
  const catalogCardStyle = useCatalogCardStyle();
  const previewId = buildCardHoverPreviewId({
    mediaType: item.mediaType,
    id: item.contentId,
  });
  const { activePreviewId } = useCardHoverPreviewContext();
  const isActivePreview = activePreviewId === previewId;
  const mediaRef = useRef<HTMLDivElement | null>(null);
  const previewSource = item.imdbId
    ? ({ kind: "stream", imdbId: item.imdbId } as const)
    : undefined;

  const {
    isPreviewPlaying,
    isPreviewEligible,
    isTrailerAvailable,
    isUnmuted,
    toggleUnmute,
    mp4Url,
    hlsUrl,
    handleStreamError,
    onPointerEnter: onPreviewEnter,
    onPointerLeave: onPreviewLeave,
  } = useCardHoverPreview({
    previewId,
    previewSource,
    catalogCardStyle,
  });

  useTrailerPrefetch(mediaRef, previewSource, isPreviewEligible);

  const showVideo =
    isActivePreview && isPreviewPlaying && Boolean(mp4Url || hlsUrl);

  const prefetchItem = {
    id: item.contentId,
    media_type: item.mediaType,
    title: item.title,
  } satisfies Pick<MediaItem, "id" | "media_type" | "title">;
  const { schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    prefetchItem as MediaItem,
    item.href,
  );

  const isPosterStyle = catalogCardStyle === "poster";
  const imagePath = isPosterStyle
    ? (item.posterPath ?? item.backdropPath)
    : (item.backdropPath ?? item.posterPath);
  const imageUrl = imagePath
    ? isPosterStyle
      ? tmdbImage.poster(imagePath, "w342")
      : tmdbImage.backdrop(imagePath, "w780")
    : undefined;
  const imageSrcSet = imagePath
    ? isPosterStyle
      ? tmdbImage.posterSrcSet(imagePath)
      : tmdbImage.backdropSrcSet(imagePath)
    : undefined;

  const episodeLabel =
    item.mediaType === "tv" && item.seasonNumber && item.episodeNumber
      ? `S${item.seasonNumber} · E${item.episodeNumber}`
      : null;

  const rating =
    item.voteAverage != null && item.voteAverage > 0
      ? item.voteAverage.toFixed(1)
      : null;

  const showMeta = Boolean(episodeLabel || item.year || rating);

  const progressPercent =
    item.progressRatio != null ? Math.round(item.progressRatio * 100) : null;

  return (
    <div
      className="group flex w-full select-none flex-col gap-2"
      onPointerEnter={() => {
        playHoverSound?.();
        onPreviewEnter();
        schedulePrefetch();
      }}
      onPointerLeave={() => {
        onPreviewLeave();
        cancelPrefetch();
      }}
      onTouchStart={schedulePrefetch}
    >
      <div
        ref={mediaRef}
        className={cn(
          "relative overflow-hidden rounded-lg border border-white/12 bg-card/40 shadow-lg shadow-black/10 ring-1 ring-white/8 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:shadow-xl",
          isPosterStyle ? "aspect-2/3" : "aspect-video",
        )}
      >
        {imageUrl ? (
          imageSrcSet ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet}
              sizes={
                isPosterStyle
                  ? "(max-width: 640px) 44vw, (max-width: 768px) 32vw, 20vw"
                  : "(max-width: 768px) 85vw, 28vw"
              }
              alt={item.title}
              className={cn(
                "pointer-events-none absolute inset-0 size-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03]",
                showVideo && "opacity-0",
              )}
              draggable={false}
              fetchPriority={priority ? "high" : undefined}
            />
          ) : (
            <Image
              src={imageUrl}
              alt={item.title}
              fill
              className={cn(
                "pointer-events-none object-cover transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03]",
                showVideo && "opacity-0",
              )}
              sizes={
                isPosterStyle
                  ? "(max-width: 640px) 44vw, (max-width: 768px) 32vw, 20vw"
                  : "(max-width: 768px) 85vw, 28vw"
              }
              draggable={false}
              priority={priority}
            />
          )
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-pink-500/20 to-pink-500/5" />
        )}

        {showVideo ? (
          <VideasyStreamVideo
            mp4Url={mp4Url}
            hlsUrl={hlsUrl}
            playback="ambient"
            className="absolute inset-0 size-full animate-card-preview-in object-cover"
            isMuted={!isUnmuted}
            onError={handleStreamError}
          />
        ) : null}

        {isTrailerAvailable && catalogCardStyle === "backdrop" ? (
          <button
            type="button"
            className={cn(
              "absolute top-2 left-2 z-50 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100",
              showVideo && "opacity-100",
            )}
            aria-label={isUnmuted ? "Mute preview" : "Unmute preview"}
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              toggleUnmute();
            }}
          >
            {isUnmuted ? (
              <Volume2 className="size-4" />
            ) : (
              <VolumeX className="size-4" />
            )}
          </button>
        ) : null}

        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          {showVideo ? (
            <Pause
              className="size-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] opacity-80 sm:size-12"
              strokeWidth={1.5}
            />
          ) : (
            <Icons.play
              className="size-10 scale-90 text-white opacity-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-100 sm:size-12 md:opacity-0 md:group-hover:opacity-100"
              strokeWidth={1.5}
            />
          )}
        </div>

        {onMarkComplete ? (
          <MarkContinueWatchingCompleteControl
            className="absolute top-2 right-2"
            title={item.title}
            isPending={isMarkCompletePending}
            onConfirm={onMarkComplete}
          />
        ) : null}

        {showProgress ? (
          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1",
              continueWatchingProgressTrackClass,
            )}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent ?? undefined}
            aria-label={
              progressPercent != null
                ? `${progressPercent}% watched`
                : "Watch progress unavailable"
            }
          >
            <div
              className={cn(
                "h-full rounded-r-full transition-[width] duration-500",
                progressPercent == null
                  ? cn("w-[6%]", continueWatchingProgressFallbackFillClass)
                  : continueWatchingProgressFillClass,
              )}
              style={
                progressPercent != null
                  ? { width: `${Math.max(progressPercent, 2)}%` }
                  : undefined
              }
            />
          </div>
        ) : null}

        <Link
          href={item.href}
          className="absolute inset-0 z-40 cursor-pointer rounded-lg"
          aria-label={playAriaLabel ?? `Continue watching ${item.title}`}
          prefetch={true}
        />
      </div>

      <div className="pointer-events-none min-w-0 space-y-1 px-0.5">
        <p className="line-clamp-2 text-sm font-normal leading-snug text-white">
          {item.title}
        </p>
        {showMeta ? (
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-normal text-white/70">
            {episodeLabel ? (
              <span className="font-medium text-white/85">{episodeLabel}</span>
            ) : null}
            {episodeLabel && (item.year || rating) ? <Dot /> : null}
            {item.year ? <span>{item.year}</span> : null}
            {item.year && rating ? <Dot /> : null}
            {rating ? (
              <span className="inline-flex items-center gap-1">
                <Star
                  className="size-3 shrink-0 fill-pink-500 text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.55)]"
                  aria-hidden
                />
                {rating}
              </span>
            ) : null}
          </p>
        ) : null}
        {episodeInfo && item.mediaType === "tv" ? (
          <div className="pointer-events-none pt-0.5">
            <EpisodeIndicator
              contentId={item.contentId}
              mediaType="tv"
              episodeInfo={episodeInfo}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
