import {
  engineSourceUrl as directEngineSourceUrlFromStream,
  engineStreamKind,
  nextFallbackEngine,
  selectInitialEngine,
  supportsWebCodecs,
  toDirectStream,
  type DirectEngineSelectionOptions,
  type DirectPlaybackEngine,
} from "@/lib/direct/playback";

export type DirectPlaybackMode = "hls" | "direct" | "extended";

export type { DirectPlaybackEngine };

export { supportsWebCodecs };

export function selectDirectPlaybackEngine(
  playback: DirectPlaybackMode,
  fallbackUrl?: string,
  mediaUrl?: string,
  fileName?: string,
  name?: string,
  size?: number | string,
  browserPlayable?: boolean,
  playbackHint?: "movi-first" | "hls-first",
  options?: DirectEngineSelectionOptions,
): DirectPlaybackEngine | null {
  const resolvedFileName =
    fileName ?? (mediaUrl ? mediaUrl.split("/").pop() : undefined);
  const resolvedName = name ?? resolvedFileName;
  return selectInitialEngine(
    toDirectStream({
      url: mediaUrl ?? "",
      fallbackUrl,
      playback,
      browserPlayable,
      fileName: resolvedFileName,
      name: resolvedName,
      size,
      playbackHint,
    }),
    options,
  );
}

export function nextDirectPlaybackEngine(
  playback: DirectPlaybackMode,
  current: DirectPlaybackEngine,
  fallbackUrl?: string,
  mediaUrl?: string,
  fileName?: string,
  name?: string,
  playbackHint?: "movi-first" | "hls-first",
  options?: DirectEngineSelectionOptions,
): DirectPlaybackEngine | null {
  const resolvedFileName =
    fileName ?? (mediaUrl ? mediaUrl.split("/").pop() : undefined);
  const resolvedName = name ?? resolvedFileName;
  return nextFallbackEngine(
    toDirectStream({
      url: mediaUrl ?? "",
      fallbackUrl,
      playback,
      fileName: resolvedFileName,
      name: resolvedName,
      playbackHint,
    }),
    current,
    undefined,
    options,
  );
}

export function directEngineSourceUrl(
  mediaUrl: string,
  fallbackUrl: string | undefined,
  engine: DirectPlaybackEngine,
): string {
  return directEngineSourceUrlFromStream(
    toDirectStream({ url: mediaUrl, fallbackUrl }),
    engine,
  );
}

export function directEngineStreamKind(
  engine: DirectPlaybackEngine,
  sourceUrl?: string,
): "hls" | "mp4" {
  return engineStreamKind(engine, sourceUrl);
}
