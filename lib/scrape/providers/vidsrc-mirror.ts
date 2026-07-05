import { flareSolverrGet } from "../flaresolverr";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

const VIDSRC_WTF_API = "https://api.vidsrc.wtf/source";
const VIDSRC_WTF_REFERER = "https://vidsrc.wtf/";

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

export async function scrapeVidsrcMirror(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidsrc-mirror";

  try {
    const apiUrl = buildVidsrcMirrorApiUrl(input);
    const solved = await flareSolverrGet(apiUrl);

    if (!solved || solved.status !== 200) {
      return {
        ok: false,
        providerId,
        error: solved
          ? `VidSrc Mirror API failed (${solved.status})`
          : "VidSrc Mirror requires FlareSolverr",
      };
    }

    const payload = parseVidsrcMirrorBody(solved.body);
    const streamUrl = payload?.stream?.url;

    if (!streamUrl?.startsWith("http")) {
      return {
        ok: false,
        providerId,
        error: "VidSrc Mirror stream URL missing",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      referer: VIDSRC_WTF_REFERER,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "VidSrc Mirror scrape failed unexpectedly",
    };
  }
}
