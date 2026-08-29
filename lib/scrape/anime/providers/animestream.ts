import { stripSeasonSuffix } from "@/lib/anilist-franchise";
import {
  fetchAnilistMediaMeta,
  resolveAnimeSearchQueries,
} from "../anilist-meta";
import {
  animeFranchisePrefixMatch,
  animeSearchLabelMatches,
  isExactAnimeTitleMatch,
} from "../title-match";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { cancelResponseBody, scrapeFetch, scrapeFetchText } from "../../fetch";

/** Site captured in animestream.my.id HAR (replaces dead UniqueStream API). */
const ANIMESTREAM_ORIGIN = "https://animestream.my.id";
const ANIMESTREAM_REFERER = `${ANIMESTREAM_ORIGIN}/`;

type AnimestreamSearchHit = {
  title?: string;
  slug?: string;
  type?: string;
  year?: string;
};

type AnimestreamSearchResponse = {
  status?: string;
  data?: AnimestreamSearchHit[];
};

const parseSetCookieHeader = (header: string): string =>
  header
    .split(/,(?=\s*[A-Za-z0-9_-]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");

const decodeDataUrlValue = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return trimmed;
  }

  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();
    return decoded || null;
  } catch {
    return null;
  }
};

const warmAnimestreamSession = async (): Promise<string | null> => {
  const home = await scrapeFetch(ANIMESTREAM_ORIGIN, {
    headers: { Referer: ANIMESTREAM_REFERER },
  });
  if (!home.ok) {
    await cancelResponseBody(home);
    return null;
  }

  await cancelResponseBody(home);
  const cookie = parseSetCookieHeader(home.headers.get("set-cookie") ?? "");
  return cookie || null;
};

const sessionHeaders = (cookie: string | null): Record<string, string> => ({
  Referer: ANIMESTREAM_REFERER,
  ...(cookie ? { Cookie: cookie } : {}),
});

const searchAnimestream = async (
  query: string,
  cookie: string | null,
): Promise<AnimestreamSearchHit[]> => {
  const url = `${ANIMESTREAM_ORIGIN}/ajax.php?action=ajax-proxy&endpoint=/ajax-search&q=${encodeURIComponent(query)}`;
  const response = await scrapeFetchText(url, {
    ...sessionHeaders(cookie),
    "X-Requested-With": "XMLHttpRequest",
    Accept: "application/json, text/plain, */*",
  });
  if (response.status !== 200) {
    return [];
  }

  try {
    const payload = JSON.parse(response.text) as AnimestreamSearchResponse;
    if (payload.status !== "success" || !Array.isArray(payload.data)) {
      return [];
    }
    return payload.data;
  } catch {
    return [];
  }
};

const slugifyTitle = (title: string): string =>
  title
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/['']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const mediaTypeRank = (
  type: string | undefined,
  preferMovie: boolean,
): number => {
  const normalized = (type ?? "").toUpperCase();
  if (preferMovie) {
    return normalized === "MOVIE" ? 3 : normalized === "TV" ? 2 : 1;
  }
  return normalized === "TV" ? 3 : normalized === "MOVIE" ? 1 : 2;
};

const rankSearchHit = (
  hit: AnimestreamSearchHit,
  expectedTitles: readonly string[],
  preferMovie: boolean,
): number => {
  const title = hit.title ?? "";
  let score = -1;

  if (isExactAnimeTitleMatch(title, expectedTitles)) {
    score = 90;
  } else if (animeSearchLabelMatches(title, expectedTitles)) {
    score = 70;
  } else if (
    expectedTitles.some((expected) =>
      animeFranchisePrefixMatch(title, expected),
    )
  ) {
    score = 55;
  }

  if (score < 0) {
    return -1;
  }

  return score + mediaTypeRank(hit.type, preferMovie);
};

const selectSearchHit = (
  hits: AnimestreamSearchHit[],
  expectedTitles: readonly string[],
  preferMovie: boolean,
): AnimestreamSearchHit | undefined => {
  const withSlug = hits.filter((hit) => Boolean(hit.slug && hit.title));
  return [...withSlug]
    .map((hit) => ({
      hit,
      score: rankSearchHit(hit, expectedTitles, preferMovie),
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)[0]?.hit;
};

const fetchEpisodePage = async (
  episodePath: string,
  cookie: string | null,
): Promise<{ status: number; text: string }> =>
  scrapeFetchText(
    `${ANIMESTREAM_ORIGIN}${episodePath}`,
    sessionHeaders(cookie),
  );

const resolveEpisodePage = async (
  seriesSlug: string,
  episodeNumber: number,
  cookie: string | null,
): Promise<{ text: string } | null> => {
  const paths = [`${seriesSlug}/episode-${episodeNumber}`];
  if (episodeNumber === 1) {
    paths.push(`${seriesSlug}/episode-1`);
  }

  for (const episodePath of paths) {
    const episodePage = await fetchEpisodePage(episodePath, cookie);
    if (episodePage.text.length < 800) {
      continue;
    }

    if (
      /page not found|404/i.test(
        episodePage.text.match(/<title>([^<]+)/i)?.[1] ?? "",
      )
    ) {
      continue;
    }

    const playerId = extractPlayerId(episodePage.text);
    if (playerId) {
      return { text: episodePage.text };
    }
  }

  return null;
};

const normalizeSeriesSlug = (slug: string): string => {
  const trimmed = slug.trim();
  if (!trimmed) return "";
  try {
    const path = trimmed.startsWith("http")
      ? new URL(trimmed).pathname
      : trimmed;
    return path.replace(/^\/anime\//, "/").replace(/\/+$/, "") || "";
  } catch {
    return trimmed.replace(/^\/anime\//, "/").replace(/\/+$/, "");
  }
};

const extractPlayerId = (episodeHtml: string): string | null => {
  for (const match of episodeHtml.matchAll(/data-url=["']([^"']+)["']/gi)) {
    const decoded = decodeDataUrlValue(match[1] ?? "");
    if (!decoded) continue;
    const fromPlayer = decoded.match(
      /player\.tikungan\.store\/([A-Za-z0-9_-]+)/i,
    )?.[1];
    if (fromPlayer) return fromPlayer;
  }

  return (
    episodeHtml.match(/player\.tikungan\.store\/([A-Za-z0-9_-]+)/i)?.[1] ?? null
  );
};

const buildMasterPlaylistUrl = (playerId: string): string =>
  `https://player.tikungan.store/img.banter03.click/${playerId}/master.m3u8`;

export async function scrapeAnimestream(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animestream" as const;

  try {
    const expectedTitles = await resolveAnimeSearchQueries(input);
    const mediaMeta = await fetchAnilistMediaMeta(input.anilistId);
    const preferMovie =
      mediaMeta?.format === "MOVIE" || mediaMeta?.episodes === 1;

    const cookie = await warmAnimestreamSession();
    let hit: AnimestreamSearchHit | undefined;

    for (const title of expectedTitles) {
      const results = await searchAnimestream(title, cookie);
      hit = selectSearchHit(results, expectedTitles, preferMovie);
      if (hit?.slug) break;
    }

    let seriesSlug = hit?.slug ? normalizeSeriesSlug(hit.slug) : "";

    if (!seriesSlug) {
      for (const title of expectedTitles) {
        const slug = slugifyTitle(title);
        if (!slug) continue;
        const probe = await resolveEpisodePage(
          `/${slug}`,
          input.episodeNumber,
          cookie,
        );
        if (probe) {
          seriesSlug = `/${slug}`;
          break;
        }
      }
    }

    if (!seriesSlug) {
      return {
        ok: false,
        providerId,
        error: "AnimeStream series search miss",
      };
    }

    const episodePage = await resolveEpisodePage(
      seriesSlug,
      input.episodeNumber,
      cookie,
    );
    if (!episodePage) {
      return {
        ok: false,
        providerId,
        error: `AnimeStream episode ${input.episodeNumber} not found`,
      };
    }

    const playerId = extractPlayerId(episodePage.text);
    if (!playerId) {
      return {
        ok: false,
        providerId,
        error: "AnimeStream player embed missing",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl: buildMasterPlaylistUrl(playerId),
      streamKind: "hls",
      referer: ANIMESTREAM_REFERER,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "AnimeStream scrape failed",
    };
  }
}

export { resolveScrapeAudioVariantUrl as resolveUniqueStreamVariantUrl } from "../../audio-versions";
