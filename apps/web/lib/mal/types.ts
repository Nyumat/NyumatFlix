export type MalUser = {
  id: number;
  name: string;
  picture?: string | null;
  joined_at?: string;
  location?: string;
};

export type MalMyListStatus = {
  status?: "watching" | "completed" | "on_hold" | "dropped" | "plan_to_watch";
  score?: number;
  num_episodes_watched?: number;
  is_rewatching?: boolean;
  updated_at?: string;
};

export type MalAnimeNode = {
  id: number;
  title: string;
  main_picture?: {
    medium?: string;
    large?: string;
  };
  num_episodes?: number;
  media_type?: string;
  status?: string;
  my_list_status?: MalMyListStatus;
};

export type MalUserAnimeListItem = {
  node: MalAnimeNode;
  list_status: MalMyListStatus;
};

export type MalUserAnimeListResponse = {
  data: MalUserAnimeListItem[];
  paging?: {
    next?: string;
    previous?: string;
  };
};

export type MalTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
};

export type MalSyncStatusResponse = {
  connected: boolean;
  malUsername?: string | null;
  malPicture?: string | null;
  lastSyncedAt?: string | null;
  autoSyncEnabled?: boolean;
  /** True when MAL rejected the stored credentials and the user must reconnect. */
  reauthRequired?: boolean;
};

export type MalSyncResult = {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** True when failure was a network/timeout issue reaching MAL, not a data problem. */
  isNetworkError?: boolean;
  /** True when MAL rejected the stored credentials and the user must reconnect. */
  reauthRequired?: boolean;
};

export type MalEntryResponse = {
  malId: number;
  numEpisodes: number | null;
  animeStatus: string | null;
  onList: boolean;
  listStatus: MalMyListStatus | null;
};
