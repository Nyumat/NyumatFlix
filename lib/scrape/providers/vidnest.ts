import { scrapeFetchText } from "../fetch";
import type { ScrapeMediaInput, ScrapeResult } from "../types";
import { validateStreamUrl } from "../validate-stream";
import { decodeVidnestPayload } from "../vidnest-crypto";
import {
  buildVidnestMediaPath,
  extractVidnestCaptions,
  extractVidnestStreams,
  mapVidnestCaptions,
  rankVidnestStreamUrls,
  refererForVidnestStream,
  type VidNestPayload,
} from "../vidnest-shared";

const VIDNEST_API_ORIGIN = "https://new.vidnest.fun";
const VIDNEST_REFERER = "https://vidnest.fun/";

/** Resolvers that most often return direct HLS (verified live). */
const VIDNEST_SCRAPE_RESOLVERS = [
  "ophim",
  "moviesapi",
  "hollymoviehd",
  "movies5f",
  "klikxxi",
  "videasy",
] as const;

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

const fetchResolver = async (
  resolver: (typeof VIDNEST_SCRAPE_RESOLVERS)[number],
  mediaPath: string,
): Promise<ScrapeResult[]> => {
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

  const subtitles = mapVidnestCaptions(extractVidnestCaptions(payload));

  return rankVidnestStreamUrls(extractVidnestStreams(payload)).map(
    (streamUrl) => ({
      ok: true,
      providerId: "vidnest",
      streamUrl,
      referer: refererForVidnestStream(streamUrl),
      subtitles: subtitles.length > 0 ? subtitles : undefined,
    }),
  );
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
    for (const resolver of VIDNEST_SCRAPE_RESOLVERS) {
      const results = await fetchResolver(resolver, mediaPath);
      for (const result of results) {
        if (
          result.ok &&
          (await validateStreamUrl(result.streamUrl, result.referer))
        ) {
          return { ...result, validated: true };
        }
      }
    }

    return {
      ok: false,
      providerId,
      error: "VidNest returned no playable streams",
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
