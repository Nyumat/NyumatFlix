export const featureFlags = {
  liveTv: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export const isFeatureEnabled = (feature: FeatureFlag): boolean =>
  featureFlags[feature];

export const isLiveTvEnabled = (): boolean => isFeatureEnabled("liveTv");
