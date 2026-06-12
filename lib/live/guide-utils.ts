import { slugifyChannelName } from "@/lib/live/channel-slugs";
import { sortFeaturedLiveChannelsFirst } from "@/lib/live/defaults";
import type { LiveChannel, LiveChannelsResponse } from "@/lib/live/types";

const ANIMEX_HIDIVE_SLUG = "animexhidive";

const isAnimeXHidiveChannel = (channel: LiveChannel) =>
  slugifyChannelName(channel.name) === ANIMEX_HIDIVE_SLUG;

const isPlutoChannel = (channel: LiveChannel) =>
  channel.id.startsWith("open-pluto-");

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

const preferChannel = (left: LiveChannel, right: LiveChannel) => {
  if (left.logoUrl && !right.logoUrl) {
    return left;
  }

  if (right.logoUrl && !left.logoUrl) {
    return right;
  }

  return left;
};

export const isPlayableLiveChannel = (channel: LiveChannel) =>
  channel.availability === "ready" && Boolean(channel.playUrl);

export const filterPlayableLiveChannels = (channels: LiveChannel[]) =>
  channels.filter(isPlayableLiveChannel);

export const toPlayableLiveGuide = (
  guide: LiveChannelsResponse,
): LiveChannelsResponse =>
  buildLiveChannelsResponse(filterPlayableLiveChannels(guide.channels), {
    guidePhase: guide.guidePhase,
    guideComplete: guide.guideComplete,
  });

export const dedupeLiveChannels = (channels: LiveChannel[]) => {
  const bySourceUrl = new Map<string, LiveChannel>();
  const byId = new Map<string, LiveChannel>();

  for (const channel of channels) {
    const sourceKey = channel.sourceUrl ?? channel.id;
    const existingBySource = bySourceUrl.get(sourceKey);
    bySourceUrl.set(
      sourceKey,
      existingBySource ? preferChannel(existingBySource, channel) : channel,
    );
  }

  for (const channel of bySourceUrl.values()) {
    const existingById = byId.get(channel.id);
    byId.set(
      channel.id,
      existingById ? preferChannel(existingById, channel) : channel,
    );
  }

  const hidiveChannels = [...byId.values()].filter(isAnimeXHidiveChannel);
  const preferredHidive =
    hidiveChannels.find(isPlutoChannel) ?? hidiveChannels[0];

  const dedupedChannels = [...byId.values()].filter((channel) => {
    if (!isAnimeXHidiveChannel(channel)) {
      return true;
    }

    return preferredHidive ? channel.id === preferredHidive.id : true;
  });

  return sortFeaturedLiveChannelsFirst(
    dedupedChannels.sort((a, b) => a.name.localeCompare(b.name)),
  );
};

export const buildLiveChannelsResponse = (
  channels: LiveChannel[],
  options?: {
    guidePhase?: LiveChannelsResponse["guidePhase"];
    guideComplete?: boolean;
  },
): LiveChannelsResponse => {
  const ready = channels.filter(
    (channel) => channel.availability === "ready",
  ).length;

  return {
    version: 1,
    updatedAt: Date.now(),
    channels,
    categories: buildCategoryOptions(channels),
    totals: {
      channels: channels.length,
      ready,
      unsupported: channels.length - ready,
    },
    guidePhase: options?.guidePhase,
    guideComplete: options?.guideComplete,
  };
};

export const mergeLiveChannelGuides = (
  current: LiveChannelsResponse,
  incoming: LiveChannelsResponse,
): LiveChannelsResponse => {
  const channels = dedupeLiveChannels([
    ...current.channels,
    ...incoming.channels,
  ]);

  return buildLiveChannelsResponse(channels, {
    guidePhase: "full",
    guideComplete: incoming.guideComplete ?? true,
  });
};
