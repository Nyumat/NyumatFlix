import {
  isHlsSourceUrl,
  rankSourcesHlsFirst,
  unwrapProxyUrl,
  type RankableSource,
} from "../source-resolve";
import type { ScrapeQuality, ScrapeSubtitle } from "../types";

export type EncDecExtractedStream = {
  url: string;
  label: string;
  referer?: string;
  type?: string;
};

const HTTP_URL_PATTERN = /^https?:\/\//i;

const isPlayableUrl = (value: string): boolean =>
  HTTP_URL_PATTERN.test(value) &&
  (/\.m3u8(?:[?#]|$)/i.test(value) ||
    /\.mp4(?:[?#]|$)/i.test(value) ||
    /\/pl\//i.test(value) ||
    /\/playlist\//i.test(value) ||
    /\/media\//i.test(value) ||
    /master/i.test(value));

const qualityFromLabel = (label: string | undefined): number => {
  const normalized = (label ?? "").toLowerCase();
  if (normalized.includes("2160") || normalized.includes("4k")) return 2160;
  if (normalized.includes("1080")) return 1080;
  if (normalized.includes("720")) return 720;
  if (normalized.includes("480")) return 480;
  if (normalized.includes("360")) return 360;
  return 0;
};

const pushCandidate = (
  candidates: EncDecExtractedStream[],
  seen: Set<string>,
  url: string,
  label: string,
  referer?: string,
  type?: string,
): void => {
  const normalized = unwrapProxyUrl(url.trim());
  if (!isPlayableUrl(normalized) || seen.has(normalized)) {
    return;
  }
  seen.add(normalized);
  candidates.push({ url: normalized, label, referer, type });
};

const collectFromRecord = (
  record: Record<string, unknown>,
  candidates: EncDecExtractedStream[],
  seen: Set<string>,
  referer?: string,
): void => {
  const directUrl =
    (typeof record.url === "string" && record.url) ||
    (typeof record.file === "string" && record.file) ||
    (typeof record.link === "string" && record.link) ||
    (typeof record.src === "string" && record.src);

  if (directUrl) {
    const label =
      (typeof record.quality === "string" && record.quality) ||
      (typeof record.label === "string" && record.label) ||
      (typeof record.name === "string" && record.name) ||
      "auto";
    const type = typeof record.type === "string" ? record.type : undefined;
    pushCandidate(candidates, seen, directUrl, label, referer, type);
  }

  if (Array.isArray(record.sources)) {
    for (const entry of record.sources) {
      if (entry && typeof entry === "object") {
        collectFromRecord(
          entry as Record<string, unknown>,
          candidates,
          seen,
          referer,
        );
      }
    }
  }

  if (record.playlist && typeof record.playlist === "object") {
    collectFromRecord(
      record.playlist as Record<string, unknown>,
      candidates,
      seen,
      referer,
    );
  }

  if (Array.isArray(record.streams)) {
    for (const entry of record.streams) {
      if (entry && typeof entry === "object") {
        collectFromRecord(
          entry as Record<string, unknown>,
          candidates,
          seen,
          referer,
        );
      }
    }
  }
};

export const extractEncDecPlayableStreams = (
  payload: unknown,
  referer?: string,
): EncDecExtractedStream[] => {
  const candidates: EncDecExtractedStream[] = [];
  const seen = new Set<string>();

  if (typeof payload === "string") {
    if (isPlayableUrl(payload)) {
      pushCandidate(candidates, seen, payload, "auto", referer);
    }
    return candidates;
  }

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      if (typeof entry === "string" && isPlayableUrl(entry)) {
        pushCandidate(candidates, seen, entry, "auto", referer);
        continue;
      }
      if (entry && typeof entry === "object") {
        collectFromRecord(
          entry as Record<string, unknown>,
          candidates,
          seen,
          referer,
        );
      }
    }
    return rankEncDecStreams(candidates);
  }

  if (payload && typeof payload === "object") {
    collectFromRecord(
      payload as Record<string, unknown>,
      candidates,
      seen,
      referer,
    );
  }

  return rankEncDecStreams(candidates);
};

export const rankEncDecStreams = (
  streams: EncDecExtractedStream[],
): EncDecExtractedStream[] => {
  const rankable: RankableSource[] = streams.map((stream) => ({
    url: stream.url,
    type: stream.type,
  }));

  const ranked = rankSourcesHlsFirst(rankable, (source) => source.url ?? null);
  const order = new Map(ranked.map((entry, index) => [entry.url, index]));

  return [...streams].sort((left, right) => {
    const leftHls = isHlsSourceUrl(left, left.url);
    const rightHls = isHlsSourceUrl(right, right.url);
    if (leftHls !== rightHls) {
      return Number(rightHls) - Number(leftHls);
    }
    const qualityDelta =
      qualityFromLabel(right.label) - qualityFromLabel(left.label);
    if (qualityDelta !== 0) {
      return qualityDelta;
    }
    return (order.get(left.url) ?? 0) - (order.get(right.url) ?? 0);
  });
};

export const mapEncDecSubtitles = (
  payload: unknown,
  referer?: string,
): ScrapeSubtitle[] | undefined => {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const tracks = Array.isArray(record.subtitles)
    ? record.subtitles
    : Array.isArray(record.tracks)
      ? record.tracks
      : null;

  if (!tracks) {
    return undefined;
  }

  const mapped = tracks
    .filter(
      (track): track is Record<string, unknown> =>
        Boolean(track) && typeof track === "object",
    )
    .map((track) => {
      const url =
        (typeof track.url === "string" && track.url) ||
        (typeof track.file === "string" && track.file);
      if (!url || !HTTP_URL_PATTERN.test(url)) {
        return null;
      }
      const lang =
        (typeof track.lang === "string" && track.lang) ||
        (typeof track.label === "string" && track.label) ||
        "Unknown";
      return {
        lang,
        url,
        referer,
        format: /\.srt(?:[?#]|$)/i.test(url)
          ? ("srt" as const)
          : ("vtt" as const),
      };
    })
    .filter((track): track is NonNullable<typeof track> => track !== null)
    .map((track): ScrapeSubtitle => track);

  return mapped.length > 0 ? mapped : undefined;
};

export const mapEncDecQualities = (
  streams: EncDecExtractedStream[],
  bestUrl: string,
  referer?: string,
): ScrapeQuality[] | undefined => {
  const extras = streams
    .filter((stream) => stream.url !== bestUrl)
    .map((stream) => ({
      label: stream.label,
      url: stream.url,
      referer: stream.referer ?? referer,
    }));

  return extras.length > 0 ? extras : undefined;
};
