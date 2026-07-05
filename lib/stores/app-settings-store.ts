import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppSettingsState {
  noAdsMode: boolean;
  disableHeroTrailers: boolean;
  setNoAdsMode: (enabled: boolean) => void;
  setDisableHeroTrailers: (enabled: boolean) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      noAdsMode: false,
      disableHeroTrailers: false,
      setNoAdsMode: (enabled) => set({ noAdsMode: enabled }),
      setDisableHeroTrailers: (enabled) =>
        set({ disableHeroTrailers: enabled }),
    }),
    {
      name: "app-settings-storage",
    },
  ),
);
