"use client";

import { createContext, useContext } from "react";

type LiveTvGuideContextValue = {
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
};

const LiveTvGuideContext = createContext<LiveTvGuideContextValue | null>(null);

export function LiveTvGuideProvider({
  children,
  guideOpen,
  setGuideOpen,
}: {
  children: React.ReactNode;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
}) {
  return (
    <LiveTvGuideContext.Provider value={{ guideOpen, setGuideOpen }}>
      {children}
    </LiveTvGuideContext.Provider>
  );
}

export const useLiveTvGuide = () => {
  const context = useContext(LiveTvGuideContext);

  if (!context) {
    throw new Error("useLiveTvGuide must be used within LiveTvGuideProvider");
  }

  return context;
};
