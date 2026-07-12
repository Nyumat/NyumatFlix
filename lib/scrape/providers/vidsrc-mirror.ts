import type { ScrapeMediaInput } from "../types";

const VIDSRC_WTF_API = "https://api.vidsrc.wtf/source";
type VidSrcWtfPayload = {
  stream?: {
    url?: string;
  };
};

export const buildVidsrcMirrorApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${VIDSRC_WTF_API}/movie/${input.tmdbId}`;
  }

  return `${VIDSRC_WTF_API}/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
};

export const parseVidsrcMirrorBody = (
  body: string,
): VidSrcWtfPayload | null => {
  const trimmed = body.trim();

  try {
    return JSON.parse(trimmed) as VidSrcWtfPayload;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]) as VidSrcWtfPayload;
    } catch {
      return null;
    }
  }
};
