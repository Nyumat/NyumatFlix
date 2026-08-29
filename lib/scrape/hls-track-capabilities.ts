import { probeHlsPlaylistBody } from "./anime/hls-sanity";
import { countHlsMediaRenditions } from "./hls-media-renditions";

export type HlsTrackCapabilityFields = {
  streamUrl: string;
  streamKind?: string;
  referer?: string;
  nativeAudioTrackCount?: number;
  nativeSubtitleTrackCount?: number;
};

const looksLikeHls = (result: HlsTrackCapabilityFields): boolean =>
  result.streamKind === "hls" || /\.m3u8(?:[?#]|$)/i.test(result.streamUrl);

export const attachHlsTrackCapabilities = async <
  T extends HlsTrackCapabilityFields,
>(
  result: T,
): Promise<T> => {
  if (
    result.nativeAudioTrackCount !== undefined &&
    result.nativeSubtitleTrackCount !== undefined
  ) {
    return result;
  }

  if (!looksLikeHls(result)) {
    return result;
  }

  const body = await probeHlsPlaylistBody(
    result.streamUrl,
    result.referer ?? "",
  );
  if (!body) {
    return result;
  }

  return {
    ...result,
    nativeAudioTrackCount: countHlsMediaRenditions(body, "AUDIO"),
    nativeSubtitleTrackCount: countHlsMediaRenditions(body, "SUBTITLES"),
  };
};
