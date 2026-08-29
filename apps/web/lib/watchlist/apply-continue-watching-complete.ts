import type { WatchlistItem } from "@/lib/domain/watchlist";

export type ApplyContinueWatchingCompleteInput = {
  contentId: number;
  mediaType: "movie" | "tv";
  status: "completed" | null;
  seasonNumber?: number;
  episodeNumber?: number;
};

type ContinueWatchingStatus = Exclude<
  ApplyContinueWatchingCompleteInput["status"],
  null
>;

type WatchlistItemRef = Pick<WatchlistItem, "id">;

type PatchWatchlistBody = {
  status?: ContinueWatchingStatus;
  lastWatchedSeason?: number;
  lastWatchedEpisode?: number;
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
} as const;

export async function applyContinueWatchingComplete(
  input: ApplyContinueWatchingCompleteInput,
): Promise<void> {
  if (input.status === null) {
    return;
  }

  const resolved = { ...input, status: input.status };

  const existing = await fetchWatchlistItem(
    resolved.contentId,
    resolved.mediaType,
  );
  if (existing) {
    await patchWatchlistItem(existing.id, buildStatusPatch(resolved));
    return;
  }

  const created = await postWatchlistItem(resolved);
  if (created === "conflict") {
    const retry = await fetchWatchlistItem(
      resolved.contentId,
      resolved.mediaType,
    );
    if (!retry) {
      throw new Error("Watchlist item not found");
    }
    await patchWatchlistItem(retry.id, buildStatusPatch(resolved));
    return;
  }

  const lastWatched = lastWatchedFields(resolved);
  if (lastWatched) {
    await patchWatchlistItem(created.id, lastWatched);
  }
}

async function fetchWatchlistItem(
  contentId: number,
  mediaType: "movie" | "tv",
): Promise<WatchlistItemRef | null> {
  const response = await fetch(
    `/api/watchlist/item?contentId=${contentId}&mediaType=${mediaType}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch watchlist item");
  }

  return readItemRef(response);
}

async function postWatchlistItem(
  input: ApplyContinueWatchingCompleteInput & {
    status: ContinueWatchingStatus;
  },
): Promise<WatchlistItemRef | "conflict"> {
  const response = await fetch("/api/watchlist", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      contentId: input.contentId,
      mediaType: input.mediaType,
      status: input.status,
    }),
  });

  if (response.status === 409) {
    return "conflict";
  }

  if (!response.ok) {
    throw new Error("Failed to add to watchlist");
  }

  const item = await readItemRef(response);
  if (!item) {
    throw new Error("Failed to add to watchlist");
  }

  return item;
}

async function patchWatchlistItem(
  id: string,
  body: PatchWatchlistBody,
): Promise<void> {
  const response = await fetch(`/api/watchlist/${id}`, {
    method: "PATCH",
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Failed to update watchlist");
  }
}

async function readItemRef(
  response: Response,
): Promise<WatchlistItemRef | null> {
  const data: unknown = await response.json();
  if (!isRecord(data)) {
    return null;
  }

  const item = data.item;
  if (!isRecord(item) || typeof item.id !== "string" || item.id.length === 0) {
    return null;
  }

  return { id: item.id };
}

function buildStatusPatch(
  input: ApplyContinueWatchingCompleteInput & {
    status: ContinueWatchingStatus;
  },
): PatchWatchlistBody {
  const lastWatched = lastWatchedFields(input);
  if (!lastWatched) {
    return { status: input.status };
  }

  return {
    status: input.status,
    ...lastWatched,
  };
}

function lastWatchedFields(
  input: ApplyContinueWatchingCompleteInput,
): { lastWatchedSeason: number; lastWatchedEpisode: number } | null {
  if (
    input.mediaType !== "tv" ||
    !isPositiveNumber(input.seasonNumber) ||
    !isPositiveNumber(input.episodeNumber)
  ) {
    return null;
  }

  return {
    lastWatchedSeason: input.seasonNumber,
    lastWatchedEpisode: input.episodeNumber,
  };
}

function isPositiveNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
