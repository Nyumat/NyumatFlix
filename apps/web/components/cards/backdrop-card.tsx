"use client";

import { BackdropCardCaption } from "@/components/cards/backdrop-card-caption";
import { VideasyStreamVideo } from "@/components/hero/videasy-stream-video";
import { useHoverSound } from "@/components/providers/hover-sound-provider";
import { MediaLogo } from "@/components/media/media-display";
import { useCardHoverPreview } from "@/hooks/use-card-hover-preview";
import { useTrailerPrefetch } from "@/hooks/use-trailer-prefetch";
import { useMediaCardPrefetch } from "@/hooks/use-media-card-prefetch";
import { useOpenMediaPeek } from "@/hooks/use-open-media-peek";
import {
  buildCardHoverPreviewId,
  readCardPreviewSource,
  useCatalogCardStyle,
} from "@/lib/catalog-card-presentation";
import {
  hideYouTubeHoverPreview,
  setYouTubeHoverPreviewMuted,
  showYouTubeHoverPreview,
  updateYouTubeHoverPreviewRect,
} from "@/lib/youtube/hover-preview-store";
import {
  getBackdropPath,
  getDisplayTitle,
  getHref,
  getPosterPath,
  hasLocalizedCatalogBackdrop,
  isAnimeHubCatalogCard,
} from "@/lib/cards/selectors";
import type { CanonicalMediaCard, MediaItem } from "@/lib/domain/typings";
import { useCardHoverPreviewContext } from "@/components/providers/card-hover-preview-provider";
import { resolveMediaPeekTarget } from "@/lib/peek/media-peek-target";
import useMedia from "@/hooks/useMedia";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/tmdb/utils";
import { Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";

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
  const animeHubCatalogCard = isAnimeHubCatalogCard(item);
  const hasLocalizedArt = hasLocalizedCatalogBackdrop(item);
  const showCardLogoBelow =
    !animeHubCatalogCard && !hasLocalizedArt && Boolean(item.logo?.file_path);
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
  const imageSrcSet = backdropPath
    ? tmdbImage.backdropSrcSet(backdropPath)
    : posterPath
      ? tmdbImage.posterSrcSet(posterPath)
      : undefined;
  const previewSource = readCardPreviewSource(item);
  const previewId = buildCardHoverPreviewId({
    mediaType: item.media_type,
    id: item.id ?? "unknown",
  });
  const { activePreviewId } = useCardHoverPreviewContext();
  const isActivePreview = activePreviewId === previewId;
  const mediaRef = useRef<HTMLDivElement | null>(null);

  const { prefetch, schedulePrefetch, cancelPrefetch } = useMediaCardPrefetch(
    item,
    link,
  );
  const playHoverSound = useHoverSound();
  const openMediaPeek = useOpenMediaPeek();
  const peekItem = item as Parameters<typeof resolveMediaPeekTarget>[0];

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

  useTrailerPrefetch(
    mediaRef,
    previewSource,
    isPreviewEligible && !isMobileDevice,
  );

  const youtubeKey =
    previewSource?.kind === "youtube" ? previewSource.youtubeKey : undefined;
  const isYouTubePreviewActive = isActivePreview && Boolean(youtubeKey);

  useEffect(() => {
    if (!isYouTubePreviewActive || !youtubeKey) {
      hideYouTubeHoverPreview(previewId);
      return;
    }

    const publishRect = () => {
      const el = mediaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      updateYouTubeHoverPreviewRect(previewId, {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };

    const el = mediaRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      showYouTubeHoverPreview({
        id: previewId,
        youtubeKey,
        muted: !isUnmuted,
        playing: false,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      });
    }

    window.addEventListener("scroll", publishRect, true);
    window.addEventListener("resize", publishRect);
    return () => {
      window.removeEventListener("scroll", publishRect, true);
      window.removeEventListener("resize", publishRect);
      hideYouTubeHoverPreview(previewId);
    };
  }, [isYouTubePreviewActive, youtubeKey, previewId]);

  useEffect(() => {
    if (!isYouTubePreviewActive) return;
    setYouTubeHoverPreviewMuted(previewId, !isUnmuted);
  }, [isYouTubePreviewActive, isUnmuted, previewId]);

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

  const showStreamVideo =
    isActivePreview && isPreviewPlaying && Boolean(mp4Url || hlsUrl);
  const isVideoPresented = showStreamVideo || isYouTubePreviewActive;

  return (
    <div
      className={cn(
        "group flex w-full cursor-pointer flex-col gap-2",
        className,
      )}
      onPointerEnter={handleIntent}
      onPointerLeave={handleLeave}
      onTouchStart={prefetch}
    >
      <div
        ref={mediaRef}
        className={cn(
          "relative aspect-video overflow-hidden rounded-lg border border-white/12 bg-card/70 shadow-lg shadow-black/10 ring-1 ring-white/8 backdrop-blur-sm max-lg:backdrop-blur-none",
          isInteractive &&
            "transition-all duration-300 hover:border-primary/40 hover:shadow-xl",
        )}
      >
        {imageUrl ? (
          imageSrcSet ? (
            <img
              src={imageUrl}
              srcSet={imageSrcSet}
              sizes="(max-width: 768px) 85vw, 28vw"
              alt={title || "Backdrop"}
              className={cn(
                "absolute inset-0 size-full object-cover",
                isInteractive &&
                  "transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03]",
              )}
              loading={isMobileDevice ? "eager" : undefined}
            />
          ) : (
            <Image
              src={imageUrl}
              alt={title || "Backdrop"}
              fill
              className={cn(
                "object-cover",
                isInteractive &&
                  "transition-[opacity,transform] duration-500 ease-out group-hover:scale-[1.03]",
              )}
              loading={isMobileDevice ? "eager" : undefined}
              sizes="(max-width: 768px) 85vw, 28vw"
            />
          )
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-primary/20 to-primary/5" />
        )}

        {showStreamVideo ? (
          <VideasyStreamVideo
            mp4Url={mp4Url}
            hlsUrl={hlsUrl}
            playback="ambient"
            className="absolute inset-0 size-full animate-card-preview-in object-cover"
            isMuted={!isUnmuted}
            onError={handleStreamError}
          />
        ) : null}

        {frameOverlay}

        {isInteractive &&
        isTrailerAvailable &&
        catalogCardStyle === "backdrop" ? (
          <button
            type="button"
            className={cn(
              "absolute top-2 right-2 z-50 flex size-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white opacity-0 shadow-lg backdrop-blur-md transition-opacity duration-200 hover:bg-black/70 group-hover:opacity-100",
              isVideoPresented && "opacity-100",
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

        {cardLink}
      </div>

      <div className="pointer-events-none min-w-0 space-y-1.5">
        {showCardLogoBelow ? (
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
        <BackdropCardCaption item={item} hideTitle={showCardLogoBelow} />
      </div>
    </div>
  );
}
