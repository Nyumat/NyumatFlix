"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { useFeatureFlagsOptional } from "@/components/providers/feature-flags-provider";
import { ScrapingOverlay } from "@/components/media/controls/scraping-overlay";
import { ScrapePlayerShell } from "@/components/media/scrape-player-shell";
import type { UseAnimeScrapeReturn } from "@/hooks/use-anime-scrape";
import type { UseScrapeReturn } from "@/hooks/use-scrape";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { USE_SHAKA_DASH } from "@/lib/constants";
import { buildScrapePlayerKey } from "@/lib/scrape/player-sources";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "@/lib/scrape/types";
import { isScrapeServer, type VideoServer } from "@/lib/stores/server-store";

const ScrapeHlsPlayer = dynamic(
  () =>
    import("@/components/media/scrape-hls-player").then(
      (module) => module.ScrapeHlsPlayer,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-border/20 bg-black text-sm text-muted-foreground shadow-2xl">
        Loading player...
      </div>
    ),
  },
);

const ScrapeShakaDashPlayer = dynamic(
  () =>
    import("@/components/media/scrape-shaka-dash-player").then(
      (module) => module.ScrapeShakaDashPlayer,
    ),
  {
    ssr: false,
  },
);

type HeroScrapePlayerPanelProps = {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"];
  scrapeResult: {
    playUrl: string;
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
  onEnded?: () => Promise<boolean>;
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
  onEnded,
}: HeroScrapePlayerPanelProps) {
  const flags = useFeatureFlagsOptional();
  const maintenanceMode = flags?.maintenanceMode ?? false;

  if (!isScrapeServer(selectedServer)) {
    return null;
  }

  const maintenanceBanner = maintenanceMode ? (
    <div className="absolute inset-x-0 top-0 z-40 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-100 backdrop-blur-sm">
      Playback is temporarily unavailable while maintenance is in progress.
    </div>
  ) : null;

  return (
    <>
      {maintenanceBanner}
      {scrapeStatus === "scraping" ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={activeProviderId}
          error={scrapeError}
          onSelectEmbedServer={onSelectEmbedServer}
        />
      ) : null}

      {scrapeStatus === "playing" && scrapeResult?.playUrl && progressKey ? (
        USE_SHAKA_DASH && streamKind === "dash" ? (
          <ScrapeShakaDashPlayer
            key={buildScrapePlayerKey({
              playUrl: scrapeResult.playUrl,
              qualities: scrapeResult.qualities,
              subtitles: scrapeResult.subtitles,
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
            onEnded={isTv ? onEnded : undefined}
          />
        ) : (
          <ScrapeHlsPlayer
            key={buildScrapePlayerKey({
              playUrl: scrapeResult.playUrl,
              qualities: scrapeResult.qualities,
              subtitles: scrapeResult.subtitles,
              audioVersions: scrapeResult.audioVersions,
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
            onEnded={isTv ? onEnded : undefined}
          />
        )
      ) : null}

      {scrapeStatus === "error" ? (
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
  children,
}: {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"] | UseAnimeScrapeReturn["status"];
  playbackBackdropUrl: string | null;
  children: ReactNode;
}) {
  return (
    <ScrapePlayerShell
      backdropUrl={playbackBackdropUrl}
      blurBackdrop={
        isScrapeServer(selectedServer) &&
        (scrapeStatus === "scraping" || scrapeStatus === "error")
      }
      hideBackdrop={
        isScrapeServer(selectedServer) && scrapeStatus === "playing"
      }
    >
      {children}
    </ScrapePlayerShell>
  );
}
