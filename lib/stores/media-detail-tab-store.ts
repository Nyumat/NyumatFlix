import { create } from "zustand";

export type MediaDetailTabOwner = "tv" | "movie";

export const mediaDetailTabStoreKey = (
  mediaType: MediaDetailTabOwner,
  id: string,
): string => `${mediaType}:${id}`;

type MediaDetailTabStoreState = {
  tabs: Record<string, string>;
  setMediaDetailTab: (
    mediaType: MediaDetailTabOwner,
    id: string,
    tab: string,
  ) => void;
  getMediaDetailTab: (
    mediaType: MediaDetailTabOwner,
    id: string,
  ) => string | undefined;
};

export const useMediaDetailTabStore = create<MediaDetailTabStoreState>(
  (set, get) => ({
    tabs: {},
    setMediaDetailTab: (mediaType, id, tab) => {
      const storeKey = mediaDetailTabStoreKey(mediaType, id);
      set((s) => {
        if (mediaType === "movie" && tab === "") {
          const { [storeKey]: _, ...rest } = s.tabs;
          return { tabs: rest };
        }
        return { tabs: { ...s.tabs, [storeKey]: tab } };
      });
    },
    getMediaDetailTab: (mediaType, id) =>
      get().tabs[mediaDetailTabStoreKey(mediaType, id)],
  }),
);

export const useMediaDetailTab = (mediaType: MediaDetailTabOwner, id: string) =>
  useMediaDetailTabStore((s) => s.tabs[mediaDetailTabStoreKey(mediaType, id)]);
