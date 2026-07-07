import {
  extractFirstMatch,
  extractJsonPreBody,
  extractM3u8Urls,
  unpackDeanEdwardsScripts,
} from "../html-utils";
import { resolveAnimeSearchQuery } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import {
  flareSolverrCreateSession,
  flareSolverrDestroySession,
  flareSolverrGet,
} from "../../flaresolverr";
import { scrapeFetchText } from "../../fetch";

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

const extractKwikUrl = (
  html: string,
  translationType: AnimeScrapeInput["translationType"],
): string | null => {
  const desiredAudio = translationType === "dub" ? "eng" : "jpn";
  const candidates = [
    ...html.matchAll(
      /<button\b([^>]+data-src="https:\/\/kwik\.[^"]+"[^>]*)>/gi,
    ),
  ]
    .map((match) => ({
      attrs: match[1] ?? "",
      url: (match[1] ?? "").match(/data-src="(https:\/\/kwik\.[^"]+)"/i)?.[1],
      audio: (match[1] ?? "").match(/data-audio="([^"]+)"/i)?.[1],
      resolution: Number(
        (match[1] ?? "").match(/data-resolution="(\d+)"/i)?.[1] ?? 0,
      ),
    }))
    .filter((candidate): candidate is typeof candidate & { url: string } =>
      Boolean(candidate.url),
    );

  const matchingAudio = candidates
    .filter((candidate) => candidate.audio === desiredAudio)
    .sort((left, right) => right.resolution - left.resolution);

  return (
    matchingAudio[0]?.url ??
    extractFirstMatch(html, /data-src="(https:\/\/kwik\.[^"]+)"/) ??
    extractFirstMatch(html, /href="(https:\/\/kwik\.[^"]+)"/)
  );
};

const unpackKwikPackedJs = (html: string): string | null =>
  unpackDeanEdwardsScripts(html)
    .flatMap(extractM3u8Urls)
    .find((url) => url.includes(".m3u8")) ?? null;

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

    const kwikUrl = extractKwikUrl(playPage.body, input.translationType);
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

    const kwikPage = await scrapeFetchText(kwikUrl, {
      Referer: `${ANIMEPAHE_ORIGIN}/`,
    });
    if (kwikPage.status !== 200 || kwikPage.text.length < 100) {
      return {
        ok: false,
        providerId,
        error: `Kwik embed request failed (${kwikPage.status}) for ${new URL(kwikUrl).hostname}`,
      };
    }

    const directM3u8 =
      extractM3u8Urls(kwikPage.text).find((url) => url.includes(".m3u8")) ??
      unpackKwikPackedJs(kwikPage.text);

    if (!directM3u8) {
      const pipeToken = extractFirstMatch(
        kwikPage.text,
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
      referer: `${new URL(kwikUrl).origin}/`,
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
