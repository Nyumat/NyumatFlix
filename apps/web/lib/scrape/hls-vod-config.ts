/** HLS.js settings tuned for proxied VOD (slow segment fetches, CDN token refresh). */
export const SCRAPE_VOD_HLS_CONFIG = {
  enableWorker: true,
  lowLatencyMode: false,
  startPosition: 0,
  maxBufferLength: 90,
  maxMaxBufferLength: 600,
  maxBufferHole: 0.5,
  maxStarvationDelay: 4,
  nudgeOffset: 0.1,
  nudgeMaxRetry: 6,
  highBufferWatchdogPeriod: 2,
  fragLoadingTimeOut: 60_000,
  fragLoadingMaxRetry: 6,
  levelLoadingMaxRetry: 4,
  manifestLoadingMaxRetry: 4,
} as const;
