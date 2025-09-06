import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewMode = "grid" | "list";

interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  getResponsiveDefault: () => ViewMode;
}

export const useViewModeStore = create<ViewModeState>()(
  persist(
    (set) => ({
      viewMode: "grid",
      setViewMode: (mode) => set({ viewMode: mode }),
      getResponsiveDefault: () => {
        const width = window.innerWidth;
        if (width < 768) return "list";
        return "grid";
      },
    }),
    {
      name: "view-mode-storage", // unique name for localStorage
    },
  ),
);
