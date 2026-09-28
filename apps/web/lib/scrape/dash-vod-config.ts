import type { MediaPlayerSettingClass } from "dashjs";

export type DashSettingsPlayer = {
  updateSettings: (settings: MediaPlayerSettingClass) => unknown;
};

export const DASH_LOG_LEVEL_NONE = 0;

export const SCRAPE_VOD_DASH_CONFIG: MediaPlayerSettingClass = {
  debug: {
    logLevel: DASH_LOG_LEVEL_NONE,
  },
  streaming: {
    text: {
      defaultEnabled: false,
      dispatchForManualRendering: true,
    },
    cmcd: {
      enabled: false,
    },
    buffer: {
      fastSwitchEnabled: true,
      avoidCurrentTimeRangePruning: true,
    },
  },
};

export const configureScrapeDashInstance = (dash: DashSettingsPlayer): void => {
  dash.updateSettings({
    debug: {
      logLevel: DASH_LOG_LEVEL_NONE,
    },
  });
};

export const loadDashjsLibrary = () =>
  import("dashjs").then((module) => ({ default: module.MediaPlayer }));

/** Vidstack dash.js settings accepted by the DASH provider adapter. */
export type VidstackDashProvider = {
  config: unknown;
  library: unknown;
  onInstance: (callback: (dash: DashSettingsPlayer) => void) => unknown;
};

/**
 * Attach the scrape VOD dash.js config to a Vidstack DASH provider. Keeps
 * dash.js console noise (e.g. the benign teardown-time
 * "getAllBufferRanges exception") off the console in every Vidstack engine.
 */
export const configureVidstackDashProvider = (
  provider: VidstackDashProvider,
): void => {
  provider.config = SCRAPE_VOD_DASH_CONFIG;
  provider.library = loadDashjsLibrary;
  provider.onInstance(configureScrapeDashInstance);
};
