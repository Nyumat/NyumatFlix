import {
  engineSourceUrl as directEngineSourceUrlFromStream,
  engineStreamKind,
  nextFallbackEngine,
  prefersSeekableHlsFallback,
  selectInitialEngine,
  supportsWebCodecs,
  toDirectStream,
  type DirectPlaybackEngine,
} from "@/lib/direct/playback";

export type DirectPlaybackMode = "hls" | "direct" | "extended";

export type { DirectPlaybackEngine };

export { prefersSeekableHlsFallback, supportsWebCodecs };

export function selectDirectPlaybackEngine(
  playback: DirectPlaybackMode,
  fallbackUrl?: string,
  mediaUrl?: string,
  fileName?: string,
  name?: string,
  size?: number | string,
  browserPlayable?: boolean,
): DirectPlaybackEngine | null {
  return selectInitialEngine(
    toDirectStream({
      url: mediaUrl ?? "",
      fallbackUrl,
      playback,
      browserPlayable,
      fileName,
      name,
      size,
    }),
  );
}

export function nextDirectPlaybackEngine(
  playback: DirectPlaybackMode,
  current: DirectPlaybackEngine,
  fallbackUrl?: string,
  mediaUrl?: string,
): DirectPlaybackEngine | null {
  return nextFallbackEngine(
    toDirectStream({
      url: mediaUrl ?? "",
      fallbackUrl,
      playback,
    }),
    current,
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
