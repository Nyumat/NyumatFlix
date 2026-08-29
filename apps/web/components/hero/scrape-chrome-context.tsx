"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { HeroScrapeChrome } from "@/components/hero/hero-scrape-types";

const defaultChrome: HeroScrapeChrome = {
  scrapeStatus: "idle",
  activeProviderId: null,
  activeProviderName: null,
  scrapeItems: [],
  scrapeProviders: [],
  onSelectScrapeProvider: null,
  onFindNextSource: null,
  canFindNextSource: false,
};

const ScrapeChromeContext = createContext<HeroScrapeChrome>(defaultChrome);

export function ScrapeChromeProvider({
  chrome,
  children,
}: {
  chrome: HeroScrapeChrome;
  children: ReactNode;
}) {
  return (
    <ScrapeChromeContext.Provider value={chrome}>
      {children}
    </ScrapeChromeContext.Provider>
  );
}

export function useScrapeChrome() {
  return useContext(ScrapeChromeContext);
}
