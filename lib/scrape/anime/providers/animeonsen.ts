import { fetchAnilistTitleCandidates } from "../anilist-meta";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetch } from "../../fetch";

const ONSEN_ORIGIN = "https://www.animeonsen.xyz";
const ONSEN_AUTH = "https://auth.animeonsen.xyz/oauth/token";
const ONSEN_API = "https://api.animeonsen.xyz/v4";

const ONSEN_CLIENT_ID = "f296be26-28b5-4358-b5a1-6259575e23b7";
const ONSEN_CLIENT_SECRET =
  "349038c4157d0480784753841217270c3c5b35f4281eaee029de21cb04084235";

type OnsenTokenResponse = { access_token?: string };
type OnsenSearchResponse = {
  result?: OnsenSearchResult[];
  data?: OnsenSearchResult[];
};
type OnsenSearchResult = {
  content_id?: string;
  content_title?: string;
  content_title_en?: string;
};
type OnsenVideoResponse = {
  uri?: { stream?: string; subtitles?: Record<string, string> };
  data?: {
    uri?: { stream?: string; subtitles?: Record<string, string> };
  };
};

let cachedToken: { value: string; expiresAt: number } | null = null;

const normalizeTitle = (title: string) =>
  title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const findMatchingOnsenResult = (
  rows: OnsenSearchResult[],
  titles: string[],
): OnsenSearchResult | undefined => {
  const expected = new Set(titles.map(normalizeTitle).filter(Boolean));
  return rows.find((row) =>
    [row.content_title, row.content_title_en].some(
      (title) => title && expected.has(normalizeTitle(title)),
    ),
  );
};

const getOnsenToken = async (): Promise<string | null> => {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    client_id: ONSEN_CLIENT_ID,
    client_secret: ONSEN_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const response = await scrapeFetch(ONSEN_AUTH, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as OnsenTokenResponse;
  if (!payload.access_token) {
    return null;
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
  };

  return payload.access_token;
};

export async function scrapeAnimeonsen(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animeonsen" as const;

  try {
    const token = await getOnsenToken();
    if (!token) {
      return { ok: false, providerId, error: "AnimeOnsen OAuth failed" };
    }

    const authHeaders = {
      Authorization: `Bearer ${token}`,
      Referer: `${ONSEN_ORIGIN}/`,
    };
    const titles = [
      input.query?.trim(),
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
    ].filter((title): title is string => Boolean(title));
    const uniqueTitles = [...new Set(titles)];
    let match: OnsenSearchResult | undefined;

    for (const query of uniqueTitles) {
      const searchResponse = await scrapeFetch(
        `${ONSEN_API}/search/${encodeURIComponent(query)}`,
        { headers: authHeaders },
      );

      if (!searchResponse.ok) {
        continue;
      }

      const payload = (await searchResponse.json()) as OnsenSearchResponse;
      const rows = payload.result ?? payload.data ?? [];
      match = findMatchingOnsenResult(rows, uniqueTitles);
      if (match) break;
    }

    const contentId = match?.content_id;
    if (!contentId) {
      return { ok: false, providerId, error: "AnimeOnsen content not found" };
    }

    const videoResponse = await scrapeFetch(
      `${ONSEN_API}/content/${contentId}/video/${input.episodeNumber}`,
      { headers: authHeaders },
    );

    if (!videoResponse.ok) {
      return {
        ok: false,
        providerId,
        error: `AnimeOnsen video failed (${videoResponse.status})`,
      };
    }

    const videoPayload = (await videoResponse.json()) as OnsenVideoResponse;
    const streamUrl =
      videoPayload.uri?.stream ?? videoPayload.data?.uri?.stream;
    const subtitleMap =
      videoPayload.uri?.subtitles ?? videoPayload.data?.uri?.subtitles;

    if (!streamUrl) {
      return {
        ok: false,
        providerId,
        error: "AnimeOnsen stream URL missing",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: streamUrl.includes(".mpd") ? "dash" : "hls",
      referer: ONSEN_ORIGIN,
      subtitles: subtitleMap
        ? Object.entries(subtitleMap).map(([lang, url]) => ({ lang, url }))
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "AnimeOnsen scrape failed",
    };
  }
}
