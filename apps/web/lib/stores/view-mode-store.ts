import { create } from "zustand";

export type ViewMode = "grid" | "list";

interface ViewModeState {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  getResponsiveDefault: () => ViewMode;
}

export const useViewModeStore = create<ViewModeState>()((set) => ({
  viewMode: "grid",
  setViewMode: (mode) => set({ viewMode: mode }),
  getResponsiveDefault: () => {
    const width = window.innerWidth;
    if (width < 768) return "list";
    return "grid";
  },
}));
