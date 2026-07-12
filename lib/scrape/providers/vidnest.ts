import { scrapeFetchText } from "../fetch";
import { attachSubtitlesToQualities, dedupeSubtitles } from "../linked-config";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";
import { validateStreamUrlWithReferers } from "../validate-stream";
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

    const playable: RankedVidnestCandidate[] = [];
    const seenUrls = new Set<string>();

    const collectPlayable = async (depth: "master" | "full") => {
      for (const candidates of resolverResults) {
        for (const candidate of candidates) {
          if (seenUrls.has(candidate.streamUrl)) {
            continue;
          }

          const kind = /\.mp4(?:[?#]|$)/i.test(candidate.streamUrl)
            ? "mp4"
            : "hls";
          const validation = await validateStreamUrlWithReferers(
            candidate.streamUrl,
            candidate.referer,
            kind,
            { depth },
          );
          if (!validation.ok) {
            if (
              !isVidnestClientOnlyCdn(candidate.streamUrl) ||
              !isFreshVidnestSignedUrl(candidate.streamUrl)
            ) {
              continue;
            }

            seenUrls.add(candidate.streamUrl);
            playable.push(candidate);
            continue;
          }

          seenUrls.add(candidate.streamUrl);
          playable.push({
            ...candidate,
            referer: validation.referer ?? candidate.referer,
          });
        }
      }
    };

    // Master pass ranks candidates cheaply; full pass is the accept gate.
    await collectPlayable("master");
    const masterCandidates = [...playable];
    playable.length = 0;
    seenUrls.clear();

    if (masterCandidates.length > 0) {
      for (const candidate of masterCandidates) {
        if (seenUrls.has(candidate.streamUrl)) {
          continue;
        }
        const kind = /\.mp4(?:[?#]|$)/i.test(candidate.streamUrl)
          ? "mp4"
          : "hls";
        const validation = await validateStreamUrlWithReferers(
          candidate.streamUrl,
          candidate.referer,
          kind,
          { depth: "full" },
        );
        if (!validation.ok) {
          if (
            isVidnestClientOnlyCdn(candidate.streamUrl) &&
            isFreshVidnestSignedUrl(candidate.streamUrl)
          ) {
            seenUrls.add(candidate.streamUrl);
            playable.push(candidate);
          }
          continue;
        }
        seenUrls.add(candidate.streamUrl);
        playable.push({
          ...candidate,
          referer: validation.referer ?? candidate.referer,
        });
      }
    }

    if (playable.length === 0) {
      await collectPlayable("full");
    }

    playable.sort((left, right) => right.score - left.score);

    const primary = playable[0];
    if (!primary) {
      return {
        ok: false,
        providerId,
        error: "VidNest returned no playable streams",
      };
    }

    // Alternate resolver streams only — not ABR heights from one master.
    const qualities: ScrapeQuality[] = playable.slice(1).map((candidate) => ({
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
