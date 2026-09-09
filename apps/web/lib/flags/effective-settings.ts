import type { PlaybackAudioPreference } from "@/lib/playback/playback-preferences";
import { scrapeServer } from "@/lib/stores/playback-mode-store";
import type { VideoServer } from "@/lib/stores/video-servers";
import { videoServers } from "@/lib/stores/video-servers";
import type { SiteFlags } from "@/lib/flags/site-flags";
import {
  getPlaybackModePolicy,
  orderVideoServersByMenu,
} from "@/lib/flags/site-flags";

export type UserPlaybackChoices = {
  noAdsMode?: boolean;
  disableHeroTrailers?: boolean;
  selectedServerId?: string;
  userSelectedPlaybackServer?: boolean;
  policyGenerationAtChoice?: string;
  playbackAudio?: PlaybackAudioPreference;
};

export type EffectiveSettings = {
  noAdsMode: boolean;
  disableHeroTrailers: boolean;
  selectedServer: VideoServer;
  hasUserSelectedPlaybackServer: boolean;
};

const resolveDefaultEmbedServer = (flags: SiteFlags): VideoServer => {
  const ordered = orderVideoServersByMenu(flags);
  const enabled = ordered.filter((server) => flags.embedProviders[server.id]);
  return enabled[0] ?? videoServers[0]!;
};

export const resolveEffectiveSettings = (
  flags: SiteFlags,
  user: UserPlaybackChoices = {},
): EffectiveSettings => {
  const policy = getPlaybackModePolicy(flags);
  const policyGeneration = flags.policyGeneration;

  if (policy === "proxy") {
    return {
      noAdsMode: true,
      disableHeroTrailers:
        flags.staticHeroBackdrops || flags.lockUserSettings
          ? true
          : (user.disableHeroTrailers ?? false),
      selectedServer: scrapeServer,
      hasUserSelectedPlaybackServer: false,
    };
  }

  if (policy === "iframe") {
    const defaultEmbed = resolveDefaultEmbedServer(flags);
    const userServer =
      user.selectedServerId &&
      user.userSelectedPlaybackServer &&
      user.policyGenerationAtChoice === policyGeneration
        ? videoServers.find((s) => s.id === user.selectedServerId) ??
          defaultEmbed
        : defaultEmbed;

    return {
      noAdsMode: false,
      disableHeroTrailers:
        flags.staticHeroBackdrops || flags.lockUserSettings
          ? true
          : (user.disableHeroTrailers ?? false),
      selectedServer: userServer,
      hasUserSelectedPlaybackServer: false,
    };
  }

  const userExplicitServer =
    user.userSelectedPlaybackServer &&
    user.selectedServerId &&
    user.policyGenerationAtChoice === policyGeneration
      ? videoServers.find((s) => s.id === user.selectedServerId) ??
        resolveDefaultEmbedServer(flags)
      : null;

  const defaultFromFlag =
    flags.defaultProxyPlayback && !userExplicitServer
      ? scrapeServer
      : resolveDefaultEmbedServer(flags);

  const selectedServer = userExplicitServer ?? defaultFromFlag;

  const userNoAds = user.noAdsMode ?? false;
  const effectiveNoAds =
    flags.noAdsModeDefault && !user.userSelectedPlaybackServer
      ? true
      : userNoAds;

  const finalServer =
    effectiveNoAds && selectedServer.id !== scrapeServer.id
      ? scrapeServer
      : selectedServer;

  const disableHeroTrailers =
    flags.staticHeroBackdrops || flags.lockUserSettings
      ? true
      : (user.disableHeroTrailers ?? false);

  return {
    noAdsMode: effectiveNoAds,
    disableHeroTrailers,
    selectedServer: finalServer,
    hasUserSelectedPlaybackServer: Boolean(user.userSelectedPlaybackServer),
  };
};

export const shouldReapplySoftDefaults = (
  flags: SiteFlags,
  user: UserPlaybackChoices,
): boolean => {
  if (user.userSelectedPlaybackServer) {
    return false;
  }
  return user.policyGenerationAtChoice !== flags.policyGeneration;
};
