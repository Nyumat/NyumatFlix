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
import { decryptVidKingPayload } from "../vidking-cipher";
import { isVidKingCdnUrl } from "../vidking-cdn-url";
import {
  SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  SCRAPE_PLAY_PROBE_TIMEOUT_MS,
} from "../playback-probe";
import {
  getWingsCdnReferers,
  WINGS_SOURCE_FETCH_TIMEOUT_MS,
  wingsApiHeaders,
  wingsSourceUrl,
} from "../vidking-constants";
import { fetchWingsSeed } from "../wings-api-discover";
import { type WingsTmdbLookup, resolveWingsTmdbLookup } from "../tmdb-lookup";
import { anyAbortSignal } from "../abort";
import { firstOkInBatches, raceFirstOk } from "../race-first";
import { scrapeNow } from "../stage-timing";

/**
 * VidKing embed server → API endpoint map (VideoPlayer bundle, 2026-08).
 * `meine` is German-only; skip it for the default English scrape.
 */
const VIDKING_SOURCE_ENDPOINTS = [
  "cdn/sources-with-title", // Yoru
  "downloader2/sources-with-title", // Cypher
  "m4uhd/sources-with-title", // Breach
  "vsrc/sources-with-title", // Neon
  "hdmovie/sources-with-title", // Vyse / Fade
  "superflix/sources-with-title", // Raze
  "lamovie/sources-with-title", // Omen
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

  if (
    /\/\d+p\/index\.m3u8(?:[?#].*)?$/i.test(url) ||
    /index-s\d+p/i.test(url)
  ) {
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
  const indexed = url.match(/index-s(\d+)p/i);
  if (indexed?.[1]) {
    return `${indexed[1]}p`;
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

export const WINGS_PROBE_CONCURRENCY = 6;

export type WingsdatabaseStreamProbe = (
  streamUrl: string,
  referer: string,
  signal: AbortSignal,
) => Promise<string | null>;

export const probeFirstWingsdatabaseCandidate = async (
  candidates: VidKingPlayableCandidate[],
  referer: string,
  options: { signal?: AbortSignal; probe?: WingsdatabaseStreamProbe } = {},
): Promise<WingsdatabaseProbeWinner | null> => {
  const probe = options.probe ?? probeWingsdatabaseStreamReferer;
  const winner = await firstOkInBatches(
    candidates,
    (candidate, signal) => probe(candidate.streamUrl, referer, signal),
    WINGS_PROBE_CONCURRENCY,
    { signal: options.signal },
  );
  return winner ? { candidate: winner.item, referer: winner.value } : null;
};

export type WingsdatabaseMirrorPayload = {
  mirror: string;
  payload: VidKingPayload | null;
};

export type WingsdatabaseMirrorRace = {
  winner: WingsdatabaseProbeWinner | null;
  payloads: WingsdatabaseMirrorPayload[];
  candidates: VidKingPlayableCandidate[];
};

/**
 * probes candidates as each mirror answers instead of waiting for every mirror,
 * and aborts outstanding mirror requests and probes once one candidate validates.
 */
export const raceWingsdatabaseMirrors = async (options: {
  mirrors: readonly string[];
  referer: string;
  fetchPayload: (
    mirror: string,
    signal: AbortSignal,
  ) => Promise<VidKingPayload | null>;
  probe?: WingsdatabaseStreamProbe;
  concurrency?: number;
  signal?: AbortSignal;
}): Promise<WingsdatabaseMirrorRace> => {
  const probe = options.probe ?? probeWingsdatabaseStreamReferer;
  const concurrency = Math.max(
    1,
    options.concurrency ?? WINGS_PROBE_CONCURRENCY,
  );
  const controller = new AbortController();
  const signal = options.signal
    ? anyAbortSignal(controller.signal, options.signal)
    : controller.signal;
  const payloads: WingsdatabaseMirrorPayload[] = [];
  const candidates: VidKingPlayableCandidate[] = [];
  const seenUrls = new Set<string>();
  const queue: VidKingPlayableCandidate[] = [];

  const winner = await new Promise<WingsdatabaseProbeWinner | null>(
    (resolve) => {
      let settled = false;
      let pendingMirrors = options.mirrors.length;
      let activeProbes = 0;

      const finish = (result: WingsdatabaseProbeWinner | null) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      const finishIfExhausted = () => {
        if (pendingMirrors === 0 && activeProbes === 0 && queue.length === 0) {
          finish(null);
        }
      };

      const pump = () => {
        while (!settled && activeProbes < concurrency && queue.length > 0) {
          const candidate = queue.shift();
          if (!candidate) {
            break;
          }
          activeProbes += 1;
          void probe(candidate.streamUrl, options.referer, signal)
            .catch(() => null)
            .then((winningReferer) => {
              activeProbes -= 1;
              if (winningReferer && !signal.aborted) {
                finish({ candidate, referer: winningReferer });
                return;
              }
              pump();
              finishIfExhausted();
            });
        }
      };

      if (signal.aborted) {
        finish(null);
        return;
      }
      signal.addEventListener("abort", () => finish(null), { once: true });

      for (const mirror of options.mirrors) {
        void options
          .fetchPayload(mirror, signal)
          .catch(() => null)
          .then((payload) => {
            pendingMirrors -= 1;
            payloads.push({ mirror, payload });
            for (const candidate of collectVidKingPlayableCandidates(
              [{ mirror, payload }],
              options.mirrors,
            )) {
              if (seenUrls.has(candidate.streamUrl)) {
                continue;
              }
              seenUrls.add(candidate.streamUrl);
              candidates.push(candidate);
              queue.push(candidate);
            }
            pump();
            finishIfExhausted();
          });
      }

      finishIfExhausted();
    },
  );

  controller.abort();
  return { winner, payloads: [...payloads], candidates: [...candidates] };
};

type WingsdatabaseScrapeSuccess = Extract<ScrapeResult, { ok: true }>;

const bestWingsdatabaseSubtitles = (
  payloads: readonly WingsdatabaseMirrorPayload[],
): ScrapeSubtitle[] => {
  let best: VidKingSubtitle[] = [];
  for (const { payload } of payloads) {
    if ((payload?.subtitles ?? []).length > best.length) {
      best = payload?.subtitles ?? [];
    }
  }
  return mapVidKingSubtitles(best);
};

export const scrapeWingsdatabaseMirrors = async (options: {
  providerId: string;
  referer: string;
  mirrors: readonly string[];
  fetchPayload: (
    mirror: string,
    signal: AbortSignal,
  ) => Promise<VidKingPayload | null>;
  input: ScrapeMediaInput;
}): Promise<ScrapeResult> => {
  const { providerId, referer, input } = options;
  const raceStartedAt = scrapeNow();
  const race = await raceWingsdatabaseMirrors({
    mirrors: options.mirrors,
    referer,
    fetchPayload: options.fetchPayload,
    signal: input.signal,
  });
  input.timing?.since("mirrors", raceStartedAt);

  const sawSources = race.payloads.some(
    ({ payload }) => (payload?.sources ?? []).length > 0,
  );
  let winner = race.winner;

  if (!winner && sawSources && !input.signal?.aborted && scrapeProxyUrl()) {
    const rotated = await rotateScrapeVpnEgress();
    if (rotated.ok) {
      resetScrapeHostEgressPreferences();
      const retryStartedAt = scrapeNow();
      winner = await probeFirstWingsdatabaseCandidate(
        race.candidates,
        referer,
        { signal: input.signal },
      );
      input.timing?.since("validation", retryStartedAt);
    }
  }

  if (!winner) {
    return {
      ok: false,
      providerId,
      error: sawSources
        ? "Wingsdatabase CDN unreachable"
        : "No HLS sources in wingsdatabase payload",
    };
  }

  const mappedSubtitles = bestWingsdatabaseSubtitles(race.payloads);
  const streamUrl = winner.candidate.streamUrl;
  const success: WingsdatabaseScrapeSuccess = {
    ok: true,
    providerId,
    validated: true,
    streamUrl,
    referer: winner.referer,
    qualities: attachSubtitlesToQualities(
      qualitiesExceptPrimary(
        aggregateWingsdatabaseQualities(race.payloads),
        streamUrl,
      ),
      mappedSubtitles,
    ),
    subtitles: mappedSubtitles.length > 0 ? mappedSubtitles : undefined,
  };
  return success;
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
  for (const cdnReferer of getWingsCdnReferers()) {
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
  signal?: AbortSignal,
): Promise<string | null> => {
  const winner = await raceFirstOk(
    probeVidKingReferers(referer, streamUrl),
    async (candidateReferer, probeSignal) =>
      (await probeVidKingStreamOnce(streamUrl, candidateReferer, probeSignal))
        ? candidateReferer
        : null,
    { signal },
  );
  return winner?.value ?? null;
};

export const probeWingsdatabaseStream = async (
  streamUrl: string,
  referer: string,
): Promise<boolean> =>
  Boolean(await probeWingsdatabaseStreamReferer(streamUrl, referer));

const probeVidKingStreamOnce = async (
  streamUrl: string,
  referer: string,
  signal?: AbortSignal,
): Promise<boolean> => {
  try {
    const response = await scrapeFetch(streamUrl, {
      headers: {
        ...scrapeUpstreamHeaders(streamUrl, referer),
        ...(/\.mp4(?:[?#]|$)|\/mp4\//i.test(streamUrl)
          ? { Range: "bytes=0-1023" }
          : {}),
      },
      timeoutMs: SCRAPE_PLAY_PROBE_TIMEOUT_MS,
      retryAttempts: SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
      signal,
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

export type { WingsTmdbLookup };
export { resolveWingsTmdbLookup };

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
  lookup: WingsTmdbLookup,
  seed: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<VidKingPayload | null> => {
  const encryptedResponse = await scrapeFetch(
    wingsSourceUrl(endpoint, {
      title: lookup.title,
      mediaType: input.mediaType,
      year: lookup.year,
      tmdbId: input.tmdbId,
      imdbId: lookup.imdbId,
      seasonId: String(input.seasonNumber ?? 1),
      episodeId: String(input.episodeNumber ?? 1),
      seed,
    }),
    {
      headers,
      timeoutMs: WINGS_SOURCE_FETCH_TIMEOUT_MS,
      curlFallback: false,
      retryAttempts: 1,
      signal,
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

  const decrypted = decryptVidKingPayload(encrypted, seed, input.tmdbId);

  return JSON.parse(decrypted) as VidKingPayload;
};

export async function scrapeVidKing(
  input: ScrapeMediaInput,
): Promise<ScrapeResult> {
  const providerId = "vidking";
  try {
    const lookup = (await resolveWingsTmdbLookup(input)) ?? {
      title: "",
      year: "",
      imdbId: "",
    };

    const seedResult = await fetchWingsSeed("vidking", input.tmdbId);
    if (!seedResult.ok) {
      return {
        ok: false,
        providerId,
        error: seedResult.error,
      };
    }

    const seed = seedResult.seed;
    const headers = wingsApiHeaders(seedResult.origin);

    return scrapeWingsdatabaseMirrors({
      providerId,
      referer: `${seedResult.origin}/`,
      mirrors: VIDKING_SOURCE_ENDPOINTS,
      fetchPayload: (mirror, signal) =>
        fetchVidKingPayload(mirror, input, lookup, seed, headers, signal),
      input,
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
