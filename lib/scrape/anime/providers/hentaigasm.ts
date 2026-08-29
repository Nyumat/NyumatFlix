import { decodeHtmlEntities, extractFirstMatch } from "../html-utils";
import {
  fetchAnilistMediaMeta,
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import { shouldIncludeHentaigasmProvider } from "../hentaigasm-eligible";
import { buildAdultCatalogSearchQueries } from "../adult-catalog-search";
import { expandAdultAnimeSlugAliases } from "../adult-title-slug-aliases";
import { fuzzyMatchAnimeTitle, isExactAnimeTitleMatch } from "../title-match";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";

const HENTAIGASM_ORIGIN = "https://hentaigasm.com";
const HENTAIGASM_REFERER = `${HENTAIGASM_ORIGIN}/`;
const HENTAIGASM_WP_POSTS = `${HENTAIGASM_ORIGIN}/wp-json/wp/v2/posts`;

export type HentaigasmWpPost = {
  slug: string;
  link: string;
  title: string;
};

export type HentaigasmEpisodeSlug = {
  seriesSlug: string;
  episodeNumber: number;
};

export const slugifyHentaigasmTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const buildHentaigasmEpisodeSlug = (
  seriesSlug: string,
  episodeNumber: number,
): string => `${seriesSlug}-${episodeNumber}-subbed`;

export const parseHentaigasmEpisodeSlug = (
  slug: string,
): HentaigasmEpisodeSlug | null => {
  const match = slug
    .trim()
    .replace(/\/+$/, "")
    .match(/^([a-z0-9-]+)-(\d+)-subbed$/i);
  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    seriesSlug: match[1].toLowerCase(),
    episodeNumber: Number.parseInt(match[2], 10),
  };
};

export const stripHentaigasmPostTitle = (title: string): string =>
  decodeHtmlEntities(title)
    .replace(/\s+\d+\s+subbed\s*$/i, "")
    .trim();

export const buildHentaigasmSearchUrl = (query: string): string => {
  const url = new URL(HENTAIGASM_WP_POSTS);
  url.searchParams.set("search", query);
  url.searchParams.set("per_page", "20");
  url.searchParams.set("_fields", "id,slug,link,title,status");
  return url.toString();
};

export const parseHentaigasmWpPosts = (raw: string): HentaigasmWpPost[] => {
  try {
    const payload: unknown = JSON.parse(raw);
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload.flatMap((row) => {
      if (!row || typeof row !== "object") {
        return [];
      }

      const record = row as {
        slug?: unknown;
        link?: unknown;
        title?: unknown;
        status?: unknown;
      };
      if (record.status && record.status !== "publish") {
        return [];
      }

      const slug = typeof record.slug === "string" ? record.slug.trim() : "";
      const link = typeof record.link === "string" ? record.link.trim() : "";
      const title =
        record.title &&
        typeof record.title === "object" &&
        "rendered" in record.title &&
        typeof record.title.rendered === "string"
          ? record.title.rendered
          : "";

      if (!slug || !link) {
        return [];
      }

      return [{ slug, link, title: decodeHtmlEntities(title) }];
    });
  } catch {
    return [];
  }
};

export const pickHentaigasmWpEpisode = (
  posts: readonly HentaigasmWpPost[],
  titles: readonly string[],
  seriesSlugs: readonly string[],
  episodeNumber: number,
): HentaigasmWpPost | null => {
  const slugSet = new Set(
    seriesSlugs.map((slug) => slug.toLowerCase()).filter(Boolean),
  );

  const matches = posts.filter((post) => {
    const parsed = parseHentaigasmEpisodeSlug(post.slug);
    if (!parsed || parsed.episodeNumber !== episodeNumber) {
      return false;
    }

    if (slugSet.has(parsed.seriesSlug)) {
      return true;
    }

    const postTitle = stripHentaigasmPostTitle(post.title);
    return (
      isExactAnimeTitleMatch(postTitle, titles) ||
      fuzzyMatchAnimeTitle(postTitle, titles)
    );
  });

  return (
    matches.find((post) => {
      const parsed = parseHentaigasmEpisodeSlug(post.slug);
      return parsed ? slugSet.has(parsed.seriesSlug) : false;
    }) ??
    matches.find((post) => {
      const parsed = parseHentaigasmEpisodeSlug(post.slug);
      return parsed ? !parsed.seriesSlug.endsWith("-season") : false;
    }) ??
    matches[0] ??
    null
  );
};

export const extractHentaigasmStreamUrl = (html: string): string | null =>
  extractFirstMatch(
    html,
    /jwplayer\("player_01"\)\.setup\(\{\s*file:\s*"([^"]+)"/,
  ) ??
  extractFirstMatch(html, /file:\s*"(https?:\/\/hgasm\d*\.com\/[^"]+\.mp4)"/i);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const findHentaigasmEpisodePath = (
  seriesPageHtml: string,
  episodeNumber: number,
  seriesSlug?: string,
): string | null => {
  const slugPattern = seriesSlug
    ? escapeRegExp(buildHentaigasmEpisodeSlug(seriesSlug, episodeNumber))
    : `[^"]*-${episodeNumber}-subbed`;
  const absolute = extractFirstMatch(
    seriesPageHtml,
    new RegExp(`href="(https://hentaigasm\\.com/${slugPattern}/?)"`, "i"),
  );
  if (absolute) {
    return absolute.replace(HENTAIGASM_ORIGIN, "");
  }

  return extractFirstMatch(
    seriesPageHtml,
    new RegExp(`href="(/${slugPattern}/?)"`, "i"),
  );
};

const uniqueNonEmpty = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

/**
 * In-memory cache mapping an AniList id to the Hentaigasm series slug discovered
 * via WP search. Once a series is matched (often through fuzzy title matching),
 * subsequent episodes skip the search round-trip and probe the episode path
 * directly. Server-side, per-process; safe to repopulate on a miss.
 */
const hentaigasmSeriesSlugByAnilistId = new Map<number, string>();

export const lookupHentaigasmSeriesSlug = (anilistId: number): string | null =>
  hentaigasmSeriesSlugByAnilistId.get(anilistId) ?? null;

export const rememberHentaigasmSeriesSlug = (
  anilistId: number,
  seriesSlug: string,
): void => {
  const trimmed = seriesSlug.trim().toLowerCase();
  if (trimmed) {
    hentaigasmSeriesSlugByAnilistId.set(anilistId, trimmed);
  }
};

export const clearHentaigasmSeriesSlugCache = (): void => {
  hentaigasmSeriesSlugByAnilistId.clear();
};

const isUsefulHentaigasmSearchQuery = (title: string): boolean =>
  /[a-z]{3,}/i.test(title);

const pathFromHentaigasmLink = (link: string): string | null => {
  try {
    const parsed = new URL(link);
    if (!parsed.hostname.endsWith("hentaigasm.com")) {
      return null;
    }
    const path = parsed.pathname.endsWith("/")
      ? parsed.pathname
      : `${parsed.pathname}/`;
    return path.startsWith("/") ? path : `/${path}`;
  } catch {
    return null;
  }
};

const buildSeriesSlugCandidates = (titles: string[]): string[] => {
  const slugs = titles.flatMap((title) => {
    const base = slugifyHentaigasmTitle(title);
    if (!base) {
      return [];
    }

    const withoutEpisodeSuffix = base.replace(
      /-(?:episode-)?\d+(?:-subbed)?$/,
      "",
    );
    return [base, withoutEpisodeSuffix].filter(Boolean);
  });

  return uniqueNonEmpty(
    slugs.flatMap((slug) => expandAdultAnimeSlugAliases(slug)),
  );
};

const buildEpisodePathCandidates = (
  seriesSlugs: string[],
  episodeNumber: number,
): string[] =>
  uniqueNonEmpty(
    seriesSlugs.map(
      (slug) => `/${buildHentaigasmEpisodeSlug(slug, episodeNumber)}/`,
    ),
  );

const isPlayableEpisodePage = (page: {
  status: number;
  text: string;
}): boolean =>
  page.status === 200 && Boolean(extractHentaigasmStreamUrl(page.text));

export type HentaigasmCatalogMatch = {
  path: string;
  seriesSlug: string;
  postTitle: string;
};

export const searchHentaigasmCatalogEpisode = async (
  titles: string[],
  seriesSlugs: string[],
  episodeNumber: number,
): Promise<HentaigasmCatalogMatch | null> => {
  const queries = uniqueNonEmpty(
    buildAdultCatalogSearchQueries(titles, {
      slugCandidates: seriesSlugs,
    }).filter(isUsefulHentaigasmSearchQuery),
  );

  for (const query of queries) {
    const searchPage = await scrapeFetchText(buildHentaigasmSearchUrl(query), {
      Referer: HENTAIGASM_REFERER,
      Accept: "application/json",
    });
    if (searchPage.status !== 200) {
      continue;
    }

    const match = pickHentaigasmWpEpisode(
      parseHentaigasmWpPosts(searchPage.text),
      titles,
      seriesSlugs,
      episodeNumber,
    );
    const path = match ? pathFromHentaigasmLink(match.link) : null;
    if (!path || !match) {
      continue;
    }

    const parsed = parseHentaigasmEpisodeSlug(match.slug);
    if (!parsed?.seriesSlug) {
      continue;
    }

    return {
      path,
      seriesSlug: parsed.seriesSlug,
      postTitle: stripHentaigasmPostTitle(match.title),
    };
  }

  return null;
};

const searchHentaigasmEpisodePath = async (
  titles: string[],
  seriesSlugs: string[],
  episodeNumber: number,
  anilistId: number,
): Promise<string | null> => {
  const match = await searchHentaigasmCatalogEpisode(
    titles,
    seriesSlugs,
    episodeNumber,
  );
  if (!match) {
    return null;
  }

  const episodePage = await scrapeFetchText(
    `${HENTAIGASM_ORIGIN}${match.path}`,
    {
      Referer: HENTAIGASM_REFERER,
    },
  );
  if (isPlayableEpisodePage(episodePage)) {
    rememberHentaigasmSeriesSlug(anilistId, match.seriesSlug);
    return match.path;
  }

  return null;
};

const resolveEpisodePagePath = async (
  titles: string[],
  seriesSlugs: string[],
  episodeNumber: number,
  anilistId: number,
): Promise<string | null> => {
  const cachedSlug = lookupHentaigasmSeriesSlug(anilistId);
  const orderedSlugs = cachedSlug
    ? uniqueNonEmpty([cachedSlug, ...seriesSlugs])
    : seriesSlugs;

  for (const path of buildEpisodePathCandidates(orderedSlugs, episodeNumber)) {
    const episodePage = await scrapeFetchText(`${HENTAIGASM_ORIGIN}${path}`, {
      Referer: HENTAIGASM_REFERER,
    });
    if (isPlayableEpisodePage(episodePage)) {
      return path;
    }
  }

  const searched = await searchHentaigasmEpisodePath(
    titles,
    orderedSlugs,
    episodeNumber,
    anilistId,
  );
  if (searched) {
    return searched;
  }

  for (const seriesSlug of orderedSlugs) {
    const seriesPage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}/hentai/${seriesSlug}/`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (seriesPage.status !== 200) {
      continue;
    }

    const discoveredPath = findHentaigasmEpisodePath(
      seriesPage.text,
      episodeNumber,
      seriesSlug,
    );
    if (!discoveredPath) {
      continue;
    }

    const normalizedPath = discoveredPath.startsWith("/")
      ? discoveredPath
      : `/${discoveredPath}`;
    const episodePage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}${normalizedPath}`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (isPlayableEpisodePage(episodePage)) {
      return normalizedPath.endsWith("/")
        ? normalizedPath
        : `${normalizedPath}/`;
    }
  }

  return null;
};

export async function scrapeHentaigasm(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "hentaigasm" as const;

  try {
    if (input.translationType === "dub") {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm only provides subbed streams",
      };
    }

    const meta = await fetchAnilistMediaMeta(input.anilistId);
    if (!meta || meta.titles.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm title metadata missing",
      };
    }

    if (!shouldIncludeHentaigasmProvider(meta)) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm is limited to adult or Hentai-genre titles",
      };
    }

    const query = await resolveAnimeSearchQuery(input);
    const titles = uniqueNonEmpty([
      query,
      ...(await fetchAnilistTitleCandidates(input.anilistId)),
      ...meta.titles,
    ]);
    const seriesSlugs = buildSeriesSlugCandidates(titles);

    if (seriesSlugs.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm series slug candidates missing",
        unavailable: true,
      };
    }

    const episodePath = await resolveEpisodePagePath(
      titles,
      seriesSlugs,
      input.episodeNumber,
      input.anilistId,
    );
    if (!episodePath) {
      return {
        ok: false,
        providerId,
        error: `Hentaigasm episode page not found (episode ${input.episodeNumber})`,
        unavailable: true,
      };
    }

    const episodePage = await scrapeFetchText(
      `${HENTAIGASM_ORIGIN}${episodePath}`,
      { Referer: HENTAIGASM_REFERER },
    );

    if (episodePage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `Hentaigasm episode page failed (${episodePage.status})`,
      };
    }

    const streamUrl = extractHentaigasmStreamUrl(episodePage.text);
    if (!streamUrl?.startsWith("http")) {
      return {
        ok: false,
        providerId,
        error: "Hentaigasm stream URL missing in player setup",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "mp4",
      referer: HENTAIGASM_REFERER,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error ? error.message : "Hentaigasm scrape failed",
    };
  }
}
