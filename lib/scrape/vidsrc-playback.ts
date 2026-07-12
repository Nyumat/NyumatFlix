import "server-only";

import { scrapeFetchText } from "./fetch";
import type { VidsrcPlaybackRefresh } from "./vidsrc-constants";

/** Rotating VidSrc CDN hosts — JWT from generate.php is bound to request egress IP. */
export const VIDSRC_CDN_HOST_PATTERN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.space$/i;

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
  const response = await scrapeFetchText(
    `https://${refresh.tokenHost}/generate.php`,
    { Referer: `${refresh.playerOrigin}/` },
  );

  if (response.status !== 200) {
    return null;
  }

  const token = response.text.trim();
  return token || null;
};

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

/**
 * Mint a fresh JWT and rebuild the master URL on the same egress that will
 * immediately fetch it — VidSrc tokens carry an ipacidr claim.
 */
export async function resolveVidsrcPlaybackUrl(
  upstreamUrl: string,
  refresh: VidsrcPlaybackRefresh,
): Promise<string> {
  if (!isVidsrcMasterPlaybackUrl(upstreamUrl, refresh)) {
    return upstreamUrl;
  }

  const jwt = await fetchVidsrcJwtToken(refresh);
  if (!jwt) {
    return upstreamUrl;
  }

  return buildVidsrcStreamUrl(refresh.masterTemplate, jwt);
}
