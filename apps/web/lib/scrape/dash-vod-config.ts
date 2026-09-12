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
