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

export const continueWatchingTitleKey = (
  mediaType: ContinueWatchingMediaType,
  contentId: number,
): string => `${mediaType}:${contentId}`;

export const readContinueWatchingDismissals =
  (): ContinueWatchingDismissalMap => {
    if (typeof window === "undefined") {
      return {};
    }

    try {
      const raw = window.localStorage.getItem(
        CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY,
      );
      if (!raw) {
        return {};
      }

      const parsed = JSON.parse(raw) as ContinueWatchingDismissalMap;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

const writeMap = (map: ContinueWatchingDismissalMap): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      CONTINUE_WATCHING_DISMISSALS_STORAGE_KEY,
      JSON.stringify(map),
    );
  } catch {
    void 0;
  }
};

export const dismissContinueWatchingTitle = (
  mediaType: ContinueWatchingMediaType,
  contentId: number,
  dismissedAt: number = Date.now(),
): void => {
  if (typeof window === "undefined") {
    return;
  }

  const map = readContinueWatchingDismissals();
  map[continueWatchingTitleKey(mediaType, contentId)] = { dismissedAt };
  writeMap(map);
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
