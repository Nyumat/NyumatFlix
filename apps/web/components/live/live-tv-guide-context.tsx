"use client";

import { createContext, useContext } from "react";

type LiveTvGuideContextValue = {
  shareUrl: string | null;
};

const LiveTvGuideContext = createContext<LiveTvGuideContextValue | null>(null);

export function LiveTvGuideProvider({
  children,
  shareUrl,
}: {
  children: React.ReactNode;
  shareUrl: string | null;
}) {
  return (
    <LiveTvGuideContext.Provider value={{ shareUrl }}>
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
