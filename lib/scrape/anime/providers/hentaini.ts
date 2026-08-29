import { extractFirstMatch } from "../html-utils";
import {
  fetchAnilistMediaMeta,
  fetchAnilistTitleCandidates,
  resolveAnimeSearchQuery,
} from "../anilist-meta";
import { shouldIncludeHentaigasmProvider } from "../hentaigasm-eligible";
import { expandAdultAnimeSlugAliases } from "../adult-title-slug-aliases";
import { searchHentaigasmCatalogEpisode } from "./hentaigasm";
import {
  buildHentainiEpisodePath,
  expandHentainiSlugVariants,
  slugifyHentainiTitle,
} from "../hentaini-slug";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";

export {
  buildHentainiEpisodePath,
  expandHentainiSlugVariants,
  slugifyHentainiTitle,
} from "../hentaini-slug";

const HENTAINI_ORIGIN = "https://hentaini.com";
const HENTAINI_REFERER = `${HENTAINI_ORIGIN}/`;

export const extractHentainiStreamUrl = (html: string): string | null =>
  extractFirstMatch(html, /"embedUrl":"(https?:\/\/[^"]+\.m3u8)"/) ??
  extractFirstMatch(html, /"url":\s*"(https?:\/\/[^"]+\.m3u8)"/);

export const findHentainiEpisodePath = (
  seriesPageHtml: string,
  seriesSlug: string,
  episodeNumber: number,
): string | null => {
  const escapedSlug = seriesSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const absolute = extractFirstMatch(
    seriesPageHtml,
    new RegExp(
      `href="(https://hentaini\\.com/h/${escapedSlug}/${episodeNumber})"`,
      "i",
    ),
  );
  if (absolute) {
    return absolute.replace(HENTAINI_ORIGIN, "");
  }

  return extractFirstMatch(
    seriesPageHtml,
    new RegExp(`href="(/h/${escapedSlug}/${episodeNumber})"`, "i"),
  );
};

const uniqueNonEmpty = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const buildSeriesSlugCandidates = (titles: string[]): string[] => {
  const slugs = titles.flatMap((title) => {
    const base = slugifyHentainiTitle(title);
    if (!base) {
      return [];
    }

    const withoutEpisodeSuffix = base.replace(/-(?:episode-)?\d+$/, "");
    return [base, withoutEpisodeSuffix].filter(Boolean);
  });

  return uniqueNonEmpty(
    slugs.flatMap((slug) => [
      ...expandAdultAnimeSlugAliases(slug),
      ...expandHentainiSlugVariants(slug),
    ]),
  );
};

const isPlayableEpisodePage = (page: {
  status: number;
  text: string;
}): boolean =>
  page.status === 200 && Boolean(extractHentainiStreamUrl(page.text));

const hentaigasmSeriesSlugToHentainiCandidates = (
  hentaigasmSeriesSlug: string,
  postTitle: string,
): string[] => {
  const fromSlug = slugifyHentainiTitle(
    hentaigasmSeriesSlug
      .replace(/-uncensored$/i, "")
      .replace(/-season$/i, "")
      .replace(/-/g, " "),
  );
  const fromTitle = slugifyHentainiTitle(postTitle);

  return uniqueNonEmpty(
    [fromSlug, fromTitle].flatMap((slug) => [
      slug,
      ...expandHentainiSlugVariants(slug),
    ]),
  );
};

const resolveEpisodePagePath = async (
  titles: string[],
  seriesSlugs: string[],
  episodeNumber: number,
): Promise<string | null> => {
  for (const seriesSlug of seriesSlugs) {
    const episodePath = buildHentainiEpisodePath(seriesSlug, episodeNumber);
    const episodePage = await scrapeFetchText(
      `${HENTAINI_ORIGIN}${episodePath}`,
      { Referer: HENTAINI_REFERER },
    );
    if (isPlayableEpisodePage(episodePage)) {
      return episodePath;
    }

    const seriesPage = await scrapeFetchText(
      `${HENTAINI_ORIGIN}/h/${seriesSlug}`,
      { Referer: HENTAINI_REFERER },
    );
    if (seriesPage.status !== 200) {
      continue;
    }

    const discoveredPath = findHentainiEpisodePath(
      seriesPage.text,
      seriesSlug,
      episodeNumber,
    );
    if (!discoveredPath) {
      continue;
    }

    const normalizedPath = discoveredPath.startsWith("/")
      ? discoveredPath
      : `/${discoveredPath}`;
    const discoveredPage = await scrapeFetchText(
      `${HENTAINI_ORIGIN}${normalizedPath}`,
      { Referer: HENTAINI_REFERER },
    );
    if (isPlayableEpisodePage(discoveredPage)) {
      return normalizedPath;
    }
  }

  const catalogMatch = await searchHentaigasmCatalogEpisode(
    titles,
    seriesSlugs,
    episodeNumber,
  );
  if (catalogMatch) {
    const discoveredSlugs = hentaigasmSeriesSlugToHentainiCandidates(
      catalogMatch.seriesSlug,
      catalogMatch.postTitle,
    );
    for (const seriesSlug of discoveredSlugs) {
      const episodePath = buildHentainiEpisodePath(seriesSlug, episodeNumber);
      const episodePage = await scrapeFetchText(
        `${HENTAINI_ORIGIN}${episodePath}`,
        { Referer: HENTAINI_REFERER },
      );
      if (isPlayableEpisodePage(episodePage)) {
        return episodePath;
      }
    }
  }

  return null;
};

export async function scrapeHentaini(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "hentaini" as const;

  try {
    if (input.translationType === "dub") {
      return {
        ok: false,
        providerId,
        error: "Hentaini only provides subbed streams",
      };
    }

    const meta = await fetchAnilistMediaMeta(input.anilistId);
    if (!meta || meta.titles.length === 0) {
      return {
        ok: false,
        providerId,
        error: "Hentaini title metadata missing",
      };
    }

    if (!shouldIncludeHentaigasmProvider(meta)) {
      return {
        ok: false,
        providerId,
        error: "Hentaini is limited to adult or Hentai-genre titles",
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
        error: "Hentaini series slug candidates missing",
        unavailable: true,
      };
    }

    const episodePath = await resolveEpisodePagePath(
      titles,
      seriesSlugs,
      input.episodeNumber,
    );
    if (!episodePath) {
      return {
        ok: false,
        providerId,
        error: `Hentaini episode page not found (episode ${input.episodeNumber})`,
        unavailable: true,
      };
    }

    const episodePage = await scrapeFetchText(
      `${HENTAINI_ORIGIN}${episodePath}`,
      { Referer: HENTAINI_REFERER },
    );

    if (episodePage.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `Hentaini episode page failed (${episodePage.status})`,
      };
    }

    const streamUrl = extractHentainiStreamUrl(episodePage.text);
    if (!streamUrl?.startsWith("http")) {
      return {
        ok: false,
        providerId,
        error: "Hentaini stream URL missing in episode metadata",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl,
      streamKind: "hls",
      referer: HENTAINI_REFERER,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "Hentaini scrape failed",
    };
  }
}
