import type { PlayableManifest } from "@nyumatflix/playback";

import { USE_SHAKA_DASH } from "@/lib/constants";
import type { DashEngine, PlayerEngine } from "@/lib/flags/experience-defaults";

export type ScrapePlaybackEngine = "vidstack" | "movi" | "shaka";
export type PlaybackShellEngine = ScrapePlaybackEngine | "direct";

export const selectPlaybackShellEngine = (
  manifest: PlayableManifest,
  options: { userEngine: PlayerEngine; dashEngine?: DashEngine },
): PlaybackShellEngine => {
  if (manifest.origin === "direct" || manifest.directPlayback) {
    return "direct";
  }

  if (manifest.kind === "dash") {
    const dashEngine =
      options.dashEngine ?? (USE_SHAKA_DASH ? "shaka" : "vidstack");
    return dashEngine === "shaka" ? "shaka" : "vidstack";
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
