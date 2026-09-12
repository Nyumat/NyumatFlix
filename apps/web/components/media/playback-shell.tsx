"use client";

import type { PlayableManifest } from "@nyumatflix/playback";

import { DirectPlaybackEngine } from "@/components/media/engines/direct-playback-engine";
import { MoviScrapeEngine } from "@/components/media/engines/movi-scrape-engine";
import { ShakaScrapeEngine } from "@/components/media/engines/shaka-scrape-engine";
import { VidstackScrapeEngine } from "@/components/media/engines/vidstack-scrape-engine";
import { usePlayerEngine } from "@/hooks/use-movi-preview";
import { selectPlaybackShellEngine } from "@/lib/playback/select-playback-engine";
import { manifestSessionKey } from "@/lib/playback/to-playable-manifest";
import type { PlaybackProgressKey } from "@/lib/playback/progress-storage";

export type PlaybackShellProps = {
  manifest: PlayableManifest;
  title: string;
  poster?: string | null;
  progressKey: PlaybackProgressKey;
  imdbId?: string | null;
  isTv?: boolean;
  className?: string;
  onFatalError: () => void;
  onMediaReady?: (ready: boolean) => void;
  onEnded?: () => Promise<boolean>;
  onPlaybackStallFailover?: () => void;
};

export function PlaybackShell({
  manifest,
  title,
  poster,
  progressKey,
  imdbId,
  isTv,
  className,
  onFatalError,
  onMediaReady,
  onEnded,
  onPlaybackStallFailover,
}: PlaybackShellProps) {
  const { engine: userEngine } = usePlayerEngine();
  const shellEngine = selectPlaybackShellEngine(manifest, { userEngine });
  const sessionKey = manifestSessionKey(manifest, progressKey);
  const engineSessionKey = `${sessionKey}:${userEngine}`;

  const sharedProps = {
    manifest,
    title,
    poster,
    progressKey,
    imdbId,
    isTv,
    className,
    onFatalError,
    onMediaReady,
    onEnded,
    onPlaybackStallFailover,
    autoPlay: true as const,
  };

  switch (shellEngine) {
    case "direct":
      return <DirectPlaybackEngine key={engineSessionKey} {...sharedProps} />;
    case "shaka":
      return <ShakaScrapeEngine key={engineSessionKey} {...sharedProps} />;
    case "movi":
      return <MoviScrapeEngine key={engineSessionKey} {...sharedProps} />;
    case "vidstack":
      return <VidstackScrapeEngine key={engineSessionKey} {...sharedProps} />;
  }
}
