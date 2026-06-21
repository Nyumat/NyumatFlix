export type OpenStreamPlaybackConfig = {
  userAgent?: string;
  referer?: string;
};

type RegistryState = {
  streamConfigs: Map<string, OpenStreamPlaybackConfig>;
  allowedHosts: Set<string>;
};

const REGISTRY_KEY = "__nyumatflixOpenStreamRegistry";

const getRegistryState = (): RegistryState => {
  const globalStore = globalThis as typeof globalThis & {
    [REGISTRY_KEY]?: RegistryState;
  };

  if (!globalStore[REGISTRY_KEY]) {
    globalStore[REGISTRY_KEY] = {
      streamConfigs: new Map(),
      allowedHosts: new Set(),
    };
  }

  return globalStore[REGISTRY_KEY]!;
};

const { streamConfigs, allowedHosts } = getRegistryState();

const TRUSTED_OPEN_STREAM_SOURCE_HOSTS = new Set(["jmp2.uk"]);

const OPEN_STREAM_REDIRECT_SUFFIXES: Record<string, string[]> = {
  "jmp2.uk": ["pluto.tv", "plutotv.net"],
};

const hostMatchesSuffix = (hostname: string, suffix: string) =>
  hostname === suffix || hostname.endsWith(`.${suffix}`);

const isStreamAssetPath = (pathname: string, search: string) =>
  /\.(?:m3u8|ts)(?:[?#].*|$)/i.test(`${pathname}${search}`);

const isTrustedOpenStreamSourceHost = (hostname: string) =>
  TRUSTED_OPEN_STREAM_SOURCE_HOSTS.has(hostname);

const sourceHostIsActive = (hostname: string) =>
  allowedHosts.has(hostname) || isTrustedOpenStreamSourceHost(hostname);

const isOpenStreamRedirectHost = (hostname: string) => {
  for (const [sourceHost, suffixes] of Object.entries(
    OPEN_STREAM_REDIRECT_SUFFIXES,
  )) {
    if (!sourceHostIsActive(sourceHost)) {
      continue;
    }

    if (suffixes.some((suffix) => hostMatchesSuffix(hostname, suffix))) {
      return true;
    }
  }

  return false;
};

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
  allowedHosts.has(hostname) ||
  isTrustedOpenStreamSourceHost(hostname) ||
  isOpenStreamRedirectHost(hostname);

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

    if (
      isTrustedOpenStreamSourceHost(parsed.hostname) &&
      isStreamAssetPath(parsed.pathname, parsed.search)
    ) {
      return true;
    }

    if (
      !allowedHosts.has(parsed.hostname) &&
      !isOpenStreamRedirectHost(parsed.hostname)
    ) {
      return false;
    }

    return isStreamAssetPath(parsed.pathname, parsed.search);
  } catch {
    return false;
  }
};
