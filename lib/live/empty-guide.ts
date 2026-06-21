import type { LiveChannelsResponse } from "@/lib/live/types";

export const EMPTY_LIVE_GUIDE: LiveChannelsResponse = {
  version: 1,
  updatedAt: 0,
  channels: [],
  categories: [],
  totals: {
    channels: 0,
    ready: 0,
    unsupported: 0,
  },
};
