export const CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY =
  "nyumatflix.continueWatching.dismissed";

export type ContinueWatchingMediaType = "movie" | "tv";

export type ContinueWatchingDismissal = {
  dismissedAt: number;
};

export type ContinueWatchingDismissalMap = Record<
  string,
  ContinueWatchingDismissal
>;

export type ContinueWatchingTitleRef = {
  mediaType: ContinueWatchingMediaType;
  contentId: number;
  updatedAt: number;
};

const guestDismissals: ContinueWatchingDismissalMap = {};

export const continueWatchingTitleKey = (
  mediaType: ContinueWatchingMediaType,
  contentId: number,
): string => `${mediaType}:${contentId}`;

export const readContinueWatchingDismissals =
  (): ContinueWatchingDismissalMap => ({ ...guestDismissals });

export const dismissContinueWatchingTitle = (
  mediaType: ContinueWatchingMediaType,
  contentId: number,
  dismissedAt: number = Date.now(),
): void => {
  guestDismissals[continueWatchingTitleKey(mediaType, contentId)] = {
    dismissedAt,
  };

  void fetch("/api/watchlist/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mediaType, contentId, dismissedAt }),
  }).catch(() => {
    void 0;
  });
};

export const isContinueWatchingTitleDismissed = (
  input: ContinueWatchingTitleRef,
  dismissals: ContinueWatchingDismissalMap = readContinueWatchingDismissals(),
): boolean => {
  const entry =
    dismissals[continueWatchingTitleKey(input.mediaType, input.contentId)];
  if (!entry || typeof entry.dismissedAt !== "number") {
    return false;
  }

  return entry.dismissedAt >= input.updatedAt;
};

export const filterDismissedContinueWatching = <
  T extends ContinueWatchingTitleRef,
>(
  items: T[],
  dismissals: ContinueWatchingDismissalMap = readContinueWatchingDismissals(),
): T[] =>
  items.filter((item) => !isContinueWatchingTitleDismissed(item, dismissals));

export const dismissalsFromWatchlist = (
  items: Array<{
    mediaType: ContinueWatchingMediaType;
    contentId: number;
    dismissedAt: Date | null;
  }>,
): ContinueWatchingDismissalMap => {
  const map: ContinueWatchingDismissalMap = {};
  for (const item of items) {
    if (!item.dismissedAt) {
      continue;
    }
    map[continueWatchingTitleKey(item.mediaType, item.contentId)] = {
      dismissedAt: new Date(item.dismissedAt).getTime(),
    };
  }
  return map;
};
