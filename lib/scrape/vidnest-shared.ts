import type { ScrapeMediaInput, ScrapeSubtitle } from "./types";
import { refererForStreamUrl } from "./stream-url-patterns";

const VIDNEST_REFERER = "https://vidnest.fun/";

type VidNestStream = {
  url?: string;
  type?: string;
  language?: string;
};

type VidNestCaption = {
  url?: string;
  lan?: string;
  lanName?: string;
};

export const buildVidnestMediaPath = (
  input: ScrapeMediaInput,
): string | null => {
  if (input.mediaType === "movie") {
    return `movie/${input.tmdbId}`;
  }

  if (input.seasonNumber && input.episodeNumber) {
    return `tv/${input.tmdbId}/${input.seasonNumber}/${input.episodeNumber}`;
  }

  return null;
};

const isHlsStream = (stream: VidNestStream): boolean =>
  stream.type === "hls" || /\.m3u8(?:[?#].*|$)/i.test(stream.url ?? "");

export const pickVidnestStreamUrl = (
  streams: VidNestStream[],
): string | null => {
  const candidates = streams.filter((stream) => stream.url?.startsWith("http"));
  if (candidates.length === 0) {
    return null;
  }

  const hlsCandidates = candidates.filter(isHlsStream);
  const pool = hlsCandidates.length > 0 ? hlsCandidates : candidates;

  const english = pool.find((stream) =>
    /^(?:en|english)(?:[-_]|$)/i.test(stream.language ?? ""),
  );

  return (english ?? pool[0])?.url ?? null;
};

export const mapVidnestCaptions = (
  captions: VidNestCaption[] | undefined,
): ScrapeSubtitle[] => {
  if (!captions?.length) {
    return [];
  }

  const seen = new Set<string>();

  return captions.flatMap((caption) => {
    if (!caption.url?.startsWith("http") || seen.has(caption.url)) {
      return [];
    }

    seen.add(caption.url);

    return [
      {
        lang: caption.lanName ?? caption.lan ?? "Unknown",
        url: caption.url,
      },
    ];
  });
};

export type VidNestPayload = {
  data?: {
    streams?: VidNestStream[];
    captions?: VidNestCaption[];
  };
  streams?: VidNestStream[];
  captions?: VidNestCaption[];
};

export const extractVidnestStreams = (payload: VidNestPayload) =>
  payload.data?.streams ?? payload.streams ?? [];

export const extractVidnestCaptions = (payload: VidNestPayload) =>
  payload.data?.captions ?? payload.captions ?? [];

export const refererForVidnestStream = (streamUrl: string): string => {
  try {
    const { hostname } = new URL(streamUrl);
    if (hostname === "goodstream.cc" || hostname.endsWith(".goodstream.cc")) {
      return VIDNEST_REFERER;
    }
  } catch {
    // fall through
  }

  return refererForStreamUrl(streamUrl, VIDNEST_REFERER);
};
