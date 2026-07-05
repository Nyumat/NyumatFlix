"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { ScrapingOverlay } from "@/components/media/controls/scraping-overlay";
import { ScrapePlayerShell } from "@/components/media/scrape-player-shell";
import type { UseAnimeScrapeReturn } from "@/hooks/use-anime-scrape";
import type { UseScrapeReturn } from "@/hooks/use-scrape";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";
import { buildScrapePlayerKey } from "@/lib/scrape/player-sources";
import type { SourceOverlayItem } from "@/lib/scrape/source-overlay";
import type { StreamKind } from "@/lib/scrape/stream-url-patterns";
import type { ScrapeQuality, ScrapeSubtitle } from "@/lib/scrape/types";
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

type HeroScrapePlayerPanelProps = {
  selectedServer: VideoServer;
  scrapeStatus: UseScrapeReturn["status"];
  scrapeResult: {
    playUrl: string;
    qualities?: ScrapeQuality[];
    subtitles?: ScrapeSubtitle[];
    referer?: string;
  } | null;
  scrapeError: string | null;
  activeProviderId: string | null;
  sourceOverlayItems: SourceOverlayItem[];
  playbackTitle: string;
  playbackPosterUrl: string | null;
  progressKey: PlaybackProgressKey | null;
  streamKind: StreamKind;
  isTv: boolean;
  onSelectEmbedServer: (serverId: string) => void;
  onFatalError: () => void;
  onEnded?: () => void;
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
  streamKind,
  isTv,
  onSelectEmbedServer,
  onFatalError,
  onEnded,
}: HeroScrapePlayerPanelProps) {
  if (!isScrapeServer(selectedServer)) {
    return null;
  }

  return (
    <>
      {scrapeStatus === "scraping" ? (
        <ScrapingOverlay
          items={sourceOverlayItems}
          activeProviderId={activeProviderId}
          error={scrapeError}
          onSelectEmbedServer={onSelectEmbedServer}
        />
      ) : null}

      {scrapeStatus === "playing" && scrapeResult?.playUrl && progressKey ? (
        <ScrapeHlsPlayer
          key={buildScrapePlayerKey({
            playUrl: scrapeResult.playUrl,
            qualities: scrapeResult.qualities,
            subtitles: scrapeResult.subtitles,
          })}
          playUrl={scrapeResult.playUrl}
          streamKind={streamKind}
          qualities={scrapeResult.qualities}
          referer={scrapeResult.referer}
          subtitles={scrapeResult.subtitles}
          title={playbackTitle}
          poster={playbackPosterUrl}
          progressKey={progressKey}
          className="h-full w-full"
          onFatalError={onFatalError}
          onEnded={isTv ? onEnded : undefined}
        />
      ) : null}

      {scrapeStatus === "error" ? (
        <>
          <ScrapingOverlay
            items={sourceOverlayItems}
            activeProviderId={activeProviderId}
            error={scrapeError}
            onSelectEmbedServer={onSelectEmbedServer}
          />
          <div className="absolute inset-x-0 bottom-16 z-40 flex justify-center px-6">
            <p className="max-w-sm text-center text-xs text-white/45">
              Try another server from the menu below.
            </p>
          </div>
        </>
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
