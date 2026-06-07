import { z } from "zod";

import { buildLivePlayUrl, isAllowedLiveStreamUrl } from "@/lib/live/playback";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

const DULO_API_BASE = "https://dulo.tv/api";
const DULO_FETCH_TIMEOUT_MS = 20_000;
const DULO_FETCH_RETRIES = 3;
const LIVE_CACHE_TTL_MS = 1000 * 60 * 5;
const LIVE_STALE_TTL_MS = 1000 * 60 * 60 * 6;

const CATEGORY_NAMES: Record<string, string> = {
  documentary: "Documentary",
  entertainment: "Entertainment",
  kids: "Kids",
  movies: "Movies",
  news: "News",
  sports: "Sports",
};

const DuloChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string().nullable().optional(),
  source_url: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
});

const DuloEventSchema = z.object({
  id: z.string(),
  league: z.string(),
  team_a_name: z.string().nullable().optional(),
  team_b_name: z.string().nullable().optional(),
  title: z.string(),
  starts_at: z.string().nullable().optional(),
  sort_order: z.number().nullable().optional(),
  sources: z.array(z.string()).default([]),
});

const DuloChannelsPayloadSchema = z.object({
  channels: z.array(DuloChannelSchema),
});

const DuloEventsPayloadSchema = z.object({
  events: z.array(DuloEventSchema),
});

type DuloChannelRecord = z.output<typeof DuloChannelSchema>;
type DuloEventRecord = z.output<typeof DuloEventSchema>;
type DuloChannelsPayload = z.output<typeof DuloChannelsPayloadSchema>;
type DuloEventsPayload = z.output<typeof DuloEventsPayloadSchema>;

type CacheEntry = {
  response: LiveChannelsResponse;
  expiresAt: number;
  staleUntil: number;
};

let cachedLiveChannels: CacheEntry | null = null;
let inFlightLiveChannels: Promise<LiveChannelsResponse> | null = null;

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

const getSourceHost = (sourceUrl: string | null) => {
  if (!sourceUrl) {
    return null;
  }

  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return null;
  }
};

const getUnavailableReason = (sourceUrl: string | null) => {
  if (!sourceUrl) {
    return "No stream source";
  }

  if (sourceUrl.includes("cdn.dulo.tv")) {
    return "Unsupported backup source";
  }

  if (!isAllowedLiveStreamUrl(sourceUrl)) {
    return "Unsupported stream source";
  }

  return null;
};

const jsonFromDuloApi = async <T>(
  path: string,
  schema: { parse: (value: unknown) => T },
): Promise<T> => {
  const url = `${DULO_API_BASE}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < DULO_FETCH_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DULO_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`dulo ${path} returned ${response.status}`);
      }

      return schema.parse(await response.json());
    } catch (error) {
      lastError = error;

      if (attempt < DULO_FETCH_RETRIES - 1) {
        await sleep(400 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`dulo ${path} failed`);
};

const normalizeChannel = (channel: DuloChannelRecord): LiveChannel => {
  const sourceUrl = channel.source_url?.trim() || null;
  const category = channel.category || "entertainment";
  const unavailableReason = getUnavailableReason(sourceUrl);
  const categoryName = getCategoryName(category);

  return {
    id: `dulo-channel-${channel.id}`,
    name: channel.name,
    category,
    categoryName,
    country: "US",
    logoUrl: channel.logo_url ?? null,
    playUrl:
      sourceUrl && !unavailableReason ? buildLivePlayUrl(sourceUrl) : null,
    sourceUrl,
    sourceHost: getSourceHost(sourceUrl),
    availability: unavailableReason ? "unsupported" : "ready",
    unavailableReason,
    kind: "channel",
    startsAt: null,
    label: null,
    searchText: buildSearchText([
      channel.name,
      category,
      categoryName,
      getSourceHost(sourceUrl),
    ]),
  };
};

const normalizeEvent = (event: DuloEventRecord): LiveChannel => {
  const sourceUrl =
    event.sources.find((source) => !getUnavailableReason(source)) ?? null;
  const unavailableReason = getUnavailableReason(sourceUrl);
  const category = "sports";
  const categoryName = getCategoryName(category);

  return {
    id: `dulo-event-${event.id}`,
    name: event.title,
    category,
    categoryName,
    country: "US",
    logoUrl: null,
    playUrl:
      sourceUrl && !unavailableReason ? buildLivePlayUrl(sourceUrl) : null,
    sourceUrl,
    sourceHost: getSourceHost(sourceUrl),
    availability: unavailableReason ? "unsupported" : "ready",
    unavailableReason,
    kind: "event",
    startsAt: event.starts_at ?? null,
    label: event.league ? `${event.league.toUpperCase()} Live` : "Live Event",
    searchText: buildSearchText([
      event.title,
      event.league,
      event.team_a_name,
      event.team_b_name,
      "live event",
    ]),
  };
};

const buildCategoryOptions = (channels: LiveChannel[]) => {
  const counts = new Map<string, { name: string; count: number }>();

  for (const channel of channels) {
    const existing = counts.get(channel.category);
    counts.set(channel.category, {
      name: channel.categoryName,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...counts.entries()]
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
};

const loadLiveChannels = async (): Promise<LiveChannelsResponse> => {
  const [channelsPayload, eventsPayload] = await Promise.all([
    jsonFromDuloApi<DuloChannelsPayload>(
      "/live-tv/channels",
      DuloChannelsPayloadSchema,
    ),
    jsonFromDuloApi<DuloEventsPayload>(
      "/live-tv/events",
      DuloEventsPayloadSchema,
    ).catch(
      (): DuloEventsPayload => ({
        events: [],
      }),
    ),
  ]);

  const events = eventsPayload.events.map(normalizeEvent).sort((a, b) => {
    const aTime = a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER;
    const bTime = b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER;
    return aTime - bTime || a.name.localeCompare(b.name);
  });
  const channels = channelsPayload.channels
    .map(normalizeChannel)
    .sort((a, b) => a.name.localeCompare(b.name));
  const allChannels = [...events, ...channels];
  const ready = allChannels.filter(
    (channel) => channel.availability === "ready",
  ).length;

  return {
    version: 1,
    updatedAt: Date.now(),
    channels: allChannels,
    categories: buildCategoryOptions(allChannels),
    totals: {
      channels: allChannels.length,
      ready,
      unsupported: allChannels.length - ready,
    },
  };
};

export const getLiveChannels = async (): Promise<LiveChannelsResponse> => {
  const now = Date.now();

  if (cachedLiveChannels && cachedLiveChannels.expiresAt > now) {
    return cachedLiveChannels.response;
  }

  if (!inFlightLiveChannels) {
    inFlightLiveChannels = loadLiveChannels()
      .then((response) => {
        cachedLiveChannels = {
          response,
          expiresAt: Date.now() + LIVE_CACHE_TTL_MS,
          staleUntil: Date.now() + LIVE_STALE_TTL_MS,
        };
        return response;
      })
      .catch((error) => {
        if (cachedLiveChannels && cachedLiveChannels.staleUntil > Date.now()) {
          return cachedLiveChannels.response;
        }

        throw error;
      })
      .finally(() => {
        inFlightLiveChannels = null;
      });
  }

  return inFlightLiveChannels;
};
