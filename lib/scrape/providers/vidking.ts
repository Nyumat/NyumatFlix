import {
  cancelResponseBody,
  resetScrapeHostEgressPreferences,
  scrapeFetch,
} from "../fetch";
import { scrapeProxyUrl } from "../proxy";
import { attachSubtitlesToQualities } from "../linked-config";
import { scrapeUpstreamHeaders } from "../upstream-headers";
import { rotateScrapeVpnEgress } from "../vpn-rotate";
import type {
  ScrapeMediaInput,
  ScrapeQuality,
  ScrapeResult,
  ScrapeSubtitle,
} from "../types";
import { isVidKingCdnUrl } from "../vidking-cdn-url";

const VIDKING_ORIGIN = "https://www.vidking.net";
const VIDKING_CDN_REFERERS = [
  "https://www.vidking.net/",
  "https://vidking.net/",
] as const;
const VIDKING_API = "https://api.wingsdatabase.com";

/**
 * VidKing embed server → API endpoint map (from their VideoPlayer bundle).
 * Query fast mirrors first; `neon2` (Oxygen) hangs on catalog misses.
 */
const VIDKING_SOURCE_ENDPOINTS = [
  "cdn/sources-with-title", // Hydrogen
  "downloader2/sources-with-title", // Lithium
  "tejo/sources-with-title", // Titanium
  "1movies/sources-with-title", // Helium
  "neon2/sources-with-title", // Oxygen — best when present, slowest on miss
] as const;

export type VidKingPlayableCandidate = {
  streamUrl: string;
  kind: "hls" | "mp4";
  qualities?: ScrapeQuality[];
  mirror: string;
  mirrorRank: number;
  sourceRank: number;
};

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

const sourceKindRank = (url: string, quality?: string): number => {
  const kind = classifyVidKingSource(url, quality);
  if (kind === "master") {
    return 400 + qualityRank(quality);
  }
  if (kind === "variant") {
    return 300 + qualityRank(quality);
  }
  if (kind === "flat") {
    return 200 + qualityRank(quality);
  }
  if (/\.m3u8/i.test(url)) {
    return 100 + qualityRank(quality);
  }
  if (/\.mp4(?:[?#]|$)|\/mp4\//i.test(url)) {
    return 280 + qualityRank(quality);
  }
  return 0;
};

/** Flatten every mirror payload into a ranked probe list (not just one pick each). */
export const collectVidKingPlayableCandidates = (
  payloads: ReadonlyArray<{
    mirror: string;
    payload: VidKingPayload | null;
  }>,
  mirrorOrder: readonly string[] = VIDKING_SOURCE_ENDPOINTS,
): VidKingPlayableCandidate[] => {
  const mirrorRank = new Map(
    mirrorOrder.map((mirror, index) => [mirror, index]),
  );
  const ranked: VidKingPlayableCandidate[] = [];
  const seenUrls = new Set<string>();

  const push = (candidate: Omit<VidKingPlayableCandidate, "mirrorRank">) => {
    if (seenUrls.has(candidate.streamUrl)) {
      return;
    }
    seenUrls.add(candidate.streamUrl);
    ranked.push({
      ...candidate,
      mirrorRank: mirrorRank.get(candidate.mirror) ?? 99,
    });
  };

  for (const { mirror, payload } of payloads) {
    if (!payload) {
      continue;
    }

    const sources = payload.sources ?? [];
    const selected = selectVidKingSources(sources);
    if (selected) {
      push({
        mirror,
        streamUrl: selected.streamUrl,
        kind: "hls",
        qualities:
          selected.qualities.length > 0 ? selected.qualities : undefined,
        sourceRank: 500,
      });
    }

    for (const source of dedupeSources(sources)) {
      if (!source.url) {
        continue;
      }

      const rank = sourceKindRank(source.url, source.quality);
      if (rank <= 0) {
        continue;
      }

      push({
        mirror,
        streamUrl: source.url,
        kind: /\.m3u8/i.test(source.url) ? "hls" : "mp4",
        sourceRank: rank,
      });
    }
  }

  return ranked.sort((a, b) => {
    if (a.mirrorRank !== b.mirrorRank) {
      return a.mirrorRank - b.mirrorRank;
    }
    if (a.sourceRank !== b.sourceRank) {
      return b.sourceRank - a.sourceRank;
    }
    return 0;
  });
};

const inferWingsdatabaseQualityLabel = (
  url: string,
  quality?: string,
): string => {
  const trimmed = quality?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (/\.mp4(?:[?#]|$)|\/mp4\//i.test(url)) {
    return "MP4";
  }
  if (/\/playlist\.m3u8|\/master\.m3u8/i.test(url)) {
    return "Auto";
  }
  return "Stream";
};

/** Every decrypted source across mirrors — exposed as quality ladder + MP4 alts. */
export const aggregateWingsdatabaseQualities = (
  payloads: ReadonlyArray<{ payload: VidKingPayload | null }>,
): ScrapeQuality[] => {
  const ranked = payloads
    .flatMap(({ payload }) => payload?.sources ?? [])
    .filter((source): source is VidKingSource & { url: string } =>
      Boolean(source.url),
    )
    .sort(
      (a, b) =>
        sourceKindRank(b.url, b.quality) - sourceKindRank(a.url, a.quality),
    );

  const seenUrls = new Set<string>();
  const qualities: ScrapeQuality[] = [];

  for (const source of ranked) {
    if (seenUrls.has(source.url)) {
      continue;
    }
    seenUrls.add(source.url);
    qualities.push({
      label: inferWingsdatabaseQualityLabel(source.url, source.quality),
      url: source.url,
    });
  }

  return qualities;
};

const qualitiesExceptPrimary = (
  qualities: ScrapeQuality[],
  streamUrl: string,
): ScrapeQuality[] | undefined => {
  const alternates = qualities.filter((quality) => quality.url !== streamUrl);
  return alternates.length > 0 ? alternates : undefined;
};

export type WingsdatabaseProbeWinner = {
  candidate: VidKingPlayableCandidate;
  referer: string;
};

export const probeFirstWingsdatabaseCandidate = async (
  candidates: VidKingPlayableCandidate[],
  referer: string,
): Promise<WingsdatabaseProbeWinner | null> => {
  const batchSize = 6;

  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const batch = candidates.slice(offset, offset + batchSize);
    const results = await Promise.all(
      batch.map(async (candidate) => {
        const winningReferer = await probeWingsdatabaseStreamReferer(
          candidate.streamUrl,
          referer,
        );
        return winningReferer ? { candidate, referer: winningReferer } : null;
      }),
    );
    const winner = results.find(
      (entry): entry is WingsdatabaseProbeWinner => entry !== null,
    );
    if (winner) {
      return winner;
    }
  }

  return null;
};

type WingsdatabaseScrapeSuccess = Extract<ScrapeResult, { ok: true }>;

export const finalizeWingsdatabaseScrape = async (options: {
  providerId: string;
  referer: string;
  payloads: ReadonlyArray<{
    mirror: string;
    payload: VidKingPayload | null;
  }>;
  mirrorOrder: readonly string[];
  mappedSubtitles: ReturnType<typeof mapVidKingSubtitles>;
  sawSources: boolean;
}): Promise<ScrapeResult> => {
  const {
    providerId,
    referer,
    payloads,
    mirrorOrder,
    mappedSubtitles,
    sawSources,
  } = options;
  const aggregatedQualities = aggregateWingsdatabaseQualities(payloads);
  const candidates = collectVidKingPlayableCandidates(payloads, mirrorOrder);
  let winner = await probeFirstWingsdatabaseCandidate(candidates, referer);

  if (!winner && sawSources && scrapeProxyUrl()) {
    const rotated = await rotateScrapeVpnEgress();
    if (rotated.ok) {
      resetScrapeHostEgressPreferences();
      winner = await probeFirstWingsdatabaseCandidate(candidates, referer);
    }
  }

  const buildSuccess = (
    streamUrl: string,
    playbackReferer: string,
    validated: boolean,
  ): WingsdatabaseScrapeSuccess => ({
    ok: true,
    providerId,
    ...(validated ? { validated: true as const } : {}),
    streamUrl,
    referer: playbackReferer,
    qualities: attachSubtitlesToQualities(
      qualitiesExceptPrimary(aggregatedQualities, streamUrl),
      mappedSubtitles,
    ),
    subtitles: mappedSubtitles.length > 0 ? mappedSubtitles : undefined,
  });

  if (winner) {
    return buildSuccess(winner.candidate.streamUrl, winner.referer, true);
  }

  return {
    ok: false,
    providerId,
    error: sawSources
      ? "Wingsdatabase CDN unreachable"
      : "No HLS sources in wingsdatabase payload",
  };
};

const probeVidKingReferers = (referer: string, streamUrl: string): string[] => {
  const referers: string[] = [];
  const seen = new Set<string>();
  const push = (value: string | undefined) => {
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    referers.push(value);
  };

  // Wings CDN currently requires vidking.net — videasy/player origins 403.
  for (const cdnReferer of VIDKING_CDN_REFERERS) {
    push(cdnReferer);
  }
  push(referer);
  try {
    push(new URL(streamUrl).origin + "/");
  } catch {
    void 0;
  }

  return referers;
};

export const probeWingsdatabaseStreamReferer = async (
  streamUrl: string,
  referer: string,
): Promise<string | null> => {
  for (const candidateReferer of probeVidKingReferers(referer, streamUrl)) {
    if (await probeVidKingStreamOnce(streamUrl, candidateReferer)) {
      return candidateReferer;
    }
  }

  return null;
};

export const probeWingsdatabaseStream = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> =>
  Boolean(await probeWingsdatabaseStreamReferer(streamUrl, referer));

const probeVidKingStreamOnce = async (
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
    {
      headers,
      timeoutMs: 8_000,
      curlFallback: false,
      retryAttempts: 1,
    },
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
    const seed = seedPayload.seed;
    if (!seed) {
      return { ok: false, providerId, error: "Missing VidKing seed" };
    }

    // Hit every embed mirror in parallel, then probe every source URL we get back.
    let sawSources = false;
    let bestSubtitles: VidKingSubtitle[] = [];
    const referer = `${VIDKING_ORIGIN}/`;

    const payloads = await Promise.all(
      VIDKING_SOURCE_ENDPOINTS.map(async (mirror) => {
        try {
          const payload = await fetchVidKingPayload(
            mirror,
            input,
            seed,
            headers,
          );
          return { mirror, payload };
        } catch {
          return { mirror, payload: null };
        }
      }),
    );

    for (const { payload } of payloads) {
      if ((payload?.sources ?? []).length > 0) {
        sawSources = true;
      }
      if ((payload?.subtitles ?? []).length > bestSubtitles.length) {
        bestSubtitles = payload?.subtitles ?? [];
      }
    }

    const mappedSubtitles = mapVidKingSubtitles(bestSubtitles);

    return finalizeWingsdatabaseScrape({
      providerId,
      referer,
      payloads,
      mirrorOrder: VIDKING_SOURCE_ENDPOINTS,
      mappedSubtitles,
      sawSources,
    });
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
