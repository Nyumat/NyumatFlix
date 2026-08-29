import "server-only";

import { scrapeFetchText } from "./fetch";
import { scrapeProxyUrl } from "./proxy";
import { parseVidsrcTokenResponse } from "./providers/vidsrc";
import type { VidsrcPlaybackRefresh } from "./vidsrc-constants";

/** Rotating VidSrc CDN hosts — JWT from generate.php is bound to request egress IP. */
export const VIDSRC_CDN_HOST_PATTERN =
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:space|site|website)$/i;

export const isVidsrcCdnHostname = (hostname: string): boolean =>
  VIDSRC_CDN_HOST_PATTERN.test(hostname);

export const buildVidsrcStreamUrl = (
  masterTemplate: string,
  jwt: string,
): string =>
  masterTemplate.replaceAll("__TOKEN__", jwt).replaceAll("__TOKENPG__", jwt);

export const fetchVidsrcJwtToken = async (
  refresh: VidsrcPlaybackRefresh,
): Promise<string | null> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1_500 * attempt);
      });
    }

    const response = await scrapeFetchText(
      `https://${refresh.tokenHost}/generate.php`,
      { Referer: `${refresh.playerOrigin}/` },
    );

    if (response.status === 200) {
      const token = parseVidsrcTokenResponse(response.text);
      if (token) {
        return token;
      }
    }

    if (response.status !== 429 && response.status !== 503) {
      return null;
    }
  }

  return null;
};

export const isRetryableVidsrcUpstreamStatus = (status: number): boolean =>
  status === 401 || status === 403;

const templatePathKey = (masterTemplate: string): string | null => {
  try {
    const path = new URL(
      masterTemplate
        .replaceAll("__TOKEN__", "0")
        .replaceAll("__TOKENPG__", "0"),
    );
    return `${path.hostname}${path.pathname}`;
  } catch {
    return null;
  }
};

export const isVidsrcMasterPlaybackUrl = (
  upstreamUrl: string,
  refresh: VidsrcPlaybackRefresh,
): boolean => {
  const templateKey = templatePathKey(refresh.masterTemplate);
  if (!templateKey) {
    return false;
  }

  try {
    const parsed = new URL(upstreamUrl);
    return `${parsed.hostname}${parsed.pathname}` === templateKey;
  } catch {
    return false;
  }
};

/** JWT already substituted during scrape — generate.php rate-limits bursts. */
export const extractVidsrcJwtFromUrl = (upstreamUrl: string): string | null => {
  try {
    const token = new URL(upstreamUrl).searchParams.get("token");
    if (!token || token.includes("__TOKEN")) {
      return null;
    }

    return token.startsWith("eyJ") ? token : null;
  } catch {
    return null;
  }
};

const VIDSRC_JWT_REUSE_MS = 60_000;

type VidsrcJwtSession = {
  jwt: string;
  fetchedAt: number;
};

const jwtSessionCache = new Map<string, VidsrcJwtSession>();

const jwtSessionKey = (refresh: VidsrcPlaybackRefresh): string =>
  refresh.tokenHost;

export const invalidateVidsrcJwtSession = (
  refresh: VidsrcPlaybackRefresh,
): void => {
  jwtSessionCache.delete(jwtSessionKey(refresh));
};

export function primeVidsrcJwtSession(
  refresh: VidsrcPlaybackRefresh,
  streamUrl: string,
): void {
  const jwt = extractVidsrcJwtFromUrl(streamUrl);
  if (!jwt) {
    return;
  }

  jwtSessionCache.set(jwtSessionKey(refresh), { jwt, fetchedAt: Date.now() });
}

/**
 * Mint a fresh JWT and rebuild the master URL on the same egress that will
 * immediately fetch it — VidSrc tokens carry an ipacidr claim.
 */
export async function resolveVidsrcPlaybackUrl(
  upstreamUrl: string,
  refresh: VidsrcPlaybackRefresh,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!isVidsrcMasterPlaybackUrl(upstreamUrl, refresh)) {
    return upstreamUrl;
  }

  const embeddedJwt = extractVidsrcJwtFromUrl(upstreamUrl);
  // Scrape may have minted on a different egress; prod re-mints via VPN proxy.
  if (!options.force && embeddedJwt && !scrapeProxyUrl()) {
    return upstreamUrl;
  }

  const cacheKey = jwtSessionKey(refresh);
  const cached = jwtSessionCache.get(cacheKey);
  const now = Date.now();

  if (
    !options.force &&
    cached &&
    now - cached.fetchedAt < VIDSRC_JWT_REUSE_MS
  ) {
    return buildVidsrcStreamUrl(refresh.masterTemplate, cached.jwt);
  }

  const jwt = await fetchVidsrcJwtToken(refresh);
  if (!jwt) {
    return upstreamUrl;
  }

  jwtSessionCache.set(cacheKey, { jwt, fetchedAt: now });
  return buildVidsrcStreamUrl(refresh.masterTemplate, jwt);
}
