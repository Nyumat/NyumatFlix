import type { PlayableManifest } from "@nyumatflix/playback";

import { USE_SHAKA_DASH } from "@/lib/constants";
import type { PlayerEngine } from "@/hooks/use-movi-preview";

export type ScrapePlaybackEngine = "vidstack" | "movi" | "shaka";
export type PlaybackShellEngine = ScrapePlaybackEngine | "direct";

export const selectPlaybackShellEngine = (
  manifest: PlayableManifest,
  options: { userEngine: PlayerEngine },
): PlaybackShellEngine => {
  if (manifest.origin === "direct" || manifest.directPlayback) {
    return "direct";
  }

  if (manifest.kind === "dash") {
    return USE_SHAKA_DASH ? "shaka" : "vidstack";
  }

  if (options.userEngine === "movi") {
    return "movi";
  }

  return "vidstack";
};

export const selectScrapePlaybackEngine = (
  manifest: PlayableManifest,
  options: { userEngine: PlayerEngine },
): ScrapePlaybackEngine => {
  const engine = selectPlaybackShellEngine(manifest, options);
  if (engine === "direct") {
    return "vidstack";
  }
  return engine;
};
