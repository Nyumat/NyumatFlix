const BULK_MEDIA_SHELL_MAX_ITEMS = 20;

export type BulkMediaShellRequestItem = {
  mediaType: "movie" | "tv";
  contentId: number;
};

export type BulkMediaShellResponseItem = {
  mediaType: "movie" | "tv";
  contentId: number;
  title?: string;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
};

const shellKey = (item: {
  mediaType: "movie" | "tv";
  contentId: number;
}): string => `${item.mediaType}:${item.contentId}`;

export async function fetchBulkMediaShellsClient(
  items: BulkMediaShellRequestItem[],
): Promise<Map<string, BulkMediaShellResponseItem>> {
  const unique: BulkMediaShellRequestItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = shellKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= BULK_MEDIA_SHELL_MAX_ITEMS) break;
  }

  if (unique.length === 0) {
    return new Map();
  }

  const response = await fetch("/api/media/bulk-shell", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: unique }),
  });

  if (!response.ok) {
    return new Map();
  }

  const payload = (await response.json()) as {
    items?: Array<BulkMediaShellResponseItem | null>;
  };
  const shells = new Map<string, BulkMediaShellResponseItem>();

  for (const item of payload.items ?? []) {
    if (!item) continue;
    shells.set(shellKey(item), item);
  }

  return shells;
}
