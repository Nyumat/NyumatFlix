export type ParsedVidKingCdnUrl = {
  prefix: string;
  token: string;
  pathAfterToken: string;
};

const VIDKING_CDN_HOST = /(?:^|\.)shadowlemon\.site$/i;

const VIDKING_CDN_PATH =
  /^((?:https?:\/\/[^/]*shadowlemon\.site)(?:\/r2)?\/cdn[12])\/([^/]+)\/(.+)$/i;

export const isVidKingCdnUrl = (url: string): boolean => {
  try {
    const { hostname } = new URL(url);
    return VIDKING_CDN_HOST.test(hostname);
  } catch {
    return false;
  }
};

export const parseVidKingCdnUrl = (url: string): ParsedVidKingCdnUrl | null => {
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
