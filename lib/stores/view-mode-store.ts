import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "grid" | "list";

interface ViewModeStore {
  viewMode: ViewMode | null;
  setViewMode: (mode: ViewMode) => void;
  getResponsiveDefault: () => ViewMode;
}

export const useViewModeStore = create<ViewModeStore>()(
  persist(
    (set, get) => ({
      viewMode: null, // null means use responsive default
      setViewMode: (mode) => set({ viewMode: mode }),
      getResponsiveDefault: () => {
        // This will be calculated on the client side
        if (typeof window !== "undefined") {
          return window.innerWidth <= 768 ? "list" : "grid";
        }
        return "grid";
      },
    }),
    {
      name: "view-mode-storage", // name of the item in storage
    },
  ),
);
