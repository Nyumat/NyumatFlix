import { scrapeFetchText } from "../fetch";
import type { VixsrcPlaybackRefresh } from "../vixsrc-constants";
import {
  buildVixsrcPlaylistUrl,
  extractVixsrcPlaylistParams,
  VIXSRC_ORIGIN,
} from "../vixsrc-shared";
import type { ScrapeMediaInput, ScrapeResult } from "../types";

const buildApiUrl = (input: ScrapeMediaInput): string => {
  if (input.mediaType === "movie") {
    return `${VIXSRC_ORIGIN}/api/movie/${input.tmdbId}`;
  }

  return `${VIXSRC_ORIGIN}/api/tv/${input.tmdbId}/${input.seasonNumber ?? 1}/${input.episodeNumber ?? 1}`;
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

export async function scrapeVixsrc(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vixsrc" as const;

  try {
    const api = await scrapeFetchText(buildApiUrl(input), {
      Accept: "application/json",
      Referer: `${VIXSRC_ORIGIN}/`,
      Origin: VIXSRC_ORIGIN,
    });

    if (api.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `VixSrc API failed (${api.status})`,
      };
    }

    let src: string | undefined;
    try {
      const payload = JSON.parse(api.text) as { src?: string };
      src = payload.src;
    } catch {
      return {
        ok: false,
        providerId,
        error: "VixSrc API returned invalid JSON",
      };
    }

    if (!src) {
      return { ok: false, providerId, error: "VixSrc API missing embed src" };
    }

    const embedUrl = absoluteEmbedUrl(src);
    const embed = await scrapeFetchText(embedUrl, {
      Referer: `${VIXSRC_ORIGIN}/`,
      Origin: VIXSRC_ORIGIN,
    });

    if (embed.status !== 200) {
      return {
        ok: false,
        providerId,
        error: `VixSrc embed failed (${embed.status})`,
      };
    }

    const params = extractVixsrcPlaylistParams(embed.text);
    if (!params) {
      return {
        ok: false,
        providerId,
        error: "VixSrc embed missing playlist params",
      };
    }

    const streamUrl = buildVixsrcPlaylistUrl(params);
    const referer = embedUrl;
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
      referer,
      playbackRefresh,
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error: error instanceof Error ? error.message : "VixSrc scrape failed",
    };
  }
}
