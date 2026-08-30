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
import { useMoviPreview } from "@/hooks/use-movi-preview";
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
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { USE_SHAKA_DASH } from "@/lib/constants";
import {
  PLAYBACK_STALL_FAILOVER_MS,
  PLAYBACK_START_TIMEOUT_MS,
} from "@/lib/playback/playbackStart";
import { buildScrapePlayerKey } from "@/lib/scrape/player-sources";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { isScrapeServer, type VideoServer } from "@/lib/stores/server-store";

const DirectStreamPlayer = dynamic(
  () =>
    import("@/components/media/direct-stream-player").then(
      (module) => module.DirectStreamPlayer,
    ),
  { ssr: false, loading: () => null },
);

const CalluspiratesStreamPlayer = dynamic(
  () =>
    import("@/components/media/calluspirates-stream-player").then(
      (module) => module.CalluspiratesStreamPlayer,
    ),
  { ssr: false, loading: () => null },
);

const MoviScrapePlayer = dynamic(
  () =>
    import("@/components/media/movi-scrape-player").then(
      (module) => module.MoviScrapePlayer,
    ),
  { ssr: false, loading: () => null },
);

const MoviDirectPlayer = dynamic(
  () =>
    import("@/components/media/movi-direct-player").then(
      (module) => module.MoviDirectPlayer,
    ),
  { ssr: false, loading: () => null },
);

const ScrapeHlsPlayer = dynamic(
  () =>
    import("@/components/media/scrape-hls-player").then(
      (module) => module.ScrapeHlsPlayer,
    ),
  { ssr: false, loading: () => null },
);

const ScrapeShakaDashPlayer = dynamic(
  () =>
    import("@/components/media/scrape-shaka-dash-player").then(
      (module) => module.ScrapeShakaDashPlayer,
    ),
  { ssr: false, loading: () => null },
);

type HeroScrapePlayerPanelProps = {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"];
  scrapeResult: {
    providerId?: string;
    playUrl: string;
    directPlayback?: "hls" | "direct" | "extended";
    directFallbackUrl?: string;
    directStreamName?: string;
    directFileName?: string;
    qualities?: ScrapeQuality[];
    subtitles?: ScrapeSubtitle[];
    audioVersions?: ScrapeAudioVersion[];
    defaultAudioLang?: string;
    defaultHardSubLang?: string;
    referer?: string;
    preferredAudioLang?: string;
  } | null;
  scrapeError: string | null;
  activeProviderId: string | null;
  sourceOverlayItems: SourceOverlayItem[];
  playbackTitle: string;
  playbackPosterUrl: string | null;
  progressKey: PlaybackProgressKey | null;
  imdbId: string | null;
  streamKind: StreamKind;
  isTv: boolean;
  onSelectEmbedServer: (serverId: string) => void;
  onRetryAllScraping?: () => void;
  onFatalError: () => void;
  onPlaybackStallFailover?: () => void;
  onDirectPlaybackExhausted?: () => void;
  onEnded?: () => Promise<boolean>;
  isDirectMode?: boolean;
  directPlayback?: UseDirectPlaybackReturn;
  onMediaReadyChange?: (ready: boolean) => void;
  isResolvingEpisode?: boolean;
};

export function HeroScrapePlayerPanel({
  selectedServer,
  scrapeStatus,
  scrapeResult,
  scrapeError,
  activeProviderId,
  sourceOverlayItems,
  playbackTitle,
  playbackPosterUrl,
  progressKey,
  imdbId,
  streamKind,
  isTv,
  onSelectEmbedServer,
  onRetryAllScraping,
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
  const moviPreview = useMoviPreview();
  const [mediaReady, setMediaReady] = useState(false);
  const [playbackStartError, setPlaybackStartError] = useState<string | null>(
    null,
  );
  const moviLoaded = useMoviPlayerLoaded();

  const playbackSessionKey = useMemo(() => {
    if (isDirectMode && directPlayback?.activeStream) {
      return `direct:${directPlayback.activeStream.hash}:${directPlayback.streamIndex}`;
    }
    if (scrapeResult?.playUrl) {
      return `scrape:${scrapeResult.providerId ?? "unknown"}:${scrapeResult.playUrl}`;
    }
    return "idle";
  }, [
    directPlayback?.activeStream,
    directPlayback?.streamIndex,
    isDirectMode,
    scrapeResult?.playUrl,
    scrapeResult?.providerId,
  ]);

  const onMediaReadyChangeRef = useRef(onMediaReadyChange);
  const onPlaybackStallFailoverRef = useRef(onPlaybackStallFailover);
  const onFatalErrorRef = useRef(onFatalError);
  onMediaReadyChangeRef.current = onMediaReadyChange;
  onPlaybackStallFailoverRef.current = onPlaybackStallFailover;
  onFatalErrorRef.current = onFatalError;

  useEffect(() => {
    setMediaReady(false);
    setPlaybackStartError(null);
    onMediaReadyChangeRef.current?.(false);
  }, [playbackSessionKey]);

  const directHasPlayer = (() => {
    if (!isDirectMode || !directPlayback) {
      return false;
    }

    return (
      directPlayback.status === "playing" &&
      Boolean(directPlayback.activeStream) &&
      Boolean(progressKey)
    );
  })();

  const scrapeHasPlayer =
    !isDirectMode &&
    scrapeStatus === "playing" &&
    Boolean(scrapeResult?.playUrl) &&
    Boolean(progressKey);

  const hasActivePlayer = directHasPlayer || scrapeHasPlayer;

  useEffect(() => {
    if (
      !hasActivePlayer ||
      mediaReady ||
      isDirectMode ||
      !onPlaybackStallFailover
    ) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      onPlaybackStallFailoverRef.current?.();
    }, PLAYBACK_STALL_FAILOVER_MS);

    return () => window.clearTimeout(timeout);
  }, [hasActivePlayer, isDirectMode, mediaReady, playbackSessionKey]);

  useEffect(() => {
    if (!hasActivePlayer || mediaReady) {
      setPlaybackStartError(null);
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setPlaybackStartError("Playback didn't start in time.");
      onFatalErrorRef.current();
    }, PLAYBACK_START_TIMEOUT_MS);

    return () => window.clearTimeout(timeout);
  }, [hasActivePlayer, mediaReady, playbackSessionKey]);

  const handleMediaReady = useCallback(() => {
    setMediaReady(true);
    onMediaReadyChange?.(true);
  }, [onMediaReadyChange]);

  if (!isScrapeServer(selectedServer)) {
    return null;
  }

  const maintenanceBanner = maintenanceMode ? (
    <div className="absolute inset-x-0 top-0 z-40 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100 backdrop-blur-sm">
      Playback is temporarily unavailable while maintenance is in progress.
    </div>
  ) : null;

  if (isDirectMode && directPlayback) {
    const directStatus = directPlayback.status;
    const directError = directPlayback.error ?? scrapeError;
    const isDiscovering = directStatus === "loading" || directStatus === "idle";
    const hasPlayer =
      directStatus === "playing" &&
      Boolean(directPlayback.activeStream) &&
      Boolean(progressKey);
    const showDiscoveryOverlay = isDiscovering;
    const showBufferingOverlay = hasPlayer && !mediaReady;
    const showErrorOverlay = directStatus === "error";
    const directEngine = directPlayback.activeStream
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

        {hasPlayer && progressKey && directPlayback.activeStream ? (
          <PlaybackErrorBoundary onClose={onFatalError}>
            {moviPreview ? (
              <MoviDirectPlayer
                key={`movi-direct:${directPlayback.activeStream.hash}:${directPlayback.streamIndex}`}
                stream={directPlayback.activeStream}
                candidates={directPlayback.rankedStreams}
                title={playbackTitle}
                poster={playbackPosterUrl}
                progressKey={progressKey}
                className="h-full w-full"
                onStreamFailed={onDirectPlaybackExhausted ?? onFatalError}
                onMediaReady={handleMediaReady}
                onEnded={isTv ? onEnded : undefined}
              />
            ) : (
              <CalluspiratesStreamPlayer
                key={`${directPlayback.activeStream.hash}:${directPlayback.streamIndex}`}
                stream={directPlayback.activeStream}
                candidates={directPlayback.rankedStreams}
                title={playbackTitle}
                poster={playbackPosterUrl}
                progressKey={progressKey}
                className="h-full w-full"
                onStreamFailed={onDirectPlaybackExhausted ?? onFatalError}
                onMediaReady={handleMediaReady}
                onEnded={isTv ? onEnded : undefined}
              />
            )}
          </PlaybackErrorBoundary>
        ) : null}

        {showDiscoveryOverlay ? (
          <ScrapingOverlay
            items={sourceOverlayItems}
            activeProviderId="direct"
            error={directError}
            onSelectEmbedServer={onSelectEmbedServer}
          />
        ) : null}

        {showBufferingOverlay ? (
          <PlaybackStartingOverlay
            message={
              playbackStartError ? "Trying another source…" : startingMessage
            }
            error={playbackStartError}
          />
        ) : null}

        {showErrorOverlay ? (
          <ScrapingOverlay
            items={sourceOverlayItems}
            activeProviderId="direct"
            error={directError}
            onSelectEmbedServer={onSelectEmbedServer}
            onRetryAll={onRetryAllScraping}
          />
        ) : null}
      </>
    );
  }

  const isDiscovering = scrapeStatus === "scraping";
  const hasPlayer =
    scrapeStatus === "playing" &&
    Boolean(scrapeResult?.playUrl) &&
    Boolean(progressKey);
  const showDiscoveryOverlay = isDiscovering && !isResolvingEpisode;
  const showResolvingOverlay = isResolvingEpisode && scrapeStatus === "idle";
  const showBufferingOverlay = hasPlayer && !mediaReady;
  const showErrorOverlay = scrapeStatus === "error";

  return (
    <>
      {maintenanceBanner}

      {showResolvingOverlay ? (
        <PlaybackStartingOverlay message={ANIME_PLAYBACK_RESOLVING_MESSAGE} />
      ) : null}

      {hasPlayer && scrapeResult?.playUrl && progressKey ? (
        scrapeResult.providerId === "direct" && scrapeResult.directPlayback ? (
          <PlaybackErrorBoundary onClose={onFatalError}>
            <DirectStreamPlayer
              key={buildScrapePlayerKey({
                playUrl: scrapeResult.playUrl,
                qualities: scrapeResult.qualities,
                subtitles: scrapeResult.subtitles,
                audioVersions: scrapeResult.audioVersions,
                progressKey,
              })}
              mediaUrl={scrapeResult.playUrl}
              fallbackUrl={scrapeResult.directFallbackUrl}
              playback={scrapeResult.directPlayback}
              streamName={scrapeResult.directStreamName}
              fileName={scrapeResult.directFileName}
              qualities={scrapeResult.qualities}
              referer={scrapeResult.referer}
              subtitles={scrapeResult.subtitles}
              audioVersions={scrapeResult.audioVersions}
              defaultAudioLang={scrapeResult.defaultAudioLang}
              defaultHardSubLang={scrapeResult.defaultHardSubLang}
              preferredAudioLang={scrapeResult.preferredAudioLang}
              title={playbackTitle}
              poster={playbackPosterUrl}
              progressKey={progressKey}
              imdbId={imdbId}
              className="h-full w-full"
              onFatalError={onFatalError}
              onMediaReady={handleMediaReady}
              onEnded={isTv ? onEnded : undefined}
            />
          </PlaybackErrorBoundary>
        ) : USE_SHAKA_DASH && streamKind === "dash" ? (
          <ScrapeShakaDashPlayer
            key={buildScrapePlayerKey({
              playUrl: scrapeResult.playUrl,
              qualities: scrapeResult.qualities,
              subtitles: scrapeResult.subtitles,
              progressKey,
            })}
            playUrl={scrapeResult.playUrl}
            referer={scrapeResult.referer}
            subtitles={scrapeResult.subtitles}
            title={playbackTitle}
            poster={playbackPosterUrl}
            progressKey={progressKey}
            imdbId={imdbId}
            className="h-full w-full"
            onFatalError={onFatalError}
            onMediaReady={handleMediaReady}
            onEnded={isTv ? onEnded : undefined}
          />
        ) : moviPreview ? (
          <MoviScrapePlayer
            key={buildScrapePlayerKey({
              playUrl: scrapeResult.playUrl,
              qualities: scrapeResult.qualities,
              subtitles: scrapeResult.subtitles,
              audioVersions: scrapeResult.audioVersions,
              progressKey,
            })}
            playUrl={scrapeResult.playUrl}
            streamKind={streamKind}
            qualities={scrapeResult.qualities}
            referer={scrapeResult.referer}
            subtitles={scrapeResult.subtitles}
            audioVersions={scrapeResult.audioVersions}
            defaultAudioLang={scrapeResult.defaultAudioLang}
            defaultHardSubLang={scrapeResult.defaultHardSubLang}
            preferredAudioLang={scrapeResult.preferredAudioLang}
            title={playbackTitle}
            poster={playbackPosterUrl}
            progressKey={progressKey}
            imdbId={imdbId}
            className="h-full w-full"
            onFatalError={onFatalError}
            onMediaReady={handleMediaReady}
            onEnded={isTv ? onEnded : undefined}
          />
        ) : (
          <ScrapeHlsPlayer
            key={buildScrapePlayerKey({
              playUrl: scrapeResult.playUrl,
              qualities: scrapeResult.qualities,
              subtitles: scrapeResult.subtitles,
              audioVersions: scrapeResult.audioVersions,
              progressKey,
            })}
            playUrl={scrapeResult.playUrl}
            streamKind={streamKind}
            qualities={scrapeResult.qualities}
            referer={scrapeResult.referer}
            subtitles={scrapeResult.subtitles}
            audioVersions={scrapeResult.audioVersions}
            defaultAudioLang={scrapeResult.defaultAudioLang}
            defaultHardSubLang={scrapeResult.defaultHardSubLang}
            preferredAudioLang={scrapeResult.preferredAudioLang}
            title={playbackTitle}
            poster={playbackPosterUrl}
            progressKey={progressKey}
            imdbId={imdbId}
            className="h-full w-full"
            onFatalError={onFatalError}
            onMediaReady={handleMediaReady}
            onEnded={isTv ? onEnded : undefined}
          />
        )
      ) : null}

      {showDiscoveryOverlay ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={activeProviderId}
          error={scrapeError}
          onSelectEmbedServer={onSelectEmbedServer}
        />
      ) : null}

      {showBufferingOverlay ? (
        <PlaybackStartingOverlay
          message={
            playbackStartError ? "Trying another source…" : "Starting playback…"
          }
          error={playbackStartError}
        />
      ) : null}

      {showErrorOverlay ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={activeProviderId}
          error={scrapeError}
          onSelectEmbedServer={onSelectEmbedServer}
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
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/20 bg-black text-sm text-muted-foreground shadow-2xl">
        Loading stream...
      </div>
    );
  }

  return (
    <iframe
      key={iframeKey}
      src={videoSrc}
      className="absolute inset-0 h-full w-full rounded-lg bg-black"
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
  isPlaybackBuffering = false,
  children,
}: {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"] | UseAnimeScrapeReturn["status"];
  playbackBackdropUrl: string | null;
  mediaReady?: boolean;
  isPlaybackBuffering?: boolean;
  children: ReactNode;
}) {
  const playbackStarted =
    isScrapeServer(selectedServer) && isPlaybackBuffering && mediaReady;

  return (
    <ScrapePlayerShell
      backdropUrl={playbackBackdropUrl}
      blurBackdrop={
        isScrapeServer(selectedServer) &&
        (scrapeStatus === "scraping" ||
          scrapeStatus === "error" ||
          (isPlaybackBuffering && !mediaReady))
      }
      hideBackdrop={playbackStarted}
    >
      {children}
    </ScrapePlayerShell>
  );
}
