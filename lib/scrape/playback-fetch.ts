import { scrapeFetch } from "./fetch";
import { scrapeUpstreamHeaders } from "./upstream-headers";

export type ScrapePlaybackFetchOptions = {
  rangeHeader?: string | null;
  cookies?: string;
  signal?: AbortSignal;
  /**
   * Play and validate must share curl policy. Default true so hosts that only
   * pass via curl during validation also play.
   */
  curlFallback?: boolean;
};

/** Upstream fetch used by `/api/scrape/play` and play-path probes. */
export const fetchScrapePlaybackUpstream = (
  upstreamUrl: string,
  referer: string | undefined,
  options: ScrapePlaybackFetchOptions = {},
): Promise<Response> => {
  const { rangeHeader = null, cookies, signal, curlFallback = true } = options;

  return scrapeFetch(upstreamUrl, {
    method: "GET",
    curlFallback,
    signal,
    headers: {
      ...scrapeUpstreamHeaders(upstreamUrl, referer, rangeHeader),
      ...(cookies ? { Cookie: cookies } : {}),
    },
  });
};
