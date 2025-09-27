"use client";

import { createContext, useContext, useState } from "react";
import type { ViewMode } from "@/components/content-grid";
import { ViewModeCompactDock } from "@/components/ui/compact-dock";

interface GlobalDockContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  showDock: boolean;
  setShowDock: (show: boolean) => void;
}

const GlobalDockContext = createContext<GlobalDockContextType | null>(null);

export function useGlobalDock() {
  const context = useContext(GlobalDockContext);
  if (!context) {
    throw new Error("useGlobalDock must be used within a GlobalDockProvider");
  }
  return context;
}

interface GlobalDockProviderProps {
  children: React.ReactNode;
}

export function GlobalDockProvider({ children }: GlobalDockProviderProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [showDock, setShowDock] = useState(false);

  return (
    <GlobalDockContext.Provider
      value={{
        viewMode,
        setViewMode,
        showDock,
        setShowDock,
      }}
    >
      {children}
      {showDock && (
        <ViewModeCompactDock
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          position="bottom-right"
          showScrollToTop={true}
        />
      )}
    </GlobalDockContext.Provider>
  );
}
