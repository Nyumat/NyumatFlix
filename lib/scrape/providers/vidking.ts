import { cancelResponseBody, scrapeFetch } from "../fetch";
import type { ScrapeMediaInput, ScrapeQuality, ScrapeResult } from "../types";

const VIDKING_ORIGIN = "https://www.vidking.net";
const VIDKING_API = "https://api.wingsdatabase.com";

const VIDKING_SOURCE_ENDPOINTS = [
  "cdn/sources-with-title",
  "downloader2/sources-with-title",
] as const;

type VidKingSource = {
  quality?: string;
  url?: string;
};

type VidKingSubtitle = {
  lang?: string;
  label?: string;
  name?: string;
  kind?: string;
  url?: string;
};

type VidKingPayload = {
  sources?: VidKingSource[];
  subtitles?: VidKingSubtitle[];
};

type VidKingSourceKind = "master" | "variant" | "flat" | "other";

const qualityRank = (quality: string | undefined): number => {
  const normalized = quality?.trim().toUpperCase() ?? "";

  if (normalized === "4K" || normalized === "2160P" || normalized === "UHD") {
    return 4;
  }
  if (normalized === "1080P" || normalized === "1080") {
    return 3;
  }
  if (normalized === "720P" || normalized === "720") {
    return 2;
  }
  if (normalized === "480P" || normalized === "480") {
    return 1;
  }
  if (normalized === "360P" || normalized === "360") {
    return 0;
  }

  return -1;
};

/** cdn1 flat media playlists masquerade as 4K but break adaptive seeking. */
export const classifyVidKingSource = (
  url: string,
  quality?: string,
): VidKingSourceKind => {
  if (/\/cdn1\/[^/]+\/playlist\.m3u8(?:[?#].*)?$/i.test(url)) {
    return "flat";
  }

  if (
    /\/playlist\.m3u8(?:[?#].*)?$/i.test(url) &&
    (quality?.trim().toLowerCase() === "auto" || !/\/\d+p\//i.test(url))
  ) {
    return "master";
  }

  if (/\/\d+p\/index\.m3u8(?:[?#].*)?$/i.test(url)) {
    return "variant";
  }

  if (/\.m3u8/i.test(url)) {
    return "variant";
  }

  return "other";
};

const dedupeSources = (sources: VidKingSource[]): VidKingSource[] => {
  const seen = new Set<string>();
  const deduped: VidKingSource[] = [];

  for (const source of sources) {
    if (!source.url || seen.has(source.url)) {
      continue;
    }

    seen.add(source.url);
    deduped.push(source);
  }

  return deduped;
};

/** Prefer adaptive master / explicit variants over cdn1 flat 4K playlists. */
export const selectVidKingSources = (
  sources: VidKingSource[],
): { streamUrl: string; qualities: ScrapeQuality[] } | null => {
  const hlsSources = sources.filter(
    (source): source is VidKingSource & { url: string } =>
      Boolean(source.url?.includes(".m3u8")),
  );

  if (!hlsSources.length) {
    return null;
  }

  const masters = hlsSources.filter(
    (source) => classifyVidKingSource(source.url, source.quality) === "master",
  );
  const variants = hlsSources
    .filter(
      (source) =>
        classifyVidKingSource(source.url, source.quality) === "variant",
    )
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  const flats = hlsSources.filter(
    (source) => classifyVidKingSource(source.url, source.quality) === "flat",
  );

  const toQualities = (items: VidKingSource[]): ScrapeQuality[] =>
    dedupeSources(items)
      .filter((source): source is VidKingSource & { url: string } =>
        Boolean(source.url),
      )
      .map((source) => ({
        label: source.quality ?? "auto",
        url: source.url,
      }));

  if (masters.length > 0) {
    const streamUrl = masters[0]?.url;
    if (!streamUrl) {
      return null;
    }

    return {
      streamUrl,
      qualities: [],
    };
  }

  if (variants.length > 0) {
    const streamUrl = variants[0]?.url;
    if (!streamUrl) {
      return null;
    }

    return {
      streamUrl,
      qualities: toQualities(variants),
    };
  }

  if (flats.length > 0) {
    const streamUrl = flats[0]?.url;
    if (!streamUrl) {
      return null;
    }

    return {
      streamUrl,
      qualities: toQualities(flats),
    };
  }

  return null;
};

const fetchVidKingPayload = async (
  endpoint: string,
  input: ScrapeMediaInput,
  seed: string,
  headers: Record<string, string>,
): Promise<VidKingPayload | null> => {
  const params = new URLSearchParams({
    tmdbId: String(input.tmdbId),
    mediaType: input.mediaType,
    imdbId: "",
    enc: "2",
    seed,
  });

  if (input.mediaType === "tv") {
    if (input.seasonNumber) params.set("season", String(input.seasonNumber));
    if (input.episodeNumber) {
      params.set("episode", String(input.episodeNumber));
    }
  }

  const encryptedResponse = await scrapeFetch(
    `${VIDKING_API}/${endpoint}?${params.toString()}`,
    { headers },
  );

  if (!encryptedResponse.ok) {
    await cancelResponseBody(encryptedResponse);
    return null;
  }

  const encrypted = await encryptedResponse.text();
  if (encrypted.length < 50) {
    return null;
  }

  const { decryptVidKingPayload } = await import("../vidking-cipher");
  const decrypted = decryptVidKingPayload(encrypted, seed, input.tmdbId);

  return JSON.parse(decrypted) as VidKingPayload;
};

export async function scrapeVidKing(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidking";
  const headers = {
    Origin: VIDKING_ORIGIN,
    Referer: `${VIDKING_ORIGIN}/`,
  };
  try {
    const seedResponse = await scrapeFetch(
      `${VIDKING_API}/seed?mediaId=${input.tmdbId}`,
      { headers },
    );

    if (!seedResponse.ok) {
      await cancelResponseBody(seedResponse);
      return {
        ok: false,
        providerId,
        error: `Seed request failed (${seedResponse.status})`,
      };
    }

    const seedPayload = (await seedResponse.json()) as { seed?: string };
    if (!seedPayload.seed) {
      return { ok: false, providerId, error: "Missing VidKing seed" };
    }

    const mergedSources: VidKingSource[] = [];
    let subtitles: VidKingSubtitle[] = [];

    for (const endpoint of VIDKING_SOURCE_ENDPOINTS) {
      const payload = await fetchVidKingPayload(
        endpoint,
        input,
        seedPayload.seed,
        headers,
      );

      if (!payload) {
        continue;
      }

      mergedSources.push(...(payload.sources ?? []));

      if ((payload.subtitles ?? []).length > subtitles.length) {
        subtitles = payload.subtitles ?? [];
      }
    }

    const selected = selectVidKingSources(mergedSources);
    if (!selected) {
      return {
        ok: false,
        providerId,
        error: "No HLS sources in VidKing payload",
      };
    }

    return {
      ok: true,
      providerId,
      streamUrl: selected.streamUrl,
      referer: VIDKING_ORIGIN,
      qualities: selected.qualities.length > 0 ? selected.qualities : undefined,
      subtitles: subtitles
        .filter((track): track is VidKingSubtitle & { url: string } =>
          Boolean(track.url),
        )
        .map((track) => ({
          lang: track.label ?? track.name ?? track.kind ?? track.lang ?? "und",
          url: track.url,
        })),
    };
  } catch (error) {
    return {
      ok: false,
      providerId,
      error:
        error instanceof Error
          ? error.message
          : "VidKing scrape failed unexpectedly",
    };
  }
}
