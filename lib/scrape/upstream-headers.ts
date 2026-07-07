export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** VidKing CDN (shadowlemon) blocks our default Chrome UA via DDoS-Guard. */
const DDOS_GUARD_BLOCKED_UA_HOSTS = /(?:^|\.)shadowlemon\.site$/i;

export const userAgentForUpstreamUrl = (
  upstreamUrl: string,
): string | undefined => {
  try {
    const { hostname } = new URL(upstreamUrl);
    if (DDOS_GUARD_BLOCKED_UA_HOSTS.test(hostname)) {
      return undefined;
    }
  } catch {
    // fall through
  }

  return DEFAULT_USER_AGENT;
};

export const scrapeUpstreamHeaders = (
  upstreamUrl: string,
  referer: string | undefined,
  rangeHeader: string | null = null,
): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };

  const userAgent = userAgentForUpstreamUrl(upstreamUrl);
  if (userAgent) {
    headers["User-Agent"] = userAgent;
  }

  const effectiveReferer =
    referer ??
    (() => {
      try {
        return new URL(upstreamUrl).origin;
      } catch {
        return undefined;
      }
    })();

  if (effectiveReferer) {
    headers.Referer = effectiveReferer;

    try {
      headers.Origin = new URL(effectiveReferer).origin;
    } catch {
      // origin not derivable
    }
  }

  if (rangeHeader) {
    headers.Range = rangeHeader;
  }

  return headers;
};
