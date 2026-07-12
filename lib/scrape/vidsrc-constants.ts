export type VidsrcPlaybackProviderId = "vidsrc" | "vidsrc-mirror";

/** Metadata to re-mint IP-bound VidSrc JWTs at playback time. */
export type VidsrcPlaybackRefresh = {
  providerId: VidsrcPlaybackProviderId;
  tokenHost: string;
  masterTemplate: string;
  playerOrigin: string;
  playerReferer: string;
};
