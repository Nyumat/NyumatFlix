"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useFeatureFlags } from "@/components/providers/feature-flags-provider";
import { PlaybackStartingOverlay } from "@/components/media/controls/playback-starting-overlay";
import { ScrapingOverlay } from "@/components/media/controls/scraping-overlay";
import { PlaybackErrorBoundary } from "@/components/media/playback-error-boundary";
import { ScrapePlayerShell } from "@/components/media/scrape-player-shell";
import type { UseDirectPlaybackReturn } from "@/hooks/use-direct-movie-playback";
import type { UseAnimeScrapeReturn } from "@/hooks/use-anime-scrape";
import { useMoviPlayerLoaded } from "@/hooks/use-movi-player-loaded";
import { ANIME_PLAYBACK_RESOLVING_MESSAGE } from "@/lib/anime/anime-playback-policy";
import type { UseScrapeReturn } from "@/hooks/use-scrape";
import { selectInitialEngine } from "@nyumatflix/playback";
import type { PlayableManifest } from "@nyumatflix/playback";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { resolveHeroPlaybackOverlays } from "@/lib/playback/hero-playback-overlays";
import {
  toPlayableManifestFromDirect,
  toPlayableManifestFromScrape,
  type ScrapePlaybackPayload,
} from "@/lib/playback/to-playable-manifest";
import {
  PLAYBACK_STALL_FAILOVER_MS,
  PLAYBACK_START_TIMEOUT_MS,
} from "@/lib/playback/playbackStart";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import { isScrapeServer, type VideoServer } from "@/lib/stores/server-store";
import {
  isMoviPlayerMakingProgress,
  isScrapeVideoMakingProgress,
  type MoviHostElement,
} from "@/lib/player/player-playback-ready";

const PlaybackShell = dynamic(
  () =>
    import("@/components/media/playback-shell").then(
      (module) => module.PlaybackShell,
    ),
  { ssr: false, loading: () => null },
);

type HeroScrapePlayerPanelProps = {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"];
  scrapeResult: ScrapePlaybackPayload | null;
  playbackManifest?: PlayableManifest | null;
  scrapeError: string | null;
  activeProviderId: string | null;
  sourceOverlayItems: SourceOverlayItem[];
  playbackTitle: string;
  playbackPosterUrl: string | null;
  progressKey: PlaybackProgressKey | null;
  imdbId: string | null;
  isTv: boolean;
  onSelectEmbedServer: (serverId: string) => void;
  onSelectScrapeProvider?: (providerId: string) => void;
  onRetryAllScraping?: () => void;
  /** increments on every episode selection; callbacks from older generations are ignored. */
  playbackGeneration: number;
  onFatalError: (generation: number, started: boolean) => void;
  onPlaybackStallFailover?: (generation: number) => void;
  onDirectPlaybackExhausted?: (generation: number) => void;
  onEnded?: (generation: number) => Promise<boolean>;
  isDirectMode?: boolean;
  directPlayback?: UseDirectPlaybackReturn;
  onMediaReadyChange?: (generation: number, ready: boolean) => void;
  isResolvingEpisode?: boolean;
};

export function HeroScrapePlayerPanel({
  selectedServer,
  scrapeStatus,
  scrapeResult,
  playbackManifest,
  scrapeError,
  activeProviderId,
  sourceOverlayItems,
  playbackTitle,
  playbackPosterUrl,
  progressKey,
  imdbId,
  isTv,
  onSelectEmbedServer,
  onSelectScrapeProvider,
  onRetryAllScraping,
  playbackGeneration,
  onFatalError,
  onPlaybackStallFailover,
  onDirectPlaybackExhausted,
  onEnded,
  isDirectMode = false,
  directPlayback,
  onMediaReadyChange,
  isResolvingEpisode = false,
}: HeroScrapePlayerPanelProps) {
  const { maintenanceMode } = useFeatureFlags();
  const [mediaReady, setMediaReady] = useState(false);
  const [playbackStartError, setPlaybackStartError] = useState<string | null>(
    null,
  );
  const moviLoaded = useMoviPlayerLoaded();

  const resolvedManifest = useMemo((): PlayableManifest | null => {
    if (playbackManifest) {
      return playbackManifest;
    }

    if (isDirectMode && directPlayback?.activeStream) {
      return toPlayableManifestFromDirect(
        directPlayback.activeStream,
        directPlayback.rankedStreams,
      );
    }

    if (scrapeResult) {
      return toPlayableManifestFromScrape(
        {
          providerId: scrapeResult.providerId,
          providerName: scrapeResult.providerName,
          playUrl: scrapeResult.playUrl,
          streamKind: scrapeResult.streamKind,
          referer: scrapeResult.referer,
          qualities: scrapeResult.qualities,
          subtitles: scrapeResult.subtitles,
          audioVersions: scrapeResult.audioVersions,
          defaultAudioLang: scrapeResult.defaultAudioLang,
          defaultHardSubLang: scrapeResult.defaultHardSubLang,
          preferredAudioLang: scrapeResult.preferredAudioLang,
          directPlayback: scrapeResult.directPlayback,
          directFallbackUrl: scrapeResult.directFallbackUrl,
          directStreamName: scrapeResult.directStreamName,
          directFileName: scrapeResult.directFileName,
        },
        progressKey ?? undefined,
      );
    }

    return null;
  }, [
    directPlayback?.activeStream,
    directPlayback?.rankedStreams,
    isDirectMode,
    playbackManifest,
    progressKey,
    scrapeResult,
  ]);

  const playbackSessionKey = `${playbackGeneration}:${resolvedManifest?.id ?? "idle"}`;

  const onMediaReadyChangeRef = useRef(onMediaReadyChange);
  const onPlaybackStallFailoverRef = useRef(onPlaybackStallFailover);
  const onFatalErrorRef = useRef(onFatalError);
  const playbackGenerationRef = useRef(playbackGeneration);
  const mediaReadyRef = useRef(mediaReady);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  onMediaReadyChangeRef.current = onMediaReadyChange;
  onPlaybackStallFailoverRef.current = onPlaybackStallFailover;
  onFatalErrorRef.current = onFatalError;
  playbackGenerationRef.current = playbackGeneration;
  mediaReadyRef.current = mediaReady;

  useEffect(() => {
    setMediaReady(false);
    setPlaybackStartError(null);
    onMediaReadyChangeRef.current?.(playbackGenerationRef.current, false);
  }, [playbackSessionKey]);

  const directHasPlayer = Boolean(
    isDirectMode &&
      directPlayback &&
      (directPlayback.status === "playing" ||
        directPlayback.status === "loading") &&
      directPlayback.activeStream &&
      progressKey &&
      resolvedManifest,
  );

  const scrapeHasPlayer = Boolean(
    !isDirectMode &&
      resolvedManifest &&
      progressKey &&
      (scrapeStatus === "playing" || scrapeStatus === "scraping"),
  );

  const hasActivePlayer = directHasPlayer || scrapeHasPlayer;
  const overlays = resolveHeroPlaybackOverlays({
    isDirectMode,
    scrapeStatus,
    directStatus: directPlayback?.status,
    hasManifest: Boolean(resolvedManifest),
    mediaReady,
    isResolvingEpisode,
  });

  useEffect(() => {
    if (
      !hasActivePlayer ||
      mediaReady ||
      isDirectMode ||
      !onPlaybackStallFailover
    ) {
      return undefined;
    }

    const generation = playbackGenerationRef.current;
    const timeout = window.setTimeout(() => {
      const container = playerContainerRef.current;
      const moviPlayer = container?.querySelector("movi-player");
      if (
        moviPlayer &&
        isMoviPlayerMakingProgress(moviPlayer as MoviHostElement)
      ) {
        return;
      }
      if (isScrapeVideoMakingProgress(container)) {
        return;
      }
      onPlaybackStallFailoverRef.current?.(generation);
    }, PLAYBACK_STALL_FAILOVER_MS);

    return () => window.clearTimeout(timeout);
  }, [hasActivePlayer, isDirectMode, mediaReady, playbackSessionKey]);

  useEffect(() => {
    if (!hasActivePlayer || mediaReady || isDirectMode) {
      setPlaybackStartError(null);
      return undefined;
    }

    const generation = playbackGenerationRef.current;
    const timeout = window.setTimeout(() => {
      setPlaybackStartError("Playback didn't start in time.");
      onFatalErrorRef.current(generation, false);
    }, PLAYBACK_START_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [hasActivePlayer, isDirectMode, mediaReady, playbackSessionKey]);

  const handleMediaReady = useCallback(() => {
    if (playbackGenerationRef.current !== playbackGeneration) {
      return;
    }
    setMediaReady(true);
    onMediaReadyChange?.(playbackGeneration, true);
  }, [onMediaReadyChange, playbackGeneration]);

  const handlePlaybackFatalError = useCallback(() => {
    if (isDirectMode && onDirectPlaybackExhausted) {
      onDirectPlaybackExhausted(playbackGeneration);
      return;
    }
    onFatalError(playbackGeneration, mediaReadyRef.current);
  }, [
    isDirectMode,
    onDirectPlaybackExhausted,
    onFatalError,
    playbackGeneration,
  ]);

  const handlePlaybackStallFailover = useCallback(() => {
    onPlaybackStallFailover?.(playbackGeneration);
  }, [onPlaybackStallFailover, playbackGeneration]);

  const handlePlaybackEnded = useCallback(
    () => onEnded?.(playbackGeneration) ?? Promise.resolve(false),
    [onEnded, playbackGeneration],
  );

  if (!isScrapeServer(selectedServer)) {
    return null;
  }

  const maintenanceBanner = maintenanceMode ? (
    <div className="absolute inset-x-0 top-0 z-40 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100 backdrop-blur-sm">
      Playback is temporarily unavailable while maintenance is in progress.
    </div>
  ) : null;

  const showResolvingOverlay = isResolvingEpisode && scrapeStatus === "idle";
  const showDiscoveryOverlay = overlays.showDiscoveryOverlay;
  const showBufferingOverlay = overlays.showBufferingOverlay;
  const showErrorOverlay = overlays.showErrorOverlay;
  const overlayError = isDirectMode
    ? (directPlayback?.error ?? scrapeError)
    : scrapeError;

  const directEngine = directPlayback?.activeStream
    ? selectInitialEngine(directPlayback.activeStream)
    : null;
  const startingMessage =
    directEngine === "movi" && !moviLoaded
      ? "Loading video decoder…"
      : directEngine === "vidstack-hls"
        ? "Starting transcode…"
        : "Starting playback…";

  return (
    <>
      {maintenanceBanner}

      {showResolvingOverlay ? (
        <PlaybackStartingOverlay message={ANIME_PLAYBACK_RESOLVING_MESSAGE} />
      ) : null}

      {hasActivePlayer && resolvedManifest && progressKey ? (
        <div
          key={playbackGeneration}
          ref={playerContainerRef}
          className="h-full w-full"
        >
          <PlaybackErrorBoundary onClose={handlePlaybackFatalError}>
            <PlaybackShell
              manifest={resolvedManifest}
              title={playbackTitle}
              poster={playbackPosterUrl}
              progressKey={progressKey}
              imdbId={imdbId}
              isTv={isTv}
              className="h-full w-full"
              onFatalError={handlePlaybackFatalError}
              onMediaReady={handleMediaReady}
              onPlaybackStallFailover={
                onPlaybackStallFailover
                  ? handlePlaybackStallFailover
                  : undefined
              }
              onEnded={isTv && onEnded ? handlePlaybackEnded : undefined}
            />
          </PlaybackErrorBoundary>
        </div>
      ) : null}

      {showDiscoveryOverlay ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={isDirectMode ? "direct" : activeProviderId}
          error={overlayError}
          onSelectEmbedServer={onSelectEmbedServer}
          onSelectScrapeProvider={onSelectScrapeProvider}
        />
      ) : null}

      {showBufferingOverlay ? (
        <PlaybackStartingOverlay
          message={
            playbackStartError
              ? "Trying another source…"
              : isDirectMode
                ? startingMessage
                : "Starting playback…"
          }
          error={playbackStartError}
        />
      ) : null}

      {showErrorOverlay ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={isDirectMode ? "direct" : activeProviderId}
          error={overlayError}
          onSelectEmbedServer={onSelectEmbedServer}
          onSelectScrapeProvider={onSelectScrapeProvider}
          onRetryAll={onRetryAllScraping}
        />
      ) : null}
    </>
  );
}

export function HeroEmbedPlayerPanel({
  videoSrc,
  iframeKey,
}: {
  videoSrc: string;
  iframeKey: string;
}) {
  if (!videoSrc) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[1.35rem] bg-transparent text-sm text-muted-foreground">
        Loading stream...
      </div>
    );
  }

  return (
    <iframe
      key={iframeKey}
      src={videoSrc}
      className="absolute inset-0 h-full w-full rounded-[1.15rem] bg-black"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  );
}

export function HeroPlaybackShell({
  selectedServer,
  scrapeStatus,
  playbackBackdropUrl,
  mediaReady = false,
  hasPlaybackManifest = false,
  isPlaybackBuffering = false,
  isDirectMode = false,
  directStatus,
  children,
}: {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"] | UseAnimeScrapeReturn["status"];
  playbackBackdropUrl: string | null;
  mediaReady?: boolean;
  hasPlaybackManifest?: boolean;
  isPlaybackBuffering?: boolean;
  isDirectMode?: boolean;
  directStatus?: UseDirectPlaybackReturn["status"];
  children: ReactNode;
}) {
  const overlays = resolveHeroPlaybackOverlays({
    isDirectMode,
    scrapeStatus,
    directStatus,
    hasManifest: hasPlaybackManifest || isPlaybackBuffering,
    mediaReady,
  });

  return (
    <ScrapePlayerShell
      backdropUrl={playbackBackdropUrl}
      blurBackdrop={isScrapeServer(selectedServer) && overlays.blurBackdrop}
      hideBackdrop={isScrapeServer(selectedServer) && overlays.hideBackdrop}
    >
      {children}
    </ScrapePlayerShell>
  );
}
