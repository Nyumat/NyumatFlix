export const defaultFeatureFlags = {
  liveTv: false,
  authEnabled: true,
  proxyModeOnly: false,
  iframeModeOnly: false,
  staticHeroBackdrops: false,
  signupDisabled: false,
  noAdsModeDefault: false,
  scrapeProxyRequired: false,
  lockUserSettings: false,
  maintenanceMode: false,
} as const;

export type FeatureFlag = keyof typeof defaultFeatureFlags;

export const isFeatureEnabled = (feature: FeatureFlag): boolean =>
  defaultFeatureFlags[feature];

export const isLiveTvEnabled = (): boolean => defaultFeatureFlags.liveTv;
