let playerModulesPromise: Promise<unknown> | null = null;

/** Warm direct player React chunks (vidstack + movi wrappers). */
export function prefetchDirectPlayerModules(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!playerModulesPromise) {
    playerModulesPromise = Promise.all([
      import("@/components/media/calluspirates-stream-player"),
      import("@/components/media/movi-stream-player"),
    ]);
  }
}

/** Warm direct player React chunks before playback starts. */
export function prefetchDirectPlaybackPlayer(): void {
  prefetchDirectPlayerModules();
}
