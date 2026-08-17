import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppSettingsState {
  noAdsMode: boolean;
  disableHeroTrailers: boolean;
  disableHoverSound: boolean;
  setNoAdsMode: (enabled: boolean) => void;
  setDisableHeroTrailers: (enabled: boolean) => void;
  setDisableHoverSound: (enabled: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      noAdsMode: false,
      disableHeroTrailers: false,
      disableHoverSound: false,
      setNoAdsMode: (enabled) => set({ noAdsMode: enabled }),
      setDisableHeroTrailers: (enabled) =>
        set({ disableHeroTrailers: enabled }),
      setDisableHoverSound: (enabled) => set({ disableHoverSound: enabled }),
    }),
    {
      name: "app-settings-storage",
    },
  ),
);
