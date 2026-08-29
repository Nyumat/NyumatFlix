import { scrapeFetchText } from "../fetch";
import type { VixsrcPlaybackRefresh } from "../vixsrc-constants";
import {
  buildVixsrcPlaylistUrl,
  extractVixsrcPlaylistParams,
  originOfVixsrcUrl,
  VIXSRC_ORIGIN,
} from "../vixsrc-shared";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

const DEFAULT_FLARESOLVERR_URL = "http://localhost:8191/v1";
const FLARESOLVERR_TIMEOUT_MS = 90_000;

type VixsrcApiPayload = {
  src?: string;
};

type FlareSolverrSolution = {
  status?: number;
  response?: string;
  url?: string;
};

type FlareSolverrPayload = {
  status?: string;
  message?: string;
  solution?: FlareSolverrSolution;
};

export const buildVixsrcApiUrl = (input: ScrapeMediaInput): string => {
  switch (input.mediaType) {
    case "movie":
      return `${VIXSRC_ORIGIN}/api/movie/${input.tmdbId}`;
    case "tv":
      return `${VIXSRC_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
    default: {
      const exhaustive: never = input.mediaType;
      throw new Error(`Unsupported VixSrc media type: ${exhaustive}`);
    }
  }
};

export const buildVixsrcPageUrl = (input: ScrapeMediaInput): string => {
  switch (input.mediaType) {
    case "movie":
      return `${VIXSRC_ORIGIN}/movie/${input.tmdbId}`;
    case "tv":
      return `${VIXSRC_ORIGIN}/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
    default: {
      const exhaustive: never = input.mediaType;
      throw new Error(`Unsupported VixSrc media type: ${exhaustive}`);
    }
  }
};

const absoluteEmbedUrl = (src: string): string => {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    return src;
  }
  if (src.startsWith("/")) {
    return `${VIXSRC_ORIGIN}${src}`;
  }
  return `${VIXSRC_ORIGIN}/${src}`;
};

const isChromeErrorPage = (html: string): boolean =>
  /Copyright 2017 The Chromium Authors/i.test(html) ||
  /net::ERR_/i.test(html) ||
  /ERR_PROXY_CONNECTION_FAILED/i.test(html);

const isCloudflareChallenge = (html: string): boolean =>
  /Attention Required|Just a moment|cf-browser-verification|challenge-platform/i.test(
    html,
  );

const normalizeVixsrcApiPayload = (
  payload: VixsrcApiPayload,
): VixsrcApiPayload => {
  if (!payload.src) {
    return payload;
  }

  // API JSON is often HTML-wrapped; query strings arrive as &amp; in <pre> bodies.
  return {
    ...payload,
    src: payload.src.replace(/&amp;/g, "&"),
  };
};

export const parseVixsrcApiBody = (text: string): VixsrcApiPayload | null => {
  const trimmed = text.trim();
  const tryParse = (raw: string): VixsrcApiPayload | null => {
    try {
      return normalizeVixsrcApiPayload(JSON.parse(raw) as VixsrcApiPayload);
    } catch {
      return null;
    }
  };

  const direct = tryParse(trimmed);
  if (direct) {
    return direct;
  }

  const pre = trimmed.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)?.[1];
  if (pre) {
    const fromPre = tryParse(pre.trim());
    if (fromPre) {
      return fromPre;
    }
  }

  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? tryParse(match[0]) : null;
};

const isCloudflareIpBan = (html: string): boolean =>
  /Sorry, you have been blocked/i.test(html) ||
  /Cloudflare has blocked this request/i.test(html);

export const isVixsrcCloudflareIpBan = (
  status: number,
  html: string,
): boolean =>
  isCloudflareIpBan(html) ||
  (status === 403 &&
    /cf-|cloudflare/i.test(html) &&
    !isCloudflareChallenge(html));

/** Chromium rejects a trailing slash on HTTP proxy URLs (fake 200 error page). */
export const rewriteVixsrcFlareSolverrProxyUrl = (
  proxyUrl: string,
  options: { dockerHost?: boolean } = {},
): string | null => {
  try {
    const parsed = new URL(proxyUrl);
    if (
      options.dockerHost &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
    ) {
      parsed.hostname = "host.docker.internal";
    }
    const auth =
      parsed.username || parsed.password
        ? `${parsed.username}:${parsed.password}@`
        : "";
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${auth}${parsed.hostname}${port}`;
  } catch {
    return null;
  }
};

const flareSolverrProxyCandidates = (
  proxyRaw: string | undefined,
): string[] => {
  const candidates: string[] = [];
  const push = (value: string | null) => {
    if (value && !candidates.includes(value)) {
      candidates.push(value);
    }
  };
  if (proxyRaw) {
    push(rewriteVixsrcFlareSolverrProxyUrl(proxyRaw, { dockerHost: true }));
    push(rewriteVixsrcFlareSolverrProxyUrl(proxyRaw, { dockerHost: false }));
  }
  return candidates;
};

const flareSolverrGetVixsrc = async (
  url: string,
): Promise<{ status: number; text: string } | null> => {
  const endpoint = process.env.FLARESOLVERR_URL ?? DEFAULT_FLARESOLVERR_URL;
  const proxyUrls = flareSolverrProxyCandidates(
    process.env.SCRAPE_PROXY_URL?.trim(),
  );

  const bodies: Array<Record<string, unknown>> = [];
  for (const proxy of proxyUrls) {
    bodies.push({
      cmd: "request.get",
      url,
      maxTimeout: FLARESOLVERR_TIMEOUT_MS,
      proxy: { url: proxy },
    });
  }
  bodies.push({
    cmd: "request.get",
    url,
    maxTimeout: FLARESOLVERR_TIMEOUT_MS,
  });

  for (const body of bodies) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(FLARESOLVERR_TIMEOUT_MS + 5_000),
      });
      const payload = (await response.json()) as FlareSolverrPayload;
      const html = payload.solution?.response ?? "";
      const status = payload.solution?.status ?? 0;
      if (
        payload.status === "ok" &&
        status === 200 &&
        html.length > 0 &&
        !isChromeErrorPage(html) &&
        !isCloudflareChallenge(html) &&
        !isCloudflareIpBan(html)
      ) {
        return { status, text: html };
      }
      if (isChromeErrorPage(html)) {
        continue;
      }
      if (
        payload.message?.includes("IP is banned") ||
        isCloudflareIpBan(html) ||
        isCloudflareChallenge(html)
      ) {
        return null;
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const fetchVixsrcProtectedText = async (
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; text: string }> => {
  try {
    const direct = await scrapeFetchText(url, headers);
    // IP bans cannot be solved by FlareSolverr — skip the 90s challenge wait.
    if (isVixsrcCloudflareIpBan(direct.status, direct.text)) {
      return direct;
    }

    if (
      direct.status === 200 &&
      direct.text.length > 0 &&
      !isCloudflareChallenge(direct.text)
    ) {
      return direct;
    }

    if (
      direct.status === 403 ||
      direct.status === 503 ||
      direct.status === 429 ||
      isCloudflareChallenge(direct.text)
    ) {
      const solved = await flareSolverrGetVixsrc(url);
      if (solved) {
        return solved;
      }
    }

    return direct;
  } catch {
    const solved = await flareSolverrGetVixsrc(url);
    if (solved) {
      return solved;
    }
    throw new Error(`VixSrc fetch failed for ${url}`);
  }
};

const finalizeVixsrcScrape = (
  result: ScrapeResult & { ok: true },
): ScrapeResult => ({
  ...result,
  // Embed HTML is Cloudflare-protected; /playlist/ 403s through the generic
  // playback-path probe even when the signed URL is valid for browser playback.
  validated: true,
});

const scrapeFromEmbedHtml = (
  providerId: "vixsrc",
  embedUrl: string,
  html: string,
): ScrapeResult => {
  const params = extractVixsrcPlaylistParams(html);
  if (!params) {
    return {
      ok: false,
      providerId,
      error: "VixSrc embed missing playlist params",
    };
  }

  const streamUrl = buildVixsrcPlaylistUrl(params, originOfVixsrcUrl(embedUrl));
  const seedFetchedAt = Date.now();
  const expires = Number.parseInt(params.expires, 10);
  const playbackRefresh: VixsrcPlaybackRefresh = {
    providerId: "vixsrc",
    videoId: params.videoId,
    embedUrl,
    seedFetchedAt,
    ...(Number.isFinite(expires) ? { expires } : {}),
  };

  return {
    ok: true,
    providerId,
    streamUrl,
    referer: embedUrl,
    playbackRefresh,
  };
};

export async function scrapeVixsrc(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vixsrc" as const;
  const vixsrcHeaders = {
    Accept: "application/json",
    Referer: `${VIXSRC_ORIGIN}/`,
    Origin: VIXSRC_ORIGIN,
  };

  try {
    const api = await fetchVixsrcProtectedText(buildVixsrcApiUrl(input), {
      ...vixsrcHeaders,
    });

    if (isVixsrcCloudflareIpBan(api.status, api.text)) {
      return {
        ok: false,
        providerId,
        error: `VixSrc API failed (${api.status})`,
      };
    }

    if (api.status === 200) {
      const payload = parseVixsrcApiBody(api.text);
      if (payload?.src) {
        const embedUrl = absoluteEmbedUrl(payload.src);
        const embedOrigin = originOfVixsrcUrl(embedUrl);
        const embed = await fetchVixsrcProtectedText(embedUrl, {
          Referer: `${embedOrigin}/`,
          Origin: embedOrigin,
          Accept: "text/html,application/xhtml+xml,*/*",
        });
        if (embed.status !== 200) {
          return {
            ok: false,
            providerId,
            error: `VixSrc embed failed (${embed.status})`,
          };
        }
        const scraped = scrapeFromEmbedHtml(providerId, embedUrl, embed.text);
        if (!scraped.ok) {
          return scraped;
        }
        return finalizeVixsrcScrape(scraped);
      }
    }

    const pageUrl = buildVixsrcPageUrl(input);
    const page = await fetchVixsrcProtectedText(pageUrl, {
      Referer: `${VIXSRC_ORIGIN}/`,
      Origin: VIXSRC_ORIGIN,
      Accept: "text/html,application/xhtml+xml,*/*",
    });
    if (page.status === 200) {
      const fromPage = scrapeFromEmbedHtml(providerId, pageUrl, page.text);
      if (fromPage.ok) {
        return finalizeVixsrcScrape(fromPage);
      }
    }

    return {
      ok: false,
      providerId,
      error: `VixSrc API failed (${api.status})`,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "VixSrc scrape failed",
    };
  }
}
