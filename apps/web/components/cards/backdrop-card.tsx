"use client";

import { BackdropCardCaption } from "@/components/cards/backdrop-card-caption";
import { VideasyStreamVideo } from "@/components/hero/videasy-stream-video";
import { useHoverSound } from "@/components/providers/hover-sound-provider";
import { MediaLogo } from "@/components/media/media-display";
import { useCardHoverPreview } from "@/hooks/use-card-hover-preview";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import { useOpenMediaPeek } from "@/hooks/use-open-media-peek";
import {
  buildCardHoverPreviewId,
  readImdbIdForPreview,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import {
  getBackdropPath,
  getDisplayTitle,
  getHref,
  getPosterPath,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { useCardHoverPreviewContext } from "@/components/providers/card-hover-preview-provider";
import { Icons } from "@/lib/icons";
import { resolveMediaPeekTarget } from "@/lib/peek/media-peek-target";
import useMedia from "@/hooks/useMedia";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { Pause, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

const isExternalHref = (href: string) =>
  /^https?:\/\//i.test(href) || href.includes("anilist.co");

type BackdropCardProps = {
  item: CanonicalMediaCard | MediaItem;
  isMobile?: boolean;
  href?: string;
  hideTitleFallback?: boolean;
  frameOverlay?: ReactNode;
  className?: string;
};

export function BackdropCard({
  item,
  isMobile,
  href,
  hideTitleFallback,
  frameOverlay,
  className,
}: BackdropCardProps) {
  const title = getDisplayTitle(item);
  const link = href || getHref(item);
  const detectedMobile = useMedia("(max-width: 768px)", false);
  const isMobileDevice = isMobile ?? !!detectedMobile;
  const isInteractive = !isMobileDevice;
  const catalogCardStyle = useCatalogCardStyle();
  const posterPath = getPosterPath(item) ?? undefined;
  const backdropPath = getBackdropPath(item);
  const imageUrl = backdropPath
    ? tmdbImage.backdrop(backdropPath, "w780")
    : posterPath
      ? tmdbImage.poster(posterPath, "w780")
      : undefined;
  const imdbId = readImdbIdForPreview(item);
  const previewId = buildCardHoverPreviewId({
    mediaType: item.media_type,
    id: item.id ?? "unknown",
  });
  const { activePreviewId } = useCardHoverPreviewContext();
  const isActivePreview = activePreviewId === previewId;

  const { prefetch, schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    item,
    link,
  );
  const playHoverSound = useHoverSound();
  const openMediaPeek = useOpenMediaPeek();
  const peekItem = item as Parameters<typeof resolveMediaPeekTarget>[0];

  const {
    isPreviewPlaying,
    isUnmuted,
    toggleUnmute,
    mp4Url,
    hlsUrl,
    handleStreamError,
    onPointerEnter: onPreviewEnter,
    onPointerLeave: onPreviewLeave,
  } = useCardHoverPreview({
    previewId,
    imdbId,
    catalogCardStyle,
  });

  const handlePeekActivate = (event: MouseEvent | KeyboardEvent) => {
    openMediaPeek(event, peekItem, link);
  };

  const handlePeekKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    handlePeekActivate(event);
  };

  const handleIntent = () => {
    schedulePrefetch();
    playHoverSound?.();
    onPreviewEnter();
  };

  const handleLeave = () => {
    cancelPrefetch();
    onPreviewLeave();
  };

  const cardLink = isExternalHref(link) ? (
    <a
      href={link}
      className="absolute inset-0 z-40 cursor-pointer rounded-lg"
      aria-label={`View ${title}`}
      target="_blank"
      rel="noopener noreferrer"
    />
  ) : (
    <button
      type="button"
      className="absolute inset-0 z-40 cursor-pointer rounded-lg"
      aria-label={`View ${title}`}
      onClick={handlePeekActivate}
      onKeyDown={handlePeekKeyDown}
    />
  );

  const showVideo =
    isActivePreview && isPreviewPlaying && Boolean(mp4Url || hlsUrl);

  return (
    <div
      className={cn("group flex w-full flex-col gap-2", className)}
      onPointerEnter={handleIntent}
      onPointerLeave={handleLeave}
      onTouchStart={prefetch}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden rounded-lg border border-white/12 bg-card/40 shadow-lg shadow-black/10 ring-1 ring-white/8 backdrop-blur-md",
          isInteractive &&
            "transition-all duration-300 hover:border-primary/40 hover:shadow-xl",
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title || "Backdrop"}
            fill
            className={cn(
              "object-cover transition-transform duration-500",
              isInteractive && "group-hover:scale-[1.03]",
              showVideo && "opacity-0",
            )}
            sizes="(max-width: 768px) 85vw, 28vw"
          />
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5" />
        )}

        {showVideo ? (
          <VideasyStreamVideo
            mp4Url={mp4Url}
            hlsUrl={hlsUrl}
            playback="ambient"
            className="absolute inset-0 size-full object-cover"
            isMuted={!isUnmuted}
            onError={handleStreamError}
          />
        ) : null}

        {frameOverlay}

        {isInteractive && imdbId && catalogCardStyle === "backdrop" ? (
          <button
            type="button"
            className={cn(
              "absolute top-2 right-2 z-50 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100",
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

        {isInteractive ? (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            {showVideo ? (
              <Pause
                className="size-10 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] opacity-80"
                strokeWidth={1.5}
              />
            ) : (
              <Icons.play
                className="size-10 scale-90 text-white opacity-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
                strokeWidth={1.5}
              />
            )}
          </div>
        ) : null}

        {cardLink}
      </div>

      <div className="pointer-events-none min-w-0 space-y-1.5">
        {item.logo?.file_path ? (
          <MediaLogo
            logo={item.logo}
            align="left"
            className="max-h-8 w-full"
            title={
              hideTitleFallback && item.logo?.file_path ? undefined : title
            }
            fallbackClassName="line-clamp-2 text-sm font-normal leading-snug text-white"
          />
        ) : null}
        <BackdropCardCaption
          item={item}
          hideTitle={Boolean(item.logo?.file_path)}
        />
      </div>
    </div>
  );
}
