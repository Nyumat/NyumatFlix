import { resolveAnimeSearchQueries } from "../anilist-meta";
import {
  animeSearchLabelMatches,
  stripAnimeSearchMetadata,
} from "../title-match";
import type { AnimeScrapeInput, AnimeScrapeResult } from "../types";
import { scrapeFetchText } from "../../fetch";
import type { MegaplayPlaybackRefresh } from "../../megaplay-constants";
import {
  MEGAPLAY_ORIGIN,
  resolveMegaplayEmbedStream,
  resolveMegaplaySourcesById,
} from "../../megaplay-sources";

/** Official domains per https://animepahe.ch/ */
const ANIMEPAHE_ORIGINS = [
  "https://animepahe.ch",
  "https://animepahe.ng",
] as const;

const ORIGIN_CACHE_TTL_MS = 10 * 60_000;

type CachedOrigin = {
  origin: string;
  cachedAt: number;
};

let cachedOrigin: CachedOrigin | null = null;

const cleanSearchLabel = (raw: string): string =>
  stripAnimeSearchMetadata(raw)
    .replace(/\b(Anime|Ongoing|Completed|Upcoming|Sub|Dub)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const slugifyTitle = (title: string): string =>
  title
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/['']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

const decodeBase64Utf8 = (value: string): string | null => {
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
};

const getCachedOrigin = (): string | null => {
  if (
    cachedOrigin &&
    Date.now() - cachedOrigin.cachedAt < ORIGIN_CACHE_TTL_MS
  ) {
    return cachedOrigin.origin;
  }
  return null;
};

const rememberOrigin = (origin: string): void => {
  cachedOrigin = { origin, cachedAt: Date.now() };
};

const originsToTry = (): string[] => {
  const preferred = getCachedOrigin();
  if (!preferred) {
    return [...ANIMEPAHE_ORIGINS];
  }
  return [
    preferred,
    ...ANIMEPAHE_ORIGINS.filter((origin) => origin !== preferred),
  ];
};

const isHomepageHtml = (html: string): boolean => {
  const title = html.match(/<title>([^<]+)/i)?.[1]?.trim() ?? "";
  return /^Animepahe\s*\|\s*Watch Free Anime Online/i.test(title);
};

const isValidSeriesPage = (html: string, seriesSlug: string): boolean => {
  if (!html || html.length < 800) return false;
  if (isHomepageHtml(html) && !html.includes(`/series/${seriesSlug}`)) {
    return false;
  }
  return (
    html.includes(`eplister`) ||
    html.includes(`${seriesSlug}-episode-`) ||
    new RegExp(`Watch\\s+.+\\s+Online Free`, "i").test(
      html.match(/<title>([^<]+)/i)?.[1] ?? "",
    )
  );
};

const isValidEpisodePage = (html: string): boolean => {
  if (!html || html.length < 800) return false;
  if (isHomepageHtml(html)) return false;
  return (
    /player-embed/i.test(html) ||
    /megaplay\.buzz/i.test(html) ||
    /gov-the-embed/i.test(html) ||
    /m3u8=/i.test(html) ||
    /livesportshd\.ru/i.test(html)
  );
};

type SeriesCandidate = {
  seriesPath: string;
  label: string;
};

const isDubSeriesCandidate = (candidate: SeriesCandidate): boolean =>
  /(?:^|-)dub\/?$/i.test(candidate.seriesPath) ||
  /\(\s*dub\s*\)|\bdub\b/i.test(candidate.label);

const pickSeriesCandidate = (
  candidates: SeriesCandidate[],
  expectedTitles: readonly string[],
  translationType: AnimeScrapeInput["translationType"],
): SeriesCandidate | undefined => {
  const matched = candidates.filter((candidate) =>
    animeSearchLabelMatches(candidate.label, expectedTitles),
  );
  if (matched.length === 0) {
    return undefined;
  }

  if (translationType === "dub") {
    return (
      matched.find((candidate) => isDubSeriesCandidate(candidate)) ?? matched[0]
    );
  }

  return (
    matched.find((candidate) => !isDubSeriesCandidate(candidate)) ?? matched[0]
  );
};

const parseSeriesCandidates = (
  html: string,
  origin: string,
): SeriesCandidate[] => {
  const candidates: SeriesCandidate[] = [];
  const seen = new Set<string>();

  // Prefer heading links from search hits over sidebar widgets.
  for (const match of html.matchAll(
    /<h[12]\b[^>]*>[\s\S]*?<a\b[^>]*href="((?:https?:\/\/[^"]+)?\/series\/([^"/?#]+)\/?)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h[12]>/gi,
  )) {
    const href = match[1] ?? "";
    const slug = match[2] ?? "";
    const label = cleanSearchLabel(match[3] ?? "");
    if (!slug) continue;

    let seriesPath: string;
    try {
      seriesPath = new URL(href, origin).pathname.replace(/\/?$/, "/");
    } catch {
      seriesPath = `/series/${slug}/`;
    }

    if (seen.has(seriesPath)) continue;
    seen.add(seriesPath);
    candidates.push({
      seriesPath,
      label: label || slug.replace(/-/g, " "),
    });
  }

  if (candidates.length > 0) {
    return candidates;
  }

  for (const match of html.matchAll(
    /<a\b[^>]*href="((?:https?:\/\/[^"]+)?\/series\/([^"/?#]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const href = match[1] ?? "";
    const slug = match[2] ?? "";
    const label = cleanSearchLabel(match[3] ?? "");
    if (!slug) continue;

    let seriesPath: string;
    try {
      seriesPath = new URL(href, origin).pathname.replace(/\/?$/, "/");
    } catch {
      seriesPath = `/series/${slug}/`;
    }

    if (seen.has(seriesPath)) continue;
    seen.add(seriesPath);
    candidates.push({
      seriesPath,
      label: label || slug.replace(/-/g, " "),
    });
  }

  return candidates;
};

const findSeriesPath = async (
  origin: string,
  expectedTitles: readonly string[],
  translationType: AnimeScrapeInput["translationType"],
): Promise<string | null> => {
  for (const title of expectedTitles) {
    const searchPage = await scrapeFetchText(
      `${origin}/?s=${encodeURIComponent(title)}`,
      { Referer: `${origin}/` },
    );
    if (searchPage.status !== 200) {
      continue;
    }

    const candidates = parseSeriesCandidates(searchPage.text, origin);
    const matched = pickSeriesCandidate(
      candidates,
      expectedTitles,
      translationType,
    );
    if (!matched) {
      continue;
    }

    const seriesSlug = matched.seriesPath
      .replace(/^\/series\//, "")
      .replace(/\/$/, "");
    const seriesPage = await scrapeFetchText(`${origin}${matched.seriesPath}`, {
      Referer: `${origin}/`,
    });
    if (
      seriesPage.status === 200 &&
      isValidSeriesPage(seriesPage.text, seriesSlug)
    ) {
      return matched.seriesPath;
    }
  }

  for (const title of expectedTitles) {
    const baseSlug = slugifyTitle(title);
    if (!baseSlug) continue;
    const slugCandidates =
      translationType === "dub"
        ? [`${baseSlug}-dub`, baseSlug]
        : [baseSlug, `${baseSlug}-dub`];
    for (const slug of slugCandidates) {
      const seriesPath = `/series/${slug}/`;
      const seriesPage = await scrapeFetchText(`${origin}${seriesPath}`, {
        Referer: `${origin}/`,
      });
      if (
        seriesPage.status === 200 &&
        isValidSeriesPage(seriesPage.text, slug)
      ) {
        return seriesPath;
      }
    }
  }

  return null;
};

const episodePathPatterns = (
  seriesSlug: string,
  episodeNumber: number,
  translationType: AnimeScrapeInput["translationType"],
): string[] => {
  const n = episodeNumber;
  const preferDub = translationType === "dub";
  const subPatterns = [
    `/${seriesSlug}-episode-${n}-english-subbed/`,
    `/${seriesSlug}-episode-${n}-subbed/`,
    `/${seriesSlug}-episode-${n}/`,
  ];
  const dubPatterns = [
    `/${seriesSlug}-episode-${n}-english-dubbed/`,
    `/${seriesSlug}-episode-${n}-dubbed/`,
  ];
  return preferDub
    ? [...dubPatterns, ...subPatterns]
    : [...subPatterns, ...dubPatterns];
};

const findEpisodeUrl = (
  seriesHtml: string,
  origin: string,
  seriesSlug: string,
  episodeNumber: number,
  translationType: AnimeScrapeInput["translationType"],
): string | null => {
  const hrefs = [
    ...seriesHtml.matchAll(
      /href="((?:https?:\/\/[^"]+)?\/[^"]*episode-[^"]+)"/gi,
    ),
  ].map((match) => match[1] ?? "");

  for (const pattern of episodePathPatterns(
    seriesSlug,
    episodeNumber,
    translationType,
  )) {
    const hit = hrefs.find((href) => {
      try {
        return new URL(href, origin).pathname === pattern;
      } catch {
        return href.includes(pattern);
      }
    });
    if (hit) {
      return new URL(hit, origin).toString();
    }
  }

  const episodeRe = new RegExp(
    `/${seriesSlug}-episode-${episodeNumber}(?:-[a-z0-9-]+)?/?$`,
    "i",
  );
  for (const href of hrefs) {
    try {
      const path = new URL(href, origin).pathname;
      if (episodeRe.test(path)) {
        return new URL(href, origin).toString();
      }
    } catch {
      continue;
    }
  }

  return null;
};

const extractIframeSrc = (html: string): string | null => {
  const match = html.match(/<iframe\b[^>]*\bsrc=["']([^"']+)["']/i);
  return match?.[1]?.trim() || null;
};

/** Collect primary iframe + putMi server embeds from episode HTML. */
const extractEpisodeEmbedUrls = (episodeHtml: string): string[] => {
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (!trimmed || seen.has(trimmed)) return;
    if (!/^https?:\/\//i.test(trimmed)) return;
    seen.add(trimmed);
    urls.push(trimmed);
  };

  for (const match of episodeHtml.matchAll(
    /<iframe\b[^>]*\bsrc=["']([^"']+)["']/gi,
  )) {
    push(match[1]);
  }

  for (const match of episodeHtml.matchAll(
    /putMi\(\s*this\s*,\s*'([A-Za-z0-9+/=]+)'/gi,
  )) {
    const decoded = decodeBase64Utf8(match[1] ?? "");
    if (!decoded) continue;
    push(extractIframeSrc(decoded));
    for (const urlMatch of decoded.matchAll(/https?:\/\/[^\s"'<>]+/gi)) {
      push(urlMatch[0]?.replace(/&amp;/g, "&"));
    }
  }

  return urls;
};

const extractDirectM3u8FromEmbedUrl = (embedUrl: string): string | null => {
  try {
    const parsed = new URL(embedUrl);
    const fromQuery =
      parsed.searchParams.get("m3u8") ??
      parsed.searchParams.get("url") ??
      parsed.searchParams.get("file");
    if (fromQuery && /^https?:\/\//i.test(fromQuery)) {
      return fromQuery;
    }
  } catch {
    void 0;
  }

  const inline = embedUrl.match(/m3u8=(https?:\/\/[^&"'>\s]+)/i)?.[1];
  return inline ? decodeURIComponent(inline) : null;
};

const resolveEpisodeStream = async (
  episodeHtml: string,
  pageReferer: string,
): Promise<{
  streamUrl: string;
  referer: string;
  playbackRefresh?: MegaplayPlaybackRefresh;
  subtitles?: Array<{ lang: string; url: string; format: "vtt" }>;
} | null> => {
  const embeds = extractEpisodeEmbedUrls(episodeHtml);

  const subtitles: Array<{ lang: string; url: string; format: "vtt" }> = [];
  for (const embed of embeds) {
    try {
      const subtitle = new URL(embed).searchParams.get("subtitle");
      if (
        subtitle &&
        /^https?:\/\//i.test(subtitle) &&
        /\.vtt(?:[?#]|$)/i.test(subtitle)
      ) {
        subtitles.push({ lang: "English", url: subtitle, format: "vtt" });
        break;
      }
    } catch {
      continue;
    }
  }

  for (const embed of embeds) {
    if (!/megaplay\.buzz/i.test(embed)) continue;
    const resolved = await resolveMegaplayEmbedStream(embed);
    if (resolved) {
      const referer = `${MEGAPLAY_ORIGIN}/`;
      return {
        streamUrl: resolved.streamUrl,
        referer,
        playbackRefresh: {
          providerId: "megaplay",
          referer,
          seedStreamUrl: resolved.streamUrl,
          megaplayId: resolved.megaplayId,
        },
        ...(subtitles.length > 0 ? { subtitles } : {}),
      };
    }
  }

  for (const embed of embeds) {
    const direct = extractDirectM3u8FromEmbedUrl(embed);
    if (direct) {
      let referer = pageReferer;
      try {
        referer = `${new URL(embed).origin}/`;
      } catch {
        void 0;
      }
      return {
        streamUrl: direct,
        referer,
        ...(subtitles.length > 0 ? { subtitles } : {}),
      };
    }
  }

  // Legacy: bare data-id on the episode page itself.
  for (const match of episodeHtml.matchAll(/data-id="(\d+)"/gi)) {
    const megaplayId = match[1] ?? "";
    const streamUrl = await resolveMegaplaySourcesById(megaplayId);
    if (streamUrl) {
      const referer = `${MEGAPLAY_ORIGIN}/`;
      return {
        streamUrl,
        referer,
        playbackRefresh: {
          providerId: "megaplay",
          referer,
          seedStreamUrl: streamUrl,
          megaplayId,
        },
        ...(subtitles.length > 0 ? { subtitles } : {}),
      };
    }
  }

  return null;
};

export async function scrapeAnimepahe(
  input: AnimeScrapeInput,
): Promise<AnimeScrapeResult> {
  const providerId = "animepahe" as const;

  try {
    const expectedTitles = await resolveAnimeSearchQueries(input);

    let origin: string | null = null;
    let seriesPath: string | null = null;

    for (const candidateOrigin of originsToTry()) {
      const found = await findSeriesPath(
        candidateOrigin,
        expectedTitles,
        input.translationType,
      );
      if (found) {
        origin = candidateOrigin;
        seriesPath = found;
        rememberOrigin(candidateOrigin);
        break;
      }
    }

    if (!origin || !seriesPath) {
      return {
        ok: false,
        providerId,
        error: "AnimePahe exact title match not found",
      };
    }

    const seriesSlug = seriesPath.replace(/^\/series\//, "").replace(/\/$/, "");
    const seriesPage = await scrapeFetchText(`${origin}${seriesPath}`, {
      Referer: `${origin}/`,
    });
    if (
      seriesPage.status !== 200 ||
      !isValidSeriesPage(seriesPage.text, seriesSlug)
    ) {
      return {
        ok: false,
        providerId,
        error: `AnimePahe series page failed (${seriesPage.status})`,
      };
    }

    let episodeUrl = findEpisodeUrl(
      seriesPage.text,
      origin,
      seriesSlug,
      input.episodeNumber,
      input.translationType,
    );

    let episodeHtml: string | null = null;

    const tryEpisodeUrl = async (url: string): Promise<boolean> => {
      const page = await scrapeFetchText(url, {
        Referer: `${origin}${seriesPath}`,
      });
      if (page.status === 200 && isValidEpisodePage(page.text)) {
        episodeUrl = url;
        episodeHtml = page.text;
        return true;
      }
      return false;
    };

    if (episodeUrl) {
      const ok = await tryEpisodeUrl(episodeUrl);
      if (!ok) {
        episodeUrl = null;
      }
    }

    if (!episodeHtml) {
      for (const path of episodePathPatterns(
        seriesSlug,
        input.episodeNumber,
        input.translationType,
      )) {
        if (await tryEpisodeUrl(`${origin}${path}`)) {
          break;
        }
      }
    }

    if (!episodeUrl || !episodeHtml) {
      return {
        ok: false,
        providerId,
        error: `AnimePahe episode ${input.episodeNumber} not found`,
      };
    }

    const resolved = await resolveEpisodeStream(episodeHtml, episodeUrl);
    if (!resolved) {
      return {
        ok: false,
        providerId,
        error: "AnimePahe stream embed missing",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl: resolved.streamUrl,
      streamKind: "hls",
      referer: resolved.referer,
      ...(resolved.playbackRefresh
        ? { playbackRefresh: resolved.playbackRefresh }
        : {}),
      ...(resolved.subtitles ? { subtitles: resolved.subtitles } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "AnimePahe scrape failed",
    };
  }
}
