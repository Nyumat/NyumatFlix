import type { PlayerSrc } from "@vidstack/react";

import { vidstackCaptionMenuValue } from "@/lib/playback/vidstack-caption-menu";

import {
  buildScrapePlayUrl,
  extractScrapePlaybackRefreshFromPlayUrl,
} from "./playback";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "./types";

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

const formatScrapeSubtitleLabel = (
  lang: string,
  url: string,
  source?: string,
): string => {
  const variant = subtitleVariantLabel(url);
  const base = lang.trim() || "Unknown";
  const withVariant =
    variant && variant.length <= 3 ? `${base} (${variant})` : base;

  return source ? `${withVariant} · ${source}` : withVariant;
};

const slugifyScrapeSubtitleLang = (lang: string): string => {
  const slug = lang
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "unknown";
};

const shortScrapeUrlHash = (url: string): string => {
  let hash = 0;

  for (let index = 0; index < url.length; index += 1) {
    hash = (hash * 31 + url.charCodeAt(index)) | 0;
  }

  return (hash >>> 0).toString(36).slice(0, 8);
};

const buildScrapeSubtitleTrackId = (
  track: ScrapeSubtitle,
  url: string,
): string => {
  const langSlug = slugifyScrapeSubtitleLang(track.lang);
  return `scrape-${langSlug}-${shortScrapeUrlHash(url)}`;
};

/** Matches Vidstack `useCaptionOptions` radio `value` / React menu keys. */
export const scrapeSubtitleCaptionMenuValue = (
  track: ScrapePlayerTextTrack,
): string =>
  vidstackCaptionMenuValue({
    id: track.id,
    kind: "subtitles",
    label: track.label,
  });

const dedupeScrapeSubtitleTracksForCaptionMenu = (
  tracks: ScrapePlayerTextTrack[],
): ScrapePlayerTextTrack[] => {
  const seen = new Set<string>();

  return tracks.filter((track) => {
    const value = scrapeSubtitleCaptionMenuValue(track);
    if (seen.has(value)) {
      return false;
    }

    seen.add(value);
    return true;
  });
};

export const buildScrapeSubtitleTracks = (
  subtitles: ScrapeSubtitle[] | undefined,
  referer: string | undefined,
): ScrapePlayerTextTrack[] => {
  if (!subtitles?.length) {
    return [];
  }

  const seenUrls = new Set<string>();
  const tracks = subtitles.flatMap((track) => {
    if (!track.url.startsWith("http") || seenUrls.has(track.url)) {
      return [];
    }

    seenUrls.add(track.url);

    let trackReferer = track.referer ?? referer;
    if (!trackReferer) {
      try {
        trackReferer = new URL(track.url).origin;
      } catch {
        void 0;
      }
    }

    return [
      {
        id: buildScrapeSubtitleTrackId(track, track.url),
        src: buildScrapePlayUrl({
          url: track.url,
          referer: trackReferer,
          subtitleFormat: track.format === "ass" ? "ass" : undefined,
        }),
        lang: track.lang,
        label: formatScrapeSubtitleLabel(track.lang, track.url, track.source),
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

  return dedupeScrapeSubtitleTracksForCaptionMenu(
    ensureUniqueScrapeSubtitleLabels(tracks),
  );
};

const ensureUniqueScrapeSubtitleLabels = (
  tracks: ScrapePlayerTextTrack[],
): ScrapePlayerTextTrack[] => {
  const seen = new Map<string, number>();

  return tracks.map((track) => {
    const normalized = track.label.toLowerCase();
    const count = seen.get(normalized) ?? 0;
    seen.set(normalized, count + 1);

    if (count === 0) {
      return track;
    }

    return {
      ...track,
      label: `${track.label} (${count + 1})`,
    };
  });
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

export type ScrapeQualityPlayOption = {
  label: string;
  playUrl: string;
  subtitles?: ScrapeSubtitle[];
};

const HEIGHT_QUALITY_LABEL = /^(?:.*·\s*)?\d{2,4}p$/i;

/** True when failover options are only ABR height renditions of one master. */
export const isAbrOnlyQualityFailover = (
  options: readonly Pick<ScrapeQualityPlayOption, "label">[],
): boolean => {
  if (options.length <= 1) {
    return false;
  }

  const failoverLabels = options.slice(1).map((option) => option.label.trim());
  return (
    failoverLabels.length > 0 &&
    failoverLabels.every((label) => HEIGHT_QUALITY_LABEL.test(label))
  );
};

/** Ordered play options: primary first, then alternate qualities (highest first). */
export const buildScrapeQualityPlayOptions = (
  playUrl: string,
  qualities: ScrapeQuality[] | undefined,
  referer: string | undefined,
  topLevelSubtitles?: ScrapeSubtitle[],
): ScrapeQualityPlayOption[] => {
  const refresh = extractScrapePlaybackRefreshFromPlayUrl(playUrl);
  const directPlayback = playUrl.startsWith("http");
  const options: ScrapeQualityPlayOption[] = [];
  const seen = new Set<string>();

  const resolvePlayUrl = (quality: ScrapeQuality) => {
    if (directPlayback) {
      return quality.url;
    }

    return buildScrapePlayUrl({
      url: quality.url,
      referer: quality.referer ?? referer,
      refresh,
    });
  };

  const pushOption = (option: ScrapeQualityPlayOption) => {
    if (seen.has(option.playUrl)) {
      return;
    }
    seen.add(option.playUrl);
    options.push(option);
  };

  const sorted = [...(qualities ?? [])]
    .filter((quality) => quality.url.startsWith("http"))
    .sort((left, right) => qualityHeight(right) - qualityHeight(left));

  const primaryMatch = sorted.find((quality) => {
    const proxied = resolvePlayUrl(quality);
    return proxied === playUrl || quality.url === playUrl;
  });

  pushOption({
    label: primaryMatch?.label ?? "Auto",
    playUrl,
    subtitles: primaryMatch?.subtitles?.length
      ? primaryMatch.subtitles
      : topLevelSubtitles,
  });

  for (const quality of sorted) {
    const proxied = resolvePlayUrl(quality);
    pushOption({
      label: quality.label,
      playUrl: proxied,
      subtitles: quality.subtitles?.length
        ? quality.subtitles
        : topLevelSubtitles,
    });
  }

  return options;
};

const qualityLabelHeight = (label: string | undefined): number =>
  parseQualityLabel(label ?? "")?.height ?? 0;

/** Prefer the highest scrape quality tier instead of adaptive Auto. */
export const pickDefaultScrapeQualityIndex = (
  options: readonly Pick<ScrapeQualityPlayOption, "label">[],
): number => {
  if (options.length <= 1) {
    return 0;
  }

  let bestIndex = 0;
  let bestHeight = qualityLabelHeight(options[0]?.label);

  for (let index = 1; index < options.length; index += 1) {
    const height = qualityLabelHeight(options[index]?.label);
    if (height > bestHeight) {
      bestHeight = height;
      bestIndex = index;
    }
  }

  if (bestHeight === 0 && isAbrOnlyQualityFailover(options)) {
    return 1;
  }

  return bestIndex;
};

export const buildScrapeQualityPlayUrls = (
  playUrl: string,
  qualities: ScrapeQuality[] | undefined,
  referer: string | undefined,
): string[] =>
  buildScrapeQualityPlayOptions(playUrl, qualities, referer).map(
    (option) => option.playUrl,
  );

export const buildScrapePlayerKey = (input: {
  playUrl: string;
  qualities?: ScrapeQuality[];
  subtitles?: ScrapeSubtitle[];
  audioVersions?: ScrapeAudioVersion[];
}) => {
  const qualityKey =
    input.qualities?.map((quality) => quality.label).join(",") ?? "";
  const audioKey =
    input.audioVersions
      ?.map(
        (version) =>
          `${version.lang}:${version.hardSubs?.map((track) => track.lang).join(",") ?? ""}`,
      )
      .join("|") ?? "";

  return `${input.playUrl}-${qualityKey}-${audioKey}`;
};
