import { isOkCdnHlsUrl } from "./anime/allanime-stream-url";
import { cancelResponseBody } from "./fetch";
import {
  fetchScrapePlaybackUpstream,
  type ScrapePlaybackFetchOptions,
} from "./playback-fetch";
import {
  type ScrapePlaybackToken,
  isDisguisedHlsSegment,
  isPlaylistResponse,
  resolveKaaSegmentFallbackUrls,
} from "./playback";
import { resolveScrapePlaybackUpstreamUrl } from "./vidking-playback";
import { looksLikeHlsStreamUrl, type StreamKind } from "./stream-url-patterns";
import {
  extractHlsProbeTargets,
  isValidHlsAssetResponse,
} from "./validate-stream";
import { isPoisonedHlsPlaylistBody } from "./hls-poison";
import { isVixsrcStubPlaylistBody } from "./vixsrc-stub";
import { decodeObfuscatedHlsBody } from "./hls-body";
import { normalizeVidKingAssetHost } from "./vidking-cdn-url";

const looksLikeHlsPlaylistBody = (body: string): boolean =>
  decodeObfuscatedHlsBody(body).includes("#EXTM3U");

const looksLikeDashManifestBody = (body: string): boolean =>
  body.includes("<MPD") || /\bmpd\b/i.test(body);

const shouldTreatAsHlsPlaylist = (
  targetUrl: string,
  contentType: string | null,
  body: string,
): boolean => {
  if (!looksLikeHlsPlaylistBody(body) || isDisguisedHlsSegment(targetUrl)) {
    return false;
  }

  return (
    isPlaylistResponse(targetUrl, contentType) ||
    looksLikeHlsStreamUrl(targetUrl) ||
    /mpegurl|m3u8|text\/|json|octet-stream|binary/i.test(contentType ?? "")
  );
};

export type ProbeScrapePlaybackPathOptions = Pick<
  ScrapePlaybackFetchOptions,
  "timeoutMs" | "retryAttempts" | "signal"
>;

export const SCRAPE_PLAY_PROBE_TIMEOUT_MS = 8_000;
export const SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS = 1;

export const withScrapePlayProbeOptions = (
  options: ProbeScrapePlaybackPathOptions = {},
): ProbeScrapePlaybackPathOptions => ({
  timeoutMs: options.timeoutMs ?? SCRAPE_PLAY_PROBE_TIMEOUT_MS,
  retryAttempts: options.retryAttempts ?? SCRAPE_PLAY_PROBE_RETRY_ATTEMPTS,
  signal: options.signal,
});

const fetchWithKaaFallback = async (
  upstreamUrl: string,
  referer: string | undefined,
  cookies: string | undefined,
  rangeHeader: string | null,
  fetchOptions: ProbeScrapePlaybackPathOptions = {},
): Promise<{ response: Response; url: string }> => {
  let response = await fetchScrapePlaybackUpstream(upstreamUrl, referer, {
    rangeHeader,
    cookies,
    ...fetchOptions,
  });
  let url = upstreamUrl;

  if (response.status === 403) {
    for (const fallbackUrl of resolveKaaSegmentFallbackUrls(upstreamUrl)) {
      await cancelResponseBody(response);
      response = await fetchScrapePlaybackUpstream(fallbackUrl, referer, {
        rangeHeader,
        cookies,
        ...fetchOptions,
      });
      url = fallbackUrl;
      if (response.ok || response.status !== 403) {
        break;
      }
    }
  }

  return { response, url };
};

const probeHlsAssetThroughPlaybackPath = async (
  assetUrl: string,
  referer: string | undefined,
  cookies: string | undefined,
  fetchOptions: ProbeScrapePlaybackPathOptions = {},
): Promise<boolean> => {
  const candidates = [assetUrl, ...resolveKaaSegmentFallbackUrls(assetUrl)];

  for (const candidate of candidates) {
    const { response } = await fetchWithKaaFallback(
      candidate,
      referer,
      cookies,
      "bytes=0-1023",
      fetchOptions,
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (isValidHlsAssetResponse(contentType, bytes)) {
      return true;
    }
  }

  return false;
};

const probeHlsThroughPlaybackPath = async (
  playlistUrl: string,
  body: string,
  referer: string | undefined,
  cookies: string | undefined,
  fetchOptions: ProbeScrapePlaybackPathOptions = {},
  depth = 0,
): Promise<boolean> => {
  const maxDepth = isOkCdnHlsUrl(playlistUrl) ? 5 : 2;
  if (!looksLikeHlsPlaylistBody(body) || depth > maxDepth) {
    return false;
  }

  if (isPoisonedHlsPlaylistBody(body)) {
    return false;
  }

  const { childPlaylist, requiredAssets } = extractHlsProbeTargets(
    body,
    playlistUrl,
  );

  if (childPlaylist) {
    const { response, url } = await fetchWithKaaFallback(
      childPlaylist,
      referer,
      cookies,
      null,
      fetchOptions,
    );
    if (!response.ok) {
      await cancelResponseBody(response);
      return false;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/html")) {
      await cancelResponseBody(response);
      return false;
    }

    const childBody = decodeObfuscatedHlsBody(
      (await response.text()).slice(0, 64_000),
    );
    return probeHlsThroughPlaybackPath(
      url,
      childBody,
      referer,
      cookies,
      fetchOptions,
      depth + 1,
    );
  }

  if (requiredAssets.length === 0) {
    return false;
  }

  for (const assetUrl of requiredAssets) {
    const normalized = normalizeVidKingAssetHost(assetUrl, playlistUrl);
    if (
      !(await probeHlsAssetThroughPlaybackPath(
        normalized,
        referer,
        cookies,
        fetchOptions,
      ))
    ) {
      return false;
    }
  }

  return true;
};

/**
 * Prove the stream works under the same egress policy as `/api/scrape/play`
 * (headers + curl fallback + KAA host rotation), including one media segment
 * for HLS. Call this before returning scrape `ok`.
 */
export async function probeScrapePlaybackPath(
  payload: ScrapePlaybackToken,
  kind: StreamKind = "hls",
  options: ProbeScrapePlaybackPathOptions = {},
): Promise<boolean> {
  const probeOptions = withScrapePlayProbeOptions(options);
  try {
    const rangeHeader = kind === "mp4" ? "bytes=0-511" : null;
    const resolvedUrl = await resolveScrapePlaybackUpstreamUrl(
      payload.url,
      payload.refresh,
    );
    const { response, url } = await fetchWithKaaFallback(
      resolvedUrl,
      payload.referer,
      payload.cookies,
      rangeHeader,
      probeOptions,
    );

    if (!response.ok) {
      await cancelResponseBody(response);
      return false;
    }

    if (kind === "mp4") {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) {
        return false;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        return false;
      }
      return true;
    }

    const contentType = response.headers.get("content-type");
    const rawBody = (await response.text()).slice(0, 64_000);
    const body = decodeObfuscatedHlsBody(rawBody);

    if (isVixsrcStubPlaylistBody(resolvedUrl, body)) {
      return false;
    }

    if (isPoisonedHlsPlaylistBody(body)) {
      return false;
    }

    if (kind === "dash") {
      return looksLikeDashManifestBody(body);
    }

    if (!shouldTreatAsHlsPlaylist(url, contentType, body)) {
      return false;
    }

    if (isOkCdnHlsUrl(url) && body.includes("#EXTM3U")) {
      return true;
    }

    return probeHlsThroughPlaybackPath(
      url,
      body,
      payload.referer,
      payload.cookies,
      probeOptions,
    );
  } catch {
    return false;
  }
}

export { looksLikeHlsPlaylistBody, shouldTreatAsHlsPlaylist };
