import type { PlayableManifest } from "@nyumatflix/playback";

export type LivePlaybackSnapshot<TResult> = {
  result: TResult;
  manifest: PlayableManifest | null;
};

export function snapshotLivePlayback<TResult>(input: {
  status: string;
  result: TResult | null;
  manifest: PlayableManifest | null;
}): LivePlaybackSnapshot<TResult> | null {
  if (input.result === null) {
    return null;
  }

  if (input.status !== "playing" && input.status !== "scraping") {
    return null;
  }

  return {
    result: input.result,
    manifest: input.manifest,
  };
}
