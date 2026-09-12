let playerModulesPromise: Promise<unknown> | null = null;

/** Warm direct player React chunks (vidstack + movi wrappers). */
export function prefetchDirectPlayerModules(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (!playerModulesPromise) {
    playerModulesPromise = Promise.all([
      import("@/components/media/playback-shell"),
      import("@/components/media/engines/direct-playback-engine"),
      import("@/components/media/movi-stream-player"),
    ]);
  }
}

/** Warm direct player React chunks before playback starts. */
export function prefetchDirectPlaybackPlayer(): void {
  prefetchDirectPlayerModules();
}
