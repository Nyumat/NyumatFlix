import type { UseScrapeReturn } from "@/hooks/use-scrape";

export type HeroScrapeChrome = {
  scrapeStatus: UseScrapeReturn["status"];
  activeProviderId: string | null;
  activeProviderName: string | null;
  scrapeProviders: Array<{
    providerId: string;
    name: string;
    group?: "anime" | "tmdb";
  }>;
  onSelectScrapeProvider: ((providerId: string) => void) | null;
  onFindNextSource: (() => void) | null;
  canFindNextSource: boolean;
};
