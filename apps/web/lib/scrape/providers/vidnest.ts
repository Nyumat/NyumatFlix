import { scrapeFetchText } from "../fetch";
import { attachSubtitlesToQualities, dedupeSubtitles } from "../linked-config";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  probeScrapePlaybackPath,
} from "../playback-probe";
import { firstOkInBatches } from "../race-first";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";
import { decodeVidnestPayload } from "../vidnest-crypto";
import {
  buildVidnestMediaPath,
  extractVidnestCaptions,
  extractVidnestStreams,
  isFreshVidnestSignedUrl,
  isVidnestClientOnlyCdn,
  mapVidnestCaptions,
  refererForVidnestStream,
  type VidNestPayload,
} from "../vidnest-shared";

const VIDNEST_API_ORIGIN = "https://new.vidnest.fun";
const VIDNEST_REFERER = "https://vidnest.fun/";

export const VIDNEST_PLAYABLE_CANDIDATE_LIMIT = 4;
export const VIDNEST_PLAYABLE_CANDIDATE_BATCH = 2;
export const VIDNEST_EXTRA_QUALITIES = 3;

const VIDNEST_SCRAPE_RESOLVERS = [
  "movies5f",
  "moviebox",
  "allmovies",
  "ophim",
  "hollymoviehd",
  "videasy",
  "moviesapi",
  "klikxxi",
  "vidlink",
  "flixhq",
  "multiembed",
  "nepu",
] as const;

type RankedVidnestCandidate = {
  streamUrl: string;
  referer: string;
  label: string;
  subtitles?: ScrapeQuality["subtitles"];
  score: number;
};

const parseVidnestBody = (body: string): VidNestPayload | null => {
  try {
    const envelope = JSON.parse(body) as { data?: string };
    if (!envelope.data) {
      return null;
    }

    return JSON.parse(decodeVidnestPayload(envelope.data)) as VidNestPayload;
  } catch {
    return null;
  }
};

const scoreStream = (url: string, language?: string): number => {
  let score = 0;
  if (/\.m3u8(?:[?#]|$)/i.test(url) || /cf-master/i.test(url)) {
    score += 4;
  }
  if (/\.mp4(?:[?#]|$)/i.test(url)) {
    score += 1;
  }
  const heightMatch = language?.match(/(\d{3,4})p/i);
  if (heightMatch?.[1]) {
    score += Number.parseInt(heightMatch[1], 10) / 1000;
  }
  if (/^(?:en|english|main|auto)(?:[-_]|$)/i.test(language ?? "")) {
    score += 2;
  }
  return score;
};

const vidnestStreamKind = (streamUrl: string): "mp4" | "hls" =>
  /\.mp4(?:[?#]|$)/i.test(streamUrl) ? "mp4" : "hls";

const fetchResolverCandidates = async (
  resolver: (typeof VIDNEST_SCRAPE_RESOLVERS)[number],
  mediaPath: string,
): Promise<RankedVidnestCandidate[]> => {
  const response = await scrapeFetchText(
    `${VIDNEST_API_ORIGIN}/${resolver}/${mediaPath}`,
    {
      Accept: "application/json",
      Referer: VIDNEST_REFERER,
    },
    {
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
    },
  );

  if (response.status !== 200) {
    return [];
  }

  const payload = parseVidnestBody(response.text);
  if (!payload) {
    return [];
  }

  const subtitles = dedupeSubtitles(
    mapVidnestCaptions(extractVidnestCaptions(payload)),
  );
  const streams = extractVidnestStreams(payload);

  return streams.flatMap((stream, index) => {
    const streamUrl = stream.url;

    const language = stream.language?.trim();
    const type = stream.type?.trim();
    const labelParts = [
      resolver,
      language && language.toLowerCase() !== "auto" ? language : null,
      type && !/\.m3u8/i.test(streamUrl) ? type.toUpperCase() : null,
      streams.length > 1 ? `#${index + 1}` : null,
    ].filter(Boolean);

    return [
      {
        streamUrl,
        referer: refererForVidnestStream(streamUrl, stream.referer),
        label: labelParts.join(" · "),
        subtitles: subtitles.length > 0 ? subtitles : undefined,
        score: scoreStream(streamUrl, language),
      },
    ];
  });
};

const probeVidnestCandidate = async (
  candidate: RankedVidnestCandidate,
): Promise<true | null> => {
  if (
    isVidnestClientOnlyCdn(candidate.streamUrl) &&
    isFreshVidnestSignedUrl(candidate.streamUrl)
  ) {
    return true;
  }

  const ok = await probeScrapePlaybackPath(
    {
      url: candidate.streamUrl,
      referer: candidate.referer,
    },
    vidnestStreamKind(candidate.streamUrl),
  );
  return ok ? true : null;
};

export async function scrapeVidNest(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidnest";
  const mediaPath = buildVidnestMediaPath(input);

  if (!mediaPath) {
    return {
      ok: false,
      providerId,
      error: "VidNest requires season and episode for TV",
    };
  }

  try {
    const resolverResults = await Promise.all(
      VIDNEST_SCRAPE_RESOLVERS.map((resolver) =>
        fetchResolverCandidates(resolver, mediaPath),
      ),
    );

    const seenUrls = new Set<string>();
    const ranked = resolverResults
      .flat()
      .filter((candidate) => {
        if (seenUrls.has(candidate.streamUrl)) {
          return false;
        }
        seenUrls.add(candidate.streamUrl);
        return true;
      })
      .sort((left, right) => right.score - left.score);

    const winner = await firstOkInBatches(
      ranked.slice(0, VIDNEST_PLAYABLE_CANDIDATE_LIMIT),
      probeVidnestCandidate,
      VIDNEST_PLAYABLE_CANDIDATE_BATCH,
    );
    const primary = winner?.item;

    if (!primary) {
      return {
        ok: false,
        providerId,
        error: "VidNest returned no playable streams",
      };
    }

    if (
      isVidnestClientOnlyCdn(primary.streamUrl) &&
      !isFreshVidnestSignedUrl(primary.streamUrl)
    ) {
      return {
        ok: false,
        providerId,
        error: "VidNest signed stream URL is missing or expired",
      };
    }

    const qualities: ScrapeQuality[] = ranked
      .filter((candidate) => candidate.streamUrl !== primary.streamUrl)
      .slice(0, VIDNEST_EXTRA_QUALITIES)
      .map((candidate) => ({
        label: candidate.label,
        url: candidate.streamUrl,
        referer: candidate.referer,
        subtitles: candidate.subtitles,
      }));

    return {
      ok: true,
      providerId,
      streamUrl: primary.streamUrl,
      referer: primary.referer,
      validated: true,
      subtitles: primary.subtitles,
      qualities: attachSubtitlesToQualities(
        qualities.length > 0 ? qualities : undefined,
        primary.subtitles,
      ),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "VidNest scrape failed unexpectedly",
    };
  }
}
