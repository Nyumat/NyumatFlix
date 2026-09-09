/** HLS.js settings tuned for proxied VOD (slow segment fetches, CDN token refresh). */
export const SCRAPE_VOD_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  startPosition: 0,
  maxBufferLength: 30,
  maxMaxBufferLength: 90,
  maxBufferHole: 0.5,
  maxStarvationDelay: 12,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 6,
  highBufferWatchdogPeriod: 2,
  fragLoadingTimeOut: 60_000,
  fragLoadingMaxRetry: 6,
  levelLoadingMaxRetry: 4,
  manifestLoadingMaxRetry: 4,
} as const;

export type ScrapeVodHlsConfig = {
  [K in keyof typeof SCRAPE_VOD_HLS_CONFIG]: K extends "startPosition"
    ? number
    : (typeof SCRAPE_VOD_HLS_CONFIG)[K];
};

export const buildScrapeVodHlsConfig = (resumeTime: number): ScrapeVodHlsConfig => ({
  ...SCRAPE_VOD_HLS_CONFIG,
  startPosition: resumeTime > 0 ? resumeTime : 0,
});
