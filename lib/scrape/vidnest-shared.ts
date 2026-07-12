import type { ScrapeMediaInput, ScrapeSubtitle } from "./types";
import { refererForStreamUrl } from "./stream-url-patterns";

const VIDNEST_REFERER = "https://vidnest.fun/";

const HAKUNAYMATATA_PATTERN = /(?:^|\.)hakunaymatata\.com/i;
const BCDN_PATTERN = /(?:^|\.)bcdn\./i;

/** CDN hosts that only allow browser-origin fetches (server probes get 403). */
export const isVidnestClientOnlyCdn = (streamUrl: string): boolean =>
  HAKUNAYMATATA_PATTERN.test(streamUrl) || BCDN_PATTERN.test(streamUrl);

/** Signed hakunaymatata URLs include a `sign` query param from the resolver API. */
export const isFreshVidnestSignedUrl = (streamUrl: string): boolean => {
  if (!isVidnestClientOnlyCdn(streamUrl)) {
    return false;
  }

  try {
    const sign = new URL(streamUrl).searchParams.get("sign");
    return Boolean(sign && sign.length >= 8);
  } catch {
    return false;
  }
};

type VidNestStreamRaw = {
  url?: string;
  link?: string;
  type?: string;
  language?: string;
  lang?: string;
  quality?: string;
  headers?: { Referer?: string };
};

type VidNestDownload = {
  url?: string;
  resolution?: number;
};

type VidNestUrlEntry = {
  url?: string;
  link?: string;
  lang?: string;
  language?: string;
  resolution?: string | number;
  type?: string;
};

type VidNestCaption = {
  url?: string;
  lan?: string;
  lanName?: string;
};

export type VidNestStream = {
  url: string;
  type?: string;
  language?: string;
  referer?: string;
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
  stream.type === "hls" || /\.m3u8(?:[?#].*|$)/i.test(stream.url);

export const pickVidnestStreamUrl = (
  streams: VidNestStream[],
): string | null => {
  return rankVidnestStreamUrls(streams)[0] ?? null;
};

export const rankVidnestStreamUrls = (streams: VidNestStream[]): string[] => {
  const candidates = streams.filter((stream) => stream.url.startsWith("http"));
  if (candidates.length === 0) {
    return [];
  }

  return [...candidates]
    .sort((left, right) => {
      const score = (stream: VidNestStream) =>
        (isHlsStream(stream) ? 2 : 0) +
        (/^(?:en|english)(?:[-_]|$)/i.test(stream.language ?? "") ? 1 : 0);
      return score(right) - score(left);
    })
    .map((stream) => stream.url);
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
  code?: number;
  data?: {
    streams?: VidNestStreamRaw[];
    downloads?: VidNestDownload[];
    captions?: VidNestCaption[];
    sources?: VidNestStreamRaw[];
  };
  streams?: VidNestStreamRaw[];
  sources?: VidNestStreamRaw[];
  url?: VidNestUrlEntry[];
  captions?: VidNestCaption[];
  provider?: string;
};

const streamFromRaw = (raw: VidNestStreamRaw): VidNestStream | null => {
  const url = raw.url ?? raw.link;
  if (!url?.startsWith("http")) {
    return null;
  }

  const referer = raw.headers?.Referer;
  return {
    url,
    type: raw.type,
    language: raw.language ?? raw.lang ?? raw.quality,
    referer: referer?.startsWith("http") ? referer : undefined,
  };
};

export const extractVidnestStreams = (
  payload: VidNestPayload,
): VidNestStream[] => {
  const seen = new Set<string>();
  const streams: VidNestStream[] = [];

  const add = (stream: VidNestStream | null) => {
    if (!stream || seen.has(stream.url)) {
      return;
    }
    seen.add(stream.url);
    streams.push(stream);
  };

  for (const raw of [
    ...(payload.data?.streams ?? []),
    ...(payload.streams ?? []),
    ...(payload.data?.sources ?? []),
    ...(payload.sources ?? []),
  ]) {
    add(streamFromRaw(raw));
  }

  for (const download of payload.data?.downloads ?? []) {
    if (!download.url?.startsWith("http")) {
      continue;
    }
    add({
      url: download.url,
      type: "mp4",
      language: download.resolution ? `${download.resolution}p` : undefined,
    });
  }

  for (const entry of payload.url ?? []) {
    const url = entry.link ?? entry.url;
    if (!url?.startsWith("http")) {
      continue;
    }
    add({
      url,
      type: entry.type ?? (/\.mp4/i.test(url) ? "mp4" : undefined),
      language:
        entry.lang ??
        entry.language ??
        (entry.resolution ? `${entry.resolution}p` : undefined),
    });
  }

  return streams;
};

export const extractVidnestCaptions = (payload: VidNestPayload) =>
  payload.data?.captions ?? payload.captions ?? [];

export const refererForVidnestStream = (
  streamUrl: string,
  streamReferer?: string,
): string => {
  if (streamReferer?.startsWith("http")) {
    return streamReferer;
  }
  if (HAKUNAYMATATA_PATTERN.test(streamUrl) || BCDN_PATTERN.test(streamUrl)) {
    return "";
  }
  return refererForStreamUrl(streamUrl, VIDNEST_REFERER);
};
