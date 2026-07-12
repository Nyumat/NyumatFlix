import { cancelResponseBody, scrapeFetch } from "../fetch";
import { attachSubtitlesToQualities } from "../linked-config";
import { scrapeUpstreamHeaders } from "../upstream-headers";
import type {
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeResult,
  ScrapeSubtitle,
} from "../types";
import { isVidKingCdnUrl } from "../vidking-cdn-url";

const VIDKING_ORIGIN = "https://www.vidking.net";
const VIDKING_API = "https://api.wingsdatabase.com";

/**
 * VidKing embed server → API endpoint map (from their VideoPlayer bundle).
 * Prefer Oxygen: Hydrogen’s ironbubble token CDN currently 403s from our egress.
 */
const VIDKING_SOURCE_ENDPOINTS = [
  "neon2/sources-with-title", // Oxygen
  "cdn/sources-with-title", // Hydrogen
  "downloader2/sources-with-title", // Lithium
  "tejo/sources-with-title", // Titanium
  "1movies/sources-with-title", // Helium
] as const;

type VidKingSource = {
  quality?: string;
  type?: string;
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
    /\/(?:playlist|master)\.m3u8(?:[?#].*)?$/i.test(url) &&
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
      qualities: variants.length > 0 ? toQualities(variants) : [],
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

const selectVidKingMp4Source = (sources: VidKingSource[]): string | null => {
  const ranked = dedupeSources(sources)
    .filter((source): source is VidKingSource & { url: string } =>
      Boolean(
        source.url &&
          (/\/mp4\//i.test(source.url) || /\.mp4(?:[?#]|$)/i.test(source.url)),
      ),
    )
    .sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));

  return ranked[0]?.url ?? null;
};

const probeVidKingStream = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> => {
  try {
    const response = await scrapeFetch(streamUrl, {
      headers: {
        ...scrapeUpstreamHeaders(streamUrl, referer),
        ...(/\.mp4(?:[?#]|$)|\/mp4\//i.test(streamUrl)
          ? { Range: "bytes=0-1023" }
          : {}),
      },
    });

    if (!response.ok) {
      await cancelResponseBody(response);
      return false;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      return false;
    }

    if (isVidKingCdnUrl(streamUrl) || /\.m3u8/i.test(streamUrl)) {
      return Buffer.from(bytes.slice(0, 64))
        .toString("utf8")
        .includes("#EXTM3U");
    }

    // ISO BMFF / MP4
    return (
      bytes.length >= 8 &&
      bytes[4] === 0x66 &&
      bytes[5] === 0x74 &&
      bytes[6] === 0x79 &&
      bytes[7] === 0x70
    );
  } catch {
    return false;
  }
};

/** Prefer one track per language label — VidKing often repeats every lang dozens of times. */
export const mapVidKingSubtitles = (
  subtitles: VidKingSubtitle[],
): ScrapeSubtitle[] => {
  const byLang = new Map<string, ScrapeSubtitle>();

  for (const track of subtitles) {
    if (!track.url?.startsWith("http")) {
      continue;
    }

    const lang =
      track.label?.trim() ||
      track.name?.trim() ||
      track.lang?.trim() ||
      track.kind?.trim() ||
      "und";
    const key = lang.toLowerCase();
    if (byLang.has(key)) {
      continue;
    }

    byLang.set(key, { lang, url: track.url });
  }

  return [...byLang.values()];
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

    // Try each embed server independently. Merging first lets Hydrogen's dead
    // tokenized HLS outrank Oxygen's working master.
    let sawSources = false;
    let bestSubtitles: VidKingSubtitle[] = [];
    const referer = VIDKING_ORIGIN;

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

      const sources = payload.sources ?? [];
      if (sources.length > 0) {
        sawSources = true;
      }

      if ((payload.subtitles ?? []).length > bestSubtitles.length) {
        bestSubtitles = payload.subtitles ?? [];
      }

      const mappedSubtitles = mapVidKingSubtitles(bestSubtitles);
      const selected = selectVidKingSources(sources);

      if (selected && (await probeVidKingStream(selected.streamUrl, referer))) {
        return {
          ok: true,
          providerId,
          // Tokenized CDN URLs often flake on a second naive probe; playback uses
          // the session/refresh path with path-based CDN host detection.
          validated: true,
          streamUrl: selected.streamUrl,
          referer,
          qualities: attachSubtitlesToQualities(
            selected.qualities.length > 0 ? selected.qualities : undefined,
            mappedSubtitles,
          ),
          subtitles: mappedSubtitles.length > 0 ? mappedSubtitles : undefined,
        };
      }

      const mp4Url = selectVidKingMp4Source(sources);
      if (mp4Url && (await probeVidKingStream(mp4Url, referer))) {
        return {
          ok: true,
          providerId,
          validated: true,
          streamUrl: mp4Url,
          referer,
          subtitles: mappedSubtitles.length > 0 ? mappedSubtitles : undefined,
        };
      }
    }

    return {
      ok: false,
      providerId,
      error: sawSources
        ? "VidKing CDN unreachable"
        : "No HLS sources in VidKing payload",
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
