export type LiveChannelAvailability = "ready" | "unsupported";

export type LiveChannel = {
  id: string;
  name: string;
  category: string;
  categoryName: string;
  country: string;
  logoUrl: string | null;
  playUrl: string | null;
  sourceUrl: string | null;
  sourceHost: string | null;
  availability: LiveChannelAvailability;
  unavailableReason: string | null;
  kind: "channel" | "event";
  startsAt: string | null;
  label: string | null;
  searchText: string;
};

export type LiveChannelsResponse = {
  version: 1;
  updatedAt: number;
  channels: LiveChannel[];
  categories: Array<{
    id: string;
    name: string;
    count: number;
  }>;
  totals: {
    channels: number;
    ready: number;
    unsupported: number;
  };
  guidePhase?: "bootstrap" | "supplemental" | "full";
  guideComplete?: boolean;
};
