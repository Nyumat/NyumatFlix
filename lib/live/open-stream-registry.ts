export type OpenStreamPlaybackConfig = {
  userAgent?: string;
  referer?: string;
};

const streamConfigs = new Map<string, OpenStreamPlaybackConfig>();
const allowedHosts = new Set<string>();

const normalizeUrl = (url: string) => {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
};

export const resetOpenStreamRegistry = () => {
  streamConfigs.clear();
  allowedHosts.clear();
};

export const registerOpenStreamUrl = (
  url: string,
  config: OpenStreamPlaybackConfig = {},
) => {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return;
  }

  streamConfigs.set(normalized, config);

  try {
    allowedHosts.add(new URL(normalized).hostname);
  } catch {
    // Ignore invalid URLs.
  }
};

export const registerOpenStreamUrls = (
  urls: Iterable<string>,
  config: OpenStreamPlaybackConfig = {},
) => {
  for (const url of urls) {
    registerOpenStreamUrl(url, config);
  }
};

export const getOpenStreamPlaybackConfig = (url: string) =>
  streamConfigs.get(url) ?? null;

export const isRegisteredOpenStreamUrl = (url: string) =>
  streamConfigs.has(url);

export const isAllowedOpenStreamHost = (hostname: string) =>
  allowedHosts.has(hostname);

export const isAllowedOpenStreamUrl = (url: string) => {
  const normalized = normalizeUrl(url);

  if (!normalized) {
    return false;
  }

  if (streamConfigs.has(normalized)) {
    return true;
  }

  try {
    const parsed = new URL(normalized);

    if (parsed.protocol !== "https:") {
      return false;
    }

    if (!allowedHosts.has(parsed.hostname)) {
      return false;
    }

    return /\.(?:m3u8|ts)(?:[?#].*|$)/i.test(
      `${parsed.pathname}${parsed.search}`,
    );
  } catch {
    return false;
  }
};
