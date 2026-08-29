import { getPlaybackModePolicy, type SiteFlags } from "@/lib/flags/site-flags";
import { isScrapeServer } from "@/lib/stores/server-store";
import type { VideoServer } from "@/lib/stores/video-servers";

/** Embed iframe popups only matter when playback uses an embed server. */
export function shouldBypassEmbedAdblockPrompt(input: {
  noAdsMode: boolean;
  flags: SiteFlags;
  selectedServer: Pick<VideoServer, "id">;
}): boolean {
  if (input.noAdsMode) {
    return true;
  }

  const policy = getPlaybackModePolicy(input.flags);
  if (policy === "proxy") {
    return true;
  }

  if (input.flags.defaultProxyPlayback) {
    return true;
  }

  if (isScrapeServer(input.selectedServer)) {
    return true;
  }

  return false;
}
