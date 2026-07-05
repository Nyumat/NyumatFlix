import {
  extractFirstMatch,
  extractJsonPreBody,
  extractM3u8Urls,
} from "../html-utils";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import {
  flareSolverrCreateSession,
  flareSolverrDestroySession,
  flareSolverrGet,
} from "../../flaresolverr";

const ANIMEPAHE_ORIGIN = "https://animepahe.pw";

type AnimePaheSearchItem = {
  id?: number;
  title?: string;
  session?: string;
};

type AnimePaheSearchResponse = {
  data?: AnimePaheSearchItem[];
};

type AnimePaheReleaseItem = {
  id?: number;
  session?: string;
  episode?: number;
};

type AnimePaheReleaseResponse = {
  data?: AnimePaheReleaseItem[];
};

const flareGetJson = async <T>(
  url: string,
  session: string,
): Promise<T | null> => {
  const response = await flareSolverrGet(url, 90_000, session);
  if (!response || response.status !== 200) {
    return null;
  }

  const preBody = extractJsonPreBody(response.body);
  const raw = preBody ?? response.body.trim();

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const extractKwikUrl = (html: string): string | null =>
  extractFirstMatch(html, /data-src="(https:\/\/kwik\.[^"]+)"/) ??
  extractFirstMatch(html, /href="(https:\/\/kwik\.[^"]+)"/);

const unpackKwikPackedJs = (html: string): string | null => {
  const packed = extractFirstMatch(
    html,
    /eval\(function\(p,a,c,k,e,d\)\{[\s\S]*?\}\('([^']*)'/,
  );

  if (!packed) {
    return null;
  }

  const m3u8 = packed.match(/https?:\\\/\\\/[^'\\]+\.m3u8/);
  return m3u8?.[0]?.replace(/\\\//g, "/") ?? null;
};

export async function scrapeAnimepahe(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animepahe" as const;
  const session = await flareSolverrCreateSession();

  if (!session) {
    return {
      ok: false,
      providerId,
      error: "FlareSolverr session unavailable (is Docker running?)",
    };
  }

  try {
    const query = await resolveAnimeSearchQuery(input);
    const searchPayload = await flareGetJson<AnimePaheSearchResponse>(
      `${ANIMEPAHE_ORIGIN}/api?m=search&q=${encodeURIComponent(query)}`,
      session,
    );

    const anime = searchPayload?.data?.[0];
    if (!anime?.session && !anime?.id) {
      return { ok: false, providerId, error: "AnimePahe search miss" };
    }

    const animeSession = anime.session ?? String(anime.id);
    const releasePayload = await flareGetJson<AnimePaheReleaseResponse>(
      `${ANIMEPAHE_ORIGIN}/api?m=release&id=${encodeURIComponent(animeSession)}&sort=episode_asc&page=1`,
      session,
    );

    const episodeEntry = releasePayload?.data?.find(
      (entry) => entry.episode === input.episodeNumber,
    );

    if (!episodeEntry?.session) {
      return {
        ok: false,
        providerId,
        error: `AnimePahe episode ${input.episodeNumber} not found`,
      };
    }

    const playPage = await flareSolverrGet(
      `${ANIMEPAHE_ORIGIN}/play/${animeSession}/${episodeEntry.session}`,
      90_000,
      session,
    );

    if (!playPage || playPage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: "AnimePahe play page failed via FlareSolverr",
      };
    }

    const kwikUrl = extractKwikUrl(playPage.body);
    const playPageM3u8 = extractM3u8Urls(playPage.body)[0];

    if (playPageM3u8) {
      return {
        ok: true,
        providerId,
        streamUrl: playPageM3u8,
        streamKind: "hls",
        referer: ANIMEPAHE_ORIGIN,
      };
    }

    if (!kwikUrl) {
      return {
        ok: false,
        providerId,
        error: "AnimePahe kwik embed URL missing",
      };
    }

    const kwikPage = await flareSolverrGet(kwikUrl, 90_000, session);
    if (!kwikPage || kwikPage.status !== 200 || kwikPage.body.length < 100) {
      return {
        ok: false,
        providerId,
        error:
          "Kwik embed blocked (FlareSolverr IP ban) — metadata API works, stream needs Kwik unpacker",
      };
    }

    const directM3u8 =
      extractM3u8Urls(kwikPage.body).find((url) => url.includes(".m3u8")) ??
      unpackKwikPackedJs(kwikPage.body);

    if (!directM3u8) {
      const pipeToken = extractFirstMatch(
        kwikPage.body,
        /(\w+\|\w+\|[a-f0-9]+\|\d+\|stream\|top\|[^|<]+\|vault\|https)/i,
      );

      return {
        ok: false,
        providerId,
        error: pipeToken
          ? "Kwik m3u8 requires updated pipe unpacker"
          : "Kwik m3u8 not found in page",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl: directM3u8,
      streamKind: "hls",
      referer: ANIMEPAHE_ORIGIN,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AnimePahe scrape failed",
    };
  } finally {
    await flareSolverrDestroySession(session);
  }
}
