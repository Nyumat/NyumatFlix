import { scrapeFetchText } from "../fetch";
import type { VidsrcPlaybackRefresh } from "../vidsrc-constants";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

const EMBED_ORIGIN = "https://vsembed.ru";
export const VIDSRC_MIRROR_EMBED_ORIGIN = "https://vidsrc-embed.ru";
const PLAYER_ORIGIN = "https://cloudorchestranova.com";

const buildEmbedUrl = (
  input: ScrapeMediaInput,
  embedOrigin = EMBED_ORIGIN,
): string => {
  if (input.mediaType === "movie") {
    return `${embedOrigin}/embed/movie?tmdb=${input.tmdbId}`;
  }

  const params = new URLSearchParams({
    tmdb: String(input.tmdbId),
    season: String(input.seasonNumber ?? 1),
    episode: String(input.episodeNumber ?? 1),
  });

  return `${embedOrigin}/embed/tv?${params.toString()}`;
};

const normalizeEmbedSrc = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "about:blank") {
    return null;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  if (trimmed.startsWith("http")) {
    return trimmed;
  }

  return null;
};

const extractIframeSrc = (html: string): string | null => {
  const playerIframeTag = html.match(
    /<iframe\b[^>]*\bid=["']player_iframe["'][^>]*>/i,
  );
  if (playerIframeTag?.[0]) {
    const srcMatch = playerIframeTag[0].match(/\bsrc=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const normalized = normalizeEmbedSrc(srcMatch[1]);
      if (normalized) {
        return normalized;
      }
    }
  }

  const playerPatterns = [
    /src=["']([^"']*(?:cloudorchestranova|\/rcp\/|\/prorcp\/)[^"']*)["']/i,
    /src=["']([^"']+)["']/i,
  ];

  for (const pattern of playerPatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const normalized = normalizeEmbedSrc(match[1]);
    if (normalized && !normalized.includes("cdnjs.cloudflare.com")) {
      return normalized;
    }
  }

  return null;
};

const extractProrcpHash = (html: string): string | null => {
  const match = html.match(/\/prorcp\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
};

const extractMasterUrl = (html: string): string | null => {
  const patterns = [
    /master_urls\s*=\s*"([^"]+)"/,
    /master_urls\s*=\s*'([^']+)'/,
    /master_url\s*=\s*"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const candidate = match[1].split(" or ")[0]?.trim();
    if (candidate?.includes(".m3u8")) {
      return candidate;
    }
  }

  return null;
};

const tokenHostFromUrl = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const scrapeVidSrcEdn = async (
  input: ScrapeMediaInput,
  embedOrigin = EMBED_ORIGIN,
  providerId = "vidsrc",
): Promise<ScrapeResult> => {
  const embedUrl = buildEmbedUrl(input, embedOrigin);
  const embed = await scrapeFetchText(embedUrl, {
    Referer: `${embedOrigin}/`,
  });

  if (embed.status !== 200) {
    return {
      ok: false,
      providerId,
      error: `Embed page failed (${embed.status})`,
    };
  }

  const iframeSrc = extractIframeSrc(embed.text);
  if (!iframeSrc) {
    return { ok: false, providerId, error: "VidSrc iframe not found" };
  }

  const playerReferer = iframeSrc;
  let playerOrigin = PLAYER_ORIGIN;
  try {
    playerOrigin = new URL(playerReferer).origin;
  } catch {
    void 0;
  }

  let prorcpHash = extractProrcpHash(iframeSrc);

  if (!prorcpHash) {
    const rcpPage = await scrapeFetchText(iframeSrc, {
      Referer: `${embedOrigin}/`,
    });
    prorcpHash = extractProrcpHash(rcpPage.text);
  }

  if (!prorcpHash) {
    return { ok: false, providerId, error: "VidSrc player hash not found" };
  }

  const playerPage = await scrapeFetchText(
    `${playerOrigin}/prorcp/${prorcpHash}`,
    { Referer: playerReferer },
  );

  const masterTemplate = extractMasterUrl(playerPage.text);
  if (!masterTemplate) {
    return { ok: false, providerId, error: "VidSrc master playlist missing" };
  }

  const tokenHost = tokenHostFromUrl(masterTemplate);
  if (!tokenHost) {
    return { ok: false, providerId, error: "VidSrc token host missing" };
  }

  const tokenResponse = await scrapeFetchText(
    `https://${tokenHost}/generate.php`,
    { Referer: `${playerOrigin}/` },
  );

  const token = tokenResponse.text.trim();
  if (!token) {
    return { ok: false, providerId, error: "VidSrc JWT token missing" };
  }

  const streamUrl = masterTemplate
    .replaceAll("__TOKEN__", token)
    .replaceAll("__TOKENPG__", token);

  const playbackRefresh: VidsrcPlaybackRefresh = {
    providerId: providerId === "vidsrc-mirror" ? "vidsrc-mirror" : "vidsrc",
    tokenHost,
    masterTemplate,
    playerOrigin,
    playerReferer,
  };

  return {
    ok: true,
    providerId,
    streamUrl,
    referer: `${playerOrigin}/`,
    playbackRefresh,
  };
};

export async function scrapeVidSrc(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidsrc";

  try {
    const embedResult = await scrapeVidSrcEdn(input);
    return embedResult;
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "VidSrc scrape failed unexpectedly",
    };
  }
}

export async function scrapeVidSrcMirrorEmbed(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  try {
    return await scrapeVidSrcEdn(
      input,
      VIDSRC_MIRROR_EMBED_ORIGIN,
      "vidsrc-mirror",
    );
  } catch (error) {
    return {
      ok: false,
      providerId: "vidsrc-mirror",
      error:
        error instanceof Error
          ? error.message
          : "VidSrc Mirror scrape failed unexpectedly",
    };
  }
}
