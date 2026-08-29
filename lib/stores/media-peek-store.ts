import type { MediaPeekTarget } from "@/lib/peek/media-peek-target";
import { create } from "zustand";

type MediaPeekStoreState = {
  target: MediaPeekTarget | null;
  openPeek: (target: MediaPeekTarget) => void;
  closePeek: () => void;
};

export const useMediaPeekStore = create<MediaPeekStoreState>((set) => ({
  target: null,
  openPeek: (target) => set({ target }),
  closePeek: () => set({ target: null }),
}));
