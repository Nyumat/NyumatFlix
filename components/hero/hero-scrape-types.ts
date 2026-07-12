import type { UseScrapeReturn } from "@/hooks/use-scrape";
import type { ScrapeItem } from "@/lib/scrape/types";

export type HeroScrapeChrome = {
  scrapeStatus: UseScrapeReturn["status"];
  activeProviderId: string | null;
  activeProviderName: string | null;
  scrapeItems: ScrapeItem[];
  scrapeProviders: Array<{
    providerId: string;
    name: string;
    group?: "anime" | "tmdb";
  }>;
  onSelectScrapeProvider: ((providerId: string) => void) | null;
  onFindNextSource: (() => void) | null;
  canFindNextSource: boolean;
};
