export type ScrapeLoadingTip =
  | string
  | { type: "link"; text: string; href: string };

export const SCRAPE_LOADING_TIPS: readonly ScrapeLoadingTip[] = [
  "Proxies may take 10-15 seconds to load. Be patient.",
  {
    type: "link",
    text: "Click here to unlock early access to new features.",
    href: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  "We automatically store your watch progress.",
  "You can switch to no-ads mode in the navigation menu.",
  "Want a watchlist? Make an account!",
  "If playback buffers, is low quality, or stops, try another source.",
];

export const SCRAPE_LOADING_TIP_INTERVAL_MS = 4_500;
