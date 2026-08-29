export type M3uEntry = {
  name: string;
  url: string;
  tvgId: string | null;
  tvgLogo: string | null;
  groupTitle: string | null;
  country: string | null;
  userAgent: string | null;
  referer: string | null;
};

const EXTINF_ATTR_RE = /([a-z0-9-]+)="([^"]*)"/gi;
const BLOCKED_STREAM_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "youtu.be",
  "www.twitch.tv",
  "twitch.tv",
]);

const parseExtinfAttributes = (line: string) => {
  const attributes = new Map<string, string>();

  for (const match of line.matchAll(EXTINF_ATTR_RE)) {
    attributes.set(match[1].toLowerCase(), match[2]);
  }

  const name = line.split(",").at(-1)?.trim() ?? "Unknown Channel";

  return {
    name,
    tvgId: attributes.get("tvg-id") ?? null,
    tvgLogo: attributes.get("tvg-logo") ?? null,
    groupTitle: attributes.get("group-title") ?? null,
    country: attributes.get("tvg-country") ?? null,
    userAgent: attributes.get("http-user-agent") ?? null,
    referer:
      attributes.get("http-referrer") ?? attributes.get("referrer") ?? null,
  };
};

export const isPlayableM3uStreamUrl = (url: string) => {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return false;
    }

    if (BLOCKED_STREAM_HOSTS.has(parsed.hostname)) {
      return false;
    }

    return /\.m3u8(?:[?#].*)?$/i.test(parsed.pathname + parsed.search);
  } catch {
    return false;
  }
};

export const parseM3uPlaylist = (content: string): M3uEntry[] => {
  const lines = content.split(/\r?\n/);
  const entries: M3uEntry[] = [];
  let pending: Omit<M3uEntry, "url"> | null = null;
  let pendingUserAgent: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.startsWith("#EXTINF:")) {
      const parsed = parseExtinfAttributes(line);
      pending = {
        ...parsed,
        userAgent: parsed.userAgent ?? pendingUserAgent,
      };
      pendingUserAgent = null;
      continue;
    }

    if (line.startsWith("#EXTVLCOPT:http-user-agent=")) {
      pendingUserAgent = line
        .slice("#EXTVLCOPT:http-user-agent=".length)
        .trim();
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (!pending || !isPlayableM3uStreamUrl(line)) {
      pending = null;
      pendingUserAgent = null;
      continue;
    }

    entries.push({
      ...pending,
      url: line,
    });
    pending = null;
    pendingUserAgent = null;
  }

  return entries;
};
