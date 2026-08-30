import { SUB1X2_SUBTITLE_ORIGIN } from "./subtitle-origin";
import { dedupeSubtitles } from "./linked-config";
import type {
  ScrapeAudioVersion,
  ScrapeQuality,
  ScrapeSubtitle,
} from "./types";

export const SUBTITLE_HARVEST_CONCURRENCY = 2;

export type SubtitleDonor = {
  referer?: string;
  source: string;
};

export type HarvestableScrapePayload = {
  subtitles?: ScrapeSubtitle[];
  qualities?: ScrapeQuality[];
  audioVersions?: ScrapeAudioVersion[];
  playUrl?: string;
  startupProbeMs?: number;
  startupProbeOk?: boolean;
};

const catalogHost = (() => {
  try {
    return new URL(SUB1X2_SUBTITLE_ORIGIN).host;
  } catch {
    return "sub.1x2.space";
  }
})();

export const isCatalogSubtitle = (track: ScrapeSubtitle): boolean => {
  try {
    return new URL(track.url).host === catalogHost;
  } catch {
    return track.url.includes(catalogHost);
  }
};

export const isVttSubtitle = (track: ScrapeSubtitle): boolean =>
  track.format === "vtt" ||
  (track.format !== "ass" &&
    track.format !== "srt" &&
    /\.vtt(?:[?#]|$)/i.test(track.url));

export const stampDonorSubtitles = (
  subtitles: ScrapeSubtitle[] | undefined,
  donor: SubtitleDonor,
): ScrapeSubtitle[] | undefined => {
  if (!subtitles?.length) {
    return subtitles;
  }

  return subtitles.map((track) => {
    if (isCatalogSubtitle(track)) {
      return track;
    }

    return {
      ...track,
      referer: track.referer ?? donor.referer,
      source: track.source ?? donor.source,
    };
  });
};

export const mergeHarvestedSubtitles = (
  existing: ScrapeSubtitle[] | undefined,
  incoming: ScrapeSubtitle[] | undefined,
): ScrapeSubtitle[] => {
  const extra = [...(incoming ?? [])].sort(
    (left, right) => Number(isVttSubtitle(right)) - Number(isVttSubtitle(left)),
  );

  return dedupeSubtitles([...(existing ?? []), ...extra]);
};

export const mergePayloadSubtitles = <T extends HarvestableScrapePayload>(
  payload: T,
  incoming: ScrapeSubtitle[],
): T => {
  if (incoming.length === 0) {
    return payload;
  }

  const subtitles = mergeHarvestedSubtitles(payload.subtitles, incoming);
  const qualities = payload.qualities?.map((quality) => ({
    ...quality,
    subtitles: mergeHarvestedSubtitles(quality.subtitles, incoming),
  }));
  const audioVersions = payload.audioVersions?.map((version) => ({
    ...version,
    subtitles: mergeHarvestedSubtitles(version.subtitles, incoming),
  }));

  return {
    ...payload,
    subtitles,
    ...(qualities ? { qualities } : {}),
    ...(audioVersions ? { audioVersions } : {}),
  };
};

export const mapWithConcurrency = async <T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  if (items.length === 0) {
    return;
  }

  let nextIndex = 0;
  const limit = Math.max(1, concurrency);
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item === undefined) {
          continue;
        }
        await worker(item);
      }
    },
  );

  await Promise.all(runners);
};
