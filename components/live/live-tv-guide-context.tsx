"use client";

import { createContext, useContext } from "react";

type LiveTvGuideContextValue = {
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  shareUrl: string | null;
};

const LiveTvGuideContext = createContext<LiveTvGuideContextValue | null>(null);

export function LiveTvGuideProvider({
  children,
  guideOpen,
  setGuideOpen,
  shareUrl,
}: {
  children: React.ReactNode;
  guideOpen: boolean;
  setGuideOpen: (open: boolean) => void;
  shareUrl: string | null;
}) {
  return (
    <LiveTvGuideContext.Provider value={{ guideOpen, setGuideOpen, shareUrl }}>
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
