import { create } from "zustand";

type RootTrailerAudioStore = {
  peekTrailerActive: boolean;
  setPeekTrailerActive: (active: boolean) => void;
};

export const useRootTrailerAudioStore = create<RootTrailerAudioStore>(
  (set) => ({
    peekTrailerActive: false,
    setPeekTrailerActive: (active) => set({ peekTrailerActive: active }),
  }),
);
