export const resolveNextProviderId = (
  providerOrder: readonly string[],
  currentProviderId: string,
): string | null => {
  const currentIndex = providerOrder.indexOf(currentProviderId);
  if (currentIndex < 0 || currentIndex >= providerOrder.length - 1) {
    return null;
  }

  return providerOrder[currentIndex + 1] ?? null;
};

/** Pin first, then keep the rest of the proxy chain for fallback racing. */
export const buildPinnedProviderResolveOrder = (
  fullOrder: readonly string[],
  pinnedProviderId?: string,
): readonly string[] => {
  if (!pinnedProviderId) {
    return fullOrder;
  }

  return [
    pinnedProviderId,
    ...fullOrder.filter((providerId) => providerId !== pinnedProviderId),
  ];
};
