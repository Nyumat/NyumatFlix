export type ParsedVidKingCdnUrl = {
  prefix: string;
  token: string;
  pathAfterToken: string;
};

/**
 * VidKing rotates CDN hostnames (shadowlemon → ironbubble → …). Fingerprint the
 * stable path shape instead of hardcoding hosts so playback keeps working.
 */
const VIDKING_CDN_PATHNAME = /^\/(?:r2\/)?cdn[12]\/[^/]+\/.+/i;

const VIDKING_CDN_PATH =
  /^((?:https?:\/\/[^/?#]+)(?:\/r2)?\/cdn[12])\/([^/]+)\/(.+)$/i;

export const isVidKingCdnUrl = (url: string): boolean => {
  try {
    return VIDKING_CDN_PATHNAME.test(new URL(url).pathname);
  } catch {
    return false;
  }
};

export const parseVidKingCdnUrl = (url: string): ParsedVidKingCdnUrl | null => {
  if (!isVidKingCdnUrl(url)) {
    return null;
  }

  const match = url.match(VIDKING_CDN_PATH);
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  return {
    prefix: match[1],
    token: match[2],
    pathAfterToken: match[3],
  };
};

export const rebuildVidKingCdnUrl = (
  parsed: ParsedVidKingCdnUrl,
  token: string,
): string => `${parsed.prefix}/${token}/${parsed.pathAfterToken}`;

export const swapVidKingCdnToken = (
  url: string,
  nextToken: string,
): string | null => {
  const parsed = parseVidKingCdnUrl(url);
  if (!parsed) {
    return null;
  }

  return rebuildVidKingCdnUrl(parsed, nextToken);
};

export const extractVidKingCdnToken = (url: string): string | null =>
  parseVidKingCdnUrl(url)?.token ?? null;

/** Keep playlist/segment hosts aligned when the CDN rotates mid-playback. */
export const normalizeVidKingAssetHost = (
  assetUrl: string,
  playlistUrl: string,
): string => {
  try {
    const asset = new URL(assetUrl);
    const playlist = new URL(playlistUrl);
    const assetPath = asset.pathname.match(
      /^\/(?:r2\/)?cdn[12]\/([^/]+)\/(.+)$/i,
    );
    const playlistPath = playlist.pathname.match(
      /^\/(?:r2\/)?cdn[12]\/([^/]+)\/(.+)$/i,
    );
    if (
      asset.protocol === "https:" &&
      playlist.protocol === "https:" &&
      asset.origin !== playlist.origin &&
      assetPath?.[1] &&
      assetPath[1] === playlistPath?.[1]
    ) {
      asset.host = playlist.host;
    }
    return asset.toString();
  } catch {
    return assetUrl;
  }
};
