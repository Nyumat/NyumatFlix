import { isAllowedLiveStreamUrl } from "@/lib/live/playback";

const STREAM_URL_TEMPLATE = /\[[A-Z0-9_]+\]/;

export const getUnavailableReason = (sourceUrl: string | null) => {
  if (!sourceUrl) {
    return "No stream source";
  }

  if (sourceUrl.includes("cdn.dulo.tv")) {
    return "Unsupported backup source";
  }

  if (STREAM_URL_TEMPLATE.test(sourceUrl)) {
    return "Device-specific stream URL";
  }

  if (!isAllowedLiveStreamUrl(sourceUrl)) {
    return "Unsupported stream source";
  }

  return null;
};
