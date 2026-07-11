import type { PlayerSrc } from "@vidstack/react";

import {
  buildScrapePlayUrl,
  extractScrapePlaybackRefreshFromPlayUrl,
} from "./playback";
import type { ScrapeQuality, ScrapeSubtitle } from "./types";

export type ScrapeSubtitleTrackType = "vtt" | "srt";

export type ScrapePlayerTextTrack = {
  id: string;
  src: string;
  lang: string;
  label: string;
  type: ScrapeSubtitleTrackType;
  default: boolean;
};

const SRT_URL_PATTERN = /(?:format=srt|\.srt(?:[?#]|$))/i;

export const detectScrapeSubtitleType = (
  url: string,
): ScrapeSubtitleTrackType => (SRT_URL_PATTERN.test(url) ? "srt" : "vtt");

const subtitleVariantLabel = (url: string): string | null => {
  const match = url.match(/\/([a-z0-9]+)\.(?:vtt|srt)(?:[?#]|$)/i);
  return match?.[1] ? match[1].toUpperCase() : null;
};

const formatScrapeSubtitleLabel = (lang: string, url: string): string => {
  const variant = subtitleVariantLabel(url);
  const base = lang.trim() || "Unknown";

  return variant && variant.length <= 3 ? `${base} (${variant})` : base;
};

export const buildScrapeSubtitleTracks = (
  subtitles: ScrapeSubtitle[] | undefined,
  referer: string | undefined,
): ScrapePlayerTextTrack[] => {
  if (!subtitles?.length) {
    return [];
  }

  const seen = new Set<string>();
  const tracks = subtitles.flatMap((track, index) => {
    if (!track.url.startsWith("http") || seen.has(track.url)) {
      return [];
    }

    seen.add(track.url);

    let trackReferer = referer;
    try {
      trackReferer = new URL(track.url).origin;
    } catch {
      void 0;
    }

    return [
      {
        id: `${track.lang}-${index}`,
        src: buildScrapePlayUrl({
          url: track.url,
          referer: trackReferer,
          subtitleFormat: track.format === "ass" ? "ass" : undefined,
        }),
        lang: track.lang,
        label: formatScrapeSubtitleLabel(track.lang, track.url),
        type:
          track.format === "srt"
            ? "srt"
            : track.format === "vtt" || track.format === "ass"
              ? "vtt"
              : detectScrapeSubtitleType(track.url),
        default: false,
      },
    ];
  });

  return tracks;
};

export type ScrapeVideoDimensions = {
  width: number;
  height: number;
};

export const parseQualityLabel = (
  label: string,
): ScrapeVideoDimensions | null => {
  const normalized = label.trim().toUpperCase();

  if (normalized === "4K" || normalized === "2160P" || normalized === "UHD") {
    return { width: 3840, height: 2160 };
  }

  const match = normalized.match(/(\d{3,4})\s*P?$/);
  if (!match?.[1]) {
    return null;
  }

  const height = Number.parseInt(match[1], 10);
  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    width: Math.round((height * 16) / 9),
    height,
  };
};

const HLS_MIME_TYPE = "application/x-mpegurl" as const;

const inferDimensionsFromUrl = (url: string): ScrapeVideoDimensions | null => {
  const match = url.match(/\/(\d{3,4})p\//i);
  if (!match?.[1]) {
    return null;
  }

  const height = Number.parseInt(match[1], 10);
  if (!Number.isFinite(height) || height <= 0) {
    return null;
  }

  return {
    width: Math.round((height * 16) / 9),
    height,
  };
};

const dimensionsForQuality = (
  quality: ScrapeQuality,
): ScrapeVideoDimensions | null =>
  parseQualityLabel(quality.label) ?? inferDimensionsFromUrl(quality.url);

export const buildScrapePlayerSrc = (
  playUrl: string,
  qualities?: ScrapeQuality[],
  referer?: string,
): PlayerSrc => {
  if (!qualities?.length) {
    return playUrl;
  }

  const refresh = extractScrapePlaybackRefreshFromPlayUrl(playUrl);
  const seen = new Set<string>();
  const renditions = [...qualities]
    .filter((quality) => quality.url.startsWith("http"))
    .map((quality) => {
      const dimensions = dimensionsForQuality(quality);
      if (!dimensions) {
        return null;
      }

      const proxied = buildScrapePlayUrl({
        url: quality.url,
        referer,
        refresh,
      });
      if (seen.has(proxied)) {
        return null;
      }

      seen.add(proxied);

      return {
        src: proxied,
        type: HLS_MIME_TYPE,
        width: dimensions.width,
        height: dimensions.height,
      };
    })
    .filter((rendition): rendition is NonNullable<typeof rendition> =>
      Boolean(rendition),
    )
    .sort((left, right) => right.height - left.height);

  if (!seen.has(playUrl)) {
    const primaryQuality = qualities.find((quality) => {
      const proxied = buildScrapePlayUrl({
        url: quality.url,
        referer,
        refresh,
      });
      return proxied === playUrl;
    });
    const dimensions = primaryQuality
      ? dimensionsForQuality(primaryQuality)
      : null;

    if (dimensions) {
      renditions.unshift({
        src: playUrl,
        type: HLS_MIME_TYPE,
        width: dimensions.width,
        height: dimensions.height,
      });
    }
  }

  const unique = renditions.filter(
    (rendition, index, list) =>
      list.findIndex((entry) => entry.src === rendition.src) === index,
  );

  if (unique.length <= 1) {
    return playUrl;
  }

  return unique;
};

const qualityHeight = (quality: ScrapeQuality): number =>
  parseQualityLabel(quality.label)?.height ?? 0;

/** Ordered play URLs to try: primary first, then alternate qualities (highest first). */
export const buildScrapeQualityPlayUrls = (
  playUrl: string,
  qualities: ScrapeQuality[] | undefined,
  referer: string | undefined,
): string[] => {
  const urls = [playUrl];
  const seen = new Set<string>([playUrl]);
  const refresh = extractScrapePlaybackRefreshFromPlayUrl(playUrl);

  if (!qualities?.length) {
    return urls;
  }

  const alternates = [...qualities]
    .filter((quality) => quality.url.startsWith("http"))
    .sort((left, right) => qualityHeight(right) - qualityHeight(left));

  for (const quality of alternates) {
    const proxied = buildScrapePlayUrl({ url: quality.url, referer, refresh });
    if (seen.has(proxied)) {
      continue;
    }

    seen.add(proxied);
    urls.push(proxied);
  }

  return urls;
};

export const buildScrapePlayerKey = (input: {
  playUrl: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
}) => {
  const qualityKey =
    input.qualities?.map((quality) => quality.label).join(",") ?? "";
  const subtitleKey =
    input.subtitles?.map((track) => `${track.lang}:${track.url}`).join("|") ??
    "";

  return `${input.playUrl}-${qualityKey}-${subtitleKey}`;
};
