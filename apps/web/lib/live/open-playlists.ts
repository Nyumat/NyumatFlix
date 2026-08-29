import type { M3uEntry } from "@/lib/live/m3u-parser";
import { parseM3uPlaylist } from "@/lib/live/m3u-parser";
import {
  registerOpenStreamUrl,
  resetOpenStreamRegistry,
} from "@/lib/live/open-stream-registry";
import { getUnavailableReason } from "@/lib/live/availability";
import {
  buildLiveChannelsResponse,
  dedupeLiveChannels,
} from "@/lib/live/guide-utils";
import { buildLivePlayUrl } from "@/lib/live/playback";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

const PLAYLIST_FETCH_TIMEOUT_MS = 30_000;
const PLAYLIST_FETCH_RETRIES = 2;

type OpenPlaylistSource = {
  id: string;
  url: string;
  country: "US" | "CA";
  providerLabel?: string;
  countries?: Set<string>;
  tvgIdRegions?: Set<string>;
};

const OPEN_PLAYLIST_SOURCES: OpenPlaylistSource[] = [
  {
    id: "iptv-org-us",
    url: "https://iptv-org.github.io/iptv/countries/us.m3u",
    country: "US",
  },
  {
    id: "iptv-org-ca",
    url: "https://iptv-org.github.io/iptv/countries/ca.m3u",
    country: "CA",
  },
  {
    id: "iptv-org-eng",
    url: "https://iptv-org.github.io/iptv/languages/eng.m3u",
    country: "US",
    tvgIdRegions: new Set(["us", "ca"]),
    countries: new Set(["US", "CA"]),
  },
  {
    id: "free-tv",
    url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
    country: "US",
    countries: new Set(["US", "CA"]),
  },
  {
    id: "pluto-us",
    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_us.m3u",
    country: "US",
    providerLabel: "Pluto TV",
  },
  {
    id: "tubi-us",
    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/tubi_all.m3u",
    country: "US",
    providerLabel: "Tubi",
  },
  {
    id: "roku-us",
    url: "https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/roku_all.m3u",
    country: "US",
    providerLabel: "Roku",
  },
  {
    id: "apsat-cineverse",
    url: "https://www.apsattv.com/cineverse.m3u",
    country: "US",
    providerLabel: "Cineverse",
  },
  {
    id: "apsat-lg",
    url: "https://www.apsattv.com/uslg.m3u",
    country: "US",
    providerLabel: "LG Channels",
  },
  {
    id: "apsat-tablo",
    url: "https://www.apsattv.com/tablo.m3u",
    country: "US",
    providerLabel: "Tablo",
  },
  {
    id: "apsat-firetv",
    url: "https://www.apsattv.com/firetv.m3u",
    country: "US",
    providerLabel: "Fire TV",
  },
  {
    id: "apsat-localnow",
    url: "https://www.apsattv.com/localnow.m3u",
    country: "US",
    providerLabel: "Local Now",
  },
  {
    id: "apsat-vizio",
    url: "https://www.apsattv.com/vizio.m3u",
    country: "US",
    providerLabel: "Vizio WatchFree",
  },
];

const BOOTSTRAP_SOURCE_IDS = new Set([
  "iptv-org-us",
  "iptv-org-ca",
  "pluto-us",
  "apsat-firetv",
  "apsat-cineverse",
  "apsat-tablo",
]);

const BOOTSTRAP_LIMIT_PER_SOURCE = 120;

const BOOTSTRAP_PRIORITY_QUERIES = [
  "anime x hidive",
  "cartoon network",
  "cnn",
  "espn",
  "nickelodeon",
  "disney",
  "fox news",
  "mtv",
  "hbo",
  "tbs",
  "tnt",
];

const GROUP_CATEGORY_MAP: Record<string, string> = {
  animation: "kids",
  business: "news",
  comedy: "entertainment",
  cooking: "entertainment",
  culture: "entertainment",
  documentary: "documentary",
  education: "documentary",
  entertainment: "entertainment",
  family: "entertainment",
  general: "entertainment",
  kids: "kids",
  legislative: "news",
  lifestyle: "entertainment",
  movies: "movies",
  music: "entertainment",
  news: "news",
  outdoor: "sports",
  public: "entertainment",
  relax: "entertainment",
  religious: "entertainment",
  science: "documentary",
  series: "entertainment",
  shop: "entertainment",
  sports: "sports",
  travel: "entertainment",
  weather: "news",
};

const CATEGORY_NAMES: Record<string, string> = {
  documentary: "Documentary",
  entertainment: "Entertainment",
  kids: "Kids",
  movies: "Movies",
  news: "News",
  sports: "Sports",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const titleCase = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const getCategoryName = (category: string) =>
  CATEGORY_NAMES[category] ?? titleCase(category);

const buildSearchText = (parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const fetchPlaylistText = async (url: string) => {
  let lastError: unknown;

  for (let attempt = 0; attempt < PLAYLIST_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      PLAYLIST_FETCH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/vnd.apple.mpegurl, application/x-mpegURL, */*",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`playlist ${url} returned ${response.status}`);
      }

      return response.text();
    } catch (error) {
      lastError = error;

      if (attempt < PLAYLIST_FETCH_RETRIES - 1) {
        await sleep(250 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`playlist ${url} failed`);
};

const resolveCategory = (groupTitle: string | null) => {
  const primary = groupTitle?.split(";")[0]?.trim().toLowerCase() ?? "";
  const category = GROUP_CATEGORY_MAP[primary] ?? "entertainment";

  return {
    category,
    categoryName: primary ? titleCase(primary) : getCategoryName(category),
  };
};

const matchesTvgIdRegion = (tvgId: string | null, regions: Set<string>) => {
  if (!tvgId) {
    return false;
  }

  const normalized = tvgId.toLowerCase();

  return [...regions].some(
    (region) =>
      normalized.includes(`.${region}@`) || normalized.endsWith(`.${region}`),
  );
};

const shouldIncludeEntry = (entry: M3uEntry, source: OpenPlaylistSource) => {
  if (source.tvgIdRegions || source.countries) {
    const country = entry.country?.toUpperCase() ?? null;
    const matchesCountry = country
      ? (source.countries?.has(country) ?? false)
      : false;
    const matchesRegion = source.tvgIdRegions
      ? matchesTvgIdRegion(entry.tvgId, source.tvgIdRegions)
      : false;

    if (!matchesCountry && !matchesRegion) {
      return false;
    }
  }

  if (/\[geo-blocked\]/i.test(entry.name)) {
    return false;
  }

  return true;
};

const normalizeOpenPlaylistEntry = (
  entry: M3uEntry,
  source: OpenPlaylistSource,
): LiveChannel => {
  const { category, categoryName } = resolveCategory(entry.groupTitle);
  const channelId = entry.tvgId
    ? `open-${slugify(source.id)}-${slugify(entry.tvgId)}`
    : `open-${slugify(`${source.id}-${entry.name}-${entry.url}`)}`;

  const unavailableReason = getUnavailableReason(entry.url);

  if (!unavailableReason) {
    registerOpenStreamUrl(entry.url, {
      userAgent: entry.userAgent ?? undefined,
      referer: entry.referer ?? undefined,
    });
  }

  const groupLabel = entry.groupTitle?.split(";")[0]?.trim() ?? null;
  const label =
    [source.providerLabel, groupLabel].filter(Boolean).join(" · ") || null;

  return {
    id: channelId,
    name: entry.name.replace(/\s*\[[^\]]+\]\s*/g, " ").trim(),
    category,
    categoryName,
    country: entry.country?.toUpperCase() ?? source.country,
    logoUrl: entry.tvgLogo,
    playUrl: unavailableReason ? null : buildLivePlayUrl(entry.url),
    sourceUrl: entry.url,
    sourceHost: new URL(entry.url).hostname,
    availability: unavailableReason ? "unsupported" : "ready",
    unavailableReason,
    kind: "channel",
    startsAt: null,
    label,
    searchText: buildSearchText([
      entry.name,
      entry.tvgId,
      entry.groupTitle,
      source.providerLabel,
      category,
      categoryName,
      source.country,
      entry.country,
    ]),
  };
};

const prioritizeBootstrapEntries = (entries: M3uEntry[]) => {
  const prioritized: M3uEntry[] = [];
  const regular: M3uEntry[] = [];

  for (const entry of entries) {
    const normalizedName = entry.name.toLowerCase();
    const isPriority = BOOTSTRAP_PRIORITY_QUERIES.some((query) =>
      normalizedName.includes(query),
    );

    if (isPriority) {
      prioritized.push(entry);
    } else {
      regular.push(entry);
    }
  }

  return [...prioritized, ...regular].slice(0, BOOTSTRAP_LIMIT_PER_SOURCE);
};

const loadPlaylistSource = async (
  source: OpenPlaylistSource,
  bootstrap: boolean,
) => {
  const text = await fetchPlaylistText(source.url);
  let entries = parseM3uPlaylist(text).filter((entry) =>
    shouldIncludeEntry(entry, source),
  );

  if (bootstrap) {
    entries = prioritizeBootstrapEntries(entries);
  }

  return entries.map((entry) => normalizeOpenPlaylistEntry(entry, source));
};

const resolvePlaylistSources = (options: {
  bootstrap: boolean;
  supplemental: boolean;
}) => {
  if (options.bootstrap) {
    return OPEN_PLAYLIST_SOURCES.filter((source) =>
      BOOTSTRAP_SOURCE_IDS.has(source.id),
    );
  }

  if (options.supplemental) {
    return OPEN_PLAYLIST_SOURCES.filter(
      (source) => !BOOTSTRAP_SOURCE_IDS.has(source.id),
    );
  }

  return OPEN_PLAYLIST_SOURCES;
};

export const loadLiveChannelsFromOpenPlaylists = async (options?: {
  bootstrap?: boolean;
  supplemental?: boolean;
  resetRegistry?: boolean;
}): Promise<LiveChannelsResponse> => {
  const bootstrap = options?.bootstrap ?? false;
  const supplemental = options?.supplemental ?? false;
  const resetRegistry = options?.resetRegistry ?? true;

  if (resetRegistry) {
    resetOpenStreamRegistry();
  }

  const sources = resolvePlaylistSources({ bootstrap, supplemental });

  const playlistResults = await Promise.allSettled(
    sources.map((source) => loadPlaylistSource(source, bootstrap)),
  );

  const channels = dedupeLiveChannels(
    playlistResults.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    ),
  );

  return buildLiveChannelsResponse(channels, {
    guidePhase: bootstrap
      ? "bootstrap"
      : supplemental
        ? "supplemental"
        : "full",
    guideComplete: !bootstrap && !supplemental,
  });
};
